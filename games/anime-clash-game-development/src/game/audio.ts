// Fully procedural Web Audio engine: SFX, ambience and generative music. No external assets.

type OscType = OscillatorType;

interface Track {
  bpm: number;
  root: number; // Hz
  prog: [number, "m" | "M"][];
  bass: OscType;
  bassPat: number[];
  arp: OscType;
  arpPat: number[];
  arpOct: number;
  kick: number[];
  snare: number[];
  hat: number[];
  taiko: number[];
  pad: OscType;
  padVol: number;
  lead: OscType | null;
  swing?: number;
}

const P = (s: string) => s.split("").map((c) => (c === "x" ? 1 : c === "-" ? 0 : Number(c)));

const TRACKS: Record<string, Track> = {
  menu: {
    bpm: 92, root: 110, prog: [[0, "m"], [-4, "M"], [-9, "M"], [-2, "M"]], bass: "sawtooth",
    bassPat: P("x---x---x--x-x--"), arp: "triangle", arpPat: [0, -1, 1, -1, 2, -1, 1, -1, 0, -1, 1, -1, 2, -1, 3, -1], arpOct: 2,
    kick: P("x-------x-x-----"), snare: P("--------x-------"), hat: P("x-x-x-x-x-x-x-x-"), taiko: P("x---------x-----"),
    pad: "sawtooth", padVol: 0.05, lead: "sine",
  },
  tokyo: {
    bpm: 120, root: 87.31, prog: [[0, "m"], [-4, "M"], [-9, "M"], [-2, "M"]], bass: "sawtooth",
    bassPat: P("x-xxx-xxx-xxx-xx"), arp: "square", arpPat: [0, 1, 2, 1, 0, 1, 2, 3, 0, 1, 2, 1, 2, 3, 2, 1], arpOct: 2,
    kick: P("x---x---x---x---"), snare: P("----x-------x---"), hat: P("--x---x---x---x-"), taiko: P("----------------"),
    pad: "sawtooth", padVol: 0.04, lead: "square",
  },
  dragon: {
    bpm: 104, root: 73.42, prog: [[0, "m"], [-4, "M"], [-2, "M"], [0, "m"]], bass: "triangle",
    bassPat: P("x-----x-x-------"), arp: "sine", arpPat: [0, -1, -1, 2, -1, -1, 1, -1, -1, 2, -1, -1, 3, -1, 1, -1], arpOct: 2,
    kick: P("x---------------"), snare: P("--------x-------"), hat: P("----------------"), taiko: P("x--x--x-x-x--x--"),
    pad: "sawtooth", padVol: 0.05, lead: "sine",
  },
  celestial: {
    bpm: 82, root: 98, prog: [[0, "M"], [-3, "m"], [-7, "M"], [-5, "M"]], bass: "sine",
    bassPat: P("x-------x-------"), arp: "sine", arpPat: [0, 1, 2, 3, 2, 1, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1], arpOct: 3,
    kick: P("x-------x-------"), snare: P("----------------"), hat: P("--x---x---x---x-"), taiko: P("----------------"),
    pad: "triangle", padVol: 0.08, lead: "sine",
  },
};

const MIN = [0, 3, 7, 10, 12];
const MAJ = [0, 4, 7, 11, 12];
const PENT = [0, 3, 5, 7, 10, 12, 15, 17];

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicGain!: GainNode;
  sfxGain!: GainNode;
  verb!: ConvolverNode;
  verbGain!: GainNode;
  noiseBuf!: AudioBuffer;
  vol = { master: 0.8, music: 0.5, sfx: 0.8 };
  musicId = "";
  private timer: number | null = null;
  private nextT = 0;
  private step = 0;
  private lastLead = 0;
  private amb: { stop: () => void } | null = null;
  private lastSfx: Record<string, number> = {};

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.musicGain = ctx.createGain();
    this.sfxGain = ctx.createGain();
    this.verb = ctx.createConvolver();
    this.verbGain = ctx.createGain();
    this.verbGain.gain.value = 0.35;
    // generated impulse
    const len = ctx.sampleRate * 2.2;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    this.verb.buffer = ir;
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.sfxGain.connect(this.verb);
    this.musicGain.connect(this.verb);
    this.verb.connect(this.verbGain);
    this.verbGain.connect(this.master);
    this.master.connect(comp);
    comp.connect(ctx.destination);
    this.applyVolumes();
    if (this.musicId) {
      const id = this.musicId;
      this.musicId = "";
      this.music(id);
    }
  }

  setVolumes(v: Partial<{ master: number; music: number; sfx: number }>) {
    this.vol = { ...this.vol, ...v };
    this.applyVolumes();
  }
  private applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.vol.master;
    this.musicGain.gain.value = this.vol.music * 0.9;
    this.sfxGain.gain.value = this.vol.sfx;
  }

  // ---------- primitives ----------
  private osc(type: OscType, f0: number, t: number, dur: number, g: number, o: { f1?: number; dest?: AudioNode; attack?: number; detune?: number; pan?: number } = {}) {
    const ctx = this.ctx!;
    const os = ctx.createOscillator();
    const gn = ctx.createGain();
    os.type = type;
    os.frequency.setValueAtTime(f0, t);
    if (o.f1) os.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + dur);
    if (o.detune) os.detune.value = o.detune;
    const a = o.attack ?? 0.004;
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(g, t + a);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    os.connect(gn);
    let out: AudioNode = gn;
    if (o.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = o.pan;
      gn.connect(p);
      out = p;
    }
    out.connect(o.dest ?? this.sfxGain);
    os.start(t);
    os.stop(t + dur + 0.05);
  }
  private noise(t: number, dur: number, g: number, o: { type?: BiquadFilterType; f0?: number; f1?: number; q?: number; dest?: AudioNode; attack?: number; pan?: number } = {}) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? "lowpass";
    f.frequency.setValueAtTime(o.f0 ?? 2000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + dur);
    f.Q.value = o.q ?? 0.7;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(g, t + (o.attack ?? 0.003));
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(gn);
    let out: AudioNode = gn;
    if (o.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = o.pan;
      gn.connect(p);
      out = p;
    }
    out.connect(o.dest ?? this.sfxGain);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  // ---------- SFX ----------
  play(name: string, vol = 1, pan = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    // rate-limit identical sounds
    if (this.lastSfx[name] && now - this.lastSfx[name] < 0.035) return;
    this.lastSfx[name] = now;
    const t = now + 0.001;
    const v = vol;
    const pn = Math.max(-1, Math.min(1, pan));
    switch (name) {
      case "ui_move": this.osc("triangle", 660, t, 0.07, 0.12 * v); this.osc("triangle", 990, t + 0.03, 0.06, 0.08 * v); break;
      case "ui_select": this.osc("square", 440, t, 0.1, 0.1 * v); this.osc("square", 880, t + 0.06, 0.18, 0.1 * v); this.noise(t, 0.18, 0.08 * v, { type: "highpass", f0: 4000 }); break;
      case "ui_back": this.osc("triangle", 500, t, 0.12, 0.12 * v, { f1: 250 }); break;
      case "ready": [523, 659, 784, 1047].forEach((f, i) => this.osc("sawtooth", f, t + i * 0.06, 0.35, 0.09 * v)); this.noise(t, 0.4, 0.1 * v, { type: "highpass", f0: 3000 }); break;
      case "count": this.osc("square", 440, t, 0.18, 0.14 * v); this.osc("sine", 220, t, 0.25, 0.2 * v); break;
      case "go": this.osc("sawtooth", 660, t, 0.5, 0.16 * v, { f1: 1320 }); this.osc("sawtooth", 330, t, 0.5, 0.14 * v); this.noise(t, 0.6, 0.18 * v, { f0: 6000, f1: 800 }); this.osc("sine", 70, t, 0.5, 0.4 * v, { f1: 35 }); break;
      case "punch": this.noise(t, 0.09, 0.5 * v, { f0: 3000, f1: 400, pan: pn }); this.osc("sine", 160, t, 0.12, 0.5 * v, { f1: 60, pan: pn }); break;
      case "kick": this.noise(t, 0.11, 0.55 * v, { f0: 2400, f1: 300, pan: pn }); this.osc("sine", 120, t, 0.16, 0.55 * v, { f1: 45, pan: pn }); this.osc("triangle", 300, t, 0.06, 0.2 * v, { f1: 100 }); break;
      case "heavy": this.noise(t, 0.28, 0.8 * v, { f0: 2600, f1: 120, pan: pn }); this.osc("sine", 90, t, 0.35, 0.9 * v, { f1: 30, pan: pn }); this.osc("square", 200, t, 0.08, 0.2 * v, { f1: 60 }); break;
      case "whoosh": this.noise(t, 0.22, 0.2 * v, { type: "bandpass", f0: 500, f1: 3000, q: 1.2, attack: 0.08, pan: pn }); break;
      case "jump": this.noise(t, 0.15, 0.12 * v, { type: "bandpass", f0: 300, f1: 1200, q: 1 }); break;
      case "dash": this.noise(t, 0.28, 0.3 * v, { type: "bandpass", f0: 1800, f1: 400, q: 0.8, attack: 0.02, pan: pn }); break;
      case "land": this.noise(t, 0.12, 0.3 * v, { f0: 500, f1: 80 }); this.osc("sine", 80, t, 0.15, 0.35 * v, { f1: 40 }); break;
      case "block": this.osc("square", 1200, t, 0.08, 0.14 * v, { f1: 700 }); this.noise(t, 0.12, 0.35 * v, { type: "bandpass", f0: 2500, q: 2 }); this.osc("sine", 200, t, 0.1, 0.3 * v); break;
      case "parry": this.osc("sine", 2200, t, 0.5, 0.2 * v); this.osc("sine", 3300, t, 0.4, 0.12 * v); this.osc("triangle", 1100, t, 0.3, 0.15 * v); this.noise(t, 0.1, 0.4 * v, { type: "highpass", f0: 5000 }); break;
      case "guardbreak": this.osc("sawtooth", 400, t, 0.4, 0.25 * v, { f1: 60 }); this.noise(t, 0.4, 0.5 * v, { f0: 6000, f1: 200 }); break;
      case "fire": this.noise(t, 0.4, 0.45 * v, { type: "bandpass", f0: 400, f1: 2400, q: 0.9, attack: 0.04, pan: pn }); this.osc("sawtooth", 140, t, 0.3, 0.15 * v, { f1: 70 }); break;
      case "thunder": for (let i = 0; i < 6; i++) this.noise(t + i * 0.025 + Math.random() * 0.02, 0.05, 0.4 * v, { type: "highpass", f0: 3000 + Math.random() * 3000, pan: pn }); this.osc("sawtooth", 1800, t, 0.18, 0.15 * v, { f1: 200 }); this.osc("sine", 60, t, 0.5, 0.5 * v, { f1: 28 }); break;
      case "ice": this.noise(t, 0.3, 0.2 * v, { type: "highpass", f0: 5000, pan: pn }); [2400, 3100, 3900, 4700].forEach((f, i) => this.osc("sine", f, t + i * 0.03, 0.3, 0.1 * v)); break;
      case "dark": this.osc("sawtooth", 90, t, 0.6, 0.3 * v, { f1: 40, detune: 20 }); this.osc("sawtooth", 93, t, 0.6, 0.25 * v, { f1: 38 }); this.noise(t, 0.6, 0.25 * v, { type: "bandpass", f0: 200, f1: 1500, q: 2, attack: 0.3 }); break;
      case "freeze": this.noise(t, 0.5, 0.35 * v, { type: "highpass", f0: 3000 }); this.osc("sine", 3000, t, 0.5, 0.15 * v, { f1: 800 }); this.osc("sine", 70, t, 0.4, 0.4 * v); break;
      case "shatter": for (let i = 0; i < 8; i++) this.osc("sine", 2000 + Math.random() * 3500, t + Math.random() * 0.12, 0.25, 0.1 * v); this.noise(t, 0.35, 0.5 * v, { type: "highpass", f0: 2500 }); break;
      case "explosion": this.noise(t, 0.9, 0.9 * v, { f0: 3500, f1: 70, pan: pn }); this.osc("sine", 70, t, 0.8, 1 * v, { f1: 24 }); this.noise(t + 0.05, 0.4, 0.4 * v, { type: "bandpass", f0: 900, q: 0.5 }); break;
      case "bigexplosion": this.noise(t, 2.0, 1 * v, { f0: 4500, f1: 50 }); this.osc("sine", 55, t, 1.6, 1.2 * v, { f1: 18 }); this.osc("sawtooth", 80, t, 1.2, 0.3 * v, { f1: 25 }); this.noise(t + 0.1, 1.2, 0.5 * v, { type: "bandpass", f0: 600, f1: 150, q: 0.4 }); break;
      case "charge": this.osc("sawtooth", 80, t, 1.2, 0.2 * v, { f1: 700, attack: 0.9 }); this.osc("sine", 160, t, 1.2, 0.3 * v, { f1: 1400, attack: 1 }); this.noise(t, 1.2, 0.3 * v, { type: "bandpass", f0: 300, f1: 4000, q: 1.5, attack: 1 }); break;
      case "ult": this.osc("sine", 50, t, 1.2, 1.1 * v, { f1: 25 }); this.osc("sawtooth", 220, t, 0.9, 0.2 * v, { f1: 880, attack: 0.6 }); this.noise(t, 0.9, 0.5 * v, { f0: 8000, f1: 200 }); [523, 659, 784].forEach((f, i) => this.osc("square", f, t + 0.1 + i * 0.05, 0.8, 0.08 * v)); break;
      case "transform": this.osc("sawtooth", 60, t, 1.4, 0.4 * v, { f1: 500, attack: 1 }); this.osc("sine", 40, t, 1.4, 0.8 * v); this.noise(t, 1.4, 0.4 * v, { type: "bandpass", f0: 200, f1: 6000, q: 1, attack: 1.1 }); [0, 4, 7, 12].forEach((s, i) => this.osc("sawtooth", 220 * Math.pow(2, s / 12), t + 1.1 + i * 0.03, 0.9, 0.1 * v)); break;
      case "clash": this.noise(t, 1.5, 1 * v, { f0: 9000, f1: 100 }); this.osc("sine", 45, t, 1.4, 1.2 * v, { f1: 15 }); this.osc("sawtooth", 1500, t, 1.2, 0.2 * v, { f1: 100 }); this.osc("square", 100, t, 0.8, 0.3 * v, { f1: 700 }); break;
      case "ko": this.osc("sine", 60, t, 1.0, 1 * v, { f1: 20 }); this.noise(t, 0.8, 0.7 * v, { f0: 5000, f1: 100 }); this.osc("sawtooth", 880, t, 0.6, 0.15 * v, { f1: 110 }); break;
      case "victory": [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => { this.osc("sawtooth", 262 * Math.pow(2, s / 12), t + i * 0.11, 0.9, 0.1 * v); this.osc("triangle", 131 * Math.pow(2, s / 12), t + i * 0.11, 1.2, 0.12 * v); }); this.osc("sine", 60, t, 1, 0.5 * v, { f1: 30 }); break;
      case "defeat": [0, -2, -5, -9].forEach((s, i) => this.osc("sawtooth", 262 * Math.pow(2, s / 12), t + i * 0.3, 0.9, 0.09 * v)); break;
      case "round": this.osc("sine", 90, t, 0.6, 0.6 * v, { f1: 40 }); this.osc("sawtooth", 330, t, 0.4, 0.1 * v, { f1: 165 }); break;
      case "pickup": this.osc("sine", 880, t, 0.12, 0.12 * v, { f1: 1760 }); break;
    }
  }

  // ---------- Music ----------
  music(id: string) {
    if (this.musicId === id) return;
    this.musicId = id;
    this.stopMusic(false);
    if (!this.ctx || !id || !TRACKS[id]) return;
    this.step = 0;
    this.nextT = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }
  stopMusic(clearId = true) {
    if (clearId) this.musicId = "";
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
  }
  private schedule() {
    const ctx = this.ctx;
    const tr = TRACKS[this.musicId];
    if (!ctx || !tr) return;
    const spb = 60 / tr.bpm / 4;
    while (this.nextT < ctx.currentTime + 0.18) {
      this.playStep(tr, this.step, this.nextT, spb);
      this.nextT += spb;
      this.step++;
    }
  }
  private playStep(tr: Track, step: number, t: number, spb: number) {
    const s = step % 16;
    const bar = Math.floor(step / 16) % tr.prog.length;
    const [rootOff, q] = tr.prog[bar];
    const ch = q === "m" ? MIN : MAJ;
    const rootF = tr.root * Math.pow(2, rootOff / 12);
    const dest = this.musicGain;
    const hz = (semi: number, oct = 0) => rootF * Math.pow(2, semi / 12 + oct);
    if (tr.bassPat[s]) {
      const lp = this.ctx!.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 500; lp.connect(dest);
      this.osc(tr.bass, hz(0), t, spb * 1.8, 0.22, { dest: lp });
      if (tr.bass === "sawtooth") this.osc("sine", hz(0), t, spb * 1.8, 0.2, { dest });
    }
    if (tr.arpPat[s] >= 0) {
      const n = ch[tr.arpPat[s] % ch.length];
      this.osc(tr.arp, hz(n, tr.arpOct - 1 + 1), t, spb * 2.4, tr.arp === "square" ? 0.05 : 0.11, { dest });
    }
    if (tr.kick[s]) { this.osc("sine", 140, t, 0.2, 0.7, { f1: 42, dest }); }
    if (tr.snare[s]) { this.noise(t, 0.16, 0.3, { type: "bandpass", f0: 1800, q: 0.8, dest }); this.osc("triangle", 220, t, 0.1, 0.2, { f1: 120, dest }); }
    if (tr.hat[s]) this.noise(t, 0.04, 0.12, { type: "highpass", f0: 7500, dest });
    if (tr.taiko[s]) { this.osc("sine", 95, t, 0.4, 0.9, { f1: 45, dest }); this.noise(t, 0.12, 0.3, { f0: 1200, f1: 200, dest }); }
    if (s === 0) {
      // pad chord
      for (const n of [ch[0], ch[1], ch[2]]) {
        for (const d of [-6, 6]) {
          this.osc(tr.pad, hz(n, 0), t, spb * 16.5, tr.padVol, { attack: spb * 5, detune: d, dest });
        }
      }
    }
    if (tr.lead && s % 2 === 0 && Math.random() < 0.38) {
      const pool = PENT.filter((n) => n <= 17);
      const idx = Math.max(0, Math.min(pool.length - 1, this.lastLead + Math.floor(Math.random() * 3) - 1));
      this.lastLead = idx;
      this.osc(tr.lead, hz(pool[idx], 1), t, spb * 4, tr.lead === "square" ? 0.035 : 0.09, { dest, attack: 0.02 });
    }
  }

  // ---------- Ambience ----------
  ambience(id: string) {
    this.amb?.stop();
    this.amb = null;
    if (!this.ctx || !id) return;
    const ctx = this.ctx;
    const nodes: AudioScheduledSourceNode[] = [];
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.linearRampToValueAtTime(1, ctx.currentTime + 2);
    g.connect(this.musicGain);
    const mkNoise = (type: BiquadFilterType, f: number, q: number, vol: number) => {
      const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const gn = ctx.createGain(); gn.gain.value = vol;
      s.connect(fl); fl.connect(gn); gn.connect(g); s.start(); nodes.push(s);
      return fl;
    };
    const mkDrone = (f: number, vol: number, type: OscType = "sine") => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
      const gn = ctx.createGain(); gn.gain.value = vol; o.connect(gn); gn.connect(g); o.start(); nodes.push(o);
      return o;
    };
    let lfo: number | null = null;
    if (id === "tokyo") {
      mkNoise("highpass", 3500, 0.5, 0.07); mkNoise("lowpass", 300, 0.5, 0.12); mkDrone(55, 0.04, "sawtooth");
    } else if (id === "dragon") {
      const f = mkNoise("bandpass", 420, 0.8, 0.12);
      mkDrone(48, 0.07); mkDrone(72, 0.03);
      let ph = 0;
      lfo = window.setInterval(() => { ph += 0.05; f.frequency.value = 380 + Math.sin(ph) * 160; }, 60);
    } else if (id === "celestial") {
      const f = mkNoise("bandpass", 900, 2, 0.05);
      mkDrone(196, 0.02, "triangle"); mkDrone(293.7, 0.015, "triangle"); mkDrone(49, 0.05);
      let ph = 0;
      lfo = window.setInterval(() => { ph += 0.04; f.frequency.value = 900 + Math.sin(ph) * 500; }, 60);
    }
    this.amb = {
      stop: () => {
        try { g.gain.cancelScheduledValues(ctx.currentTime); g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.6); } catch { /* noop */ }
        if (lfo) window.clearInterval(lfo);
        setTimeout(() => { nodes.forEach((n) => { try { n.stop(); } catch { /* noop */ } }); g.disconnect(); }, 700);
      },
    };
  }
  stopAmbience() { this.amb?.stop(); this.amb = null; }
}

export const audio = new AudioEngine();
