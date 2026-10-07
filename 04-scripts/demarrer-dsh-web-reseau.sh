#!/bin/bash
# demarrer-dsh-web-reseau.sh — lance dsh --profile web sur un port fixe,
# en vue d'un accès depuis un mobile via tunnel SSH (voir README,
# "Accès depuis le mobile" — PAS une exposition directe sur le réseau
# local : testé en conditions réelles, dsh 0.1.7-rc.2 refuse tout --host
# autre que 127.0.0.1 ou 0.0.0.0, et bloque 0.0.0.0 à l'exécution avec
# "it would expose remote code execution to the network" — aucun moyen
# de le lier directement à une IP du LAN avec cette version). Pensé pour
# être lancé par le LaunchAgent installé via installer-demarrage-auto.sh
# — pour un usage interactif ponctuel, ./start.sh reste le point
# d'entrée normal.
#
# Port fixe 3080 : une URL stable à mettre en favori côté tunnel, plutôt
# qu'un port qui changerait à chaque lancement.
#
# --trusted-host 127.0.0.1:3080 uniquement : dsh n'écoutant que sur
# 127.0.0.1, toute requête qui l'atteint (y compris via un tunnel SSH,
# qui ressort localement sur la machine) a cet hôte comme en-tête
# Host — inutile de déclarer le nom .local ou l'IP du LAN, qui
# n'apparaîtront jamais côté dsh.
set -euo pipefail
cd "$(dirname "$0")/.."
export HARNESS_HOME="$(pwd)"
mkdir -p logs

PORT=3080

exec dsh --profile web --no-open \
    --host 127.0.0.1 \
    --port "$PORT" \
    --trusted-host "127.0.0.1:${PORT}" \
    >> logs/dsh-web.log 2>&1
