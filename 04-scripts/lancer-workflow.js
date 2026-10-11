#!/usr/bin/env node
/**
 * lancer-workflow.js — exécute un script de 03-workflows/*.workflow.js via
 * l'outil `workflow` natif de dsh, et VÉRIFIE que c'est bien ce script-là
 * qui a tourné.
 *
 * Pourquoi ce script existe (voir documentation/historique-du-projet.md,
 * round 24) : l'outil `workflow` de dsh (@deepseek-ai/dsh-tool-workflow)
 * n'a pas de registre de définitions — c'est le modèle qui soumet le
 * script dans son appel d'outil. Rien ne garantit qu'un modèle local le
 * recopie fidèlement. Ce lanceur lui donne le script tel quel, puis
 * compare le script réellement soumis (événement `tool_call` du flux
 * `dsh --json`) au fichier source : une recopie altérée est un échec,
 * pas un succès supposé.
 *
 * Format d'un .workflow.js : première ligne `// @meta {...}` (JSON :
 * name, description, phases), puis le corps du script. Les lignes de
 * commentaire entières sont retirées avant l'envoi (moins de texte à
 * recopier pour le modèle) — la comparaison porte sur ce corps-là.
 *
 * Usage :
 *   node 04-scripts/lancer-workflow.js <fichier.workflow.js> ['{"demande":"..."}']
 * Sortie : JSON {statut, script_identique, resultat, dossier} sur la
 * dernière ligne de stdout ; code 0 si le workflow a réellement tourné
 * jusqu'au bout avec le script exact, 1 sinon. Flux complet et prompt
 * conservés dans logs/workflows/<horodatage>-<nom>/.
 */
import { readFileSync, writeFileSync, mkdirSync, createWriteStream } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo, logError } from './dsh-logger.js';

const COMPOSANT = 'lancer-workflow';
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Lit un .workflow.js : meta (ligne `// @meta`) et corps sans les lignes
 * de commentaire entières. */
export function lireWorkflow(cheminFichier) {
  const lignes = readFileSync(cheminFichier, 'utf-8').split('\n');
  const ligneMeta = lignes.find((l) => l.startsWith('// @meta '));
  if (!ligneMeta) throw new Error(`${cheminFichier} : ligne "// @meta {...}" absente`);
  const meta = JSON.parse(ligneMeta.slice('// @meta '.length));
  if (!meta.name || !meta.description) throw new Error(`${cheminFichier} : meta.name et meta.description sont requis`);
  const corps = lignes.filter((l) => !/^\s*\/\//.test(l)).join('\n').trim();
  return { meta, corps };
}

/** Normalisation minimale pour comparer : espaces de fin de ligne et
 * lignes vides en bord — rien qui change le sens du code. */
const normaliser = (texte) => texte.split('\n').map((l) => l.trimEnd()).join('\n').trim();

function construirePrompt(meta, args, corps) {
  return [
    "Appelle l'outil workflow une seule fois, avec exactement les paramètres ci-dessous, sans rien modifier, résumer ni reformater.",
    `meta = ${JSON.stringify(meta)}`,
    `args = ${JSON.stringify(args)}`,
    'script = tout le texte compris entre la ligne ===DEBUT-SCRIPT=== et la ligne ===FIN-SCRIPT===, recopié caractère pour caractère (ces deux lignes exclues).',
    '===DEBUT-SCRIPT===',
    corps,
    '===FIN-SCRIPT===',
    "Une fois l'outil terminé, donne son résultat tel quel.",
  ].join('\n');
}

export function analyserFlux(cheminEvenements, corpsAttendu) {
  const evenements = readFileSync(cheminEvenements, 'utf-8').split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
  const appels = evenements.filter((e) => e.type === 'tool_call' && e.tool === 'workflow');
  if (appels.length === 0) return { statut: 'NON_APPELE', script_identique: false, resultat: null };
  const appel = appels[0];
  const scriptSoumis = appel.input?.script ?? '';
  const identique = normaliser(scriptSoumis) === normaliser(corpsAttendu);
  const resultatOutil = evenements.find((e) => e.type === 'tool_result' && e.callId === appel.callId);
  const texte = resultatOutil?.result ?? null;
  const termine = resultatOutil?.status === 'completed' && typeof texte === 'string' && texte.includes('completed');
  return {
    statut: termine ? 'TERMINE' : (resultatOutil ? 'ECHEC' : 'SANS_RESULTAT'),
    script_identique: identique,
    nb_appels_workflow: appels.length,
    script_soumis: scriptSoumis,
    resultat: texte,
  };
}

async function main() {
  const [fichier, argsBruts] = process.argv.slice(2);
  if (!fichier) {
    console.error('Usage : node 04-scripts/lancer-workflow.js <fichier.workflow.js> [\'{"cle":"valeur"}\']');
    process.exit(1);
  }
  const { meta, corps } = lireWorkflow(path.resolve(fichier));
  const args = argsBruts ? JSON.parse(argsBruts) : {};

  const horodatage = new Date().toISOString().replace(/[:.]/g, '-');
  const dossier = path.join(RACINE, 'logs', 'workflows', `${horodatage}-${meta.name}`);
  mkdirSync(dossier, { recursive: true });
  const prompt = construirePrompt(meta, args, corps);
  writeFileSync(path.join(dossier, 'prompt.txt'), prompt);
  const cheminEvenements = path.join(dossier, 'evenements.jsonl');

  logInfo(COMPOSANT, `Lancement du workflow '${meta.name}'`, { context: { fichier, args, dossier } });
  const debut = Date.now();
  const code = await new Promise((resolve) => {
    const enfant = spawn('dsh', ['--profile', 'headless', '--json', '-'], { cwd: RACINE, stdio: ['pipe', 'pipe', 'pipe'] });
    enfant.stdout.pipe(createWriteStream(cheminEvenements));
    enfant.stderr.pipe(createWriteStream(path.join(dossier, 'stderr.txt')));
    enfant.on('error', (err) => { logError(COMPOSANT, 'Impossible de lancer dsh', { err }); resolve(127); });
    enfant.on('close', resolve);
    enfant.stdin.end(prompt);
  });

  const analyse = analyserFlux(cheminEvenements, corps);
  if (!analyse.script_identique && analyse.script_soumis) {
    writeFileSync(path.join(dossier, 'script-soumis.js'), analyse.script_soumis);
    writeFileSync(path.join(dossier, 'script-attendu.js'), corps);
  }
  const bilan = {
    statut: analyse.statut,
    script_identique: analyse.script_identique,
    nb_appels_workflow: analyse.nb_appels_workflow ?? 0,
    code_dsh: code,
    duree_s: Math.round((Date.now() - debut) / 1000),
    resultat: analyse.resultat,
    dossier: path.relative(RACINE, dossier),
  };
  writeFileSync(path.join(dossier, 'bilan.json'), JSON.stringify(bilan, null, 2));
  const reussi = bilan.statut === 'TERMINE' && bilan.script_identique;
  (reussi ? logInfo : logError)(COMPOSANT, `Workflow '${meta.name}' : ${bilan.statut}, script ${bilan.script_identique ? 'identique' : 'ALTÉRÉ ou absent'}`, { context: { dossier: bilan.dossier, duree_s: bilan.duree_s } });
  console.log(JSON.stringify(bilan));
  process.exit(reussi ? 0 : 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    logError(COMPOSANT, 'Échec inattendu', { err });
    console.error(`❌ ${err.message}`);
    process.exit(1);
  });
}
