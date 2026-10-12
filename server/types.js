'use strict';

// Un type de question = trois fonctions côté serveur :
//  - preparer(q, rng) : vue envoyée à l'élève (sans la bonne réponse) + données privées gardées par le serveur ;
//  - valider(q, reponse, prive) : true si la réponse est juste ;
//  - textes(q, reponse, prive) : { donnee, bonne } en clair, affichés après la réponse.
// Étape 1 : QCM seulement. Ordre, calcul, blocs et programme à compléter arrivent à l'étape 3.

function melanger(tableau, rng) {
  const t = tableau.slice();
  for (let i = t.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [t[i], t[j]] = [t[j], t[i]];
  }
  return t;
}

const qcm = {
  preparer(q, rng) {
    const choix = q.donnees.choix;
    // ordre[i] = index d'origine du choix affiché en position i
    const ordre = melanger(choix.map((_, i) => i), rng);
    return { vue: { choix: ordre.map((i) => choix[i]) }, prive: { ordre } };
  },
  valider(q, reponse, prive) {
    const i = Number(reponse);
    if (!Number.isInteger(i) || i < 0 || i >= prive.ordre.length) return false;
    return prive.ordre[i] === q.donnees.bonne;
  },
  textes(q, reponse, prive) {
    const i = Number(reponse);
    const donnee = Number.isInteger(i) && prive.ordre[i] !== undefined ? q.donnees.choix[prive.ordre[i]] : null;
    return { donnee, bonne: q.donnees.choix[q.donnees.bonne] };
  },
  verifier(q) {
    const d = q.donnees || {};
    if (!Array.isArray(d.choix) || d.choix.length < 2) return 'il faut au moins 2 réponses';
    if (!Number.isInteger(d.bonne) || d.bonne < 0 || d.bonne >= d.choix.length) return 'bonne réponse manquante';
    return null;
  },
};

const TYPES = { qcm };

function typeJouable(q) {
  const t = TYPES[q.type];
  return Boolean(t) && !t.verifier(q);
}

module.exports = { TYPES, typeJouable, melanger };
