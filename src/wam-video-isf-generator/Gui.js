/**
 * Gui.js
 * Interface utilisateur du WAM.
 * Contient UNIQUEMENT les contrôleurs (Menu, Sliders, Couleurs).
 */
class ISFVisualizerGui extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shaders = [
            { name: 'Default Pulse', url: 'internal' },
            { name: 'Checkerboard Freak', url: 'shaders/checkerboard.fs' },
            { name: 'Electric Nebula', url: 'shaders/nebula.fs' }
        ];
    }

    connectedCallback() {
        this.render();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    background: #1a1a1a;
                    color: #eee;
                    padding: 15px;
                    border-radius: 10px;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    width: 280px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                    border: 1px solid #333;
                }
                .section { margin-bottom: 12px; }
                label { display: block; font-size: 0.7rem; margin-bottom: 5px; color: #888; letter-spacing: 1px; }
                select, input[type="range"], input[type="color"] {
                    width: 100%;
                    background: #252525;
                    border: 1px solid #444;
                    color: white;
                    border-radius: 4px;
                    cursor: pointer;
                }
                .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                strong { display: block; margin-bottom: 10px; color: #007bff; font-size: 0.9rem; }
            </style>
            
            <strong>ISF VISUALIZER SETTINGS</strong>

            <div class="section">
                <label>SHADER PRESET</label>
                <select id="shader-select">
                    ${this.shaders.map(s => `<option value="${s.url}">${s.name}</option>`).join('')}
                </select>
            </div>

            <div class="section">
                <label>MAIN COLOR</label>
                <input type="color" id="color-picker" value="#ffffff">
            </div>

            <div class="grid section">
                <div>
                    <label>AUDIO GAIN</label>
                    <input type="range" id="gain-slider" min="0" max="5" step="0.1" value="1">
                </div>
                <div>
                    <label>SPEED</label>
                    <input type="range" id="speed-slider" min="0" max="3" step="0.1" value="1">
                </div>
            </div>

            <div class="section">
                <label>PATTERN SCALE</label>
                <input type="range" id="scale-slider" min="0.1" max="10" step="0.1" value="1">
            </div>
        `;

        // Event Listeners
        this.shadowRoot.getElementById('shader-select').addEventListener('change', (e) => {
            this.dispatchEvent(new CustomEvent('shader-change', { detail: e.target.value }));
        });

        const emitParam = (name, value) => {
            this.dispatchEvent(new CustomEvent('param-change', { detail: { name, value } }));
        };

        this.shadowRoot.getElementById('color-picker').addEventListener('input', (e) => {
            const hex = e.target.value;
            const r = parseInt(hex.slice(1, 3), 16) / 255;
            const g = parseInt(hex.slice(3, 5), 16) / 255;
            const b = parseInt(hex.slice(5, 7), 16) / 255;
            emitParam('color', [r, g, b]);
        });

        this.shadowRoot.getElementById('gain-slider').addEventListener('input', (e) => emitParam('audioGain', parseFloat(e.target.value)));
        this.shadowRoot.getElementById('speed-slider').addEventListener('input', (e) => emitParam('speed', parseFloat(e.target.value)));
        this.shadowRoot.getElementById('scale-slider').addEventListener('input', (e) => emitParam('scale', parseFloat(e.target.value)));
    }
}

customElements.define('isf-visualizer-gui', ISFVisualizerGui);
