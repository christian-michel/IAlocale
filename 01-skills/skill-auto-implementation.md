---
name: auto-implementation
description: "Documente comment le système s'auto-itère et s'auto-implémente : qui propose, qui applique, quel garde-fou, et ce qui déclenche un cycle. À consulter avant de lancer ou de modifier ce mécanisme."
---

# Consignes — auto-itération et auto-implémentation

Ce skill ferme une boucle qui restait ouverte : `skill-ameliorateur-systeme`
(distinct de `skill-ameliorateur`, qui corrige une réponse ponctuelle —
voir sa description) proposait des modifications, mais rien ne les
appliquait jamais. Depuis
`04-scripts/auto-implementer.js`, le système peut réellement modifier ses
propres skills et workflows — de façon bornée, vérifiée, et réversible.

## La chaîne complète

```
échec / demande / cycle périodique
        │
        ▼
skill-apprendre-des-echecs (si déclenché par un échec)
        │
        ▼
consulter 06-data/personnalite/valeurs.md
        │
        ▼
skill-ameliorateur-systeme  ──▶  propose (JSON, voir son format de sortie)
        │
        ▼
04-scripts/auto-implementer.js --proposition-file ...
        │
        ├─ branche git dédiée (auto-amelioration/<horodatage>)
        ├─ applique les fichiers (SKILLS et WORKFLOWS uniquement)
        ├─ commit
        ├─ node 04-scripts/valider-skills-workflows.js   ◄── le verdict
        │
        ├── code 0 → fusion --no-ff dans la branche d'origine, branche supprimée
        └── code ≠0 → branche conservée pour relecture humaine, rien fusionné
```

## Périmètre — décision explicite, pas une convention

Seuls `01-skills/*.md` et `03-workflows/*.json` peuvent être modifiés
automatiquement. `04-scripts/auto-implementer.js` refuse — dans le code,
pas seulement dans le prompt — tout chemin hors de ces deux dossiers, y
compris une tentative de traversée de chemin (`../`). Les scripts
(`04-scripts/`) et les configs (`05-configs/`) ne sont jamais touchés
automatiquement : un script cassé peut désactiver silencieusement le
logging ou la détection d'erreurs elle-même, c'est un risque d'une autre
nature qu'un skill ou un workflow mal formé (qui échoue bruyamment à la
validation).

## Le garde-fou en détail

- **Arbre de travail propre exigé avant de démarrer** — sinon le travail
  en cours de l'utilisateur serait embarqué dans le commit d'auto-
  amélioration, ou perdu au changement de branche. (`.gitignore` existe
  précisément pour que les fichiers générés — logs, index RAG, mémoire —
  ne déclenchent jamais ce refus à tort.)
- **Vérification déterministe** (boucle 04, voir
  `skill-boucles-agentiques.md`) : `valider-skills-workflows.js` contrôle
  la syntaxe (frontmatter YAML valide avec `name`/`description`, JSON de
  workflow valide avec `name`/`steps`) — jamais la pertinence du contenu,
  ça reste au jugement du modèle.
- **Jamais de push** : tout reste en local. Partager le résultat (push,
  pull request) est une décision humaine séparée, délibérée.
- **Échec = branche conservée, pas supprimée** : `auto-amelioration/<horodatage>`
  reste consultable avec `git log <branche>` / `git diff master...<branche>`
  pour comprendre ce qui a été tenté et pourquoi ça n'a pas suffi.

## Les trois déclencheurs

1. **Sur demande explicite** : lance le workflow
   `03-workflows/auto-amelioration.workflow.json` directement.
2. **Après un échec significatif** : `controle-qualite.workflow.json`
   enchaîne déjà `skill-apprendre-des-echecs` quand une réponse est
   invalidée ou qu'un test échoue ; il enchaîne maintenant aussi le
   workflow `auto-amelioration` à la suite, avec la leçon tout juste
   écrite comme contexte.
3. **Périodiquement** : via `boucle-surveillance.sh`, qui ne fournit que
   le déclenchement régulier (ce n'est PAS un critère d'arrêt, voir
   `skill-boucles-agentiques.md`) — le critère réel reste la vérification
   déterministe à l'intérieur du cycle lui-même. Exemple, une fois par
   jour :
   ```bash
   ./04-scripts/boucle-surveillance.sh \
     "dsh --profile headless 'lance le workflow auto-amelioration'" \
     86400 auto-amelioration-periodique
   ```

## Ce que ça veut dire pour la continuité multi-LLM

Rien dans cette chaîne n'est spécifique à un modèle : les skills et
workflows sont du texte/JSON lu par n'importe quel LLM configuré (voir
`05-configs/modeles.yaml`), `auto-implementer.js` et
`valider-skills-workflows.js` sont du code déterministe qui ne dépend
d'aucun modèle. Change de modèle avec `basculer-modele.sh`, le mécanisme
d'auto-amélioration continue de fonctionner à l'identique — seule la
qualité des propositions de `skill-ameliorateur-systeme` varie avec le
modèle utilisé.

## Règle d'or

Une auto-modification qui fusionne n'est pas forcément une bonne
auto-modification — seulement une qui n'a rien cassé de visible
syntaxiquement. `skill-apprendre-des-echecs` doit continuer à surveiller
les conséquences d'une fusion dans les sessions suivantes : si une
"amélioration" auto-implémentée est à l'origine d'erreurs nouvelles, ça
devient une leçon à son tour, qui peut mener à proposer de la défaire.
