#!/usr/bin/env bash
# Robot Rush sur Raspberry Pi : installation en « borne » (serveur du jeu + course sur le projecteur).
#
# À lancer sur la Pi (Raspberry Pi OS avec bureau), connectée à internet, dans le Terminal :
#   curl -fsSL https://raw.githubusercontent.com/Anlito/robot-rush/main/outils-pi/installer.sh | bash
#
# Relancer la même commande met le jeu à jour : les questions et le mot de passe sont gardés.
# Ce qui est installé :
#   - Node.js et le jeu dans /opt/robot-rush ; les données (questions, parcours) dans /var/lib/robot-rush ;
#   - le mot de passe professeur dans /etc/robot-rush/env (lisible par la Pi seulement, jamais dans le dépôt) ;
#   - un service qui démarre le jeu à l'allumage et le relance s'il s'arrête ;
#   - l'ouverture automatique de la course en plein écran sur la sortie HDMI.
set -euo pipefail

DEPOT="https://github.com/Anlito/robot-rush.git"
DOSSIER="/opt/robot-rush"
DONNEES="/var/lib/robot-rush"
CONFIG="/etc/robot-rush"
PORT=3000
MOI="$(id -un)"

etape() { printf '\n\033[1m» %s\033[0m\n' "$1"; }
stop() { printf '\n\033[31mArrêt : %s\033[0m\n' "$1" >&2; exit 1; }

[ "$(id -u)" -ne 0 ] || stop "lancer ce script sans « sudo » (il le demandera lui-même)."
command -v sudo >/dev/null || stop "la commande sudo est introuvable."
[ -r /dev/tty ] || stop "lancer ce script dans le Terminal de la Pi (il pose une question)."

etape "Logiciels nécessaires (Node.js, git, navigateur)"
sudo apt-get update -qq
sudo apt-get install -y -qq git nodejs npm curl
if ! command -v chromium >/dev/null && ! command -v chromium-browser >/dev/null; then
  sudo apt-get install -y -qq chromium || sudo apt-get install -y -qq chromium-browser
fi
NODE_MAJ="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJ" -ge 18 ] || stop "Node.js $NODE_MAJ est trop ancien (18 ou plus). Mettre à jour Raspberry Pi OS."
echo "  Node.js $(node --version)"

etape "Jeu Robot Rush ($DOSSIER)"
if [ -d "$DOSSIER/.git" ]; then
  git -C "$DOSSIER" fetch -q origin main
  git -C "$DOSSIER" reset -q --hard origin/main
else
  sudo mkdir -p "$DOSSIER"
  sudo chown "$MOI": "$DOSSIER"
  git clone -q "$DEPOT" "$DOSSIER"
fi
(cd "$DOSSIER" && npm ci --omit=dev --no-audit --no-fund --loglevel=error)
echo "  Version : $(git -C "$DOSSIER" log -1 --format='%h du %cd' --date=short)"

etape "Dossier des questions ($DONNEES)"
sudo mkdir -p "$DONNEES"
sudo chown "$MOI": "$DONNEES"

if sudo test -f "$CONFIG/env"; then
  etape "Mot de passe professeur : déjà choisi (gardé)"
  echo "  Pour le changer : sudo rm $CONFIG/env, puis relancer ce script."
else
  etape "Mot de passe de l'espace professeur"
  echo "  Il sert à ouvrir /admin : lettres sans accent, chiffres et . _ - ! @ # % + = : , ?
  Il ne s'affiche pas pendant la saisie."
  while true; do
    read -r -s -p "  Mot de passe : " MDP < /dev/tty; echo
    read -r -s -p "  Encore une fois : " MDP2 < /dev/tty; echo
    # Liste de caractères sûrs : rien qui gêne le fichier de configuration du service.
    if [[ ! "$MDP" =~ ^[A-Za-z0-9._!@#%+=:,?-]+$ ]]; then echo "  Lettres sans accent, chiffres et . _ - ! @ # % + = : , ? seulement : recommencer."
    elif [ "$MDP" != "$MDP2" ]; then echo "  Les deux saisies sont différentes : recommencer."
    else break
    fi
  done
  sudo mkdir -p "$CONFIG"
  printf 'ADMIN_PASSWORD="%s"\n' "$MDP" | sudo tee "$CONFIG/env" >/dev/null
  sudo chmod 600 "$CONFIG/env"
  unset MDP MDP2
fi

etape "Démarrage automatique du jeu"
sudo tee /etc/systemd/system/robot-rush.service >/dev/null <<EOF
[Unit]
Description=Robot Rush (jeu de course d'équipes)
After=network-online.target
Wants=network-online.target

[Service]
User=$MOI
WorkingDirectory=$DOSSIER
Environment=PORT=$PORT
Environment=DATA_DIR=$DONNEES
EnvironmentFile=$CONFIG/env
ExecStart=$(command -v node) server/index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable -q robot-rush
sudo systemctl restart robot-rush

etape "Course en plein écran sur le projecteur (HDMI)"
mkdir -p "$HOME/.config/autostart"
cat > "$HOME/.config/autostart/robot-rush-ecran.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Robot Rush · projecteur
Exec=bash $DOSSIER/outils-pi/ecran.sh
X-GNOME-Autostart-enabled=true
EOF
if command -v raspi-config >/dev/null; then
  sudo raspi-config nonint do_boot_behaviour B4 || true   # ouverture de session automatique sur le bureau
  sudo raspi-config nonint do_blanking 1 || true          # l'écran ne se met jamais en veille
fi

etape "Vérification"
for _ in $(seq 1 30); do curl -fs "http://localhost:$PORT/sante" >/dev/null && break; sleep 1; done
if curl -fs "http://localhost:$PORT/sante" >/dev/null; then
  IP="$(hostname -I | awk '{print $1}')"
  printf '\n\033[32mRobot Rush est installé et tourne.\033[0m\n'
  echo "  Adresse élèves      : http://${IP:-adresse-de-la-pi}:$PORT/jouer"
  echo "  Espace professeur   : http://${IP:-adresse-de-la-pi}:$PORT/admin"
  echo "  (au collège, l'adresse change : elle s'affiche en grand sur le projecteur)"
  echo
  echo "  Redémarrer la Pi pour voir la course en plein écran : sudo reboot"
else
  echo "Le jeu ne répond pas. Journal des dernières lignes :"
  sudo journalctl -u robot-rush -n 30 --no-pager
  exit 1
fi
