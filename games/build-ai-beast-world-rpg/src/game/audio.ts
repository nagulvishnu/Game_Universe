type Mode = "off" | "explore" | "combat" | "boss";
const PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
const PENTA = [57, 60, 62, 64, 67, 69, 72, 76];
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class AudioSys {
  ctx: AudioContext | null = null;
  master!: GainNode; sfxG!: GainNode; musG!: GainNode; windG!: GainNode; noiseBuf!: AudioBuffer;
  muted = false; volume = 0.7;
  mode: Mode = "off";
  step = 0; nextT = 0; timer: number | null = null;
  lastHit = 0;

  init() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : this.volume; this.master.connect(c.destination);
    this.sfxG = c.createGain(); this.sfxG.gain.value = 0.8; this.sfxG.connect(this.master);
    this.musG = c.createGain(); this.musG.gain.value = 0.32; this.musG.connect(this.master);
    this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // wind bed
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 420; f.Q.value = 0.6;
    this.windG = c.createGain(); this.windG.gain.value = 0.03;
    src.connect(f); f.connect(this.windG); this.windG.connect(this.master); src.start();
    this.timer = window.setInterval(() => this.schedule(), 80);
    this.nextT = c.currentTime + 0.1;
  }
  setMuted(m: boolean) { this.muted = m; if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.05); }
  setVolume(v: number) { this.volume = v; if (this.ctx && !this.muted) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  setWind(v: number) { if (this.ctx) this.windG.gain.setTargetAtTime(0.015 + v * 0.07, this.ctx.currentTime, 0.4); }
  setMode(m: Mode) { this.mode = m; }

  tone(f: number, dur: number, type: OscillatorType = "sine", vol = 0.2, slide = 0, delay = 0, dest?: AudioNode, atk = 0.005) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxG); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur: number, vol = 0.2, freq = 2000, type: BiquadFilterType = "lowpass", delay = 0, sweep = 0, dest?: AudioNode) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxG); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  /* --- sfx --- */
  swing(i = 0) { this.noise(0.16, 0.22, 1800 + i * 500, "bandpass", 0, 2500); }
  hit(heavy = false, crit = false) {
    const n = performance.now(); if (n - this.lastHit < 25) return; this.lastHit = n;
    this.noise(0.12, heavy ? 0.5 : 0.32, 900, "lowpass");
    this.tone(heavy ? 110 : 190, 0.14, "square", heavy ? 0.28 : 0.16, -80);
    if (crit) this.tone(1200, 0.25, "triangle", 0.12, 600);
  }
  dodge() { this.noise(0.22, 0.3, 700, "bandpass", 0, 3000); }
  perfect() { this.tone(660, 0.5, "sine", 0.2, 660); this.tone(1320, 0.7, "triangle", 0.1, 0, 0.05); }
  parry() { this.tone(1500, 0.3, "triangle", 0.22, -600); this.noise(0.1, 0.3, 4000, "highpass"); this.tone(220, 0.2, "square", 0.15, -100); }
  skill() { this.noise(0.4, 0.3, 500, "bandpass", 0, 3500); this.tone(300, 0.3, "sawtooth", 0.12, 600); }
  bloom() { this.tone(120, 0.9, "sine", 0.3, 200); this.tone(500, 0.9, "triangle", 0.1, -300); }
  boom() { this.noise(0.8, 0.6, 600, "lowpass"); this.tone(70, 0.7, "sine", 0.5, -40); }
  ult() { this.noise(1.2, 0.35, 300, "bandpass", 0, 4000); [0, 4, 7, 12].forEach((s, i) => this.tone(mtof(57 + s), 1.1, "sawtooth", 0.08, 0, i * 0.08)); }
  pickup() { this.tone(880, 0.12, "triangle", 0.15); this.tone(1320, 0.2, "triangle", 0.12, 0, 0.07); }
  chest() { [0, 4, 7, 12].forEach((s, i) => this.tone(mtof(72 + s), 0.5, "triangle", 0.14, 0, i * 0.09)); this.noise(0.3, 0.12, 5000, "highpass"); }
  level() { [0, 4, 7, 12, 16].forEach((s, i) => this.tone(mtof(64 + s), 0.6, "square", 0.08, 0, i * 0.08)); }
  portal() { this.tone(200, 1.5, "sine", 0.25, 800); this.tone(300, 1.5, "triangle", 0.12, 900, 0.1); }
  hurt() { this.tone(140, 0.25, "sawtooth", 0.25, -70); this.noise(0.18, 0.3, 500, "lowpass"); }
  roar() { this.noise(1.6, 0.5, 260, "lowpass", 0, 200); this.tone(70, 1.5, "sawtooth", 0.3, 40); this.tone(95, 1.3, "square", 0.12, -20, 0.1); }
  thunder() { this.noise(1.8, 0.5, 220, "lowpass", 0, -100); }
  ui() { this.tone(700, 0.06, "square", 0.08); }
  core() { this.noise(1.6, 0.35, 200, "bandpass", 0, 5000); [0, 7, 12, 19, 24].forEach((s, i) => this.tone(mtof(45 + s), 1.8, "sawtooth", 0.09, 0, i * 0.12)); }
  discover() { [0, 7, 12, 16, 19].forEach((s, i) => this.tone(mtof(60 + s), 1.2, "sine", 0.14, 0, i * 0.11)); }
  splash() { this.noise(0.4, 0.3, 1500, "bandpass", 0, -700); }
  vesper() { this.tone(900, 0.3, "sine", 0.1, 500); this.tone(1400, 0.3, "triangle", 0.06, -300, 0.12); }
  warn() { this.tone(300, 0.25, "square", 0.07, -80); }

  /* --- music scheduler --- */
  private schedule() {
    const c = this.ctx; if (!c || this.mode === "off") return;
    const bpm = this.mode === "explore" ? 78 : this.mode === "combat" ? 118 : 140;
    const sd = 60 / bpm / 4;
    if (this.nextT < c.currentTime - 0.5) this.nextT = c.currentTime + 0.05;
    while (this.nextT < c.currentTime + 0.25) {
      this.note(this.nextT - c.currentTime);
      this.nextT += sd; this.step++;
    }
  }
  private note(delay: number) {
    const s = this.step % 64, bar = Math.floor(s / 16) % 4, st = s % 16;
    const ch = PROG[bar];
    const m = this.mode;
    const d = Math.max(0, delay);
    if (st === 0) {
      for (const n of ch) {
        this.tone(mtof(n - 12), m === "explore" ? 4.2 : 2.2, m === "boss" ? "sawtooth" : "triangle", m === "explore" ? 0.09 : 0.06, 0, d, this.musG, 0.8);
      }
    }
    if (m === "explore") {
      if (st % 4 === 2 && Math.random() < 0.35) this.tone(mtof(PENTA[Math.floor(Math.random() * PENTA.length)]), 1.4, "sine", 0.1, 0, d, this.musG, 0.01);
    } else {
      const root = ch[0] - 24;
      if (st % 2 === 0 || m === "boss") this.tone(mtof(root), 0.18, m === "boss" ? "sawtooth" : "square", 0.1, 0, d, this.musG);
      if (st === 0 || st === 8 || (m === "boss" && st === 12)) this.tone(110, 0.2, "sine", 0.35, -70, d, this.musG);
      if (st % 2 === 1) this.noise(0.05, 0.08, 7000, "highpass", d, 0, this.musG);
      this.tone(mtof(ch[st % 3] + 12), 0.12, "triangle", 0.06, 0, d, this.musG);
      if (m === "boss" && st % 4 === 0) this.tone(mtof(ch[(st / 4) % 3] + 24), 0.5, "sawtooth", 0.04, 0, d, this.musG);
    }
  }
}
export const audio = new AudioSys();
