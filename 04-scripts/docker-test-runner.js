#!/usr/bin/env node
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir, rm } from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import { logInfo, logWarning, logError, logSilentError } from './dsh-logger.js';

const execAsync = promisify(exec);

const args = process.argv.slice(2);
const argsMap = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) { argsMap[args[i].slice(2)] = args[i + 1]; i++; }
}
const { lang, code, test, timeout = '30' } = argsMap;

if (!lang || !code) {
  console.error('Usage: --lang python|node|bash --code "..." --test "..." --timeout 30');
  process.exit(1);
}

const getCodeFilename = l => ({ python: 'main.py', node: 'index.js', bash: 'script.sh' }[l] || 'code.txt');
const getTestFilename = l => ({ python: 'test_main.py', node: 'test.js' }[l] || 'test.txt');
const getDockerImage = l => ({ python: 'python:3.11-slim', node: 'node:20-slim', bash: 'alpine:latest' }[l] || 'alpine:latest');

function parseTestResults(output) {
  const passed = (output.match(/PASSED|passed/g) || []).length;
  const failed = (output.match(/FAILED|failed/g) || []).length;
  return { tests_passes: passed, tests_echoues: failed };
}

function buildSecureDockerCommand(l, workDir) {
  const image = getDockerImage(l);
  const securityOptions = ['--read-only', '--no-new-privileges', '--cap-drop=ALL'];
  const common = `--rm --memory 512m --cpus 0.5 ${securityOptions.join(' ')} -v "${workDir}":/app:ro --tmpfs /tmp -w /tmp`;
  const bashOnly = `--rm --memory 512m --cpus 0.5 ${securityOptions.join(' ')} --network=none -v "${workDir}":/app:ro --tmpfs /tmp -w /tmp`;

  const commands = {
    python: `docker run ${common} ${image} sh -c "cp -r /app/. /tmp/ && pip install --quiet pytest 2>/dev/null; pytest test_main.py -v --tb=short"`,
    node: `docker run ${common} ${image} sh -c "cp -r /app/. /tmp/ && npm init -y >/dev/null 2>&1 && npm install --silent jest >/dev/null 2>&1 && npx jest test.js"`,
    bash: `docker run ${bashOnly} ${image} sh -c "cp -r /app/. /tmp/ && sh script.sh && echo 'Test passed' || echo 'Test failed'"`,
  };
  return commands[l] || `docker run ${common} ${image} sh -c "echo 'No tests defined'"`;
}

const workDir = path.join('/tmp', `dsh-test-${randomBytes(8).toString('hex')}`);
await mkdir(workDir, { recursive: true });

try {
  await writeFile(path.join(workDir, getCodeFilename(lang)), code);
  if (test) await writeFile(path.join(workDir, getTestFilename(lang)), test);

  const cmd = buildSecureDockerCommand(lang, workDir);
  logInfo('docker_test_runner', `Lancement des tests Docker pour ${lang}`);

  const { stdout, stderr } = await execAsync(cmd, { timeout: Number(timeout) * 1000 });
  const statut = /FAILED|failed/.test(stdout) ? 'ECHEC' : 'SUCCES';
  if (statut === 'ECHEC') {
    logWarning('docker_test_runner', 'Tests exécutés mais échoués', { context: { lang, sortie: stdout.slice(-1000) } });
  }
  console.log(JSON.stringify({ statut, code_retour: 0, logs: stdout + '\n' + stderr, details: parseTestResults(stdout) }));
} catch (error) {
  const combined = `${error.stderr || ''} ${error.message || ''}`;
  const dockerMissing = /docker:?\s*not found|command not found|ENOENT|Cannot connect to the Docker daemon/i.test(combined);

  // AVANT (même piège que dans le projet Python précédent) : un simple
  // console.log ici aurait laissé passer la vraie cause (Docker absent,
  // timeout, image manquante...) sans rien de structuré à relire après
  // coup. On logue toujours en ERROR, avec un message ciblé si la cause
  // est identifiable.
  if (dockerMissing) {
    logError('docker_test_runner', "Docker n'est pas disponible (non installé ou daemon arrêté)", { err: error, context: { lang } });
  } else {
    logError('docker_test_runner', 'Échec inattendu du test Docker', { err: error, context: { lang } });
  }

  console.log(JSON.stringify({
    statut: 'ERREUR',
    code_retour: error.code || 1,
    logs: (error.stdout || '') + '\n' + (error.stderr || error.message || ''),
    details: { tests_passes: 0, tests_echoues: 1 },
    erreur: dockerMissing ? "Docker n'est pas disponible. Lance Docker Desktop et réessaie." : error.message,
  }));
} finally {
  try {
    await rm(workDir, { recursive: true, force: true });
  } catch (err) {
    // Un échec de nettoyage ne doit PAS faire planter le run (les
    // résultats des tests ont déjà été retournés), mais il ne doit pas
    // non plus disparaître : un /tmp qui se remplit silencieusement finit
    // par faire échouer des runs sans rapport, des semaines plus tard.
    logSilentError('docker_test_runner', `Nettoyage de ${workDir} échoué — dossier temporaire potentiellement orphelin`, { err });
  }
}
