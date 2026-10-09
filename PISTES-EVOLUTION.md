# Pistes d'évolution

Idées soulevées en discussion après la validation complète du projet (voir
`documentation/historique-du-projet.md`, section "Validation sur machine réelle") — consignées ici pour
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
voir documentation/historique-du-projet.md) :
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
  `dsh` a été désactivé (round 12, voir documentation/historique-du-projet.md) parce que câblé sur l'API
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

**Mise à jour — tranché et construit** : le format pour les "clés"
relationnelles est décidé. Les clés gouvernent un **comportement**
(comment recevoir/décortiquer une information, quelle posture adopter) —
elles vivent comme un **skill** (`01-skills/skill-cles-relationnelles.md`,
vide pour l'instant, à remplir par l'utilisateur), pas comme une donnée
passive dans `06-data/`. Raison : un skill est déjà dans le périmètre
sûr d'`auto-implementer.js` (`modifier-skill`) — si l'agent juge un jour
qu'une clé devrait être révisée, il peut le proposer via le mécanisme
d'auto-implémentation existant, sans qu'il faille étendre son périmètre.
Les **citations des sages**, à l'inverse, sont de la référence passive
(pas un comportement à réviser) — elles vivent dans
`06-data/sagesse/citations-sages/`, indexées automatiquement, sans
mécanisme de révision.

Un nouveau skill `01-skills/skill-persona-relations-humaines.md` encode
l'ordre de priorité strict demandé : clés internes d'abord, citations de
sagesse ensuite, élargissement par raisonnement général en tout dernier
recours et seulement en renforcement — jamais en remplacement.

**Également construit, dans la même discussion** : `01-skills/skill-
raisonnement-scientifique.md` (jamais défini avant, rédigé sur des bases
de méthode scientifique standard — distinction fait/hypothèse/opinion,
falsifiabilité, quantification de l'incertitude) et `01-skills/skill-
apprentissage-par-confirmation.md`, qui ferme une boucle demandée
explicitement : demander confirmation après une réponse substantielle,
et l'enregistrer via `04-scripts/memoire-cli.js` (déjà existant, aucun
nouveau script) pour répondre plus vite et plus précisément la prochaine
fois sur un sujet similaire.

**Pas encore testé en conditions réelles** : la commande
`memoire-cli.js set/search --type reponse-validee` a été vérifiée
isolément (fonctionne comme documenté), mais jamais le comportement réel
du skill en conversation — est-ce que l'agent demande la confirmation au
bon moment, pas trop souvent, et retrouve bien une réponse validée la
fois suivante ?

**Mise à jour — deux ajouts supplémentaires construits dans la même
discussion**, en réponse à un besoin de réversibilité et de richesse
contextuelle :
- **Backup/restore pour la mémoire structurée**
  (`memoire-cli.js backup/list-backups/restore`) — comblait un vrai
  trou : `06-data/memoire/` est explicitement hors git
  (`.gitignore` — "état d'exécution, propre à chaque machine"), donc
  contrairement au reste du projet, aucun commit n'y donnait de point de
  restauration. `clear` crée désormais un backup automatique avant
  d'effacer. Testé de bout en bout (set → backup → modification →
  restore → re-vérification).
- **`01-skills/skill-comparateur-scenarios.md`** — formule deux approches
  concrètes pour une tâche récurrente, les évalue avec
  `skill-evaluateur`, garde le gagnant et l'affine par petites
  variations à l'occasion suivante plutôt que de repartir de zéro.
  Consigne chaque comparaison avec un contexte riche (tags
  domaine/situation/contrainte, pas un mot-clé générique) — c'est cette
  richesse-là qui construit, avec le temps, un vrai répertoire d'actions
  adaptées au contexte plutôt qu'une réponse figée par type de tâche.
  Jamais observé en conditions réelles.

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

## 7. Appel automatique à Laya par les agents, décidé par une auto-évaluation de fiabilité

**Contexte** : vient juste après le retrait de la sélection automatique
`--domaine` (Round 22, `documentation/historique-du-projet.md`) — `laya`
avait planté en usage réel une fois branché sans supervision. Cette
piste est une tentative différente de rendre l'appel automatique, pas
une relance du même mécanisme : au lieu d'une heuristique de mots-clés
décidée à l'avance (le code/pas-le-code), l'agent évaluerait lui-même,
tâche par tâche, si `laya` est fiable avant de lui en confier le
traitement.

**Idée telle que formulée par l'utilisateur**, à affiner, décrite en
étapes :
1. L'agent définit une tâche à faire (ex. classer/trier un lot
   d'éléments, trancher une série de questions fermées répétitives).
2. Il demande à `laya` d'estimer sa propre fiabilité sur cette tâche —
   un pourcentage de confiance par réponse.
3. Selon la proportion de réponses au-dessus de 80 % de confiance, il
   choisit : (a) tout confier à `laya`, (b) ne rien lui confier, ou (c)
   lui confier la partie où sa confiance dépasse 80 % et traiter
   lui-même le reste.
4. But : gagner du temps et consommer moins d'énergie que de tout
   traiter avec le gros modèle.

**But déjà discuté, lié** : le seuil de 80 % mentionné correspond à
`--seuil-confiance` dans `decision-rapide.js`, déjà existant (réglé
différemment selon les endroits aujourd'hui — 0.6 dans l'exemple du
skill, 0.75 dans le workflow) — à harmoniser à 0.8 quand cette piste sera
reprise, pas un nouveau mécanisme à inventer.

**Remarques/suggestions à garder pour la reprise** (pas tranchées,
l'utilisateur a explicitement dit que le process restera à affiner) :
- **Coût du chargement à froid** (Round 20 : ~362s pour charger `laya`,
  `laya` n'a pas de serveur persistant — voir "Pas de serveur
  persistant" dans `skill-decision-rapide.md`) : l'étape 2 (sonder la
  confiance) et l'étape 3 (traiter réellement) rechargeraient le modèle
  deux fois si elles ne sont pas faites dans le même processus/la même
  session chargée — à concevoir pour ne charger qu'une fois.
- **Sur quoi porte le sondage de confiance** : un échantillon des
  éléments réels à traiter, ou l'ensemble d'entre eux par avance ? Si
  c'est l'ensemble, l'étape 2 fait déjà presque tout le travail de
  l'étape 4 (classer) — à clarifier si le sondage doit rester un
  échantillon représentatif plus léger que la tâche complète.
- **Alimenter `journal-desaccords.js` au passage** : chaque décision de
  "confier/ne pas confier" à `laya`, et son résultat réel une fois
  connu, est exactement le genre de donnée que ce journal existe pour
  accumuler (voir Round 21, piste du fine-tuning) — à relier plutôt qu'à
  dupliquer un mécanisme de journalisation séparé.
- **Préalable non négociable avant toute implémentation** : `--moteur
  laya` doit avoir été rejoué manuellement plusieurs fois sans plantage
  (validation en cours par l'utilisateur, voir Round 22) avant de
  construire quoi que ce soit ici — la cause du plantage initial n'a
  toujours pas été diagnostiquée.

**Séquencement convenu avec l'utilisateur** : d'abord stabiliser et
valider le fonctionnement avec `ollama` seul sur la branche actuelle,
fusionner cette branche dans `main` une fois validé par l'utilisateur en
conditions réelles ; **puis**, sur une nouvelle branche du même dépôt
(pas un projet séparé — voir la discussion qui a précédé cette piste),
reprendre ce travail sur l'usage automatique de `laya`.

**État actuel** : pas commencé, aucune ligne de code écrite. Consigné
ici uniquement pour ne pas perdre l'idée entre deux sessions.

---

Aucune de ces pistes n'a de code associé pour l'instant — ce fichier existe
pour ne pas les perdre entre deux sessions, pas comme engagement à les
construire dans un ordre particulier.
