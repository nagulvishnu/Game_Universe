let ctx: AudioContext | null = null;
let muted = false;
try {
  muted = localStorage.getItem('bastion-muted') === '1';
} catch {
  /* ignore */
}

const last: Record<string, number> = {};

function getCtx(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.04, slide = 0, delay = 0) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function throttle(key: string, ms: number) {
  const now = performance.now();
  if (now - (last[key] ?? 0) < ms) return false;
  last[key] = now;
  return true;
}

export function isMuted() {
  return muted;
}
export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem('bastion-muted', m ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export const sfx = {
  shoot(kind: string) {
    if (!throttle('shoot-' + kind, 70)) return;
    if (kind === 'archer') tone(700, 0.06, 'triangle', 0.025, -300);
    else if (kind === 'cannon') tone(120, 0.18, 'sawtooth', 0.05, -70);
    else if (kind === 'frost') tone(900, 0.2, 'sine', 0.03, 500);
    else if (kind === 'tesla') tone(300, 0.12, 'sawtooth', 0.03, 600);
    else if (kind === 'sniper') tone(220, 0.25, 'square', 0.05, -160);
  },
  boom() {
    if (!throttle('boom', 80)) return;
    tone(90, 0.25, 'sawtooth', 0.06, -50);
  },
  kill() {
    if (!throttle('kill', 50)) return;
    tone(520, 0.08, 'square', 0.02, 300);
  },
  build() {
    tone(260, 0.09, 'square', 0.05, 200);
    tone(390, 0.12, 'square', 0.05, 200, 0.08);
  },
  upgrade() {
    tone(400, 0.1, 'triangle', 0.06);
    tone(500, 0.1, 'triangle', 0.06, 0, 0.09);
    tone(700, 0.18, 'triangle', 0.06, 0, 0.18);
  },
  sell() {
    tone(500, 0.1, 'triangle', 0.05, -200);
  },
  deny() {
    tone(160, 0.15, 'square', 0.05, -40);
  },
  life() {
    tone(200, 0.3, 'sawtooth', 0.07, -120);
  },
  wave() {
    tone(220, 0.15, 'square', 0.05);
    tone(330, 0.15, 'square', 0.05, 0, 0.14);
    tone(440, 0.3, 'square', 0.05, 0, 0.28);
  },
  meteor() {
    tone(900, 0.6, 'sawtooth', 0.04, -800);
    tone(70, 0.5, 'sawtooth', 0.09, -30, 0.6);
  },
  freeze() {
    tone(1200, 0.5, 'sine', 0.05, -900);
  },
  heal() {
    tone(500, 0.15, 'sine', 0.06, 0);
    tone(750, 0.25, 'sine', 0.06, 0, 0.12);
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.07, 0, i * 0.14));
  },
  lose() {
    [392, 330, 262, 196].forEach((f, i) => tone(f, 0.35, 'sawtooth', 0.06, 0, i * 0.2));
  },
  click() {
    tone(600, 0.04, 'square', 0.02);
  },
};
