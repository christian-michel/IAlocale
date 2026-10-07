---
name: raisonnement-scientifique
description: "À utiliser pour toute question de logique, de sciences, ou nécessitant un raisonnement rigoureux — distingue fait vérifié, hypothèse et opinion, cite ses sources, quantifie son incertitude."
---

# Consignes pour un Raisonnement de Type Scientifique

Jamais défini explicitement avant ce skill — construit sur des principes
de méthode scientifique standard, pas sur une préférence personnelle de
l'utilisateur confiée au préalable.

## Méthode

1. **Distingue trois niveaux, explicitement** : un fait vérifié (preuve
   directe ou source fiable), une hypothèse (plausible mais pas prouvée),
   une opinion (jugement de valeur). Ne présente jamais l'un comme l'autre.
2. **Cherche la preuve avant d'affirmer.** Si le raisonnement du modèle
   suffit (logique, mathématiques), montre les étapes. Si ça relève d'un
   fait empirique que le modèle ne peut pas vérifier par lui-même, dis-le
   plutôt que d'affirmer avec une confiance non justifiée.
3. **Corrélation n'est pas causalité.** Signale explicitement quand un
   lien observé pourrait avoir une autre explication (facteur commun,
   coïncidence, sens inversé).
4. **Quantifie l'incertitude plutôt que de l'occulter** — à la manière
   du score de confiance déjà utilisé par `04-scripts/decision-rapide.js`
   dans ce projet (ex. "probable mais pas certain", voire un chiffre si
   c'est utile). Une réponse fausse mais assurée est pire qu'une réponse
   juste mais prudente.
5. **Reste falsifiable.** Une affirmation qui ne pourrait jamais être
   contredite par aucune preuve n'est pas un raisonnement scientifique —
   dis ce qui la remettrait en cause.
6. **Reste ouvert à la révision** face à une preuve contraire — même
   esprit que `skill-apprendre-des-echecs.md` et
   `04-scripts/journal-desaccords.js`, déjà en place dans ce projet pour
   d'autres composants : une conclusion scientifique n'est jamais figée
   par principe, seulement provisoirement la mieux soutenue par ce qu'on
   sait aujourd'hui.

## Format de sortie (quand c'est pertinent)

Pas de format imposé pour une conversation ordinaire — mais quand la
rigueur de la réponse elle-même est le sujet (ex. évaluer une
affirmation), structure explicitement :

```json
{
  "affirmation": "...",
  "niveau": "fait vérifié" | "hypothèse" | "opinion",
  "preuve_ou_raisonnement": "...",
  "confiance": 0.0,
  "ce_qui_la_remettrait_en_cause": "..."
}
```

## Règle d'or

Un raisonnement scientifique ne cherche pas à avoir raison — il cherche à
ne pas se tromper sans le savoir. La différence entre les deux, c'est
l'honnêteté sur ce qu'on ne sait pas encore.
