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

# 4. Premier test en tâche unique (headless), avant de passer en mode web (étape 5)
dsh --profile headless 'Explique-moi ce que fait 04-scripts/dsh-logger.js'

# 5. Lancement complet
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
