'use strict';

// Images des questions : fichiers dans data/images, servis sur /images/<nom>.
// Le type est vérifié sur le contenu du fichier (et pas seulement sur son nom).

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const TAILLE_MAX = 800 * 1024; // 800 Ko : les postes élèves sont parfois lents
const TYPES = {
  png: { mime: 'image/png', signature: (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  jpg: { mime: 'image/jpeg', signature: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  gif: { mime: 'image/gif', signature: (b) => b.slice(0, 4).toString('ascii') === 'GIF8' },
  webp: { mime: 'image/webp', signature: (b) => b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP' },
  svg: { mime: 'image/svg+xml', signature: (b) => /<svg[\s>]/i.test(b.slice(0, 2048).toString('utf8')) },
};

class ErreurImage extends Error {}

function typeDe(buffer) {
  return Object.keys(TYPES).find((t) => TYPES[t].signature(buffer)) || null;
}

/** Enregistre une image et renvoie son chemin public (/images/…). Même contenu = même fichier. */
function enregistrer(dossier, buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new ErreurImage('Fichier vide.');
  if (buffer.length > TAILLE_MAX) throw new ErreurImage(`Image trop lourde (${Math.round(buffer.length / 1024)} Ko) : 800 Ko au plus. Réduisez-la avant de l'ajouter.`);
  const type = typeDe(buffer);
  if (!type) throw new ErreurImage('Format non reconnu : utilisez une image PNG, JPG, GIF, WEBP ou SVG.');
  const nom = `${crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16)}.${type}`;
  fs.mkdirSync(dossier, { recursive: true });
  const fichier = path.join(dossier, nom);
  if (!fs.existsSync(fichier)) fs.writeFileSync(fichier, buffer);
  return `/images/${nom}`;
}

const NOM_VALIDE = /^\/images\/[0-9a-f]{16}\.(png|jpg|gif|webp|svg)$/;

/** Image → data: URI (pour l'export, qui doit tenir dans un seul fichier). */
function versDataUri(dossier, chemin) {
  if (!NOM_VALIDE.test(chemin || '')) return null;
  const fichier = path.join(dossier, path.basename(chemin));
  if (!fs.existsSync(fichier)) return null;
  const type = path.extname(fichier).slice(1);
  return `data:${TYPES[type].mime};base64,${fs.readFileSync(fichier).toString('base64')}`;
}

/** data: URI (import) → chemin public, ou null si l'image est invalide. */
function depuisDataUri(dossier, uri) {
  const m = /^data:[a-z/+.-]+;base64,([A-Za-z0-9+/=]+)$/.exec(uri || '');
  if (!m) return null;
  try {
    return enregistrer(dossier, Buffer.from(m[1], 'base64'));
  } catch {
    return null;
  }
}

module.exports = { enregistrer, versDataUri, depuisDataUri, ErreurImage, NOM_VALIDE, TAILLE_MAX };
