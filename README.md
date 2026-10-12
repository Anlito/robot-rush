# Robot Rush

Jeu de course d'équipes en direct pour la classe de technologie (collège 5e–3e, SEGPA).
De 2 à 8 équipes répondent à des questions sur leur ordinateur ; chaque bonne réponse permet
d'**avancer**, de **prendre une solution** pour le stock de l'équipe ou d'**attaquer** une autre équipe
avec un obstacle. La course est projetée en classe.

| Page | Pour qui | Rôle |
|---|---|---|
| `/course` | vidéoprojecteur | piste de toutes les équipes, chrono, fil d'actions, codes avant la partie, podium |
| `/jouer` (ou `/`) | élèves | code d'équipe + pseudo, questions, choix d'action, bandeau d'état permanent |
| `/admin` | professeur | parcours, équipes, réglages, codes, élèves, Démarrer / Pause / Arrêter |
| `/test` | professeur, depuis un poste élève | diagnostic du réseau : « Connexion réussie », temps réel, rapidité |

## Mode local : le jeu sur le PC du professeur, sans internet

**Guide pas à pas pour les enseignants : [MODE-LOCAL.md](MODE-LOCAL.md)** (installation de Node.js ou version portable,
double-clic sur `demarrer.bat`, pare-feu Windows, adresse et QR code pour les élèves, page `/test`, dépannage).

En bref : double-cliquer sur `demarrer.bat` (Mac : `demarrer.command`, Linux : `demarrer.sh`).
Le script vérifie Node.js, installe les composants la première fois, crée `config-serveur.json`,
puis lance le serveur et ouvre l'espace professeur. Tout fonctionne hors ligne : polices, icônes, QR code
et bibliothèques sont dans le projet.

## Lancer en ligne de commande

Il faut [Node.js](https://nodejs.org) 18 ou plus.

```bash
npm install
npm start
```

Le serveur écoute sur toutes les cartes réseau (`0.0.0.0`). La console affiche l'adresse à donner aux élèves
(l'adresse locale en 192.168.x.x ou 10.x.x.x est privilégiée, les cartes virtuelles sont écartées),
l'adresse du projecteur, de l'espace professeur et de la page de diagnostic.
Si le port est occupé, le serveur prend le suivant et l'affiche.

Réglages du serveur, dans `config-serveur.json` (modèle : `config-serveur.exemple.json`)
ou par variables d'environnement, prioritaires :

| Fichier | Variable | Rôle | Défaut |
|---|---|---|---|
| `port` | `PORT` | port d'écoute | 3000 |
| `motDePasse` | `ADMIN_PASSWORD` | mot de passe de l'espace professeur | `robot` (avertissement affiché) |
| `adressePublique` | `PUBLIC_URL` | adresse affichée aux élèves (hébergement en ligne) | adresse du PC sur le réseau local |
| `ouvrirNavigateur` | `OUVRIR_NAVIGATEUR=1` | ouvrir l'espace professeur au démarrage | non |
| | `DATA_DIR` | dossier des données | `data/` |

## Tester sans classe

Avec le serveur lancé, dans un second terminal :

```bash
node tools/eleves-factices.js 12
```

12 élèves factices rejoignent les équipes, répondent (70 % de bonnes réponses) et jouent des actions au hasard.
Arguments : `nombre adresse taux` (ex. `node tools/eleves-factices.js 30 http://localhost:3000 0.5`).

Tests automatisés de la logique de jeu :

```bash
npm test
```

## Règles (réglages par défaut, tous modifiables dans l'admin)

- Bonne réponse : 8 s pour choisir **Avancer** (+2 cases), **Solution** (2 solutions tirées parmi 4, ajoutée au stock
  partagé de l'équipe, 3 au plus par type) ou **Attaquer** (2 obstacles tirés parmi 4, puis l'équipe visée ;
  automatique avec 2 équipes). Sans choix : « Avancer ».
- Obstacle reçu : si l'équipe a la solution en stock, elle est consommée et l'obstacle annulé. Sinon le **robot de l'équipe**
  est bloqué 15 s, ou jusqu'à ce qu'un coéquipier prenne la bonne solution. Une équipe bloquée ne reçoit pas d'autre obstacle ;
  elle est protégée 3 s quand elle repart.
- Mauvaise réponse ou temps dépassé : 3 s d'attente.
- Fin : première équipe à 30 cases, ou fin des 12 minutes (l'équipe la plus avancée gagne).

Choix validés avec le professeur :

- Pendant un blocage, **Avancer est grisé** ; sans choix au bout des 8 s, une solution est prise à la place.
- Option de partie « **solution garantie** » (cochée par défaut) : pendant un blocage, le tirage contient toujours la
  solution qui débloque. Décochée : hasard total.
- **Égalité** de position en fin de partie : l'équipe qui a le plus de réponses justes passe devant ; égalité parfaite = ex æquo.
- Une solution déjà au plafond est exclue du tirage ; « Attaquer » est grisé si aucune équipe ne peut être visée
  (toutes bloquées ou protégées).

## Données

- `data/questions.json`, `data/parcours.json`, `data/config.json` : créés au premier lancement à partir de `seed/`
  (les 20 questions de test du brief et le parcours « Test »).
- Aucune donnée d'élève n'est écrite sur le disque : les pseudos restent en mémoire le temps de la partie.

## Organisation du code

```
server/
  index.js       serveur HTTP + Socket.IO, diffusion de l'état
  jeu.js         logique de partie (machine à états, règles, minuteries)
  types.js       types de questions : préparation (sans la réponse) et validation côté serveur
  constantes.js  équipes, réglages par défaut, paires obstacle / solution
  stockage.js    fichiers JSON
  reseau.js      adresse IP locale, port de secours, config-serveur.json
public/          pages /course, /jouer, /admin, /test, styles, scripts, SVG, polices embarquées
seed/            questions et parcours de départ
test/            tests de la logique de jeu (node --test)
tools/           élèves factices
demarrer.bat     lancement Windows (double-clic) ; demarrer.command (Mac), demarrer.sh (Linux)
design/          maquettes Claude Design (référence de l'interface)
docs/            brief et cahier des charges
```

Le serveur fait foi : tirages, validation, stocks, blocages, positions et chrono sont calculés côté serveur.
Les navigateurs ne reçoivent jamais la bonne réponse avant d'avoir répondu.

## Avancement

1. **Cœur du jeu** (fait) : serveur, salle d'attente avec codes, écran élève avec bandeau d'état, projecteur 2 à 8 équipes,
   règles complètes, questions QCM.
2. **Interface finale** (fait) : écrans fidèles aux maquettes, animations, polices embarquées ;
   **mode local** : scripts de lancement, adresse et QR code, page /test, fonctionnement hors ligne.
3. Autres types de questions : ordre, calcul, blocs (module du distributeur de céréales), programme à compléter.
4. Admin complet : éditeur de questions et de parcours, export / import JSON.
5. Déploiement en ligne depuis GitHub, test de charge (60 clients).
