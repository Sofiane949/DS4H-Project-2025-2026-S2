
/**
 * Node.js
 * Noeud WAM basé sur CompositeAudioNode, calqué sur Quadrafuzz.
 */
import CompositeAudioNode from './sdk-parammgr/src/CompositeAudioNode.js';

export default class ISFVideoNode extends CompositeAudioNode {
    /**
     * @type {import('../VideoWAMHost/my_video_wam/sdk-parammgr').ParamMgrNode}
     */
    _wamNode = undefined;

    setup(wamNode) {
        this._wamNode = wamNode;
        this.connectNodes();
    }

    constructor(context, options) {
        super(context, options);
        this.renderer = null;

        // Analyseur pour le RMS (thread principal)
        this._analyser = context.createAnalyser();
        this._analyser.fftSize = 256;
        this._buffer = new Float32Array(this._analyser.fftSize);

        // Comme dans Quadrafuzz, on définit la sortie
        this._output = this.context.createGain();
    }

    connectNodes() {
        // Entrée (this) -> Analyseur
        // Entrée (this) -> Sortie (bypass audio)
        this.connect(this._analyser);
        this.connect(this._output);
    }

    setRenderer(renderer) {
        this.renderer = renderer;
    }

    updateAudioData() {
        if (!this.renderer || !this._analyser) return;
        try {
            this._analyser.getFloatTimeDomainData(this._buffer);
            let sum = 0;
            for (let i = 0; i < this._buffer.length; i++) {
                sum += this._buffer[i] * this._buffer[i];
            }
            this.renderer.audioRMS = Math.sqrt(sum / this._buffer.length);
        } catch (e) {
            // Sécurité pour éviter TypeError sur Sequencer Party
        }
    }

    // Délégation des méthodes WAM à _wamNode (comme dans Quadrafuzz)
    getParamValue(name) {
        return this._wamNode.getParamValue(name);
    }

    setParamValue(name, value) {
        return this._wamNode.setParamValue(name, value);
    }

    getParamsValues() {
        return this._wamNode.getParamsValues();
    }

    setParamsValues(values) {
        return this._wamNode.setParamsValues(values);
    }
}
