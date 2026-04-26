/*{
    "DESCRIPTION": "Black and white checkerboard pattern",
    "CREDIT": "DS4H Tutorship Project",
    "ISFVSN": "2",
    "CATEGORIES": ["Generator"],
    "INPUTS": [
        {
            "NAME": "rows",
            "TYPE": "float",
            "DEFAULT": 8.0,
            "MIN": 1.0,
            "MAX": 32.0,
            "LABEL": "Rows"
        },
        {
            "NAME": "cols",
            "TYPE": "float",
            "DEFAULT": 8.0,
            "MIN": 1.0,
            "MAX": 32.0,
            "LABEL": "Columns"
        },
        {
            "NAME": "speed",
            "TYPE": "float",
            "DEFAULT": 0.0,
            "MIN": 0.0,
            "MAX": 5.0,
            "LABEL": "Speed"
        },
        {
            "NAME": "invert",
            "TYPE": "bool",
            "DEFAULT": false,
            "LABEL": "Invert"
        }
    ]
}*/

void main() {
    vec2 uv = isf_FragNormCoord;

    // Animated offset driven by TIME and speed
    float offset = TIME * speed * 0.5;

    float x = floor(uv.x * cols + offset);
    float y = floor(uv.y * rows);
    float checker = mod(x + y, 2.0);

    if (invert) checker = 1.0 - checker;

    gl_FragColor = vec4(vec3(checker), 1.0);
}
