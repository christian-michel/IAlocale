#!/bin/bash
# Installe le CLI dsh + tous les plugins demandés, avec les noms réels
# (plusieurs de ceux fournis dans le brief initial n'existaient pas tels
# quels — voir README.md, section "Vérification de la liste de plugins").
set -euo pipefail
cd "$(dirname "$0")/.."
HARNESS_HOME="$(pwd)"

echo "🔌 Installation dans : $HARNESS_HOME"

# 0. Le CLI de base. "dsh-agent-harness" (nom donné dans le brief) n'existe
#    pas comme paquet séparé : c'est le CLI lui-même, @deepseek-ai/dsh.
if ! command -v dsh >/dev/null 2>&1; then
    echo "📥 Installation du CLI dsh..."
    npm install -g @deepseek-ai/dsh
else
    echo "✅ dsh déjà installé ($(dsh --version 2>/dev/null || echo '?'))."
fi

# 1. Workflow : orchestrateur de workflows
#    NB : "dsh_workflow" (underscore, tel que donné) n'existe pas sur npm ;
#    le vrai paquet est "dsh-workflow" (tiret).
dsh plugin --profile web add dsh-workflow@latest

# 2. Browser : contrôle du navigateur
dsh plugin --profile web add dsh-browser@latest

# 3. ModLens : vision (lecture d'images), routable vers Ollama en local
dsh plugin --profile web add @liustack/modlens@latest

# 4. dsh-tui : client terminal pour dsh
dsh plugin --profile web add dsh-tui@latest

# 5. DSH-better-sidebar : barre latérale façon VS Code dans l'UI web
#    ("dsh-web" mentionné dans le brief n'est pas un plugin séparé — c'est
#    soit la sous-commande `dsh web`, déjà utilisée dans start.sh, soit le
#    module interne @deepseek-ai/dsh-web, déjà une dépendance du cœur.)
dsh plugin --profile web add "github:omdsh-dev/DSH-better-sidebar" || \
    echo "⚠️  DSH-better-sidebar : l'installation via GitHub a échoué. Vérifie la syntaxe exacte dans la doc dsh (dsh plugin --help), le nom du dépôt a pu changer."

# 6. agentic-research : laboratoire de recherche multi-agents (Python/uv,
#    indépendant de dsh — cloné à côté, pas installé comme plugin dsh)
mkdir -p ./02-plugins
if [ ! -d "./02-plugins/agentic-research" ]; then
    git clone https://github.com/BittnerPierre/agentic-research.git ./02-plugins/agentic-research
fi

# 7. dsh-find-plugins : fournit des skills, pas un plugin dsh à proprement
#    parler — on récupère juste son dossier skills/
if [ ! -d "./02-plugins/dsh-find-plugins" ]; then
    git clone https://github.com/Nagi-ovo/dsh-find-plugins.git ./02-plugins/dsh-find-plugins
fi
if [ -d "./02-plugins/dsh-find-plugins/skills" ]; then
    cp -rn ./02-plugins/dsh-find-plugins/skills/* ./01-skills/ 2>/dev/null || true
else
    echo "⚠️  Pas de dossier 'skills' dans dsh-find-plugins — vérifie la structure actuelle du dépôt avant de copier à l'aveugle."
fi

echo ""
echo "✅ Installation des plugins terminée."
echo "   Redémarre dsh (dsh --profile web) pour que les plugins soient actifs."
echo "   Prochaine étape : ./04-scripts/setup-local-model.sh pour brancher dsh sur Ollama en local"
echo "   (sinon dsh reste configuré sur l'API cloud DeepSeek par défaut)."
