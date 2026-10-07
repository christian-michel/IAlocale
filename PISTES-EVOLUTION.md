# Pistes d'évolution

Idées soulevées en discussion après la validation complète du projet (voir
`README.md`, section "Validation sur machine réelle") — consignées ici pour
ne pas les perdre, **pas encore commencées**. Chaque piste est décrite avec
son état réel actuel (certaines existent déjà partiellement) et la
recommandation donnée au moment où elle a été discutée.

## 1. Toujours répondre en français, sauf si la question est dans une autre langue

**État actuel** : pas fait. Le comportement linguistique dépend aujourd'hui
du modèle par défaut (`agent-default-model`), sans consigne explicite.

**Piste** : ajouter une consigne au `system-prompt` de `dsh` (voir
`personaPrefix`/`personaSuffix` dans `--dump-config`, plugin
`@deepseek-ai/dsh-system-prompt`) ou un skill dédié. Le plus simple des cinq
points listés ici — aucune contrainte technique identifiée.

## 2. Un LLM par expertise (code, comptabilité, langue, recherche...)

**État actuel** : un seul modèle actif à la fois (`05-configs/modeles.yaml`,
`04-scripts/basculer-modele.sh`) — changer de modèle implique un
déchargement/rechargement (quelques dizaines de secondes).

**Contrainte réelle** : les modèles de ce projet font 15-19 Go chacun ; les
24 Go du Mac Mini ne permettent pas d'en garder plusieurs chargés
simultanément pour un vrai routage instantané par sujet.

**Recommandation donnée** : plutôt qu'un vrai changement de modèle par
domaine (lent, coûteux en RAM), donner au modèle unique actif des **skills
"personas"** par domaine (comptable, prof de langue, assistant personnel) —
réutilise l'architecture `01-skills/` déjà en place, sans coût de
rechargement. Un vrai changement de modèle reste envisageable plus tard si
le besoin de qualité par domaine dépasse ce qu'un bon skill peut faire.

## 3. Accès à des sandbox Docker pour les propres tests de l'agent

**État actuel** : existe déjà. `01-skills/skill-testeur-docker.md` +
`04-scripts/docker-test-runner.js` montent un conteneur Docker isolé pour
exécuter/valider du code, invoqués par `01-skills/skill-controleur-qualite.md`
("Test Pratique"). `04-scripts/security-check.sh` vérifie la présence de
Docker et l'activation du user namespace.

**Reste à faire** : confirmer en conditions réelles que `skill-testeur-docker`
s'engage vraiment en pratique — jamais observé directement dans les tests de
`suite-tests-reelle.sh` jusqu'ici (les tâches 3a/3b, HTML5/WordPress, n'ont
jamais déclenché ce chemin).

## 4. Étoffer les connaissances : sagesse, livres PDF pour le RAG, skills relationnels

**État actuel** : `01-skills/skill-personnalite-et-sagesse.md` est un point
d'entrée volontairement vide. `06-data/personnalite/` et `06-data/sagesse/`
sont déjà indexés automatiquement par `04-scripts/watch-knowledge-base.js`
(aucun changement de code nécessaire pour y ajouter des fichiers `.md`).

**Reste à faire** :
- Vérifier si `watch-knowledge-base.js` sait déjà extraire le texte d'un PDF,
  ou s'il faut ajouter une étape d'extraction avant indexation.
- Décider du format pour les "clés" relationnelles personnelles (nouveau
  skill dédié vs fichiers dans `06-data/sagesse/`) — pas encore tranché.

## 5. Docker par projet, pour isoler plusieurs projets de code en parallèle

**État actuel** : pas fait. Seule l'isolation ad hoc de `skill-testeur-docker`
existe (un conteneur par tâche de test, pas persistant par projet).

**Recommandation donnée** : ne pas construire un orchestrateur multi-projets
avant d'avoir rencontré un vrai conflit de dépendances entre deux projets
concrets. Un seul modèle local tourne à la fois sur cette machine — monter
plusieurs conteneurs isole les environnements d'exécution, mais n'apporte
pas de vrai parallélisme de traitement. Si un vrai conflit apparaît : un
gabarit de conteneur par type de projet (un `Dockerfile` standard "Node", un
autre "Python") serait l'étape suivante logique, pas un système plus large.

---

Aucune de ces pistes n'a de code associé pour l'instant — ce fichier existe
pour ne pas les perdre entre deux sessions, pas comme engagement à les
construire dans un ordre particulier.
