import { G, V3 } from "./core";

let ctx: AudioContext | null = null;
let master: GainNode, musicG: GainNode, sfxG: GainNode, ambG: GainNode;
let noiseBuf: AudioBuffer;
let active = 0;
let level = 0;
let started = false;
const vols = { master: 0.8, music: 0.5, sfx: 0.8 };

export function initAudio() {
  if (ctx) {
    if (ctx.state === "suspended") ctx.resume();
    return;
  }
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp);
  comp.connect(ctx.destination);
  musicG = ctx.createGain();
  sfxG = ctx.createGain();
  ambG = ctx.createGain();
  musicG.connect(master);
  sfxG.connect(master);
  ambG.connect(master);
  setVolumes(vols.master, vols.music, vols.sfx);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  startAmbience();
  startMusic();
}

export function setVolumes(m: number, mu: number, s: number) {
  vols.master = m; vols.music = mu; vols.sfx = s;
  if (!ctx) return;
  master.gain.value = m;
  musicG.gain.value = mu * 0.5;
  sfxG.gain.value = s;
  ambG.gain.value = s * 0.5;
}
export function setMusicLevel(l: number) {
  level = l;
}

const _r = new V3(), _d = new V3();
function spatial(pos?: V3, vol = 1): { node: AudioNode; ok: boolean } {
  const g = ctx!.createGain();
  let v = vol;
  let pan = 0;
  if (pos && G.camera) {
    _d.copy(pos).sub(G.camera.position);
    const d = _d.length();
    v *= 1 / (1 + d / 28);
    _r.set(1, 0, 0).applyQuaternion(G.camera.quaternion);
    pan = d > 0.1 ? Math.max(-1, Math.min(1, _d.dot(_r) / d)) * 0.8 : 0;
  }
  if (v < 0.015 || active > 30) return { node: g, ok: false };
  g.gain.value = v;
  if ((ctx as any).createStereoPanner) {
    const p = ctx!.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    p.connect(sfxG);
  } else g.connect(sfxG);
  return { node: g, ok: true };
}
function track(src: AudioScheduledSourceNode, end: number) {
  active++;
  src.onended = () => active--;
  src.stop(end);
}
function tone(out: AudioNode, type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0) {
  const t = ctx!.currentTime + delay;
  const o = ctx!.createOscillator();
  const g = ctx!.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(out);
  o.start(t);
  track(o, t + dur + 0.05);
}
function noise(out: AudioNode, ftype: BiquadFilterType, f0: number, f1: number, dur: number, vol: number, delay = 0, q = 1) {
  const t = ctx!.currentTime + delay;
  const s = ctx!.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ctx!.createBiquadFilter();
  f.type = ftype;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = ctx!.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.015, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(out);
  s.start(t, Math.random());
  track(s, t + dur + 0.05);
}

export function sfx(name: string, pos?: V3, vol = 1) {
  if (!ctx || ctx.state !== "running") return;
  const { node, ok } = spatial(pos, vol);
  if (!ok) return;
  switch (name) {
    case "punch":
      tone(node, "sine", 160, 50, 0.14, 0.9);
      noise(node, "bandpass", 1800, 600, 0.08, 0.5);
      break;
    case "hit":
      tone(node, "square", 220, 70, 0.1, 0.35);
      noise(node, "highpass", 3000, 1200, 0.1, 0.5);
      break;
    case "heavy":
      tone(node, "sine", 110, 30, 0.35, 1);
      noise(node, "lowpass", 1500, 100, 0.3, 0.8);
      break;
    case "whoosh":
      noise(node, "bandpass", 400, 2400, 0.22, 0.35, 0, 1.5);
      break;
    case "jump":
      noise(node, "bandpass", 300, 1200, 0.18, 0.25, 0, 2);
      break;
    case "land":
      tone(node, "sine", 90, 40, 0.18, 0.7);
      noise(node, "lowpass", 800, 100, 0.12, 0.4);
      break;
    case "fire":
      noise(node, "bandpass", 900, 300, 0.5, 0.5, 0, 0.8);
      tone(node, "sawtooth", 180, 90, 0.3, 0.15);
      break;
    case "fireball":
      noise(node, "bandpass", 500, 2000, 0.35, 0.5, 0, 1);
      tone(node, "sawtooth", 140, 380, 0.3, 0.22);
      break;
    case "explosion":
      noise(node, "lowpass", 2600, 80, 0.9, 1.1);
      tone(node, "sine", 80, 25, 0.8, 1.2);
      break;
    case "big":
      noise(node, "lowpass", 3200, 50, 2.2, 1.5);
      tone(node, "sine", 60, 20, 2, 1.6);
      tone(node, "sawtooth", 90, 30, 1.4, 0.3);
      break;
    case "charge":
      tone(node, "sawtooth", 80, 900, 1.6, 0.3);
      tone(node, "sine", 160, 1800, 1.6, 0.35);
      noise(node, "bandpass", 200, 3000, 1.6, 0.35, 0, 3);
      break;
    case "longcharge":
      tone(node, "sawtooth", 60, 700, 2.2, 0.32);
      tone(node, "sine", 120, 2400, 2.2, 0.4);
      noise(node, "bandpass", 150, 4000, 2.2, 0.45, 0, 4);
      break;
    case "beam":
      tone(node, "sawtooth", 90, 70, 2.1, 0.35);
      tone(node, "square", 440, 380, 2.1, 0.12);
      noise(node, "bandpass", 1200, 800, 2.1, 0.35, 0, 2);
      break;
    case "teleport":
      tone(node, "sine", 1200, 150, 0.25, 0.5);
      tone(node, "triangle", 200, 1500, 0.15, 0.3, 0.1);
      noise(node, "highpass", 4000, 800, 0.2, 0.3);
      break;
    case "shadow":
      tone(node, "sawtooth", 300, 60, 0.5, 0.35);
      tone(node, "sine", 70, 40, 0.5, 0.5);
      break;
    case "summon":
      tone(node, "sawtooth", 50, 200, 0.7, 0.4);
      tone(node, "square", 100, 400, 0.7, 0.15);
      noise(node, "lowpass", 600, 100, 0.7, 0.4);
      break;
    case "pickup":
      tone(node, "sine", 660, 660, 0.12, 0.35);
      tone(node, "sine", 990, 990, 0.2, 0.3, 0.08);
      break;
    case "level":
      [523, 659, 784, 1046].forEach((f, i) => tone(node, "triangle", f, f, 0.4, 0.4, i * 0.1));
      break;
    case "ui":
      tone(node, "square", 520, 780, 0.07, 0.18);
      break;
    case "shot":
      tone(node, "square", 900, 200, 0.12, 0.25);
      break;
    case "laser":
      tone(node, "sawtooth", 1800, 300, 0.3, 0.3);
      break;
    case "roar":
      tone(node, "sawtooth", 90, 55, 1.2, 0.7);
      tone(node, "square", 130, 60, 1.2, 0.3);
      noise(node, "lowpass", 900, 200, 1.2, 0.6);
      break;
    case "warn":
      tone(node, "square", 880, 880, 0.12, 0.25);
      tone(node, "square", 880, 880, 0.12, 0.25, 0.2);
      break;
    case "slam":
      tone(node, "sine", 70, 22, 0.7, 1.2);
      noise(node, "lowpass", 1200, 60, 0.6, 1);
      break;
    case "hurt":
      tone(node, "sawtooth", 200, 80, 0.25, 0.4);
      noise(node, "bandpass", 800, 300, 0.2, 0.4);
      break;
    case "dash":
      noise(node, "bandpass", 600, 3000, 0.25, 0.5, 0, 1.2);
      tone(node, "sawtooth", 200, 600, 0.2, 0.15);
      break;
    case "perfect":
      tone(node, "sine", 1500, 600, 0.5, 0.35);
      tone(node, "triangle", 300, 100, 0.5, 0.4);
      break;
  }
}

export function voice(text: string, pitch = 1, rate = 1) {
  if (!G.settings.voice || !("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.pitch = pitch;
    u.rate = rate;
    u.volume = Math.min(1, vols.sfx * vols.master);
    speechSynthesis.speak(u);
  } catch {}
}

/* ambience */
function startAmbience() {
  const c = ctx!;
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 260;
  const g = c.createGain();
  g.gain.value = 0.22;
  s.connect(f); f.connect(g); g.connect(ambG);
  s.start();
  const w = c.createBufferSource();
  w.buffer = noiseBuf; w.loop = true;
  const wf = c.createBiquadFilter();
  wf.type = "bandpass"; wf.frequency.value = 700; wf.Q.value = 0.6;
  const wg = c.createGain(); wg.gain.value = 0.04;
  const lfo = c.createOscillator(); lfo.frequency.value = 0.12;
  const lg = c.createGain(); lg.gain.value = 0.035;
  lfo.connect(lg); lg.connect(wg.gain);
  w.connect(wf); wf.connect(wg); wg.connect(ambG);
  w.start(); lfo.start();
  const event = () => {
    if (ctx && ctx.state === "running" && G.mode === "playing") {
      const r = Math.random();
      const t = c.currentTime;
      const o = c.createOscillator();
      const og = c.createGain();
      o.connect(og); og.connect(ambG);
      if (r < 0.4) {
        o.type = "square"; o.frequency.value = 420; og.gain.setValueAtTime(0.02, t); og.gain.setValueAtTime(0.0001, t + 0.35);
        o.frequency.setValueAtTime(520, t + 0.4); og.gain.setValueAtTime(0.02, t + 0.4); og.gain.setValueAtTime(0.0001, t + 0.8);
        o.start(t); o.stop(t + 0.9);
      } else if (r < 0.7) {
        o.type = "sine";
        for (let k = 0; k < 3; k++) { o.frequency.linearRampToValueAtTime(1000, t + k * 1.6 + 0.8); o.frequency.linearRampToValueAtTime(600, t + k * 1.6 + 1.6); }
        og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(0.015, t + 1.5); og.gain.linearRampToValueAtTime(0.0001, t + 4.8);
        o.start(t); o.stop(t + 5);
      } else {
        o.type = "sine"; o.frequency.value = 1400; og.gain.setValueAtTime(0.012, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
        o.start(t); o.stop(t + 0.5);
      }
    }
    setTimeout(event, 6000 + Math.random() * 12000);
  };
  setTimeout(event, 5000);
}

/* music */
const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const ROOTS = [33, 29, 36, 31];
const PENT = [0, 3, 5, 7, 10, 12, 15];
function startMusic() {
  if (started) return;
  started = true;
  const c = ctx!;
  let step = 0;
  let next = c.currentTime + 0.1;
  const bpm = () => (level >= 2 ? 150 : level === 1 ? 132 : 100);
  const sched = () => {
    while (next < c.currentTime + 0.25) {
      const sd = 60 / bpm() / 4;
      const bar = Math.floor(step / 16) % 4;
      const s16 = step % 16;
      const t = next - c.currentTime;
      const ch = CHORDS[bar];
      if (G.mode === "playing" || G.mode === "menu" || G.mode === "select") {
        if (s16 === 0) {
          for (const n of ch) {
            const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
            o.type = o2.type = "sawtooth"; o.frequency.value = NOTE(n); o2.frequency.value = NOTE(n) * 1.006;
            f.type = "lowpass"; f.frequency.value = level ? 1400 : 700;
            g.gain.setValueAtTime(0.0001, next); g.gain.linearRampToValueAtTime(0.05, next + sd * 3); g.gain.linearRampToValueAtTime(0.0001, next + sd * 15);
            o.connect(f); o2.connect(f); f.connect(g); g.connect(musicG);
            o.start(next); o2.start(next); o.stop(next + sd * 16); o2.stop(next + sd * 16);
          }
        }
        // bass
        if (s16 % 2 === 0 && (level > 0 || s16 % 4 === 0)) {
          const n = ROOTS[bar] + (level >= 2 && s16 % 8 === 4 ? 12 : 0);
          const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
          o.type = "sawtooth"; o.frequency.value = NOTE(n); f.type = "lowpass"; f.frequency.value = 400;
          g.gain.setValueAtTime(0.0001, next); g.gain.linearRampToValueAtTime(level ? 0.2 : 0.12, next + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, next + sd * 1.8);
          o.connect(f); f.connect(g); g.connect(musicG); o.start(next); o.stop(next + sd * 2);
        }
        // arp
        if (level > 0 || s16 % 4 === 0) {
          const k = PENT[(step * 3 + (s16 >> 2) * 2 + bar) % PENT.length];
          const o = c.createOscillator(), g = c.createGain();
          o.type = level >= 2 ? "square" : "triangle"; o.frequency.value = NOTE(69 + k - (bar === 1 ? 4 : 0));
          g.gain.setValueAtTime(0.0001, next); g.gain.linearRampToValueAtTime(level ? 0.06 : 0.035, next + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, next + sd * 2.5);
          o.connect(g); g.connect(musicG); o.start(next); o.stop(next + sd * 3);
        }
        // drums
        const kick = level ? s16 % 4 === 0 || (level >= 2 && s16 === 14) : s16 === 0 || s16 === 8;
        if (kick && ctx) {
          const o = c.createOscillator(), g = c.createGain();
          o.frequency.setValueAtTime(130, next); o.frequency.exponentialRampToValueAtTime(40, next + 0.12);
          g.gain.setValueAtTime(level ? 0.5 : 0.28, next); g.gain.exponentialRampToValueAtTime(0.0001, next + 0.2);
          o.connect(g); g.connect(musicG); o.start(next); o.stop(next + 0.22);
        }
        if (level && (s16 === 4 || s16 === 12)) {
          const s = c.createBufferSource(); s.buffer = noiseBuf; const f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 1500; const g = c.createGain();
          g.gain.setValueAtTime(0.22, next); g.gain.exponentialRampToValueAtTime(0.0001, next + 0.15);
          s.connect(f); f.connect(g); g.connect(musicG); s.start(next, Math.random()); s.stop(next + 0.2);
        }
        if (level || s16 % 2 === 0) {
          const s = c.createBufferSource(); s.buffer = noiseBuf; const f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7000; const g = c.createGain();
          g.gain.setValueAtTime(level ? 0.06 : 0.03, next); g.gain.exponentialRampToValueAtTime(0.0001, next + 0.04);
          s.connect(f); f.connect(g); g.connect(musicG); s.start(next, Math.random()); s.stop(next + 0.06);
        }
      }
      void t;
      next += sd;
      step++;
    }
  };
  setInterval(sched, 60);
}
