// Fully procedural audio (Web Audio API). No audio files are shipped.

export interface V3 {
  x: number;
  y: number;
  z: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

const LULLABY = [
  220, 261.6, 329.6, 293.7, 261.6, 246.9, 220, 0, 196, 220, 261.6, 246.9, 220, 0, 174.6, 196, 220, 0, 164.8, 174.6,
  196, 220, 0, 0,
];

export type VoiceMode = 'hum' | 'mutter' | 'rage' | 'silent';

export class GameAudio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private noiseBuf!: AudioBuffer;
  private brownBuf!: AudioBuffer;
  private volume = 0.8;

  // granny voice chain
  private gBus!: BiquadFilterNode;
  private gPanner!: PannerNode;
  private gVoice!: GainNode;
  private gOsc!: OscillatorNode;
  private gRageOut!: GainNode;
  private gRageOsc!: OscillatorNode;
  private noteTimer = 0;
  private noteIdx = 0;
  private rageTimer = 0;

  // tension
  private tLowGain!: GainNode;
  private tHighGain!: GainNode;
  private ambTimer = 6;
  private rainGain!: GainNode;

  init() {
    if (this.ctx) {
      this.resume();
      return;
    }
    const AC: typeof AudioContext | undefined =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 20;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 1;
    this.sfx.connect(comp);
    comp.connect(this.master);
    this.master.connect(ctx.destination);

    // noise buffers
    const len = ctx.sampleRate * 3;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    this.brownBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const w = this.noiseBuf.getChannelData(0);
    const b = this.brownBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      w[i] = white;
      last = (last + 0.02 * white) / 1.02;
      b[i] = last * 3.5;
    }

    this.buildAmbience();
    this.buildTension();
    this.buildGranny();
    this.resume();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }
  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }
  setVolume(v: number) {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  setListener(p: V3, yaw: number) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    if (l.positionX) {
      l.positionX.value = p.x;
      l.positionY.value = p.y;
      l.positionZ.value = p.z;
      l.forwardX.value = fx;
      l.forwardY.value = 0;
      l.forwardZ.value = fz;
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    }
  }

  // ------------------------------------------------------------ builders
  private loopSrc(buf: AudioBuffer) {
    const s = this.ctx!.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.start(0, Math.random() * 2);
    return s;
  }

  private buildAmbience() {
    const ctx = this.ctx!;
    // rain on the roof / windows
    const rain = this.loopSrc(this.noiseBuf);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1100;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5200;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0.045;
    rain.connect(hp);
    hp.connect(lp);
    lp.connect(this.rainGain);
    this.rainGain.connect(this.sfx);

    // wind
    const wind = this.loopSrc(this.brownBuf);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 260;
    bp.Q.value = 0.7;
    const wg = ctx.createGain();
    wg.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ctx.createGain();
    lg.gain.value = 0.25;
    lfo.connect(lg);
    lg.connect(wg.gain);
    lfo.start();
    wind.connect(bp);
    bp.connect(wg);
    wg.connect(this.sfx);

    // low dread drone
    const out = ctx.createGain();
    out.gain.value = 0.05;
    const dl = ctx.createBiquadFilter();
    dl.type = 'lowpass';
    dl.frequency.value = 150;
    for (const f of [48, 48.6, 72.3]) {
      const o = ctx.createOscillator();
      o.type = f === 72.3 ? 'sine' : 'sawtooth';
      o.frequency.value = f;
      o.connect(dl);
      o.start();
    }
    const dlfo = ctx.createOscillator();
    dlfo.frequency.value = 0.09;
    const dlg = ctx.createGain();
    dlg.gain.value = 0.025;
    dlfo.connect(dlg);
    dlg.connect(out.gain);
    dlfo.start();
    dl.connect(out);
    out.connect(this.sfx);
  }

  private buildTension() {
    const ctx = this.ctx!;
    this.tLowGain = ctx.createGain();
    this.tLowGain.gain.value = 0;
    const low = ctx.createOscillator();
    low.type = 'sawtooth';
    low.frequency.value = 55;
    const low2 = ctx.createOscillator();
    low2.type = 'sawtooth';
    low2.frequency.value = 58.3;
    const lf = ctx.createBiquadFilter();
    lf.type = 'lowpass';
    lf.frequency.value = 260;
    const pulse = ctx.createGain();
    pulse.gain.value = 0.5;
    const plfo = ctx.createOscillator();
    plfo.frequency.value = 2.3;
    const plg = ctx.createGain();
    plg.gain.value = 0.5;
    plfo.connect(plg);
    plg.connect(pulse.gain);
    plfo.start();
    low.connect(lf);
    low2.connect(lf);
    lf.connect(pulse);
    pulse.connect(this.tLowGain);
    this.tLowGain.connect(this.sfx);
    low.start();
    low2.start();

    this.tHighGain = ctx.createGain();
    this.tHighGain.gain.value = 0;
    const trem = ctx.createGain();
    trem.gain.value = 0.6;
    const tl = ctx.createOscillator();
    tl.frequency.value = 7.5;
    const tlg = ctx.createGain();
    tlg.gain.value = 0.4;
    tl.connect(tlg);
    tlg.connect(trem.gain);
    tl.start();
    for (const f of [1760, 1864, 2489]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const vib = ctx.createOscillator();
      vib.frequency.value = rand(4, 8);
      const vg = ctx.createGain();
      vg.gain.value = 12;
      vib.connect(vg);
      vg.connect(o.frequency);
      vib.start();
      o.connect(trem);
      o.start();
    }
    trem.connect(this.tHighGain);
    this.tHighGain.connect(this.sfx);
  }

  private buildGranny() {
    const ctx = this.ctx!;
    this.gBus = ctx.createBiquadFilter();
    this.gBus.type = 'lowpass';
    this.gBus.frequency.value = 9000;
    this.gPanner = ctx.createPanner();
    this.gPanner.panningModel = 'HRTF';
    this.gPanner.distanceModel = 'inverse';
    this.gPanner.refDistance = 2.5;
    this.gPanner.rolloffFactor = 1.35;
    this.gPanner.maxDistance = 80;
    this.gBus.connect(this.gPanner);
    this.gPanner.connect(this.sfx);

    // humming voice: saw -> two formants
    this.gVoice = ctx.createGain();
    this.gVoice.gain.value = 0;
    this.gOsc = ctx.createOscillator();
    this.gOsc.type = 'sawtooth';
    this.gOsc.frequency.value = 220;
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.2;
    const vg = ctx.createGain();
    vg.gain.value = 5;
    vib.connect(vg);
    vg.connect(this.gOsc.frequency);
    vib.start();
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.value = 420;
    f1.Q.value = 6;
    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.value = 1150;
    f2.Q.value = 7;
    const g1 = ctx.createGain();
    g1.gain.value = 1.3;
    const g2 = ctx.createGain();
    g2.gain.value = 0.6;
    this.gOsc.connect(f1);
    this.gOsc.connect(f2);
    f1.connect(g1);
    f2.connect(g2);
    g1.connect(this.gVoice);
    g2.connect(this.gVoice);
    this.gVoice.connect(this.gBus);
    this.gOsc.start();

    // rage voice: growl pulses
    this.gRageOut = ctx.createGain();
    this.gRageOut.gain.value = 0;
    this.gRageOsc = ctx.createOscillator();
    this.gRageOsc.type = 'sawtooth';
    this.gRageOsc.frequency.value = 110;
    const rf = ctx.createBiquadFilter();
    rf.type = 'bandpass';
    rf.frequency.value = 780;
    rf.Q.value = 2.2;
    const am = ctx.createGain();
    am.gain.value = 0.5;
    const alfo = ctx.createOscillator();
    alfo.type = 'square';
    alfo.frequency.value = 5.4;
    const ag = ctx.createGain();
    ag.gain.value = 0.5;
    alfo.connect(ag);
    ag.connect(am.gain);
    alfo.start();
    const noise = this.loopSrc(this.noiseBuf);
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 1500;
    nf.Q.value = 1.2;
    const ng = ctx.createGain();
    ng.gain.value = 0.35;
    noise.connect(nf);
    nf.connect(ng);
    ng.connect(rf);
    this.gRageOsc.connect(rf);
    rf.connect(am);
    am.connect(this.gRageOut);
    this.gRageOut.connect(this.gBus);
    this.gRageOsc.start();
  }

  // ------------------------------------------------------------ primitives
  private dest(pos?: V3, ref = 2.5): AudioNode {
    const ctx = this.ctx!;
    if (!pos) return this.sfx;
    const p = ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = ref;
    p.rolloffFactor = 1.3;
    p.maxDistance = 80;
    p.positionX.value = pos.x;
    p.positionY.value = pos.y;
    p.positionZ.value = pos.z;
    p.connect(this.sfx);
    return p;
  }

  private burst(o: {
    dest: AudioNode;
    type: BiquadFilterType;
    freq: number;
    freqEnd?: number;
    q?: number;
    dur: number;
    gain: number;
    attack?: number;
    brown?: boolean;
    delay?: number;
  }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + (o.delay ?? 0);
    const s = ctx.createBufferSource();
    s.buffer = o.brown ? this.brownBuf : this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.type;
    f.frequency.setValueAtTime(o.freq, t);
    if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, t + o.dur);
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.gain, t + (o.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    s.connect(f);
    f.connect(g);
    g.connect(o.dest);
    s.start(t, Math.random() * 1.8);
    s.stop(t + o.dur + 0.05);
  }

  private tone(o: {
    dest: AudioNode;
    type: OscillatorType;
    f0: number;
    f1?: number;
    dur: number;
    gain: number;
    attack?: number;
    delay?: number;
    filter?: { type: BiquadFilterType; freq: number; q?: number };
    vibrato?: [number, number];
  }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.gain, t + (o.attack ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let node: AudioNode = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter.type;
      f.frequency.value = o.filter.freq;
      f.Q.value = o.filter.q ?? 1;
      osc.connect(f);
      node = f;
    }
    if (o.vibrato) {
      const v = ctx.createOscillator();
      v.frequency.value = o.vibrato[0];
      const vg = ctx.createGain();
      vg.gain.value = o.vibrato[1];
      v.connect(vg);
      vg.connect(osc.frequency);
      v.start(t);
      v.stop(t + o.dur + 0.05);
    }
    node.connect(g);
    g.connect(o.dest);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
  }

  // ------------------------------------------------------------ sfx
  footstep(kind: 'walk' | 'run' | 'crouch') {
    if (!this.ctx) return;
    const d = this.sfx;
    const g = kind === 'run' ? 0.5 : kind === 'walk' ? 0.28 : 0.1;
    this.burst({ dest: d, type: 'lowpass', freq: rand(260, 420), q: 0.8, dur: 0.1, gain: g, attack: 0.004 });
    this.tone({ dest: d, type: 'sine', f0: 90, f1: 45, dur: 0.12, gain: g * 0.9 });
    if (kind !== 'crouch') this.burst({ dest: d, type: 'bandpass', freq: rand(900, 1500), q: 2, dur: 0.05, gain: g * 0.18 });
  }

  grannyStep(pos: V3) {
    if (!this.ctx) return;
    this.updateGrannyPos(pos);
    const d = this.gBus;
    this.burst({ dest: d, type: 'lowpass', freq: 220, q: 1, dur: 0.16, gain: 0.8, attack: 0.004 });
    this.tone({ dest: d, type: 'sine', f0: 70, f1: 38, dur: 0.2, gain: 0.9 });
    this.burst({ dest: d, type: 'bandpass', freq: rand(700, 1100), q: 3, dur: 0.07, gain: 0.25, delay: 0.02 });
  }

  creak(pos?: V3, loud = 1) {
    if (!this.ctx) return;
    const d = this.dest(pos, 3);
    const f = rand(110, 180);
    this.tone({
      dest: d,
      type: 'sawtooth',
      f0: f,
      f1: f * rand(0.6, 0.8),
      dur: rand(0.55, 0.9),
      gain: 0.22 * loud,
      attack: 0.05,
      filter: { type: 'bandpass', freq: rand(380, 620), q: 9 },
      vibrato: [rand(18, 35), 12],
    });
    this.burst({ dest: d, type: 'bandpass', freq: 700, q: 4, dur: 0.5, gain: 0.05 * loud, attack: 0.08 });
  }

  doorOpen(pos?: V3) {
    if (!this.ctx) return;
    const d = this.dest(pos, 3);
    this.tone({
      dest: d,
      type: 'sawtooth',
      f0: 150,
      f1: 260,
      dur: 0.9,
      gain: 0.12,
      attack: 0.1,
      filter: { type: 'bandpass', freq: 520, q: 10 },
      vibrato: [26, 18],
    });
    this.burst({ dest: d, type: 'lowpass', freq: 400, dur: 0.12, gain: 0.35 });
  }

  doorClose(pos?: V3) {
    if (!this.ctx) return;
    const d = this.dest(pos, 3);
    this.tone({
      dest: d,
      type: 'sawtooth',
      f0: 240,
      f1: 130,
      dur: 0.6,
      gain: 0.1,
      attack: 0.05,
      filter: { type: 'bandpass', freq: 480, q: 10 },
      vibrato: [24, 14],
    });
    this.burst({ dest: d, type: 'lowpass', freq: 300, dur: 0.22, gain: 0.8, delay: 0.5 });
    this.tone({ dest: d, type: 'sine', f0: 80, f1: 40, dur: 0.25, gain: 0.8, delay: 0.5 });
  }

  doorLocked(pos?: V3) {
    if (!this.ctx) return;
    const d = this.dest(pos, 3);
    for (let i = 0; i < 3; i++) {
      this.burst({ dest: d, type: 'bandpass', freq: 1800, q: 5, dur: 0.07, gain: 0.35, delay: i * 0.09 });
      this.tone({ dest: d, type: 'square', f0: 340, f1: 180, dur: 0.06, gain: 0.07, delay: i * 0.09 });
    }
  }

  unlock() {
    if (!this.ctx) return;
    const d = this.sfx;
    this.burst({ dest: d, type: 'bandpass', freq: 2400, q: 6, dur: 0.05, gain: 0.4 });
    this.burst({ dest: d, type: 'bandpass', freq: 3000, q: 6, dur: 0.06, gain: 0.4, delay: 0.14 });
    for (const [i, f] of [1568, 2093, 2637].entries())
      this.tone({ dest: d, type: 'sine', f0: f, dur: 0.5, gain: 0.07, delay: 0.2 + i * 0.07 });
  }

  pickup() {
    if (!this.ctx) return;
    this.tone({ dest: this.sfx, type: 'sine', f0: 660, dur: 0.18, gain: 0.12 });
    this.tone({ dest: this.sfx, type: 'sine', f0: 990, dur: 0.3, gain: 0.1, delay: 0.07 });
  }

  paper() {
    if (!this.ctx) return;
    this.burst({ dest: this.sfx, type: 'bandpass', freq: 3200, q: 0.8, dur: 0.28, gain: 0.2, attack: 0.04 });
    this.burst({ dest: this.sfx, type: 'highpass', freq: 5000, dur: 0.2, gain: 0.08, delay: 0.12 });
  }

  whoosh() {
    if (!this.ctx) return;
    this.burst({ dest: this.sfx, type: 'bandpass', freq: 500, freqEnd: 2200, q: 1.2, dur: 0.3, gain: 0.22, attack: 0.1 });
  }

  glassBreak(pos?: V3) {
    if (!this.ctx) return;
    const d = this.dest(pos, 4);
    this.burst({ dest: d, type: 'highpass', freq: 2500, dur: 0.5, gain: 0.8, attack: 0.002 });
    this.burst({ dest: d, type: 'bandpass', freq: 5200, q: 1.2, dur: 0.7, gain: 0.5, attack: 0.002 });
    this.tone({ dest: d, type: 'sine', f0: 140, f1: 50, dur: 0.2, gain: 0.5 });
    for (let i = 0; i < 9; i++) {
      this.tone({
        dest: d,
        type: 'sine',
        f0: rand(2800, 7500),
        dur: rand(0.15, 0.4),
        gain: rand(0.04, 0.1),
        delay: rand(0.03, 0.6),
      });
    }
  }

  trapSnap(pos?: V3) {
    if (!this.ctx) return;
    const d = this.dest(pos, 5);
    this.burst({ dest: d, type: 'bandpass', freq: 2600, q: 3, dur: 0.25, gain: 0.9, attack: 0.001 });
    this.tone({ dest: d, type: 'square', f0: 900, f1: 200, dur: 0.12, gain: 0.25 });
    this.tone({ dest: d, type: 'sine', f0: 120, f1: 40, dur: 0.3, gain: 0.9 });
    this.burst({ dest: d, type: 'bandpass', freq: 1200, q: 8, dur: 0.6, gain: 0.25, delay: 0.1 });
  }

  scream() {
    if (!this.ctx) return;
    const d = this.sfx;
    this.tone({
      dest: d,
      type: 'sawtooth',
      f0: 520,
      f1: 880,
      dur: 0.9,
      gain: 0.22,
      attack: 0.04,
      filter: { type: 'bandpass', freq: 1300, q: 2 },
      vibrato: [9, 40],
    });
    this.burst({ dest: d, type: 'bandpass', freq: 1800, q: 1.5, dur: 0.8, gain: 0.15, attack: 0.04 });
  }

  thunder(delay = 0) {
    if (!this.ctx) return;
    const d = this.sfx;
    this.burst({ dest: d, type: 'lowpass', freq: 1400, freqEnd: 90, q: 0.8, dur: 4.5, gain: 1.3, attack: 0.05, brown: true, delay });
    this.burst({ dest: d, type: 'bandpass', freq: 500, freqEnd: 100, q: 0.5, dur: 1.2, gain: 0.6, attack: 0.01, delay });
    this.burst({ dest: d, type: 'lowpass', freq: 220, freqEnd: 50, dur: 3.2, gain: 1.2, attack: 0.4, brown: true, delay: delay + 0.7 });
  }

  heartbeat(intensity: number) {
    if (!this.ctx) return;
    const g = 0.18 + intensity * 0.55;
    this.tone({ dest: this.sfx, type: 'sine', f0: 62, f1: 38, dur: 0.2, gain: g });
    this.burst({ dest: this.sfx, type: 'lowpass', freq: 120, dur: 0.15, gain: g * 0.6 });
    this.tone({ dest: this.sfx, type: 'sine', f0: 56, f1: 34, dur: 0.22, gain: g * 0.8, delay: 0.17 });
  }

  stinger() {
    if (!this.ctx) return;
    const d = this.sfx;
    for (const f of [220, 233.1, 311.1, 466.2]) {
      this.tone({ dest: d, type: 'sawtooth', f0: f * 2, f1: f * 1.9, dur: 1.4, gain: 0.07, attack: 0.01, filter: { type: 'lowpass', freq: 2200 } });
    }
    this.burst({ dest: d, type: 'bandpass', freq: 400, freqEnd: 5000, q: 1.5, dur: 0.8, gain: 0.35, attack: 0.3 });
  }

  caughtHit() {
    if (!this.ctx) return;
    const d = this.sfx;
    this.burst({ dest: d, type: 'lowpass', freq: 900, dur: 0.5, gain: 1.4, attack: 0.002 });
    this.tone({ dest: d, type: 'sine', f0: 110, f1: 28, dur: 0.7, gain: 1.2 });
    this.scream();
    this.stinger();
  }

  shatterRoar() {
    if (!this.ctx) return;
    this.burst({ dest: this.sfx, type: 'bandpass', freq: 300, freqEnd: 2800, q: 1, dur: 0.7, gain: 0.7, attack: 0.15 });
  }

  win() {
    if (!this.ctx) return;
    const notes = [392, 494, 587, 784, 988];
    notes.forEach((f, i) => {
      this.tone({ dest: this.sfx, type: 'triangle', f0: f, dur: 2.2, gain: 0.12, attack: 0.05, delay: i * 0.22 });
      this.tone({ dest: this.sfx, type: 'sine', f0: f / 2, dur: 2.2, gain: 0.1, attack: 0.05, delay: i * 0.22 });
    });
  }

  // ------------------------------------------------------------ continuous
  setTension(t: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.tLowGain.gain.setTargetAtTime(t * 0.2, now, 0.35);
    this.tHighGain.gain.setTargetAtTime(Math.max(0, t - 0.45) * 0.07, now, 0.4);
  }

  setRain(v: number) {
    if (!this.ctx) return;
    this.rainGain.gain.setTargetAtTime(0.03 + v * 0.03, this.ctx.currentTime, 0.5);
  }

  private updateGrannyPos(p: V3) {
    this.gPanner.positionX.value = p.x;
    this.gPanner.positionY.value = p.y;
    this.gPanner.positionZ.value = p.z;
  }

  updateGranny(pos: V3, mode: VoiceMode, occluded: boolean, dt: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    this.updateGrannyPos(pos);
    this.gBus.frequency.setTargetAtTime(occluded ? 650 : 9000, now, 0.12);
    this.gRageOut.gain.setTargetAtTime(mode === 'rage' ? 0.55 : 0, now, 0.08);
    if (mode === 'rage') {
      this.rageTimer -= dt;
      if (this.rageTimer <= 0) {
        this.rageTimer = rand(0.1, 0.22);
        this.gRageOsc.frequency.setTargetAtTime(rand(75, 170), now, 0.03);
      }
    }
    if (mode === 'hum' || mode === 'mutter') {
      this.noteTimer -= dt;
      if (this.noteTimer <= 0) {
        let f = LULLABY[this.noteIdx % LULLABY.length];
        this.noteIdx++;
        const dur = rand(0.45, 0.85);
        this.noteTimer = dur + rand(0.02, 0.12);
        if (mode === 'mutter') f = f > 0 ? rand(110, 190) : 0;
        if (f > 0) {
          const amp = mode === 'mutter' ? 0.12 : 0.26;
          this.gOsc.frequency.setTargetAtTime(f, now, 0.05);
          const g = this.gVoice.gain;
          g.cancelScheduledValues(now);
          g.setValueAtTime(Math.max(0.0001, g.value), now);
          g.linearRampToValueAtTime(amp, now + 0.09);
          g.setTargetAtTime(0.0001, now + dur * 0.7, 0.07);
        }
      }
    } else {
      const g = this.gVoice.gain;
      g.cancelScheduledValues(now);
      g.setTargetAtTime(0.0001, now, 0.06);
    }
  }

  grannyGrunt(pos: V3) {
    if (!this.ctx) return;
    this.updateGrannyPos(pos);
    this.tone({ dest: this.gBus, type: 'sawtooth', f0: 220, f1: 70, dur: 0.7, gain: 0.35, filter: { type: 'bandpass', freq: 700, q: 2 }, vibrato: [14, 20] });
  }

  grannyShout(pos: V3) {
    if (!this.ctx) return;
    this.updateGrannyPos(pos);
    this.tone({ dest: this.gBus, type: 'sawtooth', f0: 300, f1: 520, dur: 0.9, gain: 0.45, attack: 0.05, filter: { type: 'bandpass', freq: 1100, q: 2 }, vibrato: [11, 35] });
    this.burst({ dest: this.gBus, type: 'bandpass', freq: 1500, q: 1.5, dur: 0.8, gain: 0.3, attack: 0.05 });
  }

  /** random ambient house noises */
  ambient(dt: number, around: V3) {
    if (!this.ctx) return;
    this.ambTimer -= dt;
    if (this.ambTimer > 0) return;
    this.ambTimer = rand(9, 22);
    const a = rand(0, Math.PI * 2);
    const r = rand(6, 14);
    const pos = { x: around.x + Math.cos(a) * r, y: around.y + 1, z: around.z + Math.sin(a) * r };
    const k = Math.random();
    if (k < 0.5) this.creak(pos, 0.8);
    else if (k < 0.8) {
      // distant knocks
      for (let i = 0; i < 3; i++) {
        const d = this.dest(pos, 3);
        this.burst({ dest: d, type: 'lowpass', freq: 380, dur: 0.1, gain: 0.7, delay: i * rand(0.25, 0.4) });
        this.tone({ dest: d, type: 'sine', f0: 110, f1: 60, dur: 0.12, gain: 0.5, delay: i * 0.3 });
      }
    } else {
      // soft whisper-like breath
      const d = this.dest(pos, 2);
      this.burst({ dest: d, type: 'bandpass', freq: 1800, freqEnd: 900, q: 3, dur: 1.4, gain: 0.12, attack: 0.5 });
    }
  }

  dispose() {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
