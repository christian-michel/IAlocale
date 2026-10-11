/**
 * dsh-workflows-projet — plugin dsh : outil `workflow_projet`, qui lance
 * un workflow de 03-workflows/ PAR SON NOM.
 *
 * Pourquoi ce plugin existe (voir documentation/historique-du-projet.md,
 * round 24) : l'outil `workflow` natif de dsh n'a pas de registre de
 * définitions — le modèle doit recopier tout le script dans son appel
 * d'outil. Avec qwen3-coder en local, cette recopie échoue (script coupé
 * net vers 8 100 caractères, ou appel émis en texte brut sans jamais être
 * exécuté). Ici, le modèle n'émet qu'un nom et des args ; le script est
 * lu sur disque tel quel, puis confié au même moteur que l'outil natif
 * (ctx.workflowEngine, @deepseek-ai/dsh-workflow). Calqué sur
 * @deepseek-ai/dsh-tool-workflow (mode premier plan uniquement).
 *
 * Format d'un .workflow.js : première ligne `// @meta {...}` (JSON :
 * name, description, phases), puis le corps du script.
 *
 * Si `dossierSkills` est configuré, le contenu des skills (sans leur
 * frontmatter) est transmis au script dans `args.skills` ({nom: méthode}).
 * Le script n'a pas accès aux fichiers ; ainsi un sous-agent reçoit la
 * méthode directement dans sa consigne au lieu de devoir la charger par
 * l'outil skill — appel qui fuitait en texte brut chez ~40 % des
 * sous-agents (round 24 : 3/8 et 4/8 selon la formulation).
 */
import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Installé par lien (`dsh plugin --profile <p> add link:<ce dossier>`),
// ce plugin vit dans le dépôt, où @deepseek-ai/* n'est pas résolvable
// (pnpm l'annonce à l'installation). On charge donc les modules de
// l'installation de dsh qui exécute ce plugin — les mêmes instances que
// le reste de dsh, sans en télécharger une seconde copie. Point d'entrée
// ESM lu dans le champ `exports` de chaque paquet (schemastery a une
// entrée ESM et une CJS distinctes).
const requireDsh = createRequire(realpathSync(process.argv[1]));
async function importerDepuisDsh(paquet) {
  const cheminPackageJson = requireDsh.resolve(`${paquet}/package.json`);
  const entree = JSON.parse(readFileSync(cheminPackageJson, 'utf-8')).exports['.'];
  const fichier = typeof entree === 'string' ? entree : (entree.import ?? entree.default);
  return import(pathToFileURL(path.join(path.dirname(cheminPackageJson), fichier)).href);
}
const { default: z } = await importerDepuisDsh('@deepseek-ai/schemastery');
const { defineTool } = await importerDepuisDsh('@deepseek-ai/dsh-tools');

export const name = 'workflows-projet';
export const inject = ['tools', 'workflowEngine'];
export const Config = z.object({
  dossier: z.string().required(),
  dossierSkills: z.string(),
  toolName: z.string().default('workflow_projet'),
  maxResultChars: z.natural().min(1).default(5e4),
});

const SUFFIXE = '.workflow.js';

/** Lit un .workflow.js : meta (ligne `// @meta`) et corps complet. */
export function lireWorkflow(cheminFichier) {
  const texte = readFileSync(cheminFichier, 'utf-8');
  const ligneMeta = texte.split('\n').find((l) => l.startsWith('// @meta '));
  if (!ligneMeta) throw new Error(`${cheminFichier} : ligne "// @meta {...}" absente`);
  const meta = JSON.parse(ligneMeta.slice('// @meta '.length));
  if (!meta.name || !meta.description) throw new Error(`${cheminFichier} : meta.name et meta.description sont requis`);
  return { meta, script: texte };
}

function listerWorkflows(dossier) {
  try {
    return readdirSync(dossier).filter((f) => f.endsWith(SUFFIXE)).map((f) => f.slice(0, -SUFFIXE.length)).sort();
  } catch {
    return [];
  }
}

/** {nom: méthode} pour chaque skill de dossierSkills (frontmatter `name:`). */
export function lireSkills(dossierSkills) {
  const skills = {};
  for (const f of readdirSync(dossierSkills).filter((x) => x.endsWith('.md'))) {
    const texte = readFileSync(path.join(dossierSkills, f), 'utf-8');
    const m = texte.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    const nom = m?.[1].match(/^name:\s*["']?([^"'\n]+)["']?\s*$/m)?.[1];
    if (nom) skills[nom] = m[2].trim();
  }
  return skills;
}

function renderResult(nom, agentsStarted, value, maxChars) {
  const rendu = JSON.stringify(value, null, 2);
  const coupe = rendu.length > maxChars ? `${rendu.slice(0, maxChars)}\n… [tronqué : ${rendu.length - maxChars} caractères de plus]` : rendu;
  return `workflow "${nom}" completed (${agentsStarted} agent${agentsStarted === 1 ? '' : 's'}).\nReturn value:\n${coupe}`;
}

export function apply(ctx, config) {
  const { dossier, dossierSkills, toolName, maxResultChars } = config;
  const disponibles = listerWorkflows(dossier);
  ctx.tools.register(defineTool({
    name: toolName,
    description: `Lance un workflow du projet par son nom (fichier ${dossier}/<nom>${SUFFIXE}, exécuté tel quel par le moteur de workflows de dsh) et renvoie sa valeur de retour. Workflows disponibles : ${disponibles.join(', ') || '(aucun)'}. Ne recopie jamais le script : donne seulement son nom et ses args.`,
    parameters: {
      nom: { type: 'string', required: true, description: `Nom du workflow, parmi : ${disponibles.join(', ') || '(aucun)'}.` },
      args: { type: 'object', additionalProperties: true, description: 'Arguments JSON exposés au script comme variable globale `args`.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          kind: { type: 'string', required: true, const: 'foreground' },
          runId: { type: 'string', required: true },
          agentsStarted: { type: 'integer', required: true },
          result: { type: 'json', required: true },
        },
      },
      render: (args, value) => [{ type: 'text', text: renderResult(args.nom, value.agentsStarted, value.result, maxResultChars) }],
    },
    async execute(args, exec) {
      const parent = exec.agent;
      if (!parent) throw new Error(`${toolName} : agent appelant indisponible (exec.agent undefined)`);
      if (!/^[a-z0-9-]+$/.test(args.nom)) throw new Error(`${toolName} : nom invalide "${args.nom}" (lettres minuscules, chiffres et tirets uniquement)`);
      const cheminFichier = path.join(dossier, `${args.nom}${SUFFIXE}`);
      const { meta, script } = lireWorkflow(cheminFichier);
      const argsScript = dossierSkills ? { ...(args.args ?? {}), skills: lireSkills(dossierSkills) } : args.args;
      const run = ctx.workflowEngine.start({ script, meta, ...(argsScript !== undefined ? { args: argsScript } : {}), parent, signal: exec.signal });
      const onAbort = () => run.cancel('parent step aborted');
      exec.signal.addEventListener('abort', onAbort, { once: true });
      try {
        const result = await run.result;
        if (result.stopReason !== 'completed') {
          throw new Error(result.stopReason === 'cancelled' ? `workflow run was cancelled${result.error ? ` (${result.error})` : ''}` : `workflow run failed: ${result.error ?? 'unknown error'}`);
        }
        return { kind: 'foreground', runId: run.id, agentsStarted: result.agentsStarted, result: result.value };
      } finally {
        exec.signal.removeEventListener('abort', onAbort);
        await run.dispose();
      }
    },
    presentCall: (args) => ({ card: 'generic', title: `workflow_projet: ${args.nom}` }),
    presentResult: () => ({ card: 'generic' }),
  }));
}
