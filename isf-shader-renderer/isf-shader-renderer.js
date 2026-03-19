const DEFAULT_VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

import "./webaudio-knob.js";

const PRESENT_FRAGMENT_SHADER = `
precision highp float;
uniform sampler2D u_texture;
varying vec2 v_uv;

void main() {
  gl_FragColor = texture2D(u_texture, v_uv);
}
`;

const QUAD = new Float32Array([
  -1, -1,
  1, -1,
  -1, 1,
  1, -1,
  1, 1,
  -1, 1,
]);

const BUILTIN_PRESETS = [
  {
    name: "audio-grid-3d",
    path: "./shaders/audio-grid-3d.fs",
  },
];

const STORAGE_KEY = "ds4h-isf-presets";
const AUDIO_FEATURES_WORKLET_NAME = "isf-audio-features-processor";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function parseISFMetadata(source) {
  const match = source.match(/\/\*\s*\{[\s\S]*?\}\s*\*\//);
  if (!match) {
    return { metadata: { INPUTS: [] }, shaderCode: source };
  }

  const jsonText = match[0].replace(/^\/\*/, "").replace(/\*\/$/, "");
  const metadata = JSON.parse(jsonText);
  const shaderCode = source.slice(match.index + match[0].length);

  return { metadata, shaderCode };
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || "Erreur de compilation shader inconnue";
    gl.deleteShader(shader);
    throw new Error(log);
  }

  return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) || "Erreur de link shader inconnue";
    gl.deleteProgram(program);
    throw new Error(log);
  }

  return program;
}

class AudioReactiveBridge {
  constructor() {
    this.context = null;
    this.analyser = null;
    this.workletNode = null;
    this.workletFeatures = null;
    this.engineInitPromise = null;
    this.useWorklet = false;
    this.useAnalyserFallback = false;
    this.mediaSource = null;
    this.sourceNodes = [];
    this.freqData = null;
    this.timeData = null;
    this.state = {
      level: 0,
      lows: 0,
      mids: 0,
      highs: 0,
    };
    this.config = {
      gain: 3.0,
      smoothing: 0.35,
      analyserSmoothing: 0.55,
      curve: 0.6,
      featureRate: 60,
      attack: 0.45,
      release: 0.08,
    };
  }

  attachElement(element) {
    if (!this.context) {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (!this.mediaSource) {
      this.mediaSource = this.context.createMediaElementSource(element);
      this.mediaSource.connect(this.context.destination);
    }

    this.attachNode(this.mediaSource);
  }

  attachNode(sourceNode) {
    if (!sourceNode) {
      return;
    }

    if (!this.context) {
      this.context = sourceNode.context;
    }

    if (!this.sourceNodes.includes(sourceNode)) {
      this.sourceNodes.push(sourceNode);
    }

    this.ensureEngine();

    if (this.useWorklet && this.workletNode) {
      sourceNode.connect(this.workletNode);
      return;
    }

    if (!this.analyser) {
      this.initAnalyserFallback();
    }

    sourceNode.connect(this.analyser);
  }

  ensureEngine() {
    if (this.engineInitPromise || !this.context) {
      return;
    }
    this.engineInitPromise = this.initEngine();
  }

  async initEngine() {
    try {
      if (!this.context.audioWorklet) {
        throw new Error("AudioWorklet indisponible");
      }

      const workletUrl = new URL("./isf-audio-features-processor.js", import.meta.url);
      await this.context.audioWorklet.addModule(workletUrl);

      this.workletNode = new AudioWorkletNode(this.context, AUDIO_FEATURES_WORKLET_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 0,
      });

      this.workletNode.port.onmessage = (event) => {
        if (event.data && event.data.type === "features") {
          this.workletFeatures = event.data.features;
        }
      };

      this.workletNode.port.postMessage({
        type: "config",
        config: {
          gain: this.config.gain,
          curve: this.config.curve,
          featureRate: this.config.featureRate,
          attack: this.config.attack,
          release: this.config.release,
        },
      });

      this.useWorklet = true;

      this.sourceNodes.forEach((sourceNode) => {
        sourceNode.connect(this.workletNode);
      });
    } catch (_error) {
      this.useWorklet = false;
      this.initAnalyserFallback();
      this.sourceNodes.forEach((sourceNode) => {
        sourceNode.connect(this.analyser);
      });
    }
  }

  initAnalyserFallback() {
    if (this.analyser || !this.context) {
      return;
    }

    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = this.config.analyserSmoothing;
    this.analyser.minDecibels = -100;
    this.analyser.maxDecibels = -10;

    this.freqData = new Float32Array(this.analyser.frequencyBinCount);
    this.timeData = new Float32Array(this.analyser.fftSize);
    this.useAnalyserFallback = true;
  }

  async resume() {
    if (this.context && this.context.state !== "running") {
      await this.context.resume();
    }
  }

  setConfig(nextConfig = {}) {
    this.config = {
      ...this.config,
      ...nextConfig,
    };

    if (this.analyser) {
      this.analyser.smoothingTimeConstant = clamp(this.config.analyserSmoothing, 0, 0.99);
    }

    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: "config",
        config: {
          gain: this.config.gain,
          curve: this.config.curve,
          featureRate: this.config.featureRate,
          attack: this.config.attack,
          release: this.config.release,
        },
      });
    }
  }

  sample() {
    if (this.useWorklet && this.workletFeatures) {
      const smooth = clamp(Number(this.config.smoothing), 0.01, 1);
      this.state.level = lerp(this.state.level, this.workletFeatures.level || 0, smooth);
      this.state.lows = lerp(this.state.lows, this.workletFeatures.lows || 0, smooth);
      this.state.mids = lerp(this.state.mids, this.workletFeatures.mids || 0, smooth);
      this.state.highs = lerp(this.state.highs, this.workletFeatures.highs || 0, smooth);
      return this.state;
    }

    if (!this.analyser || !this.freqData || !this.timeData) {
      return this.state;
    }

    // Fallback path if AudioWorklet is not available.
    this.analyser.getFloatFrequencyData(this.freqData);
    this.analyser.getFloatTimeDomainData(this.timeData);

    const boost = (value) => clamp(Math.pow(clamp(value, 0, 1), this.config.curve), 0, 1);

    const level = boost(this.computeRms(this.timeData));
    const lows = boost(this.bandEnergy(20, 200));
    const mids = boost(this.bandEnergy(200, 2000));
    const highs = boost(this.bandEnergy(2000, 8000));

    const smooth = clamp(Number(this.config.smoothing), 0.01, 1);
    this.state.level = lerp(this.state.level, level, smooth);
    this.state.lows = lerp(this.state.lows, lows, smooth);
    this.state.mids = lerp(this.state.mids, mids, smooth);
    this.state.highs = lerp(this.state.highs, highs, smooth);

    return this.state;
  }

  computeRms(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i += 1) {
      const v = buffer[i];
      sum += v * v;
    }
    const gain = Number(this.config.gain) || 1;
    return clamp(Math.sqrt(sum / buffer.length) * gain, 0, 1);
  }

  bandEnergy(minHz, maxHz) {
    const nyquist = this.context.sampleRate * 0.5;
    const maxBin = this.freqData.length - 1;
    const start = clamp(Math.floor((minHz / nyquist) * maxBin), 0, maxBin);
    const end = clamp(Math.ceil((maxHz / nyquist) * maxBin), 0, maxBin);

    let sum = 0;
    let count = 0;
    for (let i = start; i <= end; i += 1) {
      const db = this.freqData[i];
      const lin = Math.pow(10, db / 20);
      sum += lin;
      count += 1;
    }

    if (!count) {
      return 0;
    }

    const gain = Number(this.config.gain) || 1;
    return clamp((sum / count) * gain, 0, 1);
  }
}

class ISFShaderRenderer extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: "open" });
    this.width = Number(this.getAttribute("width")) || 960;
    this.height = Number(this.getAttribute("height")) || 540;

    this.audioBridge = new AudioReactiveBridge();
    this.audioConfig = {
      gain: 3.0,
      smoothing: 0.35,
      analyserSmoothing: 0.55,
      curve: 0.6,
    };
    this.audioBridge.setConfig(this.audioConfig);
    this.manualUniformValues = {};
    this.smoothedUniformValues = {};
    this.audioMappedTargets = new Set();
    this.uniformSlew = {
      rise: 0.38,
      fall: 0.12,
    };
    this.uniformLocations = new Map();
    this.uniformTypes = new Map();
    this.mappings = [
      { source: "lows", target: "audioLows", amount: 1.8, bias: 0, min: 0, max: 1, invert: false },
      { source: "mids", target: "audioMids", amount: 1.5, bias: 0, min: 0, max: 1, invert: false },
      { source: "highs", target: "audioHighs", amount: 1.35, bias: 0, min: 0, max: 1, invert: false },
    ];

    this.inputTexture = null;
    this.inputFrameProvider = null;
    this.inputProviderError = "";
    this.connectedTarget = null;
    this.targetCanvas = null;
    this.micStream = null;
    this.micSourceNode = null;
    this.micActive = false;
    this.renderRequest = 0;
    this.startTime = performance.now();

    this.initDOM();
    this.initGL();
  }

  static get observedAttributes() {
    return ["shader"];
  }

  connectedCallback() {
    const shaderPath = this.getAttribute("shader") || BUILTIN_PRESETS[0].path;
    this.loadShader(shaderPath);
    this.startRenderLoop();
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.renderRequest);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "shader" && oldValue !== newValue && newValue) {
      this.loadShader(newValue);
    }
  }

  initDOM() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          border: 1px solid #cbd4ca;
          border-radius: 14px;
          background: #f7faf7;
          overflow: hidden;
          font-family: "Segoe UI", Tahoma, sans-serif;
        }

        .root {
          display: grid;
          grid-template-columns: 280px 1fr;
          min-height: 620px;
        }

        .panel {
          border-right: 1px solid #d7ded5;
          display: grid;
          grid-template-rows: auto auto auto 1fr auto;
          min-width: 0;
        }

        .section {
          padding: 10px;
          border-bottom: 1px solid #e2e8df;
        }

        .section h3 {
          margin: 0 0 8px;
          font-size: 13px;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: #3a4f3f;
        }

        .row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }

        select,
        input,
        textarea,
        button {
          width: 100%;
          box-sizing: border-box;
          font: inherit;
          padding: 8px;
          border-radius: 8px;
          border: 1px solid #b9c6ba;
          background: #fff;
        }

        textarea {
          min-height: 140px;
          resize: vertical;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 12px;
          line-height: 1.4;
        }

        .buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .params {
          max-height: 190px;
          overflow: auto;
          display: grid;
          gap: 8px;
          padding-right: 4px;
        }

        .param {
          display: grid;
          gap: 4px;
        }

        .param label {
          font-size: 12px;
        }

        .canvas-wrap {
          display: grid;
          grid-template-rows: 1fr 140px;
          min-height: 0;
        }

        canvas {
          width: 100%;
          height: 100%;
          background: #060808;
          display: block;
        }

        .error-console {
          border-top: 1px solid #d7ded5;
          background: #101513;
          color: #d5e9dc;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 12px;
          padding: 10px;
          overflow: auto;
          white-space: pre-wrap;
        }

        .small {
          font-size: 12px;
          color: #45614f;
        }

        .audio-bars {
          display: grid;
          gap: 6px;
          margin-top: 8px;
        }

        .bar-row {
          display: grid;
          grid-template-columns: 48px 1fr;
          gap: 8px;
          align-items: center;
        }

        .bar-label {
          font-size: 11px;
          color: #3f5a49;
        }

        .bar-track {
          height: 8px;
          background: #d6e0d6;
          border-radius: 999px;
          overflow: hidden;
        }

        .bar-fill {
          height: 100%;
          width: 0%;
          background: linear-gradient(90deg, #0f766e, #22d3ee);
          transition: width 60ms linear;
        }

        .mapping-list {
          display: grid;
          gap: 8px;
          max-height: 180px;
          overflow: auto;
        }

        .mapping-row {
          border: 1px solid #d3ddd3;
          border-radius: 8px;
          padding: 8px;
          display: grid;
          gap: 6px;
          background: #fdfefd;
        }

        .mapping-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }

        .mapping-grid-3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 6px;
        }

        .mapping-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .mic-indicator {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 6px;
          padding: 4px 8px;
          border: 1px solid #c8d6c8;
          border-radius: 999px;
          background: #f2f7f2;
          font-size: 11px;
          color: #48624f;
        }

        .mic-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #93a59a;
          transition: background 120ms linear, box-shadow 120ms linear;
        }

        .mic-indicator.on .mic-dot {
          background: #10b981;
          box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2);
        }
      </style>
      <div class="root">
        <div class="panel">
          <div class="section row">
            <h3>Presets</h3>
            <select id="presetSelect"></select>
            <input id="presetName" placeholder="Nom preset" />
            <div class="buttons">
              <button id="savePreset">Sauver</button>
              <button id="deletePreset">Supprimer</button>
            </div>
          </div>

          <div class="section row">
            <h3>Shader Source</h3>
            <textarea id="shaderSource"></textarea>
            <div class="buttons">
              <button id="compileBtn">Compiler</button>
              <button id="reloadBtn">Recharger fichier</button>
            </div>
          </div>

          <div class="section">
            <h3>Parametres Dynamiques</h3>
            <div id="params" class="params"></div>
          </div>

          <div class="section">
            <h3>Audio Map</h3>
            <div class="small" id="audioState">level: 0.00 / lows: 0.00 / mids: 0.00 / highs: 0.00</div>
            <div class="audio-bars" id="audioBars">
              <div class="bar-row"><div class="bar-label">level</div><div class="bar-track"><div class="bar-fill" data-bar="level"></div></div></div>
              <div class="bar-row"><div class="bar-label">lows</div><div class="bar-track"><div class="bar-fill" data-bar="lows"></div></div></div>
              <div class="bar-row"><div class="bar-label">mids</div><div class="bar-track"><div class="bar-fill" data-bar="mids"></div></div></div>
              <div class="bar-row"><div class="bar-label">highs</div><div class="bar-track"><div class="bar-fill" data-bar="highs"></div></div></div>
            </div>
            <div class="mapping-grid" style="margin-top:8px;">
              <label class="small">Gain
                <input id="audioGain" type="range" min="0.2" max="4" step="0.01" />
              </label>
              <label class="small">Smoothing
                <input id="audioSmoothing" type="range" min="0.01" max="1" step="0.01" />
              </label>
            </div>
            <div class="small" id="audioConfigLabel"></div>
            <div class="mic-indicator" id="micIndicator"><span class="mic-dot"></span><span id="micIndicatorLabel">MIC OFF</span></div>
            <div style="margin-top: 10px;">
              <div class="mapping-footer" style="margin-bottom:6px;">
                <div class="small" style="font-weight:600;">Mappings</div>
                <button id="addMapping" style="width:auto; padding:4px 8px;">+ Ajouter</button>
              </div>
              <div id="mappingList" class="mapping-list"></div>
            </div>
          </div>

          <div class="section">
            <h3>Connect</h3>
            <div class="small">connect(target): canvas, selector CSS ou autre composant isf-shader-renderer.</div>
          </div>
        </div>

        <div class="canvas-wrap">
          <canvas id="canvas" width="${this.width}" height="${this.height}"></canvas>
          <div id="console" class="error-console">Console prete.</div>
        </div>
      </div>
    `;

    this.canvas = this.shadowRoot.getElementById("canvas");
    this.consoleNode = this.shadowRoot.getElementById("console");
    this.paramsNode = this.shadowRoot.getElementById("params");
    this.audioStateNode = this.shadowRoot.getElementById("audioState");
    this.presetSelect = this.shadowRoot.getElementById("presetSelect");
    this.presetNameInput = this.shadowRoot.getElementById("presetName");
    this.sourceInput = this.shadowRoot.getElementById("shaderSource");
    this.audioGainInput = this.shadowRoot.getElementById("audioGain");
    this.audioSmoothingInput = this.shadowRoot.getElementById("audioSmoothing");
    this.audioConfigLabel = this.shadowRoot.getElementById("audioConfigLabel");
    this.micIndicatorNode = this.shadowRoot.getElementById("micIndicator");
    this.micIndicatorLabel = this.shadowRoot.getElementById("micIndicatorLabel");
    this.mappingListNode = this.shadowRoot.getElementById("mappingList");
    this.audioBarNodes = {
      level: this.shadowRoot.querySelector('[data-bar="level"]'),
      lows: this.shadowRoot.querySelector('[data-bar="lows"]'),
      mids: this.shadowRoot.querySelector('[data-bar="mids"]'),
      highs: this.shadowRoot.querySelector('[data-bar="highs"]'),
    };

    this.syncAudioControls();
    this.updateMicIndicator();

    this.shadowRoot.getElementById("compileBtn").addEventListener("click", () => {
      this.compileFromEditor();
    });

    this.shadowRoot.getElementById("reloadBtn").addEventListener("click", () => {
      const shaderPath = this.getAttribute("shader");
      if (shaderPath) {
        this.loadShader(shaderPath);
      }
    });

    this.shadowRoot.getElementById("savePreset").addEventListener("click", () => {
      this.savePreset();
    });

    this.shadowRoot.getElementById("deletePreset").addEventListener("click", () => {
      this.deletePreset();
    });

    this.presetSelect.addEventListener("change", async (event) => {
      const value = event.target.value;
      await this.loadPreset(value);
    });

    this.audioGainInput.addEventListener("input", () => {
      this.audioConfig.gain = Number(this.audioGainInput.value);
      this.audioBridge.setConfig(this.audioConfig);
      this.updateAudioConfigLabel();
    });

    this.audioSmoothingInput.addEventListener("input", () => {
      this.audioConfig.smoothing = Number(this.audioSmoothingInput.value);
      this.audioBridge.setConfig(this.audioConfig);
      this.updateAudioConfigLabel();
    });

    this.shadowRoot.getElementById("addMapping").addEventListener("click", () => {
      this.addMapping();
    });

    this.populatePresetSelect();
    this.buildMappingControls();
  }

  initGL() {
    this.gl = this.canvas.getContext("webgl", { premultipliedAlpha: false, antialias: true });
    if (!this.gl) {
      this.pushError("WebGL indisponible dans ce navigateur.");
      return;
    }

    const gl = this.gl;

    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);

    this.presentProgram = createProgram(gl, DEFAULT_VERTEX_SHADER, PRESENT_FRAGMENT_SHADER);
    this.presentTextureLoc = gl.getUniformLocation(this.presentProgram, "u_texture");
    this.presentPosLoc = gl.getAttribLocation(this.presentProgram, "a_position");

    this.outputFramebuffer = gl.createFramebuffer();
    this.outputTexture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, this.outputTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.outputFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.outputTexture, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  async loadShader(path) {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Impossible de charger le shader: ${path}`);
      }

      this.currentShaderPath = path;
      const source = await response.text();
      this.sourceInput.value = source;
      this.compileShaderSource(source);
      this.pushInfo(`Shader charge: ${path}`);
    } catch (error) {
      this.pushError(error.message || String(error));
    }
  }

  compileFromEditor() {
    this.compileShaderSource(this.sourceInput.value);
  }

  compileShaderSource(source) {
    if (!this.gl) {
      return;
    }

    let metadata;
    let shaderBody;

    try {
      const parsed = parseISFMetadata(source);
      metadata = parsed.metadata;
      shaderBody = parsed.shaderCode;
    } catch (error) {
      this.pushError(`Erreur parse metadata ISF: ${error.message || error}`);
      return;
    }

    const gl = this.gl;

    if (this.shaderProgram) {
      gl.deleteProgram(this.shaderProgram);
      this.shaderProgram = null;
    }

    try {
      this.metadata = metadata || { INPUTS: [] };
      this.inputs = Array.isArray(this.metadata.INPUTS) ? this.metadata.INPUTS : [];

      const fragment = this.wrapFragment(shaderBody, this.inputs);
      this.shaderProgram = createProgram(gl, DEFAULT_VERTEX_SHADER, fragment);
      this.positionLoc = gl.getAttribLocation(this.shaderProgram, "a_position");

      this.uniformLocations.clear();
      this.uniformTypes.clear();

      this.inputs.forEach((entry) => {
        const location = gl.getUniformLocation(this.shaderProgram, entry.NAME);
        this.uniformLocations.set(entry.NAME, location);
        this.uniformTypes.set(entry.NAME, entry.TYPE);

        if (this.manualUniformValues[entry.NAME] === undefined) {
          this.manualUniformValues[entry.NAME] = this.defaultInputValue(entry);
        }
      });

      this.timeLocation = gl.getUniformLocation(this.shaderProgram, "TIME");
      this.sizeLocation = gl.getUniformLocation(this.shaderProgram, "RENDERSIZE");
      this.inputImageLocation = gl.getUniformLocation(this.shaderProgram, "inputImage");

      const allowedTargets = new Set(this.getMappableUniforms());
      this.mappings = this.mappings.filter((m) => allowedTargets.has(m.target));

      this.buildDynamicControls();
      this.buildMappingControls();
      this.pushInfo("Compilation shader OK.");
    } catch (error) {
      this.pushError(`Erreur compilation shader:\n${error.message || String(error)}`);
    }
  }

  wrapFragment(shaderBody, inputs) {
    const declaredUniforms = new Set();
    const uniformRegex = /uniform\s+\w+\s+(\w+)\s*;/g;
    let match = uniformRegex.exec(shaderBody);
    while (match) {
      declaredUniforms.add(match[1]);
      match = uniformRegex.exec(shaderBody);
    }

    const uniforms = [];
    if (!/precision\s+(lowp|mediump|highp)\s+float\s*;/.test(shaderBody)) {
      uniforms.push("precision highp float;");
    }
    if (!declaredUniforms.has("RENDERSIZE")) {
      uniforms.push("uniform vec2 RENDERSIZE;");
    }
    if (!declaredUniforms.has("TIME")) {
      uniforms.push("uniform float TIME;");
    }

    for (const input of inputs || []) {
      if (!input || !input.NAME || declaredUniforms.has(input.NAME)) {
        continue;
      }

      if (input.TYPE === "float") {
        uniforms.push(`uniform float ${input.NAME};`);
      } else if (input.TYPE === "bool" || input.TYPE === "event") {
        uniforms.push(`uniform bool ${input.NAME};`);
      } else if (input.TYPE === "long") {
        uniforms.push(`uniform int ${input.NAME};`);
      } else if (input.TYPE === "color") {
        uniforms.push(`uniform vec4 ${input.NAME};`);
      } else if (input.TYPE === "point2D") {
        uniforms.push(`uniform vec2 ${input.NAME};`);
      } else if (input.TYPE === "image") {
        uniforms.push(`uniform sampler2D ${input.NAME};`);
      }
    }

    if (!uniforms.length) {
      return shaderBody;
    }

    return `${uniforms.join("\n")}\n\n${shaderBody}`;
  }

  defaultInputValue(input) {
    if (input.DEFAULT !== undefined) {
      return input.DEFAULT;
    }

    if (input.TYPE === "float") {
      return input.MIN !== undefined ? input.MIN : 0;
    }

    if (input.TYPE === "bool" || input.TYPE === "event") {
      return false;
    }

    if (input.TYPE === "long") {
      return 0;
    }

    if (input.TYPE === "color") {
      return [0, 0, 0, 1];
    }

    if (input.TYPE === "point2D") {
      return [0.5, 0.5];
    }

    return 0;
  }

  syncAudioControls() {
    if (!this.audioGainInput || !this.audioSmoothingInput) {
      return;
    }
    this.audioGainInput.value = String(this.audioConfig.gain);
    this.audioSmoothingInput.value = String(this.audioConfig.smoothing);
    this.updateAudioConfigLabel();
  }

  updateAudioConfigLabel() {
    if (!this.audioConfigLabel) {
      return;
    }
    this.audioConfigLabel.textContent = `gain: ${this.audioConfig.gain.toFixed(2)} / smoothing: ${this.audioConfig.smoothing.toFixed(2)}`;
  }

  updateMicIndicator() {
    if (!this.micIndicatorNode || !this.micIndicatorLabel) {
      return;
    }
    if (this.micActive) {
      this.micIndicatorNode.classList.add("on");
      this.micIndicatorLabel.textContent = "MIC ON";
    } else {
      this.micIndicatorNode.classList.remove("on");
      this.micIndicatorLabel.textContent = "MIC OFF";
    }
  }

  getMappableUniforms() {
    return (this.inputs || []).filter((input) => input.TYPE === "float").map((input) => input.NAME);
  }

  addMapping() {
    const targets = this.getMappableUniforms();
    if (!targets.length) {
      this.pushError("Aucune uniform float disponible pour le mapping.");
      return;
    }

    this.mappings.push({
      source: "lows",
      target: targets[0],
      amount: 1,
      bias: 0,
      min: 0,
      max: 1,
      invert: false,
    });

    this.buildMappingControls();
  }

  buildMappingControls() {
    if (!this.mappingListNode) {
      return;
    }

    const targets = this.getMappableUniforms();
    this.mappingListNode.innerHTML = "";

    if (!targets.length) {
      const empty = document.createElement("div");
      empty.className = "small";
      empty.textContent = "Aucune uniform float detectee dans le shader.";
      this.mappingListNode.appendChild(empty);
      return;
    }

    this.mappings.forEach((mapping, index) => {
      const row = document.createElement("div");
      row.className = "mapping-row";

      const sourceSelect = document.createElement("select");
      ["level", "lows", "mids", "highs"].forEach((src) => {
        const opt = document.createElement("option");
        opt.value = src;
        opt.textContent = src;
        sourceSelect.appendChild(opt);
      });
      sourceSelect.value = mapping.source;

      const targetSelect = document.createElement("select");
      targets.forEach((target) => {
        const opt = document.createElement("option");
        opt.value = target;
        opt.textContent = target;
        targetSelect.appendChild(opt);
      });
      if (targets.includes(mapping.target)) {
        targetSelect.value = mapping.target;
      } else if (targets.length) {
        targetSelect.value = targets[0];
        mapping.target = targets[0];
      }

      const amountInput = document.createElement("input");
      amountInput.type = "number";
      amountInput.step = "0.01";
      amountInput.value = String(mapping.amount);

      const biasInput = document.createElement("input");
      biasInput.type = "number";
      biasInput.step = "0.01";
      biasInput.value = String(mapping.bias);

      const minInput = document.createElement("input");
      minInput.type = "number";
      minInput.step = "0.01";
      minInput.value = String(mapping.min);

      const maxInput = document.createElement("input");
      maxInput.type = "number";
      maxInput.step = "0.01";
      maxInput.value = String(mapping.max);

      const invertLabel = document.createElement("label");
      invertLabel.className = "small";
      const invertInput = document.createElement("input");
      invertInput.type = "checkbox";
      invertInput.checked = !!mapping.invert;
      invertLabel.append("Invert ", invertInput);

      const removeButton = document.createElement("button");
      removeButton.textContent = "Supprimer";
      removeButton.style.width = "auto";
      removeButton.style.padding = "4px 8px";

      const topGrid = document.createElement("div");
      topGrid.className = "mapping-grid";
      topGrid.append(sourceSelect, targetSelect);

      const bottomGrid = document.createElement("div");
      bottomGrid.className = "mapping-grid-3";
      bottomGrid.append(amountInput, biasInput, minInput);

      const extraGrid = document.createElement("div");
      extraGrid.className = "mapping-grid";
      extraGrid.append(maxInput, invertLabel);

      const footer = document.createElement("div");
      footer.className = "mapping-footer";
      const summary = document.createElement("div");
      summary.className = "small";
      summary.textContent = `map ${mapping.source} -> ${mapping.target}`;
      footer.append(summary, removeButton);

      sourceSelect.addEventListener("change", () => {
        mapping.source = sourceSelect.value;
        summary.textContent = `map ${mapping.source} -> ${mapping.target}`;
      });
      targetSelect.addEventListener("change", () => {
        mapping.target = targetSelect.value;
        summary.textContent = `map ${mapping.source} -> ${mapping.target}`;
      });
      amountInput.addEventListener("input", () => {
        mapping.amount = Number(amountInput.value);
      });
      biasInput.addEventListener("input", () => {
        mapping.bias = Number(biasInput.value);
      });
      minInput.addEventListener("input", () => {
        mapping.min = Number(minInput.value);
      });
      maxInput.addEventListener("input", () => {
        mapping.max = Number(maxInput.value);
      });
      invertInput.addEventListener("change", () => {
        mapping.invert = invertInput.checked;
      });
      removeButton.addEventListener("click", () => {
        this.mappings.splice(index, 1);
        this.buildMappingControls();
      });

      row.append(topGrid, bottomGrid, extraGrid, footer);
      this.mappingListNode.appendChild(row);
    });
  }

  buildDynamicControls() {
    this.paramsNode.innerHTML = "";

    for (const input of this.inputs) {
      if (input.TYPE === "image") {
        continue;
      }

      const wrapper = document.createElement("div");
      wrapper.className = "param";
      const label = document.createElement("label");
      label.textContent = input.NAME;
      wrapper.appendChild(label);

      if (input.TYPE === "float") {
        const knob = document.createElement("webaudio-knob");
        knob.setAttribute("min", String(input.MIN ?? 0));
        knob.setAttribute("max", String(input.MAX ?? 1));
        knob.setAttribute("default", String(input.DEFAULT ?? this.defaultInputValue(input)));
        knob.setAttribute("value", String(this.manualUniformValues[input.NAME] ?? this.defaultInputValue(input)));
        knob.setAttribute("size", "48");
        knob.setAttribute("color", "#22d3ee");
        knob.setAttribute("decimals", "3");

        const valueText = document.createElement("div");
        valueText.className = "small";
        valueText.textContent = Number(this.manualUniformValues[input.NAME] ?? this.defaultInputValue(input)).toFixed(3);

        knob.addEventListener("input", (event) => {
          const knobValue = Number(event.detail.value);
          this.manualUniformValues[input.NAME] = knobValue;
          valueText.textContent = knobValue.toFixed(3);
        });

        wrapper.appendChild(knob);
        wrapper.appendChild(valueText);
      } else if (input.TYPE === "bool" || input.TYPE === "event") {
        const toggle = document.createElement("input");
        toggle.type = "checkbox";
        toggle.checked = Boolean(this.manualUniformValues[input.NAME]);
        toggle.addEventListener("change", () => {
          this.manualUniformValues[input.NAME] = toggle.checked;
        });
        wrapper.appendChild(toggle);
      } else if (input.TYPE === "long") {
        const select = document.createElement("select");
        const labels = input.LABELS || input.VALUES || [];
        labels.forEach((entry, index) => {
          const option = document.createElement("option");
          option.value = String(index);
          option.textContent = String(entry);
          select.appendChild(option);
        });
        select.value = String(this.manualUniformValues[input.NAME] || 0);
        select.addEventListener("change", () => {
          this.manualUniformValues[input.NAME] = Number(select.value);
        });
        wrapper.appendChild(select);
      }

      this.paramsNode.appendChild(wrapper);
    }
  }

  startRenderLoop() {
    const renderFrame = () => {
      this.renderFrame();
      this.renderRequest = requestAnimationFrame(renderFrame);
    };
    this.renderRequest = requestAnimationFrame(renderFrame);
  }

  renderFrame() {
    if (!this.gl || !this.shaderProgram) {
      return;
    }

    const gl = this.gl;
    const now = (performance.now() - this.startTime) / 1000;

    const audio = this.audioBridge.sample();
    this.audioStateNode.textContent = `level: ${audio.level.toFixed(2)} / lows: ${audio.lows.toFixed(2)} / mids: ${audio.mids.toFixed(2)} / highs: ${audio.highs.toFixed(2)}`;
    if (this.audioBarNodes.level) {
      this.audioBarNodes.level.style.width = `${(audio.level * 100).toFixed(1)}%`;
      this.audioBarNodes.lows.style.width = `${(audio.lows * 100).toFixed(1)}%`;
      this.audioBarNodes.mids.style.width = `${(audio.mids * 100).toFixed(1)}%`;
      this.audioBarNodes.highs.style.width = `${(audio.highs * 100).toFixed(1)}%`;
    }

    gl.useProgram(this.shaderProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(this.positionLoc);
    gl.vertexAttribPointer(this.positionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.outputFramebuffer);
    gl.viewport(0, 0, this.width, this.height);

    this.refreshInputTextureFromProvider();

    if (this.timeLocation) {
      gl.uniform1f(this.timeLocation, now);
    }
    if (this.sizeLocation) {
      gl.uniform2f(this.sizeLocation, this.width, this.height);
    }

    this.audioMappedTargets.clear();
    this.applyAudioMappings(audio);
    this.applyUniformInputs();

    if (this.inputImageLocation && this.inputTexture) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.inputTexture);
      gl.uniform1i(this.inputImageLocation, 0);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.presentTexture(this.outputTexture);

    if (this.targetCanvas) {
      const ctx2d = this.targetCanvas.getContext("2d");
      if (ctx2d) {
        ctx2d.drawImage(this.canvas, 0, 0, this.targetCanvas.width, this.targetCanvas.height);
      }
    }
  }

  refreshInputTextureFromProvider() {
    if (!this.inputFrameProvider) {
      return;
    }

    const frame = this.inputFrameProvider();
    if (!frame || !frame.texture) {
      this.inputTexture = null;
      return;
    }

    if (frame.gl !== this.gl) {
      const error = "Chaining GPU requires same WebGL context between components.";
      if (this.inputProviderError !== error) {
        this.inputProviderError = error;
        this.pushError(error);
      }
      this.inputTexture = null;
      return;
    }

    this.inputProviderError = "";
    this.inputTexture = frame.texture;
  }

  applyAudioMappings(audio) {
    for (const map of this.mappings) {
      if (!this.uniformLocations.has(map.target)) {
        continue;
      }

      const sourceValue = audio[map.source] ?? 0;
      const src = map.invert ? 1 - sourceValue : sourceValue;
      const min = Math.min(map.min, map.max);
      const max = Math.max(map.min, map.max);
      const mapped = clamp(src * map.amount + map.bias, min, max);
      this.manualUniformValues[map.target] = mapped;
      this.audioMappedTargets.add(map.target);
    }
  }

  applyUniformSlew(name, targetValue) {
    const currentValue = this.smoothedUniformValues[name];
    if (currentValue === undefined || Number.isNaN(currentValue)) {
      this.smoothedUniformValues[name] = targetValue;
      return targetValue;
    }

    const delta = targetValue - currentValue;
    const speed = delta >= 0 ? this.uniformSlew.rise : this.uniformSlew.fall;

    // Same spirit as the reference SlewProcessor: asymmetric rise/fall smoothing.
    const factor = speed * speed;
    const nextValue = currentValue + (delta * factor);

    this.smoothedUniformValues[name] = nextValue;
    return nextValue;
  }

  applyUniformInputs() {
    const gl = this.gl;

    for (const input of this.inputs) {
      const location = this.uniformLocations.get(input.NAME);
      if (!location) {
        continue;
      }

      const type = this.uniformTypes.get(input.NAME);
      const value = this.manualUniformValues[input.NAME];

      if (type === "float") {
        const targetValue = Number(value);
        if (this.audioMappedTargets.has(input.NAME)) {
          const smoothed = this.applyUniformSlew(input.NAME, targetValue);
          gl.uniform1f(location, smoothed);
        } else {
          this.smoothedUniformValues[input.NAME] = targetValue;
          gl.uniform1f(location, targetValue);
        }
      } else if (type === "bool" || type === "event") {
        gl.uniform1i(location, value ? 1 : 0);
      } else if (type === "long") {
        if (Array.isArray(input.VALUES) && input.VALUES.length) {
          const idx = clamp(Number(value) || 0, 0, input.VALUES.length - 1);
          gl.uniform1i(location, Number(input.VALUES[idx]));
        } else {
          gl.uniform1i(location, Number(value) || 0);
        }
      } else if (type === "color") {
        const v = Array.isArray(value) ? value : [0, 0, 0, 1];
        gl.uniform4f(location, Number(v[0] || 0), Number(v[1] || 0), Number(v[2] || 0), Number(v[3] ?? 1));
      } else if (type === "point2D") {
        const v = Array.isArray(value) ? value : [0.5, 0.5];
        gl.uniform2f(location, Number(v[0] || 0), Number(v[1] || 0));
      }
    }
  }

  presentTexture(texture) {
    const gl = this.gl;

    gl.useProgram(this.presentProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(this.presentPosLoc);
    gl.vertexAttribPointer(this.presentPosLoc, 2, gl.FLOAT, false, 0, 0);
    gl.viewport(0, 0, this.width, this.height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(this.presentTextureLoc, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  connect(target) {
    let resolved = target;

    if (typeof target === "string") {
      resolved = document.querySelector(target) || document.getElementById(target);
      if (!resolved) {
        this.pushError(`connect: cible introuvable (${target}).`);
        return null;
      }
    }

    if (resolved instanceof HTMLCanvasElement) {
      this.targetCanvas = resolved;
      this.connectedTarget = null;
      this.pushInfo("Connecte vers canvas externe.");
      return resolved;
    }

    if (resolved && resolved.tagName && resolved.tagName.toLowerCase() === "isf-shader-renderer") {
      this.connectedTarget = resolved;
      this.targetCanvas = null;
      if (typeof resolved.setInputFrameProvider === "function") {
        resolved.setInputFrameProvider(() => this.getOutputFrame());
      } else if (typeof resolved.setInputTexture === "function") {
        resolved.setInputTexture(this.outputTexture);
      }
      this.pushInfo("Connecte vers un autre composant isf-shader-renderer.");
      return resolved;
    }

    this.pushError("connect: type de cible non supporte.");
    return null;
  }

  setInputTexture(texture) {
    this.inputTexture = texture;
  }

  setInputFrameProvider(provider) {
    this.inputFrameProvider = provider;
  }

  getOutputFrame() {
    return {
      texture: this.outputTexture,
      gl: this.gl,
      width: this.width,
      height: this.height,
    };
  }

  connectAudio(audioSource) {
    try {
      if (audioSource instanceof HTMLMediaElement) {
        this.audioBridge.attachElement(audioSource);
      } else if (audioSource instanceof AudioNode) {
        this.audioBridge.attachNode(audioSource);
      } else {
        throw new Error("Source audio non supportee. Utiliser HTMLMediaElement ou AudioNode.");
      }
      this.pushInfo("Analyse audio activee.");
    } catch (error) {
      this.pushError(error.message || String(error));
    }
  }

  async connectMicrophone() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Microphone non supporte par ce navigateur.");
    }

    if (this.micStream) {
      return this.micStream;
    }

    await this.resumeAudio();

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
    } catch (_firstError) {
      // Fallback for browsers/devices that reject explicit audio constraints.
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
    }

    if (!this.audioBridge.context) {
      this.audioBridge.context = new (window.AudioContext || window.webkitAudioContext)();
    }

    this.micSourceNode = this.audioBridge.context.createMediaStreamSource(this.micStream);
    this.audioBridge.attachNode(this.micSourceNode);
    this.micActive = true;
    this.updateMicIndicator();
    this.pushInfo("Microphone connecte.");

    return this.micStream;
  }

  microphoneSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  stopMicrophone() {
    if (this.micSourceNode) {
      try {
        this.micSourceNode.disconnect();
      } catch (_error) {
        // node may already be disconnected
      }
      this.micSourceNode = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }

    this.micActive = false;
    this.updateMicIndicator();

    this.pushInfo("Microphone arrete.");
  }

  setAudioMappings(mappings) {
    if (!Array.isArray(mappings)) {
      return;
    }
    this.mappings = mappings.map((mapping) => ({
      source: mapping.source || "lows",
      target: mapping.target || "",
      amount: Number(mapping.amount ?? 1),
      bias: Number(mapping.bias ?? 0),
      min: Number(mapping.min ?? 0),
      max: Number(mapping.max ?? 1),
      invert: !!mapping.invert,
    }));
    this.buildMappingControls();
  }

  async resumeAudio() {
    await this.audioBridge.resume();
  }

  getOutputTexture() {
    return this.outputTexture;
  }

  pushInfo(message) {
    this.consoleNode.textContent = `[INFO] ${message}\n${this.consoleNode.textContent}`;
  }

  pushError(message) {
    this.consoleNode.textContent = `[ERROR] ${message}\n${this.consoleNode.textContent}`;
  }

  getCustomPresets() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter((entry) => entry && entry.name && entry.source).map((entry) => ({
        ...entry,
        mappings: Array.isArray(entry.mappings) ? entry.mappings : undefined,
        audioConfig: entry.audioConfig && typeof entry.audioConfig === "object" ? entry.audioConfig : undefined,
      }));
    } catch (_error) {
      return [];
    }
  }

  saveCustomPresets(presets) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  }

  populatePresetSelect() {
    const custom = this.getCustomPresets().map((entry) => ({
      ...entry,
      custom: true,
    }));

    this.availablePresets = [
      ...BUILTIN_PRESETS.map((entry) => ({ ...entry, custom: false })),
      ...custom,
    ];

    this.presetSelect.innerHTML = "";
    this.availablePresets.forEach((preset, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = preset.custom ? `${preset.name} (local)` : preset.name;
      this.presetSelect.appendChild(option);
    });
  }

  async loadPreset(indexStr) {
    const index = Number(indexStr);
    const preset = this.availablePresets[index];
    if (!preset) {
      return;
    }

    this.presetNameInput.value = preset.name;

    if (preset.custom) {
      this.sourceInput.value = preset.source;
      if (Array.isArray(preset.mappings)) {
        this.setAudioMappings(preset.mappings);
      }
      if (preset.audioConfig) {
        this.audioConfig = {
          ...this.audioConfig,
          ...preset.audioConfig,
        };
        this.audioBridge.setConfig(this.audioConfig);
        this.syncAudioControls();
      }
      this.compileShaderSource(preset.source);
      return;
    }

    if (preset.path) {
      await this.loadShader(preset.path);
    }
  }

  savePreset() {
    const name = (this.presetNameInput.value || "").trim();
    const source = this.sourceInput.value;

    if (!name) {
      this.pushError("Nom de preset obligatoire.");
      return;
    }

    const custom = this.getCustomPresets();
    const existingIndex = custom.findIndex((entry) => entry.name === name);

    const presetPayload = {
      name,
      source,
      mappings: this.mappings,
      audioConfig: this.audioConfig,
    };

    if (existingIndex >= 0) {
      custom[existingIndex] = presetPayload;
    } else {
      custom.push(presetPayload);
    }

    this.saveCustomPresets(custom);
    this.populatePresetSelect();
    this.pushInfo(`Preset sauvegarde: ${name}`);
  }

  deletePreset() {
    const name = (this.presetNameInput.value || "").trim();
    if (!name) {
      this.pushError("Nom preset requis pour suppression.");
      return;
    }

    const filtered = this.getCustomPresets().filter((entry) => entry.name !== name);
    this.saveCustomPresets(filtered);
    this.populatePresetSelect();
    this.pushInfo(`Preset supprime: ${name}`);
  }
}

customElements.define("isf-shader-renderer", ISFShaderRenderer);
