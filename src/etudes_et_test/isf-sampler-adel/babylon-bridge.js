/**
 * BabylonBridge — Version ultra-compatible
 */
export class BabylonBridge {
    constructor(canvasId, isfRenderer) {
        this.canvas = document.getElementById(canvasId);
        this.isf = isfRenderer;
        
        if (!this.canvas) return;

        this.engine = new BABYLON.Engine(this.canvas, true);
        this.scene = new BABYLON.Scene(this.engine);
        // Fond légèrement bleuté pour voir si le cube est transparent ou noir
        this.scene.clearColor = new BABYLON.Color4(0.05, 0.05, 0.1, 1);

        this.dynamicTexture = null;
        this.cube = null;
        this.material = null;

        this._initScene();
        this._startLoop();
        this._waitForSource();
    }

    _initScene() {
        const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 6, BABYLON.Vector3.Zero(), this.scene);
        camera.attachControl(this.canvas, true);
        const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), this.scene);
        
        this.cube = BABYLON.MeshBuilder.CreateBox("cube", { size: 2.5 }, this.scene);
        this.material = new BABYLON.StandardMaterial("cubeMat", this.scene);
        
        // Couleur par défaut (gris) pour voir le cube même sans texture
        this.material.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
        this.material.emissiveColor = new BABYLON.Color3(1, 1, 1);
        this.cube.material = this.material;
    }

    _waitForSource() {
        const check = () => {
            const source = this.isf.canvas;
            if (source && source instanceof HTMLCanvasElement && source.width > 0) {
                console.log("BabylonBridge: Canvas source détecté (" + source.width + "x" + source.height + ")");
                
                // Utilisation de DynamicTexture avec le canvas source
                // On passe le canvas directement comme option de contexte
                this.dynamicTexture = new BABYLON.DynamicTexture("isfTex", source, this.scene, true);
                
                // On applique la texture sur tous les canaux pour être sûr
                this.material.diffuseTexture = this.dynamicTexture;
                this.material.emissiveTexture = this.dynamicTexture;
                this.material.disableLighting = true;
            } else {
                setTimeout(check, 100); // On vérifie toutes les 100ms
            }
        };
        check();
    }

    _startLoop() {
        this.engine.runRenderLoop(() => {
            // FORCE UPDATE : C'est ici que l'on copie l'image 2D vers la 3D
            if (this.dynamicTexture) {
                this.dynamicTexture.update(true); // 'true' pour inverser l'axe Y si besoin
            }

            if (this.cube) {
                this.cube.rotation.y += 0.01;
                this.cube.rotation.x += 0.005;
            }
            this.scene.render();
        });
        window.addEventListener("resize", () => this.engine.resize());
    }

    updateAudioReactivity(features) {
        if (!this.cube || !features) return;
        
        // Réactivité physique
        const scale = 1.0 + (features.bass * 1.5);
        this.cube.scaling.set(scale, scale, scale);
        
        // Réactivité lumineuse
        if (this.material) {
            const glow = 0.3 + (features.rms * 1.2);
            this.material.emissiveColor = new BABYLON.Color3(glow, glow, glow);
        }
    }
}
