#!/usr/bin/env node
/**
 * boucle-hook-stop.js — boucle 04 du concept "5 boucles" : un script
 * déterministe décide si l'agent a le droit de s'arrêter, pas l'agent
 * lui-même.
 *
 * dsh n'a pas (à notre connaissance — jamais confirmé, voir README section
 * "Non vérifiable") de mécanisme de hooks natif comme Claude Code. Ce
 * script reproduit l'effet depuis l'extérieur : il relance une commande de
 * "travail" tant qu'une commande de "vérification" séparée échoue, et
 * s'arrête UNIQUEMENT sur le code de sortie réel de cette vérification —
 * jamais sur une auto-évaluation du modèle. C'est la distinction du PDF
 * source : « une suite de tests / un code de sortie de build / un linter »
 * sont des critères lisibles par la machine, contrairement à "ça a l'air
 * bon".
 *
 * Usage :
 *   node boucle-hook-stop.js --travail "<commande shell>" \
 *                             --verification "<commande shell>" \
 *                             [--max-iterations 5] [--composant nom]
 *
 * Exemple concret avec ce projet :
 *   node 04-scripts/boucle-hook-stop.js \
 *     --travail 'dsh --profile headless "corrige les tests qui échouent dans src/"' \
 *     --verification "npm test" \
 *     --max-iterations 5
 */
import { spawnSync } from 'child_process';
import { logInfo, logWarning, logError } from './dsh-logger.js';

const COMPOSANT_DEFAUT = 'boucle-hook-stop';

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

/** Exécute une commande shell et retourne son code de sortie réel — jamais
 * d'interprétation, juste le fait brut sur lequel la boucle se base. */
function executer(commande, composant, etape) {
  const resultat = spawnSync(commande, { shell: true, encoding: 'utf-8' });
  if (resultat.error) {
    // La commande elle-même n'a pas pu être lancée (binaire absent, etc.)
    // — c'est différent d'un échec de vérification normal, et ça mérite
    // un niveau ERROR distinct pour ne pas le confondre avec "le critère
    // n'est pas encore atteint".
    logError(composant, `Impossible de lancer la commande (${etape})`, {
      err: resultat.error,
      context: { commande },
    });
    return { codeSortie: 1, stdout: '', stderr: String(resultat.error) };
  }
  return {
    codeSortie: resultat.status ?? 1,
    stdout: resultat.stdout || '',
    stderr: resultat.stderr || '',
  };
}

const args = parseArgs(process.argv.slice(2));
const composant = typeof args.composant === 'string' ? args.composant : COMPOSANT_DEFAUT;

if (!args.travail || args.travail === true || !args.verification || args.verification === true) {
  console.error('Usage : --travail "<commande>" --verification "<commande>" [--max-iterations 5] [--composant nom]');
  process.exit(1);
}

const maxIterations = Number(args['max-iterations'] || 5);

logInfo(composant, `Hook Stop démarré (max ${maxIterations} itération(s))`, {
  context: { travail: args.travail, verification: args.verification },
});

let iteration = 0;
let critereAtteint = false;

while (iteration < maxIterations && !critereAtteint) {
  iteration++;
  logInfo(composant, `Itération ${iteration}/${maxIterations} — exécution du travail`);
  executer(args.travail, composant, 'travail');

  const verification = executer(args.verification, composant, 'verification');
  critereAtteint = verification.codeSortie === 0;

  if (!critereAtteint) {
    logWarning(composant, `Critère d'arrêt non atteint à l'itération ${iteration} (code de sortie ${verification.codeSortie})`, {
      context: { extrait_stderr: verification.stderr.slice(-500) },
    });
  }
}

if (critereAtteint) {
  logInfo(composant, `Critère d'arrêt atteint après ${iteration} itération(s) — l'agent a le droit de s'arrêter`);
  console.log(JSON.stringify({ statut: 'SUCCES', iterations: iteration }));
  process.exit(0);
} else {
  logError(composant, `Nombre maximal d'itérations atteint (${maxIterations}) sans satisfaire le critère de vérification`, {
    context: { verification: args.verification },
  });
  console.log(JSON.stringify({ statut: 'ECHEC', iterations: iteration }));
  process.exit(1);
}
