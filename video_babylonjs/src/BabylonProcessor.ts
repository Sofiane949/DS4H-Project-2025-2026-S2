const getBabylonProcessor = (moduleId: string) => {
	// Utilisation de any pour éviter l'erreur de namespace TS2709
	const audioWorkletGlobalScope: any = globalThis as any;
	const ModuleScope = audioWorkletGlobalScope.webAudioModules.getModuleScope(moduleId);

	const WamProcessor = ModuleScope.WamProcessor;
	const DynamicParameterProcessor = ModuleScope.DynamicParameterProcessor;

	class BabylonProcessor extends DynamicParameterProcessor {
		_process(startSample: number, endSample: number, inputs: Float32Array[][], outputs: Float32Array[][]) {
			if (inputs.length != outputs.length) return;
			for (let i = 0; i < inputs.length; i++) {
				for (let j = 0; j < inputs[i].length; j++) {
					for (let k = 0; k < inputs[i][j].length; k++) {
						outputs[i][j][k] = inputs[i][j][k]
					}
				}
			}
			return;
		}
	}

	try {
		audioWorkletGlobalScope.registerProcessor(moduleId, BabylonProcessor as any);
	} catch (error) {
		console.warn(error);
	}

	return BabylonProcessor
}

export default getBabylonProcessor;
