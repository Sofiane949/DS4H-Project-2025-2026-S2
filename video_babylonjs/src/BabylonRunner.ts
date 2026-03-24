// On utilise BABYLON en global pour éviter les erreurs d'import dynamique dans le séquenceur
declare var BABYLON: any;

export class BabylonRunner {
    options: any
    output?: WebGLTexture
    engine: any // BABYLON.Engine
    scene: any  // BABYLON.Scene
    renderTarget: any // BABYLON.RenderTargetTexture
    
    sphere: any // BABYLON.Mesh
    sphereMaterial: any // BABYLON.StandardMaterial
    externalTexture: any = null

    constructor(options: any) {
        this.options = options
        this.setup(options.gl)
    }

    destroy() {
        if (this.scene) this.scene.dispose()
        if (this.engine) this.engine.dispose()
    }

    setup(gl: WebGLRenderingContext) {
        // @ts-ignore
        this.engine = new BABYLON.Engine(gl, true);
        // @ts-ignore
        this.scene = new BABYLON.Scene(this.engine);
        
        // @ts-ignore
        const camera = new BABYLON.ArcRotateCamera("camera", 0, Math.PI / 3, 10, BABYLON.Vector3.Zero(), this.scene);
        // @ts-ignore
        const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), this.scene);

        // @ts-ignore
        this.sphere = BABYLON.MeshBuilder.CreateSphere("sphere", { diameter: 3 }, this.scene);
        // @ts-ignore
        this.sphereMaterial = new BABYLON.StandardMaterial("sphereMat", this.scene);
        // @ts-ignore
        this.sphereMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1);
        this.sphere.material = this.sphereMaterial;

        // @ts-ignore
        this.renderTarget = new BABYLON.RenderTargetTexture("output", 
            { width: this.options.width, height: this.options.height }, 
            this.scene
        );
        this.scene.customRenderTargets.push(this.renderTarget);
    }

    render(inputs: WebGLTexture[], generator: any, time: number, params: Record<string, any>, fft: any): WebGLTexture[] {
        if (inputs.length > 0 && inputs[0]) {
            const webGLTexture = inputs[0];
            if (!this.externalTexture) {
                // @ts-ignore
                this.externalTexture = new BABYLON.Texture(null, this.scene);
                // @ts-ignore
                const internalTexture = new BABYLON.InternalTexture(this.engine, BABYLON.InternalTextureSource.Unknown);
                // @ts-ignore
                internalTexture._webGLTexture = webGLTexture;
                internalTexture.width = this.options.width;
                internalTexture.height = this.options.height;
                // @ts-ignore
                this.externalTexture._texture = internalTexture;
                this.sphereMaterial.emissiveTexture = this.externalTexture;
            }
        }

        if (fft && fft.length > 0) {
            let bassSum = 0;
            for(let i=0; i<10; i++) bassSum += fft[i] || 0;
            const avgBass = (bassSum / 10) / 255;
            const scale = 1.0 + avgBass * 0.8;
            this.sphere.scaling.set(scale, scale, scale);
        }

        this.sphere.rotation.y += 0.01;
        this.scene.render();
        // @ts-ignore
        this.output = this.renderTarget.getInternalTexture()!._webGLTexture!;
        return [this.output!]
    }
}
