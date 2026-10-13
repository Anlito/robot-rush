# Robot Rush sur Raspberry Pi (borne de classe)

La Raspberry Pi fait tourner le jeu et affiche la course sur le vidéoprojecteur. Branchée en RJ45 sur le
réseau du collège, elle est jointe directement par les postes élèves : **pas d'internet en classe, pas de
filtre web, rien à lancer sur le PC du professeur** (un navigateur suffit pour l'espace professeur).

Testé pour : Raspberry Pi 4 B (une Pi 3 suffit aussi). Il faut : une carte micro-SD (16 Go ou plus),
l'alimentation de la Pi, un câble micro-HDMI → HDMI, un clavier et une souris pour l'installation.

## 1. Installer le système (à la maison, une fois)

1. Sur votre PC, installer **Raspberry Pi Imager** : <https://www.raspberrypi.com/software/>.
2. Choisir : appareil **Raspberry Pi 4**, système **Raspberry Pi OS (64-bit)** (la version *avec bureau*),
   puis la carte micro-SD.
3. Quand Imager propose de **modifier les réglages** : répondre oui et remplir
   - nom d'hôte : `robotrush` ;
   - un nom d'utilisateur et un mot de passe (ceux de la Pi, à garder pour vous) ;
   - le Wi-Fi de la maison (pour l'installation) ;
   - fuseau horaire `Europe/Paris`, clavier `fr`.
4. Écrire la carte, la mettre dans la Pi, brancher écran, clavier, souris, puis l'alimentation.

## 2. Installer Robot Rush (à la maison, une fois)

Sur la Pi, ouvrir le **Terminal** (icône d'écran noir en haut à gauche) et coller cette ligne
(clic droit → Coller), puis Entrée :

```bash
curl -fsSL https://raw.githubusercontent.com/Anlito/robot-rush/main/outils-pi/installer.sh | bash
```

Le script installe tout (5 à 10 minutes), puis demande le **mot de passe de l'espace professeur**
(lettres, chiffres et quelques signes ; il ne s'affiche pas pendant la saisie). À la fin, il affiche
« Robot Rush est installé et tourne ».

Redémarrer la Pi (`sudo reboot`) : après une minute, la course s'affiche en plein écran.
Pour quitter le plein écran (par exemple pour retrouver le bureau) : **Alt + F4**.

## 3. En classe

1. Brancher la Pi : **câble réseau** sur la prise de la salle, **HDMI** sur le vidéoprojecteur, puis l'alimentation.
2. Après une minute, le projecteur affiche Robot Rush avec **l'adresse à donner aux élèves** et le QR code
   (par exemple `10.0.12.47:3000`). L'adresse peut changer d'une séance à l'autre : toujours lire celle du projecteur.
3. Sur le PC du professeur, ouvrir la même adresse suivie de **`/admin`** (par exemple `10.0.12.47:3000/admin`),
   puis le mot de passe choisi à l'étape 2.
4. Les élèves tapent l'adresse affichée et le code de leur équipe.
5. À la fin du cours : débrancher l'alimentation suffit (les questions sont enregistrées à chaque modification).

**Premier essai au collège (5 minutes, avant un vrai cours)** : brancher la Pi, puis sur un poste élève
ouvrir l'adresse affichée suivie de **`/test`**. « Connexion réussie » : tout fonctionnera.

| Ce qu'on voit au projecteur | Que faire |
|---|---|
| L'adresse commence par `169.254` ou il n'y a pas d'adresse | La prise ne donne pas de réseau à la Pi : essayer une autre prise, ou voir le référent numérique. |
| L'adresse s'affiche mais `/test` ne s'ouvre pas sur les postes élèves | Le réseau sépare les postes des autres appareils : demander au référent d'autoriser l'accès à la Pi sur le port 3000. |
| Écran noir ou « page introuvable » | Attendre une minute de plus ; sinon débrancher et rebrancher l'alimentation. |

Avant de brancher un appareil personnel sur le réseau du collège, prévenir le référent numérique.
À lui dire : la Pi ne va pas sur internet pendant le cours, n'enregistre aucune donnée personnelle
(les pseudos des élèves ne sont jamais enregistrés) et n'accepte que les connexions au jeu (port 3000).

## 4. Mettre le jeu à jour

**Automatique** : à chaque allumage, si la Pi a internet (à la maison, câble ou Wi-Fi), elle installe toute seule
la dernière version publiée sur GitHub avant de lancer le jeu (une à deux minutes de plus quand il y a du nouveau).
Sans internet, au collège en général, elle démarre aussitôt avec la version déjà installée.
Après une modification du jeu : allumer la Pi une fois à la maison, attendre que la course s'affiche, c'est tout.
Les questions, les parcours et le mot de passe sont gardés.

**À la main** (si un changement concerne l'installation elle-même, je vous le dirai) : quitter le plein écran
(**Alt + F4**), ouvrir le Terminal et relancer la même commande qu'à l'étape 2.

Voir ce qui s'est passé au dernier démarrage : `journalctl -u robot-rush -b | grep "Mise à jour"`.

Changer le mot de passe professeur : `sudo rm /etc/robot-rush/env`, puis relancer la commande.

## 5. Sauvegarder ses questions

Comme sur PC : dans l'espace professeur, **Exporter JSON**. Les données sont aussi dans
`/var/lib/robot-rush` sur la Pi (copie de sécurité quotidienne dans `sauvegardes/`).

## Pour information

| Élément | Où |
|---|---|
| Jeu | `/opt/robot-rush` (copie du dépôt GitHub) |
| Questions, parcours | `/var/lib/robot-rush` |
| Mot de passe professeur | `/etc/robot-rush/env` (lisible par l'administrateur de la Pi seulement) |
| Service du jeu | `robot-rush` : `sudo systemctl status robot-rush`, journal : `journalctl -u robot-rush -f` |
| Plein écran au démarrage | `~/.config/autostart/robot-rush-ecran.desktop` → `outils-pi/ecran.sh` |
