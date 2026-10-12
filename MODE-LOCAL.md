# Robot Rush en mode local (sans internet)

Ce mode permet de jouer **sans hébergement et sans internet** : le jeu tourne sur le PC du professeur,
branché au vidéoprojecteur, et les ordinateurs des élèves s'y connectent par le réseau du collège.
Rien n'est installé sur les postes élèves : un navigateur suffit.

Aucune donnée ne sort du réseau local. Les questions, parcours et réglages sont enregistrés sur le PC
(dossier `data/`). Les pseudos des élèves ne sont jamais enregistrés : ils disparaissent à la fin de la partie.

---

## 1. Installer Node.js (une seule fois)

Robot Rush a besoin de **Node.js**, un programme gratuit.

**Avec les droits d'installation** : télécharger la version **LTS** sur <https://nodejs.org/fr/download>
et l'installer en gardant les options proposées.

**Sans droits d'installation (version portable, utilisable depuis une clé USB)** :

1. Sur <https://nodejs.org/fr/download>, choisir **Windows**, puis **Standalone Binary (.zip)**, architecture **x64**.
2. Ouvrir le fichier `.zip` téléchargé. Il contient un dossier du type `node-v22.x.x-win-x64`.
3. Copier **le contenu** de ce dossier dans un nouveau dossier nommé **`node`**, placé dans le dossier Robot Rush.
   On doit obtenir le fichier `Robot Rush\node\node.exe`.

`demarrer.bat` utilise automatiquement ce Node.js portable s'il le trouve.

*Mac ou Linux* : même principe avec l'archive `.tar.gz` de votre système, dont le contenu va dans `node/`
(on doit obtenir `node/bin/node`).

## 2. Préparer le dossier (une seule fois, avec internet)

1. Récupérer le dossier Robot Rush (copie du dépôt GitHub ou d'une clé USB) et le placer où vous voulez,
   par exemple dans *Documents*.
2. Double-cliquer sur **`demarrer.bat`**. La première fois, il installe les composants du jeu
   (dossier `node_modules`) : **une connexion internet est nécessaire pour cette étape uniquement**.

Ensuite, le dossier complet (avec `node_modules`, et `node` si vous utilisez la version portable)
peut être **copié tel quel** sur une clé USB ou un autre PC : il fonctionnera sans internet.

## 3. Lancer le jeu

1. Brancher le PC au **réseau du collège** (câble ou Wi-Fi), le même que celui des postes élèves.
2. Double-cliquer sur **`demarrer.bat`** (Mac : `demarrer.command`, Linux : `demarrer.sh`).
3. Une fenêtre noire s'ouvre et affiche l'adresse à donner aux élèves, par exemple :

   ```
   Adresse à donner aux élèves :  http://192.168.1.25:3000/jouer
   (version courte : 192.168.1.25:3000)
   ```

   **Laissez cette fenêtre ouverte pendant tout le cours** : la fermer arrête le jeu.
4. Le navigateur s'ouvre sur l'**espace professeur**. Mot de passe par défaut : `robot`.
5. Ouvrez **`/course`** (lien en haut de l'espace professeur) sur l'écran du vidéoprojecteur,
   puis mettez-le en plein écran (touche **F11**).

Équivalent en ligne de commande : `npm start`.

## 4. Autoriser le pare-feu Windows (au premier lancement)

Au premier lancement, Windows affiche « Le Pare-feu Windows Defender a bloqué certaines fonctionnalités de cette application ».

- Cocher **Réseaux privés** (et Réseaux publics seulement si le réseau du collège est déclaré « public »).
- Cliquer sur **Autoriser l'accès**.

Si vous avez cliqué sur Annuler par erreur : *Paramètres* → *Confidentialité et sécurité* → *Sécurité Windows*
→ *Pare-feu et protection du réseau* → *Autoriser une application via le pare-feu* → *Modifier les paramètres*
→ cocher **Node.js JavaScript Runtime** pour les réseaux privés. Des droits d'administrateur peuvent être nécessaires :
demandez alors au référent numérique.

## 5. Donner l'adresse aux élèves

L'adresse est affichée **en grand au projecteur** avant la partie, avec un **QR code** (pour les tablettes),
et dans l'espace professeur. Les élèves la tapent dans la barre d'adresse du navigateur, **sans www ni https**,
par exemple `192.168.1.25:3000`, puis saisissent le code de leur équipe.

## 6. Tester le réseau avant le premier cours

Depuis un poste élève, ouvrir l'adresse suivie de **`/test`**, par exemple `192.168.1.25:3000/test`.
La page doit afficher **« Connexion réussie »**. Elle vérifie aussi que le temps réel fonctionne
et mesure la rapidité du réseau. Cette page ne change rien à la partie.

## 7. Que faire si ça ne marche pas

| Ce qu'on voit | Que faire |
|---|---|
| La fenêtre noire dit « Node.js n'est pas installé » | Installer Node.js (étape 1), ou utiliser la version portable. |
| « L'installation des composants a échoué » | Il faut internet pour la toute première installation. Sinon, copier le dossier depuis un PC où le jeu fonctionne déjà (avec `node_modules`). |
| La fenêtre noire se ferme tout de suite | Ouvrir une invite de commandes dans le dossier et taper `demarrer.bat` pour lire le message. |
| « Le port 3000 est déjà utilisé, essai du port 3001 » | Rien à faire : le jeu prend le port suivant. Donner aux élèves la **nouvelle** adresse affichée. |
| La page ne s'ouvre pas sur les postes élèves | 1) Vérifier que les postes sont sur le **même réseau** que le PC. 2) Vérifier le **pare-feu** (étape 4). 3) Essayer l'**autre adresse** affichée si le PC a plusieurs cartes réseau. 4) Certains réseaux isolent les postes entre eux : demander au référent numérique d'autoriser le port (3000 par défaut), ou utiliser un point d'accès Wi-Fi dédié à la classe. |
| « Aucun réseau détecté » | Le PC n'est relié à aucun réseau : brancher le câble ou se connecter au Wi-Fi, attendre quelques secondes. |
| La page `/test` s'affiche mais le temps réel échoue | Un proxy ou un filtrage bloque les WebSockets. Essayer un autre navigateur, ou demander au référent numérique. |
| Un élève a fermé son onglet | Il rouvre la même adresse : il retrouve son équipe et son pseudo automatiquement. |

## 8. Changer le mot de passe ou le port

Au premier lancement, `demarrer.bat` crée le fichier **`config-serveur.json`** dans le dossier Robot Rush.
L'ouvrir avec le Bloc-notes :

```json
{
  "port": 3000,
  "motDePasse": "robot",
  "ouvrirNavigateur": true
}
```

Modifier `motDePasse` (et `port` si besoin), enregistrer, puis relancer le jeu.
Les variables d'environnement `ADMIN_PASSWORD` et `PORT` restent possibles et sont prioritaires.

## 9. Sauvegarder ses questions

Tout est enregistré automatiquement dans le dossier **`data/`** du dossier Robot Rush.
Pour sauvegarder ou transférer vos questions sur un autre PC, copiez ce dossier
(l'export / import depuis l'espace professeur arrive avec l'éditeur de questions).
