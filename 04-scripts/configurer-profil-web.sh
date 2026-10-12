#!/bin/bash
# configurer-profil-web.sh — applique les réglages du projet aux PRÉRÉGLAGES
# D'AGENT du profil web (ou du profil passé en argument).
#
# Pourquoi ce script existe (voir documentation/historique-du-projet.md,
# round 26) : le profil web ne construit pas ses conversations à partir
# des plugins racine, comme headless, mais à partir de préréglages d'agent
# (standard, ptc, minimal, cordis) qui ont chacun leur propre liste de
# plugins. Les réglages racine des autres scripts (skills du dépôt,
# tool-web et tool-goal désactivés, plugins de 07-plugins/) ne s'y
# appliquaient donc pas : dans le navigateur, aucun skill du dépôt, la
# recherche web cloud et les outils d'objectif actifs, pas de RAG local.
#
# dsh ne permet ni d'insérer dans un préréglage ("not a group"), ni d'en
# cibler un plugin enfant ("not found") : seule la réécriture complète est
# possible. Le script :
#  1. lit les préréglages par défaut de l'installation de dsh
#     (--dump-default-config — relance-le après une mise à jour de dsh) ;
#  2. y applique les réglages du projet ;
#  3. les écrit dans presets-ialocale.yml, à côté du patch du profil
#     (fichier régénéré en entier à chaque fois, jamais fusionné) ;
#  4. dans cordis.patch.yml : désactive les préréglages d'origine et
#     inclut ce fichier (entrée cordis:include) — le patch principal reste
#     sans expression !!js, que les autres scripts refusent de fusionner.
#
# Prérequis : ./04-scripts/installer-plugins-locaux.sh <profil> (installe
# les paquets des plugins locaux dans le profil).
set -euo pipefail
cd "$(dirname "$0")/.."
RACINE="$(pwd)"
PROFIL="${1:-web}"
DOSSIER_PROFIL="$HOME/.dsh/profiles/$PROFIL"
PATCH_FILE="$DOSSIER_PROFIL/cordis.patch.yml"
PRESETS_FILE="$DOSSIER_PROFIL/presets-ialocale.yml"

command -v python3 >/dev/null 2>&1 || { echo "❌ python3 requis."; exit 1; }
python3 -c "import yaml" >/dev/null 2>&1 || { echo "❌ Module Python 'yaml' manquant. Installe-le avec : pip3 install pyyaml --break-system-packages"; exit 1; }
[ -f "$PATCH_FILE" ] || { echo "❌ $PATCH_FILE introuvable — le profil '$PROFIL' a-t-il déjà été lancé une fois ?"; exit 1; }
if grep -v '^[[:space:]]*#' "$PATCH_FILE" | grep -q '!!js'; then
    echo "❌ $PATCH_FILE contient une expression '!!js' — fusion automatique refusée pour ne pas la corrompre."
    exit 1
fi

DEFAUT=$(mktemp)
trap 'rm -f "$DEFAUT"' EXIT
dsh --profile "$PROFIL" --dump-default-config > "$DEFAUT" 2>/dev/null \
    || { echo "❌ dsh --profile $PROFIL --dump-default-config a échoué."; exit 1; }
# Paquet dont le chemin est calculé par une expression !!js dans le
# préréglage du mode créateur : résolu ici, depuis l'installation de dsh,
# car un fichier inclus a sa propre base de résolution de modules.
DSH_BIN="$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$(command -v dsh)")"
SKILLS_PRESET="$(node -e "const p=require('path');const r=require('module').createRequire(process.argv[1]);console.log(p.join(p.dirname(r.resolve('@deepseek-ai/dsh-agent-preset/package.json')),'skills'))" "$DSH_BIN")"
MODELE=$(dsh --profile "$PROFIL" --dump-config 2>/dev/null | grep -A4 "id: agent-default-model" | awk '/model:/ {print $2; exit}')
[ -n "$MODELE" ] || MODELE="qwen3-coder:30b-a3b-q4_K_M"

echo "🧩 Réécriture des préréglages d'agent du profil '$PROFIL'..."
python3 - "$DEFAUT" "$PATCH_FILE" "$PRESETS_FILE" "$RACINE" "$SKILLS_PRESET" "$MODELE" << 'PYEOF'
import copy
import sys
import yaml

defaut_path, patch_path, presets_path, racine, skills_preset, modele = sys.argv[1:]

class Js(str):
    """Expression !!js de Cordis, conservée telle quelle."""

TAG = 'tag:yaml.org,2002:js'

class Chargeur(yaml.SafeLoader):
    pass

class Ecrivain(yaml.SafeDumper):
    pass

Chargeur.add_constructor(TAG, lambda l, n: Js(l.construct_scalar(n)))
Ecrivain.add_representer(Js, lambda d, v: d.represent_scalar(TAG, str(v)))

def evaluer(valeur):
    """Évalue les seules expressions dont le résultat est certain ici."""
    if not isinstance(valeur, Js):
        return valeur
    e = ' '.join(valeur.split())
    if e == "process.platform === 'win32'":
        return False
    if e == "process.platform !== 'win32'":
        return True
    if "dsh-agent-preset/package.json" in e and "'skills'" in e:
        return skills_preset
    return valeur

PLUGINS_LOCAUX = [
    {"id": "workflows-projet", "name": "dsh-workflows-projet",
     "config": {"dossier": f"{racine}/03-workflows", "dossierSkills": f"{racine}/01-skills"}},
    {"id": "contexte-local", "name": "dsh-contexte-local", "config": {"modele": modele}},
]

def ajuster(entrees):
    """Applique les réglages du projet à une liste d'entrées (récursif sur les groupes)."""
    for e in entrees:
        if not isinstance(e, dict):
            continue
        if 'disabled' in e:
            e['disabled'] = evaluer(e['disabled'])
        if e.get('name') == 'cordis:group' and isinstance(e.get('config'), list):
            ajuster(e['config'])
        if e.get('id') in ('tool-web', 'tool-goal'):
            e['disabled'] = True
        if e.get('id') == 'skill-filesystem':
            conf = e.get('config') or {}
            dirs = [evaluer(d) for d in conf.get('customSkillDirs', [])]
            if f"{racine}/01-skills" not in dirs:
                dirs.append(f"{racine}/01-skills")
            conf['customSkillDirs'] = dirs
            e['config'] = conf
    return entrees

with open(defaut_path) as f:
    defaut = yaml.load(f, Loader=Chargeur) or []

presets = []
for e in defaut:
    if isinstance(e, dict) and e.get('name') == '@deepseek-ai/dsh-agent-preset':
        p = copy.deepcopy(e)
        p['id'] = f"{e['id']}-ialocale"
        conf = p['config']
        conf['plugins'] = ajuster(conf.get('plugins', [])) + copy.deepcopy(PLUGINS_LOCAUX)
        presets.append((e['id'], p))
if not presets:
    print("❌ Aucun préréglage d'agent trouvé dans la configuration par défaut — rien à faire.", file=sys.stderr)
    sys.exit(1)

with open(presets_path, 'w') as f:
    f.write("# Généré par 04-scripts/configurer-profil-web.sh — ne pas éditer à la main,\n"
            "# relancer le script (après une mise à jour de dsh notamment).\n")
    yaml.dump([p for _, p in presets], f, Dumper=Ecrivain, default_flow_style=False, sort_keys=False, allow_unicode=True, width=1000)

with open(patch_path) as f:
    lignes = f.read().splitlines(keepends=True)
i = 0
while i < len(lignes) and (lignes[i].startswith('#') or lignes[i].strip() == ''):
    i += 1
entete = ''.join(lignes[:i])
patch = yaml.safe_load(''.join(lignes[i:])) or []

ids_origine = {pid for pid, _ in presets}
# Les plugins locaux vivent dans les préréglages : déclarés aussi à la
# racine (par installer-plugins-locaux.sh), workflows-projet y attendait
# un service absent ("pending (waiting for service: workflowEngine)").
ids_retires = {'presets-ialocale'} | {p['id'] for p in PLUGINS_LOCAUX}
patch = [e for e in patch if not (isinstance(e, dict) and (e.get('id') in ids_origine
         or any(isinstance(x, dict) and x.get('id') in ids_retires for x in e.get('insert', []))))]
for pid in sorted(ids_origine):
    patch.append({'id': pid, 'disabled': True})
patch.append({'insert': [{'id': 'presets-ialocale', 'name': 'cordis:include', 'config': {'path': 'presets-ialocale.yml'}}]})

with open(patch_path, 'w') as f:
    f.write(entete)
    yaml.safe_dump(patch, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

print(f"✅ {len(presets)} préréglage(s) réécrit(s) dans {presets_path} : " + ', '.join(p['config']['id'] for _, p in presets))
print(f"✅ {patch_path} : préréglages d'origine désactivés, presets-ialocale.yml inclus.")
PYEOF

echo ""
echo "Vérifie avec :"
echo "  dsh --profile $PROFIL --dump-config 2>&1 | grep -E '^dsh:|id: preset-'"
echo "Puis relance l'interface web pour que les nouvelles conversations en profitent."
