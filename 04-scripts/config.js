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
 *
 * Repli quand HARNESS_HOME n'est pas défini : la racine du dépôt qui
 * contient ce fichier (04-scripts/..), et non plus ~/dsh-harness. Trouvé
 * en pratique (voir documentation/historique-du-projet.md, rounds 11 et
 * 24) : les commandes lancées par dsh — en particulier par les
 * sous-agents d'un workflow — ne reçoivent pas HARNESS_HOME ; avec
 * l'ancien repli, elles écrivaient hors du dépôt, ce que le bac à sable
 * de dsh refuse (EPERM) : journal-desaccords.js ne consignait rien, et
 * tous leurs logs étaient perdus. Pour une installation clonée dans
 * ~/dsh-harness comme le recommande le README, les deux replis désignent
 * le même dossier.
 */
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE_DEPOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const HARNESS_HOME = process.env.HARNESS_HOME || RACINE_DEPOT;
