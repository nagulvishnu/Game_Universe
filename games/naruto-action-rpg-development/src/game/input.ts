import { useGame } from './store';
import type { Action } from './config';
import { DEFAULT_BINDINGS } from './config';

/** Keyboard / mouse state with per-frame "pressed" edges and rebindable actions. */
class Input {
  keys = new Set<string>();
  pressedKeys = new Set<string>();
  mouseDown = [false, false, false];
  mousePressed = [false, false, false];
  dx = 0; dy = 0;
  locked = false;
  lockFailed = false;
  everLocked = false;
  capturing = false;
  canvas: HTMLElement | null = null;
  private lastOverlayChange = 0;
  private codeToActions = new Map<string, Action[]>();

  constructor() { this.rebuild(); }

  rebuild() {
    const b = useGame.getState().settings.bindings;
    this.codeToActions.clear();
    (Object.keys(DEFAULT_BINDINGS) as Action[]).forEach((a) => {
      const c = b[a]; const l = this.codeToActions.get(c) ?? []; l.push(a); this.codeToActions.set(c, l);
    });
  }
  private code(a: Action) { return useGame.getState().settings.bindings[a]; }
  down(a: Action) { return this.keys.has(this.code(a)); }
  pressed(a: Action) { return this.pressedKeys.has(this.code(a)); }
  endFrame() { this.pressedKeys.clear(); this.mousePressed[0] = this.mousePressed[1] = this.mousePressed[2] = false; this.dx = 0; this.dy = 0; }
  reset() { this.keys.clear(); this.pressedKeys.clear(); this.mouseDown.fill(false); this.mousePressed.fill(false); this.dx = this.dy = 0; }

  private get live() { const g = useGame.getState(); return g.screen === 'playing' && g.overlay === null; }

  requestLock() {
    if (!this.canvas || this.locked) return;
    try {
      const r = (this.canvas as HTMLElement).requestPointerLock?.() as unknown;
      if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(() => { if (!this.everLocked) this.lockFailed = true; });
    } catch { if (!this.everLocked) this.lockFailed = true; }
  }
  releaseLock() { if (document.pointerLockElement) document.exitPointerLock(); }
  noteOverlayChange() { this.lastOverlayChange = performance.now(); }

  attach() {
    const onKeyDown = (e: KeyboardEvent) => {
      if (this.capturing) return;
      const g = useGame.getState();
      if (g.screen !== 'playing') return;
      if (e.code === this.code('pause') || e.code === 'Escape') {
        e.preventDefault();
        if (e.repeat) return;
        if (performance.now() - this.lastOverlayChange < 160) return;
        const o = g.overlay;
        if (o === null) { g.setOverlay('pause'); this.releaseLock(); }
        else if (o === 'dialogue') g.advanceDialogue();
        else if (o === 'gameover') { /* must choose */ }
        else { g.setOverlay(o === 'settings' || o === 'save' || o === 'load' || o === 'controls' ? 'pause' : null); if (!useGame.getState().overlay) this.requestLock(); }
        this.noteOverlayChange();
        return;
      }
      // Block browser shortcuts that would interfere (Tab focus, space scroll, F-key, arrows).
      if (this.codeToActions.has(e.code) || e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow') || e.ctrlKey && this.codeToActions.has(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressedKeys.add(e.code);
      this.keys.add(e.code);
      if (g.overlay === null) return;
      if (g.overlay === 'dialogue' && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyT')) g.advanceDialogue();
      // toggle menus with their hotkeys
      const toggles: [Action, Parameters<typeof g.setOverlay>[0]][] = [['status', 'status'], ['inventory', 'inventory'], ['map', 'map'], ['skills', 'skills'], ['missions', 'missions']];
      for (const [a, o] of toggles) if (e.code === this.code(a) && g.overlay === o) { g.setOverlay(null); this.requestLock(); this.noteOverlayChange(); }
    };
    const onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
    const onMouseDown = (e: MouseEvent) => {
      if (!this.live) return;
      if ((e.target as HTMLElement)?.closest?.('[data-ui]')) return;
      if (!this.locked && !this.lockFailed) { this.requestLock(); return; }
      if (!this.mouseDown[e.button]) this.mousePressed[e.button] = true;
      this.mouseDown[e.button] = true;
    };
    const onMouseUp = (e: MouseEvent) => { this.mouseDown[e.button] = false; };
    const onMove = (e: MouseEvent) => {
      if (!this.live) return;
      if (this.locked || this.lockFailed) { this.dx += e.movementX; this.dy += e.movementY; }
    };
    const onLockChange = () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === this.canvas && !!this.canvas;
      if (this.locked) this.everLocked = true;
      const g = useGame.getState();
      if (was && !this.locked && g.screen === 'playing' && g.overlay === null && performance.now() - this.lastOverlayChange > 200) {
        g.setOverlay('pause'); this.noteOverlayChange();
      }
    };
    const onLockErr = () => { if (!this.everLocked) this.lockFailed = true; };
    const onCtx = (e: Event) => { if (useGame.getState().screen === 'playing') e.preventDefault(); };
    const onBlur = () => { this.reset(); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('contextmenu', onCtx);
    window.addEventListener('blur', onBlur);
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('pointerlockerror', onLockErr);
    const unsub = useGame.subscribe((s, prev) => {
      if (s.settings.bindings !== prev.settings.bindings) this.rebuild();
      if (s.overlay !== prev.overlay) {
        this.noteOverlayChange();
        if (s.overlay !== null) { this.releaseLock(); this.reset(); }
        else if (prev.overlay !== null && s.screen === 'playing') this.requestLock();
      }
    });
    return () => {
      window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown); window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMove); window.removeEventListener('contextmenu', onCtx);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('pointerlockchange', onLockChange); document.removeEventListener('pointerlockerror', onLockErr);
      unsub();
    };
  }
}
export const input = new Input();
