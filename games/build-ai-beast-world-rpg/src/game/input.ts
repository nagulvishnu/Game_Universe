export type Act = "attack" | "heavy" | "block" | "dodge" | "jump" | "skill1" | "skill2" | "ult" | "vesper" | "core" | "mount" | "interact" | "sense" | "lock" | "map" | "pause" | "descend" | "sprint" | "advance";
const KEYMAP: Record<string, Act> = {
  KeyJ: "attack", KeyK: "block", KeyH: "heavy", ShiftLeft: "dodge", ShiftRight: "dodge", Space: "jump",
  KeyE: "skill1", KeyQ: "skill2", KeyR: "ult", KeyZ: "vesper", KeyF: "interact", KeyV: "mount", KeyB: "core",
  KeyG: "sense", KeyT: "lock", Tab: "map", KeyM: "map", Escape: "pause", KeyP: "pause", KeyC: "descend", ControlLeft: "descend", Enter: "advance",
};
interface S { down: boolean; pressed: boolean; released: boolean; t: number }
class Input {
  acts = {} as Record<Act, S>;
  keys = new Set<string>();
  stick = { x: 0, y: 0 };
  look = { x: 0, y: 0 };
  touch = false;
  locked = false;
  sens = 1;
  constructor() {
    for (const a of Object.values(KEYMAP).concat(["sprint"])) this.acts[a] = { down: false, pressed: false, released: false, t: 0 };
    this.touch = typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches || navigator.maxTouchPoints > 0);
  }
  set(a: Act, down: boolean) {
    const s = this.acts[a]; if (!s) return;
    if (down && !s.down) { s.pressed = true; s.t = performance.now(); }
    if (!down && s.down) s.released = true;
    s.down = down;
  }
  down(a: Act) { return this.acts[a].down; }
  pressed(a: Act) { return this.acts[a].pressed; }
  released(a: Act) { return this.acts[a].released; }
  heldFor(a: Act) { const s = this.acts[a]; return s.down ? (performance.now() - s.t) / 1000 : 0; }
  consume(a: Act) { this.acts[a].pressed = false; }
  endFrame() { for (const k in this.acts) { const s = this.acts[k as Act]; s.pressed = false; s.released = false; } this.look.x = 0; this.look.y = 0; }
  moveVec() {
    let x = this.stick.x, y = this.stick.y;
    if (this.keys.has("KeyA")) x -= 1; if (this.keys.has("KeyD")) x += 1;
    if (this.keys.has("KeyW")) y += 1; if (this.keys.has("KeyS")) y -= 1;
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }
  attach(el: HTMLElement) {
    const kd = (e: KeyboardEvent) => {
      if (e.code === "Tab" || e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      const a = KEYMAP[e.code]; if (a) this.set(a, true);
    };
    const ku = (e: KeyboardEvent) => { this.keys.delete(e.code); const a = KEYMAP[e.code]; if (a) this.set(a, false); };
    const md = (e: MouseEvent) => {
      if (!this.locked && e.target !== el) return;
      if (e.button === 0) this.set("attack", true); else if (e.button === 2) this.set("block", true); else if (e.button === 1) { e.preventDefault(); this.set("lock", true); }
    };
    const mu = (e: MouseEvent) => { if (e.button === 0) this.set("attack", false); else if (e.button === 2) this.set("block", false); else if (e.button === 1) this.set("lock", false); };
    const mm = (e: MouseEvent) => { if (this.locked) { this.look.x += e.movementX; this.look.y += e.movementY; } };
    const lc = () => { this.locked = document.pointerLockElement === el; if (!this.locked) { this.set("attack", false); this.set("block", false); } };
    const blur = () => { for (const k in this.acts) this.set(k as Act, false); this.keys.clear(); };
    const cm = (e: Event) => e.preventDefault();
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    window.addEventListener("mousedown", md); window.addEventListener("mouseup", mu); window.addEventListener("mousemove", mm);
    document.addEventListener("pointerlockchange", lc); window.addEventListener("blur", blur); window.addEventListener("contextmenu", cm);
    return () => {
      window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku);
      window.removeEventListener("mousedown", md); window.removeEventListener("mouseup", mu); window.removeEventListener("mousemove", mm);
      document.removeEventListener("pointerlockchange", lc); window.removeEventListener("blur", blur); window.removeEventListener("contextmenu", cm);
    };
  }
}
export const input = new Input();
