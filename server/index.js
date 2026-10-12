'use strict';

const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const { Partie, ErreurJeu } = require('./jeu');
const stockage = require('./stockage');
const reseau = require('./reseau');

const CONFIG_SERVEUR = reseau.lireConfigServeur();
const MOT_DE_PASSE = CONFIG_SERVEUR.motDePasse || 'robot';
const PUBLIC = path.join(__dirname, '..', 'public');
let port = CONFIG_SERVEUR.port; // peut changer si le port est déjà pris

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

let adresseEnCache = null;
function calculerAdresse() {
  const locales = reseau.adressesLocales();
  const suffixePort = port === 80 ? '' : `:${port}`;
  let base;
  if (CONFIG_SERVEUR.adressePublique) base = CONFIG_SERVEUR.adressePublique;
  else base = `http://${locales.length ? locales[0].ip : 'localhost'}${suffixePort}`;
  return {
    base,
    complete: `${base}/jouer`,
    // Version courte à recopier : l'adresse sans « http:// » (la racine mène à /jouer).
    courte: base.replace(/^https?:\/\//, ''),
    autres: CONFIG_SERVEUR.adressePublique ? [] : locales.slice(1).map((a) => `${a.ip}${suffixePort}`),
    // Aucune carte réseau utilisable : les élèves ne pourront pas se connecter.
    sansReseau: !CONFIG_SERVEUR.adressePublique && (!locales.length || locales[0].ip.startsWith('169.254.')),
  };
}
function adresse() {
  if (!adresseEnCache) adresseEnCache = calculerAdresse();
  return adresseEnCache;
}
// Le PC peut changer de réseau (Wi-Fi, câble) : on recalcule régulièrement.
setInterval(() => {
  const nouvelle = calculerAdresse();
  if (JSON.stringify(nouvelle) !== JSON.stringify(adresseEnCache)) {
    adresseEnCache = nouvelle;
    qrEnCache = null;
    publicSale = true;
    planifier();
  }
}, 15000);

let qrEnCache = null;
async function qrSvg() {
  if (!qrEnCache) {
    qrEnCache = await QRCode.toString(adresse().complete, {
      type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#16161D', light: '#FFFFFF' },
    });
  }
  return qrEnCache;
}

// ---------- HTTP ----------

const app = express();
app.disable('x-powered-by');
app.get('/', (req, res) => res.redirect('/jouer'));
for (const page of ['course', 'jouer', 'admin', 'test']) {
  app.get(`/${page}`, (req, res) => res.sendFile(path.join(PUBLIC, `${page}.html`)));
}
// QR code de l'adresse élèves, généré sur place (aucun service externe).
app.get('/qr.svg', async (req, res) => {
  try {
    res.type('image/svg+xml').set('Cache-Control', 'no-cache').send(await qrSvg());
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
});
// Pages, styles et scripts : toujours revérifiés (une mise à jour du jeu est vue tout de suite).
// Polices et images : gardées en cache par les navigateurs.
app.use(express.static(PUBLIC, {
  setHeaders(res, fichier) {
    res.set('Cache-Control', /\.(woff2|svg|png|jpe?g)$/.test(fichier) ? 'public, max-age=86400' : 'no-cache');
  },
}));

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

function vueCourse() { return { ...partie.vuePublique({ avecCodes: true, avecEleves: true }), adresse: adresse() }; }
function vueAdmin() { return { ...partie.vueAdmin(), adresse: adresse() }; }

function diffuser() {
  minuterie = null;
  if (publicSale) {
    publicSale = false;
    io.to('course').emit('etat', vueCourse());
    io.to('eleves').emit('etat', partie.vuePublique());
    io.to('admin').emit('etat', vueAdmin());
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
    parcours: banque.parcours.map((p) => {
      const types = new Set(p.questions.map((id) => (banque.questions.find((q) => q.id === id) || {}).type).filter(Boolean));
      return { id: p.id, nom: p.nom, nb: p.questions.length, nbTypes: types.size };
    }),
    motDePasseParDefaut: MOT_DE_PASSE === 'robot',
  };
}

io.on('connection', (socket) => {
  const { role, jeton, motDePasse } = socket.handshake.auth || {};

  // Page de diagnostic /test : aller-retour temps réel.
  if (role === 'test') {
    socket.on('ping-test', (envoi, rappel) => {
      if (typeof rappel === 'function') rappel({ envoi, serveur: Date.now() });
    });
    return;
  }

  if (role === 'course') {
    socket.join('course');
    socket.emit('etat', vueCourse());
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
    socket.emit('etat', vueAdmin());

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
    gerer(socket, 'signalerEleve', ({ jeton: j, signale }) => partie.signalerEleve(j, signale));
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
    return { equipe: { id: e.id, nom: e.nom, couleur: e.couleur, symbole: e.symbole, texte: e.texte, clair: e.clair, nbEleves: nb } };
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

// ---------- Démarrage ----------

reseau.ecouter(serveur, CONFIG_SERVEUR.port).then((p) => {
  port = p;
  adresseEnCache = null;
  const a = adresse();
  const ligne = '='.repeat(60);
  console.log(ligne);
  console.log('  ROBOT RUSH est lancé. Laissez cette fenêtre ouverte pendant le cours.');
  console.log(ligne);
  console.log(`  Adresse à donner aux élèves :  ${a.complete}`);
  console.log(`  (version courte : ${a.courte})`);
  for (const autre of a.autres) console.log(`  Autre réseau possible : ${autre}`);
  if (a.sansReseau) console.log('  ATTENTION : aucun réseau détecté. Branchez le PC au réseau du collège.');
  console.log('');
  console.log(`  Projecteur  : http://localhost:${port}/course`);
  console.log(`  Professeur  : http://localhost:${port}/admin`);
  console.log(`  Diagnostic  : ${a.base}/test  (à ouvrir depuis un poste élève)`);
  if (p !== CONFIG_SERVEUR.port) console.log(`  Le port ${CONFIG_SERVEUR.port} était occupé : le jeu utilise le port ${p}.`);
  if (MOT_DE_PASSE === 'robot') {
    console.log('  Mot de passe professeur : « robot » (par défaut, à changer dans config-serveur.json).');
  }
  console.log(`  Données     : ${stockage.DOSSIER}`);
  console.log(ligne);
  if (CONFIG_SERVEUR.ouvrirNavigateur) reseau.ouvrirNavigateur(`http://localhost:${port}/admin`);
}).catch((e) => {
  console.error('');
  console.error(`Impossible de démarrer Robot Rush : ${e.message}`);
  process.exit(1);
});
