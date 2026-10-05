#!/usr/bin/env node
/**
 * auto-implementer.js — ferme la boucle que skill-ameliorateur.md laissait
 * ouverte : au lieu de seulement PROPOSER une modification (JSON en
 * sortie), applique réellement les fichiers, sur une branche git dédiée,
 * et ne fusionne que si la vérification déterministe passe.
 *
 * Périmètre volontairement restreint (décision explicite de l'utilisateur,
 * voir 01-skills/skill-auto-implementation.md) : UNIQUEMENT des skills
 * (01-skills/*.md) et des workflows (03-workflows/*.json). Jamais de
 * script, jamais de config — ces chemins sont refusés même s'ils
 * apparaissent dans une proposition, le contrôle n'est pas qu'une
 * convention suivie par le prompt, c'est vérifié ici dans le code.
 *
 * Garde-fou : branche dédiée → écriture → commit → vérification
 * (04-scripts/valider-skills-workflows.js par défaut) → fusion seulement
 * si la vérification sort en code 0, sinon la branche reste de côté pour
 * relecture humaine. Jamais de push vers un remote — tout reste local,
 * partager le résultat est une décision humaine séparée.
 *
 * Usage :
 *   node auto-implementer.js --proposition-file <chemin.json>
 *                             [--verification "<commande>"]
 *
 * Format attendu du fichier de proposition (voir skill-ameliorateur.md) :
 *   {
 *     "modifications": [
 *       { "type": "modifier-skill", "skill": "01-skills/skill-x.md",
 *         "nouvelle_version": "---\nname: ...\n---\n...",
 *         "justification": "...", "alignement_valeurs": "..." },
 *       { "type": "creer-workflow", "workflow": "03-workflows/x.workflow.json",
 *         "contenu": "{...}",
 *         "justification": "...", "alignement_valeurs": "..." }
 *     ]
 *   }
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { logInfo, logWarning, logError } from './dsh-logger.js';

const COMPOSANT = 'auto-implementer';
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERIFICATION_DEFAUT = 'node 04-scripts/valider-skills-workflows.js';

// Seuls ces deux dossiers peuvent être touchés — toute proposition qui
// sort de là est refusée avant même d'écrire quoi que ce soit.
const DOSSIERS_AUTORISES = {
  'modifier-skill': { champ: 'skill', dossier: '01-skills', extension: '.md' },
  'creer-workflow': { champ: 'workflow', dossier: '03-workflows', extension: '.json' },
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

/** Exécute une commande git et retourne stdout — jette une erreur précise
 * et loggée si le code de sortie n'est pas celui attendu, plutôt que de
 * laisser le script continuer sur un état git incertain. */
function git(args, { attendu = 0 } = {}) {
  const resultat = spawnSync('git', args, { cwd: RACINE, encoding: 'utf-8' });
  if (resultat.error) {
    logError(COMPOSANT, `Impossible de lancer git ${args.join(' ')}`, { err: resultat.error });
    throw resultat.error;
  }
  if (resultat.status !== attendu) {
    const err = new Error(`git ${args.join(' ')} a échoué (code ${resultat.status}) : ${resultat.stderr}`);
    logError(COMPOSANT, `Commande git inattendue`, { err, context: { args, stdout: resultat.stdout, stderr: resultat.stderr } });
    throw err;
  }
  return resultat.stdout.trim();
}

/** Valide qu'un chemin déclaré dans la proposition reste bien à
 * l'intérieur du dossier autorisé pour son type — bloque explicitement
 * une tentative de traversée de chemin (ex. "01-skills/../04-scripts/x.js")
 * qui contournerait sinon la restriction de périmètre. */
function resoudreCheminSur(cheminDeclare, dossierAutorise) {
  const cheminAbsoluDossier = path.join(RACINE, dossierAutorise);
  const cheminAbsoluCible = path.resolve(RACINE, cheminDeclare);
  if (!cheminAbsoluCible.startsWith(cheminAbsoluDossier + path.sep)) {
    return null;
  }
  return cheminAbsoluCible;
}

function validerEtAppliquer(modifications) {
  const fichiersTouches = [];
  for (const [index, modif] of modifications.entries()) {
    const regle = DOSSIERS_AUTORISES[modif.type];
    if (!regle) {
      throw new Error(`modification #${index} : type "${modif.type}" non autorisé (seuls "modifier-skill" et "creer-workflow" le sont)`);
    }
    const cheminDeclare = modif[regle.champ];
    if (!cheminDeclare || typeof cheminDeclare !== 'string') {
      throw new Error(`modification #${index} : champ "${regle.champ}" manquant`);
    }
    if (!cheminDeclare.endsWith(regle.extension)) {
      throw new Error(`modification #${index} : "${cheminDeclare}" doit se terminer par "${regle.extension}"`);
    }
    const cheminAbsolu = resoudreCheminSur(cheminDeclare, regle.dossier);
    if (!cheminAbsolu) {
      throw new Error(`modification #${index} : "${cheminDeclare}" sort du dossier autorisé "${regle.dossier}/" — refusé`);
    }
    const contenu = modif.type === 'modifier-skill' ? modif.nouvelle_version : modif.contenu;
    if (!contenu || typeof contenu !== 'string') {
      throw new Error(`modification #${index} : contenu manquant`);
    }
    mkdirSync(path.dirname(cheminAbsolu), { recursive: true });
    writeFileSync(cheminAbsolu, contenu, 'utf-8');
    fichiersTouches.push(path.relative(RACINE, cheminAbsolu));
  }
  return fichiersTouches;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args['proposition-file']) {
    console.error('Usage : --proposition-file <chemin.json> [--verification "<commande>"]');
    process.exit(1);
  }

  // Précondition vérifiée en premier, avec un message actionnable : ce
  // script fait des branches/commits/fusions, impossible sans un vrai
  // dépôt git. La cause la plus fréquente d'un "not a git repository"
  // ici n'est pas une erreur d'environnement obscure — c'est que le
  // dossier vient d'un "Download ZIP" GitHub plutôt que d'un vrai
  // `git clone` (observé en pratique : le nom de dossier
  // "<repo>-<branche>" est exactement ce que produit ce bouton).
  try {
    git(['rev-parse', '--is-inside-work-tree']);
  } catch {
    console.error(`❌ ${RACINE} n'est pas un dépôt git (pas de .git trouvé).`);
    console.error("   Cause la plus probable : ce dossier vient d'un \"Download ZIP\" sur GitHub plutôt que d'un `git clone` — un ZIP n'inclut jamais le dossier .git.");
    console.error(`   Vérifie avec : cd ${RACINE} && git status`);
    console.error('   Si ça confirme le diagnostic, clone proprement le dépôt (`git clone <url>`) plutôt que de réutiliser ce dossier.');
    process.exit(1);
  }
  const verification = typeof args.verification === 'string' ? args.verification : VERIFICATION_DEFAUT;

  let proposition;
  try {
    proposition = JSON.parse(readFileSync(args['proposition-file'], 'utf-8'));
  } catch (err) {
    logError(COMPOSANT, `Fichier de proposition illisible ou invalide (${args['proposition-file']})`, { err });
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
  if (!Array.isArray(proposition.modifications) || proposition.modifications.length === 0) {
    console.error('❌ La proposition ne contient aucune modification ("modifications" vide ou absent).');
    process.exit(1);
  }

  // Jamais démarrer sur un arbre de travail sale : on ne veut ni
  // embarquer du travail en cours de l'utilisateur dans le commit
  // d'auto-amélioration, ni perdre cet état en changeant de branche.
  const statutGit = git(['status', '--porcelain']);
  if (statutGit) {
    logError(COMPOSANT, 'Arbre de travail non propre — auto-implémentation refusée pour ne pas embarquer de changements non liés');
    console.error('❌ Des changements non commités existent déjà. Commite ou mets-les de côté (git stash) avant de relancer.');
    process.exit(1);
  }

  const brancheOrigine = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  const horodatage = new Date().toISOString().replace(/[:.]/g, '-');
  const brancheAuto = `auto-amelioration/${horodatage}`;

  logInfo(COMPOSANT, `Démarrage d'un cycle d'auto-implémentation depuis '${brancheOrigine}'`, {
    context: { nb_modifications: proposition.modifications.length },
  });

  git(['checkout', '-b', brancheAuto]);

  let fichiersTouches;
  try {
    fichiersTouches = validerEtAppliquer(proposition.modifications);
  } catch (err) {
    // La proposition elle-même est hors périmètre ou mal formée : on
    // revient immédiatement sur la branche d'origine et on supprime la
    // branche avortée — rien n'a été commité, rien à nettoyer d'autre.
    logError(COMPOSANT, 'Proposition rejetée avant toute écriture', { err });
    git(['checkout', brancheOrigine]);
    git(['branch', '-D', brancheAuto]);
    console.log(JSON.stringify({ statut: 'REJETEE', raison: err.message }, null, 2));
    process.exit(1);
  }

  const messageCommit = [
    `auto-amélioration : ${fichiersTouches.join(', ')}`,
    '',
    ...proposition.modifications.map((m, i) => `- ${m[DOSSIERS_AUTORISES[m.type].champ]} : ${m.justification || '(pas de justification fournie)'}${m.alignement_valeurs ? `\n  alignement valeurs : ${m.alignement_valeurs}` : ''}`),
  ].join('\n');

  git(['add', ...fichiersTouches]);
  git(['commit', '-m', messageCommit]);

  logInfo(COMPOSANT, `Modifications commitées sur '${brancheAuto}', lancement de la vérification : ${verification}`);
  const resultatVerif = spawnSync(verification, { shell: true, cwd: RACINE, encoding: 'utf-8' });

  git(['checkout', brancheOrigine]);

  if (resultatVerif.status === 0) {
    git(['merge', '--no-ff', brancheAuto, '-m', `Fusion auto-amélioration : ${fichiersTouches.join(', ')}`]);
    git(['branch', '-d', brancheAuto]);
    logInfo(COMPOSANT, `Cycle réussi — fusionné dans '${brancheOrigine}' et branche temporaire supprimée`, {
      context: { fichiers: fichiersTouches },
    });
    console.log(JSON.stringify({ statut: 'FUSIONNEE', branche_origine: brancheOrigine, fichiers: fichiersTouches }, null, 2));
    process.exit(0);
  } else {
    // Échec de vérification : la branche reste intacte pour relecture,
    // volontairement non supprimée — c'est la trace de ce qui a été
    // tenté et pourquoi ça n'a pas suffi.
    logWarning(COMPOSANT, `Vérification échouée — branche '${brancheAuto}' conservée pour relecture, rien fusionné`, {
      context: { sortie_verification: resultatVerif.stdout?.slice(-1000) },
    });
    console.log(JSON.stringify({
      statut: 'REJETEE_APRES_VERIFICATION',
      branche_conservee: brancheAuto,
      details_verification: resultatVerif.stdout?.trim(),
    }, null, 2));
    process.exit(1);
  }
}

main().catch(err => {
  logError(COMPOSANT, 'Échec inattendu du cycle d\'auto-implémentation', { err });
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
