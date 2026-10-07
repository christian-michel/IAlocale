#!/bin/bash
# bootstrap-complet.sh — point d'entrée unique pour une machine neuve :
# vérifie/installe tout ce dont ce projet a eu besoin au fil de son
# développement (chaque dépendance ci-dessous a été une vraie cause de
# blocage à un moment, voir README "Validation sur machine réelle"),
# puis enchaîne la configuration complète en un seul lancement.
#
# Pensé pour : "j'efface mon Mac Mini, je veux tout retrouver avec une
# seule commande." Ne remplace pas les scripts individuels (toujours
# utilisables séparément, voir README section Installation) — les
# orchestre dans l'ordre, avec les vérifications de prérequis qui leur
# manquaient en amont.
#
# Volontairement PAS entièrement automatisé : l'installation de Homebrew
# lui-même demande une confirmation interactive (et parfois les outils
# de ligne de commande Xcode) — ce script s'arrête là avec l'instruction
# exacte plutôt que de lancer un curl | bash sans supervision.
set -uo pipefail
cd "$(dirname "$0")/.."
HARNESS_HOME="$(pwd)"
export HARNESS_HOME

ECHECS=0
etape() { echo ""; echo "━━━ $1 ━━━"; }
echec() { ECHECS=$((ECHECS + 1)); echo "❌ $1"; }
ok() { echo "✅ $1"; }

etape "0. Plateforme"
if [ "$(uname)" != "Darwin" ]; then
    echo "❌ Ce projet est pensé pour macOS (Mac Mini M4) — plateforme détectée : $(uname)."
    echo "   iogpu.wired_limit_mb, launchctl, osacompile n'ont pas d'équivalent testé ailleurs."
    exit 1
fi
ok "macOS détecté"

etape "1. Homebrew"
if command -v brew >/dev/null 2>&1; then
    ok "Homebrew présent ($(brew --version | head -1))"
else
    echo "❌ Homebrew introuvable — installation non automatisée ici (demande une confirmation"
    echo "   interactive de ta part, parfois les outils Xcode). Installe-le avec :"
    echo '   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
    echo "   Puis relance ce script."
    exit 1
fi

etape "2. Node.js et npm"
if command -v node >/dev/null 2>&1; then
    ok "Node $(node --version)"
else
    echo "📥 Installation de Node via brew..."
    brew install node && ok "Node installé ($(node --version))" || echec "Échec de l'installation de Node"
fi
if command -v npm >/dev/null 2>&1; then
    ok "npm $(npm --version)"
else
    echec "npm introuvable malgré Node installé — vérifie manuellement"
fi

etape "3. pnpm (requis par 'dsh plugin add')"
if command -v pnpm >/dev/null 2>&1; then
    ok "pnpm $(pnpm --version)"
else
    echo "📥 Installation de pnpm..."
    brew install pnpm && ok "pnpm installé ($(pnpm --version 2>/dev/null))" || echec "Échec de l'installation de pnpm"
fi

etape "4. git"
if command -v git >/dev/null 2>&1; then
    ok "git $(git --version | awk '{print $3}')"
else
    echo "📥 Installation de git..."
    brew install git && ok "git installé" || echec "Échec de l'installation de git"
fi

etape "5. Python 3 et le module PyYAML"
if command -v python3 >/dev/null 2>&1; then
    ok "python3 $(python3 --version 2>&1 | awk '{print $2}')"
else
    echo "📥 Installation de python3..."
    # Nom de formule brew incertain selon la version (python3 vs python) —
    # on tente les deux plutôt que de deviner lequel existe sur cette machine.
    (brew install python3 || brew install python) && ok "python3 installé" || echec "Échec de l'installation de python3"
fi
if python3 -c "import yaml" >/dev/null 2>&1; then
    ok "module Python 'yaml' présent"
else
    echo "📥 Installation de PyYAML..."
    pip3 install pyyaml --break-system-packages && ok "PyYAML installé" || echec "Échec de l'installation de PyYAML"
fi

etape "6. Docker (optionnel — requis seulement par skill-testeur-docker)"
if command -v docker >/dev/null 2>&1; then
    ok "Docker présent"
else
    echo "⚠️  Docker introuvable — non bloquant, mais skill-testeur-docker ne pourra pas s'exécuter."
    echo "   Installe Docker Desktop : https://www.docker.com/products/docker-desktop/"
fi

etape "7. Ollama"
if command -v ollama >/dev/null 2>&1; then
    ok "Ollama présent"
else
    echo "📥 Installation d'Ollama..."
    brew install ollama && ok "Ollama installé" || echec "Échec de l'installation d'Ollama"
fi

etape "8. dsh + plugins"
if [ "$ECHECS" -gt 0 ]; then
    echo "⚠️  Des prérequis ont échoué ci-dessus — poursuite malgré tout, mais attends-toi à des échecs en cascade."
fi
./04-scripts/install-plugins.sh || echec "install-plugins.sh a échoué"

etape "9. Modèle local et configuration Ollama/dsh (contexte, mémoire GPU)"
./04-scripts/setup-local-model.sh || echec "setup-local-model.sh a échoué"

etape "10. Skills de ce dépôt déclarés à dsh"
./04-scripts/configurer-skills-dsh.sh || echec "configurer-skills-dsh.sh a échoué"

etape "11. Outil de recherche web cloud désactivé"
./04-scripts/desactiver-recherche-web-cloud.sh || echec "desactiver-recherche-web-cloud.sh a échoué"

echo ""
if [ "$ECHECS" -eq 0 ]; then
    echo "=== ✅ Bootstrap terminé sans échec ==="
    echo ""
    echo "Prochaine étape recommandée (confirme tout de bout en bout) :"
    echo "  ./04-scripts/suite-tests-reelle.sh"
    echo ""
    echo "Optionnel, pour le confort au quotidien (pas requis) :"
    echo "  ./04-scripts/creer-raccourci-lancement.sh      # icône cliquable sur le Bureau"
    echo "  ./04-scripts/installer-demarrage-auto.sh       # démarrage auto + accès mobile sur le WiFi"
    exit 0
else
    echo "=== ⚠️  Bootstrap terminé avec $ECHECS échec(s) — voir le détail ❌ ci-dessus ==="
    exit 1
fi
