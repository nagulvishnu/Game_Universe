/* Lightweight Web Audio synthesiser — no audio files, nothing loaded until first use. */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const cfg = { sound: true, volume: 0.6 };
let musicTimer: number | null = null;
let musicGain: GainNode | null = null;

export function configureAudio(sound: boolean, volume: number) {
  cfg.sound = sound; cfg.volume = volume;
  if (master) master.gain.value = volume;
}

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = cfg.volume; master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.2, delay = 0, slideTo?: number, dest?: AudioNode) {
  const c = ac(); if (!c || !master) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest ?? master); o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur: number, gain: number, freq: number, delay = 0) {
  const c = ac(); if (!c || !master) return;
  const t = c.currentTime + delay;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 1.1;
  const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master); src.start(t);
}

const play = (fn: () => void) => { if (cfg.sound) fn(); };

export const sfx = {
  move: () => play(() => { noise(0.05, 0.5, 1100); tone(190, 0.09, "sine", 0.25, 0, 120); }),
  capture: () => play(() => { noise(0.09, 0.9, 700); tone(130, 0.14, "triangle", 0.35, 0, 70); noise(0.05, 0.4, 1800, 0.05); }),
  castle: () => play(() => { noise(0.05, 0.5, 1000); tone(190, 0.09, "sine", 0.25); noise(0.05, 0.5, 1000, 0.12); tone(220, 0.09, "sine", 0.25, 0.12); }),
  promote: () => play(() => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, "triangle", 0.18, i * 0.06)); }),
  check: () => play(() => { tone(880, 0.12, "triangle", 0.22); tone(660, 0.2, "triangle", 0.22, 0.1); }),
  mate: () => play(() => { noise(0.25, 0.9, 300); [196, 233, 294].forEach((f, i) => tone(f, 1.3, "sawtooth", 0.07, i * 0.04)); tone(98, 1.6, "sine", 0.3); }),
  click: () => play(() => tone(1250, 0.03, "square", 0.04)),
  error: () => play(() => tone(160, 0.14, "sawtooth", 0.12, 0, 110)),
  success: () => play(() => { tone(660, 0.1, "triangle", 0.2); tone(990, 0.18, "triangle", 0.2, 0.09); }),
  win: () => play(() => { [392, 494, 587, 784].forEach((f, i) => tone(f, 0.35, "triangle", 0.2, i * 0.13)); tone(196, 0.9, "sine", 0.2, 0.4); }),
  lose: () => play(() => { [392, 349, 311, 262].forEach((f, i) => tone(f, 0.38, "triangle", 0.16, i * 0.16)); }),
  draw: () => play(() => { tone(440, 0.4, "sine", 0.2); tone(440, 0.5, "sine", 0.2, 0.3); tone(330, 0.7, "sine", 0.18, 0.3); }),
  tick: () => play(() => tone(1800, 0.02, "square", 0.03)),
};

const PROG = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]];
export function setMusic(on: boolean) {
  if (!on) {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    if (musicGain && ctx) { musicGain.gain.cancelScheduledValues(ctx.currentTime); musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2); }
    return;
  }
  if (musicTimer) return;
  const c = ac(); if (!c || !master) return;
  musicGain = c.createGain(); musicGain.gain.value = 0.35; musicGain.connect(master);
  let i = 0;
  const bar = () => {
    const chord = PROG[i++ % PROG.length];
    chord.forEach((f, k) => tone(f, 3.6, "sine", 0.05, k * 0.05, undefined, musicGain!));
    tone(chord[0] / 2, 3.8, "sine", 0.07, 0, undefined, musicGain!);
    const arp = [chord[0] * 2, chord[2] * 2, chord[1] * 2, chord[2] * 2];
    arp.forEach((f, k) => tone(f, 0.9, "triangle", 0.025, 0.4 + k * 0.85, undefined, musicGain!));
  };
  bar(); musicTimer = window.setInterval(bar, 3600);
}
