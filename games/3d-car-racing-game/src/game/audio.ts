// Fully synthesised audio: engine, tyre squeal, wind, impacts, countdown beeps and a light synth soundtrack.

export class GameAudio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private musicGain!: GainNode;
  private osc1!: OscillatorNode;
  private osc2!: OscillatorNode;
  private osc3!: OscillatorNode;
  private engFilter!: BiquadFilterNode;
  private engGain!: GainNode;
  private skidGain!: GainNode;
  private windGain!: GainNode;
  private noiseBuf!: AudioBuffer;
  private muted = false;
  private musicOn = true;
  private musicTimer: number | null = null;
  private nextNote = 0;
  private step = 0;
  private nodes: AudioNode[] = [];
  private sources: AudioScheduledSourceNode[] = [];

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 1;
    this.sfx.connect(this.master);
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.22;
    this.musicGain.connect(this.master);

    // noise buffer
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // engine
    this.osc1 = ctx.createOscillator();
    this.osc1.type = "sawtooth";
    this.osc2 = ctx.createOscillator();
    this.osc2.type = "square";
    this.osc3 = ctx.createOscillator();
    this.osc3.type = "triangle";
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * 2 - 1;
      curve[i] = Math.tanh(x * 2.2);
    }
    shaper.curve = curve;
    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = "lowpass";
    this.engFilter.frequency.value = 900;
    this.engFilter.Q.value = 1.4;
    this.engGain = ctx.createGain();
    this.engGain.gain.value = 0;
    const g1 = ctx.createGain();
    g1.gain.value = 0.5;
    const g2 = ctx.createGain();
    g2.gain.value = 0.28;
    const g3 = ctx.createGain();
    g3.gain.value = 0.35;
    this.osc1.connect(g1).connect(shaper);
    this.osc2.connect(g2).connect(shaper);
    this.osc3.connect(g3).connect(shaper);
    shaper.connect(this.engFilter).connect(this.engGain).connect(this.sfx);
    this.osc1.start();
    this.osc2.start();
    this.osc3.start();
    this.sources.push(this.osc1, this.osc2, this.osc3);

    // skid
    const skid = ctx.createBufferSource();
    skid.buffer = this.noiseBuf;
    skid.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1700;
    bp.Q.value = 3;
    this.skidGain = ctx.createGain();
    this.skidGain.gain.value = 0;
    skid.connect(bp).connect(this.skidGain).connect(this.sfx);
    skid.start();
    this.sources.push(skid);

    // wind
    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuf;
    wind.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    wind.connect(lp).connect(this.windGain).connect(this.sfx);
    wind.start();
    this.sources.push(wind);

    this.startMusic();
  }

  resume() {
    this.ctx?.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }
  isMuted() {
    return this.muted;
  }
  setMusic(on: boolean) {
    this.musicOn = on;
    if (this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, 0.1);
  }
  isMusic() {
    return this.musicOn;
  }

  update(rpm: number, throttle: number, speed01: number, skid: number, nitro: boolean, paused: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = 34 + rpm * 190 + (nitro ? 12 : 0);
    this.osc1.frequency.setTargetAtTime(f, t, 0.03);
    this.osc2.frequency.setTargetAtTime(f * 0.5, t, 0.03);
    this.osc3.frequency.setTargetAtTime(f * 2.01, t, 0.03);
    this.engFilter.frequency.setTargetAtTime(380 + rpm * 1500 + throttle * 1100, t, 0.05);
    this.engGain.gain.setTargetAtTime(paused ? 0 : 0.07 + throttle * 0.1 + rpm * 0.04, t, 0.05);
    this.skidGain.gain.setTargetAtTime(paused ? 0 : Math.min(0.2, skid * 0.2), t, 0.04);
    this.windGain.gain.setTargetAtTime(paused ? 0 : speed01 * speed01 * 0.22, t, 0.1);
  }

  thump(intensity: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const v = Math.min(1, intensity / 14);
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5 * v + 0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.32);
    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 900;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.35 * v + 0.05, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    n.connect(f).connect(ng).connect(this.sfx);
    n.start(t);
    n.stop(t + 0.25);
  }

  beep(high: boolean) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = high ? 880 : 440;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + (high ? 0.7 : 0.3));
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.75);
  }

  jingle() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((fr, i) => {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = fr;
      const g = ctx.createGain();
      const t = t0 + i * 0.13;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.connect(g).connect(this.sfx);
      o.start(t);
      o.stop(t + 0.55);
    });
  }

  /* ---------- tiny generative synthwave */
  private startMusic() {
    const ctx = this.ctx!;
    this.nextNote = ctx.currentTime + 0.2;
    this.step = 0;
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.32;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    delay.connect(fb).connect(delay);
    const dOut = ctx.createGain();
    dOut.gain.value = 0.5;
    delay.connect(dOut).connect(this.musicGain);
    this.nodes.push(delay, fb, dOut);
    const roots = [45, 41, 48, 43]; // A2 F2 C3 G2 (midi)
    const chords = [
      [0, 3, 7],
      [0, 4, 7],
      [0, 4, 7],
      [0, 4, 7],
    ];
    const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    const bpm = 112;
    const sixteenth = 60 / bpm / 4;
    const tick = () => {
      if (!this.ctx) return;
      while (this.nextNote < ctx.currentTime + 0.4) {
        const bar = Math.floor(this.step / 16) % 4;
        const s = this.step % 16;
        const root = roots[bar];
        const t = this.nextNote;
        // bass on 8ths
        if (s % 2 === 0) {
          const o = ctx.createOscillator();
          o.type = "sawtooth";
          o.frequency.value = mtof(root + (s % 8 === 6 ? 12 : 0));
          const f = ctx.createBiquadFilter();
          f.type = "lowpass";
          f.frequency.setValueAtTime(900, t);
          f.frequency.exponentialRampToValueAtTime(200, t + sixteenth * 1.8);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.28, t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.001, t + sixteenth * 1.9);
          o.connect(f).connect(g).connect(this.musicGain);
          o.start(t);
          o.stop(t + sixteenth * 2);
        }
        // arpeggio
        const ch = chords[bar];
        const note = root + 24 + ch[[0, 1, 2, 1][s % 4]] + (s >= 8 && s % 4 === 3 ? 12 : 0);
        const o2 = ctx.createOscillator();
        o2.type = "square";
        o2.frequency.value = mtof(note);
        const f2 = ctx.createBiquadFilter();
        f2.type = "lowpass";
        f2.frequency.value = 1800;
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.0001, t);
        g2.gain.exponentialRampToValueAtTime(0.07, t + 0.008);
        g2.gain.exponentialRampToValueAtTime(0.001, t + sixteenth * 1.5);
        o2.connect(f2).connect(g2);
        g2.connect(this.musicGain);
        g2.connect(delay);
        o2.start(t);
        o2.stop(t + sixteenth * 1.6);
        // kick + hat
        if (s % 4 === 0) {
          const k = ctx.createOscillator();
          k.frequency.setValueAtTime(140, t);
          k.frequency.exponentialRampToValueAtTime(40, t + 0.14);
          const kg = ctx.createGain();
          kg.gain.setValueAtTime(0.5, t);
          kg.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
          k.connect(kg).connect(this.musicGain);
          k.start(t);
          k.stop(t + 0.2);
        }
        if (s % 2 === 1) {
          const n = ctx.createBufferSource();
          n.buffer = this.noiseBuf;
          const hp = ctx.createBiquadFilter();
          hp.type = "highpass";
          hp.frequency.value = 7000;
          const hg = ctx.createGain();
          hg.gain.setValueAtTime(0.09, t);
          hg.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
          n.connect(hp).connect(hg).connect(this.musicGain);
          n.start(t);
          n.stop(t + 0.06);
        }
        this.nextNote += sixteenth;
        this.step++;
      }
    };
    this.musicTimer = window.setInterval(tick, 100);
  }

  dispose() {
    if (this.musicTimer !== null) clearInterval(this.musicTimer);
    this.sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* ignore */
      }
    });
    this.ctx?.close();
    this.ctx = null;
  }
}
