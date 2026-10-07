#!/usr/bin/env node
/**
 * moteur-laya.js — toute l'intégration avec le paquet @receptron/laya
 * (Convai Innovations, Apache 2.0), isolée dans ce seul fichier.
 *
 * But : si Laya doit un jour être remplacé par un autre moteur de
 * décision rapide local, seul ce fichier change — decision-rapide.js
 * n'importe que `decisionViaLaya` ci-dessous, sans jamais référencer
 * `@receptron/laya` ni son API lui-même.
 *
 * Contexte complet (pourquoi ce moteur existe, ses limites connues,
 * pourquoi --type note est refusé) : voir l'en-tête de
 * decision-rapide.js, section "laya" — non dupliqué ici.
 */
import { logInfo, logError } from './dsh-logger.js';

export const NOM_PAQUET_LAYA = '@receptron/laya';

export async function decisionViaLaya({ args, composant, type, choix }) {
  if (type === 'note') {
    // Le type "score" de Laya renvoie bien un nombre, mais aucune mesure
    // de confiance associée n'est documentée (contrairement à "choice"
    // et son champ "probabilities") — plutôt que d'inventer une valeur
    // de confiance arbitraire, ce type est refusé avec ce moteur.
    console.error('❌ --type note n\'est pas supporté avec --moteur laya (pas de mesure de confiance confirmée pour son type "score"). Utilise --moteur ollama.');
    process.exit(1);
  }

  let LayaModule;
  try {
    LayaModule = await import(NOM_PAQUET_LAYA);
  } catch (err) {
    logError(composant, `Le paquet ${NOM_PAQUET_LAYA} n'est pas installé`, { err });
    console.error(`❌ ${NOM_PAQUET_LAYA} n'est pas installé. Lance \`npm install\` à la racine du dépôt, puis réessaie (voir package.json).`);
    process.exit(1);
  }

  const multilingue = Boolean(args.multilingue);
  logInfo(composant, `Décision rapide demandée (moteur=laya, type=${type}, checkpoint=${multilingue ? 'multilingual' : 'défaut'})`);

  const debutChargement = Date.now();
  let laya;
  try {
    laya = await LayaModule.Laya.load(multilingue ? { subfolder: 'multilingual' } : undefined);
  } catch (err) {
    logError(composant, 'Échec du chargement du modèle Laya', { err });
    console.error(`❌ Échec du chargement de Laya : ${err.message}`);
    process.exit(1);
  }
  const dureeChargementMs = Date.now() - debutChargement;

  // Une seule question par appel, sous une clé fixe — decision-rapide.js
  // ne demande jamais plusieurs décisions en une fois.
  const question = type === 'oui-non'
    ? { decision: { type: 'noul', instructions: args.question } }
    : { decision: { type: 'choice', instructions: args.question, criteria: Object.fromEntries(choix.map(c => [c, c])) } };
  // NB : Laya attend normalement une description par option dans
  // "criteria" (ex. {billing: "paiements, remboursements..."}) — l'API
  // actuelle de decision-rapide.js ne transporte que des libellés plats
  // (--choix "a,b,c"), donc chaque option se décrit ici par elle-même.
  // Une vraie description par option demanderait d'étendre le CLI.

  const debutDecision = Date.now();
  let resultat;
  try {
    resultat = await laya.systemOne({ contexte: args.contexte || '' }, question);
  } catch (err) {
    logError(composant, 'Échec de la décision Laya', { err });
    console.error(`❌ Échec de la décision Laya : ${err.message}`);
    try { await laya.close(); } catch { /* déjà en échec, rien de plus à faire */ }
    process.exit(1);
  }
  const dureeDecisionMs = Date.now() - debutDecision;
  await laya.close();

  let decisionBrute;
  if (type === 'oui-non') {
    const p = resultat.answers.decision.noul;
    decisionBrute = { decision: p >= 0.5, confiance: p >= 0.5 ? p : 1 - p };
  } else {
    const c = resultat.answers.decision.choice;
    decisionBrute = { decision: c, confiance: resultat.answers.decision.probabilities?.[c] };
  }

  return {
    decisionBrute,
    dureeMs: dureeChargementMs + dureeDecisionMs,
    modele: 'laya',
    detailTiming: { chargement_ms: dureeChargementMs, decision_ms: dureeDecisionMs },
  };
}
