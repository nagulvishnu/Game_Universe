import * as THREE from "three";
import { FIGHTERS } from "./data";
import { buildRig, type FighterRig } from "./rig";
import { ANIMS, POSES } from "./poses";
import { EL_COLORS } from "./vfx";

const glow = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.4, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();

export const HERO_POSE: Record<string, Float32Array> = {
  kairo: ANIMS.uppercut.strike,
  ryujin: ANIMS.cast.strike,
  akuma: POSES.ultPoint,
  shiro: ANIMS.castUp.strike,
};

export type ShowPose = "idle" | "hero" | "victory" | "charge" | "roar";

export interface ShowOpts {
  chars: number[];
  spacing?: number;
  pose?: ShowPose;
  orbit?: boolean;
  fov?: number;
  camY?: number;
  camZ?: number;
  lookY?: number;
  yaw?: number[];
  forms?: boolean;
  manual?: boolean;
  alpha?: boolean;
}

export class Showcase {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  rigs: FighterRig[] = [];
  holders: THREE.Group[] = [];
  halos: THREE.Sprite[] = [];
  discs: THREE.Mesh[] = [];
  embers: THREE.Points;
  emberPos: Float32Array;
  raf = 0;
  last = 0;
  t = 0;
  yawDrag = 0;
  dragging = false;
  pose: ShowPose;
  disposed = false;
  rimLights: THREE.PointLight[] = [];
  constructor(public canvas: HTMLCanvasElement, public opts: ShowOpts) {
    this.pose = opts.pose ?? "idle";
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: opts.alpha !== false, powerPreference: "high-performance", preserveDrawingBuffer: !!opts.manual });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.setClearColor(0x000000, 0);
    this.camera = new THREE.PerspectiveCamera(opts.fov ?? 32, 1, 0.1, 100);
    this.scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x302040, 1.3));
    const key = new THREE.DirectionalLight(0xfff0e0, 2.6); key.position.set(-3, 5, 6); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x8090ff, 0.8); fill.position.set(4, 2, 3); this.scene.add(fill);
    // embers
    const N = 120;
    this.emberPos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { this.emberPos[i * 3] = (Math.random() - 0.5) * 8; this.emberPos[i * 3 + 1] = Math.random() * 4; this.emberPos[i * 3 + 2] = (Math.random() - 0.5) * 4; }
    const eg = new THREE.BufferGeometry(); eg.setAttribute("position", new THREE.BufferAttribute(this.emberPos, 3));
    this.embers = new THREE.Points(eg, new THREE.PointsMaterial({ size: 0.07, map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffffff }));
    this.scene.add(this.embers);
    this.setChars(opts.chars);
    if (!opts.manual) {
      this.raf = requestAnimationFrame(this.loop);
      canvas.addEventListener("pointerdown", this.onDown);
    }
  }

  private onDown = (e: PointerEvent) => {
    this.dragging = true;
    let lx = e.clientX;
    const move = (ev: PointerEvent) => { this.yawDrag += (ev.clientX - lx) * 0.012; lx = ev.clientX; };
    const up = () => { this.dragging = false; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  setChars(chars: number[]) {
    this.rigs.forEach((r, i) => { this.scene.remove(this.holders[i]); r.dispose(); });
    this.halos.forEach((h) => this.scene.remove(h));
    this.discs.forEach((d) => this.scene.remove(d));
    this.rigs = []; this.holders = []; this.halos = []; this.discs = []; this.rimLights.forEach((l) => this.scene.remove(l)); this.rimLights = [];
    const sp = this.opts.spacing ?? 2.2;
    chars.forEach((ci, i) => {
      const def = FIGHTERS[ci];
      const rig = buildRig(def.id);
      const holder = new THREE.Group();
      holder.position.x = (i - (chars.length - 1) / 2) * sp;
      holder.add(rig.root);
      this.scene.add(holder);
      this.rigs.push(rig); this.holders.push(holder);
      const col = EL_COLORS[def.element].main;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: col, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.set(4.6, 5.2, 1); halo.position.set(holder.position.x, 1.2, -0.9); this.scene.add(halo); this.halos.push(halo);
      const disc = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.78, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.6), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      disc.position.set(holder.position.x, 0.02, 0); this.scene.add(disc); this.discs.push(disc);
      const rim = new THREE.PointLight(col, 40, 8, 1.5); rim.position.set(holder.position.x + 1.2, 1.8, -1.6); this.scene.add(rim); this.rimLights.push(rim);
      const rim2 = new THREE.PointLight(def.glow2, 18, 8, 1.5); rim2.position.set(holder.position.x - 1.4, 1.2, 1.6); this.scene.add(rim2); this.rimLights.push(rim2);
      if (this.opts.forms) { rig.setForm(true); rig.form = 1; }
      this.applyPose(i);
      rig.snap();
    });
    (this.embers.material as THREE.PointsMaterial).color.set(chars.length ? EL_COLORS[FIGHTERS[chars[0]].element].core : 0xffffff);
  }

  setPose(p: ShowPose) { this.pose = p; this.rigs.forEach((_, i) => this.applyPose(i)); }

  private applyPose(i: number) {
    const rig = this.rigs[i];
    const id = rig.style.id;
    const p = this.pose;
    if (p === "hero") { rig.setPose(HERO_POSE[id], 6); rig.setGlow(0.6); }
    else if (p === "victory") { rig.setPose("victory", 6); rig.setGlow(0.4); }
    else if (p === "charge") { rig.setPose("charge", 6); rig.setGlow(1); }
    else if (p === "roar") { rig.setPose("roar", 6); rig.setGlow(1); }
    else { rig.setPose("idle", 6); rig.setGlow(0.15); }
  }

  resize() {
    const c = this.canvas;
    const w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    if (c.width !== Math.floor(w * this.renderer.getPixelRatio()) || c.height !== Math.floor(h * this.renderer.getPixelRatio())) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  frame(dt: number) {
    this.t += dt;
    const o = this.opts;
    this.rigs.forEach((r, i) => {
      const base = o.yaw?.[i] ?? 0;
      const orbit = o.orbit ? Math.sin(this.t * 0.5) * 0.35 : 0;
      this.holders[i].rotation.y = base + orbit + this.yawDrag;
      r.update(dt, this.t + i * 0.7);
      this.discs[i].rotation.y = this.t * 0.5;
      this.discs[i].scale.setScalar(1 + Math.sin(this.t * 2 + i) * 0.04);
      this.halos[i].material.opacity = 0.42 + Math.sin(this.t * 1.7 + i) * 0.1;
    });
    const arr = this.emberPos;
    for (let i = 0; i < arr.length / 3; i++) { arr[i * 3 + 1] += dt * (0.3 + (i % 5) * 0.12); if (arr[i * 3 + 1] > 4.2) arr[i * 3 + 1] = 0; }
    this.embers.geometry.attributes.position.needsUpdate = true;
    const n = this.rigs.length;
    const camZ = o.camZ ?? (n > 1 ? 4 + n * 1.5 : 5.2);
    this.camera.position.set(Math.sin(this.t * 0.3) * 0.25, o.camY ?? 1.45, camZ);
    this.camera.lookAt(0, o.lookY ?? 1.0, 0);
    this.renderer.render(this.scene, this.camera);
  }

  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    this.resize();
    this.frame(dt);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.rigs.forEach((r) => r.dispose());
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

// ---------------------------------------------------------------- static art (rendered once)
const artCache: Record<string, string> = {};
export function getArt(ci: number, kind: "full" | "face" | "bust"): string {
  const key = `${ci}:${kind}`;
  return artCache[key] ?? "";
}

export async function generateArt(onProgress?: (p: number) => void) {
  const tick = () => new Promise((r) => setTimeout(r, 16));
  let n = 0;
  const total = FIGHTERS.length * 3;
  for (let ci = 0; ci < FIGHTERS.length; ci++) {
    for (const kind of ["full", "bust", "face"] as const) {
      const canvas = document.createElement("canvas");
      const w = kind === "full" ? 600 : kind === "bust" ? 520 : 256;
      const h = kind === "full" ? 900 : kind === "bust" ? 520 : 256;
      canvas.width = w; canvas.height = h;
      const sc = new Showcase(canvas, { chars: [ci], pose: kind === "face" ? "idle" : "hero", manual: true, fov: kind === "full" ? 30 : 26, yaw: [kind === "face" ? 0.12 : kind === "bust" ? 0.3 : 0.45] });
      const rig = sc.rigs[0];
      sc.renderer.setPixelRatio(1);
      sc.renderer.setSize(w, h, false);
      sc.camera.aspect = w / h;
      for (let i = 0; i < 30; i++) rig.update(0.05, i * 0.05);
      sc.holders[0].rotation.y = kind === "face" ? 0.12 : kind === "bust" ? 0.3 : 0.45;
      const headW = new THREE.Vector3();
      rig.head.getWorldPosition(headW);
      if (kind === "full") { sc.camera.position.set(0.4, 1.25, 5.6); sc.camera.lookAt(0, 0.98, 0); }
      else if (kind === "bust") { sc.camera.position.set(0.5, headW.y - 0.18, 3.1); sc.camera.lookAt(0, headW.y - 0.3, 0); }
      else { sc.camera.position.set(0.08, headW.y + 0.15, 1.55); sc.camera.lookAt(0, headW.y + 0.17, 0); }
      sc.camera.updateProjectionMatrix();
      sc.discs.forEach((d) => (d.visible = kind === "full"));
      sc.embers.visible = kind === "full";
      sc.halos.forEach((hh) => { hh.scale.set(kind === "full" ? 5 : 6, kind === "full" ? 6 : 6, 1); hh.position.set(0, kind === "full" ? 1.2 : headW.y - 0.2, -1); });
      sc.renderer.render(sc.scene, sc.camera);
      artCache[`${ci}:${kind}`] = canvas.toDataURL("image/png");
      sc.dispose();
      n++;
      onProgress?.(n / total);
      await tick();
    }
  }
}
