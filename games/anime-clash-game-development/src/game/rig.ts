import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { JOINTS, POSE_LEN, LAY, HY, POSES, type Joint } from "./poses";

type V3 = [number, number, number];

// ---------------- materials ----------------
const gradientMap = (() => {
  const d = new Uint8Array([70, 70, 80, 255, 150, 150, 165, 255, 215, 215, 225, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

interface ToonOpts { emissive?: number; ei?: number; rim?: number; rimS?: number; vc?: boolean; side?: THREE.Side }
export function toon(color: number, o: ToonOpts = {}) {
  const m = new THREE.MeshToonMaterial({
    color, gradientMap, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1,
    vertexColors: o.vc ?? false, side: o.side ?? THREE.FrontSide,
  });
  m.userData.rimC = { value: new THREE.Color(o.rim ?? 0x9fb4ff) };
  m.userData.rimS = { value: o.rimS ?? 0.4 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.rimColor = m.userData.rimC;
    sh.uniforms.rimStrength = m.userData.rimS;
    sh.fragmentShader = "uniform vec3 rimColor;\nuniform float rimStrength;\n" + sh.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      { vec3 rn = normalize(vNormal); vec3 vd = normalize(vViewPosition);
        float rim = pow(1.0 - clamp(dot(rn, vd), 0.0, 1.0), 2.4);
        totalEmissiveRadiance += rimColor * rim * rimStrength; }`
    );
  };
  m.customProgramCacheKey = () => "toonrim";
  return m;
}

const OUTLINE = (() => {
  const m = new THREE.MeshBasicMaterial({ color: 0x08060f, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <begin_vertex>", "vec3 transformed = position + normalize(normal) * 0.011;");
  };
  m.customProgramCacheKey = () => "outline";
  return m;
})();

const glowTex = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.35, "rgba(255,255,255,0.6)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
})();

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, o: { p?: V3; r?: V3; s?: V3; ol?: boolean; cast?: boolean } = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (o.p) m.position.set(...o.p);
  if (o.r) m.rotation.set(...o.r);
  if (o.s) m.scale.set(...o.s);
  m.castShadow = o.cast ?? true;
  if (o.ol !== false) {
    const ol = new THREE.Mesh(geo, OUTLINE);
    ol.userData.outline = true;
    m.add(ol);
  }
  parent.add(m);
  return m;
}
const grp = (parent: THREE.Object3D, p: V3 = [0, 0, 0], r: V3 = [0, 0, 0]) => {
  const g = new THREE.Group();
  g.position.set(...p);
  g.rotation.set(...r);
  parent.add(g);
  return g;
};
const cyl = (rt: number, rb: number, h: number, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg);
const sph = (r: number, ws = 14, hs = 10) => new THREE.SphereGeometry(r, ws, hs);
const rbox = (w: number, h: number, d: number, r = 0.02) => new RoundedBoxGeometry(w, h, d, 2, r);
const cone = (r: number, h: number, seg = 8) => new THREE.ConeGeometry(r, h, seg);

// ---------------- styles ----------------
export interface Style {
  id: string;
  skin: number;
  hair: number;
  hairForm: number;
  hairEmForm: number;
  cloth: number;
  cloth2: number;
  trim: number;
  metal: number;
  pants: number;
  boots: number;
  eye: number;
  eyeGlow: number;
  eyeForm: number;
  aura: number;
  auraForm: number;
  brow: number;
  open: number;
  scale: number;
  mouth: "grin" | "smirk" | "calm" | "flat";
  mark: "scar" | "bolt" | "violet" | "diamond";
  rim: number;
}

export const STYLES: Record<string, Style> = {
  kairo: { id: "kairo", skin: 0xe8a77a, hair: 0x15131a, hairForm: 0xffd23f, hairEmForm: 0xffa010, cloth: 0x1b1a22, cloth2: 0xd8261c, trim: 0xff5a2a, metal: 0x8b8f9c, pants: 0x1d1c26, boots: 0x16151c, eye: 0xff7a1a, eyeGlow: 0xff5a1f, eyeForm: 0xfff3a0, aura: 0xff5a1f, auraForm: 0xffd23f, brow: 0.22, open: 0.9, scale: 1.0, mouth: "grin", mark: "scar", rim: 0xff7a3a },
  ryujin: { id: "ryujin", skin: 0xf3d3bd, hair: 0xd9dfee, hairForm: 0xfff6a8, hairEmForm: 0xffe040, cloth: 0x15235c, cloth2: 0xf2f6ff, trim: 0x4fb8ff, metal: 0xc9d6ee, pants: 0x101a42, boots: 0xe8eefc, eye: 0x38c8ff, eyeGlow: 0x4fd0ff, eyeForm: 0xfff6a8, aura: 0x4fb8ff, auraForm: 0xffe85a, brow: 0.12, open: 0.72, scale: 0.98, mouth: "smirk", mark: "bolt", rim: 0x6fd0ff },
  akuma: { id: "akuma", skin: 0xc9c0d6, hair: 0x0b0a10, hairForm: 0x3a0012, hairEmForm: 0xff2050, cloth: 0x2b1550, cloth2: 0x0f0b1a, trim: 0xa23cff, metal: 0x4a4560, pants: 0x161024, boots: 0x0e0a16, eye: 0xc060ff, eyeGlow: 0xb050ff, eyeForm: 0xff3060, aura: 0xa23cff, auraForm: 0xff2a5a, brow: 0.2, open: 0.62, scale: 1.04, mouth: "flat", mark: "violet", rim: 0xb86bff },
  shiro: { id: "shiro", skin: 0xf4e3e8, hair: 0xdff4ff, hairForm: 0xe6dcff, hairEmForm: 0xa890ff, cloth: 0xf2f8ff, cloth2: 0x3a78c8, trim: 0x76e2ff, metal: 0xaee6ff, pants: 0xdfe9f6, boots: 0xb8d4ee, eye: 0x7fe6ff, eyeGlow: 0x8aeaff, eyeForm: 0xd0b8ff, aura: 0x76e2ff, auraForm: 0xb8a6ff, brow: 0.04, open: 0.76, scale: 1.02, mouth: "calm", mark: "diamond", rim: 0xa8f0ff },
};

const faceCache: Record<string, THREE.CanvasTexture> = {};
function faceTexture(st: Style): THREE.CanvasTexture {
  if (faceCache[st.id]) return faceCache[st.id];
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  const hex = (n: number, a = 1) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  // blush + shading
  const bl = (x: number) => {
    const gr = g.createRadialGradient(x, 350, 0, x, 350, 55);
    gr.addColorStop(0, "rgba(255,110,110,0.28)");
    gr.addColorStop(1, "rgba(255,110,110,0)");
    g.fillStyle = gr; g.fillRect(x - 60, 290, 120, 120);
  };
  bl(95); bl(417);
  const eye = (cx: number, flip: number) => {
    g.save();
    g.translate(cx, 292);
    g.scale(flip, 1);
    g.rotate(st.brow * 0.9);
    const rx = 52, ry = 58 * st.open;
    g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); g.clip();
    g.fillStyle = "#f6f4ff"; g.fillRect(-60, -70, 120, 140);
    const ir = g.createLinearGradient(0, -ry, 0, ry);
    ir.addColorStop(0, hex(st.eye, 1)); ir.addColorStop(0.55, hex(st.eye, 1)); ir.addColorStop(1, "#ffffff");
    g.fillStyle = "#1a1020"; g.beginPath(); g.ellipse(2, 2, 38, ry * 0.98, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = ir; g.beginPath(); g.ellipse(2, 4, 34, ry * 0.93, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#0b0612"; g.beginPath(); g.ellipse(2, 2, 14, ry * 0.5, 0, 0, Math.PI * 2); g.fill();
    // lid shadow
    const ls = g.createLinearGradient(0, -ry, 0, -ry + 26);
    ls.addColorStop(0, "rgba(0,0,0,0.55)"); ls.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = ls; g.fillRect(-60, -ry, 120, 30);
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(-14, -ry * 0.35, 11, 13, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(18, ry * 0.4, 6, 7, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    // lashes / lids
    g.save();
    g.translate(cx, 292); g.scale(flip, 1); g.rotate(st.brow * 0.9);
    g.strokeStyle = "#0a0610"; g.lineCap = "round";
    g.lineWidth = 13;
    g.beginPath(); g.ellipse(0, 0, rx + 2, ry + 1, 0, Math.PI * 1.06, Math.PI * 1.96); g.stroke();
    g.lineWidth = 9;
    g.beginPath(); g.moveTo(rx - 6, -ry * 0.55); g.lineTo(rx + 16, -ry * 0.85); g.stroke();
    g.lineWidth = 4;
    g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0.15, Math.PI - 0.15); g.stroke();
    g.restore();
    // brow
    g.save();
    g.translate(cx, 292 - 90 * st.open - 20); g.scale(flip, 1); g.rotate(st.brow * 1.5);
    g.fillStyle = hex(st.id === "shiro" || st.id === "ryujin" ? st.hair : 0x120c18, 0.95);
    g.beginPath(); g.moveTo(-52, 6); g.quadraticCurveTo(0, -12, 56, -4); g.lineTo(54, 6); g.quadraticCurveTo(0, -2, -50, 16); g.closePath(); g.fill();
    g.restore();
  };
  eye(112, 1);
  eye(400, -1);
  // nose
  g.strokeStyle = "rgba(120,60,50,0.55)"; g.lineWidth = 4; g.lineCap = "round";
  g.beginPath(); g.moveTo(256, 345); g.lineTo(250, 366); g.lineTo(262, 368); g.stroke();
  // mouth
  g.strokeStyle = "#5a2030"; g.lineWidth = 6;
  g.beginPath();
  if (st.mouth === "grin") { g.moveTo(215, 410); g.quadraticCurveTo(256, 440, 300, 405); g.stroke(); g.fillStyle = "#fff"; g.beginPath(); g.moveTo(228, 414); g.quadraticCurveTo(256, 432, 288, 412); g.quadraticCurveTo(256, 422, 228, 414); g.fill(); }
  else if (st.mouth === "smirk") { g.moveTo(225, 415); g.quadraticCurveTo(270, 418, 305, 398); g.stroke(); }
  else if (st.mouth === "flat") { g.moveTo(222, 414); g.lineTo(290, 412); g.stroke(); }
  else { g.moveTo(228, 412); g.quadraticCurveTo(256, 420, 286, 412); g.stroke(); }
  // marks
  if (st.mark === "scar") {
    g.strokeStyle = "rgba(150,50,50,0.8)"; g.lineWidth = 7;
    g.beginPath(); g.moveTo(418, 352); g.lineTo(446, 398); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.moveTo(410, 372); g.lineTo(440, 372); g.stroke();
  } else if (st.mark === "bolt") {
    g.fillStyle = hex(st.trim, 0.9);
    g.beginPath(); g.moveTo(430, 340); g.lineTo(408, 372); g.lineTo(424, 372); g.lineTo(404, 408); g.lineTo(442, 366); g.lineTo(426, 366); g.closePath(); g.fill();
  } else if (st.mark === "violet") {
    g.strokeStyle = hex(st.trim, 0.9); g.lineWidth = 6;
    for (const x of [112, 400]) { g.beginPath(); g.moveTo(x - 20, 365); g.lineTo(x - 30, 405); g.moveTo(x + 4, 368); g.lineTo(x - 4, 415); g.stroke(); }
    g.fillStyle = "rgba(60,20,90,0.25)"; g.beginPath(); g.ellipse(112, 340, 56, 22, 0, 0, 7); g.ellipse(400, 340, 56, 22, 0, 0, 7); g.fill();
  } else {
    g.fillStyle = hex(st.trim, 0.95);
    g.beginPath(); g.moveTo(256, 138); g.lineTo(276, 170); g.lineTo(256, 202); g.lineTo(236, 170); g.closePath(); g.fill();
    g.strokeStyle = hex(st.trim, 0.8); g.lineWidth = 4;
    for (const x of [100, 412]) { g.beginPath(); g.moveTo(x - 30, 372); g.lineTo(x + 20, 380); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  faceCache[st.id] = t;
  return t;
}

// ---------------- chains (hair / cloth) ----------------
interface Chain { pivots: THREE.Group[]; base: number; amp: number; freq: number; phase: number; lag: number; side: number }

// ---------------- rig ----------------
export class FighterRig {
  root = new THREE.Group();
  body = new THREE.Group();
  joints = {} as Record<Joint, THREE.Group>;
  cur = new Float32Array(POSE_LEN);
  target = new Float32Array(POSE_LEN);
  scratch = new Float32Array(POSE_LEN);
  rate = 14;
  chains: Chain[] = [];
  hairMats: { m: THREE.MeshToonMaterial; base: THREE.Color; form: THREE.Color; emForm: THREE.Color; emBase: number }[] = [];
  glowParts: { m: THREE.MeshToonMaterial; base: number }[] = [];
  eyeGlow: THREE.Mesh[] = [];
  eyeMat!: THREE.MeshBasicMaterial;
  aura!: THREE.Mesh;
  auraMat!: THREE.ShaderMaterial;
  iceShell = new THREE.Group();
  handL = new THREE.Object3D();
  handR = new THREE.Object3D();
  footL = new THREE.Object3D();
  footR = new THREE.Object3D();
  head!: THREE.Group;
  chestG!: THREE.Group;
  vel = new THREE.Vector3(); // local-space velocity for cloth
  walk = 0;
  walkPhase = 0;
  grounded = true;
  headTurn = 0;
  jitter = 0;
  glow = 0;
  form = 0;
  formTarget = 0;
  hipsY = 0.93;
  time = 0;
  speedScale = 1;
  constructor(public style: Style) {
    this.root.add(this.body);
    this.root.scale.setScalar(style.scale * 0.95);
    this.cur.set(POSES.idle);
    this.target.set(POSES.idle);
  }

  setPose(p: string | Float32Array, rate = 14) {
    this.target.set(typeof p === "string" ? POSES[p] ?? POSES.idle : p);
    this.rate = rate;
  }
  setBlend(a: Float32Array, b: Float32Array, t: number, rate = 30) {
    for (let i = 0; i < POSE_LEN; i++) this.target[i] = a[i] + (b[i] - a[i]) * t;
    this.rate = rate;
  }
  snap() { this.cur.set(this.target); }

  setForm(on: boolean) { this.formTarget = on ? 1 : 0; }
  setGlow(v: number) { this.glow = v; }

  update(dt: number, time: number) {
    this.time = time;
    const k = 1 - Math.exp(-this.rate * dt);
    const cur = this.cur, tg = this.target;
    for (let i = 0; i < POSE_LEN; i++) cur[i] += (tg[i] - cur[i]) * k;
    this.form += (this.formTarget - this.form) * (1 - Math.exp(-4 * dt));
    // procedural overlays
    const br = Math.sin(time * 2.2) * 0.02;
    this.walkPhase += dt * 11 * this.walk * this.speedScale;
    const wp = this.walkPhase, wa = this.walk;
    const add = (j: Joint, ax: number, ay: number, az: number) => {
      const i = JOINTS.indexOf(j) * 3;
      this.joints[j].rotation.set(cur[i] + ax, cur[i + 1] + ay, cur[i + 2] + az);
    };
    const lay = cur[LAY];
    const idle = 1 - Math.min(1, wa) * 0.6;
    add("hips", 0, 0, 0);
    add("spine", br * idle, 0, 0);
    add("chest", br * 0.6 * idle, 0, 0);
    add("head", -br * 0.5, this.headTurn, 0);
    add("lSh", br * 1.6 * idle - Math.sin(wp) * 0.35 * wa, 0, 0);
    add("rSh", -br * 1.6 * idle + Math.sin(wp) * 0.35 * wa, 0, 0);
    add("lEl", 0, 0, 0);
    add("rEl", 0, 0, 0);
    add("lHp", -Math.sin(wp) * 0.7 * wa, 0, 0);
    add("rHp", Math.sin(wp) * 0.7 * wa, 0, 0);
    add("lKn", Math.max(0, Math.cos(wp)) * 0.9 * wa, 0, 0);
    add("rKn", Math.max(0, -Math.cos(wp)) * 0.9 * wa, 0, 0);
    // grounding via forward kinematics of both legs
    const L1 = 0.41, L2 = 0.39;
    const reach = (hp: Joint, kn: Joint) => {
      const h = this.joints[hp].rotation, n = this.joints[kn].rotation;
      const th = -h.x;
      return (L1 * Math.cos(th) + L2 * Math.cos(th - n.x)) * Math.cos(h.z) * Math.cos(h.y * 0.5);
    };
    let targetY: number;
    if (this.grounded && lay < 0.3) targetY = 0.06 + 0.07 + Math.max(reach("lHp", "lKn"), reach("rHp", "rKn"));
    else targetY = 0.93 + cur[HY];
    this.hipsY += (targetY - this.hipsY) * (1 - Math.exp(-(this.grounded ? 30 : 14) * dt));
    this.joints.hips.position.y = this.hipsY;
    this.body.rotation.x = -Math.PI / 2 * lay;
    this.body.position.y = lay * 0.15;
    this.body.position.x = this.jitter ? (Math.random() - 0.5) * this.jitter : 0;
    // cloth & hair
    const vz = this.vel.z, vy = this.vel.y, vx = this.vel.x;
    const lagTot = Math.max(-0.7, Math.min(1.0, vz * 0.07 - vy * 0.025));
    for (const ch of this.chains) {
      const n = ch.pivots.length;
      for (let i = 0; i < n; i++) {
        const kk = (i + 1) / n;
        const p = ch.pivots[i];
        p.rotation.x = ch.base / n + (lagTot * ch.lag) / n * 1.6 + Math.sin(time * ch.freq + ch.phase - i * 0.8) * ch.amp * kk;
        p.rotation.z = Math.sin(time * ch.freq * 0.7 + ch.phase + i) * ch.amp * 0.5 * kk * ch.side - vx * 0.03 * kk;
      }
    }
    // glow / aura / eyes
    const g = this.glow;
    this.auraMat.uniforms.uTime.value = time;
    const ac = new THREE.Color(this.style.aura).lerp(new THREE.Color(this.style.auraForm), this.form);
    (this.auraMat.uniforms.uColor.value as THREE.Color).copy(ac);
    const str = 0.02 + g * 0.75 + this.form * 0.35;
    this.auraMat.uniforms.uStr.value = str;
    this.aura.visible = str > 0.05;
    const sc = 1 + this.form * 0.35 + g * 0.35;
    this.aura.scale.set(sc, 1 + g * 0.3 + this.form * 0.25, sc);
    const eyeC = new THREE.Color(this.style.eyeGlow).lerp(new THREE.Color(this.style.eyeForm), this.form);
    this.eyeMat.color.copy(eyeC);
    const eo = Math.max(g, this.form * 0.9);
    this.eyeMat.opacity = eo;
    for (const e of this.eyeGlow) { e.visible = eo > 0.02; e.scale.setScalar(1 + eo * 0.6); }
    for (const hm of this.hairMats) {
      hm.m.color.copy(hm.base).lerp(hm.form, this.form);
      hm.m.emissive.copy(hm.form);
      hm.m.emissiveIntensity = hm.emBase + (hm.emForm.r > -1 ? 0 : 0) + this.form * 0.9 + g * 0.25;
    }
    for (const gp of this.glowParts) gp.m.emissiveIntensity = gp.base + g * 1.2 + this.form * 0.8;
  }

  dispose() {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        if (!m.userData.outline) {
          m.geometry?.dispose();
          const mat = m.material as THREE.Material;
          if (mat && mat !== OUTLINE) mat.dispose();
        }
      }
    });
  }
}

// ---------------- building ----------------
export function buildRig(id: string): FighterRig {
  const st = STYLES[id];
  const rig = new FighterRig(st);
  const B = rig.body;
  const skinM = toon(st.skin, { rim: st.rim, rimS: 0.3 });
  const clothM = toon(st.cloth, { rim: st.rim });
  const cloth2M = toon(st.cloth2, { rim: st.rim });
  const trimM = toon(st.trim, { emissive: st.trim, ei: 0.5, rim: st.rim });
  const metalM = toon(st.metal, { rim: st.rim, rimS: 0.6 });
  const pantsM = toon(st.pants, { rim: st.rim });
  const bootsM = toon(st.boots, { rim: st.rim });
  const glowPart = (color: number, base = 0.9) => {
    const m = toon(color, { emissive: color, ei: base, rim: 0xffffff, rimS: 0.2 });
    rig.glowParts.push({ m, base });
    return m;
  };
  const hairMat = (color: number, vc = false, emBase = 0.08) => {
    const m = toon(vc ? 0xffffff : color, { emissive: st.hairForm, ei: emBase, vc, rim: st.rim, rimS: 0.5 });
    m.emissive.set(st.hairEmForm);
    rig.hairMats.push({ m, base: new THREE.Color(vc ? 0xffffff : color), form: new THREE.Color(st.hairForm), emForm: new THREE.Color(st.hairEmForm), emBase });
    return m;
  };

  // --- skeleton ---
  const hips = grp(B, [0, 0.93, 0]);
  rig.joints.hips = hips;
  mesh(cyl(0.165, 0.15, 0.16, 14), pantsM, hips, { s: [1, 1, 0.72] });
  const spine = grp(hips, [0, 0.07, 0]);
  rig.joints.spine = spine;
  mesh(cyl(0.155, 0.172, 0.22, 14), clothM, spine, { p: [0, 0.11, 0], s: [1, 1, 0.7] });
  const chest = grp(spine, [0, 0.22, 0]);
  rig.joints.chest = chest;
  rig.chestG = chest;
  const bare = id === "kairo";
  const chestMesh = mesh(cyl(0.215, 0.168, 0.34, 16), bare ? skinM : clothM, chest, { p: [0, 0.15, 0], s: [1, 1, 0.68] });
  chestMesh.name = "chest";
  const neck = grp(chest, [0, 0.33, 0]);
  mesh(cyl(0.05, 0.056, 0.12, 10), skinM, neck, { p: [0, 0.03, 0] });
  const head = grp(neck, [0, 0.1, 0]);
  rig.joints.head = head;
  rig.head = head;
  const skullG = grp(head, [0, 0.17, 0]);
  skullG.scale.set(0.95, 1.05, 1);
  mesh(sph(0.19, 24, 18), skinM, skullG, { ol: true });
  mesh(sph(0.1, 14, 10), skinM, skullG, { p: [0, -0.115, 0.07], s: [0.8, 0.9, 0.85], ol: false });
  for (const sx of [-1, 1]) mesh(cone(0.032, 0.09, 6), skinM, skullG, { p: [sx * 0.185, -0.01, -0.01], r: [0, 0, -sx * 1.25], ol: false });
  // face overlay patch
  const patch = new THREE.SphereGeometry(0.197, 28, 20, Math.PI / 2 - 0.7, 1.4, 0.85, 1.35);
  const faceM = new THREE.MeshBasicMaterial({ map: faceTexture(st), transparent: true, color: 0xe6e6ee, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const face = new THREE.Mesh(patch, faceM);
  skullG.add(face);
  // eye glow
  rig.eyeMat = new THREE.MeshBasicMaterial({ map: glowTex, color: st.eyeGlow, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.12), rig.eyeMat);
    e.position.set(sx * 0.074, -0.005, 0.204);
    e.visible = false;
    skullG.add(e);
    rig.eyeGlow.push(e);
  }

  // arms
  const arm = (side: -1 | 1) => {
    const key = side > 0 ? "l" : "r";
    const sh = grp(chest, [side * 0.255, 0.27, 0]);
    rig.joints[(key + "Sh") as Joint] = sh;
    mesh(sph(0.066), id === "kairo" ? skinM : clothM, sh, {});
    mesh(cyl(0.054, 0.046, 0.27, 10), id === "kairo" || id === "shiro" ? skinM : clothM, sh, { p: [0, -0.135, 0] });
    const el = grp(sh, [0, -0.27, 0]);
    rig.joints[(key + "El") as Joint] = el;
    mesh(sph(0.047), id === "kairo" || id === "shiro" ? skinM : clothM, el, {});
    const forearmM = id === "ryujin" ? cloth2M : id === "kairo" ? skinM : id === "akuma" ? metalM : skinM;
    mesh(cyl(0.047, 0.04, 0.25, 10), forearmM, el, { p: [0, -0.125, 0] });
    const hand = grp(el, [0, -0.26, 0]);
    mesh(sph(0.056, 12, 8), id === "akuma" ? metalM : skinM, hand, { p: [0, -0.02, 0.01], s: [1, 1.05, 1.1] });
    const end = side > 0 ? rig.handL : rig.handR;
    end.position.set(0, -0.04, 0.03);
    hand.add(end);
    // per-character gauntlets
    if (id === "kairo") {
      mesh(cyl(0.056, 0.052, 0.14, 10), cloth2M, el, { p: [0, -0.15, 0] });
      mesh(cyl(0.058, 0.058, 0.03, 10), metalM, el, { p: [0, -0.07, 0] });
      mesh(rbox(0.1, 0.045, 0.08, 0.015), glowPart(0xff5a1f, 0.4), hand, { p: [0, -0.01, 0.03] });
    } else if (id === "ryujin") {
      mesh(cyl(0.052, 0.052, 0.025, 10), cloth2M, el, { p: [0, -0.02, 0] });
      mesh(cyl(0.05, 0.047, 0.1, 10), glowPart(0x4fb8ff, 0.7), el, { p: [0, -0.17, 0] });
      mesh(rbox(0.095, 0.05, 0.085, 0.02), cloth2M, hand, { p: [0, -0.01, 0.01] });
    } else if (id === "akuma") {
      mesh(cyl(0.055, 0.05, 0.14, 8), clothM, el, { p: [0, -0.15, 0] });
      for (let i = 0; i < 3; i++) mesh(cone(0.012, 0.09, 5), metalM, hand, { p: [(i - 1) * 0.03, -0.1, 0.045], r: [0.35, 0, 0] });
      mesh(cone(0.05, 0.16, 6), glowPart(0xa23cff, 0.5), el, { p: [0, -0.04, -0.06], r: [2.6, 0, 0] });
    } else {
      mesh(cyl(0.056, 0.05, 0.15, 8), metalM, el, { p: [0, -0.15, 0] });
      for (let i = 0; i < 3; i++) mesh(cone(0.016, 0.1, 5), glowPart(0x76e2ff, 0.7), el, { p: [(i - 1) * 0.03, -0.09, -0.06], r: [2.9, 0, (i - 1) * 0.3] });
      mesh(rbox(0.095, 0.05, 0.085, 0.02), metalM, hand, { p: [0, -0.01, 0.01] });
    }
    return sh;
  };
  const lSh = arm(1);
  const rSh = arm(-1);

  // legs
  const leg = (side: -1 | 1) => {
    const key = side > 0 ? "l" : "r";
    const hp = grp(hips, [side * 0.1, -0.06, 0]);
    rig.joints[(key + "Hp") as Joint] = hp;
    mesh(cyl(0.09, 0.068, 0.41, 12), pantsM, hp, { p: [0, -0.205, 0] });
    const kn = grp(hp, [0, -0.41, 0]);
    rig.joints[(key + "Kn") as Joint] = kn;
    mesh(sph(0.069), pantsM, kn, {});
    mesh(cyl(0.066, 0.05, 0.39, 10), pantsM, kn, { p: [0, -0.195, 0] });
    mesh(cyl(0.07, 0.062, 0.22, 10), bootsM, kn, { p: [0, -0.28, 0] });
    mesh(cyl(0.075, 0.07, 0.03, 10), id === "kairo" ? cloth2M : trimM, kn, { p: [0, -0.17, 0] });
    const an = grp(kn, [0, -0.39, 0]);
    mesh(rbox(0.12, 0.08, 0.28, 0.03), bootsM, an, { p: [0, -0.03, 0.05] });
    mesh(rbox(0.125, 0.025, 0.29, 0.01), metalM, an, { p: [0, -0.065, 0.05], ol: false });
    if (id === "akuma") for (let i = 0; i < 2; i++) mesh(cone(0.015, 0.08, 5), metalM, kn, { p: [(i - 0.5) * 0.06, -0.2, 0.07], r: [1.5, 0, 0] });
    if (id === "shiro") mesh(cone(0.03, 0.14, 5), glowPart(0x76e2ff, 0.6), kn, { p: [0, -0.1, 0.075], r: [-0.4, 0, 0] });
    const end = side > 0 ? rig.footL : rig.footR;
    end.position.set(0, -0.03, 0.12);
    an.add(end);
  };
  leg(1);
  leg(-1);

  // chain helper (needs rig)
  const chain = (parent: THREE.Object3D, pos: V3, n: number, segLen: number, w0: number, w1: number, mat: THREE.Material, o: { base?: number; amp?: number; freq?: number; phase?: number; lag?: number; strand?: boolean; side?: number; thick?: number; rotY?: number } = {}) => {
    const root = grp(parent, pos, [0, o.rotY ?? 0, 0]);
    const ch: Chain = { pivots: [], base: o.base ?? 0.2, amp: o.amp ?? 0.12, freq: o.freq ?? 2.4, phase: o.phase ?? 0, lag: o.lag ?? 1, side: o.side ?? 1 };
    let par: THREE.Object3D = root;
    for (let i = 0; i < n; i++) {
      const piv = grp(par, [0, i === 0 ? 0 : -segLen, 0]);
      const wa = w0 + (w1 - w0) * (i / n), wb = w0 + (w1 - w0) * ((i + 1) / n);
      if (o.strand) mesh(cyl(wa, Math.max(0.004, wb), segLen * 1.05, 6), mat, piv, { p: [0, -segLen / 2, 0] });
      else mesh(new THREE.BoxGeometry((wa + wb) / 1, segLen * 1.03, o.thick ?? 0.025), mat, piv, { p: [0, -segLen / 2, 0] });
      ch.pivots.push(piv);
      par = piv;
    }
    rig.chains.push(ch);
    return root;
  };

  // hair helpers
  const hairG = grp(head, [0, 0.17, 0]);
  hairG.scale.set(0.95, 1.05, 1);
  const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const cap = (mat: THREE.Material, tilt = -0.25, R = 0.203, len = 1.95) => {
    const g = new THREE.SphereGeometry(R, 24, 16, 0, Math.PI * 2, 0, len);
    return mesh(g, mat, hairG, { r: [tilt, 0, 0] });
  };
  const tuft = (mat: THREE.Material, th: number, ph: number, len: number, rad: number, bend: V3, amt: number, tip?: number, tipBase?: number) => {
    const d = new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
    const bd = new THREE.Vector3(...bend).normalize();
    const dir = d.clone().multiplyScalar(1 - amt).addScaledVector(bd, amt).normalize();
    const geo = cone(rad, len, 6);
    geo.translate(0, len / 2, 0);
    if (tip !== undefined) {
      const pos = geo.attributes.position;
      const cols = new Float32Array(pos.count * 3);
      const c0 = new THREE.Color(tipBase ?? 0x111111), c1 = new THREE.Color(tip);
      for (let i = 0; i < pos.count; i++) {
        const t = Math.max(0, Math.min(1, (pos.getY(i) / len - 0.35) / 0.65));
        const c = c0.clone().lerp(c1, t);
        cols.set([c.r, c.g, c.b], i * 3);
      }
      geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    }
    const m = mesh(geo, mat, hairG, { p: [d.x * 0.185, d.y * 0.185, d.z * 0.185] });
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return m;
  };

  // --- per-character design ---
  if (id === "kairo") {
    const hm = hairMat(st.hair, true, 0.1);
    const hm2 = hairMat(st.hair, false, 0.05);
    cap(hm2, -0.3);
    const back: V3 = [0, 0.35, -1];
    for (let i = 0; i < 18; i++) {
      const ph = (i / 18) * Math.PI * 2 + 0.3;
      const th = 0.45 + rnd(i) * 0.5;
      tuft(hm, th, ph, 0.26 + rnd(i + 5) * 0.14, 0.07, back, 0.45, 0xff4a1c, 0x16121a);
    }
    for (let i = 0; i < 6; i++) tuft(hm, 0.2 + rnd(i + 9) * 0.3, i * 1.1, 0.34 + rnd(i) * 0.1, 0.075, [0, 1, -0.5], 0.4, 0xff7a2a, 0x16121a);
    for (let i = 0; i < 5; i++) tuft(hm, 0.95 + rnd(i + 3) * 0.2, Math.PI / 2 + (i - 2) * 0.32, 0.22 + rnd(i) * 0.08, 0.055, [0, -0.7, 0.5], 0.62, 0xff4a1c, 0x16121a);
    // headband
    const hb = new THREE.TorusGeometry(0.2, 0.022, 8, 28);
    mesh(hb, cloth2M, hairG, { p: [0, -0.04, 0], r: [Math.PI / 2 - 0.12, 0, 0], ol: false });
    mesh(rbox(0.09, 0.05, 0.02, 0.01), metalM, hairG, { p: [0, -0.02, 0.2], r: [-0.1, 0, 0] });
    chain(head, [0, 0.12, -0.19], 3, 0.12, 0.035, 0.05, cloth2M, { base: 0.5, amp: 0.2, freq: 3.2, lag: 1.4 });
    chain(head, [0.03, 0.11, -0.19], 3, 0.1, 0.03, 0.04, cloth2M, { base: 0.7, amp: 0.25, freq: 3.6, phase: 1.5, lag: 1.4 });
    // vest
    for (const sx of [-1, 1]) {
      mesh(rbox(0.14, 0.37, 0.07, 0.025), clothM, chest, { p: [sx * 0.13, 0.15, 0.115], r: [0, sx * 0.18, 0] });
      mesh(rbox(0.02, 0.37, 0.075, 0.008), cloth2M, chest, { p: [sx * 0.065, 0.15, 0.13], r: [0, sx * 0.18, 0], ol: false });
      mesh(rbox(0.18, 0.1, 0.1, 0.03), clothM, chest, { p: [sx * 0.2, 0.3, -0.02] }); // shoulder cloth
    }
    mesh(rbox(0.3, 0.3, 0.06, 0.02), clothM, chest, { p: [0, 0.14, -0.13] });
    mesh(new THREE.OctahedronGeometry(0.05), glowPart(0xff4a1c, 0.9), chest, { p: [0, 0.15, -0.17], s: [1, 1.5, 0.4], ol: false });
    // sash
    mesh(new THREE.TorusGeometry(0.168, 0.04, 8, 24), cloth2M, spine, { p: [0, 0.02, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.72, 1] });
    mesh(rbox(0.07, 0.06, 0.03, 0.01), metalM, spine, { p: [0, 0.02, 0.13] });
    chain(hips, [0.12, 0.0, -0.1], 3, 0.14, 0.04, 0.05, cloth2M, { base: 0.1, amp: 0.18, freq: 2.8, phase: 0.5, lag: 1.2 });
    chain(hips, [-0.1, 0.0, -0.1], 3, 0.12, 0.04, 0.05, clothM, { base: 0.12, amp: 0.18, freq: 2.6, phase: 2, lag: 1.2 });
  } else if (id === "ryujin") {
    const hm = hairMat(st.hair, false, 0.12);
    cap(hm, -0.35);
    const back: V3 = [0, 0.1, -1];
    for (let i = 0; i < 14; i++) {
      const ph = (i / 14) * Math.PI * 2 + 0.2;
      tuft(hm, 0.55 + rnd(i) * 0.5, ph, 0.28 + rnd(i + 5) * 0.16, 0.065, back, 0.55);
    }
    for (let i = 0; i < 4; i++) tuft(hm, 0.2 + i * 0.12, i * 1.7, 0.36, 0.07, [0, 1, -0.6], 0.35);
    // long side bangs framing face
    for (const sx of [-1, 1]) {
      tuft(hm, 1.0, Math.PI / 2 + sx * 0.55, 0.33, 0.055, [0, -1, 0.15], 0.8);
      tuft(hm, 0.95, Math.PI / 2 + sx * 0.25, 0.27, 0.05, [sx * 0.3, -1, 0.4], 0.75);
    }
    chain(head, [0, 0.12, -0.17], 5, 0.11, 0.07, 0.01, hm, { base: 0.5, amp: 0.2, freq: 2.8, strand: true, lag: 1.5 });
    chain(head, [0.06, 0.08, -0.16], 4, 0.1, 0.05, 0.01, hm, { base: 0.4, amp: 0.25, freq: 3.1, phase: 1, strand: true, lag: 1.5 });
    for (const sx of [-1, 1]) mesh(cone(0.012, 0.07, 4), glowPart(0x4fb8ff, 0.8), skullG, { p: [sx * 0.2, -0.06, 0.02], r: [3.14, 0, 0] });
    // coat
    for (const sx of [-1, 1]) {
      mesh(rbox(0.07, 0.34, 0.08, 0.02), cloth2M, chest, { p: [sx * 0.085, 0.16, 0.115], r: [0, sx * 0.3, 0] });
    }
    mesh(rbox(0.3, 0.3, 0.06, 0.02), clothM, chest, { p: [0, 0.14, -0.13] });
    mesh(cyl(0.085, 0.105, 0.09, 12), cloth2M, chest, { p: [0, 0.36, 0], s: [1, 1, 0.85] });
    mesh(new THREE.TorusGeometry(0.168, 0.035, 8, 24), cloth2M, spine, { p: [0, 0.03, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.72, 1] });
    mesh(new THREE.OctahedronGeometry(0.04), glowPart(0xffd84a, 0.9), spine, { p: [0, 0.03, 0.135], s: [1, 1.6, 0.5], ol: false });
    for (const [sx, ph] of [[-1, 0], [1, 1.4]] as const) {
      chain(hips, [sx * 0.09, 0.02, -0.12], 4, 0.14, 0.09, 0.075, clothM, { base: 0.12, amp: 0.2, freq: 2.5, phase: ph, lag: 1.6, thick: 0.03 });
      chain(hips, [sx * 0.09, 0.0, -0.133], 4, 0.14, 0.012, 0.012, cloth2M, { base: 0.12, amp: 0.2, freq: 2.5, phase: ph, lag: 1.6, thick: 0.03 });
    }
    // sheathed katana
    const kat = grp(hips, [0.18, 0.0, -0.06], [0.3, 0, 1.3]);
    mesh(cyl(0.017, 0.017, 0.6, 8), toon(0x111118), kat, { p: [0, -0.25, 0] });
    mesh(cyl(0.02, 0.02, 0.16, 8), cloth2M, kat, { p: [0, 0.13, 0] });
    mesh(cyl(0.035, 0.035, 0.012, 10), metalM, kat, { p: [0, 0.04, 0] });
  } else if (id === "akuma") {
    const hm = hairMat(st.hair, false, 0.1);
    cap(hm, -0.2);
    const back: V3 = [0, -0.1, -1];
    for (let i = 0; i < 16; i++) {
      const ph = (i / 16) * Math.PI * 2 + 0.4;
      tuft(hm, 0.55 + rnd(i) * 0.55, ph, 0.3 + rnd(i + 5) * 0.2, 0.075, back, 0.5);
    }
    for (let i = 0; i < 5; i++) tuft(hm, 0.15 + rnd(i) * 0.4, i * 1.3 + 0.5, 0.3 + rnd(i) * 0.12, 0.08, [0.3, 1, -0.3], 0.3);
    tuft(hm, 0.95, Math.PI / 2 + 0.35, 0.4, 0.075, [0.2, -1, 0.2], 0.85); // bang over eye
    tuft(hm, 0.9, Math.PI / 2 + 0.05, 0.34, 0.07, [0, -1, 0.3], 0.8);
    tuft(hm, 0.95, Math.PI / 2 - 0.4, 0.28, 0.06, [-0.2, -1, 0.3], 0.75);
    for (const sx of [-1, 1]) chain(head, [sx * 0.17, 0.1, 0.0], 4, 0.1, 0.05, 0.01, hm, { base: 0.1, amp: 0.2, freq: 2.2, phase: sx, strand: true, lag: 1.0 });
    chain(head, [0, 0.1, -0.17], 5, 0.12, 0.08, 0.01, hm, { base: 0.5, amp: 0.2, freq: 2.6, strand: true, lag: 1.4 });
    // armour
    mesh(rbox(0.28, 0.2, 0.08, 0.03), metalM, chest, { p: [0, 0.2, 0.115] });
    mesh(rbox(0.05, 0.3, 0.02, 0.01), glowPart(0xa23cff, 0.8), chest, { p: [0, 0.15, 0.162], ol: false });
    for (const sx of [-1, 1]) mesh(rbox(0.012, 0.14, 0.02, 0.005), glowPart(0xa23cff, 0.8), chest, { p: [sx * 0.1, 0.12, 0.158], r: [0, 0, sx * 0.4], ol: false });
    mesh(rbox(0.3, 0.3, 0.06, 0.02), cloth2M, chest, { p: [0, 0.14, -0.13] });
    // pauldrons
    const bigP = grp(lSh, [0.04, 0.05, 0]);
    mesh(sph(0.12, 12, 8), metalM, bigP, { s: [1, 0.7, 1.1] });
    for (let i = 0; i < 4; i++) mesh(cone(0.03, 0.2 + i * 0.03, 6), metalM, bigP, { p: [0.04 + i * 0.015, 0.06, (i - 1.5) * 0.06], r: [0, 0, -1.0 + i * 0.1] });
    const smallP = grp(rSh, [-0.04, 0.05, 0]);
    mesh(sph(0.09, 12, 8), metalM, smallP, { s: [1, 0.7, 1.1] });
    for (let i = 0; i < 2; i++) mesh(cone(0.025, 0.15, 6), metalM, smallP, { p: [-0.03, 0.05, (i - 0.5) * 0.07], r: [0, 0, 0.9] });
    // chain belt
    mesh(new THREE.TorusGeometry(0.17, 0.018, 6, 24), metalM, spine, { p: [0, 0.02, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.72, 1] });
    mesh(new THREE.TorusGeometry(0.17, 0.018, 6, 24), metalM, spine, { p: [0, 0.08, 0], r: [Math.PI / 2 + 0.2, 0.1, 0], s: [1, 0.72, 1] });
    mesh(new THREE.OctahedronGeometry(0.05), glowPart(0xff55e0, 0.9), spine, { p: [0, 0.04, 0.14], s: [1, 1.4, 0.6], ol: false });
    // tattered cape
    for (const sx of [-1, 1]) chain(chest, [sx * 0.11, 0.3, -0.16], 4, 0.19, 0.11, 0.09, cloth2M, { base: 0.18, amp: 0.2, freq: 2.2, phase: sx * 1.3, lag: 1.8, thick: 0.03 });
    // scarf
    mesh(new THREE.TorusGeometry(0.1, 0.04, 8, 16), clothM, chest, { p: [0, 0.36, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.85, 1] });
    chain(chest, [0.07, 0.34, -0.1], 5, 0.13, 0.05, 0.045, toon(0x6a2cc0, { rim: st.rim }), { base: 0.3, amp: 0.28, freq: 3.0, lag: 1.9 });
  } else {
    const hm = hairMat(st.hair, false, 0.15);
    cap(hm, -0.3);
    const back: V3 = [0, 0.05, -1];
    for (let i = 0; i < 14; i++) {
      const ph = (i / 14) * Math.PI * 2 + 0.3;
      tuft(hm, 0.5 + rnd(i) * 0.5, ph, 0.22 + rnd(i + 5) * 0.12, 0.06, back, 0.45);
    }
    for (let i = 0; i < 4; i++) tuft(hm, 0.9 + rnd(i) * 0.1, Math.PI / 2 + (i - 1.5) * 0.4, 0.26, 0.05, [0, -1, 0.35], 0.75);
    for (const sx of [-1, 1]) chain(head, [sx * 0.17, 0.12, -0.02], 5, 0.12, 0.06, 0.01, hm, { base: 0.08, amp: 0.15, freq: 2.0, phase: sx, strand: true, lag: 1.0 });
    for (let i = 0; i < 3; i++) chain(head, [(i - 1) * 0.07, 0.13, -0.17], 6, 0.13, 0.075, 0.008, hm, { base: 0.35 + i * 0.05, amp: 0.18, freq: 2.2 + i * 0.3, phase: i * 1.1, strand: true, lag: 1.5 });
    // crown
    mesh(new THREE.TorusGeometry(0.2, 0.014, 6, 28), metalM, hairG, { p: [0, 0.01, 0], r: [Math.PI / 2 - 0.15, 0, 0], ol: false });
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.42;
      mesh(cone(0.022, 0.1 + (i === 2 ? 0.08 : 0), 5), glowPart(0x76e2ff, 0.8), hairG, { p: [Math.sin(a) * 0.2, 0.04, Math.cos(a) * 0.2], r: [0.2, 0, -a * 0.4] });
    }
    // armour
    mesh(rbox(0.3, 0.26, 0.09, 0.04), metalM, chest, { p: [0, 0.2, 0.1], s: [1, 1, 1] });
    mesh(new THREE.OctahedronGeometry(0.045), glowPart(0x76e2ff, 0.9), chest, { p: [0, 0.22, 0.16], s: [1, 1.5, 0.6], ol: false });
    mesh(rbox(0.3, 0.3, 0.07, 0.02), cloth2M, chest, { p: [0, 0.14, -0.13] });
    for (const sx of [-1, 1]) {
      const pa = grp(sx > 0 ? lSh : rSh, [sx * 0.03, 0.05, 0]);
      mesh(sph(0.1, 12, 8), metalM, pa, { s: [1, 0.65, 1.1] });
      mesh(cone(0.035, 0.22, 5), glowPart(0x76e2ff, 0.7), pa, { p: [sx * 0.05, 0.1, 0], r: [0, 0, -sx * 0.5] });
      mesh(cone(0.025, 0.15, 5), glowPart(0x76e2ff, 0.7), pa, { p: [sx * 0.09, 0.07, 0.04], r: [0.3, 0, -sx * 1.0] });
    }
    mesh(new THREE.TorusGeometry(0.17, 0.035, 8, 24), cloth2M, spine, { p: [0, 0.02, 0], r: [Math.PI / 2, 0, 0], s: [1, 0.72, 1] });
    for (const sx of [-1, 1]) chain(hips, [sx * 0.08, 0.0, 0.12], 3, 0.14, 0.08, 0.06, cloth2M, { base: -0.2, amp: 0.12, freq: 2.0, phase: sx, lag: 1.0, thick: 0.03 });
    // cape
    chain(chest, [0, 0.31, -0.17], 5, 0.17, 0.2, 0.16, cloth2M, { base: 0.15, amp: 0.16, freq: 1.9, lag: 2.0, thick: 0.03 });
    chain(chest, [0, 0.31, -0.19], 5, 0.17, 0.12, 0.1, toon(0xffffff, { rim: st.rim }), { base: 0.15, amp: 0.16, freq: 1.9, lag: 2.0, thick: 0.03 });
    // sword on back
    const sw = grp(chest, [0.0, 0.2, -0.2], [0, 0, 0.7]);
    mesh(cyl(0.015, 0.015, 0.75, 6), glowPart(0x76e2ff, 0.5), sw, { p: [0, 0.2, 0] });
    mesh(cyl(0.02, 0.02, 0.15, 6), metalM, sw, { p: [0, -0.22, 0] });
    mesh(rbox(0.12, 0.02, 0.03, 0.01), metalM, sw, { p: [0, -0.14, 0] });
  }

  // aura
  rig.auraMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(st.aura) }, uStr: { value: 0.2 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uStr; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h(i), h(i+vec2(1.0,0.0)), f.x), mix(h(i+vec2(0.0,1.0)), h(i+vec2(1.0,1.0)), f.x), f.y); }
      void main(){ float y = vUv.y;
        float fl = n(vec2(vUv.x * 10.0, y * 3.0 - uTime * 2.6)) * 0.65 + n(vec2(vUv.x * 20.0, y * 6.0 - uTime * 4.5)) * 0.35;
        float fade = pow(1.0 - y, 1.3) * smoothstep(0.0, 0.06, y);
        float a = fade * fl * uStr * 1.8;
        gl_FragColor = vec4(uColor * (0.7 + fl), a); }`,
  });
  rig.aura = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.75, 2.5, 20, 1, true), rig.auraMat);
  rig.aura.position.y = 1.15;
  rig.aura.renderOrder = 5;
  rig.root.add(rig.aura);

  // ice shell
  const iceM = new THREE.MeshStandardMaterial({ color: 0xbdefff, emissive: 0x4ab8ff, emissiveIntensity: 0.6, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.2 });
  const shellBody = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 1), iceM);
  shellBody.scale.set(0.75, 1.25, 0.75);
  shellBody.position.y = 0.95;
  rig.iceShell.add(shellBody);
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Mesh(cone(0.12, 0.7, 5), iceM);
    const a = (i / 9) * Math.PI * 2;
    c.position.set(Math.cos(a) * 0.5, 0.2 + (i % 3) * 0.1, Math.sin(a) * 0.5);
    c.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
    rig.iceShell.add(c);
  }
  rig.iceShell.visible = false;
  rig.root.add(rig.iceShell);

  // snap pose & initial transforms
  rig.update(0.016, 0);
  rig.snap();
  rig.hipsY = 0.93;
  rig.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.frustumCulled = true; });
  return rig;
}
