#!/usr/bin/env node
/**
 * decision-rapide.js — mécanisme de décision rapide inspiré de JEV
 * (TypeSafe AI, "System One Model" : https://simonwillison.net/2026/Sep/21/jev/).
 * JEV lui-même est un service cloud payant (non local, voir README section
 * "Auto-itération"), mais son idée se reproduit entièrement en local : pour
 * une question FERMÉE (oui/non, choix dans une liste, note chiffrée), pas
 * besoin de faire générer une réponse complète par un modèle.
 *
 * Deux moteurs, choisis avec --moteur :
 *
 *   - "ollama" (défaut) : appel contraint au gros modèle déjà configuré
 *     (sortie forcée par JSON Schema via `/api/chat`, température 0).
 *     N'ajoute aucune dépendance, mais sollicite le même modèle qui sert
 *     aussi à générer — voir README, section "Décision rapide".
 *
 *   - "laya" : Laya (Convai Innovations, Apache 2.0), un encodeur dédié de
 *     421M de paramètres (~2 Go de RAM), gratuit et local, qui tourne à
 *     côté du gros modèle sans lui disputer la RAM. Nécessite
 *     `npm install` (voir package.json — seule dépendance npm de ce
 *     dépôt, volontairement optionnelle). Supporte uniquement oui-non et
 *     choix pour l'instant : le type "score" de Laya ne renvoie pas de
 *     mesure de confiance confirmée dans sa documentation, donc --type
 *     note est refusé avec ce moteur plutôt que d'inventer une confiance.
 *     Qualité en français NON VÉRIFIÉE (benchmarks publiés tous
 *     anglophones) — voir --multilingue, qui change de checkpoint sans
 *     garantir le résultat. Implémentation entière isolée dans
 *     04-scripts/moteur-laya.js (seul fichier à toucher si Laya doit
 *     être remplacé par un autre moteur local un jour) — ce fichier-ci
 *     n'importe que decisionViaLaya, sans jamais référencer
 *     @receptron/laya ni son API directement.
 *
 * Dans les deux cas : appel direct, PAS par `dsh` — évite le coût caché
 * du catalogue d'outils de l'agent (voir README, "Optimisation Mac Mini
 * M4", ~14 700 tokens de schémas d'outils pour une tâche triviale).
 *
 * ✅ Moteur "ollama" confirmé contre un vrai Ollama sur machine réelle
 * (Mac Mini M4, `suite-tests-reelle.sh` round 14, voir README) : 3
 * décisions réelles (code/juridique/comptable), ~1-2s chacune, confiance
 * 0.9-0.95, JSON conforme au schéma à chaque fois. La validation post-hoc
 * (validerDecision) reste utile en continu — un résultat conforme une
 * fois n'empêche pas une dérive plus tard — mais ce n'est plus la seule
 * garantie. Moteur "laya" toujours non exécuté, pour une raison précise
 * et vérifiée (pas juste "pas essayé") :
 * `npm install` échoue ici car la dépendance `onnxruntime-node` télécharge
 * son binaire natif depuis le flux Nuget (api.nuget.org) au moment de
 * l'installation — pas depuis npm — et ce host est bloqué par le proxy
 * réseau de mon environnement (confirmé dans son propre journal
 * d'échecs). Rien n'indique que ce sera aussi le cas sur un réseau
 * domestique normal, mais si `npm install` échoue avec une erreur réseau
 * sur `onnxruntime-node`, vérifie que api.nuget.org est bien joignable
 * avant de chercher ailleurs. L'API utilisée (Laya.load / systemOne /
 * types noul·choice) vient de la documentation du projet
 * (github.com/receptron/laya), vérifiée textuellement à deux reprises
 * mais jamais exécutée.
 *
 * Usage :
 *   node decision-rapide.js --question "..." --type oui-non|choix|note
 *                            [--moteur ollama|laya]
 *                            [--contexte "..."] [--choix "a,b,c"]
 *                            [--echelle "0,10"] [--avec-justification]
 *                            [--seuil-confiance 0.6] [--modele <id>]
 *                            [--base-url http://127.0.0.1:11434]
 *                            [--multilingue] [--composant decision-rapide]
 *
 * Sortie (dernière ligne de stdout) :
 *   { "decision": ..., "confiance": 0-1, "fiable": bool, "moteur": "...",
 *     "justification": "..." (si demandé), "duree_ms": N, "modele": "..." }
 *
 * Code de sortie : 0 = décision rendue (fiable, ou pas de seuil demandé) ;
 *   2 = décision rendue mais confiance sous --seuil-confiance (à
 *       l'appelant de décider d'escalader vers un skill délibératif
 *       complet plutôt que de faire confiance à cette réponse rapide) ;
 *   1 = échec réel (moteur injoignable/non installé, réponse hors
 *       schéma, arguments invalides).
 */
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { logInfo, logWarning, logError } from './dsh-logger.js';
import { decisionViaLaya } from './moteur-laya.js';

const COMPOSANT_DEFAUT = 'decision-rapide';
const TYPES_VALIDES = ['oui-non', 'choix', 'note'];
const MOTEURS_VALIDES = ['ollama', 'laya'];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      args[key] = val;
    }
  }
  return args;
}

/** Lit agent-default-model dans ~/.dsh/settings.yaml — ce que
 * basculer-modele.sh/setup-local-model.sh écrivent. Passe le chemin en
 * argv à python3 plutôt que de l'interpoler (même discipline que
 * auto-implementer.js / boucle-surveillance.sh).
 *
 * ⚠️ Vérifié en conditions réelles (retour utilisateur, dsh 0.1.7-rc.2) :
 * ce fichier n'est pas forcément la source de vérité que dsh consulte
 * réellement — `dsh --profile X --dump-config` peut montrer un modèle
 * correctement configuré via ~/.dsh/profiles/<profil>/cordis.patch.yml
 * alors que settings.yaml est absent ou périmé. decision-rapide.js parle
 * directement à Ollama, jamais à dsh (voir l'en-tête de ce fichier) : la
 * cohérence veut donc que son repli ultime interroge Ollama directement
 * lui aussi, plutôt que de deviner lequel des fichiers de config de dsh
 * fait foi. */
function lireModeleParDefaut() {
  const depuisSettings = lireModeleDepuisSettingsYaml();
  if (depuisSettings) return depuisSettings;
  return lirePremierModeleOllama();
}

function lireModeleDepuisSettingsYaml() {
  const settingsPath = path.join(os.homedir(), '.dsh', 'settings.yaml');
  if (!existsSync(settingsPath)) return null;
  const resultat = spawnSync('python3', ['-c', `
import sys, yaml
with open(sys.argv[1]) as f:
    data = yaml.safe_load(f) or {}
print((data.get('agent-default-model') or {}).get('model') or '')
`, settingsPath], { encoding: 'utf-8' });
  if (resultat.error || resultat.status !== 0) return null;
  const modele = resultat.stdout.trim();
  return modele || null;
}

/** Repli : demande à `ollama list` ce qui est réellement disponible,
 * sans rien supposer sur la config de dsh. Même commande que celle
 * utilisée par suite-tests-reelle.sh pour le même besoin. */
function lirePremierModeleOllama() {
  const resultat = spawnSync('ollama', ['list'], { encoding: 'utf-8' });
  if (resultat.error || resultat.status !== 0) return null;
  const lignes = resultat.stdout.trim().split('\n');
  if (lignes.length < 2) return null; // juste l'en-tête, aucun modèle tiré
  const premiereColonne = lignes[1].trim().split(/\s+/)[0];
  return premiereColonne || null;
}

/** Vérifie après coup que la décision respecte vraiment ce qui a été
 * demandé — un petit modèle/encodeur peut s'écarter de la contrainte
 * (ex. renvoyer un choix hors de la liste). Ne fait jamais confiance
 * aveuglément à "le format était valide", quel que soit le moteur. */
function validerDecision(decisionBrute, { type, choix, echelleMin, echelleMax }) {
  if (typeof decisionBrute.confiance !== 'number' || decisionBrute.confiance < 0 || decisionBrute.confiance > 1) {
    return `confiance hors de [0,1] ou absente : ${JSON.stringify(decisionBrute.confiance)}`;
  }
  if (type === 'oui-non' && typeof decisionBrute.decision !== 'boolean') {
    return `decision attendue booléenne, reçu : ${JSON.stringify(decisionBrute.decision)}`;
  }
  if (type === 'choix' && !choix.includes(decisionBrute.decision)) {
    return `decision "${decisionBrute.decision}" hors de la liste autorisée (${choix.join(', ')})`;
  }
  if (type === 'note') {
    const n = decisionBrute.decision;
    if (typeof n !== 'number' || n < echelleMin || n > echelleMax) {
      return `decision hors de l'échelle [${echelleMin}, ${echelleMax}] : ${JSON.stringify(n)}`;
    }
  }
  return null;
}

// --- Moteur "ollama" ------------------------------------------------------

function construireSchemaOllama({ type, choix, echelleMin, echelleMax, avecJustification }) {
  const proprietes = {};
  const requis = ['decision', 'confiance'];
  if (type === 'oui-non') {
    proprietes.decision = { type: 'boolean' };
  } else if (type === 'choix') {
    proprietes.decision = { type: 'string', enum: choix };
  } else {
    proprietes.decision = { type: 'number', minimum: echelleMin, maximum: echelleMax };
  }
  proprietes.confiance = { type: 'number', minimum: 0, maximum: 1 };
  if (avecJustification) {
    proprietes.justification = { type: 'string' };
    requis.push('justification');
  }
  return { type: 'object', properties: proprietes, required: requis };
}

function construirePromptOllama({ question, contexte, type, choix, echelleMin, echelleMax, avecJustification }) {
  const lignes = [
    `Réponds uniquement par la décision demandée${avecJustification ? ', avec une justification d’une phrase' : ', sans explication ni commentaire'}.`,
    `Question : ${question}`,
  ];
  if (type === 'choix') lignes.push(`Choix possibles (un seul, exactement comme écrit) : ${choix.join(', ')}`);
  if (type === 'note') lignes.push(`Donne une note entre ${echelleMin} et ${echelleMax}.`);
  lignes.push('Indique aussi ta confiance dans cette décision, entre 0 (incertain) et 1 (certain).');
  if (contexte) lignes.push(`\nContexte :\n${contexte}`);
  return lignes.join('\n');
}

async function decisionViaOllama({ args, composant, type, choix, echelleMin, echelleMax, avecJustification }) {
  const baseUrl = typeof args['base-url'] === 'string' ? args['base-url'] : 'http://127.0.0.1:11434';
  const modele = typeof args.modele === 'string' ? args.modele : lireModeleParDefaut();
  if (!modele) {
    console.error('❌ Aucun modèle déclaré : passe --modele, ou configure-en un avec ./04-scripts/basculer-modele.sh.');
    process.exit(1);
  }

  const schema = construireSchemaOllama({ type, choix, echelleMin, echelleMax, avecJustification });
  const prompt = construirePromptOllama({ question: args.question, contexte: args.contexte, type, choix, echelleMin, echelleMax, avecJustification });
  const corps = {
    model: modele,
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    format: schema,
    options: { temperature: 0, num_predict: avecJustification ? 200 : 60 },
  };

  logInfo(composant, `Décision rapide demandée (moteur=ollama, type=${type}, modèle=${modele})`);
  const debut = Date.now();

  let reponseHttp;
  try {
    reponseHttp = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    });
  } catch (err) {
    // Erreur réseau (Ollama non démarré, port injoignable...) — pas un
    // SILENT_ERROR : rien n'a pu être décidé, l'appelant doit le savoir.
    logError(composant, `Ollama injoignable sur ${baseUrl}`, { err, context: { modele } });
    console.error(`❌ Ollama injoignable sur ${baseUrl} : ${err.message}`);
    process.exit(1);
  }
  const dureeMs = Date.now() - debut;

  if (!reponseHttp.ok) {
    const corpsErreur = await reponseHttp.text();
    logError(composant, `Ollama a répondu ${reponseHttp.status}`, { context: { corps: corpsErreur.slice(0, 500), modele } });
    console.error(`❌ Ollama a répondu ${reponseHttp.status} : ${corpsErreur.slice(0, 300)}`);
    process.exit(1);
  }

  const data = await reponseHttp.json();
  let decisionBrute;
  try {
    decisionBrute = JSON.parse(data.message.content);
  } catch (err) {
    if (!(err instanceof SyntaxError)) throw err;
    logError(composant, `Le modèle n'a pas renvoyé un JSON valide malgré la contrainte de schéma`, {
      err, context: { modele, contenu_brut: data.message?.content?.slice(0, 500) },
    });
    console.error(`❌ Réponse non-JSON malgré --format : ${data.message?.content?.slice(0, 300)}`);
    process.exit(1);
  }

  return { decisionBrute, dureeMs, modele };
}

// --- Orchestration ----------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const composant = typeof args.composant === 'string' ? args.composant : COMPOSANT_DEFAUT;
  const moteur = typeof args.moteur === 'string' ? args.moteur : 'ollama';

  if (!args.question || args.question === true || !TYPES_VALIDES.includes(args.type) || !MOTEURS_VALIDES.includes(moteur)) {
    console.error(`Usage : --question "..." --type ${TYPES_VALIDES.join('|')} [--moteur ${MOTEURS_VALIDES.join('|')}] [--contexte "..."] [--choix "a,b,c"] [--echelle "0,10"] [--avec-justification] [--seuil-confiance 0.6] [--modele <id>] [--base-url http://127.0.0.1:11434] [--multilingue]`);
    process.exit(1);
  }
  const type = args.type;
  const choix = type === 'choix' ? String(args.choix || '').split(',').map(s => s.trim()).filter(Boolean) : [];
  if (type === 'choix' && choix.length < 2) {
    console.error('Usage : --type choix requiert --choix "a,b,c" (au moins deux options)');
    process.exit(1);
  }
  const [echelleMin, echelleMax] = String(args.echelle || '0,10').split(',').map(Number);
  const avecJustification = Boolean(args['avec-justification']);
  const seuilConfiance = args['seuil-confiance'] !== undefined ? Number(args['seuil-confiance']) : null;

  // echelleMin/echelleMax ne sont pas transmis à decisionViaLaya : ce
  // moteur refuse déjà --type note (seul type qui s'en servirait) avant
  // même de regarder les arguments — voir moteur-laya.js.
  const { decisionBrute, dureeMs, modele, detailTiming } = moteur === 'laya'
    ? await decisionViaLaya({ args, composant, type, choix })
    : await decisionViaOllama({ args, composant, type, choix, echelleMin, echelleMax, avecJustification });

  const raisonInvalide = validerDecision(decisionBrute, { type, choix, echelleMin, echelleMax });
  if (raisonInvalide) {
    logError(composant, `Décision reçue mais invalide : ${raisonInvalide}`, { context: { moteur, modele, decisionBrute } });
    console.error(`❌ ${raisonInvalide}`);
    process.exit(1);
  }

  const fiable = seuilConfiance === null || decisionBrute.confiance >= seuilConfiance;
  if (!fiable) {
    logWarning(composant, `Confiance ${decisionBrute.confiance} sous le seuil ${seuilConfiance} — décision rendue mais marquée non fiable`, {
      context: { moteur, modele, decision: decisionBrute.decision },
    });
  } else {
    logInfo(composant, `Décision rendue en ${dureeMs}ms (moteur=${moteur}, confiance ${decisionBrute.confiance})`);
  }

  const resultat = {
    decision: decisionBrute.decision,
    confiance: decisionBrute.confiance,
    fiable,
    moteur,
    duree_ms: dureeMs,
    modele,
  };
  if (detailTiming) resultat.detail_timing = detailTiming;
  if (avecJustification) resultat.justification = decisionBrute.justification;

  console.log(JSON.stringify(resultat, null, 2));
  process.exit(fiable ? 0 : 2);
}

main().catch(err => {
  logError(COMPOSANT_DEFAUT, 'Échec inattendu de decision-rapide', { err });
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
