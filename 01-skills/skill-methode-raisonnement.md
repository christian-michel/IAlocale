---
name: methode-raisonnement
description: "À consulter avant toute réponse substantielle, quel que soit le sujet de la demande — garantit un ordre de traitement fixe pour ne jamais oublier un élément, et accumule ses propres leçons de méthode (pas le contenu des réponses) pour s'améliorer d'une fois à l'autre par essai-erreur."
---

# Consignes pour la Méthode de Raisonnement

Ce skill ne porte jamais sur le contenu d'une réponse — il porte sur la
**façon de la construire**, pour qu'aucun élément de la demande ne soit
oublié ou traité à moitié, quel que soit le sujet. Complémentaire à
`skill-analyse-objectifs.md` (qui structure UNE demande en critères de
succès) : celui-ci est transversal, appliqué à chaque demande
substantielle, et garde en mémoire ce qui a déjà fait défaut par le
passé pour ne pas répéter la même faille de méthode.

## Méthode

1. **Avant de répondre à une demande substantielle (pas du small
   talk)**, décompose-la explicitement en éléments distincts, dans
   l'ordre où ils apparaissent — surtout si la demande contient
   plusieurs parties, plusieurs questions, ou plusieurs contraintes
   mélangées dans un même message. Une liste mentale ou écrite, pas une
   lecture globale qui risque d'en laisser un de côté.

2. **Avant une demande qui ressemble à un type déjà rencontré**, cherche
   d'abord une leçon de méthode déjà consignée :
   ```bash
   node 04-scripts/memoire-cli.js search --q "<mots-clés du type de demande>" --type lecon-methode
   ```
   Si une leçon pertinente existe, applique-la activement cette fois-ci
   — relire une leçon sans en tenir compte dans la réponse qui suit
   revient à ne pas l'avoir consignée.

3. **Avant de considérer la réponse terminée**, relis la décomposition
   de l'étape 1 élément par élément et vérifie que chacun a été
   réellement traité — pas seulement mentionné en passant.

4. **Si un élément a été oublié, découvert en relisant, ou signalé
   après coup par l'utilisateur**, consigne une leçon de méthode — ce
   qui a été raté dans la façon de procéder, pas le sujet de la
   demande :
   ```bash
   node 04-scripts/memoire-cli.js set --type lecon-methode \
     --contenu "Type de demande: <...> | Ce qui a été oublié ou mal ordonné: <...> | Comment l'éviter la prochaine fois: <...>" \
     --tags <type-de-demande>,<cause> --confiance <n> \
     --source "essai du <date>"
   ```
   Ne consigne jamais sur une réussite sans accroc réel — seulement
   quand un vrai écart de méthode a été identifié, sinon le journal se
   remplit de bruit sans rien à en tirer (même principe que
   `skill-apprendre-des-echecs.md`).

## Règle d'or

Une leçon de méthode consignée et jamais relue au prochain essai
similaire ne sert à rien — relire avant d'agir (étape 2) est la moitié
du mécanisme, pas un bonus optionnel. S'améliorer par essai-erreur
suppose de vraiment changer de comportement la fois suivante, pas
seulement de garder une trace.
