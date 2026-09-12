#!/bin/bash
# boucle-surveillance.sh — boucle 05 du concept "5 boucles" : relance une
# commande à intervalle régulier, indéfiniment, jusqu'à interruption
# manuelle (Ctrl+C).
#
# ATTENTION — lu le PDF source jusqu'au bout avant d'écrire ce script :
# « ce n'est pas travailler jusqu'à ce que ce soit fini, c'est de la
# surveillance ». Il n'y a ici AUCUN critère d'arrêt automatique : le
# script tourne tant qu'on ne le coupe pas soi-même. Pour "travailler
# jusqu'à ce que ce soit fini", utilise boucle-hook-stop.js (critère
# vérifiable) ou le workflow systeme-auto-ameliorant-avec-controle.json
# (seuil de satisfaction). Réserve ce script à du vrai monitoring :
# surveiller un service, ré-indexer périodiquement, alerter sur une
# dérive — pas à faire avancer une tâche de fond en croyant qu'elle
# progresse vers un objectif.
#
# Usage : ./boucle-surveillance.sh "<commande>" [intervalle_secondes] [composant]
set -uo pipefail
cd "$(dirname "$0")/.."

COMMANDE="${1:-}"
INTERVALLE="${2:-300}"
COMPOSANT="${3:-boucle-surveillance}"

if [ -z "$COMMANDE" ]; then
    echo "Usage : $0 \"<commande>\" [intervalle_secondes=300] [composant]" >&2
    exit 1
fi

# Petit relais vers dsh-logger.js pour que chaque cycle laisse une trace
# structurée dans logs/pipeline.jsonl, au même titre que tous les autres
# scripts de ce projet — sans dupliquer la logique de logging en bash.
#
# niveau/composant/message passent tous par process.argv (jamais par
# interpolation dans le code source du -e) : COMPOSANT vient d'un
# argument de ce script, un caractère comme une apostrophe ne doit
# jamais pouvoir casser ou étendre le code JS exécuté.
journaliser() {
    node --input-type=module -e "
import { logInfo, logWarning, logError } from './04-scripts/dsh-logger.js';
const fns = { INFO: logInfo, WARNING: logWarning, ERROR: logError };
const [niveau, composant, message] = process.argv.slice(1);
(fns[niveau] || logInfo)(composant, message);
" -- "$1" "$COMPOSANT" "$2"
}

echo "⚠️  SURVEILLANCE, PAS UN CRITÈRE D'ARRÊT — cette boucle ne termine jamais"
echo "    d'elle-même. Coupe-la avec Ctrl+C quand tu n'en as plus besoin."
echo "🔁 Commande : $COMMANDE"
echo "⏱️  Intervalle : ${INTERVALLE}s"
echo ""

trap 'journaliser INFO "Surveillance arrêtée manuellement"; echo ""; echo "🛑 Surveillance arrêtée."; exit 0' SIGINT SIGTERM

journaliser INFO "Surveillance démarrée (intervalle ${INTERVALLE}s)"

while true; do
    HORODATAGE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "[$HORODATAGE] Exécution : $COMMANDE"
    bash -c "$COMMANDE"
    CODE_SORTIE=$?
    if [ "$CODE_SORTIE" -ne 0 ]; then
        journaliser WARNING "Cycle de surveillance terminé avec un code de sortie non nul ($CODE_SORTIE)"
    else
        journaliser INFO "Cycle de surveillance exécuté avec succès"
    fi
    sleep "$INTERVALLE"
done
