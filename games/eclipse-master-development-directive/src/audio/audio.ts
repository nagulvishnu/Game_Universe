// Audio engine: generative leitmotif score, procedural SFX/ambience, TTS voices. Safe to import in Node (no-ops).
import type { MusicCue } from '../engine/types';

interface Cue {
  root: number; scale: number[]; tempo: number; prog: number[]; pad: number; arp: number; bass: number;
  drums: 'none' | 'soft' | 'war'; lead: number; vol: number;
}
const MINOR = [0, 2, 3, 5, 7, 8, 10], DORIAN = [0, 2, 3, 5, 7, 9, 10], MAJOR = [0, 2, 4, 5, 7, 9, 11], PHRYG = [0, 1, 3, 5, 7, 8, 10];
const CUES: Record<MusicCue, Cue | null> = {
  silence: null,
  prologue: { root: 45, scale: MINOR, tempo: 54, prog: [0, 5, 3, 4], pad: 1, arp: 0, bass: 0.6, drums: 'soft', lead: 1, vol: 0.9 },
  dawn: { root: 50, scale: MAJOR, tempo: 72, prog: [0, 4, 5, 3], pad: 0.8, arp: 1, bass: 0.4, drums: 'none', lead: 0.6, vol: 0.8 },
  mystery: { root: 47, scale: DORIAN, tempo: 62, prog: [0, 3, 0, 4], pad: 1, arp: 1, bass: 0.3, drums: 'none', lead: 0.35, vol: 0.8 },
  tension: { root: 43, scale: PHRYG, tempo: 88, prog: [0, 1, 0, 5], pad: 0.9, arp: 2, bass: 0.9, drums: 'soft', lead: 0.2, vol: 0.9 },
  battle: { root: 40, scale: PHRYG, tempo: 132, prog: [0, 5, 3, 4], pad: 0.6, arp: 2, bass: 1, drums: 'war', lead: 0.7, vol: 1 },
  sorrow: { root: 45, scale: MINOR, tempo: 50, prog: [0, 5, 2, 4], pad: 1, arp: 0, bass: 0.3, drums: 'none', lead: 0.9, vol: 0.85 },
  campfire: { root: 52, scale: DORIAN, tempo: 66, prog: [0, 3, 4, 0], pad: 0.5, arp: 1, bass: 0.2, drums: 'none', lead: 0.5, vol: 0.7 },
  dread: { root: 38, scale: PHRYG, tempo: 56, prog: [0, 1, 0, 6], pad: 1, arp: 0, bass: 1, drums: 'soft', lead: 0.1, vol: 0.9 },
  triumph: { root: 48, scale: MAJOR, tempo: 100, prog: [0, 4, 5, 3], pad: 0.9, arp: 2, bass: 0.8, drums: 'war', lead: 1, vol: 1 },
  finale: { root: 45, scale: MINOR, tempo: 76, prog: [0, 5, 2, 6], pad: 1, arp: 2, bass: 0.8, drums: 'soft', lead: 1, vol: 1 },
  epilogue: { root: 50, scale: MAJOR, tempo: 64, prog: [0, 3, 4, 0], pad: 1, arp: 1, bass: 0.3, drums: 'none', lead: 1, vol: 0.85 },
  credits: { root: 48, scale: MAJOR, tempo: 80, prog: [0, 4, 5, 3], pad: 1, arp: 1, bass: 0.5, drums: 'soft', lead: 1, vol: 0.9 },
};
// The "Eclipse theme": [scale degree, step within 16-step phrase]
const THEME: [number, number][] = [[7, 0], [9, 3], [11, 4], [9, 7], [10, 8], [9, 10], [7, 12], [6, 14]];

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode; musicBus!: GainNode; sfxBus!: GainNode; voiceBus: GainNode | null = null;
  dest: MediaStreamAudioDestinationNode | null = null;
  private reverb!: ConvolverNode;
  private noiseBuf!: AudioBuffer;
  private cueBus: GainNode | null = null;
  private cue: Cue | null = null;
  cueName: MusicCue = 'silence';
  private step = 0;
  timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  muted = false;
  musicVol = 0.5; sfxVol = 0.8;
  private ambNodes: { wind?: GainNode; rain?: GainNode; drone?: GainNode } = {};
  private speaking = false;
  onBoundary: ((charIndex: number) => void) | null = null;
  voicesAvailable = false;
  lastSpoken = '';

  get available() { return typeof window !== 'undefined' && !!(window.AudioContext || (window as any).webkitAudioContext); }

  init() {
    if (this.ctx || !this.available) return;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    const c: AudioContext = new AC();
    this.ctx = c;
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(c.destination);
    this.dest = c.createMediaStreamDestination();
    this.master.connect(this.dest);
    this.musicBus = c.createGain(); this.musicBus.gain.value = this.musicVol;
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = this.sfxVol;
    // synthetic hall reverb
    const len = c.sampleRate * 2.6;
    const ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8); }
    this.reverb = c.createConvolver(); this.reverb.buffer = ir;
    const wet = c.createGain(); wet.gain.value = 0.35;
    this.musicBus.connect(this.master); this.musicBus.connect(this.reverb); this.reverb.connect(wet); wet.connect(this.master);
    this.sfxBus.connect(this.master);
    this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const nd = this.noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.initAmbience();
    this.timer = setInterval(() => this.tick(), 90);
    if (typeof speechSynthesis !== 'undefined') {
      const upd = () => { this.voicesAvailable = speechSynthesis.getVoices().length > 0; };
      upd(); speechSynthesis.onvoiceschanged = upd;
    }
  }

  setMuted(m: boolean) { this.muted = m; if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05); if (m) this.stopVoice(); }
  setMusicVol(v: number) { this.musicVol = v; if (this.ctx) this.musicBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  pause() { this.ctx?.suspend(); if (typeof speechSynthesis !== 'undefined') speechSynthesis.pause(); }
  resume() { this.ctx?.resume(); if (typeof speechSynthesis !== 'undefined') speechSynthesis.resume(); }

  // ---- music --------------------------------------------------------
  setMusic(name: MusicCue) {
    if (name === this.cueName) return;
    this.cueName = name;
    const c = this.ctx; if (!c) return;
    if (this.cueBus) { const old = this.cueBus; old.gain.setTargetAtTime(0, c.currentTime, 0.9); setTimeout(() => old.disconnect(), 4500); }
    this.cue = CUES[name];
    if (!this.cue) { this.cueBus = null; return; }
    this.cueBus = c.createGain(); this.cueBus.gain.value = 0;
    this.cueBus.gain.setTargetAtTime(this.cue.vol, c.currentTime, 0.8);
    this.cueBus.connect(this.musicBus);
    this.step = 0; this.nextTime = c.currentTime + 0.1;
  }
  private midi(cue: Cue, deg: number) {
    const n = cue.scale.length; const oct = Math.floor(deg / n); const i = ((deg % n) + n) % n;
    return 440 * Math.pow(2, (cue.root + cue.scale[i] + 12 * oct - 69) / 12);
  }
  private tick() {
    const c = this.ctx; if (!c || !this.cue || !this.cueBus || c.state !== 'running') return;
    const cue = this.cue; const dur = 60 / cue.tempo / 2;
    while (this.nextTime < c.currentTime + 0.35) {
      this.playStep(cue, this.step, this.nextTime, dur);
      this.step++; this.nextTime += dur;
    }
  }
  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  private osc(type: OscillatorType, f: number, t: number, a: number, d: number, peak: number, dest: AudioNode, lp = 0) {
    const c = this.ctx!; const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.value = f; this.env(g, t, a, peak, d);
    let out: AudioNode = o;
    if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); out = fl; }
    out.connect(g); g.connect(dest); o.start(t); o.stop(t + a + d + 0.1);
  }
  private playStep(cue: Cue, step: number, t: number, dur: number) {
    const c = this.ctx!; const bus = this.cueBus!;
    const bar = Math.floor(step / 8); const inBar = step % 8;
    const chord = cue.prog[bar % cue.prog.length];
    if (inBar === 0 && cue.pad > 0) {
      [0, 2, 4, 7].forEach((o, i) => this.osc(i % 2 ? 'sawtooth' : 'triangle', this.midi(cue, chord + o), t, 0.9, dur * 8, 0.05 * cue.pad, bus, 900));
    }
    if (cue.bass > 0 && (inBar === 0 || (inBar === 4 && cue.bass > 0.7))) this.osc('sine', this.midi(cue, chord - 7), t, 0.02, dur * 3.5, 0.22 * cue.bass, bus);
    if (cue.arp > 0 && (cue.arp === 2 || inBar % 2 === 0)) {
      const seq = [0, 2, 4, 7, 4, 2, 0, 2]; this.osc('triangle', this.midi(cue, chord + seq[inBar] + 7), t, 0.005, dur * 1.8, 0.05, bus, 3500);
    }
    const dr = cue.drums;
    if (dr !== 'none') {
      const kick = dr === 'war' ? inBar === 0 || inBar === 3 || inBar === 6 : inBar === 0 || inBar === 3;
      if (kick) {
        const o = c.createOscillator(); const g = c.createGain(); o.frequency.setValueAtTime(dr === 'war' ? 110 : 80, t); o.frequency.exponentialRampToValueAtTime(34, t + 0.22);
        g.gain.setValueAtTime(dr === 'war' ? 0.7 : 0.45, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.4);
      }
      if (dr === 'war' && (inBar === 4 || inBar === 7)) this.noise(t, 0.16, 'bandpass', 1800, 0.25, bus);
    }
    if (cue.lead > 0) {
      const s16 = step % 16;
      THEME.forEach(([deg, st]) => {
        if (st !== s16) return;
        const p = cue.lead >= 0.9 ? 1 : cue.lead;
        if (Math.random() < p) this.osc('triangle', this.midi(cue, deg + chordShift(chord)), t, 0.04, dur * 3, 0.1 * Math.min(1, cue.lead + 0.2), bus, 4200);
      });
    }
    function chordShift(ch: number) { return ch === 0 ? 0 : ch > 4 ? -1 : 0; }
  }
  private noise(t: number, dur: number, type: BiquadFilterType, f: number, vol: number, dest: AudioNode, f2?: number) {
    const c = this.ctx!; const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  // ---- sfx ------------------------------------------------------------
  sfx(name: string, vol = 1) {
    const c = this.ctx; if (!c || this.muted) return;
    const t = c.currentTime; const b = this.sfxBus; const v = vol;
    const sweep = (type: OscillatorType, f0: number, f1: number, d: number, pk: number) => {
      const o = c.createOscillator(); const g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d);
      g.gain.setValueAtTime(pk * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(g); g.connect(b); o.start(t); o.stop(t + d + 0.05);
    };
    switch (name) {
      case 'slash': this.noise(t, 0.22, 'highpass', 2000, 0.35 * v, b, 7000); sweep('sawtooth', 900, 200, 0.12, 0.05); break;
      case 'clash': this.noise(t, 0.3, 'highpass', 3000, 0.4 * v, b); sweep('square', 2400, 1800, 0.35, 0.08); sweep('triangle', 3600, 3000, 0.5, 0.06); break;
      case 'hit': this.noise(t, 0.18, 'lowpass', 900, 0.6 * v, b, 120); sweep('sine', 140, 45, 0.25, 0.6); break;
      case 'whoosh': this.noise(t, 0.5, 'bandpass', 400, 0.35 * v, b, 3000); break;
      case 'magic': sweep('sine', 300, 1800, 0.6, 0.18); sweep('triangle', 450, 2700, 0.6, 0.1); break;
      case 'burst': this.noise(t, 0.9, 'lowpass', 3000, 0.7 * v, b, 80); sweep('sine', 200, 30, 0.9, 0.7); sweep('sawtooth', 600, 1500, 0.4, 0.06); break;
      case 'blast': this.noise(t, 0.6, 'lowpass', 2500, 0.6 * v, b, 100); sweep('sine', 160, 30, 0.6, 0.6); break;
      case 'thunder': this.noise(t, 3.2, 'lowpass', 500, 0.9 * v, b, 50); sweep('sine', 60, 25, 2.5, 0.5); break;
      case 'rumble': this.noise(t, 2.4, 'lowpass', 180, 0.8 * v, b, 40); sweep('sine', 45, 25, 2.2, 0.5); break;
      case 'crystal': [1760, 2217, 2637].forEach((f, i) => this.osc('sine', f, t + i * 0.09, 0.005, 1.6, 0.07 * v, b)); break;
      case 'gong': [110, 165, 233].forEach((f) => this.osc('sine', f, t, 0.01, 4, 0.2 * v, b)); this.noise(t, 0.4, 'bandpass', 800, 0.15 * v, b); break;
      case 'heartbeat': sweep('sine', 70, 40, 0.18, 0.8); setTimeout(() => this.sfx('hit', 0.3), 230); break;
      case 'door': this.noise(t, 0.5, 'lowpass', 400, 0.5 * v, b, 80); sweep('sine', 90, 50, 0.4, 0.5); break;
      case 'impact_low': sweep('sine', 80, 25, 1.2, 0.9); this.noise(t, 0.8, 'lowpass', 400, 0.5 * v, b, 60); break;
      case 'eclipse': sweep('sine', 55, 110, 4, 0.4); this.noise(t, 4, 'bandpass', 300, 0.2 * v, b, 1500); break;
      default: break;
    }
  }

  // ---- ambience ---------------------------------------------------------
  private initAmbience() {
    const c = this.ctx!;
    const loop = (type: BiquadFilterType, f: number, q = 0.7) => {
      const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = c.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(this.sfxBus); s.start();
      return g;
    };
    this.ambNodes.wind = loop('bandpass', 380, 0.8);
    this.ambNodes.rain = loop('highpass', 3500);
    const o = c.createOscillator(); const g = c.createGain(); o.frequency.value = 48; g.gain.value = 0; o.connect(g); g.connect(this.sfxBus); o.start();
    this.ambNodes.drone = g;
  }
  setAmbience(a: { wind: number; rain: number; drone: number }) {
    const c = this.ctx; if (!c) return;
    this.ambNodes.wind?.gain.setTargetAtTime(a.wind * 0.12, c.currentTime, 1.2);
    this.ambNodes.rain?.gain.setTargetAtTime(a.rain * 0.09, c.currentTime, 1.2);
    this.ambNodes.drone?.gain.setTargetAtTime(a.drone * 0.1, c.currentTime, 1.5);
  }

  // ---- voice ------------------------------------------------------------
  private pickVoice(id: string, gender: 'm' | 'f'): SpeechSynthesisVoice | undefined {
    if (typeof speechSynthesis === 'undefined') return undefined;
    const all = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
    if (!all.length) return undefined;
    const fem = /female|zira|samantha|aria|jenny|hazel|susan|karen|moira|tessa|fiona|libby|sonia|victoria|google uk english female/i;
    const mal = /\bmale\b|david|mark|george|daniel|james|guy|ryan|alex|fred|thomas|google uk english male|oliver/i;
    const pool = all.filter((v) => (gender === 'f' ? fem.test(v.name) : mal.test(v.name) && !fem.test(v.name)));
    const use = pool.length ? pool : all;
    return use[hash(id) % use.length];
  }
  speak(id: string, text: string, voice: { pitch: number; rate: number; gender: 'm' | 'f' }, onEnd?: () => void) {
    this.lastSpoken = text;
    if (typeof speechSynthesis === 'undefined' || this.muted || !this.voicesAvailable) { this.speaking = false; return false; }
    try {
      if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = this.pickVoice(id, voice.gender); if (v) u.voice = v;
      u.pitch = Math.min(2, voice.pitch); u.rate = voice.rate; u.volume = 1;
      u.onstart = () => { this.speaking = true; };
      u.onend = () => { this.speaking = false; onEnd?.(); };
      u.onerror = () => { this.speaking = false; };
      u.onboundary = (e) => this.onBoundary?.(e.charIndex);
      this.speaking = true;
      speechSynthesis.speak(u);
      return true;
    } catch { this.speaking = false; return false; }
  }
  isSpeaking() { return this.speaking; }
  stopVoice() { this.speaking = false; if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); }
  getStream(): MediaStream | null { return this.dest?.stream ?? null; }
}

export const audio = new AudioEngine();
