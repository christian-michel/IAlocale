---
name: comparateur-scenarios
description: "À utiliser quand une tâche récurrente admet plusieurs approches plausibles : formule deux scénarios concrets, évalue lequel est le plus efficace, garde le gagnant comme référence et affine-le à l'occasion suivante plutôt que de repartir de zéro chaque fois."
---

# Consignes pour le Comparateur de Scénarios

Ne construit rien de nouveau par-dessus l'existant — s'appuie sur
`skill-evaluateur.md` pour noter, `04-scripts/memoire-cli.js` pour
consigner et retrouver, `skill-ameliorateur-systeme.md` →
`auto-implementer.js` pour rendre un gagnant permanent sans jamais
modifier un skill directement.

## Méthode

1. **Formule deux scénarios concrets**, pas vagues — deux approches
   réellement différentes et comparables pour le même type de tâche
   (ex. deux méthodes de rédaction d'un email de relance, deux façons de
   structurer une réponse technique). Si une seule approche existe
   vraiment, il n'y a rien à comparer — ne force pas une alternative
   artificielle juste pour avoir "deux scénarios".

2. **Produis (ou raisonne) les deux résultats.** Si l'exécution réelle
   des deux est trop coûteuse ou risquée, raisonne les deux en détail
   plutôt que d'en écarter un à l'aveugle sans l'avoir vraiment considéré.

3. **Évalue chaque résultat avec `skill-evaluateur`**, critères
   explicites et objectifs — jamais une préférence non justifiée.

4. **Consigne la comparaison** avec le contexte complet, pas seulement
   le verdict :
   ```bash
   node 04-scripts/memoire-cli.js set --type comparaison-scenario \
     --contenu "Contexte: <situation> | Scénario A: <description> (score: <n>) | Scénario B: <description> (score: <n>) | Gagnant: <A ou B> | Pourquoi: <justification>" \
     --tags <domaine>,<situation>,<contrainte> --confiance <n> \
     --source "comparaison du <date>"
   ```
   Les tags sont ce qui permet de **retrouver ce choix dans un contexte
   similaire plus tard** — pas juste un mot-clé générique : nomme le
   domaine, la situation, toute contrainte qui a compté dans le choix.
   C'est cette richesse contextuelle qui construit, au fil du temps, un
   répertoire d'actions adaptées — pas une seule réponse figée par type
   de tâche.

5. **Avant une tâche similaire**, cherche d'abord une comparaison déjà
   consignée :
   ```bash
   node 04-scripts/memoire-cli.js search --q "<mots-clés du contexte>" --type comparaison-scenario
   ```
   Si elle existe, repars du scénario gagnant comme base — pas comme
   réponse automatique à recopier, comme point de départ à affiner.

6. **Affine par petites variations**, pas par refonte complète. À
   l'occasion suivante : scénario A = le gagnant précédent tel quel,
   scénario B = une seule variation ciblée sur ce qui semblait le plus
   discutable la fois d'avant. Compare, consigne, recommence — une
   amélioration incrémentale, jamais un redémarrage à zéro.

7. **Si le gagnant doit devenir un comportement standard** (pas juste un
   choix ponctuel, mais une méthode à appliquer systématiquement), ne
   l'écris jamais toi-même dans un skill existant — propose la mise à
   jour via `skill-ameliorateur-systeme` → `auto-implementer.js`, comme
   pour toute auto-modification dans ce projet. La comparaison consignée
   à l'étape 4 est exactement la justification à joindre à cette
   proposition.

## Format de sortie

```json
{
  "contexte": "...",
  "scenario_a": { "description": "...", "score": 0.0 },
  "scenario_b": { "description": "...", "score": 0.0 },
  "gagnant": "A" | "B",
  "justification": "...",
  "tags_contexte": ["..."]
}
```

## Règle d'or

Un gagnant qui n'est jamais réexaminé devient une habitude non
questionnée — pas un acquis. Reviens sur la comparaison consignée
(`search`) avant de la considérer définitive, et laisse-la être
contredite par un meilleur scénario B le jour où un vrai meilleur se
présente.
