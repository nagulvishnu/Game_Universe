import { ACTIONS, Action, useGame } from './store';

const now = () => performance.now() / 1000;

class InputSystem {
  held = new Set<Action>();
  pressedAt: Partial<Record<Action, number>> = {};
  consumed: Partial<Record<Action, number>> = {};
  codes = new Set<string>();
  look = { x: 0, y: 0 };
  axis = { x: 0, y: 0 };
  pad = { x: 0, y: 0, lx: 0, ly: 0 };
  locked = false;
  lockedOnce = false;
  isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0);
  onAction: (a: Action, down: boolean) => void = () => {};
  onPause: () => void = () => {};
  private prevPad: boolean[] = [];

  press(a: Action) { if (!this.held.has(a)) { this.held.add(a); this.pressedAt[a] = now(); this.onAction(a, true); } }
  release(a: Action) { if (this.held.delete(a)) this.onAction(a, false); }
  isHeld(a: Action) { return this.held.has(a); }
  /** returns true once if pressed within buffer seconds */
  took(a: Action, buffer = .22) {
    const p = this.pressedAt[a];
    if (p === undefined || p === this.consumed[a]) return false;
    if (now() - p > buffer) return false;
    this.consumed[a] = p; return true;
  }
  peek(a: Action, buffer = .22) { const p = this.pressedAt[a]; return p !== undefined && p !== this.consumed[a] && now() - p <= buffer; }
  flush() { for (const a of ACTIONS) this.consumed[a] = this.pressedAt[a]; this.look.x = this.look.y = 0; }
  clear() { for (const a of [...this.held]) this.release(a); this.codes.clear(); this.axis.x = this.axis.y = 0; }

  move() {
    let x = this.axis.x + this.pad.x, y = this.axis.y + this.pad.y;
    if (this.held.has('left')) x -= 1; if (this.held.has('right')) x += 1;
    if (this.held.has('forward')) y += 1; if (this.held.has('back')) y -= 1;
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }
  camKeys() {
    let x = 0, y = 0;
    if (this.codes.has('ArrowLeft')) x -= 1; if (this.codes.has('ArrowRight')) x += 1;
    if (this.codes.has('ArrowUp')) y -= 1; if (this.codes.has('ArrowDown')) y += 1;
    return { x: x + this.pad.lx, y: y + this.pad.ly };
  }

  private actionsFor(code: string): Action[] {
    const keys = useGame.getState().settings.keys, out: Action[] = [];
    for (const a of ACTIONS) if (keys[a] === code) out.push(a);
    return out;
  }

  pollPad() {
    const gp = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads()[0] : null;
    if (!gp) { this.pad.x = this.pad.y = this.pad.lx = this.pad.ly = 0; return; }
    const dz = (v: number) => Math.abs(v) < .18 ? 0 : v;
    this.pad.x = dz(gp.axes[0] ?? 0); this.pad.y = -dz(gp.axes[1] ?? 0); this.pad.lx = dz(gp.axes[2] ?? 0); this.pad.ly = dz(gp.axes[3] ?? 0);
    const map: [number, Action][] = [[0, 'jump'], [2, 'light'], [3, 'heavy'], [5, 'deflect'], [1, 'dodge'], [4, 'spec1'], [6, 'spec2'], [7, 'ult'], [10, 'lock'], [11, 'awaken'], [8, 'sprint']];
    for (const [b, a] of map) {
      const d = !!gp.buttons[b]?.pressed;
      if (d && !this.prevPad[b]) this.press(a); else if (!d && this.prevPad[b]) this.release(a);
      this.prevPad[b] = d;
    }
  }
  rumble(strong: number, weak: number, ms: number) {
    const s = useGame.getState().settings; if (!s.vibrate) return;
    try {
      const gp = navigator.getGamepads?.()[0] as (Gamepad & { vibrationActuator?: { playEffect: (t: string, o: object) => void } }) | null;
      gp?.vibrationActuator?.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak });
      else_vib(ms * Math.max(strong, weak));
    } catch { /* ignore */ }
  }
}
function else_vib(ms: number) { if (typeof navigator !== 'undefined' && navigator.vibrate && ms > 5) navigator.vibrate(Math.min(80, ms)); }

export const input = new InputSystem();

export function installInput() {
  const isField = (t: EventTarget | null) => t instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(t.tagName);
  window.addEventListener('keydown', e => {
    const st = useGame.getState();
    if (st.rebinding) { e.preventDefault(); if (e.code !== 'Escape') st.setKey(st.rebinding, e.code); else st.set({ rebinding: null }); return; }
    if (isField(e.target)) return;
    if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (e.repeat) return;
    input.codes.add(e.code);
    if (e.code === 'Escape' || e.code === 'KeyP') { input.onPause(); return; }
    for (const a of input['actionsFor'](e.code)) input.press(a);
  });
  window.addEventListener('keyup', e => {
    input.codes.delete(e.code);
    for (const a of input['actionsFor'](e.code)) input.release(a);
  });
  window.addEventListener('mousedown', e => {
    if ((e as unknown as { sourceCapabilities?: { firesTouchEvents?: boolean } }).sourceCapabilities?.firesTouchEvents) return;
    const st = useGame.getState();
    const st2 = st.rebinding;
    if (st2) { e.preventDefault(); st.setKey(st2, 'Mouse' + e.button); return; }
    if (st.screen !== 'playing') return;
    const t = e.target as HTMLElement;
    if (!t.closest('[data-game]')) return;
    if (!input.locked && !input.isTouch) { try { (document.querySelector('canvas') as HTMLCanvasElement | null)?.requestPointerLock?.(); } catch { /* ignore */ } }
    e.preventDefault();
    for (const a of input['actionsFor']('Mouse' + e.button)) input.press(a);
  });
  window.addEventListener('mouseup', e => { for (const a of input['actionsFor']('Mouse' + e.button)) input.release(a); });
  window.addEventListener('mousemove', e => {
    if (input.locked) { input.look.x += e.movementX; input.look.y += e.movementY; }
  });
  window.addEventListener('contextmenu', e => { if (useGame.getState().screen === 'playing' || useGame.getState().rebinding) e.preventDefault(); });
  window.addEventListener('blur', () => input.clear());
  document.addEventListener('pointerlockchange', () => {
    const was = input.locked;
    input.locked = !!document.pointerLockElement;
    if (input.locked) input.lockedOnce = true;
    if (was && !input.locked && useGame.getState().screen === 'playing') input.onPause();
  });
}

export function lockPointer() {
  if (input.isTouch) return;
  try { (document.querySelector('canvas') as HTMLCanvasElement | null)?.requestPointerLock?.(); } catch { /* ignore */ }
}
