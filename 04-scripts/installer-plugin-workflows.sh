#!/bin/bash
# installer-plugin-workflows.sh — installe le plugin dsh local
# 07-plugins/dsh-workflows-projet (outil `workflow_projet`) sur les profils
# headless et web (ou ceux passés en arguments), et le déclare dans leur
# cordis.patch.yml.
#
# Pourquoi ce script existe (voir documentation/historique-du-projet.md,
# round 24) : l'outil `workflow` natif de dsh oblige le modèle à recopier
# tout le script dans son appel d'outil, ce que qwen3-coder rate en local.
# `workflow_projet` lit le script dans 03-workflows/<nom>.workflow.js et le
# confie au même moteur — le modèle ne donne qu'un nom et des args.
#
# Installé par lien (link:) : une modification du plugin dans le dépôt est
# prise en compte au prochain lancement de dsh, sans réinstallation.
# Ajouter un plugin passe par une entrée `insert` du patch (une entrée
# `- id:` seule ne fait que modifier un plugin existant : "entry not found").
set -euo pipefail
cd "$(dirname "$0")/.."
RACINE="$(pwd)"
PLUGIN="$RACINE/07-plugins/dsh-workflows-projet"
DOSSIER_WORKFLOWS="$RACINE/03-workflows"

command -v python3 >/dev/null 2>&1 || { echo "❌ python3 requis pour fusionner le YAML."; exit 1; }
python3 -c "import yaml" >/dev/null 2>&1 || { echo "❌ Module Python 'yaml' manquant. Installe-le avec : pip3 install pyyaml --break-system-packages"; exit 1; }

# Profils visés : en arguments, sinon headless et web.
PROFILS=("$@")
[ ${#PROFILS[@]} -eq 0 ] && PROFILS=(headless web)
for PROFIL in "${PROFILS[@]}"; do
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
        echo "   - insert:"
        echo "     - id: workflows-projet"
        echo "       name: dsh-workflows-projet"
        echo "       config:"
        echo "         dossier: $DOSSIER_WORKFLOWS"
        continue
    fi

    echo "📦 Installation du plugin dsh-workflows-projet (lien) pour le profil '$PROFIL'..."
    (cd /tmp && dsh plugin --profile "$PROFIL" add "link:$PLUGIN" >/dev/null) \
        || { echo "❌ dsh plugin add a échoué pour le profil '$PROFIL'."; exit 1; }

    echo "🔌 Déclaration de workflow_projet dans $PATCH_FILE..."
    python3 - "$PATCH_FILE" "$DOSSIER_WORKFLOWS" << 'PYEOF'
import sys
import yaml

patch_path, dossier = sys.argv[1], sys.argv[2]

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

entree = {"id": "workflows-projet", "name": "dsh-workflows-projet", "config": {"dossier": dossier}}
# Retire une éventuelle déclaration précédente (idempotence), puis la remet.
patch = [e for e in patch if not (isinstance(e, dict) and any(isinstance(x, dict) and x.get("id") == "workflows-projet" for x in e.get("insert", [])))]
patch.append({"insert": [entree]})

with open(patch_path, "w") as f:
    f.write(entete)
    yaml.safe_dump(patch, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

print(f"✅ {patch_path} mis à jour — workflow_projet déclaré (dossier : {dossier}).")
PYEOF
done

echo ""
echo "Vérifie avec :"
echo "  dsh --profile headless --dump-config | grep -A4 'id: workflows-projet'"
echo "Puis lance un workflow avec :"
echo "  node 04-scripts/lancer-workflow.js systeme-auto-ameliorant-avec-controle '{\"demande\":\"...\"}'"
