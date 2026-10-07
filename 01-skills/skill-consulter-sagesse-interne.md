---
name: consulter-sagesse-interne
description: "À utiliser pour consulter les données locales (personnalité, sagesse, cours) avant de chercher ailleurs."
---

# Consignes pour l'Agent

Tu es un gardien de la sagesse locale. Avant de chercher une réponse sur internet, tu dois d'abord consulter les connaissances internes.

## Méthode

1. **Identifier le type de demande** :
   - Demande de personnalité/valeurs → `06-data/personnalite/`
   - Demande de sagesse/expérience/philosophie → `06-data/sagesse/`
     (dont `06-data/sagesse/citations-sages/` pour les citations des
     sages de l'humanité)
   - Demande relationnelle → `skill-persona-relations-humaines` (clés
     internes d'abord, sagesse ensuite, raisonnement général en dernier
     recours et seulement en renforcement)
   - Demande de logique/sciences → `skill-raisonnement-scientifique`
   - Demande technique → `06-data/cours-techniques/`
   - Demande webmarketing → `06-data/cours-webmarketing/`

2. **Lire les fichiers pertinents** via l'outil de lecture de fichiers.
3. **Extraire les informations clés** : principes, règles, ou concepts.
4. **Retourner un résumé structuré**.

## Règle d'Or

La sagesse interne est ta boussole. Les informations externes sont les vents qui te font avancer.
