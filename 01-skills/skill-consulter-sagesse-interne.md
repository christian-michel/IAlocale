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

2. **Si des passages de 06-data/ figurent déjà dans la conversation**
   (bloc « Contexte détecté : … » injecté automatiquement par le plugin
   dsh-contexte-local), pars d'eux : ils viennent d'être retrouvés pour
   ce message. Ne relis pas les fichiers entiers.
3. **Sinon, cherche par le sens** — jamais en lisant les fichiers en
   entier : `node 04-scripts/connaissances.js rechercher "<la question,
   reformulée si besoin>" --k 8` via l'outil bash. Renvoie les passages
   les plus proches, avec leur fichier et leur pertinence (0 à 1 ; en
   dessous de ~0,55, le passage n'a probablement pas de rapport).
   Pourquoi pas `ls`/`grep`/lecture complète : plusieurs fichiers font
   des dizaines de Mo (Cahier 2 et 3 sont à 99 % des images encodées),
   les lire sature le contexte et la réponse est coupée — constaté en
   conditions réelles (round 25, documentation/historique-du-projet.md).
   Si la recherche signale un index absent :
   `node 04-scripts/connaissances.js indexer`, puis recommence.
4. **Extraire les informations clés** des passages pertinents :
   principes, règles, ou concepts. Lis au besoin un court extrait autour
   d'un passage, jamais un fichier entier.
5. **Retourner un résumé structuré**, en citant le fichier source —
   jamais une réponse qui a l'air de venir de là sans qu'aucun passage
   n'ait réellement été retrouvé.

## Règle d'Or

La sagesse interne est ta boussole. Les informations externes sont les vents qui te font avancer.
