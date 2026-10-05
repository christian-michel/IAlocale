#!/usr/bin/env node
/**
 * decision-rapide.js — mécanisme de décision rapide inspiré de JEV
 * (TypeSafe AI, "System One Model" : https://simonwillison.net/2026/Sep/21/jev/).
 * JEV lui-même est un service cloud payant (non local, voir README section
 * "Auto-itération"), mais son idée se reproduit entièrement en local : pour
 * une question FERMÉE (oui/non, choix dans une liste, note chiffrée), pas
 * besoin de faire générer une réponse complète par un modèle — un appel
 * contraint (sortie JSON forcée via le paramètre `format` de l'API Ollama,
 * `options.temperature: 0`, `num_predict` bas) suffit, et c'est nettement
 * plus rapide qu'un tour complet de génération libre.
 *
 * Appelle directement l'API native d'Ollama (`/api/chat`), PAS `dsh` :
 * ça évite aussi le coût caché du catalogue d'outils de l'agent (voir
 * README, section "Optimisation Mac Mini M4", ~14 700 tokens de schémas
 * d'outils pour une tâche triviale) — pour une décision fermée, cet appel
 * n'a besoin d'aucun outil.
 *
 * ⚠️ Non testé contre un vrai Ollama (absent de mon environnement) : le
 * format de requête/réponse vient de la documentation officielle Ollama
 * (format `format` en JSON Schema sur /api/chat, stable depuis la 0.5),
 * mais le comportement réel d'un modèle précis face à la contrainte de
 * schéma — respecte-t-il toujours l'enum, la plage de la note ? — n'est
 * vérifiable que sur la machine cible. Ce script vérifie lui-même après
 * coup que la réponse respecte bien ce qui a été demandé (voir
 * validerDecision) plutôt que de faire confiance aveuglément au modèle.
 *
 * Usage :
 *   node decision-rapide.js --question "..." --type oui-non|choix|note
 *                            [--contexte "..."] [--choix "a,b,c"]
 *                            [--echelle "0,10"] [--avec-justification]
 *                            [--seuil-confiance 0.6] [--modele <id>]
 *                            [--base-url http://127.0.0.1:11434]
 *                            [--composant decision-rapide]
 *
 * Sortie (dernière ligne de stdout) :
 *   { "decision": ..., "confiance": 0-1, "fiable": bool,
 *     "justification": "..." (si demandé), "duree_ms": N, "modele": "..." }
 *
 * Code de sortie : 0 = décision rendue (fiable, ou pas de seuil demandé) ;
 *   2 = décision rendue mais confiance sous --seuil-confiance (à
 *       l'appelant de décider d'escalader vers un skill délibératif
 *       complet plutôt que de faire confiance à cette réponse rapide) ;
 *   1 = échec réel (Ollama injoignable, réponse hors schéma, arguments
 *       invalides).
 */
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { logInfo, logWarning, logError } from './dsh-logger.js';

const COMPOSANT_DEFAUT = 'decision-rapide';
const TYPES_VALIDES = ['oui-non', 'choix', 'note'];

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

/** Lit agent-default-model dans ~/.dsh/settings.yaml — le modèle réellement
 * actif, celui que basculer-modele.sh a configuré en dernier. Passe le
 * chemin en argv à python3 plutôt que de l'interpoler dans le script
 * (même discipline que auto-implementer.js / boucle-surveillance.sh). */
function lireModeleParDefaut() {
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

function construireSchema({ type, choix, echelleMin, echelleMax, avecJustification }) {
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

function construirePrompt({ question, contexte, type, choix, echelleMin, echelleMax, avecJustification }) {
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

/** Vérifie après coup que la décision respecte vraiment ce qui a été
 * demandé — un petit modèle local peut s'écarter du schéma malgré la
 * contrainte (ex. renvoyer un choix hors de la liste). Ne fait jamais
 * confiance aveuglément à "le format JSON était valide". */
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const composant = typeof args.composant === 'string' ? args.composant : COMPOSANT_DEFAUT;

  if (!args.question || args.question === true || !TYPES_VALIDES.includes(args.type)) {
    console.error(`Usage : --question "..." --type ${TYPES_VALIDES.join('|')} [--contexte "..."] [--choix "a,b,c"] [--echelle "0,10"] [--avec-justification] [--seuil-confiance 0.6] [--modele <id>] [--base-url http://127.0.0.1:11434]`);
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
  const baseUrl = typeof args['base-url'] === 'string' ? args['base-url'] : 'http://127.0.0.1:11434';
  const modele = typeof args.modele === 'string' ? args.modele : lireModeleParDefaut();

  if (!modele) {
    console.error('❌ Aucun modèle déclaré : passe --modele, ou configure-en un avec ./04-scripts/basculer-modele.sh.');
    process.exit(1);
  }

  const schema = construireSchema({ type, choix, echelleMin, echelleMax, avecJustification });
  const prompt = construirePrompt({ question: args.question, contexte: args.contexte, type, choix, echelleMin, echelleMax, avecJustification });

  const corps = {
    model: modele,
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    format: schema,
    options: { temperature: 0, num_predict: avecJustification ? 200 : 60 },
  };

  logInfo(composant, `Décision rapide demandée (type=${type}, modèle=${modele})`);
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

  const raisonInvalide = validerDecision(decisionBrute, { type, choix, echelleMin, echelleMax });
  if (raisonInvalide) {
    logError(composant, `Décision reçue mais invalide : ${raisonInvalide}`, { context: { modele, decisionBrute } });
    console.error(`❌ ${raisonInvalide}`);
    process.exit(1);
  }

  const fiable = seuilConfiance === null || decisionBrute.confiance >= seuilConfiance;
  if (!fiable) {
    logWarning(composant, `Confiance ${decisionBrute.confiance} sous le seuil ${seuilConfiance} — décision rendue mais marquée non fiable`, {
      context: { modele, decision: decisionBrute.decision },
    });
  } else {
    logInfo(composant, `Décision rendue en ${dureeMs}ms (confiance ${decisionBrute.confiance})`);
  }

  const resultat = {
    decision: decisionBrute.decision,
    confiance: decisionBrute.confiance,
    fiable,
    duree_ms: dureeMs,
    modele,
  };
  if (avecJustification) resultat.justification = decisionBrute.justification;

  console.log(JSON.stringify(resultat, null, 2));
  process.exit(fiable ? 0 : 2);
}

main().catch(err => {
  logError(COMPOSANT_DEFAUT, 'Échec inattendu de decision-rapide', { err });
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
