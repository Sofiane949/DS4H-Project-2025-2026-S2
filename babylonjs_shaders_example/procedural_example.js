function createExampleScene(engine, canvas) {
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, -10), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);

    const light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);

    // 1. Shader pour une texture procedurale de type "Grid"
    BABYLON.Effect.ShadersStore["gridPixelShader"] = `
        precision highp float;
        varying vec2 vUV;
        uniform float time;
        uniform float speed;

        void main() {
            vec2 p = vUV * 10.0;
            vec2 f = fract(p + vec2(0, time * speed));
            float grid = smoothstep(0.02, 0.0, abs(f.x - 0.5)) + 
                         smoothstep(0.02, 0.0, abs(f.y - 0.5));
            
            vec3 color = vec3(0.0, 1.0, 0.5) * grid;
            gl_FragColor = vec4(color, grid);
        }
    `;

    // 2. Texture Procedurale Custom
    const gridTexture = new BABYLON.CustomProceduralTexture("grid", "grid", 1024, scene);
    gridTexture.setFloat("speed", 2.0);
    gridTexture.hasAlpha = true;

    // 3. Application sur un sol (Ground) et un Cylindre
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 10, height: 10 }, scene);
    const groundMat = new BABYLON.StandardMaterial("gmat", scene);
    groundMat.diffuseTexture = gridTexture;
    groundMat.opacityTexture = gridTexture;
    groundMat.backFaceCulling = false;
    ground.material = groundMat;

    const cylinder = BABYLON.MeshBuilder.CreateCylinder("cyl", { diameter: 3, height: 5 }, scene);
    cylinder.position.y = 2.5;
    const cylMat = new BABYLON.StandardMaterial("cmat", scene);
    cylMat.diffuseTexture = gridTexture;
    cylMat.emissiveColor = new BABYLON.Color3(0, 0.5, 0.2);
    cylinder.material = cylMat;

    // Animation
    let time = 0;
    scene.registerBeforeRender(() => {
        time += engine.getDeltaTime() / 1000;
        gridTexture.setFloat("time", time);
        cylinder.rotation.y += 0.01;
    });

    return scene;
}
