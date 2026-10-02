#!/usr/bin/env node
/**
 * valider-skills-workflows.js — vérification déterministe, lisible par la
 * machine, que tous les skills et workflows du dépôt sont syntaxiquement
 * valides. C'est le "critère de vérification" (boucle 04, voir
 * skill-boucles-agentiques.md) utilisé par auto-implementer.js : une
 * auto-modification n'est fusionnée QUE si ce script sort en code 0.
 *
 * Ne vérifie PAS la qualité ou la pertinence du contenu (ça, c'est le rôle
 * de skill-evaluateur / skill-controleur-qualite, jugé par un modèle) —
 * seulement ce qu'un script peut trancher sans ambiguïté :
 *   - 01-skills/*.md : frontmatter YAML présent, avec `name` et
 *     `description` non vides.
 *   - 03-workflows/*.json : JSON syntaxiquement valide, avec `name` (string)
 *     et `steps` (array) — même structure minimale que les 4 workflows
 *     d'origine.
 *
 * Le parsing YAML passe par python3 (déjà une dépendance du projet pour
 * setup-local-model.sh / basculer-modele.sh) plutôt que d'ajouter une
 * dépendance npm (js-yaml) pour un seul script — ce dépôt n'a pas de
 * package.json, et ça reste volontairement ainsi.
 *
 * Usage :
 *   node valider-skills-workflows.js
 * Sortie : JSON {valide, erreurs: [...]} sur la dernière ligne de stdout ;
 * code de sortie 0 si tout est valide, 1 sinon.
 */
import { readdirSync, readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo, logError } from './dsh-logger.js';

const COMPOSANT = 'valider-skills-workflows';
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = path.join(RACINE, '01-skills');
const WORKFLOWS_DIR = path.join(RACINE, '03-workflows');

/** Extrait le bloc frontmatter (entre les deux premières lignes `---`) et
 * le fait valider par un vrai parseur YAML (python3/pyyaml), pas une
 * approximation maison — un frontmatter qui a l'air correct à l'œil peut
 * être invalide YAML (indentation, guillemets non fermés...). */
function validerFrontmatterYAML(cheminFichier, contenu) {
  if (!contenu.startsWith('---\n')) {
    return { ok: false, raison: 'pas de frontmatter (doit commencer par "---")' };
  }
  const finFrontmatter = contenu.indexOf('\n---', 4);
  if (finFrontmatter === -1) {
    return { ok: false, raison: 'frontmatter jamais refermé (pas de second "---")' };
  }
  const frontmatter = contenu.slice(4, finFrontmatter);

  const resultat = spawnSync('python3', ['-c', `
import sys, yaml, json
try:
    data = yaml.safe_load(sys.stdin.read())
except yaml.YAMLError as e:
    print(json.dumps({"ok": False, "raison": f"YAML invalide : {e}"}))
    sys.exit(0)
if not isinstance(data, dict):
    print(json.dumps({"ok": False, "raison": "le frontmatter ne contient pas un mapping"}))
    sys.exit(0)
manquants = [c for c in ("name", "description") if not data.get(c)]
if manquants:
    print(json.dumps({"ok": False, "raison": f"champ(s) manquant(s) ou vide(s) : {', '.join(manquants)}"}))
    sys.exit(0)
print(json.dumps({"ok": True}))
`], { input: frontmatter, encoding: 'utf-8' });

  if (resultat.error) {
    // python3/pyyaml indisponible : on ne peut pas se prononcer, mais on
    // ne doit pas non plus faire passer le fichier pour valide en silence.
    return { ok: false, raison: `impossible de lancer python3 pour valider le YAML (${resultat.error.message})` };
  }
  try {
    return JSON.parse(resultat.stdout.trim());
  } catch (err) {
    return { ok: false, raison: `sortie inattendue du validateur YAML : ${err.message}` };
  }
}

function validerSkills() {
  const erreurs = [];
  let fichiers;
  try {
    fichiers = readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md'));
  } catch (err) {
    logError(COMPOSANT, `Impossible de lister ${SKILLS_DIR}`, { err });
    return [{ fichier: SKILLS_DIR, raison: `dossier illisible : ${err.message}` }];
  }
  for (const nom of fichiers) {
    const cheminComplet = path.join(SKILLS_DIR, nom);
    let contenu;
    try {
      contenu = readFileSync(cheminComplet, 'utf-8');
    } catch (err) {
      erreurs.push({ fichier: nom, raison: `illisible : ${err.message}` });
      continue;
    }
    const { ok, raison } = validerFrontmatterYAML(cheminComplet, contenu);
    if (!ok) erreurs.push({ fichier: `01-skills/${nom}`, raison });
  }
  return erreurs;
}

function validerWorkflows() {
  const erreurs = [];
  let fichiers;
  try {
    fichiers = readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.json'));
  } catch (err) {
    logError(COMPOSANT, `Impossible de lister ${WORKFLOWS_DIR}`, { err });
    return [{ fichier: WORKFLOWS_DIR, raison: `dossier illisible : ${err.message}` }];
  }
  for (const nom of fichiers) {
    const cheminComplet = path.join(WORKFLOWS_DIR, nom);
    let contenu;
    try {
      contenu = readFileSync(cheminComplet, 'utf-8');
    } catch (err) {
      erreurs.push({ fichier: nom, raison: `illisible : ${err.message}` });
      continue;
    }
    let data;
    try {
      data = JSON.parse(contenu);
    } catch (err) {
      erreurs.push({ fichier: `03-workflows/${nom}`, raison: `JSON invalide : ${err.message}` });
      continue;
    }
    if (typeof data.name !== 'string' || !data.name) {
      erreurs.push({ fichier: `03-workflows/${nom}`, raison: 'champ "name" manquant ou vide' });
    }
    if (!Array.isArray(data.steps)) {
      erreurs.push({ fichier: `03-workflows/${nom}`, raison: 'champ "steps" manquant ou n\'est pas un tableau' });
    }
  }
  return erreurs;
}

const erreurs = [...validerSkills(), ...validerWorkflows()];
const valide = erreurs.length === 0;

if (valide) {
  logInfo(COMPOSANT, 'Tous les skills et workflows sont syntaxiquement valides');
} else {
  logError(COMPOSANT, `${erreurs.length} fichier(s) invalide(s) détecté(s)`, { context: { erreurs } });
}

console.log(JSON.stringify({ valide, erreurs }, null, 2));
process.exit(valide ? 0 : 1);
