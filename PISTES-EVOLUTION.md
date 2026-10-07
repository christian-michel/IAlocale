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

**Point d'ancrage concret, déjà vu dans un vrai `--dump-config`** (round 9,
voir README) :
```yaml
- id: system-prompt
  config:
    personaPrefix: You are a coding agent powered by the {{model}} model.
    personaSuffix: Your working directory is {{cwd}}.
```
C'est très probablement le bon endroit pour glisser la consigne de langue
(ex. ajouter au `personaPrefix` : "Réponds toujours en français, sauf si la
question est posée dans une autre langue.") — à vérifier que ce champ
accepte une valeur personnalisée via un patch de profil, comme
`customSkillDirs`/`tool-web` l'ont déjà été (round 6/12).

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

**Analyse complète (pourquoi ce choix, pas juste la conclusion)** :

Un skill n'ajoute pas de connaissance au modèle — c'est une injection de
prompt système (instructions, méthode, restrictions d'outils), pas un
entraînement. Il peut façonner le **ton**, la **méthode**, le **format**
("pense comme un comptable : vérifie ces points dans cet ordre, signale
toute incertitude plutôt que d'arrondir"), mais ne peut pas compenser une
vraie lacune de connaissances du modèle de base. Si le modèle actif connaît
mal un domaine, aucun skill "persona" ne va lui injecter cette
connaissance — un skill dirige un modèle déjà compétent, il n'en invente
pas un.

Donc la vraie question n'est pas "skill contre modèle" en général, mais
spécifique à chaque expertise visée, et seulement vérifiable à l'usage :

- **Code** : `qwen3-coder` est déjà le modèle par défaut de ce projet —
  rien à changer.
- **Comptable / juridique / langue** : si le modèle actuel répond déjà
  correctement sur ces sujets dès qu'un bon skill cadre la méthode, un
  skill suffit, point final. Si ses réponses manquent de justesse
  factuelle sur un domaine précis malgré un skill bien écrit, c'est le
  signal qu'un **vrai changement de modèle** serait justifié pour CE
  sujet-là — vers `mistral-small3.2` ou un autre modèle déjà présent dans
  `ollama list`, plus généraliste que `qwen3-coder`. Mais basculé **une
  fois par session de travail**, pas en temps réel par message : c'est
  très exactement ce que `04-scripts/basculer-modele.sh` permet déjà
  aujourd'hui, sans aucun développement supplémentaire. La bascule
  "automatique selon le sujet, message par message" demandée initialement
  est la partie coûteuse en RAM/latence à éviter ; la bascule "une fois en
  début de session selon le sujet du jour" est déjà résolue.
- **Recherche internet** : besoin d'un accès web, pas seulement d'un autre
  modèle — à traiter séparément. Rappel : l'outil de recherche web natif de
  `dsh` a été désactivé (round 12, voir README) parce que câblé sur l'API
  cloud DeepSeek, contraire au principe local de ce projet. Une recherche
  web qui resterait locale/maîtrisée demanderait un autre mécanisme, pas
  encore défini.

**Prochaine étape concrète si cette piste est reprise** : tester les
skills-personas sur chaque domaine avec le modèle actuel d'abord, et ne
basculer vers un changement de modèle par session que si un vrai déficit
de connaissance est observé en pratique — pas avant, et jamais
automatiquement message par message. Le coût réel d'un déchargement/
rechargement complet (~18 Go) n'a jamais été mesuré précisément dans ce
projet (juste estimé "quelques dizaines de secondes" par analogie avec les
temps de chargement déjà observés) — à chronométrer pour de vrai avant de
trancher si cette piste devient active.

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

## 6. Multimodal : lire PDF/images (vision), voix en entrée/sortie, génération d'images

Quatre capacités distinctes, à ne pas traiter comme un seul bloc — chacune
a ses propres contraintes matérielles sur cette machine.

**Lire des PDF et des images (vision)** : état actuel pas clair — une piste
existait déjà dans `install-plugins.sh` depuis la toute première version du
projet (`@liustack/modlens`, "vision, routable vers Ollama en local"), mais
jamais testée ni confirmée installée au fil des 13 rounds de validation
réelle. Reste à vérifier : (1) si ModLens est effectivement installé et
fonctionnel, (2) si l'un des modèles déjà présents dans `ollama list`
(`qwen3-coder`, `mistral-small3.2`, `openchat`, `glm-4.7-flash`, `llama3`,
`mistral`) a de vraies capacités vision — aucun n'est confirmé vision-capable
ici, à vérifier plutôt qu'à supposer. Si aucun ne l'est, il faudrait tirer un
modèle vision dédié (ex. famille Qwen2-VL), avec le même arbitrage RAM que
le point 2 (un modèle de plus à charger, sur un budget déjà serré).

**Voix en entrée (commandes vocales) et en sortie (réponse parlée)** : la
piste la plus simple des quatre — ne touche pas au gros modèle de langage.
Transcription locale légère en entrée (ex. `whisper.cpp`, quelques centaines
de Mo, tourne bien sur Apple Silicon), voix de sortie via la commande `say`
native de macOS ou un moteur TTS local plus naturel. S'ajoute en périphérie
de `dsh` (transcription → texte envoyé en prompt, réponse texte → synthèse
vocale), sans concurrencer le budget RAM/GPU déjà serré du LLM principal.

**Génération d'images** : nécessite un modèle de diffusion (Stable
Diffusion/SDXL/Flux ou équivalent), une famille de modèle complètement
différente des LLM de texte. Même casse-tête RAM/GPU que le point 2 : les
24 Go de ce Mac Mini ne permettent probablement pas de garder le LLM de
chat ET un modèle de diffusion chargés simultanément — à utiliser en
séquence (décharger l'un pour charger l'autre), pas en parallèle, sauf à
vérifier qu'un modèle de diffusion suffisamment léger changerait ce calcul.

**Reste à faire avant de construire quoi que ce soit** : vérifier l'état
réel de ModLens, confirmer ou infirmer les capacités vision des modèles
déjà présents, et tester un couple whisper.cpp/`say` en conditions réelles
(c'est la piste la moins chère à valider des quatre).

---

Aucune de ces pistes n'a de code associé pour l'instant — ce fichier existe
pour ne pas les perdre entre deux sessions, pas comme engagement à les
construire dans un ordre particulier.
