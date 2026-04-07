/**
 * main.js
 * Point d'entrée principal du WAM visuel.
 * Orchestre le processeur audio, le moteur de rendu et l'interface.
 */

class ISFVisualizerWAM {
    static async createInstance(audioContext) {
        // 1. Charger le processeur audio
        await audioContext.audioWorklet.addModule('AudioProcessor.js');
        const audioNode = new AudioWorkletNode(audioContext, 'isf-visualizer-processor');
        
        // 2. Créer l'interface graphique (Sliders uniquement)
        const gui = document.createElement('isf-visualizer-gui');

        // 3. Créer le Canvas de rendu (Invisible par défaut dans le DOM)
        const visualCanvas = document.createElement('canvas');
        visualCanvas.width = 800;
        visualCanvas.height = 600;

        // 4. Initialiser le moteur de rendu sur ce canvas
        const renderer = new ISFGeneratorRenderer(visualCanvas);

        // 5. Connecter les messages audio au moteur de rendu
        audioNode.port.onmessage = (event) => {
            if (event.data.type === 'AUDIO_DATA') {
                renderer.updateAudio(event.data.rms);
            }
        };

        // 6. Gérer les changements de paramètres en live
        gui.addEventListener('param-change', (e) => {
            renderer.updateParam(e.detail.name, e.detail.value);
        });

        // 7. Gérer les changements de shaders
        gui.addEventListener('shader-change', async (e) => {
            const shaderUrl = e.detail;
            if (shaderUrl === 'internal') {
                renderer.initDefaultShader();
            } else {
                try {
                    const response = await fetch(shaderUrl);
                    const code = await response.text();
                    renderer.loadShaderFromFile(code);
                } catch (err) {
                    console.error("Erreur lors du chargement du shader:", err);
                }
            }
        });

        return { audioNode, gui, visualCanvas, renderer };
    }
}

// Pour tester directement dans le navigateur
window.addEventListener('click', async () => {
    const audioContext = new AudioContext();
    await audioContext.resume();
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = audioContext.createMediaStreamSource(stream);
    
    // On récupère le canvas en plus du GUI et du Node
    const { audioNode, gui, visualCanvas } = await ISFVisualizerWAM.createInstance(audioContext);
    
    source.connect(audioNode);
    audioNode.connect(audioContext.destination);
    
    // On affiche l'interface du WAM
    document.body.appendChild(gui);

    // Pour le TEST : On affiche le canvas À CÔTÉ dans une zone de preview
    const previewZone = document.getElementById('preview-zone');
    if (previewZone) {
        previewZone.appendChild(visualCanvas);
    }
    
    console.log("WAM Visualizer démarré !");
}, { once: true });
