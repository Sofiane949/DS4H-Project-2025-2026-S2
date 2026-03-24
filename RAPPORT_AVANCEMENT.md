# Journal d'Avancement Individuel : Projet WebXR Shaders

**Projet DS4H 2025-2026**  
**Encadrant :** Michel Buffa

---

## Sofiane

**Semaine 1 : Recherche et Prototypage**
*   **Veille Technologique :** Étude approfondie du framework **Web Audio Modules (WAM)** et des extensions vidéo.
*   **Build Système :** Installation de l'environnement et réussite de la compilation locale du dépôt original de Tom Burns (`burns-audio-wam`).
*   **Prototypes Babylon.js :** Création d'une série d'exemples (`babylonjs_shaders_example`) appliquant des shaders provenant de **Shadertoy** sur des formes 3D (Box, Sphere, Torus) via des `ShaderMaterial` et `ProceduralTextures`.

**Semaine 2 : Architecture du Plugin WAM**
*   **Conception du Plugin :** Création du dossier `video_babylonjs` et définition de la structure WAM (Runner, Processor, GUI).
*   **Moteur de Rendu :** Développement du `BabylonRunner.ts`. Mise en place de l'initialisation de l'Engine Babylon utilisant un **contexte WebGL partagé** avec l'hôte pour garantir les performances.
*   **Réactivité Audio :** Implémentation de la logique de mise à l'échelle des objets 3D basée sur l'analyse des fréquences (**FFT**) reçues en temps réel.

**Semaine 3 : Intégration Finale et Résolution de Bugs**
*   **Bundling Webpack :** Configuration avancée de Webpack pour inclure l'intégralité de la bibliothèque Babylon.js dans le bundle final, résolvant les erreurs d'importation ("Bare Specifiers") sur
    l'hôte en ligne.
*   **Stabilisation AudioWorklet :** Résolution des erreurs critiques de scope (`webAudioModules is undefined`) en isolant l'enregistrement du processeur via une injection sécurisée.
*   **Connexion Inter-Plugins :** Implémentation du système de capture de textures. Le moteur 3D récupère désormais le flux vidéo du plugin ISF d'Amir pour l'appliquer comme texture émissive sur les
    mèches 3D.
*   **Coordination :** Rédaction du README global du projet et fusion des différentes branches sur le `main`.

---

## Adel

**Semaine 1 : Analyse Fonctionnelle**
*   **Exploration Hôte :** Test et analyse du fonctionnement de [sequencer.party](https://sequencer.party) pour identifier les mécanismes de déclenchement audio-visuel.
*   **Étude de l'UI :** Définition des besoins pour une interface de séquenceur capable de piloter des shaders ISF.

**Semaine 2 : Développement du Séquenceur (Host)**
*   **Moteur de Séquence :** Développement du projet `isf-renderer-adel`. Création d'un **Step-Séquenceur de 16 pas** en Vanilla JS.
*   **Gestion des Sons :** Intégration d'un moteur de sampler capable de charger et jouer différents kits de batterie (808, Electronic, Hip-Hop).
*   **Interface Utilisateur :** Création de la grille interactive du séquenceur, des contrôles de transport (Play/Stop/BPM) et des indicateurs de progression.

**Semaine 3 : Systèmes Avancés et Fusion**
*   **Backend Express :** Implémentation d'un serveur Node.js/Express pour servir les fichiers statiques et gérer une API REST de persistance des presets de shaders.
*   **Navigation & Ergonomie :** Création d'un composant Navbar pour basculer entre les modes "Chaînage", "Audio" et "Séquenceur".
*   **Intégration :** Collaboration avec Sofiane et Amir pour harmoniser les structures de dossiers et préparer le dépôt pour le rendu final.

---

## Amir

**Semaine 1 : Spécifications ISF**
*   **Étude du Format :** Recherche sur la norme **Interactive Shader Format (ISF)** et son parseur de métadonnées JSON.
*   **Analyse des Shaders :** Étude des plugins `video_isf` existants pour comprendre comment les paramètres utilisateur sont injectés dans les uniformes GLSL.

**Semaine 2 : Composant de Rendu ISF**
*   **Développement Core :** Création du composant `isf-shader-renderer.js` utilisant WebGL 2.
*   **Bridge Audio-Réactif :** Développement de la classe `AudioReactiveBridge`. Cette brique permet de mapper dynamiquement le volume global et les bandes de fréquences sur les variables des shaders
    (ex: `rings`, `speed`, `glow`).
*   **Bibliothèque de Shaders :** Sélection et adaptation de shaders ISF complexes (ex: `audio-grid-3d.fs`) pour les rendre compatibles avec le projet.

**Semaine 3 : Exposition des Flux & Optimisation**
*   **API de Texture :** Implémentation des méthodes `getOutputFrame()` et `getOutputTexture()` permettant d'extraire le rendu du shader sous forme de `WebGLTexture`.
*   **Support Intégration 3D :** Travail avec Sofiane pour s'assurer que le format de sortie est compatible avec les matériaux Babylon.js sans perte de performance.
*   **Presets :** Création d'une liste de presets audio-visuels pré-configurés pour démontrer la réactivité du système.
