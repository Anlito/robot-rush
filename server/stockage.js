'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { REGLAGES_DEFAUT, PAIRES_DEFAUT } = require('./constantes');

// Banque de questions, parcours et réglages : fichiers JSON dans DATA_DIR (./data par défaut).
// Au premier lancement, on recopie les 20 questions de test et le parcours « Test » depuis seed/.
// Aucune donnée d'élève n'est écrite sur le disque : les pseudos restent en mémoire le temps de la partie.

const RACINE = path.join(__dirname, '..');
// Volume permanent de Railway reconnu automatiquement ; sinon DATA_DIR, sinon ./data.
const DOSSIER = path.resolve(process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(RACINE, 'data'));
// Banque de référence facultative (fichier exporté depuis l'admin, publié à la racine du dépôt GitHub) :
// chargée au premier lancement, puis à chaque nouvelle publication (voir reference.js).
const BANQUE_INITIALE = path.join(RACINE, 'banque.json');
const DOSSIER_IMAGES = path.join(DOSSIER, 'images');
const DOSSIER_SAUVEGARDES = path.join(DOSSIER, 'sauvegardes');
const SEED = path.join(RACINE, 'seed');
const JOURS_DE_SAUVEGARDE = 30;

const FICHIERS = {
  questions: { nom: 'questions.json', defaut: () => lireJson(path.join(SEED, 'questions.json')) },
  parcours: { nom: 'parcours.json', defaut: () => lireJson(path.join(SEED, 'parcours.json')) },
  config: { nom: 'config.json', defaut: () => ({ reglages: REGLAGES_DEFAUT, paires: PAIRES_DEFAUT, nbEquipes: 4, parcoursId: 'p-test' }) },
};

function lireJson(fichier) {
  // Marque invisible (BOM) ajoutée par certains éditeurs Windows : ignorée.
  return JSON.parse(fs.readFileSync(fichier, 'utf8').replace(/^\uFEFF/, ''));
}

const aujourdhui = () => new Date().toISOString().slice(0, 10);

const crees = new Set(); // fichiers créés à ce lancement (premier démarrage, ou disque effacé)

function charger(cle) {
  const { nom, defaut } = FICHIERS[cle];
  const fichier = path.join(DOSSIER, nom);
  if (!fs.existsSync(fichier)) {
    const valeur = defaut();
    sauver(cle, valeur);
    crees.add(cle);
    return valeur;
  }
  try {
    return lireJson(fichier);
  } catch (e) {
    // Fichier abîmé (modifié à la main, coupure de courant…) : on le met de côté au lieu de planter.
    const mis = path.join(DOSSIER, `${nom.replace('.json', '')}-illisible-${aujourdhui()}-${Date.now()}.json`);
    fs.renameSync(fichier, mis);
    console.error(`\n  ATTENTION : le fichier ${nom} était illisible (${e.message}).`);
    console.error(`  Il a été mis de côté sous le nom ${path.basename(mis)}.`);
    console.error(`  Des copies de sécurité se trouvent dans ${DOSSIER_SAUVEGARDES}.\n`);
    const valeur = defaut();
    sauver(cle, valeur);
    return valeur;
  }
}

// Une copie de sécurité par jour et par fichier, gardée 30 jours.
const sauvegardesDuJour = new Set();
function copieDeSecurite(cle, fichier) {
  const jour = aujourdhui();
  if (sauvegardesDuJour.has(`${cle}-${jour}`) || !fs.existsSync(fichier)) return;
  sauvegardesDuJour.add(`${cle}-${jour}`);
  fs.mkdirSync(DOSSIER_SAUVEGARDES, { recursive: true });
  const copie = path.join(DOSSIER_SAUVEGARDES, `${cle}-${jour}.json`);
  if (!fs.existsSync(copie)) fs.copyFileSync(fichier, copie);
  // Ménage des copies trop anciennes.
  const limite = Date.now() - JOURS_DE_SAUVEGARDE * 86400000;
  for (const f of fs.readdirSync(DOSSIER_SAUVEGARDES)) {
    const p = path.join(DOSSIER_SAUVEGARDES, f);
    if (fs.statSync(p).mtimeMs < limite) fs.rmSync(p);
  }
}

function sauver(cle, valeur) {
  fs.mkdirSync(DOSSIER, { recursive: true });
  const fichier = path.join(DOSSIER, FICHIERS[cle].nom);
  if (cle !== 'config') copieDeSecurite(cle, fichier);
  // Écriture atomique : un fichier temporaire puis renommage.
  const tmp = `${fichier}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(valeur, null, 2), 'utf8');
  fs.renameSync(tmp, fichier);
}

/** true si la banque vient d'être créée à ce lancement (premier démarrage, ou disque effacé). */
const banqueNeuve = () => crees.has('questions');

/** Contenu de banque.json (banque de référence publiée), ou null s'il n'y en a pas ou s'il est illisible. */
function lireBanqueReference() {
  if (!fs.existsSync(BANQUE_INITIALE)) return null;
  try {
    return lireJson(BANQUE_INITIALE);
  } catch (e) {
    console.error(`  Le fichier banque.json est illisible (${e.message}) : il est ignoré.`);
    return null;
  }
}

/** Petits fichiers annexes du dossier de données (état de la publication, liaison GitHub). */
function lireAnnexe(nom) {
  const fichier = path.join(DOSSIER, nom);
  if (!fs.existsSync(fichier)) return null;
  try { return lireJson(fichier); } catch { return null; }
}
function ecrireAnnexe(nom, valeur) {
  const fichier = path.join(DOSSIER, nom);
  fs.mkdirSync(DOSSIER, { recursive: true });
  if (valeur === null) { fs.rmSync(fichier, { force: true }); return; }
  const tmp = `${fichier}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(valeur, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, fichier);
}

/** Copie de la banque actuelle avant de la remplacer (en plus de la copie du jour). */
function copieAvantRemplacement(etiquette) {
  fs.mkdirSync(DOSSIER_SAUVEGARDES, { recursive: true });
  const horodatage = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  for (const cle of ['questions', 'parcours']) {
    const fichier = path.join(DOSSIER, FICHIERS[cle].nom);
    if (fs.existsSync(fichier)) fs.copyFileSync(fichier, path.join(DOSSIER_SAUVEGARDES, `${cle}-${etiquette}-${horodatage}.json`));
  }
}

module.exports = {
  charger, sauver, banqueNeuve, lireBanqueReference, lireAnnexe, ecrireAnnexe, copieAvantRemplacement,
  DOSSIER, DOSSIER_IMAGES, DOSSIER_SAUVEGARDES,
};
