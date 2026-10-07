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
 *   node memoire-cli.js backup [--raison "texte"]
 *   node memoire-cli.js list-backups
 *   node memoire-cli.js restore --dernier | --fichier <nom> | --horodatage <ts>
 *
 * Backup/restore existe parce que 06-data/memoire/ est explicitement
 * exclu de git (voir .gitignore — "état d'exécution, propre à chaque
 * machine") : contrairement au reste du projet, un commit git ne donne
 * ici aucun point de restauration. `clear` crée maintenant un backup
 * automatique avant d'effacer quoi que ce soit — un effacement reste
 * décidé explicitement (--confirm toujours requis), mais plus jamais
 * irréversible en pratique.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logInfo, logError } from './dsh-logger.js';
import { HARNESS_HOME } from './config.js';

const MEMOIRE_DIR = path.join(HARNESS_HOME, '06-data', 'memoire');
const MEMOIRE_FILE = path.join(MEMOIRE_DIR, 'memoire.json');
const BACKUPS_DIR = path.join(MEMOIRE_DIR, 'backups');

const COMPOSANT = 'memoire-cli';

/** Liste les fichiers de backup disponibles, triés du plus ancien au
 * plus récent (ordre alphabétique = ordre chronologique, l'horodatage
 * ISO le garantit). */
function listerBackups() {
  if (!existsSync(BACKUPS_DIR)) return [];
  return readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.json')).sort();
}

/** Copie le magasin courant dans backups/, horodaté. Ne fait rien (et
 * ne jette pas d'erreur) si memoire.json n'existe pas encore — pas de
 * backup à faire d'un fichier qui n'a jamais existé. */
function creerBackup(raison) {
  if (!existsSync(MEMOIRE_FILE)) return null;
  mkdirSync(BACKUPS_DIR, { recursive: true });
  const horodatage = new Date().toISOString().replace(/[:.]/g, '-');
  const nomFichier = `memoire-${horodatage}.json`;
  const cible = path.join(BACKUPS_DIR, nomFichier);
  copyFileSync(MEMOIRE_FILE, cible);
  logInfo(COMPOSANT, `Point de restauration créé (${nomFichier})${raison ? ` — ${raison}` : ''}`, {
    context: { fichier: nomFichier, raison: raison || null },
  });
  return nomFichier;
}

/** Transforme `process.argv` en objet `{ cle: valeur }`. Convention à
 * connaître pour lire le reste du fichier : `--flag` suivi d'un mot qui
 * ne commence pas par `--` devient `{ flag: "mot" }` ; `--flag` seul
 * (ou suivi d'un autre `--flag`) devient `{ flag: true }`. C'est ce
 * `true` que les blocs de commande plus bas testent (ex.
 * `args.contenu === true`) pour détecter "le flag était là mais sans
 * valeur", distinct de "le flag était absent" (`undefined`). Les
 * arguments sans `--` (positionnels) sont rangés dans `args._` — c'est
 * là que la commande elle-même (`set`, `get`, ...) est récupérée. */
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

/** `--tags a,b,c` → `["a", "b", "c"]`. `valeur === true` couvre le cas
 * "--tags" tapé sans rien derrière (voir la convention de `parseArgs`
 * ci-dessus) — traité comme "aucun tag", pas comme une erreur. */
function parseTags(valeur) {
  if (!valeur || valeur === true) return [];
  return String(valeur).split(',').map(t => t.trim()).filter(Boolean);
}

const args = parseArgs(process.argv.slice(2));
const commande = args._[0];

// Un bloc if/else par sous-commande CLI : chacun valide ses propres
// arguments obligatoires (sinon affiche l'usage et sort en erreur),
// charge le magasin si besoin (chargerMagasin), fait son opération, et
// réécrit le magasin (sauvegarderMagasin) seulement s'il l'a modifié —
// get/list/search sont en lecture seule, pas d'écriture après elles.

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
  // Lecture exacte par id — pas de recherche floue ici, c'est le rôle de `search`.
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
  // Filtre par champ exact (type/tag) puis trie du plus récent au plus
  // ancien (modifiee_le décroissant) — c'est pour ça qu'un `set --id`
  // sur une entrée existante la fait remonter en tête de liste.
  const magasin = chargerMagasin();
  let entrees = Object.values(magasin.entries);
  if (args.type) entrees = entrees.filter(e => e.type === args.type);
  if (args.tag) entrees = entrees.filter(e => (e.tags || []).includes(args.tag));
  entrees.sort((a, b) => (b.modifiee_le || '').localeCompare(a.modifiee_le || ''));
  const n = Number(args.n || 50);
  entrees = entrees.slice(0, n);
  console.log(JSON.stringify({ count: entrees.length, entrees }, null, 2));

} else if (commande === 'search') {
  // Recherche floue (sous-chaîne, insensible à la casse) sur le contenu
  // ET sur les tags — contrairement à `list --tag` qui veut une
  // correspondance exacte d'un seul tag. C'est pourquoi les skills
  // documentent `search --q "mots-clés du contexte"` plutôt que `list`
  // pour retrouver une entrée sans connaître son tag exact.
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
  // Effacement en masse (tout, ou un type entier) : geste explicite
  // (--confirm toujours requis — pas là pour freiner l'agent, juste pour
  // qu'une faute de frappe sur --type ne vide pas silencieusement toute
  // la mémoire), mais plus jamais irréversible en pratique : un backup
  // automatique précède toujours l'effacement, récupérable via `restore`.
  if (!args.confirm) {
    console.error("Usage : clear [--type <type>] --confirm   (le flag --confirm est obligatoire pour un effacement en masse)");
    process.exit(1);
  }
  const nomBackup = creerBackup(`avant clear --type ${args.type || '(toutes)'}`);
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
  console.log(`✅ ${avant - apres} entrée(s) supprimée(s).${nomBackup ? ` Backup avant effacement : ${nomBackup}` : ''}`);

} else if (commande === 'backup') {
  const raison = typeof args.raison === 'string' ? args.raison : null;
  const nomBackup = creerBackup(raison);
  if (!nomBackup) {
    console.log(JSON.stringify({ statut: 'RIEN_A_SAUVEGARDER', message: `${MEMOIRE_FILE} n'existe pas encore.` }, null, 2));
  } else {
    console.log(JSON.stringify({ statut: 'SAUVEGARDE', fichier: nomBackup }, null, 2));
  }

} else if (commande === 'list-backups') {
  const backups = listerBackups();
  console.log(JSON.stringify({ count: backups.length, backups }, null, 2));

} else if (commande === 'restore') {
  const backups = listerBackups();
  let cible;
  if (args.dernier) {
    cible = backups[backups.length - 1];
  } else if (typeof args.fichier === 'string') {
    cible = args.fichier;
  } else if (typeof args.horodatage === 'string') {
    cible = `memoire-${args.horodatage}.json`;
  }
  if (!cible || !backups.includes(cible)) {
    console.error(`❌ Point de restauration introuvable. Disponibles : ${backups.join(', ') || '(aucun)'}`);
    console.error('Usage : restore --dernier | --fichier <nom> | --horodatage <ts>');
    process.exit(1);
  }
  // Une restauration ne doit jamais, elle-même, devenir irréversible :
  // on sauvegarde toujours l'état courant avant de le remplacer.
  const nomBackupAvant = creerBackup(`avant restauration de ${cible}`);
  copyFileSync(path.join(BACKUPS_DIR, cible), MEMOIRE_FILE);
  logInfo(COMPOSANT, `Mémoire restaurée depuis ${cible}`, { context: { fichier: cible, backup_precedent: nomBackupAvant } });
  console.log(JSON.stringify({ statut: 'RESTAUREE', depuis: cible, etat_precedent_sauvegarde_sous: nomBackupAvant }, null, 2));

} else {
  console.error(`Commande inconnue : ${commande || '(aucune)'}`);
  console.error('Usage : set | get | list | search | delete | clear | backup | list-backups | restore');
  process.exit(1);
}
