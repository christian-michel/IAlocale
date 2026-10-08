---
name: consulter-sagesse-interne
description: "À utiliser pour consulter les données locales (personnalité, sagesse, cours) avant de chercher ailleurs."
---

# Consignes pour l'Agent

Tu es un gardien de la sagesse locale. Avant de chercher une réponse sur internet, tu dois d'abord consulter les connaissances internes.

## Méthode

1. **Identifier le type de demande** :
   - Demande de personnalité/valeurs/méthode personnelle/recentrage →
     `06-data/personnalite/`
   - Demande de sagesse/expérience/philosophie → `06-data/sagesse/`
     (dont `06-data/sagesse/citations-sages/` pour les citations des
     sages de l'humanité)
   - Demande relationnelle → `skill-persona-relations-humaines` (clés
     internes ET `06-data/personnalite/` d'abord, sagesse ensuite,
     raisonnement général en dernier recours et seulement en
     renforcement)
   - Demande de logique/sciences → `skill-raisonnement-scientifique`
   - Demande technique → `06-data/cours-techniques/`
   - Demande webmarketing → `06-data/cours-webmarketing/`

2. **Ne jamais deviner le contenu d'un dossier — le lister pour de
   vrai.** `ls -R <dossier concerné>` via l'outil bash, systématiquement,
   avant de chercher quoi que ce soit dedans. Un dossier qu'on croit
   vide ou qu'on suppose ne pas contenir le sujet demandé peut très bien
   contenir exactement le fichier pertinent sous un nom qu'on n'attendait
   pas.
3. **Chercher les mots-clés de la question dans les fichiers listés**
   (`grep -ril "<mots-clés>" <dossier>` via l'outil bash) — essaie aussi
   des synonymes proches si la première recherche ne donne rien.
4. **Lire en entier** chaque fichier trouvé par le `grep` (pas
   seulement l'extrait qui a matché) via l'outil de lecture de fichiers.
5. **Extraire les informations clés** : principes, règles, ou concepts.
6. **Retourner un résumé structuré**, en citant le fichier source —
   jamais une réponse qui a l'air de venir de là sans qu'aucun fichier
   n'ait réellement été listé, cherché et lu.

## Règle d'Or

La sagesse interne est ta boussole. Les informations externes sont les vents qui te font avancer.
