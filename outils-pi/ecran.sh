#!/usr/bin/env bash
# Robot Rush sur Raspberry Pi : ouvre la course en plein écran sur la sortie HDMI.
# Lancé à l'ouverture de session (voir installer.sh). Pour quitter le plein écran : Alt + F4.

PORT=3000
URL="http://localhost:$PORT/course"

# Le jeu met quelques secondes à démarrer avec la Pi : on l'attend (2 minutes au plus).
for _ in $(seq 1 120); do
  curl -fs "http://localhost:$PORT/sante" >/dev/null && break
  sleep 1
done

NAVIGATEUR="$(command -v chromium || command -v chromium-browser)"
exec "$NAVIGATEUR" --kiosk --noerrdialogs --disable-infobars --no-first-run \
  --disable-session-crashed-bubble --disable-features=Translate --password-store=basic \
  --check-for-update-interval=31536000 "$URL"
