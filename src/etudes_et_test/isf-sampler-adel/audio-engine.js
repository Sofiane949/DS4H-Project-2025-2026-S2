/**
 * AudioEngine — Web Audio API feature extractor
 *
 * Provides normalised (0–1) audio features updated at ~60 fps:
 *   bass, mid, treble, rms, peak
 *
 * Built-in generated sources (no files needed):
 *   'mic'       — live microphone input
 *   'bass'      — low sub-bass drone (60 Hz + harmonics)
 *   'arp'       — synth arpeggio (pentatonic, 220–880 Hz)
 *   'beat'      — kick + hi-hat percussive loop
 *   'noise'     — white noise burst
 *
 * Usage:
 *   const eng = new AudioEngine();
 *   await eng.start('bass');
 *   requestAnimationFrame(() => console.log(eng.features));
 *   await eng.switch('mic');
 *   eng.stop();
 */

export class AudioEngine {

    constructor() {
        this._ctx      = null;
        this._analyser = null;
        this._source   = null;        // current AudioNode source
        this._stream   = null;        // MediaStream (mic only)
        this._active   = false;
        this._buf      = null;        // Uint8Array for analyser data

        this.features  = { bass: 0, mid: 0, treble: 0, rms: 0, peak: 0 };

        // Scheduler state for generated sources
        this._beatTimer  = null;
        this._arpTimer   = null;
        this._noiseTimer = null;
        this._gainNode   = null;
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    /** Start the engine with the given source id. */
    async start(sourceId = 'bass') {
        if (this._ctx) await this.stop();

        this._ctx      = new AudioContext();
        this._analyser = this._ctx.createAnalyser();
        this._analyser.fftSize            = 2048;
        this._analyser.smoothingTimeConstant = 0.82;
        this._analyser.connect(this._ctx.destination);
        this._buf = new Uint8Array(this._analyser.frequencyBinCount);

        await this._startSource(sourceId);
        this._active = true;
    }

    /** Switch to a different source without restarting the engine. */
    async switch(sourceId) {
        if (!this._ctx) { await this.start(sourceId); return; }
        await this._stopSource();
        await this._startSource(sourceId);
    }

    /** Stop everything and release resources. */
    async stop() {
        this._active = false;
        await this._stopSource();
        if (this._analyser) { this._analyser.disconnect(); this._analyser = null; }
        if (this._ctx) { await this._ctx.close(); this._ctx = null; }
    }

    // ── Feature extraction (call in rAF loop) ─────────────────────────────────

    /** Update this.features from the latest analyser frame. */
    tick() {
        if (!this._analyser || !this._active) return;
        this._analyser.getByteFrequencyData(this._buf);

        const N     = this._buf.length;
        const sr    = this._ctx.sampleRate;
        const binHz = sr / (this._analyser.fftSize);

        // Frequency band index boundaries
        const bassEnd   = Math.floor(  250 / binHz);
        const midEnd    = Math.floor( 4000 / binHz);
        const trebleEnd = Math.min(N, Math.floor(16000 / binHz));

        this.features.bass   = _bandAvg(this._buf, 0,        bassEnd)   / 255;
        this.features.mid    = _bandAvg(this._buf, bassEnd,   midEnd)    / 255;
        this.features.treble = _bandAvg(this._buf, midEnd,    trebleEnd) / 255;
        this.features.rms    = _bandAvg(this._buf, 0,         trebleEnd) / 255;
        this.features.peak   = _bandPeak(this._buf, 0,        trebleEnd) / 255;
    }

    // ── Source management ─────────────────────────────────────────────────────

    async _startSource(id) {
        this._currentId = id;
        this._gainNode  = this._ctx.createGain();
        this._gainNode.gain.value = 1.0;
        this._gainNode.connect(this._analyser);

        switch (id) {
            case 'mic':   await this._startMic();   break;
            case 'bass':        this._startBass();  break;
            case 'arp':         this._startArp();   break;
            case 'beat':        this._startBeat();  break;
            case 'noise':       this._startNoise(); break;
            default:
                console.warn(`AudioEngine: unknown source "${id}", using bass`);
                this._startBass();
        }
    }

    async _stopSource() {
        // Stop scheduled loops
        clearInterval(this._beatTimer);
        clearInterval(this._arpTimer);
        clearInterval(this._noiseTimer);
        this._beatTimer = this._arpTimer = this._noiseTimer = null;

        if (this._source) {
            try { this._source.stop(); } catch (_) {}
            try { this._source.disconnect(); } catch (_) {}
            this._source = null;
        }
        if (this._stream) {
            this._stream.getTracks().forEach(t => t.stop());
            this._stream = null;
        }
        if (this._gainNode) {
            this._gainNode.disconnect();
            this._gainNode = null;
        }
    }

    // ── Sources ───────────────────────────────────────────────────────────────

    async _startMic() {
        try {
            this._stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            this._source = this._ctx.createMediaStreamSource(this._stream);
            this._source.connect(this._gainNode);
        } catch (err) {
            console.error('AudioEngine: mic access denied —', err.message);
        }
    }

    _startBass() {
        // Sub-bass drone: 60 Hz fundamental + 120 Hz + 180 Hz
        const osc1 = _osc(this._ctx, 60,  'sine',     0.6);
        const osc2 = _osc(this._ctx, 120, 'sine',     0.3);
        const osc3 = _osc(this._ctx, 180, 'triangle', 0.15);
        const mix  = this._ctx.createGain(); mix.gain.value = 1;
        osc1.connect(mix); osc2.connect(mix); osc3.connect(mix);
        mix.connect(this._gainNode);
        osc1.start(); osc2.start(); osc3.start();
        // keep refs so we can stop them
        this._source = { stop: () => { osc1.stop(); osc2.stop(); osc3.stop(); }, disconnect: () => mix.disconnect() };
    }

    _startArp() {
        // Pentatonic arpeggio: C3 D3 E3 G3 A3 C4 ...
        const freqs  = [130.8, 146.8, 164.8, 196.0, 220.0, 261.6, 293.7, 329.6, 392.0, 440.0];
        let   idx    = 0;
        const master = this._ctx.createGain(); master.gain.value = 0.5;
        master.connect(this._gainNode);

        const play = () => {
            const osc = this._ctx.createOscillator();
            const env = this._ctx.createGain();
            osc.type      = 'sawtooth';
            osc.frequency.value = freqs[idx % freqs.length];
            env.gain.setValueAtTime(0.6, this._ctx.currentTime);
            env.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + 0.18);
            osc.connect(env); env.connect(master);
            osc.start();  osc.stop(this._ctx.currentTime + 0.2);
            idx++;
        };
        play();
        this._arpTimer = setInterval(play, 200);
        this._source   = { stop: () => {}, disconnect: () => master.disconnect() };
    }

    _startBeat() {
        // Kick on beats 1 & 3, hi-hat on every 8th note
        const master = this._ctx.createGain(); master.gain.value = 0.8;
        master.connect(this._gainNode);

        let step = 0;
        const tick = () => {
            const now = this._ctx.currentTime;
            // Kick (steps 0 and 4 of 8)
            if (step === 0 || step === 4) {
                const kick = this._ctx.createOscillator();
                const kenv = this._ctx.createGain();
                kick.frequency.setValueAtTime(150, now);
                kick.frequency.exponentialRampToValueAtTime(40, now + 0.12);
                kenv.gain.setValueAtTime(0.9, now);
                kenv.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                kick.connect(kenv); kenv.connect(master);
                kick.start(now); kick.stop(now + 0.22);
            }
            // Hi-hat on every step
            const bufLen = this._ctx.sampleRate * 0.05;
            const buf    = this._ctx.createBuffer(1, bufLen, this._ctx.sampleRate);
            const data   = buf.getChannelData(0);
            for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1);
            const noise  = this._ctx.createBufferSource();
            const hpf    = this._ctx.createBiquadFilter();
            const henv   = this._ctx.createGain();
            noise.buffer = buf;
            hpf.type = 'highpass'; hpf.frequency.value = 8000;
            const hVol = (step % 2 === 0) ? 0.35 : 0.15;
            henv.gain.setValueAtTime(hVol, now);
            henv.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
            noise.connect(hpf); hpf.connect(henv); henv.connect(master);
            noise.start(now); noise.stop(now + 0.05);

            step = (step + 1) % 8;
        };
        tick();
        this._beatTimer = setInterval(tick, 125);  // 8th notes at 120 bpm
        this._source    = { stop: () => {}, disconnect: () => master.disconnect() };
    }

    _startNoise() {
        // Periodic white noise bursts
        const master = this._ctx.createGain(); master.gain.value = 0.4;
        master.connect(this._gainNode);

        const burst = () => {
            const now    = this._ctx.currentTime;
            const bufLen = this._ctx.sampleRate * 0.12;
            const buf    = this._ctx.createBuffer(1, bufLen, this._ctx.sampleRate);
            const data   = buf.getChannelData(0);
            for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1);
            const src  = this._ctx.createBufferSource();
            const env  = this._ctx.createGain();
            src.buffer = buf;
            env.gain.setValueAtTime(0.8, now);
            env.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            src.connect(env); env.connect(master);
            src.start(now); src.stop(now + 0.13);
        };
        burst();
        this._noiseTimer = setInterval(burst, 400);
        this._source     = { stop: () => {}, disconnect: () => master.disconnect() };
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _bandAvg(buf, start, end) {
    if (end <= start) return 0;
    let s = 0;
    for (let i = start; i < end; i++) s += buf[i];
    return s / (end - start);
}

function _bandPeak(buf, start, end) {
    let p = 0;
    for (let i = start; i < end; i++) if (buf[i] > p) p = buf[i];
    return p;
}

function _osc(ctx, freq, type, gain) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type           = type;
    o.frequency.value = freq;
    g.gain.value     = gain;
    o.connect(g);
    return o;   // caller must connect g to destination and call o.start()
}
