import { WebAudioModule, WamNode } from "@webaudiomodules/sdk"
import { BabylonRunner } from "./BabylonRunner"

declare var window: any;

export default class VideoBabylonJS extends WebAudioModule<any> {
	_node: any
	_runner: BabylonRunner

	async createAudioNode(initialState: any) {
		const id = this.moduleId; 
		
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
			// @ts-ignore
			await this.audioContext.audioWorklet.addModule(url);
		} catch (e) {}
		
		const node = new WamNode(this, { 
			processorId: id, 
			initialState 
		} as any) as any;
		
		// Ajout de l'analyseur audio pour le FFT (comme dans le plugin de Tom Burns)
		const analyser = this.audioContext.createAnalyser();
		analyser.smoothingTimeConstant = 0.3;
		node.analyser = analyser;
		node.connect(analyser);

		// ENREGISTREMENT DE L'EXTENSION VIDÉO
		// C'est ce bloc qui permet à Sequencer Party de "voir" ton moteur 3D
		if (window.WAMExtensions && window.WAMExtensions.video) {
			window.WAMExtensions.video.setDelegate(node.instanceId, {
				connectVideo: (options: any) => {
					console.log("BABYLON: connectVideo reçu de l'hôte");
					this._runner = new BabylonRunner(options);
				},
				config: () => {
					return { numberOfInputs: 1, numberOfOutputs: 1 };
				},
				render: (inputs: WebGLTexture[], currentTime: number): WebGLTexture[] => {
					if (!this._runner) return inputs;
					
					// Extraction du FFT pour la réactivité
					const fftArray = new Float32Array(node.analyser.frequencyBinCount);
					node.analyser.getFloatFrequencyData(fftArray);
					
					// Appel au rendu Babylon
					return this._runner.render(inputs, null, currentTime, {}, fftArray);
				},
				disconnectVideo: () => {
					console.log("BABYLON: disconnectVideo");
					if (this._runner) this._runner.destroy();
				}
			});
		}

		this._node = node;
		return node
	}

	async createGui() {
		const div = document.createElement("div")
		div.style.width = "100%";
		div.style.height = "100%";
		div.style.display = "flex";
		div.style.alignItems = "center";
		div.style.justifyContent = "center";
		div.style.backgroundColor = "#111";
		div.style.color = "#00ffcc";
		div.innerHTML = "<div style='text-align:center'><h2>BABYLON 3D</h2><p>Moteur spatialisé et connecté.</p></div>";
		return div
	}
}
