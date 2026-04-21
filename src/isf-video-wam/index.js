
/**
 * index.js
 * Point d'entrée principal du plugin WAM ISF Video.
 */
import WebAudioModule from './sdk/src/WebAudioModule.js';
import ParamMgrFactory from './sdk-parammgr/src/ParamMgrFactory.js';
import ISFVideoNode from './Node.js';
import ISFRenderer from './ISFRenderer.js';

export default class ISFVideoPlugin extends WebAudioModule {
    _baseURL = new URL('.', import.meta.url).href;
    _descriptorUrl = `${this._baseURL}descriptor.json`;

    async _loadDescriptor() {
        const response = await fetch(this._descriptorUrl);
        const descriptor = await response.json();
        Object.assign(this.descriptor, descriptor);
    }

    async initialize(state) {
        await this._loadDescriptor();
        this.paramsValues = {
            shaderSelect: 0,
            speed: 0.3,
            noiseLevel: 0.2,
            distortion1: 0.5,
            distortion2: 1.0,
            scroll: 0.0,
            scanLineThickness: 25.0,
            scanLineIntensity: 0.3,
            scanLineOffset: 0.0,
            audioGain: 2.0,
            audioPulse: 1.0,
            brightness: 1.0,
            contrast: 1.0,
            saturation: 1.0
        };
        this.shaders = [
            'default.fs', 'kaleidoscope.fs', 'rgb_shift.fs', 'pixelate.fs', 
            'mirror.fs', 'wave.fs', 'negative.fs', 'hue_pulse.fs', 
            'edges.fs', 'radial_blur.fs', 'posterize.fs'
        ];
        return super.initialize(state);
    }

    async getState() {
        return this.audioNode.getState();
    }

    async setState(state) {
        await this.audioNode.setState(state);
    }

    async createAudioNode(initialState) {
        const node = new ISFVideoNode(this.audioContext);

        // Définition de TOUS les paramètres pour ParamMgr
        const internalParamsConfig = {
            shaderSelect: { defaultValue: 0, minValue: 0, maxValue: 10, step: 1, onChange: (v) => this._changeShader(v) },
            speed: { defaultValue: 0.3, minValue: 0, maxValue: 2.0, onChange: (v) => this._updateParam('speed', v) },
            noiseLevel: { defaultValue: 0.2, minValue: 0, maxValue: 1.0, onChange: (v) => this._updateParam('noiseLevel', v) },
            distortion1: { defaultValue: 0.5, minValue: 0, maxValue: 5.0, onChange: (v) => this._updateParam('distortion1', v) },
            distortion2: { defaultValue: 1.0, minValue: 0, maxValue: 5.0, onChange: (v) => this._updateParam('distortion2', v) },
            scroll: { defaultValue: 0.0, minValue: 0, maxValue: 1.0, onChange: (v) => this._updateParam('scroll', v) },
            scanLineThickness: { defaultValue: 25.0, minValue: 1.0, maxValue: 100.0, onChange: (v) => this._updateParam('scanLineThickness', v) },
            scanLineIntensity: { defaultValue: 0.3, minValue: 0, maxValue: 1.0, onChange: (v) => this._updateParam('scanLineIntensity', v) },
            scanLineOffset: { defaultValue: 0.0, minValue: 0, maxValue: 1.0, onChange: (v) => this._updateParam('scanLineOffset', v) },
            audioGain: { defaultValue: 2.0, minValue: 0, maxValue: 10.0, onChange: (v) => this._updateParam('audioGain', v) },
            audioPulse: { defaultValue: 1.0, minValue: 0, maxValue: 2.0, onChange: (v) => this._updateParam('audioPulse', v) },
            brightness: { defaultValue: 1.0, minValue: 0, maxValue: 2.0, onChange: (v) => this._updateParam('brightness', v) },
            contrast: { defaultValue: 1.0, minValue: 0, maxValue: 2.0, onChange: (v) => this._updateParam('contrast', v) },
            saturation: { defaultValue: 1.0, minValue: 0, maxValue: 2.0, onChange: (v) => this._updateParam('saturation', v) }
        };

        const paramMgrNode = await ParamMgrFactory.create(this, { internalParamsConfig });
        node.setup(paramMgrNode);

        if (initialState) node.setState(initialState);
        
        this.registerVideoExtension(node);

        this.audioNode = node;
        return node;
    }

    _updateParam(name, value) {
        this.paramsValues[name] = value;
        if (this.renderer) this.renderer.setUniform(name, value);
    }

    async _changeShader(index) {
        const shaderIndex = Math.round(index);
        this.paramsValues.shaderSelect = shaderIndex;
        const shaderFile = this.shaders[shaderIndex];
        if (this.renderer) {
            const response = await fetch(`${this._baseURL}shaders/${shaderFile}`);
            const shaderSrc = await response.text();
            this.renderer.loadSource(shaderSrc);
            
            // Ré-appliquer TOUS les paramètres au nouveau shader
            Object.keys(this.paramsValues).forEach(key => {
                if (key !== 'shaderSelect') this.renderer.setUniform(key, this.paramsValues[key]);
            });
        }
    }

    registerVideoExtension(node) {
        if (window.WAMExtensions && window.WAMExtensions.video) {
            window.WAMExtensions.video.setDelegate(this.instanceId, {
                connectVideo: async (options) => {
                    this.renderer = new ISFRenderer(options.gl);
                    node.setRenderer(this.renderer);
                    await this._changeShader(this.paramsValues.shaderSelect);
                },
                config: () => ({
                    numberOfInputs: this.renderer ? this.renderer.parser.inputs.filter(i => i.TYPE === 'image').length : 1,
                    numberOfOutputs: 1,
                }),
                render: (inputs, currentTime) => {
                    if (this.renderer) {
                        node.updateAudioData();
                        const { width, height } = this.renderer.gl.canvas;
                        const outputTexture = this.renderer.draw(width, height, inputs);
                        return [outputTexture];
                    }
                    return inputs;
                },
                disconnectVideo: () => {
                    this.renderer = null;
                    node.setRenderer(null);
                }
            });
        }
    }

    async createGui() {
        const { createElement } = await import('./Gui.js');
        return createElement(this);
    }
}
