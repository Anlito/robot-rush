# Test de charge

- Date : 12/10/2026 19:30:12
- Serveur : local (serveur de test lancé par l'outil), Intel(R) Core(TM) i5-7300U CPU @ 2.60GHz, 8 Go
- Node.js v24.19.0
- 60 élèves, 8 équipes, 60 s de course, une réponse toutes les 1 à 3 s par élève (plus rapide qu'en classe)

| Mesure | Résultat |
|---|---|
| Actions envoyées par les élèves | 1976 (33 par seconde) |
| Délai de réponse du serveur (médiane / 95 % / max) | 2 ms / 16 ms / 59 ms |
| Délai de mise à jour de l'écran élève (médiane / 95 %) | 46 ms / 59 ms |
| Connexion d'un élève (médiane / max) | 278 ms / 362 ms |
| Reçu par élève (moyenne) | 13.4 Ko/s, 6.2 messages/s |
| Mémoire du serveur (max) | 71 Mo |
| Erreurs de connexion | 0 |
| Déconnexions imprévues | 0 |
| Actions refusées par les règles (normal : cible devenue protégée…) | 78 |
| Positions en fin de test | Rouge 38, Bleue 36, Verte 36, Jaune 60, Violette 40, Orange 32, Rose 38, Turquoise 32 |

**Verdict : fluide** (seuils : 95 % des réponses en moins de 250 ms, des mises à jour en moins de 400 ms, aucune erreur ni déconnexion).

Détail des actions refusées :

- 30 × action : Votre robot est bloqué : impossible d'avancer.
- 23 × action : Aucune équipe ne peut être attaquée pour le moment.
- 9 × action : Votre stock de solutions est plein.
- 7 × attaquer : L'équipe Rouge est déjà bloquée.
- 3 × attaquer : L'équipe Violette est déjà bloquée.
- 2 × attaquer : Choisis une équipe adverse.
