---
name: apprentissage-par-confirmation
description: "À utiliser après une réponse substantielle (pas pour du small talk) : demande à l'utilisateur si la réponse était correcte, et si oui, enregistre-la dans la mémoire structurée pour répondre plus vite et plus précisément la prochaine fois sur un sujet similaire."
---

# Consignes pour l'Apprentissage par Confirmation

Miroir de `skill-apprendre-des-echecs.md` (qui apprend des échecs) — ce
skill apprend des **succès confirmés**. Repose entièrement sur l'outil
existant `04-scripts/memoire-cli.js` (mémoire structurée CRUD) — pas de
nouveau mécanisme de stockage.

## Méthode

1. **Avant de répondre à une question qui pourrait déjà avoir une
   réponse validée**, cherche d'abord dans la mémoire structurée :
   ```bash
   node 04-scripts/memoire-cli.js search --q "<mots-clés de la question>" --type reponse-validee
   ```
   Si une entrée pertinente existe, réutilise/adapte-la — c'est plus
   rapide et plus précis qu'une nouvelle délibération complète depuis
   zéro.

2. **Après une réponse substantielle** (pas une formule de politesse, pas
   du small talk — une vraie réponse qui a demandé une analyse ou un
   jugement), demande explicitement : *"Est-ce que cette réponse te
   convient, était-elle correcte ?"* Ne le fais pas après chaque message,
   seulement quand la réponse engageait un vrai raisonnement.

3. **Si l'utilisateur confirme**, enregistre :
   ```bash
   node 04-scripts/memoire-cli.js set --type reponse-validee \
     --contenu "Q: <question> | R: <réponse confirmée>" \
     --tags <domaine> --confiance 10 \
     --source "confirmée par l'utilisateur le <date>"
   ```
   Si l'utilisateur corrige plutôt que de confirmer, enregistre la
   version **corrigée** (pas l'originale) — c'est elle qui doit servir la
   prochaine fois, pas ta première tentative.

4. **Ne force jamais la confirmation.** Si l'utilisateur ne répond pas à
   la demande ou passe à autre chose, n'insiste pas et ne consigne rien
   par défaut — une réponse non confirmée reste non confirmée, jamais
   validée par supposition.

## Règle d'or

Une réponse confirmée une fois et jamais relue devient vite une réponse
périmée. Comme pour `skill-gestion-memoire.md` : relis (`list`/`search`)
avant d'écrire, pour corriger une entrée existante plutôt que d'empiler
des réponses validées contradictoires sur le même sujet.
