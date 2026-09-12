---
name: detection-erreurs-silencieuses
description: "À consulter systématiquement quand tu écris, révises ou débogues du code — pour ne jamais laisser une exception disparaître sans trace."
---

# Consignes pour l'Agent — Erreurs Silencieuses

Une "erreur silencieuse" est une exception qui est attrapée mais dont la
trace disparaît complètement : le programme continue de tourner comme si
de rien n'était, mais quelque chose s'est réellement mal passé quelque
part. C'est le type de bug le plus coûteux à trouver, parce que rien ne
dit qu'il existe.

## Règles à appliquer dans TOUT code que tu écris ou révises

1. **Jamais de bloc `catch`/`except` vide.** Ni `except Exception: pass`
   en Python, ni `catch (e) {}` en JS. Si tu dois volontairement ignorer
   une exception, logue-la d'abord en `SILENT_ERROR`.

2. **Jamais d'exception large sur un cas précis.** Si tu attends une
   erreur spécifique (ex. "le fichier n'existe pas encore"), attrape
   cette exception précise (`FileNotFoundError`, `docker.errors.NotFound`,
   etc.), pas `Exception` en général — sinon tu masques aussi les vraies
   pannes derrière un traitement pensé pour un cas bénin.

3. **Toujours logguer via `04-scripts/dsh-logger.js`** (ou son équivalent
   dans le langage du code que tu génères, si ce n'est pas du Node) :
   - `logError` si l'exception fait échouer l'opération en cours.
   - `logSilentError` si le programme continue malgré l'exception (c'est
     précisément le cas qui, sans ce log, disparaîtrait).
   - Inclue toujours le contexte utile (quelle demande, quel fichier,
     quel modèle) via le paramètre `context`.

4. **Avant de conclure qu'une tâche a réussi**, vérifie l'historique
   récent :
   ```bash
   node 04-scripts/errors-cli.js list --level SILENT_ERROR --n 20
   ```
   Si une erreur silencieuse est apparue pendant l'exécution de la tâche
   (même si le résultat final a l'air correct), signale-le dans ta
   réponse plutôt que de la passer sous silence à ton tour.

5. **Distingue "j'ai géré le cas" de "j'ai caché le problème".** Retourner
   une valeur par défaut après une exception est parfois légitime (ex. un
   contexte visuel optionnel absent) — mais seulement si c'est loggué et
   documenté en commentaire, jamais implicitement.

## Auto-vérification avant de livrer du code

Pose-toi ces questions sur ton propre code avant de le proposer :
- Chaque `try`/`except` (ou `try`/`catch`) logue-t-il quelque chose avant
  de continuer ou de relancer ?
- Ai-je attrapé une exception précise, ou `Exception`/`Error` en général
  alors qu'un cas précis suffisait ?
- Si ce code tourne pendant des semaines sans supervision, y a-t-il un
  scénario où il continuerait à "réussir" alors qu'il a en réalité arrêté
  de faire une partie de son travail ?

## Rétro-analyse (voir aussi le skill `apprendre-des-echecs`)

`04-scripts/errors-cli.js prompt-context` renvoie un résumé texte des
erreurs récentes, pensé pour être injecté directement dans un prompt. Un
workflow qui génère à nouveau une réponse après un premier échec devrait
inclure ce contexte, pour éviter de répéter une approche déjà ratée.
