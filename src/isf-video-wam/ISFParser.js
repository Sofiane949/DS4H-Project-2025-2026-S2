
/**
 * ISFParser.js
 * Extrait les métadonnées et prépare les shaders pour WebGL.
 */

const typeUniformMap = {
  float: 'float',
  image: 'sampler2D',
  bool: 'bool',
  event: 'bool',
  long: 'int',
  color: 'vec4',
  point2D: 'vec2',
};

export default class ISFParser {
  constructor() {
    this.inputs = [];
    this.passes = [];
    this.metadata = {};
    this.fragmentShader = "";
    this.vertexShader = "";
  }

  parse(rawFragmentShader, rawVertexShader) {
    try {
      this.rawFragmentShader = rawFragmentShader;
      this.rawVertexShader = rawVertexShader || ISFParser.vertexShaderDefault;

      // Extraction simplifiée du JSON de métadonnées
      const regex = /\/\*([\s\S]*?)\*\//;
      const results = regex.exec(this.rawFragmentShader);
      if (!results) throw new Error('No metadata found in shader');

      const metadataString = results[1];
      this.metadata = JSON.parse(metadataString);
      this.inputs = this.metadata.INPUTS || [];
      this.passes = this.metadata.PASSES || [{}];

      const endOfMetadata = this.rawFragmentShader.indexOf('*/') + 2;
      this.rawFragmentMain = this.rawFragmentShader.substring(endOfMetadata);

      this.generateShaders();
    } catch (e) {
      console.error("ISFParser Error:", e);
      throw e;
    }
  }

  generateShaders() {
    this.uniformDefs = '';
    this.inputs.forEach(input => {
      const type = typeUniformMap[input.TYPE];
      this.uniformDefs += `uniform ${type} ${input.NAME};\n`;
      if (type === 'sampler2D') {
        this.uniformDefs += `uniform vec4 _${input.NAME}_imgRect;\n`;
        this.uniformDefs += `uniform vec2 _${input.NAME}_imgSize;\n`;
        this.uniformDefs += `uniform bool _${input.NAME}_flip;\n`;
      }
    });

    this.fragmentShader = ISFParser.fragmentShaderSkeleton
      .replace('[[uniforms]]', this.uniformDefs)
      .replace('[[main]]', this.replaceSpecialFunctions(this.rawFragmentMain));

    this.vertexShader = ISFParser.vertexShaderSkeleton
      .replace('[[uniforms]]', this.uniformDefs)
      .replace('[[main]]', this.rawVertexShader);
  }

  replaceSpecialFunctions(source) {
    let s = source;
    s = s.replace(/IMG_THIS_PIXEL\((.+?)\)/g, 'texture2D($1, isf_FragNormCoord)');
    s = s.replace(/IMG_THIS_NORM_PIXEL\((.+?)\)/g, 'texture2D($1, isf_FragNormCoord)');
    s = s.replace(/IMG_NORM_PIXEL\((.+?)\s?,\s?(.+?)\)/g, 'texture2D($1, $2)');
    s = s.replace(/IMG_SIZE\((.+?)\)/g, `_$1_imgSize`);
    return s;
  }
}

ISFParser.fragmentShaderSkeleton = `
precision highp float;
precision highp int;
uniform int PASSINDEX;
uniform vec2 RENDERSIZE;
varying vec2 isf_FragNormCoord;
uniform float TIME;
uniform float TIMEDELTA;
uniform int FRAMEINDEX;
uniform float AUDIO_RMS;

[[uniforms]]

[[main]]
`;

ISFParser.vertexShaderDefault = `
void main() {
  isf_vertShaderInit();
}
`;

ISFParser.vertexShaderSkeleton = `
precision highp float;
attribute vec2 isf_position;
uniform vec2 RENDERSIZE;
varying vec2 isf_FragNormCoord;

[[uniforms]]

void isf_vertShaderInit() {
  gl_Position = vec4(isf_position, 0.0, 1.0);
  isf_FragNormCoord = isf_position * 0.5 + 0.5;
}

[[main]]
`;
