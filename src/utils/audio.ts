/**
 * Lightweight procedural audio (WebAudio, no asset downloads).
 * Nothing plays until `start()` is called from a user gesture.
 */
export type SfxKind = "hover" | "click" | "open" | "launch";

class HubAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientNodes: Array<OscillatorNode | AudioBufferSourceNode> = [];
  private running = false;
  private suspended = false;

  get isRunning() {
    return this.running;
  }

  start() {
    if (this.running) return;
    try {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      if (!this.ctx) {
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0;
        this.master.connect(this.ctx.destination);
        this.buildAmbient();
      }
      void this.ctx.resume();
      this.running = true;
      this.applyLevel();
    } catch {
      this.running = false;
    }
  }

  stop() {
    if (!this.running || !this.ctx || !this.master) return;
    this.running = false;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.linearRampToValueAtTime(0, now + 0.4);
  }

  /** Mute hub audio while a game is running (games bring their own sound). */
  setSuspended(v: boolean) {
    this.suspended = v;
    this.applyLevel();
  }

  private applyLevel() {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.linearRampToValueAtTime(this.running && !this.suspended ? 0.55 : 0, now + 0.8);
  }

  private buildAmbient() {
    const ctx = this.ctx!;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 520;
    filter.Q.value = 4;
    const bus = ctx.createGain();
    bus.gain.value = 0.16;
    filter.connect(bus);
    bus.connect(this.master!);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    this.ambientNodes.push(lfo);

    const tones: Array<[OscillatorType, number, number]> = [
      ["sawtooth", 55, 0.5],
      ["sawtooth", 55.4, 0.5],
      ["sine", 82.4, 0.6],
      ["triangle", 164.8, 0.25],
      ["sine", 246.9, 0.12],
    ];
    for (const [type, freq, gain] of tones) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = gain;
      o.connect(g);
      g.connect(filter);
      o.start();
      this.ambientNodes.push(o);
    }
  }

  sfx(kind: SfxKind) {
    if (!this.running || this.suspended || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const blip = (type: OscillatorType, f0: number, f1: number, dur: number, vol: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, now);
      o.frequency.exponentialRampToValueAtTime(f1, now + dur);
      g.gain.setValueAtTime(vol, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      o.connect(g);
      g.connect(this.master!);
      o.start(now);
      o.stop(now + dur + 0.02);
    };
    switch (kind) {
      case "hover":
        blip("sine", 660, 990, 0.09, 0.05);
        break;
      case "click":
        blip("square", 320, 180, 0.07, 0.04);
        break;
      case "open":
        blip("sine", 420, 840, 0.22, 0.07);
        break;
      case "launch": {
        blip("sawtooth", 90, 900, 1.1, 0.07);
        blip("sine", 180, 1400, 1.0, 0.08);
        const len = Math.floor(ctx.sampleRate * 1.0);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.Q.value = 1.2;
        bp.frequency.setValueAtTime(200, now);
        bp.frequency.exponentialRampToValueAtTime(5000, now + 1.0);
        const g = ctx.createGain();
        g.gain.value = 0.18;
        src.connect(bp);
        bp.connect(g);
        g.connect(this.master);
        src.start(now);
        break;
      }
    }
  }
}

export const hubAudio = new HubAudio();
