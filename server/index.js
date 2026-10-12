'use strict';

const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const { Server } = require('socket.io');
const { Partie, ErreurJeu } = require('./jeu');
const stockage = require('./stockage');

const PORT = Number(process.env.PORT) || 3000;
const MOT_DE_PASSE = process.env.ADMIN_PASSWORD || 'robot';
const PUBLIC = path.join(__dirname, '..', 'public');

// ---------- Données ----------

const banque = { questions: stockage.charger('questions'), parcours: stockage.charger('parcours') };
const config = stockage.charger('config');

function trouverParcours(id) {
  return banque.parcours.find((p) => p.id === id) || banque.parcours[0] || null;
}

const partie = new Partie({
  questions: banque.questions,
  parcours: trouverParcours(config.parcoursId),
  reglages: config.reglages,
  paires: config.paires,
  nbEquipes: config.nbEquipes,
});

// ---------- Adresse à donner aux élèves ----------

function adressesLocales() {
  const res = [];
  for (const liste of Object.values(os.networkInterfaces())) {
    for (const a of liste || []) if (a.family === 'IPv4' && !a.internal) res.push(a.address);
  }
  return res;
}

function adresseEleves() {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const ip = adressesLocales()[0] || 'localhost';
  return `http://${ip}${PORT === 80 ? '' : `:${PORT}`}`;
}

// ---------- HTTP ----------

const app = express();
app.disable('x-powered-by');
app.get('/', (req, res) => res.redirect('/jouer'));
for (const page of ['course', 'jouer', 'admin']) {
  app.get(`/${page}`, (req, res) => res.sendFile(path.join(PUBLIC, `${page}.html`)));
}
app.use(express.static(PUBLIC));

const serveur = http.createServer(app);
const io = new Server(serveur, { pingInterval: 10000, pingTimeout: 8000 });

// ---------- Diffusion de l'état (regroupée pour rester fluide à 60 élèves) ----------

const socketsParJeton = new Map(); // jeton → Set<socket>
let publicSale = true;
const joueursSales = new Set();
let minuterie = null;

function planifier() {
  if (!minuterie) minuterie = setTimeout(diffuser, 40);
}

function diffuser() {
  minuterie = null;
  if (publicSale) {
    publicSale = false;
    const adresse = adresseEleves();
    io.to('course').emit('etat', { ...partie.vuePublique({ avecCodes: true, avecEleves: true }), adresse });
    io.to('eleves').emit('etat', partie.vuePublique());
    io.to('admin').emit('etat', { ...partie.vueAdmin(), adresse });
  }
  for (const jeton of joueursSales) {
    const vue = partie.vueEleve(jeton);
    for (const s of socketsParJeton.get(jeton) || []) s.emit('moi', vue);
  }
  joueursSales.clear();
}

partie.on('change', () => { publicSale = true; planifier(); });
partie.on('joueur', (jeton) => { joueursSales.add(jeton); planifier(); });
partie.on('alerte', (equipeId, alerte) => {
  for (const j of partie.joueurs.values()) {
    if (j.equipeId !== equipeId) continue;
    for (const s of socketsParJeton.get(j.jeton) || []) s.emit('alerte', alerte);
  }
});
partie.on('retire', (jeton, motif) => {
  for (const s of socketsParJeton.get(jeton) || []) { s.emit('retire', { motif }); s.data.jeton = null; }
  socketsParJeton.delete(jeton);
});

setInterval(() => partie.tick(), 200);

// ---------- Temps réel ----------

// Enregistre un gestionnaire : les erreurs « métier » sont renvoyées telles quelles au navigateur.
function gerer(socket, nom, fn) {
  socket.on(nom, (donnees, rappel) => {
    const repondre = typeof rappel === 'function' ? rappel : () => {};
    try {
      const r = fn(donnees || {});
      repondre({ ok: true, ...(r || {}) });
    } catch (e) {
      if (e instanceof ErreurJeu) repondre({ ok: false, erreur: e.message });
      else { console.error(e); repondre({ ok: false, erreur: 'Erreur interne du serveur.' }); }
    }
  });
}

function associer(socket, jeton) {
  socket.data.jeton = jeton;
  if (!socketsParJeton.has(jeton)) socketsParJeton.set(jeton, new Set());
  socketsParJeton.get(jeton).add(socket);
  joueursSales.add(jeton);
  planifier();
}

function motDePasseValide(essai) {
  const a = crypto.createHash('sha256').update(String(essai || '')).digest();
  const b = crypto.createHash('sha256').update(MOT_DE_PASSE).digest();
  return crypto.timingSafeEqual(a, b);
}

function donneesAdmin() {
  return {
    parcours: banque.parcours.map((p) => ({ id: p.id, nom: p.nom, nb: p.questions.length })),
  };
}

io.on('connection', (socket) => {
  const { role, jeton, motDePasse } = socket.handshake.auth || {};

  if (role === 'course') {
    socket.join('course');
    socket.emit('etat', { ...partie.vuePublique({ avecCodes: true, avecEleves: true }), adresse: adresseEleves() });
    return;
  }

  if (role === 'admin') {
    if (!motDePasseValide(motDePasse)) {
      socket.emit('admin:refuse', { erreur: 'Mot de passe incorrect.' });
      socket.disconnect(true);
      return;
    }
    socket.join('admin');
    socket.emit('admin:donnees', donneesAdmin());
    socket.emit('etat', { ...partie.vueAdmin(), adresse: adresseEleves() });

    gerer(socket, 'configurer', ({ parcoursId, nbEquipes, reglages }) => {
      const parcours = parcoursId !== undefined ? trouverParcours(parcoursId) : undefined;
      partie.configurer({ parcours, nbEquipes, reglages });
      Object.assign(config, { reglages: partie.reglages, nbEquipes: partie.equipes.length,
        parcoursId: partie.parcours ? partie.parcours.id : null });
      stockage.sauver('config', config);
    });
    gerer(socket, 'demarrer', ({ forcer }) => partie.demarrer({ forcer }));
    gerer(socket, 'pause', () => partie.pause());
    gerer(socket, 'reprendre', () => partie.reprendre());
    gerer(socket, 'arreter', () => partie.arreter());
    gerer(socket, 'nouvellePartie', ({ garderEquipes }) => partie.nouvellePartie({ garderEquipes }));
    gerer(socket, 'regenererCodes', () => partie.regenererCodes());
    gerer(socket, 'retirerEleve', ({ jeton: j }) => partie.retirerEleve(j));
    gerer(socket, 'deplacerEleve', ({ jeton: j, equipeId }) => partie.deplacerEleve(j, equipeId));
    return;
  }

  // Élève
  socket.join('eleves');
  socket.emit('etat', partie.vuePublique());
  if (jeton && partie.joueurs.has(jeton)) {
    partie.connecter(jeton);
    associer(socket, jeton);
  } else {
    socket.emit('moi', null);
  }

  gerer(socket, 'rejoindre', ({ code, pseudo }) => {
    if (socket.data.jeton) return { jeton: socket.data.jeton };
    const j = partie.rejoindre({ code, pseudo });
    associer(socket, j.jeton);
    return { jeton: j.jeton };
  });
  // Confirmation avant de rejoindre : « Tu rejoins l'équipe Bleue · 4 coéquipiers ».
  gerer(socket, 'verifierCode', ({ code }) => {
    const e = partie.equipes.find((x) => x.code === String(code || '').trim().toUpperCase());
    if (!e) return { equipe: null };
    const nb = [...partie.joueurs.values()].filter((j) => j.equipeId === e.id).length;
    return { equipe: { id: e.id, nom: e.nom, couleur: e.couleur, symbole: e.symbole, texte: e.texte, nbEleves: nb } };
  });
  const moi = () => socket.data.jeton;
  gerer(socket, 'repondre', (d) => partie.repondre(moi(), d));
  gerer(socket, 'action', ({ action }) => partie.choisirAction(moi(), action));
  gerer(socket, 'solution', ({ solution }) => partie.prendreSolution(moi(), solution));
  gerer(socket, 'attaquer', ({ obstacle, cible }) => partie.attaquer(moi(), { obstacle, cible }));

  socket.on('disconnect', () => {
    const j = socket.data.jeton;
    if (!j) return;
    const set = socketsParJeton.get(j);
    if (set) {
      set.delete(socket);
      if (set.size === 0) { socketsParJeton.delete(j); partie.deconnecter(j); }
    }
  });
});

serveur.listen(PORT, () => {
  console.log('Robot Rush est lancé.');
  console.log(`  Élèves      : ${adresseEleves()}`);
  for (const ip of adressesLocales().slice(1)) console.log(`                (ou http://${ip}:${PORT})`);
  console.log(`  Projecteur  : http://localhost:${PORT}/course`);
  console.log(`  Professeur  : http://localhost:${PORT}/admin`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log('  Attention : mot de passe professeur par défaut (« robot »). Définissez ADMIN_PASSWORD.');
  }
  console.log(`  Données     : ${stockage.DOSSIER}`);
});
