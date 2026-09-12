#!/bin/bash
# basculer-modele.sh — bascule dsh vers un profil de modèle nommé (voir
# 05-configs/modeles.yaml), pour rendre le LLM sous-jacent interchangeable
# sans retenir un id de modèle par cœur.
#
# Ce script ne fait QUE résoudre le nom de profil vers l'id de modèle réel
# puis délègue à setup-local-model.sh, déjà testé (fusion YAML idempotente
# — voir README) : aucune logique de configuration n'est dupliquée ici.
#
# Usage :
#   ./basculer-modele.sh              # liste les profils disponibles
#   ./basculer-modele.sh rapide       # bascule vers le profil "rapide"
set -euo pipefail
cd "$(dirname "$0")/.."

PROFIL="${1:-}"
CONFIG="05-configs/modeles.yaml"

command -v python3 >/dev/null 2>&1 || { echo "❌ python3 requis pour lire $CONFIG."; exit 1; }
[ -f "$CONFIG" ] || { echo "❌ Fichier introuvable : $CONFIG"; exit 1; }

if [ -z "$PROFIL" ]; then
    echo "Profils disponibles :"
    python3 - "$CONFIG" << 'PYEOF'
import sys, yaml
with open(sys.argv[1]) as f:
    data = yaml.safe_load(f) or {}
defaut = data.get("profil-par-defaut", "")
for nom, info in (data.get("profils") or {}).items():
    marque = " (défaut)" if nom == defaut else ""
    print(f"  - {nom}{marque} : {info.get('modele')} — {info.get('description', '')}")
PYEOF
    exit 0
fi

MODELE=$(python3 - "$CONFIG" "$PROFIL" << 'PYEOF'
import sys, yaml
config_path, profil = sys.argv[1], sys.argv[2]
with open(config_path) as f:
    data = yaml.safe_load(f) or {}
info = (data.get("profils") or {}).get(profil)
if not info:
    sys.exit(1)
print(info["modele"])
PYEOF
) || { echo "❌ Profil inconnu : '$PROFIL'. Lance '$0' sans argument pour voir la liste."; exit 1; }

echo "🔀 Bascule vers le profil '$PROFIL' → modèle '$MODELE'"
exec ./04-scripts/setup-local-model.sh "$MODELE"
