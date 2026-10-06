#!/bin/bash
# demarrer-dsh-web-reseau.sh — lance dsh --profile web ouvert sur le
# réseau local (pas seulement 127.0.0.1), pour y accéder depuis un
# mobile sur le même WiFi. Pensé pour être lancé par le LaunchAgent
# installé via installer-demarrage-auto.sh — pour un usage interactif
# ponctuel, ./start.sh reste le point d'entrée normal.
#
# Port fixe 3080 (celui vu par défaut lors d'un essai réel sur cette
# machine) : une URL stable à mettre en favori sur le téléphone, plutôt
# qu'un port qui changerait à chaque lancement.
#
# --trusted-host : `dsh --profile web --help` documente un "garde-fou de
# confiance du navigateur" sur /api, qui vérifie l'autorité (host:port)
# de la requête. On déclare à la fois le nom .local (stable, via
# Bonjour/mDNS) et l'IP actuelle (peut changer avec le DHCP), pour ne
# jamais se retrouver bloqué si l'un des deux a changé depuis le dernier
# démarrage. Pas vérifié en conditions réelles que cette précaution est
# suffisante — à confirmer en se connectant vraiment depuis un mobile.
set -euo pipefail
cd "$(dirname "$0")/.."
export HARNESS_HOME="$(pwd)"
mkdir -p logs

PORT=3080
NOM_LOCAL=$(scutil --get LocalHostName 2>/dev/null || hostname)
IP_ACTUELLE=$(ifconfig 2>/dev/null | awk '/inet /{print $2}' | grep -v '^127\.' | head -1)

exec dsh --profile web --no-open \
    --host 0.0.0.0 \
    --port "$PORT" \
    --trusted-host "${NOM_LOCAL}.local:${PORT}" \
    --trusted-host "${IP_ACTUELLE}:${PORT}" \
    >> logs/dsh-web.log 2>&1
