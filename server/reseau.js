'use strict';

const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

// Configuration du serveur : variables d'environnement, sinon config-serveur.json à la racine du projet.
function lireConfigServeur() {
  const fichier = path.join(__dirname, '..', 'config-serveur.json');
  let fichierConfig = {};
  if (fs.existsSync(fichier)) {
    try {
      // Le Bloc-notes de Windows peut ajouter une marque invisible (BOM) en tête de fichier : on l'ignore.
      fichierConfig = JSON.parse(fs.readFileSync(fichier, 'utf8').replace(/^\uFEFF/, ''));
    } catch (e) {
      console.error(`Le fichier config-serveur.json est mal écrit (${e.message}). Il est ignoré.`);
    }
  }
  const h = hebergement();
  return {
    port: Number(process.env.PORT || fichierConfig.port) || 3000,
    motDePasse: process.env.ADMIN_PASSWORD || fichierConfig.motDePasse || null,
    adressePublique: (process.env.PUBLIC_URL || fichierConfig.adressePublique || h.adresse || '').replace(/\/$/, '') || null,
    ouvrirNavigateur: process.env.OUVRIR_NAVIGATEUR === '1' || fichierConfig.ouvrirNavigateur === true,
    hebergement: h.nom,
  };
}

/**
 * Hébergement en ligne reconnu grâce aux variables qu'il fournit lui-même :
 * nom, adresse publique, et dossier de données permanent (volume) s'il y en a un.
 */
function hebergement() {
  const e = process.env;
  if (e.RENDER === 'true' || e.RENDER_EXTERNAL_URL) {
    return { nom: 'Render', adresse: e.RENDER_EXTERNAL_URL || null, volume: null };
  }
  if (e.RAILWAY_ENVIRONMENT || e.RAILWAY_PUBLIC_DOMAIN || e.RAILWAY_PROJECT_ID) {
    return { nom: 'Railway', adresse: e.RAILWAY_PUBLIC_DOMAIN ? `https://${e.RAILWAY_PUBLIC_DOMAIN}` : null, volume: e.RAILWAY_VOLUME_MOUNT_PATH || null };
  }
  if (e.FLY_APP_NAME) {
    return { nom: 'Fly.io', adresse: `https://${e.FLY_APP_NAME}.fly.dev`, volume: null };
  }
  return { nom: null, adresse: null, volume: null };
}

// Cartes réseau virtuelles (machines virtuelles, WSL, VPN…) : jamais l'adresse à donner aux élèves.
const VIRTUELLES = /virtual|vmware|vbox|hyper-v|vethernet|wsl|docker|loopback|tailscale|zerotier|hamachi|vpn|tap|tun/i;

function rangAdresse(ip) {
  if (/^192\.168\./.test(ip)) return 0;
  if (/^10\./.test(ip)) return 1;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 2;
  if (/^169\.254\./.test(ip)) return 9; // adresse automatique : pas de vrai réseau
  return 5;
}

/** Adresses IPv4 du PC, la plus probable pour les élèves en premier. */
function adressesLocales() {
  const liste = [];
  for (const [nom, adresses] of Object.entries(os.networkInterfaces())) {
    for (const a of adresses || []) {
      if (a.family !== 'IPv4' && a.family !== 4) continue;
      if (a.internal) continue;
      liste.push({ ip: a.address, carte: nom, virtuelle: VIRTUELLES.test(nom) });
    }
  }
  return liste.sort((x, y) => (x.virtuelle - y.virtuelle) || (rangAdresse(x.ip) - rangAdresse(y.ip)));
}

/** Démarre le serveur HTTP ; si le port est pris, essaie les 10 suivants. */
function ecouter(serveur, portSouhaite) {
  return new Promise((resolve, reject) => {
    let port = portSouhaite;
    const essayer = () => {
      serveur.once('error', (e) => {
        if (e.code === 'EADDRINUSE' && port < portSouhaite + 10) {
          console.log(`Le port ${port} est déjà utilisé, essai du port ${port + 1}…`);
          port++;
          essayer();
        } else if (e.code === 'EADDRINUSE') {
          reject(new Error(`Les ports ${portSouhaite} à ${port} sont tous occupés. Fermez l'autre programme ou choisissez un autre port.`));
        } else if (e.code === 'EACCES') {
          reject(new Error(`Windows refuse d'utiliser le port ${port}. Choisissez un port au-dessus de 1024 (par exemple 3000).`));
        } else {
          reject(e);
        }
      });
      // 0.0.0.0 : accessible depuis les autres ordinateurs du réseau, pas seulement depuis ce PC.
      serveur.listen(port, '0.0.0.0', () => resolve(port));
    };
    essayer();
  });
}

function ouvrirNavigateur(url) {
  const { exec } = require('node:child_process');
  const commande = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(commande, () => { /* sans navigateur : on ignore */ });
}

module.exports = { lireConfigServeur, hebergement, adressesLocales, ecouter, ouvrirNavigateur };
