# ISF Video Shader WAM

Ce projet est un plugin **Web Audio Module (WAM)** de traitement vidéo 2D utilisant le format **ISF (Interactive Shader Format)**. Il permet d'appliquer des effets visuels en temps réel sur un flux vidéo, avec une réactivité basée sur le signal audio entrant.

## Liens utiles

- **URL du plugin :** [https://sofiane949.github.io/DS4H-Project-2025-2026-S2/src/isf-video-wam/index.js](https://sofiane949.github.io/DS4H-Project-2025-2026-S2/src/isf-video-wam/index.js)

## Caractéristiques

- **Traitement Vidéo ISF :** Utilise des shaders de fragments (GLSL) pour transformer la vidéo.
- **Réactivité Audio :** Analyse le niveau RMS du signal audio pour piloter des paramètres visuels dynamiquement.
- **Chaînage Vidéo :** Supporte les entrées et sorties vidéo via l'extension `WAMExtensions.video`, permettant de combiner ce plugin avec d'autres modules vidéo.
- **Sélection de Shaders :** 11 effets pré-configurés interchangeables en temps réel.
- **Contrôle Paramétrique :** Nombreux réglages exposés (vitesse, distorsion, grain, lignes de balayage, luminosité, contraste, saturation).

## Shaders inclus

Le plugin embarque une collection de shaders variés :
- `default.fs` : Effet de base / Passthrough.
- `kaleidoscope.fs` : Effet kaléidoscope symétrique.
- `rgb_shift.fs` : Décalage chromatique des couches R, G et B.
- `pixelate.fs` : Pixellisation de l'image.
- `mirror.fs` : Effet miroir (horizontal/vertical).
- `wave.fs` : Distorsion de vague sinusoïdale.
- `negative.fs` : Inversion des couleurs.
- `hue_pulse.fs` : Cycle de couleurs pulsé par l'audio.
- `edges.fs` : Détection de contours.
- `radial_blur.fs` : Flou radial centré.
- `posterize.fs` : Réduction de la palette de couleurs (effet poster).

## Paramètres

Le plugin expose les paramètres suivants via l'API WAM :
- **Shader Select** : Sélectionne l'effet actif.
- **Speed** : Vitesse d'animation du shader.
- **Noise Level** : Intensité du grain/bruit.
- **Distortion 1 & 2** : Contrôles de déformation spécifiques au shader.
- **Scanlines** : Épaisseur, intensité et décalage des lignes de balayage type CRT.
- **Audio Reactivity** : Gain et pulse audio pour ajuster l'influence du son sur l'image.
- **Color Correction** : Luminosité, contraste et saturation.

## Structure du projet

- `index.js` : Point d'entrée principal (classe `ISFVideoPlugin`).
- `Node.js` : Gestion de l'audio et de l'analyse RMS (classe `ISFVideoNode`).
- `Gui.js` : Interface utilisateur graphique personnalisée.
- `ISFParser.js` & `ISFRenderer.js` : Moteur de rendu GLSL compatible avec le standard ISF.
- `shaders/` : Dossier contenant les fichiers `.fs` des effets visuels.
- `descriptor.json` : Métadonnées du plugin (nom, version, auteur).

## Utilisation

1. Importez le plugin dans un hôte compatible WAM.
2. Connectez une source audio pour activer la réactivité visuelle.
3. Connectez une source vidéo (webcam ou fichier) pour appliquer les effets.
4. Utilisez l'interface graphique pour naviguer entre les shaders et ajuster les paramètres.

---
Développé par (2025-2026) dans le cadre du projet DS4H.
