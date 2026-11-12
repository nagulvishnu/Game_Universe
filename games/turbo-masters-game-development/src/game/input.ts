import { PlayerInput, emptyInput } from "./vehicle";
import { store } from "./store";

const MAP = [
  { throttle: ["KeyW"], brake: ["KeyS"], left: ["KeyA"], right: ["KeyD"], nitro: ["ShiftLeft"], drift: ["Space"], item: ["KeyF"], reset: ["KeyR"], cam: ["KeyC"] },
  { throttle: ["ArrowUp"], brake: ["ArrowDown"], left: ["ArrowLeft"], right: ["ArrowRight"], nitro: ["ShiftRight"], drift: ["Enter", "NumpadEnter"], item: ["KeyK"], reset: ["KeyU"], cam: ["KeyO"] },
];
const GAME_KEYS = new Set<string>(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Enter", "NumpadEnter", "ShiftLeft", "ShiftRight", "KeyW", "KeyA", "KeyS", "KeyD", "KeyF", "KeyK", "KeyR", "KeyU", "KeyC", "KeyO", "AltLeft", "AltRight", "Tab", "ContextMenu"]);

class InputManager {
  keys = new Set<string>();
  edges: Record<string, boolean>[] = [{}, {}];
  padPrev: Record<number, boolean[]> = {};
  capture = false;
  onEscape: (() => void) | null = null;
  private inited = false;

  init() {
    if (this.inited) return;
    this.inited = true;
    window.addEventListener("keydown", (e) => {
      if (this.capture && GAME_KEYS.has(e.code)) e.preventDefault();
      if (this.capture && (e.ctrlKey || e.metaKey) && ["KeyS", "KeyW", "KeyR", "KeyF", "KeyO", "KeyU", "KeyK", "KeyD", "KeyA", "KeyC"].includes(e.code) === false) {
        /* let other ctrl combos through */
      }
      if (e.repeat) return;
      this.keys.add(e.code);
      MAP.forEach((m, p) => {
        (["item", "reset", "cam"] as const).forEach((a) => {
          if (m[a].includes(e.code)) this.edges[p][a] = true;
        });
      });
      if (e.code === "Escape" || e.code === "KeyP") this.onEscape?.();
    });
    window.addEventListener("keyup", (e) => {
      if (this.capture && GAME_KEYS.has(e.code)) e.preventDefault();
      this.keys.delete(e.code);
    });
    window.addEventListener("blur", () => this.keys.clear());
    window.addEventListener("contextmenu", (e) => {
      if (this.capture) e.preventDefault();
    });
  }

  pads(): { index: number; id: string }[] {
    const list = (navigator.getGamepads ? navigator.getGamepads() : []) as (Gamepad | null)[];
    const out: { index: number; id: string }[] = [];
    for (const g of list) if (g && g.connected) out.push({ index: g.index, id: g.id });
    return out;
  }
  /** Which pad index drives player p (or -1) */
  padFor(p: number): number {
    const sel = store.get().profiles[p].pad;
    const pads = this.pads();
    if (sel >= 0) return pads.some((g) => g.index === sel) ? sel : -1;
    // auto: P1 -> first pad, P2 -> second pad
    const other = store.get().profiles[1 - p].pad;
    const free = pads.filter((g) => g.index !== other);
    if (pads.length >= 2 && other < 0) return pads[p]?.index ?? -1;
    return free[0]?.index ?? -1;
  }

  down(p: number, a: keyof (typeof MAP)[0]) {
    return MAP[p][a].some((k) => this.keys.has(k));
  }

  sample(p: number, out: PlayerInput = emptyInput()): PlayerInput {
    out.throttle = this.down(p, "throttle") ? 1 : 0;
    out.brake = this.down(p, "brake") ? 1 : 0;
    out.steer = (this.down(p, "left") ? 1 : 0) - (this.down(p, "right") ? 1 : 0);
    out.nitro = this.down(p, "nitro");
    out.drift = this.down(p, "drift");
    out.item = !!this.edges[p].item;
    out.reset = !!this.edges[p].reset;
    out.cam = !!this.edges[p].cam;
    this.edges[p] = {};
    const gi = this.padFor(p);
    if (gi >= 0) {
      const g = (navigator.getGamepads() as (Gamepad | null)[])[gi];
      if (g) {
        const ax = g.axes[0] ?? 0;
        const dz = Math.abs(ax) < 0.14 ? 0 : ax;
        const dl = g.buttons[14]?.pressed ? 1 : 0, dr = g.buttons[15]?.pressed ? 1 : 0;
        const st = -dz + dl - dr;
        if (Math.abs(st) > Math.abs(out.steer)) out.steer = Math.max(-1, Math.min(1, st));
        out.throttle = Math.max(out.throttle, g.buttons[7]?.value ?? 0);
        out.brake = Math.max(out.brake, g.buttons[6]?.value ?? 0);
        const b = (i: number) => !!g.buttons[i]?.pressed;
        out.nitro = out.nitro || b(5) || b(2);
        out.drift = out.drift || b(0);
        const prev = this.padPrev[gi] ?? [];
        const edge = (i: number) => b(i) && !prev[i];
        if (edge(3)) out.item = true;
        if (edge(4) || edge(8)) out.reset = true;
        if (edge(1)) out.cam = true;
        if (edge(9)) this.onEscape?.();
        this.padPrev[gi] = g.buttons.map((x) => x.pressed);
      }
    }
    return out;
  }
}
export const input = new InputManager();

export const CONTROL_HELP = [
  { action: "Accelerate", p1: "W", p2: "↑" },
  { action: "Brake / Reverse", p1: "S", p2: "↓" },
  { action: "Steer", p1: "A / D", p2: "← / →" },
  { action: "Nitro", p1: "L-Shift", p2: "R-Shift" },
  { action: "Drift", p1: "Space", p2: "Enter" },
  { action: "Power-up", p1: "F", p2: "K" },
  { action: "Reset car", p1: "R", p2: "U" },
  { action: "Camera", p1: "C", p2: "O" },
];
