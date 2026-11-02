import * as THREE from "three";
import type { VehicleKind, WeaponId } from "./data";

// ---------------------------------------------------------------------------
// Material + geometry caches (keeps draw setup cheap)
// ---------------------------------------------------------------------------

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

export function mat(
  color: string,
  opts: {
    metalness?: number;
    roughness?: number;
    emissive?: string;
    emissiveIntensity?: number;
    transparent?: boolean;
    opacity?: number;
  } = {}
): THREE.MeshStandardMaterial {
  const key = `${color}|${opts.metalness ?? 0.35}|${opts.roughness ?? 0.5}|${opts.emissive ?? ""}|${
    opts.emissiveIntensity ?? 0
  }|${opts.transparent ?? false}|${opts.opacity ?? 1}`;
  const hit = materialCache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshStandardMaterial({
    color,
    metalness: opts.metalness ?? 0.35,
    roughness: opts.roughness ?? 0.5,
    emissive: opts.emissive ?? "#000000",
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  });
  materialCache.set(key, m);
  return m;
}

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const sphereGeo = new THREE.SphereGeometry(1, 14, 10);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 12);

function box(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material
) {
  const m = new THREE.Mesh(boxGeo, material);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function cyl(
  parent: THREE.Object3D,
  rTop: number,
  rBottom: number,
  h: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
  rot?: [number, number, number],
  segments = 12
) {
  const geo =
    rTop === rBottom
      ? cylGeo
      : new THREE.CylinderGeometry(rTop, rBottom, 1, segments);
  const m = new THREE.Mesh(geo, material);
  m.scale.set(rTop === rBottom ? rTop : 1, h, rTop === rBottom ? rTop : 1);
  if (rTop !== rBottom) m.scale.set(rTop, h, rTop);
  m.position.set(x, y, z);
  if (rot) m.rotation.set(...rot);
  parent.add(m);
  return m;
}

function sphere(
  parent: THREE.Object3D,
  r: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
  sy = 1
) {
  const m = new THREE.Mesh(sphereGeo, material);
  m.scale.set(r, r * sy, r);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

const wheelGeoCache = new Map<string, THREE.CylinderGeometry>();
function wheelGeo(radius: number, width: number) {
  const key = `${radius}-${width}`;
  let geo = wheelGeoCache.get(key);
  if (!geo) {
    geo = new THREE.CylinderGeometry(radius, radius, width, 14);
    geo.rotateZ(Math.PI / 2);
    wheelGeoCache.set(key, geo);
  }
  return geo;
}

function wheel(parent: THREE.Object3D, x: number, y: number, z: number, radius = 0.38, width = 0.3) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(wheelGeo(radius, width), mat("#0b0d10", { roughness: 0.8, metalness: 0.1 }));
  g.add(tire);
  const hubGeo = wheelGeo(radius * 0.55, width + 0.02);
  const hub = new THREE.Mesh(hubGeo, mat("#c9d1d9", { metalness: 0.95, roughness: 0.25 }));
  g.add(hub);
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

// ---------------------------------------------------------------------------
// Vehicle models
// ---------------------------------------------------------------------------

export interface BuiltVehicle {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  rotors: THREE.Object3D[];
  policeLights: THREE.Mesh[];
  barrel?: THREE.Object3D;
  headlightsMaterial?: THREE.MeshStandardMaterial;
}

const GLASS = () => mat("#0a1520", { metalness: 0.9, roughness: 0.08 });

function carOf(
  kind: VehicleKind,
  color: string,
  o: {
    length: number;
    width: number;
    bodyH: number;
    cabinH: number;
    cabinZ: number;
    ride: number;
    wheelR: number;
    wheelZ: number;
  }
): BuiltVehicle {
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  const paint = mat(color, { metalness: 0.55, roughness: 0.3 });
  const dark = mat("#12161b", { metalness: 0.4, roughness: 0.6 });
  const trim = mat("#2a3138", { metalness: 0.8, roughness: 0.35 });

  box(group, o.width, o.bodyH, o.length, 0, o.ride + o.bodyH / 2, 0, paint);
  box(group, o.width * 0.94, o.bodyH * 0.42, o.length * 0.98, 0, o.ride * 0.55, 0, dark);
  // cabin
  box(
    group,
    o.width * 0.84,
    o.cabinH,
    o.length * 0.45,
    0,
    o.ride + o.bodyH + o.cabinH / 2,
    o.cabinZ,
    GLASS()
  );
  box(
    group,
    o.width * 0.86,
    o.cabinH * 0.28,
    o.length * 0.43,
    0,
    o.ride + o.bodyH + o.cabinH * 0.92,
    o.cabinZ,
    paint
  );
  // skirts + bumpers
  box(group, o.width * 1.02, 0.16, 0.32, 0, o.ride - 0.02, o.length / 2 - 0.08, trim);
  box(group, o.width * 1.02, 0.16, 0.32, 0, o.ride - 0.02, -o.length / 2 + 0.08, trim);
  // lights
  const headMat = mat("#fff4d6", { emissive: "#fff2cc", emissiveIntensity: 2.4 });
  const tailMat = mat("#ff2233", { emissive: "#ff1122", emissiveIntensity: 1.8 });
  box(group, 0.42, 0.13, 0.06, -o.width * 0.32, o.ride + o.bodyH * 0.72, o.length / 2 + 0.005, headMat);
  box(group, 0.42, 0.13, 0.06, o.width * 0.32, o.ride + o.bodyH * 0.72, o.length / 2 + 0.005, headMat);
  box(group, 0.4, 0.12, 0.06, -o.width * 0.33, o.ride + o.bodyH * 0.7, -o.length / 2 - 0.005, tailMat);
  box(group, 0.4, 0.12, 0.06, o.width * 0.33, o.ride + o.bodyH * 0.7, -o.length / 2 - 0.005, tailMat);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      wheels.push(wheel(group, (sx * o.width) / 2 - sx * 0.02, o.wheelR, sz * o.wheelZ, o.wheelR, 0.3));
    }
  }

  if (kind === "sports") {
    box(group, o.width * 0.9, 0.07, 0.5, 0, o.ride + o.bodyH + 0.08, -o.length / 2 + 0.25, trim);
    box(group, 0.1, 0.24, 0.12, -o.width * 0.36, o.ride + 0.18, -o.length / 2 + 0.25, trim);
    box(group, 0.1, 0.24, 0.12, o.width * 0.36, o.ride + 0.18, -o.length / 2 + 0.25, trim);
    box(group, o.width * 0.98, 0.06, o.length * 0.5, 0, o.ride + o.bodyH + 0.01, o.length * 0.22, mat("#e8ffab", { emissive: "#b7ff2e", emissiveIntensity: 0.4 }));
  }
  if (kind === "muscle") {
    box(group, 0.7, 0.14, 0.9, 0, o.ride + o.bodyH + 0.06, o.length * 0.28, trim);
    box(group, o.width * 0.92, 0.04, o.length * 0.8, 0, o.ride + o.bodyH + 0.005, 0, mat("#0d0f12", { roughness: 0.7 }));
  }
  if (kind === "suv") {
    box(group, o.width * 0.86, 0.06, o.length * 0.44, 0, o.ride + o.bodyH + o.cabinH + 0.03, o.cabinZ, trim);
    box(group, o.width * 0.5, 0.18, 0.08, 0, o.ride + 0.3, o.length / 2 + 0.03, trim);
  }
  if (kind === "truck") {
    const cargo = mat("#b9c2c9", { metalness: 0.6, roughness: 0.45 });
    box(group, o.width * 1.02, 2.3, 5.2, 0, 1.75, -1.7, cargo);
    box(group, o.width * 1.04, 0.12, 5.25, 0, 2.92, -1.7, trim);
    for (let i = 0; i < 6; i++) {
      box(group, o.width * 1.03, 0.04, 0.06, 0, 0.7 + i * 0.38, -4.32, trim);
    }
  }
  if (kind === "taxi") {
    box(group, 0.9, 0.26, 0.34, 0, o.ride + o.bodyH + o.cabinH + 0.2, o.cabinZ, mat("#ffd23d", { emissive: "#ffbd00", emissiveIntensity: 0.9 }));
    box(group, 0.34, 0.07, o.length * 0.8, 0, o.ride + 0.14, 0, mat("#12161b"));
  }
  if (kind === "police") {
    const red = mat("#ff2233", { emissive: "#ff0022", emissiveIntensity: 2.2, metalness: 0.2 });
    const blue = mat("#2b7bff", { emissive: "#0a5bff", emissiveIntensity: 2.2, metalness: 0.2 });
    const bar1 = box(group, 0.5, 0.16, 0.3, -0.36, o.ride + o.bodyH + o.cabinH + 0.14, o.cabinZ, red);
    const bar2 = box(group, 0.5, 0.16, 0.3, 0.36, o.ride + o.bodyH + o.cabinH + 0.14, o.cabinZ, blue);
    box(group, o.width * 1.01, 0.3, 0.06, 0, o.ride + o.bodyH * 0.5, 0.4, mat("#10233f"));
    for (let i = 0; i < 4; i++) {
      box(group, 0.14, 0.5, 0.05, -0.5 + i * 0.34, o.ride + o.bodyH * 0.62, o.length / 2 + 0.02, i % 2 ? mat("#0a1220") : mat("#b7e6ff", { emissive: "#b7e6ff", emissiveIntensity: 0.4 }));
    }
    return { group, wheels, rotors: [], policeLights: [bar1, bar2] };
  }
  return { group, wheels, rotors: [], policeLights: [] };
}

function buildBike(color: string, sport: boolean): BuiltVehicle {
  const group = new THREE.Group();
  const paint = mat(color, { metalness: 0.6, roughness: 0.28 });
  const trim = mat("#1a1f25", { metalness: 0.9, roughness: 0.25 });
  const wheels: THREE.Object3D[] = [];
  wheels.push(wheel(group, 0, 0.38, 0.78, 0.38, 0.16));
  wheels.push(wheel(group, 0, 0.38, -0.78, 0.38, 0.16));
  box(group, 0.34, 0.34, 1.1, 0, 0.78, 0.02, paint);
  box(group, 0.42, 0.24, 0.55, 0, 0.92, 0.34, paint);
  box(group, 0.3, 0.12, 0.6, 0, 0.94, -0.3, trim);
  box(group, 0.28, 0.06, 0.7, 0, 0.7, -0.5, trim);
  // forks + bars
  cyl(group, 0.045, 0.045, 0.9, 0, 0.68, 0.62, trim, [0.35, 0, 0]);
  box(group, 1.0, 0.07, 0.07, 0, 1.06, 0.5, trim);
  box(group, 0.14, 0.14, 0.1, -0.42, 1.02, 0.5, mat("#ff2233", { emissive: "#ff2233", emissiveIntensity: 1.2 }));
  cyl(group, 0.1, 0.1, 0.9, 0.24, 0.55, -0.4, trim, [0.2, 0, 0]);
  const head = box(group, 0.3, 0.2, 0.06, 0, 1.02, 0.86, mat("#fff4d6", { emissive: "#fff2cc", emissiveIntensity: 2 }));
  head.visible = true;
  if (sport) {
    box(group, 0.34, 0.16, 0.5, 0, 1.0, -0.02, paint);
    box(group, 0.26, 0.1, 0.4, 0, 1.06, -0.5, paint);
    cyl(group, 0.05, 0.05, 0.7, 0.26, 0.5, -0.7, trim, [0.35, 0, 0]);
  }
  return { group, wheels, rotors: [], policeLights: [] };
}

function buildPlane(color: string): BuiltVehicle {
  const group = new THREE.Group();
  const paint = mat(color, { metalness: 0.55, roughness: 0.3 });
  const trim = mat("#212b36", { metalness: 0.8, roughness: 0.3 });
  const accent = mat("#ff3d3d", { metalness: 0.4, roughness: 0.4 });
  const rotors: THREE.Object3D[] = [];
  // fuselage (forward +Z)
  const body = sphere(group, 0.85, 0, 1.5, 0, paint, 1);
  body.scale.set(0.95, 0.95, 4.2);
  sphere(group, 0.75, 0, 1.5, 2.1, paint).scale.set(0.75, 0.7, 1.3);
  // cockpit
  const cock = sphere(group, 0.72, 0, 1.95, 1.1, GLASS(), 0.9);
  cock.scale.set(0.8, 0.55, 1.5);
  // wings
  box(group, 11, 0.14, 1.9, 0, 1.55, 0.1, paint);
  box(group, 11, 0.2, 0.5, 0, 1.5, 1.0, accent);
  // tail
  box(group, 0.16, 2.0, 1.3, 0, 2.5, -3.0, accent);
  box(group, 3.6, 0.12, 0.9, 0, 1.55, -3.0, paint);
  box(group, 0.1, 1.4, 0.8, 0, 1.9, -2.6, accent);
  // windows strip
  box(group, 1.45, 0.3, 1.0, 0, 1.92, 0.5, GLASS());
  // engine + prop
  box(group, 0.5, 0.5, 0.8, 0, 1.5, 2.75, trim);
  const prop = new THREE.Group();
  prop.position.set(0, 1.5, 3.05);
  for (let i = 0; i < 4; i++) {
    const blade = box(prop, 0.11, 1.5, 0.04, 0, 0, 0, trim);
    blade.rotation.z = (i * Math.PI) / 2;
  }
  box(prop, 0.22, 0.22, 0.18, 0, 0, 0, mat("#ffd23d", { emissive: "#ffb800", emissiveIntensity: 0.5 }));
  rotors.push(prop);
  group.add(prop);
  // wheels
  const wheels: THREE.Object3D[] = [];
  for (const sx of [-1, 1]) {
    const g = new THREE.Group();
    const t = new THREE.Mesh(wheelGeo(0.28, 0.18), mat("#0b0d10"));
    g.add(t);
    g.position.set(sx * 1.7, 0.75, 0.4);
    group.add(g);
    wheels.push(g);
  }
  wheels.push(wheel(group, 0, 0.55, -2.7, 0.18, 0.12));
  const nav = mat("#ff2233", { emissive: "#ff2233", emissiveIntensity: 1.4 });
  box(group, 0.12, 0.12, 0.12, -5.4, 1.58, 0.1, nav);
  box(group, 0.12, 0.12, 0.12, 5.4, 1.58, 0.1, mat("#22ff88", { emissive: "#22ff88", emissiveIntensity: 1.4 }));
  return { group, wheels, rotors, policeLights: [] };
}

function buildHeli(color: string): BuiltVehicle {
  const group = new THREE.Group();
  const paint = mat(color, { metalness: 0.65, roughness: 0.3 });
  const trim = mat("#141c24", { metalness: 0.7, roughness: 0.35 });
  const neon = mat("#c8ff3d", { emissive: "#8fff00", emissiveIntensity: 0.6 });
  const rotors: THREE.Object3D[] = [];
  const body = sphere(group, 1.05, 0, 1.75, 0, paint, 0.9);
  body.scale.set(1.0, 0.9, 1.55);
  const cock = sphere(group, 0.85, 0, 1.85, 1.05, GLASS(), 0.8);
  cock.scale.set(0.92, 0.8, 1.1);
  box(group, 0.55, 0.5, 3.4, 0, 2.0, -2.2, paint);
  box(group, 0.16, 1.3, 0.5, 0, 2.6, -3.6, neon);
  // skids
  box(group, 1.7, 0.1, 0.12, 0, 0.55, 1.0, trim);
  box(group, 1.7, 0.1, 0.12, 0, 0.55, -1.1, trim);
  box(group, 0.1, 0.7, 0.1, -0.7, 0.9, 1.0, trim);
  box(group, 0.1, 0.7, 0.1, 0.7, 0.9, 1.0, trim);
  box(group, 0.1, 0.7, 0.1, -0.7, 0.9, -1.1, trim);
  box(group, 0.1, 0.7, 0.1, 0.7, 0.9, -1.1, trim);
  // main rotor
  const rotor = new THREE.Group();
  rotor.position.set(0, 2.85, 0);
  box(rotor, 9.2, 0.06, 0.38, 0, 0, 0, mat("#15181c", { metalness: 0.7 }));
  box(rotor, 0.38, 0.06, 9.2, 0, 0, 0, mat("#15181c", { metalness: 0.7 }));
  rotors.push(rotor);
  group.add(rotor);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.15, 2.6, -3.7);
  box(tailRotor, 0.05, 2.2, 0.16, 0, 0, 0, mat("#0d1116"));
  rotors.push(tailRotor);
  group.add(tailRotor);
  // lights
  box(group, 0.16, 0.16, 0.16, -1.0, 1.6, 0.9, mat("#ff2233", { emissive: "#ff2233", emissiveIntensity: 2 }));
  box(group, 0.16, 0.16, 0.16, 1.0, 1.6, 0.9, mat("#22ff88", { emissive: "#22ff88", emissiveIntensity: 2 }));
  return { group, wheels: [], rotors, policeLights: [] };
}

function buildTank(color: string): BuiltVehicle {
  const group = new THREE.Group();
  const paint = mat(color, { metalness: 0.5, roughness: 0.62 });
  const dark = mat("#23271a", { metalness: 0.45, roughness: 0.7 });
  const steel = mat("#444c30", { metalness: 0.6, roughness: 0.5 });
  const wheels: THREE.Object3D[] = [];
  // tracks
  for (const sx of [-1, 1]) {
    box(group, 0.9, 1.0, 5.6, sx * 1.4, 0.58, 0, dark);
    box(group, 1.02, 0.22, 5.2, sx * 1.4, 1.1, 0, steel);
    for (let i = 0; i < 5; i++) {
      const w = wheel(group, sx * 1.4, 0.45, -2.2 + i * 1.1, 0.36, 1.0);
      wheels.push(w);
    }
  }
  box(group, 2.2, 1.0, 5.0, 0, 1.35, 0, paint);
  box(group, 2.3, 0.28, 4.6, 0, 0.9, 0, steel);
  // turret
  const turret = new THREE.Group();
  turret.position.set(0, 2.1, -0.2);
  const tur = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.35, 0.7, 10), paint);
  turret.add(tur);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 3.9, 10), steel);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.1, 2.1);
  turret.add(barrel);
  box(turret, 0.5, 0.3, 0.5, 0, 0.5, -0.2, dark);
  const ant = box(turret, 0.06, 2.2, 0.06, -0.7, 1.2, -0.8, steel);
  ant.rotation.z = 0.15;
  group.add(turret);
  // headlights
  box(group, 0.32, 0.2, 0.08, -0.65, 1.65, 2.52, mat("#fff2cc", { emissive: "#fff2cc", emissiveIntensity: 2 }));
  box(group, 0.32, 0.2, 0.08, 0.65, 1.65, 2.52, mat("#fff2cc", { emissive: "#fff2cc", emissiveIntensity: 2 }));
  const tail = mat("#ff2233", { emissive: "#ff2233", emissiveIntensity: 1.4 });
  box(group, 0.24, 0.16, 0.08, -1.0, 1.6, -2.55, tail);
  box(group, 0.24, 0.16, 0.08, 1.0, 1.6, -2.55, tail);
  return { group, wheels, rotors: [], policeLights: [], barrel: turret };
}

export function buildVehicle(kind: VehicleKind, colorOverride?: string): BuiltVehicle {
  const baseColor = colorOverride;
  switch (kind) {
    case "sports":
      return carOf(kind, baseColor ?? "#c8ff3d", { length: 4.5, width: 1.95, bodyH: 0.46, cabinH: 0.42, cabinZ: -0.18, ride: 0.3, wheelR: 0.37, wheelZ: 1.45 });
    case "muscle":
      return carOf(kind, baseColor ?? "#ff6b35", { length: 4.7, width: 2.0, bodyH: 0.6, cabinH: 0.52, cabinZ: -0.3, ride: 0.34, wheelR: 0.42, wheelZ: 1.5 });
    case "suv":
      return carOf(kind, baseColor ?? "#dfe6ec", { length: 4.8, width: 2.1, bodyH: 0.85, cabinH: 0.72, cabinZ: -0.25, ride: 0.38, wheelR: 0.47, wheelZ: 1.55 });
    case "taxi":
      return carOf(kind, baseColor ?? "#ffd23d", { length: 4.6, width: 1.95, bodyH: 0.6, cabinH: 0.55, cabinZ: -0.15, ride: 0.32, wheelR: 0.4, wheelZ: 1.45 });
    case "police":
      return carOf(kind, baseColor ?? "#f4f7fb", { length: 4.7, width: 2.0, bodyH: 0.55, cabinH: 0.52, cabinZ: -0.2, ride: 0.33, wheelR: 0.42, wheelZ: 1.5 });
    case "truck":
      return carOf(kind, baseColor ?? "#3b4a5a", { length: 5.4, width: 2.25, bodyH: 0.95, cabinH: 0.95, cabinZ: 1.1, ride: 0.5, wheelR: 0.55, wheelZ: 1.9 });
    case "bike":
      return buildBike(baseColor ?? "#00e0c6", false);
    case "sportbike":
      return buildBike(baseColor ?? "#ff3d8b", true);
    case "plane":
      return buildPlane(baseColor ?? "#eef2f7");
    case "heli":
      return buildHeli(baseColor ?? "#233244");
    case "tank":
      return buildTank(baseColor ?? "#606b39");
  }
}

// ---------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------

export interface BuiltPed {
  group: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  head: THREE.Object3D;
  hand: THREE.Group;
}

export function buildPed(opts: {
  shirt?: string;
  pants?: string;
  skin?: string;
  hair?: string;
  cop?: boolean;
  enemy?: boolean;
  player?: boolean;
  cap?: boolean;
  female?: boolean;
}): BuiltPed {
  const group = new THREE.Group();
  const skin = mat(opts.skin ?? "#b97a56", { roughness: 0.75, metalness: 0.05 });
  const shirtColor = opts.cop ? "#16283f" : opts.enemy ? "#47121b" : opts.shirt ?? "#2d3540";
  const shirt = mat(shirtColor, { roughness: 0.8, metalness: 0.1 });
  const pants = mat(opts.pants ?? (opts.cop ? "#0f1a26" : "#22262c"), { roughness: 0.9 });
  const shoe = mat("#0b0d10", { roughness: 0.8 });
  const hair = mat(opts.hair ?? "#1a1310", { roughness: 0.9 });

  const legL = new THREE.Group();
  legL.position.set(-0.13, 0.92, 0);
  box(legL, 0.19, 0.9, 0.22, 0, -0.45, 0, pants);
  box(legL, 0.21, 0.12, 0.32, 0, -0.88, 0.04, shoe);
  group.add(legL);

  const legR = new THREE.Group();
  legR.position.set(0.13, 0.92, 0);
  box(legR, 0.19, 0.9, 0.22, 0, -0.45, 0, pants);
  box(legR, 0.21, 0.12, 0.32, 0, -0.88, 0.04, shoe);
  group.add(legR);

  const torsoW = opts.female ? 0.44 : 0.52;
  box(group, torsoW, 0.64, 0.29, 0, 1.3, 0, shirt);
  if (opts.player) {
    box(group, torsoW + 0.03, 0.32, 0.31, 0, 1.12, 0, mat("#c8ff3d", { metalness: 0.3, roughness: 0.5 }));
    box(group, 0.09, 0.5, 0.02, 0, 1.35, 0.16, mat("#101408"));
    box(group, torsoW + 0.04, 0.16, 0.3, 0, 1.56, 0, mat("#171b16", { roughness: 0.6 }));
  }
  if (opts.cop) {
    box(group, 0.5, 0.08, 0.31, 0, 1.42, 0, mat("#c8ff3d", { emissive: "#8cff00", emissiveIntensity: 0.25 }));
    box(group, 0.2, 0.12, 0.05, 0.14, 1.32, 0.17, mat("#ffd23d", { metalness: 0.9, roughness: 0.2 }));
  }
  if (opts.enemy) {
    box(group, torsoW + 0.02, 0.14, 0.3, 0, 1.42, 0, mat("#0c0d10", { roughness: 0.8 }));
  }
  // neck + head
  box(group, 0.14, 0.1, 0.14, 0, 1.66, 0, skin);
  const head = sphere(group, 0.21, 0, 1.82, 0, skin, 1.1);
  if (opts.cop) {
    box(group, 0.42, 0.1, 0.42, 0, 1.94, 0, mat("#13243a", { metalness: 0.2 }));
    box(group, 0.3, 0.06, 0.16, 0, 1.88, 0.2, mat("#0b0f14", { metalness: 0.4, roughness: 0.2 }));
  } else {
    sphere(group, 0.215, 0, 1.87, -0.03, hair, 0.75);
    if (opts.cap) {
      box(group, 0.42, 0.14, 0.42, 0, 1.98, 0, mat("#c8ff3d", { roughness: 0.6 }));
      box(group, 0.34, 0.05, 0.24, 0, 1.94, 0.24, mat("#0e120a"));
    }
    box(group, 0.05, 0.04, 0.02, -0.08, 1.84, 0.2, mat("#141414"));
    box(group, 0.05, 0.04, 0.02, 0.08, 1.84, 0.2, mat("#141414"));
  }
  const armL = new THREE.Group();
  armL.position.set(-torsoW / 2 - 0.06, 1.55, 0);
  box(armL, 0.14, 0.62, 0.18, 0, -0.3, 0, opts.player ? shirt : shirt);
  box(armL, 0.12, 0.1, 0.12, 0, -0.63, 0, skin);
  group.add(armL);

  const armR = new THREE.Group();
  armR.position.set(torsoW / 2 + 0.06, 1.55, 0);
  box(armR, 0.14, 0.62, 0.18, 0, -0.3, 0, shirt);
  const hand = new THREE.Group();
  hand.position.set(0, -0.62, 0);
  sphere(hand, 0.075, 0, 0, 0, skin);
  armR.add(hand);
  group.add(armR);

  return { group, armL, armR, legL, legR, head, hand };
}

// ---------------------------------------------------------------------------
// Weapon props
// ---------------------------------------------------------------------------

export function buildWeaponMesh(id: WeaponId): THREE.Group | null {
  if (id === "fists") return null;
  const group = new THREE.Group();
  const steel = mat("#2b323a", { metalness: 0.9, roughness: 0.3 });
  const dark = mat("#11151a", { metalness: 0.5, roughness: 0.7 });
  const accent = mat("#c8ff3d", { emissive: "#8cff00", emissiveIntensity: 0.3, metalness: 0.4 });
  if (id === "pistol") {
    box(group, 0.07, 0.12, 0.32, 0, 0, 0.1, steel);
    box(group, 0.06, 0.19, 0.1, 0, -0.13, 0.0, dark);
    box(group, 0.03, 0.03, 0.06, 0, 0.07, 0.26, accent);
  } else if (id === "smg") {
    box(group, 0.09, 0.14, 0.5, 0, 0, 0.1, steel);
    box(group, 0.06, 0.24, 0.12, 0, -0.18, 0.14, dark);
    box(group, 0.05, 0.1, 0.22, 0, -0.02, -0.2, dark);
    box(group, 0.03, 0.04, 0.5, 0, 0.08, 0.08, accent);
  } else if (id === "shotgun") {
    box(group, 0.1, 0.12, 0.75, 0, 0, 0.2, steel);
    box(group, 0.08, 0.08, 0.5, 0, -0.08, 0.3, dark);
    box(group, 0.1, 0.16, 0.3, 0, -0.02, -0.25, dark);
    box(group, 0.04, 0.04, 0.3, 0, 0.09, 0.2, accent);
  } else if (id === "rifle") {
    box(group, 0.09, 0.12, 0.95, 0, 0, 0.25, steel);
    box(group, 0.07, 0.22, 0.16, 0, -0.15, 0.2, dark);
    box(group, 0.1, 0.14, 0.34, 0, 0, -0.28, dark);
    box(group, 0.05, 0.08, 0.26, 0, 0.05, 0.6, accent);
    box(group, 0.05, 0.16, 0.05, 0, -0.12, 0.55, steel);
  } else {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.5, 10), mat("#39432a", { metalness: 0.5, roughness: 0.6 }));
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0, 0.2);
    group.add(tube);
    box(group, 0.1, 0.26, 0.16, 0, -0.2, 0.05, dark);
    const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 10), mat("#ff3d3d", { metalness: 0.4, roughness: 0.4 }));
    warhead.rotation.x = Math.PI / 2;
    warhead.position.set(0, 0, 1.05);
    group.add(warhead);
    box(group, 0.05, 0.16, 0.16, 0, 0.16, 0.3, accent);
  }
  group.scale.setScalar(1.25);
  return group;
}

// ---------------------------------------------------------------------------
// Pickups & world glow
// ---------------------------------------------------------------------------

let glowTexture: THREE.Texture | null = null;
export function getGlowTexture(): THREE.Texture {
  if (glowTexture) return glowTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.8)");
  grad.addColorStop(0.55, "rgba(255,255,255,0.25)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  glowTexture = new THREE.CanvasTexture(c);
  return glowTexture;
}

export type PickupKind = "health" | "armor" | "cash" | "ammo" | "nitro" | "skill";

export function buildPickupMesh(kind: PickupKind): THREE.Group {
  const g = new THREE.Group();
  const colors: Record<PickupKind, string> = {
    health: "#42ff8b",
    armor: "#3db9ff",
    cash: "#ffd23d",
    ammo: "#ff8c1a",
    nitro: "#ff3d8b",
    skill: "#c47dff",
  };
  const color = colors[kind];
  const m = mat(color, { emissive: color, emissiveIntensity: 1.1, metalness: 0.4, roughness: 0.3 });
  if (kind === "health") {
    box(g, 0.14, 0.5, 0.14, 0, 0, 0, m);
    box(g, 0.5, 0.14, 0.14, 0, 0, 0, m);
  } else if (kind === "armor") {
    box(g, 0.42, 0.44, 0.1, 0, 0, 0, m);
    box(g, 0.28, 0.16, 0.12, 0, -0.24, 0, m);
  } else if (kind === "cash") {
    box(g, 0.44, 0.26, 0.16, 0, 0, 0, m);
    box(g, 0.46, 0.06, 0.18, 0, 0.08, 0, mat("#1a1a1a"));
  } else if (kind === "ammo") {
    box(g, 0.4, 0.26, 0.24, 0, 0, 0, m);
    box(g, 0.08, 0.18, 0.06, -0.1, 0.16, 0, mat("#2b2b2b"));
    box(g, 0.08, 0.18, 0.06, 0.1, 0.16, 0, mat("#2b2b2b"));
  } else if (kind === "nitro") {
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.5, 10), m);
    g.add(bottle);
    box(g, 0.1, 0.1, 0.1, 0, 0.3, 0, mat("#e5e5e5", { metalness: 0.9 }));
  } else {
    const oct = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), m);
    g.add(oct);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.02, 6, 24), mat("#ffffff", { emissive: color, emissiveIntensity: 1.4 }));
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
  }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(1.8);
  g.add(halo);
  return g;
}

// ---------------------------------------------------------------------------
// Building facades
// ---------------------------------------------------------------------------

const windowTexCache = new Map<string, THREE.Texture>();
export function makeWindowTexture(base: string, lit: string, density = 0.5): THREE.Texture {
  const key = `${base}-${lit}-${density}`;
  const cached = windowTexCache.get(key);
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = 96;
  c.height = 192;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, c.width, c.height);
  const cols = 6;
  const rows = 14;
  const cw = c.width / cols;
  const ch = c.height / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const on = Math.random() < density;
      const shade = Math.random();
      ctx.fillStyle = on
        ? shade > 0.55
          ? lit
          : shade > 0.3
          ? "#ffe9bd"
          : "#a9d6ff"
        : `rgba(12,16,26,${0.55 + Math.random() * 0.35})`;
      if (on) ctx.globalAlpha = 0.5 + Math.random() * 0.5;
      ctx.fillRect(x * cw + cw * 0.2, y * ch + ch * 0.22, cw * 0.6, ch * 0.46);
      ctx.globalAlpha = 1;
    }
  }
  // concrete bands
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  for (let y = 0; y < rows; y++) ctx.fillRect(0, y * ch, c.width, 1.5);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  windowTexCache.set(key, tex);
  return tex;
}
