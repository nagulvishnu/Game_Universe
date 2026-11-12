import { DEFAULT_PAD, type PadMap } from './store';

export interface Polled {
  mx: number;
  mz: number;
  sprint: boolean;
  shot: number;
  special: boolean;
  camera: boolean;
}

const KB = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', shots: ['Digit1', 'Digit2', 'Digit3', 'Digit4'], sprint: ['ShiftLeft'], special: ['Space'], camera: 'KeyC' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', shots: ['Numpad1', 'Numpad2', 'Numpad3', 'Numpad4'], alt: ['Comma', 'Period', 'Slash', 'Quote'], sprint: ['Enter', 'NumpadEnter'], special: ['ShiftRight'], camera: 'KeyO' },
] as const;

class InputManager {
  private down = new Set<string>();
  private edges = new Set<string>();
  private prevPad: Record<number, boolean[]> = {};
  private pauseEdge = false;
  touch = { mx: 0, mz: 0, sprint: false, shot: 0, special: false, camera: false, enabled: false };
  pad: PadMap = { ...DEFAULT_PAD };
  padFor: 1 | 2 = 1;
  blockKeys = false;

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (this.blockKeys) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (!e.repeat) {
        this.edges.add(e.code);
        if (e.code === 'Escape' || e.code === 'KeyP') this.pauseEdge = true;
      }
      this.down.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Quote' || e.code === 'Slash') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });
    window.addEventListener('blur', () => this.down.clear());
  }

  consumePause(): boolean {
    let p = this.pauseEdge;
    this.pauseEdge = false;
    for (let i = 0; i < 2; i++) {
      const g = this.gp(i);
      if (g && this.btnEdge(i, g, this.pad.pause)) p = true;
    }
    return p;
  }
  isDown(code: string) {
    return this.down.has(code);
  }
  consumeEdge(code: string) {
    const v = this.edges.has(code);
    this.edges.delete(code);
    return v;
  }
  clearEdges() {
    this.edges.clear();
    this.pauseEdge = false;
  }

  private gp(i: number): Gamepad | null {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const list: Gamepad[] = [];
    for (const g of pads) if (g && g.connected) list.push(g);
    return list[i] ?? null;
  }
  private btnEdge(slot: number, g: Gamepad, b: number): boolean {
    const prev = (this.prevPad[slot] ??= []);
    const cur = !!g.buttons[b]?.pressed;
    const was = !!prev[b];
    return cur && !was;
  }
  private savePad(slot: number, g: Gamepad) {
    this.prevPad[slot] = g.buttons.map((b) => b.pressed);
  }
  padCount() {
    let n = 0;
    for (const g of navigator.getGamepads ? navigator.getGamepads() : []) if (g && g.connected) n++;
    return n;
  }
  /** Wait for the next gamepad button press (for remapping). */
  captureButton(): Promise<number> {
    return new Promise((res) => {
      const start = performance.now();
      const tick = () => {
        for (let i = 0; i < 2; i++) {
          const g = this.gp(i);
          if (g) {
            for (let b = 0; b < g.buttons.length; b++) if (g.buttons[b].pressed) return res(b);
          }
        }
        if (performance.now() - start > 8000) return res(-1);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  poll(idx: 0 | 1, merged: boolean): Polled {
    const out: Polled = { mx: 0, mz: 0, sprint: false, shot: 0, special: false, camera: false };
    const sets = merged ? [KB[idx], KB[1 - idx]] : [KB[idx]];
    const order = merged ? sets : sets;
    for (const k of order) {
      if (this.down.has(k.right)) out.mx += 1;
      if (this.down.has(k.left)) out.mx -= 1;
      if (this.down.has(k.up)) out.mz += 1;
      if (this.down.has(k.down)) out.mz -= 1;
      if (k.sprint.some((c) => this.down.has(c))) out.sprint = true;
      for (let s = 0; s < 4; s++) {
        const alt = 'alt' in k ? k.alt[s] : null;
        if (this.edges.delete(k.shots[s]) || (alt && this.edges.delete(alt))) out.shot = s + 1;
      }
      if (k.special.some((c) => this.edges.delete(c))) out.special = true;
      if (this.edges.delete(k.camera)) out.camera = true;
    }
    // gamepad
    const padSlots: number[] = [];
    if (merged) padSlots.push(0, 1);
    else padSlots.push(idx + 1 === this.padFor ? 0 : 1);
    for (const slot of padSlots) {
      const g = this.gp(slot);
      if (!g) continue;
      const ax = g.axes[0] ?? 0;
      const ay = g.axes[1] ?? 0;
      const dz = 0.22;
      if (Math.abs(ax) > dz) out.mx += ax;
      if (Math.abs(ay) > dz) out.mz -= ay;
      if (g.buttons[14]?.pressed) out.mx -= 1;
      if (g.buttons[15]?.pressed) out.mx += 1;
      if (g.buttons[12]?.pressed) out.mz += 1;
      if (g.buttons[13]?.pressed) out.mz -= 1;
      const p = this.pad;
      if (g.buttons[p.sprint]?.pressed || g.buttons[6]?.pressed) out.sprint = true;
      if (this.btnEdge(slot, g, p.long)) out.shot = 1;
      if (this.btnEdge(slot, g, p.short)) out.shot = 2;
      if (this.btnEdge(slot, g, p.right)) out.shot = 3;
      if (this.btnEdge(slot, g, p.left)) out.shot = 4;
      if (this.btnEdge(slot, g, p.special) || this.btnEdge(slot, g, 7)) out.special = true;
      if (this.btnEdge(slot, g, p.camera)) out.camera = true;
      this.savePad(slot, g);
    }
    // touch controls drive player 1 (or the only human)
    if ((idx === 0 || merged) && this.touch.enabled) {
      out.mx += this.touch.mx;
      out.mz += this.touch.mz;
      if (this.touch.sprint) out.sprint = true;
      if (this.touch.shot) {
        out.shot = this.touch.shot;
        this.touch.shot = 0;
      }
      if (this.touch.special) {
        out.special = true;
        this.touch.special = false;
      }
      if (this.touch.camera) {
        out.camera = true;
        this.touch.camera = false;
      }
    }
    const m = Math.hypot(out.mx, out.mz);
    if (m > 1) {
      out.mx /= m;
      out.mz /= m;
    }
    return out;
  }
}

export const input = new InputManager();
