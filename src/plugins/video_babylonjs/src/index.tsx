import { WebAudioModule, WamNode } from "@webaudiomodules/sdk"
import { BabylonRunner } from "./BabylonRunner"

declare var window: any;

export default class VideoBabylonJS extends WebAudioModule<any> {
	_node: any
	_runner: BabylonRunner

	get isVideoPlugin() { return true; }

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
		
		const analyser = this.audioContext.createAnalyser();
		analyser.smoothingTimeConstant = 0.3;
		node.analyser = analyser;
		node.connect(analyser);

		if (window.WAMExtensions && window.WAMExtensions.video) {
			window.WAMExtensions.video.setDelegate((this as any).instanceId || node.instanceId, {
				connectVideo: (options: any) => {
					this._runner = new BabylonRunner(options);
				},
				config: () => {
					return { numberOfInputs: 1, numberOfOutputs: 1 };
				},
				render: (inputs: WebGLTexture[], currentTime: number): WebGLTexture[] => {
					if (!this._runner) return inputs;
					const fftArray = new Float32Array(node.analyser.frequencyBinCount);
					node.analyser.getFloatFrequencyData(fftArray);
					return this._runner.render(inputs, null, currentTime, {}, fftArray);
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
		div.style.backgroundColor = "#111";
		div.style.color = "#00ffcc";
		div.style.display = "flex";
		div.style.alignItems = "center";
		div.style.justifyContent = "center";
		div.innerHTML = "<h2>BABYLON 3D</h2>";
		return div
	}
}
