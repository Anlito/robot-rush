'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Banque, probleme } = require('../server/banque');
const seedQ = require('../seed/questions.json');
const seedP = require('../seed/parcours.json');

function banque(options = {}) {
  const ecrits = [];
  const b = new Banque({ questions: JSON.parse(JSON.stringify(seedQ)), parcours: JSON.parse(JSON.stringify(seedP)),
    sauver: (cle, v) => ecrits.push([cle, v.length]), ...options });
  return { b, ecrits };
}

test('chargement : les 23 questions de test sont complètes', () => {
  const { b } = banque();
  assert.equal(b.questions.length, 23);
  assert.deepEqual(b.questions.filter((q) => probleme(q)).map((q) => q.id), []);
  assert.equal(b.questionsJouables().length, 23);
});

test('chargement : une question abîmée est gardée et signalée, pas supprimée', () => {
  const b = new Banque({ questions: [...seedQ, { id: 'q-x', type: 'inconnu', enonce: 'x' }, { id: 'q-y', type: 'qcm', enonce: 'y', duree_s: 9999, donnees: { choix: ['a', 'b'], bonne: 0 } }], parcours: seedP });
  assert.equal(b.questions.length, 25);
  assert.match(probleme(b.question('q-x')), /abîmée/);
  assert.equal(b.question('q-y').duree_s, null);
  assert.equal(b.questionsJouables().length, 24);
});

test('nouvelle question : numéro attribué, sauvegarde immédiate, incomplète signalée', () => {
  const { b, ecrits } = banque();
  const r = b.enregistrerQuestion({ type: 'qcm', enonce: '', donnees: { choix: ['a', 'b'], bonne: 0 } });
  assert.equal(r.question.id, 'q-024');
  assert.equal(r.probleme, 'énoncé vide');
  assert.deepEqual(ecrits.at(-1), ['questions', 24]);
  const r2 = b.enregistrerQuestion({ ...r.question, enonce: '2 + 2 ?', donnees: { choix: ['4', '5', '', ''], bonne: 0 } });
  assert.equal(r2.question.id, 'q-024');
  assert.equal(r2.probleme, null);
  // Version jouable : les cases vides du QCM disparaissent.
  assert.deepEqual(b.questionsJouables().find((q) => q.id === 'q-024').donnees.choix, ['4', '5']);
});

test('nettoyage : champs inconnus retirés, longueurs limitées, durée vérifiée', () => {
  const { b } = banque();
  const { question } = b.enregistrerQuestion({ type: 'calcul', enonce: 'x'.repeat(2000), pirate: '<script>', donnees: { reponse: '12,5', autre: 1 } });
  assert.equal(question.enonce.length, 600);
  assert.equal(question.pirate, undefined);
  assert.deepEqual(question.donnees, { reponse: 12.5, unite: null });
  assert.throws(() => b.enregistrerQuestion({ type: 'calcul', enonce: 'x', duree_s: 2, donnees: {} }), /entre 5 et 300/);
  assert.throws(() => b.enregistrerQuestion({ type: 'devinette', enonce: 'x' }), /inconnu/);
});

test('blocs : les séquences repassent par Blockly (instructions inconnues retirées)', () => {
  const { b } = banque();
  const { question, probleme: p } = b.enregistrerQuestion({ type: 'blocs', enonce: 'x', donnees: {
    blocs: ['led_etat', 'pirate'], sequences: [[{ bloc: 'led_etat', etat: 1 }, { bloc: 'formater_disque' }]] } });
  assert.deepEqual(question.donnees.blocs, ['led_etat']);
  assert.deepEqual(question.donnees.sequences, [[{ bloc: 'led_etat', etat: 1 }]]);
  assert.equal(p, null);
  assert.deepEqual(b.vue().questions.find((q) => q.id === question.id).apercuSequences, ['allumer la LED']);
});

test('supprimer une question la retire aussi des parcours', () => {
  const { b } = banque();
  const r = b.supprimerQuestion('q-001');
  assert.equal(r.parcoursModifies, 1);
  assert.ok(!b.unParcours('p-test').questions.includes('q-001'));
});

test('dupliquer une question et un parcours', () => {
  const { b } = banque();
  const { question } = b.dupliquerQuestion('q-005');
  assert.notEqual(question.id, 'q-005');
  assert.equal(question.enonce, b.question('q-005').enonce);
  const { parcours } = b.dupliquerParcours('p-test');
  assert.equal(parcours.nom, 'Test (copie)');
  assert.equal(parcours.questions.length, 23);
});

test('parcours : nom obligatoire, questions inconnues retirées, réglages bornés', () => {
  const { b } = banque();
  assert.throws(() => b.enregistrerParcours({ nom: '  ', questions: [] }), /nom/);
  const { parcours } = b.enregistrerParcours({ nom: '5e – Distributeur', questions: ['q-001', 'q-404', 'q-001'], reglages: { dureePartie: 10, longueur: '' } });
  assert.deepEqual(parcours.questions, ['q-001']);
  assert.deepEqual(parcours.reglages, { dureePartie: 10 });
  assert.throws(() => b.enregistrerParcours({ nom: 'x', reglages: { longueur: 2 } }), /Piste/);
  assert.throws(() => { b.supprimerParcours(parcours.id); b.supprimerParcours('p-test'); }, /au moins un parcours/);
});

test('export puis import « ajouter » : tout est renuméroté et les parcours suivent', () => {
  const { b } = banque();
  const fichier = JSON.parse(JSON.stringify(b.exporter()));
  assert.equal(fichier.format, 'robot-rush');
  const rapport = b.importer(fichier, { mode: 'ajouter' });
  assert.equal(rapport.questions, 23);
  assert.equal(rapport.parcours, 1);
  assert.equal(b.questions.length, 46);
  const copie = b.parcours[1];
  assert.equal(copie.questions.length, 23);
  assert.ok(copie.questions.every((id) => !seedQ.some((q) => q.id === id)), 'le parcours importé pointe vers les nouvelles questions');
});

test('import « remplacer », fichiers invalides et rapport des questions ignorées', () => {
  const { b } = banque();
  assert.throws(() => b.importer({ format: 'autre-jeu', questions: [] }), /ne vient pas de Robot Rush/);
  assert.throws(() => b.importer('n\'importe quoi'), /non reconnu/);
  assert.throws(() => b.importer({ questions: [seedQ[0]] }, { mode: 'remplacer' }), /aucun parcours/);
  const rapport = b.importer({ questions: [seedQ[0], { type: 'devinette' }], parcours: [{ nom: 'Mini', questions: ['q-001'] }] }, { mode: 'remplacer' });
  assert.equal(b.questions.length, 1);
  assert.equal(rapport.ignorees.length, 1);
  assert.match(rapport.ignorees[0], /question 2/);
  assert.deepEqual(b.parcours[0].questions, ['q-001']);
});

test('export d\'un seul parcours : seulement ses questions', () => {
  const { b } = banque();
  const { parcours } = b.enregistrerParcours({ nom: 'Deux', questions: ['q-002', 'q-010'] });
  const f = b.exporter({ parcoursIds: [parcours.id] });
  assert.deepEqual(f.questions.map((q) => q.id), ['q-002', 'q-010']);
  assert.equal(f.parcours.length, 1);
});

test('paires : formes déduites du genre, identifiants gardés, au moins 2', () => {
  const { nettoyerPaires, genreDe } = require('../server/paires');
  const { PAIRES_DEFAUT } = require('../server/constantes');
  const erreur = (m) => { throw new Error(m); };
  const p = nettoyerPaires([
    { obstacle: { id: 'trou', nom: 'Trou', genre: 'm' }, solution: { id: 'pont', nom: 'pont', genre: 'm' } },
    { obstacle: { nom: 'boue', genre: 'part-f' }, solution: { nom: 'échelle', genre: 'f' } },
    { obstacle: { nom: 'sable', genre: 'part-m' }, solution: { nom: 'chenilles', genre: 'pl' } },
  ], erreur);
  assert.deepEqual(p[0].obstacle, { id: 'trou', nom: 'trou', un: 'un trou', le: 'le trou', sa: 'son trou' });
  assert.equal(p[1].obstacle.id, 'o-boue');
  assert.equal(p[1].obstacle.un, 'de la boue');
  assert.deepEqual([p[1].solution.un, p[1].solution.le, p[1].solution.sa], ['une échelle', "l'échelle", 'son échelle']);
  assert.deepEqual([p[2].obstacle.un, p[2].solution.sa], ['du sable', 'ses chenilles']);
  assert.throws(() => nettoyerPaires([p[0]], erreur), /au moins 2/);
  // Les paires par défaut se relisent avec le bon genre.
  assert.deepEqual(PAIRES_DEFAUT.map((x) => genreDe(x.solution)), ['m', 'f', 'f', 'pl']);
  assert.equal(genreDe(PAIRES_DEFAUT[3].obstacle), 'part-f');
});

test('fichiers JSON avec une marque BOM (Bloc-notes de Windows) : lus quand même', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-bom-'));
  const BOM = String.fromCharCode(0xfeff);
  fs.writeFileSync(path.join(dossier, 'questions.json'), BOM + JSON.stringify(seedQ.slice(0, 2)), 'utf8');
  process.env.DATA_DIR = dossier;
  delete require.cache[require.resolve('../server/stockage')];
  const stockage = require('../server/stockage');
  assert.equal(stockage.charger('questions').length, 2);
  delete process.env.DATA_DIR;
  delete require.cache[require.resolve('../server/stockage')];
  fs.rmSync(dossier, { recursive: true, force: true });
});

test('à compléter (blocs) : départ et broches gardés, aperçus en clair', () => {
  const { b } = banque();
  const { question, probleme: p } = b.enregistrerQuestion({ type: 'completer', enonce: 'x', donnees: {
    version: 'blocs', blocs: ['led_etat'], broches: true,
    sequences: [[{ bloc: 'led_etat', etat: 1, broche: 'D3' }]],
    depart: [{ bloc: 'led_etat', etat: '?', broche: 'D3' }, { bloc: 'trou' }, { bloc: 'pirate' }] } });
  assert.equal(p, null);
  assert.equal(question.donnees.broches, true);
  assert.deepEqual(question.donnees.depart, [{ bloc: 'led_etat', etat: '?', broche: 'D3' }, { bloc: 'trou' }]);
  const vue = b.vue().questions.find((x) => x.id === question.id);
  assert.equal(vue.apercuDepart, 'LED à l\'état ? (D3) → [bloc manquant]');
  assert.deepEqual(vue.apercuSequences, ['allumer la LED (D3)']);
  // Version texte par défaut (anciennes questions).
  const { question: t } = b.enregistrerQuestion({ type: 'completer', enonce: 'y', donnees: { texte: 'si ___', trous: [{ bonne: 'a' }] } });
  assert.equal(t.donnees.version, 'texte');
});

test('titre : gardé, nettoyé, 80 caractères au plus', () => {
  const { b } = banque();
  const { question } = b.enregistrerQuestion({ type: 'calcul', titre: `  LED D9   ${'x'.repeat(100)}`, enonce: 'Combien ?', donnees: { reponse: 3 } });
  assert.ok(question.titre.length <= 80);
  assert.ok(question.titre.startsWith('LED D9 x'));
  assert.equal(b.enregistrerQuestion({ type: 'calcul', enonce: 'y', donnees: { reponse: 1 } }).question.titre, null);
});
