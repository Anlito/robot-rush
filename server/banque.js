'use strict';

// Banque de questions et de parcours : création, modification, duplication, suppression,
// export et import. Tout ce qui arrive du navigateur (ou d'un fichier importé) est nettoyé ici :
// seuls les champs connus sont gardés, avec des longueurs raisonnables.

const { TYPES, lireNombre } = require('./types');
const blocs = require('./blocs');
const { BORNES_REGLAGES } = require('./constantes');

class ErreurBanque extends Error {}
const erreur = (m) => { throw new ErreurBanque(m); };

const FORMAT = 'robot-rush';
const VERSION = 1;
const NIVEAUX = ['5e', '4e', '3e', 'SEGPA', 'autre'];
const MAX = { enonce: 600, explication: 400, choix: 150, element: 150, texte: 1500, unite: 12, nom: 80, trou: 80 };

const texte = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);
const ligne = (v, max) => texte(v, max).replace(/\s+/g, ' ');
const liste = (v) => (Array.isArray(v) ? v : []);

// ---------- Nettoyage des données par type ----------

const NETTOYAGE = {
  qcm(d) {
    const choix = liste(d.choix).slice(0, 4).map((c) => ligne(c, MAX.choix));
    while (choix.length < 4) choix.push('');
    const bonne = Number.isInteger(Number(d.bonne)) ? Number(d.bonne) : -1;
    return { choix, bonne };
  },
  ordre(d) {
    return { elements: liste(d.elements).slice(0, 8).map((e) => ligne(e, MAX.element)) };
  },
  calcul(d) {
    const n = typeof d.reponse === 'number' ? d.reponse : lireNombre(d.reponse);
    return { reponse: Number.isFinite(n) ? n : null, unite: ligne(d.unite, MAX.unite) || null };
  },
  blocs(d) {
    const autorises = liste(d.blocs).filter((b) => blocs.BLOCS_DISPONIBLES.includes(b));
    // Chaque séquence repasse par Blockly et retour : seules les instructions connues survivent.
    const sequences = liste(d.sequences).slice(0, 10).map((s) => blocs.depuisBlockly(blocs.versBlockly(liste(s))).programme);
    return { blocs: [...new Set(autorises)], sequences };
  },
  completer(d) {
    const trous = liste(d.trous).slice(0, 6).map((t) => ({
      bonne: ligne(t && t.bonne, MAX.trou),
      distracteurs: liste(t && t.distracteurs).slice(0, 6).map((x) => ligne(x, MAX.trou)).filter(Boolean),
    }));
    return { texte: texte(d.texte, MAX.texte), mode: d.mode === 'glisser' ? 'glisser' : 'liste', trous };
  },
};

function nettoyerQuestion(q) {
  if (!q || typeof q !== 'object') erreur('Question illisible.');
  const type = TYPES[q.type] ? q.type : null;
  if (!type) erreur('Type de question inconnu.');
  const duree = q.duree_s === null || q.duree_s === '' || q.duree_s === undefined ? null : Math.round(Number(q.duree_s));
  if (duree !== null && (!Number.isFinite(duree) || duree < 5 || duree > 300)) erreur('Durée : entre 5 et 300 secondes (ou vide pour la durée par défaut).');
  return {
    id: typeof q.id === 'string' && /^[\w-]{1,40}$/.test(q.id) ? q.id : null,
    type,
    niveau: NIVEAUX.includes(q.niveau) ? q.niveau : '5e',
    enonce: texte(q.enonce, MAX.enonce),
    image: typeof q.image === 'string' && /^\/images\/[0-9a-f]{16}\.(png|jpg|gif|webp|svg)$/.test(q.image) ? q.image : null,
    duree_s: duree,
    explication: texte(q.explication, MAX.explication) || null,
    donnees: NETTOYAGE[type](q.donnees || {}),
  };
}

/** Pourquoi une question ne peut pas être posée, ou null si elle est complète. */
function probleme(q) {
  if (!TYPES[q.type] || !q.donnees) return 'question abîmée : à corriger ou supprimer';
  if (!q.enonce) return 'énoncé vide';
  if (q.type === 'qcm') {
    const remplis = q.donnees.choix.filter(Boolean).length;
    if (remplis < 2) return 'il faut au moins 2 réponses';
    if (!q.donnees.choix[q.donnees.bonne]) return 'bonne réponse non choisie (ou vide)';
    return null;
  }
  return TYPES[q.type].verifier(q);
}

/** Version jouable d'une question : pour le QCM, les cases vides sont retirées. */
function versionJouable(q) {
  if (q.type !== 'qcm') return q;
  const garder = q.donnees.choix.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
  return { ...q, donnees: { choix: garder.map((i) => q.donnees.choix[i]), bonne: garder.indexOf(q.donnees.bonne) } };
}

function nettoyerParcours(p, idsQuestions) {
  if (!p || typeof p !== 'object') erreur('Parcours illisible.');
  const nom = ligne(p.nom, MAX.nom);
  if (!nom) erreur('Donnez un nom au parcours.');
  const reglages = {};
  for (const cle of ['dureePartie', 'longueur']) {
    const v = p.reglages && p.reglages[cle];
    if (v === undefined || v === null || v === '') continue;
    const n = Math.round(Number(v));
    const [min, max] = BORNES_REGLAGES[cle];
    if (!Number.isFinite(n) || n < min || n > max) {
      erreur(cle === 'dureePartie' ? `Durée : entre ${min} et ${max} minutes.` : `Piste : entre ${min} et ${max} cases.`);
    }
    reglages[cle] = n;
  }
  return {
    id: typeof p.id === 'string' && /^[\w-]{1,40}$/.test(p.id) ? p.id : null,
    nom,
    ordre_aleatoire: p.ordre_aleatoire !== false,
    questions: [...new Set(liste(p.questions).filter((id) => idsQuestions.has(id)))],
    reglages,
  };
}

// ---------- La banque ----------

class Banque {
  /** sauver(cle, valeur) écrit sur le disque ; images = { versDataUri, depuisDataUri } pour l'export. */
  constructor({ questions = [], parcours = [], sauver = () => {}, images = null }) {
    this.sauver = sauver;
    this.images = images;
    // Au chargement, rien ne doit disparaître sans bruit : une question abîmée est gardée telle quelle
    // (elle sera signalée « à corriger » et ne sera pas posée).
    this.questions = liste(questions).filter((q) => q && typeof q === 'object').map((q) => {
      try { return { ...nettoyerQuestion(q), id: q.id }; } catch { /* on réessaie sans la durée */ }
      try { return { ...nettoyerQuestion({ ...q, duree_s: null }), id: q.id }; } catch { return q; }
    });
    const ids = new Set(this.questions.map((q) => q.id));
    this.parcours = liste(parcours).filter((p) => p && typeof p === 'object').map((p) => {
      try { return { ...nettoyerParcours(p, ids), id: p.id }; } catch { return { ...p, questions: liste(p.questions), nom: ligne(p.nom, MAX.nom) || 'Sans nom' }; }
    });
  }

  // ----- Lecture -----

  question(id) { return this.questions.find((q) => q.id === id) || null; }
  unParcours(id) { return this.parcours.find((p) => p.id === id) || null; }

  /** Questions jouables d'un parcours (incomplètes écartées). */
  questionsJouables() {
    return this.questions.filter((q) => !probleme(q)).map(versionJouable);
  }

  /** Vue pour l'admin : chaque question avec son éventuel problème et, pour les blocs, ses séquences en clair. */
  vue() {
    return {
      questions: this.questions.map((q) => ({
        ...q,
        probleme: probleme(q),
        utilisations: this.parcours.filter((p) => p.questions.includes(q.id)).length,
        apercuSequences: q.type === 'blocs' ? q.donnees.sequences.map((s) => blocs.texteProgramme(s)) : undefined,
      })),
      parcours: this.parcours.map((p) => ({ ...p, nbJouables: p.questions.filter((id) => { const q = this.question(id); return q && !probleme(q); }).length })),
    };
  }

  // ----- Questions -----

  nouvelId(prefixe, existants) {
    let n = existants.length + 1;
    const pris = new Set(existants.map((x) => x.id));
    while (pris.has(`${prefixe}-${String(n).padStart(3, '0')}`)) n++;
    return `${prefixe}-${String(n).padStart(3, '0')}`;
  }

  enregistrerQuestion(entree) {
    const q = nettoyerQuestion(entree);
    const i = q.id ? this.questions.findIndex((x) => x.id === q.id) : -1;
    if (i >= 0) this.questions[i] = q;
    else { q.id = this.nouvelId('q', this.questions); this.questions.push(q); }
    this.sauver('questions', this.questions);
    return { question: q, probleme: probleme(q) };
  }

  dupliquerQuestion(id) {
    const q = this.question(id) || erreur('Question introuvable.');
    const copie = { ...JSON.parse(JSON.stringify(q)), id: this.nouvelId('q', this.questions) };
    this.questions.splice(this.questions.indexOf(q) + 1, 0, copie);
    this.sauver('questions', this.questions);
    return { question: copie };
  }

  supprimerQuestion(id) {
    const i = this.questions.findIndex((q) => q.id === id);
    if (i < 0) erreur('Question introuvable.');
    this.questions.splice(i, 1);
    let parcoursModifies = 0;
    for (const p of this.parcours) {
      if (p.questions.includes(id)) { p.questions = p.questions.filter((x) => x !== id); parcoursModifies++; }
    }
    this.sauver('questions', this.questions);
    if (parcoursModifies) this.sauver('parcours', this.parcours);
    return { parcoursModifies };
  }

  // ----- Parcours -----

  enregistrerParcours(entree) {
    const p = nettoyerParcours(entree, new Set(this.questions.map((q) => q.id)));
    const i = p.id ? this.parcours.findIndex((x) => x.id === p.id) : -1;
    if (i >= 0) this.parcours[i] = p;
    else { p.id = this.nouvelId('p', this.parcours); this.parcours.push(p); }
    this.sauver('parcours', this.parcours);
    return { parcours: p };
  }

  dupliquerParcours(id) {
    const p = this.unParcours(id) || erreur('Parcours introuvable.');
    const copie = { ...JSON.parse(JSON.stringify(p)), id: this.nouvelId('p', this.parcours), nom: `${p.nom} (copie)`.slice(0, MAX.nom) };
    this.parcours.splice(this.parcours.indexOf(p) + 1, 0, copie);
    this.sauver('parcours', this.parcours);
    return { parcours: copie };
  }

  supprimerParcours(id) {
    const i = this.parcours.findIndex((p) => p.id === id);
    if (i < 0) erreur('Parcours introuvable.');
    if (this.parcours.length === 1) erreur('Il faut garder au moins un parcours.');
    this.parcours.splice(i, 1);
    this.sauver('parcours', this.parcours);
    return {};
  }

  // ----- Export / import -----

  /** Un seul fichier JSON, images comprises (en data: URI), pour changer de PC ou partager avec un collègue. */
  exporter({ parcoursIds = null } = {}) {
    const parcours = parcoursIds ? this.parcours.filter((p) => parcoursIds.includes(p.id)) : this.parcours;
    const utiles = parcoursIds ? new Set(parcours.flatMap((p) => p.questions)) : null;
    const questions = this.questions.filter((q) => !utiles || utiles.has(q.id)).map((q) => {
      const copie = JSON.parse(JSON.stringify(q));
      if (q.image && this.images) {
        const uri = this.images.versDataUri(q.image);
        if (uri) copie.imageData = uri;
        delete copie.image;
      }
      return copie;
    });
    return { format: FORMAT, version: VERSION, exporteLe: new Date().toISOString(), questions, parcours };
  }

  /**
   * Importe un fichier exporté (ou une simple liste de questions).
   * mode « ajouter » : tout est ajouté, les numéros déjà pris sont renumérotés.
   * mode « remplacer » : la banque est remplacée par le contenu du fichier.
   */
  importer(donnees, { mode = 'ajouter' } = {}) {
    let entreeQ;
    let entreeP;
    if (Array.isArray(donnees)) { entreeQ = donnees; entreeP = []; }
    else if (donnees && typeof donnees === 'object' && (Array.isArray(donnees.questions) || Array.isArray(donnees.parcours))) {
      if (donnees.format && donnees.format !== FORMAT) erreur('Ce fichier ne vient pas de Robot Rush.');
      entreeQ = liste(donnees.questions);
      entreeP = liste(donnees.parcours);
    } else erreur('Fichier non reconnu : il faut un fichier exporté depuis Robot Rush (.json).');

    const questions = mode === 'remplacer' ? [] : this.questions.slice();
    const parcours = mode === 'remplacer' ? [] : this.parcours.slice();
    const correspondance = new Map();
    const rapport = { questions: 0, parcours: 0, ignorees: [], incompletes: 0 };

    entreeQ.forEach((brute, rang) => {
      try {
        const q = nettoyerQuestion({ ...brute, image: null });
        if (brute.imageData && this.images) q.image = this.images.depuisDataUri(brute.imageData);
        else if (typeof brute.image === 'string' && /^\/images\//.test(brute.image)) q.image = nettoyerQuestion({ ...brute }).image;
        const ancien = q.id;
        if (!q.id || questions.some((x) => x.id === q.id)) q.id = this.nouvelId('q', questions);
        if (ancien) correspondance.set(ancien, q.id);
        questions.push(q);
        rapport.questions++;
        if (probleme(q)) rapport.incompletes++;
      } catch (e) {
        rapport.ignorees.push(`question ${rang + 1} : ${e.message}`);
      }
    });

    const ids = new Set(questions.map((q) => q.id));
    entreeP.forEach((brut, rang) => {
      try {
        const traduit = { ...brut, questions: liste(brut.questions).map((id) => correspondance.get(id) || id) };
        const p = nettoyerParcours(traduit, ids);
        if (!p.id || parcours.some((x) => x.id === p.id)) p.id = this.nouvelId('p', parcours);
        parcours.push(p);
        rapport.parcours++;
      } catch (e) {
        rapport.ignorees.push(`parcours ${rang + 1} : ${e.message}`);
      }
    });

    if (mode === 'remplacer' && parcours.length === 0) {
      erreur('Ce fichier ne contient aucun parcours : il remplacerait tout par du vide. Choisissez « Ajouter » à la place.');
    }
    if (rapport.questions === 0 && rapport.parcours === 0) erreur('Rien à importer dans ce fichier.');
    this.questions = questions;
    this.parcours = parcours;
    this.sauver('questions', this.questions);
    this.sauver('parcours', this.parcours);
    return rapport;
  }
}

module.exports = { Banque, ErreurBanque, nettoyerQuestion, probleme, versionJouable, NIVEAUX };
