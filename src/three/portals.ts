import * as THREE from "three";
import type { PortalKind } from "@/games/theme";
import { mulberry32 } from "@/games/theme";

export type Quality = "high" | "medium" | "low";

export interface PortalSpec {
  id: string;
  title: string;
  kind: PortalKind;
  primary: string;
  secondary: string;
  seed: number;
  playable: boolean;
}

export interface BuildContext {
  track: <T extends { dispose(): void }>(x: T) => T;
  glowTexture: THREE.Texture;
  quality: Quality;
  spec: PortalSpec;
  primary: THREE.Color;
  secondary: THREE.Color;
}

export interface CoreResult {
  group: THREE.Group;
  /** speed: 1 at rest, higher while hovered. */
  animate: (t: number, dt: number, speed: number) => void;
}

const SEGMENTS: Record<Quality, number> = { high: 40, medium: 28, low: 16 };

function std(ctx: BuildContext, o: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  return ctx.track(new THREE.MeshStandardMaterial(o));
}
function basic(ctx: BuildContext, o: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial {
  return ctx.track(new THREE.MeshBasicMaterial(o));
}
function mesh(ctx: BuildContext, geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(ctx.track(geo), mat);
}
const glowMat = (ctx: BuildContext, color: THREE.Color, opacity: number) =>
  basic(ctx, {
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

function planetTexture(ctx: BuildContext): THREE.CanvasTexture {
  const rng = mulberry32(ctx.spec.seed);
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const g = c.getContext("2d")!;
  const a = `#${ctx.primary.getHexString()}`;
  const b = `#${ctx.secondary.getHexString()}`;
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, "#0a1a2a");
  grad.addColorStop(0.5, "#163a3a");
  grad.addColorStop(1, "#0a1a2a");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 70; i++) {
    g.globalAlpha = 0.12 + rng() * 0.3;
    g.fillStyle = rng() > 0.5 ? a : b;
    g.beginPath();
    g.ellipse(rng() * 256, rng() * 128, 6 + rng() * 34, 3 + rng() * 14, rng() * 3, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return ctx.track(tex);
}

function orbiter(pivot: THREE.Object3D, speed: number) {
  return (dt: number, k: number) => {
    pivot.rotation.y += dt * speed * k;
  };
}

function buildPlanet(ctx: BuildContext): CoreResult {
  const seg = SEGMENTS[ctx.quality];
  const group = new THREE.Group();
  const planet = mesh(
    ctx,
    new THREE.SphereGeometry(1.5, seg, Math.round(seg * 0.75)),
    std(ctx, { map: planetTexture(ctx), emissive: ctx.primary, emissiveIntensity: 0.12, roughness: 0.9 }),
  );
  const atmo = mesh(
    ctx,
    new THREE.SphereGeometry(1.7, 24, 16),
    basic(ctx, {
      color: ctx.secondary,
      transparent: true,
      opacity: 0.2,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  group.add(planet, atmo);
  const moons: Array<(dt: number, k: number) => void> = [];
  for (let i = 0; i < 2; i++) {
    const pivot = new THREE.Object3D();
    pivot.rotation.x = 0.4 * (i + 1);
    const moon = mesh(
      ctx,
      new THREE.SphereGeometry(0.16 + i * 0.06, 12, 10),
      std(ctx, { color: i ? ctx.secondary : "#b8c4d6", roughness: 1 }),
    );
    moon.position.set(2.2 + i * 0.5, 0, 0);
    pivot.add(moon);
    group.add(pivot);
    moons.push(orbiter(pivot, 0.5 - i * 0.2));
  }
  return {
    group,
    animate: (_t, dt, k) => {
      planet.rotation.y += dt * 0.15 * k;
      moons.forEach((m) => m(dt, k));
    },
  };
}

function buildRacing(ctx: BuildContext): CoreResult {
  const group = new THREE.Group();
  const dark = std(ctx, { color: "#10142a", emissive: ctx.secondary, emissiveIntensity: 0.12, roughness: 0.5, metalness: 0.5 });
  const top = mesh(ctx, new THREE.CylinderGeometry(2.1, 1.7, 0.4, 6), dark);
  const rock = mesh(ctx, new THREE.ConeGeometry(1.5, 1.7, 6), dark);
  rock.rotation.x = Math.PI;
  rock.position.y = -1.0;
  const track = mesh(ctx, new THREE.TorusGeometry(1.5, 0.06, 8, 64), basic(ctx, { color: ctx.primary }));
  track.rotation.x = Math.PI / 2;
  track.position.y = 0.24;
  const inner = mesh(ctx, new THREE.TorusGeometry(0.95, 0.04, 8, 48), basic(ctx, { color: ctx.secondary }));
  inner.rotation.x = Math.PI / 2;
  inner.position.y = 0.24;
  const gates = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const gate = mesh(ctx, new THREE.TorusGeometry(0.5, 0.045, 8, 24), basic(ctx, { color: i % 2 ? ctx.secondary : ctx.primary }));
    const a = (i / 3) * Math.PI * 2;
    gate.position.set(Math.cos(a) * 1.5, 0.75, Math.sin(a) * 1.5);
    gate.rotation.y = -a + Math.PI / 2;
    gates.add(gate);
  }
  const car = mesh(ctx, new THREE.BoxGeometry(0.34, 0.1, 0.16), basic(ctx, { color: "#ffffff" }));
  car.position.y = 0.32;
  group.add(top, rock, track, inner, gates, car);
  return {
    group,
    animate: (t, dt, k) => {
      gates.rotation.y += dt * 0.2 * k;
      const a = t * 1.6 * k;
      car.position.x = Math.cos(a) * 1.5;
      car.position.z = Math.sin(a) * 1.5;
      car.rotation.y = -a;
    },
  };
}

function buildSky(ctx: BuildContext): CoreResult {
  const group = new THREE.Group();
  const metal = std(ctx, { color: "#2a3a55", emissive: ctx.primary, emissiveIntensity: 0.1, roughness: 0.6, metalness: 0.4, flatShading: true });
  const platform = mesh(ctx, new THREE.CylinderGeometry(2.0, 1.7, 0.22, 24), metal);
  const rock = mesh(ctx, new THREE.ConeGeometry(1.6, 1.9, 7), metal);
  rock.rotation.x = Math.PI;
  rock.position.y = -1.05;
  const tower = mesh(ctx, new THREE.CylinderGeometry(0.15, 0.28, 1.1, 8), metal);
  tower.position.y = 0.65;
  const dish = mesh(ctx, new THREE.TorusGeometry(0.45, 0.04, 8, 24), basic(ctx, { color: ctx.secondary }));
  dish.position.y = 1.3;
  dish.rotation.x = Math.PI / 2.4;
  const planes = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const p = mesh(ctx, new THREE.ConeGeometry(0.1, 0.42, 3), basic(ctx, { color: ctx.secondary }));
    p.rotation.x = Math.PI / 2;
    const arm = new THREE.Object3D();
    arm.rotation.y = (i / 3) * Math.PI * 2;
    p.position.set(2.7, 0.2 + i * 0.25, 0);
    p.rotation.z = Math.PI / 2;
    arm.add(p);
    planes.add(arm);
  }
  const clouds = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Sprite(
      ctx.track(new THREE.SpriteMaterial({ map: ctx.glowTexture, color: "#ffffff", transparent: true, opacity: 0.22, depthWrite: false })),
    );
    s.scale.set(2.8, 1.3, 1);
    const a = (i / 3) * Math.PI * 2;
    s.position.set(Math.cos(a) * 1.8, -0.35, Math.sin(a) * 1.8);
    clouds.add(s);
  }
  group.add(platform, rock, tower, dish, planes, clouds);
  return {
    group,
    animate: (_t, dt, k) => {
      planes.rotation.y += dt * 0.7 * k;
      clouds.rotation.y -= dt * 0.1 * k;
      dish.rotation.z += dt * 0.8 * k;
    },
  };
}

function buildFortress(ctx: BuildContext): CoreResult {
  const group = new THREE.Group();
  const stone = std(ctx, { color: "#3a3550", emissive: ctx.primary, emissiveIntensity: 0.08, roughness: 0.8, flatShading: true });
  const roofMat = std(ctx, { color: ctx.secondary, emissive: ctx.secondary, emissiveIntensity: 0.25, roughness: 0.6 });
  const rock = mesh(ctx, new THREE.ConeGeometry(1.7, 2.0, 7), stone);
  rock.rotation.x = Math.PI;
  rock.position.y = -1.1;
  const base = mesh(ctx, new THREE.CylinderGeometry(1.9, 1.7, 0.25, 8), stone);
  const keep = mesh(ctx, new THREE.BoxGeometry(1.1, 1.3, 1.1), stone);
  keep.position.y = 0.75;
  const roof = mesh(ctx, new THREE.ConeGeometry(0.9, 0.7, 4), roofMat);
  roof.position.y = 1.75;
  roof.rotation.y = Math.PI / 4;
  group.add(rock, base, keep, roof);
  for (const [x, z] of [
    [1.2, 1.2],
    [-1.2, 1.2],
    [1.2, -1.2],
    [-1.2, -1.2],
  ]) {
    const t = mesh(ctx, new THREE.CylinderGeometry(0.28, 0.32, 1.0, 8), stone);
    t.position.set(x, 0.62, z);
    const c = mesh(ctx, new THREE.ConeGeometry(0.36, 0.45, 8), roofMat);
    c.position.set(x, 1.34, z);
    group.add(t, c);
  }
  return {
    group,
    animate: (_t, dt, k) => {
      group.rotation.y += dt * 0.12 * k;
    },
  };
}

function buildCorrupted(ctx: BuildContext): CoreResult {
  const rng = mulberry32(ctx.spec.seed);
  const group = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(1.45, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const s = 0.75 + rng() * 0.55;
    pos.setXYZ(i, pos.getX(i) * s, pos.getY(i) * s, pos.getZ(i) * s);
  }
  geo.computeVertexNormals();
  const body = mesh(ctx, geo, std(ctx, { color: "#1b0a14", emissive: ctx.primary, emissiveIntensity: 0.28, roughness: 0.7, flatShading: true }));
  const wire = new THREE.Mesh(geo, basic(ctx, { color: ctx.primary, wireframe: true, transparent: true, opacity: 0.45 }));
  wire.scale.setScalar(1.04);
  group.add(body, wire);
  const shards = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const s = mesh(ctx, new THREE.TetrahedronGeometry(0.14 + rng() * 0.16), basic(ctx, { color: i % 2 ? ctx.primary : ctx.secondary }));
    const a = rng() * Math.PI * 2;
    const r = 2.0 + rng() * 0.8;
    s.position.set(Math.cos(a) * r, (rng() - 0.5) * 1.8, Math.sin(a) * r);
    s.userData.spin = 0.5 + rng() * 1.5;
    shards.add(s);
  }
  group.add(shards);
  return {
    group,
    animate: (t, dt, k) => {
      body.rotation.y += dt * 0.2 * k;
      wire.rotation.y = body.rotation.y;
      body.rotation.x = Math.sin(t * 0.4) * 0.15;
      wire.rotation.x = body.rotation.x;
      shards.rotation.y -= dt * 0.35 * k;
      shards.children.forEach((c) => {
        c.rotation.x += dt * (c.userData.spin as number) * k;
        c.rotation.y += dt * (c.userData.spin as number) * 0.7 * k;
      });
    },
  };
}

function buildShooter(ctx: BuildContext): CoreResult {
  const group = new THREE.Group();
  const metal = std(ctx, { color: "#2b2d33", emissive: ctx.primary, emissiveIntensity: 0.1, roughness: 0.45, metalness: 0.8, flatShading: true });
  const core = mesh(ctx, new THREE.CylinderGeometry(1.0, 1.25, 0.8, 8), metal);
  const turret = mesh(ctx, new THREE.BoxGeometry(0.8, 0.45, 0.8), metal);
  turret.position.y = 0.6;
  const barrel = mesh(ctx, new THREE.CylinderGeometry(0.08, 0.1, 1.2, 8), metal);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0.7, 0.65, 0);
  const rings = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const r = mesh(ctx, new THREE.TorusGeometry(1.75, 0.04, 8, 64), basic(ctx, { color: i ? ctx.secondary : ctx.primary }));
    r.rotation.x = Math.PI / 2 + (i ? 0.5 : -0.4);
    rings.add(r);
  }
  const cage = mesh(
    ctx,
    new THREE.IcosahedronGeometry(2.05, 1),
    basic(ctx, { color: ctx.secondary, wireframe: true, transparent: true, opacity: 0.22 }),
  );
  group.add(core, turret, barrel, rings, cage);
  return {
    group,
    animate: (_t, dt, k) => {
      rings.rotation.y += dt * 0.6 * k;
      cage.rotation.y -= dt * 0.15 * k;
      cage.rotation.x += dt * 0.08 * k;
      turret.rotation.y += dt * 0.3 * k;
      barrel.rotation.y = turret.rotation.y;
      barrel.position.x = Math.cos(turret.rotation.y) * 0.7;
      barrel.position.z = -Math.sin(turret.rotation.y) * 0.7;
    },
  };
}

function buildMagic(ctx: BuildContext): CoreResult {
  const rng = mulberry32(ctx.spec.seed);
  const group = new THREE.Group();
  const crystal = mesh(
    ctx,
    new THREE.OctahedronGeometry(1.1),
    std(ctx, { color: ctx.primary, emissive: ctx.primary, emissiveIntensity: 0.55, roughness: 0.15, metalness: 0.2, flatShading: true, transparent: true, opacity: 0.92 }),
  );
  crystal.scale.y = 1.6;
  group.add(crystal);
  const runes = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const r = mesh(ctx, new THREE.TorusGeometry(1.6 + i * 0.2, 0.02, 6, 64), basic(ctx, { color: i % 2 ? ctx.secondary : ctx.primary, transparent: true, opacity: 0.7 }));
    r.rotation.set(i * 1.05, i * 0.6, 0);
    runes.add(r);
  }
  group.add(runes);
  const n = ctx.quality === "low" ? 20 : 48;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const b = Math.acos(2 * rng() - 1);
    const r = 2.0 + rng() * 0.9;
    arr[i * 3] = r * Math.sin(b) * Math.cos(a);
    arr[i * 3 + 1] = r * Math.cos(b);
    arr[i * 3 + 2] = r * Math.sin(b) * Math.sin(a);
  }
  const g = ctx.track(new THREE.BufferGeometry());
  g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  const sparkles = new THREE.Points(
    g,
    ctx.track(new THREE.PointsMaterial({ map: ctx.glowTexture, color: ctx.secondary, size: 0.28, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })),
  );
  group.add(sparkles);
  return {
    group,
    animate: (t, dt, k) => {
      crystal.rotation.y += dt * 0.5 * k;
      runes.rotation.y += dt * 0.25 * k;
      runes.rotation.x += dt * 0.12 * k;
      sparkles.rotation.y -= dt * 0.2 * k;
      crystal.position.y = Math.sin(t * 0.9) * 0.1;
    },
  };
}

function buildArcade(ctx: BuildContext): CoreResult {
  const group = new THREE.Group();
  const cubeGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
  const cube = mesh(ctx, cubeGeo, std(ctx, { color: "#0c1230", emissive: ctx.primary, emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.4 }));
  const edges = new THREE.LineSegments(
    ctx.track(new THREE.EdgesGeometry(cubeGeo)),
    ctx.track(new THREE.LineBasicMaterial({ color: ctx.secondary })),
  );
  cube.add(edges);
  group.add(cube);
  const minis = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const m = mesh(ctx, new THREE.BoxGeometry(0.22, 0.22, 0.22), basic(ctx, { color: i % 2 ? ctx.primary : ctx.secondary }));
    const a = (i / 6) * Math.PI * 2;
    m.position.set(Math.cos(a) * 2.2, Math.sin(a * 2) * 0.5, Math.sin(a) * 2.2);
    minis.add(m);
  }
  group.add(minis);
  return {
    group,
    animate: (_t, dt, k) => {
      cube.rotation.x += dt * 0.5 * k;
      cube.rotation.y += dt * 0.7 * k;
      minis.rotation.y += dt * 0.9 * k;
      minis.children.forEach((c) => {
        c.rotation.x += dt * 2 * k;
        c.rotation.y += dt * 2 * k;
      });
    },
  };
}

function buildCosmic(ctx: BuildContext): CoreResult {
  const group = new THREE.Group();
  const knot = mesh(
    ctx,
    new THREE.TorusKnotGeometry(0.9, 0.28, SEGMENTS[ctx.quality] * 3, 12),
    std(ctx, { color: ctx.primary, emissive: ctx.secondary, emissiveIntensity: 0.28, roughness: 0.25, metalness: 0.8 }),
  );
  group.add(knot);
  return {
    group,
    animate: (_t, dt, k) => {
      knot.rotation.x += dt * 0.35 * k;
      knot.rotation.y += dt * 0.5 * k;
    },
  };
}

const BUILDERS: Record<PortalKind, (ctx: BuildContext) => CoreResult> = {
  planet: buildPlanet,
  racing: buildRacing,
  sky: buildSky,
  fortress: buildFortress,
  corrupted: buildCorrupted,
  shooter: buildShooter,
  magic: buildMagic,
  arcade: buildArcade,
  cosmic: buildCosmic,
};

export function buildCore(ctx: BuildContext): CoreResult {
  return BUILDERS[ctx.spec.kind](ctx);
}

/** Swirling portal disc shader material. */
export function createPortalDiscMaterial(a: THREE.Color, b: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uAlpha: { value: 0.5 },
      uA: { value: a.clone() },
      uB: { value: b.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uAlpha;
      uniform vec3 uA;
      uniform vec3 uB;
      void main() {
        vec2 p = vUv - 0.5;
        float r = length(p) * 2.0;
        float ang = atan(p.y, p.x);
        float swirl = sin(ang * 3.0 + r * 9.0 - uTime * 1.4) * 0.5 + 0.5;
        float edge = smoothstep(1.0, 0.7, r);
        float rim = smoothstep(0.55, 0.95, r);
        vec3 col = mix(uA, uB, swirl);
        float a = edge * (0.04 + rim * (0.2 + 0.4 * swirl)) * uAlpha;
        gl_FragColor = vec4(col, a);
      }
    `,
  });
}
