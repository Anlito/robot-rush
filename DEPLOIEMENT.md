# Mettre Robot Rush en ligne

En ligne, le jeu a une adresse fixe (par exemple `https://robot-rush.onrender.com`) : rien à lancer sur le PC
du professeur, les élèves y vont depuis n'importe quel poste. Si le réseau du collège bloque cette adresse,
le **mode local** reste le plan B (voir [MODE-LOCAL.md](MODE-LOCAL.md)).

Le code est sur GitHub (`Anlito/robot-rush`). Les trois hébergeurs ci-dessous savent le déployer
directement depuis le dépôt ; les fichiers de réglage sont déjà prêts (`render.yaml`, `railway.json`, `fly.toml`, `Dockerfile`).

## Quel hébergeur ?

Tarifs relevés en octobre 2026 sur les sites officiels : à revérifier au moment de s'inscrire, ils changent souvent.

| | **Railway** (Hobby) | **Render** (gratuit) | **Fly.io** |
|---|---|---|---|
| Coût | 5 $/mois (5 $ d'usage inclus) ; essai gratuit de 30 jours | 0 € | ≈ 2,19 $/mois pour la plus petite machine allumée en continu, moins avec l'arrêt automatique, + 0,15 $/Go/mois de volume |
| Carte bancaire | pour l'abonnement | non | oui (sauf court essai) |
| Mise en veille | non | après 15 min sans élève connecté, ≈ 1 min pour se réveiller | arrêt quand plus personne n'est connecté, redémarrage en quelques secondes |
| Questions créées en ligne | **gardées** (volume) | **effacées à chaque redémarrage** : voir « banque.json » | **gardées** (volume) |
| Mise en place | quelques clics depuis GitHub | quelques clics depuis GitHub | outil en ligne de commande (ou GitHub Actions) |

**Conseil** : Railway pour un usage régulier en classe ; Render pour essayer gratuitement ;
Fly.io si vous êtes à l'aise avec la ligne de commande et voulez le coût le plus bas.

Dans tous les cas, il faut choisir un **mot de passe professeur** (variable `ADMIN_PASSWORD`).
En ligne, l'espace professeur reste fermé tant qu'il n'est pas défini.

---

## Railway

1. Aller sur <https://railway.com> et se connecter avec son compte GitHub.
2. **New Project** → **Deploy from GitHub repo** → choisir `Anlito/robot-rush`.
   Railway lit `railway.json` et construit le `Dockerfile`.
3. Ouvrir le service → onglet **Variables** → **New Variable** : `ADMIN_PASSWORD` = votre mot de passe.
4. **Volume (pour garder les questions)** : dans le projet, clic droit sur le service → **Attach volume**,
   chemin de montage : `/data`. Robot Rush le détecte tout seul.
5. Onglet **Settings** → **Networking** → **Generate Domain** : l'adresse du jeu apparaît (`…up.railway.app`).
   Dans **Settings → Region**, choisir une région européenne.
6. Vérifier : ouvrir `https://<adresse>/sante` → `{"ok":true,…}`, puis `https://<adresse>/admin`.

Chaque envoi sur la branche `main` du dépôt redéploie le jeu automatiquement.

## Render (gratuit)

1. Aller sur <https://render.com> et se connecter avec son compte GitHub.
2. **New +** → **Blueprint** → choisir `Anlito/robot-rush`. Render lit `render.yaml`.
3. Render demande `ADMIN_PASSWORD` : saisir votre mot de passe → **Apply**.
4. L'adresse du jeu apparaît en haut du service (`https://robot-rush….onrender.com`).
5. Vérifier : `https://<adresse>/sante`, puis `/admin`.

**Les deux limites de l'offre gratuite :**

- **Mise en veille** après 15 minutes sans visite : ouvrir l'écran projecteur (`/course`) **deux minutes avant le cours**.
  Pendant une partie, les élèves connectés le gardent éveillé.
- **Fichiers effacés** à chaque redémarrage (mise en veille comprise) : les questions créées en ligne disparaissent.
  La parade : la **banque de départ** `banque.json`.
  1. Préparer ses questions et parcours (en local, ou en ligne pendant une séance).
  2. Espace professeur → **Exporter JSON**.
  3. Sur GitHub, dans le dépôt : **Add file** → **Upload files** → déposer le fichier **renommé `banque.json`** → **Commit changes**.
  4. Render redéploie ; à chaque démarrage, le jeu recharge cette banque.

  Un bandeau jaune le rappelle dans l'espace professeur quand le stockage n'est pas permanent.

## Fly.io

Il faut un compte Fly.io avec une carte bancaire, et l'outil `flyctl`
(<https://fly.io/docs/flyctl/install/>).

Dans le dossier Robot Rush :

```bash
fly launch --no-deploy --copy-config
```

Choisir un nom libre (il devient l'adresse : `<nom>.fly.dev`) ; il remplace `robot-rush` dans `fly.toml`.

```bash
fly volumes create robot_rush_data --region cdg --size 1
```

```bash
fly secrets set ADMIN_PASSWORD=votre-mot-de-passe
```

```bash
fly deploy
```

**Déployer depuis GitHub au lieu de la ligne de commande** : créer un jeton avec `fly tokens create deploy`,
l'ajouter dans le dépôt GitHub (**Settings → Secrets and variables → Actions** → `FLY_API_TOKEN`),
puis **Actions → Déploiement Fly.io → Run workflow**.

La machine s'arrête quand plus personne n'est connecté et redémarre à la première visite (quelques secondes).

---

## Mettre à jour le jeu

- **Railway, Render** : tout envoi sur `main` redéploie automatiquement.
- **Fly.io** : `fly deploy`, ou le bouton **Run workflow** de GitHub Actions.

Un redéploiement interrompt la partie en cours : ne pas mettre à jour pendant un cours.

## Avant le premier cours

1. Depuis un **poste élève du collège**, ouvrir `https://<adresse>/test` : la page doit afficher « Connexion réussie ».
   Si l'adresse est bloquée par le filtrage du collège, demander son ouverture au référent numérique,
   ou utiliser le mode local.
2. Facultatif, hors temps de cours : test de charge sur le serveur en ligne (il lance une vraie partie de 60 élèves factices) :

   ```bash
   node tools/test-charge.js --adresse https://<adresse> --mdp votre-mot-de-passe
   ```

## Données et sécurité

- Seuls les pseudos des élèves passent par le serveur ; ils restent en mémoire et disparaissent à la fin de la partie.
  Aucune donnée d'élève n'est écrite sur le disque ni dans les journaux.
- Choisir une région européenne (Render : Francfort ; Fly.io : Paris ; Railway : région européenne dans les réglages).
- Le mot de passe professeur n'est jamais dans le dépôt GitHub : il est saisi dans les réglages de l'hébergeur.
