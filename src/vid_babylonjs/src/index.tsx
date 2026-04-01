import { WebAudioModule, WamNode } from "@webaudiomodules/sdk"
import { BabylonRunner } from "./BabylonRunner"

declare var window: any;

export default class VideoBabylonJS extends WebAudioModule<any> {
	_runner: any
	_node: any

	async createAudioNode(initialState?: any) {
		// On force l'ID pour éviter les problèmes de descriptor.json manquant
		const id = "video-babylon-wam";
		(this as any)._moduleId = id;

		// Injection manuelle du processeur (méthode la plus robuste)
		const processorCode = `
			registerProcessor('${id}', class extends AudioWorkletProcessor {
				process(inputs, outputs) {
					if (inputs[0] && outputs[0]) {
						for (let i = 0; i < inputs[0].length; i++) {
							if (outputs[0][i] && inputs[0][i]) {
								outputs[0][i].set(inputs[0][i]);
							}
						}
					}
					return true;
				}
			});
		`;
		
		const url = "data:text/javascript;base64," + btoa(processorCode);
		await this.audioContext.audioWorklet.addModule(url);
		
		// Création du noeud
		const node = new (WamNode as any)(this, {
			processorId: id,
			initialState
		});

		// Configuration de l'analyseur
		const analyser = this.audioContext.createAnalyser();
		analyser.smoothingTimeConstant = 0.3;
		node.analyser = analyser;
		node.connect(analyser);

		this._node = node;
		return node;
	}

	public attachToMesh(scene: any, mesh: any) {
		if (!this._runner) {
			this._runner = new BabylonRunner({ width: 512, height: 512 });
		}
		this._runner.attachToTarget(scene, mesh);

		scene.onBeforeRenderObservable.add(() => {
			if (this._runner && this._node && this._node.analyser) {
				const fftArray = new Uint8Array(this._node.analyser.frequencyBinCount);
				this._node.analyser.getByteFrequencyData(fftArray);
				this._runner.render([], null, scene.getEngine().getDeltaTime(), {}, fftArray);
			}
		});
	}

	async createGui() {
		const div = document.createElement("div");
		div.innerHTML = `<div style="color: #00ffcc; padding: 10px;">BABYLON WAM READY</div>`;
		return div;
	}
}
