// @meta {"name":"systeme-auto-ameliorant-avec-controle","description":"Système complet auto-améliorant avec contrôle de qualité et rétro-analyse des erreurs.","phases":[{"title":"Expérimentation"},{"title":"Évaluation"},{"title":"Identification"},{"title":"Contrôle qualité"},{"title":"Synthèse"}]}
//
// Script pour l'outil `workflow` natif de dsh (@deepseek-ai/dsh-tool-workflow).
// Remplace l'ancienne définition JSON déclarative (steps/loop/agent.type),
// qu'aucun composant de dsh n'exécutait — voir
// documentation/historique-du-projet.md, round 24.
//
// Un script de workflow ne peut pas appeler un autre workflow par son nom
// (pas de registre) : les anciens sous-workflows meta-experimentation,
// recherche-approfondie, controle-qualite et auto-amelioration sont
// donc des fonctions de ce même script.
//
// Lancement : ./04-scripts/lancer-workflow.sh 03-workflows/systeme-auto-ameliorant-avec-controle.workflow.js '{"demande":"..."}'
// Les lignes de commentaire entières (comme celles-ci) sont retirées par
// le lanceur avant l'envoi au modèle, qui doit recopier le script tel quel.
//
// args : demande (requis), seuil_satisfaction (8.0), max_iterations (5),
// workflows_a_tester (["recherche-approfondie"]), seuil_confiance_rapide
// (0.75 ; > 1 force le repli délibératif, pour le tester).
const demande = args.demande;
if (!demande) throw new Error('args.demande est requis');
const seuil = args.seuil_satisfaction ?? 8.0;
const maxIterations = args.max_iterations ?? 5;
const aTester = args.workflows_a_tester ?? ['recherche-approfondie'];
const seuilRapide = args.seuil_confiance_rapide ?? 0.75;

const viaSkill = (nom, consigne) => `Charge d'abord le skill \`${nom}\` avec l'outil skill (paramètre name: "${nom}") et applique sa méthode.\n\n${consigne}`;
const SCHEMA_EVAL = { type: 'object', properties: { score_global: { type: 'number' }, evaluations: { type: 'array', items: { type: 'object' } } }, required: ['score_global'] };
const SCHEMA_CQ = { type: 'object', properties: { statut: { type: 'string', enum: ['VALIDE', 'INVALIDE', 'A_VERIFIER'] }, score: { type: 'number' }, actions_correctives: { type: 'array', items: { type: 'string' } } }, required: ['statut', 'score'] };
const SCHEMA_META = { type: 'object', properties: { verdict_final: { type: 'string', enum: ['CONFIRME', 'A_RECONSIDERER'] }, divergences: { type: 'array', items: { type: 'object' } }, commentaire: { type: 'string' } }, required: ['verdict_final'] };
const sortieBash = (commande) => agent(`Exécute avec l'outil bash : \`${commande}\` et retourne sa sortie telle quelle, sans commentaire.`, { label: commande.slice(0, 40) });

async function rechercheApprofondie(question) {
  const analyse = await agent(viaSkill('analyse-objectifs', `Analyse la question : ${question}`), { label: 'analyser' });
  const sagesse = await agent(viaSkill('consulter-sagesse-interne', `Consulte les connaissances locales utiles pour : ${question}`), { label: 'consulter-sagesse' });
  const validation = await agent(viaSkill('verifier-et-croiser', `Vérifie et croise les informations.\nDemande : ${question}\nSagesse interne : ${sagesse}`), { label: 'verifier-externe' });
  return { analyse, validation };
}

const WORKFLOWS = { 'recherche-approfondie': rechercheApprofondie };

async function metaExperimentation(question) {
  return parallel(aTester.map((nom) => () => {
    if (!WORKFLOWS[nom]) throw new Error(`workflow inconnu : ${nom}`);
    return WORKFLOWS[nom](question);
  }));
}

async function autoAmelioration(contexte) {
  const erreurs = await sortieBash('node 04-scripts/errors-cli.js prompt-context --hours 24');
  const valeurs = await agent("Lis 06-data/personnalite/valeurs.md et résume les principes à respecter pour toute auto-modification.", { label: 'consulter-valeurs' });
  const proposition = await agent(viaSkill('ameliorateur-systeme', `Propose une amélioration de skill ou de workflow, en respectant le périmètre et le format JSON exacts de ton skill. Contexte du déclenchement : ${contexte}\n\n${erreurs}\n\nValeurs à respecter : ${valeurs}`), { label: 'proposer', schema: { type: 'object', properties: { modifications: { type: 'array', items: { type: 'object' } } }, required: ['modifications'] } });
  if (!proposition || proposition.modifications.length === 0) return { proposition, resultat: null };
  const evaluation = await agent(viaSkill('evaluateur', `Évalue cette proposition d'auto-modification, en incluant explicitement le critère harmonie/sagesse (voir ta consigne sur ce cas particulier).\n${JSON.stringify(proposition)}`), { label: 'evaluer-alignement', schema: SCHEMA_EVAL });
  if (!evaluation || evaluation.score_global < 6) return { proposition, evaluation, resultat: null };
  const resultat = await agent(`Écris exactement ce JSON dans un fichier temporaire hors du dépôt (ex. /tmp), puis exécute avec l'outil bash \`node 04-scripts/auto-implementer.js --proposition-file <ce-fichier>\`. Retourne le statut affiché (FUSIONNEE, REJETEE, DEJA_A_JOUR ou REJETEE_APRES_VERIFICATION).\n${JSON.stringify(proposition)}`, { label: 'appliquer', schema: { type: 'object', properties: { statut: { type: 'string' } }, required: ['statut'] } });
  if (resultat) await agent(`Exécute avec l'outil bash \`node 04-scripts/memoire-cli.js set --type auto-implementation --contenu "<résumé>" --tags cycle-auto-amelioration\`, où <résumé> résume ce résultat : ${JSON.stringify(resultat)}`, { label: 'consigner' });
  return { proposition, evaluation, resultat };
}

async function controleQualite(reponse, demandeOriginale) {
  const erreurs = await sortieBash('node 04-scripts/errors-cli.js prompt-context --hours 24');
  const evaluation = await agent(viaSkill('controle-qualite', `Demande originale : ${demandeOriginale}\n\nVérifie la réponse : ${reponse}\n\n${erreurs}`), { label: 'verifier-reponse', schema: SCHEMA_CQ });
  if (!evaluation) throw new Error('verifier-reponse : aucun verdict exploitable');
  const meta = await agent(viaSkill('controleur-de-controle', `Audite le verdict ci-dessous, pas la réponse originale.\nDemande : ${demandeOriginale}\nRéponse : ${reponse}\nVerdict : ${JSON.stringify(evaluation)}`), { label: 'contre-verifier', schema: SCHEMA_META });
  const extraits = await agent(viaSkill('extracteur-tests', `Extrait le code et génère des tests. Liste vide s'il n'y a aucun code.\n${reponse}`), { label: 'detecter-code', schema: { type: 'object', properties: { codes: { type: 'array', items: { type: 'object' } } }, required: ['codes'] } });
  const codes = extraits?.codes ?? [];
  const tests = codes.length === 0 ? [] : await parallel(codes.map((c, i) => () => agent(viaSkill('testeur-docker', `Exécute les tests dans Docker via 04-scripts/docker-test-runner.js.\n${JSON.stringify(c)}`), { label: `tester-code-${i}`, schema: { type: 'object', properties: { statut: { type: 'string' } }, required: ['statut'] } })));
  const echecTests = tests.some((t) => !t || t.statut === 'ECHEC');
  const invalide = evaluation.statut === 'INVALIDE' || echecTests;
  let reponseCorrigee = null;
  if (invalide) {
    const corr = await agent(viaSkill('ameliorateur', `Corrige la réponse en tenant compte des erreurs remontées.\nRéponse originale : ${reponse}\nCorrections : ${JSON.stringify(evaluation.actions_correctives ?? [])}\nRésultats des tests : ${JSON.stringify(tests)}`), { label: 'corriger-si-invalide', schema: { type: 'object', properties: { reponse_corrigee: { type: 'string' } }, required: ['reponse_corrigee'] } });
    reponseCorrigee = corr?.reponse_corrigee ?? null;
  }
  let autoAmel = null;
  if (invalide || meta?.verdict_final === 'A_RECONSIDERER') {
    const lecon = await agent(viaSkill('apprendre-des-echecs', `Enregistre une leçon à partir de cet échec (y compris si c'est un désaccord entre les deux niveaux de contrôle plutôt qu'un échec de tâche).\nVerdict : ${JSON.stringify(evaluation)}\nContre-vérification : ${JSON.stringify(meta)}`), { label: 'apprendre' });
    autoAmel = await autoAmelioration(`Déclenché après un échec significatif : ${lecon}`);
  }
  const verdictMeta = meta?.verdict_final ?? null;
  return {
    statut: evaluation.statut,
    score: evaluation.score,
    verdict_meta: verdictMeta,
    divergences_meta: meta?.divergences ?? null,
    reponse_finale: evaluation.statut === 'VALIDE' && verdictMeta !== 'A_RECONSIDERER' ? reponse : null,
    reponse_corrigee: reponseCorrigee,
    rapport_tests: tests,
    auto_amelioration: autoAmel,
  };
}

async function identifierMeilleur(evaluations) {
  const n = evaluations.length;
  const indices = [...Array(n).keys()].join(',');
  const scores = JSON.stringify(Object.fromEntries(evaluations.map((e, i) => [i, e?.score_global ?? null])));
  return agent(`Choisir le meilleur résultat parmi ces évaluations (index -> score_global) : ${scores}. C'est une décision fermée — tente d'abord la voie rapide : exécute avec l'outil bash \`node 04-scripts/decision-rapide.js --question "Quel index de la liste a le meilleur score_global ?" --type choix --choix "${indices}" --contexte '${scores}' --seuil-confiance ${seuilRapide}\` (pas de --moteur : laya n'est plus jamais choisi automatiquement, voir skill-decision-rapide.md). Si le JSON retourné a "fiable": true, renvoie meilleur_index = sa "decision" et methode = "rapide". Si "fiable": false, ou si la commande échoue, consigne d'abord ce résultat non fiable avec \`node 04-scripts/journal-desaccords.js enregistrer --question "Quel index de la liste a le meilleur score_global ?" --type choix --choix "${indices}" --moteur ollama --decision-rapide "<decision>" --confiance-rapide <confiance> --seuil-confiance ${seuilRapide} --composant identifier-meilleur\`, PUIS compare toi-même les évaluations en détail, puis relance la même commande journal-desaccords.js en ajoutant --decision-deliberative "<index choisi>". Renvoie alors meilleur_index = l'index choisi et methode = "deliberative". N'utilise jamais un résultat "fiable": false.`, { label: 'identifier-meilleur', schema: { type: 'object', properties: { meilleur_index: { type: 'number' }, methode: { type: 'string', enum: ['rapide', 'deliberative'] } }, required: ['meilleur_index', 'methode'] } });
}

const historique = [];
let iteration = 0;
let scoreGlobal = null;
let statutValidation = null;
let dernier = null;
while (true) {
  iteration += 1;
  log(`Itération ${iteration}/${maxIterations}`);
  phase('Expérimentation');
  const resultats = (await metaExperimentation(demande)).filter(Boolean);
  if (resultats.length === 0) throw new Error('aucune expérimentation exploitable');
  phase('Évaluation');
  const evaluations = await parallel(resultats.map((r, i) => () => agent(viaSkill('evaluateur', `Évalue ce résultat au regard de la demande : ${demande}\n\n${JSON.stringify(r)}`), { label: `evaluer-${i}`, schema: SCHEMA_EVAL })));
  phase('Identification');
  const choix = await identifierMeilleur(evaluations);
  if (!choix) throw new Error('identifier-meilleur : aucun choix exploitable');
  const idx = Math.round(choix.meilleur_index);
  if (!(idx >= 0 && idx < resultats.length)) throw new Error(`identifier-meilleur : index hors limites (${choix.meilleur_index})`);
  const meilleureReponse = JSON.stringify(resultats[idx]);
  scoreGlobal = evaluations[idx]?.score_global ?? null;
  phase('Contrôle qualité');
  const controle = await controleQualite(meilleureReponse, demande);
  statutValidation = controle.statut;
  dernier = { meilleureReponse, controle };
  historique.push({ iteration, score_global: scoreGlobal, methode_identification: choix.methode, statut_validation: statutValidation, verdict_meta: controle.verdict_meta, corrigee: controle.reponse_corrigee !== null, auto_amelioration: controle.auto_amelioration?.resultat ?? null });
  if ((scoreGlobal !== null && scoreGlobal >= seuil && statutValidation === 'VALIDE') || iteration >= maxIterations) break;
}

phase('Synthèse');
const base = dernier.controle.reponse_corrigee ?? dernier.meilleureReponse;
const reponse = await agent(viaSkill('synthese-finale', `Rédige la réponse finale en intégrant les apprentissages accumulés.\nDemande : ${demande}\nMeilleur résultat : ${base}\nHistorique des itérations : ${JSON.stringify(historique)}`), { label: 'synthese-finale' });
return { reponse, iterations: iteration, score_global: scoreGlobal, statut_validation: statutValidation, verdict_meta: dernier.controle.verdict_meta, historique };
