'use strict';

const { EventEmitter } = require('node:events');
const crypto = require('node:crypto');
const {
  ALPHABET_CODES, LONGUEUR_CODE, EQUIPES, REGLAGES_DEFAUT, BORNES_REGLAGES, LIBELLES_REGLAGES, PAIRES_DEFAUT, TYPES_LONGS, MOTS_SIGNALES,
} = require('./constantes');
const { TYPES, typeJouable, melanger } = require('./types');

// Erreur « métier » : son message est affiché tel quel à l'élève ou au professeur.
class ErreurJeu extends Error {}
const erreur = (message) => { throw new ErreurJeu(message); };

const ETATS = { LOBBY: 'lobby', EN_COURS: 'en_cours', PAUSE: 'pause', TERMINEE: 'terminee' };
const TAILLE_FIL = 20;
const DUREE_SUCCES_MS = 1000;
const LONGUEUR_PSEUDO = 16;

/** Pseudo probablement inapproprié : signalé au professeur, jamais refusé automatiquement. */
function pseudoSignale(pseudo) {
  const normal = String(pseudo).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't');
  const mots = normal.split(/[^a-z]+/).filter(Boolean);
  const colle = mots.join('');
  // Mots courts : seulement s'ils sont isolés (« con » ne doit pas signaler « Constance ») ;
  // mots de 4 lettres ou plus : aussi à l'intérieur du pseudo (« GrosCaca »).
  return MOTS_SIGNALES.some((m) => mots.includes(m) || (m.length >= 4 && colle.includes(m)));
}

function nettoyerReglages(entree, base = REGLAGES_DEFAUT) {
  const r = { ...base };
  for (const [cle, [min, max]] of Object.entries(BORNES_REGLAGES)) {
    if (entree && entree[cle] !== undefined && entree[cle] !== '') {
      const n = Math.round(Number(entree[cle]));
      if (!Number.isFinite(n)) erreur(`${LIBELLES_REGLAGES[cle]} : nombre attendu.`);
      if (n < min || n > max) erreur(`${LIBELLES_REGLAGES[cle]} : entre ${min} et ${max}.`);
      r[cle] = n;
    }
  }
  if (entree && entree.solutionGarantie !== undefined) r.solutionGarantie = Boolean(entree.solutionGarantie);
  return r;
}

/**
 * Une partie : machine à états lobby → en_cours ↔ pause → terminee.
 *
 * Tout le temps de jeu est mesuré par une horloge interne `this.t` (ms) qui n'avance
 * que pendant `en_cours` : la pause gèle donc automatiquement chronos, blocages et questions.
 * Le serveur appelle `tick()` régulièrement ; les tests injectent `maintenant` et `rng`.
 *
 * Événements émis :
 *  - 'change'                 : l'état public a changé
 *  - 'joueur' (jeton)         : l'état personnel d'un élève a changé
 *  - 'alerte' (equipeId, a)   : flash à afficher chez les élèves d'une équipe
 *  - 'retire' (jeton, motif)  : l'élève doit revenir à l'écran de connexion
 */
class Partie extends EventEmitter {
  constructor({ questions = [], parcours = null, reglages = {}, paires = PAIRES_DEFAUT, nbEquipes = 4,
    rng = Math.random, maintenant = Date.now } = {}) {
    super();
    this.rng = rng;
    this.maintenant = maintenant;
    this.etat = ETATS.LOBBY;
    this.t = 0;
    this.dernierTick = maintenant();
    this.joueurs = new Map(); // jeton → joueur
    this.fil = [];
    this.resultat = null;
    this.idFil = 0;
    this.configurer({ questions, parcours, reglages, paires, nbEquipes });
  }

  // ---------- Configuration (salle d'attente) ----------

  configurer({ questions, parcours, reglages, paires, nbEquipes } = {}) {
    if (this.etat !== ETATS.LOBBY) erreur('La partie a déjà commencé : réglages verrouillés.');
    if (reglages !== undefined) this.reglages = nettoyerReglages(reglages, this.reglages || REGLAGES_DEFAUT);
    if (paires !== undefined) {
      if (!Array.isArray(paires) || paires.length < 2) erreur('Il faut au moins 2 paires obstacle / solution.');
      this.paires = paires;
    }
    if (parcours !== undefined) this.parcours = parcours;
    if (questions !== undefined) this.toutesQuestions = questions;
    this.questions = this.questionsDuParcours();
    if (nbEquipes !== undefined) {
      const n = Number(nbEquipes);
      if (!Number.isInteger(n) || n < 2 || n > EQUIPES.length) erreur(`Nombre d'équipes : entre 2 et ${EQUIPES.length}.`);
      if (!this.equipes || this.equipes.length !== n) this.creerEquipes(n);
    }
    // Les stocks dépendent des paires.
    for (const e of this.equipes) e.stock = this.stockVide(e.stock);
    this.emit('change');
  }

  questionsDuParcours() {
    const toutes = this.toutesQuestions || [];
    let liste = toutes;
    if (this.parcours && Array.isArray(this.parcours.questions)) {
      const parId = new Map(toutes.map((q) => [q.id, q]));
      liste = this.parcours.questions.map((id) => parId.get(id)).filter(Boolean);
    }
    return liste.filter(typeJouable);
  }

  stockVide(ancien = {}) {
    const s = {};
    for (const p of this.paires) s[p.solution.id] = Math.min(ancien[p.solution.id] || 0, this.reglages.stockMax);
    return s;
  }

  creerEquipes(n) {
    const anciennes = this.equipes || [];
    const codes = this.nouveauxCodes(n);
    this.equipes = EQUIPES.slice(0, n).map((modele, i) => ({
      id: i,
      ...modele,
      code: anciennes[i] ? anciennes[i].code : codes[i],
      position: 0,
      stock: this.stockVide(),
      blocage: null, // { obstacle, finA, par }
      protegeJusqua: 0,
      succesJusqua: 0,
      justes: 0,
    }));
    // Codes uniques même en gardant les anciens.
    const vus = new Set();
    for (const e of this.equipes) {
      if (vus.has(e.code)) e.code = this.nouveauxCodes(1, vus)[0];
      vus.add(e.code);
    }
    // Les élèves des équipes supprimées repassent par l'écran de connexion.
    for (const j of [...this.joueurs.values()]) {
      if (j.equipeId >= n) this.supprimerJoueur(j.jeton, 'Les équipes ont changé : demande le nouveau code.');
    }
  }

  nouveauxCodes(n, dejaPris = new Set()) {
    const codes = [];
    while (codes.length < n) {
      let c = '';
      for (let i = 0; i < LONGUEUR_CODE; i++) c += ALPHABET_CODES[Math.floor(this.rng() * ALPHABET_CODES.length)];
      if (!dejaPris.has(c) && !codes.includes(c)) codes.push(c);
    }
    return codes;
  }

  regenererCodes() {
    if (this.etat !== ETATS.LOBBY) erreur('Les codes ne peuvent changer qu\'avant le départ.');
    const codes = this.nouveauxCodes(this.equipes.length);
    this.equipes.forEach((e, i) => { e.code = codes[i]; });
    this.emit('change');
  }

  // ---------- Élèves ----------

  rejoindre({ code, pseudo, jeton } = {}) {
    if (jeton && this.joueurs.has(jeton)) {
      this.connecter(jeton);
      return this.joueurs.get(jeton);
    }
    if (this.etat === ETATS.TERMINEE) erreur('La partie est terminée.');
    const c = String(code || '').trim().toUpperCase();
    const equipe = this.equipes.find((e) => e.code === c);
    if (!equipe) erreur('Code inconnu. Vérifie les 4 caractères au tableau.');
    const p = String(pseudo || '').trim().replace(/\s+/g, ' ');
    if (!p) erreur('Choisis un pseudo.');
    if (p.length > LONGUEUR_PSEUDO) erreur(`Pseudo trop long (${LONGUEUR_PSEUDO} caractères au plus).`);
    const pris = [...this.joueurs.values()].some((j) => j.pseudo.toLowerCase() === p.toLowerCase());
    if (pris) erreur('Ce pseudo est déjà pris : choisis-en un autre.');

    const j = {
      jeton: crypto.randomUUID(),
      pseudo: p,
      equipeId: equipe.id,
      connecte: true,
      phase: 'attente',
      question: null,      // { q, vue, prive, finA }
      finPhase: 0,         // fin de l'attente (erreur) ou du choix d'action
      tirage: null,        // { solutions: [...] } ou { obstacles: [...] }
      retour: null,        // { correct, donnee, bonne, explication }
      vues: new Set(),
      indexSuivant: 0,
      numero: 0,
      stats: { justes: 0, attaques: 0, solutions: 0 },
      signale: pseudoSignale(p),
    };
    this.joueurs.set(j.jeton, j);
    if (this.etat === ETATS.EN_COURS || this.etat === ETATS.PAUSE) this.donnerQuestion(j);
    this.emit('change');
    this.emit('joueur', j.jeton);
    return j;
  }

  connecter(jeton) {
    const j = this.joueurs.get(jeton);
    if (!j) return;
    j.connecte = true;
    if (j.phase === 'attente' && (this.etat === ETATS.EN_COURS || this.etat === ETATS.PAUSE)) this.donnerQuestion(j);
    this.emit('change');
    this.emit('joueur', jeton);
  }

  deconnecter(jeton) {
    const j = this.joueurs.get(jeton);
    if (!j) return;
    j.connecte = false;
    this.emit('change');
  }

  retirerEleve(jeton) {
    if (!this.joueurs.has(jeton)) erreur('Élève introuvable.');
    this.supprimerJoueur(jeton, 'Le professeur t\'a retiré de la partie. Rejoins avec un autre pseudo.');
    this.emit('change');
  }

  supprimerJoueur(jeton, motif) {
    this.joueurs.delete(jeton);
    this.emit('retire', jeton, motif);
  }

  signalerEleve(jeton, signale) {
    const j = this.joueurs.get(jeton);
    if (!j) erreur('Élève introuvable.');
    j.signale = Boolean(signale);
    this.emit('change');
  }

  deplacerEleve(jeton, equipeId) {
    const j = this.joueurs.get(jeton);
    if (!j) erreur('Élève introuvable.');
    const e = this.equipes[Number(equipeId)];
    if (!e) erreur('Équipe introuvable.');
    j.equipeId = e.id;
    // Un choix d'action en cours dépendait de l'ancienne équipe : on l'annule.
    if (['action', 'solution', 'attaque'].includes(j.phase)) this.donnerQuestion(j);
    this.emit('change');
    this.emit('joueur', jeton);
  }

  // ---------- Déroulement ----------

  elevesParEquipe() {
    const n = this.equipes.map(() => 0);
    for (const j of this.joueurs.values()) n[j.equipeId]++;
    return n;
  }

  demarrer({ forcer = false } = {}) {
    if (this.etat === ETATS.PAUSE) return this.reprendre();
    if (this.etat !== ETATS.LOBBY) erreur('La partie est déjà lancée.');
    if (this.questions.length === 0) erreur('Le parcours ne contient aucune question jouable.');
    if (this.joueurs.size === 0) erreur('Aucun élève n\'a rejoint la partie.');
    const n = this.elevesParEquipe();
    const vides = this.equipes.filter((e) => n[e.id] === 0);
    if (vides.length && !forcer) {
      const utilises = this.equipes.length - vides.length;
      return {
        avertissement: `${this.equipes.length} équipes configurées, ${utilises} code${utilises > 1 ? 's' : ''} utilisé${utilises > 1 ? 's' : ''}`
          + ` (sans élève : ${vides.map((e) => e.nom).join(', ')}). Démarrer quand même ?`,
      };
    }
    this.etat = ETATS.EN_COURS;
    this.t = 0;
    this.dernierTick = this.maintenant();
    for (const j of this.joueurs.values()) if (j.connecte) this.donnerQuestion(j);
    this.ajouterFil({ type: 'depart', texte: 'Départ de la course !' });
    this.emit('change');
    return {};
  }

  pause() {
    if (this.etat !== ETATS.EN_COURS) erreur('La partie n\'est pas en cours.');
    this.tick();
    this.etat = ETATS.PAUSE;
    this.emit('change');
  }

  reprendre() {
    if (this.etat !== ETATS.PAUSE) erreur('La partie n\'est pas en pause.');
    this.dernierTick = this.maintenant();
    this.etat = ETATS.EN_COURS;
    this.emit('change');
    return {};
  }

  arreter() {
    if (this.etat !== ETATS.EN_COURS && this.etat !== ETATS.PAUSE) erreur('Aucune partie en cours.');
    this.terminer('arret');
  }

  /** Revient en salle d'attente. Avec garderEquipes, les élèves et les codes sont conservés. */
  nouvellePartie({ garderEquipes = true } = {}) {
    this.etat = ETATS.LOBBY;
    this.t = 0;
    this.fil = [];
    this.resultat = null;
    if (!garderEquipes) {
      for (const jeton of [...this.joueurs.keys()]) this.supprimerJoueur(jeton, 'Nouvelle partie : demande le nouveau code.');
      const n = this.equipes.length;
      this.equipes = null;
      this.creerEquipes(n);
    } else {
      this.equipes.forEach((e) => Object.assign(e, {
        position: 0, stock: this.stockVide(), blocage: null, protegeJusqua: 0, succesJusqua: 0, justes: 0,
      }));
      for (const j of this.joueurs.values()) {
        Object.assign(j, { phase: 'attente', question: null, tirage: null, retour: null, vues: new Set(),
          indexSuivant: 0, numero: 0, stats: { justes: 0, attaques: 0, solutions: 0 } });
        this.emit('joueur', j.jeton);
      }
    }
    this.emit('change');
  }


  tick() {
    const n = this.maintenant();
    if (this.etat !== ETATS.EN_COURS) { this.dernierTick = n; return; }
    this.t += Math.max(0, n - this.dernierTick);
    this.dernierTick = n;

    for (const e of this.equipes) {
      if (e.blocage && this.t >= e.blocage.finA) {
        const obstacle = this.obstacle(e.blocage.obstacle);
        e.blocage = null;
        e.protegeJusqua = this.t + this.reglages.protection * 1000;
        this.ajouterFil({ type: 'repart', equipe: e.id, obstacle: obstacle.id, texte: `${e.nom} repart après ${obstacle.le}` });
        this.emit('alerte', e.id, { type: 'debloque', texte: `Fin du blocage · protégés ${this.reglages.protection} s` });
        this.emit('change');
      }
    }

    for (const j of this.joueurs.values()) {
      if (j.phase === 'question' && this.t >= j.question.finA) {
        if (j.connecte) this.repondreFaux(j, null);
        else { j.phase = 'attente'; j.question = null; this.emit('joueur', j.jeton); }
      } else if (j.phase === 'erreur' && this.t >= j.finPhase) {
        this.donnerQuestion(j);
      } else if (['action', 'solution', 'attaque'].includes(j.phase) && this.t >= j.finPhase) {
        this.actionParDefaut(j);
      }
      if (this.etat !== ETATS.EN_COURS) return; // l'action par défaut a pu finir la course
    }

    if (this.t >= this.reglages.dureePartie * 60000) this.terminer('temps');
  }

  // ---------- Questions ----------

  donnerQuestion(j) {
    const qs = this.questions;
    let q;
    if (this.parcours && this.parcours.ordre_aleatoire === false) {
      q = qs[j.indexSuivant % qs.length];
      j.indexSuivant++;
    } else {
      let candidates = qs.filter((x) => !j.vues.has(x.id));
      if (candidates.length === 0) {
        // Toutes vues : on recommence, en évitant de reposer la dernière tout de suite.
        const derniere = j.question && j.question.q.id;
        j.vues.clear();
        candidates = qs.length > 1 ? qs.filter((x) => x.id !== derniere) : qs;
      }
      q = candidates[Math.floor(this.rng() * candidates.length)];
    }
    j.vues.add(q.id);
    j.numero++;
    const { vue, prive } = TYPES[q.type].preparer(q, this.rng);
    const duree = (q.duree_s || (TYPES_LONGS.includes(q.type) ? this.reglages.tempsQuestionLong : this.reglages.tempsQuestion)) * 1000;
    j.question = { q, vue, prive, finA: this.t + duree, duree };
    j.phase = 'question';
    j.tirage = null;
    this.emit('joueur', j.jeton);
  }

  repondre(jeton, { questionId, reponse } = {}) {
    const j = this.joueurActif(jeton);
    if (j.phase !== 'question') erreur('Pas de question en attente de réponse.');
    if (questionId !== undefined && questionId !== j.question.q.id) erreur('Cette question a expiré.');
    const { q, prive } = j.question;
    const correct = TYPES[q.type].valider(q, reponse, prive);
    if (!correct) { this.repondreFaux(j, reponse); return { correct: false }; }

    const equipe = this.equipes[j.equipeId];
    j.stats.justes++;
    equipe.justes++;
    j.retour = { correct: true, explication: q.explication || null };
    j.phase = 'action';
    j.finPhase = this.t + this.reglages.delaiAction * 1000;
    this.emit('joueur', jeton);
    this.emit('change');
    return { correct: true };
  }

  repondreFaux(j, reponse) {
    const { q, prive } = j.question;
    const { donnee, bonne } = TYPES[q.type].textes(q, reponse, prive);
    j.retour = { correct: false, donnee: reponse === null ? null : donnee, bonne, explication: q.explication || null,
      tempsDepasse: reponse === null };
    j.phase = 'erreur';
    j.finPhase = this.t + this.reglages.attenteErreur * 1000;
    this.emit('joueur', j.jeton);
  }

  // ---------- Actions après une bonne réponse ----------

  /** Ce que l'élève peut choisir : sert à l'affichage et à la validation. */
  options(j) {
    const e = this.equipes[j.equipeId];
    return {
      avancer: !e.blocage,
      solution: this.solutionsDisponibles(e).length > 0,
      attaque: this.ciblesPossibles(e).length > 0,
    };
  }

  solutionsDisponibles(e) {
    return this.paires.map((p) => p.solution.id).filter((s) => e.stock[s] < this.reglages.stockMax);
  }

  ciblesPossibles(e) {
    return this.equipes.filter((x) => x.id !== e.id && this.peutRecevoir(x));
  }

  peutRecevoir(e) {
    return !e.blocage && e.protegeJusqua <= this.t;
  }

  choisirAction(jeton, action) {
    const j = this.joueurActif(jeton);
    if (j.phase !== 'action') erreur('Aucune action à choisir.');
    const e = this.equipes[j.equipeId];
    const opts = this.options(j);
    if (!opts[action]) {
      const motifs = {
        avancer: 'Votre robot est bloqué : impossible d\'avancer.',
        solution: 'Votre stock de solutions est plein.',
        attaque: 'Aucune équipe ne peut être attaquée pour le moment.',
      };
      erreur(motifs[action] || 'Action inconnue.');
    }
    if (action === 'avancer') {
      this.avancer(j);
    } else if (action === 'solution') {
      j.tirage = { solutions: this.tirerSolutions(e) };
      j.phase = 'solution';
      this.emit('joueur', jeton);
    } else {
      const obstacles = melanger(this.paires.map((p) => p.obstacle.id), this.rng).slice(0, 2);
      j.tirage = { obstacles };
      j.phase = 'attaque';
      this.emit('joueur', jeton);
    }
    return {};
  }

  tirerSolutions(e) {
    const dispo = this.solutionsDisponibles(e);
    const utile = e.blocage ? this.solutionDe(e.blocage.obstacle).id : null;
    if (this.reglages.solutionGarantie && utile && dispo.includes(utile)) {
      const autres = melanger(dispo.filter((s) => s !== utile), this.rng).slice(0, 1);
      return melanger([utile, ...autres], this.rng);
    }
    return melanger(dispo, this.rng).slice(0, 2);
  }

  avancer(j) {
    const e = this.equipes[j.equipeId];
    e.position = Math.min(this.reglages.longueur, e.position + this.reglages.gainAvancer);
    this.emit('change');
    if (e.position >= this.reglages.longueur) {
      this.ajouterFil({ type: 'arrivee', equipe: e.id, texte: `${e.nom} franchit la ligne d'arrivée !` });
      this.terminer('arrivee');
      return;
    }
    this.donnerQuestion(j);
  }

  prendreSolution(jeton, solutionId) {
    const j = this.joueurActif(jeton);
    if (j.phase !== 'solution') erreur('Aucune solution à choisir.');
    if (!j.tirage.solutions.includes(solutionId)) erreur('Cette solution ne fait pas partie du tirage.');
    this.appliquerSolution(j, solutionId);
    this.donnerQuestion(j);
    return {};
  }

  appliquerSolution(j, solutionId) {
    const e = this.equipes[j.equipeId];
    const sol = this.solution(solutionId);
    j.stats.solutions++;
    if (e.blocage && this.solutionDe(e.blocage.obstacle).id === solutionId) {
      // La solution qui débloque est consommée aussitôt.
      e.blocage = null;
      e.protegeJusqua = this.t + this.reglages.protection * 1000;
      e.succesJusqua = this.t + DUREE_SUCCES_MS;
      this.ajouterFil({ type: 'debloque', equipe: e.id, solution: sol.id, pseudo: j.pseudo, texte: `${e.nom} prend ${sol.un} et repart` });
      this.emit('alerte', e.id, { type: 'debloque', solution: sol.id,
        texte: `${j.pseudo} a pris ${sol.un} · protégés ${this.reglages.protection} s` });
    } else {
      // Stock plein : le tirage l'exclut, mais l'état a pu changer entre-temps.
      e.stock[sol.id] = Math.min(this.reglages.stockMax, (e.stock[sol.id] || 0) + 1);
      this.ajouterFil({ type: 'stock', equipe: e.id, solution: sol.id, pseudo: j.pseudo, texte: `${e.nom} stocke ${sol.un}` });
    }
    this.emit('change');
  }

  attaquer(jeton, { obstacle, cible } = {}) {
    const j = this.joueurActif(jeton);
    if (j.phase !== 'attaque') erreur('Aucune attaque à choisir.');
    if (!j.tirage.obstacles.includes(obstacle)) erreur('Cet obstacle ne fait pas partie du tirage.');
    const e = this.equipes[j.equipeId];
    let c;
    if (this.equipes.length === 2) c = this.equipes.find((x) => x.id !== e.id);
    else c = this.equipes[Number(cible)];
    if (!c || c.id === e.id) erreur('Choisis une équipe adverse.');
    if (c.blocage) erreur(`L'équipe ${c.nom} est déjà bloquée.`);
    if (c.protegeJusqua > this.t) erreur(`L'équipe ${c.nom} est protégée quelques secondes.`);
    this.appliquerObstacle(c, obstacle, e, j.pseudo);
    j.stats.attaques++;
    this.donnerQuestion(j);
    return {};
  }

  appliquerObstacle(cible, obstacleId, source, pseudo = null) {
    const obs = this.obstacle(obstacleId);
    const sol = this.solutionDe(obstacleId);
    if (cible.stock[sol.id] > 0) {
      cible.stock[sol.id]--;
      cible.succesJusqua = this.t + DUREE_SUCCES_MS;
      this.ajouterFil({ type: 'parade', equipe: cible.id, source: source.id, obstacle: obs.id, solution: sol.id,
        texte: `${cible.nom} franchit ${obs.le} avec ${sol.sa || sol.un}` });
      this.emit('alerte', cible.id, { type: 'parade', obstacle: obs.id, solution: sol.id,
        texte: `${source.nom} t'envoie ${obs.un} : paré avec ${sol.un} du stock` });
      this.emit('alerte', source.id, { type: 'info', texte: `${cible.nom} avait ${sol.un} en stock : attaque parée` });
    } else {
      cible.blocage = { obstacle: obs.id, finA: this.t + this.reglages.dureeBlocage * 1000, par: source.id };
      this.ajouterFil({ type: 'attaque', equipe: source.id, cible: cible.id, obstacle: obs.id, pseudo,
        texte: `${source.nom} envoie ${obs.un} à ${cible.nom} !` });
      this.emit('alerte', cible.id, { type: 'attaque', obstacle: obs.id, solution: sol.id,
        texte: `${source.nom} t'envoie ${obs.un}` });
      // Un élève de l'équipe ciblée qui allait avancer ne le peut plus : son écran doit se mettre à jour.
      for (const j of this.joueurs.values()) if (j.equipeId === cible.id && j.phase === 'action') this.emit('joueur', j.jeton);
    }
    this.emit('change');
  }

  /** Délai de choix écoulé : « Avancer » si possible, sinon une solution, sinon rien. */
  actionParDefaut(j) {
    const e = this.equipes[j.equipeId];
    if (j.phase === 'solution' && j.tirage.solutions.length) {
      const utile = e.blocage ? this.solutionDe(e.blocage.obstacle).id : null;
      const choix = j.tirage.solutions.includes(utile) ? utile : j.tirage.solutions[Math.floor(this.rng() * j.tirage.solutions.length)];
      this.appliquerSolution(j, choix);
      this.donnerQuestion(j);
      return;
    }
    const opts = this.options(j);
    if (opts.avancer) { this.avancer(j); return; }
    if (j.phase === 'action' && opts.solution) {
      const tirage = this.tirerSolutions(e);
      const utile = e.blocage ? this.solutionDe(e.blocage.obstacle).id : null;
      const choix = tirage.includes(utile) ? utile : tirage[Math.floor(this.rng() * tirage.length)];
      this.appliquerSolution(j, choix);
    }
    this.donnerQuestion(j);
  }

  // ---------- Fin ----------

  terminer(raison) {
    this.etat = ETATS.TERMINEE;
    // Classement : position, puis nombre de réponses justes ; égalité parfaite = ex æquo.
    const tri = this.equipes.slice().sort((a, b) => b.position - a.position || b.justes - a.justes);
    let rang = 0;
    const classement = tri.map((e, i) => {
      const prec = tri[i - 1];
      if (!prec || prec.position !== e.position || prec.justes !== e.justes) rang = i + 1;
      return { equipe: e.id, rang, position: e.position, justes: e.justes };
    });
    const joueurs = [...this.joueurs.values()];
    const meilleur = (cle) => {
      const j = joueurs.filter((x) => x.stats[cle] > 0).sort((a, b) => b.stats[cle] - a.stats[cle])[0];
      return j ? { pseudo: j.pseudo, equipe: j.equipeId, score: j.stats[cle] } : null;
    };
    this.resultat = {
      raison,
      dureeMs: this.t,
      classement,
      meilleurs: { justes: meilleur('justes'), attaques: meilleur('attaques'), solutions: meilleur('solutions') },
    };
    const g = classement.filter((c) => c.rang === 1);
    this.ajouterFil({ type: 'fin', texte: g.length === 1 ? `${this.equipes[g[0].equipe].nom} gagne !` : 'Égalité en tête !' });
    for (const j of joueurs) { j.phase = 'fin'; j.question = null; j.tirage = null; this.emit('joueur', j.jeton); }
    this.emit('change');
  }

  // ---------- Utilitaires ----------

  joueurActif(jeton) {
    const j = this.joueurs.get(jeton);
    if (!j) erreur('Tu n\'es plus dans la partie : reconnecte-toi avec le code de ton équipe.');
    if (this.etat === ETATS.PAUSE) erreur('Partie en pause.');
    if (this.etat !== ETATS.EN_COURS) erreur('La course n\'est pas en cours.');
    return j;
  }

  paire(id) { return this.paires.find((p) => p.obstacle.id === id || p.solution.id === id); }
  obstacle(id) { const p = this.paire(id); if (!p || p.obstacle.id !== id) erreur('Obstacle inconnu.'); return p.obstacle; }
  solution(id) { const p = this.paire(id); if (!p || p.solution.id !== id) erreur('Solution inconnue.'); return p.solution; }
  solutionDe(obstacleId) { return this.paire(obstacleId).solution; }

  ajouterFil(entree) {
    this.fil.unshift({ id: ++this.idFil, t: this.t, ...entree });
    this.fil.length = Math.min(this.fil.length, TAILLE_FIL);
  }

  // ---------- Vues envoyées aux navigateurs ----------

  vuePublique({ avecCodes = false, avecEleves = false, fil = 8 } = {}) {
    const parEquipe = this.equipes.map(() => []);
    for (const j of this.joueurs.values()) parEquipe[j.equipeId].push(j);
    return {
      etat: this.etat,
      parcours: this.parcours ? this.parcours.nom : null,
      tempsRestantMs: Math.max(0, this.reglages.dureePartie * 60000 - this.t),
      reglages: { longueur: this.reglages.longueur, stockMax: this.reglages.stockMax, gainAvancer: this.reglages.gainAvancer },
      paires: this.paires,
      equipes: this.equipes.map((e) => ({
        id: e.id, nom: e.nom, couleur: e.couleur, symbole: e.symbole, texte: e.texte, clair: e.clair,
        code: avecCodes ? e.code : undefined,
        position: e.position,
        stock: e.stock,
        blocage: e.blocage ? { obstacle: e.blocage.obstacle, restantMs: e.blocage.finA - this.t } : null,
        protegeRestantMs: Math.max(0, e.protegeJusqua - this.t),
        succesRestantMs: Math.max(0, e.succesJusqua - this.t),
        nbEleves: parEquipe[e.id].length,
        eleves: avecEleves ? parEquipe[e.id].map((j) => j.pseudo) : undefined,
      })),
      nbEleves: this.joueurs.size,
      fil: this.fil.slice(0, fil),
      resultat: this.resultat,
    };
  }

  vueEleve(jeton) {
    const j = this.joueurs.get(jeton);
    if (!j) return null;
    const v = {
      pseudo: j.pseudo,
      equipeId: j.equipeId,
      phase: j.phase,
      retour: j.retour,
      stats: j.stats,
      tirage: j.tirage,
    };
    if (j.question && j.phase === 'question') {
      const { q, vue, finA, duree } = j.question;
      v.question = { id: q.id, type: q.type, enonce: q.enonce, image: q.image || null, ...vue,
        restantMs: Math.max(0, finA - this.t), dureeMs: duree, numero: j.numero };
    }
    if (['action', 'solution', 'attaque', 'erreur'].includes(j.phase)) v.restantMs = Math.max(0, j.finPhase - this.t);
    if (j.phase === 'action') v.options = this.options(j);
    return v;
  }

  vueAdmin() {
    const pub = this.vuePublique({ avecCodes: true });
    const parEquipe = this.equipes.map(() => []);
    for (const j of this.joueurs.values()) {
      parEquipe[j.equipeId].push({ jeton: j.jeton, pseudo: j.pseudo, connecte: j.connecte, stats: j.stats, signale: j.signale });
    }
    pub.equipes.forEach((e) => { e.eleves = parEquipe[e.id]; });
    return {
      ...pub,
      reglagesComplets: this.reglages,
      parcoursId: this.parcours ? this.parcours.id : null,
      nbQuestionsJouables: this.questions.length,
    };
  }
}

module.exports = { Partie, ErreurJeu, ETATS, nettoyerReglages, pseudoSignale };
