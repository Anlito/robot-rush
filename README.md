<!-- suivi-maintenance:debut -->
## État du projet et améliorations documentées — 21 octobre 2026

- Blockly et ses médias sont chargés depuis Labo Blocs en ligne, sans copie locale. Les questions de programmation nécessitent Internet, y compris lorsque le serveur du jeu est lancé sur le réseau local.
- Les courses, questions, blocs de quiz et corrections côté serveur restent propres à Robot Rush.
- La collision des identifiants d’historiques créés au même instant a été corrigée pour éviter de confondre deux bilans lors de leur import.
- Les tests et le contrôle de sauvegarde/relecture des blocs ont été effectués lors de ces modifications.
- Le dépôt et le dossier source local sont synchronisés. Le redémarrage ou le redéploiement d’un serveur Robot Rush déjà lancé reste une opération distincte ; la synchronisation du code ne redémarre pas un service.

### Référence locale et maintenance

Dossier de travail de référence : **Documents/RobotRush**. Dépôt : [Anlito/robot-rush](https://github.com/Anlito/robot-rush). La branche principale est **main**. Les copies temporaires d’un chat ou les worktrees servent au travail intermédiaire ; elles ne remplacent pas ce dossier.

À chaque intervention :

1. Vérifier les modifications locales et la version publiée avant de commencer ; sauvegarder le travail non enregistré.
2. Décrire dans ce README les améliorations, les vérifications, les limites et les opérations restantes.
3. Publier les changements autorisés, puis synchroniser le dossier local de référence avec le même commit.
4. Contrôler le commit local, le commit distant et les fichiers restants avant d’annoncer que le projet est à jour. Signaler explicitement tout décalage ou travail conservé hors publication.

Cette règle permet de reprendre le projet dans un autre outil local sans perdre les dernières améliorations. Une publication du site ne met pas automatiquement à jour les dossiers du PC.

<!-- suivi-maintenance:fin -->

## Blockly centralisé

Les questions de blocs chargent Blockly depuis Labo Blocs en ligne, sans copie dans ce projet. Une connexion Internet est nécessaire pour ces questions, même si le serveur Robot Rush est lancé localement. Le moteur du jeu, les courses, les questions et la correction côté serveur restent propres à Robot Rush.

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

## Faire créer des questions par une IA

[outils-salle/MODELE-QUESTIONS-IA.md](outils-salle/MODELE-QUESTIONS-IA.md) (consigne et format) et
[outils-salle/exemple-questions-robot-rush.json](outils-salle/exemple-questions-robot-rush.json) (une question de chaque type,
importable) : à joindre à l'IA. Une copie de ces deux fichiers est proposée au téléchargement sur https://anlito.github.io
(dossier `fichiers/robot-rush/` du dépôt `Anlito/anlito.github.io`) : **la recopier quand ils changent**.


L’accès professeur se configure pour chaque installation. Aucune valeur de mot de passe n’est indiquée dans ce README.

## Mode local : le jeu sur le PC du professeur

**Guide pas à pas pour les enseignants : [MODE-LOCAL.md](MODE-LOCAL.md)** (installation de Node.js ou version portable,
double-clic sur `demarrer.bat`, pare-feu Windows, adresse et QR code pour les élèves, page `/test`, dépannage).

Dossier tout prêt à copier sur le PC du professeur (jeu + Node.js portable + fiche de mise en place à imprimer) :
`npm run dossier-local` → `dist/RobotRush/` et son archive ZIP.

Sur **Raspberry Pi** (borne branchée en RJ45 et sur le vidéoprojecteur, installation en une commande) :
[outils-pi/RASPBERRY-PI.md](outils-pi/RASPBERRY-PI.md).

En bref : double-cliquer sur `demarrer.bat` (Mac : `demarrer.command`, Linux : `demarrer.sh`).
Le script vérifie Node.js, installe les composants la première fois, crée `config-serveur.json`,
puis lance le serveur et ouvre l'espace professeur. Le serveur, les polices, les icônes et le QR code fonctionnent localement ; les questions de blocs nécessitent Internet. Ressources locales : polices, icônes, QR code
et bibliothèques sont dans le projet.

## En ligne : Railway, Render ou Fly.io

**Guide pas à pas : [DEPLOIEMENT.md](DEPLOIEMENT.md)** (comparatif des coûts et limites, mise en place depuis GitHub,
mot de passe, volume pour garder les questions, banque de départ `banque.json` pour Render gratuit).

Fichiers prêts : `railway.json`, `render.yaml`, `fly.toml`, `Dockerfile`. Le serveur reconnaît l'hébergeur,
affiche son adresse publique aux élèves, utilise le volume permanent s'il existe, et garde l'espace professeur
fermé tant que `ADMIN_PASSWORD` n'est pas défini. Les tests tournent sur GitHub à chaque envoi (`.github/workflows`).

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
| `adressePublique` | `PUBLIC_URL` | adresse affichée aux élèves (hébergement en ligne) | adresse du PC sur le réseau local |
| `ouvrirNavigateur` | `OUVRIR_NAVIGATEUR=1` | ouvrir l'espace professeur au démarrage | non |
| | `DATA_DIR` | dossier des données | `data/` (ou le volume Railway) |

Une route `/sante` renvoie l'état du serveur (utilisée par les hébergeurs et le test de charge).

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

Test de charge : 60 élèves factices jouent une partie complète, plus vite qu'en classe, sur un serveur de test
lancé à part (vos données ne sont pas touchées). Rapport dans [docs/test-charge.md](docs/test-charge.md).

```bash
npm run test-charge
```

Options : `--eleves 80 --duree 120 --equipes 8`, ou `--adresse https://… --mdp …` pour tester un serveur en ligne.

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

## Types de questions

Chaque question : `{ id, type, niveau, enonce, image, duree_s, explication, donnees }`.
Dans l'énoncé, un mot entre accents graves (`` `score` ``) s'affiche comme du code.
Le serveur garde la réponse ; l'élève ne reçoit que ce qu'il faut pour répondre (choix mélangés, étapes mélangées…).

| Type | `donnees` | Validation (côté serveur) |
|---|---|---|
| `qcm` | `choix` (2 à 4 textes), `bonne` (index) | choix affichés mélangés, correspondance gardée par le serveur |
| `ordre` | `elements` dans le bon ordre | comparaison des textes (deux étapes identiques sont interchangeables) |
| `calcul` | `reponse` (nombre), `unite` facultative | nombre exact ; virgule ou point acceptés |
| `blocs` | `blocs` (blocs proposés), `sequences` (programmes acceptés) | programme Blockly relu par le serveur, comparé aux séquences acceptées |
| `completer` | `texte` avec `___` pour chaque trou, `trous` (`bonne`, `distracteurs`), `mode` (`liste` ou `glisser`) | chaque trou comparé à sa bonne réponse (majuscules ignorées) |

Durée par défaut : 30 s, 60 s pour `blocs` et `completer` (réglables), sauf si la question fixe `duree_s`.

### Blocs : ce qui vient du projet « distributeur de céréales »

| Repris tel quel | Adapté pour Robot Rush |
|---|---|
| Blockly chargé depuis Labo Blocs en ligne | chargé seulement à la première question de blocs |
| Libellés français, couleurs des familles, thème, rendu « zelos » (`public/js/blocs.js`) | broches au choix de la question (menus D2 à D13, servo D5 / D6) ; un seul chapeau « Programme » ; nouveau bloc « répéter ( ) fois » ; palette à plat (les blocs de la question) |
| Format simplifié des programmes et conversion Blockly ↔ programme (`server/blocs.js`) | lu côté serveur, étendu à « répéter » ; normalisation des écritures équivalentes |
| Repérage des blocs « hors du programme » (contour pointillé) | avertissement avant de valider |
| — | pas de simulateur ni de scénarios (version réduite) : comparaison avec les séquences acceptées |

Séquences acceptées, au format de l'atelier céréales (`"broche": "D3"` en plus si la question est « avec broches ») :

```json
[{ "bloc": "si_sinon", "condition": { "bloc": "bouton_etat" },
   "alors": [{ "bloc": "servo_angle", "angle": 90 }], "sinon": [{ "bloc": "servo_angle", "angle": 0 }] }]
```

Écritures équivalentes acceptées automatiquement : « si bouton », « si bouton = HAUT », « si HAUT = bouton »,
« si bouton ≠ BAS » ; « si bouton = BAS alors A sinon B » vaut « si bouton alors B sinon A ».
Pour une autre variante (ex. clignoter en commençant éteint), ajouter une séquence à la liste.

### Programme à compléter : version texte ou version blocs

- **Texte** : le programme est écrit avec `___` à la place de chaque trou (liste déroulante ou glisser-déposer).
- **Blocs** : le professeur assemble la solution dans Blockly, puis « Préparer les trous » : bloc remplacé par
  « ? bloc manquant », nombre remplacé par `?` (temps, angle, nombre de fois, valeur de CHOIX), menu sur `?`
  (broche, HAUT / BAS, = / ≠), condition retirée. L'élève reçoit ce programme verrouillé : seuls les trous se
  modifient ; un bloc posé juste au-dessus ou en dessous d'un « ? bloc manquant » prend sa place.
  La palette contient les blocs pour remplir les trous (et des pièges). Validation comme les blocs à assembler.
  Format : `"donnees": { "version": "blocs", "blocs": [...], "broches": true, "sequences": [[...]], "depart": [...] }`,
  avec `{ "bloc": "trou" }` pour un bloc manquant ou un nombre `?`, `"?"` pour un menu, `null` pour une condition vide.

## Espace professeur (`/admin`)

| Onglet | Contenu |
|---|---|
| **Partie** | parcours, nombre d'équipes, réglages, obstacles → solutions (« Modifier »), codes, élèves (déplacer, signaler, retirer), Démarrer / Pause / Arrêter, adresse et QR code |
| **Questions** | liste avec recherche et filtres (type, niveau) ; éditeur des 5 types ; image ; aperçu élève (la réponse est validée par le serveur, comme en partie) ; dupliquer, supprimer |
| **Parcours** | liste des parcours ; nom, ordre aléatoire ou fixe, durée et longueur de piste propres au parcours ; questions à ajouter depuis la banque, à réordonner (poignée ⠿ ou flèches) ; « Choisir pour la partie » ; exporter ce parcours |

- **Sauvegarde automatique** : chaque modification est enregistrée dans `data/` dès que l'on arrête de taper.
  Une question incomplète est gardée, marquée « ! », et n'est pas posée aux élèves tant qu'elle n'est pas complète.
- **Export / import JSON** (barre du haut) : un seul fichier, images comprises, pour changer de PC ou partager avec un collègue.
  À l'import : « Ajouter à ma banque » (rien n'est écrasé, numéros renumérotés si besoin) ou « Remplacer ma banque ».
- **Questions blocs** : la bonne réponse s'assemble dans Blockly (« + Ajouter la bonne réponse »), plusieurs variantes possibles.
- **Obstacles et solutions** : nom et genre de chaque obstacle et de sa solution ; les phrases du fil d'actions en sont déduites
  (« envoie un trou », « franchit la boue avec ses chenilles »). Modifiables avant le départ de la course.
- Les questions modifiées pendant une course sont prises en compte à la partie suivante.

## Données

- `data/questions.json`, `data/parcours.json`, `data/config.json` : créés au premier lancement à partir de `seed/`
  (les 20 questions de test du brief et le parcours « Test »).
- `data/images/` : images des questions ; `data/sauvegardes/` : une copie de sécurité par jour, gardée 30 jours.
- Un fichier abîmé (modifié à la main, coupure de courant) est mis de côté au démarrage au lieu de bloquer le jeu.
- Aucune donnée d'élève n'est écrite sur le disque : les pseudos restent en mémoire le temps de la partie.

## Organisation du code

```
server/
  index.js       serveur HTTP + Socket.IO, diffusion de l'état
  jeu.js         logique de partie (machine à états, règles, minuteries)
  types.js       5 types de questions : préparation (sans la réponse) et validation côté serveur
  blocs.js       programmes Blockly : lecture, normalisation, comparaison (repris du projet céréales)
  constantes.js  équipes, réglages par défaut, paires obstacle / solution
  banque.js      banque de questions et parcours : nettoyage, création, export / import
  paires.js      paires obstacle / solution (formes déduites du genre)
  images.js      images des questions (type vérifié sur le contenu)
  stockage.js    fichiers JSON, copies de sécurité
  reseau.js      adresse IP locale, port de secours, config-serveur.json
public/          pages /course, /jouer, /admin, /test, styles, scripts, SVG, polices embarquées
  js/questions.js  affichage des 5 types de questions (élève et aperçu)
  js/admin*.js     espace professeur : partie, questions, parcours, fichiers
  js/blocs.js      éditeur Blockly (blocs de l'atelier céréales)
  Blockly : module central de Labo Blocs en ligne
seed/            questions et parcours de départ
test/            tests de la logique de jeu (node --test)
tools/           élèves factices, test de charge, préparation du dossier local
outils-salle/    fiche de mise en place à imprimer, modèle et fichier exemple pour l'IA
render.yaml, railway.json, fly.toml, Dockerfile   déploiement en ligne
demarrer.bat     lancement Windows (double-clic) ; demarrer.command (Mac), demarrer.sh (Linux)
design/          maquettes Claude Design (référence de l'interface)
docs/            brief et cahier des charges
```

Le serveur fait foi : tirages, validation, stocks, blocages, positions et chrono sont calculés côté serveur.
Les navigateurs ne reçoivent jamais la bonne réponse avant d'avoir répondu.

## Avancement

1. **Cœur du jeu** (fait) : serveur, salle d'attente avec codes, écran élève avec bandeau d'état, projecteur 2 à 8 équipes,
   règles complètes.
2. **Interface finale** (fait) : écrans fidèles aux maquettes, animations, polices embarquées ;
   **mode local** : scripts de lancement, adresse et QR code, page /test, fonctionnement hors ligne.
3. **Autres types de questions** (fait) : remise en ordre, calcul, blocs (Blockly du distributeur de céréales), programme à compléter.
4. **Admin complet** (fait) : éditeur de questions des 5 types avec aperçu, éditeur de parcours, obstacles modifiables,
   export / import JSON, sauvegarde automatique et copies de sécurité.
5. **Déploiement** (fait) : Railway, Render et Fly.io prêts depuis GitHub, tests automatiques sur GitHub,
   test de charge à 60 élèves (voir docs/test-charge.md).
