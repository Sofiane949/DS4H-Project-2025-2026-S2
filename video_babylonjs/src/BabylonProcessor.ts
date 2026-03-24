const getBabylonProcessor = (moduleId: string) => {
	const audioWorkletGlobalScope: any = globalThis;
	const id = "com.webaudiomodule.default"; // On force l'ID attendu par l'hôte

	const ModuleScope = audioWorkletGlobalScope.webAudioModules.getModuleScope(id);
	const WamProcessor = ModuleScope.WamProcessor || audioWorkletGlobalScope.WamProcessor;

	if (!WamProcessor) return;

	class BabylonProcessor extends WamProcessor {
		_process(startSample: number, endSample: number, inputs: Float32Array[][], outputs: Float32Array[][]) {
			if (!inputs[0] || !outputs[0]) return;
			for (let i = 0; i < inputs[0].length; i++) {
				if (outputs[0][i] && inputs[0][i]) {
					outputs[0][i].set(inputs[0][i]);
				}
			}
		}
	}

	try {
		audioWorkletGlobalScope.registerProcessor(id, BabylonProcessor);
	} catch (e) { }
}

export default getBabylonProcessor;
