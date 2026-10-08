---
name: decision-rapide
description: "À consulter avant de faire appel à un skill délibératif pour une question fermée (oui/non, choix dans une liste, note chiffrée) — decision-rapide.js répond souvent en une fraction du temps, sans passer par l'agent complet."
---

# Consignes — décision rapide (inspiré de JEV)

`04-scripts/decision-rapide.js` reproduit localement l'idée de JEV
(TypeSafe AI, "System One Model") : pour une question **fermée**, pas
besoin de faire générer une réponse complète par l'agent. JEV lui-même
est un service cloud payant, non local (voir documentation/historique-du-projet.md, section
"Auto-itération") ; ce script en reproduit le principe entièrement en
local, sans rien payer — avec deux moteurs au choix (`--moteur`) :

- **`ollama`** (défaut) : appel direct et contraint au gros modèle déjà
  configuré (`/api/chat`, sortie forcée par JSON Schema). N'ajoute aucune
  dépendance.
- **`laya`** : [Laya](https://github.com/receptron/laya) (Convai
  Innovations, Apache 2.0), un encodeur dédié de 421M de paramètres
  (~2 Go de RAM) qui tourne à côté du gros modèle sans lui disputer la
  RAM — concurrent open source de JEV. Nécessite `npm install` (seule
  dépendance npm de ce dépôt, volontairement optionnelle — voir
  `package.json`). Supporte `oui-non` et `choix` seulement : le type
  `note` est refusé avec ce moteur (voir "Limites" plus bas).

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

Le modèle utilisé (moteur `ollama`) est celui déclaré dans
`~/.dsh/settings.yaml` (`agent-default-model`, donc celui que
`basculer-modele.sh` a configuré en dernier) sauf si `--modele` est passé
explicitement. Pour le moteur `laya`, ajoute `--moteur laya` ; `--multilingue`
bascule sur le checkpoint multilingue de Laya plutôt que l'anglophone par
défaut (voir "Limites" — la qualité en français n'est vérifiée dans
aucun des deux cas).

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

Branché dans `identifier-meilleur`
(`03-workflows/systeme-auto-ameliorant-avec-controle.workflow.json`,
v1.3.0) : choisir le meilleur résultat parmi N expériences évaluées est
un choix fermé, candidat naturel. L'étape tente d'abord
`decision-rapide.js --type choix` ; si `fiable: false` (confiance sous
`--seuil-confiance 0.75`) ou en cas d'échec, elle retombe sur la
comparaison délibérative habituelle — la logique de repli vit dans les
instructions de l'étape elle-même (pas dans une syntaxe conditionnelle du
moteur de workflow que je ne peux pas vérifier), voir le fichier
directement.

Validé avec un faux serveur Ollama sur trois domaines (code, juridique,
comptable) : choix confiant dans deux cas (code, comptable), confiance
sous le seuil dans le troisième (juridique, candidats aux scores
proches) — déclenchant bien le code de sortie 2 attendu. Le comportement
contre un vrai modèle (le seuil de 0.75 est-il le bon réglage ? un
modèle 30B-A3B exprime-t-il une confiance bien calibrée ?) reste à
confirmer sur la machine cible.

Les autres workflows n'ont volontairement pas été touchés : remplacer
une étape sans pouvoir vérifier l'effet sur `dsh` en conditions réelles
(jamais exécuté dans mon environnement, voir documentation/historique-du-projet.md section "Non
vérifiable") serait plus risqué qu'utile. Demande l'intégration d'un cas
précis plutôt qu'une bascule générale.

## Limites du moteur `laya`

- **Non exécuté dans mon environnement** — pas faute d'avoir essayé :
  `npm install` y échoue précisément parce que la dépendance
  `onnxruntime-node` télécharge son binaire natif depuis le flux Nuget
  (`api.nuget.org`) au moment de l'installation, pas depuis npm, et ce
  host est bloqué par le proxy réseau de mon bac à sable (confirmé dans
  son propre journal d'échecs). Rien n'indique que ce sera le cas sur un
  réseau domestique normal — mais si `npm install` échoue avec une erreur
  réseau sur `onnxruntime-node` chez toi aussi, vérifie `api.nuget.org`
  avant de chercher ailleurs.
- **Type `note` non supporté** : le type `score` de Laya ne documente pas
  de mesure de confiance (contrairement à `choice` et son champ
  `probabilities`) — plutôt que d'inventer une valeur, ce type est refusé
  avec ce moteur.
- **Qualité en français non vérifiée** : les benchmarks publiés par Laya
  sont tous sur des jeux de données anglophones. `--multilingue` change
  de checkpoint mais ne garantit rien — à évaluer toi-même avant de t'y
  fier pour du contenu en français.
- **Pas de serveur persistant** : contrairement à Ollama (démon qui garde
  le modèle chargé), chaque appel à `--moteur laya` recharge le modèle
  depuis son cache (~2 Go lus). `detail_timing` dans la sortie JSON
  sépare `chargement_ms` de `decision_ms` pour que ce coût reste visible
  plutôt que caché dans un `duree_ms` global trompeur.

## Vers une amélioration de Laya par l'usage

Chaque fois que `decision-rapide.js` renvoie `fiable: false`, c'est une
occasion de savoir, plus tard, si la décision rapide avait quand même
raison. `04-scripts/journal-desaccords.js` consigne systématiquement ces
cas (voir `skill-journal-desaccords.md`) — première brique vers un
éventuel fine-tuning de Laya, pas encore le fine-tuning lui-même.

## Règle d'or

Une décision rapide qui se trompe silencieusement coûte plus cher que le
temps qu'elle a fait gagner. Le seuil de confiance et la vérification
post-hoc du schéma ne sont pas des détails d'implémentation : c'est ce
qui rend ce mécanisme sûr à utiliser — pour les deux moteurs.
