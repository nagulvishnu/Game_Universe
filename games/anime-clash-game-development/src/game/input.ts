import { ACTIONS, DEFAULT_BINDINGS, DEFAULT_PADMAP, type Action, type Bindings, type PadMap } from "./data";

export interface PlayerInput {
  held: Record<Action, boolean>;
  pressed: Record<Action, boolean>;
  ax: number; // -1..1 screen X
  az: number; // -1..1 screen Z (negative = forward / into screen)
}

const emptyActs = (): Record<Action, boolean> => {
  const o = {} as Record<Action, boolean>;
  for (const a of ACTIONS) o[a] = false;
  return o;
};

const RESERVED = new Set(["Escape", "F1", "F5", "F11", "F12", "MetaLeft", "MetaRight"]);
const STORE = "animeclash.input.v1";

class InputManager {
  bindings: [Bindings, Bindings] = [{ ...DEFAULT_BINDINGS[0] }, { ...DEFAULT_BINDINGS[1] }];
  padMap: [PadMap, PadMap] = [{ ...DEFAULT_PADMAP }, { ...DEFAULT_PADMAP }];
  padAssign: [number, number] = [-1, -1];
  version = 0;
  message = "";
  private keys = new Set<string>();
  private edges = new Set<string>();
  private prev: [Record<Action, boolean>, Record<Action, boolean>] = [emptyActs(), emptyActs()];
  private padPrev: Record<number, boolean[]> = {};
  private padEdge: Record<number, Set<number>> = {};
  private listeners = new Set<() => void>();
  private attached = false;
  private capture: ((code: string) => void) | null = null;
  private padCapture: { pad: number; cb: (btn: number) => void } | null = null;
  pauseEdge = false;
  anyKeyEdge = false;

  constructor() {
    try {
      const s = localStorage.getItem(STORE);
      if (s) {
        const o = JSON.parse(s);
        if (o.bindings) this.bindings = [{ ...DEFAULT_BINDINGS[0], ...o.bindings[0] }, { ...DEFAULT_BINDINGS[1], ...o.bindings[1] }];
        if (o.padMap) this.padMap = [{ ...DEFAULT_PADMAP, ...o.padMap[0] }, { ...DEFAULT_PADMAP, ...o.padMap[1] }];
      }
    } catch { /* ignore */ }
  }

  private save() {
    try { localStorage.setItem(STORE, JSON.stringify({ bindings: this.bindings, padMap: this.padMap })); } catch { /* ignore */ }
  }
  private bump() { this.version++; this.listeners.forEach((l) => l()); }
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getVersion = () => this.version;

  attach() {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener("keydown", this.onDown, { passive: false });
    window.addEventListener("keyup", this.onUp);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("gamepadconnected", this.onPadConn);
    window.addEventListener("gamepaddisconnected", this.onPadDisc);
    // pick up already-connected pads
    this.autoAssign();
  }

  private allBound(): Set<string> {
    const s = new Set<string>(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab", "Backspace"]);
    for (const b of this.bindings) for (const a of ACTIONS) s.add(b[a]);
    return s;
  }

  private onDown = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
    if (this.capture) {
      e.preventDefault();
      const cb = this.capture;
      this.capture = null;
      cb(e.code);
      return;
    }
    if (this.allBound().has(e.code)) e.preventDefault();
    if (e.code === "Escape" && !e.repeat) this.pauseEdge = true;
    if (e.repeat) return;
    this.keys.add(e.code);
    this.edges.add(e.code);
    this.anyKeyEdge = true;
  };
  private onUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (this.allBound().has(e.code)) e.preventDefault();
  };
  private onBlur = () => { this.keys.clear(); };
  private onPadConn = () => { this.autoAssign(); this.bump(); };
  private onPadDisc = (e: GamepadEvent) => {
    for (let i = 0; i < 2; i++) if (this.padAssign[i] === e.gamepad.index) this.padAssign[i] = -1;
    this.bump();
  };

  connectedPads(): { index: number; id: string }[] {
    const out: { index: number; id: string }[] = [];
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const g of gps) if (g && g.connected) out.push({ index: g.index, id: g.id });
    return out;
  }

  autoAssign() {
    const pads = this.connectedPads().map((p) => p.index);
    for (let i = 0; i < 2; i++) if (this.padAssign[i] >= 0 && !pads.includes(this.padAssign[i])) this.padAssign[i] = -1;
    for (const idx of pads) {
      if (this.padAssign.includes(idx)) continue;
      const free = this.padAssign.indexOf(-1);
      if (free >= 0) this.padAssign[free] = idx;
    }
  }
  assignPad(player: 0 | 1, idx: number) {
    if (idx >= 0 && this.padAssign[1 - player] === idx) this.padAssign[1 - player] = -1;
    this.padAssign[player] = idx;
    this.bump();
  }

  // ---- remapping ----
  remapKey(player: 0 | 1, action: Action, done?: () => void) {
    this.message = `Press a key for ${action.toUpperCase()}… (Esc to cancel)`;
    this.bump();
    this.capture = (code) => {
      if (code === "Escape") { this.message = ""; this.bump(); done?.(); return; }
      if (RESERVED.has(code)) { this.message = `${code} is reserved.`; this.bump(); done?.(); return; }
      const old = this.bindings[player][action];
      // conflict prevention: swap if another action (any player) already uses this key
      for (let p = 0; p < 2; p++) {
        for (const a of ACTIONS) {
          if (this.bindings[p][a] === code && !(p === player && a === action)) {
            this.bindings[p][a] = old;
            this.message = `Swapped with P${p + 1} ${a.toUpperCase()} to avoid conflict.`;
          }
        }
      }
      this.bindings[player][action] = code;
      if (!this.message.startsWith("Swapped")) this.message = "";
      this.save();
      this.bump();
      done?.();
    };
  }
  cancelRemap() { this.capture = null; this.padCapture = null; this.message = ""; this.bump(); }
  remapPad(player: 0 | 1, action: Action, done?: () => void) {
    const pad = this.padAssign[player];
    if (pad < 0) { this.message = `Assign a controller to Player ${player + 1} first.`; this.bump(); return; }
    this.message = `Press a controller button for ${action.toUpperCase()}…`;
    this.bump();
    this.padCapture = {
      pad,
      cb: (btn) => {
        const m = this.padMap[player];
        for (const a of ACTIONS) if (m[a] === btn && a !== action) m[a] = m[action];
        m[action] = btn;
        this.message = "";
        this.save();
        this.bump();
        done?.();
      },
    };
  }
  resetBindings() {
    this.bindings = [{ ...DEFAULT_BINDINGS[0] }, { ...DEFAULT_BINDINGS[1] }];
    this.padMap = [{ ...DEFAULT_PADMAP }, { ...DEFAULT_PADMAP }];
    this.message = "";
    this.save();
    this.bump();
  }

  // ---- polling ----
  private pollPads() {
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const g of gps) {
      if (!g) continue;
      const prev = this.padPrev[g.index] ?? [];
      const set = (this.padEdge[g.index] ??= new Set());
      const cur = g.buttons.map((b) => b.pressed || b.value > 0.6);
      cur.forEach((c, i) => {
        if (c && !prev[i]) {
          set.add(i);
          if (this.padCapture && this.padCapture.pad === g.index) {
            const cb = this.padCapture.cb;
            this.padCapture = null;
            cb(i);
          }
          if (i === 9) this.pauseEdge = true;
          this.anyKeyEdge = true;
        }
      });
      this.padPrev[g.index] = cur;
    }
  }

  poll(player: 0 | 1): PlayerInput {
    if (player === 0) this.pollPads();
    const held = emptyActs();
    const pressed = emptyActs();
    const b = this.bindings[player];
    const pad = this.padAssign[player];
    const gp = pad >= 0 && navigator.getGamepads ? navigator.getGamepads()[pad] : null;
    const pm = this.padMap[player];
    for (const a of ACTIONS) {
      let h = this.keys.has(b[a]);
      let e = this.edges.has(b[a]);
      if (gp && pm[a] !== undefined) {
        const bi = pm[a]!;
        const bt = gp.buttons[bi];
        if (bt && (bt.pressed || bt.value > 0.6)) h = true;
        if (this.padEdge[gp.index]?.has(bi)) e = true;
      }
      held[a] = h;
      pressed[a] = e || (h && !this.prev[player][a]);
    }
    let ax = 0, az = 0;
    if (gp) {
      const x = gp.axes[0] ?? 0, y = gp.axes[1] ?? 0;
      if (Math.abs(x) > 0.28) ax += x;
      if (Math.abs(y) > 0.28) az += y;
      const d = (i: number) => gp.buttons[i]?.pressed;
      if (d(14)) ax -= 1;
      if (d(15)) ax += 1;
      if (d(12)) az -= 1;
      if (d(13)) az += 1;
    }
    if (held.left) ax -= 1;
    if (held.right) ax += 1;
    if (held.up) az -= 1;
    if (held.down) az += 1;
    ax = Math.max(-1, Math.min(1, ax));
    az = Math.max(-1, Math.min(1, az));
    held.left = held.left || ax < -0.4;
    held.right = held.right || ax > 0.4;
    held.up = held.up || az < -0.4;
    held.down = held.down || az > 0.4;
    // directional edges for menu navigation
    for (const a of ["left", "right", "up", "down"] as Action[]) {
      if (!pressed[a] && held[a] && !this.prev[player][a]) pressed[a] = true;
    }
    this.prev[player] = { ...held };
    return { held, pressed, ax, az };
  }

  endFrame() {
    this.edges.clear();
    for (const k in this.padEdge) this.padEdge[k].clear();
    this.pauseEdge = false;
    this.anyKeyEdge = false;
  }

  consumeKey(code: string) { return this.edges.has(code); }

  clearHeld() { this.keys.clear(); this.prev = [emptyActs(), emptyActs()]; }
}

export const input = new InputManager();
