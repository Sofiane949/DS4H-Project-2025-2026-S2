import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 8080;

// Middleware pour ajouter les headers CORS et de sécurité WAM
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Ces headers sont cruciaux pour les WAM et le partage de ressources
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    
    next();
});

// Servir le dossier racine pour accéder à index.html et aux fichiers sources
app.use(express.static(__dirname));
// Servir aussi le dossier 'dist' (optionnel si tout est déjà à la racine)
app.use(express.static(path.join(__dirname, 'dist')));

app.listen(port, () => {
    console.log(`WAM Server running at http://localhost:${port}/`);
    console.log(`URL pour le testeur : http://localhost:${port}/index.js`);
});
