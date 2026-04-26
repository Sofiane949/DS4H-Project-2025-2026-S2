
/**
 * ISFRenderer.js
 * Moteur de rendu WebGL pour shaders ISF.
 */
import ISFParser from './ISFParser.js';

export default class ISFRenderer {
  constructor(gl) {
    this.gl = gl;
    this.parser = new ISFParser();
    this.program = null;
    this.startTime = performance.now();
    this.frameIndex = 0;
    this.audioRMS = 0;
    this.audioGain = 2.0;
    this.audioPulse = 1.0;
    this.cumulativeTime = 0;
    this.lastFrameTime = performance.now();
    
    // Stockage des valeurs des paramètres
    this.values = new Map();
    
    this.setupBillboard();
  }

  setupBillboard() {
    const gl = this.gl;
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  }

  loadSource(fragmentSrc, vertexSrc) {
    this.parser.parse(fragmentSrc, vertexSrc);
    this.compile();
  }

  compile() {
    const gl = this.gl;
    try {
        const vs = this.createShader(gl.VERTEX_SHADER, this.parser.vertexShader);
        const fs = this.createShader(gl.FRAGMENT_SHADER, this.parser.fragmentShader);
        
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(program));
        }
        this.program = program;
    } catch (e) {
        console.error("Shader compilation failed:", e);
    }
  }

  createShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(info);
    }
    return shader;
  }

  setupOutput(width, height) {
    const gl = this.gl;
    this.outputFramebuffer = gl.createFramebuffer();
    this.outputTexture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, this.outputTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.outputFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.outputTexture, 0);
    
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  setUniform(name, value) {
    this.values.set(name, value);
  }

  draw(width, height, inputs = []) {
    const gl = this.gl;
    if (!this.program) return null;
    
    if (!this.outputTexture) this.setupOutput(width, height);

    gl.useProgram(this.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.outputFramebuffer);
    gl.viewport(0, 0, width, height);

    // Sommets
    const posAttr = gl.getAttribLocation(this.program, 'isf_position');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    // Temps réactif à l'audio
    const now = performance.now();
    const dt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    const audioFactor = 1.0 + (this.audioRMS * this.audioGain * this.audioPulse);
    this.cumulativeTime += dt * audioFactor;

    // Uniforms de base
    this._applyUniform('TIME', this.cumulativeTime);
    this._applyUniform('RENDERSIZE', [width, height]);
    this._applyUniform('FRAMEINDEX', this.frameIndex++);
    this._applyUniform('AUDIO_RMS', this.audioRMS);

    // Appliquer toutes les valeurs stockées
    for (const [name, val] of this.values) {
        this._applyUniform(name, val);
    }

    // Entrées vidéo (Textures)
    const imageInputs = this.parser.inputs.filter(inp => inp.TYPE === 'image');
    inputs.forEach((texture, i) => {
        if (imageInputs[i]) {
            gl.activeTexture(gl.TEXTURE0 + i);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            this._applyUniform(imageInputs[i].NAME, i);
            this._applyUniform(`_${imageInputs[i].NAME}_imgSize`, [width, height]);
            this._applyUniform(`_${imageInputs[i].NAME}_imgRect`, [0, 0, 1, 1]);
            this._applyUniform(`_${imageInputs[i].NAME}_flip`, false);
        }
    });

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return this.outputTexture;
  }

  _applyUniform(name, value) {
    const gl = this.gl;
    const loc = gl.getUniformLocation(this.program, name);
    if (loc === null) return;

    if (typeof value === 'number') {
      gl.uniform1f(loc, value);
    } else if (Array.isArray(value)) {
      if (value.length === 2) gl.uniform2fv(loc, value);
      else if (value.length === 3) gl.uniform3fv(loc, value);
      else if (value.length === 4) gl.uniform4fv(loc, value);
    } else if (typeof value === 'boolean') {
      gl.uniform1i(loc, value ? 1 : 0);
    }
  }
}
