// Fully synthesized audio (Web Audio API): racket hits, shuttle flight, crowd, footsteps, music, announcer.
import type { Grade, Special } from './shots';
import type { Settings } from './storage';

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicG!: GainNode;
  private sfxG!: GainNode;
  private crowdG!: GainNode;
  private voiceVol = 0.7;
  private masterVol = 0.8;
  private noise!: AudioBuffer;
  private whooshG: GainNode | null = null;
  private whooshF: BiquadFilterNode | null = null;
  private crowdLevel: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private nextT = 0;
  private musicRoot = 220;
  private musicOn = false;

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain(); this.master.connect(c.destination);
    this.musicG = c.createGain(); this.musicG.connect(this.master);
    this.sfxG = c.createGain(); this.sfxG.connect(this.master);
    this.crowdG = c.createGain(); this.crowdG.connect(this.master);
    this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // looping noise sources: shuttle whoosh + crowd bed
    const mk = () => { const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true; return s; };
    const w = mk(); this.whooshF = c.createBiquadFilter(); this.whooshF.type = 'bandpass'; this.whooshF.Q.value = 1.2;
    this.whooshG = c.createGain(); this.whooshG.gain.value = 0;
    w.connect(this.whooshF).connect(this.whooshG).connect(this.sfxG); w.start();
    const cr = mk(); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650;
    this.crowdLevel = c.createGain(); this.crowdLevel.gain.value = 0.05;
    cr.connect(lp).connect(this.crowdLevel).connect(this.crowdG); cr.start();
  }

  apply(s: Settings) {
    this.masterVol = s.master; this.voiceVol = s.voice;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.master, t, 0.03);
    this.musicG.gain.setTargetAtTime(s.music * 0.5, t, 0.03);
    this.sfxG.gain.setTargetAtTime(s.sfx, t, 0.03);
    this.crowdG.gain.setTargetAtTime(s.crowd, t, 0.03);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, dest?: AudioNode, delay = 0) {
    const c = this.ctx; if (!c) return;
    const o = c.createOscillator(); const g = c.createGain();
    const t = c.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest ?? this.sfxG);
    o.start(t); o.stop(t + dur + 0.02);
  }
  private burst(dur: number, freq: number, vol: number, type: BiquadFilterType = 'highpass', q = 0.7, dest?: AudioNode, delay = 0) {
    const c = this.ctx; if (!c) return;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); const t = c.currentTime + delay;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest ?? this.sfxG);
    s.start(t, Math.random() * 0.5, dur + 0.02);
  }

  hit(grade: Grade, special: Special | null, speed: number) {
    if (!this.ctx) return;
    const power = Math.min(1, speed / 45);
    this.burst(0.07, 2200, 0.5 + power * 0.4);
    this.tone(grade === 'poor' ? 380 : 880, 0.09, 'triangle', 0.35, 260);
    if (special === 'perfectSmash' || special === 'superSmash') {
      this.tone(140, 0.35, 'sawtooth', 0.45, 40);
      this.tone(1200, 0.4, 'sawtooth', 0.18, 90);
      this.burst(0.3, 900, 0.5, 'bandpass', 0.8);
    } else if (special) {
      this.tone(600, 0.25, 'square', 0.12, 1800);
    }
    if (grade === 'perfect') this.chime();
    else if (grade === 'good') this.tone(1320, 0.12, 'sine', 0.12);
    if (power > 0.55 && !special) this.tone(220, 0.15, 'sine', 0.3, 80);
  }
  chime() {
    this.tone(1318, 0.5, 'sine', 0.2); this.tone(1976, 0.6, 'sine', 0.14, undefined, undefined, 0.06);
    this.tone(2637, 0.7, 'sine', 0.08, undefined, undefined, 0.12);
  }
  swing() { this.burst(0.12, 1400, 0.12, 'bandpass', 0.9); }
  net() { this.burst(0.18, 500, 0.45, 'lowpass'); this.tone(160, 0.14, 'sine', 0.25, 80); }
  land(inb: boolean) { this.burst(0.05, 3000, 0.25); this.tone(inb ? 520 : 200, 0.08, 'triangle', 0.15); }
  step(v: number) { this.burst(0.045, 1800 + Math.random() * 600, 0.07 + Math.min(0.08, v * 0.01), 'bandpass', 1.5); }
  jump() { this.tone(300, 0.12, 'sine', 0.12, 520); }
  whoosh(speed: number, active: boolean) {
    if (!this.ctx || !this.whooshG || !this.whooshF) return;
    const t = this.ctx.currentTime;
    this.whooshG.gain.setTargetAtTime(active ? Math.min(0.28, speed / 130) : 0, t, 0.04);
    this.whooshF.frequency.setTargetAtTime(500 + speed * 45, t, 0.05);
  }
  crowd(level: number) {
    if (!this.ctx || !this.crowdLevel) return;
    const t = this.ctx.currentTime;
    this.crowdLevel.gain.cancelScheduledValues(t);
    this.crowdLevel.gain.setTargetAtTime(0.05 + level * 0.5, t, 0.05);
    this.crowdLevel.gain.setTargetAtTime(0.06, t + 0.4 + level * 1.2, 0.5);
  }
  cheer(big = false) {
    this.crowd(big ? 1 : 0.5);
    if (big) this.burst(1.2, 1400, 0.3, 'bandpass', 0.5, this.crowdG);
  }
  groan() { this.crowd(0.3); this.tone(220, 0.5, 'sawtooth', 0.05, 140, this.crowdG); }
  point(winnerIsHuman: boolean) {
    if (winnerIsHuman) { this.tone(660, 0.14, 'triangle', 0.2); this.tone(880, 0.2, 'triangle', 0.2, undefined, undefined, 0.1); }
    else this.tone(300, 0.3, 'triangle', 0.18, 220);
  }
  fanfare(win: boolean) {
    if (!this.ctx) return;
    const notes = win ? [523, 659, 784, 1047, 784, 1047, 1319] : [392, 349, 330, 262];
    notes.forEach((n, i) => this.tone(n, 0.35, win ? 'square' : 'triangle', 0.14, undefined, this.musicG, i * 0.16));
    if (win) this.cheer(true);
  }
  ui() { this.tone(900, 0.06, 'triangle', 0.12); }
  speak(text: string) {
    if (this.voiceVol <= 0.01 || this.masterVol <= 0.01) return;
    try {
      const s = window.speechSynthesis; if (!s) return;
      s.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.volume = Math.min(1, this.voiceVol * this.masterVol); u.rate = 1.05; u.pitch = 1;
      s.speak(u);
    } catch { /* speech unavailable */ }
  }

  // ---- procedural music ----
  startMusic(root = 220) {
    if (!this.ctx || this.musicOn) { this.musicRoot = root; return; }
    this.musicOn = true; this.musicRoot = root;
    this.nextT = this.ctx.currentTime + 0.1;
    const sched = () => {
      const c = this.ctx; if (!c) return;
      while (this.nextT < c.currentTime + 0.3) {
        this.playStep(this.musicStep++, this.nextT);
        this.nextT += 60 / 126 / 2;
      }
    };
    this.musicTimer = window.setInterval(sched, 90);
  }
  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }
  private playStep(i: number, t: number) {
    const c = this.ctx; if (!c) return;
    const scale = [0, 3, 5, 7, 10, 12, 15, 17];
    const bar = Math.floor(i / 16) % 4;
    const prog = [0, -2, -4, -5][bar];
    const f = (semi: number) => this.musicRoot * Math.pow(2, (semi + prog) / 12);
    const o = (freq: number, dur: number, type: OscillatorType, vol: number) => {
      const os = c.createOscillator(), g = c.createGain();
      os.type = type; os.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      os.connect(g).connect(this.musicG); os.start(t); os.stop(t + dur + 0.02);
    };
    const s = i % 16;
    if (s % 4 === 0) o(f(-24), 0.22, 'sine', 0.5);
    if (s % 8 === 4) { // snare-ish
      const src = c.createBufferSource(); src.buffer = this.noise;
      const g = c.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
      src.connect(hp).connect(g).connect(this.musicG); src.start(t, 0, 0.12);
    }
    if (s % 2 === 0) o(f(-12 + ((s * 3) % 5 === 0 ? 7 : 0)), 0.12, 'square', 0.07);
    const arp = [0, 4, 7, 12, 7, 4, 10, 7][s % 8];
    o(f(arp + 12), 0.16, 'triangle', 0.1);
    if (s === 0) o(f(scale[bar + 2]) , 0.9, 'sawtooth', 0.05);
  }
}

export const audio = new AudioEngine();
