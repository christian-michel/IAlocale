#!/usr/bin/env node
/**
 * memoire-cli.js — mémoire d'expériences structurée, que l'agent peut
 * créer/lire/modifier/supprimer/vider lui-même (CRUD complet), en CLI.
 *
 * Différence avec 06-data/sagesse/lecons-apprises.md : ce fichier-là est du
 * texte libre, indexé pour la recherche sémantique (RAG) par
 * watch-knowledge-base.js. Cette mémoire-ci est structurée (type, tags,
 * confiance) et interrogeable par champ exact — pour des faits ou
 * observations que l'agent veut pouvoir retrouver, corriger ou effacer
 * précisément, pas seulement relire en contexte. Les deux coexistent :
 * voir 01-skills/skill-gestion-memoire.md pour la répartition des usages.
 *
 * Stockage : un unique fichier JSON (06-data/memoire/memoire.json), pas de
 * base SQL — cohérent avec le reste du projet (JSON/JSONL/YAML partout) et
 * sans dépendance native à compiler sur le Mac cible.
 *
 * Usage :
 *   node memoire-cli.js set --type <type> --contenu "texte" [--id <id>]
 *                            [--tags a,b,c] [--confiance 0-10] [--source ...]
 *   node memoire-cli.js get --id <id>
 *   node memoire-cli.js list [--type <type>] [--tag <tag>] [--n 50]
 *   node memoire-cli.js search --q "texte" [--type <type>]
 *   node memoire-cli.js delete --id <id>
 *   node memoire-cli.js clear [--type <type>] --confirm
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { logInfo, logError } from './dsh-logger.js';

const HARNESS_HOME = process.env.HARNESS_HOME || path.join(os.homedir(), 'dsh-harness');
const MEMOIRE_DIR = path.join(HARNESS_HOME, '06-data', 'memoire');
const MEMOIRE_FILE = path.join(MEMOIRE_DIR, 'memoire.json');

const COMPOSANT = 'memoire-cli';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      args[key] = val;
    } else {
      args._.push(argv[i]);
    }
  }
  return args;
}

/** Charge le magasin mémoire. Un fichier absent est le cas normal du
 * premier lancement (pas une erreur) ; un fichier présent mais corrompu
 * est une vraie erreur — on refuse de continuer plutôt que d'écraser
 * silencieusement des données existantes avec un magasin vide. */
function chargerMagasin() {
  if (!existsSync(MEMOIRE_FILE)) {
    return { entries: {} };
  }
  const brut = readFileSync(MEMOIRE_FILE, 'utf-8');
  try {
    const magasin = JSON.parse(brut);
    magasin.entries ||= {};
    return magasin;
  } catch (err) {
    logError(COMPOSANT, `Magasin mémoire corrompu (${MEMOIRE_FILE}) — refus d'écraser, corrige ou supprime le fichier manuellement`, { err });
    console.error(`❌ ${MEMOIRE_FILE} n'est pas un JSON valide. Rien n'a été modifié.`);
    process.exit(1);
  }
}

function sauvegarderMagasin(magasin) {
  try {
    mkdirSync(MEMOIRE_DIR, { recursive: true });
    writeFileSync(MEMOIRE_FILE, JSON.stringify(magasin, null, 2), 'utf-8');
  } catch (err) {
    // Un échec d'écriture ici doit être bruyant : sinon l'agent croit avoir
    // mémorisé quelque chose qui n'a en réalité jamais été persisté.
    logError(COMPOSANT, `Échec d'écriture du magasin mémoire (${MEMOIRE_FILE})`, { err });
    console.error(`❌ Impossible d'écrire ${MEMOIRE_FILE} : ${err.message}`);
    process.exit(1);
  }
}

function parseTags(valeur) {
  if (!valeur || valeur === true) return [];
  return String(valeur).split(',').map(t => t.trim()).filter(Boolean);
}

const args = parseArgs(process.argv.slice(2));
const commande = args._[0];

if (commande === 'set') {
  if (!args.type || !args.contenu || args.contenu === true) {
    console.error('Usage : set --type <type> --contenu "texte" [--id <id>] [--tags a,b] [--confiance 0-10] [--source ...]');
    process.exit(1);
  }
  const magasin = chargerMagasin();
  const maintenant = new Date().toISOString();
  const id = (typeof args.id === 'string' && args.id) ? args.id : crypto.randomUUID();
  const existante = magasin.entries[id];

  magasin.entries[id] = {
    id,
    type: args.type,
    contenu: args.contenu,
    tags: args.tags !== undefined ? parseTags(args.tags) : (existante?.tags || []),
    confiance: args.confiance !== undefined ? Number(args.confiance) : (existante?.confiance ?? null),
    source: typeof args.source === 'string' ? args.source : (existante?.source || null),
    creee_le: existante?.creee_le || maintenant,
    modifiee_le: maintenant,
  };
  sauvegarderMagasin(magasin);
  logInfo(COMPOSANT, existante ? `Entrée mémoire mise à jour (${id})` : `Nouvelle entrée mémoire créée (${id})`, {
    context: { id, type: args.type },
  });
  console.log(JSON.stringify(magasin.entries[id], null, 2));

} else if (commande === 'get') {
  if (!args.id) {
    console.error('Usage : get --id <id>');
    process.exit(1);
  }
  const magasin = chargerMagasin();
  const entree = magasin.entries[args.id];
  if (!entree) {
    console.error(`Introuvable : aucune entrée avec l'id '${args.id}'.`);
    process.exit(1);
  }
  console.log(JSON.stringify(entree, null, 2));

} else if (commande === 'list') {
  const magasin = chargerMagasin();
  let entrees = Object.values(magasin.entries);
  if (args.type) entrees = entrees.filter(e => e.type === args.type);
  if (args.tag) entrees = entrees.filter(e => (e.tags || []).includes(args.tag));
  entrees.sort((a, b) => (b.modifiee_le || '').localeCompare(a.modifiee_le || ''));
  const n = Number(args.n || 50);
  entrees = entrees.slice(0, n);
  console.log(JSON.stringify({ count: entrees.length, entrees }, null, 2));

} else if (commande === 'search') {
  if (!args.q) {
    console.error('Usage : search --q "texte" [--type <type>]');
    process.exit(1);
  }
  const magasin = chargerMagasin();
  const aiguille = String(args.q).toLowerCase();
  let entrees = Object.values(magasin.entries).filter(e =>
    e.contenu.toLowerCase().includes(aiguille) ||
    (e.tags || []).some(t => t.toLowerCase().includes(aiguille))
  );
  if (args.type) entrees = entrees.filter(e => e.type === args.type);
  console.log(JSON.stringify({ count: entrees.length, entrees }, null, 2));

} else if (commande === 'delete') {
  if (!args.id) {
    console.error('Usage : delete --id <id>');
    process.exit(1);
  }
  const magasin = chargerMagasin();
  if (!magasin.entries[args.id]) {
    console.error(`Introuvable : aucune entrée avec l'id '${args.id}'.`);
    process.exit(1);
  }
  delete magasin.entries[args.id];
  sauvegarderMagasin(magasin);
  logInfo(COMPOSANT, `Entrée mémoire supprimée (${args.id})`, { context: { id: args.id } });
  console.log(`✅ Entrée '${args.id}' supprimée.`);

} else if (commande === 'clear') {
  // Effacement en masse (tout, ou un type entier) : geste volontairement
  // irréversible, donc explicite. --confirm n'est pas là pour freiner
  // l'agent — juste pour qu'une faute de frappe sur --type ne vide pas
  // silencieusement toute la mémoire.
  if (!args.confirm) {
    console.error("Usage : clear [--type <type>] --confirm   (le flag --confirm est obligatoire pour un effacement en masse)");
    process.exit(1);
  }
  const magasin = chargerMagasin();
  const avant = Object.keys(magasin.entries).length;
  if (args.type) {
    for (const [id, entree] of Object.entries(magasin.entries)) {
      if (entree.type === args.type) delete magasin.entries[id];
    }
  } else {
    magasin.entries = {};
  }
  const apres = Object.keys(magasin.entries).length;
  sauvegarderMagasin(magasin);
  logInfo(COMPOSANT, `Effacement en masse (${avant - apres} entrée(s) supprimée(s))`, {
    context: { type: args.type || '(toutes)' },
  });
  console.log(`✅ ${avant - apres} entrée(s) supprimée(s).`);

} else {
  console.error(`Commande inconnue : ${commande || '(aucune)'}`);
  console.error('Usage : set | get | list | search | delete | clear');
  process.exit(1);
}
