# DS4H - Projet WebXR & Shaders (2025-2026)

**Équipe :** Khourta Sofiane, Benyahia Amir, El Moussaoui Adel

Ce dépôt regroupe les composants logiciels développés pour l'intégration de shaders WebGL et ISF dans l'écosystème **Wam Jam Party**. L'objectif est de créer un environnement 3D immersif (WebXR) où les visuels réagissent en temps réel au flux audio via le framework **Web Audio Modules (WAM)**.

## 📂 Structure du Projet

Le projet est divisé en plusieurs modules complémentaires :

### 1. [video_babylonjs](./src/plugins/video_babylonjs) (Moteur 3D & Plugin WAM)

- **Rôle** : Plugin WAM utilisant **Babylon.js** pour générer une scène 3D.
- **Fonctionnalités** :
    - Capture de textures WebGL externes (provenant du renderer ISF).
    - Réactivité audio temps réel via l'analyse FFT.
    - Infrastructure compatible avec le séquenceur de Tom Burns.

### 2. [isf-shader-renderer](./src/isf-shader-renderer) (Générateur ISF)

- **Rôle** : Fournir une pipeline de rendu pour les shaders interactifs.
- **Fonctionnalités** : Bridge audio-réactif intégré et exposition de la texture de sortie pour le moteur 3D.

### 3. [isf-sampler-adel](./src/isf-sampler-adel) (Hôte Séquenceur)

Une implémentation d'un séquenceur audio-visuel complet.
- **Rôle** : Interface de contrôle pour déclencher des sons et des visuels.
- **Fonctionnalités** : Step-séquenceur 16 pas, gestion de presets de batterie et chaînage de shaders.

### 4. [babylonjs_shaders_example](./src/babylonjs_shaders_example) (Recherche)

Dossier contenant les premières expérimentations sur les shaders.
- **Rôle** : Prototypes de ShaderMaterial et ProceduralTextures sur des mèches Babylon.js.
