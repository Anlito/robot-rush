'use strict';

// Test de charge : une soixantaine d'élèves factices jouent une vraie partie, plus vite qu'en classe.
//
//   npm run test-charge                       → 60 élèves, 60 s, serveur de test lancé à part (données temporaires)
//   node tools/test-charge.js --eleves 80 --duree 120
//   node tools/test-charge.js --adresse https://robot-rush.onrender.com --mdp MOTDEPASSE   (serveur en ligne)
//
// Mesures : délai de réponse du serveur (accusé de réception des actions), délai de mise à jour de l'écran,
// volume reçu par élève, mémoire du serveur, erreurs et déconnexions. Rapport écrit dans docs/test-charge.md.

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { io } = require('socket.io-client');
const blocs = require('../server/blocs');

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map((a) => {
  const [k, ...v] = a.trim().split(/\s+/);
  return [k, v.join(' ') || true];
}));
const NB = Number(args.eleves) || 60;
const DUREE = Number(args.duree) || 60;
const EQUIPES = Number(args.equipes) || 8;
const PORT_TEST = 3099;
const MDP = args.mdp || process.env.ADMIN_PASSWORD || 'robot';
const RACINE = path.join(__dirname, '..');
const banque = new Map(JSON.parse(fs.readFileSync(path.join(RACINE, 'seed', 'questions.json'), 'utf8')).map((q) => [q.id, q]));
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const hasard = (t) => t[Math.floor(Math.random() * t.length)];

// ---------- Serveur de test ----------
async function lancerServeur() {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'robot-rush-charge-'));
  const enfant = spawn(process.execPath, [path.join(RACINE, 'server', 'index.js')], {
    env: { ...process.env, PORT: String(PORT_TEST), DATA_DIR: dossier, ADMIN_PASSWORD: MDP, OUVRIR_NAVIGATEUR: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let sortie = '';
  enfant.stdout.on('data', (d) => { sortie += d; });
  enfant.stderr.on('data', (d) => { sortie += d; });
  const adresse = `http://localhost:${PORT_TEST}`;
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${adresse}/sante`)).ok) return { adresse, enfant, dossier, sortie: () => sortie }; } catch { /* pas encore prêt */ }
    await attendre(200);
  }
  enfant.kill();
  throw new Error(`Le serveur de test n'a pas démarré :\n${sortie}`);
}

// ---------- Statistiques ----------
function centile(liste, p) {
  if (!liste.length) return 0;
  const t = liste.slice().sort((a, b) => a - b);
  return Math.round(t[Math.min(t.length - 1, Math.floor((p / 100) * t.length))]);
}

// ---------- Élèves ----------
function reponse(vue, q) {
  const juste = q && Math.random() < 0.7;
  switch (vue.type) {
    case 'qcm': return juste ? vue.choix.indexOf(q.donnees.choix[q.donnees.bonne]) : Math.floor(Math.random() * vue.choix.length);
    case 'ordre': {
      if (!juste) return vue.elements.map((_, i) => i).sort(() => Math.random() - 0.5);
      const pris = new Set();
      return q.donnees.elements.map((t) => { const i = vue.elements.findIndex((x, k) => x === t && !pris.has(k)); pris.add(i); return i; });
    }
    case 'calcul': return String(juste ? q.donnees.reponse : 999);
    case 'completer': return q.donnees.trous.map((t) => (juste ? t.bonne : '?'));
    case 'blocs': return blocs.versBlockly(juste ? q.donnees.sequences[0] : [{ bloc: 'led_etat', etat: 1 }]);
    default: return null;
  }
}

function eleve(numero, code, adresse, mesures) {
  return new Promise((resolve) => {
    const debut = Date.now();
    const s = io(adresse, { auth: { role: 'eleve' }, transports: ['websocket'], reconnection: true });
    let etat = null;
    let cle = '';
    let minuterie = null;
    let actionEnvoyeeA = 0;
    const m = { octets: 0, messages: 0 };
    mesures.eleves.push(m);
    const compter = (nom) => (x) => { m.messages++; m.octets += JSON.stringify(x || null).length; if (nom === 'etat') etat = x; };
    s.on('etat', compter('etat'));
    s.on('alerte', compter('alerte'));
    s.on('disconnect', (r) => { if (!mesures.fini) mesures.deconnexions.push(r); });
    s.on('connect_error', (e) => mesures.erreurs.push(`connexion : ${e.message}`));

    // Envoi avec mesure du délai d'accusé de réception.
    const envoyer = (ev, d) => {
      const t0 = performance.now();
      actionEnvoyeeA = t0;
      s.emit(ev, d, (r) => {
        mesures.accuses.push(performance.now() - t0);
        if (!r || !r.ok) {
          mesures.refus.push(`${ev} : ${r ? r.erreur : 'sans réponse'}`);
          // Action refusée : l'écran n'a pas à changer, on ne mesure pas de mise à jour.
          if (actionEnvoyeeA === t0) actionEnvoyeeA = 0;
        }
      });
    };

    s.on('moi', (moi) => {
      compter('moi')(moi);
      if (!moi) return;
      // Délai entre l'action de l'élève et la mise à jour de son écran.
      if (actionEnvoyeeA) { mesures.miseAJour.push(performance.now() - actionEnvoyeeA); actionEnvoyeeA = 0; }
      const k = `${moi.phase}|${moi.question ? moi.question.id + moi.question.numero : ''}|${JSON.stringify(moi.tirage)}`;
      if (k === cle || mesures.fini) return;
      cle = k;
      clearTimeout(minuterie);
      // Rythme soutenu (1 à 3 s par question) : plus exigeant qu'une vraie classe.
      if (moi.phase === 'question') {
        minuterie = setTimeout(() => envoyer('repondre', { questionId: moi.question.id, reponse: reponse(moi.question, banque.get(moi.question.id)) }), 1000 + Math.random() * 2000);
      } else if (moi.phase === 'action') {
        minuterie = setTimeout(() => envoyer('action', { action: hasard(['avancer', 'solution', 'solution', 'attaque', 'attaque']) }), 300 + Math.random() * 700);
      } else if (moi.phase === 'solution') {
        minuterie = setTimeout(() => envoyer('solution', { solution: hasard(moi.tirage.solutions) }), 300 + Math.random() * 500);
      } else if (moi.phase === 'attaque') {
        minuterie = setTimeout(() => {
          const cibles = etat ? etat.equipes.filter((x) => x.id !== moi.equipeId && !x.blocage && x.protegeRestantMs <= 0) : [];
          envoyer('attaquer', { obstacle: hasard(moi.tirage.obstacles), cible: cibles.length ? hasard(cibles).id : null });
        }, 300 + Math.random() * 500);
      }
    });
    s.on('connect', () => {
      if (s.recovered || cle) return;
      s.emit('rejoindre', { code, pseudo: `Eleve${numero}` }, (r) => {
        if (!r || !r.ok) mesures.erreurs.push(`rejoindre : ${r ? r.erreur : 'sans réponse'}`);
        // Comme le vrai navigateur (jeton gardé en mémoire) : une reconnexion retrouve l'équipe.
        else s.auth.jeton = r.jeton;
        mesures.connexions.push(Date.now() - debut);
        resolve(s);
      });
    });
  });
}

// ---------- Déroulement ----------
(async () => {
  let serveur = null;
  let adresse = args.adresse;
  if (!adresse) {
    process.stdout.write('Lancement d\'un serveur de test (données temporaires)… ');
    serveur = await lancerServeur();
    adresse = serveur.adresse;
    console.log('prêt.');
  }
  const mesures = { eleves: [], accuses: [], miseAJour: [], connexions: [], erreurs: [], refus: [], deconnexions: [], memoire: [], fini: false };

  const admin = io(adresse, { auth: { role: 'admin', motDePasse: MDP }, transports: ['websocket'] });
  const em = (ev, d = {}) => new Promise((r) => admin.emit(ev, d, r));
  await new Promise((r, rej) => { admin.once('etat', r); admin.once('admin:refuse', (e) => rej(new Error(e.erreur))); });
  await em('arreter');
  await em('nouvellePartie', { garderEquipes: false });
  // Piste longue et durée suffisante : la course ne doit pas finir avant la fin du test.
  const conf = await em('configurer', { nbEquipes: EQUIPES, parcoursId: 'p-test', reglages: { longueur: 100, dureePartie: Math.ceil(DUREE / 60) + 2 } });
  if (!conf.ok) throw new Error(`Configuration refusée : ${conf.erreur}`);
  const codes = await new Promise((r) => { admin.once('etat', (e) => r(e.equipes.map((x) => x.code))); em('configurer', {}); });

  console.log(`Connexion de ${NB} élèves répartis en ${EQUIPES} équipes…`);
  const t0 = Date.now();
  const sockets = await Promise.all(Array.from({ length: NB }, (_, i) => eleve(i + 1, codes[i % codes.length], adresse, mesures)));
  console.log(`  ${NB} élèves connectés en ${Date.now() - t0} ms.`);

  const dep = await em('demarrer', { forcer: true });
  if (!dep.ok) throw new Error(`Démarrage refusé : ${dep.erreur}`);
  console.log(`Course lancée pour ${DUREE} s…`);
  const debut = Date.now();
  while (Date.now() - debut < DUREE * 1000) {
    await attendre(5000);
    try { const s = await (await fetch(`${adresse}/sante`)).json(); mesures.memoire.push(s.memoireMo); } catch { /* ignoré */ }
    process.stdout.write(`  ${Math.round((Date.now() - debut) / 1000)} s · ${mesures.accuses.length} actions · mémoire ${mesures.memoire.at(-1) ?? '?'} Mo\n`);
  }
  mesures.fini = true;
  const fin = await new Promise((r) => { admin.once('etat', r); em('configurer', {}); });
  await em('arreter');
  for (const s of sockets) s.disconnect();
  admin.disconnect();
  console.log('');

  // ---------- Rapport ----------
  const duree = (Date.now() - debut) / 1000;
  const octets = mesures.eleves.map((m) => m.octets / duree);
  const messages = mesures.eleves.map((m) => m.messages / duree);
  const moyenne = (t) => t.reduce((a, b) => a + b, 0) / (t.length || 1);
  const a = mesures.accuses;
  const u = mesures.miseAJour;
  const verdict = centile(a, 95) < 250 && centile(u, 95) < 400 && mesures.erreurs.length === 0 && mesures.deconnexions.length === 0;
  const refusTypes = {};
  for (const r of mesures.refus) { const k = r.replace(/ : .*/, '') + ' : ' + r.split(' : ').slice(1).join(' : '); refusTypes[k] = (refusTypes[k] || 0) + 1; }
  const lignes = [
    '# Test de charge',
    '',
    `- Date : ${new Date().toLocaleString('fr-FR')}`,
    `- Serveur : ${args.adresse ? adresse : `local (serveur de test lancé par l'outil), ${os.cpus()[0].model.trim()}, ${Math.round(os.totalmem() / 1e9)} Go`}`,
    `- Node.js ${process.version}`,
    `- ${NB} élèves, ${EQUIPES} équipes, ${Math.round(duree)} s de course, une réponse toutes les 1 à 3 s par élève (plus rapide qu'en classe)`,
    '',
    '| Mesure | Résultat |',
    '|---|---|',
    `| Actions envoyées par les élèves | ${a.length} (${Math.round(a.length / duree)} par seconde) |`,
    `| Délai de réponse du serveur (médiane / 95 % / max) | ${centile(a, 50)} ms / ${centile(a, 95)} ms / ${centile(a, 100)} ms |`,
    `| Délai de mise à jour de l'écran élève (médiane / 95 %) | ${centile(u, 50)} ms / ${centile(u, 95)} ms |`,
    `| Connexion d'un élève (médiane / max) | ${centile(mesures.connexions, 50)} ms / ${centile(mesures.connexions, 100)} ms |`,
    `| Reçu par élève (moyenne) | ${(moyenne(octets) / 1024).toFixed(1)} Ko/s, ${moyenne(messages).toFixed(1)} messages/s |`,
    `| Mémoire du serveur (max) | ${mesures.memoire.length ? Math.max(...mesures.memoire) : '?'} Mo |`,
    `| Erreurs de connexion | ${mesures.erreurs.length} |`,
    `| Déconnexions imprévues | ${mesures.deconnexions.length} |`,
    `| Actions refusées par les règles (normal : cible devenue protégée…) | ${mesures.refus.length} |`,
    `| Positions en fin de test | ${fin.equipes.map((e) => `${e.nom} ${e.position}`).join(', ')} |`,
    '',
    `**Verdict : ${verdict ? 'fluide' : 'à surveiller'}** (seuils : 95 % des réponses en moins de 250 ms, des mises à jour en moins de 400 ms, aucune erreur ni déconnexion).`,
  ];
  if (Object.keys(refusTypes).length) {
    lignes.push('', 'Détail des actions refusées :', '', ...Object.entries(refusTypes).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([k, n]) => `- ${n} × ${k}`));
  }
  if (mesures.erreurs.length) lignes.push('', 'Erreurs :', '', ...mesures.erreurs.slice(0, 10).map((e) => `- ${e}`));
  const rapport = `${lignes.join('\n')}\n`;
  console.log(`\n${rapport}`);
  if (!args.adresse || args.rapport) {
    fs.mkdirSync(path.join(RACINE, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(RACINE, 'docs', 'test-charge.md'), rapport);
    console.log('Rapport enregistré dans docs/test-charge.md');
  }
  if (serveur) {
    serveur.enfant.kill();
    fs.rmSync(serveur.dossier, { recursive: true, force: true });
    if (/Error|erreur interne/i.test(serveur.sortie())) console.log(`\nSortie du serveur :\n${serveur.sortie()}`);
  }
  process.exit(verdict ? 0 : 1);
})().catch((e) => { console.error(`\nTest interrompu : ${e.message}`); process.exit(2); });
