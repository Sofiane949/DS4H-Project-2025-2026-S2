/**
 * ISFRenderer — Web Component
 *
 * Renders ISF (Interactive Shader Format) GLSL shaders in a WebGL 2 canvas.
 * Dynamically generates controls from shader metadata (INPUTS).
 * Exposes a connect() method for chaining (Phase 3 framebuffer sharing).
 *
 * Usage:
 *   <isf-renderer shaders-path="./shaders"></isf-renderer>
 *
 *   // JS API
 *   const r = document.querySelector('isf-renderer');
 *   r.loadShader('checkerboard');
 *   r.connect(anotherRenderer);   // or r.connect('canvas-id')
 */

import { parseISF, buildUniformDeclarations, getDefaultValue } from './isf-parser.js';
import './isf-knob.js';
import './isf-switch.js';
import { fetchPresets, savePreset, deletePreset } from './preset-api.js';

// ─── WebGL 2 / GLSL 300 es shaders ───────────────────────────────────────────

const VERTEX_SHADER_SRC = `#version 300 es
in vec2 a_position;
out vec2 isf_FragNormCoord;

void main() {
    isf_FragNormCoord = (a_position + 1.0) / 2.0;
    gl_Position = vec4(a_position, 0.0, 1.0);
}`;

/**
 * Preamble injected before every ISF fragment shader.
 *
 * - Declares all ISF built-in uniforms.
 * - Declares the output variable and re-defines gl_FragColor for compatibility,
 *   so unmodified ISF shaders (which use gl_FragColor) compile under GLSL 300 es.
 */
const ISF_FRAG_PREAMBLE = `
uniform float TIME;
uniform float TIMEDELTA;
uniform vec4  DATE;
uniform vec2  RENDERSIZE;
uniform int   FRAMEINDEX;

in  vec2 isf_FragNormCoord;
out vec4 isf_FragColor;

// Compatibility shims for ISF shaders targeting WebGL 1 / GLSL 100
#define gl_FragColor isf_FragColor
#define texture2D   texture
`;

// ─── Component styles (Shadow DOM) ───────────────────────────────────────────

const STYLES = `
:host {
    display: block;
    background: #12121f;
    border: 1px solid #1e1e3a;
    border-radius: 8px;
    overflow: hidden;
    font-family: 'Segoe UI', system-ui, sans-serif;
    color: #d0d4e8;
    min-width: 280px;
}

/* ── Header ── */
.header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px;
    background: #1a1a30;
    border-bottom: 1px solid #1e1e3a;
}
.header-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #7c85c8;
    flex: 1;
}
/* Chain badge shown when this component feeds into another */
.chain-badge {
    display: none;
    font-size: 9px;
    font-weight: 700;
    color: #e0506a;
    letter-spacing: 1px;
    text-transform: uppercase;
    border: 1px solid #e0506a44;
    border-radius: 3px;
    padding: 1px 5px;
}
:host([chained]) .chain-badge { display: inline; }
.preset-select {
    background: #12121f;
    color: #d0d4e8;
    border: 1px solid #2a2a50;
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 12px;
    cursor: pointer;
    outline: none;
    transition: border-color 0.15s;
}
.preset-select:hover,
.preset-select:focus { border-color: #e0506a; }

/* ── Canvas ── */
.canvas-wrap {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    background: #000;
    overflow: hidden;
}
canvas {
    display: block;
    width: 100%;
    height: 100%;
}

/* ── Controls ── */
.controls {
    padding: 10px 14px;
    min-height: 44px;
    border-top: 1px solid #1e1e3a;
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: flex-end;
}
.ctrl-empty {
    color: #3a3a5a;
    font-size: 11px;
    font-style: italic;
}

/* isf-knob and isf-switch manage their own Shadow DOM styles */

/* ── Presets panel ── */
.presets {
    border-top: 1px solid #1e1e3a;
    padding: 8px 12px;
}
.presets-row {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 5px;
}
.presets-title {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #383860;
    flex: 0 0 auto;
}
.preset-name-input {
    flex: 1;
    background: #0c0c1e;
    border: 1px solid #252548;
    border-radius: 4px;
    color: #c0c8e8;
    font-size: 11px;
    padding: 3px 8px;
    outline: none;
    min-width: 0;
    transition: border-color 0.15s;
}
.preset-name-input:focus  { border-color: #5060a0; }
.preset-name-input::placeholder { color: #2a2a50; }

.preset-save-btn {
    background: #181834;
    color: #6070b0;
    border: 1px solid #252548;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding: 4px 10px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.preset-save-btn:hover:not(:disabled) {
    background: #e0506a;
    color: #fff;
    border-color: #e0506a;
}
.preset-save-btn:disabled { opacity: 0.3; cursor: default; }

/* Preset list */
.preset-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 92px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #252548 transparent;
}
.preset-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 5px;
    border-radius: 3px;
    cursor: default;
    transition: background 0.1s;
}
.preset-item:hover { background: #14142a; }
.preset-shader-tag {
    font-size: 8px;
    font-family: 'Courier New', monospace;
    color: #303060;
    flex: 0 0 auto;
    padding: 1px 4px;
    border: 1px solid #252548;
    border-radius: 2px;
}
.preset-item-name {
    font-size: 11px;
    color: #7080b8;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.preset-load-btn, .preset-del-btn {
    background: none;
    border: 1px solid transparent;
    border-radius: 3px;
    cursor: pointer;
    padding: 1px 6px;
    font-size: 10px;
    flex: 0 0 auto;
    transition: background 0.1s, border-color 0.1s, color 0.1s;
}
.preset-load-btn { color: #4060a0; }
.preset-load-btn:hover {
    background: #5080c020;
    border-color: #5080c050;
    color: #80a0e0;
}
.preset-del-btn { color: #603050; }
.preset-del-btn:hover {
    background: #e0506a18;
    border-color: #e0506a40;
    color: #e0506a;
}
.preset-status {
    font-size: 10px;
    color: #2a2a48;
    font-style: italic;
    padding: 2px 0;
}

/* ── Error console ── */
.console {
    background: #0c0c18;
    border-top: 1px solid #1e1e3a;
    padding: 5px 10px;
    height: 72px;
    overflow-y: auto;
    font-family: 'Courier New', monospace;
    font-size: 10px;
    color: #555577;
    scroll-behavior: smooth;
}
.console .line { padding: 1px 0; line-height: 1.5; }
.console .line.error { color: #e05060; }
.console .line.info  { color: #5090d0; }
.console .line.warn  { color: #d0a030; }
`;

// ─── ISFRenderer class ────────────────────────────────────────────────────────

class ISFRenderer extends HTMLElement {

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        // WebGL state
        this._gl        = null;
        this._program   = null;
        this._buffer    = null;     // vertex buffer (fullscreen quad)

        // Render loop state
        this._animId    = null;
        this._startTime = null;     // set on first frame after shader load
        this._lastTime  = null;
        this._frameIdx  = 0;

        // Shader / parameter state
        this._metadata  = null;     // parsed ISF metadata object
        this._params    = {};       // { name → current JS value }
        this._locs      = {};       // { name → WebGLUniformLocation }

        // Shader list (from index.json)
        this._shaderNames = [];

        // Chaining (Phase 3)
        this._connectedTarget = null;
        this._source          = null;
        this._sourceTexture   = null;
        this._slaved          = false;

        // Preset persistence (Phase 4)
        this._currentShaderName = null;   // name of the currently loaded shader file
        this._savedPresets      = [];     // presets loaded from backend
        this._backendOnline     = false;
    }

    // ── Observed attributes ────────────────────────────────────────────────

    static get observedAttributes() {
        return ['shaders-path', 'shader'];
    }

    attributeChangedCallback(name) {
        if (name === 'shaders-path' && this._gl) this._loadShaderList();
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────

    connectedCallback() {
        this._shadersPath    = this.getAttribute('shaders-path') || './shaders';
        this._defaultShader  = this.getAttribute('shader') || null;
        this._buildUI();
        this._initWebGL();
        this._loadShaderList();
        this._initPresets();
    }

    disconnectedCallback() {
        if (this._animId) {
            cancelAnimationFrame(this._animId);
            this._animId = null;
        }
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /**
     * Load a shader by preset name (filename without extension).
     * @param {string} name
     */
    async loadShader(name) {
        await this._fetchAndApply(name);
    }

    /**
     * Connect this renderer (source) into a target renderer.
     * The target will sample this renderer's canvas as a texture each frame.
     * This renderer stops its own rAF loop — the target drives the whole chain.
     *
     * @param {string|ISFRenderer} target  — element ID or ISFRenderer instance
     */
    connect(target) {
        const t = typeof target === 'string' ? document.getElementById(target) : target;
        if (!t) {
            this._log(`connect(): target "${target}" not found`, 'error');
            return;
        }

        this._connectedTarget = t;

        // Stop own render loop — the downstream target will drive us
        this._slaved = true;
        if (this._animId) {
            cancelAnimationFrame(this._animId);
            this._animId = null;
        }

        // Show chain badge in header
        this.setAttribute('chained', '');

        // Tell the target about its new source
        if (typeof t._setSource === 'function') {
            t._setSource(this);
        }

        this._log(`→ chained to ${t.id || t.tagName.toLowerCase()}`, 'info');
    }

    /**
     * Called by an upstream renderer when it connects to this one.
     * @param {ISFRenderer} src
     */
    _setSource(src) {
        this._source = src;
        // Clean up any previous source texture
        if (this._sourceTexture && this._gl) {
            this._gl.deleteTexture(this._sourceTexture);
            this._sourceTexture = null;
        }
        this._log(`← source: ${src.id || src.tagName.toLowerCase()}`, 'info');
    }

    // ── UI ─────────────────────────────────────────────────────────────────

    _buildUI() {
        this.shadowRoot.innerHTML = `
            <style>${STYLES}</style>
            <div class="header">
                <span class="header-title">ISF Renderer</span>
                <span class="chain-badge">⇢ chained</span>
                <select class="preset-select"><option value="">— loading —</option></select>
            </div>
            <div class="canvas-wrap"><canvas></canvas></div>
            <div class="controls"><span class="ctrl-empty">No shader loaded</span></div>
            <div class="presets">
                <div class="presets-row">
                    <span class="presets-title">Presets</span>
                    <input class="preset-name-input" type="text" placeholder="preset name…" maxlength="48" />
                    <button class="preset-save-btn" disabled>Save</button>
                </div>
                <div class="preset-list"><span class="preset-status">connecting…</span></div>
            </div>
            <div class="console"></div>
        `;

        this._canvas      = this.shadowRoot.querySelector('canvas');
        this._controlsEl  = this.shadowRoot.querySelector('.controls');
        this._consoleEl   = this.shadowRoot.querySelector('.console');
        this._selectEl    = this.shadowRoot.querySelector('.preset-select');

        this._selectEl.addEventListener('change', e => {
            if (e.target.value) this._fetchAndApply(e.target.value);
        });

        // Presets panel refs
        this._presetNameInput = this.shadowRoot.querySelector('.preset-name-input');
        this._presetSaveBtn   = this.shadowRoot.querySelector('.preset-save-btn');
        this._presetListEl    = this.shadowRoot.querySelector('.preset-list');

        this._presetSaveBtn.addEventListener('click', () => this._saveCurrentPreset());
        this._presetNameInput.addEventListener('input', () => {
            this._presetSaveBtn.disabled = !this._presetNameInput.value.trim();
        });
        this._presetNameInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') this._saveCurrentPreset();
        });
    }

    // ── WebGL initialisation ───────────────────────────────────────────────

    _initWebGL() {
        const gl = this._canvas.getContext('webgl2');
        if (!gl) {
            this._log('WebGL 2 is not supported in this browser.', 'error');
            return;
        }
        this._gl = gl;

        // Fullscreen quad: two triangles as a TRIANGLE_STRIP
        //   (-1,-1)──(1,-1)
        //      │   ╲   │
        //   (-1, 1)──(1, 1)
        const quad = new Float32Array([-1, -1,  1, -1,  -1, 1,  1, 1]);
        this._buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
        gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

        // Enable attribute slot 0 once; all programs will bind a_position to 0
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    }

    // ── Shader loading ─────────────────────────────────────────────────────

    async _loadShaderList() {
        try {
            const res = await fetch(`${this._shadersPath}/index.json`);
            if (!res.ok) throw new Error(`Cannot load shader list (${res.status})`);
            const data = await res.json();
            this._shaderNames = data.shaders ?? [];
            this._populateSelect();
            if (this._shaderNames.length > 0) {
                // Respect the `shader` attribute, fall back to first in list
                const init = this._defaultShader && this._shaderNames.includes(this._defaultShader)
                    ? this._defaultShader
                    : this._shaderNames[0];
                this._selectEl.value = init;
                await this._fetchAndApply(init);
            }
        } catch (err) {
            this._log(err.message, 'error');
        }
    }

    _populateSelect() {
        this._selectEl.innerHTML = this._shaderNames
            .map(n => `<option value="${n}">${n}</option>`)
            .join('');
    }

    async _fetchAndApply(name) {
        try {
            const res = await fetch(`${this._shadersPath}/${name}.fs`);
            if (!res.ok) throw new Error(`Cannot load "${name}.fs" (${res.status})`);
            const source = await res.text();
            this._applyShader(source, name);
        } catch (err) {
            this._log(err.message, 'error');
        }
    }

    _applyShader(source, name, overrideParams = null) {
        if (!this._gl) return;
        try {
            const { metadata, glslCode } = parseISF(source);
            const fragSrc = this._buildFragSrc(glslCode, metadata);
            const program = this._compileAndLink(fragSrc);

            // Replace old program and state
            if (this._program) this._gl.deleteProgram(this._program);
            this._program           = program;
            this._metadata          = metadata;
            this._currentShaderName = name;
            this._params            = this._initParams(metadata.INPUTS ?? []);

            // Preset load: override defaults with saved values
            if (overrideParams) {
                for (const [k, v] of Object.entries(overrideParams)) {
                    if (k in this._params) this._params[k] = v;
                }
            }

            this._locs = this._cacheLocations(program, metadata.INPUTS ?? []);

            // Rebuild parameter controls
            this._buildControls(metadata.INPUTS ?? []);

            // Reset timing so TIME starts at 0 for the new shader
            this._startTime = null;
            this._lastTime  = null;
            this._frameIdx  = 0;

            // Start render loop only if we're not slaved to a downstream renderer
            if (!this._animId && !this._slaved) this._startLoop();

            this._log(`Loaded: ${name}`, 'info');
            this.dispatchEvent(new CustomEvent('shaderloaded', {
                detail: { name, metadata },
                bubbles: true,
            }));
        } catch (err) {
            this._log(err.message, 'error');
        }
    }

    // ── GLSL compilation ───────────────────────────────────────────────────

    _buildFragSrc(glslCode, metadata) {
        const userUniforms = buildUniformDeclarations(metadata.INPUTS ?? []);
        return [
            '#version 300 es',
            'precision highp float;',
            ISF_FRAG_PREAMBLE,
            userUniforms,
            glslCode,
        ].join('\n');
    }

    _compileStage(type, src) {
        const gl = this._gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`Compile error:\n${info}`);
        }
        return shader;
    }

    _compileAndLink(fragSrc) {
        const gl   = this._gl;
        const vert = this._compileStage(gl.VERTEX_SHADER,   VERTEX_SHADER_SRC);
        const frag = this._compileStage(gl.FRAGMENT_SHADER, fragSrc);

        const prog = gl.createProgram();
        // Force a_position to attribute slot 0 (matches our one-time setup in _initWebGL)
        gl.bindAttribLocation(prog, 0, 'a_position');
        gl.attachShader(prog, vert);
        gl.attachShader(prog, frag);
        gl.linkProgram(prog);
        gl.deleteShader(vert);
        gl.deleteShader(frag);

        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            const info = gl.getProgramInfoLog(prog);
            gl.deleteProgram(prog);
            throw new Error(`Link error:\n${info}`);
        }
        return prog;
    }

    // ── Parameters ─────────────────────────────────────────────────────────

    _initParams(inputs) {
        const out = {};
        for (const input of inputs) out[input.NAME] = getDefaultValue(input);
        return out;
    }

    _cacheLocations(program, inputs) {
        const gl  = this._gl;
        const loc = {};
        // ISF built-ins
        for (const name of ['TIME', 'TIMEDELTA', 'DATE', 'RENDERSIZE', 'FRAMEINDEX']) {
            loc[name] = gl.getUniformLocation(program, name);
        }
        // User inputs
        for (const input of inputs) {
            loc[input.NAME] = gl.getUniformLocation(program, input.NAME);
            // ISF image inputs carry companion size / rect uniforms
            if (input.TYPE === 'image') {
                loc[`_${input.NAME}_imgSize`] = gl.getUniformLocation(program, `_${input.NAME}_imgSize`);
                loc[`_${input.NAME}_imgRect`] = gl.getUniformLocation(program, `_${input.NAME}_imgRect`);
            }
        }
        return loc;
    }

    // ── Controls (Phase 2: isf-knob + isf-switch) ─────────────────────────

    _buildControls(inputs) {
        this._controlsEl.innerHTML = '';

        if (inputs.length === 0) {
            this._controlsEl.innerHTML = '<span class="ctrl-empty">No parameters</span>';
            return;
        }

        for (const input of inputs) {
            if (input.TYPE === 'float' || input.TYPE === 'long') {
                const knob = document.createElement('isf-knob');
                knob.setAttribute('min',     input.MIN   ?? 0);
                knob.setAttribute('max',     input.MAX   ?? 1);
                knob.setAttribute('value',   this._params[input.NAME] ?? 0);
                knob.setAttribute('default', this._params[input.NAME] ?? 0);
                knob.setAttribute('label',   input.LABEL ?? input.NAME);
                if (input.TYPE === 'long') knob.setAttribute('step', '1');
                knob.dataset.param = input.NAME;
                knob.addEventListener('input', () => {
                    this._params[input.NAME] = knob.value;
                });
                this._controlsEl.appendChild(knob);

            } else if (input.TYPE === 'bool') {
                const sw = document.createElement('isf-switch');
                sw.setAttribute('label', input.LABEL ?? input.NAME);
                if (this._params[input.NAME]) sw.setAttribute('checked', '');
                sw.dataset.param = input.NAME;
                sw.addEventListener('input', () => {
                    this._params[input.NAME] = sw.checked;
                });
                this._controlsEl.appendChild(sw);

            }
            // color / point2D → Phase 2+
        }
    }

    /**
     * Silently set a shader parameter value and update its control widget.
     * Does NOT dispatch input/change events (avoids feedback loops with audio).
     * @param {string} name  — ISF parameter name
     * @param {*}      value — new value
     */
    setParam(name, value) {
        this._params[name] = value;
        // Find the control widget by data-param and update it silently
        const el = this._controlsEl.querySelector(`[data-param="${name}"]`);
        if (!el) return;
        if (typeof el.setValue === 'function') el.setValue(value);
    }

    /**
     * Returns array of ISF input metadata objects for the currently loaded shader.
     * Each object has at least: { NAME, TYPE, MIN, MAX, DEFAULT, LABEL }
     * @returns {object[]}
     */
    get inputsMeta() {
        return this._metadata?.INPUTS ?? [];
    }

    // ── Preset persistence (Phase 4) ───────────────────────────────────────

    async _initPresets() {
        try {
            this._savedPresets  = await fetchPresets();
            this._backendOnline = true;
            this._renderPresetList();
        } catch {
            // Backend offline (e.g. served via python -m http.server)
            this._backendOnline = false;
            this._presetListEl.innerHTML =
                '<span class="preset-status">backend offline — run: node server.js</span>';
        }
    }

    async _saveCurrentPreset() {
        const name = this._presetNameInput.value.trim();
        if (!name || !this._currentShaderName) return;

        this._presetSaveBtn.disabled = true;
        try {
            const preset = await savePreset(name, this._currentShaderName, { ...this._params });
            this._savedPresets.push(preset);
            this._renderPresetList();
            this._presetNameInput.value = '';
            this._log(`Preset saved: "${name}"`, 'info');
        } catch (err) {
            this._log(`Save failed: ${err.message}`, 'error');
        } finally {
            this._presetSaveBtn.disabled = !this._presetNameInput.value.trim();
        }
    }

    async _loadSavedPreset(preset) {
        try {
            const res = await fetch(`${this._shadersPath}/${preset.shader}.fs`);
            if (!res.ok) throw new Error(`Cannot load "${preset.shader}.fs" (${res.status})`);
            const source = await res.text();

            // Apply shader with the preset's saved param values
            this._applyShader(source, preset.shader, preset.params);

            // Sync the shader selector dropdown
            this._selectEl.value = preset.shader;
            this._log(`Preset loaded: "${preset.name}"`, 'info');
        } catch (err) {
            this._log(`Load failed: ${err.message}`, 'error');
        }
    }

    async _deletePreset(id) {
        try {
            await deletePreset(id);
            this._savedPresets = this._savedPresets.filter(p => p.id !== id);
            this._renderPresetList();
        } catch (err) {
            this._log(`Delete failed: ${err.message}`, 'error');
        }
    }

    _renderPresetList() {
        if (!this._presetListEl) return;
        this._presetListEl.innerHTML = '';

        if (this._savedPresets.length === 0) {
            this._presetListEl.innerHTML =
                '<span class="preset-status">no presets saved yet</span>';
            return;
        }

        for (const preset of this._savedPresets) {
            const item = document.createElement('div');
            item.className = 'preset-item';
            item.innerHTML = `
                <span class="preset-shader-tag">${preset.shader}</span>
                <span class="preset-item-name" title="${preset.name}">${preset.name}</span>
                <button class="preset-load-btn" title="Load">↩</button>
                <button class="preset-del-btn"  title="Delete">✕</button>
            `;
            item.querySelector('.preset-load-btn')
                .addEventListener('click', () => this._loadSavedPreset(preset));
            item.querySelector('.preset-del-btn')
                .addEventListener('click', () => this._deletePreset(preset.id));
            this._presetListEl.appendChild(item);
        }
    }

    // ── Render loop ────────────────────────────────────────────────────────

    _startLoop() {
        const tick = (ts) => {
            this._drawFrame(ts);
            this._animId = requestAnimationFrame(tick);
        };
        this._animId = requestAnimationFrame(tick);
    }

    _drawFrame(ts) {
        const gl = this._gl;
        if (!gl || !this._program) return;

        // ── Chain: drive source renderer first, then upload its canvas as texture ──
        if (this._source) {
            this._source._drawFrame(ts);
            this._uploadSourceTexture();
        }

        // ── Timing ────────────────────────────────────────────────────────
        if (this._startTime === null) {
            this._startTime = ts;
            this._lastTime  = ts;
        }

        // ── Sync canvas size ──────────────────────────────────────────────
        const w = this._canvas.clientWidth  || 400;
        const h = this._canvas.clientHeight || 225;
        if (this._canvas.width !== w || this._canvas.height !== h) {
            this._canvas.width  = w;
            this._canvas.height = h;
            gl.viewport(0, 0, w, h);
        }

        gl.useProgram(this._program);

        // ── ISF built-in uniforms ──────────────────────────────────────────
        const time  = (ts - this._startTime) / 1000;
        const delta = (ts - this._lastTime)  / 1000;
        this._lastTime = ts;

        const d = new Date();
        gl.uniform1f(this._locs.TIME,       time);
        gl.uniform1f(this._locs.TIMEDELTA,  delta);
        gl.uniform4f(this._locs.DATE,
            d.getFullYear(), d.getMonth() + 1, d.getDate(),
            d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()
        );
        gl.uniform2f(this._locs.RENDERSIZE, w, h);
        gl.uniform1i(this._locs.FRAMEINDEX, this._frameIdx++);

        // ── Image inputs: bind source texture ─────────────────────────────
        let texUnit = 0;
        for (const input of (this._metadata?.INPUTS ?? [])) {
            if (input.TYPE !== 'image') continue;
            const loc = this._locs[input.NAME];
            if (loc == null || !this._sourceTexture) continue;

            gl.activeTexture(gl.TEXTURE0 + texUnit);
            gl.bindTexture(gl.TEXTURE_2D, this._sourceTexture);
            gl.uniform1i(loc, texUnit);

            // Companion size / rect uniforms (ISF spec)
            const sw = this._source?._canvas.width  ?? w;
            const sh = this._source?._canvas.height ?? h;
            const sizeLoc = this._locs[`_${input.NAME}_imgSize`];
            const rectLoc = this._locs[`_${input.NAME}_imgRect`];
            if (sizeLoc != null) gl.uniform2f(sizeLoc, sw, sh);
            if (rectLoc != null) gl.uniform4f(rectLoc, 0, 0, 1, 1);

            texUnit++;
        }

        // ── Non-image user uniforms ────────────────────────────────────────
        for (const input of (this._metadata?.INPUTS ?? [])) {
            if (input.TYPE !== 'image') {
                this._setUniform(input.NAME, input.TYPE, this._params[input.NAME]);
            }
        }

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    /**
     * Upload the source renderer's canvas into a WebGL texture in THIS context.
     * Called once per frame, after the source has rendered.
     * UNPACK_FLIP_Y_WEBGL corrects the Y-axis difference between canvas and GL conventions.
     */
    _uploadSourceTexture() {
        const gl = this._gl;
        if (!this._source?._canvas) return;

        if (!this._sourceTexture) {
            this._sourceTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this._sourceTexture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        } else {
            gl.bindTexture(gl.TEXTURE_2D, this._sourceTexture);
        }

        // Flip Y so bottom-left (0,0) in GL matches bottom-left in the source canvas
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._source._canvas);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    _setUniform(name, type, value) {
        const gl  = this._gl;
        const loc = this._locs[name];
        if (loc == null) return;

        switch (type) {
            case 'float':   gl.uniform1f(loc, value ?? 0);          break;
            case 'bool':    gl.uniform1i(loc, value ? 1 : 0);       break;
            case 'long':    gl.uniform1i(loc, value ?? 0);          break;
            case 'color':   gl.uniform4fv(loc, value ?? [0,0,0,1]); break;
            case 'point2D': gl.uniform2fv(loc, value ?? [0,0]);     break;
        }
    }

    // ── Console ────────────────────────────────────────────────────────────

    _log(msg, type = 'info') {
        const method = type === 'error' ? 'error' : type === 'warn' ? 'warn' : 'log';
        console[method]('[ISFRenderer]', msg);

        if (!this._consoleEl) return;
        const line = document.createElement('div');
        line.className = `line ${type}`;
        const hms = new Date().toLocaleTimeString();
        line.textContent = `[${hms}] ${msg}`;
        this._consoleEl.appendChild(line);
        this._consoleEl.scrollTop = this._consoleEl.scrollHeight;
    }
}

customElements.define('isf-renderer', ISFRenderer);
export { ISFRenderer };
