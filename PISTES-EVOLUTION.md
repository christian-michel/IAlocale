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

## 8. Laya comme routeur à l'entrée de la conversation (triage du prompt)

**Lien avec le point 7** : même pattern (sonder `laya` avec un seuil de
confiance, 80 % ici aussi, basculer sur `ollama` en dessous), mais
appliqué à un moment différent — pas pour déléguer une tâche répétitive
*pendant* le travail d'un agent, mais pour trier *chaque prompt entrant*
avant même de décider quel chemin de l'orchestrateur l'emprunte. Mêmes
préalables que le point 7 (`--moteur laya` validé manuellement sans
plantage, projet unique, travail sur une nouvelle branche après fusion
d'`ollama` dans `main`).

**Objectif clarifié par l'utilisateur** : pas seulement trier le prompt
vers le bon chemin, mais **réduire les hallucinations du gros modèle**
en ne lui donnant jamais le prompt brut tel quel. `laya` produirait en
amont un artefact plus propre — un JSON clair, un prompt reformulé plus
précis, un classement fiable, voire dans certains cas une anticipation
de la prochaine action probable — et ne renverrait ce retour au LLM
qu'une fois cet artefact prêt, pour que le LLM parte d'une base mieux
orientée plutôt que d'un texte ambigu, et réponde plus vite.

**Avis donné à ce stade** (discussion, rien tranché) :
- Pour tout ce qui reste une décision fermée (JSON structuré, classement,
  tri) : cohérent avec ce que `laya` fait déjà ailleurs dans ce projet
  (sortie contrainte par schéma, comme `decision-rapide.js` le fait déjà
  côté `ollama`) — étendre ce principe en amont du LLM plutôt qu'à côté
  de lui est une extension naturelle, pas un nouveau principe.
- "Anticiper la prochaine action possible" est différent : une tâche
  ouverte/générative, pas une décision fermée avec pourcentage de
  confiance — ce n'est pas le genre de chose que les trois types fixes
  de `laya` (`noul`/`choice`/`score`) sont conçus pour bien faire. À
  traiter séparément du reste si cette piste est reprise, pas comme une
  simple variante de "classement fiable".
- La prémisse elle-même ("un artefact structuré en amont réduit les
  hallucinations du LLM qui reçoit ensuite ce retour") est plausible
  mais non vérifiée dans ce projet — à mesurer réellement une fois cette
  piste reprise (comparer les réponses du LLM avec et sans ce passage
  par `laya` sur les mêmes prompts), pas à supposer.

**Idée telle que formulée par l'utilisateur**, à affiner (mécanique de
routage proprement dite) :

1. Pour chaque prompt reçu, `laya` répond à plusieurs questions fermées
   avec un pourcentage de confiance chacune : *est-ce urgent ?*,
   *est-ce technique ?*, *est-ce du développement personnel /
   coaching ?* (une quatrième question, *"est-ce de la technique ?"*,
   reprend la deuxième telle que formulée par l'utilisateur — probable
   redite plutôt qu'un vrai quatrième axe distinct ; à clarifier à la
   reprise, pas corrigé ici pour rester fidèle à la demande).
2. Si une réponse est sous 80 % de confiance, bascule sur `ollama`, qui
   peut alors poser une ou plusieurs questions à l'utilisateur pour
   préciser le contexte manquant.
3. Retour vers `laya` pour retenter une réponse sur les éléments qui
   manquaient, maintenant que le contexte est plus précis.
4. Routage selon le résultat final :
   - **Développement personnel / coaching / sagesse** → l'orchestrateur
     consulte en premier les contenus du dossier `06-data/sagesse/`
     (cohérent avec l'ordre de priorité déjà construit dans
     `01-skills/skill-persona-relations-humaines.md` : clés internes
     d'abord, citations de sagesse ensuite, raisonnement général en
     dernier recours — ce routage déciderait donc *quand* déclencher
     cette chaîne existante, sans la remplacer).
   - **Code / technique** → chemin classique déjà en place :
     orchestrateur, skills, agents, `qwen3-coder` comme LLM.
   - **Ni l'un ni l'autre** → l'orchestrateur retombe sur son
     architecture de pensée de base pour échanger et construire la
     conversation, sans routage spécialisé.

**Remarques à garder pour la reprise** (non tranchées) :
- **Effet de l'axe "urgence"** non précisé dans le routage décrit —
  les trois branches finales (coaching, technique, aucun des deux) ne
  disent pas ce que change une réponse "urgent". À définir quand cette
  piste sera reprise.
- **Mécanisme déjà disponible, rien de neuf à inventer côté outillage** :
  chaque question fermée de ce triage est exactement ce que
  `decision-rapide.js --type oui-non --moteur laya --seuil-confiance
  0.8` fait déjà aujourd'hui pour une question isolée — la nouveauté
  ici est l'enchaînement (plusieurs questions, boucle de reprécision
  via `ollama`, routage final), pas un nouveau mode de décision.
- **Reste à définir** : le nombre d'allers-retours autorisés entre
  `ollama` (clarification) et `laya` (nouvelle tentative) avant
  d'abandonner et de rester sur `ollama` pour la suite — sans limite,
  un contexte vraiment ambigu pourrait boucler longtemps avant même de
  commencer à répondre à l'utilisateur.

**État actuel** : pas commencé, aucune ligne de code écrite.

## 9. Modèle de référence fourni par l'utilisateur : le traitement d'un prompt en 8 étapes

**Source** : un document (PDF) partagé par l'utilisateur — lui-même un
jeu de diapositives générique décrivant comment un assistant IA traite
une requête, étape par étape, avec en commentaire systématique l'idée
d'évaluer à chaque étape si `laya` pourrait y contribuer. Consigné ici
comme référence à relire quand les pistes 7/8 (et au-delà) seront
reprises — pas un plan d'implémentation en 8 modules.

**Les 8 étapes du modèle de référence**, telles que présentées :
1. **Assembler le contexte** — instructions système, outils/skills,
   contexte personnel, historique, message, fichiers/résultats d'outils.
2. **Tokeniser & calculer** — détail d'infrastructure du modèle, hors
   périmètre de ce que ce projet peut influencer directement.
3. **Comprendre** — extraire intention, contraintes, références
   implicites, ton/registre, ambiguïté, contexte personnel ("ICRATP").
4. **Classer la demande** — sept familles (conversation, savoir stable,
   info actuelle, données perso, livrable, action différée, sujet
   sensible), chacune avec un traitement typique associé. Une étape
   "4 bis" annexe précise en plus *où la réponse va vivre* (réponse
   directe, fichier, artefact type, code, ou clarification d'abord si
   trop ambigu).
5. **Évaluer les risques** — jugement intégré (refus net / prudence et
   cadrage / contraintes de forme), pas un filtre séparé plaqué après
   coup.
6. **Planifier & agir** — la boucle agentique (réfléchir → appeler un
   outil → lire le résultat → ajuster le plan, jusqu'à ce que le
   résultat soit prêt). **C'est l'étape sur laquelle le travail déjà
   fait sur IAlocale s'est le plus concentré jusqu'ici**, selon
   l'utilisateur.
7. **Rédiger** — adapter langue/registre, longueur, structure, sources
   et honnêteté sur l'incertitude au besoin réel plutôt qu'à un format
   figé.
8. **Vérifier & livrer** — contrôler faits, calculs, documents, visuels,
   avant la livraison proprement dite.

Quatre points de synthèse ("à retenir") : c'est un **réseau, pas un
organigramme** (les étapes décrivent un comportement appris, pas des
modules séparés qui s'enchaînent mécaniquement) ; **le contexte fait
tout** (instructions, outils et historique déterminent ce qui est
possible/dû) ; **le format suit l'usage**, pas l'inverse ; le
comportement reste **probabiliste** (un même prompt peut produire des
réponses différentes, d'où l'intérêt de vérifier).

**Mise en correspondance avec IAlocale, donnée par l'utilisateur** :
- **Étape 8 (Vérifier & livrer)** correspond à ce qu'`01-skills/skill-
  controleur-qualite.md` fait déjà — avec un ajout explicite : *un
  second agent qui contrôle la manière dont l'agent de contrôle a fait
  son travail, ainsi que la conformité de la réponse avec l'attendu*.
  C'est exactement le rôle déjà construit par `01-skills/skill-
  controleur-de-controle.md` (double contrôle) — confirme que cette
  partie de l'architecture existante correspond déjà au modèle de
  référence, rien de nouveau à construire ici.
- **Étape 6 (Planifier & agir / boucle agentique)** est, selon
  l'utilisateur, celle sur laquelle le travail passé sur IAlocale a le
  plus porté (voir `04-scripts/boucle-hook-stop.js`,
  `04-scripts/boucle-surveillance.sh`, `01-skills/skill-boucles-
  agentiques.md`).
- **Le fil rouge Laya** (répété après chaque étape dans le document
  source, mot pour mot identique à ce qui a déjà été discuté et
  consigné aux points 7 et 8 ci-dessus) : évaluer, à *chacune* des 8
  étapes, si `laya` pourrait y contribuer — pas seulement au point
  d'entrée (classement de la demande, étape 4) ou pour déléguer une
  sous-tâche (point 7), mais potentiellement aussi pour l'évaluation
  des risques (étape 5, elle aussi une décision assez fermée par
  nature) ou pour le choix du format de sortie (étape 4 bis). Rien de
  neuf par rapport aux points 7/8 dans le mécanisme lui-même ; ce qui
  est nouveau, c'est le cadre des 8 étapes pour situer *où* ces
  évaluations pourraient s'insérer.

**Objectif final tel que formulé par l'utilisateur** (dernière page du
document) : *"reproduire au mieux ce système en local avec
l'orchestrateur, les skills, les plugins, le LLM et Laya."* — cohérent
avec la mission déjà posée dans `README.md`, maintenant rattachée
explicitement à ce modèle de référence en 8 étapes.

**Remarque à garder pour la reprise** : le point "à retenir" n°1 du
document source ("un réseau, pas un organigramme") met en garde contre
une lecture trop littérale — ces 8 étapes décrivent un comportement, pas
une liste de modules à coder un par un dans l'ordre. À utiliser comme
grille de lecture pour auditer ce qu'`01-skills/` couvre déjà et ce qui
manque, pas comme plan d'implémentation séquentiel.

**Exigence précisée par l'utilisateur, en relisant ce point** : au
moment venu, l'orchestrateur devra avoir la capacité de **marquer
correctement et de la manière la plus fiable possible** à quelle étape
il se trouve parmi les 8, et de **diagnostiquer explicitement le
message** selon les six axes de l'étape 3 (intention, contraintes,
références implicites, ton & registre, ambiguïté, contexte personnel —
"ICRATP" dans ce fichier). Pas juste suivre ce modèle en arrière-plan de
façon implicite : le rendre visible/traçable dans le fonctionnement
réel.

**Tension à résoudre à la reprise, pas maintenant** : ça va plus loin
que la mise en garde "un réseau, pas un organigramme" juste au-dessus —
marquer fiablement une étape *suppose* un signal explicite quelque part
(log, champ structuré...), pas seulement un comportement diffus. Reste à
définir, le moment venu : qu'est-ce qui marque une étape — un log
structuré par skill/étape (cohérent avec `dsh-logger.js`, déjà utilisé
partout), une sortie JSON explicite type diagnostic ICRATP produite en
amont de chaque réponse, autre chose ? Et doit-on tagger les 8 étapes
pour de vrai, ou seulement celles qui bénéficient concrètement d'un
traitement différencié (ex. étape 3/ICRATP et étape 5/risques semblent
plus immédiatement actionnables que étape 2/tokenisation, hors de portée
de ce projet). Lié au point 10 : un marquage fiable des étapes est aussi
ce qui permettrait de mesurer *où* le temps/les ressources sont dépensés
à chaque étape, pas seulement en bout de chaîne.

**État actuel** : observé et consigné, comme demandé. Aucune ligne de
code écrite — attente du retour de l'utilisateur sur la validation
d'`ollama` seul et de la fusion dans `main` avant toute reprise de ce
chantier (points 7, 8 et 9).

## 10. Mesurer la finesse réelle du paramétrage, pas seulement l'existence fonctionnelle

**Demandé explicitement par l'utilisateur** : ce qui compte n'est pas
qu'un mécanisme existe, mais qu'il exécute *efficacement, rapidement et
finement* le travail demandé — en temps, en ressources, en justesse et
en pertinence. `suite-tests-reelle.sh` (voir
`documentation/historique-du-projet.md`) valide déjà que les choses
*fonctionnent* (pass/fail) ; rien à ce jour ne mesure *à quel point*
elles fonctionnent bien. Ce point consigne le besoin, pas encore une
implémentation.

**Quatre axes de mesure distincts, à ne pas confondre** :
- **Temps** : latence par type de requête (réponse directe, décision
  rapide, recherche avec outils, génération de fichier...). Plusieurs
  briques exposent déjà des chiffres bruts à exploiter plutôt qu'à
  réinventer : `decision-rapide.js` sépare `chargement_ms`/`decision_ms`
  dans `detail_timing` (voir Round 20) ; `dsh-logger.js` horodate déjà
  chaque étape journalisée.
- **Ressources** : RAM/GPU unifiée du Mac Mini (contrainte déjà centrale
  au point 2 — un seul modèle ~15-19 Go chargé à la fois) ; `ollama ps`
  donne l'état réel du modèle chargé, déjà utilisé comme vérification
  manuelle dans le README (étape 3 de l'installation détaillée) mais
  jamais consigné automatiquement.
- **Justesse** : mesurable objectivement pour tout ce qui a une réponse
  vérifiable (décisions fermées de `decision-rapide.js`, résultats de
  calcul, conformité à un schéma) — `journal-desaccords.js` capture déjà
  une partie de ce signal pour les décisions rapides (accord/désaccord
  avec la comparaison délibérative, voir Round 21).
- **Pertinence** : plus subjective (une réponse peut être juste sans
  être la plus utile) — deux mécanismes existants captent déjà un signal
  proche sans être pensés comme un outil de mesure : `skill-evaluateur`
  (note un résultat) et `skill-apprentissage-par-confirmation` (demande
  confirmation à l'utilisateur après une réponse substantielle, consigne
  via `memoire-cli.js --type reponse-validee`). À vérifier si ce signal
  suffit tel quel ou s'il faut un mécanisme dédié.

**Principe directeur pour la suite** : ne pas construire un nouveau
mécanisme de mesure par axe sans d'abord vérifier ce que les briques
existantes exposent déjà (comme ci-dessus) — cohérent avec la discipline
déjà appliquée ailleurs dans ce projet (ne pas dupliquer, ne pas
inventer ce qui peut être vérifié).

**Lien direct avec les points 7/8/9** : ce travail de mesure n'est pas
seulement un chantier à part — c'est le mécanisme qui rendra vérifiable
l'hypothèse non tranchée au point 8 ("réduire les hallucinations" via
`laya`) et toute amélioration annoncée par l'intégration de `laya` en
général. Sans mesure *avant* (ollama seul, une fois stabilisé — l'état
que l'utilisateur teste actuellement) et *après* (une fois `laya`
intégré), aucune comparaison ne serait crédible — même principe déjà
posé au point 2 ("à chronométrer pour de vrai avant de trancher").
**Séquencement proposé** : établir une mesure de référence (temps,
ressources, justesse) sur la branche `ollama` seul, une fois validée et
fusionnée dans `main` — avant d'attaquer les points 7/8/9, pas après.

**Reste à définir avant toute implémentation** :
- Un jeu de requêtes représentatif et stable à rejouer à l'identique
  d'une mesure à l'autre (sans quoi aucune comparaison n'a de sens) —
  les sept familles de demandes du point 9 sont un candidat naturel de
  base.
- Qui/quoi juge la "pertinence" de façon répétable : relecture humaine
  systématique, ou un des mécanismes existants cités plus haut,
  suffisamment fiable pour ça ?
- Où stocker ces mesures dans le temps (nouveau journal JSONL dans
  `06-data/memoire/`, sur le même principe append-only que
  `journal-desaccords.js` ? à trancher).

**État actuel** : besoin consigné, aucune ligne de code écrite. Reprise
prévue après validation et fusion d'`ollama` seul dans `main`, avant les
points 7/8/9.

## 11. Axes de consolidation du modèle actuel — validés par l'utilisateur, à traiter avant les points 7/8/9

**Séquencement décidé** : l'utilisateur a validé ces six axes comme
priorité immédiate, **avant** de reprendre les pistes Laya (points
7/8/9) — consolider d'abord le socle `ollama` plutôt que d'empiler de
nouveaux mécanismes dessus. Les points 7/8/9 restent une source
d'inspiration pour la suite, pas abandonnés — juste après celui-ci dans
l'ordre de reprise.

### 11.1 Vérifier l'orchestration elle-même avant d'empiler dessus

**Constat** : l'exécution réelle d'un `.workflow.json` par `dsh-workflow`
(plusieurs étapes enchaînées, pas un script isolé) n'a jamais été
vérifiée de bout en bout en conditions réelles — seuls les scripts
individuels qu'un workflow appelle l'ont été, chacun isolément (voir
`documentation/historique-du-projet.md`, section "Non vérifiable").
Construire les pistes 7/8/9 sur une couche d'orchestration jamais
confirmée reviendrait à bâtir sur une hypothèse, pas un fait vérifié.

**Recommandation** : avant toute reprise des pistes Laya, faire tourner
`03-workflows/systeme-auto-ameliorant-avec-controle.workflow.json` pour
de vrai sur la machine cible et confirmer qu'il s'exécute comme écrit
(boucle, sorties, repli délibératif inclus).

### 11.2 Réduire le coût de contexte à chaque tour

**Constat** : les 27 skills de `01-skills/` (en langage naturel) et le
catalogue d'outils de `dsh` sont vraisemblablement injectés en entier à
chaque message, pas seulement ceux pertinents pour la demande en cours —
le même problème que `decision-rapide.js` contourne déjà en parlant
directement à Ollama plutôt que de passer par `dsh` (voir
`documentation/historique-du-projet.md`, "Optimisation Mac Mini M4",
~14 700 tokens de schémas d'outils pour une tâche triviale). Sur un
modèle local, ce coût pèse sur le temps de traitement du prompt à
*chaque* tour, qu'un outil serve ou non.

**Recommandation** : c'est le levier le plus direct pour une IAlocale
"efficace en fonction du contexte" — charger seulement les skills
pertinents pour la demande plutôt que le catalogue entier
systématiquement. Rejoint directement la piste 8 (Laya en routeur de
prompt) : son apport le plus concret et mesurable n'est peut-être pas
"réduire les hallucinations" (hypothèse non vérifiée, voir point 8) mais
réduire ce coût de contexte — à garder en tête quand cette piste sera
reprise.

### 11.3 Ne pas faire confiance aveuglément à la confiance auto-déclarée

**Constat** : tout l'édifice `--seuil-confiance` (`decision-rapide.js`,
moteurs `ollama` et `laya` confondus) repose sur le modèle qui
s'auto-évalue dans la même réponse qui contient sa décision — un biais
de sur-confiance documenté chez les LLM, pas une mesure indépendante.

**Recommandation** : `journal-desaccords.js` accumule déjà la matière
pour vérifier empiriquement si cette confiance auto-déclarée est bien
calibrée (corrèle-t-elle avec le fait d'avoir eu raison, une fois la
comparaison délibérative connue ?) — jusqu'ici pensé seulement comme
préparation à un futur fine-tuning de `laya` (voir point "Vers une
amélioration de Laya par l'usage" dans `skill-journal-desaccords.md`),
mais la même question de calibration se pose pour `ollama` et n'est
consignée nulle part ailleurs.

### 11.4 Mesurer avant d'annoncer une amélioration

Déjà couvert en détail au point 10 — répété ici comme axe de
consolidation à part entière : sans chiffres de référence sur l'état
actuel (temps, ressources, justesse), aucune évolution future
n'est vérifiable autrement que par impression.

### 11.5 Activer ce qui existe déjà mais reste inutilisé

**Constat** : `01-skills/skill-comparateur-scenarios.md` (formule deux
approches concrètes pour une tâche récurrente, les évalue avec
`skill-evaluateur`, garde la gagnante et l'affine par petites variations)
est déjà construit et documenté (voir point 4 ci-dessus) mais "jamais
observé en conditions réelles".

**Recommandation** : une fois le socle stabilisé, le brancher sur
quelques tâches récurrentes réelles serait un gain concret pour
améliorer "le modèle actuel" dans la durée, sans rien inventer de
nouveau — l'outil existe, il manque seulement l'usage.

### 11.6 Rendre traçable quel skill a réellement été engagé

**Constat** : les skills n'ont aucune instrumentation — impossible
aujourd'hui de vérifier après coup si le bon skill s'est déclenché pour
un type de demande donné.

**Recommandation** : un log léger, même principe que `dsh-logger.js`
(déjà utilisé partout ailleurs dans `04-scripts/`), rendrait ça
auditable. Rejoint directement l'exigence posée au point 9 sur le
marquage fiable des 8 étapes — un même mécanisme de traçabilité pourrait
servir les deux besoins plutôt que d'en construire deux séparés.

**État actuel** : six axes validés par l'utilisateur comme priorité
immédiate. Aucune ligne de code écrite — attente du retour utilisateur
sur les tests d'`ollama` seul et de la fusion dans `main` avant de
commencer concrètement l'un de ces six axes.

---

Aucune de ces pistes n'a de code associé pour l'instant — ce fichier existe
pour ne pas les perdre entre deux sessions, pas comme engagement à les
construire dans un ordre particulier.
