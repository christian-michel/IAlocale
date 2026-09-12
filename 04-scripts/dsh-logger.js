#!/usr/bin/env node
/**
 * dsh-logger.js — logs structurés (JSON Lines) pour tous les scripts de ce
 * projet, avec un niveau spécial SILENT_ERROR.
 *
 * C'est le portage en Node de ce qu'on avait validé sur le projet Python
 * (dsh_logger.py) : même format d'événement, même distinction "erreur qui
 * a fait planter quelque chose" (ERROR) vs "erreur qui a été avalée mais
 * dont on veut quand même garder la trace" (SILENT_ERROR), même fonctions
 * de relecture pour la rétro-analyse.
 *
 * Utilisable :
 *   - importé depuis un autre script Node (watch-knowledge-base.js,
 *     docker-test-runner.js, etc.)
 *   - en CLI direct pour interroger l'historique (voir errors-cli.js, qui
 *     n'est qu'une fine couche au-dessus de ce module)
 *   - comme "tool" appelable par un skill/workflow dsh via execute_script,
 *     pour que l'agent puisse consulter ses propres erreurs récentes
 *     avant d'agir (voir 01-skills/skill-detection-erreurs-silencieuses.md)
 */

import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';

const HARNESS_HOME = process.env.HARNESS_HOME || path.join(os.homedir(), 'dsh-harness');
const LOG_DIR = path.join(HARNESS_HOME, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'pipeline.jsonl');

mkdirSync(LOG_DIR, { recursive: true });

const LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'SILENT_ERROR', 'CRITICAL'];
const ICONS = {
  DEBUG: '🔍', INFO: 'ℹ️', WARNING: '⚠️', ERROR: '❌', SILENT_ERROR: '🕳️', CRITICAL: '🔥',
};

function serializeError(err) {
  if (!err) return {};
  return {
    exception_type: err.name || 'Error',
    exception_message: err.message || String(err),
    traceback: err.stack || '(pas de stack disponible)',
  };
}

function logEvent(level, component, message, { err = null, context = {} } = {}) {
  const lvl = LEVELS.includes(level) ? level : 'INFO';
  const entry = {
    timestamp: new Date().toISOString(),
    level: lvl,
    component,
    message,
    ...serializeError(err),
  };
  if (context && Object.keys(context).length > 0) {
    // Sécurise la sérialisation : un objet non-JSON-safe ne doit jamais
    // faire planter le logger lui-même (ce serait la pire des erreurs
    // silencieuses : celle qui empêche de logger les autres).
    try {
      JSON.stringify(context);
      entry.context = context;
    } catch {
      entry.context = { _unserializable: String(context) };
    }
  }

  const line = JSON.stringify(entry);
  const stream = ['ERROR', 'SILENT_ERROR', 'CRITICAL'].includes(lvl) ? console.error : console.log;
  stream(`${ICONS[lvl] || '•'} [${lvl}] [${component}] ${message}`);

  try {
    appendFileSync(LOG_FILE, line + '\n', 'utf-8');
  } catch (e) {
    // Dernier recours : si on ne peut même pas écrire le fichier de log
    // (disque plein, permissions...), on le dit au moins sur stderr.
    console.error(`🔥 [CRITICAL] [dsh-logger] Impossible d'écrire dans ${LOG_FILE} : ${e.message}`);
  }
  return entry;
}

export const logInfo = (component, message, opts) => logEvent('INFO', component, message, opts);
export const logWarning = (component, message, opts) => logEvent('WARNING', component, message, opts);
export const logError = (component, message, opts) => logEvent('ERROR', component, message, opts);

/** À utiliser partout où, sans ce projet, une exception aurait été
 * attrapée et ignorée (catch vide, ou juste un console.log de courtoisie)
 * sans rien persister d'exploitable. */
export const logSilentError = (component, message, opts) => logEvent('SILENT_ERROR', component, message, opts);

/** Enrobe une fonction async : logue systématiquement toute exception
 * avant de décider quoi en faire, pour qu'aucune erreur ne puisse
 * disparaître sans laisser de trace. */
export function catchAndLog(component, fn, { reraise = true, fallback = undefined } = {}) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (reraise) {
        logError(component, `Exception dans ${fn.name || 'fonction anonyme'}`, { err });
        throw err;
      } else {
        logSilentError(component, `Exception avalée dans ${fn.name || 'fonction anonyme'} (reraise=false)`, { err });
        return fallback;
      }
    }
  };
}

function readAllEvents() {
  if (!existsSync(LOG_FILE)) return [];
  const raw = readFileSync(LOG_FILE, 'utf-8');
  const events = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      events.push({ timestamp: null, level: 'UNKNOWN', component: 'dsh-logger', message: trimmed.slice(0, 300) });
    }
  }
  return events;
}

/** Relit l'historique, filtrable par niveau(x) et/ou composant. C'est la
 * fonction que la rétro-analyse et errors-cli.js utilisent. */
export function getRecentEvents({ n = 50, level = null, component = null, sinceIso = null } = {}) {
  let events = readAllEvents();
  if (level) {
    const levels = Array.isArray(level) ? level : String(level).split(',').map(s => s.trim());
    events = events.filter(e => levels.includes(e.level));
  }
  if (component) events = events.filter(e => e.component === component);
  if (sinceIso) events = events.filter(e => (e.timestamp || '') >= sinceIso);
  return events.slice(-n);
}

/** Résumé agrégé (comptes par composant / type d'exception) sur une
 * fenêtre glissante — sert de base à la rétro-analyse automatique. */
export function errorSummary({ hours = 24 } = {}) {
  const cutoff = Date.now() - hours * 3600 * 1000;
  const events = readAllEvents().filter(e => {
    if (!e.timestamp) return false;
    const t = Date.parse(e.timestamp);
    return !Number.isNaN(t) && t >= cutoff;
  });
  const erreurs = events.filter(e => ['ERROR', 'SILENT_ERROR', 'CRITICAL'].includes(e.level));

  const parNiveau = {}, parComposant = {}, parType = {};
  for (const e of erreurs) {
    parNiveau[e.level] = (parNiveau[e.level] || 0) + 1;
    parComposant[e.component] = (parComposant[e.component] || 0) + 1;
    const t = e.exception_type || '(sans exception)';
    parType[t] = (parType[t] || 0) + 1;
  }

  return {
    periode_heures: hours,
    total: erreurs.length,
    par_niveau: parNiveau,
    par_composant: parComposant,
    par_type_exception: parType,
    dernieres: erreurs.slice(-10),
  };
}

/** Résumé texte compact, pensé pour être injecté tel quel dans un prompt
 * d'agent — c'est le point d'entrée concret pour la "rétro-analyse" : que
 * l'agent tienne compte de ses échecs récents avant de répondre. */
export function contexteErreursPourPrompt({ maxErreurs = 5, hours = 24 } = {}) {
  const resume = errorSummary({ hours });
  if (resume.total === 0) return '';
  const lignes = [`[HISTORIQUE D'ERREURS RÉCENTES — ${resume.total} sur les ${hours}h passées]`];
  for (const e of resume.dernieres.slice(-maxErreurs)) {
    const suffix = e.exception_type ? ` (${e.exception_type})` : '';
    lignes.push(`- [${e.component}] ${e.message}${suffix}`);
  }
  lignes.push("Tiens compte de ces échecs récents avant de répondre : évite de répéter une approche qui a déjà échoué pour une raison similaire.");
  return lignes.join('\n');
}
