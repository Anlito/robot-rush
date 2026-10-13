'use strict';

const blocs = require('./blocs');

// Un type de question = quatre fonctions côté serveur :
//  - preparer(q, rng) : vue envoyée à l'élève (jamais la bonne réponse) + données privées gardées par le serveur ;
//  - valider(q, reponse, prive) : true si la réponse est juste ;
//  - textes(q, reponse, prive) : { donnee, bonne } en clair, affichés après une mauvaise réponse ;
//  - verifier(q) : message d'erreur si la question est mal remplie, sinon null.

function melanger(tableau, rng) {
  const t = tableau.slice();
  for (let i = t.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [t[i], t[j]] = [t[j], t[i]];
  }
  return t;
}

const nettoyer = (t) => String(t ?? '').trim().replace(/\s+/g, ' ');
const pareil = (a, b) => nettoyer(a).toLowerCase() === nettoyer(b).toLowerCase();

// ---------- 1. QCM : 4 réponses, une bonne ----------
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
    if (d.choix.some((c) => !nettoyer(c))) return 'une réponse est vide';
    if (!Number.isInteger(d.bonne) || d.bonne < 0 || d.bonne >= d.choix.length) return 'bonne réponse non choisie';
    return null;
  },
};

// ---------- 2. Remise en ordre ----------
// L'élève renvoie les positions affichées dans l'ordre qu'il a choisi. On compare les textes :
// deux étapes identiques (« Attendre 1 s » deux fois) sont donc interchangeables.
const ordre = {
  preparer(q, rng) {
    const elements = q.donnees.elements;
    let affichage = melanger(elements.map((_, i) => i), rng);
    // Jamais déjà dans le bon ordre au départ.
    for (let essai = 0; essai < 10 && affichage.every((v, i) => elements[v] === elements[i]); essai++) affichage = melanger(affichage, rng);
    return { vue: { elements: affichage.map((i) => elements[i]) }, prive: { affichage } };
  },
  lire(q, reponse, prive) {
    if (!Array.isArray(reponse) || reponse.length !== prive.affichage.length) return null;
    const vus = new Set();
    const textes = [];
    for (const r of reponse) {
      const i = Number(r);
      if (!Number.isInteger(i) || i < 0 || i >= prive.affichage.length || vus.has(i)) return null;
      vus.add(i);
      textes.push(q.donnees.elements[prive.affichage[i]]);
    }
    return textes;
  },
  valider(q, reponse, prive) {
    const textes = ordre.lire(q, reponse, prive);
    return Boolean(textes) && textes.every((t, i) => t === q.donnees.elements[i]);
  },
  textes(q, reponse, prive) {
    const textes = ordre.lire(q, reponse, prive);
    return { donnee: textes ? textes.join(' → ') : null, bonne: q.donnees.elements.join(' → ') };
  },
  verifier(q) {
    const e = (q.donnees || {}).elements;
    if (!Array.isArray(e) || e.length < 2) return 'il faut au moins 2 étapes';
    if (e.some((x) => !nettoyer(x))) return 'une étape est vide';
    return null;
  },
};

// ---------- 3. Calcul : réponse numérique exacte ----------
function lireNombre(texte) {
  const t = String(texte ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}
const calcul = {
  preparer(q) {
    return { vue: { unite: q.donnees.unite || null }, prive: {} };
  },
  valider(q, reponse) {
    const n = lireNombre(reponse);
    return n !== null && Math.abs(n - Number(q.donnees.reponse)) < 1e-9;
  },
  textes(q, reponse) {
    const u = q.donnees.unite ? ` ${q.donnees.unite}` : '';
    const n = lireNombre(reponse);
    return { donnee: reponse === null || reponse === undefined || reponse === '' ? null : `${n === null ? nettoyer(reponse) : String(n).replace('.', ',')}${u}`,
      bonne: `${String(q.donnees.reponse).replace('.', ',')}${u}` };
  },
  verifier(q) {
    const r = (q.donnees || {}).reponse;
    if (r === undefined || r === null || r === '' || !Number.isFinite(Number(r))) return 'réponse numérique manquante';
    return null;
  },
};

// ---------- 4. Blocs à assembler (Blockly, module du distributeur de céréales) ----------
const TAILLE_MAX_PROGRAMME = 60000; // caractères de la sauvegarde Blockly envoyée par l'élève
function lireProgramme(reponse) {
  try {
    const texte = typeof reponse === 'string' ? reponse : JSON.stringify(reponse);
    if (!texte || texte.length > TAILLE_MAX_PROGRAMME) return null;
    return blocs.depuisBlockly(typeof reponse === 'string' ? JSON.parse(reponse) : reponse);
  } catch {
    return null;
  }
}
const blocsType = {
  preparer(q) {
    const autorises = (q.donnees.blocs || blocs.BLOCS_DISPONIBLES).filter((b) => blocs.BLOCS_DISPONIBLES.includes(b));
    return { vue: { blocs: autorises, broches: Boolean(q.donnees.broches) }, prive: {} };
  },
  valider(q, reponse) {
    const lu = lireProgramme(reponse);
    return Boolean(lu) && lu.incomplets === 0 && blocs.programmeAccepte(lu.programme, q.donnees.sequences, { broches: Boolean(q.donnees.broches) });
  },
  textes(q, reponse) {
    const lu = lireProgramme(reponse);
    return { donnee: lu ? blocs.texteProgramme(lu.programme) : null, bonne: blocs.texteProgramme(q.donnees.sequences[0]) };
  },
  verifier(q) {
    const d = q.donnees || {};
    const s = d.sequences;
    if (!Array.isArray(s) || !s.length || !s.every(Array.isArray)) return 'aucune séquence acceptée';
    if (s.some((x) => !x.length)) return 'une séquence acceptée est vide';
    if (d.broches && s.some((x) => blocs.brochesManquantes(x))) return 'broches activées : choisir la broche de chaque bloc dans les séquences acceptées';
    return null;
  },
};

// ---------- 5. Programme à compléter ----------
// Deux versions : « texte » (trous à remplir par liste déroulante ou glisser-déposer)
// et « blocs » (programme Blockly de départ avec des trous, à compléter avec d'autres blocs ou des valeurs).
const MARQUEUR = '___';
const completerTexte = {
  preparer(q, rng) {
    const d = q.donnees;
    const segments = d.texte.split(MARQUEUR);
    const mode = d.mode === 'glisser' ? 'glisser' : 'liste';
    const vue = { segments, mode };
    if (mode === 'liste') {
      vue.options = d.trous.map((t) => melanger([t.bonne, ...(t.distracteurs || [])], rng));
    } else {
      // Glisser-déposer : une seule réserve d'étiquettes pour tous les trous.
      const toutes = [];
      for (const t of d.trous) for (const x of [t.bonne, ...(t.distracteurs || [])]) if (!toutes.some((y) => pareil(x, y))) toutes.push(x);
      vue.etiquettes = melanger(toutes, rng);
    }
    return { vue, prive: {} };
  },
  valider(q, reponse) {
    const trous = q.donnees.trous;
    return Array.isArray(reponse) && reponse.length === trous.length && trous.every((t, i) => pareil(reponse[i], t.bonne));
  },
  textes(q, reponse) {
    const remplir = (valeurs) => q.donnees.texte.split(MARQUEUR)
      .map((s, i) => (i === 0 ? s : `[${valeurs[i - 1] ?? '…'}]${s}`)).join('').replace(/\s*\n\s*/g, ' · ');
    return { donnee: Array.isArray(reponse) ? remplir(reponse.map(nettoyer)) : null, bonne: remplir(q.donnees.trous.map((t) => t.bonne)) };
  },
  verifier(q) {
    const d = q.donnees || {};
    if (typeof d.texte !== 'string') return 'programme manquant';
    const n = d.texte.split(MARQUEUR).length - 1;
    if (n === 0) return `aucun trou (écrire ${MARQUEUR} à la place de chaque trou)`;
    if (!Array.isArray(d.trous) || d.trous.length !== n) return `${n} trou(s) dans le programme mais ${(d.trous || []).length} réponse(s)`;
    if (d.trous.some((t) => !nettoyer(t.bonne))) return 'bonne réponse d\'un trou manquante';
    return null;
  },
};

// Version blocs : le programme de départ (verrouillé, avec ses trous) est envoyé à l'élève ;
// la validation est celle des blocs (séquences acceptées, écritures équivalentes).
const completerBlocs = {
  preparer(q) {
    const { vue } = blocsType.preparer({ donnees: { ...q.donnees, blocs: q.donnees.blocs || [] } });
    return { vue: { ...vue, version: 'blocs', depart: blocs.versBlockly(q.donnees.depart, { verrouiller: true }) }, prive: {} };
  },
  valider: (q, reponse) => blocsType.valider(q, reponse),
  textes: (q, reponse) => blocsType.textes(q, reponse),
  verifier(q) {
    const d = q.donnees || {};
    if (!Array.isArray(d.sequences) || !d.sequences.length) return 'solution manquante : assembler le programme complet';
    const pb = blocsType.verifier(q);
    if (pb) return pb;
    if (!Array.isArray(d.depart) || !d.depart.length) return 'programme de départ manquant : préparer les trous';
    if (!blocs.compterTrous(d.depart)) return 'le programme de départ n\'a aucun trou';
    return null;
  },
};

const version = (q) => (q.donnees && q.donnees.version === 'blocs' ? completerBlocs : completerTexte);
const completer = {
  preparer: (q, rng) => version(q).preparer(q, rng),
  valider: (q, reponse, prive) => version(q).valider(q, reponse, prive),
  textes: (q, reponse, prive) => version(q).textes(q, reponse, prive),
  verifier: (q) => version(q).verifier(q),
};

const TYPES = { qcm, ordre, calcul, blocs: blocsType, completer };

function typeJouable(q) {
  const t = TYPES[q.type];
  return Boolean(t) && !t.verifier(q);
}

module.exports = { TYPES, typeJouable, melanger, lireNombre };
