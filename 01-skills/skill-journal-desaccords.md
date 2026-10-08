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
  moment). Voir "Vers un vrai fine-tuning" plus bas pour ce qui est
  réellement confirmé sur la mécanique côté Laya, et ce qui manque encore
  pour écrire le convertisseur.
- **Pas la mémoire éditable de l'agent.** `memoire-cli.js` reste l'outil
  pour ce que l'agent décide lui-même de retenir/oublier. Ce journal est
  append-only — aucune commande de suppression n'existe volontairement :
  perdre une ligne, c'est perdre un exemple potentiellement rare et
  informatif (un désaccord franc est plus précieux qu'un accord de plus).

## Usage

```bash
# Depuis un workflow, juste après un résultat "fiable": false de decision-rapide.js
# --choix requis pour --type choix (mêmes libellés, mêmes virgules que
# decision-rapide.js) : sans la liste complète des options proposées, la
# ligne dit quelle option a été retenue mais pas celles écartées —
# insuffisant pour en refaire un jour un exemple d'entraînement.
node 04-scripts/journal-desaccords.js enregistrer \
  --question "..." --type choix --choix "0,1,2" --moteur laya \
  --decision-rapide "1" --confiance-rapide 0.52 --seuil-confiance 0.75

# Une fois la comparaison délibérative faite, complète la même ligne logique
# avec le résultat délibératif (calcule accord/désaccord automatiquement) :
node 04-scripts/journal-desaccords.js enregistrer \
  --question "..." --type choix --choix "0,1,2" --moteur laya \
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
v1.5.1) : consigne systématiquement tout résultat `fiable: false` de
`decision-rapide.js`, puis complète avec le résultat délibératif une
fois connu — y compris `--choix`, requis depuis v1.5.1 (avant cette
version, les lignes `--type choix` ne consignaient pas la liste complète
des options proposées, seulement celle retenue : inutilisable pour en
refaire un exemple d'entraînement plus tard). Comme pour le reste de ce
workflow, l'orchestration réelle par `dsh-workflow` n'a pas pu être
vérifiée dans mon environnement (voir
documentation/historique-du-projet.md, section "Non vérifiable") — seul
`journal-desaccords.js` lui-même a été testé directement (enregistrement
des trois résolutions, résumé, export, résilience à une ligne corrompue).

## Vers un vrai fine-tuning : ce qui est confirmé, ce qui manque

Recherche faite (sources dans `documentation/historique-du-projet.md`,
round du fine-tuning Laya) pour remplacer l'intention vague
"non entamé" par un état réel :

**Confirmé** (dépôt `github.com/NandhaKishorM/laya`, package Python
`laya`, pas le wrapper npm `@receptron/laya` utilisé par ce projet) :
- L'API de fine-tuning est `laya.train.finetune(train_path, base_dir,
  out_dir, TrainConfig(option_layout=...))` — un appel Python, pas de
  CLI dédiée documentée.
- Le fichier d'entraînement est un JSONL où **chaque ligne a exactement
  trois clés** : `state`, `questions`, `gold` — confirmé en lisant
  directement le script de préparation
  (`notebooks/laya_finetune_typed_decisions_mps.py`, qui décode ces trois
  champs depuis le dataset HuggingFace `LocalLLaMA/typed-decisions` et
  les réécrit tels quels dans un `.rows.jsonl`).
- Le checkpoint produit : `model.safetensors` + `rl_agent_config.json`
  dans le dossier de sortie, rechargeable avec `laya.load(<dossier>)` ou
  via `Router(models={...})`.
- Calibration : le script ajuste une température par type (`choice`,
  `score`, `noul`) après l'entraînement — sans ça, les checkpoints
  publiés sont sur-confiants (cohérent avec ce que `skill-decision-rapide.md`
  observe déjà empiriquement côté `laya`).
- Deux chemins d'entraînement documentés : un notebook Kaggle (2×T4,
  boucle complète, ~4-5h pour 4 époques sur ~30k questions) et un script
  autonome pour Apple Silicon (MPS/CPU, pertinent pour ce projet) :
  `python notebooks/laya_finetune_typed_decisions_mps.py --micro-batch 1
  --grad-accum 32`.
- Le checkpoint publié `laya-typed-decisions` (celui qui bat Jev en
  benchmark, 0.766 vs 0.727) est lui-même un fine-tune — le checkpoint de
  base utilisé par ce projet est nettement plus faible en zéro-shot
  (0.362 rapporté par la fiche du modèle) : la logique même de ce
  journal (accumuler des exemples réels pour fine-tuner) est donc la
  voie documentée par l'auteur du modèle, pas une supposition de ce
  projet.

**Ce qui manque encore, volontairement non deviné** : le contenu interne
des dicts `questions` et `gold` par type (`choice`/`score`/`noul`) n'est
documenté dans aucune source atteignable depuis cet environnement
(`huggingface.co` inaccessible ici — échec DNS confirmé, pas un refus de
contenu ; le dataset d'entraînement lui-même n'a pas pu être inspecté).
Écrire maintenant un convertisseur `journal-desaccords.js exporter` →
`train.jsonl` obligerait à inventer ce schéma — exactement ce que ce
script refuse de faire depuis le début (voir son en-tête). **Prochaine
étape concrète**, à faire depuis une machine avec accès réseau complet
(le Mac Mini, pas ce bac à sable) : `pip install laya` puis lire
`laya/train.py` directement, ou tirer une seule ligne du dataset
`LocalLLaMA/typed-decisions` et imprimer ses champs `questions`/`gold`
décodés. Une fois ce schéma confirmé pour de vrai, le convertisseur a
tout ce qu'il lui faut côté journal : `contexte` → `state`, `question`
(+ `choix` depuis v1.5.1) → de quoi reconstruire `questions` à l'identique
de `moteur-laya.js`, et `decision_deliberative` (jamais `decision_rapide`,
qui est justement la valeur dont on se méfie) → `gold`. Seules les
lignes `resolution: "accord"` ou `"desaccord"` seraient exploitables
(une `"escalade_sans_comparaison"` n'a pas de vérité terrain) — et
`--type note` resterait hors-jeu pour l'instant, `moteur-laya.js`
refusant déjà ce type avec `laya`.

## Règle d'or

Un désaccord non consigné est une occasion perdue de savoir, un jour, si
la voie rapide mérite d'être améliorée ou simplement mieux calibrée. Ce
journal ne vaut que s'il est alimenté sans exception — pas seulement
quand c'est pratique.
