#!/usr/bin/env node
/**
 * lancer-workflow.js — exécute un workflow de 03-workflows/<nom>.workflow.js
 * via l'outil `workflow_projet` (plugin 07-plugins/dsh-workflows-projet),
 * et VÉRIFIE qu'il a réellement tourné jusqu'au bout.
 *
 * Pourquoi ce lanceur (voir documentation/historique-du-projet.md, round
 * 24) : dsh headless ne lance rien sans passer par le modèle. Le modèle
 * n'a ici qu'un appel minuscule à émettre (nom + args — le plugin lit le
 * script sur disque), mais rien ne garantit qu'il le fasse correctement :
 * il peut appeler un autre outil, se tromper d'arguments, ou émettre
 * l'appel en texte brut (glitch de template, voir D.14). Chaque appel
 * d'outil est donc vérifié EN DIRECT dans le flux `dsh --json` : tout ce
 * qui n'est pas exactement `workflow_projet` avec ce nom et ces args
 * arrête dsh aussitôt (tout son groupe de processus, sous-agents
 * compris), avant exécution, et une nouvelle tentative est lancée.
 * Prérequis : ./04-scripts/installer-plugins-locaux.sh headless
 *
 * Usage :
 *   node 04-scripts/lancer-workflow.js <nom> ['{"demande":"..."}'] [tentatives=3]
 * Sortie : JSON {statut, tentatives, resultat, dossier} sur la dernière
 * ligne de stdout ; code 0 si le workflow a réellement tourné jusqu'au
 * bout, 1 sinon. Prompt et flux de chaque tentative conservés dans
 * logs/workflows/<horodatage>-<nom>/.
 */
import { writeFileSync, mkdirSync, createWriteStream, existsSync } from 'fs';
import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { isDeepStrictEqual } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo, logError } from './dsh-logger.js';

const COMPOSANT = 'lancer-workflow';
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTIL = 'workflow_projet';

/** Pourquoi un appel d'outil n'est pas celui attendu, ou null s'il l'est. */
export function ecartAppel(evenement, nom, args) {
  if (evenement.tool !== OUTIL) return `outil "${evenement.tool}" appelé au lieu de ${OUTIL}`;
  if (evenement.input?.nom !== nom) return `nom "${evenement.input?.nom}" au lieu de "${nom}"`;
  if (!isDeepStrictEqual(evenement.input?.args ?? {}, args)) return `args différents : ${JSON.stringify(evenement.input?.args)}`;
  return null;
}

/** Une tentative : lance dsh, surveille chaque appel d'outil, arrête dsh au premier écart. */
function tenter(prompt, nom, args, prefixe) {
  return new Promise((resolve) => {
    // detached : dsh et ses sous-agents dans leur propre groupe de
    // processus, pour pouvoir tous les arrêter d'un coup.
    const enfant = spawn('dsh', ['--profile', 'headless', '--json', '-'], { cwd: RACINE, stdio: ['pipe', 'pipe', 'pipe'], detached: true });
    const sortie = createWriteStream(`${prefixe}-evenements.jsonl`);
    enfant.stderr.pipe(createWriteStream(`${prefixe}-stderr.txt`));
    const etat = { ecart: null, appelId: null, resultat: null };
    createInterface({ input: enfant.stdout }).on('line', (ligne) => {
      sortie.write(ligne + '\n');
      let e;
      try { e = JSON.parse(ligne); } catch { return; }
      if (e.type === 'tool_call' && !etat.ecart) {
        const ecart = etat.appelId ? `appel d'outil supplémentaire (${e.tool})` : ecartAppel(e, nom, args);
        if (ecart) {
          etat.ecart = ecart;
          try { process.kill(-enfant.pid, 'SIGTERM'); } catch { enfant.kill('SIGTERM'); }
        } else {
          etat.appelId = e.callId;
        }
      }
      if (e.type === 'tool_result' && e.callId === etat.appelId) etat.resultat = e;
    });
    enfant.on('error', (err) => { etat.ecart = `impossible de lancer dsh : ${err.message}`; });
    enfant.on('close', (code) => sortie.end(() => resolve({ ...etat, code })));
    enfant.stdin.end(prompt);
  });
}

async function main() {
  const [nom, argsBruts, tentativesBrutes] = process.argv.slice(2);
  if (!nom) {
    console.error('Usage : node 04-scripts/lancer-workflow.js <nom> [\'{"cle":"valeur"}\'] [tentatives=3]');
    process.exit(1);
  }
  if (!existsSync(path.join(RACINE, '03-workflows', `${nom}.workflow.js`))) {
    console.error(`❌ 03-workflows/${nom}.workflow.js introuvable.`);
    process.exit(1);
  }
  const args = argsBruts ? JSON.parse(argsBruts) : {};
  const maxTentatives = Number(tentativesBrutes ?? 3);

  const horodatage = new Date().toISOString().replace(/[:.]/g, '-');
  const dossier = path.join(RACINE, 'logs', 'workflows', `${horodatage}-${nom}`);
  mkdirSync(dossier, { recursive: true });
  const prompt = `Appelle l'outil ${OUTIL} une seule fois, avec nom = "${nom}" et args = ${JSON.stringify(args)}, sans utiliser aucun autre outil. Une fois l'outil terminé, donne son résultat tel quel.`;
  writeFileSync(path.join(dossier, 'prompt.txt'), prompt);

  logInfo(COMPOSANT, `Lancement du workflow '${nom}'`, { context: { args, dossier, maxTentatives } });
  const debut = Date.now();
  let r, tentative = 0;
  const ecarts = [];
  do {
    tentative += 1;
    r = await tenter(prompt, nom, args, path.join(dossier, `tentative-${tentative}`));
    const raison = r.ecart ?? (r.appelId ? null : `${OUTIL} jamais appelé (réponse en texte, voir D.14)`);
    if (raison) {
      ecarts.push({ tentative, raison });
      logError(COMPOSANT, `Tentative ${tentative} : ${raison}${r.ecart ? ' — dsh arrêté avant exécution' : ''}`, { context: { dossier } });
    }
  } while ((r.ecart || !r.appelId) && tentative < maxTentatives);

  const texte = r.resultat?.result ?? null;
  const termine = !r.ecart && r.resultat?.status === 'completed' && typeof texte === 'string' && texte.includes('completed');
  const bilan = {
    statut: termine ? 'TERMINE' : (r.ecart ? 'ECART_INTERROMPU' : (r.appelId ? 'ECHEC' : 'NON_APPELE')),
    tentatives: tentative,
    ecarts,
    code_dsh: r.code,
    duree_s: Math.round((Date.now() - debut) / 1000),
    resultat: texte,
    dossier: path.relative(RACINE, dossier),
  };
  writeFileSync(path.join(dossier, 'bilan.json'), JSON.stringify(bilan, null, 2));
  (termine ? logInfo : logError)(COMPOSANT, `Workflow '${nom}' : ${bilan.statut} après ${tentative} tentative(s)`, { context: { dossier: bilan.dossier, duree_s: bilan.duree_s } });
  console.log(JSON.stringify(bilan));
  process.exit(termine ? 0 : 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    logError(COMPOSANT, 'Échec inattendu', { err });
    console.error(`❌ ${err.message}`);
    process.exit(1);
  });
}
