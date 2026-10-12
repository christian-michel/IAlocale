/**
 * dsh-contexte-local — plugin dsh : avant chaque réponse, identifie le
 * contexte du message de l'utilisateur et, s'il est conversationnel,
 * injecte les passages pertinents de 06-data/ (RAG local) pour qu'ils
 * soient utilisés AVANT toute autre source.
 *
 * Demandé par l'utilisateur (voir documentation/historique-du-projet.md,
 * round 25) : « Si ce n'est pas de la technique ou de l'histoire et que
 * c'est du conversationnel, alors il faut utiliser [les données locales]
 * avant d'aller sur internet, comme un RAG. » Jusque-là, 06-data/ n'était
 * lu que si le modèle pensait de lui-même à charger un skill — rien ne le
 * garantissait.
 *
 * Fonctionnement, hors du bon vouloir du modèle (hook `agent/pre-step`,
 * le même que celui par lequel dsh injecte le catalogue des skills) :
 * 1. Nouveau message humain (source.kind "user"), session de premier
 *    niveau seulement (pas les sous-agents d'un workflow).
 * 2. Classement technique / histoire / conversationnel par un appel court
 *    au modèle déjà chargé, sortie contrainte par schéma.
 * 3. Conversationnel, ou classement incertain (confiance < seuil) :
 *    recherche par le sens dans l'index de 04-scripts/connaissances.js ;
 *    les passages au-dessus du seuil de pertinence sont injectés.
 * 4. Chaque décision est journalisée (dsh-logger), pour pouvoir vérifier
 *    après coup ce qui a été classé et injecté.
 * Toute erreur (Ollama, index absent) est journalisée et n'empêche jamais
 * la réponse : le message passe alors sans injection.
 */
import { importerDepuisDsh } from '../commun/dsh.js';
import { rechercher } from '../../04-scripts/connaissances.js';
import { logInfo, logError } from '../../04-scripts/dsh-logger.js';

const { default: z } = await importerDepuisDsh('@deepseek-ai/schemastery');
const { createUserMessage } = await importerDepuisDsh('@deepseek-ai/dsh-llm');

export const name = 'contexte-local';
export const inject = [];
export const Config = z.object({
  modele: z.string().required(),
  ollama: z.string().default('http://127.0.0.1:11434'),
  seuilConfiance: z.number().default(0.7),
  seuilPertinence: z.number().default(0.55),
  nbPassages: z.natural().default(5),
});

const COMPOSANT = 'contexte-local';
const SOURCE = 'contexte-local';
const CONTEXTES = ['technique', 'histoire', 'conversationnel'];

const texteDe = (message) => (message.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');

/** Classe le message : {contexte, confiance}. */
export async function classer(message, { modele, ollama }) {
  const reponse = await fetch(`${ollama}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      model: modele,
      stream: false,
      options: { temperature: 0 },
      format: { type: 'object', properties: { contexte: { type: 'string', enum: CONTEXTES }, confiance: { type: 'number' } }, required: ['contexte', 'confiance'] },
      messages: [
        { role: 'system', content: "Tu classes un message selon son contexte. technique : informatique, code, sciences et techniques, outils, procédures. histoire : faits, dates, événements ou personnages historiques. conversationnel : tout le reste — échange personnel, émotions, relations, développement personnel, sens, valeurs, sagesse, conseils de vie. Donne aussi ta confiance entre 0 et 1." },
        { role: 'user', content: message },
      ],
    }),
  });
  if (!reponse.ok) throw new Error(`Ollama /api/chat : HTTP ${reponse.status}`);
  const resultat = JSON.parse((await reponse.json()).message.content);
  if (!CONTEXTES.includes(resultat.contexte)) throw new Error(`classement hors schéma : ${JSON.stringify(resultat)}`);
  return resultat;
}

export function rendreInjection(classement, passages) {
  return [
    '<system-reminder>',
    `Contexte détecté : ${classement.contexte} (confiance ${classement.confiance}). Voici des passages des données personnelles locales de l'utilisateur (06-data/), retrouvés pour ce message.`,
    "Utilise-les EN PREMIER, avant tes connaissances générales : clés et personnalité d'abord, sagesse ensuite, raisonnement général seulement en renfort, jamais en remplacement. Cite le fichier source quand tu t'en sers. Si aucun passage ne convient vraiment, dis-le plutôt que de le forcer.",
    // Constaté (round 25) : sans cette phrase, le modèle relisait les
    // fichiers entiers (dizaines de Mo), saturait son contexte, et la
    // réponse était coupée.
    "Ces passages suffisent : réponds directement à partir d'eux. Ne relis pas les fichiers de 06-data/ et ne charge pas le skill consulter-sagesse-interne pour ce message.",
    '',
    ...passages.map((p, i) => `[${i + 1}] ${p.fichier} (pertinence ${p.score})\n${p.texte}\n`),
    '</system-reminder>',
  ].join('\n');
}

export function apply(ctx, config) {
  ctx.on('agent/pre-step', async ({ agent, messages, signal }, next) => {
    const decision = await next();
    if (decision.kind === 'reject') return decision;
    if ((agent.session?.header?.delegationDepth ?? 0) > 0) return decision;

    const tous = decision.messages ?? messages;
    let iHumain = -1;
    for (let i = tous.length - 1; i >= 0; i--) if (tous[i].role === 'user' && tous[i].source?.kind === 'user') { iHumain = i; break; }
    if (iHumain === -1) return decision;
    const humain = tous[iHumain];
    if (tous.slice(iHumain + 1).some((m) => m.source?.kind === SOURCE)) return decision;

    const message = texteDe(humain);
    const trace = { message: message.slice(0, 200) };
    try {
      const classement = await classer(message, config);
      signal?.throwIfAborted();
      Object.assign(trace, classement);
      const consulter = classement.contexte === 'conversationnel' || classement.confiance < config.seuilConfiance;
      let passages = [];
      if (consulter) passages = (await rechercher(message, config.nbPassages)).filter((p) => p.score >= config.seuilPertinence);
      signal?.throwIfAborted();
      trace.consulte = consulter;
      trace.passages = passages.map((p) => `${p.fichier} (${p.score})`);
      // Une marque est injectée même sans passage : elle évite de
      // reclasser ce message à chaque étape de la même réponse.
      const texte = passages.length > 0
        ? rendreInjection(classement, passages)
        : `<system-reminder>\nContexte détecté : ${classement.contexte} (confiance ${classement.confiance}).${consulter ? " Aucun passage des données locales (06-data/) n'est assez pertinent pour ce message." : ''}\n</system-reminder>`;
      logInfo(COMPOSANT, `Message classé ${classement.contexte} (${classement.confiance}) — ${passages.length} passage(s) local(aux) injecté(s)`, { context: trace });
      return { ...decision, messages: [...tous, createUserMessage({ content: [{ type: 'text', text: texte }], source: { kind: SOURCE, pourMessage: humain.id } })] };
    } catch (err) {
      if (signal?.aborted) throw err;
      logError(COMPOSANT, 'Classement ou recherche impossible — réponse sans injection', { err, context: trace });
      return decision;
    }
  });
}
