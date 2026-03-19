'use strict';

/**
 * ISF Renderer — Backend server
 *
 * Serves the frontend as static files and exposes a REST API for preset
 * persistence.  Presets are stored as JSON in ./data/presets.json.
 *
 * Usage:
 *   npm install
 *   npm start          (production)
 *   npm run dev        (auto-restart on file change)
 *
 * API:
 *   GET    /api/presets        → list all presets
 *   POST   /api/presets        → create preset  { name, shader, params }
 *   PUT    /api/presets/:id    → update preset  { name?, params? }
 *   DELETE /api/presets/:id    → delete preset
 */

const express = require('express');
const fs      = require('fs').promises;
const path    = require('path');
const crypto  = require('crypto');

const app          = express();
const PORT         = process.env.PORT || 8080;
const DATA_DIR     = path.join(__dirname, 'data');
const PRESETS_FILE = path.join(DATA_DIR, 'presets.json');

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json());
// Serve the entire project directory as static files (HTML, JS, shaders…)
app.use(express.static(path.join(__dirname)));

// ── Storage helpers ───────────────────────────────────────────────────────────

async function ensureStorage() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
        await fs.access(PRESETS_FILE);
    } catch {
        await fs.writeFile(PRESETS_FILE, '[]', 'utf8');
        console.log(`  Created ${PRESETS_FILE}`);
    }
}

async function readPresets() {
    const raw = await fs.readFile(PRESETS_FILE, 'utf8');
    return JSON.parse(raw);
}

async function writePresets(presets) {
    await fs.writeFile(PRESETS_FILE, JSON.stringify(presets, null, 2), 'utf8');
}

// ── REST API ──────────────────────────────────────────────────────────────────

// GET /api/presets — list all
app.get('/api/presets', async (_req, res) => {
    try {
        res.json(await readPresets());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/presets — create
app.post('/api/presets', async (req, res) => {
    try {
        const { name, shader, params } = req.body ?? {};

        if (!name?.trim())  return res.status(400).json({ error: '"name" is required' });
        if (!shader?.trim()) return res.status(400).json({ error: '"shader" is required' });

        const preset = {
            id:        crypto.randomUUID(),
            name:      name.trim(),
            shader:    shader.trim(),
            params:    params ?? {},
            createdAt: new Date().toISOString(),
        };

        const presets = await readPresets();
        presets.push(preset);
        await writePresets(presets);

        console.log(`  [+] preset saved: "${preset.name}" (${preset.shader})`);
        res.status(201).json(preset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/presets/:id — rename or update params
app.put('/api/presets/:id', async (req, res) => {
    try {
        const presets = await readPresets();
        const i = presets.findIndex(p => p.id === req.params.id);
        if (i === -1) return res.status(404).json({ error: 'Preset not found' });

        const { name, params } = req.body ?? {};
        if (name)   presets[i].name      = name.trim();
        if (params) presets[i].params    = params;
        presets[i].updatedAt = new Date().toISOString();

        await writePresets(presets);
        res.json(presets[i]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/presets/:id
app.delete('/api/presets/:id', async (req, res) => {
    try {
        const presets = await readPresets();
        const i = presets.findIndex(p => p.id === req.params.id);
        if (i === -1) return res.status(404).json({ error: 'Preset not found' });

        const [removed] = presets.splice(i, 1);
        await writePresets(presets);

        console.log(`  [-] preset deleted: "${removed.name}"`);
        res.status(204).end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Start ─────────────────────────────────────────────────────────────────────

ensureStorage().then(() => {
    app.listen(PORT, () => {
        console.log(`
  ┌─────────────────────────────────────────┐
  │  ISF Renderer  →  http://localhost:${PORT}  │
  │  API           →  /api/presets          │
  └─────────────────────────────────────────┘
`);
    });
}).catch(err => {
    console.error('Startup error:', err);
    process.exit(1);
});
