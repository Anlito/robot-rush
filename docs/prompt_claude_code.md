# Prompt pour Claude Code — « Robot Rush »

## Contexte
Je suis professeur de technologie en collège. Je veux un jeu de classe en direct : des élèves répartis en 2 à 8 équipes jouent sur leur ordinateur, la course est projetée au vidéoprojecteur.

Lis d'abord `brief_jeu_course_equipes.md` (règles, écrans, réglages, questions de test) : c'est la référence fonctionnelle. Les maquettes et icônes viennent de Claude Design (export fourni dans le dossier `design/`) : respecte-les pour l'interface.

## Stack demandée
- Node.js, un seul serveur qui sert les 3 pages et gère le temps réel (WebSocket ou Socket.IO).
- Front en HTML / CSS / JavaScript léger (pas de moteur de jeu, pas de framework lourd ; un petit framework est acceptable s'il simplifie nettement). Animations en SVG / CSS.
- Pages : `/course` (projecteur), `/jouer` (élèves), `/admin` (professeur).
- Données en fichiers JSON (questions, parcours, réglages) avec **export et import depuis l'admin**.
- Dépôt GitHub avec README clair : lancement local (`npm install && npm start`) et déploiement.

## Architecture et principes
1. **Serveur autoritaire** : toute la logique (tirage des questions, validation des réponses, stocks, blocages, positions, chrono) est côté serveur. Les navigateurs ne reçoivent jamais la bonne réponse avant d'avoir répondu.
2. Une partie = machine à états : `lobby` → `en_cours` ↔ `pause` → `terminée`.
3. Les trois types de clients (projecteur, élève, admin) reçoivent l'état par événements temps réel. Prévoir la **reconnexion** d'un élève (identifiant stocké dans le navigateur) : il retrouve son équipe et son pseudo.
4. Admin protégé par un mot de passe simple défini par variable d'environnement.
5. Jusqu'à environ 60 élèves simultanés ; tout doit rester fluide sur de vieux postes de collège.
6. Prévoir deux modes de déploiement : (a) hébergement depuis GitHub vers un service gratuit ou peu cher (Render, Railway ou Fly.io, à comparer au moment du choix, en tenant compte du « sommeil » des offres gratuites) ; (b) **mode local de secours** sur le PC du prof, avec affichage de l'adresse à donner aux élèves.

## Règles du jeu à implémenter (voir brief, section 3)
- 2 à 8 équipes ; un code court par équipe (4 caractères, sans caractères ambigus) ; l'élève saisit code + pseudo et rejoint directement la bonne équipe.
- 4 paires obstacle / solution configurables : Trou/Pont, Mur/Échelle, Rocher/Pelleteuse, Boue/Chenilles.
- Après une bonne réponse, 8 s pour choisir (sinon « Avancer ») :
  - **Avancer** : +2 cases ;
  - **Prendre une solution** : 2 solutions tirées au hasard parmi 4, l'élève en choisit une, ajoutée au **stock partagé de l'équipe** (plafond 3 par type) ;
  - **Attaquer** : 2 obstacles tirés au hasard parmi 4, l'élève en choisit un, puis **choisit l'équipe cible** (automatique s'il n'y a que 2 équipes).
- Obstacle reçu : si la solution correspondante est en stock, elle est consommée automatiquement et l'obstacle est annulé ; sinon **le robot de l'équipe est bloqué** (pas un joueur) pendant 15 s, ou jusqu'à ce qu'un coéquipier prenne la solution correspondante (consommée aussitôt).
- Une équipe bloquée ne peut pas recevoir de nouvel obstacle ; protection de 3 s après son redémarrage.
- Mauvaise réponse : 3 s d'attente sans action. Temps dépassé = mauvaise réponse.
- Fin : première équipe à l'arrivée (30 cases) ou fin du temps (12 min) → équipe la plus avancée gagne ; écran final avec podium et meilleurs joueurs.
- **Tous ces nombres sont des réglages** modifiables dans l'admin, avec les valeurs par défaut du brief.

## Écran élève : vision de la course
Les élèves ne voient pas toujours le projecteur : leur écran doit afficher en permanence, dans un bandeau compact, la mini-piste de toutes les équipes, le stock de solutions de leur équipe, l'état de leur équipe (libre / bloquée par quoi, combien de secondes, quelle solution la débloque), et les dernières actions, avec une alerte visuelle forte lors d'une attaque ou d'un déblocage.

## Types de questions (voir brief, section 4)
Chaque type = un composant d'affichage + une fonction de validation côté serveur :
1. `qcm` : 4 réponses, 1 bonne.
2. `ordre` : éléments à remettre dans l'ordre.
3. `calcul` : réponse numérique exacte.
4. `blocs` : l'élève assemble des blocs selon une consigne. **Réutilise le module de blocs du projet « distributeur de céréales »** (dépôt GitHub : `<À COMPLÉTER : URL ou nom du dépôt>`). Commence par lire ce code, indique ce que tu réutilises tel quel et ce que tu adaptes, en version réduite (sans simulateur complet en v1). Validation : comparaison de la séquence de blocs avec la liste des séquences acceptées.
5. `completer` : programme avec un ou plusieurs trous (liste déroulante ou glisser-déposer) ; validation par comparaison avec les valeurs attendues.

### Schéma de données proposé (à affiner)
```json
{
  "id": "q-014",
  "type": "qcm | ordre | calcul | blocs | completer",
  "niveau": "5e",
  "enonce": "texte de la consigne",
  "image": null,
  "duree_s": 30,
  "explication": "texte court affiché après la réponse (optionnel)",
  "donnees": { }
}
```
`donnees` dépend du type (propositions + index de la bonne réponse, éléments dans l'ordre correct, valeur numérique attendue, blocs disponibles + séquences acceptées, texte à trous + valeurs correctes).
Un **parcours** = `{ id, nom, questions: [ids], ordre_aleatoire: true, reglages: { ... } }`.

## Admin
- Créer / modifier / dupliquer / supprimer des questions de chaque type, avec aperçu.
- Créer des parcours.
- Lancer une partie : parcours, nombre d'équipes, réglages, génération et affichage des codes, liste des élèves par équipe, retrait d'un pseudo, déplacement d'un élève, Démarrer / Pause / Arrêter.
- Export / import JSON de la banque de questions et des parcours.
- Charger au premier lancement les **20 questions de test** de l'annexe du brief, réparties dans un parcours « Test ».

## Plan de livraison par étapes (merci de t'arrêter et de me faire tester entre chaque étape)
1. **Cœur du jeu** : serveur, lobby avec codes d'équipe, écran élève avec bandeau d'état, écran projecteur avec 2 à 8 lignes, règles complètes, questions QCM uniquement (interface provisoire).
2. **Interface finale** à partir des maquettes de Claude Design.
3. **Autres types de questions** : ordre, calcul, puis blocs (réutilisation du module céréales), puis programme à compléter.
4. **Admin complet** : éditeur de questions, parcours, export / import.
5. **Déploiement** : mise en ligne depuis GitHub + mode local de secours, README, test de charge simulé avec une soixantaine de clients factices.

## Qualité attendue
- Tests automatisés sur la logique de jeu (attaques, solutions, blocages, protections, fin de partie, cas limites : stock plein, équipe déjà bloquée, équipe seule, déconnexions).
- Messages d'erreur clairs pour le professeur (ex. : « 3 équipes configurées, 2 codes utilisés »).
- Aucune donnée personnelle collectée au-delà du pseudo saisi par l'élève, qui n'est pas conservé après la partie.
- Pose-moi tes questions avant de coder si un point du brief est ambigu, plutôt que de décider seul sur les règles du jeu.
