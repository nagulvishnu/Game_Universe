import { Engine } from "./data";
import { rng } from "./util";

type Wave = OscillatorType;
const SCALES: Record<string, number[]> = {
  min: [0, 2, 3, 5, 7, 8, 10],
  pent: [0, 3, 5, 7, 10],
  dor: [0, 2, 3, 5, 7, 9, 10],
  phr: [0, 1, 3, 5, 7, 8, 10],
};
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

interface EngineProfile { w1: Wave; w2: Wave; w3: Wave; mult: number; r2: number; r3: number; cut: number; grit: number; whine?: boolean; turbo?: boolean }
const PROFILES: Record<Engine, EngineProfile> = {
  v8: { w1: "sawtooth", w2: "square", w3: "sawtooth", mult: 4, r2: 0.5, r3: 2, cut: 1, grit: 3 },
  v10: { w1: "sawtooth", w2: "sawtooth", w3: "square", mult: 5, r2: 1.5, r3: 2, cut: 1.5, grit: 2 },
  v6: { w1: "sawtooth", w2: "triangle", w3: "square", mult: 3.4, r2: 2, r3: 3, cut: 1.7, grit: 1.5 },
  rotary: { w1: "square", w2: "sawtooth", w3: "square", mult: 3, r2: 1.01, r3: 2, cut: 1.9, grit: 4 },
  electric: { w1: "sine", w2: "triangle", w3: "sine", mult: 2, r2: 2, r3: 3, cut: 2.5, grit: 0.2, whine: true },
  turbo: { w1: "sawtooth", w2: "square", w3: "triangle", mult: 2, r2: 0.5, r3: 3, cut: 1.2, grit: 2.5, turbo: true },
  hybrid: { w1: "sawtooth", w2: "square", w3: "sine", mult: 4.5, r2: 0.5, r3: 4, cut: 1.4, grit: 2, whine: true },
};

interface Voice {
  o: OscillatorNode[];
  g: GainNode[];
  filt: BiquadFilterNode;
  out: GainNode;
  pan: StereoPannerNode;
  prof: EngineProfile;
  whine: OscillatorNode;
  whineG: GainNode;
  nitroSrc: AudioBufferSourceNode;
  nitroG: GainNode;
  skidSrc: AudioBufferSourceNode;
  skidG: GainNode;
  skidF: BiquadFilterNode;
  windSrc: AudioBufferSourceNode;
  windG: GainNode;
  gain: number;
}

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicGain!: GainNode;
  sfxGain!: GainNode;
  noise!: AudioBuffer;
  shaper!: WaveShaperNode;
  voices: (Voice | null)[] = [null, null];
  musicVol = 0.6;
  sfxVol = 0.8;
  timer: any = 0;
  rainSrc: AudioBufferSourceNode | null = null;
  rainG: GainNode | null = null;
  thunderT: any = 0;
  musicId = 0;

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const c = this.ctx;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      this.master = c.createGain();
      this.master.gain.value = 0.9;
      this.musicGain = c.createGain();
      this.sfxGain = c.createGain();
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.master.connect(comp);
      comp.connect(c.destination);
      this.setVolumes(this.musicVol, this.sfxVol);
      const len = c.sampleRate * 2;
      this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.shaper = c.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * 2 - 1;
        curve[i] = Math.tanh(x * 2.2);
      }
      this.shaper.curve = curve;
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }
  setVolumes(m: number, s: number) {
    this.musicVol = m;
    this.sfxVol = s;
    if (this.ctx) {
      this.musicGain.gain.value = m * 0.5;
      this.sfxGain.gain.value = s;
    }
  }
  private nz(loop = true) {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    s.loop = loop;
    return s;
  }
  private tone(f: number, t: number, dur: number, type: Wave, gain: number, dest: AudioNode, cut = 0, f2 = 0) {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o;
    if (cut) {
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = cut;
      o.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  private burst(t: number, dur: number, gain: number, type: BiquadFilterType, freq: number, dest: AudioNode, pan = 0, q = 0.7, fEnd = 0) {
    const c = this.ctx!;
    const s = this.nz(false);
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (fEnd) f.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = c.createStereoPanner();
    p.pan.value = pan;
    s.connect(f);
    f.connect(g);
    g.connect(p);
    p.connect(dest);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  // ------------------------------------------------------------ UI
  ui(kind: "move" | "select" | "back" | "buy" | "error" | "ready" | "start") {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const d = this.sfxGain;
    switch (kind) {
      case "move": this.tone(660, t, 0.06, "square", 0.05, d, 3000); break;
      case "select": this.tone(520, t, 0.08, "square", 0.07, d, 4000); this.tone(780, t + 0.06, 0.1, "square", 0.07, d, 4000); break;
      case "back": this.tone(440, t, 0.08, "square", 0.06, d, 2000, 300); break;
      case "buy": [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.06, 0.15, "triangle", 0.1, d)); break;
      case "error": this.tone(160, t, 0.2, "sawtooth", 0.08, d, 800); break;
      case "ready": this.tone(880, t, 0.12, "triangle", 0.1, d); this.tone(1320, t + 0.08, 0.2, "triangle", 0.1, d); break;
      case "start": this.burst(t, 0.6, 0.3, "bandpass", 300, d, 0, 1, 3000); this.tone(220, t, 0.5, "sawtooth", 0.1, d, 2000, 880); break;
    }
  }
  beep(go: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(go ? 1046 : 523, t, go ? 0.6 : 0.25, "square", 0.12, this.sfxGain, 5000);
    if (go) this.tone(1568, t, 0.6, "triangle", 0.08, this.sfxGain);
  }

  // ------------------------------------------------------------ voices
  startEngine(i: number, kind: Engine, vol: number) {
    if (!this.ctx) return;
    this.stopEngine(i);
    const c = this.ctx;
    const prof = PROFILES[kind];
    const out = c.createGain();
    out.gain.value = 0;
    const pan = c.createStereoPanner();
    pan.pan.value = i === 0 ? -0.5 : 0.5;
    const filt = c.createBiquadFilter();
    filt.type = "lowpass";
    filt.Q.value = 2;
    const o: OscillatorNode[] = [], g: GainNode[] = [];
    const ws = c.createWaveShaper();
    ws.curve = this.shaper.curve;
    [prof.w1, prof.w2, prof.w3].forEach((w, k) => {
      const os = c.createOscillator();
      os.type = w;
      const gg = c.createGain();
      gg.gain.value = [0.5, 0.3, 0.2][k];
      os.connect(gg);
      gg.connect(ws);
      os.start();
      o.push(os);
      g.push(gg);
    });
    ws.connect(filt);
    filt.connect(out);
    out.connect(pan);
    pan.connect(this.sfxGain);
    const whine = c.createOscillator();
    whine.type = "sine";
    const whineG = c.createGain();
    whineG.gain.value = 0;
    whine.connect(whineG);
    whineG.connect(out);
    whine.start();
    const nitroSrc = this.nz();
    const nf = c.createBiquadFilter();
    nf.type = "bandpass";
    nf.frequency.value = 1400;
    nf.Q.value = 0.6;
    const nitroG = c.createGain();
    nitroG.gain.value = 0;
    nitroSrc.connect(nf);
    nf.connect(nitroG);
    nitroG.connect(pan);
    nitroSrc.start();
    const skidSrc = this.nz();
    const skidF = c.createBiquadFilter();
    skidF.type = "bandpass";
    skidF.frequency.value = 2000;
    skidF.Q.value = 4;
    const skidG = c.createGain();
    skidG.gain.value = 0;
    skidSrc.connect(skidF);
    skidF.connect(skidG);
    skidG.connect(pan);
    skidSrc.start();
    const windSrc = this.nz();
    const wf = c.createBiquadFilter();
    wf.type = "lowpass";
    wf.frequency.value = 600;
    const windG = c.createGain();
    windG.gain.value = 0;
    windSrc.connect(wf);
    wf.connect(windG);
    windG.connect(pan);
    windSrc.start();
    this.voices[i] = { o, g, filt, out, pan, prof, whine, whineG, nitroSrc, nitroG, skidSrc, skidG, skidF, windSrc, windG, gain: vol };
  }
  updateEngine(i: number, rpm: number, thr: number, nitro: boolean, skid: number, speed: number, offroad: boolean) {
    const v = this.voices[i];
    if (!v || !this.ctx) return;
    const t = this.ctx.currentTime;
    const crank = 900 + rpm * 7000;
    const f = (crank / 60) * v.prof.mult;
    const rs = [1, v.prof.r2, v.prof.r3];
    v.o.forEach((o, k) => o.frequency.setTargetAtTime(f * rs[k] * (k === 1 && v.prof.r2 === 1.01 ? 1 : 1), t, 0.03));
    v.filt.frequency.setTargetAtTime((350 + rpm * 2200 + thr * 1800) * v.prof.cut, t, 0.05);
    const eg = (0.05 + thr * 0.07 + rpm * 0.04) * v.gain * (nitro ? 1.5 : 1);
    v.out.gain.setTargetAtTime(eg, t, 0.04);
    if (v.prof.whine || v.prof.turbo) {
      v.whine.frequency.setTargetAtTime(v.prof.turbo ? 1800 + rpm * 2600 : 500 + rpm * 2800, t, 0.05);
      v.whineG.gain.setTargetAtTime((v.prof.turbo ? thr * rpm * 0.05 : 0.04 + thr * 0.05) * v.gain, t, 0.08);
    }
    v.nitroG.gain.setTargetAtTime(nitro ? 0.22 * v.gain : 0, t, nitro ? 0.05 : 0.2);
    v.skidG.gain.setTargetAtTime(skid * 0.2 * v.gain, t, 0.05);
    v.skidF.frequency.setTargetAtTime(1500 + speed * 12 + (offroad ? -600 : 0), t, 0.1);
    v.windG.gain.setTargetAtTime(Math.min(1, speed / 90) * 0.14 * v.gain, t, 0.1);
  }
  stopEngine(i: number) {
    const v = this.voices[i];
    if (!v) return;
    const stop = (n: AudioScheduledSourceNode) => { try { n.stop(); } catch { /* */ } };
    v.o.forEach(stop);
    stop(v.whine); stop(v.nitroSrc); stop(v.skidSrc); stop(v.windSrc);
    v.out.disconnect(); v.pan.disconnect();
    this.voices[i] = null;
  }
  stopEngines() {
    this.stopEngine(0);
    this.stopEngine(1);
  }
  silenceEngines(on: boolean) {
    this.voices.forEach((v) => {
      if (v && this.ctx) {
        v.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
        v.skidG.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
        v.nitroG.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
        v.windG.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
        void on;
      }
    });
  }

  // ------------------------------------------------------------ one shots
  impact(strength: number, pan = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = Math.min(1, strength / 20);
    this.burst(t, 0.35, 0.4 * s + 0.1, "lowpass", 1400, this.sfxGain, pan, 0.7, 200);
    this.burst(t, 0.15, 0.25 * s, "highpass", 3000, this.sfxGain, pan);
    this.tone(90, t, 0.25, "sine", 0.4 * s + 0.1, this.sfxGain, 0, 35);
  }
  scrape(pan = 0) {
    if (!this.ctx) return;
    this.burst(this.ctx.currentTime, 0.12, 0.12, "bandpass", 3500, this.sfxGain, pan, 2);
  }
  shift(pan = 0) {
    if (!this.ctx) return;
    this.burst(this.ctx.currentTime, 0.09, 0.15, "bandpass", 900, this.sfxGain, pan, 1.5, 300);
  }
  nitroStart(pan = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.burst(t, 0.8, 0.4, "bandpass", 500, this.sfxGain, pan, 0.8, 5000);
    this.tone(180, t, 0.7, "sawtooth", 0.12, this.sfxGain, 3000, 900);
  }
  land(strength: number, pan = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(70, t, 0.2, "sine", Math.min(0.5, strength / 30), this.sfxGain, 0, 30);
    this.burst(t, 0.15, 0.2, "lowpass", 800, this.sfxGain, pan);
  }
  driftBank(pan = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [880, 1175, 1568].forEach((f, i) => this.tone(f, t + i * 0.05, 0.14, "triangle", 0.08, this.sfxGain));
    void pan;
  }
  item(kind: string) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const d = this.sfxGain;
    if (kind === "pickup") { this.tone(600, t, 0.1, "square", 0.08, d, 4000, 1200); this.tone(900, t + 0.08, 0.15, "square", 0.08, d, 4000, 1800); }
    else if (kind === "emp") { this.tone(1800, t, 0.5, "sawtooth", 0.1, d, 6000, 80); this.burst(t, 0.5, 0.3, "highpass", 2000, d); }
    else if (kind === "oil") { this.burst(t, 0.3, 0.25, "lowpass", 600, d, 0, 1, 150); }
    else if (kind === "shield") { this.tone(300, t, 0.5, "sine", 0.15, d, 0, 1200); }
    else if (kind === "snare") { this.tone(900, t, 0.6, "triangle", 0.12, d, 0, 120); }
    else if (kind === "flare") { this.burst(t, 0.5, 0.25, "highpass", 4000, d); this.tone(1400, t, 0.3, "square", 0.05, d, 5000, 600); }
    else if (kind === "boost") { this.nitroStart(); }
    else if (kind === "hit") { this.tone(120, t, 0.4, "sawtooth", 0.15, d, 900, 40); }
  }
  victory() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [60, 64, 67, 72, 67, 72, 76, 79, 76, 84];
    notes.forEach((n, i) => {
      this.tone(mtof(n), t + i * 0.13, 0.4, "square", 0.08, this.musicGain, 4000);
      this.tone(mtof(n - 12), t + i * 0.13, 0.4, "triangle", 0.1, this.musicGain);
    });
    [60, 64, 67, 72].forEach((n) => this.tone(mtof(n), t + 1.4, 1.8, "sawtooth", 0.05, this.musicGain, 2500));
  }

  // ------------------------------------------------------------ weather
  weather(level: number, storm: boolean) {
    if (!this.ctx) return;
    this.stopWeather();
    if (level <= 0) return;
    const c = this.ctx;
    const s = this.nz();
    const f = c.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 1500;
    const g = c.createGain();
    g.gain.value = 0.05 + level * 0.1;
    s.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    s.start();
    this.rainSrc = s;
    this.rainG = g;
    if (storm) {
      const sched = () => {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.burst(t, 2.2, 0.7, "lowpass", 400, this.sfxGain, (Math.random() - 0.5) * 1.5, 0.7, 40);
        this.burst(t, 0.3, 0.5, "bandpass", 1200, this.sfxGain, 0, 0.5, 100);
        this.thunderT = setTimeout(sched, 6000 + Math.random() * 9000);
      };
      this.thunderT = setTimeout(sched, 2500);
    }
  }
  thunder() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.burst(t, 2.4, 0.6, "lowpass", 380, this.sfxGain, 0, 0.7, 40);
  }
  stopWeather() {
    clearTimeout(this.thunderT);
    try { this.rainSrc?.stop(); } catch { /* */ }
    this.rainSrc = null;
  }

  // ------------------------------------------------------------ music
  startMusic(cfg: { bpm: number; root: number; scale: "min" | "pent" | "dor" | "phr"; wave: Wave }, mood: "race" | "menu" = "race") {
    if (!this.ctx) return;
    this.stopMusic();
    const c = this.ctx;
    const id = ++this.musicId;
    const R = rng(cfg.root * 31 + cfg.bpm);
    const sc = SCALES[cfg.scale];
    const deg = (n: number) => sc[((n % sc.length) + sc.length) % sc.length] + 12 * Math.floor(n / sc.length);
    const bass = Array.from({ length: 16 }, (_, i) => (i % 4 === 0 ? 0 : R() < 0.35 ? [0, 0, 2, 4][Math.floor(R() * 4)] : -99));
    const arp = Array.from({ length: 16 }, () => (R() < 0.7 ? Math.floor(R() * 7) : -99));
    const prog = [0, 5, 3, 4].map((n) => (R() < 0.3 ? n + 2 : n));
    const stepDur = 60 / cfg.bpm / 4;
    let next = c.currentTime + 0.1;
    let step = 0;
    const race = mood === "race";
    const sched = (st: number, t: number) => {
      const bar = Math.floor(st / 16) % 4;
      const k = st % 16;
      const chord = prog[bar];
      if (k === 0) [0, 2, 4].forEach((n) => this.tone(mtof(cfg.root + 12 + deg(chord + n)), t, stepDur * 15, "triangle", 0.035, this.musicGain, 1800));
      const b = bass[k];
      if (b !== -99) this.tone(mtof(cfg.root - 12 + deg(chord + b)), t, stepDur * 1.8, "sawtooth", race ? 0.11 : 0.07, this.musicGain, 500 + (k % 8) * 60);
      const a = arp[k];
      if (a !== -99) this.tone(mtof(cfg.root + 12 + deg(chord + a) + (k % 8 > 4 ? 12 : 0)), t, stepDur * 1.2, cfg.wave, race ? 0.04 : 0.03, this.musicGain, 3500);
      if (race) {
        if (k % 4 === 0) { this.tone(130, t, 0.18, "sine", 0.3, this.musicGain, 0, 40); }
        if (k === 4 || k === 12) this.burst(t, 0.14, 0.14, "bandpass", 1800, this.musicGain, 0, 0.8);
        if (k % 2 === 0) this.burst(t, 0.04, 0.05, "highpass", 7000, this.musicGain);
      } else if (k % 8 === 0) this.tone(120, t, 0.25, "sine", 0.15, this.musicGain, 0, 45);
    };
    this.timer = setInterval(() => {
      if (id !== this.musicId || !this.ctx) return;
      while (next < this.ctx.currentTime + 0.2) {
        sched(step++, next);
        next += stepDur;
      }
    }, 40);
  }
  stopMusic() {
    this.musicId++;
    clearInterval(this.timer);
  }
}
export const audio = new AudioEngine();
export const MENU_MUSIC = { bpm: 100, root: 57, scale: "pent" as const, wave: "triangle" as OscillatorType };
