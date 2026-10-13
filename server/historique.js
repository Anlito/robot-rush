'use strict';

// Historique des parties : un bilan par partie terminée (classement des équipes, bilan par question),
// dans le dossier des données (historique.json). Jamais de pseudo d'élève : seulement les équipes.
// Sert à connaître les acquis : taux de réussite par question, pour une partie ou cumulé pour une classe.

const { ErreurBanque } = require('./banque');

const MAX_PARTIES = 300;
const LONGUEUR_CLASSE = 30;
const LONGUEUR_TITRE = 80;

const nettoyer = (max) => (c) => String(c ?? '').trim().replace(/\s+/g, ' ').slice(0, max) || null;
const nettoyerClasse = nettoyer(LONGUEUR_CLASSE);
const nettoyerTitre = nettoyer(LONGUEUR_TITRE);
const taux = (justes, total) => (total ? Math.round((100 * justes) / total) : null);
const repondues = (b) => b.justes + b.fausses + b.tempsEcoules;

function creerHistorique({ stockage }) {
  const lire = () => {
    const h = stockage.lireAnnexe('historique.json');
    return Array.isArray(h) ? h : [];
  };
  const ecrire = (h) => stockage.ecrireAnnexe('historique.json', h);

  /** Enregistre le bilan d'une partie terminée (le plus récent en premier). */
  function ajouter(bilan, { classe = null, titre = null } = {}) {
    const h = lire();
    const partie = { id: `h-${Date.now().toString(36)}`, titre: nettoyerTitre(titre), classe: nettoyerClasse(classe), ...bilan };
    h.unshift(partie);
    ecrire(h.slice(0, MAX_PARTIES));
    return partie;
  }

  /** Liste résumée pour l'espace professeur. */
  function liste() {
    return lire().map((p) => {
      const justes = p.questions.reduce((s, b) => s + b.justes, 0);
      const total = p.questions.reduce((s, b) => s + repondues(b), 0);
      return {
        id: p.id, date: p.date, titre: p.titre || null, classe: p.classe, parcours: p.parcours ? p.parcours.nom : null,
        dureeMs: p.dureeMs, nbEleves: p.nbEleves, nbEquipes: p.equipes.length, raison: p.raison,
        gagnants: p.equipes.filter((e) => e.rang === 1).map((e) => ({ nom: e.nom, couleur: e.couleur })),
        reussite: taux(justes, total), nbQuestions: p.questions.length, reponses: total,
      };
    });
  }

  function detail(id) {
    const p = lire().find((x) => x.id === id);
    if (!p) throw new ErreurBanque('Partie introuvable dans l\'historique.');
    return p;
  }

  /** Change le titre ou la classe d'une partie déjà jouée. */
  function modifier(id, { titre, classe } = {}) {
    const h = lire();
    const p = h.find((x) => x.id === id);
    if (!p) throw new ErreurBanque('Partie introuvable dans l\'historique.');
    if (titre !== undefined) p.titre = nettoyerTitre(titre);
    if (classe !== undefined) p.classe = nettoyerClasse(classe);
    ecrire(h);
    return p;
  }

  function supprimer(id) {
    const h = lire();
    const reste = h.filter((x) => x.id !== id);
    if (reste.length === h.length) throw new ErreurBanque('Partie introuvable dans l\'historique.');
    ecrire(reste);
  }

  /** Bilan cumulé des parties d'une classe (ou de toutes si classe vaut null) : acquis question par question. */
  function cumul(classe) {
    const parties = lire().filter((p) => classe === null || p.classe === classe);
    const parQuestion = new Map();
    // Du plus ancien au plus récent : le texte affiché est celui de la dernière partie.
    for (const p of parties.slice().reverse()) {
      for (const b of p.questions) {
        const c = parQuestion.get(b.id) || { id: b.id, posees: 0, justes: 0, fausses: 0, tempsEcoules: 0, parties: 0 };
        Object.assign(c, { titre: b.titre, enonce: b.enonce, type: b.type, version: b.version, niveau: b.niveau });
        for (const k of ['posees', 'justes', 'fausses', 'tempsEcoules']) c[k] += b[k];
        c.parties++;
        parQuestion.set(b.id, c);
      }
    }
    return {
      classe,
      nbParties: parties.length,
      premiere: parties.length ? parties[parties.length - 1].date : null,
      derniere: parties.length ? parties[0].date : null,
      questions: [...parQuestion.values()],
    };
  }

  /** Classes rencontrées dans l'historique (pour le filtre). */
  function classes() {
    return [...new Set(lire().map((p) => p.classe).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  }

  return { ajouter, liste, detail, modifier, supprimer, cumul, classes };
}

module.exports = { creerHistorique, nettoyerClasse, nettoyerTitre, LONGUEUR_CLASSE, LONGUEUR_TITRE };
