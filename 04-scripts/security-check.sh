#!/bin/bash
set -uo pipefail
cd "$(dirname "$0")/.."

echo "🔒 Vérification de la sécurité du système..."

echo "📦 Vérification de Docker..."
if command -v docker >/dev/null 2>&1; then
    if docker info 2>/dev/null | grep -q "Userns Mode: enabled"; then
        echo "✅ User namespace activé."
    else
        echo "⚠️  User namespace désactivé (recommandé pour l'isolation)."
    fi
else
    echo "⚠️  Docker n'est pas installé ou n'est pas dans le PATH."
fi

echo "🦙 Vérification d'Ollama..."
if command -v ollama >/dev/null 2>&1; then
    if curl -s -o /dev/null -w "" http://127.0.0.1:11434/api/tags 2>/dev/null; then
        echo "✅ Ollama répond sur le port 11434."
    else
        echo "⚠️  Ollama installé mais ne répond pas — lance 'brew services start ollama'."
    fi
else
    echo "⚠️  Ollama n'est pas installé."
fi

echo "📁 Vérification des permissions..."
if [ -d "06-data" ]; then
    find 06-data/ -type f -name "*.md" -exec chmod 600 {} \; 2>/dev/null
    echo "✅ Permissions des fichiers de connaissance restreintes."
fi

echo "🔑 Vérification des clés API..."
if [ -d "06-data" ] && grep -rIlE "API_KEY|SECRET|TOKEN" 06-data/ 2>/dev/null | grep -q .; then
    echo "⚠️  Des motifs de type clé API ont été trouvés dans 06-data/ !"
else
    echo "✅ Aucune clé API détectée dans la base de connaissances."
fi

echo "🌐 Vérification de dsh-browser (si configuré)..."
CONFIG_FILE="05-configs/profile-recherche-expert.yml"
if [ -f "$CONFIG_FILE" ]; then
    if grep -q "autoApprove: true" "$CONFIG_FILE"; then
        echo "⚠️  autoApprove est activé pour dsh-browser : l'agent naviguera sans confirmation humaine."
    else
        echo "✅ dsh-browser demande confirmation avant d'agir."
    fi
fi

echo "📝 Erreurs des dernières 24h (voir 04-scripts/errors-cli.js pour le détail) :"
if command -v node >/dev/null 2>&1 && [ -f "04-scripts/errors-cli.js" ]; then
    HARNESS_HOME="$(pwd)" node 04-scripts/errors-cli.js summary --hours 24 2>/dev/null \
        | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);console.log('   Total:', j.total, '| Silencieuses:', (j.par_niveau.SILENT_ERROR||0));}catch(e){console.log('   (log vide ou illisible)');}})"
fi

echo "✅ Audit de sécurité terminé."
