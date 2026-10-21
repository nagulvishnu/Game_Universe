import * as THREE from 'three';

export type ItemId = 'brass_key' | 'silver_key' | 'padlock_key' | 'door_key' | 'bottle' | 'note';

export const ITEM_NAMES: Record<ItemId, string> = {
  brass_key: 'Brass Key',
  silver_key: 'Silver Key',
  padlock_key: 'Padlock Key',
  door_key: 'Front Door Key',
  bottle: 'Glass Bottle',
  note: 'Note',
};

function std(color: number, rough = 0.5, metal = 0, emissive = 0x000000, ei = 1): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive, emissiveIntensity: ei });
}

function shadowed<T extends THREE.Object3D>(o: T): T {
  o.traverse((c) => {
    if (c instanceof THREE.Mesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  return o;
}

export function makeKey(id: ItemId): THREE.Group {
  const g = new THREE.Group();
  const cfg: Record<string, { metal: number; tag: number | null; scale: number }> = {
    brass_key: { metal: 0xc9a23c, tag: null, scale: 1.6 },
    silver_key: { metal: 0xd4dbe0, tag: null, scale: 1.6 },
    padlock_key: { metal: 0x5a5d62, tag: 0xcc2222, scale: 1.5 },
    door_key: { metal: 0xb08d3a, tag: 0x2a7acc, scale: 1.8 },
  };
  const c = cfg[id] ?? cfg.brass_key;
  const m = std(c.metal, 0.3, 0.9, c.metal, 0.12);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 8, 18), m);
  ring.rotation.x = Math.PI / 2;
  ring.position.x = -0.07;
  g.add(ring);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.15, 8), m);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.x = 0.015;
  g.add(shaft);
  for (const [x, w] of [
    [0.07, 0.014],
    [0.05, 0.018],
  ] as [number, number][]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.01, 0.03), m);
    t.position.set(x, 0, 0.016);
    g.add(t);
  }
  if (c.tag !== null) {
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.004, 0.06), std(c.tag, 0.6, 0, c.tag, 0.5));
    tag.position.set(-0.11, -0.004, 0.0);
    g.add(tag);
  }
  g.scale.setScalar(c.scale);
  return shadowed(g);
}

export function makeBottle(): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0x356b44, roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.8 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.04, 0.17, 12), m);
  body.position.y = 0.085;
  g.add(body);
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.038, 0.05, 12), m);
  sh.position.y = 0.195;
  g.add(sh);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.07, 10), m);
  neck.position.y = 0.255;
  g.add(neck);
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.0405, 0.0405, 0.07, 12, 1, true), std(0xc9bd96, 0.9));
  label.position.y = 0.08;
  g.add(label);
  return shadowed(g);
}

let noteTex: THREE.CanvasTexture | null = null;
export function makeNote(): THREE.Group {
  if (!noteTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d')!;
    x.fillStyle = '#d6cdae';
    x.fillRect(0, 0, 128, 128);
    x.strokeStyle = 'rgba(40,30,20,0.55)';
    x.lineWidth = 2;
    for (let y = 20; y < 112; y += 10) {
      x.beginPath();
      x.moveTo(14, y);
      for (let px = 14; px < 114; px += 8) x.lineTo(px, y + (Math.sin(px * 0.8 + y) * 2));
      x.stroke();
    }
    x.fillStyle = 'rgba(90,20,10,0.35)';
    x.beginPath();
    x.arc(96, 100, 9, 0, Math.PI * 2);
    x.fill();
    noteTex = new THREE.CanvasTexture(c);
    noteTex.colorSpace = THREE.SRGBColorSpace;
  }
  const g = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.005, 0.27), new THREE.MeshStandardMaterial({ map: noteTex, roughness: 0.95, emissive: 0x2a2418, emissiveIntensity: 0.6 }));
  g.add(paper);
  g.rotation.y = Math.random() * Math.PI;
  return shadowed(g);
}

let glintTex: THREE.CanvasTexture | null = null;
export function makeGlint(color: number): THREE.Sprite {
  if (!glintTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d')!;
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    // star spikes
    x.strokeStyle = 'rgba(255,255,255,0.8)';
    x.lineWidth = 1.5;
    x.beginPath();
    x.moveTo(32, 2);
    x.lineTo(32, 62);
    x.moveTo(2, 32);
    x.lineTo(62, 32);
    x.stroke();
    glintTex = new THREE.CanvasTexture(c);
    glintTex.colorSpace = THREE.SRGBColorSpace;
  }
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glintTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }),
  );
  s.scale.setScalar(0.28);
  s.raycast = () => {};
  return s;
}

export interface TrapRT {
  group: THREE.Group;
  jawL: THREE.Group;
  jawR: THREE.Group;
  sprung: boolean;
  t: number;
  x: number;
  z: number;
  floor: 0 | 1;
}

export function makeTrap(): { group: THREE.Group; jawL: THREE.Group; jawR: THREE.Group } {
  const g = new THREE.Group();
  const rust = std(0x6a4630, 0.55, 0.75);
  const dark = std(0x2a2a2c, 0.5, 0.8);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.34), rust);
  plate.position.y = 0.015;
  g.add(plate);
  const trig = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 12), dark);
  trig.position.y = 0.036;
  g.add(trig);
  const mkJaw = (side: 1 | -1) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.05, 0.04, 0);
    const geo = new THREE.TorusGeometry(0.15, 0.016, 5, 16, Math.PI);
    geo.rotateX(Math.PI / 2);
    geo.rotateY((side * Math.PI) / 2);
    const arc = new THREE.Mesh(geo, rust);
    pivot.add(arc);
    // teeth
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI;
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.05, 4), dark);
      // arc lies in XZ plane extending toward side * x
      const px = side * Math.sin(a) * 0.15;
      const pz = Math.cos(a) * 0.15;
      tooth.position.set(px, 0.025, pz);
      pivot.add(tooth);
    }
    g.add(pivot);
    return pivot;
  };
  const jawL = mkJaw(-1);
  const jawR = mkJaw(1);
  // spring / chain
  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 5, 10), dark);
  chain.position.set(0.28, 0.03, 0);
  chain.rotation.y = Math.PI / 2;
  g.add(chain);
  return { group: shadowed(g), jawL, jawR };
}

export function setTrapAngle(t: { jawL: THREE.Group; jawR: THREE.Group }, k: number) {
  // k = 0 open (flat) .. 1 closed (jaws upright and meeting)
  t.jawL.rotation.z = -k * Math.PI * 0.47;
  t.jawR.rotation.z = k * Math.PI * 0.47;
}
