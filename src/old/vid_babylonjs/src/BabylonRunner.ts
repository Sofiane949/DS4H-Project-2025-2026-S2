// On utilise BABYLON en global pour éviter les erreurs d'import dynamique dans le séquenceur
declare var BABYLON: any;

export class BabylonRunner {
    options: any;
    scene: any; // BABYLON.Scene
    targetMesh: any; // BABYLON.Mesh
    targetMaterial: any; // BABYLON.StandardMaterial or PBRMaterial
    
    externalTexture: any = null;

    constructor(options: any) {
        this.options = options;
        // La création de l'engine et de la scène est maintenant déléguée à l'hôte.
    }

    /**
     * Attache le runner à un mesh cible dans une scène existante.
     * @param scene La scène Babylon.js globale de l'hôte.
     * @param targetMesh Le mesh sur lequel appliquer les effets audio-réactifs.
     */
    attachToTarget(scene: any, targetMesh: any) {
        this.scene = scene;
        this.targetMesh = targetMesh;

        // On s'assure que le mesh a un matériau
        if (!this.targetMesh.material) {
            // @ts-ignore
            this.targetMesh.material = new BABYLON.StandardMaterial("targetMat", this.scene);
        }
        this.targetMaterial = this.targetMesh.material;

        // Configuration initiale du matériau si c'est un StandardMaterial
        // @ts-ignore
        if (this.targetMaterial instanceof BABYLON.StandardMaterial) {
            // @ts-ignore
            this.targetMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1);
        }
    }

    destroy() {
        // On ne dispose plus de la scène ou de l'engine car ils appartiennent à l'hôte.
        if (this.externalTexture) {
            this.externalTexture.dispose();
            this.externalTexture = null;
        }
    }

    /**
     * Appelé à chaque frame pour mettre à jour les visuels en fonction de l'audio.
     */
    render(inputs: WebGLTexture[], generator: any, time: number, params: Record<string, any>, fft: any): WebGLTexture[] {
        if (!this.targetMesh || !this.scene) return inputs;

        // Debug FFT
        if (fft && fft.length > 0 && fft[0] > 0) {
            // console.log("Audio détecté ! Basses:", fft[0]);
        }

        // 1. Gestion de la texture d'entrée (vidéo)
        if (inputs.length > 0 && inputs[0]) {
            const webGLTexture = inputs[0];
            if (!this.externalTexture) {
                // @ts-ignore
                this.externalTexture = new BABYLON.Texture(null, this.scene);
                // @ts-ignore
                const internalTexture = new BABYLON.InternalTexture(this.scene.getEngine(), BABYLON.InternalTextureSource.Unknown);
                // @ts-ignore
                internalTexture._webGLTexture = webGLTexture;
                internalTexture.width = this.options.width || 512;
                internalTexture.height = this.options.height || 512;
                // @ts-ignore
                this.externalTexture._texture = internalTexture;

                // Application de la texture sur le matériau cible
                // On essaie plusieurs slots courants selon le type de matériau
                if (this.targetMaterial.emissiveTexture !== undefined) {
                    this.targetMaterial.emissiveTexture = this.externalTexture;
                } else if (this.targetMaterial.albedoTexture !== undefined) {
                    this.targetMaterial.albedoTexture = this.externalTexture;
                } else if (this.targetMaterial.diffuseTexture !== undefined) {
                    this.targetMaterial.diffuseTexture = this.externalTexture;
                }
            }
        }

        // 2. Logique de traitement audio (FFT)
        if (fft && fft.length > 0) {
            let bassSum = 0;
            // On prend les premières fréquences pour les basses
            const bassCount = Math.min(10, fft.length);
            for(let i=0; i<bassCount; i++) bassSum += fft[i] || 0;
            
            // Normalisation (dépend si fft est Float32Array [-100, 0] ou autre)
            // Dans l'original, c'était divisé par 255, suggérant des données [0, 255]
            const avgBass = (bassSum / bassCount) / 255;
            
            // On applique le scale sur le mesh cible
            const scale = 1.0 + Math.max(0, avgBass) * 0.8;
            this.targetMesh.scaling.set(scale, scale, scale);
        }

        // 3. Animation continue
        this.targetMesh.rotation.y += 0.01;

        // Note: On ne déclenche plus scene.render() car c'est l'hôte qui gère sa boucle de rendu.
        // On ne retourne pas de texture car on modifie directement le mesh de l'hôte.
        return inputs;
    }
}
