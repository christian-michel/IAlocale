import { watch } from 'fs';
import { readFile, writeFile, readdir, stat, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { logInfo, logSilentError } from './dsh-logger.js';
// HARNESS_HOME : voir config.js, seule déclaration du projet.
import { HARNESS_HOME } from './config.js';
// Index vectoriel du RAG local (round 25) : tenu à jour en même temps que
// meta-index.json — seuls les fichiers modifiés sont ré-encodés.
import { indexer as indexerVecteurs } from './connaissances.js';

const KNOWLEDGE_BASE = path.join(HARNESS_HOME, '06-data');
const INDEX_FILE = path.join(KNOWLEDGE_BASE, 'meta-index.json');
// 'memoire' contient des données structurées (memoire.json, géré par
// memoire-cli.js) interrogeables par requête exacte, pas du texte à
// indexer sémantiquement — voir skill-gestion-memoire.md.
const EXCLUDED_DIRS = new Set(['.git', 'node_modules', '.DS_Store', 'memoire']);
const EXCLUDED_FILES = new Set(['meta-index.json', 'index-vectoriel.json']);

function checksum(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function inferType(filePath) {
  if (filePath.startsWith('personnalite/')) return 'personnalite';
  if (filePath.startsWith('sagesse/')) return 'sagesse';
  if (filePath.startsWith('cours-techniques/')) return 'technique';
  if (filePath.startsWith('cours-webmarketing/')) return 'webmarketing';
  return 'autre';
}

async function scanDirectory(dir) {
  const files = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    // AVANT (version Python du projet précédent) : ce cas était juste
    // affiché. Ici, comme le scan continue quand même (on renvoie une
    // liste partielle sans le dire), c'est une vraie erreur silencieuse :
    // l'index paraîtra à jour alors qu'un sous-dossier entier a été raté.
    logSilentError('watcher', `Impossible de lister ${dir} — ce sous-dossier sera absent de l'index`, { err, context: { dir } });
    return files;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      files.push(...await scanDirectory(fullPath));
    } else if (entry.isFile()) {
      if (EXCLUDED_FILES.has(entry.name)) continue;
      try {
        const stats = await stat(fullPath);
        const relativePath = path.relative(KNOWLEDGE_BASE, fullPath);
        const content = await readFile(fullPath, 'utf-8');
        files.push({
          path: relativePath,
          type: inferType(relativePath),
          size: stats.size,
          modified: stats.mtime.toISOString(),
          checksum: checksum(content),
        });
      } catch (err) {
        logSilentError('watcher', `Impossible de lire ${fullPath} — absent de l'index`, { err, context: { file: fullPath } });
      }
    }
  }
  return files;
}

async function updateIndex() {
  logInfo('watcher', "Mise à jour de l'index des connaissances...");
  try {
    await mkdir(KNOWLEDGE_BASE, { recursive: true });
    const files = await scanDirectory(KNOWLEDGE_BASE);
    const index = { lastUpdate: new Date().toISOString(), fileCount: files.length, files };
    await writeFile(INDEX_FILE, JSON.stringify(index, null, 2));
    logInfo('watcher', `Index mis à jour. ${files.length} fichier(s) indexé(s).`);
  } catch (err) {
    logSilentError('watcher', "Échec de la mise à jour de l'index — l'agent va continuer à consulter un index périmé sans le savoir", { err });
  }
  try {
    await indexerVecteurs();
  } catch (err) {
    logSilentError('watcher', "Échec de la mise à jour de l'index vectoriel (Ollama joignable ? modèle d'embeddings présent ?) — contexte-local injectera des passages périmés ou aucun", { err });
  }
}

logInfo('watcher', `Surveillance démarrée sur ${KNOWLEDGE_BASE}`);
await mkdir(KNOWLEDGE_BASE, { recursive: true });
await updateIndex();

let debounce = null;
const watcher = watch(KNOWLEDGE_BASE, { recursive: true }, (_event, filename) => {
  if (!filename) return;
  // Les index sont écrits DANS le dossier surveillé : sans ce filtre,
  // chaque mise à jour en déclenchait une autre, en boucle.
  if (EXCLUDED_FILES.has(path.basename(filename))) return;
  if (filename.split(path.sep).some((part) => EXCLUDED_DIRS.has(part))) return;
  clearTimeout(debounce);
  debounce = setTimeout(updateIndex, 1000);
});

function shutdown() {
  watcher.close();
  logInfo('watcher', 'Arrêt du watcher.');
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
