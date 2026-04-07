/**
 * ISFRenderer.js
 * Gère le rendu des shaders ISF sur un canvas WebGL.
 * Ce module est conçu pour être piloté par le son (RMS / FFT).
 */
class ISFGeneratorRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2');
        if (!this.gl) throw new Error("WebGL 2 not supported");

        this.program = null;
        this.startTime = performance.now();
        this.audioData = { rms: 0, high: 0, mid: 0, low: 0 };
        this.params = {
            color: [1.0, 1.0, 1.0],
            audioGain: 1.0,
            speed: 1.0,
            scale: 1.0
        };
        
        // On initialise avec un shader par défaut
        this.initDefaultShader();
        this.animate();
    }

    updateParam(name, value) {
        this.params[name] = value;
    }

    initDefaultShader() {
        const vs = `
            attribute vec2 position;
            void main() { gl_Position = vec4(position, 0.0, 1.0); }
        `;
        const fs = `
            precision mediump float;
            uniform float TIME;
            uniform float AUDIO_RMS;
            uniform vec2 RENDERSIZE;
            uniform vec3 u_color;
            uniform float u_audio_gain;
            uniform float u_speed;
            uniform float u_scale;

            void main() {
                vec2 uv = gl_FragCoord.xy / RENDERSIZE.xy;
                float time = TIME * u_speed;
                float audio = AUDIO_RMS * u_audio_gain;
                float pulsate = 0.5 + 0.5 * sin(time + audio * 10.0);
                
                vec3 finalCol = u_color * pulsate;
                gl_FragColor = vec4(finalCol, 1.0);
            }
        `;
        this.compile(vs, fs);
    }

    compile(vsSource, fsSource) {
        const gl = this.gl;
        const createShader = (type, source) => {
            const s = gl.createShader(type);
            gl.shaderSource(s, source);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                console.error(gl.getShaderInfoLog(s));
                return null;
            }
            return s;
        };

        const vs = createShader(gl.VERTEX_SHADER, vsSource);
        const fs = createShader(gl.FRAGMENT_SHADER, fsSource);
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        this.program = program;

        // Configuration des sommets
        const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        const posAttr = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(posAttr);
        gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);
    }

    updateAudio(rms) {
        this.audioData.rms = rms;
    }

    animate() {
        if (!this.program) return requestAnimationFrame(() => this.animate());

        const gl = this.gl;
        gl.useProgram(this.program);

        // Uniforms standards
        gl.uniform1f(gl.getUniformLocation(this.program, 'TIME'), (performance.now() - this.startTime) / 1000);
        gl.uniform2f(gl.getUniformLocation(this.program, 'RENDERSIZE'), this.canvas.width, this.canvas.height);
        gl.uniform1f(gl.getUniformLocation(this.program, 'AUDIO_RMS'), this.audioData.rms);

        // Uniforms personnalisés (Live Params)
        gl.uniform3fv(gl.getUniformLocation(this.program, 'u_color'), this.params.color);
        gl.uniform1f(gl.getUniformLocation(this.program, 'u_audio_gain'), this.params.audioGain);
        gl.uniform1f(gl.getUniformLocation(this.program, 'u_speed'), this.params.speed);
        gl.uniform1f(gl.getUniformLocation(this.program, 'u_scale'), this.params.scale);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        requestAnimationFrame(() => this.animate());
    }

    async loadShaderFromFile(fsContent) {
        // Logique simplifiée : On garde un vertex shader standard
        const vs = `
            attribute vec2 position;
            void main() { gl_Position = vec4(position, 0.0, 1.0); }
        `;
        this.compile(vs, fsContent);
    }
}

// On exporte pour pouvoir l'utiliser dans main.js
window.ISFGeneratorRenderer = ISFGeneratorRenderer;
