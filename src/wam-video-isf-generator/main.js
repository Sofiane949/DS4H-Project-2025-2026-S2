/**
 * main.js
 * Point d'entrée principal du WAM visuel.
 * Orchestre le processeur audio, le moteur de rendu et l'interface.
 */
import ISFVisualizerWAM from './index.js';

const btn = document.getElementById('start-btn');

btn.addEventListener('click', async () => {
    btn.style.display = 'none';
    
    // 1. Initialiser le contexte audio
    const audioContext = new AudioContext();
    await audioContext.resume();
    
    // 2. Récupérer l'entrée micro pour le test
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = audioContext.createMediaStreamSource(stream);
    
    // 3. Créer et initialiser l'instance du WAM
    // On passe un groupId (ex: "test") et l'audioContext
    const wam = await ISFVisualizerWAM.createInstance("test-group", audioContext);
    const audioNode = wam.audioNode;
    
    // 4. Connecter l'audio
    source.connect(audioNode);
    audioNode.connect(audioContext.destination);
    
    // 5. Créer l'interface (GUI) et l'ajouter au DOM
    const gui = await wam.createGui();
    const wamContainer = document.getElementById('wam-container');
    if (wamContainer) {
        wamContainer.appendChild(gui);
    } else {
        document.body.appendChild(gui);
    }

    // 6. Connecter la SORTIE VIDÉO au Canvas de preview
    // Le WAM ne s'occupe pas de l'affichage direct, il fournit une sortie
    const previewZone = document.getElementById('preview-zone');
    if (previewZone) {
        // On crée un canvas de destination dans la zone de preview
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = 600;
        outputCanvas.height = 450;
        previewZone.appendChild(outputCanvas);
        
        // On utilise la nouvelle méthode connectVideo du WAM
        wam.connectVideo(outputCanvas);
    }
    
    // 7. (Optionnel) Tester l'ENTRÉE VIDÉO pour le chaînage
    // On pourrait par exemple utiliser un élément <video> ou un autre canvas comme source
    const videoSource = document.createElement('video');
    videoSource.src = "https://www.w3schools.com/html/mov_bbb.mp4"; // Test video
    videoSource.crossOrigin = "anonymous";
    videoSource.loop = true;
    videoSource.muted = true;
    // videoSource.play(); // On peut l'activer pour tester le mélange

    // wam.setVideoInput(videoSource);
    
    console.log("WAM Visualizer démarré avec sortie connectée !");
}, { once: true });
