#!/usr/bin/env node
/**
 * consigner-verdict-qualite.js — étape finale OBLIGATOIRE de
 * skill-controleur-qualite.md et skill-controleur-de-controle.md.
 *
 * Pourquoi ce script existe : en conditions réelles (voir documentation/historique-du-projet.md,
 * "Validation sur machine réelle", round 7), le skill `controle-qualite`
 * était bien chargé par `dsh`, mais son "Format de Sortie" (un objet JSON
 * dans la réponse finale) n'était jamais réellement produit — le modèle
 * local testé (30B Q4) traitait le skill comme une lecture informative,
 * pas comme une checklist contraignante, et affirmait un succès en prose
 * libre sans avoir vérifié quoi que ce soit.
 *
 * Un modèle de cette taille suit plus fidèlement "exécute cette commande"
 * qu'"termine ta réponse par cet objet JSON précis" — d'où ce geste
 * mécanique unique plutôt qu'une contrainte de formatage. Logue via
 * dsh-logger.js (mêmes garanties que le reste du projet : jamais
 * d'exception silencieuse), avec le composant exact que
 * `suite-tests-reelle.sh` (section 4) sait déjà compter.
 *
 * Usage :
 *   node consigner-verdict-qualite.js --composant controleur-qualite|controleur-de-controle
 *     --statut VALIDE|INVALIDE|A_VERIFIER [--score 0-10]
 *     --commentaire "résumé en une phrase"
 */
import { logInfo, logWarning, logError } from './dsh-logger.js';

const COMPOSANTS_AUTORISES = ['controleur-qualite', 'controleur-de-controle'];
const LOGGERS_PAR_STATUT = {
  VALIDE: logInfo,
  A_VERIFIER: logWarning,
  INVALIDE: logError,
};

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

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!COMPOSANTS_AUTORISES.includes(args.composant)) {
    console.error(`❌ --composant doit être l'un de : ${COMPOSANTS_AUTORISES.join(', ')} (reçu : ${args.composant ?? '(absent)'})`);
    process.exit(1);
  }

  const logger = LOGGERS_PAR_STATUT[args.statut];
  if (!logger) {
    console.error(`❌ --statut doit être l'un de : ${Object.keys(LOGGERS_PAR_STATUT).join(', ')} (reçu : ${args.statut ?? '(absent)'})`);
    process.exit(1);
  }

  if (!args.commentaire || typeof args.commentaire !== 'string') {
    console.error('❌ --commentaire est requis : résumé en une phrase du verdict.');
    process.exit(1);
  }

  let score;
  if (args.score !== undefined) {
    score = Number(args.score);
    if (Number.isNaN(score) || score < 0 || score > 10) {
      console.error(`❌ --score doit être un nombre entre 0 et 10 (reçu : ${args.score}).`);
      process.exit(1);
    }
  }

  const message = `Verdict ${args.statut}${score !== undefined ? ` (score ${score})` : ''} : ${args.commentaire}`;
  const entree = logger(args.composant, message, {
    context: { statut: args.statut, score, commentaire: args.commentaire },
  });

  console.log(JSON.stringify({ consigne: true, ...entree }, null, 2));
}

main();
