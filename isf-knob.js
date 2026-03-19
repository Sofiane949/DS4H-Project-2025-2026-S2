/**
 * <isf-knob> — Rotary knob Web Component
 *
 * Visual: SVG arc track (270° sweep) + value arc + orbiting indicator dot.
 *
 * Geometry (all in SVG user units):
 *   • Track arc radius R=20, centered at (CX=32, CY=30)
 *   • Active sweep: 270°, from 7.5 o'clock → CW through 12 → to 4.5 o'clock
 *   • track rotate(135°) → stroke starts at right (0° SVG) rotated to 135° SVG = 7.5 o'clock
 *   • indicator angle = t * 270 − 135  (t ∈ [0,1], degrees, SVG clockwise)
 *
 * Attributes (all reflected as JS properties):
 *   min, max, value, default, label, step
 *
 * Events (bubble + composed):
 *   input  — fires continuously during drag / wheel
 *   change — fires once when drag is released
 *
 * Interaction:
 *   • Vertical mouse drag  (up = increase, hold Shift for fine control ÷10)
 *   • Mouse wheel
 *   • Double-click → reset to default value
 */

const CX = 32, CY = 30;     // knob center
const R  = 20;               // track radius
const BR = 13;               // body (inner filled circle) radius
const IR = 16;               // indicator orbit radius

const CIRC  = 2 * Math.PI * R;
const SWEEP = 270;
const TRACK = (SWEEP / 360) * CIRC;   // ≈ 94.25 — arc length of the 270° track

// ── Styles (Shadow DOM) ───────────────────────────────────────────────────────

const STYLES = `
:host {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    cursor: ns-resize;
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
    outline: none;
}
svg { display: block; overflow: visible; }

/* Track: full 270° background arc */
.track {
    fill: none;
    stroke: #22223e;
    stroke-width: 4;
    stroke-linecap: round;
}
/* Value arc: grows from min position proportionally */
.arc {
    fill: none;
    stroke: #e0506a;
    stroke-width: 4;
    stroke-linecap: round;
}
/* Knob body (inner circle) */
.body {
    fill: #1c1c38;
    stroke: #2c2c54;
    stroke-width: 1.5;
}
/* Indicator dot orbiting at radius IR */
.dot {
    fill: #ffffff;
}
/* Value text centered inside body */
.val {
    font-family: 'Courier New', monospace;
    font-size: 7.5px;
    fill: #8890c0;
    text-anchor: middle;
    dominant-baseline: middle;
    pointer-events: none;
}
/* Label below the knob */
.lbl {
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 8.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    fill: #5860a0;
    text-anchor: middle;
    pointer-events: none;
}

:host(:hover)  .body { fill: #242448; stroke: #383870; }
:host([drag])  .dot  { fill: #e0506a; }
:host([drag])  .arc  { stroke: #ff6080; }
:host(:focus)  .body { stroke: #5060b0; }
`;

// ── Component ─────────────────────────────────────────────────────────────────

class ISFKnob extends HTMLElement {

    static get observedAttributes() {
        return ['min', 'max', 'value', 'default', 'label', 'step'];
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        this._min  = 0;
        this._max  = 1;
        this._val  = 0;
        this._def  = 0;
        this._step = null;
        this._lbl  = '';

        this._built     = false;
        this._dragging  = false;
        this._dragY     = 0;
        this._dragV     = 0;

        this._onMove = this._move.bind(this);
        this._onUp   = this._up.bind(this);
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────

    connectedCallback() {
        this._build();
    }

    disconnectedCallback() {
        window.removeEventListener('mousemove', this._onMove);
        window.removeEventListener('mouseup',   this._onUp);
    }

    attributeChangedCallback(name, _, raw) {
        const n = parseFloat(raw);
        switch (name) {
            case 'min':     this._min  = isNaN(n) ? 0 : n; break;
            case 'max':     this._max  = isNaN(n) ? 1 : n; break;
            case 'value':   this._val  = isNaN(n) ? 0 : n; break;
            case 'default': this._def  = isNaN(n) ? 0 : n; break;
            case 'step':    this._step = isNaN(n) ? null : n; break;
            case 'label':   this._lbl  = raw ?? ''; break;
        }
        if (this._built) this._sync();
    }

    // ── Public API ─────────────────────────────────────────────────────────

    get value() { return this._val; }

    set value(v) {
        this._val = Math.min(this._max, Math.max(this._min, v));
        this._sync();
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }

    /** Silent update — does not dispatch events. Used by audio mapping. */
    setValue(v) {
        this._val = Math.min(this._max, Math.max(this._min, v));
        this._sync();
    }

    // ── Build DOM ──────────────────────────────────────────────────────────

    _build() {
        const VH = 74; // viewBox height
        this.shadowRoot.innerHTML = `
            <style>${STYLES}</style>
            <svg viewBox="0 0 64 ${VH}" width="64" height="${VH}" tabindex="-1">

                <!-- 270° background track, rotated so it starts at 7.5 o'clock -->
                <circle class="track" cx="${CX}" cy="${CY}" r="${R}" />

                <!-- Value arc, same rotation, grows with value -->
                <circle class="arc" cx="${CX}" cy="${CY}" r="${R}" />

                <!-- Knob body -->
                <circle class="body" cx="${CX}" cy="${CY}" r="${BR}" />

                <!-- Indicator dot — orbits at radius IR around knob center -->
                <g class="ig">
                    <circle class="dot" cx="${CX}" cy="${CY - IR}" r="2.5" />
                </g>

                <!-- Current value, centered in body -->
                <text class="val" x="${CX}" y="${CY}">0</text>

                <!-- Label below -->
                <text class="lbl" x="${CX}" y="${VH - 3}">LABEL</text>
            </svg>`;

        this._trackEl = this.shadowRoot.querySelector('.track');
        this._arcEl   = this.shadowRoot.querySelector('.arc');
        this._igEl    = this.shadowRoot.querySelector('.ig');
        this._valEl   = this.shadowRoot.querySelector('.val');
        this._lblEl   = this.shadowRoot.querySelector('.lbl');

        // Set static transform on track (never changes)
        this._trackEl.style.strokeDasharray = `${TRACK} ${CIRC}`;
        this._trackEl.setAttribute('transform', `rotate(135, ${CX}, ${CY})`);

        const svg = this.shadowRoot.querySelector('svg');
        svg.addEventListener('mousedown', e => this._down(e));
        svg.addEventListener('wheel',     e => this._wheel(e), { passive: false });
        svg.addEventListener('dblclick',  ()  => { this.value = this._def; });

        this._built = true;
        this._sync();
    }

    // ── Visual update ──────────────────────────────────────────────────────

    _sync() {
        if (!this._built) return;

        const range = this._max - this._min;
        const t = range === 0 ? 0 : (this._val - this._min) / range;
        const t01 = Math.max(0, Math.min(1, t));

        // Value arc length
        const arcLen = t01 * TRACK;
        this._arcEl.style.strokeDasharray = `${arcLen} ${CIRC}`;
        this._arcEl.setAttribute('transform', `rotate(135, ${CX}, ${CY})`);

        // Indicator: rotates from -135° (min, 7.5 o'clock) to +135° (max, 4.5 o'clock)
        const angle = t01 * SWEEP - 135;
        this._igEl.setAttribute('transform', `rotate(${angle}, ${CX}, ${CY})`);

        // Value text — integer display if step=1 or type is long
        const isInt = this._step !== null && Number.isInteger(this._step) && this._step >= 1;
        this._valEl.textContent = isInt ? Math.round(this._val) : this._val.toFixed(2);

        // Label
        this._lblEl.textContent = this._lbl.toUpperCase();
    }

    // ── Interaction ────────────────────────────────────────────────────────

    _down(e) {
        e.preventDefault();
        this._dragging = true;
        this._dragY    = e.clientY;
        this._dragV    = this._val;
        this.setAttribute('drag', '');
        window.addEventListener('mousemove', this._onMove);
        window.addEventListener('mouseup',   this._onUp);
    }

    _move(e) {
        if (!this._dragging) return;
        const dy    = this._dragY - e.clientY;           // up → positive
        const range = this._max - this._min;
        const sens  = e.shiftKey ? 1800 : 200;           // Shift = fine control
        this.value  = this._dragV + (dy / sens) * range;
    }

    _up() {
        this._dragging = false;
        this.removeAttribute('drag');
        window.removeEventListener('mousemove', this._onMove);
        window.removeEventListener('mouseup',   this._onUp);
        this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    }

    _wheel(e) {
        e.preventDefault();
        const range = this._max - this._min;
        const step  = this._step ?? range / 100;
        this.value  = this._val + (e.deltaY < 0 ? step : -step);
    }
}

customElements.define('isf-knob', ISFKnob);
export { ISFKnob };
