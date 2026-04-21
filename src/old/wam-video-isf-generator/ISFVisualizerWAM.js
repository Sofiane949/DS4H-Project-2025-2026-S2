/**
 * ISFVisualizerWAM.js
 * Modifié pour être conforme au SDK WAM2 (WamNode, getState, etc.)
 */
import { WebAudioModule, WamNode } from 'https://cdn.jsdelivr.net/npm/@webaudiomodules/sdk@latest/src/index.js';
import { ISFGeneratorRenderer } from './ISFRenderer.js';
import { ISFVisualizerGui } from './Gui.js';

export default class ISFVisualizerWAM extends WebAudioModule {
    _baseURL = new URL('.', import.meta.url).href;
    _descriptorUrl = `${this._baseURL}/descriptor.json`;

    async _loadDescriptor() {
        const url = this._descriptorUrl;
        if (!url) throw new TypeError('Descriptor not found');
        const response = await fetch(url);
        const descriptor = await response.json();
        Object.assign(this._descriptor, descriptor);
        return descriptor;
    }

    async initialize(state) {
        await this._loadDescriptor();
        return super.initialize(state);
    }

    async createAudioNode(initialState) {
        // Enregistrement du processeur
        const processorCode = `
            class ISFVisualizerProcessor extends AudioWorkletProcessor {
                process(inputs, outputs) {
                    const input = inputs[0];
                    if (input && input.length > 0) {
                        const channelData = input[0];
                        let sum = 0;
                        for (let i = 0; i < channelData.length; i++) sum += channelData[i] * channelData[i];
                        const rms = Math.sqrt(sum / channelData.length);
                        this.port.postMessage({ type: 'AUDIO_DATA', rms });
                    }
                    if (input && outputs[0]) {
                        for (let i = 0; i < input.length; i++) {
                            if (outputs[0][i]) outputs[0][i].set(input[i]);
                        }
                    }
                    return true;
                }
            }
            registerProcessor('${this.identifier}', ISFVisualizerProcessor);
        `;

        const blob = new Blob([processorCode], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        await this.audioContext.audioWorklet.addModule(url);

        // Création du WamNode (nécessaire pour Sequencer Party)
        const audioNode = new WamNode(this, {
            processorOptions: {
                moduleId: this.identifier,
                instanceId: this.instanceId,
            }
        });

        if (initialState) audioNode.setState(initialState);
        
        // Initialisation du renderer attaché à ce node
        // On crée un canvas interne pour le rendu
        const visualCanvas = document.createElement('canvas');
        visualCanvas.width = 800; visualCanvas.height = 600;
        audioNode.renderer = new ISFGeneratorRenderer(visualCanvas);
        
        audioNode.port.onmessage = (e) => {
            if (e.data.type === 'AUDIO_DATA') {
                audioNode.renderer.updateAudio(e.data.rms);
            }
        };

        this.audioNode = audioNode;
        return audioNode;
    }

    async createGui() {
        if (!customElements.get('isf-visualizer-gui')) {
            customElements.define('isf-visualizer-gui', ISFVisualizerGui);
        }
        const gui = document.createElement('isf-visualizer-gui');
        
        gui.addEventListener('param-change', (e) => {
            this.audioNode.renderer.updateParam(e.detail.name, e.detail.value);
        });

        gui.addEventListener('shader-change', async (e) => {
            const shaderUrl = e.detail;
            if (shaderUrl === 'internal') {
                this.audioNode.renderer.initDefaultShader();
            } else {
                try {
                    const fullUrl = shaderUrl.startsWith('http') ? shaderUrl : `${this._baseURL}/${shaderUrl}`;
                    const response = await fetch(fullUrl);
                    const code = await response.text();
                    this.audioNode.renderer.loadShaderFromFile(code);
                } catch (err) {
                    console.error("Shader load error:", err);
                }
            }
        });

        return gui;
    }

    // Méthode de chaînage vidéo
    render(inputs = [], time) {
        if (this.audioNode && this.audioNode.renderer) {
            const output = this.audioNode.renderer.render(inputs, time);
            
            // Si on a une destination de sortie connectée via connectVideo
            if (this._videoTarget) {
                const ctx = this._videoTarget.getContext('2d');
                if (ctx) {
                    ctx.drawImage(output, 0, 0, this._videoTarget.width, this._videoTarget.height);
                }
            }
            return output;
        }
        return inputs[0];
    }

    // Connecter la sortie vidéo à un canvas ou un autre WAM
    connectVideo(target) {
        this._videoTarget = target;
        
        // Si on est connecté à un canvas et qu'on n'est pas dans un hôte qui appelle render(),
        // on lance une boucle de rendu interne
        if (target instanceof HTMLCanvasElement && !this._loopStarted) {
            this._loopStarted = true;
            const loop = () => {
                this.render(this._videoInputs || []);
                requestAnimationFrame(loop);
            };
            requestAnimationFrame(loop);
        }
    }

    // Pour simuler une entrée vidéo quand on n'est pas dans un hôte
    setVideoInput(input, index = 0) {
        if (!this._videoInputs) this._videoInputs = [];
        this._videoInputs[index] = input;
    }
}
