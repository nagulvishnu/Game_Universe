// Unified keyboard / mouse / touch input -> actions
import { useStore } from './store';
import { DEFAULT_BINDS } from './data';

class Input {
  held = new Set<string>(); pressedQ = new Set<string>(); mdx = 0; mdy = 0; joy = { x: 0, y: 0 }; attack = false; aim = false; touchLook = false;
  rebinding: ((code: string) => void) | null = null; attached = false; canvas: HTMLElement | null = null; active = false;
  codeToAction: Record<string, string> = {};

  rebuild() {
    const b = { ...DEFAULT_BINDS, ...useStore.getState().settings.binds }; this.codeToAction = {};
    Object.entries(b).forEach(([a, c]) => (this.codeToAction[c] = a));
  }
  press(a: string) { if (!this.held.has(a)) this.pressedQ.add(a); this.held.add(a); }
  release(a: string) { this.held.delete(a); }
  was(a: string) { const r = this.pressedQ.has(a); return r; }
  down(a: string) { return this.held.has(a); }
  endFrame() { this.pressedQ.clear(); this.mdx = 0; this.mdy = 0; }
  axis() {
    let x = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0) + this.joy.x; let y = (this.down('forward') ? 1 : 0) - (this.down('back') ? 1 : 0) + this.joy.y;
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } return { x, y };
  }
  clear() { this.held.clear(); this.pressedQ.clear(); this.attack = false; this.aim = false; this.joy.x = 0; this.joy.y = 0; }
  attach() {
    if (this.attached) return; this.attached = true; this.rebuild();
    window.addEventListener('keydown', e => {
      if (this.rebinding) { e.preventDefault(); this.rebinding(e.code); this.rebinding = null; return; }
      if (!this.active) return;
      if (e.code === 'Escape') { const s = useStore.getState(); if (s.screen === 'game') s.setPaused(!s.paused); return; }
      const a = this.codeToAction[e.code]; if (a) { e.preventDefault(); if (!e.repeat) this.press(a); }
      if (e.code === 'Tab') e.preventDefault();
    });
    window.addEventListener('keyup', e => { const a = this.codeToAction[e.code]; if (a) this.release(a); });
    window.addEventListener('blur', () => this.clear());
    window.addEventListener('mousedown', e => {
      if (!this.active || (e.target as HTMLElement).closest('[data-ui]')) return;
      const st = useStore.getState(); if (st.paused) return;
      if (e.button === 0) { this.attack = true; this.tryLock(); } if (e.button === 2) { this.aim = true; this.pressedQ.add('aimlock'); }
    });
    window.addEventListener('mouseup', e => { if (e.button === 0) this.attack = false; if (e.button === 2) this.aim = false; });
    window.addEventListener('mousemove', e => { if (!this.active) return; if (document.pointerLockElement || e.buttons) { this.mdx += e.movementX; this.mdy += e.movementY; } });
    window.addEventListener('contextmenu', e => { if (this.active) e.preventDefault(); });
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.active) { const s = useStore.getState(); if (s.screen === 'game' && !s.paused && !('ontouchstart' in window)) s.setPaused(true); }
    });
  }
  tryLock() { if (!this.canvas || document.pointerLockElement || 'ontouchstart' in window) return; try { (this.canvas.requestPointerLock() as any)?.catch?.(() => {}); } catch { /* ignore */ } }
  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }
}
export const input = new Input();
