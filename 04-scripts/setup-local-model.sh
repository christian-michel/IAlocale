#!/bin/bash
# Configure dsh pour tourner en local sur Ollama, sans toucher à l'API
# cloud DeepSeek. Idempotent : peut être relancé sans casser une config
# existante (les clés qu'il gère sont fusionnées, pas écrasées en bloc).
set -euo pipefail
cd "$(dirname "$0")/.."

MODEL="${1:-qwen3-coder:30b-a3b-q4_K_M}"
DSH_SETTINGS="$HOME/.dsh/settings.yaml"
CONTEXT_LENGTH=32768

echo "🦙 Configuration du modèle local : $MODEL"

command -v ollama >/dev/null 2>&1 || { echo "❌ Ollama n'est pas installé. brew install ollama"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "❌ python3 requis pour fusionner le YAML."; exit 1; }

# Redémarre le vrai serveur Ollama en cours d'exécution, quel que soit son
# mode d'installation — trouvé en pratique (voir README, "Validation sur
# machine réelle", round 5) : `brew services restart ollama` est un no-op
# SILENCIEUX si Ollama tourne via l'app officielle (Ollama.app) plutôt que
# comme formule brew (cas confirmé sur un Mac Mini réel : `ollama` présent
# comme binaire CLI, mais le vrai serveur est lancé par Ollama.app). Un
# no-op silencieux ici a fait tourner ce script "avec succès" pendant
# plusieurs rounds sans jamais réellement appliquer OLLAMA_CONTEXT_LENGTH
# au serveur réel — jamais plus d'erreur avalée par `|| true` sans message.
redemarrer_ollama() {
    if brew list ollama >/dev/null 2>&1; then
        echo "🔁 Redémarrage via brew services (formule 'ollama' installée ici)..."
        brew services restart ollama
    elif [ -d "/Applications/Ollama.app" ]; then
        echo "🔁 Ollama tourne via Ollama.app (pas une formule brew sur cette machine) — redémarrage de l'app..."
        pkill -x Ollama 2>/dev/null || true
        pkill -f "ollama serve" 2>/dev/null || true
        sleep 2
        open -a Ollama
    elif pgrep -f "ollama serve" >/dev/null 2>&1; then
        echo "🔁 Redémarrage du processus 'ollama serve' lancé manuellement..."
        pkill -f "ollama serve"
        sleep 1
        nohup ollama serve >/tmp/ollama-serve.log 2>&1 &
    else
        echo "⚠️  Aucun serveur Ollama détecté en cours d'exécution (ni brew, ni Ollama.app, ni 'ollama serve' manuel)."
        echo "   Démarre-le manuellement, puis relance ce script."
        return 1
    fi
    sleep 3
}

# 1) Mémoire GPU (Apple Silicon) : macOS plafonne par défaut la part de
#    mémoire unifiée que Metal a le droit de verrouiller pour le GPU
#    (iogpu.wired_limit_mb, souvent ~75% de la RAM totale quand il vaut 0 =
#    automatique). Trouvé en pratique sur un Mac Mini 24 Go : un modèle de
#    ~19 Go peut dépasser ce plafond automatique et planter à CHAQUE appel
#    avec "Insufficient Memory (kIOGPUCommandBufferCallbackErrorOutOfMemory)"
#    — y compris sur un prompt de 13 tokens, le poids du modèle seul suffit
#    à dépasser la limite. Pas spécifique à ce modèle : touche tout modèle
#    dont la taille approche le plafond automatique sur cette machine.
if [ "$(uname)" = "Darwin" ]; then
    RAM_TOTALE_MO=$(( $(sysctl -n hw.memsize) / 1024 / 1024 ))
    LIMITE_GPU_MO=$(( RAM_TOTALE_MO - 2048 ))   # garde 2 Go de marge pour macOS
    LIMITE_ACTUELLE=$(sysctl -n iogpu.wired_limit_mb 2>/dev/null || echo 0)
    echo "🎮 Limite mémoire GPU (iogpu.wired_limit_mb) actuelle : ${LIMITE_ACTUELLE} Mo (0 = automatique, ~75% de la RAM totale)."
    echo "   Relèvement à ${LIMITE_GPU_MO} Mo (RAM totale ${RAM_TOTALE_MO} Mo - 2 Go de marge)..."
    if sudo sysctl iogpu.wired_limit_mb="$LIMITE_GPU_MO"; then
        echo "   ⚠️  Ce réglage ne survit PAS à un redémarrage de la machine — à refaire après chaque reboot (relance ce script, ou voir README pour le rendre permanent via un LaunchDaemon)."
    else
        echo "   ⚠️  Échec du relèvement (sudo requis, ou 'iogpu.wired_limit_mb' absent sur cette version de macOS) — si des plantages 'Insufficient Memory' apparaissent plus tard, voir README."
    fi
fi

# 2) Contexte : Ollama choisit sa fenêtre de contexte par défaut selon un
#    palier mémoire qu'on ne veut pas laisser au hasard (voir README,
#    section "Piège du contexte"). On le fixe explicitement, puis on
#    redémarre le VRAI serveur (fonction ci-dessus) pour que ça s'applique
#    réellement — un simple `export`/`launchctl setenv` ne touche jamais un
#    processus déjà démarré avant.
echo "📏 Configuration d'OLLAMA_CONTEXT_LENGTH=$CONTEXT_LENGTH..."
if [ "$(uname)" = "Darwin" ]; then
    launchctl setenv OLLAMA_CONTEXT_LENGTH "$CONTEXT_LENGTH" 2>/dev/null || true
fi
export OLLAMA_CONTEXT_LENGTH="$CONTEXT_LENGTH"
redemarrer_ollama

# 2) Le modèle doit être présent localement.
echo "📥 Téléchargement de $MODEL si nécessaire..."
ollama pull "$MODEL"

# 3) Vérifie que l'id annoncé par Ollama correspond EXACTEMENT à ce qu'on
#    va écrire dans settings.yaml (piège documenté : un id qui ne
#    correspond pas caractère pour caractère renvoie un 404 depuis dsh).
echo "🔍 Vérification de l'id exact auprès du serveur Ollama..."
sleep 1
REAL_ID=$(curl -s http://127.0.0.1:11434/v1/models 2>/dev/null | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    ids = [m['id'] for m in data.get('data', [])]
    target = '$MODEL'
    print(target if target in ids else (ids[0] if ids else ''))
except Exception:
    print('')
")
if [ -z "$REAL_ID" ]; then
    echo "⚠️  Impossible de confirmer l'id du modèle auprès d'Ollama (est-il bien démarré ?). On continue avec '$MODEL' tel quel — vérifie manuellement avec :"
    echo "    curl -s http://127.0.0.1:11434/v1/models | jq -r '.data[].id'"
    REAL_ID="$MODEL"
elif [ "$REAL_ID" != "$MODEL" ]; then
    echo "⚠️  L'id demandé ('$MODEL') ne correspond pas exactement à ce que sert Ollama ('$REAL_ID'). Utilisation de '$REAL_ID'."
fi

# 4) Fusion dans ~/.dsh/settings.yaml (créé s'il n'existe pas). On ne
#    touche qu'aux clés qu'on gère (llm-pi-ai.providers.ollama et
#    agent-default-model), le reste du fichier est préservé.
echo "📝 Mise à jour de $DSH_SETTINGS..."
mkdir -p "$(dirname "$DSH_SETTINGS")"
python3 - "$DSH_SETTINGS" "$REAL_ID" "$CONTEXT_LENGTH" << 'PYEOF'
import sys, os
try:
    import yaml
except ImportError:
    print("❌ PyYAML manquant. Installe-le avec : pip3 install pyyaml --break-system-packages", file=sys.stderr)
    sys.exit(1)

settings_path, model_id, context_length = sys.argv[1], sys.argv[2], int(sys.argv[3])

settings = {}
if os.path.exists(settings_path):
    with open(settings_path) as f:
        settings = yaml.safe_load(f) or {}

settings.setdefault("llm-pi-ai", {}).setdefault("providers", {})["ollama"] = {
    "displayName": "Ollama (local)",
    "apiKeyEnv": "OLLAMA_API_KEY",
    "api": "openai-completions",
    "baseURL": "http://127.0.0.1:11434/v1",
    "compat": {
        "supportsDeveloperRole": False,
        "maxTokensField": "max_tokens",
    },
    "models": [
        {
            "id": model_id,
            "name": f"{model_id} (local)",
            "contextWindow": context_length,
            "maxTokens": 8192,
        }
    ],
}
settings["agent-default-model"] = {"provider": "ollama", "model": model_id}

with open(settings_path, "w") as f:
    yaml.safe_dump(settings, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

print(f"✅ {settings_path} mis à jour (provider 'ollama', modèle '{model_id}').")
PYEOF

# 5) Credential factice : dsh exige QU'UNE variable soit référencée, même
#    si Ollama n'exige pas de vraie clé (piège documenté : sans ça, le
#    premier lancement échoue avec "No API key for provider: ollama").
echo "🔑 Configuration de la variable d'environnement OLLAMA_API_KEY (factice)..."
SHELL_RC="$HOME/.zshrc"
[ "$SHELL" = "/bin/bash" ] && SHELL_RC="$HOME/.bash_profile"
if ! grep -q "OLLAMA_API_KEY" "$SHELL_RC" 2>/dev/null; then
    echo 'export OLLAMA_API_KEY=ollama-local-no-key-needed' >> "$SHELL_RC"
    echo "✅ Ajouté à $SHELL_RC — ouvre un nouveau terminal (ou 'source $SHELL_RC') avant de lancer dsh."
else
    echo "✅ OLLAMA_API_KEY déjà présent dans $SHELL_RC."
fi
export OLLAMA_API_KEY=ollama-local-no-key-needed

echo ""
echo "✅ Configuration locale terminée."
echo "   Vérifie le contexte réellement servi avec : ollama run $REAL_ID 'hi' >/dev/null && ollama ps"
echo "   Puis lance : dsh --profile headless 'dis bonjour'"
