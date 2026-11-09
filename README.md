# Exercice d'Arabe pour Français (v1.0)

Application web pour apprendre **l'arabe littéraire (fuṣḥā)** quand on parle français, du niveau **A1 au niveau Expert**.
Elle reprend la mécanique de « Exercice d'Anglais pour Français » v1.0.1 (profils, séries, révision espacée, historique et
graphiques, test de niveau, examen blanc, expression écrite, oral au micro, « Mes exercices », sauvegarde, attestation),
mais **tous les exercices sont en arabe**, avec consignes, traductions et corrections **en français**.

Ce n'est plus un logiciel Windows : c'est un **site web qui s'installe comme une application sur téléphone**
(Android et iPhone) et qui **fonctionne hors ligne** après la première ouverture.

## Mettre le site en ligne sur GitHub (gratuit, 5 minutes)

1. Créez un compte sur https://github.com puis un **nouveau dépôt public** (bouton « New »), par ex. `exercice-arabe`.
2. Sur la page du dépôt : **Add file › Upload files**, puis glissez **tout le contenu** du dossier `ExerciceArabeFrancais`
   (le fichier `index.html` doit être à la racine du dépôt, pas dans un sous-dossier). Cliquez **Commit changes**.
3. Allez dans **Settings › Pages**. Sous « Build and deployment », choisissez **Source : Deploy from a branch**,
   **Branch : main**, dossier **/ (root)**, puis **Save**.
4. Après 1 à 2 minutes, le site est disponible à l'adresse `https://VOTRE-NOM.github.io/exercice-arabe/`.

En ligne de commande (si vous utilisez git) :

    git init && git add . && git commit -m "Exercice d'Arabe v1.0"
    git branch -M main
    git remote add origin https://github.com/VOTRE-NOM/exercice-arabe.git
    git push -u origin main

## Installer sur le téléphone

- **Android (Chrome)** : ouvrez l'adresse du site, menu ⋮ › **Installer l'application** (ou « Ajouter à l'écran d'accueil »).
- **iPhone (Safari)** : ouvrez l'adresse, bouton Partager › **Sur l'écran d'accueil**.

Une fois ouverte une première fois avec Internet, l'application et ses 9 310 exercices fonctionnent **sans connexion**.

## Voix arabe et micro

- La lecture à voix haute utilise la voix arabe du téléphone. Si aucune voix n'est trouvée :
  - Android : Paramètres › Accessibilité › Synthèse vocale › Moteur Google › Installer les données vocales › **Arabe** ;
  - iPhone : Réglages › Accessibilité › Contenu énoncé › Voix › **Arabe**.
  Menu ⚙️ Options › « Tester la voix ».
- **Oral au micro** : reconnaissance vocale du navigateur (Chrome sur Android, Safari récent sur iPhone ; Internet nécessaire
  sur certains appareils). Sans micro, l'exercice propose une auto-évaluation.

## Ce qui change par rapport à la version anglaise

- **Alphabet** : nouvelle catégorie (noms des lettres, formes début / milieu / fin, voyelles brèves et longues, chiffres arabes),
  plus une page de référence où l'on touche une lettre pour l'entendre.
- **Voyelles (ḥarakāt)** : tout le contenu est vocalisé. Option pour les masquer (lecture « comme dans la presse »).
  Elles restent toujours affichées en grammaire et en conjugaison, où elles font la différence.
- **Translittération** (kitāb, madrasa, ash-shams…) calculée automatiquement, affichable ou non.
- **Clavier arabe intégré** pour les réponses écrites (pratique si le téléphone n'a pas de clavier arabe).
  Les voyelles sont facultatives dans les réponses ; une petite erreur de hamza, ة ou ى est signalée mais acceptée, sauf en orthographe.
- **Conjugaison** : 75 verbes réguliers conjugués automatiquement (formes I à X : passé, présent, subjonctif, jussif,
  impératif, passif, participes, masdar) et 25 verbes irréguliers (concaves, défectueux, assimilés, hamzés, géminés) écrits à la main.
- **Prononciation** : translittération, lettres solaires et lunaires, paires de sons difficiles pour un francophone
  (ق / ك, ص / س, ط / ت, ع / أ, ح / ه, خ / ح, ض / د, ظ / ذ…), voyelles longues et shadda.
- Les données sont dans le navigateur (localStorage). Pour changer d'appareil : Options › Sauvegarder ma progression (.json).

## Contenu : 9 310 exercices

| Catégorie | A1 | A2 | B1 | B2 | C1 | C2 | Expert |
|---|---|---|---|---|---|---|---|
| 🔤 Alphabet | 264 | 14 | – | – | – | – | – |
| 📚 Vocabulaire (traduction, pluriels, intrus, contraires, racines, schèmes, nombres, mois) | 352 | 435 | 351 | 303 | 208 | 141 | 100 |
| 🧩 Grammaire (110 questions rédigées, de هٰذَا / هٰذِهِ à l'i'rāb) | 23 | 19 | 18 | 14 | 14 | 12 | 10 |
| ⏳ Conjugaison | 120 | 253 | 399 | 417 | 232 | 114 | 89 |
| ✍️ Orthographe (mots, hamza, ة, ى) | 275 | 211 | 194 | 175 | 136 | 92 | 71 |
| 🗣️ Prononciation | 145 | 463 | 188 | 148 | – | – | – |
| 🎧 Écoute et dictée (lettres, mots, phrases, nombres, heures, jours) | 552 | 432 | 345 | 246 | 70 | 53 | 50 |
| 📖 Lecture (12 textes, jusqu'à Kalīla wa Dimna) | 19 | 26 | 21 | 18 | 6 | 6 | 8 |
| 💬 Expressions (politesse, collocations, expressions imagées, proverbes) | 29 | 26 | 30 | 33 | 27 | 21 | 18 |
| 🤝 Communication | 16 | 16 | 12 | 10 | 5 | 4 | 2 |
| 🧱 Phrases (traduction, ordre des mots) | 79 | 74 | 59 | 45 | 36 | 30 | 30 |
| 🎤 Oral au micro | 175 | 125 | 140 | 89 | 66 | 10 | 10 |
| 🖼️ Trouver l'image | 112 | 72 | 32 | 18 | 5 | 1 | 1 |

S'y ajoutent **10 sujets d'expression écrite** (A1 → C2) avec modèle de réponse, le test de niveau et l'examen blanc.

## Modifier ou ajouter du contenu

Tout le contenu est dans des fichiers texte (une ligne = un élément, champs séparés par `|`) :

| Fichier | Contenu |
|---|---|
| `tools/content/vocab_<niveau>.txt` | mots : arabe vocalisé, français, thème, emoji, pluriel |
| `tools/content/sentences.txt` | phrases : niveau, arabe, français |
| `tools/content/grammar.txt` | QCM de grammaire avec explication |
| `tools/content/verbs_sound.txt` | verbes réguliers (racine, forme, voyelles) : conjugués automatiquement |
| `tools/content/verbs_weak.txt` | verbes irréguliers : tableaux écrits à la main |
| `tools/content/expressions.txt`, `communication.txt`, `reading.txt` | expressions, dialogues, textes |
| `tools/lists.py` | alphabet, paires de sons, nombres, heures, contraires, racines, images, sujets de rédaction |

Puis (Python 3, aucune bibliothèque à installer) :

    python tools/build_bank.py     (reconstruit data/*.json)
    python tools/check_bank.py     (vérifie toute la banque)

Après une modification, changez aussi le numéro `CACHE` dans `sw.js` pour que les téléphones téléchargent la nouvelle version.

## Limites (à connaître)

- Une grande partie des exercices est **générée à partir de listes** et vérifiée automatiquement, mais elle n'a **pas été
  relue un par un par un enseignant ou un arabophone**. Merci de signaler toute erreur.
- La translittération est une aide approximative (forme de pause, sans toutes les règles de liaison).
- La note de prononciation mesure ce que le téléphone **comprend**, pas chaque son.
- La note d'expression écrite est **partielle** (consigne, longueur, mots de liaison, vocabulaire, structure).
- L'attestation et l'examen blanc n'ont **aucune valeur officielle**.
