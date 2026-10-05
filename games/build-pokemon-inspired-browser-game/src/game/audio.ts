let actx: AudioContext | null = null;
let muted = false;
try { muted = localStorage.getItem('mq_muted') === '1'; } catch { /* ignore */ }

function ac(): AudioContext | null {
  try {
    if (!actx) {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      actx = new C();
    }
    if (actx.state === 'suspended') void actx.resume();
    return actx;
  } catch { return null; }
}

export function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.06, slide = 0, delay = 0) {
  if (muted) return;
  const c = ac(); if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(dur: number, vol = 0.1, delay = 0) {
  if (muted) return;
  const c = ac(); if (!c) return;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(); const g = c.createGain();
  s.buffer = buf; g.gain.value = vol; s.connect(g).connect(c.destination); s.start(c.currentTime + delay);
}

export const isMuted = () => muted;
export function setMuted(m: boolean) { muted = m; try { localStorage.setItem('mq_muted', m ? '1' : '0'); } catch { /* ignore */ } }

export const sfx = {
  unlock() { ac(); },
  step() { tone(120 + Math.random() * 30, 0.04, 'triangle', 0.025); },
  bump() { tone(90, 0.06, 'square', 0.03); },
  select() { tone(660, 0.06, 'square', 0.05); tone(880, 0.08, 'square', 0.05, 0, 0.05); },
  back() { tone(440, 0.07, 'square', 0.04, -120); },
  grass() { noise(0.08, 0.05); },
  encounter() { for (let i = 0; i < 6; i++) tone(300 + (i % 2) * 300, 0.08, 'sawtooth', 0.05, 0, i * 0.07); },
  hit(power = 1) { noise(0.12, 0.12 * power); tone(160, 0.12, 'square', 0.08, -80); },
  crit() { noise(0.2, 0.2); tone(900, 0.15, 'sawtooth', 0.07, -600); },
  super() { tone(520, 0.08, 'square', 0.06); tone(780, 0.14, 'square', 0.06, 0, 0.07); },
  weak() { tone(220, 0.15, 'triangle', 0.06, -80); },
  miss() { tone(300, 0.15, 'sine', 0.05, -200); },
  faint() { tone(400, 0.5, 'sawtooth', 0.07, -330); },
  swoosh() { noise(0.15, 0.05); tone(400, 0.12, 'sine', 0.03, 400); },
  wobble() { tone(200, 0.08, 'square', 0.06); tone(150, 0.08, 'square', 0.05, 0, 0.08); },
  caught() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.16, 'square', 0.06, 0, i * 0.09)); },
  levelUp() { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, 'triangle', 0.08, 0, i * 0.07)); },
  heal() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'sine', 0.08, 0, i * 0.12)); },
  buy() { tone(1200, 0.05, 'square', 0.05); tone(1600, 0.1, 'square', 0.05, 0, 0.05); },
  coin() { tone(988, 0.07, 'square', 0.05); tone(1319, 0.14, 'square', 0.05, 0, 0.07); },
  error() { tone(150, 0.15, 'sawtooth', 0.05); },
  mega() { for (let i = 0; i < 10; i++) tone(300 + i * 90, 0.12, 'sawtooth', 0.05, 200, i * 0.05); noise(0.5, 0.1, 0.4); },
  badge() { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, 0.2, 'square', 0.06, 0, i * 0.11)); },
  alert() { tone(880, 0.08, 'square', 0.07); tone(1175, 0.16, 'square', 0.07, 0, 0.08); },
  gameover() { [440, 392, 330, 262].forEach((f, i) => tone(f, 0.3, 'triangle', 0.08, 0, i * 0.22)); },
  win() { [523, 523, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'square', 0.06, 0, i * 0.14)); },
};
