'use strict';

// Questions de blocs (Blockly) : lecture et comparaison des programmes, côté serveur.
//
// Repris du projet « distributeur de céréales » (site/js/moteur/programme.js) : le format simplifié
// des programmes et la conversion depuis / vers la sauvegarde JSON de Blockly.
// Adaptations pour Robot Rush :
//  - un seul chapeau « programme » (au lieu de « Au démarrage » et « Répéter indéfiniment ») ;
//  - nouveau bloc « repeter » (répéter N fois) ;
//  - broches au choix de la question : sans broches, les questions portent sur la logique seule ;
//  - trous (programme à compléter) : bloc manquant, nombre « ? », menu sur « ? », condition vide ;
//  - normalisation pour accepter les écritures équivalentes d'un même programme.
//
// Programme simplifié (liste d'instructions) :
//   { bloc: 'led_etat', etat: 1, broche: 'D3' }  { bloc: 'attendre', duree: 2 }
//   { bloc: 'servo_angle', angle: 90, broche: 'D6' }  { bloc: 'repeter', fois: 5, faire: [...] }
//   { bloc: 'si_alors', condition, alors: [...] }
//   { bloc: 'si_sinon', condition, alors: [...], sinon: [...] }
//   { bloc: 'affecter', variable: 'CHOIX', valeur }
// Expressions : un nombre, { bloc: 'bouton_etat', broche: 'D8' }, { bloc: 'valeur_haut_bas', valeur: 1 },
//   { bloc: 'comparaison', op: '=' | '≠', a, b }, { bloc: 'variable', variable: 'CHOIX' }
// La broche n'est présente que si le bloc a un menu de broche (question « avec broches »).
// Trous : { bloc: 'trou' } (bloc manquant, ou nombre « ? »), '?' dans un menu (état, broche, opérateur),
//   null pour une entrée vide (condition à placer). Un programme avec un trou est incomplet.

const BLOCS_DISPONIBLES = [
  'led_etat', 'attendre', 'servo_angle', 'repeter', 'si_alors', 'si_sinon',
  'bouton_etat', 'valeur_haut_bas', 'comparaison', 'affecter', 'variable', 'nombre',
];

// Broches proposées dans les menus (comme l'atelier céréales).
const NUMERIQUES = ['D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13'];
const BROCHES = { led_etat: NUMERIQUES, bouton_etat: NUMERIQUES, servo_angle: ['D5', 'D6'] };

const TROU = '?';
const estTrou = (e) => Boolean(e) && typeof e === 'object' && e.bloc === 'trou';

// Entrées « nombre » et valeur du bloc fantôme (les mêmes que dans la palette de l'élève).
const ENTREES_NOMBRE = {
  attendre: { DUREE: 1 },
  servo_angle: { ANGLE: 90 },
  repeter: { FOIS: 2 },
  affecter: { VALEUR: 0 },
};

const MAX_BLOCS = 200;

// ---------- Blockly → programme simplifié ----------

function entree(bloc, nom) {
  const e = bloc.inputs && bloc.inputs[nom];
  return e ? e.block || e.shadow || null : null;
}

function champ(bloc, nom) {
  return bloc.fields ? bloc.fields[nom] : undefined;
}

/**
 * Lit une sauvegarde Blockly. Renvoie le programme, le nombre de blocs hors programme
 * et le nombre de cases incomplètes (entrée vide, trou, « ? »).
 */
function depuisBlockly(sauvegarde) {
  const hauts = (sauvegarde && sauvegarde.blocks && Array.isArray(sauvegarde.blocks.blocks)) ? sauvegarde.blocks.blocks : [];
  let compte = 0;
  let incomplets = 0;
  let horsProgramme = 0;
  let programme = null;

  const trou = () => { incomplets++; return TROU; };
  const hautBas = (v) => (String(v) === '1' ? 1 : String(v) === '0' ? 0 : trou());
  // Broche : absente si le bloc n'a pas de menu de broche.
  function avecBroche(objet, b) {
    const v = champ(b, 'BROCHE');
    if (v !== undefined) objet.broche = BROCHES[b.type].includes(v) ? v : trou();
    return objet;
  }

  function expression(bloc) {
    if (!bloc) { incomplets++; return null; }
    if (++compte > MAX_BLOCS) throw new Error('programme trop grand');
    switch (bloc.type) {
      case 'nombre': {
        const v = champ(bloc, 'NUM');
        const n = Number(v);
        if (v === TROU || v === '' || v === null || v === undefined || !Number.isFinite(n)) { incomplets++; return { bloc: 'trou' }; }
        return n;
      }
      case 'variable': return { bloc: 'variable', variable: String(champ(bloc, 'VAR') || 'CHOIX') };
      case 'bouton_etat': return avecBroche({ bloc: 'bouton_etat' }, bloc);
      case 'valeur_haut_bas': return { bloc: 'valeur_haut_bas', valeur: hautBas(champ(bloc, 'VALEUR')) };
      case 'comparaison': {
        const op = champ(bloc, 'OP');
        return { bloc: 'comparaison', op: op === 'NEQ' ? '≠' : op === 'EQ' ? '=' : trou(),
          a: expression(entree(bloc, 'A')), b: expression(entree(bloc, 'B')) };
      }
      default: incomplets++; return null;
    }
  }

  function pile(bloc) {
    const liste = [];
    for (let b = bloc; b; b = b.next && b.next.block) {
      if (++compte > MAX_BLOCS) throw new Error('programme trop grand');
      const i = instruction(b);
      if (i) liste.push(i);
    }
    return liste;
  }

  function instruction(b) {
    switch (b.type) {
      case 'led_etat': return avecBroche({ bloc: 'led_etat', etat: hautBas(champ(b, 'ETAT')) }, b);
      case 'attendre': return { bloc: 'attendre', duree: expression(entree(b, 'DUREE')) };
      case 'servo_angle': return avecBroche({ bloc: 'servo_angle', angle: expression(entree(b, 'ANGLE')) }, b);
      case 'repeter': return { bloc: 'repeter', fois: expression(entree(b, 'FOIS')), faire: pile(entree(b, 'FAIRE')) };
      case 'affecter': return { bloc: 'affecter', variable: String(champ(b, 'VAR') || 'CHOIX'), valeur: expression(entree(b, 'VALEUR')) };
      case 'si_alors': return { bloc: 'si_alors', condition: expression(entree(b, 'CONDITION')), alors: pile(entree(b, 'ALORS')) };
      case 'si_sinon':
        return { bloc: 'si_sinon', condition: expression(entree(b, 'CONDITION')),
          alors: pile(entree(b, 'ALORS')), sinon: pile(entree(b, 'SINON')) };
      case 'trou_instruction': incomplets++; return { bloc: 'trou' };
      default: return null;
    }
  }

  for (const b of hauts) {
    if (b && b.type === 'programme' && !programme) programme = pile(entree(b, 'DO'));
    else horsProgramme++;
  }
  return { programme: programme || [], horsProgramme, incomplets };
}

// ---------- Programme simplifié → Blockly ----------

/**
 * verrouiller : programme de départ d'une question à compléter. Les blocs donnés ne se déplacent
 * ni ne se suppriment, et leurs cases ne se modifient pas, sauf les trous (« ? », bloc manquant).
 */
function versBlockly(programme, { verrouiller = false } = {}) {
  let n = 0;
  const id = () => `b${++n}`;
  const nombre = (v) => ({ type: 'nombre', id: id(), fields: { NUM: estTrou(v) ? TROU : Number(v) || 0 } });
  const hautBas = (v) => (v === TROU ? TROU : v ? '1' : '0');
  const verrou = (b) => {
    if (!verrouiller) return b;
    b.movable = false;
    b.deletable = false;
    if (!Object.values(b.fields || {}).includes(TROU)) b.editable = false;
    return b;
  };
  const broche = (b, e) => { if (e.broche !== undefined) b.fields = { ...b.fields, BROCHE: e.broche }; };

  function expression(e) {
    if (e === null || e === undefined) return null;
    if (typeof e === 'number' || estTrou(e)) return verrou(nombre(e));
    switch (e.bloc) {
      case 'nombre': return verrou(nombre(e.valeur));
      case 'variable': return verrou({ type: 'variable', id: id(), fields: { VAR: e.variable || 'CHOIX' } });
      case 'bouton_etat': { const b = { type: 'bouton_etat', id: id() }; broche(b, e); return verrou(b); }
      case 'valeur_haut_bas': return verrou({ type: 'valeur_haut_bas', id: id(), fields: { VALEUR: hautBas(e.valeur) } });
      case 'comparaison': {
        const b = { type: 'comparaison', id: id(), fields: { OP: e.op === '≠' ? 'NEQ' : e.op === '=' ? 'EQ' : TROU }, inputs: {} };
        const a = expression(e.a);
        const c = expression(e.b);
        if (a) b.inputs.A = { block: a };
        if (c) b.inputs.B = { block: c };
        return verrou(b);
      }
      default: return null;
    }
  }

  function entreeNombre(bloc, nom, e) {
    if (typeof e === 'number' || estTrou(e)) bloc.inputs[nom] = { shadow: verrou(nombre(e)) };
    else {
      bloc.inputs[nom] = { shadow: verrou(nombre(ENTREES_NOMBRE[bloc.type][nom])) };
      const b = expression(e);
      if (b) bloc.inputs[nom].block = b;
    }
  }

  function instruction(i) {
    if (estTrou(i)) return { type: 'trou_instruction', id: id() };
    const b = { type: i.bloc, id: id(), inputs: {} };
    switch (i.bloc) {
      case 'led_etat': b.fields = { ETAT: hautBas(i.etat) }; broche(b, i); break;
      case 'attendre': entreeNombre(b, 'DUREE', i.duree); break;
      case 'servo_angle': broche(b, i); entreeNombre(b, 'ANGLE', i.angle); break;
      case 'affecter': b.fields = { VAR: i.variable || 'CHOIX' }; entreeNombre(b, 'VALEUR', i.valeur); break;
      case 'repeter': {
        entreeNombre(b, 'FOIS', i.fois);
        const p = pile(i.faire);
        if (p) b.inputs.FAIRE = { block: p };
        break;
      }
      case 'si_alors':
      case 'si_sinon': {
        const c = expression(i.condition);
        if (c) b.inputs.CONDITION = { block: c };
        const alors = pile(i.alors);
        if (alors) b.inputs.ALORS = { block: alors };
        if (i.bloc === 'si_sinon') {
          const sinon = pile(i.sinon);
          if (sinon) b.inputs.SINON = { block: sinon };
        }
        break;
      }
      default: return null;
    }
    if (!Object.keys(b.inputs).length) delete b.inputs;
    return verrou(b);
  }

  function pile(liste) {
    let premier = null;
    let dernier = null;
    for (const i of liste || []) {
      const b = instruction(i);
      if (!b) continue;
      if (dernier) dernier.next = { block: b };
      else premier = b;
      dernier = b;
    }
    return premier;
  }

  const chapeau = { type: 'programme', id: 'programme', x: 24, y: 24, deletable: false };
  if (verrouiller) chapeau.movable = false;
  const p = pile(programme);
  if (p) chapeau.inputs = { DO: { block: p } };
  return { blocks: { languageVersion: 0, blocks: [chapeau] } };
}

// ---------- Parcours d'un programme ----------

/** Appelle f sur chaque instruction et chaque expression du programme. */
function parcourir(liste, f) {
  const expr = (e) => {
    if (!e || typeof e !== 'object') return;
    f(e);
    if (e.bloc === 'comparaison') { expr(e.a); expr(e.b); }
  };
  for (const i of liste || []) {
    f(i);
    for (const k of ['duree', 'angle', 'fois', 'valeur', 'condition']) if (k in i) expr(i[k]);
    for (const k of ['faire', 'alors', 'sinon']) if (Array.isArray(i[k])) parcourir(i[k], f);
  }
}

/** Nombre de trous à compléter : blocs manquants, « ? », conditions vides. */
function compterTrous(programme) {
  return depuisBlockly(versBlockly(programme)).incomplets;
}

/** true si un bloc qui se branche (LED, bouton, servo) n'a pas de broche choisie. */
function brochesManquantes(programme) {
  let manque = false;
  parcourir(programme, (x) => { if (BROCHES[x.bloc] && (x.broche === undefined || x.broche === TROU)) manque = true; });
  return manque;
}

// ---------- Normalisation : écritures équivalentes → même forme ----------

/** broches : les broches comptent (question « avec broches ») ; sinon elles sont ignorées. */
function normaliser(liste, { broches = false } = {}) {
  const avecBroche = (objet, e) => (broches ? { ...objet, broche: e.broche } : objet);

  // Condition « état du bouton » : bouton, bouton = HAUT, HAUT = bouton, bouton ≠ BAS → { bouton: 1 }.
  function condition(c) {
    if (c && c.bloc === 'bouton_etat') return avecBroche({ bouton: 1 }, c);
    if (c && c.bloc === 'valeur_haut_bas') return { constante: c.valeur };
    if (c && c.bloc === 'comparaison') {
      const [x, y] = [c.a, c.b];
      const estBouton = (e) => e && e.bloc === 'bouton_etat';
      const estValeur = (e) => e && e.bloc === 'valeur_haut_bas' && e.valeur !== TROU;
      let bouton = null;
      let valeur = null;
      if (estBouton(x) && estValeur(y)) { bouton = x; valeur = y.valeur; }
      if (estBouton(y) && estValeur(x)) { bouton = y; valeur = x.valeur; }
      if (bouton && c.op !== TROU) return avecBroche({ bouton: c.op === '=' ? valeur : 1 - valeur }, bouton);
      return { comparaison: c.op, a: valeur_(x), b: valeur_(y) };
    }
    return { valeur: valeur_(c) };
  }

  function valeur_(e) {
    if (e === null || e === undefined) return null;
    if (typeof e === 'number') return e;
    if (estTrou(e)) return TROU;
    if (e.bloc === 'nombre') return Number(e.valeur) || 0;
    if (e.bloc === 'valeur_haut_bas') return e.valeur;
    if (e.bloc === 'bouton_etat') return avecBroche({ bouton: 1 }, e);
    if (e.bloc === 'variable') return { variable: e.variable };
    return condition(e);
  }

  function pile(l) {
    return (l || []).map((i) => {
      switch (i.bloc) {
        case 'led_etat': return avecBroche({ led: i.etat }, i);
        case 'attendre': return { attendre: valeur_(i.duree) };
        case 'servo_angle': return avecBroche({ servo: valeur_(i.angle) }, i);
        case 'affecter': return { affecter: i.variable, valeur: valeur_(i.valeur) };
        case 'repeter': return { repeter: valeur_(i.fois), faire: pile(i.faire) };
        case 'si_alors':
        case 'si_sinon': {
          let si = condition(i.condition);
          let alors = pile(i.alors);
          let sinon = pile(i.sinon || []);
          // « si bouton relâché alors A sinon B » = « si bouton appuyé alors B sinon A »
          if (si.bouton === 0 && sinon.length) {
            si = { ...si, bouton: 1 };
            [alors, sinon] = [sinon, alors];
          }
          return sinon.length ? { si, alors, sinon } : { si, alors };
        }
        default: return { inconnu: i.bloc };
      }
    });
  }
  return pile(liste);
}

const cle = (programme, options) => JSON.stringify(normaliser(programme, options));

/** true si le programme correspond à l'une des séquences acceptées. */
function programmeAccepte(programme, sequences, options) {
  const k = cle(programme, options);
  return (sequences || []).some((s) => cle(s, options) === k);
}

// ---------- Texte lisible (correction affichée à l'élève) ----------

const surBroche = (e) => (e && e.broche !== undefined ? ` (${e.broche})` : '');

function texteValeur(e) {
  if (e === null || e === undefined) return '?';
  if (typeof e === 'number') return String(e).replace('.', ',');
  switch (e.bloc) {
    case 'trou': return '?';
    case 'nombre': return String(e.valeur).replace('.', ',');
    case 'bouton_etat': return `bouton${surBroche(e)} appuyé`;
    case 'valeur_haut_bas': return e.valeur === TROU ? '?' : e.valeur ? 'HAUT' : 'BAS';
    case 'variable': return e.variable;
    case 'comparaison': {
      const n = normaliser([{ bloc: 'si_alors', condition: e, alors: [] }])[0].si;
      const bouton = [e.a, e.b].find((x) => x && x.bloc === 'bouton_etat');
      if ('bouton' in n) return `bouton${surBroche(bouton)} ${n.bouton ? 'appuyé' : 'relâché'}`;
      return `${texteValeur(e.a)} ${e.op} ${texteValeur(e.b)}`;
    }
    default: return '?';
  }
}

function texteProgramme(liste) {
  return (liste || []).map((i) => {
    switch (i.bloc) {
      case 'trou': return '[bloc manquant]';
      case 'led_etat': return `${i.etat === TROU ? 'LED à l\'état ?' : i.etat ? 'allumer la LED' : 'éteindre la LED'}${surBroche(i)}`;
      case 'attendre': return `attendre ${texteValeur(i.duree)} s`;
      case 'servo_angle': return `servo${surBroche(i)} à ${texteValeur(i.angle)}°`;
      case 'affecter': return `${i.variable} ← ${texteValeur(i.valeur)}`;
      case 'repeter': return `répéter ${texteValeur(i.fois)} fois { ${texteProgramme(i.faire)} }`;
      case 'si_alors': return `si ${texteValeur(i.condition)} alors { ${texteProgramme(i.alors)} }`;
      case 'si_sinon':
        return `si ${texteValeur(i.condition)} alors { ${texteProgramme(i.alors)} } sinon { ${texteProgramme(i.sinon)} }`;
      default: return '?';
    }
  }).join(' → ') || '(programme vide)';
}

module.exports = {
  BLOCS_DISPONIBLES, BROCHES, depuisBlockly, versBlockly, normaliser, programmeAccepte, texteProgramme,
  compterTrous, brochesManquantes,
};
