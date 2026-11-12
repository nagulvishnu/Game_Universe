// Keyboard / mouse / touch input with configurable bindings.
import { bus, useGame } from './store';

const ALT: Record<string, string[]> = {
  dodge: ['ControlLeft', 'ControlRight', 'KeyB'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  attack: ['KeyK'],
  forward: ['ArrowUp'],
  interact: [],
  jump: [],
};
export class Input {
  keys = new Set<string>();
  mouse = { l: false, r: false };
  lookX = 0;
  lookY = 0;
  stick = { x: 0, y: 0 };
  tHeld = new Set<string>();
  pressed = new Set<string>();
  locked = false;
  el: HTMLElement | null = null;
  attached = false;
  mouseLook = true;
  codeToActions(code: string): string[] {
    const k = useGame.getState().settings.keys;
    const out: string[] = [];
    for (const a of Object.keys(k)) if (k[a] === code) out.push(a);
    for (const a of Object.keys(ALT)) if (ALT[a].includes(code)) out.push(a);
    if (code === 'KeyY') out.push('unlock');
    if (code === 'KeyG') out.push('lock');
    const m = /^Digit([1-5])$/.exec(code);
    if (m) out.push('cmd' + m[1]);
    return out;
  }
  codes(a: string): string[] {
    return [useGame.getState().settings.keys[a], ...(ALT[a] || [])].filter(Boolean);
  }
  held(a: string) {
    if (this.tHeld.has(a)) return true;
    if (a === 'attack' && this.mouse.l) return true;
    if (a === 'lock' && this.mouse.r) return false;
    return this.codes(a).some((c) => this.keys.has(c));
  }
  hit(a: string) {
    if (this.pressed.has(a)) {
      this.pressed.delete(a);
      return true;
    }
    return false;
  }
  press(a: string) {
    this.pressed.add(a);
  }
  axis() {
    let x = this.stick.x,
      y = this.stick.y;
    if (this.held('right')) x += 1;
    if (this.held('left')) x -= 1;
    if (this.held('forward')) y += 1;
    if (this.held('back')) y -= 1;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return { x, y };
  }
  takeLook() {
    const r = { x: this.lookX, y: this.lookY };
    this.lookX = 0;
    this.lookY = 0;
    return r;
  }
  clear() {
    this.keys.clear();
    this.mouse.l = this.mouse.r = false;
    this.tHeld.clear();
    this.stick.x = this.stick.y = 0;
    this.pressed.clear();
  }
  attach(el: HTMLElement) {
    this.el = el;
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT')) return;
      const st = useGame.getState();
      if (e.code === 'Enter' || e.code === 'Escape') bus.emit('skipCine', e.code);
      if (st.dialog && (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter')) {
        const choosing = !!st.dialog.choices && st.dialog.idx === st.dialog.lines.length - 1;
        if (choosing && (e.code === 'Space' || e.code === 'Enter')) return;
        e.preventDefault();
        if (!e.repeat) bus.emit('dialogAdvance');
        return;
      }
      const uiOpen =
        st.screen === 'menu' ||
        st.screen === 'paused' ||
        st.screen === 'dead' ||
        st.screen === 'ending' ||
        st.panel !== 'none' ||
        !!st.dialog ||
        !!st.cine?.bars;
      if (uiOpen && e.code !== 'Escape') {
        if (st.screen === 'dead' && e.code === 'KeyR' && !e.repeat) bus.emit('retry');
        return;
      }
      if (
        e.code === 'Tab' ||
        e.code === 'Space' ||
        e.code.startsWith('Arrow') ||
        (e.ctrlKey && st.screen === 'playing')
      )
        e.preventDefault();
      if (e.repeat) {
        this.keys.add(e.code);
        return;
      }
      this.keys.add(e.code);
      for (const a of this.codeToActions(e.code)) {
        this.pressed.add(a);
        if (['status', 'inventory', 'map', 'quests', 'pause'].includes(a)) bus.emit('ui', a);
      }
      if (e.code === 'KeyR' && st.screen === 'dead') bus.emit('retry');
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.clear());
    el.addEventListener('mousedown', (e) => {
      if (useGame.getState().screen !== 'playing') return;
      if (e.button === 0) {
        this.mouse.l = true;
        this.pressed.add('attack');
      }
      if (e.button === 2) {
        this.mouse.r = true;
        this.pressed.add('lock');
      }
      if (!this.locked && this.mouseLook && !('ontouchstart' in window)) {
        try {
          (el.requestPointerLock() as any)?.catch?.(() => {});
        } catch {
          /* ignore */
        }
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.mouse.l = false;
        this.pressed.add('attackUp');
      }
      if (e.button === 2) this.mouse.r = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.lookX += e.movementX;
        this.lookY += e.movementY;
      }
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener(
      'wheel',
      (e) => {
        if (e.deltaY !== 0) this.pressed.add('lock');
      },
      { passive: true }
    );
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === el;
      if (was && !this.locked) {
        const st = useGame.getState();
        if (st.screen === 'playing' && st.panel === 'none' && !st.dialog && !st.cine) bus.emit('ui', 'pause');
      }
    });
  }
  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }
}
export const input = new Input();
