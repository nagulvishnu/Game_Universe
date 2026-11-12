export type Act = 'attack' | 'heavy' | 'guard' | 'dodge' | 'jump' | 'sprint' | 'skillA' | 'skillB' | 'ult' | 'awaken' | 'lock' | 'interact' | 'swap';
const ACTS: Act[] = ['attack', 'heavy', 'guard', 'dodge', 'jump', 'sprint', 'skillA', 'skillB', 'ult', 'awaken', 'lock', 'interact', 'swap'];
const KEYMAP: Record<string, Act[]> = {
  Space: ['jump'], ShiftLeft: ['sprint'], ShiftRight: ['sprint'], KeyQ: ['dodge'], KeyE: ['skillA', 'interact'], KeyR: ['skillB'], KeyV: ['ult'], KeyT: ['awaken'], KeyF: ['heavy'],
  KeyZ: ['lock'], KeyX: ['swap'], KeyG: ['interact'], Enter: ['interact'],
};
export class Input {
  down = {} as Record<Act, boolean>; pressed = {} as Record<Act, boolean>; released = {} as Record<Act, boolean>;
  mx = 0; my = 0; stick: [number, number] = [0, 0]; keys = new Set<string>(); select = -1; frozen = false; locked = false;
  constructor() { for (const a of ACTS) { this.down[a] = false; this.pressed[a] = false; this.released[a] = false; } }
  press(a: Act) { if (this.frozen) return; if (!this.down[a]) this.pressed[a] = true; this.down[a] = true; }
  release(a: Act) { if (this.down[a]) this.released[a] = true; this.down[a] = false; }
  releaseAll() { for (const a of ACTS) this.down[a] = false; this.keys.clear(); this.stick = [0, 0]; }
  look(dx: number, dy: number) { this.mx += dx; this.my += dy; }
  moveVec(): [number, number] {
    if (this.frozen) return [0, 0];
    const k = this.keys; let x = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0), y = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    x += this.stick[0]; y += this.stick[1]; const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    return [x, y];
  }
  arrowLook(dt: number) { const k = this.keys; const x = (k.has('ArrowRight') ? 1 : 0) - (k.has('ArrowLeft') ? 1 : 0), y = (k.has('ArrowDown') ? 1 : 0) - (k.has('ArrowUp') ? 1 : 0); this.mx += x * 520 * dt; this.my += y * 380 * dt; }
  endFrame() { for (const a of ACTS) { this.pressed[a] = false; this.released[a] = false; } this.mx = 0; this.my = 0; }
  keyDown(code: string): boolean {
    this.keys.add(code);
    const a = KEYMAP[code]; if (a) { for (const x of a) this.press(x); return true; }
    if (code.startsWith('Digit')) { const n = parseInt(code.slice(5)); if (n >= 1 && n <= 4) { this.select = n - 1; return true; } }
    return false;
  }
  keyUp(code: string) { this.keys.delete(code); const a = KEYMAP[code]; if (a) for (const x of a) this.release(x); }
  mouseDown(b: number) { if (b === 0) this.press('attack'); else if (b === 2) this.press('guard'); }
  mouseUp(b: number) { if (b === 0) this.release('attack'); else if (b === 2) this.release('guard'); }
}
