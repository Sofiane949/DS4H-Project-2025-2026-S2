const SVG_NS = "http://www.w3.org/2000/svg";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

class WebAudioKnob extends HTMLElement {
  static get observedAttributes() {
    return ["value", "min", "max", "default", "size", "color", "decimals"];
  }

  constructor() {
    super();

    this.attachShadow({ mode: "open" });

    this._value = 0;
    this._dragging = false;
    this._dragStartValue = 0;
    this._dragStartX = 0;
    this._dragStartY = 0;

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onDoubleClick = this.onDoubleClick.bind(this);
  }

  connectedCallback() {
    this.render();
    this.syncFromAttributes();
  }

  disconnectedCallback() {
    this.removeDragListeners();
  }

  attributeChangedCallback() {
    if (!this.isConnected) return;
    this.syncFromAttributes();
  }

  get min() {
    return Number(this.getAttribute("min") ?? 0);
  }

  get max() {
    return Number(this.getAttribute("max") ?? 1);
  }

  get defaultValue() {
    const fallback = this.min;
    return Number(this.getAttribute("default") ?? fallback);
  }

  get size() {
    return Number(this.getAttribute("size") ?? 48);
  }

  get decimals() {
    return Number(this.getAttribute("decimals") ?? 3);
  }

  get color() {
    return this.getAttribute("color") || "#22d3ee";
  }

  get value() {
    return this._value;
  }

  set value(next) {
    const clamped = clamp(Number(next), this.min, this.max);
    this._value = Number.isFinite(clamped) ? clamped : this.min;
    this.setAttribute("value", String(this._value));
    this.updateArc();
    this.updateValueLabel();
  }

  syncFromAttributes() {
    const raw = Number(this.getAttribute("value"));
    this._value = Number.isFinite(raw) ? clamp(raw, this.min, this.max) : this.min;

    this.wrapper.style.width = `${this.size}px`;
    this.wrapper.style.height = `${this.size + 14}px`;

    const ringSize = this.size;
    this.svg.setAttribute("width", String(ringSize));
    this.svg.setAttribute("height", String(ringSize));

    this.radius = ringSize * 0.5 - 5;
    this.center = ringSize * 0.5;

    this.baseArc.setAttribute("d", this.describeArc(135, 405));
    this.updateArc();
    this.updateValueLabel();
  }

  emitValue(type = "input") {
    this.dispatchEvent(new CustomEvent(type, {
      bubbles: true,
      composed: true,
      detail: { value: this._value },
    }));
  }

  onPointerDown(event) {
    event.preventDefault();
    this._dragging = true;
    this._dragStartValue = this._value;
    this._dragStartX = event.screenX;
    this._dragStartY = event.screenY;

    this.addDragListeners();
  }

  onPointerMove(event) {
    if (!this._dragging) return;

    const dx = event.screenX - this._dragStartX;
    const dy = event.screenY - this._dragStartY;
    const distance = dx - dy;
    const range = this.max - this.min;

    const nextValue = this._dragStartValue + distance * 0.005 * range;
    const clamped = clamp(nextValue, this.min, this.max);

    if (clamped !== this._value) {
      this._value = clamped;
      this.setAttribute("value", String(clamped));
      this.updateArc();
      this.updateValueLabel();
      this.emitValue("input");
    }
  }

  onPointerUp() {
    if (!this._dragging) return;
    this._dragging = false;
    this.removeDragListeners();
    this.emitValue("change");
  }

  onDoubleClick() {
    this.value = this.defaultValue;
    this.emitValue("input");
    this.emitValue("change");
  }

  addDragListeners() {
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
  }

  removeDragListeners() {
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
  }

  polarToCartesian(angleDeg) {
    const angle = ((angleDeg - 90) * Math.PI) / 180;
    const x = this.center + this.radius * Math.cos(angle);
    const y = this.center + this.radius * Math.sin(angle);
    return { x, y };
  }

  describeArc(startDeg, endDeg) {
    const start = this.polarToCartesian(endDeg);
    const end = this.polarToCartesian(startDeg);
    const largeArcFlag = endDeg - startDeg <= 180 ? "0" : "1";
    return `M ${start.x} ${start.y} A ${this.radius} ${this.radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  }

  updateArc() {
    const range = this.max - this.min;
    const norm = range === 0 ? 0 : (this._value - this.min) / range;
    const clampedNorm = clamp(norm, 0, 1);
    const sweep = 270 * clampedNorm;

    this.activeArc.setAttribute("d", this.describeArc(135, 135 + sweep));
    this.activeArc.setAttribute("stroke", this.color);
  }

  updateValueLabel() {
    this.valueLabel.textContent = Number(this._value).toFixed(this.decimals);
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
          user-select: none;
          -webkit-user-select: none;
          touch-action: none;
        }

        .wrapper {
          display: grid;
          justify-items: center;
          align-items: center;
          gap: 2px;
        }

        svg {
          overflow: visible;
          cursor: ns-resize;
        }

        .base {
          fill: none;
          stroke: #95a89b;
          stroke-width: 3;
          opacity: 0.45;
        }

        .active {
          fill: none;
          stroke-width: 3.2;
          stroke-linecap: round;
        }

        .value {
          font-size: 11px;
          color: #3e5848;
          line-height: 1;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        }
      </style>
      <div class="wrapper">
        <svg part="svg">
          <path class="base"></path>
          <path class="active"></path>
        </svg>
        <div class="value"></div>
      </div>
    `;

    this.wrapper = this.shadowRoot.querySelector(".wrapper");
    this.svg = this.shadowRoot.querySelector("svg");
    this.baseArc = this.shadowRoot.querySelector(".base");
    this.activeArc = this.shadowRoot.querySelector(".active");
    this.valueLabel = this.shadowRoot.querySelector(".value");

    this.svg.addEventListener("pointerdown", this.onPointerDown);
    this.svg.addEventListener("dblclick", this.onDoubleClick);
  }
}

if (!customElements.get("webaudio-knob")) {
  customElements.define("webaudio-knob", WebAudioKnob);
}
