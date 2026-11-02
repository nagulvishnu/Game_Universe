// Lightweight Web Audio: synthesized engine, horn, rain, thunder and UI chimes (no external assets).
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let eng: { o1: OscillatorNode; o2: OscillatorNode; g: GainNode; f: BiquadFilterNode } | null = null;
let rainG: GainNode | null = null;
let hornOsc: OscillatorNode[] = [];
let hornG: GainNode | null = null;
let vol = 0.6;

export function startAudio() {
  if (ctx) { if (ctx.state === 'suspended') void ctx.resume(); return; }
  try {
    ctx = new AudioContext();
    master = ctx.createGain(); master.gain.value = vol; master.connect(ctx.destination);
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o1.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 600; g.gain.value = 0;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(master); o1.start(); o2.start();
    eng = { o1, o2, g, f };
    // rain: filtered noise
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3000; bp.Q.value = 0.5;
    rainG = ctx.createGain(); rainG.gain.value = 0;
    src.connect(bp); bp.connect(rainG); rainG.connect(master); src.start();
    hornG = ctx.createGain(); hornG.gain.value = 0; hornG.connect(master);
    hornOsc = [400, 500].map((fq) => { const o = ctx!.createOscillator(); o.type = 'square'; o.frequency.value = fq; o.connect(hornG!); o.start(); return o; });
  } catch { ctx = null; }
}
export function setVolume(v: number) { vol = v; if (master) master.gain.value = v; }
export function setEngine(speedNorm: number, throttle: number, active: boolean) {
  if (!ctx || !eng) return;
  const t = ctx.currentTime;
  const base = 45 + speedNorm * 130 + throttle * 25;
  eng.o1.frequency.setTargetAtTime(base, t, 0.08);
  eng.o2.frequency.setTargetAtTime(base * 0.5, t, 0.08);
  eng.f.frequency.setTargetAtTime(350 + speedNorm * 900 + throttle * 300, t, 0.1);
  eng.g.gain.setTargetAtTime(active ? 0.05 + throttle * 0.05 + speedNorm * 0.03 : 0, t, 0.1);
}
export function setRain(level: number) { if (ctx && rainG) rainG.gain.setTargetAtTime(level * 0.12, ctx.currentTime, 0.5); }
export function setHorn(on: boolean) { if (ctx && hornG) hornG.gain.setTargetAtTime(on ? 0.08 : 0, ctx.currentTime, 0.02); void hornOsc; }
export function thunder() {
  if (!ctx || !master) return;
  const b = ctx.createBuffer(1, ctx.sampleRate * 2.5, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.7));
  const s = ctx.createBufferSource(); s.buffer = b;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
  const g = ctx.createGain(); g.gain.value = 0.9;
  s.connect(f); f.connect(g); g.connect(master); s.start();
}
export function chime(kind: 'good' | 'bad' | 'ding' = 'ding') {
  if (!ctx || !master) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = kind === 'bad' ? 180 : kind === 'good' ? 880 : 660;
  g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
  o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + 0.4);
  if (kind === 'good') { const o2 = ctx.createOscillator(); o2.frequency.value = 1320; o2.connect(g); o2.start(ctx.currentTime + 0.1); o2.stop(ctx.currentTime + 0.4); }
}
