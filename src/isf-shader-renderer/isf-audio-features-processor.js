const clamp01 = (v) => Math.max(0, Math.min(1, v));

class IsfAudioFeaturesProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [];
  }

  constructor() {
    super();

    this.config = {
      gain: 3.0,
      curve: 0.6,
      featureRate: 60,
      attack: 0.45,
      release: 0.08,
    };

    this.lpLow = 0;
    this.lpMid = 0;
    this.hpMid = 0;
    this.lows = 0;
    this.mids = 0;
    this.highs = 0;
    this.level = 0;

    this.samplesUntilPost = 1;
    this.updatePostInterval();

    this.port.onmessage = (event) => {
      if (event.data && event.data.type === "config") {
        this.config = {
          ...this.config,
          ...(event.data.config || {}),
        };
        this.updatePostInterval();
      }
    };
  }

  updatePostInterval() {
    const rate = Math.max(10, Number(this.config.featureRate) || 60);
    this.postIntervalSamples = Math.max(1, Math.floor(sampleRate / rate));
  }

  smoothStep(current, target) {
    const attack = clamp01(Number(this.config.attack) || 0.45);
    const release = clamp01(Number(this.config.release) || 0.08);
    const coeff = target > current ? attack : release;
    return current + (target - current) * coeff;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }

    const channels = input;
    const channelCount = channels.length;
    const frameSize = channels[0].length;

    let sumSq = 0;

    // Simple low-cost band splitting by one-pole filtering of |x|.
    const alphaLow = 0.04;
    const alphaMid = 0.12;

    for (let i = 0; i < frameSize; i += 1) {
      let mono = 0;
      for (let c = 0; c < channelCount; c += 1) {
        mono += channels[c][i];
      }
      mono /= channelCount;

      const x = Math.abs(mono);
      sumSq += mono * mono;

      this.lpLow += alphaLow * (x - this.lpLow);
      this.lpMid += alphaMid * (x - this.lpMid);

      const lowBand = this.lpLow;
      const midBand = Math.max(this.lpMid - this.lpLow, 0);
      const highBand = Math.max(x - this.lpMid, 0);

      this.lows = this.smoothStep(this.lows, lowBand);
      this.mids = this.smoothStep(this.mids, midBand);
      this.highs = this.smoothStep(this.highs, highBand);
    }

    const rms = Math.sqrt(sumSq / frameSize);
    this.level = this.smoothStep(this.level, rms);

    this.samplesUntilPost -= frameSize;
    if (this.samplesUntilPost <= 0) {
      this.samplesUntilPost += this.postIntervalSamples;

      const gain = Number(this.config.gain) || 1;
      const curve = Number(this.config.curve) || 1;
      const shape = (v) => clamp01(Math.pow(clamp01(v * gain), curve));

      this.port.postMessage({
        type: "features",
        features: {
          level: shape(this.level),
          lows: shape(this.lows),
          mids: shape(this.mids),
          highs: shape(this.highs),
        },
      });
    }

    return true;
  }
}

registerProcessor("isf-audio-features-processor", IsfAudioFeaturesProcessor);
