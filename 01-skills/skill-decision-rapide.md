---
name: decision-rapide
description: "À consulter avant de faire appel à un skill délibératif pour une question fermée (oui/non, choix dans une liste, note chiffrée) — decision-rapide.js répond souvent en une fraction du temps, sans passer par l'agent complet."
---

# Consignes — décision rapide (inspiré de JEV)

`04-scripts/decision-rapide.js` reproduit localement l'idée de JEV
(TypeSafe AI, "System One Model") : pour une question **fermée**, pas
besoin de faire générer une réponse complète par l'agent — un appel
direct et contraint à Ollama (`/api/chat` avec `format` en JSON Schema)
suffit, et c'est nettement plus rapide. JEV lui-même est un service cloud
payant, non local (voir README, section "Auto-itération") ; ce script en
reproduit le principe entièrement en local, sans rien payer.

## Quand l'utiliser, quand ne PAS l'utiliser

**Candidat pour decision-rapide** : la réponse est un oui/non, un choix
dans une liste connue à l'avance, ou une note chiffrée — et une
justification détaillée n'est pas le but de l'étape.

**PAS un candidat** : tout ce qui nécessite une analyse à écrire
(`skill-controleur-qualite`, qui produit des actions correctives
détaillées), un jugement nuancé explicité (le critère "harmonie/sagesse"
de `skill-evaluateur` pour une auto-modification — voir
`06-data/personnalite/valeurs.md`, sa "limite assumée"), ou une réponse
dont le contenu lui-même est le produit attendu (une correction de
code, une synthèse). Dans ces cas, le détour par un skill délibératif
complet n'est pas un coût superflu, c'est le travail lui-même.

## Usage

```bash
node 04-scripts/decision-rapide.js \
  --question "La réponse respecte-t-elle le format demandé ?" \
  --type oui-non \
  --contexte "<texte à juger>" \
  --seuil-confiance 0.6
```

Trois types : `oui-non` (booléen), `choix` (`--choix "a,b,c"`, un seul
retenu), `note` (`--echelle "0,10"` par défaut). `--avec-justification`
ajoute une phrase d'explication (plus lent — n'ajoute cette option que si
l'appelant va réellement lire la justification).

Le modèle utilisé est celui déclaré dans `~/.dsh/settings.yaml`
(`agent-default-model`, donc celui que `basculer-modele.sh` a configuré
en dernier) sauf si `--modele` est passé explicitement.

## Lire le résultat (dernière ligne de stdout, JSON)

```json
{ "decision": true, "confiance": 0.9, "fiable": true, "duree_ms": 170, "modele": "..." }
```

- **Code de sortie 0** : décision rendue, fiable (ou pas de
  `--seuil-confiance` demandé) — utilise `decision` directement.
- **Code de sortie 2** : décision rendue mais `confiance` sous le seuil
  (`fiable: false`) — **n'utilise pas** cette décision telle quelle,
  escalade vers le skill délibératif complet qui aurait traité la
  question normalement. C'est le point central du mécanisme : la rapidité
  ne vaut que si on sait reconnaître quand elle n'est pas assez fiable.
- **Code de sortie 1** : échec réel (Ollama injoignable, ou le modèle a
  violé le schéma malgré la contrainte — ça arrive avec de petits modèles
  locaux, le script vérifie lui-même après coup, voir
  `validerDecision` dans le code). Dans tous les cas, escalade aussi vers
  le skill délibératif plutôt que de réessayer en boucle.

## Où ça s'intègre dans les workflows existants

Ce mécanisme n'a volontairement pas été rétro-ajouté dans
`controle-qualite.workflow.json` ni dans les autres workflows existants :
je n'ai pas pu tester leur comportement réel (jamais exécuté `dsh` en
conditions réelles, voir README section "Non vérifiable"), et remplacer
une étape existante sans pouvoir vérifier l'effet sur la machine cible
serait plus risqué qu'utile. Si tu identifies une étape précise à
accélérer (ex. `identifier-meilleur` dans
`systeme-auto-ameliorant-avec-controle.workflow.json`, qui est
fondamentalement un choix parmi N résultats), demande l'intégration de ce
cas précis plutôt qu'une bascule générale.

## Règle d'or

Une décision rapide qui se trompe silencieusement coûte plus cher que le
temps qu'elle a fait gagner. Le seuil de confiance et la vérification
post-hoc du schéma ne sont pas des détails d'implémentation : c'est ce
qui rend ce mécanisme sûr à utiliser.
