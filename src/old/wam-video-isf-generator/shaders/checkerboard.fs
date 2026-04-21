precision mediump float;
uniform float TIME;
uniform float AUDIO_RMS;
uniform vec2 RENDERSIZE;

// Nouveaux paramètres Live
uniform vec3 u_color;
uniform float u_audio_gain;
uniform float u_speed;
uniform float u_scale;

void main() {
    vec2 uv = gl_FragCoord.xy / RENDERSIZE.xy;
    
    float time = TIME * u_speed;
    float audio = AUDIO_RMS * u_audio_gain;
    
    // On utilise u_scale pour la taille des carreaux
    float tiles = (5.0 + (audio * 20.0)) * u_scale;
    
    float angle = audio * 2.0 + time * 0.2;
    mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    vec2 rotatedUv = (uv - 0.5) * rotation + 0.5;
    
    vec2 check = floor(rotatedUv * tiles);
    float pattern = mod(check.x + check.y, 2.0);
    
    vec3 col = pattern * u_color;
    // On ajoute un peu de variation lumineuse avec le temps
    col *= 0.8 + 0.2 * sin(time);
    
    gl_FragColor = vec4(col, 1.0);
}
