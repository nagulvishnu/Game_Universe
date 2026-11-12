import * as THREE from "three";
import { mulberry32 } from "@/games/theme";
import { fibonacciSphere, rotateX, rotateY, bestOrbitAngle } from "./sphere";
import type { Vec3 } from "./sphere";

export type Quality = "high" | "medium" | "low";

/**
 * Three separate compositions rather than one desktop layout scaled down:
 * the headline sits beside the machine on desktop, above it on smaller
 * screens, and the shell shape / card size / orbit radius differ per profile.
 */
export type LayoutProfile = "desktop" | "tablet" | "mobile";

interface LayoutProfileConfig {
  profile: LayoutProfile;
  /** Vertical scale of the Fibonacci shell before it is projected. */
  sy: number;
  tilt: number;
  radius: number;
}

export interface HologramCard {
  id: string;
  title: string;
  /** Primary + secondary accent colours for this world's card. */
  primary: string;
  secondary: string;
  playable: boolean;
}

export interface HologramEngineOptions {
  quality: Quality;
  reducedMotion: boolean;
  particles: boolean;
  cards: HologramCard[];
  /** Called when the WebGL context is lost and the scene must fall back. */
  onFail: () => void;
}

const QUALITY_PRESETS = {
  high: { stars: 2600, motes: 420, rings: 5, pixelRatio: 2, antialias: true },
  medium: { stars: 1400, motes: 240, rings: 4, pixelRatio: 1.5, antialias: false },
  low: { stars: 700, motes: 110, rings: 3, pixelRatio: 1, antialias: false },
} as const;

/** Per-card render payload the DOM overlay consumes each frame. */
export interface CardProjection {
  id: string;
  /** Screen-space centre in CSS pixels, relative to the canvas. */
  x: number;
  y: number;
  /** Perspective scale factor (1 = reference distance). */
  scale: number;
  /** 0 = fully behind the core, 1 = fully in front of it. */
  facing: number;
  /** Bank angle around Y so cards tilt as they travel around the sphere. */
  rotationY: number;
  /** Pitch angle around X. */
  rotationX: number;
  /** Depth in camera space — used for z-ordering. */
  depth: number;
  /** True while this card is the chosen one during a Random Pick. */
  selected: boolean;
}

export type ProjectionListener = (frame: FrameProjection) => void;

/**
 * Radians of orbit per pixel of horizontal mouse drag — one full turn about
 * every 870px, which reads as pushing the shell rather than flinging it.
 */
export const ORBIT_DRAG_SPIN = 0.0072;
/** Radians of tumble per pixel of vertical drag. */
const DRAG_TUMBLE = 0.0045;
/** Release-flick speed ceiling, radians/second. */
const DRAG_FLICK_MAX = 10;

/** Where the holographic machine sits on screen, for the overlay bloom. */
export interface CoreProjection {
  x: number;
  y: number;
  scale: number;
}

export interface FrameProjection {
  cards: CardProjection[];
  core: CoreProjection;
}

const damp = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * The holographic universe: a central energy core with orbital rings, surrounded
 * by every registered game card arranged on a Fibonacci sphere.
 *
 * The core is real 3D geometry lit by real lights. The cards are DOM elements
 * whose screen positions are driven from this engine's projection, so text stays
 * crisp, hit-testing stays native, and every card remains keyboard accessible.
 */
export class HologramEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private disposables: Array<{ dispose(): void }> = [];

  private coreGroup = new THREE.Group();
  private ringMeshes: THREE.Mesh[] = [];
  private coreMesh!: THREE.Mesh;
  private coreShell!: THREE.Mesh;
  private coreLight!: THREE.PointLight;
  private glowSprite!: THREE.Sprite;
  private motes!: THREE.Points;
  private motesMat!: THREE.PointsMaterial;
  private stars!: THREE.Points;
  private glowTexture!: THREE.Texture;

  private fibDirs: Vec3[] = [];
  private cardDirs: Vec3[] = [];
  private cardWorld: THREE.Vector3[] = [];
  private cards: HologramCard[] = [];
  private projectionBuffer: CardProjection[] = [];

  private raf = 0;
  private running = false;
  private disposed = false;
  private inView = true;
  private last = 0;
  private time = 0;
  private frameCount = 0;
  private frameTimeSum = 0;
  private pixelRatio: number;
  private width = 1;
  private height = 1;

  /** Continuous orbit rotation around the core, in radians. */
  orbitAngle = 0;
  /**
   * When false the engine stops advancing `orbitAngle` itself, letting an
   * external timeline (the Random Pick cinematic) drive the orbit exactly.
   */
  autoOrbit = true;
  /** Current orbit speed in radians/second. */
  orbitSpeed = 0.14;
  /** Target orbit speed — the Random Pick sequence drives this. */
  targetOrbitSpeed = 0.14;
  /** 0 = calm, 1 = fully energised. */
  energy = 0;
  targetEnergy = 0;
  private selectedId: string | null = null;
  private selectionProgress = 0;

  private pointer = new THREE.Vector2();
  private pointerInside = false;
  /** True while the user is dragging the shell — parallax stands down. */
  private dragging = false;
  private parallax = new THREE.Vector2();
  /** Camera fit, recomputed on resize. */
  private fit = { distance: 34, lookX: 0, lookY: 0.4 };
  /** Apparent radius of the machine's core in CSS pixels. */
  private corePixelRadius = 190;
  /** Which responsive composition is active, and the numbers it dictates. */
  private layout: LayoutProfileConfig = { profile: "desktop", sy: 0.95, tilt: 0.42, radius: 13.5 };
  /**
   * Second rotation axis: the Fibonacci point set is rolled around Z before
   * the shell is shaped, so worlds travel over the poles as well as around
   * the machine instead of circling on one fixed band. It freezes during a
   * Random Pick so the chosen card still lands exactly at the front.
   */
  private tumbleAngle = 0;
  private static readonly TUMBLE_SPEED = 0.08;

  private listener: ProjectionListener | null = null;

  private io: IntersectionObserver | null = null;
  private ro: ResizeObserver | null = null;
  private readonly motion: number;
  private readonly canvas: HTMLCanvasElement;
  private readonly quality: Quality;

  constructor(
    private container: HTMLElement,
    private opts: HologramEngineOptions,
  ) {
    const preset = QUALITY_PRESETS[opts.quality];
    this.quality = opts.quality;
    this.motion = opts.reducedMotion ? 0.25 : 1;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, preset.pixelRatio);

    this.renderer = new THREE.WebGLRenderer({
      antialias: preset.antialias,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setClearColor(0x04060f, 1);
    this.canvas = this.renderer.domElement;
    this.canvas.style.cssText = "display:block;width:100%;height:100%;";
    this.canvas.setAttribute("aria-hidden", "true");
    container.appendChild(this.canvas);

    this.scene.fog = new THREE.FogExp2(0x05060f, 0.016);
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 400);
    this.camera.position.set(0, 1.4, 26);

    this.buildLights();
    this.glowTexture = this.track(makeGlowTexture());
    this.buildCore();
    this.buildStars(preset.stars);
    this.buildMotes(preset.motes);
    this.setCards(opts.cards);

    this.scene.add(this.coreGroup);

    this.resize();
    this.bind();
    this.start();
  }

  /* ---------------- public API ---------------- */

  setListener(listener: ProjectionListener | null) {
    this.listener = listener;
  }

  /** Rebuild the orbit when the registry changes (a new game is registered). */
  setCards(cards: HologramCard[]) {
    this.cards = cards;
    this.cardWorld = cards.map(() => new THREE.Vector3());
    this.buildArrangement();
    this.projectionBuffer = cards.map((c) => ({
      id: c.id,
      x: 0,
      y: 0,
      scale: 1,
      facing: 1,
      rotationY: 0,
      rotationX: 0,
      depth: 0,
      selected: false,
    }));
  }

  /** Spin faster and brighter — used while Random Pick is running. */
  setBoost(energy: number, speed: number) {
    this.targetEnergy = clamp(energy, 0, 1);
    this.targetOrbitSpeed = speed;
  }

  /** Mark a card as the chosen one; it lifts out of the sphere. */
  setSelected(id: string | null) {
    this.selectedId = id;
  }

  /** 0 = card back in the orbit, 1 = card fully emerged toward the viewer. */
  setSelectionProgress(p: number) {
    this.selectionProgress = clamp(p, 0, 1);
  }

  /** The orbit angle that brings the given card to the front of the sphere. */
  landingAngleFor(index: number): number {
    this.syncDirs();
    return bestOrbitAngle(this.cardDirs, index, this.tilt());
  }

  /**
   * An absolute orbit angle that lands the given card at the front of the
   * sphere, far enough ahead of the current angle that the machine appears to
   * have spun around before settling on its choice.
   */
  landingTargetFor(index: number, extraTurns = 3): number {
    const landing = this.landingAngleFor(index);
    const twoPi = Math.PI * 2;
    const delta = (((landing - this.orbitAngle) % twoPi) + twoPi) % twoPi;
    return this.orbitAngle + delta + extraTurns * twoPi;
  }

  /**
   * Spin the shell by a mouse-drag delta. Freezes the idle drift (resumed by
   * `endDrag`), suppresses the pointer parallax so only the shell responds to
   * the hand, and energises the core so the machine feels alive while grabbed.
   */
  dragBy(dxPx: number, dyPx: number) {
    this.dragging = true;
    this.autoOrbit = false;
    this.orbitAngle += dxPx * ORBIT_DRAG_SPIN;
    this.tumbleAngle -= dyPx * DRAG_TUMBLE;
    if (this.targetEnergy < 0.4) this.targetEnergy = 0.4;
  }

  /**
   * Take the wheel back after a drag: resume the idle drift, carrying the
   * release velocity as a flick that decays into the default orbit speed.
   */
  endDrag(flickRadPerSec = 0) {
    this.dragging = false;
    this.autoOrbit = true;
    this.orbitSpeed = clamp(flickRadPerSec, -DRAG_FLICK_MAX, DRAG_FLICK_MAX);
    this.targetEnergy = 0;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.pause();
    this.unbind();
    this.io?.disconnect();
    this.ro?.disconnect();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((m) => m.dispose());
    });
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }

  /* ---------------- construction ---------------- */

  private track<T extends { dispose(): void }>(x: T): T {
    this.disposables.push(x);
    return x;
  }

  /** Which responsive composition this viewport gets. */
  private profileFor(width: number): LayoutProfile {
    if (width >= 1100) return "desktop";
    if (width >= 760) return "tablet";
    return "mobile";
  }

  /**
   * Pick the profile's numbers.
   *
   * `sy` is only a starting point — `computeCameraFit` reshapes the shell so
   * its projected aspect matches the space that is actually free (the headline
   * column on desktop, the band under the headline on smaller screens).
   */
  private syncLayout() {
    const profile = this.profileFor(this.width);
    const base =
      profile === "desktop"
        ? { sy: 0.95, tilt: 0.42, radius: 13.5 }
        : profile === "tablet"
          ? { sy: 1.05, tilt: 0.5, radius: 12.5 }
          : { sy: 1.15, tilt: 0.62, radius: 11.5 };
    this.layout = { profile, ...base };
  }

  /** Tilt of the orbit plane — stronger on small screens so the shell still reads as 3D. */
  private tilt(): number {
    return this.layout.tilt;
  }

  /** Radius of the orbit shell. */
  private orbitRadius(): number {
    return this.layout.radius;
  }

  /**
   * The stage element that owns this canvas.
   *
   * The engine is mounted in an overlay div, so the intro block, the controls
   * and the cards are siblings rather than children — the composition has to
   * measure them from the shared parent.
   */
  private root(): HTMLElement {
    return this.container.parentElement ?? this.container;
  }

  /**
   * Card footprint in CSS pixels.
   *
   * The real card is measured rather than guessed: the overlay must reserve
   * exactly the box the browser lays out, or the fit under- or over-claims the
   * space and cards collide with the headline and the controls.
   */
  private cardSize(): { w: number; h: number } {
    const el = this.root().querySelector<HTMLElement>(".gu-orbital");
    if (el) {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w > 8 && h > 8) return { w, h };
    }
    return this.layout.profile === "desktop" ? { w: 132, h: 133 } : { w: 100, h: 104 };
  }

  /**
   * The screen region the composition may occupy.
   *
   * The headline sits *beside* the machine from 900px up and *above* it below
   * that, so both the intro block and the control cluster are measured from
   * the DOM instead of being assumed — the orbit then owns exactly the space
   * that is left over, with no dead band above the Random Pick button.
   */
  private safeRegion(): { left: number; right: number; top: number; bottom: number } {
    const stacked = this.width < 900;
    const margin = this.width < 560 ? 8 : 16;
    const root = this.root();
    const head = root.querySelector<HTMLElement>(".gu-holo-head");
    const controls = root.querySelector<HTMLElement>(".gu-holo-controls");

    let left = margin;
    let top = 74;

    if (stacked) {
      if (head && head.offsetHeight > 0) {
        top = Math.min(head.offsetTop + head.offsetHeight + 14, this.height * 0.55);
      }
    } else if (head && head.offsetWidth > 0) {
      left = Math.min(head.offsetWidth + 26, this.width - 220);
    }

    let bottom = this.height - (this.width < 700 ? 150 : 168);
    if (controls && controls.offsetTop > 0) bottom = controls.offsetTop - 18;

    bottom = Math.max(bottom, top + 170);

    return { left, right: this.width - margin, top, bottom };
  }

  /**
   * Fit the camera *and* shape the shell so the composition fills the free
   * region exactly, rather than merely fitting inside it.
   *
   * Two independent corrections converge together:
   *
   * - camera distance controls the horizontal extent (projected width scales
   *   with 1/distance),
   * - the shell's vertical scale controls the vertical extent, and because
   *   only Y is scaled it cannot disturb the width at all.
   *
   * Filling is what stops a wide monitor from ending up with a dead band on
   * the right of the orbit, and what lets a portrait phone use the full height
   * between the intro block and the Random Pick control.
   */
  private computeCameraFit(): { distance: number; lookX: number; lookY: number } {
    const n = this.cardDirs.length;
    if (n === 0) return { distance: 34, lookX: 0, lookY: 0.4 };

    const region = this.safeRegion();
    const regionW = Math.max(160, region.right - region.left);
    const regionH = Math.max(160, region.bottom - region.top);
    const centreX = (region.left + region.right) / 2;
    const centreY = (region.top + region.bottom) / 2;
    const { w: cardW, h: cardH } = this.cardSize();

    const cam = new THREE.PerspectiveCamera(this.camera.fov, this.camera.aspect, 0.1, 400);
    const fovRad = (this.camera.fov * Math.PI) / 180;
    // Screen pixels per world unit at the composition's depth.
    const pxPerUnit = this.height / 2 / Math.tan(fovRad / 2);
    const CORE_WORLD_RADIUS = 4.4;

    const radius = this.layout.radius;
    const tilt = this.layout.tilt;

    let distance = 30;
    let lookX = 0;
    let lookY = 0.4;
    let sy = this.layout.sy;

    const measure = () => {
      cam.position.set(0, 1.4, distance);
      cam.lookAt(lookX, lookY, 0);
      cam.updateMatrixWorld(true);
      cam.updateProjectionMatrix();

      const core = new THREE.Vector3(0, 0, 0).project(cam);
      const coreX = (core.x * 0.5 + 0.5) * this.width;
      const coreY = (-core.y * 0.5 + 0.5) * this.height;

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      for (let i = 0; i < n; i++) {
        const dir = this.cardDirs[i] ?? { x: 0, y: 0, z: 1 };
        const p = rotateX(rotateY(dir, this.orbitAngle), tilt);
        const world = new THREE.Vector3(p.x * radius, p.y * radius, p.z * radius);
        const v = world.clone().project(cam);
        const sx = (v.x * 0.5 + 0.5) * this.width;
        const sy = (-v.y * 0.5 + 0.5) * this.height;
        const camZ = cam.position.z - world.z;
        const scale = clamp(cam.position.z / Math.max(camZ, 1), 0.6, 1.24);
        const halfW = (cardW * scale) / 2;
        const halfH = (cardH * scale) / 2;
        minX = Math.min(minX, sx - halfW);
        maxX = Math.max(maxX, sx + halfW);
        minY = Math.min(minY, sy - halfH);
        maxY = Math.max(maxY, sy + halfH);
      }
      return { coreX, coreY, minX, maxX, minY, maxY };
    };

    for (let iter = 0; iter < 18; iter++) {
      this.layout.sy = sy;
      this.syncDirs();

      const box = measure();
      const boxW = box.maxX - box.minX;
      const boxH = box.maxY - box.minY;

      // 1) Keep the machine centred in the region.
      const coreDx = box.coreX - centreX;
      const coreDy = box.coreY - centreY;
      lookX += (coreDx / pxPerUnit) * distance;
      lookY -= (coreDy / pxPerUnit) * distance;

      // 2) Width: move the camera until the orbit spans the region.
      const kw = boxW / regionW;
      if (Math.abs(kw - 1) > 0.004) distance = Math.max(6, distance * kw);

      // 3) Height: reshape the shell (never touches the width).
      const kh = boxH / regionH;
      if (Math.abs(kh - 1) > 0.006) sy = clamp(sy * (regionH / boxH), 0.55, 1.75);

      if (
        Math.abs(coreDx) < 1.5 &&
        Math.abs(coreDy) < 1.5 &&
        Math.abs(kw - 1) <= 0.004 &&
        Math.abs(kh - 1) <= 0.006
      ) {
        break;
      }
    }

    this.layout.sy = sy;
    this.syncDirs();
    this.applyProfileScale();

    // The machine's apparent radius, so the DOM bloom can track it exactly.
    this.corePixelRadius = CORE_WORLD_RADIUS * (pxPerUnit / distance);

    return { distance, lookX, lookY };
  }

  private buildLights() {
    this.scene.add(new THREE.AmbientLight(0x4b5a92, 1.4));
    const key = new THREE.DirectionalLight(0xbfd4ff, 1.5);
    key.position.set(-9, 12, 16);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x8f7bff, 0.9);
    rim.position.set(11, -6, -10);
    this.scene.add(rim);
    this.coreLight = new THREE.PointLight(0x6ea8ff, 90, 44, 2);
    this.scene.add(this.coreLight);
  }

  /** The central holographic machine: energy core, shell, rings, platforms. */
  private buildCore() {
    const group = this.coreGroup;

    // Energy core — an emissive icosahedron with a pulsing fresnel shader.
    const coreGeo = this.track(new THREE.IcosahedronGeometry(3.5, 3));
    const coreMat = this.track(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uEnergy: { value: 0 },
          uColorA: { value: new THREE.Color("#4f8cff") },
          uColorB: { value: new THREE.Color("#c56bff") },
        },
        vertexShader: /* glsl */ `
          varying vec3 vNormal;
          varying vec3 vPos;
          uniform float uTime;
          uniform float uEnergy;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vPos = position;
            float pulse = 1.0 + sin(uTime * 2.1) * 0.035 + uEnergy * 0.14;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position * pulse, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vNormal;
          varying vec3 vPos;
          uniform float uTime;
          uniform float uEnergy;
          uniform vec3 uColorA;
          uniform vec3 uColorB;
          void main() {
            float fres = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.0);
            float bands = 0.5 + 0.5 * sin(vPos.y * 5.0 - uTime * 2.6);
            float sweep = smoothstep(0.86, 1.0, sin(vPos.y * 1.6 - uTime * 1.5));
            vec3 col = mix(uColorA, uColorB, bands * 0.55 + fres * 0.55);
            float a = (0.3 + fres * 0.95 + sweep * 0.42) * (0.9 + uEnergy * 0.5);
            gl_FragColor = vec4(col, a);
          }
        `,
      }),
    );
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(this.coreMesh);

    // Inner shell — a wireframe lattice rotating against the core.
    const shellGeo = this.track(new THREE.IcosahedronGeometry(4.4, 1));
    const shellMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0x8fd8ff,
        wireframe: true,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.coreShell = new THREE.Mesh(shellGeo, shellMat);
    group.add(this.coreShell);

    // Orbital rings.
    const ringCount = QUALITY_PRESETS[this.quality].rings;
    for (let i = 0; i < ringCount; i++) {
      const radius = 5.4 + i * 1.9;
      const geo = this.track(new THREE.TorusGeometry(radius, 0.035 + i * 0.006, 8, 128));
      const mat = this.track(
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0x5b8cff : 0xc56bff,
          transparent: true,
          opacity: 0.42,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.set(Math.PI * (0.18 + i * 0.13), Math.PI * (0.1 + i * 0.21), 0);
      ring.userData.speed = 0.16 + i * 0.05;
      ring.userData.axis = i % 2 === 0 ? "y" : "z";
      group.add(ring);
      this.ringMeshes.push(ring);
    }

    // Glowing circular platforms — flat discs that read as holographic stages.
    for (let i = 0; i < 3; i++) {
      const geo = this.track(new THREE.RingGeometry(3.4 + i * 1.5, 3.62 + i * 1.5, 96));
      const mat = this.track(
        new THREE.MeshBasicMaterial({
          color: 0x6ea8ff,
          transparent: true,
          opacity: 0.14 - i * 0.03,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const disc = new THREE.Mesh(geo, mat);
      disc.rotation.x = -Math.PI / 2 + (i - 1) * 0.16;
      disc.position.y = -4.4 + i * 0.9;
      disc.userData.spin = 0.08 + i * 0.05;
      group.add(disc);
      this.ringMeshes.push(disc);
    }

    // Volumetric glow around the core.
    const glowMat = this.track(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: 0x6ea8ff,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
    this.glowSprite = new THREE.Sprite(glowMat);
    this.glowSprite.scale.set(34, 34, 1);
    group.add(this.glowSprite);

    // Scanning beam that sweeps down through the machine.
    const beamGeo = this.track(new THREE.CylinderGeometry(3.3, 3.3, 0.14, 64, 1, true));
    const beamMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0xa8e0ff,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.userData.scan = true;
    group.add(beam);
    this.ringMeshes.push(beam);
  }

  private buildStars(count: number) {
    const rng = mulberry32(90210);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const r = 70 + rng() * 190;
      const a = rng() * Math.PI * 2;
      const b = Math.acos(2 * rng() - 1);
      pos[i * 3] = r * Math.sin(b) * Math.cos(a);
      pos[i * 3 + 1] = r * Math.cos(b);
      pos[i * 3 + 2] = r * Math.sin(b) * Math.sin(a);
      c.setHSL(0.55 + rng() * 0.28, 0.55, 0.6 + rng() * 0.35);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    const geo = this.track(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = this.track(
      new THREE.PointsMaterial({
        size: 3.2,
        map: this.glowTexture,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
    this.stars = new THREE.Points(geo, mat);
    this.scene.add(this.stars);
  }

  /** Floating holographic particles circling the machine. */
  private buildMotes(count: number) {
    const rng = mulberry32(4242);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const r = 5 + rng() * 11;
      const a = rng() * Math.PI * 2;
      const y = (rng() - 0.5) * 14;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(a) * r;
      c.setHSL(0.55 + rng() * 0.22, 0.85, 0.6 + rng() * 0.3);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    const geo = this.track(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.motesMat = this.track(
      new THREE.PointsMaterial({
        size: 0.55,
        map: this.glowTexture,
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.motes = new THREE.Points(geo, this.motesMat);
    this.scene.add(this.motes);
  }

  /**
   * Distribute every registered game evenly over the sphere.
   *
   * The Fibonacci sphere is the one arrangement used at every breakpoint — a
   * flat ring or a grid of stacked rows was the failure mode this replaces —
   * and the count always comes from the registry, so a newly registered game
   * joins the orbit with no further wiring.
   */
  private buildArrangement() {
    const n = this.cards.length;
    this.fibDirs = n === 0 ? [] : fibonacciSphere(n);
    this.syncDirs();
  }

  /**
   * Rebuild the effective directions: roll the Fibonacci point set around the
   * second axis, then stretch it to the shell the fit asked for.
   *
   * The stretch is applied *last*, which keeps the shell's silhouette stable
   * under the orbit rotation (it is symmetric about Y) so the solved camera
   * fit stays valid while the worlds travel over the poles.
   */
  private syncDirs() {
    const n = this.fibDirs.length;
    if (this.cardDirs.length !== n) this.cardDirs = this.fibDirs.map(() => ({ x: 0, y: 0, z: 1 }));

    const c = Math.cos(this.tumbleAngle);
    const s = Math.sin(this.tumbleAngle);
    const sy = this.layout.sy;

    for (let i = 0; i < n; i++) {
      const f = this.fibDirs[i];
      const d = this.cardDirs[i];
      d.x = f.x * c - f.y * s;
      d.y = (f.x * s + f.y * c) * sy;
      d.z = f.z;
    }
  }

  /**
   * Keep the machine's ring system proportional to the orbit shell.
   *
   * Without this a phone's tighter orbit would leave the outer rings spinning
   * outside the cards — the composition changes shape per profile, so the
   * furniture has to follow it instead of being a fixed desktop size.
   */
  private applyProfileScale() {
    const k = this.layout.radius / 13.5;
    for (const r of this.ringMeshes) r.scale.setScalar(k);
    this.glowSprite.scale.set(34 * k, 34 * k, 1);
  }

  /* ---------------- events ---------------- */

  private onMove = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.pointerInside = true;
  };

  private onLeave = () => {
    this.pointerInside = false;
  };

  private onVisibility = () => this.syncRunning();

  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.pause();
    this.opts.onFail();
  };

  private bind() {
    this.canvas.addEventListener("pointermove", this.onMove, { passive: true });
    this.canvas.addEventListener("pointerleave", this.onLeave, { passive: true });
    this.canvas.addEventListener("webglcontextlost", this.onContextLost);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.container);
    // Web fonts change both the measured card box and the height of the intro
    // block, so re-fit once they land — otherwise the orbit can sit on the
    // headline on a cold load.
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready
        .then(() => {
          if (!this.disposed) this.resize();
        })
        .catch(() => undefined);
    }
    this.io = new IntersectionObserver(
      (entries) => {
        this.inView = entries[entries.length - 1]?.isIntersecting ?? true;
        this.syncRunning();
      },
      { threshold: 0.01 },
    );
    this.io.observe(this.container);
  }

  private unbind() {
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointerleave", this.onLeave);
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    document.removeEventListener("visibilitychange", this.onVisibility);
  }

  private resize() {
    const w = Math.max(this.container.clientWidth, 1);
    const h = Math.max(this.container.clientHeight, 1);
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.syncLayout();
    this.buildArrangement();
    this.fit = this.computeCameraFit();
  }

  /* ---------------- loop ---------------- */

  private syncRunning() {
    if (this.disposed) return;
    if (this.inView && !document.hidden) this.start();
    else this.pause();
  }

  private start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  private pause() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private loop = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(Math.max((now - this.last) / 1000, 0), 0.05);
    this.last = now;
    this.time += dt;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.adapt(dt);
  };

  /** Lower the pixel ratio if the device cannot keep up. */
  private adapt(dt: number) {
    this.frameTimeSum += dt;
    if (++this.frameCount < 90) return;
    const avg = this.frameTimeSum / this.frameCount;
    this.frameCount = 0;
    this.frameTimeSum = 0;
    if (avg > 0.034 && this.pixelRatio > 1) {
      this.pixelRatio = Math.max(1, this.pixelRatio - 0.5);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.renderer.setSize(this.width, this.height, false);
    }
  }

  private update(dt: number) {
    const m = this.motion;
    const t = this.time;

    this.energy = damp(this.energy, this.targetEnergy, 3.2, dt);
    this.orbitSpeed = damp(this.orbitSpeed, this.targetOrbitSpeed, 2.6, dt);
    if (this.autoOrbit) {
      this.orbitAngle += this.orbitSpeed * dt * m;
      // Second axis: worlds also roll over the poles instead of circling one
      // fixed band. It shares the autoOrbit gate, so a Random Pick freezes it
      // and the chosen card still lands exactly at the front.
      this.tumbleAngle += HologramEngine.TUMBLE_SPEED * dt * m;
    }

    // Core animation.
    const coreMat = this.coreMesh.material as THREE.ShaderMaterial;
    coreMat.uniforms.uTime.value = t;
    coreMat.uniforms.uEnergy.value = this.energy;
    this.coreMesh.rotation.y += dt * 0.14 * m * (1 + this.energy * 3);
    this.coreMesh.rotation.x += dt * 0.06 * m * (1 + this.energy * 2);
    this.coreShell.rotation.y -= dt * 0.1 * m * (1 + this.energy * 4);
    this.coreShell.rotation.z += dt * 0.05 * m;
    this.coreShell.scale.setScalar(1 + Math.sin(t * 1.4) * 0.02 + this.energy * 0.08);

    for (const r of this.ringMeshes) {
      if (r.userData.scan) {
        r.position.y = ((t * 2.4) % 9) - 4.5;
        (r.material as THREE.MeshBasicMaterial).opacity = 0.16 * (0.4 + this.energy);
      } else if (r.userData.spin) {
        r.rotation.z += dt * (r.userData.spin as number) * m * (1 + this.energy * 5);
      } else {
        const speed = r.userData.speed as number;
        if (r.userData.axis === "y") r.rotation.y += dt * speed * m * (1 + this.energy * 6);
        else r.rotation.z += dt * speed * m * (1 + this.energy * 6);
      }
    }

    this.coreLight.intensity = damp(this.coreLight.intensity, 90 + this.energy * 190, 4, dt);
    (this.glowSprite.material as THREE.SpriteMaterial).opacity = 0.3 + this.energy * 0.4;

    // Environment.
    this.stars.rotation.y += dt * 0.005 * m;
    this.motes.rotation.y -= dt * (0.02 + this.energy * 0.16) * m;
    this.motes.rotation.x = Math.sin(t * 0.12) * 0.1 * m;
    this.motesMat.opacity = 0.6 + this.energy * 0.35;
    this.motesMat.size = 0.34 + this.energy * 0.22;

    // Camera parallax — suspended while the shell is in the user's hand.
    const follow = this.pointerInside && !this.dragging;
    this.parallax.x = damp(this.parallax.x, follow ? this.pointer.x : 0, 2.2, dt);
    this.parallax.y = damp(this.parallax.y, follow ? this.pointer.y : 0, 2.2, dt);
    const fit = this.fit;
    // The look-at point is offset so the machine sits in the open half of the
    // frame, clear of the headline.
    this.camera.position.x = this.parallax.x * 2.2 * m;
    this.camera.position.y = 1.4 + this.parallax.y * 1.4 * m;
    this.camera.position.z = fit.distance - this.energy * 1.4;
    this.camera.lookAt(fit.lookX, fit.lookY, 0);
    this.updateCards();
  }

  /** Compute each card's world position and publish its screen projection. */
  private updateCards() {
    const n = this.cards.length;
    if (n === 0) {
      this.listener?.({ cards: [], core: this.projectCore() });
      return;
    }

    this.syncDirs();
    const orbitRadius = this.orbitRadius();
    const tilt = this.tilt();
    const selectedIndex = this.selectedId
      ? this.cards.findIndex((c) => c.id === this.selectedId)
      : -1;

    // Pass 1 — world positions, plus the real depth range of the shell.
    // The shell is reshaped per profile, so its Z extent is not simply the
    // orbit radius and the front/back grading has to be measured, not assumed.
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (let i = 0; i < n; i++) {
      const dir = this.cardDirs[i] ?? { x: 0, y: 0, z: 1 };
      // Orbit around Y (primary axis), then tilt the plane for the 3D read.
      const p = rotateX(rotateY(dir, this.orbitAngle), tilt);

      let radius = orbitRadius;
      let rise = 0;

      if (i === selectedIndex && this.selectionProgress > 0) {
        // The chosen card rises out of the sphere and moves toward the viewer.
        rise = this.selectionProgress * 9.5;
        radius = orbitRadius - this.selectionProgress * 6.4;
      }

      const world = new THREE.Vector3(p.x * radius, p.y * radius + rise, p.z * radius);
      this.cardWorld[i].copy(world);
      if (world.z < minZ) minZ = world.z;
      if (world.z > maxZ) maxZ = world.z;
    }

    const span = Math.max(maxZ - minZ, 0.001);

    // Pass 2 — screen projection.
    for (let i = 0; i < n; i++) {
      const world = this.cardWorld[i];
      const proj = world.clone().project(this.camera);
      const behind = proj.z > 1;
      const x = (proj.x * 0.5 + 0.5) * this.width;
      const y = (-proj.y * 0.5 + 0.5) * this.height;

      // Perspective scale: nearer cards are larger, so the front of the
      // formation dominates and the far side visibly recedes.
      const camZ = this.camera.position.z - world.z;
      const reference = this.camera.position.z;
      const scale = clamp(reference / Math.max(camZ, 1), 0.6, 1.24);

      // 0 = deepest behind the machine, 1 = closest to the viewer.
      const facing = clamp((world.z - minZ) / span, 0, 1);

      const isSelected = i === selectedIndex;
      const rec = this.projectionBuffer[i];
      rec.id = this.cards[i].id;
      rec.x = x;
      rec.y = y;
      rec.scale = isSelected ? scale * (1 + this.selectionProgress * 0.55) : scale;
      rec.facing = behind ? 0 : facing;
      rec.rotationY = clamp(-proj.x * 26, -34, 34);
      // Vertical tilt follows the card's own height on the shell, normalised
      // by the reshaped shell so it stays meaningful at any profile.
      const localY = clamp(world.y / Math.max(orbitRadius * Math.max(1, this.layout.sy), 1), -1, 1);
      rec.rotationX = clamp(-proj.y * 14 + localY * 10, -30, 30);
      rec.depth = world.z;
      rec.selected = isSelected;
    }

    this.listener?.({ cards: this.projectionBuffer, core: this.projectCore() });
  }

  /** Screen position and apparent size of the holographic machine. */
  private projectCore(): CoreProjection {
    const world = new THREE.Vector3(
      this.coreGroup.position.x,
      this.coreGroup.position.y,
      this.coreGroup.position.z,
    );
    const proj = world.clone().project(this.camera);
    const camZ = Math.max(this.camera.position.z - world.z, 1);
    const scale = clamp(this.camera.position.z / camZ, 0.5, 1.6);
    return {
      x: (proj.x * 0.5 + 0.5) * this.width,
      y: (-proj.y * 0.5 + 0.5) * this.height,
      // The machine's apparent radius in CSS pixels, so the bloom tracks it.
      scale: scale * (this.corePixelRadius / 380),
    };
  }}

function makeGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.18, "rgba(180,215,255,0.6)");
  grad.addColorStop(0.45, "rgba(110,168,255,0.2)");
  grad.addColorStop(1, "rgba(110,168,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
