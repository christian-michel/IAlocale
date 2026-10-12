/**
 * Chargement des modules @deepseek-ai/* pour les plugins de 07-plugins/.
 *
 * Installés par lien (`dsh plugin --profile <p> add link:<dossier>`), ces
 * plugins vivent dans le dépôt, où @deepseek-ai/* n'est pas résolvable
 * (pnpm l'annonce à l'installation). On charge donc les modules de
 * l'installation de dsh qui exécute le plugin — les mêmes instances que
 * le reste de dsh, sans en télécharger une seconde copie. Point d'entrée
 * ESM lu dans le champ `exports` de chaque paquet (schemastery a une
 * entrée ESM et une CJS distinctes).
 */
import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const requireDsh = createRequire(realpathSync(process.argv[1]));

export async function importerDepuisDsh(paquet) {
  const cheminPackageJson = requireDsh.resolve(`${paquet}/package.json`);
  const entree = JSON.parse(readFileSync(cheminPackageJson, 'utf-8')).exports['.'];
  const fichier = typeof entree === 'string' ? entree : (entree.import ?? entree.default);
  return import(pathToFileURL(path.join(path.dirname(cheminPackageJson), fichier)).href);
}
