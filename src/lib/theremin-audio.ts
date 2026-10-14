import { DEFAULT_REVERB, MAX_FREQ, MIN_FREQ, type Waveform } from "@/lib/pitch";

const WAVE_GAIN: Record<Waveform, number> = {
  sine: 1,
  triangle: 0.86,
  square: 0.62,
  sawtooth: 0.56,
};

function makeImpulse(ctx: AudioContext) {
  const seconds = 2.15;
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const impulse = ctx.createBuffer(2, length, rate);
  const taps = [0.011, 0.019, 0.031, 0.047, 0.067, 0.091];
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const n = i / length;
      data[i] = (Math.random() * 2 - 1) * (1 - n) ** 3.1;
    }
    for (let tap = 0; tap < taps.length; tap++) {
      const idx = Math.floor(taps[tap] * rate);
      if (idx < length) {
        const sign = (channel === 0) === (tap % 2 === 0) ? 1 : -1;
        data[idx] += sign * (0.65 - tap * 0.07);
      }
    }
    let peak = 0;
    for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(data[i]));
    const scale = peak > 0 ? 0.85 / peak : 1;
    for (let i = 0; i < length; i++) data[i] *= scale;
  }
  return impulse;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Continuous theremin voice.
 * Pitch glides, a still hand blooms into vibrato, and louder notes open the filter.
 */
export class ThereminEngine {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private voice: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private lfoGain: GainNode | null = null;
  private dry: GainNode | null = null;
  private wet: GainNode | null = null;
  private preDelay: DelayNode | null = null;
  private mute: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private wave = new Uint8Array(new ArrayBuffer(1024));
  private waveform: Waveform = "sine";
  private reverb = DEFAULT_REVERB;
  private muted = false;
  private disposed = false;
  private sounding = false;

  start() {
    if (this.disposed) return;
    if (!this.ctx) this.build();
    if (this.ctx && this.ctx.state !== "running") void this.ctx.resume();
  }

  private build() {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx({ latencyHint: "interactive" });
    this.ctx = ctx;

    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc.type = this.waveform;
    osc2.type = this.waveform;
    osc.frequency.value = 440;
    osc2.frequency.value = 440;
    osc2.detune.value = 7;

    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 5.15;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.detune);
    lfoGain.connect(osc2.detune);

    const body = ctx.createGain();
    body.gain.value = 0.24;
    const mix = ctx.createGain();
    osc.connect(mix);
    osc2.connect(body);
    body.connect(mix);

    const voice = ctx.createGain();
    voice.gain.value = 0;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1800;
    filter.Q.value = 0.55;

    const hip = ctx.createBiquadFilter();
    hip.type = "highpass";
    hip.frequency.value = 70;
    hip.Q.value = 0.7;

    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const preDelay = ctx.createDelay(0.08);
    preDelay.delayTime.value = 0.02;
    const convolver = ctx.createConvolver();
    convolver.buffer = makeImpulse(ctx);
    const wetFilter = ctx.createBiquadFilter();
    wetFilter.type = "lowpass";
    wetFilter.frequency.value = 4800;

    const sum = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 16;
    comp.ratio.value = 3;
    comp.attack.value = 0.006;
    comp.release.value = 0.16;

    const tap = ctx.createGain();
    const mute = ctx.createGain();
    mute.gain.value = this.muted ? 0 : 1;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.72;

    mix.connect(voice);
    voice.connect(filter);
    filter.connect(hip);
    hip.connect(dry);
    hip.connect(preDelay);
    preDelay.connect(convolver);
    convolver.connect(wetFilter);
    wetFilter.connect(wet);
    dry.connect(sum);
    wet.connect(sum);
    sum.connect(comp);
    comp.connect(tap);
    tap.connect(mute);
    tap.connect(analyser);
    mute.connect(ctx.destination);

    osc.start();
    osc2.start();
    lfo.start();

    this.osc = osc;
    this.osc2 = osc2;
    this.voice = voice;
    this.filter = filter;
    this.lfoGain = lfoGain;
    this.dry = dry;
    this.wet = wet;
    this.preDelay = preDelay;
    this.mute = mute;
    this.analyser = analyser;
    this.applyReverb(this.reverb);
  }

  setWaveform(type: Waveform) {
    this.waveform = type;
    if (this.osc) this.osc.type = type;
    if (this.osc2) this.osc2.type = type;
  }

  setReverb(amount: number) {
    this.reverb = clamp(amount, 0, 1);
    this.applyReverb(this.reverb);
  }

  private applyReverb(amount: number) {
    if (!this.ctx || !this.dry || !this.wet || !this.preDelay) return;
    const now = this.ctx.currentTime;
    this.dry.gain.setTargetAtTime(1 - amount * 0.38, now, 0.04);
    this.wet.gain.setTargetAtTime(amount * 0.82, now, 0.04);
    this.preDelay.delayTime.setTargetAtTime(0.01 + amount * 0.028, now, 0.05);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (!this.ctx || !this.mute) return;
    const now = this.ctx.currentTime;
    this.mute.gain.cancelScheduledValues(now);
    this.mute.gain.setTargetAtTime(muted ? 0 : 1, now, 0.012);
  }

  play(freq: number, level: number, motion: number) {
    if (!this.ctx || !this.voice || !this.osc || !this.osc2 || !this.filter || !this.lfoGain) return;
    if (!Number.isFinite(freq)) return;
    const now = this.ctx.currentTime;
    const safe = clamp(freq, MIN_FREQ, MAX_FREQ);
    const shaped = clamp(level, 0, 1) ** 1.75;
    const amp = shaped * 0.34 * WAVE_GAIN[this.waveform];

    this.voice.gain.cancelScheduledValues(now);
    this.voice.gain.setTargetAtTime(amp, now, 0.028);

    this.osc.frequency.cancelScheduledValues(now);
    this.osc.frequency.setTargetAtTime(safe, now, 0.04);
    this.osc2.frequency.cancelScheduledValues(now);
    this.osc2.frequency.setTargetAtTime(safe, now, 0.055);

    const cutoff = clamp(safe * (2.3 + clamp(level, 0, 1) * 6.2), 420, 9200);
    this.filter.frequency.cancelScheduledValues(now);
    this.filter.frequency.setTargetAtTime(cutoff, now, 0.07);

    const vibrato = 8.5 * (1 - clamp(motion, 0, 1));
    this.lfoGain.gain.cancelScheduledValues(now);
    this.lfoGain.gain.setTargetAtTime(vibrato, now, 0.12);
    this.sounding = amp > 0.001;
  }

  silence() {
    if (!this.ctx || !this.voice || !this.lfoGain) return;
    const now = this.ctx.currentTime;
    this.voice.gain.cancelScheduledValues(now);
    this.voice.gain.setTargetAtTime(0, now, 0.045);
    this.lfoGain.gain.setTargetAtTime(0, now, 0.08);
    this.sounding = false;
  }

  drawWave(ctx: CanvasRenderingContext2D, width: number, height: number, color: string) {
    ctx.clearRect(0, 0, width, height);
    ctx.beginPath();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = color;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (!this.analyser || !this.sounding) {
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }
    this.analyser.getByteTimeDomainData(this.wave);
    const step = Math.max(1, Math.floor(this.wave.length / Math.max(1, width)));
    for (let x = 0; x < width; x++) {
      const index = Math.min(this.wave.length - 1, x * step);
      const sample = this.wave[index] / 128 - 1;
      const y = height / 2 + sample * height * 0.4;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  dispose() {
    this.disposed = true;
    try {
      this.osc?.stop();
    } catch {
      /* already stopped */
    }
    try {
      this.osc2?.stop();
    } catch {
      /* already stopped */
    }
    void this.ctx?.close();
    this.ctx = null;
  }
}
