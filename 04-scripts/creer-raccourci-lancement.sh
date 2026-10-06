#!/bin/bash
# creer-raccourci-lancement.sh — génère une icône .app double-cliquable
# sur le Bureau, qui ouvre un Terminal et lance ./start.sh.
#
# Pourquoi osacompile plutôt qu'Automator : Automator (Pomme > Nouveau
# document > Application > "Exécuter un script shell") fait la même
# chose en quelques clics, mais c'est une étape manuelle en interface
# graphique, impossible à scripter depuis cet environnement. osacompile
# produit le même résultat (un vrai .app double-cliquable, déplaçable
# dans le Dock) en une commande, avec un outil déjà installé sur tout
# macOS — pas de dépendance externe à ajouter.
set -euo pipefail
cd "$(dirname "$0")/.."
HARNESS_HOME="$(pwd)"
NOM_APP="${1:-Lancer IAlocale}"
DESTINATION="$HOME/Desktop/$NOM_APP.app"

command -v osacompile >/dev/null 2>&1 || { echo "❌ osacompile introuvable (devrait être natif sur macOS — es-tu bien sur un Mac ?)."; exit 1; }
[ -f "$HARNESS_HOME/start.sh" ] || { echo "❌ start.sh introuvable dans $HARNESS_HOME."; exit 1; }

SCRIPT_TEMPORAIRE=$(mktemp /tmp/lancer-XXXXXX.applescript)
trap 'rm -f "$SCRIPT_TEMPORAIRE"' EXIT

cat > "$SCRIPT_TEMPORAIRE" << EOF
tell application "Terminal"
    activate
    do script "cd '$HARNESS_HOME' && ./start.sh"
end tell
EOF

osacompile -o "$DESTINATION" "$SCRIPT_TEMPORAIRE"

echo "✅ Icône créée : $DESTINATION"
echo "   Double-clique dessus (ou glisse-la dans le Dock) pour lancer ce projet."
echo "   Pour changer son icône : sélectionne-la dans le Finder, Cmd+I, glisse une image PNG/ICNS sur la petite icône en haut de la fenêtre d'infos."
