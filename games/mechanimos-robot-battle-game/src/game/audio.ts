// Tiny WebAudio synthesizer — no assets needed.
class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  musicGain: GainNode | null = null;
  muted = false;
  musicTimer: number | null = null;
  step = 0;

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.32;
      this.musicGain.connect(this.master);
      this.startMusic();
    } catch {
      /* audio unsupported */
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.linearRampToValueAtTime(m ? 0 : 0.5, this.ctx.currentTime + 0.1);
    }
  }

  private now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  tone(freq: number, dur = 0.12, type: OscillatorType = 'square', vol = 0.2, slideTo?: number) {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.now();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    this.env(g, t, 0.008, vol, dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise(dur = 0.2, vol = 0.25, freq = 1200, q = 0.8) {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.now();
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    this.env(g, t, 0.005, vol, dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  // ---------- SFX vocabulary ----------
  click() { this.tone(660, 0.06, 'square', 0.12); }
  hover() { this.tone(440, 0.03, 'square', 0.05); }
  deny() { this.tone(140, 0.18, 'sawtooth', 0.16, 90); }
  pickup() { this.tone(880, 0.08, 'triangle', 0.16, 1320); this.tone(1320, 0.1, 'triangle', 0.1, 1760); }
  engage() { this.tone(220, 0.2, 'sawtooth', 0.18, 880); }
  rev() { this.noise(0.35, 0.12, 300, 0.6); this.tone(70, 0.35, 'sawtooth', 0.14, 160); }

  transformSfx() {
    this.tone(90, 0.9, 'sawtooth', 0.2, 540);
    this.noise(0.8, 0.12, 700, 0.5);
    setTimeout(() => this.tone(320, 0.12, 'square', 0.14), 260);
    setTimeout(() => this.tone(430, 0.12, 'square', 0.14), 430);
    setTimeout(() => this.tone(560, 0.16, 'square', 0.16), 600);
    setTimeout(() => { this.noise(0.3, 0.3, 900, 0.4); this.tone(64, 0.4, 'sine', 0.4, 40); }, 850);
  }

  hit(heavy = false) {
    this.noise(heavy ? 0.32 : 0.18, heavy ? 0.4 : 0.26, heavy ? 500 : 900, 0.5);
    this.tone(heavy ? 70 : 110, heavy ? 0.3 : 0.18, 'sine', 0.42, 40);
  }

  laser() { this.tone(1400, 0.22, 'sawtooth', 0.16, 240); }
  flame() { this.noise(0.4, 0.24, 500, 0.4); this.tone(180, 0.35, 'sawtooth', 0.1, 90); }
  zap() { this.tone(1800, 0.16, 'sawtooth', 0.14, 300); this.noise(0.14, 0.14, 3200, 1.2); }
  shieldUp() { this.tone(330, 0.3, 'triangle', 0.16, 660); }
  heal() { this.tone(520, 0.12, 'triangle', 0.14); setTimeout(() => this.tone(660, 0.12, 'triangle', 0.14), 110); setTimeout(() => this.tone(880, 0.18, 'triangle', 0.14), 220); }
  miss() { this.noise(0.14, 0.1, 2400, 2); }
  burnTick() { this.noise(0.12, 0.12, 700, 0.7); }
  stunSfx() { this.tone(980, 0.3, 'square', 0.12, 320); }

  throwCard() { this.noise(0.25, 0.14, 2000, 1.4); this.tone(800, 0.25, 'triangle', 0.1, 1600); }

  capture() {
    const seq = [523, 659, 784, 1047];
    seq.forEach((f, i) => setTimeout(() => this.tone(f, 0.16, 'triangle', 0.16), i * 110));
    setTimeout(() => this.tone(1319, 0.4, 'triangle', 0.14), 500);
  }

  escape() { this.tone(500, 0.5, 'sawtooth', 0.14, 120); }

  defeated() {
    this.tone(320, 0.4, 'sawtooth', 0.16, 80);
    setTimeout(() => this.noise(0.5, 0.2, 300, 0.5), 150);
  }

  fanfare() {
    const seq = [392, 523, 659, 784, 1047];
    seq.forEach((f, i) => setTimeout(() => this.tone(f, 0.2, 'square', 0.12), i * 90));
  }

  gameOver() {
    const seq = [440, 349, 294, 220];
    seq.forEach((f, i) => setTimeout(() => this.tone(f, 0.35, 'triangle', 0.16), i * 220));
  }

  // ---------- music: lo-fi synthwave bass loop ----------
  private startMusic() {
    if (!this.ctx || !this.musicGain) return;
    const bpm = 100;
    const stepDur = 60 / bpm / 2; // 8th notes
    const bass = [55, 55, 65.4, 55, 49, 49, 58.3, 43.7]; // A A C A | G G Bb F
    const play = () => {
      if (!this.ctx || !this.musicGain) return;
      if (!this.muted) {
        const t = this.ctx.currentTime;
        const i = this.step % 8;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const f = this.ctx.createBiquadFilter();
        o.type = 'sawtooth';
        o.frequency.value = bass[i] * (this.step % 16 < 8 ? 1 : 2);
        f.type = 'lowpass';
        f.frequency.value = 320;
        g.gain.setValueAtTime(0.16, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 0.9);
        o.connect(f); f.connect(g); g.connect(this.musicGain);
        o.start(t); o.stop(t + stepDur);
        // sparkle arp every other bar
        if (this.step % 16 === 0) {
          [220, 277, 330, 440].forEach((fr, j) => {
            const o2 = this.ctx!.createOscillator();
            const g2 = this.ctx!.createGain();
            o2.type = 'triangle';
            o2.frequency.value = fr * 2;
            const tt = t + j * stepDur * 2;
            g2.gain.setValueAtTime(0.0001, tt);
            g2.gain.exponentialRampToValueAtTime(0.05, tt + 0.02);
            g2.gain.exponentialRampToValueAtTime(0.0001, tt + stepDur * 1.6);
            o2.connect(g2); g2.connect(this.musicGain!);
            o2.start(tt); o2.stop(tt + stepDur * 2);
          });
        }
      }
      this.step++;
    };
    play();
    this.musicTimer = window.setInterval(play, stepDur * 1000);
  }
}

export const audio = new AudioEngine();
