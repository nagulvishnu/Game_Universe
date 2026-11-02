// Phase 9.2 — reusable input controller.
//
// Split deliberately into two layers:
//   InputState      pure key/axis bookkeeping, no DOM. Unit tested in Node.
//   InputController  DOM event binding that feeds InputState + pointer orbit/wheel.
//
// Design constraints honoured here:
// - Pointer lock is NOT required. Camera orbit uses plain pointer drag, which
//   works in every browser and needs no user-gesture permission.
// - Held keys are dropped on window blur and on tab hide, so alt-tabbing or
//   switching tabs can never leave the vehicle driving on its own.
// - preventDefault is applied ONLY to gameplay keys (arrows / space) and only
//   when focus is not in an editable field, so page controls keep working.
// - Listeners are added and removed symmetrically; dispose() is idempotent.

export type InputAction = 'transform' | 'quality';

/** Keyboard codes that drive movement. WASD and arrows are both accepted. */
const FORWARD_CODES = ['KeyW', 'ArrowUp'] as const;
const BACK_CODES = ['KeyS', 'ArrowDown'] as const;
const LEFT_CODES = ['KeyA', 'ArrowLeft'] as const;
const RIGHT_CODES = ['KeyD', 'ArrowRight'] as const;

/** Keys whose default browser behaviour (page scroll) would fight the game. */
const PREVENT_DEFAULT_CODES = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
]);

function anyDown(down: Set<string>, codes: readonly string[]): boolean {
  for (const c of codes) if (down.has(c)) return true;
  return false;
}

/** Pure key state. Exposed on its own so it can be tested without a DOM. */
export class InputState {
  private readonly down = new Set<string>();

  press(code: string): void {
    this.down.add(code);
  }

  release(code: string): void {
    this.down.delete(code);
  }

  /** Drop every held key (blur, tab hide, dispose). */
  clear(): void {
    this.down.clear();
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  get heldCount(): number {
    return this.down.size;
  }

  /** +1 right, -1 left, 0 none. */
  get steerAxis(): number {
    let v = 0;
    if (anyDown(this.down, RIGHT_CODES)) v += 1;
    if (anyDown(this.down, LEFT_CODES)) v -= 1;
    return v;
  }

  /** +1 forward (accelerate), -1 backward (brake/reverse), 0 coast. */
  get throttleAxis(): number {
    let v = 0;
    if (anyDown(this.down, FORWARD_CODES)) v += 1;
    if (anyDown(this.down, BACK_CODES)) v -= 1;
    return v;
  }

  get hasMovement(): boolean {
    return this.throttleAxis !== 0 || this.steerAxis !== 0;
  }
}

export interface InputControllerOptions {
  /** Element that receives pointerdown / wheel (normally the renderer canvas). */
  pointerTarget: HTMLElement;
  /** Edge-triggered one-shot actions (not held-key driven). */
  onAction?: (action: InputAction) => void;
}

export class InputController {
  readonly state = new InputState();

  private readonly pointerTarget: HTMLElement;
  private readonly onAction: ((action: InputAction) => void) | undefined;
  private disposed = false;

  private dragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private orbitX = 0;
  private orbitY = 0;
  private zoom = 0;

  constructor(options: InputControllerOptions) {
    this.pointerTarget = options.pointerTarget;
    this.onAction = options.onAction;

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.pointerTarget.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    this.pointerTarget.addEventListener('wheel', this.onWheel, { passive: false });
  }

  /** True while the user is actively dragging to orbit. */
  get isPointerDragging(): boolean {
    return this.dragging;
  }

  /** Accumulated, unconsumed pointer orbit in pixels (x = yaw, y = pitch). */
  consumeOrbit(): { x: number; y: number } {
    const out = { x: this.orbitX, y: this.orbitY };
    this.orbitX = 0;
    this.orbitY = 0;
    return out;
  }

  /** Accumulated, unconsumed wheel delta. */
  consumeZoom(): number {
    const out = this.zoom;
    this.zoom = 0;
    return out;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.pointerTarget.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    this.pointerTarget.removeEventListener('wheel', this.onWheel);

    this.state.clear();
    this.dragging = false;
    this.orbitX = 0;
    this.orbitY = 0;
    this.zoom = 0;
  }

  // ---------- keyboard ----------

  private isEditable(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el || !el.tagName) return false;
    const tag = el.tagName.toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return el.isContentEditable === true;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.disposed) return;
    // Never steal keys from a focused text field.
    if (this.isEditable(e.target)) return;

    this.state.press(e.code);

    if (e.repeat) return; // one-shot actions fire on the initial press only
    if (e.code === 'KeyT') this.onAction?.('transform');
    else if (e.code === 'KeyQ') this.onAction?.('quality');

    if (PREVENT_DEFAULT_CODES.has(e.code)) e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (this.disposed) return;
    this.state.release(e.code);
  };

  private onBlur = (): void => {
    // Alt-tab / devtools: a keyup will never arrive, so drop everything.
    this.state.clear();
    this.dragging = false;
  };

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      this.state.clear();
      this.dragging = false;
    }
  };

  // ---------- pointer ----------

  private onPointerDown = (e: PointerEvent): void => {
    if (this.disposed) return;
    // Ignore drags that start on interactive HUD controls.
    if (this.isEditable(e.target) || (e.target as HTMLElement | null)?.closest('button, a')) return;
    this.dragging = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.disposed || !this.dragging) return;
    this.orbitX += e.clientX - this.lastPointerX;
    this.orbitY += e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  };

  private onPointerUp = (): void => {
    this.dragging = false;
  };

  private onWheel = (e: WheelEvent): void => {
    if (this.disposed) return;
    if (this.isEditable(e.target)) return;
    // The page is a fixed full-screen canvas, but preventDefault keeps the
    // gesture from scrolling a page if the shell is ever embedded.
    e.preventDefault();
    this.zoom += e.deltaY;
  };
}