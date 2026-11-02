import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CITY, DISTRICTS, districtAt, type DistrictId } from "./data";
import { mat, makeWindowTexture } from "./models";

export interface BoxCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
}

export interface CityWorld {
  group: THREE.Group;
  colliders: BoxCollider[];
  blocks: BoxCollider[];
  sun: THREE.DirectionalLight;
  roadPoints: { x: number; z: number }[];
  garage: { x: number; z: number };
  hospital: { x: number; z: number };
  helipad: { x: number; z: number };
  airport: { x: number; z: number };
  disposables: THREE.Material[];
}

const RND = (() => {
  let seed = 20260421;
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
})();
const rand = (a: number, b: number) => a + RND() * (b - a);
const pick = <T>(arr: T[]): T => arr[Math.floor(RND() * arr.length)];
const blockCenter = (i: number) => -208 + i * 52;
const roadCenter = (k: number) => -234 + k * 52;

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10);
const CONE = new THREE.ConeGeometry(1, 1, 8);

function box(
  parent: THREE.Object3D,
  material: THREE.Material,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  castShadow = false
) {
  const m = new THREE.Mesh(BOX, material);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = castShadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function cylinder(
  parent: THREE.Object3D,
  material: THREE.Material,
  r: number,
  h: number,
  x: number,
  y: number,
  z: number,
  rot?: [number, number, number]
) {
  const m = new THREE.Mesh(CYL, material);
  m.scale.set(r, h, r);
  m.position.set(x, y, z);
  if (rot) m.rotation.set(...rot);
  parent.add(m);
  return m;
}
function cone(parent: THREE.Object3D, material: THREE.Material, r: number, h: number, x: number, y: number, z: number) {
  const m = new THREE.Mesh(CONE, material);
  m.scale.set(r, h, r);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// ---------------------------------------------------------------------------
// textures
// ---------------------------------------------------------------------------

const FACADES: Record<string, THREE.MeshStandardMaterial> = {};

function facade(style: "downtown" | "neon" | "harbor" | "industrial") {
  if (FACADES[style]) return FACADES[style];
  const config = {
    downtown: { base: "#111c2b", lit: "#ffdca8", density: 0.44, metal: 0.55, rough: 0.4 },
    neon: { base: "#1b1124", lit: "#ff69cf", density: 0.5, metal: 0.45, rough: 0.45 },
    harbor: { base: "#1d262b", lit: "#ffcf8e", density: 0.3, metal: 0.3, rough: 0.65 },
    industrial: { base: "#24241f", lit: "#ffc46b", density: 0.22, metal: 0.25, rough: 0.75 },
  }[style];
  const tex = makeWindowTexture(config.base, config.lit, config.density).clone();
  tex.needsUpdate = true;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3.2, 9);
  const m = new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: new THREE.Color(config.lit),
    emissiveIntensity: 0.8,
    metalness: config.metal,
    roughness: config.rough,
  });
  FACADES[style] = m;
  return m;
}

function signTexture(text: string, color: string, sub?: string, bg = "#080a10") {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 512, 256);
  grad.addColorStop(0, bg);
  grad.addColorStop(1, "#111624");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.strokeRect(12, 12, 488, 232);
  ctx.shadowColor = color;
  ctx.shadowBlur = 26;
  ctx.fillStyle = color;
  ctx.font = "900 82px Impact, 'Arial Black', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, 256, 128);
  if (sub) {
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#f4f6f8";
    ctx.font = "600 30px Inter, Arial, sans-serif";
    ctx.fillText(sub, 256, 188);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}



// ---------------------------------------------------------------------------
// sky + water
// ---------------------------------------------------------------------------

function buildSky(group: THREE.Group) {
  const skyGeo = new THREE.SphereGeometry(1200, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {},
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vPos;
      void main() {
        vec3 dir = normalize(vPos);
        float h = clamp(dir.y * 1.25 + 0.08, -0.2, 1.0);
        vec3 top = vec3(0.035, 0.028, 0.10);
        vec3 mid = vec3(0.26, 0.10, 0.29);
        vec3 horizon = vec3(0.98, 0.40, 0.20);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.28, h));
        col = mix(col, top, smoothstep(0.24, 0.85, h));
        float sun = pow(max(dot(dir, normalize(vec3(0.55, 0.16, -0.82))), 0.0), 120.0);
        col += vec3(1.0, 0.55, 0.22) * sun * 1.4;
        float band = smoothstep(0.02, 0.06, h) * (1.0 - smoothstep(0.06, 0.16, h));
        col += vec3(0.9, 0.25, 0.22) * band * 0.18;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  group.add(sky);

  // stars
  const starGeo = new THREE.BufferGeometry();
  const positions: number[] = [];
  for (let i = 0; i < 700; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.75 + 0.18);
    const r = 1050;
    positions.push(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
  }
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: "#cfd8ff", size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0.65, depthWrite: false })
  );
  group.add(stars);

  // distant skyline silhouettes
  const silMat = new THREE.MeshStandardMaterial({ color: "#0b0a16", roughness: 1, metalness: 0 });
  for (let i = 0; i < 60; i++) {
    const angle = (i / 60) * Math.PI * 2 + rand(-0.03, 0.03);
    const radius = rand(470, 800);
    const h = rand(18, 130);
    box(group, silMat, rand(12, 40), h, rand(12, 40), Math.cos(angle) * radius, h / 2, Math.sin(angle) * radius);
  }
}

function buildWater(group: THREE.Group, disposables: THREE.Material[]) {
  const waterMat = new THREE.MeshStandardMaterial({
    color: "#06131d",
    metalness: 0.92,
    roughness: 0.18,
    emissive: "#08202c",
    emissiveIntensity: 0.5,
  });
  disposables.push(waterMat);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = CITY.waterY;
  group.add(water);
}

// ---------------------------------------------------------------------------
// city construction
// ---------------------------------------------------------------------------

/**
 * Collapses the thousands of small static props into a handful of draw calls.
 * Animated / instanced / custom-shader objects are left alone.
 */
function mergeStaticMeshes(root: THREE.Group) {
  root.updateMatrixWorld(true);
  const groups = new Map<string, { material: THREE.Material; castShadow: boolean; receiveShadow: boolean; geometries: THREE.BufferGeometry[] }>();
  const sources: THREE.Mesh[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh) return;
    if (Array.isArray(mesh.material)) return;
    const material = mesh.material as THREE.Material;
    if (!material || (material as THREE.ShaderMaterial).isShaderMaterial) return;
    if (mesh.userData.noMerge) return;
    const geo = mesh.geometry;
    if (!geo || !geo.attributes.position) return;
    const key = `${material.uuid}|${mesh.castShadow}|${mesh.receiveShadow}`;
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = { material, castShadow: mesh.castShadow, receiveShadow: mesh.receiveShadow, geometries: [] };
      groups.set(key, bucket);
    }
    let clone = geo.clone();
    if (clone.index) {
      const flat = clone.toNonIndexed();
      clone.dispose();
      clone = flat;
    }
    clone.applyMatrix4(mesh.matrixWorld);
    if (!clone.attributes.uv) {
      const count = clone.attributes.position.count;
      clone.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
    }
    bucket.geometries.push(clone);
    sources.push(mesh);
  });
  for (const mesh of sources) mesh.removeFromParent();
  for (const bucket of groups.values()) {
    if (!bucket.geometries.length) continue;
    const merged = mergeGeometries(bucket.geometries, false);
    bucket.geometries.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, bucket.material);
    mesh.castShadow = bucket.castShadow;
    mesh.receiveShadow = bucket.receiveShadow;
    mesh.frustumCulled = false;
    root.add(mesh);
  }
}

export function buildCity(scene: THREE.Scene): CityWorld {
  const group = new THREE.Group();
  scene.add(group);
  const colliders: BoxCollider[] = [];
  const blocks: BoxCollider[] = [];
  const disposables: THREE.Material[] = [];

  scene.background = new THREE.Color("#150f22");
  scene.fog = new THREE.FogExp2("#241a30", 0.0024);

  buildSky(group);
  buildWater(group, disposables);

  // ground / island
  const asphalt = mat("#181b21", { roughness: 0.92, metalness: 0.05 });
  const slab = box(group, asphalt, 500, 1.6, 500, 0, -0.8, 0);
  slab.receiveShadow = true;
  // seawall with neon edge
  const wallMat = mat("#252a32", { roughness: 0.8 });
  const neonEdge = mat("#c8ff3d", { emissive: "#c8ff3d", emissiveIntensity: 1.6 });
  const cyanEdge = mat("#2ad9ff", { emissive: "#2ad9ff", emissiveIntensity: 1.3 });
  for (const s of [-1, 1]) {
    box(group, wallMat, 500, 2.4, 4, 0, 0.6, s * 246);
    box(group, wallMat, 4, 2.4, 500, s * 246, 0.6, 0);
    box(group, s > 0 ? neonEdge : cyanEdge, 496, 0.1, 0.22, 0, 1.86, s * 243.8);
    box(group, s > 0 ? neonEdge : cyanEdge, 0.22, 0.1, 496, s * 243.8, 1.86, 0);
    for (let i = -12; i <= 12; i++) {
      box(group, wallMat, 0.14, 1.1, 0.14, i * 20, 1.4, s * 243);
    }
  }

  // lighting
  const hemi = new THREE.HemisphereLight("#9a8cff", "#3a2a26", 1.5);
  group.add(hemi);
  const sun = new THREE.DirectionalLight("#ffcf9a", 2.5);
  sun.position.set(120, 170, 80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 420;
  sun.shadow.camera.left = -85;
  sun.shadow.camera.right = 85;
  sun.shadow.camera.top = 85;
  sun.shadow.camera.bottom = -85;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  group.add(sun);
  group.add(sun.target);
  const fill = new THREE.DirectionalLight("#7fb0ff", 1.25);
  fill.position.set(-140, 90, -120);
  group.add(fill);
  const warm = new THREE.PointLight("#ff7a3d", 220, 400, 2);
  warm.position.set(0, 60, 0);
  group.add(warm);

  // ground materials
  const sidewalkMat = mat("#2a2f37", { roughness: 0.9 });
  const sidewalkAlt = mat("#31363f", { roughness: 0.88 });
  const grassMat = mat("#1d3625", { roughness: 1 });
  const lotMat = mat("#202329", { roughness: 0.95 });
  const roofMat = mat("#171a20", { roughness: 0.85 });
  const roofMatLight = mat("#262a31", { roughness: 0.8 });
  const neonPink = mat("#ff3d8b", { emissive: "#ff3d8b", emissiveIntensity: 1.7 });
  const neonCyan = mat("#2ad9ff", { emissive: "#2ad9ff", emissiveIntensity: 1.5 });
  const neonLime = mat("#c8ff3d", { emissive: "#a6ff00", emissiveIntensity: 1.5 });
  const neonAmber = mat("#ffb347", { emissive: "#ff9d1c", emissiveIntensity: 1.4 });
  const warehouseMat = mat("#2c333a", { roughness: 0.8, metalness: 0.25 });
  const rustMat = mat("#5b3a2a", { roughness: 0.85, metalness: 0.25 });
  const containerMats = [
    mat("#b8402e", { roughness: 0.78, metalness: 0.25 }),
    mat("#1f6f8b", { roughness: 0.78, metalness: 0.25 }),
    mat("#c48c2a", { roughness: 0.78, metalness: 0.25 }),
    mat("#3d6b45", { roughness: 0.78, metalness: 0.25 }),
    mat("#7a3d55", { roughness: 0.78, metalness: 0.25 }),
  ];
  const trunkMat = mat("#3b2a1c", { roughness: 1 });
  const leafMats = [mat("#1f4a2c", { roughness: 1 }), mat("#2a5a33", { roughness: 1 }), mat("#17402a", { roughness: 1 })];
  const poleMat = mat("#3a4048", { metalness: 0.8, roughness: 0.4 });
  const bulbMat = mat("#ffe6b0", { emissive: "#ffcf87", emissiveIntensity: 2.2 });

  const insideAnyCollider = (x: number, z: number, pad: number) => {
    for (const c of colliders) {
      if (x > c.minX - pad && x < c.maxX + pad && z > c.minZ - pad && z < c.maxZ + pad) return true;
    }
    return false;
  };

  const addCollider = (x: number, z: number, w: number, d: number, h: number) => {
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, height: h });
  };

  const addTree = (x: number, z: number, scale = 1, palm = false) => {
    const g = new THREE.Group();
    if (palm) {
      cylinder(g, trunkMat, 0.16 * scale, 3.2 * scale, 0, 1.6 * scale, 0);
      for (let i = 0; i < 6; i++) {
        const leaf = cone(g, leafMats[1], 0.35 * scale, 2.1 * scale, 0, 3.2 * scale, 0);
        leaf.rotation.z = Math.PI / 2.6;
        leaf.rotation.y = (i / 6) * Math.PI * 2;
        leaf.position.x = Math.cos((i / 6) * Math.PI * 2) * 0.6 * scale;
        leaf.position.z = Math.sin((i / 6) * Math.PI * 2) * 0.6 * scale;
      }
    } else {
      cylinder(g, trunkMat, 0.18 * scale, 1.8 * scale, 0, 0.9 * scale, 0);
      const foliage = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), leafMats[Math.floor(RND() * leafMats.length)]);
      foliage.scale.set(1.35 * scale, 1.6 * scale, 1.35 * scale);
      foliage.position.y = 2.5 * scale;
      g.add(foliage);
    }
    g.position.set(x, 0, z);
    group.add(g);
  };

  const addStreetLight = (x: number, z: number, dir = 1) => {
    const g = new THREE.Group();
    cylinder(g, poleMat, 0.08, 5.5, 0, 2.75, 0);
    box(g, poleMat, 1.5, 0.1, 0.12, 0.75 * dir, 5.45, 0);
    box(g, bulbMat, 0.5, 0.12, 0.24, 1.45 * dir, 5.36, 0);
    g.position.set(x, 0.2, z);
    group.add(g);
  };

  const addTrafficLight = (x: number, z: number) => {
    const g = new THREE.Group();
    cylinder(g, poleMat, 0.09, 4.4, 0, 2.2, 0);
    box(g, mat("#11151a"), 0.35, 0.9, 0.28, 0, 4.3, 0);
    box(g, neonPink, 0.16, 0.16, 0.05, 0, 4.55, 0.16);
    box(g, mat("#ffcf3d", { emissive: "#ffcf3d", emissiveIntensity: 1.2 }), 0.16, 0.16, 0.05, 0, 4.3, 0.16);
    box(g, mat("#2dff8a", { emissive: "#2dff8a", emissiveIntensity: 0.4 }), 0.16, 0.16, 0.05, 0, 4.05, 0.16);
    g.position.set(x, 0.2, z);
    group.add(g);
  };

  const addBillboard = (x: number, z: number, y: number, rot: number, text: string, sub: string, color: string) => {
    const g = new THREE.Group();
    cylinder(g, poleMat, 0.16, y, 0, y / 2, 0);
    const tex = signTexture(text, color, sub);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 5.5),
      new THREE.MeshStandardMaterial({ map: tex, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.9, side: THREE.DoubleSide, metalness: 0.1, roughness: 0.6 })
    );
    plane.position.y = y + 3;
    g.add(plane);
    box(g, poleMat, 11.4, 5.8, 0.3, 0, y + 3, -0.2);
    box(g, neonCyan, 11.5, 0.1, 0.1, 0, y + 5.85, 0.1);
    g.rotation.y = rot;
    g.position.set(x, 0, z);
    group.add(g);
  };

  // ---------------------------- blocks ------------------------------------
  for (let bx = 0; bx < CITY.blocks; bx++) {
    for (let bz = 0; bz < CITY.blocks; bz++) {
      const cx = blockCenter(bx);
      const cz = blockCenter(bz);
      const district = districtAt(cx, cz);
      const isAirfield = bx >= 7 && bz >= 7;
      const blockRect: BoxCollider = { minX: cx - 19, maxX: cx + 19, minZ: cz - 19, maxZ: cz + 19, height: 0.2 };
      if (!isAirfield) blocks.push(blockRect);
      if (isAirfield) continue;

      const isPark = (district === "suburb" && RND() < 0.24) || (district === "downtown" && bx === 3 && bz === 5) || (RND() < 0.05 && bx !== 4);
      const isLot = !isPark && RND() < 0.08;

      box(group, (bx + bz) % 2 ? sidewalkMat : sidewalkAlt, 38, 0.3, 38, cx, 0.15, cz, false);
      // curb edges
      box(group, mat("#454b55", { roughness: 0.9 }), 38.4, 0.2, 0.5, cx, 0.18, cz - 18.8);
      box(group, mat("#454b55", { roughness: 0.9 }), 38.4, 0.2, 0.5, cx, 0.18, cz + 18.8);
      box(group, mat("#454b55", { roughness: 0.9 }), 0.5, 0.2, 38.4, cx - 18.8, 0.18, cz);
      box(group, mat("#454b55", { roughness: 0.9 }), 0.5, 0.2, 38.4, cx + 18.8, 0.18, cz);

      if (isPark) {
        box(group, grassMat, 33, 0.1, 33, cx, 0.33, cz);
        for (let i = 0; i < 6; i++) addTree(cx + rand(-13, 13), cz + rand(-13, 13), rand(0.75, 1.25), district === "suburb");
        // paths
        box(group, sidewalkAlt, 33, 0.06, 3, cx, 0.36, cz);
        box(group, sidewalkAlt, 3, 0.06, 33, cx, 0.36, cz);
        // benches
        for (let i = 0; i < 3; i++) {
          const bxp = cx + rand(-11, 11);
          const bzp = cz + rand(-11, 11);
          box(group, mat("#6a4b2c", { roughness: 0.8 }), 2.2, 0.12, 0.5, bxp, 0.75, bzp);
          box(group, mat("#4a4f57", { metalness: 0.7 }), 0.12, 0.45, 0.5, bxp - 0.9, 0.5, bzp);
          box(group, mat("#4a4f57", { metalness: 0.7 }), 0.12, 0.45, 0.5, bxp + 0.9, 0.5, bzp);
        }
        continue;
      }

      if (isLot) {
        box(group, lotMat, 33, 0.08, 33, cx, 0.32, cz);
        for (let i = 0; i < 3; i++) {
          box(group, mat("#8a8f96", { roughness: 0.85 }), 0.1, 0.04, 5, cx - 10 + i * 9, 0.37, cz + rand(-8, 8));
        }
        addStreetLight(cx - 15, cz - 15);
        continue;
      }

      // ------------------------- downtown -------------------------
      if (district === "downtown") {
        if (bx === 4 && bz === 4) {
          // HAVOC SPIRE — central landmark
          const H = 168;
          const base = box(group, facade("downtown"), 30, 12, 30, cx, 6, cz, true);
          base.receiveShadow = true;
          const towerMat = facade("downtown");
          box(group, towerMat, 22, 118, 22, cx, 12 + 59, cz, true);
          box(group, towerMat, 16, 34, 16, cx, 12 + 118 + 17, cz, true);
          box(group, mat("#182433", { metalness: 0.9, roughness: 0.2 }), 6, H - 160, 6, cx, 160 + (H - 160) / 2, cz);
          box(group, neonLime, 22.4, 0.25, 22.4, cx, 12 + 118, cz);
          box(group, neonCyan, 16.4, 0.2, 16.4, cx, 12 + 118 + 34, cz);
          cylinder(group, mat("#3a4250", { metalness: 0.9 }), 0.16, 24, cx, H + 12, cz);
          box(group, mat("#ff2a44", { emissive: "#ff2a44", emissiveIntensity: 2.5 }), 0.5, 0.5, 0.5, cx, H + 25, cz);
          // illuminated lobby
          box(group, mat("#cfe3d8", { metalness: 0.35, roughness: 0.1, emissive: "#eaffe8", emissiveIntensity: 0.9 }), 26, 3.2, 26, cx, 1.9, cz);
          addCollider(cx, cz, 30, 30, H);
          // plaza + logo
          const tex = signTexture("HAVOC SPIRE", "#c8ff3d", "OBSIDIAN HEIGHTS", "#060a08");
          const p = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: "#ffffff", emissiveIntensity: 1.2, side: THREE.DoubleSide }));
          p.position.set(cx, 10, cz + 15.2);
          group.add(p);
        } else if (bx === 3 && bz === 5) {
          // plaza park handled above
        } else {
          const tw = rand(16, 28);
          const td = rand(16, 28);
          const H = RND() < 0.28 ? rand(100, 148) : rand(44, 96);
          box(group, facade("downtown"), tw, H, td, cx, H / 2 + 0.3, cz, H > 80);
          box(group, roofMat, tw + 1, 1.6, td + 1, cx, H + 0.5, cz);
          // crown
          if (H > 100) {
            box(group, mat("#1c2939", { metalness: 0.8, roughness: 0.35 }), tw * 0.6, 8, td * 0.6, cx, H + 5, cz);
            box(group, neonCyan, tw * 0.62, 0.18, td * 0.62, cx, H + 9, cz);
            cylinder(group, poleMat, 0.12, 14, cx, H + 16, cz);
            box(group, mat("#ff2a44", { emissive: "#ff2a44", emissiveIntensity: 2.2 }), 0.4, 0.4, 0.4, cx, H + 23, cz);
          } else {
            box(group, roofMatLight, 3, 1.2, 2, cx + tw * 0.2, H + 1.9, cz + td * 0.15);
            box(group, roofMatLight, 1.6, 1, 1.6, cx - tw * 0.2, H + 1.6, cz - td * 0.2);
          }
          addCollider(cx, cz, tw, td, H);
          if (RND() < 0.35) {
            box(group, pick([neonLime, neonCyan, neonPink]), tw * 0.7, 0.14, 0.14, cx, rand(18, Math.min(H - 6, 60)), cz + td / 2 + 0.1);
          }
        }
      }

      // ------------------------- neon -------------------------
      if (district === "neon") {
        const count = RND() < 0.5 ? 2 : 1;
        for (let i = 0; i < count; i++) {
          const off = count === 2 ? (i === 0 ? -8 : 8) : 0;
          const w = count === 2 ? rand(12, 15) : rand(18, 28);
          const d = count === 2 ? rand(12, 15) : rand(18, 28);
          const H = rand(16, 54);
          const x = cx + off;
          const z = cz + (count === 2 ? rand(-5, 5) : 0);
          box(group, facade("neon"), w, H, d, x, H / 2 + 0.3, z, true);
          box(group, roofMat, w + 1, 1.2, d + 1, x, H + 0.6, z);
          addCollider(x, z, w, d, H);
          // neon bands + signs
          const bandMat = pick([neonPink, neonCyan, neonAmber, neonLime]);
          box(group, bandMat, w + 0.3, 0.16, d + 0.3, x, H + 0.1, z);
          box(group, bandMat, w + 0.2, 0.12, 0.12, x, rand(5, H - 3), z + d / 2 + 0.08);
          if (RND() < 0.6) {
            const tex = signTexture(pick(["VICE", "LUCK", "24/7", "MOTEL", "LIQUOR", "PULSE", "LIVE"]), pick(["#ff3d8b", "#2ad9ff", "#c8ff3d", "#ffb347"]), pick(["OPEN ALL NIGHT", "CASINO FLOOR", "NO COPS", "VACANCY"]));
            const plane = new THREE.Mesh(
              new THREE.PlaneGeometry(6.5, 3.2),
              new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: "#ffffff", emissiveIntensity: 1.35, side: THREE.DoubleSide })
            );
            plane.position.set(x, rand(6, Math.max(7, H - 4)), z + d / 2 + 0.25);
            group.add(plane);
          }
        }
        addStreetLight(cx - 15, cz + 14);
        addStreetLight(cx + 15, cz - 14, -1);
        if (RND() < 0.3) addTrafficLight(cx - 16, cz - 16);
      }

      // ------------------------- harbor -------------------------
      if (district === "harbor") {
        if (RND() < 0.5) {
          // container stacks
          const count = 3 + Math.floor(RND() * 5);
          for (let i = 0; i < count; i++) {
            const w = 6.2;
            const h = 2.6;
            const d = 2.6;
            const x = cx + rand(-11, 11);
            const z = cz + rand(-11, 11);
            const stack = 1 + Math.floor(RND() * 2);
            for (let s = 0; s < stack; s++) {
              box(group, pick(containerMats), w, h, d, x, 0.6 + s * (h + 0.08), z);
              box(group, mat("#1b1d20"), w + 0.1, 0.08, d + 0.1, x, 0.6 + s * (h + 0.08) + h / 2, z);
            }
            addCollider(x, z, w, d + 0.4, h * stack + 0.7);
          }
          // crane
          const cg = new THREE.Group();
          const towerH = rand(24, 34);
          box(cg, mat("#c8a13a", { metalness: 0.6, roughness: 0.5 }), 1.4, towerH, 1.4, 0, towerH / 2, 0);
          box(cg, mat("#c8a13a", { metalness: 0.6, roughness: 0.5 }), 26, 1.1, 1.2, 8, towerH, 0);
          box(cg, mat("#2b2f36"), 4, 0.7, 2.4, 2, towerH - 1, 0);
          box(cg, mat("#11151a"), 0.5, 12, 0.5, 17, towerH - 6, 0);
          box(cg, neonAmber, 0.32, 0.32, 0.32, 0, towerH + 1, 0);
          cg.position.set(cx + 6, 0.3, cz - 7);
          group.add(cg);
          addCollider(cx + 6, cz - 7, 2.4, 2.4, towerH);
        } else {
          const w = rand(22, 32);
          const d = rand(16, 26);
          const H = rand(7, 14);
          box(group, warehouseMat, w, H, d, cx, H / 2 + 0.3, cz);
          // sawtooth roof
          for (let i = 0; i < 4; i++) box(group, roofMat, w / 4 - 0.6, 1.6, d, cx - w / 2 + (i + 0.5) * (w / 4), H + 0.9, cz);
          box(group, neonCyan, w * 0.9, 0.12, 0.12, cx, H - 1.8, cz + d / 2 + 0.06);
          addCollider(cx, cz, w, d, H);
          addStreetLight(cx + 15, cz + 14);
        }
      }

      // ------------------------- industrial -------------------------
      if (district === "industrial") {
        if (RND() < 0.32) {
          // silos
          for (let i = 0; i < 3; i++) {
            cylinder(group, mat("#5a626b", { metalness: 0.7, roughness: 0.4 }), 2.4, rand(10, 16), cx - 8 + i * 8, 7, cz + 4);
            cylinder(group, mat("#3e454d", { metalness: 0.7 }), 2.5, 0.3, cx - 8 + i * 8, 14, cz + 4);
          }
          const H = rand(28, 46);
          cylinder(group, rustMat, 1.6, H, cx, H / 2 + 0.3, cz + 12);
          box(group, mat("#ff5a2a", { emissive: "#ff5a2a", emissiveIntensity: 1.6 }), 1.9, 0.3, 1.9, cx, H + 0.3, cz + 12);
          addCollider(cx, cz + 8, 26, 20, 16);
        } else {
          const w = rand(20, 32);
          const d = rand(18, 30);
          const H = rand(8, 20);
          box(group, facade("industrial"), w, H, d, cx, H / 2 + 0.3, cz, H > 14);
          box(group, roofMat, w + 0.8, 1, d + 0.8, cx, H + 0.4, cz);
          box(group, neonAmber, w * 0.7, 0.12, 0.12, cx, H - 1.5, cz + d / 2 + 0.08);
          addCollider(cx, cz, w, d, H);
          if (RND() < 0.5) {
            cylinder(group, mat("#474d55", { metalness: 0.8 }), 0.9, 22, cx + 10, 11, cz - 10);
            box(group, mat("#2b2f35"), 2, 0.5, 2, cx + 10, 22, cz - 10);
          }
        }
      }

      // ------------------------- suburb -------------------------
      if (district === "suburb") {
        const houseColors = ["#4a4038", "#3c4741", "#4a3d44", "#3d4350"];
        for (let i = 0; i < 2; i++) {
          const x = cx + (i === 0 ? -8 : 8);
          const z = cz + rand(-5, 5);
          const w = 13;
          const d = 11;
          const H = rand(4.5, 7);
          box(group, mat(houseColors[Math.floor(RND() * houseColors.length)], { roughness: 0.9 }), w, H, d, x, H / 2 + 0.3, z);
          const roof = cone(group, mat(pick(["#6b3b2e", "#4a4038", "#5a3a44"]), { roughness: 0.9 }), 9.4, 3.4, x, H + 2.1, z);
          roof.rotation.y = Math.PI / 4;
          roof.scale.set(1.05, 1, 0.85);
          // windows
          box(group, mat("#ffd9a0", { emissive: "#ffd9a0", emissiveIntensity: 1.1 }), 2.2, 1.4, 0.1, x - 3, H * 0.6, z + d / 2 + 0.02);
          box(group, mat("#ffd9a0", { emissive: "#ffd9a0", emissiveIntensity: 0.6 }), 1.6, 1.3, 0.1, x + 3, H * 0.6, z + d / 2 + 0.02);
          addCollider(x, z, w, d, H);
        }
        addTree(cx - 15, cz - 14, rand(0.9, 1.4), true);
        addTree(cx + 16, cz + 15, rand(0.8, 1.2), true);
        addStreetLight(cx + 15, cz - 15);
        if (RND() < 0.4) {
          box(group, mat("#8a929b", { metalness: 0.8 }), 1.4, 0.5, 0.5, cx - 14, 1.2, cz + 15);
        }
      }
    }
  }

  // --------------------------- airfield -----------------------------------
  {
    const cx = 182;
    const cz = 182;
    box(group, mat("#24262a", { roughness: 0.95 }), 102, 0.24, 102, cx, 0.1, cz);
    // runway
    box(group, mat("#14161a", { roughness: 0.9 }), 96, 0.06, 24, cx, 0.24, cz);
    const white = mat("#e8edf2", { emissive: "#cfd8e0", emissiveIntensity: 0.3 });
    for (let i = -9; i <= 9; i++) {
      box(group, white, 4, 0.03, 0.55, cx + i * 5, 0.29, cz - 1.2);
      box(group, white, 4, 0.03, 0.55, cx + i * 5, 0.29, cz + 1.2);
    }
    // hangar
    box(group, warehouseMat, 26, 10, 18, cx - 28, 5.2, cz + 30, true);
    box(group, neonCyan, 26.4, 0.16, 18.4, cx - 28, 10.4, cz + 30);
    box(group, mat("#101418"), 18, 7, 0.4, cx - 28, 3.9, cz + 21.2);
    const tex = signTexture("FOUNDRY AIRFIELD", "#ffb03d", "NO TRESPASSING", "#0b0c10");
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: "#ffffff", emissiveIntensity: 1.1, side: THREE.DoubleSide }));
    sign.position.set(cx - 28, 8, cz + 20.7);
    group.add(sign);
    // control tower
    cylinder(group, mat("#3b4148", { metalness: 0.6 }), 2.2, 18, cx + 36, 9, cz - 32);
    box(group, mat("#1b2735", { metalness: 0.6 }), 7, 4.5, 7, cx + 36, 20, cz - 32);
    box(group, neonAmber, 7.4, 0.2, 7.4, cx + 36, 22.4, cz - 32);
    addCollider(cx + 36, cz - 32, 7, 7, 22);
    addCollider(cx - 28, cz + 30, 26, 18, 10);
    for (let i = 0; i < 6; i++) box(group, mat("#ffd23d", { emissive: "#ffb800", emissiveIntensity: 1 }), 0.6, 0.2, 0.6, cx - 40 + i * 16, 0.3, cz + 49);
  }

  // helipad near downtown east
  {
    const hx = 78;
    const hz = -78;
    const padMat = mat("#2b3038", { roughness: 0.9 });
    cylinder(group, padMat, 10, 0.28, hx, 0.2, hz);
    cylinder(group, mat("#c8ff3d", { emissive: "#c8ff3d", emissiveIntensity: 0.8 }), 9.2, 0.06, hx, 0.36, hz);
    cylinder(group, padMat, 8.4, 0.08, hx, 0.4, hz);
    const htex = signTexture("H", "#c8ff3d", "HCPD AIR OPS");
    const hsign = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ map: htex, transparent: true }));
    hsign.rotation.x = -Math.PI / 2;
    hsign.position.set(hx, 0.46, hz);
    group.add(hsign);
    addCollider(hx + 9, hz, 2, 2, 1.2);
  }

  // garage + hospital landmarks
  const garage = { x: 26, z: 26 };
  {
    box(group, mat("#20252c", { roughness: 0.85 }), 12, 4.2, 9, garage.x + 8, 2.4, garage.z + 12);
    box(group, neonLime, 12.4, 0.2, 9.4, garage.x + 8, 4.6, garage.z + 12);
    box(group, mat("#0b0e12"), 6, 3, 0.2, garage.x + 8, 1.8, garage.z + 7.4);
    const tex = signTexture("HAVOC GARAGE", "#c8ff3d", "SERVICE · PARTS · NO QUESTIONS", "#070a09");
    const s = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: "#ffffff", emissiveIntensity: 1.2 }));
    s.position.set(garage.x + 8, 4.9, garage.z + 7.35);
    group.add(s);
    addStreetLight(garage.x - 2, garage.z + 6);
  }
  const hospital = { x: -108, z: -88 };
  {
    box(group, mat("#c9d3dc", { roughness: 0.75 }), 24, 18, 20, hospital.x, 9.3, hospital.z);
    box(group, neonCyan, 24.4, 0.3, 20.4, hospital.x, 18.5, hospital.z);
    box(group, mat("#1a2732", { metalness: 0.8 }), 16, 8, 0.3, hospital.x, 5, hospital.z + 10.2);
    const tex = signTexture("ST. JUDE", "#2ad9ff", "TRAUMA CENTER", "#0a0f14");
    const s = new THREE.Mesh(new THREE.PlaneGeometry(13, 6.5), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: "#ffffff", emissiveIntensity: 1 }));
    s.position.set(hospital.x, 14, hospital.z + 10.3);
    group.add(s);
    addCollider(hospital.x, hospital.z, 24, 20, 18);
  }

  // billboards at select spots
  addBillboard(-56, 150, 12, 0.3, "NECTAR", "THE CITY'S OFFICIAL WATER", "#2ad9ff");
  addBillboard(140, -120, 14, -0.4, "VAPID", "DRIVE SOMETHING LOUD", "#ff3d8b");
  addBillboard(-150, 34, 11, 0.9, "KILLICK", "IMPORT · EXPORT · DISCREET", "#c8ff3d");
  addBillboard(80, 140, 13, 2.5, "PULSE 101", "ALL HITS · ALL NIGHT", "#ffb347");

  // street furniture, lamps and traffic lights at intersections
  for (let i = 0; i < 22; i++) {
    const x = roadCenter(Math.floor(rand(0, 10)));
    const z = roadCenter(Math.floor(rand(0, 10)));
    if (rand(0, 1) > 0.5) addStreetLight(x + 8, z + 8);
    else addTrafficLight(x - 8, z - 8);
  }

  // road markings
  const dashMat = new THREE.MeshBasicMaterial({ color: "#9aa4ad" });
  dashMat.transparent = true;
  dashMat.opacity = 0.42;
  const dashGeo = new THREE.BoxGeometry(2.4, 0.04, 0.22);
  const dashCount = 10 * 2 * 38;
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashCount);
  const dummy = new THREE.Object3D();
  let di = 0;
  for (let k = 0; k < 10; k++) {
    const c = roadCenter(k);
    for (let j = 0; j < 38; j++) {
      const p = -226 + j * 12;
      dummy.position.set(p, 0.04, c);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      dashes.setMatrixAt(di++, dummy.matrix);
      dummy.position.set(c, 0.04, p);
      dummy.updateMatrix();
      dashes.setMatrixAt(di++, dummy.matrix);
    }
  }
  dashes.count = di;
  group.add(dashes);

  // crosswalks
  const crossMat = new THREE.MeshBasicMaterial({ color: "#c4ccd4" });
  crossMat.transparent = true;
  crossMat.opacity = 0.5;
  const crossGeo = new THREE.BoxGeometry(0.7, 0.03, 3.6);
  const cross = new THREE.InstancedMesh(crossGeo, crossMat, 9 * 9 * 8);
  let ci = 0;
  for (let a = 0; a < 9; a++) {
    for (let b = 0; b < 9; b++) {
      const x = roadCenter(a + 0.5);
      const z = roadCenter(b + 0.5);
      for (let s = 0; s < 4; s++) {
        for (let t = 0; t < 2; t++) {
          dummy.position.set(x + t * 1.2 - 0.6, 0.05, z + (s < 2 ? (s === 0 ? 5.4 : -5.4) : 0));
          dummy.rotation.set(0, s < 2 ? 0 : Math.PI / 2, 0);
          if (s >= 2) dummy.position.set(x + (s === 2 ? 5.4 : -5.4), 0.05, z + t * 1.2 - 0.6);
          dummy.updateMatrix();
          cross.setMatrixAt(ci++, dummy.matrix);
        }
      }
    }
  }
  cross.count = ci;
  group.add(cross);

  // road points for garage delivery and fast travel
  const roadPoints: { x: number; z: number }[] = [];
  for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++) roadPoints.push({ x: roadCenter(a), z: roadCenter(b) });

  // add palms along the perimeter and key roads
  for (let i = 0; i < 26; i++) {
    const side = Math.floor(rand(0, 4));
    const t = rand(-230, 230);
    const off = 238;
    if (side === 0) addTree(t, -off, rand(0.9, 1.3), true);
    if (side === 1) addTree(t, off, rand(0.9, 1.3), true);
    if (side === 2) addTree(-off, t, rand(0.9, 1.3), true);
    if (side === 3) addTree(off, t, rand(0.9, 1.3), true);
  }

  // distant boats
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    const x = rand(-700, 700);
    const z = rand(320, 800) * (RND() > 0.5 ? 1 : -1);
    box(g, mat("#1a222b", { metalness: 0.5 }), rand(10, 24), 3, 5, 0, 0, 0);
    box(g, mat("#2b3540"), 5, 5, 4, -2, 3, 0);
    box(g, neonAmber, 0.4, 0.4, 0.4, 0, 5.5, 0);
    g.position.set(x, CITY.waterY + 1, z);
    group.add(g);
  }

  // city limit signs
  const limitTex = signTexture("HAVOC CITY", "#c8ff3d", "POP. 4,200,000 · EST. 1904", "#0a0d0b");
  for (const [sx, sz, rot] of [
    [0, 241, Math.PI],
    [0, -241, 0],
  ]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshStandardMaterial({ map: limitTex, emissiveMap: limitTex, emissive: "#ffffff", emissiveIntensity: 0.9, side: THREE.DoubleSide }));
    s.position.set(sx, 7, sz);
    s.rotation.y = rot;
    group.add(s);
  }

  // ground-floor storefront glow so street level never reads as a black void
  const shopNear = mat("#ffdca8", { emissive: "#ffcf87", emissiveIntensity: 1.5, roughness: 0.5 });
  const shopCool = mat("#bfe8ff", { emissive: "#8fd8ff", emissiveIntensity: 1.2, roughness: 0.5 });
  const shopWarm = mat("#ffbe8f", { emissive: "#ff9b52", emissiveIntensity: 1.3, roughness: 0.5 });
  for (let bx = 0; bx < 9; bx++) {
    for (let bz = 0; bz < 9; bz++) {
      if (bx >= 7 && bz >= 7) continue;
      const cx = blockCenter(bx);
      const cz = blockCenter(bz);
      const style = districtAt(cx, cz);
      for (let f = 0; f < 4; f++) {
        if (RND() < 0.28) continue;
        const side = f;
        const along = rand(-12, 12);
        const x = side === 0 || side === 1 ? cx + along : cx + (side === 2 ? -18.9 : 18.9);
        const z = side === 0 || side === 1 ? cz + (side === 0 ? -18.9 : 18.9) : cz + along;
        if (insideAnyCollider(x, z, 1.1)) continue;
        const shopMat = style === "neon" ? (RND() > 0.4 ? shopWarm : shopCool) : style === "downtown" ? (RND() > 0.5 ? shopCool : shopNear) : RND() > 0.32 ? shopNear : shopWarm;
        const w = rand(3, 6.5);
        const horizontal = side === 0 || side === 1;
        box(group, shopMat, horizontal ? w : 0.16, rand(1.7, 2.5), horizontal ? 0.16 : w, x, 1.4, z);
        box(group, neonAmber, horizontal ? w * 0.5 : 0.18, 0.1, horizontal ? 0.18 : w * 0.5, x, 2.75, z);
        if (RND() < 0.45) {
          box(group, pick([neonPink, neonCyan, neonLime]), horizontal ? w * 0.9 : 0.12, 0.16, horizontal ? 0.12 : w * 0.9, x, 3.05, z);
        }
      }
      void style;
    }
  }

  // district markers on the ground — subtle neon ring at each district centre
  for (const d of DISTRICTS) {
    const ringMat = new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.35 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.2, 3.6, 32), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(d.center[0], 0.22, d.center[1]);
    group.add(ring);
  }

  mergeStaticMeshes(group);

  return {
    group,
    colliders,
    blocks,
    sun,
    roadPoints,
    garage,
    hospital,
    helipad: { x: 78, z: -78 },
    airport: { x: 182, z: 182 },
    disposables,
  };
}

export function districtName(id: DistrictId) {
  return DISTRICTS.find((d) => d.id === id)?.name ?? "Havoc City";
}
