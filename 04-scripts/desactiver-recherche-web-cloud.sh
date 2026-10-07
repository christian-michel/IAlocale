#!/bin/bash
# desactiver-recherche-web-cloud.sh — désactive le plugin tool-web (outil
# web_search/web_fetch) sur les profils headless et web.
#
# Pourquoi ce script existe : trouvé en conditions réelles (voir README,
# "Validation sur machine réelle") — tool-web est natif du profil
# headless (jamais installé par ce projet) et expose au modèle un outil
# web_search câblé en dur sur l'API cloud DeepSeek
# (web-search-deepseek, apiKeyEnv: DEEPSEEK_API_KEY) — strictement
# contraire au principe "aucune API cloud pour le fonctionnement
# quotidien" de ce projet (voir CLAUDE.md). DEEPSEEK_API_KEY n'étant
# jamais configurée ici, un appel à cet outil échoue toujours ; pire, un
# modèle local de taille modeste gère mal cet échec et peut partir en
# texte incohérent après coup plutôt que de simplement ignorer l'outil.
#
# Solution : retirer l'outil de la liste proposée au modèle plutôt que
# d'espérer qu'il ne l'appelle jamais.
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
    # des expressions `!!js` que PyYAML ne sait pas préserver. Lignes de
    # commentaire exclues de la recherche (sinon le commentaire d'en-tête
    # qui MENTIONNE `!!js` déclenche un faux positif).
    if grep -v '^[[:space:]]*#' "$PATCH_FILE" | grep -q '!!js'; then
        echo "❌ $PATCH_FILE contient une expression '!!js' — fusion automatique refusée pour ne pas la corrompre."
        echo "   Ajoute à la main l'entrée suivante dans ce fichier :"
        echo "   - id: tool-web"
        echo "     name: \"@deepseek-ai/dsh-tool-web\""
        echo "     disabled: true"
        continue
    fi

    echo "🔌 Désactivation de tool-web (recherche/fetch web cloud) pour le profil '$PROFIL'..."
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

entree = next((e for e in patch if isinstance(e, dict) and e.get("id") == "tool-web"), None)
if entree is None:
    entree = {"id": "tool-web", "name": "@deepseek-ai/dsh-tool-web"}
    patch.append(entree)
entree["disabled"] = True

with open(patch_path, "w") as f:
    f.write(entete)
    yaml.safe_dump(patch, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

print(f"✅ {patch_path} mis à jour — tool-web désactivé.")
PYEOF
done

echo ""
echo "Vérifie avec :"
echo "  dsh --profile headless --dump-config | grep -A3 'id: tool-web'"
echo "(doit afficher 'disabled: true')"
