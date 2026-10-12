#!/usr/bin/env node
/**
 * connaissances.js — RAG local sur 06-data/ : index vectoriel du TEXTE des
 * fichiers (personnalité, sagesse...) et recherche par le sens.
 *
 * Pourquoi (voir documentation/historique-du-projet.md, round 25) : avant
 * ce module, rien ne lisait réellement 06-data/ pour le modèle —
 * meta-index.json ne liste que des noms et des empreintes, et la recherche
 * se faisait par grep de mots-clés. Pire, Cahier 2.md et Cahier 3.md sont
 * à 99 % des images encodées en base64 (7 et 25 Mo, pour 48 et 125 Ko de
 * texte) : lus tels quels, ils noient le modèle sous du bruit tronqué.
 *
 * - Texte seul : images base64 (Markdown, HTML, longues suites) retirées
 *   et comptées, jamais indexées.
 * - Embeddings par Ollama, modèle léger multilingue, FORCÉ SUR LE CPU
 *   (num_gpu: 0, petit num_ctx) : mesuré, sur GPU il ne tient pas à côté
 *   des 21 Go de qwen3-coder (limite GPU 22,5 Go) et Ollama décharge le
 *   gros modèle à chaque appel ; sur CPU les deux cohabitent (1,4 Go).
 * - Index incrémental : un fichier n'est ré-encodé que si son contenu a
 *   changé (empreinte sha256).
 *
 * Usage :
 *   node 04-scripts/connaissances.js indexer
 *   node 04-scripts/connaissances.js rechercher "<question>" [--k 5]
 * Sortie : JSON sur la dernière ligne de stdout.
 */
import { readFile, writeFile, readdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { logInfo, logError } from './dsh-logger.js';
import { HARNESS_HOME } from './config.js';

const COMPOSANT = 'connaissances';
export const DOSSIER = path.join(HARNESS_HOME, '06-data');
export const FICHIER_INDEX = path.join(DOSSIER, 'index-vectoriel.json');
const MODELE = process.env.CONNAISSANCES_MODELE || 'qwen3-embedding:0.6b';
const OLLAMA = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const OPTIONS_OLLAMA = { num_gpu: 0, num_ctx: 1024 };
const EXTENSIONS = new Set(['.md', '.txt', '.csv']);
const EXCLUS = new Set(['memoire', 'meta-index.json', 'index-vectoriel.json']);
const TAILLE_PASSAGE = 800;
// Recommandation de Qwen3-Embedding : instruction côté requête seulement.
const INSTRUCTION = 'Instruct: Étant donné une question ou un message, retrouver les passages qui aident à y répondre\nQuery: ';

/** Retire les images encodées ; renvoie le texte et le nombre d'images retirées. */
export function texteSansImages(brut) {
  let images = 0;
  const compter = () => { images += 1; return ''; };
  const texte = brut
    .replace(/!\[[^\]]*\]\(data:[^)]*\)/g, compter)
    .replace(/<img[^>]*src=["']data:[^"']*["'][^>]*>/gi, compter)
    .replace(/^\[[^\]]+\]:\s*<?data:[^\s>]+>?.*$/gm, compter)
    .replace(/[A-Za-z0-9+/=]{200,}/g, compter)
    // Artefacts d'export (Word/Notion) qui brouillent la recherche :
    // gras éclaté (**ques****t****ion**), sauts <br>, bordures de tableau.
    .replace(/\*\*/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/^\|?[\s|:-]*\|[\s|:-]*$/gm, '')
    .replace(/\|/g, ' ');
  return { texte, images };
}

/** Découpe en passages d'environ TAILLE_PASSAGE caractères, sur les
 * paragraphes (ou les lignes pour un CSV), sans couper un paragraphe
 * plus court que la taille visée. */
export function decouper(texte, estCsv = false) {
  const blocs = (estCsv ? texte.split('\n') : texte.split(/\n\s*\n/)).map((b) => b.trim()).filter((b) => b.length > 0);
  const passages = [];
  let courant = '';
  for (const bloc of blocs) {
    if (bloc.length > TAILLE_PASSAGE * 1.5) {
      if (courant) { passages.push(courant); courant = ''; }
      for (let i = 0; i < bloc.length; i += TAILLE_PASSAGE) passages.push(bloc.slice(i, i + TAILLE_PASSAGE));
      continue;
    }
    if (courant && courant.length + bloc.length + 2 > TAILLE_PASSAGE) { passages.push(courant); courant = ''; }
    courant = courant ? `${courant}\n\n${bloc}` : bloc;
  }
  if (courant) passages.push(courant);
  return passages.filter((p) => p.replace(/[\s|,;"'-]/g, '').length >= 20);
}

async function encoder(textes) {
  const vecteurs = [];
  for (let i = 0; i < textes.length; i += 32) {
    const lot = textes.slice(i, i + 32);
    const reponse = await fetch(`${OLLAMA}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODELE, input: lot, options: OPTIONS_OLLAMA, keep_alive: '30m' }),
    });
    if (!reponse.ok) throw new Error(`Ollama /api/embed : HTTP ${reponse.status} — ${await reponse.text()}`);
    const { embeddings } = await reponse.json();
    if (!Array.isArray(embeddings) || embeddings.length !== lot.length) throw new Error('Ollama /api/embed : réponse inattendue');
    vecteurs.push(...embeddings.map(normaliser));
  }
  return vecteurs;
}

function normaliser(v) {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => Math.round((x / n) * 1e5) / 1e5);
}

async function lister(dossier) {
  const fichiers = [];
  for (const entree of await readdir(dossier, { withFileTypes: true })) {
    if (entree.name.startsWith('.') || EXCLUS.has(entree.name)) continue;
    const chemin = path.join(dossier, entree.name);
    if (entree.isDirectory()) fichiers.push(...await lister(chemin));
    else if (EXTENSIONS.has(path.extname(entree.name).toLowerCase())) fichiers.push(chemin);
  }
  return fichiers;
}

async function lireIndex() {
  try {
    const index = JSON.parse(await readFile(FICHIER_INDEX, 'utf-8'));
    return index.modele === MODELE ? index : { modele: MODELE, fichiers: {} };
  } catch {
    return { modele: MODELE, fichiers: {} };
  }
}

/** Met à jour l'index : ré-encode seulement les fichiers modifiés, retire les fichiers disparus. */
export async function indexer() {
  const ancien = await lireIndex();
  const index = { modele: MODELE, miseAJour: new Date().toISOString(), fichiers: {} };
  let encodes = 0, imagesRetirees = 0;
  for (const chemin of await lister(DOSSIER)) {
    const relatif = path.relative(DOSSIER, chemin);
    const brut = await readFile(chemin, 'utf-8');
    const empreinte = crypto.createHash('sha256').update(brut).digest('hex');
    const precedent = ancien.fichiers[relatif];
    if (precedent?.empreinte === empreinte) { index.fichiers[relatif] = precedent; imagesRetirees += precedent.images; continue; }
    const { texte, images } = texteSansImages(brut);
    const passages = decouper(texte, chemin.endsWith('.csv'));
    const vecteurs = await encoder(passages);
    index.fichiers[relatif] = { empreinte, images, passages: passages.map((t, i) => ({ texte: t, vecteur: vecteurs[i] })) };
    encodes += 1;
    imagesRetirees += images;
  }
  await writeFile(FICHIER_INDEX, JSON.stringify(index));
  const nbPassages = Object.values(index.fichiers).reduce((n, f) => n + f.passages.length, 0);
  const bilan = { fichiers: Object.keys(index.fichiers).length, reencodes: encodes, passages: nbPassages, images_retirees: imagesRetirees };
  logInfo(COMPOSANT, `Index vectoriel à jour : ${bilan.fichiers} fichier(s), ${nbPassages} passage(s), ${encodes} ré-encodé(s)`, { context: bilan });
  return bilan;
}

/** Les k passages les plus proches de la question, avec leur fichier et leur score (cosinus). */
export async function rechercher(question, k = 5) {
  const index = await lireIndex();
  const tous = Object.entries(index.fichiers).flatMap(([fichier, f]) => f.passages.map((p) => ({ fichier, ...p })));
  if (tous.length === 0) throw new Error(`Index vide ou absent (${FICHIER_INDEX}) — lance d'abord : node 04-scripts/connaissances.js indexer`);
  const [q] = await encoder([INSTRUCTION + question]);
  return tous
    .map(({ fichier, texte, vecteur }) => ({ fichier, score: Math.round(vecteur.reduce((s, x, i) => s + x * q[i], 0) * 1000) / 1000, texte }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    else args._.push(argv[i]);
  }
  return args;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const [commande, question] = args._;
  try {
    if (commande === 'indexer') console.log(JSON.stringify(await indexer()));
    else if (commande === 'rechercher' && question) console.log(JSON.stringify(await rechercher(question, Number(args.k ?? 5)), null, 2));
    else {
      console.error('Usage : node 04-scripts/connaissances.js indexer | rechercher "<question>" [--k 5]');
      process.exit(1);
    }
  } catch (err) {
    logError(COMPOSANT, `Échec de "${commande}"`, { err });
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}

