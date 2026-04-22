# DS4H - Projet : Wam Jam Party & ISF/WebGL Shaders Integration

**Équipe :** Khourta Sofiane, Benyahia Amir, El Moussaoui Adel

Ce dépôt regroupe les composants logiciels développés pour l'intégration de shaders WebGL et ISF (Interactive Shader Format) dans l'écosystème **Wam Jam Party**. L'objectif est de créer un environnement interactif où les visuels réagissent en temps réel au flux audio via le framework **Web Audio Modules (WAM)** et l'extension **Video**.

## Déploiement

Le plugin ISF Video WAM est actuellement hébergé à l'adresse suivante (pour chargement dans un hôte WAM) :
[**ISF Video Shader WAM**](https://sofiane949.github.io/DS4H-Project-2025-2026-S2/src/isf-video-wam/index.js)

## Structure du Projet

Le projet est divisé en plusieurs modules complémentaires :

### 1. [src/isf-video-wam](./src/isf-video-wam) (Plugin WAM ISF Principal - En cours)
- **Rôle** : Plugin WAM 2D permettant d'exécuter des shaders au format **ISF**.
- **Fonctionnalités** : 
    - Support complet de l'extension **Video** pour le chaînage et le rendu.
    - Réactivité audio dynamique (Gain, Pulse) mappée sur les uniformes du shader.
    - Bibliothèque intégrée de 11 shaders (Kaleidoscope, Pixelate, RGB Shift, Edges, etc.).
    - Interface GUI interactive pour le contrôle des paramètres en temps réel.

### 2. [src/plugins/video_babylonjs](./src/plugins/video_babylonjs) (Moteur 3D & Plugin WAM)
- **Rôle** : Plugin WAM utilisant **Babylon.js** pour générer une scène 3D réactive.
- **Fonctionnalités** : 
    - Capture de textures WebGL externes (provenant du renderer ISF).
    - Réactivité audio temps réel via l'analyse FFT.
    - Projection de flux vidéo sur des mèches 3D spatialisées.

### 3. [src/isf-sampler-adel](./src/isf-sampler-adel) (Hôte Séquenceur & Sampler)
- **Rôle** : Interface de contrôle (Hôte) pour déclencher des sons et des visuels.
- **Fonctionnalités** : 
    - **Step-Séquenceur 16 pas** avec gestion de kits de batterie (808, Hip-Hop, etc.).
    - **Moteur de Sampler** audio-réactif.
    - Système de navigation pour basculer entre le chaînage, l'audio et le séquenceur.
    - API REST via Express pour la persistance des presets.

### 4. [src/isf-shader-renderer](./src/isf-shader-renderer) (Générateur ISF Core)
- **Rôle** : Fournir une pipeline de rendu robuste pour les shaders interactifs.
- **Fonctionnalités** : 
    - Parseur de métadonnées ISF.
    - **Audio-Reactive Bridge** pour mapper les bandes de fréquences (Lows, Mids, Highs) sur les shaders.
    - Exposition de la texture de sortie (`WebGLTexture`) pour intégration dans Babylon.js.

### 5. [src/babylonjs_shaders_example](./src/babylonjs_shaders_example) (Recherche)
- **Rôle** : Prototypes initiaux sur les `ShaderMaterial` et `ProceduralTextures` dans Babylon.js.


---
*Projet réalisé dans le cadre du Master 1 Informatique 2025-2026 - Web Technologies - DS4H.*
