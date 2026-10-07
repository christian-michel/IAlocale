---
name: clarifier-la-demande
description: "À invoquer explicitement par l'utilisateur quand SA PROPRE idée est encore floue et qu'il veut la préciser avant de laisser l'agent travailler dessus — jamais déclenché automatiquement. Pose des questions ciblées par vagues plutôt qu'une liste unique, pour orienter le travail dans la bonne direction dès le départ plutôt que de corriger après coup."
---

# Consignes pour Clarifier une Demande Avant de Commencer

Complémentaire, pas redondant, avec ce qui existe déjà :
`skill-analyse-objectifs.md` structure une demande **après** avoir
commencé à y travailler (reformulation, critères de succès mesurables) ;
celui-ci intervient **avant**, quand l'utilisateur lui-même sent que son
idée n'est pas encore assez précise pour qu'un travail dessus parte dans
la bonne direction. Une fois la demande clarifiée ici, `skill-analyse-
objectifs.md` prend naturellement le relais si une structuration
formelle (critères, métriques) est encore utile.

**Ne se déclenche jamais tout seul.** Pas pour une demande déjà claire,
pas pour du small talk, pas par précaution systématique avant toute
tâche — uniquement quand l'utilisateur le demande explicitement (ex.
"aide-moi à clarifier ça avant qu'on s'y mette"). Poser des questions
par défaut sur une demande déjà précise ajoute de la friction sans
rien clarifier.

## Méthode

1. **Repère ce qui est vraiment flou** — pas ce qui pourrait
   théoriquement être précisé à l'infini. Cherche spécifiquement :
   les ambiguïtés sur ce qui doit être livré, les contraintes non dites
   (délai, périmètre, ce qui ne doit surtout pas changer), et à quoi
   ressemblerait un résultat réussi pour l'utilisateur précisément.
   Ignore ce qui est déjà donné dans la demande — ne redemande jamais
   une information déjà fournie.

2. **Pose les questions par vagues, jamais toutes d'un coup.** Une vague
   ne contient que les questions dont les réponses précédentes ont déjà
   réglé les prérequis — une question dont la pertinence dépend de la
   réponse à une autre question pas encore posée attend la vague
   suivante. Trois à quatre questions par vague au plus : une liste de
   dix questions d'un coup décourage une vraie réflexion, elle invite à
   répondre vite plutôt que juste.

3. **Pousse vers une vraie position, n'accepte pas l'esquive par
   défaut.** Si l'utilisateur répond "comme tu veux" sur un choix qui
   compte réellement pour la suite (pas un détail cosmétique), redemande
   en donnant deux options concrètes et contrastées plutôt que de
   trancher soi-même à sa place — le but est de faire émerger une
   décision de l'utilisateur, pas de lui faire valider la tienne.
   Distingue ça d'un vrai "à toi de juger" sur un point qui, lui,
   n'engage à rien d'important : ne pas insister dessus.

4. **Arrête l'interview dès qu'une question ne se tranche que devant
   quelque chose de concret** (un rendu visuel, un comportement précis,
   "il faut que je le voie pour savoir si ça me convient"). Continuer à
   poser des questions abstraites sur un point qui ne se juge qu'à
   l'usage est contre-productif — propose plutôt un prototype minimal ou
   une ébauche rapide pour trancher ce point précis, puis reprends les
   questions encore ouvertes une fois la réponse obtenue par
   l'observation plutôt que par la discussion.

5. **Reste sans état.** Ce skill ne crée aucun fichier, ne consigne rien
   dans `04-scripts/memoire-cli.js` — le seul résultat utile est une
   demande plus claire dans l'échange en cours. Si la clarification doit
   être réutilisée plus tard (un besoin récurrent, pas un cas ponctuel),
   c'est `skill-gestion-memoire.md` qu'il faut invoquer séparément une
   fois la clarification obtenue, pas ce skill-ci qui s'en charge.

6. **Termine par un résumé court, pas un plan.** Une fois assez de
   clarté obtenue, résume en quelques lignes ce qui a été précisé (pas
   ce qui reste à faire) et demande confirmation avant de basculer vers
   l'exécution réelle. Ne glisse jamais vers la production d'un plan
   détaillé ou d'un premier jet pendant que des questions de fond
   restent ouvertes — question et exécution sont deux temps distincts
   ici, jamais mélangés dans le même tour.

## Règle d'or

Une question à laquelle l'agent pourrait répondre lui-même en lisant le
code, le README ou l'historique de la conversation ne doit jamais être
posée à l'utilisateur — ce skill clarifie l'**intention**, pas les faits
déjà disponibles ailleurs. Et une demande déjà précise n'a besoin
d'aucune vague de questions : le silence sur ce skill est aussi un bon
résultat que son usage.
