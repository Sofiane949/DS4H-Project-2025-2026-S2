/**
 * ISFRenderer.js
 * Gère le rendu des shaders ISF sur un canvas WebGL.
 * Ce module est conçu pour être piloté par le son (RMS / FFT).
 */
export class ISFGeneratorRenderer {
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
        
        // Texture pour l'entrée vidéo (chaining)
        this.inputTexture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.inputTexture);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

        // On initialise avec un shader par défaut
        this.initDefaultShader();
    }

    updateParam(name, value) {
        this.params[name] = value;
    }

    initDefaultShader() {
        const vs = `
            attribute vec2 position;
            varying vec2 v_uv;
            void main() {
                v_uv = position * 0.5 + 0.5;
                v_uv.y = 1.0 - v_uv.y; // Flip Y for standard UVs
                gl_Position = vec4(position, 0.0, 1.0);
            }
        `;
        const fs = `
            precision mediump float;
            varying vec2 v_uv;
            uniform float TIME;
            uniform float AUDIO_RMS;
            uniform vec2 RENDERSIZE;
            uniform vec3 u_color;
            uniform float u_audio_gain;
            uniform float u_speed;
            uniform float u_scale;
            uniform sampler2D inputImage;
            uniform bool u_has_input;

            void main() {
                vec2 uv = gl_FragCoord.xy / RENDERSIZE.xy;
                float time = TIME * u_speed;
                float audio = AUDIO_RMS * u_audio_gain;
                float pulsate = 0.5 + 0.5 * sin(time + audio * 10.0);
                
                vec3 finalCol = u_color * pulsate;
                
                if (u_has_input) {
                    vec4 tex = texture2D(inputImage, v_uv);
                    finalCol = mix(tex.rgb, finalCol, 0.5); // On mélange l'entrée avec le shader
                }

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

    // Nouvelle méthode render pour le chaînage
    render(inputs = [], time = (performance.now() - this.startTime) / 1000) {
        if (!this.program) return this.canvas;

        const gl = this.gl;
        gl.useProgram(this.program);

        // Gestion de l'entrée vidéo (le premier élément de inputs)
        let hasInput = false;
        if (inputs && inputs[0]) {
            hasInput = true;
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.inputTexture);
            // On peut passer un HTMLCanvasElement, HTMLImageElement, HTMLVideoElement, ou ImageBitmap
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, inputs[0]);
            gl.uniform1i(gl.getUniformLocation(this.program, 'inputImage'), 0);
        }
        gl.uniform1i(gl.getUniformLocation(this.program, 'u_has_input'), hasInput ? 1 : 0);

        // Uniforms standards
        gl.uniform1f(gl.getUniformLocation(this.program, 'TIME'), time);
        gl.uniform2f(gl.getUniformLocation(this.program, 'RENDERSIZE'), this.canvas.width, this.canvas.height);
        gl.uniform1f(gl.getUniformLocation(this.program, 'AUDIO_RMS'), this.audioData.rms);

        // Uniforms personnalisés (Live Params)
        gl.uniform3fv(gl.getUniformLocation(this.program, 'u_color'), this.params.color);
        gl.uniform1f(gl.getUniformLocation(this.program, 'u_audio_gain'), this.params.audioGain);
        gl.uniform1f(gl.getUniformLocation(this.program, 'u_speed'), this.params.speed);
        gl.uniform1f(gl.getUniformLocation(this.program, 'u_scale'), this.params.scale);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        
        return this.canvas; // On retourne le canvas résultant pour le prochain node
    }

    // Animate reste optionnel pour un usage autonome
    animate() {
        this.render();
        requestAnimationFrame(() => this.animate());
    }

    async loadShaderFromFile(fsContent) {
        const vs = `
            attribute vec2 position;
            varying vec2 v_uv;
            void main() {
                v_uv = position * 0.5 + 0.5;
                v_uv.y = 1.0 - v_uv.y;
                gl_Position = vec4(position, 0.0, 1.0);
            }
        `;
        this.compile(vs, fsContent);
    }
}
