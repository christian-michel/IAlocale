#!/usr/bin/env node
/**
 * journal-desaccords.js — consigne chaque fois que decision-rapide.js a
 * été jugé non fiable (confiance sous le seuil) ou en désaccord avec la
 * comparaison délibérative qui a pris le relais. Pas une mémoire que
 * l'agent édite à sa guise (voir memoire-cli.js pour ça) : un historique
 * append-only, pensé comme première brique vers un futur fine-tuning de
 * Laya (voir skill-journal-desaccords.md) — on ne fine-tune rien sans
 * données, et ces données n'existaient nulle part avant ce script.
 *
 * Pourquoi un stockage séparé de memoire.json (memoire-cli.js) plutôt que
 * d'y ajouter un type "desaccord" : ce journal doit pouvoir grossir
 * indéfiniment sans jamais perdre une ligne (pas de delete/clear ici,
 * volontairement — voir plus bas), alors que memoire.json est pensé pour
 * être édité/élagué par l'agent. Format JSON Lines, même principe que
 * logs/pipeline.jsonl : une écriture = une ligne ajoutée, jamais de
 * réécriture du fichier entier.
 *
 * Usage :
 *   node journal-desaccords.js enregistrer --question "..." --type oui-non|choix|note
 *       --moteur ollama|laya --decision-rapide <valeur> --confiance-rapide <0-1>
 *       [--seuil-confiance <0-1>] [--contexte "..."] [--decision-deliberative <valeur>]
 *       [--composant identifier-meilleur]
 *
 *   node journal-desaccords.js resume [--moteur ollama|laya] [--type oui-non|choix|note]
 *   node journal-desaccords.js exporter [--moteur ...] [--type ...] [--resolution desaccord]
 *
 * "resolution" est calculé, jamais déclaré directement :
 *   - "escalade_sans_comparaison" : --decision-deliberative absent (on
 *     sait juste que la voie rapide n'était pas assez sûre)
 *   - "accord" : les deux décisions coïncident (comparaison texte stricte)
 *   - "desaccord" : les deux décisions diffèrent — la ligne la plus utile
 *     pour un futur jeu d'entraînement
 */
import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { logInfo, logError } from './dsh-logger.js';
import { HARNESS_HOME } from './config.js';

const COMPOSANT_DEFAUT = 'journal-desaccords';
const JOURNAL_DIR = path.join(HARNESS_HOME, '06-data', 'memoire');
const JOURNAL_FILE = path.join(JOURNAL_DIR, 'desaccords-laya.jsonl');

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

function lireLignes() {
  if (!existsSync(JOURNAL_FILE)) return [];
  const brut = readFileSync(JOURNAL_FILE, 'utf-8');
  const lignes = [];
  for (const ligne of brut.split('\n')) {
    const t = ligne.trim();
    if (!t) continue;
    try {
      lignes.push(JSON.parse(t));
    } catch (err) {
      // Une ligne corrompue ne doit pas faire disparaître tout le journal
      // ni faire planter la lecture des autres — juste être signalée.
      logError(COMPOSANT_DEFAUT, `Ligne JSONL illisible ignorée dans ${JOURNAL_FILE}`, { err, context: { extrait: t.slice(0, 200) } });
    }
  }
  return lignes;
}

const args = parseArgs(process.argv.slice(2));
const commande = args._[0];
const composant = typeof args.composant === 'string' ? args.composant : COMPOSANT_DEFAUT;

if (commande === 'enregistrer') {
  const requis = ['question', 'type', 'moteur', 'decision-rapide', 'confiance-rapide'];
  const manquants = requis.filter(c => args[c] === undefined || args[c] === true);
  if (manquants.length) {
    console.error(`Usage : enregistrer --question "..." --type oui-non|choix|note --moteur ollama|laya --decision-rapide <valeur> --confiance-rapide <0-1> [--seuil-confiance <0-1>] [--contexte "..."] [--decision-deliberative <valeur>]`);
    console.error(`Champ(s) manquant(s) : ${manquants.join(', ')}`);
    process.exit(1);
  }

  const decisionRapide = String(args['decision-rapide']);
  const decisionDeliberative = args['decision-deliberative'] !== undefined ? String(args['decision-deliberative']) : null;
  const resolution = decisionDeliberative === null
    ? 'escalade_sans_comparaison'
    : (decisionRapide === decisionDeliberative ? 'accord' : 'desaccord');

  const entree = {
    horodatage: new Date().toISOString(),
    question: args.question,
    contexte: typeof args.contexte === 'string' ? args.contexte : null,
    type: args.type,
    moteur: args.moteur,
    decision_rapide: decisionRapide,
    confiance_rapide: Number(args['confiance-rapide']),
    seuil_confiance: args['seuil-confiance'] !== undefined ? Number(args['seuil-confiance']) : null,
    decision_deliberative: decisionDeliberative,
    resolution,
  };

  try {
    mkdirSync(JOURNAL_DIR, { recursive: true });
    appendFileSync(JOURNAL_FILE, JSON.stringify(entree) + '\n', 'utf-8');
  } catch (err) {
    logError(composant, `Échec d'écriture dans ${JOURNAL_FILE}`, { err });
    console.error(`❌ Impossible d'écrire dans ${JOURNAL_FILE} : ${err.message}`);
    process.exit(1);
  }

  logInfo(composant, `Désaccord consigné (résolution=${resolution}, moteur=${entree.moteur}, confiance=${entree.confiance_rapide})`, {
    context: { type: entree.type, resolution },
  });
  console.log(JSON.stringify(entree, null, 2));

} else if (commande === 'resume') {
  let lignes = lireLignes();
  if (args.moteur) lignes = lignes.filter(l => l.moteur === args.moteur);
  if (args.type) lignes = lignes.filter(l => l.type === args.type);

  const parResolution = {};
  const parMoteur = {};
  const parType = {};
  let sommeConfianceDesaccord = 0, nDesaccord = 0;
  let sommeConfianceAccord = 0, nAccord = 0;

  for (const l of lignes) {
    parResolution[l.resolution] = (parResolution[l.resolution] || 0) + 1;
    parMoteur[l.moteur] = (parMoteur[l.moteur] || 0) + 1;
    parType[l.type] = (parType[l.type] || 0) + 1;
    if (l.resolution === 'desaccord') { sommeConfianceDesaccord += l.confiance_rapide; nDesaccord++; }
    if (l.resolution === 'accord') { sommeConfianceAccord += l.confiance_rapide; nAccord++; }
  }

  console.log(JSON.stringify({
    total: lignes.length,
    par_resolution: parResolution,
    par_moteur: parMoteur,
    par_type: parType,
    confiance_moyenne_sur_desaccord: nDesaccord ? +(sommeConfianceDesaccord / nDesaccord).toFixed(3) : null,
    confiance_moyenne_sur_accord: nAccord ? +(sommeConfianceAccord / nAccord).toFixed(3) : null,
  }, null, 2));

} else if (commande === 'exporter') {
  let lignes = lireLignes();
  if (args.moteur) lignes = lignes.filter(l => l.moteur === args.moteur);
  if (args.type) lignes = lignes.filter(l => l.type === args.type);
  if (args.resolution) lignes = lignes.filter(l => l.resolution === args.resolution);
  // Format brut, une ligne JSON par entrée — le format d'entraînement
  // réel (quel que soit l'outil de fine-tuning utilisé plus tard) n'est
  // pas encore connu, donc pas inventé ici : à adapter le moment venu.
  for (const l of lignes) console.log(JSON.stringify(l));

} else {
  console.error(`Commande inconnue : ${commande || '(aucune)'}`);
  console.error('Usage : enregistrer | resume | exporter');
  process.exit(1);
}
