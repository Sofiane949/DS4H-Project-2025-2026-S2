import { WebAudioModule, WamNode } from "@webaudiomodules/sdk"
import getBabylonProcessor from "./BabylonProcessor"
import { BabylonRunner } from "./BabylonRunner"

export default class VideoBabylonJS extends WebAudioModule<any> {
	_node: any
	_runner: BabylonRunner

	async createAudioNode(initialState: any) {
		const moduleId = "video-babylonjs"
		// @ts-ignore
		await this.audioContext.audioWorklet.addModule(getBabylonProcessor(moduleId))
		
		const node = new WamNode(this, { 
			processorId: moduleId, 
			initialState 
		} as any)
		
		this._node = node
		return node
	}

	async createGui() {
		const div = document.createElement("div")
		div.innerHTML = "<h3 style='color:white; padding:20px'>Plugin Babylon de Sofiane</h3><p style='color:white; padding:0 20px'>Intégration ISF Réussie !</p>"
		return div
	}

	async createRunner(options: any) {
		this._runner = new BabylonRunner(options)
		return this._runner
	}
}
