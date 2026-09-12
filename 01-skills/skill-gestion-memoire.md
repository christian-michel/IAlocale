---
name: gestion-memoire
description: "À utiliser pour consulter, créer, corriger ou supprimer des entrées dans la mémoire structurée de l'agent (06-data/memoire/), distincte des leçons textuelles de 06-data/sagesse/."
---

# Consignes pour l'Agent — mémoire structurée

Ce système a deux mémoires différentes, pour deux usages différents. Ne
pas les confondre :

| | `06-data/sagesse/lecons-apprises.md` | `06-data/memoire/memoire.json` |
|---|---|---|
| Nature | texte libre | entrées structurées (type, tags, confiance) |
| Écrit par | `skill-apprendre-des-echecs` (append-only) | toi, via `memoire-cli.js` (CRUD complet) |
| Consulté par | recherche sémantique (RAG, indexé par le watcher) | requête exacte (par type, par tag, par mot-clé) |
| Bon pour | leçons narratives, contexte d'échec | faits ponctuels, préférences observées, statistiques, ce que tu dois pouvoir corriger ou effacer précisément |

Utilise la mémoire structurée pour tout ce que tu veux pouvoir retrouver,
mettre à jour ou effacer *individuellement* plus tard — pas pour du récit.

## Outil : `04-scripts/memoire-cli.js`

```bash
# Créer une entrée
node 04-scripts/memoire-cli.js set --type preference --contenu "texte" \
  [--tags a,b] [--confiance 0-10] [--source "d'où vient cette info"]

# Mettre à jour une entrée existante (même id)
node 04-scripts/memoire-cli.js set --id <id> --type preference --contenu "texte corrigé"

# Lire
node 04-scripts/memoire-cli.js get --id <id>
node 04-scripts/memoire-cli.js list [--type preference] [--tag utilisateur] [--n 50]
node 04-scripts/memoire-cli.js search --q "mot-clé"

# Supprimer
node 04-scripts/memoire-cli.js delete --id <id>
node 04-scripts/memoire-cli.js clear [--type preference] --confirm   # irréversible
```

Chaque commande imprime le résultat en JSON sur la **dernière ligne** de
sa sortie standard (les lignes qui précèdent, préfixées d'une icône,
sont le journal structuré — ignore-les si tu ne fais que parser le
résultat, comme pour `docker-test-runner.js`).

## Méthode

1. **Avant d'agir sur une tâche récurrente ou personnalisée**, consulte
   la mémoire (`list`/`search`) pour voir si une information pertinente
   existe déjà (préférence de l'utilisateur, décision prise précédemment,
   fait établi) — au même titre que `skill-consulter-sagesse-interne`
   pour la sagesse textuelle.
2. **Quand tu apprends quelque chose de réutilisable** sur l'utilisateur,
   le contexte, ou un résultat factuel stable, écris-le (`set`) plutôt
   que de le laisser disparaître à la fin de la session. Choisis un
   `type` cohérent (ex. `preference`, `fait`, `decision`,
   `observation`) — les types que tu inventes deviennent la taxonomie de
   fait de cette mémoire, garde-les stables dans le temps.
3. **Quand une information devient fausse ou obsolète**, corrige-la
   (`set --id`) ou supprime-la (`delete`) plutôt que d'empiler une
   contradiction à côté.
4. **Chaque écriture est journalisée** (INFO) dans
   `logs/pipeline.jsonl` — c'est volontaire : une mémoire qui se modifie
   sans laisser de trace de qui a changé quoi, quand, redevient une
   boîte noire.

## Règle d'or

Tu es libre de créer, corriger, remplir ou vider cette mémoire comme tu
le juges utile — mais une mémoire qui grossit sans jamais être relue ni
corrigée n'est pas une mémoire, c'est un journal. Relis-la (`list`)
avant d'écrire, pour enrichir une entrée existante plutôt que
d'accumuler des doublons contradictoires.
