/**
 * Preset API client
 *
 * Thin wrapper around the backend REST endpoints.
 * All functions throw an Error if the request fails or returns a non-2xx status.
 */

const BASE = '/api/presets';

async function _unwrap(res) {
    if (res.ok) return res.status === 204 ? null : res.json();
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
}

/** @returns {Promise<object[]>} All saved presets */
export async function fetchPresets() {
    return _unwrap(await fetch(BASE));
}

/**
 * Save a new preset.
 * @param {string} name
 * @param {string} shader   — shader file name (without .fs)
 * @param {object} params   — current parameter values
 * @returns {Promise<object>} The created preset (with generated id)
 */
export async function savePreset(name, shader, params) {
    return _unwrap(await fetch(BASE, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, shader, params }),
    }));
}

/**
 * Update an existing preset (rename and/or change params).
 * @param {string} id
 * @param {{ name?: string, params?: object }} updates
 * @returns {Promise<object>} The updated preset
 */
export async function updatePreset(id, updates) {
    return _unwrap(await fetch(`${BASE}/${id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(updates),
    }));
}

/**
 * Delete a preset.
 * @param {string} id
 */
export async function deletePreset(id) {
    return _unwrap(await fetch(`${BASE}/${id}`, { method: 'DELETE' }));
}
