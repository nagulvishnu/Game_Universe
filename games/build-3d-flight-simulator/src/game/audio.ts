// Fully procedural WebAudio sound – no external assets.
export type EngineKind = 'jet' | 'prop' | 'heli';

export class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private volume = 0.7;
  private muted = false;
  kind: EngineKind | null = null;
  private engineNodes: { stop: () => void; update: (thr: number, spd: number, ab: boolean, rpm: number) => void } | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private rainGain: GainNode | null = null;
  private bedStop: (() => void)[] = [];

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    } catch { return; }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp);
    comp.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.04 * w) / 1.04; // brownish
      d[i] = w * 0.5 + last * 6;
    }
    this.startBeds();
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : v, this.ctx.currentTime, 0.05);
  }
  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.05);
  }
  suspend() { if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume(); }

  private noiseSrc() {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.start(0, Math.random() * 1.5);
    return s;
  }

  private startBeds() {
    const ctx = this.ctx!;
    // wind
    const wn = this.noiseSrc();
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 500;
    this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    wn.connect(this.windFilter).connect(this.windGain).connect(this.master!);
    // rain
    const rn = this.noiseSrc();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    rn.connect(hp).connect(this.rainGain).connect(this.master!);
    this.bedStop.push(() => { wn.stop(); rn.stop(); });
  }

  startEngine(kind: EngineKind) {
    if (!this.ctx) return;
    this.stopEngine();
    this.kind = kind;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0.9;
    out.connect(this.master!);
    const stoppers: (() => void)[] = [];
    if (kind === 'jet') {
      const n = this.noiseSrc();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 0.7;
      const g = ctx.createGain();
      n.connect(bp).connect(g).connect(out);
      const n2 = this.noiseSrc();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 220;
      const g2 = ctx.createGain();
      n2.connect(lp).connect(g2).connect(out);
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      const og = ctx.createGain();
      const olp = ctx.createBiquadFilter();
      olp.type = 'lowpass';
      olp.frequency.value = 900;
      o.connect(olp).connect(og).connect(out);
      const w = ctx.createOscillator();
      w.type = 'triangle';
      const wg = ctx.createGain();
      w.connect(wg).connect(out);
      o.start();
      w.start();
      stoppers.push(() => { n.stop(); n2.stop(); o.stop(); w.stop(); });
      this.engineNodes = {
        stop: () => stoppers.forEach((f) => f()),
        update: (thr, spd, ab) => {
          const t = ctx.currentTime;
          bp.frequency.setTargetAtTime(350 + thr * 900 + (ab ? 400 : 0), t, 0.1);
          g.gain.setTargetAtTime(0.06 + thr * 0.28 + (ab ? 0.22 : 0), t, 0.1);
          g2.gain.setTargetAtTime(0.25 + thr * 0.6 + (ab ? 0.4 : 0), t, 0.1);
          o.frequency.setTargetAtTime(48 + thr * 70, t, 0.15);
          og.gain.setTargetAtTime(0.05 + thr * 0.1, t, 0.1);
          w.frequency.setTargetAtTime(700 + thr * 2400, t, 0.15);
          wg.gain.setTargetAtTime(0.004 + thr * 0.02, t, 0.1);
          void spd;
        },
      };
    } else if (kind === 'prop') {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 600;
      const g = ctx.createGain();
      o.connect(lp).connect(g).connect(out);
      const o2 = ctx.createOscillator();
      o2.type = 'square';
      const g3 = ctx.createGain();
      g3.gain.value = 0.05;
      o2.connect(g3).connect(out);
      const n = this.noiseSrc();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 500;
      const g2 = ctx.createGain();
      n.connect(bp).connect(g2).connect(out);
      // prop chop
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lg.gain.value = 0.06;
      lfo.connect(lg).connect(g.gain);
      o.start();
      o2.start();
      lfo.start();
      stoppers.push(() => { o.stop(); o2.stop(); n.stop(); lfo.stop(); });
      this.engineNodes = {
        stop: () => stoppers.forEach((f) => f()),
        update: (thr) => {
          const t = ctx.currentTime;
          const f = 32 + thr * 38;
          o.frequency.setTargetAtTime(f, t, 0.12);
          o2.frequency.setTargetAtTime(f * 2.01, t, 0.12);
          lfo.frequency.setTargetAtTime(f * 0.5, t, 0.12);
          lp.frequency.setTargetAtTime(350 + thr * 700, t, 0.1);
          g.gain.setTargetAtTime(0.12 + thr * 0.2, t, 0.1);
          g2.gain.setTargetAtTime(0.05 + thr * 0.2, t, 0.1);
        },
      };
    } else {
      const n = this.noiseSrc();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 700;
      const g = ctx.createGain();
      g.gain.value = 0.3;
      n.connect(lp).connect(g).connect(out);
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lg.gain.value = 0.28;
      lfo.connect(lg).connect(g.gain);
      const w = ctx.createOscillator();
      w.type = 'sawtooth';
      const wl = ctx.createBiquadFilter();
      wl.type = 'lowpass';
      wl.frequency.value = 1800;
      const wg = ctx.createGain();
      w.connect(wl).connect(wg).connect(out);
      const th = ctx.createOscillator();
      th.type = 'sine';
      th.frequency.value = 55;
      const tg = ctx.createGain();
      tg.gain.value = 0.12;
      th.connect(tg).connect(out);
      lfo.start();
      w.start();
      th.start();
      stoppers.push(() => { n.stop(); lfo.stop(); w.stop(); th.stop(); });
      this.engineNodes = {
        stop: () => stoppers.forEach((f) => f()),
        update: (thr, spd, _ab, rpm) => {
          const t = ctx.currentTime;
          lfo.frequency.setTargetAtTime(11 + rpm * 4 + thr * 1.5, t, 0.2);
          g.gain.setTargetAtTime((0.1 + thr * 0.2) * rpm, t, 0.2);
          lg.gain.setTargetAtTime((0.12 + thr * 0.2) * rpm, t, 0.2);
          w.frequency.setTargetAtTime(500 + rpm * 700 + thr * 300, t, 0.2);
          wg.gain.setTargetAtTime(0.012 * rpm + 0.01 * thr, t, 0.2);
          th.frequency.setTargetAtTime(40 + rpm * 20, t, 0.2);
          void spd;
        },
      };
    }
  }

  stopEngine() {
    this.engineNodes?.stop();
    this.engineNodes = null;
    this.kind = null;
  }

  update(thr: number, speed: number, ab: boolean, rpm: number, wind: number, rain: number, inCockpit: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineNodes?.update(thr, speed, ab, rpm);
    const w = Math.min(1, speed / 220);
    this.windGain?.gain.setTargetAtTime((w * w * 0.5 + wind * 0.004) * (inCockpit ? 0.8 : 1), t, 0.2);
    this.windFilter?.frequency.setTargetAtTime(300 + w * 1200, t, 0.2);
    this.rainGain?.gain.setTargetAtTime(rain * (inCockpit ? 0.16 : 0.1), t, 0.3);
  }

  private env(g: GainNode, peak: number, dur: number, attack = 0.005) {
    const t = this.ctx!.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  burst(freq: number, q: number, dur: number, peak: number, type: BiquadFilterType = 'lowpass', sweepTo?: number) {
    if (!this.ctx) return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, this.ctx.currentTime + dur);
    const g = this.ctx.createGain();
    this.env(g, peak, dur);
    s.connect(f).connect(g).connect(this.master!);
    s.start(0, Math.random());
    s.stop(this.ctx.currentTime + dur + 0.1);
  }

  tone(freq: number, dur: number, peak = 0.15, type: OscillatorType = 'sine', slideTo?: number) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + dur);
    const g = this.ctx.createGain();
    this.env(g, peak, dur);
    o.connect(g).connect(this.master!);
    o.start();
    o.stop(this.ctx.currentTime + dur + 0.05);
  }

  click() { this.tone(900, 0.06, 0.08, 'square', 600); }
  gear() { this.burst(300, 1, 1.4, 0.35, 'lowpass', 120); this.tone(110, 1.2, 0.06, 'sawtooth', 70); setTimeout(() => this.burst(180, 2, 0.25, 0.5), 1400); }
  touchdown(sink: number) {
    const p = Math.min(0.9, 0.25 + sink * 0.14);
    this.burst(260, 1, 0.35, p, 'lowpass');
    this.burst(2400, 1, 0.5, p * 0.4, 'bandpass', 900);
    this.tone(70, 0.3, p * 0.5, 'sine', 40);
  }
  crash() {
    this.burst(500, 1, 2.6, 1, 'lowpass', 60);
    this.burst(90, 1, 3.2, 1, 'lowpass');
    this.tone(60, 1.6, 0.5, 'sawtooth', 25);
  }
  explosion() { this.burst(400, 1, 1.4, 0.8, 'lowpass', 70); this.tone(55, 0.9, 0.4, 'sine', 30); }
  thunder() { setTimeout(() => { this.burst(200, 1, 3.2, 0.9, 'lowpass', 50); this.burst(90, 1, 4, 0.6); }, 400 + Math.random() * 1200); }
  gun() { this.burst(1800, 1, 0.07, 0.25, 'bandpass', 500); }
  missile() { this.burst(900, 1, 1.4, 0.4, 'bandpass', 300); }
  chime() { [660, 880, 1320].forEach((f, i) => setTimeout(() => this.tone(f, 0.5, 0.12, 'sine'), i * 130)); }
  fail() { [440, 330, 220].forEach((f, i) => setTimeout(() => this.tone(f, 0.45, 0.14, 'triangle'), i * 180)); }
  beep(f = 1000) { this.tone(f, 0.1, 0.1, 'square'); }
  stall() { this.tone(820, 0.18, 0.1, 'square'); }
  pullUp() { this.tone(1100, 0.16, 0.12, 'sawtooth', 700); }
  winch() { this.tone(220, 0.2, 0.04, 'sawtooth', 260); }
  checkpoint() { this.tone(880, 0.12, 0.12, 'sine'); setTimeout(() => this.tone(1320, 0.18, 0.12, 'sine'), 100); }

  dispose() {
    this.stopEngine();
    this.bedStop.forEach((f) => { try { f(); } catch { /* noop */ } });
    this.bedStop = [];
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
  }
}
