#!/bin/sh
# Robot Rush : lancement en mode local sur le PC du professeur (Mac / Linux).
cd "$(dirname "$0")" || exit 1

# 1. Node.js : version portable dans le dossier "node", sinon celle installée.
NODE=node
NPM=npm
if [ -x "./node/bin/node" ]; then
  NODE="./node/bin/node"
  NPM="./node/bin/npm"
fi

if ! "$NODE" --version >/dev/null 2>&1; then
  echo ""
  echo "  Node.js n'est pas installé sur cet ordinateur."
  echo "  Installez la version LTS depuis https://nodejs.org/fr/download"
  echo "  puis relancez ce fichier. Version portable : voir MODE-LOCAL.md, étape 1."
  echo ""
  printf "Appuyez sur Entrée pour fermer… "; read -r _
  exit 1
fi

MAJ=$("$NODE" -p "process.versions.node.split('.')[0]")
if [ "$MAJ" -lt 18 ]; then
  echo "  La version de Node.js est trop ancienne ($MAJ). Installez la version LTS depuis https://nodejs.org/fr/download"
  printf "Appuyez sur Entrée pour fermer… "; read -r _
  exit 1
fi

# 2. Fichier de configuration (port, mot de passe) : créé au premier lancement.
[ -f config-serveur.json ] || cp config-serveur.exemple.json config-serveur.json

# 3. Composants : installés une seule fois (connexion internet nécessaire cette fois-là).
if [ ! -f node_modules/express/package.json ]; then
  echo "  Première utilisation : installation des composants (connexion internet nécessaire)…"
  if ! "$NPM" install --omit=dev --no-audit --no-fund; then
    echo "  L'installation a échoué. Vérifiez la connexion internet, puis relancez."
    printf "Appuyez sur Entrée pour fermer… "; read -r _
    exit 1
  fi
fi

OUVRIR_NAVIGATEUR=1 "$NODE" server/index.js
echo ""
echo "  Robot Rush s'est arrêté."
printf "Appuyez sur Entrée pour fermer… "; read -r _
