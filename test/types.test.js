'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TYPES } = require('../server/types');
const blocs = require('../server/blocs');
const seed = require('../seed/questions.json');

const q = (id) => seed.find((x) => x.id === id);

const preparer = (question) => TYPES[question.type].preparer(question, Math.random);

test('toutes les questions de test sont valides', () => {
  for (const x of seed) assert.equal(TYPES[x.type].verifier(x), null, x.id);
});

test('aucune vue élève ne contient la réponse', () => {
  for (const x of seed) {
    const vue = JSON.stringify(preparer(x).vue);
    assert.ok(!vue.includes('bonne'), x.id);
    assert.ok(!vue.includes('sequences'), x.id);
    if (x.type === 'calcul') assert.ok(!vue.includes(String(x.donnees.reponse)), x.id);
  }
});

test('ordre : mélangé au départ, validé sur les textes (étapes identiques interchangeables)', () => {
  const question = q('q-009'); // « Attendre 1 s » apparaît deux fois
  for (let essai = 0; essai < 20; essai++) {
    const { vue, prive } = preparer(question);
    assert.notDeepEqual(vue.elements, question.donnees.elements);
    // On remet dans l'ordre en cherchant chaque texte attendu parmi les positions affichées.
    const pris = new Set();
    const reponse = question.donnees.elements.map((t) => {
      const i = vue.elements.findIndex((x, k) => x === t && !pris.has(k));
      pris.add(i);
      return i;
    });
    assert.equal(TYPES.ordre.valider(question, reponse, prive), true);
    assert.equal(TYPES.ordre.valider(question, reponse.slice().reverse(), prive), false);
  }
  const { prive } = preparer(question);
  assert.equal(TYPES.ordre.valider(question, [0, 0, 1, 2], prive), false, 'doublon refusé');
  assert.equal(TYPES.ordre.valider(question, 'n\'importe quoi', prive), false);
});

test('calcul : virgule, point, espaces acceptés ; texte refusé', () => {
  const question = q('q-010');
  for (const r of ['11', ' 11 ', '11,0', '11.0']) assert.equal(TYPES.calcul.valider(question, r), true, r);
  for (const r of ['12', 'onze', '', null, '1 1x']) assert.equal(TYPES.calcul.valider(question, r), false, String(r));
  assert.equal(TYPES.calcul.textes(q('q-011'), '90').bonne, '100 cm');
});

test('programme à compléter : liste et glisser-déposer, casse ignorée', () => {
  const liste = q('q-019');
  const v1 = preparer(liste).vue;
  assert.equal(v1.mode, 'liste');
  assert.equal(v1.options[0].length, 4);
  assert.equal(TYPES.completer.valider(liste, ['high']), true);
  assert.equal(TYPES.completer.valider(liste, ['LOW']), false);
  const glisser = q('q-018');
  const v2 = preparer(glisser).vue;
  assert.equal(v2.mode, 'glisser');
  assert.ok(v2.etiquettes.includes('bouton appuyé'));
  assert.equal(v2.segments.length, 2);
  assert.equal(TYPES.completer.valider(glisser, ['bouton appuyé']), true);
  assert.equal(TYPES.completer.valider(glisser, []), false);
});

test('blocs : aller-retour Blockly sans perte', () => {
  for (const id of ['q-014', 'q-015', 'q-016', 'q-017']) {
    for (const s of q(id).donnees.sequences) {
      const lu = blocs.depuisBlockly(blocs.versBlockly(s));
      assert.equal(lu.incomplets, 0, id);
      assert.equal(blocs.programmeAccepte(lu.programme, [s]), true, id);
    }
  }
});

test('blocs : la solution envoyée par Blockly est acceptée, une erreur est refusée', () => {
  const question = q('q-016');
  const juste = blocs.versBlockly(question.donnees.sequences[0]);
  assert.equal(TYPES.blocs.valider(question, juste), true);
  assert.equal(TYPES.blocs.valider(question, JSON.stringify(juste)), true);
  const faux = blocs.versBlockly([{ bloc: 'repeter', fois: 4, faire: question.donnees.sequences[0][0].faire }]);
  assert.equal(TYPES.blocs.valider(question, faux), false);
  assert.match(TYPES.blocs.textes(question, faux).donnee, /répéter 4 fois/);
  assert.equal(TYPES.blocs.valider(question, '{pas du json'), false);
  assert.equal(TYPES.blocs.valider(question, 'x'.repeat(70000)), false);
});

test('blocs : écritures équivalentes de « bouton appuyé »', () => {
  const question = q('q-014');
  const led = [{ bloc: 'led_etat', etat: 1 }];
  const haut = { bloc: 'valeur_haut_bas', valeur: 1 };
  const bas = { bloc: 'valeur_haut_bas', valeur: 0 };
  const b = { bloc: 'bouton_etat' };
  for (const condition of [
    b,
    { bloc: 'comparaison', op: '=', a: b, b: haut },
    { bloc: 'comparaison', op: '=', a: haut, b },
    { bloc: 'comparaison', op: '≠', a: b, b: bas },
  ]) {
    const prog = blocs.versBlockly([{ bloc: 'si_alors', condition, alors: led }]);
    assert.equal(TYPES.blocs.valider(question, prog), true, JSON.stringify(condition));
  }
  const relache = blocs.versBlockly([{ bloc: 'si_alors', condition: { bloc: 'comparaison', op: '=', a: b, b: bas }, alors: led }]);
  assert.equal(TYPES.blocs.valider(question, relache), false);
});

test('blocs : « si relâché alors A sinon B » vaut « si appuyé alors B sinon A »', () => {
  const question = q('q-017');
  const inverse = blocs.versBlockly([{ bloc: 'si_sinon',
    condition: { bloc: 'comparaison', op: '=', a: { bloc: 'bouton_etat' }, b: { bloc: 'valeur_haut_bas', valeur: 0 } },
    alors: [{ bloc: 'servo_angle', angle: 0 }], sinon: [{ bloc: 'servo_angle', angle: 90 }] }]);
  assert.equal(TYPES.blocs.valider(question, inverse), true);
});

test('blocs : bloc incomplet ou hors du programme', () => {
  const question = q('q-015');
  const sauvegarde = blocs.versBlockly(question.donnees.sequences[0]);
  // Entrée vide : refusé.
  const vide = JSON.parse(JSON.stringify(sauvegarde));
  delete vide.blocks.blocks[0].inputs.DO.block.inputs.ANGLE.shadow;
  assert.equal(TYPES.blocs.valider(question, vide), false);
  // Un bloc qui traîne à côté : ignoré, la réponse reste juste.
  const avecIntrus = JSON.parse(JSON.stringify(sauvegarde));
  avecIntrus.blocks.blocks.push({ type: 'led_etat', id: 'intrus', fields: { ETAT: '1' } });
  assert.equal(blocs.depuisBlockly(avecIntrus).horsProgramme, 1);
  assert.equal(TYPES.blocs.valider(question, avecIntrus), true);
});



// ---------- Programme de blocs à compléter, broches ----------

/** Remplace dans une sauvegarde Blockly les trous du départ par les bonnes valeurs (comme l'élève). */
const completerDepart = (question) => blocs.versBlockly(question.donnees.sequences[0]);

test('à compléter (blocs) : le départ envoyé est verrouillé, a ses trous et pas la solution', () => {
  const question = q('q-021');
  const { vue } = preparer(question);
  assert.equal(vue.version, 'blocs');
  const lu = blocs.depuisBlockly(vue.depart);
  assert.equal(lu.incomplets, 3);
  assert.match(blocs.texteProgramme(lu.programme), /répéter \? fois .*\[bloc manquant\]/);
  const repeter = vue.depart.blocks.blocks[0].inputs.DO.block;
  assert.equal(repeter.movable, false);
  assert.equal(repeter.deletable, false);
  assert.equal(repeter.inputs.FOIS.shadow.fields.NUM, '?');
  assert.notEqual(repeter.inputs.FOIS.shadow.editable, false, 'le trou reste modifiable');
  assert.equal(repeter.inputs.FAIRE.block.editable, false, 'un bloc donné sans trou ne se modifie pas');
});

test('à compléter (blocs) : départ non rempli refusé, programme complété accepté', () => {
  for (const id of ['q-021', 'q-022', 'q-023']) {
    const question = q(id);
    const { vue } = preparer(question);
    assert.equal(TYPES.completer.valider(question, vue.depart), false, id);
    assert.equal(TYPES.completer.valider(question, completerDepart(question)), true, id);
    assert.match(TYPES.completer.textes(question, vue.depart).donnee, /\?|manquant/, id);
  }
});

test('broches : la bonne broche est exigée, ignorée si la question est sans broches', () => {
  const question = q('q-022');
  const sol = question.donnees.sequences[0];
  const mauvaise = JSON.parse(JSON.stringify(sol));
  mauvaise[0].alors[0].broche = 'D5';
  assert.equal(TYPES.completer.valider(question, blocs.versBlockly(mauvaise)), false);
  // Écriture équivalente avec la broche : bouton (D7) = HAUT.
  const equivalente = JSON.parse(JSON.stringify(sol));
  equivalente[0].condition = { bloc: 'comparaison', op: '=', a: { bloc: 'bouton_etat', broche: 'D7' }, b: { bloc: 'valeur_haut_bas', valeur: 1 } };
  assert.equal(TYPES.completer.valider(question, blocs.versBlockly(equivalente)), true);
  const autreBouton = JSON.parse(JSON.stringify(equivalente));
  autreBouton[0].condition.a.broche = 'D8';
  assert.equal(TYPES.completer.valider(question, blocs.versBlockly(autreBouton)), false);
  // Sans broches : la broche choisie ne compte pas.
  const sans = { ...question, donnees: { ...question.donnees, broches: false } };
  assert.equal(TYPES.completer.valider(sans, blocs.versBlockly(mauvaise)), true);
  // Broche « ? » ou inconnue : case incomplète.
  const inconnue = blocs.versBlockly([{ bloc: 'led_etat', etat: 1, broche: 'D99' }]);
  assert.equal(blocs.depuisBlockly(inconnue).incomplets, 1);
});

test('à compléter (blocs) : question mal préparée signalée', () => {
  const base = q('q-021');
  const sans = (d) => ({ ...base, donnees: { ...base.donnees, ...d } });
  assert.match(TYPES.completer.verifier(sans({ depart: null })), /départ manquant/);
  assert.match(TYPES.completer.verifier(sans({ depart: base.donnees.sequences[0] })), /aucun trou/);
  assert.match(TYPES.completer.verifier(sans({ sequences: [] })), /solution manquante/);
  assert.match(TYPES.completer.verifier({ ...q('q-022'), donnees: { ...q('q-022').donnees, sequences: [[{ bloc: 'led_etat', etat: 1 }]] } }), /broche/);
});

test('nombre : la virgule et le « ? » sont lus correctement', () => {
  const prog = (num) => ({ blocks: { blocks: [{ type: 'programme', inputs: { DO: { block: { type: 'attendre', inputs: { DUREE: { shadow: { type: 'nombre', fields: { NUM: num } } } } } } } }] } });
  assert.deepEqual(blocs.depuisBlockly(prog(0.5)).programme, [{ bloc: 'attendre', duree: 0.5 }]);
  assert.equal(blocs.depuisBlockly(prog('?')).incomplets, 1);
});

test('relier les paires : colonne de droite mélangée, validation par les textes', () => {
  const question = { type: 'relier', donnees: { paires: [
    { gauche: 'LED', droite: 'actionneur' }, { gauche: 'Bouton', droite: 'capteur' }, { gauche: 'Arduino', droite: 'carte' }] } };
  assert.equal(TYPES.relier.verifier(question), null);
  const { vue, prive } = TYPES.relier.preparer(question, Math.random);
  assert.deepEqual(vue.gauche, ['LED', 'Bouton', 'Arduino']);
  assert.notDeepEqual(vue.droite, ['actionneur', 'capteur', 'carte'], 'jamais déjà dans l\'ordre');
  assert.ok(!JSON.stringify(vue).includes('bonne'));
  const juste = question.donnees.paires.map((p) => vue.droite.indexOf(p.droite));
  assert.equal(TYPES.relier.valider(question, juste, prive), true);
  const faux = [juste[1], juste[0], juste[2]];
  assert.equal(TYPES.relier.valider(question, faux, prive), false);
  assert.match(TYPES.relier.textes(question, faux, prive).donnee, /LED → capteur/);
  assert.equal(TYPES.relier.valider(question, [0, 0, 1], prive), false, 'deux fois la même');
  assert.equal(TYPES.relier.valider(question, [0, 1], prive), false, 'incomplet');
  assert.match(TYPES.relier.verifier({ donnees: { paires: [{ gauche: 'a', droite: 'b' }] } }), /2 paires/);
  assert.match(TYPES.relier.verifier({ donnees: { paires: [{ gauche: 'a', droite: 'b' }, { gauche: 'A', droite: 'c' }] } }), /identiques/);
});
