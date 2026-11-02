// Phase 9.1 — reusable Three.js application shell.
//
// Smallest reliable host for the 3D game: renderer + scene + camera + lights +
// ground + a procedural placeholder rig, with a single animation loop,
// resize handling, quality tiers, telemetry and centralised disposal.
//
// Scope boundary (deliberate): NO driving, NO third-person orbit camera, NO
// collisions, NO terrain, NO entities beyond the rig. Those are Phase 9.2+.
// This shell only has to be trustworthy enough to build on.
//
// Resource ownership rules enforced here:
// - One RAF loop, tracked by id, cancelled on dispose; re-entrant dispose is a
//   no-op.
// - The PMREM render target created for the environment is *kept* and disposed.
//   (The existing proto3d code throws the target away after taking its texture,
//   which leaks the GPU resource; this shell does not.)
// - The rig is disposed through its own dispose() contract, and the generic
//   scene traversal skips the rig subtree so nothing is disposed twice.
// - RoomEnvironment's own geometry/materials are released after baking.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildMechRig, poseRig, type MechRig } from '../../proto3d/mechRig';
import {
  QUALITY_PRESETS,
  getPreset,
  nextQuality,
  qualityLabel,
  resolvePixelRatio,
  type QualityLevel,
} from './quality';
import { FrameTimeMonitor, buildSnapshot, type TelemetrySnapshot } from './telemetry';
import { InputController } from './input';
import { ThirdPersonCamera, type CameraViewState } from './camera';
import { terrainHeight, terrainMaxHeight } from './terrain';
import { TransformStateMachine, type TransformState } from './transform';
import {
  crossedStageIndices,
  dustRate,
  mulberry32,
  sparkRate,
  writeEffectFrame,
  type EffectFrame,
} from './effects';
import { ParticlePool } from './particles';
import { MechAudioEngine, type AudioStateView } from './audio';
import {
  DEFAULT_VEHICLE_CONFIG,
  createVehicleState,
  stepVehicle,
  type VehicleState,
} from './vehicle';

export { stageFor, type TransformState } from './transform';

export class WebGLInitError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'WebGLInitError';
  }
}

/**
 * Ground plane half-extent is 150 and the vehicle is limited to +/-140, so the
 * driveable area is far larger than the Phase 6 prototype's +/-26 test pad and
 * does not become an artificial arena on the way to an open world. Fog hides
 * the plane edge long before it is reached.
 */
const GROUND_SIZE = 300;
const FOG_NEAR = 40;
const FOG_FAR = 170;

export interface App3DOptions {
  quality?: QualityLevel;
  onStateChange?: () => void;
}

export class App3D {
  readonly container: HTMLElement;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  private rig: MechRig;
  private containerDirLight: THREE.DirectionalLight;
  private resizeObserver: ResizeObserver | null = null;
  private rafId = 0;
  private lastTime = 0;
  private disposed = false;
  private readonly monitor = new FrameTimeMonitor();

  // Phase 9.2 — player control
  private input: InputController;
  private followCamera: ThirdPersonCamera;
  private vehicle: VehicleState = createVehicleState();
  private obstacles = [
    { x: 6, z: 6, radius: 1.5 },
    { x: -8, z: 10, radius: 1.2 },
  ];
  private wheelSpin = 0;
  private readonly cameraTarget = new THREE.Vector3();

  private qualityLevel: QualityLevel;
  private onStateChange: (() => void) | null;

  // Phase 9.5 — deterministic car<->robot transformation timeline.
  private readonly transform = new TransformStateMachine();

  // Phase 9.6 — additive effects only; these never feed back into gameplay.
  private readonly particles = new ParticlePool(320);
  private readonly effectFrame: EffectFrame = { active: false, landing: 0, sparks: 0, dust: 0 };
  // Fixed seed keeps the particle scatter reproducible from run to run.
  private readonly fxRng = mulberry32(0x9e3779b9);
  private prevProgress = 0;
  private prevLanding = 0;
  private sparkAccum = 0;
  private dustAccum = 0;

  // Phase 9.6 — optional procedural audio. It stays silent until a real user
  // gesture and can never throw into the frame loop.
  private readonly audio = new MechAudioEngine();
  private readonly onAudioGesture = (): void => {
    this.audio.ensureStarted();
    this.removeAudioGestureListeners();
  };

  // Kept so the GPU resource is released on teardown.
  private environmentTarget: THREE.WebGLRenderTarget | null = null;

  constructor(container: HTMLElement, options: App3DOptions = {}) {
    this.container = container;
    this.qualityLevel = getPreset(options.quality).level;
    this.onStateChange = options.onStateChange ?? null;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // ---- renderer ----
    const preset = getPreset(this.qualityLevel);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: preset.antialias,
        powerPreference: 'high-performance',
      });
    } catch (err) {
      throw new WebGLInitError(
        'WebGL could not be initialised. The 3D game needs hardware-accelerated WebGL 2.',
        err,
      );
    }
    this.renderer = renderer;
    renderer.setPixelRatio(resolvePixelRatio(this.qualityLevel, window.devicePixelRatio));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = preset.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // ---- scene ----
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0618);
    this.scene.fog = new THREE.Fog(0x0a0618, FOG_NEAR, FOG_FAR);
    this.scene.environmentIntensity = preset.environmentIntensity;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environmentTarget = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.environmentTarget.texture;
    pmrem.dispose();
    disposeSceneContents(room); // RoomEnvironment keeps its own box geometry/materials

    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 260);
    this.camera.position.set(0, 5, 11);
    this.camera.lookAt(0, 1.2, 0);

    // ---- lights ----
    const hemi = new THREE.HemisphereLight(0x6a5fc0, 0x1a0f30, 1.0);
    this.scene.add(hemi);

    this.containerDirLight = new THREE.DirectionalLight(0xfff2e0, 2.1);
    this.containerDirLight.position.set(8, 14, 6);
    this.containerDirLight.castShadow = preset.shadows;
    this.containerDirLight.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
    const shadowCam = this.containerDirLight.shadow.camera;
    shadowCam.left = -22;
    shadowCam.right = 22;
    shadowCam.top = 22;
    shadowCam.bottom = -22;
    shadowCam.far = 50;
    this.scene.add(this.containerDirLight);

    const rim = new THREE.DirectionalLight(0x35f0ff, 0.5);
    rim.position.set(-6, 5, -8);
    this.scene.add(rim);

    // ---- minimal environment (ground + grid + scale-reference props) ----
    this.buildGround();
    this.buildProps();

    // ---- placeholder rig (procedural, NOT a canonical Mechanimo) ----
    this.rig = buildMechRig();
    this.scene.add(this.rig.root);
    poseRig(this.rig, 0);

    // ---- particle pool (Phase 9.6): one draw call, world-space FX ----
    this.scene.add(this.particles.points);

    // ---- player control (Phase 9.2) ----
    // The input controller owns every keyboard/pointer listener, so App3D no
    // longer binds its own key handler: one owner, symmetric add/remove.
    this.input = new InputController({
      pointerTarget: this.renderer.domElement,
      onAction: (action) => {
        if (action === 'transform') this.toggleTransform();
        else if (action === 'quality') this.toggleQuality();
      },
    });

    this.followCamera = new ThirdPersonCamera(this.camera);
    this.followCamera.snap(this.vehicle.heading + Math.PI, 0.42, 9);
    this.vehicle = createVehicleState();
    this.applyVehicleToRig();

    // ---- listeners ----
    // Audio can only start inside a genuine gesture (browser autoplay policy),
    // so unlock on the first pointer/key press and then unbind.
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', this.onAudioGesture);
      window.addEventListener('keydown', this.onAudioGesture);
    }

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.onResize);
      this.resizeObserver.observe(container);
    } else {
      window.addEventListener('resize', this.onResize);
    }

    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  private buildGround(): void {
    // Readable but cheap terrain: a single displaced plane with vertex colours.
    // Deterministic (pure sine-based) and one draw call.
    const segs = 48;
    const geo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, segs, segs);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeight(x, z);
      pos.setY(i, h);
      // colour by height
      const t = (h / terrainMaxHeight() + 1) / 2;
      colors[i * 3] = 0.14 + t * 0.08;
      colors[i * 3 + 1] = 0.1 + t * 0.12;
      colors[i * 3 + 2] = 0.26 + t * 0.18;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.1,
      roughness: 0.95,
    });
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  /** Landmarks: merged boxes, each also registered as a circular obstacle. */
  private buildProps(): void {
    const base = new THREE.BoxGeometry(2.4, 2.6, 2.4);
    const pieces: THREE.BufferGeometry[] = [];
    const landmarks = [
      { x: 12, z: 4 },
      { x: -14, z: -6 },
      { x: 20, z: -18 },
      { x: -22, z: 16 },
    ];
    for (const lm of landmarks) {
      const y = terrainHeight(lm.x, lm.z);
      const g = base.clone();
      g.applyMatrix4(new THREE.Matrix4().makeTranslation(lm.x, y + 1.3, lm.z));
      pieces.push(g);
      this.obstacles.push({ x: lm.x, z: lm.z, radius: 1.6 });
    }
    // keep original pillar rings
    const cyl = new THREE.CylinderGeometry(0.22, 0.3, 3.2, 8);
    const place = (count: number, radius: number, offset: number) => {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + offset;
        const g = cyl.clone();
        g.applyMatrix4(
          new THREE.Matrix4().makeTranslation(Math.cos(a) * radius, 1.6, Math.sin(a) * radius),
        );
        pieces.push(g);
      }
    };
    place(8, 20, 0.4);
    place(14, 88, 0.2);
    cyl.dispose();
    base.dispose();
    const merged = mergeGeometries(pieces, false);
    for (const g of pieces) g.dispose();
    if (!merged) return;
    const props = new THREE.Mesh(
      merged,
      new THREE.MeshStandardMaterial({ color: 0x2a2f4a, metalness: 0.5, roughness: 0.6 }),
    );
    props.castShadow = true;
    this.scene.add(props);
  }

  // ---------- public API ----------

  get quality(): QualityLevel {
    return this.qualityLevel;
  }

  getTransformState(): TransformState {
    return this.transform.getState();
  }

  /** Vehicle + camera state for the HUD and for browser/CDP verification. */
  getViewState(): {
    speed: number;
    heading: number;
    x: number;
    z: number;
    wheelSpin: number;
    particles: number;
    camera: CameraViewState;
    dragging: boolean;
  } {
    return {
      speed: this.vehicle.speed,
      heading: this.vehicle.heading,
      x: this.vehicle.x,
      z: this.vehicle.z,
      wheelSpin: this.wheelSpin,
      particles: this.particles.aliveCount,
      camera: this.followCamera.getState(),
      dragging: this.input.isPointerDragging,
    };
  }

  getTelemetry(): TelemetrySnapshot {
    const info = this.renderer.info.render;
    return buildSnapshot(this.monitor, { drawCalls: info.calls, triangles: info.triangles }, {
      quality: qualityLabel(this.qualityLevel),
      shadows: this.renderer.shadowMap.enabled,
      pixelRatio: this.renderer.getPixelRatio(),
      canvasWidth: this.renderer.domElement.width,
      canvasHeight: this.renderer.domElement.height,
    });
  }

  setQuality(level: QualityLevel): void {
    const preset = getPreset(level);
    this.qualityLevel = preset.level;
    this.renderer.setPixelRatio(resolvePixelRatio(preset.level, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = preset.shadows;
    this.containerDirLight.castShadow = preset.shadows;
    this.scene.environmentIntensity = preset.environmentIntensity;
    this.resize();
    this.onStateChange?.();
  }

  toggleQuality(): void {
    this.setQuality(nextQuality(this.qualityLevel));
  }

  /** Toggle the transformation animation. Movement is stopped while it runs so
   *  the car does not drive out from under its own animation. Repeated presses
   *  during an in-flight transformation are ignored by the state machine. */
  toggleTransform(): void {
    const toRobot = this.transform.progress < 0.999;
    if (!this.transform.toggle(performance.now())) return;
    this.vehicle.speed = 0;
    this.audio.playTransform(toRobot ? 'toRobot' : 'toCar');
    this.onStateChange?.();
  }

  getAudioState(): AudioStateView {
    return this.audio.getState();
  }

  setAudioMuted(muted: boolean): void {
    this.audio.setMuted(muted);
    this.onStateChange?.();
  }

  setAudioVolume(volume: number): void {
    this.audio.setVolume(volume);
    this.onStateChange?.();
  }

  /** For UI controls that are themselves the unlocking gesture. */
  unlockAudio(): void {
    this.audio.ensureStarted();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    cancelAnimationFrame(this.rafId);
    this.rafId = 0;

    this.removeAudioGestureListeners();
    this.audio.dispose();
    this.input.dispose();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    } else {
      window.removeEventListener('resize', this.onResize);
    }

    // Rig disposes its own subtree; excluded from the generic traversal below so
    // geometries and materials are not released twice.
    this.rig.dispose();
    this.scene.remove(this.rig.root);

    // Particle pool is a THREE.Points, not a Mesh, so the generic traversal
    // would skip it: release it explicitly.
    this.particles.dispose();
    this.scene.remove(this.particles.points);

    disposeSceneContents(this.scene, this.rig.root);

    this.environmentTarget?.dispose();
    this.environmentTarget = null;
    this.scene.environment = null;

    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  // ---------- resize ----------

  private onResize = (): void => this.resize();

  private removeAudioGestureListeners(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('pointerdown', this.onAudioGesture);
    window.removeEventListener('keydown', this.onAudioGesture);
  }

  private resize(): void {
    if (this.disposed) return;
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // ---------- transform tween ----------

  private stepTransform(now: number): void {
    if (this.transform.step(now)) this.onStateChange?.();
  }

  // ---------- vehicle (Phase 9.2) ----------

  /**
   * Drive the vehicle from held input and copy the result onto the rig.
   * Movement is car-form only and is suspended while the transformation
   * animation runs; robot locomotion is a later phase.
   */
  private stepVehicle(dt: number): void {
    const carForm = this.transform.drivable;
    const throttle = carForm ? this.input.state.throttleAxis : 0;
    const steer = carForm ? this.input.state.steerAxis : 0;

    this.vehicle = stepVehicle(this.vehicle, { throttle, steer }, dt, DEFAULT_VEHICLE_CONFIG, this.obstacles);
    this.applyVehicleToRig();
  }

  private applyVehicleToRig(): void {
    const root = this.rig.root;
    root.position.x = this.vehicle.x;
    root.position.y = terrainHeight(this.vehicle.x, this.vehicle.z);
    root.position.z = this.vehicle.z;
    root.rotation.y = this.vehicle.heading;
    // Roll the wheels from travelled distance, reusing the existing rig's wheels.
    this.wheelSpin += this.vehicle.speed * 0.05;
    for (const wheel of this.rig.wheels) wheel.rotation.x = this.wheelSpin;
  }

  // ---------- animation loop ----------

  private tick = (now: number): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.tick);

    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.monitor.push(Math.max(dt * 1000, 1e-3));

    this.stepTransform(now);
    const t = this.transform.progress;
    poseRig(this.rig, t);
    this.stepVehicle(dt);
    // Engine pitch follows ground speed; robot form has speed 0, so it fades out.
    this.audio.setEngine(this.vehicle.speed);

    const landU = (t - 0.9) / 0.1;
    if (landU > 0 && landU < 1) {
      this.rig.root.position.y = -0.12 * Math.sin(Math.PI * landU);
      const mat = this.rig.burstRing.material as THREE.MeshBasicMaterial;
      this.rig.burstRing.visible = true;
      const s = 0.4 + landU * 3.2;
      this.rig.burstRing.scale.set(s, s, s);
      mat.opacity = 0.85 * (1 - landU);
      for (const a of this.rig.accents) a.emissiveIntensity = 1.6 + 2.4 * (1 - landU);
    } else if (this.rig.burstRing.visible) {
      this.rig.burstRing.visible = false;
      for (const a of this.rig.accents) a.emissiveIntensity = 1.6;
    }

    // ---- effects (Phase 9.6): sparks, landing puff, rolling dust ----
    // Purely additive visuals driven by the same progress value; nothing here
    // feeds back into the transformation timeline or the vehicle.
    const fx = writeEffectFrame(this.effectFrame, t, this.transform.transforming, this.vehicle.speed);
    const origin = this.rig.root.position;

    // One-shot burst for every transformation stage boundary crossed this frame.
    const crossed = crossedStageIndices(this.prevProgress, t);
    for (let i = 0; i < crossed.length; i++) {
      this.particles.emit({
        count: 8,
        origin,
        speed: 3.2,
        spread: 2.4,
        rise: 1.6,
        life: 0.42,
        gravity: 7,
        color: [0.25, 0.95, 1.0],
        size: 0.14,
        rng: this.fxRng,
      });
    }

    // Continuous sparks while the transformation is mid-flight.
    this.sparkAccum += sparkRate(fx.sparks) * dt;
    while (this.sparkAccum >= 1) {
      this.sparkAccum -= 1;
      this.particles.emit({
        count: 1,
        origin,
        speed: 2.4,
        spread: 3.2,
        rise: 1.1,
        life: 0.5,
        gravity: 9,
        color: [1.0, 0.85, 0.45],
        size: 0.11,
        rng: this.fxRng,
      });
    }

    // Landing puff: one-shot when the foot-plant window opens.
    if (fx.landing > 0 && this.prevLanding === 0) {
      this.audio.playLanding();
      this.particles.emit({
        count: 18,
        origin,
        speed: 4.5,
        spread: 3.5,
        rise: 0.6,
        life: 0.7,
        gravity: 5,
        color: [0.55, 0.62, 0.75],
        size: 0.3,
        rng: this.fxRng,
      });
    }

    // Rolling dust behind the wheels while driving fast on the ground.
    this.dustAccum += dustRate(fx.dust) * dt;
    while (this.dustAccum >= 1) {
      this.dustAccum -= 1;
      this.particles.emit({
        count: 1,
        origin: { x: origin.x, y: origin.y + 0.15, z: origin.z },
        speed: 0.8,
        spread: 0.8,
        rise: 0.5,
        life: 0.55,
        gravity: -0.6,
        color: [0.35, 0.34, 0.4],
        size: 0.35,
        rng: this.fxRng,
      });
    }

    this.particles.update(dt);
    this.prevProgress = t;
    this.prevLanding = fx.landing;

    // ---- third-person follow camera ----
    const orbit = this.input.consumeOrbit();
    const zoom = this.input.consumeZoom();
    this.followCamera.applyOrbit(orbit.x, orbit.y, zoom);
    // Look a little higher in robot form so the taller silhouette stays framed.
    const focusHeight = t > 0.5 ? 1.7 : 1.05;
    this.cameraTarget.set(
      this.rig.root.position.x,
      this.rig.root.position.y + focusHeight,
      this.rig.root.position.z,
    );
    this.followCamera.update(
      this.cameraTarget,
      this.vehicle.heading,
      this.input.state.hasMovement && t <= 0.001,
      this.input.isPointerDragging,
      dt,
    );

    this.containerDirLight.position.set(
      this.rig.root.position.x + 8,
      14,
      this.rig.root.position.z + 6,
    );
    this.containerDirLight.target.position.copy(this.rig.root.position);
    this.containerDirLight.target.updateMatrixWorld();

    this.renderer.render(this.scene, this.camera);
  };
}

/**
 * Dispose every geometry/material under `root`, skipping `exclude`
 * (and its whole subtree). Each object is released exactly once.
 */
function disposeSceneContents(root: THREE.Object3D, exclude?: THREE.Object3D): void {
  const seenGeometries = new Set<THREE.BufferGeometry>();
  const seenMaterials = new Set<THREE.Material>();
  const stack: THREE.Object3D[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || node === exclude) continue;
    if ((node as THREE.Mesh).isMesh) {
      const mesh = node as THREE.Mesh;
      if (mesh.geometry && !seenGeometries.has(mesh.geometry)) {
        seenGeometries.add(mesh.geometry);
        mesh.geometry.dispose();
      }
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        if (material && !seenMaterials.has(material)) {
          seenMaterials.add(material);
          material.dispose();
        }
      }
    }
    for (const child of node.children) stack.push(child);
  }
}

export { QUALITY_PRESETS };