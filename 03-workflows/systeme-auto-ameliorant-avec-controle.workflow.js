// @meta {"name":"systeme-auto-ameliorant-avec-controle","description":"Système complet auto-améliorant avec contrôle de qualité et rétro-analyse des erreurs.","phases":[{"title":"Expérimentation"},{"title":"Évaluation"},{"title":"Identification"},{"title":"Contrôle qualité"},{"title":"Synthèse"}]}
//
// Script pour le moteur de workflows natif de dsh (@deepseek-ai/dsh-workflow).
// Remplace l'ancienne définition JSON déclarative (steps/loop/agent.type),
// qu'aucun composant de dsh n'exécutait — voir
// documentation/historique-du-projet.md, round 24.
//
// Un script de workflow ne peut pas appeler un autre workflow par son nom
// (pas de registre) : les anciens sous-workflows meta-experimentation,
// recherche-approfondie, controle-qualite et auto-amelioration sont
// donc des fonctions de ce même script.
//
// Lancement (le plugin 07-plugins/dsh-workflows-projet lit ce fichier tel
// quel — le modèle ne donne que le nom et les args) :
//   node 04-scripts/lancer-workflow.js systeme-auto-ameliorant-avec-controle '{"demande":"..."}'
// Script volontairement compact, de l'époque où le modèle devait le
// recopier dans son appel d'outil (round 24) ; les consignes restent
// brèves parce que chaque sous-agent charge le skill correspondant, qui
// porte la méthode détaillée.
//
// args : demande (requis), seuil_satisfaction (8.0), max_iterations (5),
// workflows_a_tester (["recherche-approfondie"]), seuil_confiance_rapide
// (0.75 ; > 1 force le repli délibératif, pour le tester).
const demande = args.demande;
if (!demande) throw new Error('args.demande est requis');
const seuil = args.seuil_satisfaction ?? 8;
const maxIter = args.max_iterations ?? 5;
const aTester = args.workflows_a_tester ?? ['recherche-approfondie'];
const seuilRapide = args.seuil_confiance_rapide ?? 0.75;

const S = { type: 'string' }, N = { type: 'number' }, B = { type: 'boolean' }, L = (items) => ({ type: 'array', items });
const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required });
const enu = (...v) => ({ type: 'string', enum: v });
const J = JSON.stringify;
// Le moteur refuse toute option non JSON (schema: undefined compris).
const skill = (nom, consigne, label, schema) => agent(`Charge le skill \`${nom}\` (outil skill, name: "${nom}") et applique sa méthode.\n\n${consigne}`, schema ? { label, schema } : { label });
const bash = (cmd, label) => agent(`Exécute avec l'outil bash : \`${cmd}\` et retourne sa sortie telle quelle.`, { label });
const EVAL = obj({ score_global: N, evaluations: L({ type: 'object' }) }, ['score_global']);

async function rechercheApprofondie(q) {
  const analyse = await skill('analyse-objectifs', `Analyse la question : ${q}`, 'analyser');
  const sagesse = await skill('consulter-sagesse-interne', `Consulte les connaissances locales utiles pour : ${q}`, 'consulter-sagesse');
  const validation = await skill('verifier-et-croiser', `Vérifie et croise.\nDemande : ${q}\nSagesse interne : ${sagesse}`, 'verifier-externe');
  return { analyse, validation };
}
const WORKFLOWS = { 'recherche-approfondie': rechercheApprofondie };

async function autoAmelioration(contexte) {
  const erreurs = await bash('node 04-scripts/errors-cli.js prompt-context --hours 24', 'erreurs-recentes');
  const valeurs = await agent('Lis 06-data/personnalite/valeurs.md et résume les principes à respecter pour toute auto-modification.', { label: 'consulter-valeurs' });
  const prop = await skill('ameliorateur-systeme', `Propose une amélioration (périmètre et format JSON de ton skill).\nDéclenchement : ${contexte}\n${erreurs}\nValeurs : ${valeurs}`, 'proposer', obj({ modifications: L({ type: 'object' }) }));
  if (!prop || prop.modifications.length === 0) return { proposition: prop, resultat: null };
  const ev = await skill('evaluateur', `Évalue cette proposition d'auto-modification, critère harmonie/sagesse inclus.\n${J(prop)}`, 'evaluer-alignement', EVAL);
  if (!ev || ev.score_global < 6) return { proposition: prop, evaluation: ev, resultat: null };
  const res = await agent(`Écris ce JSON dans un fichier sous /tmp, puis exécute avec l'outil bash \`node 04-scripts/auto-implementer.js --proposition-file <ce-fichier>\`. Renvoie le statut affiché.\n${J(prop)}`, { label: 'appliquer', schema: obj({ statut: S }) });
  if (res) await bash(`node 04-scripts/memoire-cli.js set --type auto-implementation --contenu "Auto-amélioration : ${res.statut}" --tags cycle-auto-amelioration`, 'consigner');
  return { proposition: prop, evaluation: ev, resultat: res };
}

async function controleQualite(rep, dem) {
  const erreurs = await bash('node 04-scripts/errors-cli.js prompt-context --hours 24', 'erreurs-recentes');
  const ev = await skill('controle-qualite', `Demande : ${dem}\nRéponse à vérifier : ${rep}\n${erreurs}`, 'verifier-reponse', obj({ statut: enu('VALIDE', 'INVALIDE', 'A_VERIFIER'), score: N, actions_correctives: L(S) }, ['statut', 'score']));
  if (!ev) throw new Error('verifier-reponse : aucun verdict exploitable');
  const meta = await skill('controleur-de-controle', `Audite ce verdict, pas la réponse.\nDemande : ${dem}\nRéponse : ${rep}\nVerdict : ${J(ev)}`, 'contre-verifier', obj({ verdict_final: enu('CONFIRME', 'A_RECONSIDERER'), divergences: L({ type: 'object' }), commentaire: S }, ['verdict_final']));
  const ext = await skill('extracteur-tests', `Extrait le code et génère des tests (liste vide si aucun code).\n${rep}`, 'detecter-code', obj({ codes: L({ type: 'object' }) }));
  const codes = ext?.codes ?? [];
  const tests = codes.length ? await parallel(codes.map((c, i) => () => skill('testeur-docker', `Exécute ces tests dans Docker via 04-scripts/docker-test-runner.js.\n${J(c)}`, `tester-code-${i}`, obj({ statut: S })))) : [];
  const invalide = ev.statut === 'INVALIDE' || tests.some((t) => !t || t.statut === 'ECHEC');
  let corrigee = null, auto = null;
  if (invalide) corrigee = (await skill('ameliorateur', `Corrige la réponse.\nRéponse : ${rep}\nCorrections : ${J(ev.actions_correctives ?? [])}\nTests : ${J(tests)}`, 'corriger-si-invalide', obj({ reponse_corrigee: S })))?.reponse_corrigee ?? null;
  if (invalide || meta?.verdict_final === 'A_RECONSIDERER') {
    const lecon = await skill('apprendre-des-echecs', `Enregistre une leçon de cet échec (ou de ce désaccord entre les deux niveaux de contrôle).\nVerdict : ${J(ev)}\nContre-vérification : ${J(meta)}`, 'apprendre');
    auto = await autoAmelioration(`Échec significatif : ${lecon}`);
  }
  const vm = meta?.verdict_final ?? null;
  return { statut: ev.statut, score: ev.score, verdict_meta: vm, divergences_meta: meta?.divergences ?? null, reponse_finale: ev.statut === 'VALIDE' && vm !== 'A_RECONSIDERER' ? rep : null, reponse_corrigee: corrigee, rapport_tests: tests, auto_amelioration: auto };
}

// identifier-meilleur : voie rapide (decision-rapide.js), puis repli
// délibératif si "fiable": false, la décision non fiable consignée par
// journal-desaccords.js avant et après la comparaison délibérée. Un seul
// résultat : choix trivial (journal-desaccords.js exige deux options).
async function identifierMeilleur(evals) {
  if (evals.length === 1) return { meilleur_index: 0, methode: 'unique' };
  const scores = J(Object.fromEntries(evals.map((e, i) => [i, e?.score_global ?? null])));
  const q = `--question "Quel index a le meilleur score_global ?" --type choix --choix "${evals.map((_, i) => i).join(',')}"`;
  const r = await agent(`Exécute avec l'outil bash : \`node 04-scripts/decision-rapide.js ${q} --contexte '${scores}' --seuil-confiance ${seuilRapide}\` (code de sortie 2 normal). Renvoie decision, confiance et fiable du JSON de la dernière ligne.`, { label: 'decision-rapide', schema: obj({ decision: S, confiance: N, fiable: B }) });
  if (r?.fiable) return { meilleur_index: Number(r.decision), methode: 'rapide' };
  const journal = `node 04-scripts/journal-desaccords.js enregistrer ${q} --moteur ollama --decision-rapide "${r?.decision}" --confiance-rapide ${r?.confiance} --seuil-confiance ${seuilRapide} --composant identifier-meilleur`;
  if (r) await bash(journal, 'journal-avant');
  const d = await agent(`Compare en détail ces évaluations et choisis l'index (à partir de 0) du meilleur résultat.\n${J(evals)}`, { label: 'decision-deliberative', schema: obj({ meilleur_index: N }) });
  if (!d) return null;
  if (r) await bash(`${journal} --decision-deliberative "${Math.round(d.meilleur_index)}"`, 'journal-apres');
  return { meilleur_index: d.meilleur_index, methode: 'deliberative' };
}

const historique = [];
let iteration = 0, score = null, statut = null, dernier = null;
while (true) {
  iteration += 1;
  log(`Itération ${iteration}/${maxIter}`);
  phase('Expérimentation');
  const res = (await parallel(aTester.map((nom) => () => {
    if (!WORKFLOWS[nom]) throw new Error(`workflow inconnu : ${nom}`);
    return WORKFLOWS[nom](demande);
  }))).filter(Boolean);
  if (res.length === 0) throw new Error('aucune expérimentation exploitable');
  phase('Évaluation');
  const evals = await parallel(res.map((r, i) => () => skill('evaluateur', `Évalue ce résultat pour la demande : ${demande}\n${J(r)}`, `evaluer-${i}`, EVAL)));
  phase('Identification');
  const choix = await identifierMeilleur(evals);
  if (!choix) throw new Error('identifier-meilleur : aucun choix exploitable');
  const idx = Math.round(choix.meilleur_index);
  if (!(idx >= 0 && idx < res.length)) throw new Error(`identifier-meilleur : index hors limites (${choix.meilleur_index})`);
  const meilleure = J(res[idx]);
  score = evals[idx]?.score_global ?? null;
  phase('Contrôle qualité');
  const cq = await controleQualite(meilleure, demande);
  statut = cq.statut;
  dernier = { meilleure, cq };
  historique.push({ iteration, score_global: score, methode_identification: choix.methode, statut_validation: statut, verdict_meta: cq.verdict_meta, corrigee: cq.reponse_corrigee !== null, auto_amelioration: cq.auto_amelioration?.resultat ?? null });
  if ((score !== null && score >= seuil && statut === 'VALIDE') || iteration >= maxIter) break;
}

phase('Synthèse');
const reponse = await skill('synthese-finale', `Rédige la réponse finale en intégrant les apprentissages accumulés.\nDemande : ${demande}\nMeilleur résultat : ${dernier.cq.reponse_corrigee ?? dernier.meilleure}\nHistorique : ${J(historique)}`, 'synthese-finale');
return { reponse, iterations: iteration, score_global: score, statut_validation: statut, verdict_meta: dernier.cq.verdict_meta, historique };
