#!/usr/bin/env bash
# Robot Rush sur Raspberry Pi : mise à jour automatique, lancée à chaque démarrage du jeu (voir installer.sh).
#
# - Sans internet (au collège en général) : rien à faire, le jeu démarre aussitôt avec la version installée.
# - Avec internet : si une nouvelle version est sur GitHub, elle est installée avant le démarrage du jeu.
# Prudence : les nouveaux composants (node_modules) sont préparés à côté et ne remplacent les anciens
# qu'une fois complets. Une coupure d'internet en cours de route laisse donc la version précédente intacte.
# Les questions, les parcours et le mot de passe ne sont pas dans ce dossier : ils ne sont jamais touchés.
set -uo pipefail

DOSSIER="$(cd "$(dirname "$0")/.." && pwd)"
TEMP="${HOME:-/tmp}/.cache/robot-rush-maj"
cd "$DOSSIER" || exit 0

if ! timeout 20 git fetch -q origin main 2>/dev/null; then
  echo "Mise à jour : pas d'accès à GitHub, le jeu démarre avec la version installée."
  exit 0
fi
AVANT="$(git rev-parse HEAD)"
APRES="$(git rev-parse origin/main)"
if [ "$AVANT" = "$APRES" ]; then
  echo "Mise à jour : déjà la dernière version ($(git log -1 --format='%h du %cd' --date=short))."
  exit 0
fi

# Composants à refaire seulement si la liste a changé (rare).
if ! git diff --quiet "$AVANT" "$APRES" -- package.json package-lock.json; then
  echo "Mise à jour : nouveaux composants, préparation…"
  rm -rf "$TEMP" && mkdir -p "$TEMP"
  git show "$APRES:package.json" > "$TEMP/package.json"
  git show "$APRES:package-lock.json" > "$TEMP/package-lock.json"
  if ! (cd "$TEMP" && timeout 300 npm ci --omit=dev --no-audit --no-fund --loglevel=error); then
    echo "Mise à jour : composants non téléchargés, le jeu garde la version installée."
    rm -rf "$TEMP"
    exit 0
  fi
  rm -rf "$DOSSIER/node_modules"
  mv "$TEMP/node_modules" "$DOSSIER/node_modules"
  rm -rf "$TEMP"
fi

git reset -q --hard "$APRES"
echo "Mise à jour : $(git log -1 --format='%h du %cd' --date=short) installée (avant : ${AVANT:0:7})."
