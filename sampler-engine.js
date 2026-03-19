/**
 * SamplerEngine — standalone (adapté depuis AngularSamplerAudio/SamplerEngine.js)
 *
 * Différences par rapport à l'original :
 *  - Aucun import externe (auto-suffisant)
 *  - Charge les presets directement depuis les JSON/WAV statiques
 *  - Insère un AnalyserNode entre master et destination
 *  - Expose tick() + features pour le mapping ISF
 *  - Expose onPadPlay(cb) pour flasher les pads lors du sequential
 */

const PRESETS_BASE = '/AngularSamplerAudio/sampler-main/presets';

export const DRUM_PRESETS = [
    { category: '808',             name: '808 Drum Kit'    },
    { category: 'electronic',      name: 'Electronic'      },
    { category: 'hip-hop',         name: 'Hip-Hop'         },
    { category: 'basic-kit',       name: 'Basic Kit'       },
    { category: 'steveland-vinyl', name: 'Steveland Vinyl' },
];

export class SamplerEngine {

    constructor() {
        this.ctx      = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize                = 2048;
        this.analyser.smoothingTimeConstant  = 0.82;

        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;

        // Chain: source → master → analyser → speakers
        this.master.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);

        this._buf     = new Uint8Array(this.analyser.frequencyBinCount);
        this.features = { bass: 0, mid: 0, treble: 0, rms: 0, peak: 0 };

        this.sounds      = [];
        this.effects     = new Map();
        this._active     = new Set();
        this._onPlay     = null;
        this._onPadPlay  = null;
        this.category    = null;
    }

    // ── Feature extraction (appeler dans la boucle rAF) ───────────────────────

    tick() {
        this.analyser.getByteFrequencyData(this._buf);
        const N     = this._buf.length;
        const binHz = this.ctx.sampleRate / this.analyser.fftSize;

        const bassEnd   = Math.floor(  250 / binHz);
        const midEnd    = Math.floor( 4000 / binHz);
        const trebleEnd = Math.min(N, Math.floor(16000 / binHz));

        this.features.bass   = _avg(this._buf,  0,        bassEnd)   / 255;
        this.features.mid    = _avg(this._buf,  bassEnd,  midEnd)    / 255;
        this.features.treble = _avg(this._buf,  midEnd,   trebleEnd) / 255;
        this.features.rms    = _avg(this._buf,  0,        trebleEnd) / 255;
        this.features.peak   = _peak(this._buf, 0,        trebleEnd) / 255;
    }

    // ── Chargement de preset ──────────────────────────────────────────────────

    async loadPreset(category, onProgress = null) {
        if (this.ctx.state === 'suspended') await this.ctx.resume();

        const res   = await fetch(`${PRESETS_BASE}/${category}.json`);
        const json  = await res.json();
        const list  = json.samples || [];

        this.category = category;
        this.sounds   = [];

        for (let i = 0; i < list.length; i++) {
            const s   = list[i];
            // Encode each path segment to handle spaces (e.g. "Kick 808X.wav")
            const rel = s.url.replace(/^\.\//, '');
            const url = PRESETS_BASE + '/' +
                rel.split('/').map(encodeURIComponent).join('/');

            const buffer = await _decodeUrl(this.ctx, url);
            this.sounds.push({ ...s, id: s.name || `pad-${i}`, buffer });
            if (onProgress) onProgress((i + 1) / list.length, s.name || '');
        }
    }

    // ── Effets par pad ────────────────────────────────────────────────────────

    getEffect(i) {
        if (!this.effects.has(i)) this.effects.set(i, { volume: 1, pan: 0, pitch: 1 });
        return this.effects.get(i);
    }
    setEffect(i, type, val) { this.getEffect(i)[type] = val; }
    setMasterGain(v) { this.master.gain.value = v; }

    // ── Callbacks ─────────────────────────────────────────────────────────────

    onPlay(cb)    { this._onPlay    = cb; }
    /** cb(padIndex) — appelé au moment exact où le pad joue (timing audio) */
    onPadPlay(cb) { this._onPadPlay = cb; }

    // ── Lecture ───────────────────────────────────────────────────────────────

    noteOn(category, index, when = this.ctx.currentTime + 0.02) {
        const s = this.sounds[index];
        if (!s?.buffer) return;

        const fx = this.getEffect(index);

        const src = this.ctx.createBufferSource();
        src.buffer = s.buffer;
        src.playbackRate.value = fx.pitch;

        const gain = this.ctx.createGain();
        gain.gain.value = fx.volume;

        const pan = this.ctx.createStereoPanner();
        pan.pan.value = fx.pan;

        src.connect(gain);
        gain.connect(pan);
        pan.connect(this.master);

        src.onended = () => this._active.delete(src);
        src.start(when);
        this._active.add(src);

        if (this._onPlay)
            this._onPlay(when, 0, s.buffer.duration / fx.pitch, s.buffer);

        if (this._onPadPlay) {
            const delay = Math.max(0, (when - this.ctx.currentTime) * 1000);
            setTimeout(() => this._onPadPlay(index), delay);
        }
    }

    playSingle(category, index)   { this.noteOn(category, index); }

    playTogether(category) {
        const t = this.ctx.currentTime + 0.05;
        this.sounds.forEach((_, i) => this.noteOn(category, i, t));
    }

    playSequential(category, bpm = 120) {
        const beat = 60 / Math.max(40, Math.min(240, bpm));
        let t = this.ctx.currentTime + 0.05;
        this.sounds.forEach((_, i) => { this.noteOn(category, i, t); t += beat; });
    }

    stopAll() {
        this._active.forEach(s => { try { s.stop(0); } catch (_) {} });
        this._active.clear();
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function _decodeUrl(ctx, url) {
    const res = await fetch(url);
    const ab  = await res.arrayBuffer();
    return ctx.decodeAudioData(ab);
}

function _avg(buf, s, e) {
    if (e <= s) return 0;
    let sum = 0;
    for (let i = s; i < e; i++) sum += buf[i];
    return sum / (e - s);
}

function _peak(buf, s, e) {
    let p = 0;
    for (let i = s; i < e; i++) if (buf[i] > p) p = buf[i];
    return p;
}
