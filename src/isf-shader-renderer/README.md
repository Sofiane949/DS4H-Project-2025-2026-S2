# ISF Shader Renderer (Prototype)

Prototype Web Component Vanilla JS pour:
- charger un shader ISF externe,
- parser les INPUTS et generer une UI dynamique,
- afficher les erreurs de compilation dans une console scrollable,
- connecter l'audio (AnalyserNode) et injecter des uniforms audio en temps reel,
- regler la sensibilite audio (gain) et le lissage en direct,
- visualiser l'activite audio via bargraph (level/lows/mids/highs),
- editer des mappings audio -> uniforms depuis l'UI,
- chainer vers un canvas externe ou un autre composant.

## Fichiers

- `index.html`: demo locale
- `isf-shader-renderer.js`: composant web
- `isf-audio-features-processor.js`: AudioWorklet pour extraire `level/lows/mids/highs`
- `webaudio-knob.js`: mini Web Component `webaudio-knob` (rotation drag + double-click reset)
- `shaders/audio-grid-3d.fs`: shader ISF audio-reactif d'exemple

## Lancer

Depuis `DS4H-Project-2025-2026-S2/isf-shader-renderer`:

```bash
python3 -m http.server 8080
```

Puis ouvrir:

- `http://localhost:8080/`

## API du composant

```js
const renderer = document.querySelector("isf-shader-renderer");

renderer.connectAudio(htmlAudioElementOrAudioNode);
await renderer.resumeAudio();

renderer.connect("#targetCanvas");
// ou
renderer.connect(otherIsfRenderer);

renderer.setAudioMappings([
  { source: "lows", target: "audioLows", amount: 1.2, bias: 0, min: 0, max: 1, invert: false },
]);

// Chaînage GPU: composant A -> composant B
// B lit la texture de sortie de A comme input sampler2D (sans drawImage CPU).
componentA.connect(componentB);
```

## Notes

- Les presets custom sont stockes en localStorage (source shader + mappings + config audio).
- Les presets par defaut sont declares en dur dans `isf-shader-renderer.js`.
- Le parsing ISF lit le bloc metadata `/*{ ... }*/` puis compile le fragment restant.
- Le composant utilise un AudioWorklet pour les features audio, avec fallback `AnalyserNode` si indisponible.
- Le chaînage GPU direct entre composants exige le meme contexte WebGL entre producer/consumer.
