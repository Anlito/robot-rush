'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Partie, ErreurJeu } = require('../server/jeu');

// Questions QCM dont la bonne réponse est toujours « B ».
const QUESTIONS = Array.from({ length: 5 }, (_, i) => ({
  id: `q${i}`, type: 'qcm', enonce: `Question ${i}`, donnees: { choix: ['A', 'B', 'C', 'D'], bonne: 1 },
}));

// Générateur pseudo-aléatoire déterministe.
function rngFixe(graine = 42) {
  let s = graine;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}

function nouvellePartie({ nbEquipes = 3, reglages = {}, eleves = null } = {}) {
  const horloge = { now: 0 };
  const p = new Partie({ questions: QUESTIONS, nbEquipes, reglages, rng: rngFixe(), maintenant: () => horloge.now });
  const avancerTemps = (ms) => { horloge.now += ms; p.tick(); };
  const liste = eleves || p.equipes.map((e) => [e.id, `eleve${e.id}`]);
  const j = {};
  for (const [equipeId, pseudo] of liste) j[pseudo] = p.rejoindre({ code: p.equipes[equipeId].code, pseudo }).jeton;
  return { p, j, avancerTemps };
}

// Répond juste, quel que soit le mélange des choix.
function bonneReponse(p, jeton) {
  const joueur = p.joueurs.get(jeton);
  const index = joueur.question.vue.choix.indexOf('B');
  return p.repondre(jeton, { reponse: index });
}
function mauvaiseReponse(p, jeton) {
  const joueur = p.joueurs.get(jeton);
  return p.repondre(jeton, { reponse: joueur.question.vue.choix.indexOf('A') });
}

// Attaque avec l'obstacle voulu (on force le tirage pour rendre le test lisible).
function attaquer(p, jeton, obstacle, cible) {
  bonneReponse(p, jeton);
  p.choisirAction(jeton, 'attaque');
  p.joueurs.get(jeton).tirage.obstacles = [obstacle, 'mur'];
  return p.attaquer(jeton, { obstacle, cible });
}
function prendre(p, jeton, solution) {
  bonneReponse(p, jeton);
  p.choisirAction(jeton, 'solution');
  p.joueurs.get(jeton).tirage.solutions = [solution];
  return p.prendreSolution(jeton, solution);
}

test('codes : 4 caractères, sans O, 0, I, 1, tous différents', () => {
  const { p } = nouvellePartie({ nbEquipes: 8 });
  const codes = p.equipes.map((e) => e.code);
  assert.equal(new Set(codes).size, 8);
  for (const c of codes) assert.match(c, /^[A-HJ-NP-Z2-9]{4}$/);
});

test('rejoindre : code en minuscules accepté, code inconnu et pseudo pris refusés', () => {
  const { p } = nouvellePartie({ eleves: [] });
  const code = p.equipes[1].code;
  const j = p.rejoindre({ code: ` ${code.toLowerCase()} `, pseudo: 'Lina' });
  assert.equal(j.equipeId, 1);
  assert.throws(() => p.rejoindre({ code: 'ZZZZ', pseudo: 'Noah' }), ErreurJeu);
  assert.throws(() => p.rejoindre({ code, pseudo: 'lina' }), /déjà pris/);
});

test('reconnexion : le jeton redonne la même équipe et le même pseudo', () => {
  const { p, j } = nouvellePartie();
  p.demarrer();
  p.deconnecter(j.eleve1);
  const retour = p.rejoindre({ jeton: j.eleve1 });
  assert.equal(retour.pseudo, 'eleve1');
  assert.equal(retour.equipeId, 1);
  assert.equal(retour.connecte, true);
});

test('démarrer : avertit quand des équipes sont vides, puis démarre si on force', () => {
  const { p } = nouvellePartie({ nbEquipes: 3, eleves: [[0, 'a'], [1, 'b']] });
  const r = p.demarrer();
  assert.match(r.avertissement, /3 équipes configurées, 2 codes utilisés/);
  assert.equal(p.etat, 'lobby');
  p.demarrer({ forcer: true });
  assert.equal(p.etat, 'en_cours');
});

test('démarrer sans élève : refusé', () => {
  const { p } = nouvellePartie({ eleves: [] });
  assert.throws(() => p.demarrer(), /Aucun élève/);
});

test('bonne réponse puis Avancer : +2 cases et nouvelle question', () => {
  const { p, j } = nouvellePartie();
  p.demarrer();
  assert.deepEqual(bonneReponse(p, j.eleve0), { correct: true });
  p.choisirAction(j.eleve0, 'avancer');
  assert.equal(p.equipes[0].position, 2);
  assert.equal(p.joueurs.get(j.eleve0).phase, 'question');
});

test('la vue élève ne contient jamais la bonne réponse', () => {
  const { p, j } = nouvellePartie();
  p.demarrer();
  const vue = JSON.stringify(p.vueEleve(j.eleve0));
  assert.ok(!vue.includes('bonne'));
  assert.ok(!vue.includes('ordre'));
});

test('mauvaise réponse : 3 s d\'attente puis nouvelle question', () => {
  const { p, j, avancerTemps } = nouvellePartie();
  p.demarrer();
  assert.deepEqual(mauvaiseReponse(p, j.eleve0), { correct: false });
  const joueur = p.joueurs.get(j.eleve0);
  assert.equal(joueur.phase, 'erreur');
  assert.equal(joueur.retour.bonne, 'B');
  assert.throws(() => p.choisirAction(j.eleve0, 'avancer'));
  avancerTemps(2900);
  assert.equal(joueur.phase, 'erreur');
  avancerTemps(200);
  assert.equal(joueur.phase, 'question');
});

test('temps dépassé = mauvaise réponse', () => {
  const { p, j, avancerTemps } = nouvellePartie();
  p.demarrer();
  avancerTemps(30001);
  const joueur = p.joueurs.get(j.eleve0);
  assert.equal(joueur.phase, 'erreur');
  assert.equal(joueur.retour.tempsDepasse, true);
});

test('délai de choix écoulé : Avancer par défaut', () => {
  const { p, j, avancerTemps } = nouvellePartie();
  p.demarrer();
  bonneReponse(p, j.eleve0);
  avancerTemps(8001);
  assert.equal(p.equipes[0].position, 2);
});

test('attaque sans solution en stock : robot bloqué 15 s, puis protégé 3 s', () => {
  const { p, j, avancerTemps } = nouvellePartie();
  p.demarrer();
  attaquer(p, j.eleve0, 'trou', 1);
  const cible = p.equipes[1];
  assert.equal(cible.blocage.obstacle, 'trou');
  assert.equal(p.joueurs.get(j.eleve0).stats.attaques, 1);
  // Bloquée : impossible d'avancer, impossible de recevoir un autre obstacle.
  bonneReponse(p, j.eleve1);
  assert.throws(() => p.choisirAction(j.eleve1, 'avancer'), /bloqué/);
  assert.throws(() => attaquer(p, j.eleve2, 'mur', 1), /déjà bloquée/);
  avancerTemps(15000);
  assert.equal(cible.blocage, null);
  // Protégée 3 s.
  p.joueurs.get(j.eleve2).phase = 'question';
  assert.throws(() => attaquer(p, j.eleve2, 'mur', 1), /protégée/);
  avancerTemps(3000);
  p.joueurs.get(j.eleve2).phase = 'question';
  attaquer(p, j.eleve2, 'mur', 1);
  assert.equal(cible.blocage.obstacle, 'mur');
});

test('solution en stock : consommée automatiquement, obstacle annulé', () => {
  const { p, j } = nouvellePartie();
  p.demarrer();
  prendre(p, j.eleve1, 'pont');
  assert.equal(p.equipes[1].stock.pont, 1);
  attaquer(p, j.eleve0, 'trou', 1);
  assert.equal(p.equipes[1].stock.pont, 0);
  assert.equal(p.equipes[1].blocage, null);
  assert.equal(p.fil[0].type, 'parade');
});

test('coéquipier qui prend la bonne solution : déblocage immédiat, solution consommée', () => {
  const { p, j } = nouvellePartie({ eleves: [[0, 'a'], [1, 'b'], [1, 'c'], [2, 'd']] });
  p.demarrer();
  attaquer(p, j.a, 'rocher', 1);
  assert.ok(p.equipes[1].blocage);
  prendre(p, j.c, 'pelleteuse');
  assert.equal(p.equipes[1].blocage, null);
  assert.equal(p.equipes[1].stock.pelleteuse, 0);
  assert.ok(p.equipes[1].protegeJusqua > p.t);
  assert.equal(p.joueurs.get(j.c).stats.solutions, 1);
});

test('mauvaise solution pendant un blocage : stockée, le robot reste bloqué', () => {
  const { p, j } = nouvellePartie();
  p.demarrer();
  attaquer(p, j.eleve0, 'boue', 1);
  prendre(p, j.eleve1, 'pont');
  assert.ok(p.equipes[1].blocage);
  assert.equal(p.equipes[1].stock.pont, 1);
});

test('solution garantie : le tirage contient celle qui débloque', () => {
  const { p, j } = nouvellePartie();
  p.demarrer();
  for (let essai = 0; essai < 20; essai++) {
    p.equipes[1].blocage = { obstacle: 'mur', finA: p.t + 15000 };
    p.joueurs.get(j.eleve1).phase = 'question';
    bonneReponse(p, j.eleve1);
    assert.equal(p.options(p.joueurs.get(j.eleve1)).avancer, false);
    p.choisirAction(j.eleve1, 'solution');
    assert.ok(p.joueurs.get(j.eleve1).tirage.solutions.includes('echelle'));
  }
});

test('hasard total : le tirage ne contient pas toujours la solution qui débloque', () => {
  const { p, j } = nouvellePartie({ reglages: { solutionGarantie: false } });
  p.demarrer();
  let absente = 0;
  for (let essai = 0; essai < 40; essai++) {
    p.equipes[1].blocage = { obstacle: 'mur', finA: p.t + 15000 };
    p.joueurs.get(j.eleve1).phase = 'question';
    bonneReponse(p, j.eleve1);
    p.choisirAction(j.eleve1, 'solution');
    if (!p.joueurs.get(j.eleve1).tirage.solutions.includes('echelle')) absente++;
  }
  assert.ok(absente > 0);
});

test('stock plein : plafonné à 3, exclu du tirage, option grisée quand tout est plein', () => {
  const { p, j } = nouvellePartie();
  p.demarrer();
  for (let i = 0; i < 3; i++) prendre(p, j.eleve0, 'pont');
  assert.equal(p.equipes[0].stock.pont, 3);
  bonneReponse(p, j.eleve0);
  p.choisirAction(j.eleve0, 'solution');
  assert.ok(!p.joueurs.get(j.eleve0).tirage.solutions.includes('pont'));
  p.equipes[0].stock = { pont: 3, echelle: 3, pelleteuse: 3, chenilles: 3 };
  p.joueurs.get(j.eleve0).phase = 'question';
  bonneReponse(p, j.eleve0);
  assert.equal(p.options(p.joueurs.get(j.eleve0)).solution, false);
  assert.throws(() => p.choisirAction(j.eleve0, 'solution'), /plein/);
});

test('2 équipes : la cible est automatique', () => {
  const { p, j } = nouvellePartie({ nbEquipes: 2 });
  p.demarrer();
  bonneReponse(p, j.eleve0);
  p.choisirAction(j.eleve0, 'attaque');
  const obstacle = p.joueurs.get(j.eleve0).tirage.obstacles[0];
  p.attaquer(j.eleve0, { obstacle });
  assert.ok(p.equipes[1].blocage);
});

test('on ne peut pas s\'attaquer soi-même', () => {
  const { p, j } = nouvellePartie();
  p.demarrer();
  assert.throws(() => attaquer(p, j.eleve0, 'trou', 0), /adverse/);
});

test('aucune cible disponible : Attaquer grisé', () => {
  const { p, j } = nouvellePartie();
  p.demarrer();
  p.equipes[1].blocage = { obstacle: 'trou', finA: 99999 };
  p.equipes[2].protegeJusqua = 99999;
  bonneReponse(p, j.eleve0);
  assert.equal(p.options(p.joueurs.get(j.eleve0)).attaque, false);
});

test('équipe ciblée pendant que son élève choisit : « Avancer » devient impossible', () => {
  const { p, j } = nouvellePartie();
  p.demarrer();
  bonneReponse(p, j.eleve1);
  attaquer(p, j.eleve0, 'trou', 1);
  assert.throws(() => p.choisirAction(j.eleve1, 'avancer'), /bloqué/);
});

test('délai écoulé pendant un blocage : une solution est prise à la place d\'Avancer', () => {
  const { p, j, avancerTemps } = nouvellePartie();
  p.demarrer();
  attaquer(p, j.eleve0, 'trou', 1);
  bonneReponse(p, j.eleve1);
  avancerTemps(8001);
  assert.equal(p.equipes[1].position, 0);
  assert.equal(p.joueurs.get(j.eleve1).stats.solutions, 1);
  assert.equal(p.equipes[1].blocage, null); // solution garantie : le pont a été pris
});

test('arrivée : première équipe à 30 cases gagne', () => {
  const { p, j } = nouvellePartie();
  p.demarrer();
  p.equipes[2].position = 28;
  bonneReponse(p, j.eleve2);
  p.choisirAction(j.eleve2, 'avancer');
  assert.equal(p.etat, 'terminee');
  assert.equal(p.resultat.raison, 'arrivee');
  assert.equal(p.resultat.classement[0].equipe, 2);
  assert.equal(p.resultat.meilleurs.justes.pseudo, 'eleve2');
  assert.equal(p.joueurs.get(j.eleve0).phase, 'fin');
});

test('fin du temps : la plus avancée gagne, égalité départagée par les réponses justes', () => {
  const { p, avancerTemps } = nouvellePartie();
  p.demarrer();
  Object.assign(p.equipes[0], { position: 10, justes: 5 });
  Object.assign(p.equipes[1], { position: 10, justes: 7 });
  Object.assign(p.equipes[2], { position: 4, justes: 9 });
  avancerTemps(12 * 60000);
  assert.equal(p.etat, 'terminee');
  assert.equal(p.resultat.raison, 'temps');
  assert.deepEqual(p.resultat.classement.map((c) => [c.equipe, c.rang]), [[1, 1], [0, 2], [2, 3]]);
});

test('égalité parfaite : ex æquo', () => {
  const { p } = nouvellePartie();
  p.demarrer();
  Object.assign(p.equipes[0], { position: 10, justes: 5 });
  Object.assign(p.equipes[1], { position: 10, justes: 5 });
  p.arreter();
  assert.deepEqual(p.resultat.classement.map((c) => c.rang), [1, 1, 3]);
});

test('pause : le temps, les blocages et les questions sont gelés', () => {
  const { p, j, avancerTemps } = nouvellePartie();
  p.demarrer();
  attaquer(p, j.eleve0, 'trou', 1);
  const restant = p.equipes[1].blocage.finA - p.t;
  p.pause();
  avancerTemps(60000);
  assert.ok(p.equipes[1].blocage);
  assert.equal(p.equipes[1].blocage.finA - p.t, restant);
  assert.throws(() => bonneReponse(p, j.eleve2), /pause/);
  p.reprendre();
  avancerTemps(restant);
  assert.equal(p.equipes[1].blocage, null);
});

test('élève déconnecté : sa question expire sans erreur et il en reçoit une à son retour', () => {
  const { p, j, avancerTemps } = nouvellePartie();
  p.demarrer();
  p.deconnecter(j.eleve0);
  avancerTemps(31000);
  const joueur = p.joueurs.get(j.eleve0);
  assert.equal(joueur.phase, 'attente');
  p.connecter(j.eleve0);
  assert.equal(joueur.phase, 'question');
});

test('élève qui rejoint en cours de partie : reçoit une question', () => {
  const { p } = nouvellePartie();
  p.demarrer();
  const nouveau = p.rejoindre({ code: p.equipes[0].code, pseudo: 'Retard' });
  assert.equal(nouveau.phase, 'question');
});

test('retirer et déplacer un élève', () => {
  const { p, j } = nouvellePartie();
  const retires = [];
  p.on('retire', (jeton) => retires.push(jeton));
  p.deplacerEleve(j.eleve0, 2);
  assert.equal(p.joueurs.get(j.eleve0).equipeId, 2);
  p.retirerEleve(j.eleve1);
  assert.deepEqual(retires, [j.eleve1]);
  assert.equal(p.joueurs.has(j.eleve1), false);
});

test('moins d\'équipes en salle d\'attente : les élèves des équipes supprimées sont renvoyés', () => {
  const { p, j } = nouvellePartie({ nbEquipes: 4 });
  const retires = [];
  p.on('retire', (jeton) => retires.push(jeton));
  p.configurer({ nbEquipes: 2 });
  assert.deepEqual(retires.sort(), [j.eleve2, j.eleve3].sort());
});

test('réglages : bornes vérifiées et verrouillés après le départ', () => {
  const { p } = nouvellePartie();
  assert.throws(() => p.configurer({ reglages: { longueur: 1 } }), /entre 5 et 100/);
  p.configurer({ reglages: { longueur: 40 } });
  assert.equal(p.reglages.longueur, 40);
  p.demarrer();
  assert.throws(() => p.configurer({ reglages: { longueur: 30 } }), /verrouillés/);
});

test('questions : pas de répétition pour un élève tant que possible', () => {
  const { p, j } = nouvellePartie();
  p.demarrer();
  const vues = [];
  for (let i = 0; i < QUESTIONS.length; i++) {
    vues.push(p.joueurs.get(j.eleve0).question.q.id);
    bonneReponse(p, j.eleve0);
    p.choisirAction(j.eleve0, 'avancer');
  }
  assert.equal(new Set(vues).size, QUESTIONS.length);
});

test('nouvelle partie avec les mêmes équipes : tout est remis à zéro, élèves gardés', () => {
  const { p, j } = nouvellePartie();
  p.demarrer();
  prendre(p, j.eleve0, 'pont');
  p.arreter();
  p.nouvellePartie({ garderEquipes: true });
  assert.equal(p.etat, 'lobby');
  assert.equal(p.equipes[0].stock.pont, 0);
  assert.equal(p.joueurs.size, 3);
  p.nouvellePartie({ garderEquipes: false });
  assert.equal(p.joueurs.size, 0);
});

test('pseudos signalés : mots isolés, variantes leet, sans faux positifs', () => {
  const { pseudoSignale } = require('../server/jeu');
  for (const p of ['Pr0ut', 'gros caca', 'GrosCaca', 'CON', 'Merdouille']) assert.equal(pseudoSignale(p), true, p);
  for (const p of ['Constance', 'Pascal', 'Lina', 'Noah', 'Scott', 'Bitcoin']) assert.equal(pseudoSignale(p), false, p);
});

test('fil : le pseudo de l\'élève accompagne les actions de son équipe', () => {
  const { p, j } = nouvellePartie();
  p.demarrer();
  prendre(p, j.eleve0, 'pont');
  assert.equal(p.fil[0].pseudo, 'eleve0');
  attaquer(p, j.eleve1, 'trou', 0);
  assert.equal(p.fil[0].type, 'parade');
  assert.match(p.fil[0].texte, /franchit le trou avec son pont/);
});
