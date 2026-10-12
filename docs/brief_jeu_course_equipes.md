# Brief — Jeu de course d'équipes en direct (nom de travail : « Robot Rush »)

## 1. Objectif

Un jeu de classe en direct, utilisable en technologie (programmation, algorithmique, électronique).
Les élèves jouent sur leur ordinateur, répartis en 2 à 8 équipes. La course est projetée au vidéoprojecteur.
Chaque bonne réponse donne une action : avancer, se prémunir contre un obstacle, ou envoyer un obstacle à une équipe adverse.

Contenu 100 % piloté par le professeur : il crée ses questions et ses parcours, donc le jeu est utilisable à tous les niveaux (5e, 4e, 3e, SEGPA).

## 2. Les trois écrans

### 2.1 Écran projecteur (« Course »)
- Piste en vue de côté, **une ligne par équipe** (2 à 8 lignes, toujours lisibles de loin).
- Chaque équipe : son robot à sa couleur, nom, position, **stock de solutions** sous le robot, obstacle en cours et chrono de blocage.
- Fil d'actions en direct (« Équipe Bleue envoie un trou à l'équipe Rouge ! », « Équipe Verte franchit la boue avec ses chenilles »).
- Chrono de la partie, classement en direct, écran de fin avec podium et meilleurs joueurs.
- Avant la partie : affichage en grand des **codes d'équipe**.

### 2.2 Écran élève (« Jouer »)
1. Saisie du **code d'équipe** + pseudo → l'élève arrive directement dans la bonne équipe.
2. Question, avec chrono.
3. Après une bonne réponse : choix de l'action (voir 3.3).
4. **Bandeau d'état permanent** (les élèves ne voient pas toujours le projecteur) :
   - mini-piste avec **toutes les équipes** (la sienne en évidence) ;
   - **stock de solutions** de son équipe (icônes + quantités) ;
   - **état de son équipe** : « Libre », ou « Bloquée par un TROU — 12 s — prends un PONT ! » ;
   - 2 ou 3 dernières actions (« Rouge t'envoie un mur »).
   - Alerte visuelle (flash de couleur) quand son équipe est attaquée, bloquée ou débloquée.
   - Le bandeau doit rester compact (environ 20 % de la hauteur) pour ne pas gêner la question.
5. Reconnexion automatique si l'élève actualise la page (il retrouve son équipe et son pseudo).

### 2.3 Écran professeur (« Admin »)
- **Lancement de partie** : choix du parcours, du nombre d'équipes (2 à 8), de la durée et des réglages ; génération des codes d'équipe ; liste des élèves connectés par équipe ; bouton Démarrer / Pause / Arrêter.
- Possibilité de retirer un pseudo inapproprié ou de déplacer un élève d'équipe.
- **Éditeur de questions** (tous types) et **éditeur de parcours** (voir 5 et 6).
- Mot de passe simple pour accéder à l'admin.

## 3. Règles du jeu

### 3.1 Équipes
- 2 à 8 équipes, choisies au lancement. Chaque équipe a un nom, une couleur **et un symbole** (pour ne pas dépendre de la couleur seule).
- Un code court par équipe (4 caractères, sans caractères ambigus type O/0, I/1).

### 3.2 Obstacles et solutions
4 paires au départ (liste modifiable dans l'admin) :

| Obstacle | Solution |
|---|---|
| Trou | Pont |
| Mur | Échelle |
| Rocher | Pelleteuse |
| Boue | Chenilles |

### 3.3 Après une bonne réponse, l'élève choisit une action (8 s max, sinon « Avancer » par défaut)
- **Avancer** : le robot de l'équipe progresse de quelques cases.
- **Prendre une solution** : on lui propose **2 solutions tirées au hasard parmi les 4** ; il en choisit une, elle s'ajoute au **stock de l'équipe** (stock partagé, plafonné).
- **Attaquer** : on lui propose **2 obstacles tirés au hasard parmi les 4** ; il en choisit un, puis **choisit l'équipe visée en cliquant sur sa couleur** (avec 2 équipes, la cible est automatique).

### 3.4 Quand un obstacle arrive sur une équipe
- Si le stock contient la **solution correspondante** : elle est consommée automatiquement, l'obstacle est annulé (animation + message).
- Sinon, **le robot de l'équipe est bloqué** (jamais un joueur en particulier). Il repart :
  - après un délai (15 s par défaut), **ou**
  - dès qu'un coéquipier prend la solution correspondante (elle est alors consommée immédiatement).
- Une équipe déjà bloquée ne peut pas recevoir un nouvel obstacle. Après son redémarrage, elle est protégée 3 s (évite l'enchaînement infini).
- Pas d'élimination : une équipe bloquée reste dans la course.

### 3.5 Réponse fausse
Courte attente (3 s) sans action, puis nouvelle question. Cela décourage les réponses au hasard.

### 3.6 Fin de partie
Première équipe à l'arrivée, ou à la fin du temps (10 à 15 min conseillé) : l'équipe la plus avancée gagne.
Écran final : podium des équipes + meilleurs joueurs (réponses justes, attaques envoyées, solutions fournies).

### 3.7 Réglages par défaut (tous modifiables dans l'admin)
| Réglage | Valeur |
|---|---|
| Longueur de la piste | 30 cases |
| Gain d'un « Avancer » | 2 cases |
| Attente après mauvaise réponse | 3 s |
| Durée de blocage | 15 s |
| Protection après blocage | 3 s |
| Stock maximum par solution | 3 |
| Durée de la partie | 12 min |
| Temps par question | 30 s (60 s pour les types « blocs » et « programme à compléter ») |

## 4. Types de questions

1. **QCM** : 4 réponses, une seule bonne.
2. **Remise en ordre** : étapes d'un algorithme, lignes de programme, blocs.
3. **Calcul** : réponse numérique précise.
4. **Blocs à assembler** : l'élève place les bons blocs pour répondre à la consigne. Repart du **module du projet « distributeur de céréales »** (repo GitHub / Claude Code), en version réduite pour tenir en 30 à 60 s : pas de simulateur complexe en v1, validation par comparaison avec les séquences acceptées.
5. **Programme à compléter** : programme (texte ou blocs) avec un ou plusieurs trous, à remplir par liste déroulante ou glisser-déposer.

Chaque question : énoncé, image optionnelle, niveau, durée, explication courte affichée après la réponse (optionnelle).

## 5. Parcours (jeux de questions)
- Un parcours = une sélection de questions + paramètres (ordre aléatoire par défaut, durée, longueur de piste).
- Chaque élève reçoit une question tirée au hasard dans le parcours, sans répétition pour lui tant que possible.
- Exemples : « 5e – Distributeur de céréales », « 4e – Capteurs », « 3e – Algorithmique ».

## 6. Contraintes techniques
- Navigateur uniquement, aucune installation sur les postes élèves.
- Application Node.js avec communication temps réel (WebSocket) ; trois pages : `/course` (projecteur), `/jouer` (élèves), `/admin` (prof).
- **Le serveur fait foi** : les bonnes réponses ne sont jamais envoyées aux navigateurs des élèves avant validation (anti-triche).
- Jusqu'à environ 60 élèves connectés en même temps.
- Banque de questions et parcours dans des fichiers JSON, avec **export / import** depuis l'admin.
- Léger : 2D en SVG/CSS, pas de moteur de jeu, animations simples.
- **Hébergement** : le code est sur GitHub. GitHub Pages seul ne suffit pas (pas de serveur temps réel). Déploiement prévu depuis le dépôt GitHub sur un hébergeur gratuit ou peu cher (type Render, Railway ou Fly.io, à vérifier au moment du déploiement), avec **mode local de secours** (`npm start` sur le PC du prof, élèves connectés à son adresse) si le réseau du collège bloque.
- Sur un hébergement gratuit, le serveur peut « dormir » : ouvrir la page quelques minutes avant le cours.

## 7. Design
- **Robots en style plat** : formes simples, aplats de couleur, sans dégradés ni ombres lourdes.
- Chaque équipe a une couleur franche + un symbole sur le robot (lisible à 8 équipes et pour les daltoniens).
- Icônes plates pour les 4 obstacles et les 4 solutions, reconnaissables en petit.
- Boutons de réponse en gros aplats colorés (esprit Kahoot).
- Projecteur : fort contraste, grands textes, lisible depuis le fond de la salle.
- Animations courtes (déplacement, bouclier/solution, impact d'obstacle). Fluidité avant tout.

## 8. Hors périmètre de la version 1
Sons et musique avancés, comptes élèves, statistiques détaillées par élève, simulateur complet dans les questions de blocs, mode solo.

## 9. Plan de travail
1. Validation de ce brief.
2. Claude Design : maquettes des écrans et jeu d'icônes (voir `prompt_claude_design.md`).
3. Claude Code : développement par étapes (voir `prompt_claude_code.md`) : cœur du jeu avec QCM, puis autres types de questions, puis admin, puis déploiement.
4. Test en classe avec les questions ci-dessous.

---

## Annexe — 20 questions de test

### QCM (5)
1. **Dans un programme Arduino, quelle partie s'exécute en boucle indéfiniment ?** setup() / **loop()** / main() / start()
2. **Quel composant permet de faire tourner un bras à un angle précis ?** LED / **Servo-moteur** / Bouton poussoir / Buzzer
3. **« Si bouton appuyé alors allumer la LED sinon éteindre la LED » : que se passe-t-il quand le bouton est relâché ?** La LED reste allumée / **La LED s'éteint** / La LED clignote / Rien ne change
4. **Qu'est-ce qu'un algorithme ?** **Une suite d'instructions pour résoudre un problème** / Un type de capteur / Un câble de connexion / Un langage de dessin
5. **Quels états peut prendre une broche numérique ?** **HAUT ou BAS (HIGH / LOW)** / De 0 à 1023 / De 0 à 180 / ROUGE ou VERT

### Remise en ordre (4)
6. **Distributeur** : Lire l'état du bouton → Tourner le servo à 90° → Attendre 2 secondes → Remettre le servo à 0°
7. **Développement** : Écrire le programme → Vérifier le programme → Téléverser sur la carte → Tester
8. **Feu de circulation** : Rouge → Vert → Orange
9. **Clignotement** : Allumer la LED → Attendre 1 s → Éteindre la LED → Attendre 1 s

### Calcul (4)
10. La variable `score` vaut 5. On exécute « ajouter 3 à score » deux fois. Que vaut `score` ? **11**
11. « Répéter 4 fois : avancer de 25 cm ». Distance totale en cm ? **100**
12. Un servo est à 0°. Il tourne de 45° trois fois de suite. Angle final en degrés ? **135**
13. Une LED reste allumée 2 s puis éteinte 3 s, en boucle. Combien de cycles complets en 30 s ? **6**

### Blocs à assembler (4)
14. « Quand le bouton est appuyé, allume la LED. » → **si [bouton appuyé] alors [allumer LED]**
15. « Tourne le servo à 90°, attends 2 secondes, puis ramène-le à 0°. » → **servo 90° → attendre 2 s → servo 0°**
16. « Fais clignoter la LED 5 fois (1 s allumée, 1 s éteinte). » → **répéter 5 fois { allumer LED, attendre 1 s, éteindre LED, attendre 1 s }**
17. « Si le bouton est appuyé, servo à 90°, sinon servo à 0°. » → **si [bouton appuyé] alors [servo 90°] sinon [servo 0°]**

### Programme à compléter (3)
18. `si ___ alors allumer la LED sinon éteindre la LED` — la LED doit être allumée uniquement quand on appuie. Réponse : **bouton appuyé** (autres choix : bouton relâché / LED allumée / servo à 0°)
19. `digitalWrite(LED, ___);` — pour allumer la LED. Réponse : **HIGH** (autres choix : LOW / 0 / OUTPUT)
20. `attendre ___ millisecondes` — pour attendre 2 secondes. Réponse : **2000** (autres choix : 2 / 20 / 200)
