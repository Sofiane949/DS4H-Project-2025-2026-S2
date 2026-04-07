precision mediump float;
uniform float TIME;
uniform float AUDIO_RMS;
uniform vec2 RENDERSIZE;

uniform vec3 u_color;
uniform float u_audio_gain;
uniform float u_speed;
uniform float u_scale;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
    vec2 uv = (gl_FragCoord.xy * 2.0 - RENDERSIZE.xy) / min(RENDERSIZE.x, RENDERSIZE.y);
    
    float time = TIME * u_speed;
    float audio = AUDIO_RMS * u_audio_gain;
    
    float n = noise(uv * u_scale + time * 0.5 + audio * 2.0);
    float glow = 0.01 / abs(n - length(uv) * 0.5);
    
    vec3 col = u_color * glow;
    col += glow * audio; // Éclaircissement sur les pics audio
    
    gl_FragColor = vec4(col, 1.0);
}
