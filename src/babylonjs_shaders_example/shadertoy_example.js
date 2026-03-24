function createExampleScene(engine, canvas) {
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.ArcRotateCamera("camera", 0, Math.PI / 2.5, 12, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(canvas, true);

    // 1. Definition du Shadertoy (Plasma)
    BABYLON.Effect.ShadersStore["shadertoyPixelShader"] = `
        precision highp float;
        varying vec2 vUV;
        uniform float time;

        void main() {
            vec2 p = -1.0 + 2.0 * vUV;
            float cos_t = cos(time * 0.5);
            float sin_t = sin(time * 0.5);
            mat2 rot = mat2(cos_t, -sin_t, sin_t, cos_t);
            p = rot * p;

            float color = 0.0;
            color += sin((p.x * 10.0) + time);
            color += sin((p.y * 10.0) + time) / 2.0;
            color += sin((p.x * 10.0 + p.y * 10.0) + time);
            color += sin(sqrt(p.x * p.x + p.y * p.y) * 10.0 + time);

            vec3 finalColor = vec3(0.5 + 0.5 * sin(color + time), 
                                   0.5 + 0.5 * sin(color + time + 2.0), 
                                   0.5 + 0.5 * sin(color + time + 4.0));
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `;

    // 2. Creation d'une Texture Procedurale
    const proceduralTexture = new BABYLON.ProceduralTexture("stTexture", 512, "shadertoy", scene);
    proceduralTexture.setFloat("time", 0);

    // 3. Materiau Standard utilisant cette texture
    const mat = new BABYLON.StandardMaterial("mat", scene);
    mat.diffuseTexture = proceduralTexture;
    mat.emissiveColor = new BABYLON.Color3(1, 1, 1);

    // 4. Creation de plusieurs objets
    const torus = BABYLON.MeshBuilder.CreateTorus("torus", { thickness: 0.5, diameter: 4 }, scene);
    torus.material = mat;

    const sphere = BABYLON.MeshBuilder.CreateSphere("sphere", { diameter: 2 }, scene);
    sphere.position.y = 3;
    sphere.material = mat;

    // Animation
    let time = 0;
    scene.registerBeforeRender(() => {
        time += engine.getDeltaTime() / 1000;
        proceduralTexture.setFloat("time", time);
        torus.rotation.y += 0.01;
        torus.rotation.x += 0.005;
    });

    return scene;
}
