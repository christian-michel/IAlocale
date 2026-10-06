#!/bin/bash
# installer-demarrage-auto.sh — installe un LaunchAgent macOS qui lance
# demarrer-dsh-web-reseau.sh à l'ouverture de session, pour un accès
# depuis le mobile sans avoir à lancer quoi que ce soit à la main.
#
# LaunchAgent (pas LaunchDaemon) volontairement : un LaunchDaemon tourne
# même sans session utilisateur ouverte, avec les droits système — pas
# nécessaire ici, et plus de surface de risque qu'un LaunchAgent qui
# tourne dans la session de l'utilisateur, comme n'importe quelle app
# lancée normalement.
#
# Pas testé en conditions réelles (pas de macOS dans cet environnement)
# — à vérifier après installation avec : launchctl list | grep ialocale
set -euo pipefail
cd "$(dirname "$0")/.."
HARNESS_HOME="$(pwd)"
PLIST_ID="com.ialocale.dsh-web"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_ID.plist"
SCRIPT_DEMARRAGE="$HARNESS_HOME/04-scripts/demarrer-dsh-web-reseau.sh"

[ -x "$SCRIPT_DEMARRAGE" ] || { echo "❌ $SCRIPT_DEMARRAGE introuvable ou non exécutable."; exit 1; }

mkdir -p "$HOME/Library/LaunchAgents" "$HARNESS_HOME/logs"

cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_ID</string>
    <key>ProgramArguments</key>
    <array>
        <string>$SCRIPT_DEMARRAGE</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$HARNESS_HOME/logs/dsh-web-launchd.log</string>
    <key>StandardErrorPath</key>
    <string>$HARNESS_HOME/logs/dsh-web-launchd-erreurs.log</string>
</dict>
</plist>
EOF

# Décharge une éventuelle instance précédente avant de recharger — sans
# ça, relancer ce script après une modification ne prendrait pas effet.
launchctl bootout "gui/$(id -u)" "$PLIST_PATH" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH" 2>/dev/null || launchctl load "$PLIST_PATH"

echo "✅ LaunchAgent installé et démarré : $PLIST_PATH"
echo "   Il se relancera automatiquement à chaque ouverture de session."
echo ""
echo "Vérifie qu'il tourne :"
echo "  launchctl list | grep ialocale"
echo ""
echo "Récupère l'URL à utiliser depuis ton mobile (token inclus dans la dernière ligne) :"
echo "  tail -5 $HARNESS_HOME/logs/dsh-web.log"
echo "Remplace l'hôte affiché par : $(scutil --get LocalHostName 2>/dev/null || hostname).local"
echo ""
echo "Pour désinstaller :"
echo "  launchctl bootout gui/\$(id -u) $PLIST_PATH && rm $PLIST_PATH"
