/**
 * SHADOWSTRIKE — keyboard input.
 * Continuous state for movement, explicit edge events for tap/hold attacks.
 * Held keys are cleared on blur / pause so the fighter never "sticks".
 */

import type { KeyBindings } from '../../save/save';
import type { FighterInput } from '../entities/Fighter';

const PREVENT = new Set([
  'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab',
]);

export interface VirtualInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  block: boolean;
  attackHeld: boolean;
  /** edge flags — consumed on the next read */
  attackPressed: boolean;
  attackReleased: boolean;
  jumpPressed: boolean;
  dodgePressed: boolean;
  skill1: boolean;
  skill2: boolean;
  skill3: boolean;
}

const EMPTY_VIRTUAL: VirtualInput = {
  left: false, right: false, up: false, down: false, block: false,
  attackHeld: false, attackPressed: false, attackReleased: false,
  jumpPressed: false, dodgePressed: false,
  skill1: false, skill2: false, skill3: false,
};

export class InputManager {
  private held = new Set<string>();
  private pressedBuffer = new Map<string, number>();
  private releasedBuffer = new Set<string>();
  private enabled = true;
  private bindings: [KeyBindings, KeyBindings];
  private bufferMs = 140;
  private now = 0;
  /** On-screen stick / button state, one slot per player. */
  private virtual: VirtualInput[] = [{ ...EMPTY_VIRTUAL }, { ...EMPTY_VIRTUAL }];

  constructor(p1: KeyBindings, p2: KeyBindings) {
    this.bindings = [p1, p2];
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.reset);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  setBindings(p1: KeyBindings, p2: KeyBindings) { this.bindings = [p1, p2]; }
  setEnabled(v: boolean) { this.enabled = v; if (!v) this.reset(); }

  /** Merge on-screen (virtual) controls for a player into the input state. */
  setVirtual(player: 1 | 2, patch: Partial<VirtualInput>): void {
    Object.assign(this.virtual[player - 1], patch);
  }

  /** Drop every virtual flag — used when the match is paused or lost focus. */
  clearVirtual(): void {
    this.virtual[0] = { ...EMPTY_VIRTUAL };
    this.virtual[1] = { ...EMPTY_VIRTUAL };
  }

  private onVisibility = () => { if (document.hidden) this.reset(); };

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.enabled) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    if (PREVENT.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    this.held.add(e.code);
    this.pressedBuffer.set(e.code, this.now);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (this.held.delete(e.code)) this.releasedBuffer.add(e.code);
  };

  reset = () => {
    this.held.clear();
    this.pressedBuffer.clear();
    this.releasedBuffer.clear();
    this.clearVirtual();
  };

  isHeld(code: string): boolean { return this.held.has(code); }
  isPressed(code: string): boolean { return this.pressedBuffer.has(code); }

  tick(nowMs: number): void {
    this.now = nowMs;
    for (const [code, t] of this.pressedBuffer) {
      if (nowMs - t > this.bufferMs) this.pressedBuffer.delete(code);
    }
  }

  /** Consume edge events for a player and build an input snapshot. */
  read(player: 1 | 2): FighterInput {
    const b = this.bindings[player - 1];
    const v = this.virtual[player - 1];
    const press = (code: string) => {
      if (this.pressedBuffer.has(code)) { this.pressedBuffer.delete(code); return true; }
      return false;
    };
    const release = (code: string) => {
      if (this.releasedBuffer.has(code)) { this.releasedBuffer.delete(code); return true; }
      return false;
    };
    // Virtual flags are edge-triggered: consumed by the first read that sees them.
    const takeFlag = (key: 'attackPressed' | 'attackReleased' | 'jumpPressed' | 'dodgePressed' | 'skill1' | 'skill2' | 'skill3') => {
      const val = v[key];
      if (val) v[key] = false;
      return val;
    };
    return {
      left: this.held.has(b.left) || v.left,
      right: this.held.has(b.right) || v.right,
      up: this.held.has(b.jump) || v.up,
      down: this.held.has(b.crouch) || v.down,
      block: this.held.has(b.block) || v.block,
      attackHeld: this.held.has(b.attack) || v.attackHeld,
      attackPressed: press(b.attack) || takeFlag('attackPressed'),
      attackReleased: release(b.attack) || takeFlag('attackReleased'),
      jumpPressed: press(b.jump) || takeFlag('jumpPressed'),
      dodgePressed: press(b.dodge) || takeFlag('dodgePressed'),
      skillPressed: [
        press(b.skill1) || takeFlag('skill1'),
        press(b.skill2) || takeFlag('skill2'),
        press(b.skill3) || takeFlag('skill3'),
      ],
    };
  }

  /** Clears release flags that nobody consumed, so they do not leak frames. */
  endFrame(): void {
    this.releasedBuffer.clear();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.reset);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.reset();
  }
}

export const KEY_LABELS: Record<string, string> = {
  Space: 'SPACE', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT',
  ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL', AltLeft: 'L-ALT', AltRight: 'R-ALT',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Enter: 'ENTER', Tab: 'TAB', Backspace: 'BKSP',
};

export function keyLabel(code: string): string {
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6);
  return code.toUpperCase();
}
