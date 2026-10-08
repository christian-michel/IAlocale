# IAlocale — assistant IA 100 % local pour Mac Mini M4

Assistant IA qui tourne entièrement sur ta machine, sans aucune API
cloud — basé sur `dsh` (agent de codage open-source) piloté par un
modèle Ollama local. Orienté code et développement par défaut, mais
capable de traiter des demandes plus larges (rédaction, analyse,
relationnel, logique) grâce à ses skills.

Pour l'historique technique complet (19+ rounds de validation réelle,
bugs trouvés et corrigés, choix d'architecture détaillés) :
**[`documentation/historique-du-projet.md`](documentation/historique-du-projet.md)**.
Ce fichier-ci reste volontairement court — l'usage courant, pas le
journal de bord.

## 🖥️ Configuration machine

- **Mac Mini M4**, 24 Go de RAM unifiée, 250 Go de disque
- macOS (testé sur Mojave et plus récent — requis pour les protections
  TCC dont ce projet tient compte)
- Aucune carte graphique dédiée : le modèle tourne sur le GPU intégré
  via Metal, d'où l'attention portée à la mémoire GPU (voir plus bas)

## 🧩 Stack logicielle

| Composant | Rôle |
|---|---|
| **`dsh`** (`@deepseek-ai/dsh`) | Agent de codage : boucle agentique, outils (fichiers, bash), skills, workflows |
| **Ollama** | Sert le modèle en local sur `127.0.0.1:11434`, remplace l'API cloud DeepSeek par défaut de `dsh` |
| **Qwen3-Coder** (`qwen3-coder:30b-a3b-q4_K_M`) | Modèle par défaut — MoE 30 Md de paramètres, 3 Md actifs par passe (vitesse d'un petit modèle, connaissances d'un plus gros), ~19 Go en Q4 |
| **Laya** (optionnel) | Encodeur dédié (421 M de paramètres) pour des décisions fermées très rapides (oui/non, choix), en complément du gros modèle — voir `04-scripts/moteur-laya.js` |

Chacun des trois éléments interchangeables (emplacement d'installation,
modèle, moteur Laya) n'existe qu'à un seul endroit dans le code —
détails dans `documentation/historique-du-projet.md`, section
"Portabilité".

## 🎯 Le projet

Obtenir une IA qui travaille entièrement sur la machine, sans jamais
envoyer de données vers un service cloud — ni pour le modèle, ni pour
la recherche web (désactivée par défaut, voir plus bas). Pensé d'abord
pour l'assistance au code (c'est le point fort du modèle par défaut),
mais étendu par un système de skills (`01-skills/`) pour couvrir des
tâches plus larges sans dépendre d'un meilleur modèle pour chacune :
contrôle qualité à deux niveaux, auto-amélioration encadrée,
décision rapide, mémoire structurée, relationnel, sagesse personnelle.

## 📋 Prérequis

Vérifiés et installés automatiquement par le script d'installation
rapide (ci-dessous) — sauf Homebrew, qui demande une confirmation
interactive :

- **Homebrew** — gestionnaire de paquets macOS
- **Node.js + npm** — fait tourner `dsh` et les scripts de ce projet
- **pnpm** — requis par `dsh plugin add`
- **git**
- **Python 3 + le module PyYAML** — fusionne les fichiers de config YAML
- **Ollama** — sert le modèle en local
- **Docker** (optionnel) — uniquement pour `skill-testeur-docker`

## 🚀 Installation rapide

```bash
git clone <url-du-depot> ~/dsh-harness
cd ~/dsh-harness
./04-scripts/bootstrap-complet.sh
```

Installe tout ce qui manque (avec confirmation pour Homebrew),
configure le modèle local, déclare les skills de ce dépôt auprès de
`dsh`, désactive la recherche web cloud. Teste ensuite avec :

```bash
./04-scripts/suite-tests-reelle.sh
```

## 🔧 Installation détaillée (étape par étape)

```bash
cd ~/dsh-harness

# 1. Installer dsh + tous les plugins
./04-scripts/install-plugins.sh

# 2. Configurer le modèle local (résout le profil par défaut tout seul,
#    voir 05-configs/modeles.yaml — ou choisis-en un : ./04-scripts/basculer-modele.sh rapide)
./04-scripts/setup-local-model.sh

# 3. Vérifier que le contexte réellement servi correspond
ollama run qwen3-coder:30b-a3b-q4_K_M 'bonjour' >/dev/null && ollama ps

# 4. Premier test en tâche unique (headless) — crée aussi le profil
#    ~/.dsh/profiles/headless/, nécessaire à l'étape 5
dsh --profile headless 'Explique-moi ce que fait 04-scripts/dsh-logger.js'

# 5. Déclarer 01-skills/ de ce dépôt auprès de dsh
./04-scripts/configurer-skills-dsh.sh

# 6. Désactiver l'outil de recherche web natif de dsh (câblé sur l'API cloud DeepSeek)
./04-scripts/desactiver-recherche-web-cloud.sh
```

⚠️ **Deux réglages ne survivent pas à un redémarrage de la machine**
(mémoire GPU, contexte Ollama) — relance `./04-scripts/setup-local-model.sh`
après chaque reboot avant d'utiliser `dsh`.

## 🖱️ Lancer avec l'interface graphique (raccourci bureau)

```bash
./04-scripts/creer-raccourci-lancement.sh
```

Crée une icône `.app` double-cliquable sur le Bureau. Au clic : ouvre
une fenêtre Terminal, lance l'audit de sécurité, démarre le watcher de
connaissances, puis `dsh --profile web` (ouvre automatiquement le
navigateur sur `http://127.0.0.1:3080`).

## ⌨️ Lancer et gérer depuis le terminal

```bash
./start.sh                       # équivalent de l'icône : watcher + dsh --profile web
dsh --profile web                 # directement, sans le watcher
dsh --profile headless "..."      # une seule tâche, répond et quitte (pas de conversation continue)
```

Changer de modèle :
```bash
./04-scripts/basculer-modele.sh              # liste les profils disponibles
./04-scripts/basculer-modele.sh reflexion    # bascule vers un profil nommé
```

Arrêter : `Ctrl+C` dans le terminal où `dsh` tourne (le watcher
s'arrête proprement avec lui via `start.sh`).

## 💬 Fonctionnement de base — comment s'adresser à lui

Deux façons de converser, toutes les deux depuis un terminal (ou
l'interface web pour la première) :

- **Interface web** (`dsh --profile web`) — chat classique, conversation
  continue, accessible aussi depuis un mobile sur le même réseau via un
  tunnel SSH (voir `documentation/historique-du-projet.md`).
- **Terminal, une tâche à la fois** (`dsh --profile headless "ta question"`)
  — répond une fois puis s'arrête ; pour une vraie conversation avec
  plusieurs allers-retours, utilise plutôt l'interface web.

Rien de spécial à apprendre pour écrire une demande — langage naturel,
en français. L'agent choisit lui-même, selon ta formulation, quel(s)
skill(s) invoquer (contrôle qualité, relationnel, décision rapide...).
Si une demande est encore floue dans ta tête, demande-lui explicitement
de la clarifier d'abord (`skill-clarifier-la-demande`) plutôt que de le
laisser deviner.

## 🎨 Personnalisation

- **`01-skills/*.md`** — chaque fichier est une instruction en langage
  naturel (pas du code) : méthode, déclencheur, garde-fous. Modifiable
  directement, ou proposé par l'agent lui-même via le mécanisme
  d'auto-amélioration encadré (`skill-ameliorateur-systeme` →
  `auto-implementer.js`, limité à `01-skills/` et `03-workflows/`).
- **`06-data/personnalite/`** et **`06-data/sagesse/`** — tes propres
  contenus (valeurs, méthode, citations, clés relationnelles) : de
  simples fichiers `.md`/`.csv`/`.txt`, indexés automatiquement par le
  watcher, consultés par les skills `consulter-sagesse-interne` et
  `persona-relations-humaines` avant toute réponse sur ces sujets.
- **`05-configs/modeles.yaml`** — ajoute tes propres profils de modèle
  nommés, basculables avec `basculer-modele.sh`.

## 🔁 Démarrage à l'ouverture de session

```bash
./04-scripts/installer-demarrage-auto.sh
```

Installe un `LaunchAgent` macOS qui relance `dsh` automatiquement à
chaque connexion — pas besoin de cliquer sur rien. Désinstallation
affichée en fin d'exécution du script.

⚠️ Si ce dépôt vit sous `~/Documents`/`~/Desktop`/`~/Downloads`, macOS
peut bloquer ce mécanisme (protection TCC) — voir
`documentation/historique-du-projet.md` pour le contournement.

## 🌱 Évolutions possibles

Idées discutées mais pas encore construites, avec leur état réel et la
recommandation donnée pour chacune : **[`PISTES-EVOLUTION.md`](PISTES-EVOLUTION.md)**
(réponse systématique en français, un LLM par expertise, PDF/vision,
voix, génération d'images, Docker par projet...).

## 📁 Arborescence du projet

```
dsh-harness/
├── start.sh                    # point d'entrée interactif (dsh --profile web + watcher)
├── package.json                # seule dépendance npm : @receptron/laya (optionnelle)
├── PISTES-EVOLUTION.md         # idées futures, pas encore construites
├── documentation/
│   └── historique-du-projet.md # journal de bord technique complet, tous les rounds
│
├── 01-skills/                   # 27 skills en langage naturel — voir leur description pour le déclenchement
├── 03-workflows/                # 5 workflows JSON (pipelines multi-étapes)
├── 04-scripts/                  # scripts d'installation, de gestion, et logique métier (Node + bash)
├── 05-configs/                  # profils de modèles, config Ollama de référence
└── 06-data/
    ├── personnalite/             # tes contenus personnels (valeurs, méthode, clés relationnelles...)
    └── sagesse/                  # citations, leçons apprises
```

Détail fichier par fichier dans `documentation/historique-du-projet.md`.
