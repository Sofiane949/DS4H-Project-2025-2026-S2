function createExampleScene(engine, canvas) {
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 10, new BABYLON.Vector3(0, 0, 0), scene);
    camera.attachControl(canvas, true);
    
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

    // 1. Definition du Shader
    BABYLON.Effect.ShadersStore["basicVertexShader"] = `
        precision highp float;
        attribute vec3 position;
        attribute vec2 uv;
        uniform mat4 worldViewProjection;
        varying vec2 vUV;
        void main() {
            vUV = uv;
            gl_Position = worldViewProjection * vec4(position, 1.0);
        }
    `;

    BABYLON.Effect.ShadersStore["basicFragmentShader"] = `
        precision highp float;
        varying vec2 vUV;
        uniform float time;
        void main() {
            vec3 color1 = vec3(0.1, 0.5, 0.8);
            vec3 color2 = vec3(0.8, 0.2, 0.1);
            float pulse = sin(vUV.y * 20.0 + time * 2.0) * 0.5 + 0.5;
            vec3 finalColor = mix(color1, color2, pulse);
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `;

    // 2. Creation du Materiau
    const shaderMaterial = new BABYLON.ShaderMaterial("shader", scene, {
        vertex: "basic",
        fragment: "basic",
    }, {
        attributes: ["position", "uv"],
        uniforms: ["worldViewProjection", "time"]
    });

    // 3. Application sur des formes simples
    const box = BABYLON.MeshBuilder.CreateBox("box", { size: 2 }, scene);
    box.position.x = -2;
    box.material = shaderMaterial;

    const sphere = BABYLON.MeshBuilder.CreateSphere("sphere", { diameter: 2 }, scene);
    sphere.position.x = 2;
    sphere.material = shaderMaterial;

    // Animation
    let time = 0;
    scene.registerBeforeRender(() => {
        time += engine.getDeltaTime() / 1000;
        shaderMaterial.setFloat("time", time);
    });

    return scene;
}
