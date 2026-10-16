'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { creerHistorique, nettoyerClasse } = require('../server/historique');

function stockage() {
  const a = {};
  return { lireAnnexe: (n) => (a[n] ? JSON.parse(JSON.stringify(a[n])) : null), ecrireAnnexe: (n, v) => { a[n] = v; } };
}
const q = (id, justes, fausses, tempsEcoules = 0) => ({ id, titre: `Titre ${id}`, enonce: `Énoncé ${id}`, type: 'qcm',
  posees: justes + fausses + tempsEcoules, justes, fausses, tempsEcoules, parEquipe: {} });
const bilan = (questions, date = '2026-10-14T09:00:00.000Z') => ({ date, raison: 'temps', dureeMs: 600000,
  parcours: { id: 'p', nom: 'LED' }, nbEleves: 24, reglages: {},
  equipes: [{ nom: 'Rouge', couleur: '#E0362C', rang: 1, position: 30, justes: 12, fausses: 3 },
    { nom: 'Bleue', couleur: '#2563EB', rang: 2, position: 20, justes: 8, fausses: 5 }], questions });

test('historique : enregistrement, liste résumée, détail, suppression', () => {
  const h = creerHistorique({ stockage: stockage() });
  const p = h.ajouter(bilan([q('q1', 3, 1), q('q2', 1, 2, 1)]), { classe: '  5e   B ', titre: 'Séance LED' });
  assert.equal(p.classe, '5e B');
  assert.equal(p.titre, 'Séance LED');
  h.modifier(p.id, { titre: 'Séance LED et bouton' });
  assert.equal(h.liste()[0].titre, 'Séance LED et bouton');
  assert.equal(h.liste()[0].classe, '5e B', 'la classe ne change pas si on ne la donne pas');
  const [r] = h.liste();
  assert.equal(r.reussite, 50); // 4 justes sur 8 réponses
  assert.deepEqual(r.gagnants.map((g) => g.nom), ['Rouge']);
  assert.equal(h.detail(p.id).questions.length, 2);
  assert.deepEqual(h.classes(), ['5e B']);
  h.supprimer(p.id);
  assert.equal(h.liste().length, 0);
  assert.throws(() => h.detail(p.id), /introuvable/);
});

test('historique : bilan cumulé d\'une classe sur plusieurs parties', () => {
  const h = creerHistorique({ stockage: stockage() });
  h.ajouter(bilan([q('q1', 1, 3)], '2026-10-01T09:00:00.000Z'), { classe: '5e B' });
  h.ajouter(bilan([q('q1', 3, 1), q('q2', 2, 0)], '2026-10-08T09:00:00.000Z'), { classe: '5e B' });
  h.ajouter(bilan([q('q1', 0, 4)]), { classe: '4e A' });
  const c = h.cumul('5e B');
  assert.equal(c.nbParties, 2);
  const q1 = c.questions.find((x) => x.id === 'q1');
  assert.equal(q1.justes, 4);
  assert.equal(q1.fausses, 4);
  assert.equal(q1.parties, 2);
  assert.equal(h.cumul(null).nbParties, 3);
  assert.deepEqual(h.classes(), ['4e A', '5e B']);
});

test('classe : nettoyée, 30 caractères au plus, vide = aucune', () => {
  assert.equal(nettoyerClasse('   '), null);
  assert.equal(nettoyerClasse('x'.repeat(50)).length, 30);
});

test('historique : export puis import sur un autre ordinateur, sans doublon ni champ inconnu', () => {
  const ici = creerHistorique({ stockage: stockage() });
  const p1 = ici.ajouter(bilan([q('q1', 3, 1)], '2026-10-01T09:00:00.000Z'), { classe: '5e B', titre: 'Séance 1' });
  const fichier = ici.exporter();
  assert.equal(fichier.format, 'robot-rush-historique');
  assert.equal(fichier.parties.length, 1);

  const ailleurs = creerHistorique({ stockage: stockage() });
  ailleurs.ajouter(bilan([q('q2', 1, 1)], '2026-10-08T09:00:00.000Z'), { classe: '5e B' });
  // Un champ inattendu (un pseudo glissé à la main) n'est pas gardé.
  const modifie = JSON.parse(JSON.stringify(fichier));
  modifie.parties[0].pseudos = ['Léa'];
  modifie.parties.push({ id: 'pas-un-id', date: 'nulle part' });
  const r = ailleurs.importer(modifie);
  assert.deepEqual(r, { ajoutees: 1, deja: 0, illisibles: 1 });
  assert.equal(ailleurs.liste().length, 2);
  assert.equal(ailleurs.liste()[1].id, p1.id, 'triées de la plus récente à la plus ancienne');
  assert.ok(!JSON.stringify(ailleurs.detail(p1.id)).includes('Léa'));
  assert.equal(ailleurs.cumul('5e B').nbParties, 2);
  // Réimporter le même fichier : rien en double.
  assert.deepEqual(ailleurs.importer(modifie), { ajoutees: 0, deja: 1, illisibles: 1 });
  assert.throws(() => ailleurs.importer({ format: 'robot-rush', questions: [] }), /pas un historique/);
});
