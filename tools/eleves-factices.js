'use strict';

// Élèves factices pour tester une partie sans classe.
// Usage : node tools/eleves-factices.js [nombre=12] [adresse=http://localhost:3000] [taux de bonnes réponses=0.7]
// Les élèves rejoignent les équipes à tour de rôle (codes lus via l'admin), répondent après 2 à 6 s
// et choisissent une action au hasard. Ils lisent les bonnes réponses dans data/questions.json :
// c'est un outil de test local, le serveur ne les envoie jamais.

const path = require('node:path');
const fs = require('node:fs');
const { io } = require('socket.io-client');
const blocs = require('../server/blocs');

const NB = Number(process.argv[2]) || 12;
const URL = process.argv[3] || 'http://localhost:3000';
const TAUX = process.argv[4] !== undefined ? Number(process.argv[4]) : 0.7;
const MDP = process.env.ADMIN_PASSWORD || 'robot';
const PRENOMS = ['Lina', 'Noah', 'Jade', 'Adam', 'Léa', 'Sacha', 'Inès', 'Malo', 'Zoé', 'Nino', 'Emma', 'Liam', 'Chloé', 'Tom', 'Rose', 'Hugo'];

const fichier = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'questions.json');
const banque = new Map(JSON.parse(fs.readFileSync(fichier, 'utf8')).map((q) => [q.id, q]));
const hasard = (t) => t[Math.floor(Math.random() * t.length)];
const delai = (min, max) => min + Math.random() * (max - min);

// Réponse d'un élève factice, juste ou fausse, pour chacun des 5 types de questions.
function repondre(vue, q, juste) {
  switch (vue.type) {
    case 'qcm':
      return juste ? vue.choix.indexOf(q.donnees.choix[q.donnees.bonne]) : Math.floor(Math.random() * vue.choix.length);
    case 'ordre': {
      const indices = vue.elements.map((_, i) => i);
      if (!juste) return indices.sort(() => Math.random() - 0.5);
      const pris = new Set();
      return q.donnees.elements.map((t) => {
        const i = vue.elements.findIndex((x, k) => x === t && !pris.has(k));
        pris.add(i);
        return i;
      });
    }
    case 'calcul':
      return String(juste ? q.donnees.reponse : Math.floor(Math.random() * 200));
    case 'completer':
      return q.donnees.trous.map((t) => (juste ? t.bonne : hasard(t.distracteurs || ['?'])));
    case 'blocs':
      return blocs.versBlockly(juste ? q.donnees.sequences[0] : [{ bloc: 'led_etat', etat: 1 }]);
    default:
      return null;
  }
}

function lireCodes() {
  return new Promise((resolve, reject) => {
    const admin = io(URL, { auth: { role: 'admin', motDePasse: MDP } });
    admin.on('admin:refuse', () => reject(new Error('Mot de passe admin refusé (ADMIN_PASSWORD ?)')));
    admin.on('etat', (e) => { admin.disconnect(); resolve(e.equipes.map((x) => x.code)); });
    admin.on('connect_error', reject);
  });
}

function eleve(numero, code) {
  const s = io(URL, { auth: { role: 'eleve' }, transports: ['websocket'] });
  const pseudo = `${PRENOMS[numero % PRENOMS.length]}${numero >= PRENOMS.length ? Math.floor(numero / PRENOMS.length) : ''}`;
  let etat = null;
  let derniereCle = '';
  let minuterie = null;

  s.on('connect', () => s.emit('rejoindre', { code, pseudo }, (r) => { if (!r.ok) console.log(pseudo, ':', r.erreur); }));
  s.on('etat', (e) => { etat = e; });
  s.on('moi', (moi) => {
    if (!moi) return;
    const cle = `${moi.phase}|${moi.question ? moi.question.id + moi.question.numero : ''}|${JSON.stringify(moi.tirage)}`;
    if (cle === derniereCle) return;
    derniereCle = cle;
    clearTimeout(minuterie);
    if (moi.phase === 'question') {
      minuterie = setTimeout(() => {
        const q = banque.get(moi.question.id);
        const juste = q && Math.random() < TAUX;
        s.emit('repondre', { questionId: moi.question.id, reponse: repondre(moi.question, q, juste) }, () => {});
      }, delai(2000, moi.question.type === 'blocs' || moi.question.type === 'completer' ? 9000 : 6000));
    } else if (moi.phase === 'action') {
      minuterie = setTimeout(() => s.emit('action', { action: hasard(['avancer', 'avancer', 'solution', 'attaque']) }, () => {}), delai(800, 2500));
    } else if (moi.phase === 'solution') {
      minuterie = setTimeout(() => s.emit('solution', { solution: hasard(moi.tirage.solutions) }, () => {}), delai(500, 1500));
    } else if (moi.phase === 'attaque') {
      minuterie = setTimeout(() => {
        const cibles = etat.equipes.filter((x) => x.id !== moi.equipeId && !x.blocage && x.protegeRestantMs <= 0);
        const cible = cibles.length ? hasard(cibles).id : null;
        s.emit('attaquer', { obstacle: hasard(moi.tirage.obstacles), cible }, () => {});
      }, delai(500, 1500));
    }
  });
  return s;
}

(async () => {
  const codes = await lireCodes();
  console.log(`${NB} élèves factices sur ${URL} (${codes.length} équipes, ${Math.round(TAUX * 100)} % de bonnes réponses).`);
  for (let i = 0; i < NB; i++) eleve(i, codes[i % codes.length]);
})().catch((e) => { console.error(e.message); process.exit(1); });
