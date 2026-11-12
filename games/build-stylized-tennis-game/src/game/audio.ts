import type { Settings } from './store';

type MusicKind = 'menu' | 'match' | 'win';
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicG!: GainNode;
  private sfxG!: GainNode;
  private crowdG!: GainNode;
  private noise!: AudioBuffer;
  private crowdSrc: AudioBufferSourceNode | null = null;
  private crowdLevel!: GainNode;
  private musicTimer = 0;
  private musicKind: MusicKind | null = null;
  private step = 0;
  private nextT = 0;
  s: Pick<Settings, 'master' | 'music' | 'sfx' | 'crowd' | 'musicOn' | 'sfxOn' | 'speech'> = { master: 0.8, music: 0.5, sfx: 0.9, crowd: 0.6, musicOn: true, sfxOn: true, speech: true };

  /** Must be called from a user gesture. */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    } catch {
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.connect(c.destination);
    this.musicG = c.createGain();
    this.sfxG = c.createGain();
    this.crowdG = c.createGain();
    this.musicG.connect(this.master);
    this.sfxG.connect(this.master);
    this.crowdG.connect(this.master);
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.apply(this.s);
  }

  apply(s: AudioEngine['s']) {
    this.s = s;
    if (!this.ctx) return;
    this.master.gain.value = s.master;
    this.musicG.gain.value = s.musicOn ? s.music * 0.5 : 0;
    this.sfxG.gain.value = s.sfxOn ? s.sfx : 0;
    this.crowdG.gain.value = s.sfxOn ? s.crowd * 0.5 : 0;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode, when = 0, slideTo?: number) {
    const c = this.ctx!;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  private burst(dur: number, freq: number, q: number, vol: number, dest: AudioNode, when = 0, type: BiquadFilterType = 'bandpass', attack = 0.003) {
    const c = this.ctx!;
    const t = c.currentTime + when;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  hit(grade: number, special: boolean, serve: boolean) {
    if (!this.ctx) return;
    const v = [0.5, 0.7, 0.85, 1][grade] ?? 0.7;
    this.burst(0.07, serve ? 1100 : 1700 - (grade === 0 ? 500 : 0), 1.2, v, this.sfxG);
    this.tone(serve ? 110 : 170, 0.1, 'sine', 0.7 * v, this.sfxG, 0, 60);
    if (grade === 3) {
      this.tone(1320, 0.25, 'sine', 0.3, this.sfxG, 0.02, 1980);
      [784, 988, 1175].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.18, this.sfxG, 0.04 + i * 0.05));
    }
    if (special) {
      this.tone(220, 0.5, 'sawtooth', 0.12, this.sfxG, 0, 1400);
      this.burst(0.5, 3000, 0.8, 0.2, this.sfxG, 0.02, 'highpass', 0.1);
    }
  }
  whoosh() {
    if (!this.ctx) return;
    this.burst(0.18, 900, 0.7, 0.25, this.sfxG, 0, 'bandpass', 0.06);
  }
  bounce(impact: number, kind: string) {
    if (!this.ctx) return;
    const v = Math.min(1, 0.2 + impact / 18);
    const base = kind === 'clay' || kind === 'sand' ? 95 : kind === 'grass' ? 80 : 150;
    this.tone(base * 1.4, 0.09, 'sine', 0.55 * v, this.sfxG, 0, base * 0.6);
    this.burst(0.04, kind === 'carpet' ? 3500 : 1200, 1, 0.3 * v, this.sfxG);
  }
  net(big: boolean) {
    if (!this.ctx) return;
    this.burst(big ? 0.28 : 0.12, 500, 0.6, big ? 0.7 : 0.35, this.sfxG);
    this.tone(70, 0.2, 'sine', 0.3, this.sfxG);
  }
  toss() {
    if (!this.ctx) return;
    this.tone(500, 0.12, 'sine', 0.12, this.sfxG, 0, 900);
  }
  fault() {
    if (!this.ctx) return;
    this.tone(260, 0.25, 'square', 0.15, this.sfxG, 0, 180);
  }
  point(win: boolean) {
    if (!this.ctx) return;
    if (win) {
      [523, 659, 784].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.22, this.sfxG, i * 0.07));
      this.cheer(0.7);
    } else {
      this.tone(330, 0.3, 'triangle', 0.14, this.sfxG, 0, 250);
      this.cheer(0.3);
    }
  }
  cheer(level: number) {
    if (!this.ctx) return;
    this.burst(1.3 * (0.6 + level), 1100, 0.5, 0.45 * level, this.crowdG, 0, 'bandpass', 0.25);
    if (level > 0.5) for (let i = 0; i < 6; i++) this.burst(0.05, 2400, 1, 0.12 * level, this.crowdG, 0.1 + i * 0.09 + Math.random() * 0.04, 'highpass');
  }
  oh() {
    if (!this.ctx) return;
    this.burst(0.7, 500, 0.7, 0.35, this.crowdG, 0, 'bandpass', 0.15);
  }
  click() {
    if (!this.ctx) return;
    this.tone(880, 0.05, 'square', 0.07, this.sfxG);
  }
  special() {
    if (!this.ctx) return;
    this.tone(200, 0.6, 'sawtooth', 0.14, this.sfxG, 0, 1600);
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.18, this.sfxG, 0.1 + i * 0.07));
  }
  victory() {
    if (!this.ctx) return;
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.3, 'square', 0.12, this.sfxG, i * 0.13));
    this.cheer(1);
  }
  defeat() {
    if (!this.ctx) return;
    [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.45, 'triangle', 0.18, this.sfxG, i * 0.22));
  }
  speak(text: string) {
    if (!this.s.speech || !this.s.sfxOn || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.volume = Math.min(1, this.s.sfx * this.s.master);
      u.rate = 1.1;
      u.pitch = 0.9;
      window.speechSynthesis.speak(u);
    } catch {
      /* speech unavailable */
    }
  }

  startCrowd() {
    if (!this.ctx || this.crowdSrc) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 520;
    f.Q.value = 0.4;
    this.crowdLevel = c.createGain();
    this.crowdLevel.gain.value = 0.16;
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 0.18;
    lg.gain.value = 0.05;
    lfo.connect(lg);
    lg.connect(this.crowdLevel.gain);
    lfo.start();
    src.connect(f);
    f.connect(this.crowdLevel);
    this.crowdLevel.connect(this.crowdG);
    src.start();
    this.crowdSrc = src;
  }
  stopCrowd() {
    try {
      this.crowdSrc?.stop();
    } catch {
      /* already stopped */
    }
    this.crowdSrc = null;
  }

  // ------------------------------------------------------------- music
  startMusic(kind: MusicKind) {
    if (!this.ctx) return;
    if (this.musicKind === kind) return;
    this.stopMusic();
    this.musicKind = kind;
    this.step = 0;
    this.nextT = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.schedule(), 80);
  }
  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = 0;
    this.musicKind = null;
  }
  private schedule() {
    const c = this.ctx;
    if (!c || !this.musicKind) return;
    const match = this.musicKind === 'match';
    const bpm = match ? 124 : 104;
    const dur = 60 / bpm / 2; // 8th notes
    const chords = [
      [57, 60, 64],
      [53, 57, 60],
      [48, 52, 55],
      [55, 59, 62],
    ];
    while (this.nextT < c.currentTime + 0.35) {
      const t = this.nextT - c.currentTime;
      const s = this.step;
      const chord = chords[Math.floor(s / 8) % 4];
      if (s % 8 === 0) this.tone(mtof(chord[0] - 12), dur * 7, 'triangle', match ? 0.28 : 0.22, this.musicG, t);
      if (s % 2 === 0 || match) {
        const n = chord[(s * 5 + (s >> 2)) % 3] + (s % 8 > 4 ? 12 : 12);
        this.tone(mtof(n), dur * 0.9, match ? 'square' : 'triangle', match ? 0.05 : 0.07, this.musicG, t);
      }
      if (match) {
        if (s % 4 === 0) this.tone(120, 0.12, 'sine', 0.5, this.musicG, t, 40);
        if (s % 2 === 1) this.burst(0.04, 8000, 1, 0.08, this.musicG, t, 'highpass');
        if (s % 8 === 4) this.burst(0.1, 1800, 1, 0.1, this.musicG, t);
      } else if (s % 8 === 0) {
        chord.forEach((m) => this.tone(mtof(m), dur * 7, 'sine', 0.06, this.musicG, t));
      }
      this.nextT += dur;
      this.step++;
    }
  }
}

export const audio = new AudioEngine();
