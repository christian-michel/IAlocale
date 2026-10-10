#!/bin/bash
# desactiver-outils-objectifs.sh — désactive le plugin tool-goal (outils
# create_goal/get_goal/update_goal) sur les profils headless et web.
#
# Pourquoi ce script existe : trouvé en conditions réelles (voir
# documentation/historique-du-projet.md, "Validation sur machine réelle",
# round 23) — tool-goal est natif de dsh (jamais installé par ce projet)
# et expose au modèle un mécanisme de suivi d'objectif que rien dans ce
# dépôt n'utilise. qwen3-coder l'appelle pourtant en fin de tâche pour
# "clôturer" un objectif qu'il n'a jamais créé (update_goal avec un
# goal_id inventé), reçoit "no current goal", et repart pour des tours
# supplémentaires — jusqu'à ~30 min au lieu de ~1 min pour la tâche 3a
# de suite-tests-reelle.sh. Déjà vu aux rounds 14/15/17 (update_goal,
# create_goal) sans avoir été relié à cette cause.
#
# Solution : même principe que desactiver-recherche-web-cloud.sh —
# retirer l'outil de la liste proposée au modèle plutôt que d'espérer
# qu'il ne l'appelle jamais.
set -euo pipefail
cd "$(dirname "$0")/.."

command -v python3 >/dev/null 2>&1 || { echo "❌ python3 requis pour fusionner le YAML."; exit 1; }
python3 -c "import yaml" >/dev/null 2>&1 || { echo "❌ Module Python 'yaml' manquant. Installe-le avec : pip3 install pyyaml --break-system-packages"; exit 1; }

for PROFIL in headless web; do
    PATCH_FILE="$HOME/.dsh/profiles/$PROFIL/cordis.patch.yml"

    if [ ! -f "$PATCH_FILE" ]; then
        echo "⚠️  $PATCH_FILE introuvable — le profil '$PROFIL' a-t-il déjà été lancé une fois ? Ignoré."
        continue
    fi

    # Même précaution que configurer-skills-dsh.sh : ce format autorise
    # des expressions `!!js` que PyYAML ne sait pas préserver.
    if grep -v '^[[:space:]]*#' "$PATCH_FILE" | grep -q '!!js'; then
        echo "❌ $PATCH_FILE contient une expression '!!js' — fusion automatique refusée pour ne pas la corrompre."
        echo "   Ajoute à la main l'entrée suivante dans ce fichier :"
        echo "   - id: tool-goal"
        echo "     name: \"@deepseek-ai/dsh-tool-goal\""
        echo "     disabled: true"
        continue
    fi

    echo "🔌 Désactivation de tool-goal (create_goal/get_goal/update_goal) pour le profil '$PROFIL'..."
    python3 - "$PATCH_FILE" << 'PYEOF'
import sys
import yaml

patch_path = sys.argv[1]

with open(patch_path) as f:
    texte_brut = f.read()

lignes = texte_brut.splitlines(keepends=True)
i = 0
while i < len(lignes) and (lignes[i].startswith('#') or lignes[i].strip() == ''):
    i += 1
entete = ''.join(lignes[:i])

patch = yaml.safe_load(''.join(lignes[i:])) or []
if not isinstance(patch, list):
    print(f"❌ {patch_path} : format inattendu (pas une liste au niveau racine), fusion refusée.", file=sys.stderr)
    sys.exit(1)

entree = next((e for e in patch if isinstance(e, dict) and e.get("id") == "tool-goal"), None)
if entree is None:
    entree = {"id": "tool-goal", "name": "@deepseek-ai/dsh-tool-goal"}
    patch.append(entree)
entree["disabled"] = True

with open(patch_path, "w") as f:
    f.write(entete)
    yaml.safe_dump(patch, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

print(f"✅ {patch_path} mis à jour — tool-goal désactivé.")
PYEOF
done

echo ""
echo "Vérifie avec :"
echo "  dsh --profile headless --dump-config | grep -A3 'id: tool-goal'"
echo "(doit afficher 'disabled: true')"
