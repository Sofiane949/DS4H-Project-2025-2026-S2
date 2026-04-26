/**
 * <isf-switch> — LED toggle switch Web Component
 *
 * Attributes: checked, label
 * Events (bubble + composed): input, change
 */

const STYLES = `
:host {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    outline: none;
}

.lbl {
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 8.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: #5860a0;
    pointer-events: none;
}

/* Switch track */
.track {
    width: 36px;
    height: 19px;
    border-radius: 10px;
    background: #1c1c38;
    border: 1.5px solid #2c2c54;
    position: relative;
    transition: background 0.18s, border-color 0.18s;
    flex-shrink: 0;
}

/* Sliding thumb */
.thumb {
    position: absolute;
    top: 2.5px;
    left: 2.5px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #40406a;
    transition: left 0.15s cubic-bezier(.4,0,.2,1), background 0.15s;
}

/* ON state */
:host([checked]) .track {
    background: #2a0f1a;
    border-color: #c03050;
}
:host([checked]) .thumb {
    left: 19px;
    background: #e0506a;
    box-shadow: 0 0 6px #e0506a88;
}

/* State label */
.state {
    font-family: 'Courier New', monospace;
    font-size: 8px;
    color: #40406a;
    transition: color 0.15s;
    pointer-events: none;
}
:host([checked]) .state { color: #e0506a; }

:host(:hover) .track   { border-color: #4040a0; }
:host(:focus) .track   { border-color: #6068c0; }
`;

class ISFSwitch extends HTMLElement {

    static get observedAttributes() { return ['checked', 'label']; }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._checked = false;
        this._label   = '';
        this._built   = false;
    }

    connectedCallback() {
        this._build();
    }

    attributeChangedCallback(name, _, val) {
        if (name === 'checked') this._checked = val !== null;
        if (name === 'label')   this._label   = val ?? '';
        if (this._built) this._sync();
    }

    // ── Public API ─────────────────────────────────────────────────────────

    get checked() { return this._checked; }

    set checked(v) {
        this._checked = !!v;
        if (v) this.setAttribute('checked', '');
        else   this.removeAttribute('checked');
        this._sync();
        this.dispatchEvent(new Event('input',  { bubbles: true, composed: true }));
        this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    }

    /** Silent update — does not dispatch events. Used by audio mapping. */
    setValue(v) {
        this._checked = !!v;
        if (v) this.setAttribute('checked', '');
        else   this.removeAttribute('checked');
        this._sync();
    }

    // ── Build ──────────────────────────────────────────────────────────────

    _build() {
        this.shadowRoot.innerHTML = `
            <style>${STYLES}</style>
            <span class="lbl"></span>
            <div class="track" tabindex="-1">
                <div class="thumb"></div>
            </div>
            <span class="state"></span>
        `;
        this._lblEl   = this.shadowRoot.querySelector('.lbl');
        this._stateEl = this.shadowRoot.querySelector('.state');

        const track = this.shadowRoot.querySelector('.track');
        track.addEventListener('click', () => { this.checked = !this._checked; });
        track.addEventListener('keydown', e => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                this.checked = !this._checked;
            }
        });

        this._built = true;
        this._sync();
    }

    _sync() {
        if (!this._built) return;
        this._lblEl.textContent   = (this._label || '').toUpperCase();
        this._stateEl.textContent = this._checked ? 'ON' : 'OFF';
    }
}

customElements.define('isf-switch', ISFSwitch);
export { ISFSwitch };
