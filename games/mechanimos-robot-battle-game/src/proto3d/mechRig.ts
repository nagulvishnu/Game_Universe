// PHASE 6D — in-code authored "AURORA-01" prototype character.
// Original procedural design (no external/AI assets; authored directly in
// Three.js geometry per user instruction). NOT a canonical roster identity.
// Phase 6D: taller, more humanoid robot silhouette (~+25% height) with layered
// chest, defined waist, shoulder-integrated wheels, longer articulated limbs,
// and a distinct helmeted head. Same part names, pivots, and windows as 6A/6B
// so poses/windows/state machine are unchanged.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface PartPose {
  pos: [number, number, number];
  rot: [number, number, number];
  scale?: [number, number, number];
}

export interface MechPart {
  name: string;
  group: THREE.Group;
  car: PartPose;
  robot: PartPose;
  win: [number, number];
}

export interface MechRig {
  root: THREE.Group;
  parts: MechPart[];
  wheels: THREE.Mesh[];
  burstRing: THREE.Mesh;
  accents: THREE.MeshStandardMaterial[];
  dispose(): void;
}

// ---------- materials ----------
const M = {
  armor: () => new THREE.MeshStandardMaterial({ color: 0x2f3c68, metalness: 0.9, roughness: 0.32 }),
  armorMid: () => new THREE.MeshStandardMaterial({ color: 0x465892, metalness: 0.88, roughness: 0.36 }),
  armorLight: () => new THREE.MeshStandardMaterial({ color: 0xaebfdf, metalness: 0.85, roughness: 0.26 }),
  dark: () => new THREE.MeshStandardMaterial({ color: 0x11162a, metalness: 0.65, roughness: 0.5 }),
  joint: () => new THREE.MeshStandardMaterial({ color: 0x1c2340, metalness: 0.95, roughness: 0.25 }),
  glass: () => new THREE.MeshStandardMaterial({
    color: 0x8fe8ff, metalness: 0.95, roughness: 0.08,
    emissive: 0x0c4a5e, emissiveIntensity: 0.6,
  }),
  accent: () => new THREE.MeshStandardMaterial({
    color: 0x18e0ff, emissive: 0x18e0ff, emissiveIntensity: 1.7,
    metalness: 0.35, roughness: 0.28,
  }),
  accentDim: () => new THREE.MeshStandardMaterial({
    color: 0x0e9fbe, emissive: 0x0e9fbe, emissiveIntensity: 0.9,
    metalness: 0.4, roughness: 0.35,
  }),
  tire: () => new THREE.MeshStandardMaterial({ color: 0x0c0f1a, metalness: 0.25, roughness: 0.85 }),
  rim: () => new THREE.MeshStandardMaterial({ color: 0xc3d2ec, metalness: 0.95, roughness: 0.18 }),
};

function rbox(
  w: number, h: number, d: number, r: number,
  mat: THREE.Material, x = 0, y = 0, z = 0,
  rot?: [number, number, number],
): THREE.Mesh {
  const geo = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2));
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(
  rt: number, rb: number, h: number, mat: THREE.Material,
  x = 0, y = 0, z = 0, rot?: [number, number, number], seg = 16,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Angled wedge plate (trapezoid) built from a box with tapered top via scale trick. */
function plate(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, rot?: [number, number, number]): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d, 1, 1, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const py = pos.getY(i);
    if (py > 0) { // taper top vertices inward for a beveled-plate look
      pos.setX(i, pos.getX(i) * 0.82);
      pos.setZ(i, pos.getZ(i) * 0.82);
    }
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function part(name: string, car: PartPose, robot: PartPose, win: [number, number]): MechPart {
  const group = new THREE.Group();
  group.name = name;
  return { name, group, car, robot, win };
}

/**
 * Phase 6C — merge a part group's DIRECT mesh children by material.
 * Bakes each mesh's local transform into its geometry, then replaces N meshes
 * with one mesh per material. Part-group pivots, nested child groups (arms,
 * legs), materials, and per-part transforms are untouched, so the transform
 * state machine and poses behave identically with fewer draw calls.
 * Geometries are normalized to non-indexed with position+normal+uv only, so
 * mixed primitives (rounded boxes, cylinders, plates) merge reliably.
 */
function mergeGroupMeshes(group: THREE.Group, disposables: { dispose(): void }[]): void {
  const buckets = new Map<THREE.Material, THREE.Mesh[]>();
  for (const child of [...group.children]) {
    if (child instanceof THREE.Mesh && !Array.isArray(child.material)) {
      const list = buckets.get(child.material) ?? [];
      list.push(child);
      buckets.set(child.material, list);
    }
  }
  for (const [mat, meshes] of buckets) {
    if (meshes.length < 2) continue;
    const geos: THREE.BufferGeometry[] = [];
    for (const m of meshes) {
      m.updateMatrix();
      let g = m.geometry.clone();
      if (g.index) { const n = g.toNonIndexed(); g.dispose(); g = n; }
      for (const name of Object.keys(g.attributes)) {
        if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
      }
      g.applyMatrix4(m.matrix);
      geos.push(g);
    }
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = `${group.name}_merged`;
    mesh.castShadow = meshes.some((m) => m.castShadow);
    mesh.receiveShadow = meshes.some((m) => m.receiveShadow);
    for (const m of meshes) {
      group.remove(m);
      disposables.push(m.geometry); // originals no longer in scene
    }
    group.add(mesh);
    disposables.push(merged);
  }
}

export function buildMechRig(): MechRig {
  const root = new THREE.Group();
  root.name = 'mechRoot';
  const parts: MechPart[] = [];
  const wheels: THREE.Mesh[] = [];
  const accents: THREE.MeshStandardMaterial[] = [];
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(x: T): T => { disposables.push(x); return x; };

  const armor = track(M.armor());
  const armorMid = track(M.armorMid());
  const armorLight = track(M.armorLight());
  const dark = track(M.dark());
  const joint = track(M.joint());
  const glass = track(M.glass());
  const acc = track(M.accent());
  const accDim = track(M.accentDim());
  const tireMat = track(M.tire());
  const rimMat = track(M.rim());
  accents.push(acc, accDim);

  // ================= CHASSIS (hull -> torso) =================
  // Robot: raised torso with layered chest + narrower tapered waist.
  // Scale y kept moderate so chest/collar details stay BELOW the head line.
  const chassis = part('chassis',
    { pos: [0, 0.62, 0], rot: [0, 0, 0], scale: [1, 1, 1] },
    { pos: [0, 1.8, 0], rot: [-0.05, 0, 0], scale: [0.82, 1.28, 0.5] },
    [0.15, 0.65]);
  {
    const g = chassis.group;
    // main hull — layered
    g.add(rbox(2.0, 0.34, 3.3, 0.09, armor));
    g.add(rbox(1.86, 0.16, 3.1, 0.06, armorMid, 0, 0.22, 0));           // upper deck
    g.add(rbox(2.06, 0.1, 2.6, 0.04, dark, 0, -0.18, 0));               // undertray
    // side skirts with vent lines
    for (const s of [-1, 1]) {
      g.add(rbox(0.12, 0.22, 2.3, 0.04, armorLight, s * 1.0, -0.02, 0.1));
      for (let i = 0; i < 3; i++) {
        g.add(rbox(0.05, 0.06, 0.22, 0.015, dark, s * 1.06, 0.0, 0.7 - i * 0.34));
      }
    }
    // cabin canopy base + glass
    g.add(rbox(1.3, 0.22, 1.35, 0.07, armorMid, 0, 0.36, -0.25));
    g.add(rbox(1.12, 0.2, 1.15, 0.09, glass, 0, 0.5, -0.22));
    // roof intake scoop
    g.add(rbox(0.5, 0.1, 0.6, 0.03, dark, 0, 0.62, -0.55));
    g.add(rbox(0.34, 0.05, 0.44, 0.02, accDim, 0, 0.66, -0.55));
    // chest energy strips (become robot chest glow)
    for (const s of [-1, 1]) {
      g.add(rbox(0.5, 0.05, 0.06, 0.015, acc, s * 0.42, 0.14, 1.64));
    }
    g.add(rbox(0.24, 0.05, 0.06, 0.015, acc, 0, -0.02, 1.66));
    // rear deck vents
    for (let i = 0; i < 4; i++) {
      g.add(rbox(1.2, 0.04, 0.08, 0.01, dark, 0, 0.32, -0.75 - i * 0.14));
    }
    // ---- robot torso: layered chest pushed forward of the hull + tapered waist ----
    // All coordinates below assume the robot scale above; the chest block tops
    // out under the head so the visor stays visible from the gameplay camera.
    // central raised chest block (front proud of hull nose z=1.65)
    g.add(rbox(1.0, 0.56, 0.95, 0.14, armorLight, 0, 0.36, 1.28));
    g.add(rbox(0.44, 0.4, 0.34, 0.08, accDim, 0, 0.36, 1.88));            // central chest core glow
    // angled pectoral plates flanking the core
    for (const s of [-1, 1]) {
      g.add(plate(0.5, 0.56, 0.55, armorMid, s * 0.5, 0.36, 1.35, [0.12, s * -0.22, s * 0.14]));
      g.add(rbox(0.09, 0.38, 0.36, 0.03, dark, s * 0.78, 0.36, 1.4));      // pectoral seam
    }
    // collar / neck gorset rising toward head (set back behind the chest block)
    g.add(rbox(0.6, 0.3, 0.5, 0.1, armor, 0, 0.58, 0.5));
    // waist band + energy line (below the chest block, on the hull front)
    g.add(rbox(0.8, 0.28, 0.7, 0.08, joint, 0, 0.1, 1.0));
    g.add(rbox(0.5, 0.12, 0.4, 0.04, accDim, 0, 0.0, 1.7));                 // waist energy line
    // ab-plate seams on the chest block face
    for (const s of [-1, 0, 1]) {
      g.add(rbox(0.14, 0.2, 0.1, 0.02, dark, s * 0.22, 0.2, 1.78));
    }
  }
  root.add(chassis.group);
  parts.push(chassis);

  // ================= HOOD / NOSE (-> pelvis) =================
  // Robot: slimmed + raised so it forms a narrow pelvis, not a broad car nose.
  const hood = part('hood',
    { pos: [0, 0.55, 2.05], rot: [0, 0, 0], scale: [1, 1, 1] },
    { pos: [0, 1.34, 0.05], rot: [0.22, 0, 0], scale: [0.52, 0.9, 0.62] },
    [0.25, 0.60]);
  {
    const g = hood.group;
    g.add(rbox(1.9, 0.26, 1.3, 0.09, armor));
    g.add(plate(1.7, 0.14, 1.05, armorMid, 0, 0.18, 0.05));            // sloped hood cover
    // nose cone + splitter
    g.add(rbox(1.3, 0.16, 0.4, 0.06, armorLight, 0, -0.02, 0.72));
    g.add(rbox(1.96, 0.06, 0.28, 0.02, dark, 0, -0.14, 0.78));
    // headlights — angular emissive blades
    for (const s of [-1, 1]) {
      g.add(rbox(0.42, 0.07, 0.06, 0.02, acc, s * 0.55, 0.05, 0.9, [0, s * 0.22, 0]));
    }
    // grille slats
    for (let i = 0; i < 3; i++) {
      g.add(rbox(0.9, 0.03, 0.04, 0.01, dark, 0, -0.06 + i * 0.05, 0.88));
    }
    // hood vents
    for (const s of [-1, 1]) {
      g.add(rbox(0.3, 0.05, 0.5, 0.02, dark, s * 0.5, 0.26, 0.1));
    }
    // pelvis front plate detail (hidden in car mode orientation)
    g.add(rbox(0.5, 0.12, 0.1, 0.03, accDim, 0, 0.1, 0.66));
  }
  root.add(hood.group);
  parts.push(hood);

  // ================= REAR DECK (-> backpack) =================
  const rear = part('rear',
    { pos: [0, 0.6, -1.95], rot: [0, 0, 0], scale: [1, 1, 1] },
    { pos: [0, 1.98, -0.62], rot: [-0.18, 0, 0], scale: [0.6, 0.95, 0.6] },
    [0.25, 0.60]);
  {
    const g = rear.group;
    g.add(rbox(1.85, 0.3, 1.05, 0.08, armor));
    // spoiler wing + struts
    g.add(rbox(1.9, 0.06, 0.3, 0.02, armorLight, 0, 0.34, -0.28, [0.12, 0, 0]));
    for (const s of [-1, 1]) {
      g.add(rbox(0.08, 0.26, 0.1, 0.02, dark, s * 0.72, 0.2, -0.28));
    }
    // taillight bar
    g.add(rbox(1.55, 0.07, 0.05, 0.02, acc, 0, 0.06, -0.54));
    // quad exhausts
    for (const s of [-1, 1]) {
      g.add(cyl(0.07, 0.08, 0.22, joint, s * 0.42, -0.08, -0.56, [Math.PI / 2, 0, 0], 12));
      g.add(cyl(0.05, 0.05, 0.02, accDim, s * 0.58, -0.08, -0.56, [Math.PI / 2, 0, 0], 10));
      g.add(cyl(0.07, 0.08, 0.22, joint, s * 0.58, -0.08, -0.56, [Math.PI / 2, 0, 0], 12));
    }
    // backpack thruster pods (car: rear vents)
    for (const s of [-1, 1]) {
      g.add(rbox(0.34, 0.4, 0.5, 0.07, armorMid, s * 0.5, 0.3, -0.1));
      g.add(cyl(0.1, 0.12, 0.16, dark, s * 0.5, 0.34, -0.4, [Math.PI / 2, 0, 0], 12));
      g.add(cyl(0.06, 0.06, 0.03, acc, s * 0.5, 0.34, -0.48, [Math.PI / 2, 0, 0], 10));
    }
  }
  root.add(rear.group);
  parts.push(rear);

  // ================= HEAD =================
  // Robot: raised helmeted head with crest, visor, and visible neck.
  const head = part('head',
    { pos: [0, 0.8, -1.3], rot: [0, 0, 0], scale: [1, 0.65, 1] },
    { pos: [0, 2.62, 0.12], rot: [0, 0, 0], scale: [1.12, 1.12, 1.12] },
    [0.65, 0.95]);
  {
    const g = head.group;
    // neck (connects down to collar)
    g.add(cyl(0.11, 0.13, 0.26, joint, 0, -0.1, 0));
    g.add(rbox(0.2, 0.1, 0.2, 0.04, dark, 0, 0.0, 0.02));              // neck collar ring
    // helmet main
    g.add(rbox(0.42, 0.36, 0.46, 0.1, armorLight, 0, 0.2, 0));
    g.add(rbox(0.36, 0.14, 0.34, 0.05, armor, 0, 0.4, -0.02));         // crown
    // face + visor
    g.add(rbox(0.32, 0.2, 0.12, 0.04, dark, 0, 0.15, 0.22));
    g.add(rbox(0.34, 0.09, 0.05, 0.015, acc, 0, 0.22, 0.26));          // visor eye-slit
    // jaw guard
    g.add(rbox(0.24, 0.1, 0.14, 0.03, armorMid, 0, 0.03, 0.2));
    // crest fin (raised)
    g.add(plate(0.07, 0.2, 0.4, acc, 0, 0.52, -0.02));
    g.add(plate(0.05, 0.12, 0.24, armorLight, 0, 0.5, -0.18, [0.4, 0, 0])); // rear crest taper
    // side antennae
    for (const s of [-1, 1]) {
      g.add(plate(0.04, 0.1, 0.22, armor, s * 0.24, 0.34, -0.08, [0.3, 0, s * 0.5]));
    }
  }
  root.add(head.group);
  parts.push(head);

  // ================= ARMS (shoulder panel -> upper arm; forearm) =================
  // Robot: longer upper arm + forearm, defined elbow + wrist, shoulder pauldron.
  const mkArm = (side: -1 | 1): MechPart[] => {
    const s = side === -1 ? 'L' : 'R';
    const rz = side * 0.26;
    const shoulder = part(`shoulder${s}`,
      { pos: [side * 1.14, 0.58, 0.1], rot: [Math.PI / 2, 0, 0], scale: [1, 1, 1] },
      { pos: [side * 0.98, 2.2, 0], rot: [0, 0, rz], scale: [1, 1, 1] },
      [0.30, 0.62]);
    {
      const g = shoulder.group;
      // door panel (car) / upper arm (robot) — lengthened
      g.add(rbox(0.18, 1.15, 0.5, 0.05, armor));
      g.add(rbox(0.07, 0.9, 0.38, 0.02, armorLight, side * 0.09, -0.12, 0));  // outer trim
      g.add(rbox(0.05, 0.34, 0.3, 0.015, acc, side * 0.11, -0.9, 0));          // bicep glow
      // shoulder pauldron (robot) — larger angled cap
      g.add(plate(0.44, 0.3, 0.54, armorMid, side * 0.08, 0.02, 0, [0, 0, side * 0.4]));
      g.add(rbox(0.12, 0.24, 0.4, 0.03, armorLight, side * 0.22, 0.14, 0, [0, 0, side * 0.4])); // pauldron rim
      // door handle detail (car)
      g.add(rbox(0.03, 0.04, 0.16, 0.01, joint, side * 0.1, -0.15, 0.15));
      // elbow joint
      g.add(cyl(0.11, 0.11, 0.22, joint, 0, -1.15, 0, [0, 0, Math.PI / 2], 14));
    }

    // forearm — lengthened with visible wrist
    const forearm = part(`forearm${s}`,
      { pos: [0, -1.15, 0], rot: [-Math.PI / 2, 0, 0], scale: [1, 0.55, 1] },
      { pos: [0, -1.15, 0], rot: [0.12, 0, 0], scale: [1, 1, 1] },
      [0.42, 0.72]);
    {
      const g = forearm.group;
      g.add(rbox(0.2, 0.68, 0.28, 0.05, armorLight, 0, -0.34, 0));
      g.add(rbox(0.14, 0.58, 0.2, 0.03, armorMid, 0, -0.34, 0.02));
      g.add(rbox(0.07, 0.4, 0.05, 0.015, acc, 0, -0.3, 0.14));             // forearm energy line
      // wrist + fist
      g.add(cyl(0.09, 0.09, 0.12, joint, 0, -0.72, 0));
      g.add(rbox(0.26, 0.24, 0.32, 0.06, dark, 0, -0.9, 0.02));
      // knuckle plates
      for (let i = 0; i < 3; i++) {
        g.add(rbox(0.07, 0.06, 0.05, 0.015, armorLight, -0.08 + i * 0.08, -0.82, 0.19));
      }
    }
    shoulder.group.add(forearm.group);
    root.add(shoulder.group);
    return [shoulder, forearm];
  };
  parts.push(...mkArm(-1), ...mkArm(1));

  // ================= LEGS =================
  // Robot: longer thigh + shin, distinct knee, larger planted foot.
  const mkLeg = (side: -1 | 1): MechPart[] => {
    const s = side === -1 ? 'L' : 'R';
    const hip = part(`hip${s}`,
      { pos: [side * 0.55, 0.44, -0.5], rot: [1.5, 0, 0], scale: [1, 1, 1] },
      { pos: [side * 0.4, 1.5, 0], rot: [0, 0, 0], scale: [1, 1, 1] },
      [0.35, 0.70]);
    {
      const g = hip.group;
      g.add(rbox(0.32, 0.72, 0.38, 0.07, armor));                         // thigh (lengthened)
      g.add(rbox(0.36, 0.4, 0.42, 0.09, armorMid, 0, -0.08, 0));           // thigh bulk
      g.add(rbox(0.06, 0.28, 0.22, 0.015, accDim, side * 0.17, -0.24, 0));  // side glow
      // wheel-well arch (car underside detail)
      g.add(rbox(0.36, 0.1, 0.5, 0.04, dark, 0, 0.28, 0.05));
    }

    const shin = part(`shin${s}`,
      { pos: [0, -0.72, 0], rot: [-1.55, 0, 0], scale: [1, 1, 1] },
      { pos: [0, -0.72, 0], rot: [0, 0, 0], scale: [1, 1, 1] },
      [0.45, 0.78]);
    {
      const g = shin.group;
      g.add(rbox(0.28, 0.62, 0.32, 0.06, armorLight));                     // shin (lengthened)
      g.add(plate(0.22, 0.5, 0.14, armor, 0, -0.06, 0.18));                // shin guard plate
      g.add(rbox(0.07, 0.42, 0.04, 0.01, acc, 0, -0.12, 0.22));            // shin energy line
      g.add(cyl(0.11, 0.11, 0.16, joint, 0, 0, 0, [0, 0, Math.PI / 2], 14)); // knee
      g.add(rbox(0.22, 0.2, 0.24, 0.05, armorMid, 0, -0.36, -0.16));       // calf
    }

    const foot = part(`foot${s}`,
      { pos: [0, -0.62, 0], rot: [0.9, 0, 0], scale: [1, 1, 1] },
      { pos: [0, -0.62, 0], rot: [0, 0, 0], scale: [1, 1, 1] },
      [0.50, 0.82]);
    {
      const g = foot.group;
      g.add(rbox(0.34, 0.16, 0.72, 0.05, dark, 0, -0.08, 0.14));           // boot (larger)
      g.add(rbox(0.36, 0.09, 0.24, 0.03, armorLight, 0, -0.05, 0.42));     // toe plate
      g.add(rbox(0.26, 0.12, 0.16, 0.03, armorMid, 0, -0.06, -0.14));      // heel
      g.add(rbox(0.22, 0.03, 0.1, 0.01, accDim, 0, -0.15, 0.36));          // toe glow
    }

    shin.group.add(foot.group);
    hip.group.add(shin.group);
    root.add(hip.group);
    return [hip, shin, foot];
  };
  parts.push(...mkLeg(-1), ...mkLeg(1));

  // ================= WHEELS =================
  const mkWheel = (): THREE.Group => {
    const w = new THREE.Group();
    const tire = cyl(0.36, 0.36, 0.26, tireMat, 0, 0, 0, [0, 0, Math.PI / 2], 22);
    w.add(tire);
    w.add(cyl(0.37, 0.37, 0.18, tireMat, 0, 0, 0, [0, 0, Math.PI / 2], 22));
    for (const sx of [-1, 1]) {
      w.add(cyl(0.22, 0.22, 0.03, rimMat, sx * 0.13, 0, 0, [0, 0, Math.PI / 2], 16));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const spoke = rbox(0.03, 0.3, 0.05, 0.01, rimMat, sx * 0.14, Math.sin(a) * 0.1, Math.cos(a) * 0.1, [a, 0, 0]);
        w.add(spoke);
      }
      w.add(cyl(0.07, 0.07, 0.04, acc, sx * 0.15, 0, 0, [0, 0, Math.PI / 2], 10));
    }
    return w;
  };

  // Robot: front wheels ride up beside the shoulder pauldrons; rear wheels tuck behind.
  const wheelDefs: { name: string; car: PartPose; robot: PartPose }[] = [
    { name: 'wheelFL', car: { pos: [-1.05, 0.36, 1.35], rot: [0, 0, 0] }, robot: { pos: [-1.28, 2.24, -0.1], rot: [0, 0, 0] } },
    { name: 'wheelFR', car: { pos: [1.05, 0.36, 1.35], rot: [0, 0, 0] }, robot: { pos: [1.28, 2.24, -0.1], rot: [0, 0, 0] } },
    { name: 'wheelRL', car: { pos: [-1.05, 0.36, -1.35], rot: [0, 0, 0] }, robot: { pos: [-0.62, 1.5, -0.62], rot: [0, 0, 0] } },
    { name: 'wheelRR', car: { pos: [1.05, 0.36, -1.35], rot: [0, 0, 0] }, robot: { pos: [0.62, 1.5, -0.62], rot: [0, 0, 0] } },
  ];
  for (const wd of wheelDefs) {
    const p = part(wd.name, wd.car, wd.robot, [0.05, 0.35]);
    const wg = mkWheel();
    mergeGroupMeshes(wg, disposables);
    wheels.push(...wg.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh));
    p.group.add(wg);
    root.add(p.group);
    parts.push(p);
  }

  for (const p of parts) mergeGroupMeshes(p.group, disposables);

  // ================= burst FX =================
  const ringGeo = track(new THREE.TorusGeometry(1, 0.045, 8, 40));
  const ringMat = track(new THREE.MeshBasicMaterial({
    color: 0x35f0ff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  const burstRing = new THREE.Mesh(ringGeo, ringMat);
  burstRing.rotation.x = -Math.PI / 2;
  burstRing.position.y = 0.06;
  burstRing.visible = false;
  root.add(burstRing);

  return {
    root, parts, wheels, burstRing, accents,
    dispose() {
      for (const d of disposables) d.dispose();
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = o.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m.dispose();
        }
      });
    },
  };
}

const smooth = (u: number): number => u * u * (3 - 2 * u);
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

/** Apply part poses for transform timeline t (0 = car, 1 = robot). */
export function poseRig(rig: MechRig, t: number): void {
  for (const p of rig.parts) {
    const u = smooth(clamp01((t - p.win[0]) / (p.win[1] - p.win[0])));
    const a = p.car, b = p.robot;
    p.group.position.set(
      a.pos[0] + (b.pos[0] - a.pos[0]) * u,
      a.pos[1] + (b.pos[1] - a.pos[1]) * u,
      a.pos[2] + (b.pos[2] - a.pos[2]) * u,
    );
    p.group.rotation.set(
      a.rot[0] + (b.rot[0] - a.rot[0]) * u,
      a.rot[1] + (b.rot[1] - a.rot[1]) * u,
      a.rot[2] + (b.rot[2] - a.rot[2]) * u,
    );
    const as = a.scale ?? [1, 1, 1];
    const bs = b.scale ?? [1, 1, 1];
    p.group.scale.set(
      as[0] + (bs[0] - as[0]) * u,
      as[1] + (bs[1] - as[1]) * u,
      as[2] + (bs[2] - as[2]) * u,
    );
  }
}
