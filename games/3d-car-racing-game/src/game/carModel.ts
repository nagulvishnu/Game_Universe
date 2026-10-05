import * as THREE from "three";
import type { CarDef } from "./data";

export interface WheelRig {
  pivot: THREE.Group;
  spin: THREE.Group;
  front: boolean;
  radius: number;
}

export interface CarModel {
  group: THREE.Group; // root: position + yaw
  tilt: THREE.Group; // pitch + roll
  wheels: WheelRig[];
  paint: THREE.MeshPhysicalMaterial;
  brakeMat: THREE.MeshStandardMaterial;
  flames: THREE.Mesh[];
  len: number;
  wid: number;
  headZ: number;
  headY: number;
  setColor: (c: number) => void;
  dispose: () => void;
}

type P2 = [number, number];

interface Shape {
  len: number;
  wid: number;
  body: P2[];
  cabin: P2[];
  roof?: { z: number; y: number; len: number; w: number };
  wheelR: number;
  wheelW: number;
  axleF: number;
  axleR: number;
  headY: number;
  tailY: number;
  zF: number;
  zR: number;
  rim: number;
  underY: number;
  underH: number;
}

const SHAPES: Record<string, Shape> = {
  coupe: {
    len: 4.6,
    wid: 1.95,
    body: [
      [-2.25, 0.32],
      [2.25, 0.32],
      [2.32, 0.55],
      [2.1, 0.78],
      [1.0, 0.9],
      [-1.0, 0.95],
      [-2.05, 0.98],
      [-2.3, 0.82],
    ],
    cabin: [
      [1.05, 0.88],
      [0.5, 1.36],
      [-0.75, 1.38],
      [-1.55, 0.95],
    ],
    roof: { z: -0.12, y: 1.385, len: 1.2, w: 1.38 },
    wheelR: 0.36,
    wheelW: 0.3,
    axleF: 1.4,
    axleR: -1.38,
    headY: 0.66,
    tailY: 0.85,
    zF: 2.28,
    zR: -2.3,
    rim: 0xc9ced6,
    underY: 0.36,
    underH: 0.22,
  },
  muscle: {
    len: 4.9,
    wid: 2.05,
    body: [
      [-2.4, 0.38],
      [2.4, 0.38],
      [2.46, 0.7],
      [2.3, 0.95],
      [1.2, 1.05],
      [-1.3, 1.08],
      [-2.3, 1.12],
      [-2.46, 0.95],
    ],
    cabin: [
      [0.7, 1.02],
      [0.3, 1.5],
      [-1.0, 1.52],
      [-1.7, 1.08],
    ],
    roof: { z: -0.35, y: 1.525, len: 1.3, w: 1.5 },
    wheelR: 0.4,
    wheelW: 0.34,
    axleF: 1.5,
    axleR: -1.45,
    headY: 0.78,
    tailY: 0.95,
    zF: 2.43,
    zR: -2.43,
    rim: 0xdfe3e8,
    underY: 0.42,
    underH: 0.24,
  },
  super: {
    len: 4.6,
    wid: 2.05,
    body: [
      [-2.25, 0.25],
      [2.25, 0.25],
      [2.36, 0.42],
      [2.0, 0.62],
      [0.9, 0.78],
      [-0.2, 0.92],
      [-1.4, 0.95],
      [-2.2, 0.85],
      [-2.32, 0.6],
    ],
    cabin: [
      [0.95, 0.76],
      [0.25, 1.17],
      [-0.55, 1.17],
      [-1.4, 0.94],
    ],
    roof: { z: -0.15, y: 1.175, len: 0.8, w: 1.2 },
    wheelR: 0.37,
    wheelW: 0.36,
    axleF: 1.4,
    axleR: -1.35,
    headY: 0.52,
    tailY: 0.78,
    zF: 2.3,
    zR: -2.3,
    rim: 0x2a2d33,
    underY: 0.29,
    underH: 0.2,
  },
  rally: {
    len: 4.1,
    wid: 1.9,
    body: [
      [-2.0, 0.47],
      [2.0, 0.47],
      [2.06, 0.78],
      [1.86, 0.97],
      [0.9, 1.07],
      [-1.9, 1.1],
      [-2.06, 0.92],
    ],
    cabin: [
      [0.95, 1.02],
      [0.45, 1.62],
      [-1.7, 1.6],
      [-1.92, 1.06],
    ],
    roof: { z: -0.62, y: 1.625, len: 2.05, w: 1.4 },
    wheelR: 0.42,
    wheelW: 0.3,
    axleF: 1.28,
    axleR: -1.22,
    headY: 0.88,
    tailY: 0.95,
    zF: 2.05,
    zR: -2.06,
    rim: 0xf0b323,
    underY: 0.5,
    underH: 0.25,
  },
  truck: {
    len: 5.3,
    wid: 2.15,
    body: [
      [-2.6, 0.72],
      [2.6, 0.72],
      [2.66, 1.15],
      [2.42, 1.42],
      [0.95, 1.5],
      [-0.45, 1.5],
      [-0.5, 1.35],
      [-2.55, 1.35],
      [-2.66, 1.2],
    ],
    cabin: [
      [1.0, 1.45],
      [0.6, 2.15],
      [-0.4, 2.15],
      [-0.55, 1.45],
    ],
    roof: { z: 0.1, y: 2.155, len: 1.0, w: 1.7 },
    wheelR: 0.58,
    wheelW: 0.42,
    axleF: 1.65,
    axleR: -1.6,
    headY: 1.05,
    tailY: 1.2,
    zF: 2.64,
    zR: -2.64,
    rim: 0x3a3d44,
    underY: 0.62,
    underH: 0.4,
  },
};

function extrude(pts: P2[], width: number, bevel = 0.05) {
  const shape = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  const depth = Math.max(0.05, width - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 1,
  });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2);
  return g;
}

function numberTexture(num: number) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.arc(64, 64, 58, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#111";
  g.font = "bold 78px Arial Black, Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(num), 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildCar(def: CarDef, color: number, carNumber = 7): CarModel {
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(o: T): T => {
    disposables.push(o);
    return o;
  };

  const isFormula = def.type === "formula";
  const S: Shape = isFormula
    ? {
        len: 5.0,
        wid: 2.0,
        body: [
          [-1.6, 0.25],
          [2.4, 0.2],
          [2.52, 0.3],
          [1.3, 0.52],
          [0.5, 0.6],
          [0.1, 0.72],
          [-0.5, 0.78],
          [-1.6, 0.68],
        ],
        cabin: [],
        wheelR: 0.37,
        wheelW: 0.44,
        axleF: 1.7,
        axleR: -1.5,
        headY: 0.4,
        tailY: 0.8,
        zF: 2.5,
        zR: -2.45,
        rim: 0x1c1d20,
        underY: 0.2,
        underH: 0.1,
      }
    : SHAPES[def.type];

  const group = new THREE.Group();
  const tilt = new THREE.Group();
  group.add(tilt);

  const paint = track(
    new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.55,
      roughness: 0.32,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    }),
  );
  const glass = track(new THREE.MeshPhysicalMaterial({ color: 0x0b1018, metalness: 0.9, roughness: 0.06 }));
  const black = track(new THREE.MeshStandardMaterial({ color: 0x0f1013, roughness: 0.6, metalness: 0.3 }));
  const chrome = track(new THREE.MeshStandardMaterial({ color: 0xdfe3ea, roughness: 0.15, metalness: 1 }));
  const tireMat = track(new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.92 }));
  const rimMat = track(new THREE.MeshStandardMaterial({ color: S.rim, roughness: 0.25, metalness: 0.9 }));
  const headMat = track(
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2cc, emissiveIntensity: 2.2, roughness: 0.2 }),
  );
  const brakeMat = track(
    new THREE.MeshStandardMaterial({ color: 0x990000, emissive: 0xff1010, emissiveIntensity: 0.9, roughness: 0.3 }),
  );

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, shadow = true) => {
    track(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    tilt.add(m);
    return m;
  };
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, shadow = true) =>
    add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, shadow);

  const W = S.wid;

  // ---- main bodywork
  add(extrude(S.body, isFormula ? 0.78 : W), paint);
  if (S.cabin.length) {
    add(extrude(S.cabin, W * 0.86, 0.04), glass);
  }
  if (S.roof) box(S.roof.w, 0.05, S.roof.len, paint, 0, S.roof.y, S.roof.z);
  if (!isFormula) {
    // dark underbody + side skirts
    box(W * 0.94, S.underH, S.len * 0.9, black, 0, S.underY, 0, false);
    // grille + intake
    box(W * 0.5, 0.12, 0.05, black, 0, S.headY - 0.02, S.zF - 0.06, false);
    // mirrors
    for (const sx of [-1, 1]) {
      const my = (S.body[4]?.[1] ?? 1) + 0.12;
      box(0.12, 0.09, 0.2, paint, sx * (W / 2 + 0.05), my, S.cabin.length ? S.cabin[0][0] - 0.25 : 0.5);
    }
    // lights
    for (const sx of [-1, 1]) {
      box(W * 0.2, 0.09, 0.07, headMat, sx * W * 0.34, S.headY, S.zF - 0.05, false);
      box(W * 0.14, 0.09, 0.06, brakeMat, sx * W * 0.36, S.tailY, S.zR + 0.04, false);
    }
    box(W * 0.5, 0.06, 0.05, brakeMat, 0, S.tailY, S.zR + 0.04, false);
    // exhaust
    for (const sx of [-1, 1]) {
      const ex = new THREE.CylinderGeometry(0.07, 0.07, 0.25, 12);
      ex.rotateX(Math.PI / 2);
      add(ex, chrome, sx * W * 0.28, S.underY + 0.05, S.zR - 0.04, false);
    }
    // door numbers
    const nt = track(numberTexture(carNumber));
    const nm = track(new THREE.MeshBasicMaterial({ map: nt, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }));
    for (const sx of [-1, 1]) {
      const pg = track(new THREE.PlaneGeometry(0.48, 0.48));
      const m = new THREE.Mesh(pg, nm);
      m.position.set(sx * (W / 2 + 0.012), S.underY + 0.34, -0.05);
      m.rotation.y = sx * Math.PI * 0.5;
      tilt.add(m);
    }
  }

  // ---- body-type specific parts
  const wing = (y: number, z: number, width: number, chord: number, postH: number) => {
    box(width, 0.05, chord, paint, 0, y, z);
    for (const sx of [-1, 1]) {
      box(0.05, 0.22, chord + 0.05, black, sx * (width / 2), y + 0.03, z);
      box(0.06, postH, 0.12, black, sx * width * 0.28, y - postH / 2, z + 0.05);
    }
  };

  switch (def.type) {
    case "coupe":
      box(W * 0.8, 0.04, 0.3, paint, 0, 1.03, -2.17);
      box(W * 0.96, 0.05, 0.24, black, 0, 0.3, 2.28, false);
      break;
    case "muscle":
      box(0.62, 0.12, 0.95, black, 0, 1.1, 0.95, false);
      box(W * 0.98, 0.12, 0.14, chrome, 0, 0.5, S.zF + 0.01, false);
      box(W * 0.98, 0.12, 0.14, chrome, 0, 0.5, S.zR - 0.01, false);
      box(W * 0.78, 0.04, 0.34, paint, 0, 1.15, -2.3);
      break;
    case "super":
      wing(1.2, -2.12, W * 0.96, 0.46, 0.3);
      box(W * 0.98, 0.03, 0.5, black, 0, 0.25, 2.3, false);
      for (const sx of [-1, 1]) box(0.08, 0.2, 0.7, black, sx * (W / 2 - 0.02), 0.55, -0.75, false);
      box(W * 0.6, 0.12, 0.35, black, 0, 0.36, -2.3, false);
      break;
    case "rally": {
      wing(1.78, -1.95, W * 0.92, 0.38, 0.5);
      box(0.5, 0.1, 0.5, black, 0, 1.68, 0.55, false);
      // roof light bar
      for (const sx of [-1.5, -0.5, 0.5, 1.5]) {
        const l = new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12);
        l.rotateX(Math.PI / 2);
        add(l, headMat, sx * 0.19, 1.15, 2.0, false);
      }
      box(W * 0.96, 0.1, 0.2, black, 0, 0.5, S.zF, false);
      // mud flaps
      for (const sx of [-1, 1]) {
        box(0.04, 0.2, 0.24, black, sx * (W / 2 - 0.1), 0.42, S.axleR - 0.5, false);
      }
      break;
    }
    case "truck": {
      // bull bar
      box(W * 0.8, 0.07, 0.07, black, 0, 0.96, S.zF + 0.12, false);
      for (const sx of [-1, 1]) box(0.07, 0.5, 0.07, black, sx * W * 0.4, 0.95, S.zF + 0.1, false);
      box(W * 0.9, 0.14, 0.18, black, 0, 0.8, S.zF + 0.02, false);
      // roof light bar
      box(1.5, 0.1, 0.12, black, 0, 2.25, 0.7, false);
      for (let i = -3; i <= 3; i++) box(0.14, 0.07, 0.04, headMat, i * 0.2, 2.25, 0.77, false);
      // bed rails & tailgate
      for (const sx of [-1, 1]) box(0.1, 0.3, 2.0, paint, sx * (W / 2 - 0.07), 1.5, -1.55);
      box(W * 0.96, 0.3, 0.08, paint, 0, 1.5, -2.6);
      box(W * 0.9, 0.1, 1.8, black, 0, 1.38, -1.55, false);
      // stacks
      for (const sx of [-1, 1]) box(0.09, 0.9, 0.09, chrome, sx * (W / 2 + 0.03), 1.8, -0.62, false);
      break;
    }
    case "formula": {
      // side pods
      for (const sx of [-1, 1]) {
        box(0.5, 0.36, 1.8, paint, sx * 0.62, 0.48, -0.3);
        box(0.36, 0.2, 0.5, black, sx * 0.62, 0.56, 0.68, false);
        // suspension arms
        box(0.9, 0.04, 0.05, black, sx * 0.55, 0.38, S.axleF, false);
        box(0.9, 0.04, 0.05, black, sx * 0.55, 0.38, S.axleR, false);
      }
      // engine cover / airbox
      box(0.46, 0.5, 1.5, paint, 0, 0.92, -1.0);
      box(0.3, 0.3, 0.3, black, 0, 1.25, -0.5, false);
      // helmet + halo
      const helmet = new THREE.SphereGeometry(0.2, 16, 12);
      add(helmet, track(new THREE.MeshStandardMaterial({ color: 0xffd21f, roughness: 0.3, metalness: 0.4 })), 0, 0.9, 0.05);
      const halo = new THREE.TorusGeometry(0.28, 0.025, 6, 16, Math.PI);
      halo.rotateX(Math.PI / 2);
      halo.rotateY(Math.PI / 2);
      add(halo, black, 0, 1.0, 0.1, false);
      // front wing
      box(2.1, 0.05, 0.5, paint, 0, 0.16, 2.35);
      box(2.1, 0.04, 0.3, black, 0, 0.23, 2.2, false);
      for (const sx of [-1, 1]) box(0.04, 0.22, 0.6, black, sx * 1.05, 0.25, 2.35, false);
      // rear wing
      wing(1.15, -2.2, 1.35, 0.42, 0.45);
      box(0.4, 0.05, 0.3, black, 0, 0.42, -2.45, false);
      // lights
      box(0.5, 0.06, 0.05, brakeMat, 0, 0.75, -2.0, false);
      box(0.34, 0.07, 0.07, headMat, 0, 0.4, 2.48, false);
      // livery number on nose
      const nt = track(numberTexture(carNumber));
      const nm = track(new THREE.MeshBasicMaterial({ map: nt, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }));
      for (const sx of [-1, 1]) {
        const m = new THREE.Mesh(track(new THREE.PlaneGeometry(0.4, 0.4)), nm);
        m.position.set(sx * (0.62 + 0.26), 0.52, -0.3);
        m.rotation.y = sx * Math.PI * 0.5;
        tilt.add(m);
      }
      break;
    }
  }

  // ---- wheels
  const wheels: WheelRig[] = [];
  const tireGeo = track(new THREE.CylinderGeometry(S.wheelR, S.wheelR, S.wheelW, 24));
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = track(new THREE.CylinderGeometry(S.wheelR * 0.64, S.wheelR * 0.64, S.wheelW + 0.02, 18));
  rimGeo.rotateZ(Math.PI / 2);
  const spokeGeo = track(new THREE.BoxGeometry(S.wheelW + 0.04, S.wheelR * 1.15, S.wheelR * 0.09));
  const hubGeo = track(new THREE.CylinderGeometry(S.wheelR * 0.16, S.wheelR * 0.16, S.wheelW + 0.06, 10));
  hubGeo.rotateZ(Math.PI / 2);
  const discGeo = track(new THREE.CylinderGeometry(S.wheelR * 0.5, S.wheelR * 0.5, S.wheelW * 0.5, 18));
  discGeo.rotateZ(Math.PI / 2);
  const discMat = track(new THREE.MeshStandardMaterial({ color: 0x555a63, metalness: 0.8, roughness: 0.4 }));
  const halfTrack = isFormula ? 1.02 : W / 2 - S.wheelW / 2 + 0.03;
  for (const [z, front] of [
    [S.axleF, true],
    [S.axleR, false],
  ] as [number, boolean][]) {
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * halfTrack, S.wheelR, z);
      const spin = new THREE.Group();
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.castShadow = true;
      spin.add(tire);
      spin.add(new THREE.Mesh(discGeo, discMat));
      spin.add(new THREE.Mesh(rimGeo, rimMat));
      for (let i = 0; i < 5; i++) {
        const sp = new THREE.Mesh(spokeGeo, rimMat);
        sp.rotation.x = (i * Math.PI) / 5;
        spin.add(sp);
      }
      spin.add(new THREE.Mesh(hubGeo, chrome));
      pivot.add(spin);
      tilt.add(pivot);
      wheels.push({ pivot, spin, front, radius: S.wheelR });
    }
  }

  // ---- nitro flames
  const flames: THREE.Mesh[] = [];
  const flameGeo = track(new THREE.ConeGeometry(0.13, 1.5, 10));
  flameGeo.translate(0, 0.75, 0); // base at origin, tip along +y
  flameGeo.rotateX(-Math.PI / 2); // tip now points to -z (behind the car)
  const flameMat = track(
    new THREE.MeshBasicMaterial({
      color: 0x59b8ff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  for (const sx of [-1, 1]) {
    const f = new THREE.Mesh(flameGeo, flameMat);
    f.position.set(sx * W * 0.28, S.underY + 0.05, S.zR - 0.15);
    f.visible = false;
    tilt.add(f);
    flames.push(f);
  }

  return {
    group,
    tilt,
    wheels,
    paint,
    brakeMat,
    flames,
    len: S.len,
    wid: S.wid,
    headZ: S.zF,
    headY: S.headY,
    setColor: (c: number) => paint.color.setHex(c),
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}
