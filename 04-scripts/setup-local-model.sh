#!/bin/bash
# Configure dsh pour tourner en local sur Ollama, sans toucher à l'API
# cloud DeepSeek. Idempotent : peut être relancé sans casser une config
# existante (les clés qu'il gère sont fusionnées, pas écrasées en bloc).
set -euo pipefail
cd "$(dirname "$0")/.."

MODEL="${1:-qwen2.5-coder:7b}"
DSH_SETTINGS="$HOME/.dsh/settings.yaml"
CONTEXT_LENGTH=32768

echo "🦙 Configuration du modèle local : $MODEL"

command -v ollama >/dev/null 2>&1 || { echo "❌ Ollama n'est pas installé. brew install ollama"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "❌ python3 requis pour fusionner le YAML."; exit 1; }

# 1) Contexte : Ollama choisit sa fenêtre de contexte par défaut selon un
#    palier mémoire qu'on ne veut pas laisser au hasard (voir README,
#    section "Piège du contexte"). On le fixe explicitement.
echo "📏 Configuration d'OLLAMA_CONTEXT_LENGTH=$CONTEXT_LENGTH..."
if [ "$(uname)" = "Darwin" ]; then
    launchctl setenv OLLAMA_CONTEXT_LENGTH "$CONTEXT_LENGTH" 2>/dev/null || true
fi
export OLLAMA_CONTEXT_LENGTH="$CONTEXT_LENGTH"
brew services restart ollama >/dev/null 2>&1 || true
sleep 2

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
