---
name: journal-desaccords
description: "Documente le journal des désaccords entre decision-rapide.js et la comparaison délibérative — à consulter pour comprendre pourquoi/comment chaque cas non fiable est consigné, et comme première brique vers un éventuel fine-tuning de Laya."
---

# Consignes — journal des désaccords

Ce journal n'a qu'un but : accumuler, sans jamais en perdre une ligne, les
cas où `decision-rapide.js` (voir `skill-decision-rapide.md`) n'était pas
assez sûr de lui — matière première d'un futur fine-tuning de Laya,
pas un mécanisme de décision en lui-même.

## Pourquoi ça existe

`identifier-meilleur` (voir `systeme-auto-ameliorant-avec-controle.workflow.json`)
retombe sur une comparaison délibérative quand la décision rapide n'est
pas fiable. Avant ce journal, ce repli se produisait puis s'oubliait —
aucune trace de combien de fois, ni de si la décision rapide aurait eu
raison ou tort. Sans cette donnée, parler de "fine-tuner Laya pour qu'il
s'améliore" n'est qu'une intention : il n'y a rien à entraîner sans
exemples réels de ce qui a posé problème.

## Ce que ce n'est PAS

- **Pas un mécanisme d'auto-implémentation.** Contrairement à
  `skill-ameliorateur-systeme` + `auto-implementer.js`, rien ici ne
  modifie quoi que ce soit automatiquement. Ce journal ne fait
  qu'observer et consigner.
- **Pas un fine-tuning.** Constituer un jeu de données est la condition
  préalable à un fine-tuning, pas le fine-tuning lui-même — qui reste un
  chantier séparé, avec ses propres exigences (jeu d'évaluation tenu à
  l'écart, comparaison du nouveau checkpoint à l'ancien avant toute
  bascule, jamais une fusion automatique sur la seule confiance du
  moment). Non entamé.
- **Pas la mémoire éditable de l'agent.** `memoire-cli.js` reste l'outil
  pour ce que l'agent décide lui-même de retenir/oublier. Ce journal est
  append-only — aucune commande de suppression n'existe volontairement :
  perdre une ligne, c'est perdre un exemple potentiellement rare et
  informatif (un désaccord franc est plus précieux qu'un accord de plus).

## Usage

```bash
# Depuis un workflow, juste après un résultat "fiable": false de decision-rapide.js
node 04-scripts/journal-desaccords.js enregistrer \
  --question "..." --type choix --moteur laya \
  --decision-rapide "1" --confiance-rapide 0.52 --seuil-confiance 0.75

# Une fois la comparaison délibérative faite, complète la même ligne logique
# avec le résultat délibératif (calcule accord/désaccord automatiquement) :
node 04-scripts/journal-desaccords.js enregistrer \
  --question "..." --type choix --moteur laya \
  --decision-rapide "1" --confiance-rapide 0.52 --seuil-confiance 0.75 \
  --decision-deliberative "0"

# Statistiques agrégées
node 04-scripts/journal-desaccords.js resume [--moteur laya] [--type choix]

# Export brut (JSONL), filtrable — format d'entraînement réel non
# inventé ici, à adapter le jour où un pipeline de fine-tuning existe
node 04-scripts/journal-desaccords.js exporter --resolution desaccord
```

Trois résolutions possibles, calculées jamais déclarées directement :
`escalade_sans_comparaison` (confiance faible, pas encore de comparaison
délibérative — la commande `enregistrer` est appelée deux fois pour la
même décision, la seconde complète la première avec
`--decision-deliberative`), `accord`, `desaccord`.

## Intégré dans

`identifier-meilleur`
(`03-workflows/systeme-auto-ameliorant-avec-controle.workflow.json`,
v1.4.0) : consigne systématiquement tout résultat `fiable: false` de
`decision-rapide.js`, puis complète avec le résultat délibératif une
fois connu. Comme pour le reste de ce workflow, l'orchestration réelle
par `dsh-workflow` n'a pas pu être vérifiée dans mon environnement (voir
documentation/historique-du-projet.md, section "Non vérifiable") — seul `journal-desaccords.js`
lui-même a été testé directement (enregistrement des trois résolutions,
résumé, export, résilience à une ligne corrompue).

## Règle d'or

Un désaccord non consigné est une occasion perdue de savoir, un jour, si
la voie rapide mérite d'être améliorée ou simplement mieux calibrée. Ce
journal ne vaut que s'il est alimenté sans exception — pas seulement
quand c'est pratique.
