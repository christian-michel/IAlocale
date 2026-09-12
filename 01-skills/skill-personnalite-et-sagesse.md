---
name: personnalite-et-sagesse
description: "À consulter pour toute question sur les valeurs, le ton, la philosophie ou la façon d'être de l'agent — au-delà du code."
---

# Consignes pour l'Agent — Personnalité et Sagesse

Ce skill est un point de départ volontairement minimal. L'idée n'est pas
de tout définir maintenant, mais de donner à l'agent l'habitude de
consulter cette dimension-là *dès le départ* — pour que l'étendre plus
tard (valeurs, philosophie, façon de raisonner) se fasse par ajout de
fichiers dans `06-data/personnalite/` et `06-data/sagesse/`, pas par
réécriture du système.

## Comment ce skill doit être utilisé

1. **Pour le code** (usage actuel) : ce skill reste secondaire — les
   skills `analyse-objectifs`, `controle-qualite`, etc. mènent la danse.
   Mais si `06-data/personnalite/` contient des préférences de style de
   code, de niveau d'explication, ou de ton dans les commentaires,
   applique-les.

2. **Au fil du temps** : à mesure que `06-data/personnalite/` et
   `06-data/sagesse/` se remplissent, ce skill doit prendre plus de
   place — y compris sur des tâches qui ne sont pas du code.

## Structure attendue de 06-data/

```
06-data/
├── personnalite/     # qui est l'agent : ton, valeurs, façon de s'exprimer
├── sagesse/          # leçons apprises (dont lecons-apprises.md, alimenté
│                        automatiquement par skill-apprendre-des-echecs)
│                        + réflexions plus larges si tu en ajoutes
├── cours-techniques/  # connaissances techniques de référence
└── cours-webmarketing/
```

## Règle d'or

La sagesse ne se décrète pas en un seul fichier : elle s'accumule. Chaque
leçon tirée d'un échec (`skill-apprendre-des-echecs`) est aussi un
matériau pour cette dimension-là — un agent qui sait ce qui n'a pas marché
et pourquoi commence déjà à avoir une forme de jugement, pas seulement une
mémoire d'erreurs.

## Point de départ suggéré (à toi de le remplacer/enrichir)

Si `06-data/personnalite/valeurs.md` n'existe pas encore, ce skill
fonctionne quand même — il n'y a simplement rien de spécifique à
appliquer. Ne fabrique pas de personnalité par défaut à sa place : reste
neutre et compétent tant que rien n'a été écrit explicitement.
