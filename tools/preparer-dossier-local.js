'use strict';

// Prépare le dossier « mode local » à copier sur le PC du professeur (clé USB, réseau…) :
// le jeu, ses composants (sans ceux de développement), Node.js portable pour Windows
// (version LTS officielle, empreinte SHA-256 vérifiée), la fiche de mise en place, puis une archive ZIP.
//
//   npm run dossier-local                      → dist/RobotRush/ et dist/RobotRush-mode-local-AAAA-MM-JJ.zip
//   node tools/preparer-dossier-local.js --node chemin/node-vXX-win-x64.zip   (Node.js déjà téléchargé)
//   node tools/preparer-dossier-local.js --sans-node                          (dossier plus léger)
//
// Les données du professeur (data/) et sa configuration (config-serveur.json) ne sont jamais copiées.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, execSync } = require('node:child_process');

// Sous Windows, le tar de Windows (bsdtar) : il lit et crée les ZIP. Celui de Git ne le sait pas.
const TAR = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';

const RACINE = path.join(__dirname, '..');
const DIST = path.join(RACINE, 'dist');
const DOSSIER = path.join(DIST, 'RobotRush');
const args = process.argv.slice(2);
const option = (nom) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : null; };
const A_COPIER = ['server', 'public', 'seed', 'package.json', 'package-lock.json', 'demarrer.bat', 'demarrer.command', 'demarrer.sh',
  'config-serveur.exemple.json', 'MODE-LOCAL.md'];

const etape = (t) => console.log(`\n» ${t}`);

async function telechargerNode(destination) {
  const index = await (await fetch('https://nodejs.org/dist/index.json')).json();
  const v = index.find((x) => x.lts && x.files.includes('win-x64-zip'));
  const nom = `node-${v.version}-win-x64.zip`;
  console.log(`  Node.js ${v.version} (LTS « ${v.lts} », ${v.date})`);
  const sommes = await (await fetch(`https://nodejs.org/dist/${v.version}/SHASUMS256.txt`)).text();
  const attendu = sommes.split('\n').find((l) => l.endsWith(`  ${nom}`)).split(' ')[0];
  const zip = Buffer.from(await (await fetch(`https://nodejs.org/dist/${v.version}/${nom}`)).arrayBuffer());
  const obtenu = crypto.createHash('sha256').update(zip).digest('hex');
  if (obtenu !== attendu) throw new Error(`Empreinte de ${nom} incorrecte : fichier abîmé ou falsifié, rien n'est installé.`);
  console.log('  Empreinte SHA-256 vérifiée.');
  const fichier = path.join(destination, nom);
  fs.writeFileSync(fichier, zip);
  return fichier;
}

(async () => {
  etape('Dossier de sortie : dist/RobotRush');
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DOSSIER, { recursive: true });
  for (const f of A_COPIER) fs.cpSync(path.join(RACINE, f), path.join(DOSSIER, f), { recursive: true });
  fs.copyFileSync(path.join(RACINE, 'config-serveur.exemple.json'), path.join(DOSSIER, 'config-serveur.json'));
  fs.copyFileSync(path.join(RACINE, 'outils-salle', 'FICHE-MISE-EN-PLACE.html'), path.join(DOSSIER, 'FICHE-MISE-EN-PLACE.html'));

  etape('Composants du jeu (npm ci --omit=dev)');
  execSync('npm ci --omit=dev --no-audit --no-fund', { cwd: DOSSIER, stdio: 'inherit' });

  if (!args.includes('--sans-node')) {
    etape('Node.js portable pour Windows');
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'robot-rush-node-'));
    const zip = option('--node') || await telechargerNode(temp);
    execFileSync(TAR, ['-xf', zip, '-C', temp]);
    const extrait = fs.readdirSync(temp).find((n) => n.startsWith('node-') && fs.statSync(path.join(temp, n)).isDirectory());
    fs.renameSync(path.join(temp, extrait), path.join(DOSSIER, 'node'));
    fs.rmSync(temp, { recursive: true, force: true });
  }

  etape('Archive ZIP');
  const nomZip = `RobotRush-mode-local-${new Date().toISOString().slice(0, 10)}.zip`;
  // tar de Windows 10+ sait créer un ZIP (option -a : format choisi d'après l'extension).
  execFileSync(TAR, ['-a', '-c', '-f', nomZip, 'RobotRush'], { cwd: DIST });
  const taille = (f) => `${Math.round(fs.statSync(f).size / 1048576)} Mo`;
  console.log(`\nPrêt :\n  dist/RobotRush/  (dossier à copier)\n  dist/${nomZip}  (${taille(path.join(DIST, nomZip))})`);
})().catch((e) => { console.error(`\nÉchec : ${e.message}`); process.exit(1); });
