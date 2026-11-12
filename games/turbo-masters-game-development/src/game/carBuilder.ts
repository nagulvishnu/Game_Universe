import * as THREE from "three";
import { CarDef, Custom } from "./data";
import { glowTexture, makeCanvas } from "./util";

type P = number[][];
interface Spec {
  L: number; W: number; wb: number; wr: number; wrr?: number; ww: number;
  prof: P; cab: P; roof: [number, number, number] | null; cabW: number;
  spoiler: "none" | "lip" | "duck" | "gt" | "wing" | "triple" | "f1";
  head: "slit" | "round" | "led" | "pop" | "twin" | "none";
  tail: "bar" | "round" | "split" | "strip";
  exh: 1 | 2 | 4; exhR?: number;
  ex: string[];
  open?: boolean;
}

const SPECS: Record<string, Spec> = {
  kitsune: { L: 4.4, W: 1.95, wb: 2.7, wr: 0.34, ww: 0.3, cabW: 0.86, spoiler: "lip", head: "slit", tail: "bar", exh: 2, ex: ["splitter", "diffuser", "scoops"],
    prof: [[-2.15, .32], [-2.2, .62], [-2.0, .9], [-1.1, 1.0], [-.3, .95], [.7, .82], [1.5, .64], [2.15, .5], [2.22, .38], [2.0, .3]],
    cab: [[-1.3, .95], [-.8, 1.34], [.1, 1.34], [1.0, .86]], roof: [-.75, .05, 1.35] },
  aurora: { L: 4.6, W: 1.95, wb: 2.85, wr: 0.35, ww: 0.3, cabW: 0.86, spoiler: "duck", head: "led", tail: "split", exh: 2, ex: ["splitter", "vents"],
    prof: [[-2.2, .34], [-2.25, .7], [-2.0, .95], [-1.0, .98], [0, .95], [1.0, .9], [1.9, .72], [2.3, .5], [2.3, .36], [2.0, .3]],
    cab: [[-1.25, .95], [-.8, 1.38], [0, 1.4], [.8, .92]], roof: [-.7, -.05, 1.4] },
  phantom: { L: 4.55, W: 2.1, wb: 2.75, wr: 0.34, wrr: 0.36, ww: 0.34, cabW: 0.78, spoiler: "wing", head: "slit", tail: "strip", exh: 4, ex: ["splitter", "diffuser", "canards", "fins"],
    prof: [[-2.2, .3], [-2.25, .5], [-1.9, .78], [-.9, .86], [.2, .8], [1.2, .6], [2.1, .42], [2.25, .32]],
    cab: [[-1.0, .8], [-.5, 1.12], [.3, 1.1], [1.0, .64]], roof: [-.45, .25, 1.12] },
  raijin: { L: 4.6, W: 2.05, wb: 2.8, wr: 0.34, wrr: 0.36, ww: 0.32, cabW: 0.8, spoiler: "triple", head: "slit", tail: "split", exh: 4, ex: ["splitter", "canards", "fins", "diffuser"],
    prof: [[-2.3, .3], [-2.3, .7], [-1.6, .92], [-.6, .9], [.6, .78], [1.6, .5], [2.3, .34]],
    cab: [[-1.1, .9], [-.4, 1.2], [.5, 1.15], [1.1, .76]], roof: [-.35, .4, 1.2] },
  hachi: { L: 4.1, W: 1.78, wb: 2.45, wr: 0.32, ww: 0.26, cabW: 0.9, spoiler: "duck", head: "pop", tail: "split", exh: 1, ex: ["flares", "lipkit"],
    prof: [[-2.0, .34], [-2.05, .7], [-1.9, .88], [-.9, .9], [.8, .88], [1.5, .78], [2.0, .6], [2.05, .4], [1.8, .32]],
    cab: [[-1.3, .88], [-1.0, 1.38], [.3, 1.4], [1.1, .85]], roof: [-.95, .2, 1.4] },
  sakura: { L: 4.3, W: 1.85, wb: 2.6, wr: 0.33, ww: 0.3, cabW: 0.88, spoiler: "gt", head: "round", tail: "round", exh: 2, ex: ["flares", "vents", "splitter"],
    prof: [[-2.1, .32], [-2.15, .72], [-1.9, .92], [-1.0, .96], [0, .9], [1, .82], [1.8, .62], [2.15, .44], [2.1, .32]],
    cab: [[-1.2, .92], [-.7, 1.34], [.2, 1.34], [1.0, .86]], roof: [-.65, .1, 1.35] },
  brute: { L: 4.9, W: 2.05, wb: 2.9, wr: 0.36, wrr: 0.4, ww: 0.34, cabW: 0.86, spoiler: "lip", head: "twin", tail: "bar", exh: 2, exhR: 0.1, ex: ["scoop", "flares", "bumper"],
    prof: [[-2.4, .36], [-2.45, .82], [-2.3, 1.0], [-1.0, 1.02], [.4, 1.0], [1.4, 1.0], [2.35, .92], [2.5, .7], [2.45, .4], [2.2, .32]],
    cab: [[-1.5, 1.0], [-1.0, 1.5], [0, 1.52], [.6, 1.0]], roof: [-.95, -.05, 1.52] },
  charger: { L: 4.85, W: 2.0, wb: 2.9, wr: 0.36, wrr: 0.39, ww: 0.33, cabW: 0.86, spoiler: "duck", head: "twin", tail: "split", exh: 2, exhR: 0.09, ex: ["hoodvents", "flares", "bumper"],
    prof: [[-2.4, .36], [-2.45, .8], [-2.25, .98], [-1.0, 1.0], [.4, .98], [1.4, .98], [2.35, .88], [2.45, .66], [2.4, .4], [2.2, .32]],
    cab: [[-1.75, .98], [-.95, 1.5], [.3, 1.5], [.9, .98]], roof: [-.9, .25, 1.5] },
  nova: { L: 4.6, W: 2.0, wb: 2.8, wr: 0.34, ww: 0.3, cabW: 0.8, spoiler: "none", head: "led", tail: "strip", exh: 1, ex: ["lightstrip", "wheelcover", "splitter"],
    prof: [[-2.3, .32], [-2.3, .6], [-1.5, .85], [-.2, .9], [1.2, .7], [2.2, .46], [2.3, .34]],
    cab: [[-1.1, .85], [-.5, 1.28], [.4, 1.26], [1.3, .72]], roof: [-.5, .3, 1.28] },
  zephyr: { L: 4.6, W: 2.0, wb: 2.8, wr: 0.34, ww: 0.3, cabW: 0.78, spoiler: "f1", head: "slit", tail: "strip", exh: 1, ex: ["lightstrip", "fins", "jet", "splitter"],
    prof: [[-2.2, .32], [-2.2, .9], [-1.2, 1.0], [.4, .82], [1.6, .5], [2.3, .36]],
    cab: [[-1.4, .98], [-.9, 1.36], [-.1, 1.3], [.9, .76]], roof: [-.85, -.15, 1.36] },
  kestrel: { L: 4.5, W: 1.95, wb: 2.85, wr: 0.34, ww: 0.32, cabW: 0.72, spoiler: "wing", head: "slit", tail: "strip", exh: 2, ex: ["splitter", "sidepods", "tailfin", "wheelspats"],
    prof: [[-2.2, .3], [-2.2, .72], [-1.5, .8], [-.5, .78], [.4, .68], [1.4, .5], [2.1, .36]],
    cab: [[-.9, .75], [-.45, 1.1], [.3, 1.08], [.8, .68]], roof: [-.4, .2, 1.1] },
  wasp: { L: 4.6, W: 0.95, wb: 3.0, wr: 0.36, ww: 0.42, cabW: 0.6, spoiler: "none", head: "none", tail: "strip", exh: 1, ex: ["openwheel"], open: true,
    prof: [[-1.7, .3], [-1.75, .6], [-1.1, .8], [-.4, .78], [.5, .62], [1.5, .42], [2.4, .34], [2.4, .3]],
    cab: [], roof: null },
};

function extrude(pts: P, w: number, bevel = 0.06): THREE.BufferGeometry {
  const s = new THREE.Shape();
  pts.forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)));
  s.closePath();
  const depth = Math.max(0.001, w - bevel * 2);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 1 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2);
  return g;
}
function topY(prof: P, z: number) {
  let best = 0;
  for (let i = 0; i < prof.length; i++) {
    const a = prof[i], b = prof[(i + 1) % prof.length];
    if ((a[0] <= z && b[0] >= z) || (b[0] <= z && a[0] >= z)) {
      const t = a[0] === b[0] ? 0 : (z - a[0]) / (b[0] - a[0]);
      best = Math.max(best, a[1] + (b[1] - a[1]) * t);
    }
  }
  return best;
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  return o;
}

export interface WheelRig { root: THREE.Group; steer: THREE.Group; spin: THREE.Group; r: number; front: boolean; side: number; baseY: number; z: number; x: number }
export interface CarModel {
  group: THREE.Group;
  wheels: WheelRig[];
  flames: THREE.Group[];
  tailMat: THREE.MeshStandardMaterial;
  tailGlow: THREE.Sprite[];
  headMats: THREE.MeshStandardMaterial[];
  beams: THREE.Mesh;
  underglow: THREE.Mesh;
  paintMats: THREE.MeshPhysicalMaterial[];
  exhaustLocal: THREE.Vector3[];
  rearZ: number;
  dims: { L: number; W: number; wb: number; wr: number };
  body: THREE.Group; // everything except wheels (for roll/pitch)
  setDamage(d: number): void;
  rimMats: THREE.MeshStandardMaterial[];
}

const tireMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
tireMat.userData.shared = true;
const steelMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.4, metalness: 0.9 });
steelMat.userData.shared = true;
const carbonMat = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.45, metalness: 0.5 });
carbonMat.userData.shared = true;
const blackMat = new THREE.MeshBasicMaterial({ color: 0x050507, side: THREE.BackSide });
blackMat.userData.shared = true;

function buildRim(design: number, rr: number, w: number, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const darkM = carbonMat;
  const barrel = mesh(new THREE.CylinderGeometry(rr, rr, w * 0.85, 20, 1, true).rotateZ(Math.PI / 2), darkM);
  (barrel.material as any) = new THREE.MeshStandardMaterial({ color: 0x222428, roughness: 0.5, metalness: 0.8, side: THREE.DoubleSide });
  g.add(barrel);
  const xf = w * 0.32;
  const lip = mesh(new THREE.TorusGeometry(rr * 0.97, rr * 0.05, 6, 24).rotateY(Math.PI / 2), mat, xf + 0.02);
  g.add(lip);
  const spokes = (n: number, wd: number, th: number, twist = 0, alt = false) => {
    for (let i = 0; i < n; i++) {
      const holder = new THREE.Group();
      holder.rotation.x = (i / n) * Math.PI * 2;
      const geo = box(th, rr * 0.92, wd);
      geo.translate(0, rr * 0.46, 0);
      const m = mesh(geo, mat, xf + (alt && i % 2 ? -0.025 : 0));
      m.rotation.y = twist;
      holder.add(m);
      g.add(holder);
    }
  };
  switch (design) {
    case 0: spokes(5, rr * 0.2, 0.05); break;
    case 1: spokes(14, rr * 0.07, 0.04); g.add(mesh(new THREE.TorusGeometry(rr * 0.55, rr * 0.04, 5, 20).rotateY(Math.PI / 2), mat, xf)); break;
    case 2: spokes(9, rr * 0.15, 0.04, 0.55); break;
    case 3: {
      const disc = mesh(new THREE.CylinderGeometry(rr * 0.95, rr * 0.9, 0.05, 24).rotateZ(Math.PI / 2), mat, xf);
      g.add(disc);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g.add(mesh(new THREE.SphereGeometry(rr * 0.06, 6, 6), steelMat, xf + 0.04, Math.sin(a) * rr * 0.3, Math.cos(a) * rr * 0.3));
      }
      break;
    }
    case 4: spokes(10, rr * 0.09, 0.04, 0, true); spokes(10, rr * 0.06, 0.03, 0.3); break;
    default: spokes(6, rr * 0.28, 0.07); g.add(mesh(new THREE.CylinderGeometry(rr * 0.25, rr * 0.25, 0.08, 6).rotateZ(Math.PI / 2), mat, xf + 0.03)); break;
  }
  g.add(mesh(new THREE.CylinderGeometry(rr * 0.16, rr * 0.16, 0.07, 12).rotateZ(Math.PI / 2), mat, xf + 0.03));
  return g;
}

function buildWheel(r: number, w: number, design: number, rimMat: THREE.Material, caliperMat: THREE.Material, side: number, front: boolean, x: number, z: number): WheelRig {
  const root = new THREE.Group();
  root.position.set(x, r, z);
  const steer = new THREE.Group();
  const mir = new THREE.Group();
  mir.scale.x = -side; // side=+1 -> wheel on x<0 side, mirrored so the rim faces outward
  const spin = new THREE.Group();
  const pts = [
    new THREE.Vector2(r * 0.6, -w / 2), new THREE.Vector2(r * 0.9, -w / 2), new THREE.Vector2(r * 0.98, -w * 0.38), new THREE.Vector2(r, -w * 0.2),
    new THREE.Vector2(r, w * 0.2), new THREE.Vector2(r * 0.98, w * 0.38), new THREE.Vector2(r * 0.9, w / 2), new THREE.Vector2(r * 0.6, w / 2),
  ];
  spin.add(mesh(new THREE.LatheGeometry(pts, 24).rotateZ(Math.PI / 2), tireMat));
  spin.add(buildRim(design, r * 0.64, w, rimMat));
  spin.add(mesh(new THREE.CylinderGeometry(r * 0.52, r * 0.52, 0.03, 20).rotateZ(Math.PI / 2), steelMat, w * 0.06));
  const cal = mesh(box(0.07, r * 0.5, r * 0.5), caliperMat, w * 0.14, r * 0.28, -r * 0.1);
  mir.add(spin, cal);
  steer.add(mir);
  root.add(steer);
  return { root, steer, spin, r, front, side, baseY: r, z, x };
}

function plateTex(text: string) {
  return makeCanvas(256, 64, (g, w, h) => {
    g.fillStyle = "#f2f2ea";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#1a2a6a";
    g.lineWidth = 4;
    g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = "#111";
    g.font = "bold 40px monospace";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text.slice(0, 8), w / 2, h / 2 + 2);
  });
}

export function buildCar(def: CarDef, cfg: Custom, opts: { ghost?: string } = {}): CarModel {
  const S = SPECS[def.id] ?? SPECS.kitsune;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const L = S.L, W = S.W;
  const minZ = Math.min(...S.prof.map((p) => p[0])), maxZ = Math.max(...S.prof.map((p) => p[0]));

  const paint = new THREE.MeshPhysicalMaterial({ color: cfg.primary, metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 });
  const second = new THREE.MeshPhysicalMaterial({ color: cfg.secondary, metalness: 0.45, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.1 });
  paint.userData.base = new THREE.Color(cfg.primary);
  second.userData.base = new THREE.Color(cfg.secondary);
  const tint = [0.55, 0.75, 0.9, 1][cfg.tint] ?? 0.9;
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a1018, metalness: 0.9, roughness: 0.06, transparent: tint < 1, opacity: tint });
  const rimMat = new THREE.MeshStandardMaterial({ color: cfg.rim, metalness: 0.95, roughness: 0.2 });
  const caliperMat = new THREE.MeshStandardMaterial({ color: def.paint[1] === "#0c0c0c" ? 0xd01818 : 0xd01818, roughness: 0.4, metalness: 0.4 });
  const exhCols = [0xdfe4ea, 0x6a82a8, 0x14161a, 0xd4a017];
  const exhMat = new THREE.MeshStandardMaterial({ color: exhCols[cfg.exhaust] ?? exhCols[0], metalness: 1, roughness: cfg.exhaust === 2 ? 0.5 : 0.18 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1010, emissiveIntensity: 1.2, roughness: 0.3 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdff4ff, emissiveIntensity: 2.2, roughness: 0.2 });
  const nitroCol = new THREE.Color(def.nitroColor);
  const paintMats: THREE.MeshPhysicalMaterial[] = [paint, second];

  // ---- main body
  const bodyGeo = extrude(S.prof, W, S.open ? 0.1 : 0.07);
  const bodyMesh = new THREE.Mesh(bodyGeo, paint);
  body.add(bodyMesh);
  const outline = new THREE.Mesh(bodyGeo, blackMat);
  outline.scale.set(1.02, 1.03, 1.012);
  outline.position.y = -0.012;
  body.add(outline);
  // lower skirt in secondary color
  const skirt = mesh(box(W + 0.02, 0.1, L * 0.52), second, 0, 0.33, -0.1);
  if (!S.open) body.add(skirt);

  // ---- cabin
  if (S.cab.length) {
    const gw = W * S.cabW;
    const cabGeo = extrude(S.cab, gw, 0.03);
    body.add(mesh(cabGeo, glass));
    const interior = mesh(extrude(S.cab.map(([z, y]) => [z * 0.93, y * 0.94]), gw * 0.9, 0.02), new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.8 }));
    body.add(interior);
    if (S.roof) {
      const [z0, z1, top] = S.roof;
      const rp: P = [[z0, top - 0.07], [z1, top - 0.07], [z1 - 0.12, top + 0.02], [z0 + 0.12, top + 0.02]];
      const rg = extrude(rp, gw * 0.97, 0.02);
      body.add(mesh(rg, paint));
      const ro = mesh(rg, blackMat);
      ro.scale.set(1.03, 1.1, 1.02);
      body.add(ro);
      // decal stripes on roof
      if (cfg.decal === 1 || cfg.decal === 2) {
        const sm = new THREE.MeshPhysicalMaterial({ color: cfg.secondary, metalness: 0.4, roughness: 0.3, clearcoat: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
        const offs = cfg.decal === 1 ? [0] : [-0.25, 0.25];
        offs.forEach((o) => {
          const m = mesh(extrude(rp, cfg.decal === 1 ? 0.34 : 0.14, 0.02), sm, o);
          body.add(m);
        });
      }
    }
    // seats and wheel
    const seatM = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.8 });
    const cz = (S.cab[0][0] + S.cab[S.cab.length - 1][0]) / 2;
    [-0.4, 0.4].forEach((x) => body.add(mesh(box(0.4, 0.4, 0.15), seatM, x, S.cab[1][1] - 0.45, cz - 0.35)));
    body.add(mesh(new THREE.TorusGeometry(0.15, 0.025, 6, 12), seatM, 0.4, S.cab[1][1] - 0.42, cz + 0.3).rotateX(-0.9));
  }

  // ---- body decals
  const decalMat = (c: string) => new THREE.MeshPhysicalMaterial({ color: c, metalness: 0.4, roughness: 0.3, clearcoat: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  if (cfg.decal === 1) body.add(mesh(extrude(S.prof, 0.34, 0.07), decalMat(cfg.secondary)));
  if (cfg.decal === 2) [-0.25, 0.25].forEach((o) => body.add(mesh(extrude(S.prof, 0.14, 0.07), decalMat(cfg.secondary), o)));
  if (cfg.decal === 3 && !S.open) {
    [-1, 1].forEach((s) => {
      body.add(mesh(box(0.012, 0.09, L * 0.74), decalMat(cfg.secondary), s * (W / 2 + 0.003), 0.58, -0.05));
      body.add(mesh(box(0.012, 0.04, L * 0.74), decalMat(cfg.secondary), s * (W / 2 + 0.003), 0.7, -0.05));
    });
  }
  if ((cfg.decal === 4 || cfg.decal === 5) && !S.open) {
    const tex =
      cfg.decal === 4
        ? makeCanvas(128, 128, (g, w, h) => {
            g.fillStyle = "#fff";
            g.beginPath();
            g.arc(w / 2, h / 2, 56, 0, 7);
            g.fill();
            g.fillStyle = "#111";
            g.font = "bold 70px sans-serif";
            g.textAlign = "center";
            g.textBaseline = "middle";
            g.fillText("速", w / 2, h / 2 - 8);
            g.font = "bold 28px sans-serif";
            g.fillText("07", w / 2, h / 2 + 40);
          })
        : makeCanvas(256, 32, (g, w, h) => {
            for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++) {
              g.fillStyle = (i + j) % 2 ? "#fff" : "#111";
              g.fillRect(i * 8, j * 8, 8, 8);
            }
            void w; void h;
          });
    const pm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    [-1, 1].forEach((s) => {
      const pl = new THREE.Mesh(cfg.decal === 4 ? new THREE.PlaneGeometry(0.6, 0.6) : new THREE.PlaneGeometry(L * 0.5, 0.1), pm);
      pl.position.set(s * (W / 2 + 0.01), cfg.decal === 4 ? 0.66 : 0.52, cfg.decal === 4 ? -0.1 : 0);
      pl.rotation.y = s * Math.PI / 2;
      body.add(pl);
    });
  }

  // ---- aero extras
  const frontZ = maxZ, rearZ = minZ;
  const has = (k: string) => S.ex.includes(k);
  if (has("splitter")) body.add(mesh(box(W * 1.02, 0.04, 0.5), carbonMat, 0, 0.3, frontZ - 0.1));
  if (has("lipkit")) body.add(mesh(box(W * 1.0, 0.07, 0.3), second, 0, 0.34, frontZ - 0.05));
  if (has("diffuser")) for (let i = -3; i <= 3; i++) body.add(mesh(box(0.03, 0.2, 0.5), carbonMat, i * 0.2, 0.4, rearZ + 0.2));
  if (has("scoops")) [-1, 1].forEach((s) => body.add(mesh(box(0.14, 0.2, 0.5), carbonMat, s * (W / 2 - 0.02), 0.78, -0.55)));
  if (has("vents")) [-1, 1].forEach((s) => body.add(mesh(box(0.012, 0.1, 0.4), carbonMat, s * (W / 2 + 0.005), 0.7, 0.9)));
  if (has("scoop")) body.add(mesh(box(0.55, 0.14, 0.8), carbonMat, 0, topY(S.prof, 0.9) + 0.07, 0.9));
  if (has("hoodvents")) [-0.3, 0.3].forEach((x) => body.add(mesh(box(0.28, 0.02, 0.7), carbonMat, x, topY(S.prof, 1.2) + 0.08, 1.2)));
  if (has("bumper")) body.add(mesh(box(W * 0.95, 0.1, 0.1), steelMat, 0, 0.46, frontZ + 0.04));
  if (has("canards")) [-1, 1].forEach((s) => { const c = mesh(box(0.3, 0.02, 0.2), carbonMat, s * (W / 2 - 0.1), 0.42, frontZ - 0.4); c.rotation.z = s * 0.3; body.add(c); });
  if (has("fins")) [-1, 1].forEach((s) => {
    const fin = extrude([[rearZ + 0.1, topY(S.prof, rearZ + 0.4)], [rearZ + 0.9, topY(S.prof, rearZ + 0.9)], [rearZ + 0.1, topY(S.prof, rearZ + 0.4) + 0.55]], 0.04, 0.01);
    body.add(mesh(fin, second, s * W * 0.34, 0, 0));
  });
  if (has("tailfin")) body.add(mesh(extrude([[rearZ + 0.1, 0.78], [rearZ + 1.4, 0.8], [rearZ + 0.2, 1.5]], 0.05, 0.01), second, 0, 0, 0));
  if (has("sidepods")) [-1, 1].forEach((s) => body.add(mesh(box(0.25, 0.28, 1.6), second, s * (W / 2 - 0.05), 0.6, 0.2)));
  if (has("lightstrip")) {
    const lm = new THREE.MeshBasicMaterial({ color: nitroCol });
    [-1, 1].forEach((s) => body.add(mesh(box(0.02, 0.025, L * 0.8), lm, s * (W / 2 + 0.015), 0.52, 0)));
    body.add(mesh(box(W * 0.7, 0.025, 0.02), lm, 0, topY(S.prof, frontZ - 0.6) - 0.02, frontZ - 0.4));
  }
  if (has("jet")) {
    body.add(mesh(new THREE.TorusGeometry(0.2, 0.04, 8, 20), exhMat, 0, 0.62, rearZ - 0.02));
    body.add(mesh(new THREE.CircleGeometry(0.18, 20), new THREE.MeshBasicMaterial({ color: nitroCol }), 0, 0.62, rearZ - 0.01).rotateY(Math.PI));
  }

  // ---- spoiler
  let sp = cfg.spoiler === 0 ? S.spoiler : (["none", "none", "lip", "duck", "gt", "triple"][cfg.spoiler] as Spec["spoiler"]);
  if (S.open) sp = "none";
  const mz = rearZ + 0.3;
  const dy = topY(S.prof, mz);
  const wingMat = carbonMat;
  const wing = (y: number, chord: number, w: number, z: number, tilt = -0.12) => {
    const m = mesh(box(w, 0.04, chord), wingMat, 0, y, z);
    m.rotation.x = tilt;
    body.add(m);
    body.add(mesh(box(0.04, 0.22, chord + 0.08), second, w / 2, y + 0.04, z));
    body.add(mesh(box(0.04, 0.22, chord + 0.08), second, -w / 2, y + 0.04, z));
  };
  if (sp === "lip") body.add(mesh(box(W * 0.8, 0.05, 0.2), paint, 0, dy + 0.03, rearZ + 0.15).rotateX(-0.2));
  if (sp === "duck") body.add(mesh(extrude([[-0.28, 0], [0.28, 0], [0.3, 0.1], [-0.3, 0.16]], W * 0.88, 0.02), paint, 0, dy - 0.04, rearZ + 0.32));
  if (sp === "gt" || sp === "triple") {
    const h = sp === "gt" ? 0.42 : 0.55;
    [-1, 1].forEach((s) => body.add(mesh(box(0.06, h, 0.1), carbonMat, s * W * 0.3, dy + h / 2, mz)));
    wing(dy + h, 0.42, W * 0.96, mz);
    if (sp === "triple") { wing(dy + h + 0.12, 0.3, W * 0.96, mz + 0.05, -0.25); wing(dy + h + 0.22, 0.2, W * 0.96, mz + 0.1, -0.4); }
  }
  if (sp === "wing") {
    [-1, 1].forEach((s) => body.add(mesh(box(0.05, 0.5, 0.14), carbonMat, s * W * 0.28, dy + 0.25, mz)));
    wing(dy + 0.52, 0.5, W * 1.0, mz, -0.08);
    body.add(mesh(box(W * 0.98, 0.03, 0.2), second, 0, dy + 0.62, mz + 0.15).rotateX(-0.45));
  }
  if (sp === "f1") {
    [-1, 1].forEach((s) => { const f = mesh(box(0.04, 0.55, 0.9), second, s * 0.5, dy + 0.3, mz + 0.1); f.rotation.z = s * -0.25; body.add(f); });
    body.add(mesh(box(1.1, 0.03, 0.2), carbonMat, 0, dy + 0.58, mz + 0.1));
  }

  // ---- lights
  const headMats: THREE.MeshStandardMaterial[] = [headMat];
  const hz = frontZ - 0.3, hy = topY(S.prof, hz);
  const hx = W * 0.34;
  if (S.head === "slit") [-1, 1].forEach((s) => { const m = mesh(box(0.5, 0.05, 0.14), headMat, s * hx, hy - 0.05, hz); m.rotation.y = s * 0.15; body.add(m); body.add(mesh(box(0.56, 0.09, 0.1), carbonMat, s * hx, hy - 0.05, hz - 0.03)); });
  if (S.head === "round" || S.head === "twin") [-1, 1].forEach((s) => { const n = S.head === "twin" ? 2 : 1; for (let k = 0; k < n; k++) body.add(mesh(new THREE.SphereGeometry(S.head === "twin" ? 0.13 : 0.15, 12, 8), headMat, s * (hx + k * 0.0 + (n === 2 ? (k ? -0.28 : 0.0) : 0)), hy - 0.07, hz + 0.02)); });
  if (S.head === "led") [-1, 1].forEach((s) => { for (let k = 0; k < 3; k++) body.add(mesh(box(0.14, 0.04, 0.08), headMat, s * (hx - 0.1 + k * 0.17), hy - 0.04 - k * 0.012, hz)); });
  if (S.head === "pop") [-1, 1].forEach((s) => { body.add(mesh(box(0.28, 0.2, 0.16), carbonMat, s * hx, hy + 0.06, hz - 0.1)); body.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 12).rotateX(Math.PI / 2), headMat, s * hx, hy + 0.08, hz - 0.01)); });
  if (S.head !== "none") body.add(mesh(box(W * 0.5, 0.02, 0.02), headMat, 0, hy - 0.16, frontZ - 0.05));
  else {
    [-1, 1].forEach((s) => body.add(mesh(box(0.2, 0.05, 0.08), headMat, s * 0.2, 0.45, frontZ - 0.1)));
  }
  const tz = rearZ - 0.02, ty = topY(S.prof, rearZ + 0.25) - 0.12;
  if (S.tail === "bar") body.add(mesh(box(W * 0.84, 0.07, 0.05), tailMat, 0, ty, tz));
  if (S.tail === "strip") { body.add(mesh(box(W * 0.78, 0.04, 0.04), tailMat, 0, ty, tz)); body.add(mesh(box(0.3, 0.1, 0.04), tailMat, 0, ty - 0.06, tz)); }
  if (S.tail === "round") [-1, 1].forEach((s) => [0.14, 0.4].forEach((o) => body.add(mesh(new THREE.SphereGeometry(0.1, 10, 8), tailMat, s * (W * 0.46 - o), ty, tz))));
  if (S.tail === "split") [-1, 1].forEach((s) => { body.add(mesh(box(0.4, 0.09, 0.05), tailMat, s * W * 0.32, ty, tz)); body.add(mesh(box(0.2, 0.05, 0.05), tailMat, s * W * 0.14, ty - 0.02, tz)); });
  const tailGlow: THREE.Sprite[] = [];
  [-1, 1].forEach((s) => {
    const sp2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff2020, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.4 }));
    sp2.scale.set(0.9, 0.9, 1);
    sp2.position.set(s * W * 0.32, ty, tz - 0.1);
    body.add(sp2);
    tailGlow.push(sp2);
  });
  // plates
  const pt = plateTex(cfg.plate || "TURBO");
  const plateM = new THREE.MeshBasicMaterial({ map: pt });
  const rp = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.13), plateM);
  rp.position.set(0, S.open ? 0.5 : 0.52, rearZ - 0.075);
  rp.rotation.y = Math.PI;
  body.add(rp);
  const fp = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.13), plateM);
  fp.position.set(0, 0.42, frontZ + 0.1);
  if (!S.open) body.add(fp);

  // ---- exhausts + flames
  const exhaustLocal: THREE.Vector3[] = [];
  const xs = S.exh === 1 ? [0] : S.exh === 2 ? [-0.55, 0.55] : [-0.62, -0.38, 0.38, 0.62];
  const er = S.exhR ?? 0.07;
  const flames: THREE.Group[] = [];
  xs.forEach((x) => {
    const ey = S.open ? 0.5 : 0.42;
    const ez = rearZ - 0.03;
    body.add(mesh(new THREE.CylinderGeometry(er, er * 0.9, 0.2, 14, 1, true).rotateX(Math.PI / 2), exhMat.clone() as any, x, ey, ez + 0.0));
    body.add(mesh(new THREE.CircleGeometry(er * 0.85, 12), new THREE.MeshBasicMaterial({ color: 0x050505 }), x, ey, ez + 0.0).rotateY(Math.PI));
    exhaustLocal.push(new THREE.Vector3(x, ey, ez - 0.05));
    const fg = new THREE.Group();
    fg.position.set(x, ey, ez - 0.05);
    const fo = new THREE.Mesh(new THREE.ConeGeometry(er * 1.8, 1.8, 10, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -0.9), new THREE.MeshBasicMaterial({ color: nitroCol, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const fi = new THREE.Mesh(new THREE.ConeGeometry(er * 0.9, 1.1, 8, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -0.55), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    fg.add(fo, fi);
    fg.visible = false;
    body.add(fg);
    flames.push(fg);
  });

  // ---- underbody
  body.add(mesh(box(W * 0.9, 0.04, L * 0.85), carbonMat, 0, 0.27, 0));
  const underglow = new THREE.Mesh(new THREE.PlaneGeometry(W + 1.4, L + 0.8), new THREE.MeshBasicMaterial({ map: glowTexture(), color: cfg.neon === "off" ? 0x000000 : cfg.neon, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 }));
  underglow.rotation.x = -Math.PI / 2;
  underglow.position.y = 0.06;
  underglow.visible = cfg.neon !== "off";
  group.add(underglow);
  if (cfg.neon !== "off") [-1, 1].forEach((s) => body.add(mesh(box(0.04, 0.03, L * 0.55), new THREE.MeshBasicMaterial({ color: cfg.neon }), s * (W / 2 - 0.05), 0.29, 0)));

  // beams
  const bg = new THREE.ConeGeometry(2.0, 16, 14, 1, true);
  bg.rotateX(-Math.PI / 2);
  bg.translate(0, 0, 8);
  const cols = new Float32Array(bg.attributes.position.count * 3);
  for (let i = 0; i < bg.attributes.position.count; i++) {
    const z = bg.attributes.position.getZ(i);
    const k = Math.pow(1 - z / 16, 2.2) * 0.08;
    cols[i * 3] = k; cols[i * 3 + 1] = k * 0.95; cols[i * 3 + 2] = k * 0.8;
  }
  bg.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  const beams = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beams.position.set(0, 0.75, frontZ - 0.2);
  beams.rotation.x = 0.06;
  beams.visible = false;
  group.add(beams);

  // ---- wheels & arches
  const wheels: WheelRig[] = [];
  const dsg = cfg.wheel;
  const track = S.open ? 0.98 : W / 2 - S.ww / 2 + 0.1;
  const wz = S.wb / 2;
  const mk = (front: boolean, side: number) => {
    const r = front ? S.wr : S.wrr ?? S.wr;
    const w = S.open ? S.ww : S.ww + (front ? 0 : 0.03);
    const rig = buildWheel(r, w, dsg, rimMat, caliperMat, side, front, side * track * -1, front ? wz : -wz);
    group.add(rig.root);
    wheels.push(rig);
    if (!S.open) {
      const arch = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.07, r + 0.07, w + 0.12, 18, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), paint);
      const am = paint.clone();
      am.userData = { base: new THREE.Color(cfg.primary) };
      am.side = THREE.DoubleSide;
      paintMats.push(am);
      arch.material = am;
      arch.position.set(rig.root.position.x, r, rig.root.position.z);
      body.add(arch);
      if (has("wheelcover") && !front) {
        const cv = mesh(new THREE.CylinderGeometry(r * 1.05, r * 1.05, 0.03, 20).rotateZ(Math.PI / 2), paint, rig.root.position.x + side * -1 * w * 0.5, r, rig.root.position.z);
        body.add(cv);
      }
      if (has("wheelspats") && !front) {
        const cv = mesh(new THREE.SphereGeometry(r * 1.2, 14, 8).scale(0.45, 0.95, 1.2), second, rig.root.position.x, r + 0.04, rig.root.position.z);
        body.add(cv);
      }
      if (has("flares")) body.add(mesh(box(0.13, 0.1, r * 2.2), paint, rig.root.position.x + (side > 0 ? -1 : 1) * 0.0, r * 2 - 0.02, rig.root.position.z));
    }
    return rig;
  };
  // side=+1 means mirrored (right side, x<0)
  mk(true, 1); mk(true, -1); mk(false, 1); mk(false, -1);
  // fix: wheels with side=1 are at x<0 (mirror), side=-1 at x>0
  wheels.forEach((w) => { w.root.position.x = w.side > 0 ? -Math.abs(w.root.position.x) : Math.abs(w.root.position.x); w.x = w.root.position.x; });
  // re-place arches to follow corrected x
  let ai = 0;
  body.children.forEach((c: any) => {
    if (c.geometry && c.geometry.type === "CylinderGeometry" && c.geometry.parameters.openEnded && c.geometry.parameters.thetaLength === Math.PI) {
      const w = wheels[ai++];
      if (w) c.position.x = w.x;
    }
  });

  // ---- open wheel specifics
  if (S.open) {
    const hel = mesh(new THREE.SphereGeometry(0.17, 12, 10), new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.3 }), 0, 0.98, -0.2);
    body.add(hel);
    body.add(mesh(new THREE.TorusGeometry(0.24, 0.025, 6, 14, Math.PI).rotateX(Math.PI / 2), carbonMat, 0, 0.9, 0.0));
    body.add(mesh(box(0.5, 0.32, 1.3), second, 0, 0.9, -0.95)); // engine cover
    body.add(mesh(box(0.12, 0.4, 0.5), second, 0, 1.15, -0.95)); // airbox
    [-1, 1].forEach((s) => {
      body.add(mesh(box(0.55, 0.3, 1.6), paint, s * 0.6, 0.52, -0.1)); // sidepods
      const arm = mesh(box(0.7, 0.03, 0.05), carbonMat, s * 0.62, 0.38, wz);
      body.add(arm);
      const arm2 = mesh(box(0.7, 0.03, 0.05), carbonMat, s * 0.62, 0.38, -wz);
      body.add(arm2);
    });
    body.add(mesh(box(2.0, 0.04, 0.42), second, 0, 0.3, maxZ + 0.05));
    [-1, 1].forEach((s) => body.add(mesh(box(0.04, 0.2, 0.46), paint, s * 1.0, 0.36, maxZ + 0.05)));
    body.add(mesh(box(1.4, 0.05, 0.4), second, 0, 1.12, minZ - 0.1));
    [-1, 1].forEach((s) => { body.add(mesh(box(0.04, 0.35, 0.44), paint, s * 0.7, 1.0, minZ - 0.1)); body.add(mesh(box(0.05, 0.6, 0.08), carbonMat, s * 0.2, 0.8, minZ + 0.1)); });
  }


  const model: CarModel = {
    group, wheels, flames, tailMat, tailGlow, headMats, beams, underglow, paintMats, exhaustLocal, rearZ,
    dims: { L, W, wb: S.wb, wr: S.wr }, body, rimMats: [rimMat],
    setDamage(d: number) {
      const burnt = new THREE.Color(0x1a1512);
      paintMats.forEach((m) => {
        const base = (m.userData.base as THREE.Color) ?? m.color;
        if (!m.userData.base) m.userData.base = base.clone();
        m.color.copy(m.userData.base).lerp(burnt, Math.min(0.6, d * 0.65));
        m.roughness = 0.3 + d * 0.45;
      });
    },
  };

  if (opts.ghost) {
    const gm = new THREE.MeshBasicMaterial({ color: opts.ghost, transparent: true, opacity: 0.28, depthWrite: false });
    gm.userData.shared = false;
    group.traverse((o: any) => {
      if (o.isMesh) o.material = gm;
      if (o.isSprite) o.visible = false;
    });
    beams.visible = false;
    underglow.visible = false;
    flames.forEach((f) => (f.visible = false));
  }
  return model;
}

export const CAR_DIMS = (id: string) => {
  const s = SPECS[id] ?? SPECS.kitsune;
  return { L: s.L, W: s.W };
};
