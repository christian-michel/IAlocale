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
- Les 14 skills : frontmatter YAML validé individuellement.
- Les 4 workflows : JSON validé syntaxiquement.
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

# 4. Premier test en tâche unique (headless), avant de lancer l'interface web
dsh --profile headless 'Explique-moi ce que fait 04-scripts/dsh-logger.js'

# 5. Lancement complet
./start.sh
```

## 🌱 Étendre vers la personnalité / sagesse / philosophie

Le skill `skill-personnalite-et-sagesse.md` est un point d'entrée
volontairement vide. Pour l'enrichir : ajoute des fichiers `.md` dans
`06-data/personnalite/` (ton, valeurs) et `06-data/sagesse/` (au-delà des
leçons techniques auto-générées — réflexions, principes). Le watcher les
indexe automatiquement ; aucun changement de code n'est nécessaire.

## 📁 Contenu du paquet

```
dsh-harness/
├── 01-skills/              # 14 skills (12 précédents + boucles-agentiques, gestion-memoire)
├── 02-plugins/              # agentic-research, dsh-find-plugins (clonés à l'install)
├── 03-workflows/            # 4 workflows JSON (schéma non-vérifiable formellement)
├── 04-scripts/
│   ├── dsh-logger.js         # logs structurés + SILENT_ERROR (testé)
│   ├── errors-cli.js         # consultation CLI du journal (testé)
│   ├── watch-knowledge-base.js
│   ├── docker-test-runner.js
│   ├── memoire-cli.js        # mémoire structurée CRUD (testé)
│   ├── boucle-hook-stop.js   # boucle 04 : critère d'arrêt déterministe (testé)
│   ├── boucle-surveillance.sh # boucle 05 : surveillance périodique (testé)
│   ├── basculer-modele.sh    # bascule entre profils de 05-configs/modeles.yaml (testé)
│   ├── security-check.sh
│   ├── install-plugins.sh    # plugins corrigés (dsh-workflow, dsh-tui, etc.)
│   └── setup-local-model.sh  # bascule vers Ollama local (testé, fusion YAML)
├── 05-configs/
│   ├── settings.local-ollama.yaml   # schéma vérifié
│   ├── profile-plugins.yml          # schéma non-vérifié, à confirmer
│   └── modeles.yaml                 # profils de modèles nommés (LLM interchangeables)
├── 06-data/                 # personnalite/, sagesse/, cours-techniques/, cours-webmarketing/, memoire/
├── logs/
└── start.sh
```
