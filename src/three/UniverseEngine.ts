import * as THREE from "three";
import { mulberry32 } from "@/games/theme";
import { placePortals } from "./placement";
import { buildCore, createPortalDiscMaterial } from "./portals";
import type { PortalSpec, Quality } from "./portals";

export type { PortalSpec, Quality } from "./portals";

export interface EngineOptions {
  quality: Quality;
  reducedMotion: boolean;
  particles: boolean;
  portals: PortalSpec[];
  onHover: (id: string | null) => void;
  onSelect: (id: string, pointerType: string) => void;
  /** Screen position (px, relative to container) of the active portal label. null = hide. */
  onProject: (p: { x: number; y: number } | null) => void;
  onContextLost?: () => void;
}

const QUALITY = {
  high: { stars: 2400, dust: 420, pixelRatio: 2, antialias: true },
  medium: { stars: 1300, dust: 220, pixelRatio: 1.5, antialias: false },
  low: { stars: 600, dust: 90, pixelRatio: 1, antialias: false },
} as const;

interface Portal {
  spec: PortalSpec;
  root: THREE.Group;
  coreGroup: THREE.Group;
  frame: THREE.Group;
  ring1: THREE.Mesh;
  ring2: THREE.Mesh;
  disc: THREE.Mesh;
  discMat: THREE.ShaderMaterial;
  ringMats: THREE.MeshBasicMaterial[];
  glow: THREE.Sprite;
  glowMat: THREE.SpriteMaterial;
  hit: THREE.Mesh;
  animate: (t: number, dt: number, speed: number) => void;
  baseScale: number;
  phase: number;
  hover: number;
  launch: number;
}

const damp = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

function makeGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class UniverseEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private raycaster = new THREE.Raycaster();
  private disposables: Array<{ dispose(): void }> = [];
  private portals: Portal[] = [];
  private hitMeshes: THREE.Object3D[] = [];
  private stars: THREE.Points;
  private dust: THREE.Points | null = null;
  private nebulae: THREE.Sprite[] = [];
  private pathLines: THREE.LineSegments | null = null;
  private pulses: THREE.Points | null = null;
  private pulseCurves: THREE.CatmullRomCurve3[] = [];
  private pulseOffsets: number[] = [];
  private hoverLight: THREE.PointLight;

  private center = new THREE.Vector3();
  private home = new THREE.Vector3();
  private look = new THREE.Vector3();
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();

  private pointer = new THREE.Vector2(0, 0);
  private pointerInside = false;
  private parallax = new THREE.Vector2(0, 0);
  private downAt: { x: number; y: number } | null = null;

  private hoverId: string | null = null;
  private activeId: string | null = null;
  private launchId: string | null = null;
  private energy = 0;

  private raf = 0;
  private running = false;
  private inView = true;
  private last = 0;
  private t = 0;
  private frameCount = 0;
  private frameTimeSum = 0;
  private pixelRatio: number;
  private disposed = false;
  private io: IntersectionObserver | null = null;
  private ro: ResizeObserver | null = null;
  private width = 1;
  private height = 1;
  private readonly motion: number;
  private readonly canvas: HTMLCanvasElement;

  constructor(
    private container: HTMLElement,
    private opts: EngineOptions,
  ) {
    const q = QUALITY[opts.quality];
    this.motion = opts.reducedMotion ? 0.2 : 1;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, q.pixelRatio);

    this.renderer = new THREE.WebGLRenderer({
      antialias: q.antialias,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setClearColor(0x03030a, 1);
    this.canvas = this.renderer.domElement;
    this.canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:pan-y;";
    this.canvas.setAttribute("aria-hidden", "true");
    container.appendChild(this.canvas);

    this.scene.fog = new THREE.FogExp2(0x05040f, 0.011);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);

    const glow = this.track(makeGlowTexture());

    // Lights
    this.scene.add(new THREE.AmbientLight(0x6670a0, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.7);
    key.position.set(-8, 10, 12);
    this.scene.add(key);
    this.hoverLight = new THREE.PointLight(0xffffff, 0, 24, 1.6);
    this.scene.add(this.hoverLight);

    this.stars = this.buildStars(opts.particles ? q.stars : Math.round(q.stars * 0.4), glow);
    this.buildNebulae(glow);
    if (opts.particles) this.dust = this.buildDust(opts.reducedMotion ? Math.round(q.dust * 0.4) : q.dust, glow);

    this.buildPortals(glow);
    this.buildPaths(glow);
    this.frameCamera();
    this.camera.position.copy(this.home);
    this.look.copy(this.center);
    this.camera.lookAt(this.look);

    this.resize();
    this.bind();
    this.start();
  }

  /* ---------------- public API ---------------- */

  setActive(id: string | null) {
    this.activeId = id;
    if (!id) this.opts.onProject(null);
  }

  /** Cinematic dolly toward a portal. */
  launch(id: string) {
    this.launchId = id;
    this.opts.onProject(null);
  }

  cancelLaunch() {
    this.launchId = null;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.pause();
    this.unbind();
    this.io?.disconnect();
    this.ro?.disconnect();
    this.scene.traverse((o) => {
      const obj = o as THREE.Mesh;
      if (obj.geometry) obj.geometry.dispose();
      const mat = obj.material as THREE.Material | THREE.Material[] | undefined;
      if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((m) => m.dispose());
    });
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }

  /* ---------------- scene construction ---------------- */

  private track<T extends { dispose(): void }>(x: T): T {
    this.disposables.push(x);
    return x;
  }

  private buildStars(count: number, glow: THREE.Texture): THREE.Points {
    const rng = mulberry32(1337);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const r = 90 + rng() * 260;
      const a = rng() * Math.PI * 2;
      const b = Math.acos(2 * rng() - 1);
      pos[i * 3] = r * Math.sin(b) * Math.cos(a);
      pos[i * 3 + 1] = r * Math.cos(b);
      pos[i * 3 + 2] = r * Math.sin(b) * Math.sin(a);
      c.setHSL(0.55 + rng() * 0.25, 0.5, 0.65 + rng() * 0.3);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = this.track(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = this.track(
      new THREE.PointsMaterial({
        size: 2.2,
        map: glow,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        fog: false,
      }),
    );
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);
    return pts;
  }

  private buildDust(count: number, glow: THREE.Texture): THREE.Points {
    const rng = mulberry32(4242);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rng() - 0.5) * 90;
      pos[i * 3 + 1] = (rng() - 0.5) * 40;
      pos[i * 3 + 2] = (rng() - 0.5) * 70 - 8;
    }
    const geo = this.track(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = this.track(
      new THREE.PointsMaterial({
        size: 0.22,
        map: glow,
        color: 0x9fb4ff,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);
    return pts;
  }

  private buildNebulae(glow: THREE.Texture) {
    const defs: Array<[number, number, number, number, number, number]> = [
      [0x5a2bff, -70, 20, -120, 190, 0.2],
      [0x00a8ff, 80, -15, -140, 220, 0.16],
      [0xff2bd6, -20, -40, -150, 170, 0.12],
      [0x2bffb0, 110, 40, -90, 130, 0.08],
    ];
    for (const [color, x, y, z, s, o] of defs) {
      const mat = this.track(
        new THREE.SpriteMaterial({
          map: glow,
          color,
          transparent: true,
          opacity: o,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          fog: false,
        }),
      );
      const sp = new THREE.Sprite(mat);
      sp.position.set(x, y, z);
      sp.scale.set(s, s * 0.7, 1);
      this.scene.add(sp);
      this.nebulae.push(sp);
    }
  }

  private buildPortals(glow: THREE.Texture) {
    const placement = placePortals(this.opts.portals.map((p) => p.id));
    const bounds = new THREE.Box3();

    for (const spec of this.opts.portals) {
      const p = placement.get(spec.id) ?? [0, 0, 0];
      const primary = new THREE.Color(spec.primary);
      const secondary = new THREE.Color(spec.secondary);
      const core = buildCore({
        track: (x) => this.track(x),
        glowTexture: glow,
        quality: this.opts.quality,
        spec,
        primary,
        secondary,
      });

      const root = new THREE.Group();
      root.position.set(p[0], p[1], p[2]);
      const rng = mulberry32(spec.seed);
      const baseScale = 0.92 + rng() * 0.22;
      root.scale.setScalar(baseScale);

      const coreGroup = new THREE.Group();
      coreGroup.add(core.group);
      root.add(coreGroup);

      const frame = new THREE.Group();
      const ringMat1 = new THREE.MeshBasicMaterial({
        color: secondary,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ringMat2 = new THREE.MeshBasicMaterial({
        color: primary,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ring1 = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.045, 8, 96), ringMat1);
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.02, 6, 96), ringMat2);
      const discMat = createPortalDiscMaterial(primary, secondary);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(3.0, 56), discMat);
      disc.position.z = -0.4;
      frame.add(disc, ring1, ring2);
      root.add(frame);

      const glowMat = new THREE.SpriteMaterial({
        map: glow,
        color: primary,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      });
      const glowSprite = new THREE.Sprite(glowMat);
      glowSprite.scale.set(10, 10, 1);
      glowSprite.position.z = -1;
      root.add(glowSprite);

      const hit = new THREE.Mesh(new THREE.SphereGeometry(3.2, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
      hit.userData.portalId = spec.id;
      hit.visible = false;
      root.add(hit);

      this.scene.add(root);
      this.hitMeshes.push(hit);
      this.portals.push({
        spec,
        root,
        coreGroup,
        frame,
        ring1,
        ring2,
        disc,
        discMat,
        ringMats: [ringMat1, ringMat2],
        glow: glowSprite,
        glowMat,
        hit,
        animate: core.animate,
        baseScale,
        phase: rng() * Math.PI * 2,
        hover: 0,
        launch: 0,
      });
      bounds.expandByPoint(root.position.clone().addScalar(4)).expandByPoint(root.position.clone().addScalar(-4));
    }
    if (this.portals.length > 0) bounds.getCenter(this.center);
  }

  /** Energy pathways linking the worlds (nearest-neighbour chain) + traveling pulses. */
  private buildPaths(glow: THREE.Texture) {
    const n = this.portals.length;
    if (n < 2) return;
    const remaining = this.portals.map((p) => p.root.position);
    const order: THREE.Vector3[] = [];
    // start from the portal closest to the center
    let cur = remaining.reduce((a, b) => (a.distanceTo(this.center) <= b.distanceTo(this.center) ? a : b));
    order.push(cur);
    remaining.splice(remaining.indexOf(cur), 1);
    while (remaining.length) {
      const c = cur;
      const next = remaining.reduce((a, b) => (a.distanceTo(c) <= b.distanceTo(c) ? a : b));
      order.push(next);
      remaining.splice(remaining.indexOf(next), 1);
      cur = next;
    }

    const verts: number[] = [];
    const SUB = 28;
    for (let i = 0; i < order.length - 1; i++) {
      const a = order[i];
      const b = order[i + 1];
      const dir = this.tmpA.copy(b).sub(a);
      const dist = dir.length();
      dir.normalize();
      const inset = Math.min(3.4, dist * 0.3);
      const s = a.clone().addScaledVector(dir, inset);
      const e = b.clone().addScaledVector(dir, -inset);
      const mid = s.clone().lerp(e, 0.5);
      mid.y += Math.min(2.2, dist * 0.12);
      const curve = new THREE.CatmullRomCurve3([s, mid, e]);
      this.pulseCurves.push(curve);
      const pts = curve.getPoints(SUB);
      for (let k = 0; k < pts.length - 1; k++) verts.push(pts[k].x, pts[k].y, pts[k].z, pts[k + 1].x, pts[k + 1].y, pts[k + 1].z);
    }
    const geo = this.track(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
    this.pathLines = new THREE.LineSegments(
      geo,
      this.track(new THREE.LineBasicMaterial({ color: 0x5f7bff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false })),
    );
    this.scene.add(this.pathLines);

    if (this.opts.particles) {
      const count = Math.min(this.pulseCurves.length * 2, 24);
      const pg = this.track(new THREE.BufferGeometry());
      pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
      for (let i = 0; i < count; i++) this.pulseOffsets.push(i / count);
      this.pulses = new THREE.Points(
        pg,
        this.track(
          new THREE.PointsMaterial({ size: 0.9, map: glow, color: 0x9ff3ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
        ),
      );
      this.pulses.frustumCulled = false;
      this.scene.add(this.pulses);
    }
  }

  /** Position the home camera so every portal is in view. */
  private frameCamera() {
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const tanH = Math.tan(fov / 2);
    const aspect = Math.max(this.width / this.height, 0.5);
    let z = 14;
    for (const p of this.portals) {
      const pp = p.root.position;
      const needX = (Math.abs(pp.x - this.center.x) + 4.2) / (tanH * aspect);
      const needY = (Math.abs(pp.y - this.center.y) + 4.2) / tanH;
      z = Math.max(z, Math.max(needX, needY) + pp.z);
    }
    z = Math.min(z, 110);
    this.home.set(this.center.x, this.center.y + 1.2, z);
  }

  /* ---------------- events ---------------- */

  private onMove = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.pointerInside = true;
  };
  private onLeave = () => {
    this.pointerInside = false;
    this.setHover(null);
  };
  private onDown = (e: PointerEvent) => {
    this.downAt = { x: e.clientX, y: e.clientY };
    this.onMove(e);
    // For touch there is no hover: update immediately so a tap targets the right portal.
    if (e.pointerType !== "mouse") this.pick();
  };
  private onUp = (e: PointerEvent) => {
    const d = this.downAt;
    this.downAt = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return;
    this.onMove(e);
    this.pick();
    if (this.hoverId) this.opts.onSelect(this.hoverId, e.pointerType);
  };
  private onVisibility = () => this.syncRunning();
  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.pause();
    this.opts.onContextLost?.();
  };

  private bind() {
    this.canvas.addEventListener("pointermove", this.onMove);
    this.canvas.addEventListener("pointerleave", this.onLeave);
    this.canvas.addEventListener("pointerdown", this.onDown);
    this.canvas.addEventListener("pointerup", this.onUp);
    this.canvas.addEventListener("webglcontextlost", this.onContextLost);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.container);
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
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointerup", this.onUp);
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
    if (this.portals.length) this.frameCamera();
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
    this.t += dt;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.adapt(dt);
  };

  /** Lower pixel ratio if the device can't keep up. */
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

  private setHover(id: string | null) {
    if (id === this.hoverId) return;
    this.hoverId = id;
    this.opts.onHover(id);
  }

  private pick() {
    if (!this.pointerInside && this.hoverId === null) return;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.hitMeshes, false);
    const id = hits.length ? (hits[0].object.userData.portalId as string) : null;
    this.setHover(id);
  }

  private update(dt: number) {
    const m = this.motion;
    const t = this.t;

    if (this.pointerInside && !this.launchId) this.pick();

    const focusId = this.launchId ?? this.hoverId ?? this.activeId;
    this.energy = damp(this.energy, this.hoverId || this.launchId ? 1 : 0, 3, dt);

    // Parallax target
    this.parallax.x = damp(this.parallax.x, this.pointerInside ? this.pointer.x : 0, 2.2, dt);
    this.parallax.y = damp(this.parallax.y, this.pointerInside ? this.pointer.y : 0, 2.2, dt);

    // Background motion — particles accelerate with energy
    const boost = 1 + this.energy * 6;
    this.stars.rotation.y += dt * 0.004 * m * boost;
    if (this.dust) {
      this.dust.rotation.y += dt * 0.012 * m * boost;
      this.dust.position.y = Math.sin(t * 0.2) * 0.6 * m;
    }
    this.nebulae.forEach((n, i) => {
      n.material.rotation = Math.sin(t * 0.03 + i) * 0.2 * m;
    });

    // Portals
    let focus: Portal | null = null;
    let hoverColor: THREE.Color | null = null;
    for (const p of this.portals) {
      const isFocus = p.spec.id === focusId;
      if (isFocus) focus = p;
      p.hover = damp(p.hover, isFocus ? 1 : 0, 5, dt);
      p.launch = damp(p.launch, p.spec.id === this.launchId ? 1 : 0, 2.6, dt);
      const dim = this.launchId && !isFocus ? 1 - p.launch * 0 : 1;
      const speed = (1 + p.hover * 3.5 + p.launch * 6) * (0.35 + 0.65 * m);

      p.animate(t, dt, speed);
      p.coreGroup.position.y = Math.sin(t * 0.8 + p.phase) * 0.22 * m;
      p.frame.quaternion.copy(this.camera.quaternion);
      p.ring1.rotation.z += dt * 0.25 * speed;
      p.ring2.rotation.z -= dt * 0.15 * speed;
      p.discMat.uniforms.uTime.value = t * (0.4 + 0.6 * m);
      p.discMat.uniforms.uAlpha.value = (0.55 + p.hover * 0.9 + p.launch * 2.2) * dim;
      p.ringMats[0].opacity = 0.5 + p.hover * 0.5;
      p.ringMats[1].opacity = 0.25 + p.hover * 0.45;
      p.glowMat.opacity = (0.26 + p.hover * 0.5 + p.launch * 0.4) * (this.launchId && !isFocus ? 0.4 : 1);
      p.root.scale.setScalar(p.baseScale * (1 + p.hover * 0.1 + p.launch * 0.25));
      p.disc.scale.setScalar(1 + p.launch * 1.6);
      if (isFocus) hoverColor = p.glowMat.color;
    }

    // Environment responds: light tints toward the focused world
    if (focus && hoverColor) {
      this.hoverLight.color.lerp(hoverColor, 1 - Math.exp(-6 * dt));
      this.hoverLight.position.copy(focus.root.position).add(this.tmpA.set(0, 1.5, 5));
    }
    this.hoverLight.intensity = damp(this.hoverLight.intensity, focus ? 60 : 0, 4, dt);

    // Energy pulses
    if (this.pulses && this.pulseCurves.length) {
      const attr = this.pulses.geometry.attributes.position as THREE.BufferAttribute;
      const segs = this.pulseCurves.length;
      for (let i = 0; i < this.pulseOffsets.length; i++) {
        this.pulseOffsets[i] = (this.pulseOffsets[i] + dt * 0.05 * m * (1 + this.energy * 4)) % 1;
        if (this.pulseOffsets[i] < 0) this.pulseOffsets[i] += 1;
        const f = this.pulseOffsets[i] * segs;
        const si = Math.min(Math.floor(f), segs - 1);
        const pt = this.pulseCurves[si].getPoint(f - si);
        attr.setXYZ(i, pt.x, pt.y, pt.z);
      }
      attr.needsUpdate = true;
    }

    // Camera
    const desiredPos = this.tmpA;
    const desiredLook = this.tmpB;
    let k = 1.8;
    if (this.launchId && focus) {
      desiredPos.copy(focus.root.position).add(new THREE.Vector3(0, 0.2, 4.6));
      desiredLook.copy(focus.root.position);
      k = 2.6;
    } else {
      const drift = Math.sin(t * 0.12) * 0.9 * m;
      desiredPos.set(
        this.home.x + this.parallax.x * 2.4 * m + drift,
        this.home.y + this.parallax.y * 1.4 * m,
        this.home.z,
      );
      desiredLook.copy(this.center);
      if (focus) {
        desiredPos.addScaledVector(this.tmpB.copy(focus.root.position).sub(this.center), 0.14 * m);
        desiredPos.z -= 1.6 * m;
        desiredLook.copy(this.center).lerp(focus.root.position, 0.32 * m);
      }
    }
    const a = 1 - Math.exp(-k * dt);
    this.camera.position.lerp(desiredPos, a);
    this.look.lerp(desiredLook, a);
    this.camera.lookAt(this.look);

    const targetFov = this.launchId ? 38 : 50;
    if (Math.abs(this.camera.fov - targetFov) > 0.01) {
      this.camera.fov = damp(this.camera.fov, targetFov, 2.2, dt);
      this.camera.updateProjectionMatrix();
    }

    // Label projection for the DOM overlay
    const labelId = this.hoverId ?? this.activeId;
    if (labelId && !this.launchId) {
      const p = this.portals.find((x) => x.spec.id === labelId);
      if (p) {
        const v = this.tmpA.copy(p.root.position);
        v.y -= 3.7 * p.baseScale;
        v.project(this.camera);
        if (v.z < 1) {
          this.opts.onProject({ x: (v.x * 0.5 + 0.5) * this.width, y: (-v.y * 0.5 + 0.5) * this.height });
        } else this.opts.onProject(null);
      }
    }
  }
}
