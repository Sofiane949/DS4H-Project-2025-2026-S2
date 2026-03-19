/*{
    "DESCRIPTION": "Radial ripple / pulse — reacts well to audio amplitude",
    "CREDIT": "ISF Renderer Phase 5",
    "ISFVSN": "2",
    "INPUTS": [
        { "NAME": "rings",      "TYPE": "float", "MIN": 1.0,  "MAX": 20.0, "DEFAULT": 6.0,  "LABEL": "Rings" },
        { "NAME": "speed",      "TYPE": "float", "MIN": 0.0,  "MAX": 8.0,  "DEFAULT": 1.5,  "LABEL": "Speed" },
        { "NAME": "radius",     "TYPE": "float", "MIN": 0.05, "MAX": 1.0,  "DEFAULT": 0.5,  "LABEL": "Radius" },
        { "NAME": "sharp",      "TYPE": "float", "MIN": 0.5,  "MAX": 20.0, "DEFAULT": 4.0,  "LABEL": "Sharp" },
        { "NAME": "hue",        "TYPE": "float", "MIN": 0.0,  "MAX": 1.0,  "DEFAULT": 0.95, "LABEL": "Hue" },
        { "NAME": "glow",       "TYPE": "float", "MIN": 0.0,  "MAX": 3.0,  "DEFAULT": 1.0,  "LABEL": "Glow" },
        { "NAME": "invert",     "TYPE": "bool",  "DEFAULT": false,          "LABEL": "Invert" }
    ]
}*/

precision highp float;

// -- HSV → RGB helper ---------------------------------------------------------
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    // Normalised coords centred on canvas, aspect-corrected
    vec2 uv  = isf_FragNormCoord - 0.5;
    float asp = RENDERSIZE.x / RENDERSIZE.y;
    uv.x *= asp;

    float dist = length(uv);                         // 0 at centre
    float phase = dist * rings - TIME * speed;       // ripple phase
    float wave  = sin(phase * 6.2831853);            // oscillation

    // Smooth falloff beyond 'radius'
    float fade  = 1.0 - smoothstep(radius * 0.85, radius, dist);
    float v     = pow(max(0.0, wave * 0.5 + 0.5), sharp) * fade * glow;

    vec3 col = hsv2rgb(vec3(hue + dist * 0.15, 0.85, v));

    if (invert) col = 1.0 - col;

    gl_FragColor = vec4(col, 1.0);
}
