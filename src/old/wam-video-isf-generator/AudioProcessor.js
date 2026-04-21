/**
 * AudioProcessor.js
 * Ce processeur s'exécute dans un AudioWorklet pour analyser l'audio entrant
 * et envoyer les données spectrales (FFT) et de volume (RMS) au moteur visuel.
 */
class ISFVisualizerProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.port.onmessage = (event) => {
            // Pour recevoir des commandes si nécessaire
        };
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0]; // Flux audio entrant (ex: instruments)
        
        if (input && input.length > 0) {
            const channelData = input[0]; // On prend le premier canal mono
            
            // Calcul du RMS (Volume global)
            let sum = 0;
            for (let i = 0; i < channelData.length; i++) {
                sum += channelData[i] * channelData[i];
            }
            const rms = Math.sqrt(sum / channelData.length);

            // On envoie les données au thread principal (GUI / Renderer)
            // Note: Pour une FFT réelle, on utiliserait un AnalyserNode dans le thread principal,
            // mais on passe ici le volume brut pour la réactivité de base.
            this.port.postMessage({
                type: 'AUDIO_DATA',
                rms: rms,
                buffer: channelData // On peut passer le buffer brut pour une FFT côté JS
            });
        }

        // On laisse passer l'audio vers la sortie (Transparent)
        for (let i = 0; i < input.length; i++) {
            outputs[0][i].set(input[i]);
        }

        return true;
    }
}

registerProcessor('isf-visualizer-processor', ISFVisualizerProcessor);
