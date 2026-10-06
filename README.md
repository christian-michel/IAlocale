# dsh-harness — assistant IA local pour Mac Mini M4

Ce projet reprend et termine ce qui avait été commencé au début de cette
conversation : le CLI `dsh` (`@deepseek-ai/dsh`, un agent de codage
open-source dans l'esprit de Claude Code), avec les plugins demandés,
**configuré pour tourner 100 % en local sur Ollama** plutôt que sur l'API
cloud DeepSeek par défaut.

L'idée générale : un point de départ pour coder, pensé pour être étendu
progressivement (personnalité, sagesse, philosophie) sans tout reconstruire.

## 🧭 Pourquoi ce projet plutôt que l'autre (dsh-framework)

Voir la discussion complète dans la conversation, en résumé : `dsh` est un
agent généraliste extensible par skills/workflows/plugins — exactement ce
qu'il faut pour "commencer par le code, étendre ensuite". `dsh-framework`
(le projet Python qu'on avait corrigé et outillé de logs juste avant) était
un pipeline unique et figé, sans système d'extension, et pas réellement
local (Kimi Code, la partie qui écrivait le code, appelle une API cloud).
Les idées de ce projet-là (logs structurés, rétro-analyse) sont reprises
ici — voir plus bas.

## ✅ Vérifié dans ce paquet (testé, pas juste écrit)

- `dsh-logger.js` : testé en conditions réelles (erreurs normales, erreurs
  silencieuses, décorateur `catchAndLog`, relecture, résumé, contexte de
  rétro-analyse pour prompt).
- `watch-knowledge-base.js`, `docker-test-runner.js`, `security-check.sh` :
  exécutés réellement, logs structurés vérifiés.
- Fusion de `settings.yaml` (`setup-local-model.sh`) : testée avec un
  fichier existant contenant d'autres réglages — confirmé que seules les
  clés gérées (`llm-pi-ai.providers.ollama`, `agent-default-model`) sont
  modifiées, le reste est préservé intact.
- Les 19 skills : frontmatter YAML validé individuellement
  (`node 04-scripts/valider-skills-workflows.js`).
- Les 5 workflows : JSON validé syntaxiquement.
- Toute la chaîne shell (`start.sh`, `install-plugins.sh`,
  `security-check.sh`) : testée de bout en bout dans un environnement sans
  Docker/Ollama/dsh (le cas réel avant ta première installation) — échoue
  proprement avec des messages clairs, jamais de plantage silencieux.
- `memoire-cli.js` (`set`/`get`/`list`/`search`/`delete`/`clear`) et
  `boucle-hook-stop.js` (cas succès, cas échec par épuisement du plafond
  d'itérations, arguments manquants) : exécutés réellement, logs
  structurés vérifiés dans `pipeline.jsonl`.
- `boucle-surveillance.sh` : plusieurs cycles réels exécutés, arrêt
  propre sur signal (trap) vérifié.
- `basculer-modele.sh` : résolution de profil (`05-configs/modeles.yaml`)
  testée, y compris profil inconnu ; délégation à `setup-local-model.sh`
  confirmée jusqu'au point où Ollama devient nécessaire.
- `decision-rapide.js`, moteur `ollama` : testé contre un faux serveur
  Ollama (module `http` natif) rejouant la forme exacte de `/api/chat`
  documentée par Ollama — 7 scénarios couverts (oui-non,
  choix+justification, note sous le seuil de confiance, violation de
  schéma par le modèle, erreur HTTP, réponse non-JSON, modèle
  auto-détecté depuis `~/.dsh/settings.yaml`), revérifiés sans régression
  après le refactoring pour le moteur `laya`. Le comportement contre un
  VRAI Ollama (un vrai modèle respecte-t-il bien la contrainte de schéma
  en pratique ?) reste à confirmer sur ta machine.
- `decision-rapide.js`, moteur `laya` : ses deux garde-fous testés
  réellement (type `note` refusé proprement, paquet non installé détecté
  et signalé proprement). La décision elle-même (l'appel à
  `Laya.load`/`systemOne`) n'a pas pu être exécutée — voir section
  "Décision rapide" pour la cause précise (api.nuget.org bloqué dans mon
  environnement).
- `journal-desaccords.js` : testé directement — les trois résolutions
  (`accord`, `desaccord`, `escalade_sans_comparaison`), `resume` global
  et filtré (moyennes de confiance par résolution), `exporter` filtré,
  et résilience à une ligne JSONL corrompue (ignorée et signalée, pas de
  perte du reste du journal).
- `identifier-meilleur` + `decision-rapide.js` ensemble : 3 scénarios de
  bout en bout sur trois domaines différents (code, juridique, comptable
  — voir section "Décision rapide"), y compris le cas où la confiance est
  insuffisante et où le repli doit se déclencher.
- `suite-tests-reelle.sh` : exécuté intégralement contre un faux `dsh` et
  un faux Ollama, dans un dépôt git jetable (jamais celui-ci) — bug trouvé
  et corrigé dans le stub de test lui-même (pas dans le script), logique
  réelle confirmée : arguments transmis correctement à `dsh`, fichiers
  livrés aux bons chemins, auto-implémentation fusionne/rejette comme
  attendu. Ce que ce test NE prouve PAS : que le vrai `dsh` engage
  réellement le contrôle qualité en pratique, ni qu'un vrai modèle est
  bien calibré — c'est précisément ce que ce script sert à vérifier sur
  la vraie machine.

## ❌ Non vérifiable dans mon environnement

- Le vrai CLI `dsh` : le paquet complet a des centaines de
  sous-dépendances, l'installation dans mon bac à sable dépasse le temps
  imparti. Je n'ai donc **pas pu exécuter `dsh` lui-même**, seulement
  vérifier l'existence des paquets et leur documentation officielle.
- Le format exact des workflows JSON (`03-workflows/`) : je n'ai pas trouvé
  la spec formelle de `dsh-workflow`. Ils suivent la structure plausible
  du tutoriel d'origine, mais **teste-les avec un cas simple avant de t'y
  fier** — la syntaxe réelle peut différer sur des détails.
- `profile-plugins.yml` (config de `dsh-browser`/`modlens`) : structure
  reprise du tutoriel d'origine, non confirmée champ par champ. Vérifie
  avec `dsh --profile web --dump-config` après installation.
- `DSH-better-sidebar` : confirmé qu'il existe, mais je n'ai pas pu
  vérifier la syntaxe exacte d'installation depuis GitHub — le script gère
  l'échec proprement si la commande ne correspond pas.
- Un mécanisme de hooks natif dans `dsh` (équivalent au hook `Stop` de
  Claude Code) : jamais confirmé. `boucle-hook-stop.js` (section
  "Boucles agentiques") reproduit l'effet depuis l'extérieur en encadrant
  l'appel à `dsh`, sans dépendre d'un tel mécanisme — mais si `dsh` en
  expose un réellement, ce sera une meilleure option le jour où c'est
  vérifié.

## 📋 Vérification de la liste de plugins fournie

| Demandé | Statut | Ce que j'ai fait |
|---|---|---|
| `dsh-agent-harness` | N'existe pas tel quel | C'est `@deepseek-ai/dsh`, le CLI de base — installé en premier |
| `dsh_workflow` | Existe sous `dsh-workflow` (tiret) | Installé |
| `dsh-find-plugins` | Dépôt GitHub, pas un paquet npm | Cloné, skills copiés |
| `agentic-research` | Dépôt GitHub (BittnerPierre) | Cloné à côté (Python/uv, indépendant de dsh) |
| `DSH-better-sidebar` ou `dsh-web` | Le premier existe ; `dsh-web` n'est pas un plugin séparé | Sidebar installée ; `dsh web` reste la sous-commande de lancement |
| `ModLens` | `@liustack/modlens` | Installé, configuré pour Ollama local |
| `dsh-browser` | Existe | Installé, `autoApprove: false` |
| `dsh-TUI` | Existe sous `dsh-tui` | Installé (absent du paquet précédent, ajouté ici) |

## 🦙 Configuration locale (le point important)

Par défaut, `dsh` démarre branché sur l'API cloud DeepSeek. Ce projet le
reconfigure pour Ollama via `04-scripts/setup-local-model.sh`, qui :

1. Fixe `OLLAMA_CONTEXT_LENGTH` explicitement (sinon Ollama choisit un
   palier selon la mémoire détectée, ce qui peut silencieusement tronquer
   les conversations de l'agent sans qu'aucune erreur ne le signale — voir
   ci-dessous).
2. Télécharge le modèle choisi (`qwen3-coder:30b-a3b-q4_K_M` par défaut —
   change-le au besoin, ou utilise `04-scripts/basculer-modele.sh`) et
   vérifie que l'id déclaré correspond **exactement** (avec les `:`) à ce
   que sert Ollama, pour éviter un 404 silencieux.
3. Fusionne le bloc `provider` local dans `~/.dsh/settings.yaml`, sans
   toucher au reste de ta config.
4. Configure la variable `OLLAMA_API_KEY` (factice mais requise — dsh
   refuse de démarrer sans qu'une variable soit référencée, même pour un
   serveur qui n'exige pas de vraie clé).

### Pourquoi `OLLAMA_CONTEXT_LENGTH` mérite d'être fixé explicitement

D'après la documentation, Ollama choisit sa fenêtre de contexte par défaut
selon un palier de mémoire détectée — et si ce palier ne correspond pas à
ce que `dsh` croit avoir (`contextWindow` dans `settings.yaml`), certains
modèles tronquent silencieusement le milieu de la conversation sans rien
signaler (d'autres, comme les architectures DeepSeek, refusent franchement
— ce qui est en fait préférable, l'erreur est au moins visible). Vérifie
après coup avec `ollama ps` (colonne `CONTEXT`) que le nombre correspond
bien à ce que tu as déclaré.

## ⚡ Optimisation pour Mac Mini M4 / 24 Go

- **Le catalogue d'outils a un coût caché.** Sans aucun serveur MCP
  connecté, une tâche triviale ("lis ce fichier CSV") peut consommer
  ~14 700 tokens d'entrée rien qu'en schémas d'outils — un modèle local
  paie ça en temps de traitement du prompt, pas en argent. Si les
  réponses sont lentes, c'est souvent le premier levier à regarder avant
  de changer de modèle.
- **Modèle "instruct" plutôt que "thinking" par défaut pour le travail
  d'agent.** Un modèle qui réfléchit avant chaque appel d'outil passe le
  plus clair de son temps sur des tokens de raisonnement que la boucle
  d'agent jette ensuite — pour du code assisté par outils, un modèle
  instruct est souvent nettement plus rapide pour un résultat équivalent.
  Réserve le "thinking" aux tâches qui en ont vraiment besoin (skill
  `analyse-objectifs` par exemple), pas à l'exécution courante — voir les
  profils `rapide`/`reflexion` de `05-configs/modeles.yaml`, à sélectionner
  avec `04-scripts/basculer-modele.sh`.
- **Privilégie un MoE à peu de paramètres actifs plutôt qu'un dense de
  même taille "totale".** Le profil `rapide` (`qwen3-coder:30b-a3b-q4_K_M`)
  a 30 Md de paramètres au total mais n'en active que 3 Md par passe — la
  vitesse d'un petit modèle dense, les connaissances d'un plus gros.
- **Dimensionnement mémoire** : ce même modèle en Q4 tient dans ~19 Go —
  sur 24 Go de mémoire unifiée, il reste ~5 Go pour le contexte, le reste
  du système. Ne fais tourner qu'un seul profil à la fois (24 Go ne
  permet pas de charger `rapide` et `reflexion` simultanément).
- **Pourquoi pas Kimi-K2.6 ou GLM-5.2** (demandés initialement) : ce sont
  des MoE à ~1000 Md et ~744 Md de paramètres *totaux* — même en
  quantification la plus agressive publiée, ils demandent respectivement
  ~394 Go et ~241 Go de mémoire, très loin des 24 Go disponibles. Ollama
  ne les propose d'ailleurs qu'en tags `:cloud` (renvoi vers
  l'infrastructure Moonshot/Z.ai), ce qui violerait la contrainte "aucune
  API cloud" en tête de ce fichier. Détail et sources dans
  `05-configs/modeles.yaml`.

## 📝 Logs et rétro-analyse (repris et adapté du projet précédent)

`04-scripts/dsh-logger.js` journalise en JSON Lines dans `logs/pipeline.jsonl`,
avec le même principe que sur `dsh-framework` : un niveau `SILENT_ERROR`
pour tout ce qui, dans le code que l'agent écrit ou dans les scripts de ce
projet, serait autrement attrapé et oublié sans laisser de trace.

- **Consultation** : `node 04-scripts/errors-cli.js summary --hours 24`
  ou `... list --level SILENT_ERROR`.
- **Le skill `detection-erreurs-silencieuses`** encode les règles à
  appliquer dans tout code généré (jamais de `catch` vide, toujours
  logguer avant d'avaler une exception, attraper une exception précise
  plutôt que générique).
- **Rétro-analyse** : `errors-cli.js prompt-context` produit un résumé
  texte des erreurs récentes, injectable dans un prompt — utilisé dans le
  workflow `controle-qualite` avant de valider une réponse.
- **`skill-apprendre-des-echecs`** boucle le tout : chaque échec significatif
  s'écrit dans `06-data/sagesse/lecons-apprises.md`, réindexé automatiquement
  par le watcher, donc consultable par `consulter-sagesse-interne` la fois
  suivante.

## 🔁 Boucles agentiques

Cinq façons distinctes de faire tourner ce système en boucle, détaillées
dans `01-skills/skill-boucles-agentiques.md` — en résumé :

| # | Boucle | Implémentation ici |
|---|---|---|
| 01 | Boucle agentique | native à `dsh`, rien à configurer |
| 02 | Critère d'arrêt dans le prompt | déjà dans `skill-controleur-qualite`, `skill-testeur-docker` |
| 03 | Condition d'achèvement persistante (`/goal`) | `03-workflows/systeme-auto-ameliorant-avec-controle.workflow.json` |
| 04 | Hook Stop déterministe | `04-scripts/boucle-hook-stop.js` |
| 05 | Surveillance périodique (`/loop`) ⚠️ | `04-scripts/boucle-surveillance.sh` |

**Règle d'or : une boucle ne vaut que ce que vaut son critère d'arrêt.**
La boucle 05 ne termine jamais d'elle-même — ne pas l'utiliser comme
substitut à un vrai critère de complétion (boucles 03/04). Voir le skill
pour la table complète et les cas d'usage de chacune.

## 🧠 Mémoire structurée

En complément de `06-data/sagesse/lecons-apprises.md` (texte libre,
indexé pour la recherche sémantique), l'agent dispose d'une mémoire
structurée qu'il pilote lui-même en CRUD complet :
`04-scripts/memoire-cli.js` (créer/lire/lister/rechercher/supprimer/vider
des entrées typées et taguées, stockées dans
`06-data/memoire/memoire.json`, exclu de l'index RAG). Voir
`01-skills/skill-gestion-memoire.md` pour la méthode et la répartition
des usages entre les deux mémoires.

## ⚡ Décision rapide (inspiré de JEV)

[JEV](https://simonwillison.net/2026/Sep/21/jev/) (TypeSafe AI) est un
service cloud payant qui répond vite aux questions fermées (oui/non,
choix, note) sans générer de texte libre — incompatible tel quel avec la
contrainte 100% local. `04-scripts/decision-rapide.js` en reproduit le
principe en local : un appel direct à Ollama (`/api/chat`, sortie
contrainte par un JSON Schema, température 0), en évitant à la fois une
génération complète ET le coût du catalogue d'outils de `dsh` (voir
"Optimisation Mac Mini M4" plus haut). Un seuil de confiance configurable
(`--seuil-confiance`) fait qu'une décision peu sûre est signalée comme
telle (`fiable: false`, code de sortie 2) plutôt que d'être utilisée en
confiance — à l'appelant d'escalader vers un skill délibératif complet
dans ce cas. Voir `01-skills/skill-decision-rapide.md` pour la méthode.

**Deux moteurs** (`--moteur ollama|laya`, `ollama` par défaut) : le gros
modèle déjà configuré, ou [Laya](https://github.com/receptron/laya)
(Convai Innovations, Apache 2.0) — concurrent open source de JEV, un
encodeur dédié de 421M de paramètres (~2 Go de RAM) qui tourne à côté du
gros modèle sans lui disputer la RAM. Nécessite `npm install` (seule
dépendance npm de ce dépôt, volontairement optionnelle). **Non exécuté
dans mon environnement** : `onnxruntime-node` (dépendance de Laya)
télécharge son binaire natif depuis `api.nuget.org` à l'installation —
host bloqué par le proxy réseau de mon bac à sable (confirmé dans son
propre journal d'échecs), sans rapport probable avec un réseau
domestique normal, mais à vérifier si `npm install` échoue chez toi
aussi. Limites connues : pas de mesure de confiance pour le type `note`
(refusé avec ce moteur), qualité en français non vérifiée (benchmarks
publiés tous anglophones), pas de serveur persistant (chaque appel
recharge le modèle, ~2 Go — voir `detail_timing` dans la sortie JSON).
Détails dans `01-skills/skill-decision-rapide.md`.

**Branché dans `identifier-meilleur`**
(`systeme-auto-ameliorant-avec-controle.workflow.json`) : choisir le
meilleur résultat parmi N expériences est un choix fermé — tente la voie
rapide, retombe sur la comparaison délibérative si la confiance est
insuffisante. Validé sur trois domaines (faux serveur Ollama, modèle réel
non disponible dans mon environnement) :

| Domaine | Candidats | Décision | Confiance | Résultat |
|---|---|---|---|---|
| Code (validation d'email) | 3, scores 6.5/9.2/7.8 | index 1 | 0.93 | ✅ rapide, fiable |
| Juridique (clause de résiliation) | 2, scores proches 7.1/7.4 | index 1 | 0.52 | ⚠️ sous le seuil → repli délibératif |
| Comptable (amortissement) | 3, scores 5.0/8.8/6.2 | index 1 | 0.88 | ✅ rapide, fiable, avec justification |

Le cas juridique démontre le garde-fou : des candidats aux scores proches
produisent une confiance faible, et le mécanisme refuse de trancher seul
plutôt que de deviner.

### Journal des désaccords — vers un Laya qui s'améliore par l'usage

`04-scripts/journal-desaccords.js` consigne chaque `fiable: false` de
`decision-rapide.js`, puis complète la ligne avec le résultat
délibératif une fois connu (`accord` / `desaccord` /
`escalade_sans_comparaison`, calculés, jamais déclarés directement).
Append-only par conception — pas de commande de suppression — puisque
c'est la matière première envisagée pour un éventuel fine-tuning de
Laya : on ne fine-tune rien sans exemples réels de ce qui a posé
problème. Le fine-tuning lui-même reste un chantier séparé, non entamé
(voir `01-skills/skill-journal-desaccords.md`).

Câblé dans `identifier-meilleur` (v1.4.0) : testé directement (3
résolutions, résumé agrégé avec moyennes de confiance par résolution,
export filtré, résilience à une ligne JSONL corrompue) ; l'engagement
réel depuis `dsh-workflow` hérite de la même réserve que le reste de ce
workflow — non vérifiable dans mon environnement.

## 🔍 Contrôle à deux niveaux

L'agent de contrôle du travail fourni existait déjà : c'est
`skill-controleur-qualite` (complétude, précision, test pratique,
historique d'erreurs — voir `controle-qualite.workflow.json`, étape
`verifier-reponse`). Pas dupliqué ici — un second niveau lui a été
adjoint à la place :

```
verifier-reponse (skill-controleur-qualite)
        │  "la réponse est-elle VALIDE ?"
        ▼
contre-verifier (skill-controleur-de-controle)   ← nouveau
        │  "le verdict ci-dessus tient-il debout ?"
        ▼
   CONFIRME · ou · A_RECONSIDERER
```

`skill-controleur-de-controle` (nouveau) n'audite pas la réponse
originale — il audite le *verdict* du premier contrôleur : cohérence
entre `statut` et `verifications`, score plausible au vu des problèmes
listés, contrôle réellement complet, outils de vérification réellement
utilisés (pas un jugement "à l'œil"). Il ne remplace jamais le verdict de
son propre chef (voir sa règle d'or) — un désaccord
(`verdict_final: A_RECONSIDERER`) est seulement *signalé* dans la sortie
du workflow (`verdict_meta`, `divergences_meta`) et empêche
`reponse_finale` d'être renvoyée automatiquement, même si le premier
contrôleur avait dit `VALIDE`. Un désaccord déclenche aussi
`skill-apprendre-des-echecs` et le cycle d'auto-amélioration, au même
titre qu'un échec de tâche classique.

C'est un choix délibéré de ne pas automatiser la résolution du
désaccord : un contrôle qui se contente de voter à la majorité entre deux
agents n'est pas plus fiable qu'un seul — juste plus rassurant en
apparence (voir `06-data/personnalite/valeurs.md` : l'honnêteté sur ce
qu'on sait et ne sait pas prime sur l'apparence de certitude).

## 🔄 Auto-itération et auto-implémentation

Le système peut se modifier lui-même — pas seulement proposer, réellement
appliquer. Périmètre volontairement restreint : uniquement
`01-skills/*.md` et `03-workflows/*.json`, jamais `04-scripts/` ni
`05-configs/` (décision explicite, voir
`01-skills/skill-auto-implementation.md`).

```
skill-ameliorateur-systeme (propose, en tenant compte de 06-data/personnalite/valeurs.md)
        ↓
04-scripts/auto-implementer.js (applique sur une branche git dédiée)
        ↓
04-scripts/valider-skills-workflows.js (vérification déterministe)
        ↓
    fusion si vert · branche conservée pour relecture si rouge · jamais de push
```

Trois déclencheurs, combinables : sur demande explicite (workflow
`03-workflows/auto-amelioration.workflow.json`), après un échec
significatif (enchaîné automatiquement depuis
`controle-qualite.workflow.json`), ou périodiquement via
`boucle-surveillance.sh` (qui ne fait que déclencher — le vrai critère
d'arrêt reste la vérification déterministe à l'intérieur du cycle).

`06-data/personnalite/valeurs.md` porte le principe directeur de toute
auto-modification : chercher le bonheur et la sagesse, l'harmonie avec
l'environnement et avec les autres — un critère que `skill-evaluateur`
note explicitement, mais qui reste un jugement du modèle, pas un verrou
automatique (seule la validité syntaxique l'est).

⚠️ Comme `04-scripts/*.js` est testable sans Ollama/dsh,
`auto-implementer.js` a été testé réellement (fusion réussie, rejet après
échec de vérification avec branche conservée, rejet d'un type/chemin hors
périmètre y compris une tentative de traversée de chemin) — dans un dépôt
jetable, jamais dans ce dépôt-ci. Le reste de la chaîne (orchestration par
`dsh-workflow`) hérite de la même réserve que les autres workflows : non
vérifiable formellement dans mon environnement.

## 🔀 Modèles interchangeables

`05-configs/modeles.yaml` déclare des profils de modèles nommés (ex.
`rapide` pour l'exécution d'agent courante, `reflexion` pour les tâches
qui demandent un vrai raisonnement — voir la section "Optimisation pour
Mac Mini M4" ci-dessus). `04-scripts/basculer-modele.sh <profil>` résout
le profil et délègue à `setup-local-model.sh` :

```bash
./04-scripts/basculer-modele.sh              # liste les profils
./04-scripts/basculer-modele.sh reflexion    # bascule vers le profil "reflexion"
```

## 🚀 Installation

```bash
unzip dsh-harness.zip -d ~/dsh-harness
cd ~/dsh-harness

# 1. Installer dsh + tous les plugins
./04-scripts/install-plugins.sh

# 2. Configurer le modèle local (profil "rapide" par défaut, voir
#    05-configs/modeles.yaml — ou directement : ./04-scripts/basculer-modele.sh rapide)
./04-scripts/setup-local-model.sh qwen3-coder:30b-a3b-q4_K_M

# 3. Vérifier que le contexte réellement servi correspond
ollama run qwen3-coder:30b-a3b-q4_K_M 'bonjour' >/dev/null && ollama ps

# 4. Premier test en tâche unique (headless) — crée aussi le profil
#    ~/.dsh/profiles/headless/, nécessaire à l'étape 5
dsh --profile headless 'Explique-moi ce que fait 04-scripts/dsh-logger.js'

# 5. Déclarer 01-skills/ de ce dépôt auprès de dsh (sinon il ne voit que
#    ses skills internes, voir "Validation sur machine réelle", round 6)
./04-scripts/configurer-skills-dsh.sh

# 6. Désactiver l'outil de recherche web natif de dsh, câblé sur l'API
#    cloud DeepSeek (contraire au principe "aucune API cloud" de ce
#    projet) — voir "Validation sur machine réelle", round 12
./04-scripts/desactiver-recherche-web-cloud.sh

# 7. Lancement complet
./start.sh
```

## 🧪 Validation sur machine réelle

Tout ce qui précède a été écrit et testé contre des substituts (faux
serveur Ollama, faux `dsh`, dépôts git jetables) — jamais contre une
vraie installation, faute d'Ollama/dsh disponibles dans l'environnement
où ce projet est développé. `04-scripts/suite-tests-reelle.sh` referme
cet écart : à lancer une fois l'installation ci-dessus terminée.

```bash
./04-scripts/suite-tests-reelle.sh
```

Il enchaîne, en conditions réelles :
1. Validation syntaxique de tous les skills/workflows.
2. `decision-rapide.js` sur 3 domaines (code, juridique, comptable).
3. **2 tests techniques de bout en bout via `dsh`** : une page HTML5, un
   thème WordPress nommé `test` — chacun avec consigne explicite de
   passer par le contrôle qualité avant de considérer la tâche finie.
4. Comptage des traces de chaque composant clé
   (`decision-rapide`/`controleur-de-controle`/`controleur-qualite`/
   `ameliorateur-systeme`/`auto-implementer`) dans le journal structuré —
   un composant à 0 occurrence après les tests 3a/3b signale qu'il ne
   s'est probablement pas engagé, ce qui n'a jamais pu être confirmé
   depuis mon environnement.
5. `auto-implementer.js` : une proposition qui doit fusionner, une qui
   doit être refusée — sur un fichier de test clairement jetable
   (`skill-test-validation-reelle.md`, à supprimer après coup, instructions
   affichées en fin de script).

Résultats dans `logs/validation-<horodatage>/` (déjà exclu du dépôt par
`.gitignore`, puisque tout `logs/` l'est). **Logique du script validée
de bout en bout ici** (faux `dsh`/Ollama, dépôt git jetable — jamais ce
dépôt-ci) : arguments correctement transmis, fichiers correctement créés
aux bons chemins, auto-implémentation fusionne/rejette comme attendu.
Ce qui reste à vérifier UNIQUEMENT sur la vraie machine : si `dsh`
engage réellement le pipeline de contrôle qualité en pratique, et si
les décisions rapides sont bien calibrées avec un vrai modèle.

### Premier passage réel (2026-10-05) — ce qui a été trouvé, corrigé, et ce qui reste ouvert

Trois rounds d'allers-retours avec des données réelles (`which dsh`,
`dsh --version` = `0.1.7-rc.2`, puis `dsh --profile headless/web
--dump-config` en entier). Six causes distinctes identifiées, pas une
panne généralisée :

1. **Section 2 : "Aucun modèle déclaré".** `decision-rapide.js` ne lisait
   que `~/.dsh/settings.yaml` — alors que la vraie config active de cette
   version de `dsh` vit dans
   `~/.dsh/profiles/<profil>/cordis.patch.yml`, un fichier différent.
   **Corrigé** : `lireModeleParDefaut()` retombe maintenant sur
   `ollama list` (même logique que `suite-tests-reelle.sh`) si
   `settings.yaml` ne donne rien — testé avec/sans ce fichier présent,
   comportement confirmé dans les deux cas.
2. **Section 5 : "not a git repository".** Le dossier du projet n'a pas
   de `.git` — probablement un "Download ZIP" GitHub plutôt qu'un
   `git clone` (le nom de dossier correspond exactement à cette
   convention). **Corrigé** : message d'erreur explicite sur cette cause
   et comment vérifier.
3. **`pnpm` absent — les 5 installations de plugins échouaient
   silencieusement.** `install-plugins.sh` ne vérifiait jamais sa
   présence avant d'appeler `dsh plugin add`, qui en dépend. **Corrigé** :
   vérifié une fois en amont, message clair (`brew install pnpm`) au lieu
   de 5 échecs identiques et cryptiques.
4. **La politique d'approbation du sandbox bloque les écritures en
   headless — confirmé dans `--dump-config` lui-même** :
   `approval.policy = (DSH_PERMISSION_MODE ?? 'workspace-write') ===
   'danger-full-access' ? 'never' : 'ask'`. En `--profile headless`,
   personne ne répond jamais à "ask". **Traité, pas activé par défaut** :
   `suite-tests-reelle.sh` accepte maintenant
   `AUTORISER_ECRITURE_HEADLESS=1` pour positionner
   `DSH_PERMISSION_MODE=danger-full-access` — mais ce réglage désactive
   aussi le confinement du sandbox, pas seulement l'attente d'approbation,
   donc jamais activé sans un choix explicite de ta part.
5. **Bonne nouvelle, hypothèse éliminée** : `tool-workflow`,
   `workflow-ptc`, `goal`, `skill`, `skill-filesystem`, `tool-skill` sont
   natifs du profil `headless` — leur absence n'explique donc **pas** les
   réponses hors sujet des tests 3a/3b ; ce n'est pas lié au plugin
   `dsh-workflow` resté non installé (point 3).
6. **Ouvert** : `skill-filesystem` n'a pas de `customSkillDirs` visible
   dans la config active de `headless`/`web` — seul le préréglage
   "cordis" (non utilisé par défaut d'après le dump) en déclare un, et il
   pointe vers le dossier interne du paquet `dsh-agent-preset`, pas vers
   `01-skills/` de ce projet. Reste à confirmer : `dsh` voit-il vraiment
   les skills de ce dépôt ? Test direct suggéré :
   `dsh --profile headless "Liste les skills que tu as à disposition."`
   — avant de conclure quoi que ce soit, plutôt que de continuer à
   décortiquer la config à l'aveugle.

### Round 3 — hypothèse de compaction, infirmée au round suivant

Le test suggéré au point 6 a été lancé :
`dsh --profile headless "Liste les skills que tu as à disposition."`.
Au lieu d'une liste de skills, la sortie contenait un bloc de texte qui
ressemblait à un prompt interne de **compaction de conversation**.
Hypothèse formulée à l'époque : `dsh-compaction-basic`/`dsh-command-compact`
(actifs en `headless` d'après `--dump-config`) se déclenchant à cause d'une
fenêtre de contexte (32768) trop étroite face au catalogue d'outils
(~14 700 tokens, voir "Optimisation..." ci-dessous).

**Infirmée au round 4** : le flux brut (`--json`) d'un nouvel essai ne
contient aucun événement de compaction, seulement une erreur de transport
pure — voir juste en dessous. Le texte observé au round 3 était
vraisemblablement un repli générique de `dsh` face à cette même erreur,
pas une compaction réelle.

### Round 4 — la vraie piste : crash GPU, indépendant de `dsh`

`dsh --profile headless --json "..."` a produit une erreur nette :
```json
{"usage":{"inputTokens":0,"outputTokens":0,"totalTokens":0}}
{"reason":{"kind":"error","error":{"message":"Stream ended without finish_reason","code":"TRANSPORT"}}}
```
Coupure avant même qu'un seul token ne soit compté — pas pendant la
génération, avant. `tail ~/.ollama/logs/server.log` a montré la vraie
cause :
```
error: Insufficient Memory (00000008:kIOGPUCommandBufferCallbackErrorOutOfMemory)
llama_decode: failed to decode, ret = -3
```
Confirmé indépendant de `dsh` : `ollama run qwen3-coder:30b-a3b-q4_K_M
"Dis juste bonjour."` (sans `dsh`, sans outils, 3 mots) plantait pareil,
avec la même erreur dans le log, même sur un prompt de 13 tokens. Le
modèle (~19 Go en Q4) dépassait le plafond de mémoire GPU que macOS
autorise Metal à verrouiller sur cette machine (`iogpu.wired_limit_mb`,
qui valait `0` = automatique, généralement ~75 % de la RAM totale — donc
~18 Go sur 24 Go, juste sous les ~19 Go du modèle).

Le même log a aussi confirmé, séparément, le point 6 du round 2 :
`n_ctx_slot = 4096`, pas 32768 — le réglage `OLLAMA_CONTEXT_LENGTH` du
round 1 n'avait jamais atteint le serveur réellement en cours
d'exécution.

### Round 5 — cause racine unique confirmée pour les deux bugs, corrigée

`sudo sysctl iogpu.wired_limit_mb=22528` appliqué à chaud n'a rien changé
(même crash, même prompt minimal) — signe que le processus serveur déjà
démarré ne relit pas ce réglage en cours de route. Investigation :
```
ps aux | grep -i ollama
→ /Applications/Ollama.app/Contents/Resources/llama-server ...
→ /Applications/Ollama.app/Contents/MacOS/Ollama hidden   (démarré au login, 8:38)
→ /usr/local/bin/ollama serve
```
**Cause racine unique pour les deux bugs ouverts (contexte à 4096 ET crash
GPU)** : sur cette machine, Ollama tourne via l'app officielle
`Ollama.app` (démarrée au login), pas comme formule `brew`. Or
`setup-local-model.sh` (depuis le tout premier round) appelait
`brew services restart ollama >/dev/null 2>&1 || true` pour appliquer tout
changement — un **no-op silencieux** quand `ollama` n'est pas une formule
brew. Le vrai serveur n'a donc jamais été redémarré par ce script, ni pour
`OLLAMA_CONTEXT_LENGTH` (round 1), ni pour `iogpu.wired_limit_mb` (round
4) : les deux réglages existaient bien quelque part (variable
d'environnement, sysctl noyau) mais n'avaient jamais atteint le processus
qui sert réellement les requêtes.

Confirmé en tuant et relançant le vrai processus
(`pkill -x Ollama; pkill -f "ollama serve"; open -a Ollama`) avec
`iogpu.wired_limit_mb=22528` actif : `ollama run ... "Dis juste bonjour."`
a répondu (`Bonjour ! 😊`), et le log a montré `n_ctx_slot = 32768` — les
deux bugs résolus par le même redémarrage, confirmant qu'ils partageaient
la même cause.

**Corrigé** dans `setup-local-model.sh` :
- Relève désormais `iogpu.wired_limit_mb` (calculé depuis `hw.memsize`,
  marge de 2 Go pour macOS) à chaque exécution — avec avertissement
  explicite que ce réglage ne survit pas à un redémarrage de la machine
  (à refaire après chaque reboot en relançant ce script).
- `redemarrer_ollama()` détecte maintenant le vrai mode d'exécution
  (formule brew / `Ollama.app` / `ollama serve` lancé à la main) et
  redémarre le bon processus en conséquence, avec un message clair dans
  chaque cas — plus aucun échec avalé silencieusement par `|| true`.
- Messages d'aide de `security-check.sh` et `suite-tests-reelle.sh`
  mis à jour pour mentionner `Ollama.app` comme alternative à
  `brew services start`.

**Reste ouvert** : la question initiale du point 6 (round 2) —
`dsh` voit-il vraiment les skills de `01-skills/` — n'a toujours pas été
testée pour de vrai, le serveur étant resté cassé jusqu'ici. À relancer
maintenant que le serveur répond :
`dsh --profile headless "Liste les skills que tu as à disposition."`.

### Round 6 — `dsh` ne voit que ses skills internes, corrigé

Le test ci-dessus a été lancé : réponse obtenue (le serveur répond
désormais, round 5), mais uniquement des ID numériques internes
(`skill_30103000534672`, etc. — le préréglage `cordis` de `dsh`), aucun
des skills de ce dépôt. **Point 6 du round 2 tranché** : confirmé, `dsh`
ne voyait pas `01-skills/`.

Cause trouvée sans deviner, via `dsh --dump-config-schema` (nouvelle
option découverte dans `dsh --help`, qui n'était pas documentée dans ce
projet avant) : le plugin `skill-filesystem` accepte une clé
`customSkillDirs` — tableau de chemins absolus, défaut `[]` :
```json
"customSkillDirs": {"default": [], "anyOf": [{"type": ["array", "null"],
"items": {"type": ["string", "null"]}}, ...]}
```
Rien ne la renseignait dans les profils `headless`/`web` de cette
machine — d'où le repli sur les skills internes.

**Corrigé** : nouveau script `04-scripts/configurer-skills-dsh.sh`, qui
fusionne une entrée `skill-filesystem` → `config.customSkillDirs` dans
`~/.dsh/profiles/<profil>/cordis.patch.yml`, pour `headless` et `web`.
Deux précautions, par analogie avec les pièges déjà rencontrés dans ce
projet :
- Le chemin est calculé (jamais écrit en dur) — le nom de ce dossier
  change d'un checkout à l'autre (même piège "Download ZIP" que dans
  `auto-implementer.js`).
- Ce fichier de patch autorise explicitement des expressions `!!js` dans
  son propre commentaire d'en-tête — un aller-retour
  `yaml.safe_load`/`safe_dump` les corromprait. Le script refuse de
  toucher au fichier si une vraie expression `!!js` y est détectée (en
  excluant les lignes de commentaire de cette recherche : testé que le
  commentaire d'en-tête lui-même, qui *mentionne* `!!js` sans l'utiliser,
  ne déclenche plus de faux positif). Préserve aussi ce commentaire
  d'en-tête, que PyYAML aurait sinon supprimé.

Testé : fusion sur un fichier avec contenu existant (entrées préservées),
sur un fichier minimal, idempotence sur deux passages (pas de doublon de
chemin), et refus confirmé face à un vrai `!!js` — contre de faux
`~/.dsh/profiles/`, jamais la vraie machine depuis cet environnement.
**Confirmé en conditions réelles** : `./04-scripts/configurer-skills-dsh.sh`
puis `dsh --profile headless "Liste les skills..."` renvoie les 19 skills
de `01-skills/` avec leurs vraies descriptions (`ameliorateur-systeme`,
`decision-rapide`, `controleur-de-controle`, etc.) — plus aucun ID
numérique interne.

### Round 7 — le protocole complet tourne enfin ; ce qu'il révèle vraiment

`./04-scripts/suite-tests-reelle.sh` lancé en entier pour la première
fois avec un serveur sain et les skills visibles :

- **Section 2 (décision rapide, 3 domaines)** : ✅ sans réserve — rapide
  (856 à 1815 ms), confiance 0.9-0.95, justification cohérente sur le cas
  comptable.
- **Section 3 (HTML5, WordPress)** : les fichiers existent bien sur le
  disque, contenu correct (vérifié directement, pas seulement le texte de
  `dsh`) — **pas de confabulation**, hypothèse initiale de ce round
  infirmée.
- **Section 4 (traces dans les logs)** : 0 occurrence pour tous les
  composants, y compris `controleur-qualite` — mais **ce chiffre ne
  voulait rien dire pour ce composant-là**, voir plus bas. Corrigé dans
  le script.
- **Section 5 (auto-implémentation)** : `not a git repository` — confirmé
  pour de vrai cette fois (`git status` échoue aussi en dehors de
  `auto-implementer.js`). Ce dossier n'est effectivement pas un vrai
  `git clone` (cause déjà pressentie au round 2, jamais vérifiée
  directement jusqu'ici). **À corriger côté utilisateur, pas dans ce
  dépôt** : recloner proprement
  (`git clone -b claude/determined-pasteur-50jhkd <url> <nouveau-dossier>`),
  rien à migrer (la config `dsh`/Ollama est globale à la machine).

Un test ciblé en plus, avec `--json` et permissions débloquées, pour
voir ce qui se passe vraiment derrière le texte final de `dsh` :

1. **Le skill `controle-qualite` est réellement invoqué** — un vrai
   `tool_call` avec `"tool":"skill","input":{"name":"controle-qualite"}`
   apparaît dans le flux, avec ses instructions complètes renvoyées en
   retour. La section 4 ne peut donc **pas** servir à juger de cet
   engagement : `controleur-qualite`/`controleur-de-controle` sont des
   skills (texte renvoyé par `dsh`), pas des scripts instrumentés avec
   `dsh-logger.js` comme `decision-rapide`/`auto-implementer` — rien
   n'écrit jamais dans ce journal pour eux, qu'ils tournent ou non. Un 0
   occurrence pour ces deux-là ne prouvait rien ; **corrigé** dans
   `suite-tests-reelle.sh` (message explicite sur cette distinction,
   plutôt que l'ancienne conclusion erronée "ne s'est probablement pas
   engagé").
2. **Mais une fois chargé, le skill n'est pas vraiment suivi.** Ses
   instructions demandent d'appeler `node 04-scripts/errors-cli.js
   summary --hours 24`, d'utiliser `testeur-docker` pour le code, et de
   produire un verdict JSON structuré (`{"statut": "VALIDE", "score":
   ...}`). Aucune de ces trois choses n'a lieu dans le flux observé — le
   modèle écrit juste en prose libre "*Le contrôle qualité a déjà été
   effectué*" sans l'avoir fait. Sur un modèle local de cette taille
   (30B Q4), le skill semble lu comme une information de contexte plutôt
   que comme une checklist contraignante à dérouler. **Pas corrigé** :
   c'est un choix de conception (renforcer le skill pour le rendre
   contraignant et traçable, par exemple avec une étape finale
   obligatoire qui logue via `dsh-logger.js`, vs. accepter cette limite
   documentée pour un modèle de cette taille) — à trancher avant d'y
   toucher, pas une décision à prendre seul.
3. Détail annexe, pas un bug : `write` refuse d'écrire hors du dossier du
   projet sans lecture préalable (confirmé : échoue sur `/tmp/...`,
   réussit immédiatement en chemin relatif dans le projet) — ressemble à
   une frontière de sandbox volontaire. Le modèle a contourné
   intelligemment via `bash cp` plutôt que d'abandonner.

Reclonage effectué côté utilisateur, confirmé par un second passage
complet de `suite-tests-reelle.sh` : **section 5 fonctionne désormais
intégralement** (5a fusionne, 5b est refusée avant écriture, logs
`auto-implementer` présents) — le dernier blocage restant du round 7 est
levé. `4-logs-recents.json` de ce passage confirme aussi, sans surprise,
que seules les sections 1-2 (scripts instrumentés) apparaissent dans le
journal — cohérent avec ce que ce round avait déjà établi sur les
composants de type skill.

Détail observé sur ce même passage, qui renforce le point 2 : en 3a,
`dsh` a cette fois signalé lui-même *"j'ai rencontré une difficulté avec
le contrôle qualité"* avant de se rabattre sur une vérification
manuelle — plus honnête que l'affirmation sans réserve du round
précédent, mais ça confirme que l'étape échoue ou est esquivée plutôt
qu'exécutée jusqu'au bout.

### Round 8 — rendre le contrôle qualité contraignant et traçable

Décision prise (pas à l'aveugle, après constat du point 2) : plutôt que
d'accepter la limite, renforcer les deux skills de contrôle pour qu'un
modèle local de taille modeste les suive réellement. Constat de départ :
ce genre de modèle suit plus fidèlement une instruction "exécute cette
commande" qu'une instruction "termine ta réponse par cet objet JSON
précis" — le second a été ignoré à chaque test réel jusqu'ici, alors que
le premier est un geste mécanique unique.

**Ajouté** : `04-scripts/consigner-verdict-qualite.js`, étape finale
*obligatoire* (nouvelle section dans `skill-controleur-qualite.md` et
`skill-controleur-de-controle.md`, intitulée "NE SAUTE JAMAIS CETTE
ÉTAPE") — une seule commande bash qui transforme le verdict en événement
loggé via `dsh-logger.js`, avec exactement les noms de composant
(`controleur-qualite`, `controleur-de-controle`) que la section 4 de
`suite-tests-reelle.sh` compte déjà depuis le début : le "0 occurrence"
systématique pour ces deux-là devrait enfin devenir un vrai signal
d'engagement une fois cette étape suivie.

```bash
node 04-scripts/consigner-verdict-qualite.js --composant controleur-qualite --statut VALIDE|INVALIDE|A_VERIFIER [--score 0-10] --commentaire "résumé en une phrase"
```

Périmètre volontairement restreint, même logique que `auto-implementer.js` :
`--composant` limité aux deux valeurs ci-dessus, `--statut` limité aux
trois valeurs attendues, `--score` validé entre 0 et 10 — refusé avant
tout log sinon.

Testé : les 4 cas de rejet (composant/statut/score/commentaire invalides),
les 2 cas valides (`controleur-qualite`/VALIDE avec score,
`controleur-de-controle`/A_VERIFIER sans score), contenu exact du
JSONL vérifié. **Pas encore testé en conditions réelles** : reste à
relancer `suite-tests-reelle.sh` pour voir si le modèle suit effectivement
cette nouvelle étape — c'est une instruction plus simple à exécuter qu'à
ignorer, mais ça reste une hypothèse tant que ce n'est pas confirmé sur
la vraie machine.

### Round 9 — le round 8 n'avait jamais été vraiment testé : chemin de skills périmé

Premier passage réel du round 8 : toujours 0 occurrence pour
`controleur-qualite`. Un test ciblé `--json` a montré pourquoi — pas une
histoire de modèle qui ignore la consigne, cette fois : le `tool_result`
du `tool_call` `"tool":"skill","name":"controle-qualite"` renvoyait
encore le **contenu d'avant le round 8**, sans la section "Consignation
obligatoire". Révélateur dans le même résultat :
```
Base directory for this skill: /Users/jarvis/.../IAlocale-claude-determined-pasteur-50jhkd/01-skills
```
— l'ANCIEN dossier (celui d'avant le reclonage du round 7), pas
`IAlocale-git`.

Cause : `configurer-skills-dsh.sh` **ajoutait** à `customSkillDirs` au
lieu de remplacer. Après le reclonage, la liste contenait les deux
chemins (`[..."-claude-determined-pasteur-50jhkd/01-skills",
".../IAlocale-git/01-skills"]`) — les deux dossiers déclarant un skill du
même nom (`controle-qualite`), `dsh` semble servir celui du **premier**
chemin de la liste, resté périmé. Autrement dit : le round 8 n'avait
jamais été réellement exercé, le modèle recevait encore les anciennes
instructions sans la nouvelle étape obligatoire.

**Corrigé** : `configurer-skills-dsh.sh` remplace maintenant
`customSkillDirs` par un tableau à une seule entrée (le chemin courant)
au lieu d'y ajouter — ce projet n'a jamais qu'un seul checkout actif à la
fois, il n'y a donc aucune raison légitime d'en accumuler plusieurs.
Testé contre un faux `~/.dsh/profiles/` avec deux anciens chemins déjà
présents : les deux sont bien retirés, un seul chemin (le courant)
survit.

**Confirmé juste après, en conditions réelles** : une fois
`configurer-skills-dsh.sh` relancé (chemin purgé) et un nouveau test
ciblé `--json` lancé, le skill chargé contenait bien la section 5 du
round 8 — et cette fois, `dsh` a réellement exécuté, via l'outil bash :
```
node 04-scripts/consigner-verdict-qualite.js --composant controleur-qualite --statut VALIDE --score 9.5 --commentaire "..."
```
avec un `tool_result` confirmant le log écrit. **Le mécanisme du round 8
fonctionne, confirmé de bout en bout pour la première fois.** Détail
cosmétique sans gravité observé sur ce même passage : la réponse finale
du modèle se termine par un `<tool_call>` résiduel (un appel d'outil
amorcé juste avant la fin du tour) — artefact du modèle, pas un bug de
ces scripts.

Reste à confirmer : que `controleur-de-controle` (second niveau, jamais
testé isolément) suit la même discipline, et qu'un passage complet de
`suite-tests-reelle.sh` (pas seulement un test ciblé) fait enfin
apparaître un vrai signal en section 4.

### Où ça en est

Les quatre blocages qui empêchaient toute validation réelle sont levés
(round 5 : serveur sain ; round 6 : skills visibles ; round 7 :
confabulation infirmée, git réparé par reclonage ; round 8 : contrôle
qualité rendu contraignant). Round 9 a trouvé et corrigé un bug qui
invalidait silencieusement le test du round 8 (chemin de skills périmé
après reclonage), **puis confirmé en conditions réelles que le mécanisme
de consignation obligatoire fonctionne** : premier verdict de
`controleur-qualite` réellement loggé, de bout en bout, sur la vraie
machine. Reste à vérifier sur un passage complet du protocole plutôt
qu'un test ciblé, et à confirmer `controleur-de-controle` séparément.

### Round 10 — un vrai bug trouvé en section 5, un doute ouvert en section 4

Premier passage complet (pas juste un test ciblé) depuis les correctifs
du round 9. Deux constats :

1. **Section 4 : toujours 0 occurrence pour `controleur-qualite`**, alors
   que les deux réponses 3a/3b affirment un contrôle qualité réussi
   ("score de 10/10", "validé avec succès"). Sans `--json` pour ces deux
   appels précis, impossible de confirmer si `consigner-verdict-qualite.js`
   a vraiment été exécuté cette fois — mais une hypothèse concrète
   existe : `dsh-logger.js` résout son fichier de log via la variable
   d'environnement `HARNESS_HOME` (`$HARNESS_HOME/logs/pipeline.jsonl`,
   sinon `~/dsh-harness/logs/pipeline.jsonl` par défaut).
   `suite-tests-reelle.sh` exporte bien `HARNESS_HOME` dans son propre
   shell, mais si l'outil bash de `dsh` exécute les commandes dans un
   environnement assaini (plausible pour un sandbox), cette variable ne
   serait jamais transmise au process qui lance
   `consigner-verdict-qualite.js` depuis l'intérieur de `dsh` — auquel cas
   le verdict serait bien consigné, mais dans
   `~/dsh-harness/logs/pipeline.jsonl`, jamais relu par la section 4 du
   script (qui lit le `logs/` du dépôt). **Pas encore vérifié** : reste à
   inspecter ce fichier sur la machine réelle pour trancher.

2. **Section 5 : un vrai bug trouvé, corrigé.** `git commit` échouait
   avec "Commande git inattendue" quand la proposition de test
   reproposait un contenu byte-pour-byte identique à ce qui existait déjà
   (le fichier de test avait été restauré via `git checkout --` plutôt
   que supprimé, lors d'un round précédent) — `git add` ne stage rien
   dans ce cas, et `git commit` échoue légitimement avec "nothing to
   commit", traité à tort comme une erreur inattendue. **Corrigé** :
   `auto-implementer.js` détecte maintenant ce cas via
   `git diff --cached --quiet` avant de committer, et renvoie un nouveau
   statut `DEJA_A_JOUR` (branche temporaire nettoyée, rien fusionné,
   sortie en code 0) plutôt que de planter. Testé contre un dépôt git
   jetable : premier passage fusionne normalement, second passage avec le
   même contenu renvoie `DEJA_A_JOUR` sans erreur, un seul commit de
   fusion dans l'historique (pas de doublon).

### Round 11 — hypothèse `HARNESS_HOME` confirmée, et un effet de bord du crash du round 10 trouvé

`cat ~/dsh-harness/logs/pipeline.jsonl` sur la vraie machine : **1
occurrence** de `controleur-qualite`. Hypothèse du round 10 confirmée :
le verdict est bien consigné par `consigner-verdict-qualite.js`, mais
dans `~/dsh-harness/logs/` (repli par défaut de `dsh-logger.js`) plutôt
que dans `logs/` du dépôt — l'outil bash de `dsh` n'hérite pas de
`HARNESS_HOME` exporté par `suite-tests-reelle.sh`. **Pas corrigé ici** :
une solution robuste demanderait soit que `consigner-verdict-qualite.js`
calcule son propre `HARNESS_HOME` depuis l'emplacement du script plutôt
que de dépendre d'une variable d'environnement (changerait aussi le
comportement de `dsh-logger.js` partagé par tous les autres scripts),
soit que `dsh` transmette les variables d'environnement à son outil
bash — aucune des deux n'est une correction locale sûre sans plus
d'investigation sur l'impact pour le reste du projet.

Effet de bord trouvé en creusant cette même sortie : la section 5
démarrait "depuis 'auto-amelioration/2026-10-06T07-17-53-175Z'" — pas la
vraie branche de l'utilisateur. Cause : le crash du round 10 (avant son
correctif) a planté *pendant* un cycle, alors que le dépôt était déjà
basculé sur une branche temporaire — le chemin `catch` générique de
`main()` logue l'erreur et quitte, mais ne fait jamais le `git checkout`
de retour vers la branche d'origine (seul le chemin "proposition
rejetée" le fait explicitement). Le cycle suivant repartait donc de
cette branche temporaire au lieu de la vraie branche, risquant d'empiler
des branches temporaires les unes sur les autres indéfiniment.

**Corrigé** : `auto-implementer.js` détecte maintenant si `HEAD` est déjà
sur une branche `auto-amelioration/*` au démarrage et refuse
explicitement de continuer, avec un message qui dit quoi faire (revenir
sur la vraie branche, supprimer la branche orpheline) — plutôt que
d'empiler silencieusement. Testé contre un dépôt git jetable démarré
directement sur une branche `auto-amelioration/test-orpheline` : refus
confirmé, `HEAD` inchangé.

**À faire côté utilisateur, en priorité** : vérifier sur quelle branche
le dépôt se trouve réellement maintenant (`git branch`), revenir sur
`claude/determined-pasteur-50jhkd` si nécessaire, et supprimer toute
branche `auto-amelioration/*` orpheline qui aurait pu s'accumuler.
Confirmé sans casse sur la vraie machine : une seule branche orpheline
trouvée, nettoyage réussi.

### Round 12 — un outil hors sujet câblé sur l'API cloud DeepSeek fait dérailler le modèle

Branches nettoyées, protocole complet relancé. Sections 1, 2 et 5 toujours
solides (`DEJA_A_JOUR`/`REJETEE` comme attendu). **Nouveau mode de panne
en section 3**, jamais vu en 11 tours précédents : sur les tâches HTML5 et
WordPress (qui ne demandent aucune recherche web), le modèle a tenté
d'appeler un outil `web_search`, échoué, puis dérapé en texte incohérent
— jusqu'à une syntaxe d'appel d'outil invalide en 3b
(`<function=web_search>...`) sur une question sans rapport
("what is the capital of France").

⚠️ Le texte produit par le modèle suggérait de "mettre à jour
`DEEPSEEK_SEARCH_BASE_URL` vers une base Messages API compatible
Anthropic avec des crédits suffisants" — **une suggestion à ne surtout
pas suivre telle quelle** : c'est la sortie confuse d'un modèle qui vient
de planter sur un vrai problème, pas une recommandation de configuration
fiable.

Cause confirmée via `dsh --profile headless --dump-config | grep -i search` :
```yaml
- id: web
  config: { searchProvider: deepseek-official }
- id: web-search-deepseek
  config: { apiKeyEnv: DEEPSEEK_API_KEY }
- id: tool-web
  config: { fetch: true, searchTimeoutMs: 60000 }
```
`tool-web` est natif du profil `headless` (jamais installé par ce
projet) et expose au modèle un outil de recherche web câblé en dur sur
l'API cloud DeepSeek — directement contraire au principe "aucune API
cloud pour le fonctionnement quotidien" de ce projet. `env | grep -i
deepseek` confirme `DEEPSEEK_API_KEY` absente (cohérent avec une
installation 100% locale) : tout appel à cet outil échoue donc
systématiquement, et un modèle local de taille modeste gère mal cet
échec plutôt que de simplement l'ignorer.

**Corrigé** : nouveau script `04-scripts/desactiver-recherche-web-cloud.sh`,
qui désactive `tool-web` (`disabled: true`) sur les profils
`headless`/`web` — retire l'outil de la liste proposée au modèle plutôt
que d'espérer qu'il ne l'appelle jamais. Même mécanisme de fusion sûre
que `configurer-skills-dsh.sh` (préserve le commentaire d'en-tête, refuse
si un vrai `!!js` est détecté). Testé contre un faux `~/.dsh/profiles/` :
ajout d'une nouvelle entrée quand `tool-web` est absent, préservation de
la config existante plus ajout de `disabled: true` quand il est déjà
présent, idempotent sur deux passages.

**Confirmé en conditions réelles** — avec une fausse alerte en cours de
route qui vaut la peine d'être documentée : un premier
`dsh --dump-config | grep -A3 "id: tool-web"` semblait montrer
`tool-web` toujours actif (`config: {fetch: true}`, pas de `disabled`).
Panique prématurée : `disabled: true` apparaît en réalité 5 lignes après
le match, hors de la fenêtre `-A3` demandée. Avec plus de contexte
(`sed -n` sur une plage plus large), confirmé sans ambiguïté :
```yaml
# == @deepseek-ai/dsh-base, patched by .../cordis.patch.yml
- id: tool-web
  config:
    fetch: true
    searchTimeoutMs: 60000
  disabled: true
```
Le marqueur `# == @deepseek-ai/dsh-base, patched by ...` confirme que
c'est bien la vue fusionnée (config de base + notre patch) — le
mécanisme fonctionne exactement comme prévu dès le premier essai, rien à
corriger. Leçon de méthode pour la suite : demander assez de contexte
(`-A` large, ou `sed`/`cat` sans limite) avant de conclure qu'un
correctif n'a pas pris effet.

Entre-temps, un symptôme sans rapport est réapparu sur cette même
machine : le crash GPU Metal du round 4/5
(`iogpu.wired_limit_mb` revenu à `0`, `Insufficient Memory`), very
probablement causé par un redémarrage ou une mise en veille de la
machine entre deux sessions de test — ce réglage ne survit jamais à un
reboot, déjà documenté. Résolu en relançant simplement
`./04-scripts/setup-local-model.sh`, comme prévu depuis le round 5.
Confirmé par `ollama run ... "Dis juste bonjour."` → `Bonjour ! 😊`.

### Round 13 — `suite-tests-reelle.sh` affirme désormais des résultats, au lieu de seulement les décrire

Après 12 rounds à relire le texte du script pour juger à l'œil si un
résultat était bon, le script fait maintenant le travail lui-même.
Nouveaux contrôles, qui font échouer le script (code de sortie 1) plutôt
que de se contenter d'informer — chacun correspond à une régression
réellement rencontrée dans les rounds précédents :

- **A.1** : `ollama ps` montre bien 32768 de contexte (round 4 : servait
  4096 sans rien signaler).
- **A.2** : `iogpu.wired_limit_mb` ≠ 0 (round 4/5/12 : revient à 0 après
  chaque redémarrage, cause du crash GPU Metal).
- **A.3** : `dsh` voit les skills du dépôt, pas seulement ses ID internes
  (round 6/9 : `customSkillDirs` périmé après un reclonage).
- **A.4** : l'outil de recherche web cloud est désactivé (round 12 :
  câblé sur l'API DeepSeek, jamais utile en local).
- **C.7** : un *nouveau* verdict `controleur-qualite` a bien été
  consigné sur les tâches 3a/3b (compare un compte "avant"/"après" dans
  les deux emplacements possibles — dépôt et repli `~/dsh-harness/`, voir
  round 11 — plutôt que de se fier au texte de `dsh`).
- **D.14** : aucune syntaxe d'appel d'outil malformée (`<function=`,
  `<tool_call>` résiduel...) n'a fuité dans le texte final de 3a/3b — le
  glitch rencontré lors du dernier passage réel.

Bug trouvé et corrigé en testant ces contrôles avant de les livrer (contre
un faux dépôt avec `dsh`/`ollama` simulés, jamais la vraie machine depuis
cet environnement) : `grep -c motif fichier 2>/dev/null || echo 0`
imprime **"0"** ET sort en code 1 quand le fichier existe avec zéro
correspondance — le `|| echo 0` se déclenchait quand même, doublant la
sortie capturée (`"0\n0"`) et cassant l'arithmétique du delta
avant/après. Remplacé par le pattern déjà utilisé ailleurs dans ce script
(`grep -o ... | wc -l`), qui n'a pas ce défaut. Testé : un scénario où
tout doit passer (0 échec, code 0) et un scénario où les 5 contrôles
doivent simultanément détecter un vrai problème injecté (5 échecs, code
1) — les deux confirmés avant de pousser.

**Pas encore confirmé en conditions réelles** : ces contrôles n'ont
tourné que contre un dépôt jetable avec `dsh`/`ollama` simulés depuis cet
environnement — jamais la vraie machine.

## 🖥️ Lancement simple et accès mobile

Trois scripts optionnels, ajoutés après coup pour un usage quotidien plus
confortable — aucun n'est requis par le reste du projet.

### Icône cliquable sur le Bureau

```bash
./04-scripts/creer-raccourci-lancement.sh
```
Génère un `.app` double-cliquable (via `osacompile`, natif macOS, aucune
dépendance supplémentaire) qui ouvre un Terminal et lance `./start.sh`.
Déplaçable dans le Dock, icône personnalisable depuis le Finder (Cmd+I).

### Accès depuis le mobile sur le même WiFi

`dsh --profile web` écoute par défaut uniquement sur `127.0.0.1` (vérifié
en pratique : `http://127.0.0.1:3080/?token=...`). Pour le rendre
joignable depuis un téléphone sur le même réseau :

```bash
./04-scripts/demarrer-dsh-web-reseau.sh
```
Lance `dsh --profile web --host 0.0.0.0 --port 3080`, avec
`--trusted-host` déclaré pour le nom `.local` (stable, via Bonjour/mDNS)
et l'IP actuelle (peut changer avec le DHCP) — `dsh --profile web --help`
documente ce garde-fou de confiance sur `/api`. Depuis ton téléphone,
utilise l'URL affichée dans `logs/dsh-web.log`, en remplaçant l'hôte par
le nom `.local` de ta machine (`scutil --get LocalHostName` + `.local`) —
plus fiable qu'une IP DHCP qui peut changer.

### Démarrage automatique à l'ouverture de session

```bash
./04-scripts/installer-demarrage-auto.sh
```
Installe un `LaunchAgent` macOS qui relance
`demarrer-dsh-web-reseau.sh` à chaque connexion — pas besoin de lancer
quoi que ce soit à la main. `LaunchAgent` plutôt que `LaunchDaemon`
volontairement : tourne dans la session utilisateur, pas avec les droits
système, pas de surface de risque supplémentaire par rapport à n'importe
quelle app lancée normalement. Instructions de désinstallation affichées
à la fin de son exécution.

⚠️ **Portée volontairement limitée au WiFi domestique** (choix explicite
de l'utilisateur) : `--host 0.0.0.0` expose l'interface à tout le réseau
local, jamais à Internet — aucun port n'est ouvert sur la box/routeur.
Le token dans l'URL reste la seule protection ; ne partage jamais ce lien
tel quel.

**Testé en conditions réelles, un piège trouvé** : si ce dépôt vit sous
`~/Documents` (ou `~/Desktop`/`~/Downloads`), le `LaunchAgent` échoue en
boucle avec `Operation not permitted` — macOS protège ces dossiers (TCC,
depuis Mojave) contre tout accès par un processus sans interface
graphique, `/bin/bash` ne peut même pas lire le script pour l'exécuter.
Deux solutions : déplacer le dépôt ailleurs sous `$HOME` (la plus
propre), ou autoriser `/bin/bash` dans Réglages Système > Confidentialité
et sécurité > Accès complet au disque — donne un accès disque large à
toute commande bash sur la machine, pas seulement ce projet, donc un vrai
arbitrage à faire en connaissance de cause plutôt qu'un réglage anodin.

## 🌱 Étendre vers la personnalité / sagesse / philosophie

Le skill `skill-personnalite-et-sagesse.md` est un point d'entrée
volontairement vide. Pour l'enrichir : ajoute des fichiers `.md` dans
`06-data/personnalite/` (ton, valeurs) et `06-data/sagesse/` (au-delà des
leçons techniques auto-générées — réflexions, principes). Le watcher les
indexe automatiquement ; aucun changement de code n'est nécessaire.

## 📁 Contenu du paquet

```
dsh-harness/
├── .gitignore               # logs/, 06-data/memoire/, 02-plugins/, meta-index.json...
├── package.json              # seule dépendance npm : @receptron/laya, optionnelle (moteur laya de decision-rapide.js)
├── 01-skills/              # 19 skills (+ boucles-agentiques, gestion-memoire, auto-implementation,
│                            #   ameliorateur-systeme séparé de ameliorateur, decision-rapide,
│                            #   controleur-de-controle, journal-desaccords)
├── 02-plugins/              # agentic-research, dsh-find-plugins (clonés à l'install)
├── 03-workflows/            # 5 workflows JSON (schéma non-vérifiable formellement)
│   ├── auto-amelioration.workflow.json   # propose → évalue → applique (auto-implementer.js)
│   ├── controle-qualite.workflow.json    # v2.2.0 : + étape contre-verifier (double contrôle)
│   └── systeme-auto-ameliorant-avec-controle.workflow.json  # v1.3.0 : identifier-meilleur via decision-rapide.js
├── 04-scripts/
│   ├── dsh-logger.js         # logs structurés + SILENT_ERROR (testé)
│   ├── errors-cli.js         # consultation CLI du journal (testé)
│   ├── watch-knowledge-base.js
│   ├── docker-test-runner.js
│   ├── memoire-cli.js        # mémoire structurée CRUD (testé)
│   ├── boucle-hook-stop.js   # boucle 04 : critère d'arrêt déterministe (testé)
│   ├── boucle-surveillance.sh # boucle 05 : surveillance périodique (testé)
│   ├── basculer-modele.sh    # bascule entre profils de 05-configs/modeles.yaml (testé)
│   ├── valider-skills-workflows.js  # vérification déterministe skills/workflows (testé)
│   ├── auto-implementer.js   # applique une proposition sur branche git dédiée (testé)
│   ├── decision-rapide.js    # décision rapide, moteurs ollama/laya (ollama testé via mock)
│   ├── journal-desaccords.js # historique JSONL append-only des fiable:false (testé)
│   ├── suite-tests-reelle.sh # protocole de validation complète sur machine réelle (testé via stubs)
│   ├── security-check.sh
│   ├── install-plugins.sh    # plugins corrigés (dsh-workflow, dsh-tui, etc.)
│   └── setup-local-model.sh  # bascule vers Ollama local (testé, fusion YAML)
├── 05-configs/
│   ├── settings.local-ollama.yaml   # schéma vérifié
│   ├── profile-plugins.yml          # schéma non-vérifié, à confirmer
│   └── modeles.yaml                 # profils de modèles nommés (LLM interchangeables)
├── 06-data/                 # personnalite/ (dont valeurs.md), sagesse/, cours-techniques/, cours-webmarketing/, memoire/
├── logs/
└── start.sh
```
