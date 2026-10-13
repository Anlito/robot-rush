'use strict';

// Banque de référence : le fichier banque.json à la racine du dépôt GitHub.
//
// Le PC du professeur est la référence : il crée les questions puis les publie (bouton « Publier mes questions »).
// Les autres installations (Raspberry Pi, Render, un autre PC) récupèrent la dernière banque publiée :
//  - automatiquement au démarrage, si un nouveau banque.json est arrivé avec la mise à jour du jeu
//    et si la banque locale n'a pas été modifiée depuis la dernière synchronisation ;
//  - à la demande, avec le bouton « Récupérer les questions publiées » (téléchargée depuis GitHub).
// Avant chaque remplacement, une copie de la banque est faite dans data/sauvegardes.
//
// Fichiers annexes dans le dossier de données (jamais dans le dépôt) :
//  - reference.json : { fichier, banque, date, origine } = empreintes de banque.json et de la banque locale
//    à la dernière synchronisation (publication ou récupération) ;
//  - github.json : { jeton } = jeton GitHub pour publier, choisi par le professeur ; jamais renvoyé au navigateur.

const crypto = require('node:crypto');

const FICHIER = 'banque.json';
const DELAI_MS = 20000;

class ErreurReference extends Error {}
const erreur = (m) => { throw new ErreurReference(m); };

/** Empreinte du contenu (questions et parcours), sans la date d'export. */
const empreinte = (d) => crypto.createHash('sha256')
  .update(JSON.stringify({ q: (d && d.questions) || [], p: (d && d.parcours) || [] })).digest('hex').slice(0, 20);
const resume = (d) => ({ questions: ((d && d.questions) || []).length, parcours: ((d && d.parcours) || []).length, publieLe: (d && d.exporteLe) || null });

/**
 * banque : la Banque ; stockage : le module stockage ; depot : « propriétaire/dépôt » ;
 * publication : false sur un hébergement en ligne (pas de jeton ni de publication depuis là) ;
 * fetch : injectable pour les tests.
 */
function creerReference({ banque, stockage, depot, publication = true, fetch = globalThis.fetch, empreinteDeTest = null }) {
  const etat = () => stockage.lireAnnexe('reference.json');
  const jeton = () => (stockage.lireAnnexe('github.json') || {}).jeton || null;
  const empreinteLocale = () => empreinte({ questions: banque.questions, parcours: banque.parcours });
  const noter = (fichier, origine) => stockage.ecrireAnnexe('reference.json',
    { fichier: empreinte(fichier), banque: empreinteLocale(), date: new Date().toISOString(), origine });
  let enAttente = null; // nouvelle banque arrivée au démarrage mais pas chargée (modifications locales non publiées)

  function remplacer(fichier, origine) {
    stockage.copieAvantRemplacement('avant-recuperation');
    const rapport = banque.importer(fichier, { mode: 'remplacer' });
    noter(fichier, origine);
    enAttente = null;
    return rapport;
  }

  // ----- Accès à GitHub -----

  const url = `https://api.github.com/repos/${depot}/contents/${FICHIER}`;
  async function appel(adresse, options = {}, { avecJeton = false } = {}) {
    const entetes = { 'User-Agent': 'robot-rush', 'X-GitHub-Api-Version': '2022-11-28', ...(options.headers || {}) };
    const j = jeton();
    if (avecJeton || j) entetes.Authorization = `Bearer ${j}`;
    let rep;
    try {
      rep = await fetch(adresse, { ...options, headers: entetes, signal: AbortSignal.timeout(DELAI_MS) });
    } catch {
      erreur('GitHub ne répond pas : vérifiez la connexion à internet de cet ordinateur.');
    }
    return rep;
  }

  /** Banque publiée sur GitHub (contenu et identifiant de version), ou null s'il n'y en a pas encore. */
  async function lireDistante() {
    const rep = await appel(`${url}?ref=main`, { headers: { Accept: 'application/vnd.github.raw+json' } });
    if (rep.status === 404) return null;
    if (rep.status === 401) erreur('Le jeton GitHub est refusé (expiré ?) : reliez à nouveau GitHub.');
    if (!rep.ok) erreur(`GitHub a répondu ${rep.status} : réessayez dans un moment.`);
    const texte = await rep.text();
    try {
      return JSON.parse(texte.replace(/^﻿/, ''));
    } catch {
      erreur('Le fichier banque.json publié sur GitHub est illisible.');
    }
  }

  // ----- Au démarrage -----

  /** Charge banque.json (arrivé avec le jeu) si c'est nouveau et sans risque. Renvoie un message pour le journal. */
  function auDemarrage() {
    const fichier = stockage.lireBanqueReference();
    if (!fichier) return null;
    const e = etat();
    const neuve = stockage.banqueNeuve();
    if (!neuve && e && e.fichier === empreinte(fichier)) return null; // déjà à jour
    // Banque jamais synchronisée mais restée la banque de test d'origine : rien à protéger.
    const deTest = !e && empreinteDeTest !== null && empreinteLocale() === empreinteDeTest;
    if (!neuve && !e && !deTest) {
      // Banque déjà là, jamais synchronisée, avec d'autres questions : on ne remplace rien sans le professeur.
      enAttente = resume(fichier);
      return 'Une banque publiée (banque.json) est disponible : bouton « Récupérer les questions publiées » dans l\'espace professeur.';
    }
    if (!neuve && e && e.banque !== empreinteLocale()) {
      enAttente = resume(fichier);
      return 'Nouvelle banque publiée disponible, mais les questions de cet ordinateur ont été modifiées depuis : rien n\'est remplacé (choix dans l\'espace professeur).';
    }
    try {
      const r = remplacer(fichier, neuve || deTest ? 'premier démarrage' : 'mise à jour');
      return `Banque publiée chargée : ${r.questions} question(s), ${r.parcours} parcours.`;
    } catch (err) {
      return `banque.json non utilisé : ${err.message}`;
    }
  }

  // ----- Actions de l'espace professeur -----

  /** État affiché dans l'espace professeur. */
  function vue() {
    const e = etat();
    return {
      depot,
      publication,
      relie: publication && Boolean(jeton()),
      derniere: e ? { date: e.date, origine: e.origine } : null,
      nonPubliee: !e || e.banque !== empreinteLocale(),
      enAttente,
    };
  }

  async function relier(valeur) {
    if (!publication) erreur('La publication se fait depuis l\'ordinateur du professeur, pas depuis la version en ligne.');
    const j = String(valeur || '').trim();
    if (!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(j)) erreur('Ce n\'est pas un jeton GitHub (il commence par « github_pat_ »).');
    let rep;
    try {
      rep = await fetch(`https://api.github.com/repos/${depot}`, {
        headers: { Authorization: `Bearer ${j}`, 'User-Agent': 'robot-rush', 'X-GitHub-Api-Version': '2022-11-28' },
        signal: AbortSignal.timeout(DELAI_MS),
      });
    } catch {
      erreur('GitHub ne répond pas : vérifiez la connexion à internet.');
    }
    if (rep.status === 401) erreur('GitHub refuse ce jeton (mal copié ou expiré).');
    if (rep.status === 404) erreur(`Ce jeton n'a pas accès au dépôt ${depot} : choisissez-le dans « Repository access ».`);
    if (!rep.ok) erreur(`GitHub a répondu ${rep.status}.`);
    const infos = await rep.json();
    if (infos.permissions && infos.permissions.push === false) erreur('Ce jeton peut lire le dépôt mais pas écrire : permission « Contents : Read and write ».');
    stockage.ecrireAnnexe('github.json', { jeton: j, depot, relieLe: new Date().toISOString() });
    return { depot };
  }

  function delier() {
    stockage.ecrireAnnexe('github.json', null);
    return {};
  }

  /** Publie la banque de cet ordinateur sur GitHub. forcer : remplacer une banque publiée depuis ailleurs. */
  async function publier({ forcer = false } = {}) {
    if (!publication) erreur('La publication se fait depuis l\'ordinateur du professeur, pas depuis la version en ligne.');
    if (!jeton()) erreur('Reliez d\'abord cet ordinateur à GitHub.');
    const fichier = banque.exporter();
    const distante = await lireDistante();
    const e = etat();
    if (distante && empreinte(distante) === empreinte(fichier)) {
      noter(fichier, 'publication');
      return { dejaAJour: true, ...resume(fichier) };
    }
    // Publiée depuis un autre ordinateur depuis notre dernière synchronisation : on demande avant d'écraser.
    if (distante && !forcer && (!e || e.fichier !== empreinte(distante))) return { conflit: true, distante: resume(distante) };

    const meta = await appel(`${url}?ref=main`, { headers: { Accept: 'application/vnd.github+json' } }, { avecJeton: true });
    const sha = meta.ok ? (await meta.json()).sha : undefined;
    const contenu = Buffer.from(`${JSON.stringify(fichier, null, 2)}\n`, 'utf8').toString('base64');
    const r = resume(fichier);
    const rep = await appel(url, {
      method: 'PUT',
      headers: { Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `Questions publiées depuis l'espace professeur (${r.questions} questions, ${r.parcours} parcours)`,
        content: contenu, branch: 'main', ...(sha ? { sha } : {}) }),
    }, { avecJeton: true });
    if (rep.status === 401) erreur('Le jeton GitHub est refusé (expiré ?) : reliez à nouveau GitHub.');
    if (rep.status === 403 || rep.status === 404) erreur('Le jeton n\'a pas le droit d\'écrire dans le dépôt (permission « Contents : Read and write »).');
    if (rep.status === 409) erreur('La banque a changé sur GitHub pendant la publication : réessayez.');
    if (rep.status === 413 || rep.status === 422) erreur('Banque trop lourde pour GitHub (images trop nombreuses ?).');
    if (!rep.ok) erreur(`GitHub a répondu ${rep.status} : réessayez dans un moment.`);
    noter(fichier, 'publication');
    return r;
  }

  /** Récupère la dernière banque publiée. confirmer : false = aperçu seulement. */
  async function recuperer({ confirmer = false } = {}) {
    const distante = await lireDistante();
    if (!distante) erreur('Aucune banque publiée sur GitHub pour l\'instant.');
    if (!confirmer) return { apercu: resume(distante), nonPubliee: vue().nonPubliee };
    return { rapport: remplacer(distante, 'récupération') };
  }

  return { auDemarrage, vue, relier, delier, publier, recuperer };
}

module.exports = { creerReference, ErreurReference, empreinte };
