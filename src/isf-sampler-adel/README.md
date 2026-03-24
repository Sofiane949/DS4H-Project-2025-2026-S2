<<<<<<< HEAD
# DS4H-Project-2025-2026-S2
=======
# ISF Renderer

Rendu de shaders ISF (Interactive Shader Format) avec sequenceur audio-reactif et chainage de shaders.

## Prerequis

- **Node.js** v18+
- **npm**

## Installation

```bash
cd isf-renderer
npm install
```

## Lancement

```bash
npm run dev
```

Le serveur demarre sur **http://localhost:8080**.

## Pages

| Page | URL | Description |
|------|-----|-------------|
| **Chainage** | `/index.html` | Demo du chainage de shaders (un shader alimente un autre) |
| **Audio** | `/audio.html` | Shader reactif a des sources audio generees (bass, arp, beat, noise, micro) |
| **Sequenceur** | `/sequencer.html` | Step sequenceur 16 steps avec shader audio-reactif |

La navbar en haut de chaque page permet de naviguer entre les trois.

## Sequenceur (`/sequencer.html`)

1. **Choisir un kit** dans le menu deroulant (808, Electronic, Hip-Hop, Basic Kit, Steveland Vinyl)
2. **Activer des steps** en cliquant sur les cellules de la grille
3. **Play** pour lancer la boucle — le shader reagit aux sons en temps reel
4. **BPM** ajustable via le slider (40–240)
5. **Mappings** : chaque parametre du shader peut etre mappe a une bande audio (bass, mid, treble, rms, peak)
6. **Clic droit** sur une cellule = previsualisation du son

## Structure du projet

```
isf-renderer/
├── server.js            # Serveur Express (API presets + fichiers statiques)
├── index.html           # Page chainage de shaders
├── audio.html           # Page audio-reactivite
├── sequencer.html       # Page sequenceur
├── isf-renderer.js      # Web Component <isf-renderer>
├── isf-parser.js        # Parseur de metadonnees ISF
├── isf-knob.js          # Composant knob
├── isf-switch.js        # Composant switch
├── audio-engine.js      # Moteur audio (sources generees + micro)
├── sampler-engine.js    # Moteur sampler (lecture de presets WAV)
├── sequencer.js         # Step sequenceur (encapsule SamplerEngine)
├── navbar.js            # Composant <app-navbar>
├── preset-api.js        # Client API pour les presets shader
├── shaders/             # Fichiers shader ISF (.fs)
├── data/                # Presets sauvegardes (presets.json)
└── AngularSamplerAudio/ # Projet source avec les sons
    └── sampler-main/
        └── presets/     # Kits de batterie (808, electronic, hip-hop, etc.)
```

## API REST

| Methode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/presets` | Liste tous les presets shader sauvegardes |
| `POST` | `/api/presets` | Cree un preset `{ name, shader, params }` |
| `PUT` | `/api/presets/:id` | Met a jour un preset |
| `DELETE` | `/api/presets/:id` | Supprime un preset |

## Technologies

- **Vanilla JS** (ES Modules, Web Components, Shadow DOM)
- **WebGL 2** / GLSL 300 es
- **Web Audio API** (AnalyserNode, AudioContext)
- **Express** (serveur backend)
>>>>>>> 4801fab (docs: ajout du README avec instructions de lancement)
