/*{
    "DESCRIPTION": "Colorize / invert effect — takes an image input from a chained renderer",
    "CREDIT": "DS4H Tutorship Project",
    "ISFVSN": "2",
    "CATEGORIES": ["Filter"],
    "INPUTS": [
        {
            "NAME": "inputImage",
            "TYPE": "image"
        },
        {
            "NAME": "invertAmt",
            "TYPE": "float",
            "DEFAULT": 0.0,
            "MIN": 0.0,
            "MAX": 1.0,
            "LABEL": "Invert"
        },
        {
            "NAME": "hue",
            "TYPE": "float",
            "DEFAULT": 0.0,
            "MIN": 0.0,
            "MAX": 1.0,
            "LABEL": "Hue"
        },
        {
            "NAME": "saturation",
            "TYPE": "float",
            "DEFAULT": 0.0,
            "MIN": 0.0,
            "MAX": 1.0,
            "LABEL": "Saturation"
        },
        {
            "NAME": "brightness",
            "TYPE": "float",
            "DEFAULT": 0.0,
            "MIN": -0.5,
            "MAX": 0.5,
            "LABEL": "Brightness"
        }
    ]
}*/

// ── HSV helpers ──────────────────────────────────────────────────────────────

vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)),
                d / (q.x + 1e-10),
                q.x);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// ────────────────────────────────────────────────────────────────────────────

void main() {
    vec4 src = texture2D(inputImage, isf_FragNormCoord);

    // Invert
    vec3 col = mix(src.rgb, 1.0 - src.rgb, invertAmt);

    // HSV adjustments (hue rotation + saturation boost)
    vec3 hsv = rgb2hsv(col);
    hsv.x    = fract(hsv.x + hue);
    hsv.y    = clamp(hsv.y + saturation, 0.0, 1.0);
    col      = hsv2rgb(hsv);

    // Brightness offset
    col = clamp(col + brightness, 0.0, 1.0);

    gl_FragColor = vec4(col, src.a);
}
