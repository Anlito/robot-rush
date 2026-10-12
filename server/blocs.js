'use strict';

// Questions « blocs à assembler » : lecture et comparaison des programmes Blockly, côté serveur.
//
// Repris du projet « distributeur de céréales » (site/js/moteur/programme.js) : le format simplifié
// des programmes et la conversion depuis / vers la sauvegarde JSON de Blockly.
// Adaptations pour Robot Rush :
//  - un seul chapeau « programme » (au lieu de « Au démarrage » et « Répéter indéfiniment ») ;
//  - nouveau bloc « repeter » (répéter N fois) ;
//  - pas de broches : les questions portent sur la logique, pas sur le câblage ;
//  - normalisation pour accepter les écritures équivalentes d'un même programme.
//
// Programme simplifié (liste d'instructions) :
//   { bloc: 'led_etat', etat: 1 }              { bloc: 'attendre', duree: 2 }
//   { bloc: 'servo_angle', angle: 90 }         { bloc: 'repeter', fois: 5, faire: [...] }
//   { bloc: 'si_alors', condition, alors: [...] }
//   { bloc: 'si_sinon', condition, alors: [...], sinon: [...] }
//   { bloc: 'affecter', variable: 'CHOIX', valeur }
// Expressions : un nombre, { bloc: 'bouton_etat' }, { bloc: 'valeur_haut_bas', valeur: 1 },
//   { bloc: 'comparaison', op: '=' | '≠', a, b }, { bloc: 'variable', variable: 'CHOIX' }

const BLOCS_DISPONIBLES = [
  'led_etat', 'attendre', 'servo_angle', 'repeter', 'si_alors', 'si_sinon',
  'bouton_etat', 'valeur_haut_bas', 'comparaison', 'affecter', 'variable', 'nombre',
];

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

/** Lit une sauvegarde Blockly. Renvoie le programme, le nombre de blocs hors programme et d'entrées vides. */
function depuisBlockly(sauvegarde) {
  const hauts = (sauvegarde && sauvegarde.blocks && Array.isArray(sauvegarde.blocks.blocks)) ? sauvegarde.blocks.blocks : [];
  let compte = 0;
  let incomplets = 0;
  let horsProgramme = 0;
  let programme = null;

  function expression(bloc) {
    if (!bloc) { incomplets++; return null; }
    if (++compte > MAX_BLOCS) throw new Error('programme trop grand');
    switch (bloc.type) {
      case 'nombre': return Number(champ(bloc, 'NUM')) || 0;
      case 'variable': return { bloc: 'variable', variable: String(champ(bloc, 'VAR') || 'CHOIX') };
      case 'bouton_etat': return { bloc: 'bouton_etat' };
      case 'valeur_haut_bas': return { bloc: 'valeur_haut_bas', valeur: Number(champ(bloc, 'VALEUR')) ? 1 : 0 };
      case 'comparaison':
        return { bloc: 'comparaison', op: champ(bloc, 'OP') === 'NEQ' ? '≠' : '=',
          a: expression(entree(bloc, 'A')), b: expression(entree(bloc, 'B')) };
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
      case 'led_etat': return { bloc: 'led_etat', etat: Number(champ(b, 'ETAT')) ? 1 : 0 };
      case 'attendre': return { bloc: 'attendre', duree: expression(entree(b, 'DUREE')) };
      case 'servo_angle': return { bloc: 'servo_angle', angle: expression(entree(b, 'ANGLE')) };
      case 'repeter': return { bloc: 'repeter', fois: expression(entree(b, 'FOIS')), faire: pile(entree(b, 'FAIRE')) };
      case 'affecter': return { bloc: 'affecter', variable: String(champ(b, 'VAR') || 'CHOIX'), valeur: expression(entree(b, 'VALEUR')) };
      case 'si_alors': return { bloc: 'si_alors', condition: expression(entree(b, 'CONDITION')), alors: pile(entree(b, 'ALORS')) };
      case 'si_sinon':
        return { bloc: 'si_sinon', condition: expression(entree(b, 'CONDITION')),
          alors: pile(entree(b, 'ALORS')), sinon: pile(entree(b, 'SINON')) };
      default: return null;
    }
  }

  for (const b of hauts) {
    if (b && b.type === 'programme' && !programme) programme = pile(entree(b, 'DO'));
    else horsProgramme++;
  }
  return { programme: programme || [], horsProgramme, incomplets };
}

// ---------- Programme simplifié → Blockly (aperçu, élèves factices) ----------

function versBlockly(programme) {
  let n = 0;
  const id = () => `b${++n}`;
  const nombre = (v) => ({ type: 'nombre', id: id(), fields: { NUM: Number(v) || 0 } });

  function expression(e) {
    if (e === null || e === undefined) return null;
    if (typeof e === 'number') return nombre(e);
    switch (e.bloc) {
      case 'nombre': return nombre(e.valeur);
      case 'variable': return { type: 'variable', id: id(), fields: { VAR: e.variable || 'CHOIX' } };
      case 'bouton_etat': return { type: 'bouton_etat', id: id() };
      case 'valeur_haut_bas': return { type: 'valeur_haut_bas', id: id(), fields: { VALEUR: e.valeur ? '1' : '0' } };
      case 'comparaison': {
        const b = { type: 'comparaison', id: id(), fields: { OP: e.op === '≠' ? 'NEQ' : 'EQ' }, inputs: {} };
        const a = expression(e.a);
        const c = expression(e.b);
        if (a) b.inputs.A = { block: a };
        if (c) b.inputs.B = { block: c };
        return b;
      }
      default: return null;
    }
  }

  function entreeNombre(bloc, nom, e) {
    const fantome = nombre(ENTREES_NOMBRE[bloc.type][nom]);
    if (typeof e === 'number') bloc.inputs[nom] = { shadow: nombre(e) };
    else {
      bloc.inputs[nom] = { shadow: fantome };
      const b = expression(e);
      if (b) bloc.inputs[nom].block = b;
    }
  }

  function instruction(i) {
    const b = { type: i.bloc, id: id(), inputs: {} };
    switch (i.bloc) {
      case 'led_etat': b.fields = { ETAT: i.etat ? '1' : '0' }; break;
      case 'attendre': entreeNombre(b, 'DUREE', i.duree); break;
      case 'servo_angle': entreeNombre(b, 'ANGLE', i.angle); break;
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
    return b;
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
  const p = pile(programme);
  if (p) chapeau.inputs = { DO: { block: p } };
  return { blocks: { languageVersion: 0, blocks: [chapeau] } };
}

// ---------- Normalisation : écritures équivalentes → même forme ----------

// Condition « état du bouton » : bouton, bouton = HAUT, HAUT = bouton, bouton ≠ BAS → { bouton: 1 }.
function normaliserCondition(c) {
  if (c && c.bloc === 'bouton_etat') return { bouton: 1 };
  if (c && c.bloc === 'valeur_haut_bas') return { constante: c.valeur };
  if (c && c.bloc === 'comparaison') {
    const [x, y] = [c.a, c.b];
    const estBouton = (e) => e && e.bloc === 'bouton_etat';
    const estValeur = (e) => e && e.bloc === 'valeur_haut_bas';
    let bouton = null;
    let valeur = null;
    if (estBouton(x) && estValeur(y)) { bouton = x; valeur = y.valeur; }
    if (estBouton(y) && estValeur(x)) { bouton = y; valeur = x.valeur; }
    if (bouton) return { bouton: c.op === '=' ? valeur : 1 - valeur };
    return { comparaison: c.op, a: normaliserValeur(x), b: normaliserValeur(y) };
  }
  return { valeur: normaliserValeur(c) };
}

function normaliserValeur(e) {
  if (e === null || e === undefined) return null;
  if (typeof e === 'number') return e;
  if (e.bloc === 'nombre') return Number(e.valeur) || 0;
  if (e.bloc === 'valeur_haut_bas') return e.valeur;
  if (e.bloc === 'bouton_etat') return { bouton: 1 };
  if (e.bloc === 'variable') return { variable: e.variable };
  return normaliserCondition(e);
}

function normaliser(liste) {
  return (liste || []).map((i) => {
    switch (i.bloc) {
      case 'led_etat': return { led: i.etat ? 1 : 0 };
      case 'attendre': return { attendre: normaliserValeur(i.duree) };
      case 'servo_angle': return { servo: normaliserValeur(i.angle) };
      case 'affecter': return { affecter: i.variable, valeur: normaliserValeur(i.valeur) };
      case 'repeter': return { repeter: normaliserValeur(i.fois), faire: normaliser(i.faire) };
      case 'si_alors':
      case 'si_sinon': {
        let condition = normaliserCondition(i.condition);
        let alors = normaliser(i.alors);
        let sinon = normaliser(i.sinon || []);
        // « si bouton relâché alors A sinon B » = « si bouton appuyé alors B sinon A »
        if (condition.bouton === 0 && sinon.length) {
          condition = { bouton: 1 };
          [alors, sinon] = [sinon, alors];
        }
        return sinon.length ? { si: condition, alors, sinon } : { si: condition, alors };
      }
      default: return { inconnu: i.bloc };
    }
  });
}

const cle = (programme) => JSON.stringify(normaliser(programme));

/** true si le programme correspond à l'une des séquences acceptées. */
function programmeAccepte(programme, sequences) {
  const k = cle(programme);
  return (sequences || []).some((s) => cle(s) === k);
}

// ---------- Texte lisible (correction affichée à l'élève) ----------

function texteValeur(e) {
  if (e === null || e === undefined) return '?';
  if (typeof e === 'number') return String(e).replace('.', ',');
  switch (e.bloc) {
    case 'nombre': return String(e.valeur).replace('.', ',');
    case 'bouton_etat': return 'bouton appuyé';
    case 'valeur_haut_bas': return e.valeur ? 'HAUT' : 'BAS';
    case 'variable': return e.variable;
    case 'comparaison': {
      const n = normaliserCondition(e);
      if ('bouton' in n) return n.bouton ? 'bouton appuyé' : 'bouton relâché';
      return `${texteValeur(e.a)} ${e.op} ${texteValeur(e.b)}`;
    }
    default: return '?';
  }
}

function texteProgramme(liste) {
  return (liste || []).map((i) => {
    switch (i.bloc) {
      case 'led_etat': return i.etat ? 'allumer la LED' : 'éteindre la LED';
      case 'attendre': return `attendre ${texteValeur(i.duree)} s`;
      case 'servo_angle': return `servo à ${texteValeur(i.angle)}°`;
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
  BLOCS_DISPONIBLES, depuisBlockly, versBlockly, normaliser, programmeAccepte, texteProgramme,
};
