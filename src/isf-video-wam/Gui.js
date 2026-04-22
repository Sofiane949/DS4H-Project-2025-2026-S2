
/**
 * Gui.js
 * Interface utilisateur complète et dynamique pour le plugin ISF Video.
 */
import './utils/webaudio-controls.js';

export default class ISFVideoGui extends HTMLElement {
    constructor(plugin) {
        super();
        this.plugin = plugin;
        this.attachShadow({ mode: 'open' });
        this._isInteractingWithSelect = false;
    }

    connectedCallback() {
        this.render();
        this.initControls();
        this._updateLoop();
    }

    _updateLoop = async () => {
        if (!this.isConnected) return;

        try {
            const values = await this.plugin.audioNode.getParameterValues(false);

            // Mettre à jour le sélecteur de shader
            const select = this.shadowRoot.getElementById('shaderSelect');
            if (select && !this._isInteractingWithSelect) {
                const val = Math.round(values.shaderSelect.value);
                if (select.value != val) select.value = val;
            }

            // Mettre à jour les contrôleurs
            const paramIds = [
                'distortion1', 'distortion2', 'noiseLevel', 'scroll',
                'speed', 'scanLineThickness', 'scanLineIntensity', 'scanLineOffset',
                'audioGain', 'audioPulse', 'brightness', 'contrast', 'saturation'
            ];

            paramIds.forEach(id => {
                const el = this.shadowRoot.getElementById(id);
                if (el && values[id] && !el.drag) {
                    el.value = values[id].value;
                }
            });
        } catch (e) { }

        this._raf = requestAnimationFrame(this._updateLoop);
    }

    disconnectedCallback() {
        if (this._raf) cancelAnimationFrame(this._raf);
    }

    render() {
        const shaderOptions = this.plugin.shaders.map((s, i) => `<option value="${i}">${s.replace('.fs', '')}</option>`).join('');

        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: flex;
                    flex-direction: column;
                    background: #1a1a1a;
                    color: #ddd;
                    padding: 15px;
                    border-radius: 12px;
                    font-family: 'Segoe UI', sans-serif;
                    width: 320px;
                    box-shadow: 0 4px 25px rgba(0,0,0,0.6);
                    border: 1px solid #333;
                }
                h3 { margin: 0 0 10px 0; font-size: 16px; text-align: center; color: #007bff; text-transform: uppercase; }
                select { 
                    width: 100%; background: #252525; color: #007bff; border: 1px solid #333; 
                    padding: 8px; border-radius: 5px; margin-bottom: 15px; cursor: pointer;
                    font-weight: bold; outline: none;
                }
                .section-title { font-size: 10px; color: #555; margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 3px; text-transform: uppercase; }
                .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 15px; }
                .control { display: flex; flex-direction: column; align-items: center; }
                label { font-size: 9px; margin-bottom: 4px; text-transform: uppercase; color: #888; font-weight: bold; text-align: center; }
                .slider-container { width: 100%; margin-bottom: 8px; display: flex; flex-direction: column; align-items: center; }
            </style>
            
            <select id="shaderSelect">
                ${shaderOptions}
            </select>

            <div class="section-title">Glitch & Distortion</div>
            <div class="grid">
                <div class="control">
                    <label>Distort 1</label>
                    <webaudio-knob id="distortion1" min="0" max="5" step="0.1" value="0.5" diameter="35"></webaudio-knob>
                </div>
                <div class="control">
                    <label>Distort 2</label>
                    <webaudio-knob id="distortion2" min="0" max="5" step="0.1" value="1.0" diameter="35"></webaudio-knob>
                </div>
                <div class="control">
                    <label>Noise</label>
                    <webaudio-knob id="noiseLevel" min="0" max="1" step="0.01" value="0.2" diameter="35"></webaudio-knob>
                </div>
                <div class="control">
                    <label>Scroll</label>
                    <webaudio-knob id="scroll" min="0" max="1" step="0.01" value="0.0" diameter="35"></webaudio-knob>
                </div>
            </div>

            <div class="section-title">Scanlines & Timing</div>
            <div class="grid">
                <div class="control">
                    <label>Speed</label>
                    <webaudio-knob id="speed" min="0" max="2" step="0.01" value="0.3" diameter="35"></webaudio-knob>
                </div>
                <div class="control">
                    <label>Line Thick</label>
                    <webaudio-knob id="scanLineThickness" min="1" max="100" step="1" value="25" diameter="35"></webaudio-knob>
                </div>
                <div class="control">
                    <label>Line Intens</label>
                    <webaudio-knob id="scanLineIntensity" min="0" max="1" step="0.01" value="0.3" diameter="35"></webaudio-knob>
                </div>
                <div class="control">
                    <label>Line Offset</label>
                    <webaudio-knob id="scanLineOffset" min="0" max="1" step="0.01" value="0.0" diameter="35"></webaudio-knob>
                </div>
            </div>

            <div class="section-title">Audio Reactive</div>
            <div class="grid">
                <div class="control">
                    <label>Audio Gain</label>
                    <webaudio-knob id="audioGain" min="0" max="10" step="0.1" value="2.0" diameter="35"></webaudio-knob>
                </div>
                <div class="control">
                    <label>Audio Pulse</label>
                    <webaudio-knob id="audioPulse" min="0" max="2" step="0.01" value="1.0" diameter="35"></webaudio-knob>
                </div>
            </div>

            <div class="section-title">Master Image</div>
            <div class="slider-container">
                <label>Brightness</label>
                <webaudio-slider id="brightness" min="0" max="2" step="0.01" value="1.0" width="250" height="12"></webaudio-slider>
            </div>
            <div class="slider-container">
                <label>Contrast</label>
                <webaudio-slider id="contrast" min="0" max="2" step="0.01" value="1.0" width="250" height="12"></webaudio-slider>
            </div>
            <div class="slider-container">
                <label>Saturation</label>
                <webaudio-slider id="saturation" min="0" max="2" step="0.01" value="1.0" width="250" height="12"></webaudio-slider>
            </div>
        `;
    }

    async initControls() {
        const paramIds = [
            'distortion1', 'distortion2', 'noiseLevel', 'scroll',
            'speed', 'scanLineThickness', 'scanLineIntensity', 'scanLineOffset',
            'audioGain', 'audioPulse', 'brightness', 'contrast', 'saturation'
        ];

        const select = this.shadowRoot.getElementById('shaderSelect');
        if (select) {
            select.addEventListener('mousedown', () => this._isInteractingWithSelect = true);
            select.addEventListener('blur', () => this._isInteractingWithSelect = false);
            select.addEventListener('change', (e) => {
                this.plugin.audioNode.setParamsValues({ shaderSelect: parseInt(e.target.value) });
                this._isInteractingWithSelect = false;
            });
        }

        paramIds.forEach(id => {
            const el = this.shadowRoot.getElementById(id);
            if (el) {
                el.addEventListener('input', (e) => {
                    this.plugin.audioNode.setParamsValues({ [id]: parseFloat(e.target.value) });
                });
            }
        });
    }
}

if (!customElements.get('isf-video-gui')) {
    customElements.define('isf-video-gui', ISFVideoGui);
}

export async function createElement(plugin) {
    return new ISFVideoGui(plugin);
}
