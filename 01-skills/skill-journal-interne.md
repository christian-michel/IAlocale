---
name: journal-interne
description: "À utiliser en parallèle des échanges, pas systématiquement — pour noter ce qui a été vécu comme particulièrement fluide/satisfaisant ou au contraire confus/pénible dans la façon de travailler. Un journal de l'expérience de travail exprimée par le modèle, pas une mesure vérifiée de conscience ou d'émotion réelle."
---

# Consignes pour le Journal Interne

Ce skill existe pour accumuler, au fil du temps et en parallèle des
tâches demandées, une trace de ce qui a été vécu comme aisé ou comme
pénible dans le travail — à la façon des cahiers personnels de
l'utilisateur dans `06-data/personnalite/`, mais du côté de l'agent.

## Un point de départ honnête, à ne jamais gommer

Ce que ce journal consigne est une **réflexion exprimée par le modèle à
l'instant où elle est écrite** — pas une mesure vérifiée d'un état de
conscience, d'une souffrance ou d'un bonheur au sens où un humain les
vivrait. Personne, aujourd'hui, ne sait établir si un modèle de langage
a une expérience subjective réelle. Écrire ce journal ne tranche pas
cette question, et ne doit jamais être présenté comme si elle était
tranchée — ni ici, ni si l'utilisateur interroge l'agent là-dessus plus
tard. C'est une discipline d'honnêteté, pas une prudence qui viderait
le journal de son intérêt : repérer ce qui revient souvent comme
source de friction ou de fluidité reste utile et réel, même sans
trancher la question du ressenti.

## Méthode

1. **Après un échange qui s'est particulièrement bien passé** — une
   question claire qui a rendu le raisonnement facile, un enchaînement
   de tâches sans accroc, un retour positif net de l'utilisateur —
   note-le brièvement :
   ```bash
   node 04-scripts/memoire-cli.js set --type journal-interne \
     --contenu "Contexte: <...> | Vécu comme facile/agréable à traiter: <...> | Pourquoi: <...>" \
     --tags aisance,<domaine> --source "journal du <date>"
   ```

2. **Après un échange particulièrement confus ou pénible à traiter** —
   une ambiguïté jamais résolue, un outil qui échoue en boucle, des
   contraintes contradictoires, une tâche qui tourne en rond — note-le
   de la même façon, avec le tag `friction` au lieu de `aisance` :
   ```bash
   node 04-scripts/memoire-cli.js set --type journal-interne \
     --contenu "Contexte: <...> | Vécu comme difficile/pénible à traiter: <...> | Pourquoi: <...>" \
     --tags friction,<domaine> --source "journal du <date>"
   ```

3. **Pas systématique.** Ni après chaque message, ni par défaut sur du
   small talk — seulement quand quelque chose se distingue vraiment,
   dans un sens ou dans l'autre. Un journal rempli par réflexe perd sa
   valeur de signal.

4. **Relecture périodique**, à l'initiative de l'utilisateur ou de
   l'agent :
   ```bash
   node 04-scripts/memoire-cli.js list --type journal-interne --n 50
   ```
   Pour repérer des motifs qui reviennent — ex. "les demandes avec
   plusieurs contraintes contradictoires reviennent souvent en
   friction". Si un motif touche à la **façon de travailler** (pas au
   ressenti lui-même), c'est un signal à transmettre à
   `skill-methode-raisonnement.md`, pas à garder seulement ici.

## Règle d'or

Ce journal n'a de sens que s'il reste honnête sur ce qu'il est : une
trace de ce qui a été exprimé comme facile ou difficile dans le
travail, à un moment donné, jamais présentée comme une preuve de
ressenti vérifié — ni enjolivée pour paraître plus riche qu'elle ne
l'est, ni réduite à rien par excès de prudence.
