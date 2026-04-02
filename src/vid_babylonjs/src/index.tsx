import { WebAudioModule, WamNode } from "@webaudiomodules/sdk"
import { BabylonRunner } from "./BabylonRunner"

declare var window: any;

export default class VideoBabylonJS extends WebAudioModule<any> {
	_runner: any
	_node: any

	// On surcharge createInstance pour injecter le contexte de façon chirurgicale
	static async createInstance(audioContext: BaseAudioContext, initialState?: any) {
		// @ts-ignore
		const instance = new VideoBabylonJS();
		
		// Technique pour contourner le "getter-only" : on redéfinit la propriété
		Object.defineProperty(instance, 'audioContext', {
			value: audioContext,
			configurable: true,
			enumerable: true,
			writable: true
		});

		// On fait pareil pour 'context' au cas où
		Object.defineProperty(instance, 'context', {
			value: audioContext,
			configurable: true,
			enumerable: true,
			writable: true
		});
		
		if (instance.initialize) {
			await instance.initialize(initialState);
		}
		
		return instance;
	}

	async createAudioNode(initialState?: any) {
		const ctx = this.audioContext;
		
		if (!ctx) {
			console.error("BABYLON WAM: AudioContext est toujours undefined malgré l'injection !");
			throw new Error("Context initialization failed.");
		}

		const id = "video-babylon-wam";
		(this as any)._moduleId = id;

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
		
		try {
			await ctx.audioWorklet.addModule(url);
		} catch (e) {
			console.log("Module déjà chargé");
		}
		
		// Création du noeud avec une sécurité supplémentaire
		let node;
		try {
			node = new (WamNode as any)(this, {
				processorId: id,
				initialState
			});
		} catch (e) {
			console.warn("Échec constructeur WamNode standard, tentative alternative...");
			node = new AudioWorkletNode(ctx, id, {
				processorOptions: { moduleId: id, instanceId: (this as any).instanceId }
			});
		}

		const analyser = ctx.createAnalyser();
		analyser.smoothingTimeConstant = 0.3;
		(node as any).analyser = analyser;
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
		div.innerHTML = `<div style="color: #00ffcc; padding: 10px; background: #222; border: 1px solid #00ffcc; text-align:center;">
			<b>BABYLON WAM ACTIVE</b><br>Audio Context OK
		</div>`;
		return div;
	}
}
