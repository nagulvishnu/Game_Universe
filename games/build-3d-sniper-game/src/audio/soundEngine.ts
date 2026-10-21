class TacticalSoundEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private masterGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private ambienceSource: AudioBufferSourceNode | null = null;

  private masterVol = 0.75;
  private sfxVol = 0.85;
  private ambVol = 0.5;
  private isMuted = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.masterVol;
      this.masterGain.connect(this.ctx.destination);

      // Pre-generate 2 seconds of white noise buffer for gunfire, wind, explosions
      const length = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public updateSettings(master: number, sfx: number, ambience: number, muted: boolean): void {
    this.masterVol = master;
    this.sfxVol = sfx;
    this.ambVol = ambience;
    this.isMuted = muted;

    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : master, this.ctx.currentTime, 0.04);
    }
    if (this.ambienceGain && this.ctx) {
      this.ambienceGain.gain.setTargetAtTime(muted ? 0 : ambience * 0.14, this.ctx.currentTime, 0.1);
    }
  }

  public startAmbience(weather: 'clear' | 'fog' | 'dust' | 'rain' | 'snow'): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer || !this.masterGain) return;
    this.stopAmbience();

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = weather === 'rain' ? 'bandpass' : 'lowpass';
    filter.frequency.value = weather === 'rain' ? 1150 : weather === 'snow' || weather === 'dust' ? 440 : 280;
    filter.Q.value = weather === 'rain' ? 0.7 : 1.3;

    const gain = ctx.createGain();
    gain.gain.value = this.isMuted ? 0 : this.ambVol * (weather === 'rain' ? 0.16 : 0.1);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start();

    this.ambienceSource = src;
    this.ambienceGain = gain;
  }

  public stopAmbience(): void {
    if (this.ambienceSource) {
      try {
        this.ambienceSource.stop();
        this.ambienceSource.disconnect();
      } catch {
        // Ignore already stopped
      }
      this.ambienceSource = null;
    }
  }

  public playRifleShot(suppressed: boolean, heavyCaliber: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer || !this.masterGain || this.isMuted) return;
    const now = ctx.currentTime;
    const vol = this.sfxVol;

    if (suppressed) {
      // Suppressed "THWIP" baffle transient + metallic bolt impulse
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1450, now);
      bp.frequency.exponentialRampToValueAtTime(380, now + 0.13);
      bp.Q.value = 1.6;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.65 * vol, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      noise.connect(bp);
      bp.connect(g);
      g.connect(this.masterGain);
      noise.start(now);
      noise.stop(now + 0.16);

      // Sub thump
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(155, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.1);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.55 * vol, now);
      og.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.connect(og);
      og.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.12);
    } else {
      // Unsuppressed thunderous crack + sub punch + canyon reverb tail
      const punch = ctx.createOscillator();
      punch.type = 'sawtooth';
      punch.frequency.setValueAtTime(heavyCaliber ? 95 : 130, now);
      punch.frequency.exponentialRampToValueAtTime(28, now + 0.24);
      const pg = ctx.createGain();
      pg.gain.setValueAtTime(0.85 * vol, now);
      pg.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      punch.connect(pg);
      pg.connect(this.masterGain);
      punch.start(now);
      punch.stop(now + 0.27);

      const crack = ctx.createBufferSource();
      crack.buffer = this.noiseBuffer;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(heavyCaliber ? 3400 : 4200, now);
      lp.frequency.exponentialRampToValueAtTime(240, now + (heavyCaliber ? 0.95 : 0.68));

      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.95 * vol, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + (heavyCaliber ? 0.95 : 0.7));

      crack.connect(lp);
      lp.connect(ng);
      ng.connect(this.masterGain);
      crack.start(now);
      crack.stop(now + 1.0);
    }
  }

  public playBoltCycle(delaySec = 0.28): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer || !this.masterGain || this.isMuted) return;
    const base = ctx.currentTime + delaySec;
    const clicks = [0, 0.11, 0.28, 0.39];
    const freqs = [1800, 950, 1150, 2100];

    clicks.forEach((offset, idx) => {
      const t = base + offset;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freqs[idx];
      bp.Q.value = 5.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.28 * this.sfxVol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.masterGain!);
      src.start(t);
      src.stop(t + 0.075);
    });
  }

  public playReload(durationSec: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer || !this.masterGain || this.isMuted) return;
    const now = ctx.currentTime;
    const steps = [0.1, durationSec * 0.48, durationSec * 0.82];
    const pitches = [680, 1250, 1750];

    steps.forEach((st, i) => {
      const t = now + st;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(pitches[i], t);
      osc.frequency.exponentialRampToValueAtTime(pitches[i] * 0.6, t + 0.08);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.22 * this.sfxVol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.1);
    });
  }

  public playHitMarker(isHeadshot: boolean, armorRicochet = false): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.isMuted) return;
    const now = ctx.currentTime;

    if (armorRicochet) {
      const ping = ctx.createOscillator();
      ping.type = 'sine';
      ping.frequency.setValueAtTime(2400, now);
      ping.frequency.linearRampToValueAtTime(3100, now + 0.14);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.26 * this.sfxVol, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      ping.connect(g);
      g.connect(this.masterGain);
      ping.start(now);
      ping.stop(now + 0.19);
      return;
    }

    // Crisp tactical hit thwack
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isHeadshot ? 1480 : 920, now);
    osc.frequency.exponentialRampToValueAtTime(isHeadshot ? 620 : 320, now + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35 * this.sfxVol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.11);

    if (isHeadshot) {
      // Satisfying crystalline headshot harmonic chime
      const chime = ctx.createOscillator();
      chime.type = 'triangle';
      chime.frequency.setValueAtTime(2220, now + 0.02);
      chime.frequency.exponentialRampToValueAtTime(2960, now + 0.18);
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.28 * this.sfxVol, now + 0.02);
      cg.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      chime.connect(cg);
      cg.connect(this.masterGain);
      chime.start(now + 0.02);
      chime.stop(now + 0.23);
    }
  }

  public playExplosion(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer || !this.masterGain || this.isMuted) return;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(920, now);
    lp.frequency.exponentialRampToValueAtTime(75, now + 1.15);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.95 * this.sfxVol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    src.connect(lp);
    lp.connect(g);
    g.connect(this.masterGain);
    src.start(now);
    src.stop(now + 1.25);
  }

  public playEnemyShot(isSniper: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer || !this.masterGain || this.isMuted) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = isSniper ? 1650 : 980;
    const g = ctx.createGain();
    g.gain.setValueAtTime((isSniper ? 0.45 : 0.28) * this.sfxVol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.21);
  }

  public playHeartbeat(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.isMuted) return;
    const now = ctx.currentTime;
    [0, 0.22].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(idx === 0 ? 58 : 48, now + offset);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.24 * this.sfxVol, now + offset);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.14);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now + offset);
      osc.stop(now + offset + 0.15);
    });
  }

  public playUiTone(kind: 'click' | 'alert' | 'objective' | 'scope'): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.isMuted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    if (kind === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(840, now);
      g.gain.setValueAtTime(0.1 * this.sfxVol, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (kind === 'scope') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.linearRampToValueAtTime(520, now + 0.07);
      g.gain.setValueAtTime(0.11 * this.sfxVol, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.09);
    } else if (kind === 'alert') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.setValueAtTime(880, now + 0.1);
      g.gain.setValueAtTime(0.22 * this.sfxVol, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.26);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.11);
      g.gain.setValueAtTime(0.22 * this.sfxVol, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  }
}

export const soundEngine = new TacticalSoundEngine();
