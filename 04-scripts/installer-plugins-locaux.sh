#!/bin/bash
# installer-plugins-locaux.sh — installe les plugins dsh du dépôt
# (07-plugins/) sur les profils headless et web (ou ceux passés en
# arguments), et les déclare dans leur cordis.patch.yml :
#
# - dsh-workflows-projet (outil `workflow_projet`, round 24) : l'outil
#   `workflow` natif oblige le modèle à recopier tout le script dans son
#   appel d'outil, ce que qwen3-coder rate en local ; `workflow_projet`
#   lit 03-workflows/<nom>.workflow.js et le confie au même moteur.
# - dsh-contexte-local (round 25) : avant chaque réponse, classe le
#   contexte du message ; s'il est conversationnel, injecte les passages
#   pertinents de 06-data/ (index : 04-scripts/connaissances.js indexer).
#
# Installé par lien (link:) : une modification du plugin dans le dépôt est
# prise en compte au prochain lancement de dsh, sans réinstallation.
# Ajouter un plugin passe par une entrée `insert` du patch (une entrée
# `- id:` seule ne fait que modifier un plugin existant : "entry not found").
#
# Règle aussi le moteur de workflows (workflow-ptc) sur un seul sous-agent
# à la fois : par défaut il en lance autant que de cœurs, chacun dans son
# propre processus Node, alors qu'Ollama ne traite qu'une requête à la
# fois — aucun gain de vitesse, seulement de la mémoire en plus. Sur 24 Go
# dont 21 pris par le modèle, un workflow complet a été arrêté faute de
# mémoire (round 24). Un patch remplace toute la config du plugin : la
# valeur d'origine provider: spawn est donc reprise.
set -euo pipefail
cd "$(dirname "$0")/.."
RACINE="$(pwd)"
DOSSIER_WORKFLOWS="$RACINE/03-workflows"
DOSSIER_SKILLS="$RACINE/01-skills"

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
        echo "         dossierSkills: $DOSSIER_SKILLS"
        echo "   - insert:"
        echo "     - id: contexte-local"
        echo "       name: dsh-contexte-local"
        echo "       config:"
        echo "         modele: <le modèle de agent-default-model>"
        continue
    fi

    for PLUGIN in dsh-workflows-projet dsh-contexte-local; do
        echo "📦 Installation du plugin $PLUGIN (lien) pour le profil '$PROFIL'..."
        (cd /tmp && dsh plugin --profile "$PROFIL" add "link:$RACINE/07-plugins/$PLUGIN" >/dev/null) \
            || { echo "❌ dsh plugin add $PLUGIN a échoué pour le profil '$PROFIL'."; exit 1; }
    done

    echo "🔌 Déclaration des plugins dans $PATCH_FILE..."
    python3 - "$PATCH_FILE" "$DOSSIER_WORKFLOWS" "$DOSSIER_SKILLS" << 'PYEOF'
import sys
import yaml

patch_path, dossier, dossier_skills = sys.argv[1], sys.argv[2], sys.argv[3]

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

# Modèle de classement de dsh-contexte-local : celui que le profil utilise
# déjà (écrit par setup-local-model.sh), donc déjà chargé — pas de bascule.
modele = next((e.get("config", {}).get("model") for e in patch if isinstance(e, dict) and e.get("id") == "agent-default-model"), None) or "qwen3-coder:30b-a3b-q4_K_M"
entrees = [
    {"id": "workflows-projet", "name": "dsh-workflows-projet", "config": {"dossier": dossier, "dossierSkills": dossier_skills}},
    {"id": "contexte-local", "name": "dsh-contexte-local", "config": {"modele": modele}},
]
ids = {e["id"] for e in entrees}
# Retire d'éventuelles déclarations précédentes (idempotence), puis les remet.
patch = [e for e in patch if not (isinstance(e, dict) and any(isinstance(x, dict) and x.get("id") in ids for x in e.get("insert", [])))]
for entree in entrees:
    patch.append({"insert": [entree]})

moteur = next((e for e in patch if isinstance(e, dict) and e.get("id") == "workflow-ptc"), None)
if moteur is None:
    moteur = {"id": "workflow-ptc", "name": "@deepseek-ai/dsh-workflow-ptc"}
    patch.append(moteur)
moteur["config"] = {"provider": "spawn", "maxConcurrentAgents": 1}

with open(patch_path, "w") as f:
    f.write(entete)
    yaml.safe_dump(patch, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

print(f"✅ {patch_path} mis à jour — workflow_projet et contexte-local déclarés (modèle de classement : {modele}), un sous-agent de workflow à la fois.")
PYEOF
done

echo ""
echo "Vérifie avec :"
echo "  dsh --profile headless --dump-config | grep -A4 -E 'id: (workflows-projet|contexte-local)'"
echo "L'index des données locales (06-data/) doit exister :"
echo "  node 04-scripts/connaissances.js indexer"
echo "Puis lance un workflow avec :"
echo "  node 04-scripts/lancer-workflow.js systeme-auto-ameliorant-avec-controle '{\"demande\":\"...\"}'"
