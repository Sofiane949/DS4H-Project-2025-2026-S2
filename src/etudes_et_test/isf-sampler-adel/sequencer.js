/**
 * Sequencer — Step sequencer 16 steps × N pads
 *
 * Encapsule le SamplerEngine existant pour fournir une lecture
 * en boucle de type boite a rythmes (drum machine).
 *
 * Usage :
 *   import { Sequencer } from './sequencer.js';
 *   const seq = new Sequencer();
 *   await seq.loadPreset('808');
 *   seq.toggle(0, 0);   // active le pad 0 au step 0
 *   seq.play();
 */

import { SamplerEngine, DRUM_PRESETS } from './sampler-engine.js';

export { DRUM_PRESETS };

export class Sequencer {

    constructor() {
        this.engine    = new SamplerEngine();
        this.steps     = 16;
        this.bpm       = 120;
        this._grid     = [];   // grid[padIndex][step] = true/false
        this._playing  = false;
        this._step     = 0;
        this._timer    = null;

        // Callbacks
        this._onStep       = null;   // (stepIndex) => void
        this._onPadTrigger = null;   // (padIndex, stepIndex) => void
    }

    // ── Accesseurs ────────────────────────────────────────────────────────────

    get playing()  { return this._playing; }
    get currentStep() { return this._step; }
    get grid()     { return this._grid; }
    get sounds()   { return this.engine.sounds; }
    get features() { return this.engine.features; }
    get category() { return this.engine.category; }

    /** Appeler dans la boucle rAF pour mettre a jour les features audio. */
    tick() { this.engine.tick(); }

    // ── Callbacks ─────────────────────────────────────────────────────────────

    onStep(cb)       { this._onStep = cb; }
    onPadTrigger(cb) { this._onPadTrigger = cb; }

    // ── Chargement de preset ──────────────────────────────────────────────────

    async loadPreset(category, onProgress = null) {
        this.stop();
        await this.engine.loadPreset(category, onProgress);
        this._initGrid();
    }

    _initGrid() {
        const padCount = this.engine.sounds.length;
        this._grid = [];
        for (let p = 0; p < padCount; p++) {
            this._grid.push(new Array(this.steps).fill(false));
        }
    }

    // ── Manipulation de la grille ─────────────────────────────────────────────

    toggle(padIndex, step) {
        if (!this._grid[padIndex]) return;
        this._grid[padIndex][step] = !this._grid[padIndex][step];
        return this._grid[padIndex][step];
    }

    set(padIndex, step, value) {
        if (!this._grid[padIndex]) return;
        this._grid[padIndex][step] = !!value;
    }

    get(padIndex, step) {
        return this._grid[padIndex]?.[step] ?? false;
    }

    clear() {
        for (const row of this._grid) row.fill(false);
    }

    // ── Transport ─────────────────────────────────────────────────────────────

    setBpm(bpm) {
        this.bpm = Math.max(40, Math.min(240, bpm));
        // Si en lecture, relancer le timer avec le nouveau tempo
        if (this._playing) {
            this._stopTimer();
            this._startTimer();
        }
    }

    play() {
        if (this._playing) return;
        if (this.engine.ctx.state === 'suspended') this.engine.ctx.resume();
        this._playing = true;
        this._step = 0;
        this._startTimer();
    }

    stop() {
        this._playing = false;
        this._stopTimer();
        this.engine.stopAll();
        this._step = 0;
    }

    // ── Timer interne ─────────────────────────────────────────────────────────

    _startTimer() {
        const intervalMs = () => (60 / this.bpm) * 1000;

        const advance = () => {
            this._triggerStep(this._step);
            if (this._onStep) this._onStep(this._step);

            this._step = (this._step + 1) % this.steps;
            this._timer = setTimeout(advance, intervalMs());
        };

        this._timer = setTimeout(advance, 0);
    }

    _stopTimer() {
        if (this._timer !== null) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    }

    _triggerStep(step) {
        const cat = this.engine.category;
        for (let p = 0; p < this._grid.length; p++) {
            if (this._grid[p][step]) {
                this.engine.noteOn(cat, p);
                if (this._onPadTrigger) this._onPadTrigger(p, step);
            }
        }
    }
}
