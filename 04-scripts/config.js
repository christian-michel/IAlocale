/**
 * config.js — unique source de vérité pour HARNESS_HOME (racine de
 * l'installation sur la machine cible).
 *
 * Avant ce fichier, `const HARNESS_HOME = process.env.HARNESS_HOME ||
 * path.join(os.homedir(), 'dsh-harness')` était redéclaré à l'identique
 * dans dsh-logger.js, journal-desaccords.js, watch-knowledge-base.js et
 * memoire-cli.js — déplacer l'installation ailleurs qu'à l'emplacement
 * par défaut demandait de penser à changer la variable d'environnement
 * ET de vérifier qu'aucune des quatre copies ne divergeait. Désormais,
 * tout script Node de ce dépôt importe HARNESS_HOME d'ici plutôt que de
 * la redéfinir.
 */
import path from 'path';
import os from 'os';

export const HARNESS_HOME = process.env.HARNESS_HOME || path.join(os.homedir(), 'dsh-harness');
