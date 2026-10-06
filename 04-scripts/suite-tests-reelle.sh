#!/bin/bash
# suite-tests-reelle.sh — protocole de validation complète contre une
# vraie installation (dsh + Ollama réellement configurés).
#
# AUCUNE partie de ce script n'a été exécutée dans mon environnement de
# développement : ni dsh, ni Ollama n'y sont disponibles (voir README,
# section "Non vérifiable"). C'est précisément pour ça qu'il existe —
# lance-le sur ton Mac Mini, puis partage le contenu du dossier de
# résultats pour que l'analyse de cohérence/pertinence/causes puisse se
# faire sur de vraies données, pas des suppositions.
#
# Ce script couvre :
#   1. Validation syntaxique déterministe (skills/workflows)
#   2. decision-rapide.js sur 3 domaines (code, juridique, comptable),
#      contre ton vrai modèle configuré
#   3. Deux tests techniques de bout en bout via dsh (page HTML5, thème
#      WordPress "test") — vérifie si le pipeline complet (boucle
#      agentique -> skill-controleur-qualite -> skill-controleur-de-
#      controle -> identifier-meilleur/decision-rapide) s'engage
#      réellement, ce qui n'a jamais pu être confirmé depuis mon
#      environnement
#   4. Comptage des traces de chaque composant dans les logs structurés
#   5. Auto-implementer.js : un cas qui doit fusionner, un cas qui doit
#      être refusé — sur un fichier clairement jetable, sans risque pour
#      le reste du dépôt
#
# Usage : ./04-scripts/suite-tests-reelle.sh
# Durée attendue : plusieurs minutes (les étapes 3a/3b dépendent
# entièrement de la vitesse de ton modèle local).
set -uo pipefail
cd "$(dirname "$0")/.."
export HARNESS_HOME="$(pwd)"

HORODATAGE=$(date -u +"%Y%m%dT%H%M%SZ")
DOSSIER="logs/validation-$HORODATAGE"
mkdir -p "$DOSSIER"

journal() { echo "$1" | tee -a "$DOSSIER/resume.txt"; }

journal "=== Protocole de validation — $HORODATAGE ==="
journal ""

# --- 0. Prérequis ---
journal "--- 0. Prérequis ---"
if ! command -v dsh >/dev/null 2>&1; then
    journal "ÉCHEC : dsh introuvable. Lance d'abord ./04-scripts/install-plugins.sh"
    exit 1
fi
if ! curl -s -o /dev/null http://127.0.0.1:11434/api/tags; then
    journal "ÉCHEC : Ollama ne répond pas sur 11434. Lance : brew services start ollama (formule brew) ou ouvre l'app Ollama.app (voir README, 'Validation sur machine réelle', round 5 — brew ne gère pas forcément le vrai serveur)."
    exit 1
fi
journal "dsh et Ollama répondent. Modèles disponibles :"
ollama list | tee -a "$DOSSIER/resume.txt"
journal ""

# Modèle à passer explicitement à decision-rapide.js : ne pas dépendre de
# ~/.dsh/settings.yaml (agent-default-model) pour CE script — si le modèle
# a été configuré autrement (ex. page "Models" de l'UI web de dsh plutôt
# que setup-local-model.sh/basculer-modele.sh), ce fichier peut ne jamais
# avoir été écrit, et decision-rapide.js échouerait alors systématiquement
# avec "Aucun modèle déclaré". On prend simplement le premier modèle que
# Ollama liste réellement.
MODELE_DETECTE=$(ollama list | awk 'NR==2 {print $1}')
if [ -n "$MODELE_DETECTE" ]; then
    journal "Modèle utilisé pour la section 2 (détecté via 'ollama list') : $MODELE_DETECTE"
else
    journal "ATTENTION : aucun modèle détecté via 'ollama list' — la section 2 va probablement échouer."
fi
journal ""

# --- 1. Validation syntaxique déterministe ---
journal "--- 1. Validation syntaxique skills/workflows ---"
node 04-scripts/valider-skills-workflows.js | tee "$DOSSIER/1-validation-syntaxe.json"
journal ""

# --- 2. decision-rapide.js sur 3 domaines, vrai Ollama ---
journal "--- 2. Décision rapide sur 3 domaines (vrai modèle local) ---"

journal "  2a. Code"
node 04-scripts/decision-rapide.js \
    --question "Quel index de candidat a le meilleur score global pour une validation email" \
    --type choix --choix "0,1,2" --modele "$MODELE_DETECTE" \
    --contexte "0: regex simple score 6.5 ; 1: regex et verification MX du domaine score 9.2 ; 2: regex et liste de domaines jetables score 7.8" \
    --seuil-confiance 0.75 --composant test-reel-code \
    2>&1 | tee "$DOSSIER/2a-decision-code.json"

journal "  2b. Juridique"
node 04-scripts/decision-rapide.js \
    --question "Quel index de candidat a le meilleur score global pour une clause de resiliation" \
    --type choix --choix "0,1" --modele "$MODELE_DETECTE" \
    --contexte "0: preavis 30 jours ecrit score 7.1 ; 1: preavis 30 jours ecrit et clause de force majeure score 7.4" \
    --seuil-confiance 0.75 --composant test-reel-juridique \
    2>&1 | tee "$DOSSIER/2b-decision-juridique.json"

journal "  2c. Comptable"
node 04-scripts/decision-rapide.js \
    --question "Quel index de candidat a le meilleur score global pour une methode d amortissement" \
    --type choix --choix "0,1,2" --avec-justification --modele "$MODELE_DETECTE" \
    --contexte "0: lineaire score 5.0 ; 1: degressif score 8.8 ; 2: lineaire accelere score 6.2" \
    --seuil-confiance 0.75 --composant test-reel-comptable \
    2>&1 | tee "$DOSSIER/2c-decision-comptable.json"
journal ""

# --- 3. Deux tests techniques de bout en bout via dsh ---
journal "--- 3. Tests techniques via dsh (pipeline complet) ---"
journal "Chaque appel peut prendre plusieurs minutes selon le modèle."

# dsh --profile headless --dump-config confirme : approval.policy vaut
# "ask" tant que DSH_PERMISSION_MODE != danger-full-access — or il n'y a
# personne pour répondre "oui" en headless. Débloquer ça affaiblit aussi
# le confinement du sandbox (danger-full-access, pas juste "n'attends
# plus d'approbation") — décision volontairement laissée à qui lance ce
# script, jamais activée par défaut.
if [ "${AUTORISER_ECRITURE_HEADLESS:-}" = "1" ]; then
    journal "AUTORISER_ECRITURE_HEADLESS=1 : DSH_PERMISSION_MODE=danger-full-access pour les tests 3a/3b (sandbox désactivé, pas seulement l'approbation)."
    export DSH_PERMISSION_MODE=danger-full-access
else
    journal "AUTORISER_ECRITURE_HEADLESS non défini : les écritures de fichiers par dsh en headless resteront probablement bloquées (approval.policy=ask, personne pour répondre)."
    journal "Pour autoriser : AUTORISER_ECRITURE_HEADLESS=1 ./04-scripts/suite-tests-reelle.sh (voir skill-decision-rapide pour la mise en garde)."
fi
journal ""

journal "  3a. Page HTML5"
mkdir -p "$DOSSIER/livrables"
dsh --profile headless "Crée une page HTML5 complète et valide avec un titre, un paragraphe de description et un bouton. Sauvegarde-la dans $DOSSIER/livrables/test-html5.html. Avant de considérer la tâche terminée, fais vérifier le résultat par le contrôle qualité." \
    2>&1 | tee "$DOSSIER/3a-html5-sortie.txt"

journal "  3b. Thème WordPress nommé test"
dsh --profile headless "Crée un thème WordPress minimal nommé test (style.css avec l'en-tête Theme Name: test, index.php, functions.php). Sauvegarde les fichiers dans $DOSSIER/livrables/theme-test/. Avant de considérer la tâche terminée, fais vérifier le résultat par le contrôle qualité." \
    2>&1 | tee "$DOSSIER/3b-wordpress-sortie.txt"
journal ""

# --- 4. Traces du pipeline dans les logs ---
journal "--- 4. Traces du pipeline dans les logs ---"
node 04-scripts/errors-cli.js list --n 150 > "$DOSSIER/4-logs-recents.json"
journal "Occurrences de chaque composant dans les 150 derniers événements du journal :"
for composant in decision-rapide controleur-de-controle controleur-qualite ameliorateur-systeme auto-implementer; do
    N=$(grep -o "\"component\":\"$composant\"" "$DOSSIER/4-logs-recents.json" 2>/dev/null | wc -l | tr -d ' ')
    journal "  $composant : $N occurrence(s)"
done
# ATTENTION, trouvé en pratique (round 7, voir README "Validation sur
# machine réelle") : decision-rapide et auto-implementer sont des
# SCRIPTS Node instrumentés avec dsh-logger.js — un 0 occurrence pour
# eux est un vrai signal d'absence d'engagement. controleur-de-controle
# et controleur-qualite sont des SKILLS (texte renvoyé par le tool
# "skill" de dsh, jamais exécuté comme script) — rien dans leur
# mécanisme n'écrit jamais ici, qu'ils aient été invoqués ou non. Un 0
# occurrence pour ces deux-là ne prouve RIEN sur leur engagement réel.
# Pour vérifier s'ils ont vraiment été invoqués, il faut relire le flux
# brut d'un appel dsh --json et chercher un tool_call avec
# "tool":"skill" et le bon "name" dans son "input" — pas ce journal.
journal "decision-rapide et auto-implementer : un 0 ici signale une vraie absence d'engagement."
journal "controleur-de-controle et controleur-qualite : ce sont des skills, pas des scripts —"
journal "rien n'écrit jamais ici pour eux, qu'ils aient tourné ou non. Pour vérifier leur"
journal "engagement réel, relis le flux d'un appel 'dsh --json' et cherche un tool_call"
journal "\"tool\":\"skill\" avec le bon nom dans \"input\"."
journal ""

# --- 5. Auto-implémentation : cas valide et cas invalide ---
journal "--- 5. Auto-implémentation (fichier de test jetable, sans risque) ---"

cat > "$DOSSIER/proposition-valide.json" << 'EOF'
{
  "modifications": [
    {
      "type": "modifier-skill",
      "skill": "01-skills/skill-test-validation-reelle.md",
      "nouvelle_version": "---\nname: test-validation-reelle\ndescription: \"Skill jetable créé par suite-tests-reelle.sh pour vérifier que l'auto-implémentation fonctionne réellement. Supprime-le une fois vérifié.\"\n---\n\nCe fichier ne sert à rien d'autre qu'à prouver qu'auto-implementer.js peut créer un fichier, le valider et le fusionner sur cette machine.\n",
      "justification": "Test de bout en bout du mécanisme d'auto-implémentation, sur un fichier jetable sans risque pour le reste du dépôt.",
      "alignement_valeurs": "Transparent : ce fichier s'auto-désigne comme jetable dès sa création."
    }
  ]
}
EOF

cat > "$DOSSIER/proposition-invalide.json" << 'EOF'
{
  "modifications": [
    {
      "type": "modifier-script",
      "script": "04-scripts/dsh-logger.js",
      "contenu": "ceci doit etre refuse avant toute ecriture",
      "justification": "Verifie que le perimetre skills/workflows est bien applique."
    }
  ]
}
EOF

journal "  5a. Proposition valide (doit fusionner)"
node 04-scripts/auto-implementer.js --proposition-file "$DOSSIER/proposition-valide.json" \
    2>&1 | tee "$DOSSIER/5a-auto-implementation-valide.json"

journal "  5b. Proposition invalide (doit être refusée avant toute écriture)"
node 04-scripts/auto-implementer.js --proposition-file "$DOSSIER/proposition-invalide.json" \
    2>&1 | tee "$DOSSIER/5b-auto-implementation-invalide.json"

journal ""
journal "=== Terminé ==="
journal "Résultats complets dans : $DOSSIER/"
journal ""
journal "Si le test 5a a fusionné le skill de test, retire-le avec :"
journal "  git rm 01-skills/skill-test-validation-reelle.md"
journal "  git commit -m \"Retire le skill de test\""
journal ""
journal "Envoie le contenu de $DOSSIER/ pour analyse de cohérence, de pertinence,"
journal "et pour identifier les causes de tout écart avec le résultat attendu."
