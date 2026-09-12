#!/usr/bin/env node
/**
 * errors-cli.js — interroge le journal structuré (dsh-logger.js) en ligne
 * de commande. Utilisable directement par toi, ou comme "execute_script"
 * appelé par un skill dsh pour que l'agent consulte ses propres erreurs.
 *
 * Usage :
 *   node errors-cli.js summary [--hours 24]
 *   node errors-cli.js list [--n 50] [--level SILENT_ERROR] [--component modlens]
 *   node errors-cli.js prompt-context [--hours 24]
 */
import { getRecentEvents, errorSummary, contexteErreursPourPrompt } from './dsh-logger.js';

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

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0] || 'summary';

if (cmd === 'summary') {
  const hours = Number(args.hours || 24);
  console.log(JSON.stringify(errorSummary({ hours }), null, 2));
} else if (cmd === 'list') {
  const events = getRecentEvents({
    n: Number(args.n || 50),
    level: args.level || null,
    component: args.component || null,
  });
  console.log(JSON.stringify({ count: events.length, events }, null, 2));
} else if (cmd === 'prompt-context') {
  const hours = Number(args.hours || 24);
  const texte = contexteErreursPourPrompt({ hours });
  console.log(texte || '(aucune erreur récente)');
} else {
  console.error(`Commande inconnue : ${cmd}`);
  console.error('Usage : summary | list | prompt-context');
  process.exit(1);
}
