# Livraison design : Robot Rush

## Vue d'ensemble
Robot Rush est un jeu de classe en direct (technologie, collège 5e–3e et SEGPA). 2 à 8 équipes répondent à des questions de programmation sur leur ordinateur. Chaque bonne réponse permet d'**avancer**, de **prendre une solution** pour le stock de l'équipe ou d'**attaquer** une autre équipe avec un obstacle. La course est projetée en classe.

Trois pages : `/course` (projecteur), `/jouer` (élèves), `/admin` (professeur). Les règles du jeu, les réglages par défaut, les types de questions et les contraintes techniques sont dans le brief du dépôt (`brief_jeu_course_equipes.md`). **Ce document décrit uniquement l'interface.** En cas de conflit sur une règle, c'est le brief qui fait foi.

## À propos des fichiers de design
Les fichiers de `maquettes/` sont des **références de design créées en HTML** : ils montrent l'aspect et le comportement voulus, ce n'est **pas du code de production à copier**. Il faut **recréer ces écrans** dans l'application Node.js prévue par le brief. Pas de moteur de jeu : 2D en SVG + CSS, WebSocket pour le temps réel. Le framework front est au choix : HTML/JS natif, Preact ou Svelte conviennent, vu la contrainte de légèreté.

Pour consulter les maquettes : ouvrir un fichier `.dc.html` dans un navigateur (avec `support.js` dans le même dossier). Les écrans y sont disposés en planches, à leur taille réelle.

Les SVG de `assets/` sont, eux, **directement réutilisables** dans le code.

## Fidélité
**Haute fidélité.** Les couleurs, typographies, tailles, contours et rayons sont définitifs. Seuls les contenus (noms, chiffres, questions) sont des exemples.

---

## Design tokens

### Couleurs d'équipe (couleur + symbole, jamais la couleur seule)
| # | Équipe | Hex | Symbole | Texte posé sur la couleur |
|---|---|---|---|---|
| 1 | Rouge | `#E0362C` | étoile | `#FFFFFF` |
| 2 | Bleue | `#2563EB` | triangle | `#FFFFFF` |
| 3 | Verte | `#16A34A` | cercle | `#16161D` |
| 4 | Jaune | `#F2B705` | carré | `#16161D` |
| 5 | Violette | `#7C3AED` | losange | `#FFFFFF` |
| 6 | Orange | `#F97316` | éclair | `#16161D` |
| 7 | Rose | `#DB2777` | cœur | `#FFFFFF` |
| 8 | Turquoise | `#0891B2` | croix | `#FFFFFF` |

Avec N équipes, on prend les N premières dans cet ordre.

### Neutres
| Nom | Hex | Usage |
|---|---|---|
| Encre | `#16161D` | texte, tous les contours, boutons primaires |
| Encre 2 | `#4A4A57` | texte secondaire |
| Papier | `#F5F2EA` | fond projecteur et élève |
| Piste | `#E9E3D6` | fond des couloirs de piste |
| Graduation | `#D3CBB9` | traits de case sur la piste |
| Trait | `#DDD6C8` | séparateurs |
| Blanc | `#FFFFFF` | cartes |
| Fond admin | `#F7F6F2` | fond de l'admin |
| Bordure champ admin | `#C9C2B3` | champs de saisie et boutons désactivés |
| Danger admin | `#B42318` | Arrêter, Supprimer, Retirer |

### Signaux (volontairement hors palette d'équipe)
| État | Rendu |
|---|---|
| Bloquée | bandes de chantier `repeating-linear-gradient(-45deg, #F2B705 0 12px, #16161D 12px 24px)` (arrêts nets, rendu plat) |
| Attaque reçue | flash plein `#E0362C` pendant 600 ms |
| Parade / débloquée | flash blanc, ou couleur de l'équipe |
| Compte à rebours | pastille `#16161D`, chiffres `#F2B705` |
| Tuile obstacle | fond `#FCE3DF` |
| Tuile solution | fond `#E3F1E6` |
| Équipe « moi » (élève) | fond de ligne `#DCE7FD` (bleu clair, car l'équipe de démo est Bleue ; en pratique, une teinte claire de la couleur de l'équipe) |
| Correct | `#15803D` / `#16A34A` |

### Boutons de réponse QCM (couleur + forme + lettre)
| | Fond | Texte | Forme |
|---|---|---|---|
| A | `#2563EB` | blanc | triangle |
| B | `#F97316` | `#16161D` | losange |
| C | `#7C3AED` | blanc | cercle |
| D | `#15803D` | blanc | carré |

### Typographie (Google Fonts)
- **Bricolage Grotesque** 500/700/800 : titres, noms d'équipe, chrono, chiffres (`font-variant-numeric: tabular-nums` sur les chronos).
- **Atkinson Hyperlegible** 400/700 : tout le texte courant (énoncés, réponses, admin). Elle distingue bien I, l et 1.
- **JetBrains Mono** 500/700 : codes d'équipe, code Arduino, blocs, valeurs numériques.

```
https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=JetBrains+Mono:wght@500;700&display=swap
```
Pour le **mode local hors ligne**, auto-héberger ces trois polices dans `public/fonts/`.

### Échelle typographique (px)
| Rôle | Projecteur 1920×1080 | Élève 1440×900 | Admin |
|---|---|---|---|
| Chrono de partie | 88 (800) | — | — |
| Codes d'équipe (avant la partie) | 104 mono | 56 (saisie) | 20 |
| Grand titre | 72–88 | 48–52 | 24–26 |
| Nom d'équipe | 34 (8 équipes) · 60 (2 équipes) | 19 | 18 |
| Énoncé | — | 32–36 | 15 |
| Texte des réponses | — | 40 (QCM, mono) · 26 (ordre) | 15 |
| Fil d'actions | 24 (8 éq.) · 28 (2 éq.) | 14 | — |
| **Minimum** | **24** | 13 | 12 |

### Espacements, rayons, contours
- Espacements : multiples de 4 → 4, 8, 12, 16, 24, 32, 48, 64.
- Rayons : 6 (puces), 8 (blocs), 10 (champs et boutons admin), 12–14 (cartes), 16–22 (boutons de jeu, grandes cartes).
- Contours : **2 px** `#16161D` partout, **2,5–3 px** sur les éléments jouables et au projecteur. Admin : 1,5 px.
- **Aucun dégradé, aucune ombre floue.** Seule exception : un « socle » plein sous les boutons de jeu, `box-shadow: 0 5px 0 #16161D` (ou `0 6px 0`). Au clic : `transform: translateY(5px); box-shadow: none`.

---

## Assets (`assets/`)
Dessinés à la main en SVG, sans licence tierce.

- `robots/robot-<equipe>-<etat>.svg` : 8 équipes × 3 états (`normal`, `bloque`, `succes`). viewBox `-4 -2 68 66` (le robot occupe 0–64). En code, mieux vaut **un seul composant paramétrable** (voir `maquettes/Robot.dc.html`) avec trois paramètres : `color`, `symbol`, `state`. Structure : antenne + boule, tête `rect 36×22 rx6`, yeux (selon l'état), corps `rect 32×18 rx4`, plaque blanche `r7` avec le symbole en encre, 2 roues.
  - normal : pupilles décalées à droite (regard vers l'arrivée), bouche droite ;
  - bloque : sourcils inquiets, bouche ondulée, bulle rouge « ! » en haut à droite ;
  - succes : yeux en arcs, grand sourire, traits de vitesse à gauche.
- `symboles/*.svg` : les 8 symboles, centrés sur (0,0) dans un carré de ±5,5.
- `icones/*.svg` : 4 obstacles (`trou`, `mur`, `rocher`, `boue`) et 4 solutions (`pont`, `echelle`, `pelleteuse`, `chenilles`). viewBox 32×32, contour 2 px. Testées à 56, 32, 24 et 20 px.

Correspondances : trou → pont · mur → échelle · rocher → pelleteuse · boue → chenilles. La liste est modifiable dans l'admin. Si le prof ajoute une paire, prévoir une icône générique.

---

## Écrans

### A. Projecteur `/course` (cible 1920×1080, mise à l'échelle avec `transform: scale` pour d'autres résolutions)

**A1 · Course, 8 équipes**
- Barre du haut : 104 px, fond blanc, bordure basse 3 px. Grille `1fr auto 1fr` :
  - à gauche : robot encre 60 px, « Robot Rush » 40/800, nom du parcours 24 px ;
  - au centre : chrono `08:42` 88/800, blanc sur encre, padding `4px 28px`, rayon 14 ;
  - à droite : « Rejoindre » et l'URL en mono 24 px.
- Corps : grille `1fr 440px`, gap 24, padding 24.
- **Couloir d'équipe** (112 px de haut, gap 6, contour 2,5 px, rayon 14, fond `#E9E3D6`). Grille `240px 1fr` :
  - Étiquette sur la couleur de l'équipe : pastille symbole 48 px (cercle blanc + symbole encre), nom 34/800, position `17 / 30` en mono 24/700.
  - Piste : zone absolue `left:28px; right:76px`, graduations `linear-gradient(90deg, #D3CBB9 2px, transparent 2px)` avec `background-size: calc(100%/30) 100%`. Ligne de départ : barre blanche de 6 px bordée d'encre. Arrivée : damier `repeating-conic-gradient(#16161D 0 25%, #fff 0 50%) 0 0/12px 12px` de 24 px de large.
  - Robot 64 px placé à `left: pos/longueur × 100 %`, centré (`translateX(-36px)`).
  - **Stock sous le robot** : puces blanches de 32 px (icône 24 + quantité mono 22/700). On n'affiche que les solutions dont la quantité est supérieure à 0.
  - Si bloquée : tuile obstacle 56 px (`#FCE3DF`) devant le robot, pastille compte à rebours 32/800 (`9 s`), bandes de chantier de 8 px en bas du couloir, robot en état `bloque`.
  - Si protégée (3 s après un déblocage) : `outline: 4px dashed #fff` autour du robot.
  - Robot en état `succes` pendant 1 s après une parade.
- **Colonne de droite** :
  - Carte « Classement » : lignes de 40 px avec rang 25/800, carré couleur et symbole de 32 px, nom 25 en gras, position mono 24.
  - Carte « En direct » : fil d'actions, icône 40 px + texte 24 px, noms d'équipe en gras, séparateur 1,5 px `#DDD6C8`. 6 lignes au plus, opacité dégressive `1, 1, .85, .7, .55, .4`.
  - Exemples de messages : « **Bleue** envoie un trou à **Violette !** », « **Rose** franchit la boue avec ses chenilles », « **Verte** prend une pelleteuse et repart », « **Jaune** stocke une échelle ».

**A2 · Course, 2 équipes**
Même structure, couloirs en `flex:1` (environ 430 px chacun) :
- en-tête du couloir sur la couleur de l'équipe : symbole 64, « Équipe Rouge » 60/800, position mono 44 ;
- robot 180 px, puces de stock (icône 52 + chiffre 40), tuile obstacle 120 px, compte à rebours 56/800 ;
- pas de carte Classement, fil d'actions en 28 px.

Règle de mise en page : de 2 à 3 équipes, utiliser le gabarit « grand » ; de 4 à 8, le gabarit « compact » (hauteur de couloir = espace disponible / N, au moins 96 px).

**A3 · Avant la partie**
- Fond papier, padding `48px 56px`.
- Titre « Rejoins ton équipe » 72/800. Sous-titre 36 px : « Va sur **URL** et tape le code », l'URL en mono blanc sur encre.
- À droite : nombre d'élèves connectés 96/800.
- Grille 4×2 de cartes (contour 3 px, rayon 18) : bandeau couleur avec robot 64 et nom 40/800 ; code mono 104/700 (`letter-spacing .06em`) ; « 5 élèves · Lina, Noah… » en 24 px.
- Codes : 4 caractères, alphabet sans O/0/I/1.

**A4 · Fin de partie**
- Grille `1fr 600px`.
- À gauche : « Arrivée en 10:48 » 32 px, « L'équipe Rose gagne ! » 88/800.
- Podium dans l'ordre 2–1–3 : robots en état `succes` (140 / 180 / 120 px), marches couleur d'équipe de 260 / 360 / 190 px avec le rang 96/800 et la position.
- Sous le podium, équipes 4 à 8 sur une ligne en 26 px.
- À droite : « Meilleurs joueurs », 3 cartes (Réponses justes, Attaques envoyées, Solutions fournies) avec robot de l'équipe 80 px, pseudo 44/800, équipe 26, score 72/800.

### B. Élève `/jouer` (cible 1440×900, paysage, doit rester utilisable jusqu'à 1280×720)

**Bandeau d'état permanent** (`maquettes/Bandeau.dc.html`)
- 176 px de haut (environ 20 %), padding 12, grille `340px 1fr 230px 290px`, gap 12. Chaque bloc : carte blanche, contour 2 px, rayon 12.
1. **Équipe et état** : en-tête sur la couleur de l'équipe (robot 34, « Équipe Bleue » 19/800, pseudo à droite), puis l'état :
   - `libre` : pastille verte cochée, « Libre » 26/800, position ;
   - `bloque` : bandes de chantier, encart encre avec icône obstacle, « Bloquée par un TROU » 16 en gras, « Prends un PONT ! » 14 en gras `#F2B705`, compte à rebours 28/800 `#F2B705` ;
   - `attaque` (flash 600 ms) : **tout le bandeau** passe en `#E0362C`, « Attaque ! » + « Rouge t'envoie un trou » ;
   - `parade` (flash blanc) : icône solution, « Paré ! Votre pont a bouché le trou de Rouge » ;
   - `debloque` (flash couleur d'équipe) : « C'est reparti ! Adam a pris un pont · protégés 3 s ».
2. **Mini-piste** : une ligne de 22 px par équipe, triée par position. Libellé 13 px (« Toi » en gras pour sa propre équipe, ligne en fond clair), rail de 2 px, pastille 20 px (couleur + symbole), contour 3 px pour soi, damier d'arrivée. Étiquette « bloquée » (11 px, jaune sur encre) à côté des équipes bloquées.
3. **Stock de l'équipe** : grille 2×2, icône 32 + quantité 22/800 + « /3 ». Quantité à 0 en opacité .35.
4. **Dernières actions** : 3 lignes en 14 px avec icône 22.

**Zone de question** (sous le bandeau, padding `24px 40px 36px`)
- Ligne d'en-tête commune : puce de type (blanc sur encre, 15 en gras), « Question N », barre de temps (14 px, contour 2, remplissage encre qui **passe en `#E0362C` sous 5 s**), secondes restantes 28/800.
- B2 **QCM** : énoncé 36 px, grille 2×2 de boutons (contour 3, rayon 18, socle 6 px), forme 56 px + texte mono 40/700. Raccourcis clavier 1 à 4.
- B3 **Remise en ordre** : étiquettes de 76 px (poignée ⠿, numéro sur encre, texte 26 en gras, flèches ↑ ↓ de 44 px pour le clavier ou le tactile). L'étiquette déplacée est inclinée de −1,2° et décalée de 18 px, avec un socle de 8 px. Bouton « Valider » 80 px à droite.
- B4 **Calcul** : champ de 380×150, mono 96/700, et bouton « Valider ↵ » de même hauteur. Chiffres uniquement, Entrée pour valider.
- B5 **Blocs à assembler** : grille `330px 1fr 220px`.
  - Palette : blocs avec encoche, mono 19/700, rayon 8. Catégories : contrôle `#F2B705` (texte encre), sorties LED/servo `#0891B2`, attente `#7C3AED`.
  - Zone d'assemblage sur une trame de points. Le bloc C « répéter (5) fois » a une valeur éditable en pastille blanche. Zone de dépôt : pointillés 3 px `#2563EB` sur `#DCE7FD`.
  - Boutons « Tout effacer » et « Valider ».
  - Validation côté serveur par comparaison avec les séquences acceptées. À aligner sur le module « distributeur de céréales » existant, qui n'était pas disponible pendant le design.
- B6 **Programme à compléter** : code sur fond encre, mono 32, mots-clés en `#F2B705`. Trou : pointillés 3 px `#F2B705`, au moins 300 px de large. Étiquettes en dessous (mono 24/700, contour 2,5, socle 4 px). Variante liste déroulante : même emplacement, menu natif stylé.

**B7 · Bonne réponse, choix de l'action**
- Robot 96 en état `succes`, « Bonne réponse ! » 52/800, explication 20 px.
- Compte à rebours circulaire de 96 px (bordure 6 px), sous-titre « puis « Avancer » ».
- 3 grandes cartes (contour 3, rayon 20, socle 6) :
  - **Avancer** : encre, flèche blanche 88 px, choix par défaut entouré d'un `outline 4px` couleur d'équipe ;
  - **Solution** : fond blanc, 2 icônes de solution ;
  - **Attaquer** : fond `#F2B705`, 2 icônes d'obstacle.
- Titre 44/800, description 22, « Touche 1 / 2 / 3 ».
- Délai de 8 s, puis « Avancer » automatiquement.

**B8 · Solution** : 2 cartes de solution tirées au hasard (fond `#E3F1E6`), icône 180 px, nom 52/800, « contre le **rocher** · stock 0 → 1 ». Si le stock atteint le plafond, l'indiquer (« (plein) »). Choisir une solution déjà au plafond est sans effet : à griser, ou à exclure du tirage côté serveur.

**B9 · Attaquer** : 2 obstacles tirés au hasard (cartes de 170 px ; celle sélectionnée en `#F2B705` avec `outline 5px` encre et coche), puis « Envoyer le mur à… » : une carte par équipe adverse (couleur d'équipe, robot 80, nom 30/800, info 17). Les équipes **déjà bloquées** ou **protégées** sont affichées à opacité .4 et non cliquables. Avec 2 équipes, on saute l'étape de la cible.

**B10 · Mauvaise réponse** : carte centrée de 880 px, robot 150 en état `bloque`, « Pas cette fois. » 52/800, réponse donnée vs bonne réponse (surlignée `#E3F1E6`, contour `#16A34A`), explication, barre de 3 s et « Nouvelle question dans N s ».

**B1 · Connexion** : fond couleur `#2563EB` (neutre avant d'avoir une équipe), carte de 560 px. Code : 4 cases de 96 px, mono 56/700, avec majuscules automatiques et passage auto à la case suivante. Dès qu'un code est valide, encart de confirmation « Tu rejoins l'équipe Bleue ▲ · 4 coéquipiers ». Pseudo : champ de 64 px. Bouton « Rejoindre la course » 72 px. Mention : « Les codes n'utilisent ni O, 0, I ni 1. Si tu actualises la page, tu retrouves ton équipe et ton pseudo. »

### C. Admin `/admin` (1440, sobre : texte 15 px, contours 1,5 px, pas de socle)
- Barre de 60 px : logo, onglets « Partie / Questions / Parcours » (onglet actif souligné de 3 px encre), Importer et Exporter JSON, lien « Ouvrir /course au projecteur ».
- **C0 · Accès** : carte de 400 px avec un champ mot de passe.
- **C1 · Lancement**
  - Colonne gauche de 360 px : sélecteur de parcours, nombre d'équipes en segmenté 2–8, réglages (9 champs numériques alignés à droite), paires obstacle → solution avec lien « Modifier ».
  - Zone principale : « Salle d'attente » + nombre de connectés, boutons Régénérer les codes / Pause / Arrêter (désactivés avant le départ) / **▶ Démarrer la course**.
  - Grille 3×2 de cartes d'équipe : en-tête couleur + code mono 20. Chaque ligne d'élève fait 30 px : pastille connectée (vert) ou en reconnexion (gris), pseudo, boutons ⇄ (déplacer vers une autre équipe, menu) et × (retirer).
  - Pseudo signalé : fond `#FCE3DF` et × rouge. Signalement manuel par le prof, ou automatique avec une liste de mots.
  - En cours de partie, Pause et Arrêter deviennent actifs et Démarrer devient « Reprendre ».
- **C2 · Questions**
  - Liste de 560 px : recherche, « + Nouvelle », filtres en puces par type et par niveau, lignes de 44 px (n°, type, énoncé tronqué, niveau, durée), sélection en `#DCE7FD`.
  - Éditeur : onglets des 5 types, énoncé, image (zone de dépôt), puis un **bloc propre à chaque type** :
    - QCM : 4 réponses avec forme et couleur, bouton radio « bonne réponse » ;
    - Ordre : étapes saisies dans l'ordre correct, glissables, + ajouter ;
    - Calcul : réponse exacte, unité facultative ;
    - Blocs : blocs proposés (puces activables) + liste des séquences acceptées + « Ajouter une variante » ;
    - À compléter : programme avec marqueurs `___`, pour chaque trou la bonne réponse et les distracteurs, mode glisser-déposer ou liste.
  - Puis niveau, durée et explication. Boutons Supprimer, Aperçu élève, Enregistrer.
- **C3 · Parcours** : liste des parcours (280 px), éditeur au centre (nom, ordre aléatoire en interrupteur, durée, longueur de piste, liste ordonnée des questions avec ⠿ et ×, résumé par type), banque de questions à droite (420 px) avec « + ».

---

## Interactions et animations
N'animer que `transform` et `opacity`. Avec `prefers-reduced-motion`, garder les changements d'état et supprimer les rebonds et les secousses.

| Événement | Durée | Description |
|---|---|---|
| Avancer | 450 ms ease-out | le robot glisse de N cases, rebond vertical de 4 px à l'arrivée |
| Impact d'obstacle | 300 + 200 ms | l'obstacle tombe (translateY −80 → 0), secousse ±6 px ×3, robot en état `bloque`, la pastille du compte à rebours apparaît en fondu |
| Blocage | continu | rien d'animé en boucle, seul le chiffre change chaque seconde |
| Solution qui annule | 500 ms | l'icône sort du stock (scale 1 → 1,4), se pose sur l'obstacle, les deux disparaissent (scale 0 + opacity 0), robot en état `succes` pendant 1 s, stock −1 |
| Déblocage | 250 ms | l'obstacle s'efface, saut de 8 px, halo pointillé blanc pendant les 3 s de protection |
| Victoire | 1,2 s | sauts de 12 px ×3, puis podium : marches en scaleY 0 → 1 dans l'ordre 3e, 2e, 1re |
| Fil d'actions | 200 ms | nouvelle ligne par le haut, les autres descendent |
| Alerte élève | 600 ms | fond du bandeau plein en couleur d'alerte, puis retour. **Jamais de clignotement répété** |
| Boutons de jeu | 80 ms | pression : translateY 5 px, le socle disparaît |

**Clavier élève** : 1 à 4 pour les réponses QCM, 1 à 3 pour les actions, Entrée pour valider.

## État d'interface (côté client, alimenté par le serveur)
Le serveur fait foi. Le client ne reçoit **jamais** la bonne réponse avant validation.

- Projecteur : `{ phase: 'attente'|'course'|'pause'|'fin', chrono, equipes[{ id, nom, couleur, symbole, code, position, stock{pont,echelle,pelleteuse,chenilles}, blocage{obstacle, finA}|null, protegeJusqua, eleves[] }], fil[], podium?, meilleurs? }`
- Élève : en plus, `moi{ pseudo, equipeId, jeton }` (jeton en `localStorage` pour la reconnexion), `ecran: 'connexion'|'question'|'action'|'solution'|'attaque'|'erreur'`, `question{ id, type, enonce, image?, choix?, duree }`, `tirage{ solutions[2] | obstacles[2] }`, `alerte: null|'attaque'|'parade'|'debloque'` (effacée après 600 ms).
- Admin : `parcours`, `reglages`, `banque`, actions `demarrer / pause / arreter / retirerEleve / deplacerEleve / regenererCodes`.

## Fichiers
- `maquettes/Robot Rush - Systeme.dc.html` : palette, robots, icônes, typo, boutons, espacements, animations.
- `maquettes/Robot Rush - Projecteur.dc.html` : A1 à A4.
- `maquettes/Robot Rush - Eleve.dc.html` : B1 à B11 (B11 = les 5 états du bandeau).
- `maquettes/Robot Rush - Admin.dc.html` : C0 à C3 (les onglets de type de C2 sont cliquables).
- `maquettes/Robot.dc.html`, `Icone.dc.html`, `Bandeau.dc.html` : composants (source de référence des SVG).
- `maquettes/support.js` : nécessaire uniquement pour ouvrir les maquettes.
- `assets/` : SVG prêts à l'emploi.

Les URL (`robot-rush.onrender.com`), pseudos et chiffres sont des exemples.
