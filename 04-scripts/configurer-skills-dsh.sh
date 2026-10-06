#!/bin/bash
# configurer-skills-dsh.sh — déclare 01-skills/ de ce dépôt comme
# customSkillDirs pour dsh (plugin skill-filesystem), sur les profils
# headless et web.
#
# Pourquoi ce script existe : par défaut, dsh ne voit QUE ses propres
# skills internes (préréglage "cordis", noms numériques type
# skill_30103000534672...) — confirmé en pratique (voir README,
# "Validation sur machine réelle", round 6 : `dsh --profile headless
# "Liste les skills..."` ne renvoyait que ces ID internes). Rien ne pointe
# automatiquement vers 01-skills/ de ce dépôt tant qu'on ne le déclare pas
# explicitement dans le patch de chaque profil
# (~/.dsh/profiles/<profil>/cordis.patch.yml).
#
# customSkillDirs est un tableau de chemins ABSOLUS — vérifié directement
# dans `dsh --dump-config-schema` (pas deviné) :
#   "customSkillDirs": {"default": [], "anyOf": [{"type": ["array",
#   "null"], "items": {"type": ["string", "null"]}}, ...]}
# D'où le calcul du chemin absolu de ce dépôt plutôt qu'un chemin écrit en
# dur : le nom du dossier change d'un checkout à l'autre (voir le piège
# "Download ZIP" déjà documenté dans auto-implementer.js).
#
# REMPLACE la liste plutôt que d'y ajouter (bug trouvé en pratique, round
# 9 — voir README) : après un reclonage dans un nouveau dossier, l'ancien
# chemin restait dans customSkillDirs à côté du nouveau, et dsh servait le
# contenu de skill-controleur-qualite.md de l'ANCIEN dossier (périmé,
# sans les correctifs du round 8) — les deux dossiers déclarant un skill
# du même nom, dsh prend apparemment le premier de la liste. Ce projet
# n'a jamais qu'un seul checkout actif à la fois : customSkillDirs ne
# doit donc jamais contenir plus d'une entrée.
set -euo pipefail
cd "$(dirname "$0")/.."
HARNESS_HOME="$(pwd)"
SKILLS_DIR="$HARNESS_HOME/01-skills"

command -v python3 >/dev/null 2>&1 || { echo "❌ python3 requis pour fusionner le YAML."; exit 1; }
[ -d "$SKILLS_DIR" ] || { echo "❌ Dossier introuvable : $SKILLS_DIR"; exit 1; }

for PROFIL in headless web; do
    PATCH_FILE="$HOME/.dsh/profiles/$PROFIL/cordis.patch.yml"

    if [ ! -f "$PATCH_FILE" ]; then
        echo "⚠️  $PATCH_FILE introuvable — le profil '$PROFIL' a-t-il déjà été lancé une fois ?"
        echo "   (un profil n'existe qu'après son premier lancement, ex. 'dsh --profile $PROFIL --help'). Ignoré."
        continue
    fi

    # Le format de ce fichier autorise explicitement des expressions
    # `!!js` (vu dans son propre commentaire d'en-tête, qui mentionne
    # justement cette possibilité sans forcément l'utiliser) — PyYAML ne
    # sait pas les relire/réécrire sans les corrompre. On refuse de
    # toucher au fichier plutôt que de deviner comment les préserver.
    # Les lignes de commentaire sont exclues de cette recherche : sinon
    # le commentaire d'en-tête lui-même (qui PARLE de `!!js`) déclenche un
    # faux positif systématique — vérifié en pratique avant ce correctif.
    if grep -v '^[[:space:]]*#' "$PATCH_FILE" | grep -q '!!js'; then
        echo "❌ $PATCH_FILE contient une expression '!!js' — fusion automatique refusée pour ne pas la corrompre."
        echo "   Ajoute à la main l'entrée suivante dans ce fichier :"
        echo "   - id: skill-filesystem"
        echo "     name: \"@deepseek-ai/dsh-skill-filesystem\""
        echo "     config:"
        echo "       customSkillDirs:"
        echo "         - $SKILLS_DIR"
        continue
    fi

    echo "📁 Déclaration de $SKILLS_DIR comme customSkillDirs pour le profil '$PROFIL'..."
    python3 - "$PATCH_FILE" "$SKILLS_DIR" << 'PYEOF'
import sys
import yaml

patch_path, skills_dir = sys.argv[1], sys.argv[2]

with open(patch_path) as f:
    texte_brut = f.read()

# Préserve le commentaire d'en-tête auto-généré par dsh (lignes '#' et
# vides en tête de fichier) — un aller-retour yaml.safe_load/safe_dump
# les supprimerait sinon, PyYAML ne conservant pas les commentaires.
lignes = texte_brut.splitlines(keepends=True)
i = 0
while i < len(lignes) and (lignes[i].startswith('#') or lignes[i].strip() == ''):
    i += 1
entete = ''.join(lignes[:i])

patch = yaml.safe_load(''.join(lignes[i:])) or []
if not isinstance(patch, list):
    print(f"❌ {patch_path} : format inattendu (pas une liste au niveau racine), fusion refusée.", file=sys.stderr)
    sys.exit(1)

entree = next((e for e in patch if isinstance(e, dict) and e.get("id") == "skill-filesystem"), None)
if entree is None:
    entree = {"id": "skill-filesystem", "name": "@deepseek-ai/dsh-skill-filesystem", "config": {}}
    patch.append(entree)
entree.setdefault("config", {})
# REMPLACE (pas d'ajout) : un seul checkout actif à la fois, voir
# commentaire en tête de ce script (round 9 — ancien chemin resté en
# plus du nouveau après un reclonage, dsh servait le contenu périmé).
anciens = entree["config"].get("customSkillDirs", [])
if anciens and anciens != [skills_dir]:
    print(f"ℹ️  Anciens chemins retirés de customSkillDirs : {[d for d in anciens if d != skills_dir]}")
entree["config"]["customSkillDirs"] = [skills_dir]

with open(patch_path, "w") as f:
    f.write(entete)
    yaml.safe_dump(patch, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

print(f"✅ {patch_path} mis à jour — customSkillDirs : [{skills_dir}]")
PYEOF
done

echo ""
echo "Vérifie avec :"
echo "  dsh --profile headless \"Liste les skills que tu as à disposition.\""
echo "Les skills de ce dépôt (skill-ameliorateur-systeme, skill-decision-rapide, ...)"
echo "devraient apparaître, en plus ou à la place des ID numériques internes."
