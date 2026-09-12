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
- Les 12 skills : frontmatter YAML validé individuellement.
- Les 4 workflows : JSON validé syntaxiquement.
- Toute la chaîne shell (`start.sh`, `install-plugins.sh`,
  `security-check.sh`) : testée de bout en bout dans un environnement sans
  Docker/Ollama/dsh (le cas réel avant ta première installation) — échoue
  proprement avec des messages clairs, jamais de plantage silencieux.

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
2. Télécharge le modèle choisi (`qwen2.5-coder:7b` par défaut — change-le
   au besoin) et vérifie que l'id déclaré correspond **exactement** (avec
   les `:`) à ce que sert Ollama, pour éviter un 404 silencieux.
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
  instruct de taille plus modeste est souvent nettement plus rapide pour
  un résultat équivalent. Réserve le "thinking" aux tâches qui en ont
  vraiment besoin (skill `analyse-objectifs` par exemple), pas à
  l'exécution courante.
- **Dimensionnement mémoire** : un modèle 8B en Q4 tient dans ~5 Go — sur
  24 Go de mémoire unifiée, tu as de la marge pour le contexte, Docker, et
  le reste du système, tant que tu ne fais pas tourner plusieurs gros
  modèles en simultané.

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

## 🚀 Installation

```bash
unzip dsh-harness.zip -d ~/dsh-harness
cd ~/dsh-harness

# 1. Installer dsh + tous les plugins
./04-scripts/install-plugins.sh

# 2. Configurer le modèle local (remplace le modèle par défaut si besoin)
./04-scripts/setup-local-model.sh qwen2.5-coder:7b

# 3. Vérifier que le contexte réellement servi correspond
ollama run qwen2.5-coder:7b 'bonjour' >/dev/null && ollama ps

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
├── 01-skills/              # 12 skills (10 du plan d'origine + 2 nouveaux)
├── 02-plugins/              # agentic-research, dsh-find-plugins (clonés à l'install)
├── 03-workflows/            # 4 workflows JSON (schéma non-vérifiable formellement)
├── 04-scripts/
│   ├── dsh-logger.js         # logs structurés + SILENT_ERROR (testé)
│   ├── errors-cli.js         # consultation CLI du journal (testé)
│   ├── watch-knowledge-base.js
│   ├── docker-test-runner.js
│   ├── security-check.sh
│   ├── install-plugins.sh    # plugins corrigés (dsh-workflow, dsh-tui, etc.)
│   └── setup-local-model.sh  # bascule vers Ollama local (testé, fusion YAML)
├── 05-configs/
│   ├── settings.local-ollama.yaml   # schéma vérifié
│   └── profile-plugins.yml          # schéma non-vérifié, à confirmer
├── 06-data/                 # personnalite/, sagesse/, cours-techniques/, cours-webmarketing/
├── logs/
└── start.sh
```
