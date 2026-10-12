'use strict';

// Paires obstacle / solution modifiables par le professeur.
// Il saisit un nom et un genre ; les formes utilisées dans le fil d'actions en sont déduites :
// « un trou » (un), « le trou » (le), « son pont » (sa).

const GENRES = {
  m: { un: 'un', le: 'le', sa: 'son' },
  f: { un: 'une', le: 'la', sa: 'sa' },
  pl: { un: 'des', le: 'les', sa: 'ses' },
  'part-f': { un: 'de la', le: 'la', sa: 'sa' }, // de la boue
  'part-m': { un: 'du', le: 'le', sa: 'son' },   // du sable
};

const commenceParVoyelle = (mot) => /^[aeiouyhàâéèêëîïôöûü]/i.test(mot);

function formes(nom, genre) {
  const g = GENRES[genre] || GENRES.m;
  const elision = commenceParVoyelle(nom) && genre !== 'pl';
  return {
    un: genre === 'part-m' && elision ? `de l'${nom}` : genre === 'part-f' && elision ? `de l'${nom}` : `${g.un} ${nom}`,
    le: elision ? `l'${nom}` : `${g.le} ${nom}`,
    sa: elision && g.sa === 'sa' ? `son ${nom}` : `${g.sa} ${nom}`,
  };
}

/** Genre d'une forme existante (« une échelle » → f), pour pré-remplir l'éditeur. */
function genreDe(element) {
  const un = String(element.un || '');
  if (/^des /.test(un)) return 'pl';
  if (/^de la /.test(un)) return 'part-f';
  if (/^du /.test(un)) return 'part-m';
  if (/^une /.test(un)) return 'f';
  return 'm';
}

const slug = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);

/** Nettoie la liste envoyée par l'admin. Les identifiants existants sont gardés (ils choisissent l'icône). */
function nettoyerPaires(entree, erreur) {
  if (!Array.isArray(entree)) erreur('Liste de paires illisible.');
  if (entree.length < 2) erreur('Il faut au moins 2 paires obstacle / solution.');
  if (entree.length > 8) erreur('8 paires au plus.');
  const ids = new Set();
  return entree.map((p, i) => {
    const element = (e, prefixe) => {
      const nom = String((e && e.nom) || '').trim().replace(/\s+/g, ' ').slice(0, 24).toLowerCase();
      if (!nom) erreur(`Paire ${i + 1} : nom ${prefixe === 'o' ? 'de l\'obstacle' : 'de la solution'} manquant.`);
      let id = e && typeof e.id === 'string' && /^[a-z0-9-]{1,40}$/.test(e.id) ? e.id : `${prefixe}-${slug(nom)}`;
      while (ids.has(id)) id += '-2';
      ids.add(id);
      return { id, nom, ...formes(nom, e && e.genre) };
    };
    return { obstacle: element(p && p.obstacle, 'o'), solution: element(p && p.solution, 's') };
  });
}

module.exports = { nettoyerPaires, genreDe, formes, GENRES };
