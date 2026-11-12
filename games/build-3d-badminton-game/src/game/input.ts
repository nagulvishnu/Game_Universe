// Input: keyboard (two players), gamepad (configurable), touch (virtual stick + buttons).
import type { InputState } from './sim';
import { DEFAULT_PADMAP } from './storage';

interface KeyMap { up: string; down: string; left: string; right: string; s1: string; s2: string; s3: string; s4: string; jump: string; sprint: string; cam: string; alt1?: string[]; }
const P1: KeyMap = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', s1: 'Digit1', s2: 'Digit2', s3: 'Digit3', s4: 'Digit4', jump: 'Space', sprint: 'ShiftLeft', cam: 'KeyC' };
const P2: KeyMap = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', s1: 'Numpad1', s2: 'Numpad2', s3: 'Numpad3', s4: 'Numpad4', jump: 'ShiftRight', sprint: 'Enter', cam: 'KeyO' };

export const touchState = { mx: 0, my: 0, sprint: false, shot: 0, jump: false, active: false };

export class InputManager {
  private keys = new Set<string>();
  private edge = new Set<string>();
  private padPrev: Record<number, boolean[]> = {};
  private padEdge: Record<number, Set<string>> = {};
  humans = 1;
  padMap: Record<string, number> = { ...DEFAULT_PADMAP };
  pauseReq = false;
  restartReq = false;
  camReq: boolean[] = [false, false];
  lastDevice: 'keyboard' | 'touch' | 'pad' = 'keyboard';
  listening: ((btn: number) => void) | null = null;

  private onDown = (e: KeyboardEvent) => {
    const tgt = e.target as HTMLElement | null;
    if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'SELECT' || tgt.tagName === 'TEXTAREA')) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab'].includes(e.code) && this.gameActive) e.preventDefault();
    if (e.repeat) return;
    this.lastDevice = 'keyboard';
    this.keys.add(e.code);
    this.edge.add(e.code);
    if (e.code === 'Escape' || e.code === 'KeyP') this.pauseReq = true;
    if (e.code === 'KeyR') this.restartReq = true;
    if (e.code === P1.cam) this.camReq[0] = true;
    if (e.code === P2.cam) this.camReq[this.humans > 1 ? 1 : 0] = true;
  };
  private onUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  private onBlur = () => { this.keys.clear(); };
  gameActive = false;

  attach() {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.onBlur);
  }
  detach() {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.onBlur);
  }

  private axisKeys(m: KeyMap) {
    const mx = (this.keys.has(m.right) ? 1 : 0) - (this.keys.has(m.left) ? 1 : 0);
    const my = (this.keys.has(m.up) ? 1 : 0) - (this.keys.has(m.down) ? 1 : 0);
    return { mx, my };
  }
  private edgeShot(m: KeyMap): number {
    if (this.edge.has(m.s1)) return 1;
    if (this.edge.has(m.s2)) return 2;
    if (this.edge.has(m.s3)) return 3;
    if (this.edge.has(m.s4)) return 4;
    return 0;
  }

  private pad(i: number): Gamepad | null {
    const pads = (navigator.getGamepads ? navigator.getGamepads() : []) as (Gamepad | null)[];
    const list = pads.filter((p): p is Gamepad => !!p && p.connected);
    if (!list.length) return null;
    if (this.humans === 1) return list[0];
    return list[i] ?? null;
  }

  /** poll once per frame: gamepad edge detection + rebinding */
  pollPads() {
    const pads = (navigator.getGamepads ? navigator.getGamepads() : []) as (Gamepad | null)[];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const prev = this.padPrev[p.index] ?? [];
      const ed = this.padEdge[p.index] ?? (this.padEdge[p.index] = new Set());
      p.buttons.forEach((b, i) => {
        const pressed = b.pressed || b.value > 0.6;
        if (pressed && !prev[i]) {
          ed.add('b' + i);
          this.lastDevice = 'pad';
          if (this.listening) { const l = this.listening; this.listening = null; l(i); }
          if (i === 9) this.pauseReq = true;
        }
        prev[i] = pressed;
      });
      this.padPrev[p.index] = prev;
    }
  }

  pollHuman(i: number): InputState {
    const out: InputState = { mx: 0, my: 0, sprint: false, shot: 0, jump: false };
    const maps = i === 0 ? (this.humans === 1 ? [P1, P2] : [P1]) : [P2];
    for (const m of maps) {
      const a = this.axisKeys(m);
      if (Math.abs(a.mx) > Math.abs(out.mx)) out.mx = a.mx;
      if (Math.abs(a.my) > Math.abs(out.my)) out.my = a.my;
      if (this.keys.has(m.sprint) || (m === P1 && this.keys.has('ShiftLeft'))) out.sprint = true;
      const s = this.edgeShot(m);
      if (s) out.shot = s;
      if (this.edge.has(m.jump)) out.jump = true;
      if (this.humans === 1 && m === P2 && this.keys.has('ShiftRight')) { /* special shares jump */ }
    }
    if (i === 0 && this.humans === 1 && this.keys.has('ShiftRight')) out.sprint = out.sprint || false;
    // normalize diagonals
    const mag = Math.hypot(out.mx, out.my);
    if (mag > 1) { out.mx /= mag; out.my /= mag; }
    // gamepad
    const pad = this.pad(i);
    if (pad) {
      const dz = 0.2;
      let ax = pad.axes[0] ?? 0, ay = -(pad.axes[1] ?? 0);
      if (pad.buttons[14]?.pressed) ax = -1; if (pad.buttons[15]?.pressed) ax = 1;
      if (pad.buttons[12]?.pressed) ay = 1; if (pad.buttons[13]?.pressed) ay = -1;
      if (Math.hypot(ax, ay) > dz) {
        const gm = Math.min(1, Math.hypot(ax, ay));
        const nx = (ax / Math.hypot(ax, ay)) * gm, ny = (ay / Math.hypot(ax, ay)) * gm;
        if (Math.hypot(nx, ny) > Math.hypot(out.mx, out.my)) { out.mx = nx; out.my = ny; }
        this.lastDevice = 'pad';
      }
      const m = this.padMap;
      const ed = this.padEdge[pad.index];
      const btn = (n: number) => !!pad.buttons[n]?.pressed;
      if (btn(m.sprint) || btn(6) || btn(5)) out.sprint = true;
      if (ed) {
        if (ed.has('b' + m.clear)) out.shot = 1;
        else if (ed.has('b' + m.drop)) out.shot = 2;
        else if (ed.has('b' + m.right)) out.shot = 3;
        else if (ed.has('b' + m.left)) out.shot = 4;
        if (ed.has('b' + m.jump)) out.jump = true;
        if (ed.has('b' + m.camera)) this.camReq[i] = true;
        ed.clear();
      }
    }
    // touch (player 1 only)
    if (i === 0 && touchState.active) {
      if (Math.hypot(touchState.mx, touchState.my) > Math.hypot(out.mx, out.my)) { out.mx = touchState.mx; out.my = touchState.my; }
      if (touchState.sprint) out.sprint = true;
      if (touchState.shot) { out.shot = touchState.shot; touchState.shot = 0; }
      if (touchState.jump) { out.jump = true; touchState.jump = false; }
    }
    return out;
  }

  /** call at end of frame after polling all humans */
  endFrame() { this.edge.clear(); this.camReq[0] = false; this.camReq[1] = false; }
  takePause() { const p = this.pauseReq; this.pauseReq = false; return p; }
  takeRestart() { const p = this.restartReq; this.restartReq = false; return p; }
  takeCam(i: number) { return this.camReq[i]; }
  clearKeys() { this.keys.clear(); this.edge.clear(); }
}

export const input = new InputManager();
