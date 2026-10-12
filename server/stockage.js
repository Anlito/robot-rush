'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { REGLAGES_DEFAUT, PAIRES_DEFAUT } = require('./constantes');

// Banque de questions, parcours et réglages : fichiers JSON dans DATA_DIR (./data par défaut).
// Au premier lancement, on recopie les 20 questions de test et le parcours « Test » depuis seed/.
// Aucune donnée d'élève n'est écrite sur le disque : les pseudos restent en mémoire le temps de la partie.

const RACINE = path.join(__dirname, '..');
const DOSSIER = path.resolve(process.env.DATA_DIR || path.join(RACINE, 'data'));
const SEED = path.join(RACINE, 'seed');

const FICHIERS = {
  questions: { nom: 'questions.json', defaut: () => lireJson(path.join(SEED, 'questions.json')) },
  parcours: { nom: 'parcours.json', defaut: () => lireJson(path.join(SEED, 'parcours.json')) },
  config: { nom: 'config.json', defaut: () => ({ reglages: REGLAGES_DEFAUT, paires: PAIRES_DEFAUT, nbEquipes: 4, parcoursId: 'p-test' }) },
};

function lireJson(fichier) {
  return JSON.parse(fs.readFileSync(fichier, 'utf8'));
}

function charger(cle) {
  const { nom, defaut } = FICHIERS[cle];
  const fichier = path.join(DOSSIER, nom);
  if (!fs.existsSync(fichier)) {
    const valeur = defaut();
    sauver(cle, valeur);
    return valeur;
  }
  return lireJson(fichier);
}

function sauver(cle, valeur) {
  fs.mkdirSync(DOSSIER, { recursive: true });
  const fichier = path.join(DOSSIER, FICHIERS[cle].nom);
  // Écriture atomique : un fichier temporaire puis renommage.
  const tmp = `${fichier}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(valeur, null, 2), 'utf8');
  fs.renameSync(tmp, fichier);
}

module.exports = { charger, sauver, DOSSIER };
