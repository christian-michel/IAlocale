---
name: boucles-agentiques
description: "À consulter avant de faire tourner une tâche 'jusqu'à ce que ce soit fini' ou 'en continu' — pour choisir le bon mécanisme parmi les cinq disponibles et ne jamais confondre surveillance et critère d'arrêt."
---

# Consignes — les cinq boucles

Il existe cinq façons distinctes de faire tourner ce système en boucle.
Elles ne se valent pas et ne servent pas au même usage — les confondre,
c'est soit s'arrêter trop tôt (sur une impression plutôt qu'une preuve),
soit tourner indéfiniment sans jamais réellement progresser.

## Règle d'or

**Une boucle ne vaut que ce que vaut son critère d'arrêt.** Un critère
lisible par la machine (code de sortie d'un test, d'un build, d'un
linter, diff contre un fichier de référence) bat toujours un jugement
"ça a l'air bon" — y compris le tien. Avant de lancer une boucle,
demande-toi : *qui décide qu'on s'arrête, et sur quelle preuve ?*

## Les cinq mécanismes, dans ce dépôt

| # | Boucle | Ce que c'est ici | Le tour suivant démarre quand | S'arrête quand |
|---|---|---|---|---|
| 01 | **Boucle agentique** | Le cycle natif de dsh (contexte → agit → vérifie → recommence). Tu ne la configures pas, elle tourne déjà. | (interne à dsh) | (interne à dsh) |
| 02 | **Critère d'arrêt dans le prompt** | La formulation des skills eux-mêmes : `skill-controleur-qualite`, `skill-testeur-docker`, `skill-extracteur-tests` demandent une preuve exécutable (tests, code Docker), pas une impression. | le précédent finit | le contrôleur qualité renvoie `VALIDE` |
| 03 | **Condition d'achèvement persistante (`/goal`)** | Le workflow `03-workflows/systeme-auto-ameliorant-avec-controle.workflow.json` : boucle `until: score_global >= seuil_satisfaction and statut == VALIDE or iteration >= max_iterations`. | le précédent finit | un modèle (skill-evaluateur + skill-controleur-qualite) confirme que la condition est remplie, ou le plafond d'itérations est atteint |
| 04 | **Hook Stop (déterministe)** | `04-scripts/boucle-hook-stop.js` : relance une commande de travail tant qu'une commande de vérification séparée ne renvoie pas un code de sortie 0. Le script tranche, pas le modèle. | le précédent finit | la commande de vérification réussit (code 0), ou `--max-iterations` est atteint |
| 05 | **Surveillance (`/loop`)** ⚠️ | `04-scripts/boucle-surveillance.sh` : relance une commande à intervalle fixe, indéfiniment. | un délai s'est écoulé | tu la coupes toi-même (Ctrl+C) |

## Quand utiliser laquelle

- **Tâche de code avec un résultat vérifiable** (tests, build, lint) →
  boucle 04 (`boucle-hook-stop.js`). C'est la plus fiable : le critère
  n'est jamais interprété, seulement lu (code de sortie).
- **Tâche où la "réussite" nécessite un jugement** (qualité d'une
  réponse, complétude d'une recherche) → boucle 03, déjà en place via
  `systeme-auto-ameliorant-avec-controle.workflow.json`. Toujours fixer
  un `max_iterations` : un critère jugé par un modèle peut rester
  indécidable.
- **Simple monitoring** (un service tourne toujours, un fichier n'a pas
  changé depuis trop longtemps) → boucle 05. Ne jamais l'utiliser comme
  substitut à un vrai critère d'arrêt : elle ne sait pas dire "c'est
  fini", seulement "du temps a passé".
- **Écriture d'un nouveau skill/prompt** → pense boucle 02 dès la
  rédaction : une instruction du type "corrige jusqu'à ce que les tests
  passent, avec ces cas de test précis" contient déjà sa propre boucle —
  inutile d'en ajouter une par-dessus si le prompt est assez précis.

## Ce qui n'existe pas (encore) dans dsh

Un vrai mécanisme de hooks natif (comme le hook `Stop` de Claude Code)
n'a jamais été confirmé dans `dsh` — voir la section "Non vérifiable"
du `README.md`. `boucle-hook-stop.js` reproduit l'effet *depuis
l'extérieur* (un script qui encadre l'appel à `dsh`), pas en s'intégrant
au CLI. Si `dsh --profile web --dump-config` révèle un jour un vrai
mécanisme de hooks, ce script devient une alternative de secours, pas la
seule option.
