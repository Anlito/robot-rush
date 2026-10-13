# Faire créer des questions Robot Rush par une IA

Ce document se donne **tel quel** à une IA (ChatGPT, Claude, Le Chat…) : elle y trouve la consigne et le format
exact du fichier. Le fichier qu'elle produit s'importe directement dans le jeu.

## Mode d'emploi (pour le professeur)

1. Ouvrir l'IA, **joindre ce fichier** (ou copier tout son contenu), puis écrire la demande, par exemple :
   > Crée 12 questions Robot Rush pour des élèves de 5e sur la programmation d'une LED et d'un bouton :
   > 4 QCM, 2 remises en ordre, 2 calculs, 2 programmes à compléter (texte) et 2 blocs à compléter.
   > Ajoute un parcours « LED et bouton » avec toutes ces questions.
2. Copier le fichier JSON donné par l'IA dans le Bloc-notes, l'enregistrer sous le nom `questions-ia.json`
   (Type : *Tous les fichiers*, Codage : *UTF-8*).
3. Dans l'espace professeur : **Importer JSON** → `questions-ia.json` → **Ajouter à ma banque**.
4. **Relire chaque question** (bouton *Aperçu élève*) : une IA se trompe parfois. Les questions mal remplies sont
   marquées « ! » et ne sont pas posées tant qu'elles ne sont pas corrigées.
5. Quand tout est bon : **Publier mes questions**.

---

## Consigne pour l'IA

Tu crées des questions pour **Robot Rush**, un jeu de course en équipes utilisé en classe de technologie au collège
(programmation par blocs d'une carte type Arduino : LED, bouton, servomoteur, variables, conditions, boucles).
Réponds **uniquement** avec un fichier JSON valide, dans un seul bloc de code, au format décrit ci-dessous.
Pas de commentaire dans le JSON. Textes en français, adaptés au niveau demandé, courts et sans ambiguïté :
une seule bonne réponse possible. Vérifie chaque bonne réponse avant de répondre.

### Structure du fichier

```
{ "format": "robot-rush", "version": 1, "questions": [ ... ], "parcours": [ ... ] }
```

### Champs communs à chaque question

| Champ | Contenu |
|---|---|
| `id` | identifiant au choix, unique dans le fichier : `"q-1"`, `"q-2"`… (le jeu renumérote à l'import) |
| `type` | `"qcm"`, `"ordre"`, `"calcul"`, `"blocs"` ou `"completer"` |
| `niveau` | `"5e"`, `"4e"`, `"3e"`, `"SEGPA"` ou `"autre"` |
| `titre` | 80 caractères au plus, vu seulement par le professeur, pour retrouver la question (ex. « LED : si / sinon ») |
| `enonce` | 600 caractères au plus ; un mot entre accents graves, comme `` `score` ``, s'affiche comme du code |
| `explication` | 400 caractères au plus, affichée après la réponse (pourquoi c'est juste) |
| `duree_s` | `null` (durée par défaut : 30 s, ou 60 s pour blocs et à compléter) ou un nombre de 5 à 300 |
| `image` | `null` |
| `donnees` | selon le type, voir ci-dessous |

### `donnees` selon le type

**`qcm`** : 2 à 4 réponses (150 caractères au plus), `bonne` = position de la bonne réponse **en partant de 0**.
Les réponses sont mélangées à l'affichage.
```
{ "choix": ["setup()", "loop()", "main()", "start()"], "bonne": 1 }
```

**`ordre`** : 2 à 8 étapes **dans le bon ordre** (150 caractères au plus) ; l'élève les reçoit mélangées.
```
{ "elements": ["Allumer la LED", "Attendre 1 seconde", "Éteindre la LED"] }
```

**`calcul`** : réponse numérique exacte (nombre, décimales avec un point), unité facultative (12 caractères au plus).
```
{ "reponse": 2.5, "unite": "s" }
```

**`completer`**, version texte : programme écrit en pseudo-code, avec `___` (trois tirets bas) à la place de chaque
trou (1 à 6 trous) ; pour chaque trou, dans l'ordre, la bonne réponse et 2 à 4 mauvaises réponses plausibles
(80 caractères au plus). `mode` : `"liste"` (menu déroulant par trou) ou `"glisser"` (étiquettes à déposer).
Retours à la ligne : `\n`, indentation : 4 espaces.
```
{ "version": "texte", "mode": "liste",
  "texte": "si ___ alors\n    allumer la LED\nsinon\n    ___",
  "trous": [ { "bonne": "bouton appuyé", "distracteurs": ["bouton relâché", "LED allumée"] },
             { "bonne": "éteindre la LED", "distracteurs": ["allumer la LED", "attendre 1 s"] } ] }
```

**`blocs`** (l'élève assemble le programme dans Blockly) : `blocs` = blocs proposés dans la palette,
`sequences` = programme(s) accepté(s) (le premier est la correction affichée), `broches` = `true` si l'élève
doit choisir la broche de la LED, du bouton ou du servo (indiquer alors le branchement dans l'énoncé).
```
{ "blocs": ["led_etat", "attendre", "repeter"], "broches": false,
  "sequences": [ [ { "bloc": "repeter", "fois": 3, "faire": [
      { "bloc": "led_etat", "etat": 1 }, { "bloc": "attendre", "duree": 1 },
      { "bloc": "led_etat", "etat": 0 }, { "bloc": "attendre", "duree": 1 } ] } ] ] }
```

**`completer`**, version blocs (programme Blockly déjà assemblé, avec des trous) : comme `blocs`, plus `depart` =
la solution dans laquelle on a mis des trous (au moins un). Le reste du programme est verrouillé pour l'élève.
`blocs` = blocs de la palette pour remplir les trous (avec 1 ou 2 blocs pièges), peut être vide `[]` si seules
des valeurs sont à compléter.
```
{ "version": "blocs", "blocs": ["led_etat", "servo_angle"], "broches": false,
  "sequences": [ [ { "bloc": "led_etat", "etat": 1 }, { "bloc": "attendre", "duree": 2 }, { "bloc": "led_etat", "etat": 0 } ] ],
  "depart":    [ { "bloc": "led_etat", "etat": 1 }, { "bloc": "attendre", "duree": { "bloc": "trou" } }, { "bloc": "trou" } ] }
```

### Les blocs (types `blocs` et `completer` version blocs)

Instructions (une liste = des blocs les uns sous les autres) :

| Bloc | Écriture |
|---|---|
| contrôler la LED (HAUT = allumée, BAS = éteinte) | `{ "bloc": "led_etat", "etat": 1 }` ou `"etat": 0` |
| attendre (en secondes) | `{ "bloc": "attendre", "duree": 0.5 }` |
| servomoteur (angle de 0 à 180) | `{ "bloc": "servo_angle", "angle": 90 }` |
| répéter N fois | `{ "bloc": "repeter", "fois": 4, "faire": [ ... ] }` |
| si … alors | `{ "bloc": "si_alors", "condition": COND, "alors": [ ... ] }` |
| si … alors … sinon | `{ "bloc": "si_sinon", "condition": COND, "alors": [ ... ], "sinon": [ ... ] }` |
| ranger une valeur dans la variable CHOIX | `{ "bloc": "affecter", "variable": "CHOIX", "valeur": 3 }` |

Conditions et valeurs (COND) :

| Bloc | Écriture |
|---|---|
| état du bouton (vrai si appuyé) | `{ "bloc": "bouton_etat" }` |
| HAUT / BAS | `{ "bloc": "valeur_haut_bas", "valeur": 1 }` (ou `0`) |
| comparaison = ou ≠ | `{ "bloc": "comparaison", "op": "=", "a": VALEUR, "b": VALEUR }` (`"op": "≠"` pour différent) |
| la variable CHOIX | `{ "bloc": "variable", "variable": "CHOIX" }` |
| un nombre | `5` |

Noms à mettre dans `blocs` (palette) : `led_etat`, `attendre`, `servo_angle`, `repeter`, `si_alors`, `si_sinon`,
`bouton_etat`, `valeur_haut_bas`, `comparaison`, `affecter`, `variable`, `nombre`.
La palette doit contenir **tous** les blocs nécessaires à la solution (type `blocs`) ou aux trous (`completer` blocs).
Pour une comparaison avec un nombre ou CHOIX, mettre aussi `nombre` et `variable` dans la palette.

Broches (seulement si `"broches": true`) : ajouter `"broche"` à chaque LED, bouton et servo, dans la solution
**et** dans le départ. LED et bouton : `"D2"` à `"D13"` ; servo : `"D5"` ou `"D6"`.
Exemple : `{ "bloc": "led_etat", "etat": 1, "broche": "D4" }`, `{ "bloc": "bouton_etat", "broche": "D7" }`.

Trous du `depart` (`completer` version blocs) :

| Trou | Écriture dans `depart` |
|---|---|
| bloc manquant (l'élève le glisse depuis la palette) | `{ "bloc": "trou" }` à la place de l'instruction |
| nombre à écrire (durée, angle, nombre de fois, valeur) | `{ "bloc": "trou" }` à la place du nombre |
| menu à choisir | `"?"` à la place de la valeur : `"etat": "?"`, `"broche": "?"`, `"op": "?"`, `"valeur": "?"` (HAUT/BAS) |
| condition à placer | `"condition": null` |

Le jeu accepte déjà les écritures équivalentes (« si bouton », « si bouton = HAUT », « si bouton ≠ BAS ») ;
ajouter une seconde séquence seulement pour une vraie variante (par exemple commencer LED éteinte).

### Parcours (facultatif)

```
{ "id": "p-1", "nom": "LED et bouton", "ordre_aleatoire": true, "questions": ["q-1", "q-2", "q-3"],
  "reglages": { "dureePartie": 12, "longueur": 30 } }
```
`dureePartie` : minutes (1 à 60) ; `longueur` : cases de la piste (5 à 100) ; `reglages` peut rester `{}`.

### Exemple complet de fichier

```json
{
  "format": "robot-rush",
  "version": 1,
  "questions": [
    { "id": "q-1", "type": "qcm", "niveau": "5e", "titre": "Rôle de loop()", "image": null, "duree_s": null,
      "enonce": "Dans un programme Arduino, quelle partie se répète sans fin ?",
      "explication": "setup() s'exécute une fois au démarrage, loop() se répète sans fin.",
      "donnees": { "choix": ["setup()", "loop()", "main()", "start()"], "bonne": 1 } },
    { "id": "q-2", "type": "ordre", "niveau": "5e", "titre": "Clignotement : ordre", "image": null, "duree_s": null,
      "enonce": "Remets les étapes dans l'ordre pour faire clignoter la LED une fois.",
      "explication": "On allume, on attend, on éteint, on attend.",
      "donnees": { "elements": ["Allumer la LED", "Attendre 1 seconde", "Éteindre la LED", "Attendre 1 seconde"] } },
    { "id": "q-3", "type": "calcul", "niveau": "5e", "titre": "Durée d'un clignotement", "image": null, "duree_s": null,
      "enonce": "La LED reste allumée 0,5 s puis éteinte 0,5 s, et cela 4 fois. Combien de secondes en tout ?",
      "explication": "(0,5 + 0,5) × 4 = 4 secondes.",
      "donnees": { "reponse": 4, "unite": "s" } },
    { "id": "q-4", "type": "completer", "niveau": "5e", "titre": "Si / sinon (texte)", "image": null, "duree_s": null,
      "enonce": "Complète : la LED s'allume quand on appuie sur le bouton, sinon elle s'éteint.",
      "explication": "Condition : bouton appuyé. Sinon : on éteint la LED.",
      "donnees": { "version": "texte", "mode": "liste",
        "texte": "si ___ alors\n    allumer la LED\nsinon\n    ___",
        "trous": [ { "bonne": "bouton appuyé", "distracteurs": ["bouton relâché", "LED allumée"] },
                   { "bonne": "éteindre la LED", "distracteurs": ["allumer la LED", "attendre 1 s"] } ] } },
    { "id": "q-5", "type": "blocs", "niveau": "5e", "titre": "Clignoter 3 fois (blocs)", "image": null, "duree_s": null,
      "enonce": "Assemble un programme qui fait clignoter la LED 3 fois (1 s allumée, 1 s éteinte).",
      "explication": "Répéter 3 fois : allumer, attendre 1 s, éteindre, attendre 1 s.",
      "donnees": { "blocs": ["led_etat", "attendre", "repeter"], "broches": false,
        "sequences": [ [ { "bloc": "repeter", "fois": 3, "faire": [
          { "bloc": "led_etat", "etat": 1 }, { "bloc": "attendre", "duree": 1 },
          { "bloc": "led_etat", "etat": 0 }, { "bloc": "attendre", "duree": 1 } ] } ] ] } },
    { "id": "q-6", "type": "completer", "niveau": "4e", "titre": "Bouton D7, LED D4 (blocs à compléter)", "image": null, "duree_s": null,
      "enonce": "La LED est branchée sur D4 et le bouton sur D7. Complète : la LED s'allume quand on appuie, sinon elle s'éteint.",
      "explication": "Condition : état du bouton (D7). Alors LED (D4) à HAUT, sinon LED (D4) à BAS.",
      "donnees": { "version": "blocs", "blocs": ["bouton_etat", "valeur_haut_bas", "comparaison"], "broches": true,
        "sequences": [ [ { "bloc": "si_sinon", "condition": { "bloc": "bouton_etat", "broche": "D7" },
          "alors": [ { "bloc": "led_etat", "etat": 1, "broche": "D4" } ],
          "sinon": [ { "bloc": "led_etat", "etat": 0, "broche": "D4" } ] } ] ],
        "depart": [ { "bloc": "si_sinon", "condition": null,
          "alors": [ { "bloc": "led_etat", "etat": 1, "broche": "?" } ],
          "sinon": [ { "bloc": "led_etat", "etat": "?", "broche": "D4" } ] } ] } }
  ],
  "parcours": [
    { "id": "p-1", "nom": "LED et bouton", "ordre_aleatoire": true,
      "questions": ["q-1", "q-2", "q-3", "q-4", "q-5", "q-6"], "reglages": {} }
  ]
}
```
