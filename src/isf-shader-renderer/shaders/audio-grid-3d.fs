/*{
  "CREDIT": "DS4H Prototype",
  "DESCRIPTION": "Grille pseudo-3D audio-reactive",
  "INPUTS": [
    {
      "NAME": "audioLows",
      "TYPE": "float",
      "MIN": 0.0,
      "MAX": 1.0,
      "DEFAULT": 0.0
    },
    {
      "NAME": "audioMids",
      "TYPE": "float",
      "MIN": 0.0,
      "MAX": 1.0,
      "DEFAULT": 0.0
    },
    {
      "NAME": "audioHighs",
      "TYPE": "float",
      "MIN": 0.0,
      "MAX": 1.0,
      "DEFAULT": 0.0
    },
    {
      "NAME": "deformAmount",
      "TYPE": "float",
      "MIN": 0.0,
      "MAX": 2.0,
      "DEFAULT": 0.75
    },
    {
      "NAME": "gridScale",
      "TYPE": "float",
      "MIN": 3.0,
      "MAX": 24.0,
      "DEFAULT": 12.0
    },
    {
      "NAME": "brightness",
      "TYPE": "float",
      "MIN": 0.0,
      "MAX": 2.0,
      "DEFAULT": 1.0
    }
  ]
}*/

precision highp float;

uniform vec2 RENDERSIZE;
uniform float TIME;

uniform float audioLows;
uniform float audioMids;
uniform float audioHighs;
uniform float deformAmount;
uniform float gridScale;
uniform float brightness;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float grid(vec2 uv, float width) {
  vec2 gv = abs(fract(uv) - 0.5);
  float line = min(gv.x, gv.y);
  return 1.0 - smoothstep(0.0, width, line);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * RENDERSIZE) / min(RENDERSIZE.x, RENDERSIZE.y);

  float bassPulse = audioLows;
  float midWarp = audioMids;
  float highSpark = audioHighs;

  float depth = 1.5 + uv.y * 2.2;
  vec2 p = uv;
  p.y += 0.14 * sin(TIME * (1.6 + 3.0 * midWarp) + p.x * 4.0) * (0.5 + 1.2 * midWarp);
  p.x += 0.12 * cos(TIME * (1.2 + 5.0 * bassPulse) + p.y * 7.0) * deformAmount * (0.25 + 1.6 * bassPulse);

  float perspective = 1.0 / max(0.25, depth + 0.55 * bassPulse);
  vec2 gUv = p * gridScale * perspective;

  float g = grid(gUv, 0.04 + 0.05 * highSpark);
  float lane = grid(gUv * vec2(1.0, 0.5), 0.035);
  float pulse = 0.35 + 0.65 * sin(TIME * (1.0 + 7.0 * bassPulse) + p.y * 10.0);

  vec3 base = mix(vec3(0.02, 0.03, 0.06), vec3(0.05, 0.24, 0.21), clamp(uv.y + 0.5, 0.0, 1.0));
  vec3 neon = vec3(0.15 + bassPulse * 1.1, 0.6 + midWarp * 0.7, 0.85 + highSpark * 0.45);

  float sparkle = step(0.995 - 0.12 * highSpark, hash21(gl_FragCoord.xy + TIME));
  vec3 color = base;
  color += neon * g * (0.7 + pulse * 1.1);
  color += neon.bgr * lane * 0.25;
  color += vec3(1.0, 0.9, 0.8) * sparkle * (0.5 + 1.5 * highSpark);

  color *= brightness;
  color = pow(color, vec3(0.88));

  gl_FragColor = vec4(color, 1.0);
}
