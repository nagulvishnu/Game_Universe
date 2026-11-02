// Tiny WebAudio synth — no external assets, everything generated on the fly.
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  muted = false;

  init() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.6;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    } catch {
      this.ctx = null;
    }
  }

  private ready() {
    return !!(this.ctx && this.master && !this.muted);
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number) {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g).connect(this.master!);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  private noise(dur: number, gain: number, lowpass: number, highpass = 80) {
    if (!this.ready() || !this.noiseBuffer) return;
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(lowpass, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(Math.max(120, lowpass * 0.25), ctx.currentTime + dur);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = highpass;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    src.connect(hp).connect(filter).connect(g).connect(this.master!);
    src.start();
    src.stop(ctx.currentTime + dur);
  }

  shot(weapon: string) {
    if (weapon === "shotgun") {
      this.noise(0.32, 0.55, 2400, 60);
      this.tone(90, 0.22, "square", 0.16, 40);
    } else if (weapon === "rifle" || weapon === "smg") {
      this.noise(0.1, 0.28, 3400, 200);
      this.tone(180, 0.07, "square", 0.1, 60);
    } else if (weapon === "rocket") {
      this.noise(0.4, 0.35, 1600, 90);
      this.tone(70, 0.4, "sawtooth", 0.18, 200);
    } else if (weapon === "fists") {
      this.noise(0.08, 0.18, 900, 120);
    } else {
      this.noise(0.13, 0.34, 2800, 160);
      this.tone(150, 0.1, "square", 0.12, 55);
    }
  }

  explosion() {
    this.noise(0.9, 0.7, 900, 30);
    this.tone(52, 0.8, "sine", 0.4, 24);
    this.tone(120, 0.4, "sawtooth", 0.16, 40);
  }

  hit() {
    this.noise(0.06, 0.16, 1400, 120);
  }

  pickup() {
    this.tone(660, 0.08, "sine", 0.12);
    setTimeout(() => this.tone(990, 0.1, "sine", 0.1), 60);
  }

  empty() {
    this.tone(240, 0.05, "square", 0.05, 180);
  }

  crash() {
    this.noise(0.3, 0.4, 1200, 50);
    this.tone(64, 0.25, "triangle", 0.2, 30);
  }

  levelUp() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.18, "triangle", 0.13), i * 90));
  }

  missionComplete() {
    [392, 523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.26, "sine", 0.13), i * 110));
  }

  wanted() {
    this.tone(440, 0.2, "square", 0.08, 330);
    setTimeout(() => this.tone(330, 0.3, "square", 0.07, 220), 220);
  }

  ui() {
    this.tone(880, 0.035, "sine", 0.05);
  }

  engineStart() {
    if (!this.ctx || !this.master) return;
    if (this.engineOsc) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    osc.type = "sawtooth";
    osc.frequency.value = 55;
    gain.gain.value = 0.0;
    osc.connect(filter).connect(gain).connect(this.master);
    osc.start();
    this.engineOsc = osc;
    this.engineGain = gain;
  }

  setEngine(active: boolean, speed = 0, kind = "car") {
    if (!this.ctx || !this.engineGain || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(active && !this.muted ? 0.035 : 0, t, 0.06);
    const base = kind === "tank" ? 34 : kind === "bike" ? 72 : 48;
    this.engineOsc.frequency.setTargetAtTime(base + Math.abs(speed) * 2.1, t, 0.08);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.05);
  }

  dispose() {
    try {
      this.engineOsc?.stop();
      void this.ctx?.close();
    } catch {
      /* noop */
    }
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
  }
}
