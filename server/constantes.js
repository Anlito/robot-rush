'use strict';

// Codes d'équipe : 4 caractères, sans O, 0, I ni 1.
const ALPHABET_CODES = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LONGUEUR_CODE = 4;

// Avec N équipes, on prend les N premières dans cet ordre (voir design/README.md).
const EQUIPES = [
  { nom: 'Rouge', couleur: '#E0362C', symbole: 'etoile', texte: '#FFFFFF', clair: '#FBDCD9' },
  { nom: 'Bleue', couleur: '#2563EB', symbole: 'triangle', texte: '#FFFFFF', clair: '#DCE7FD' },
  { nom: 'Verte', couleur: '#16A34A', symbole: 'cercle', texte: '#16161D', clair: '#D7F0DF' },
  { nom: 'Jaune', couleur: '#F2B705', symbole: 'carre', texte: '#16161D', clair: '#FCF0C8' },
  { nom: 'Violette', couleur: '#7C3AED', symbole: 'losange', texte: '#FFFFFF', clair: '#E8DDFC' },
  { nom: 'Orange', couleur: '#F97316', symbole: 'eclair', texte: '#16161D', clair: '#FEE3CF' },
  { nom: 'Rose', couleur: '#DB2777', symbole: 'coeur', texte: '#FFFFFF', clair: '#F9DCEA' },
  { nom: 'Turquoise', couleur: '#0891B2', symbole: 'croix', texte: '#FFFFFF', clair: '#D3EEF4' },
];

// Réglages par défaut du brief (section 3.7). Durées en secondes, sauf dureePartie en minutes.
const REGLAGES_DEFAUT = {
  longueur: 30,
  gainAvancer: 2,
  attenteErreur: 3,
  dureeBlocage: 15,
  protection: 3,
  stockMax: 3,
  dureePartie: 12,
  tempsQuestion: 30,
  tempsQuestionLong: 60,
  delaiAction: 8,
  // true : quand l'équipe est bloquée, le tirage de solutions contient toujours celle qui débloque.
  // false : hasard total (plus difficile).
  solutionGarantie: true,
  // Fin d'un blocage : 'duree' (au bout de dureeBlocage, ou plus tôt en prenant la solution)
  // ou 'solution' (seulement en prenant la solution : pas de fin automatique).
  finBlocage: 'duree',
};

// Bornes des réglages numériques : [min, max].
const BORNES_REGLAGES = {
  longueur: [5, 100],
  gainAvancer: [1, 10],
  attenteErreur: [0, 30],
  dureeBlocage: [1, 120],
  protection: [0, 30],
  stockMax: [1, 9],
  dureePartie: [1, 60],
  tempsQuestion: [5, 300],
  tempsQuestionLong: [5, 300],
  delaiAction: [3, 30],
};

// Paires obstacle / solution. « un », « le » et « sa » servent à écrire les messages du fil d'actions.
const PAIRES_DEFAUT = [
  { obstacle: { id: 'trou', nom: 'trou', un: 'un trou', le: 'le trou' },
    solution: { id: 'pont', nom: 'pont', un: 'un pont', le: 'le pont', sa: 'son pont' } },
  { obstacle: { id: 'mur', nom: 'mur', un: 'un mur', le: 'le mur' },
    solution: { id: 'echelle', nom: 'échelle', un: 'une échelle', le: "l'échelle", sa: 'son échelle' } },
  { obstacle: { id: 'rocher', nom: 'rocher', un: 'un rocher', le: 'le rocher' },
    solution: { id: 'pelleteuse', nom: 'pelleteuse', un: 'une pelleteuse', le: 'la pelleteuse', sa: 'sa pelleteuse' } },
  { obstacle: { id: 'boue', nom: 'boue', un: 'de la boue', le: 'la boue' },
    solution: { id: 'chenilles', nom: 'chenilles', un: 'des chenilles', le: 'les chenilles', sa: 'ses chenilles' } },
];

// Pseudos signalés automatiquement au professeur (il décide de retirer ou non).
// Comparaison sans accents, chiffres « leet » remplacés (0→o, 1→i, 3→e, 4→a, 5→s, 7→t).
const MOTS_SIGNALES = [
  'merde', 'merd', 'putain', 'pute', 'connard', 'connasse', 'conne', 'con', 'salope', 'salaud', 'encule', 'enfoire',
  'bite', 'couille', 'chier', 'nique', 'niquer', 'ntm', 'fdp', 'pd', 'tg', 'batard', 'bouffon', 'debile',
  'cul', 'prout', 'caca', 'pipi', 'zizi', 'nazi', 'hitler', 'sexe', 'porn', 'fuck', 'shit', 'bitch',
];

// Libellés pour les messages d'erreur affichés au professeur.
const LIBELLES_REGLAGES = {
  longueur: 'Longueur de la piste',
  gainAvancer: 'Gain d\'un « Avancer »',
  attenteErreur: 'Attente après erreur',
  dureeBlocage: 'Durée de blocage',
  protection: 'Protection après blocage',
  stockMax: 'Stock maximum',
  dureePartie: 'Durée de la partie',
  tempsQuestion: 'Temps par question',
  tempsQuestionLong: 'Temps blocs / à compléter',
  delaiAction: 'Délai pour choisir l\'action',
};

// Types dont la durée par défaut est « tempsQuestionLong ».
const TYPES_LONGS = ['blocs', 'completer'];

module.exports = {
  ALPHABET_CODES, LONGUEUR_CODE, EQUIPES, REGLAGES_DEFAUT, BORNES_REGLAGES, LIBELLES_REGLAGES, PAIRES_DEFAUT, TYPES_LONGS, MOTS_SIGNALES,
};
