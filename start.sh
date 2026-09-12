#!/bin/bash
set -uo pipefail
cd "$(dirname "$0")"
export HARNESS_HOME="$(pwd)"

echo "🚀 Lancement de l'assistant IA local..."
mkdir -p logs

echo "🔒 Audit de sécurité..."
./04-scripts/security-check.sh

echo "👀 Démarrage du watcher de connaissances..."
nohup node ./04-scripts/watch-knowledge-base.js >> ./logs/watcher.log 2>&1 &
echo $! > ./04-scripts/watcher.pid
sleep 1

echo "🔄 Démarrage de dsh..."
if ! command -v dsh >/dev/null 2>&1; then
    echo "❌ 'dsh' introuvable. Lance d'abord : ./04-scripts/install-plugins.sh"
elif ! curl -s -o /dev/null http://127.0.0.1:11434/api/tags 2>/dev/null; then
    echo "⚠️  Ollama ne répond pas sur 11434. dsh va démarrer mais utilisera l'API cloud DeepSeek"
    echo "    tant que le modèle local n'est pas configuré et joignable."
    echo "    Lance d'abord : brew services start ollama && ./04-scripts/setup-local-model.sh"
    dsh --profile web
else
    dsh --profile web
fi

if [ -f ./04-scripts/watcher.pid ]; then
    PID=$(cat ./04-scripts/watcher.pid)
    echo "🛑 Arrêt du watcher (PID: $PID)..."
    kill "$PID" 2>/dev/null || true
    rm -f ./04-scripts/watcher.pid
fi

echo "👋 Système arrêté."
