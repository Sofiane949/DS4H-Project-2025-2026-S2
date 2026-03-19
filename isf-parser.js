/**
 * ISF (Interactive Shader Format) Parser
 *
 * Responsibilities:
 *   - Extract and validate the JSON metadata block from ISF shader source
 *   - Map ISF input types to GLSL uniform declarations
 *   - Provide sensible default values for all input types
 *
 * ISF spec reference: https://github.com/mrRay/ISF_Spec
 */

/** Maps ISF input types → GLSL uniform types */
const ISF_TO_GLSL = {
    float:    'float',
    bool:     'bool',
    long:     'int',
    color:    'vec4',
    point2D:  'vec2',
    image:    'sampler2D',
    audio:    'sampler2D',
    audioFFT: 'sampler2D',
};

/**
 * Parse an ISF shader source string.
 *
 * @param {string} source - Full shader source (JSON comment + GLSL body)
 * @returns {{ metadata: object, glslCode: string }}
 * @throws {Error} if metadata is missing or invalid JSON
 */
export function parseISF(source) {
    // ISF metadata lives in the very first block comment /* { … } */
    const match = source.match(/^[\s]*\/\*([\s\S]*?)\*\//);
    if (!match) {
        throw new Error(
            'No ISF metadata found. The shader must begin with a JSON block comment.'
        );
    }

    let metadata;
    try {
        metadata = JSON.parse(match[1].trim());
    } catch (e) {
        throw new Error(`Invalid ISF JSON metadata: ${e.message}`);
    }

    // Everything after the metadata comment is the GLSL body
    const glslCode = source.slice(match[0].length);
    return { metadata, glslCode };
}

/**
 * Build GLSL uniform declarations for all inputs listed in metadata.INPUTS.
 *
 * @param {object[]} inputs - The INPUTS array from ISF metadata
 * @returns {string} One `uniform <type> <name>;` line per recognised input
 */
export function buildUniformDeclarations(inputs = []) {
    const lines = [];
    for (const input of inputs) {
        const glslType = ISF_TO_GLSL[input.TYPE];
        if (!glslType) continue;
        lines.push(`uniform ${glslType} ${input.NAME};`);
        // ISF spec: image inputs come with companion size / rect uniforms
        if (input.TYPE === 'image' || input.TYPE === 'audio' || input.TYPE === 'audioFFT') {
            lines.push(`uniform vec2 _${input.NAME}_imgSize;`);
            lines.push(`uniform vec4 _${input.NAME}_imgRect;`);
        }
    }
    return lines.join('\n');
}

/**
 * Return a sensible default value for an ISF input.
 * Falls back to type-appropriate zero values when DEFAULT is not defined.
 *
 * @param {object} input - A single entry from the ISF INPUTS array
 * @returns {number|boolean|number[]} Default value in JS representation
 */
export function getDefaultValue(input) {
    if (input.DEFAULT !== undefined) return input.DEFAULT;

    switch (input.TYPE) {
        case 'float':
            // Midpoint of [MIN, MAX] if bounds are given, else 0
            return input.MIN !== undefined
                ? (input.MIN + (input.MAX ?? 1)) / 2
                : 0;
        case 'long':    return 0;
        case 'bool':    return false;
        case 'color':   return [0, 0, 0, 1];
        case 'point2D': return [0, 0];
        default:        return null;
    }
}
