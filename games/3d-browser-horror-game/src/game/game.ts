import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GameAudio } from './audio';
import { Granny, type GrannyEnv, type Noise, type PlayerView } from './granny';
import {
  CREAK_ZONES,
  FIXED_ITEMS,
  FLOOR_Y,
  GRANNY_SPAWN_NODE,
  ITEM_SPOTS,
  NAV_NODES,
  NOTES,
  PLAYER_SPAWN,
  TRAPS,
  floorAt,
  groundY,
  pointBlockedSight,
  resolveCircle,
  roomAt,
  segmentBlocked,
  type Floor,
} from './layout';
import { ITEM_NAMES, makeBottle, makeGlint, makeKey, makeNote, makeTrap, setTrapAngle, type ItemId, type TrapRT } from './props';
import { disposeMaterials } from './materials';
import { disposeTextures } from './textures';
import { World } from './world';

export type Phase = 'ready' | 'playing' | 'paused' | 'caught' | 'gameover' | 'win';

export interface Settings {
  volume: number;
  brightness: number;
  sensitivity: number;
  quality: 'high' | 'low';
}

export interface HudState {
  day: number;
  maxDays: number;
  stamina: number;
  exhausted: boolean;
  noise: number;
  prompt: string | null;
  promptTone: 'normal' | 'locked';
  brass: boolean;
  silver: boolean;
  padlock: boolean;
  doorKey: boolean;
  studyOpen: boolean;
  masterOpen: boolean;
  bottles: number;
  hidden: boolean;
  hideType: 'wardrobe' | 'bed' | null;
  fear: number;
  flashlight: boolean;
  crouch: boolean;
  trapped: boolean;
  room: string;
  objective: string;
  whiteout: number;
  grannyState: string;
  damage: number;
  noLock: boolean;
}

export interface PhaseInfo {
  day?: number;
  maxDays?: number;
  time?: number;
  dayChange?: boolean;
}

export interface GameCallbacks {
  onHud(h: HudState): void;
  onMessage(text: string, tone: 'info' | 'warn' | 'good' | 'bad'): void;
  onNote(n: { title: string; text: string } | null): void;
  onPhase(p: Phase, info?: PhaseInfo): void;
}

interface ItemRT {
  id: ItemId;
  noteIndex: number;
  obj: THREE.Group;
  glint: THREE.Sprite | null;
  floor: Floor;
  taken: boolean;
  phase: number;
}

interface Projectile {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  floor: Floor;
  spin: THREE.Vector3;
}

interface Shard {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  floor: Floor;
}

type Target =
  | { type: 'door'; id: string }
  | { type: 'front'; id: string }
  | { type: 'item'; index: number }
  | { type: 'hide'; index: number };

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const wrapPI = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
const smooth = (t: number) => t * t * (3 - 2 * t);

const HORROR_SHADER = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    time: { value: 0 },
    fear: { value: 0 },
    pulse: { value: 0 },
    damage: { value: 0 },
    tunnel: { value: 0 },
    resolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float fear;
    uniform float pulse;
    uniform float damage;
    uniform float tunnel;
    uniform vec2 resolution;
    varying vec2 vUv;
    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float r2 = dot(c, c);
      // subtle breathing warp when afraid
      uv += c * sin(time * 1.7) * 0.004 * fear;
      float ab = (0.0010 + fear * 0.005 + damage * 0.012) * (0.25 + r2 * 3.2);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + c * ab).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - c * ab).b;

      float d = length(c) * 1.4142;
      float s = 0.55 + fear * 0.45 + tunnel * 0.75 + pulse * 0.22;
      float vig = 1.0 - clamp(pow(d, 2.1) * s, 0.0, 1.0);
      col *= vig;

      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, 1.0 - fear * 0.45 - tunnel * 0.35);
      col = mix(col, vec3(l * 1.4 + 0.02, l * 0.12, l * 0.12), damage * 0.7);

      float g = hash(gl_FragCoord.xy + fract(time) * 97.0) - 0.5;
      col *= 1.0 + g * (0.22 + fear * 0.2);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class Game {
  private container: HTMLElement;
  private cb: GameCallbacks;
  private settings: Settings;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private horror: ShaderPass | null = null;
  private canvas: HTMLCanvasElement;
  private ambient: THREE.AmbientLight;
  private flashLight: THREE.SpotLight;
  private flashDir = new THREE.Vector3(0, 0, -1);

  private world: World;
  private granny: Granny;
  private audio = new GameAudio();

  phase: Phase = 'ready';
  private raf = 0;
  private lastT = 0;
  private time = 0;
  private elapsed = 0;
  private disposed = false;

  private keys = new Set<string>();
  private locked = false;
  private noLock = false;
  private hadLock = false;
  private dragging = false;

  private player = {
    x: PLAYER_SPAWN.x,
    z: PLAYER_SPAWN.z,
    y: FLOOR_Y[PLAYER_SPAWN.floor],
    floor: PLAYER_SPAWN.floor as Floor,
    yaw: PLAYER_SPAWN.yaw,
    pitch: 0,
    vx: 0,
    vz: 0,
    eye: 1.62,
    crouch: false,
    stamina: 1,
    exhausted: false,
    trapped: 0,
    speed: 0,
    stepDist: 0,
    bob: 0,
    sprinting: false,
    hide: { state: 'none' as 'none' | 'entering' | 'inside' | 'exiting', idx: -1, t: 0, inside: 0, fromX: 0, fromY: 0, fromZ: 0, fromYaw: 0, cx: 0, cy: 0, cz: 0 },
  };
  private inv = { brass_key: false, silver_key: false, padlock_key: false, door_key: false, bottles: 0 };
  private flashOn = true;
  private flashWasOn = true;
  private seenHiding = false;

  private items: ItemRT[] = [];
  private traps: TrapRT[] = [];
  private projectiles: Projectile[] = [];
  private shards: Shard[] = [];
  private noises: Noise[] = [];
  private noiseLevel = 0;
  private shake = 0;
  private damage = 0;
  private pulse = 0;
  private fear = 0;
  private heartT = 0;
  private lightningT = 12;
  private flashClock = 99;
  private baseAmbient = 0.85;

  private day = 1;
  private readonly maxDays = 5;
  private caughtT = 0;
  private winT = -1;
  private whiteout = 0;

  private raycaster = new THREE.Raycaster();
  private target: Target | null = null;
  private interactT = 0;
  private hudT = 0;
  private noteOpenFrom: { x: number; z: number; floor: Floor } | null = null;
  private noteTimer = 0;
  private playerView: PlayerView;
  private env: GrannyEnv;
  private shardMat = new THREE.MeshStandardMaterial({ color: 0xbfe6d0, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.8 });
  private shardGeo = new THREE.BoxGeometry(0.03, 0.006, 0.02);
  private trapNoticed = false;
  debugFreeze = false;

  private handlers: [EventTarget, string, EventListener][] = [];

  constructor(container: HTMLElement, cb: GameCallbacks, settings: Settings) {
    this.container = container;
    this.cb = cb;
    this.settings = settings;

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    const pr = Math.min(window.devicePixelRatio || 1, settings.quality === 'high' ? 1.5 : 1);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.canvas = this.renderer.domElement;
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    container.appendChild(this.canvas);

    this.scene.background = new THREE.Color(0x020204);
    this.scene.fog = new THREE.FogExp2(0x040508, 0.052);

    this.camera = new THREE.PerspectiveCamera(72, w / h, 0.04, 70);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    this.ambient = new THREE.AmbientLight(0x8d9fd0, this.baseAmbient * settings.brightness);
    this.scene.add(this.ambient);

    this.flashLight = new THREE.SpotLight(0xfff0d6, 17, 30, 0.46, 0.65, 1.1);
    this.flashLight.castShadow = true;
    const ss = settings.quality === 'high' ? 1024 : 512;
    this.flashLight.shadow.mapSize.set(ss, ss);
    this.flashLight.shadow.camera.near = 0.15;
    this.flashLight.shadow.camera.far = 26;
    this.flashLight.shadow.bias = -0.0005;
    this.flashLight.shadow.normalBias = 0.03;
    this.scene.add(this.flashLight);
    this.scene.add(this.flashLight.target);

    this.world = new World();
    this.scene.add(this.world.root);

    this.granny = new Granny(this.scene);
    this.granny.reset(GRANNY_SPAWN_NODE);

    this.buildTraps();
    this.spawnItems();

    this.playerView = {
      x: 0, y: 0, z: 0, floor: 0, hidden: false, hideIndex: -1, crouch: false, flashlight: true, speed: 0, seenHiding: false,
    };
    this.env = {
      player: this.playerView,
      hides: this.world.hides,
      world: this.world,
      audio: this.audio,
      noises: this.noises,
      onCatch: () => this.onCaught(),
    };

    this.setupComposer(w, h);
    this.bindEvents();
    this.world.update(0.016, 0);
    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  // ====================================================================== setup
  private setupComposer(w: number, h: number) {
    try {
      const rt = new THREE.WebGLRenderTarget(w, h, {
        type: THREE.HalfFloatType,
        samples: this.settings.quality === 'high' ? 4 : 0,
      });
      const composer = new EffectComposer(this.renderer, rt);
      composer.setPixelRatio(this.renderer.getPixelRatio());
      composer.setSize(w, h);
      composer.addPass(new RenderPass(this.scene, this.camera));
      const sp = new ShaderPass(HORROR_SHADER);
      composer.addPass(sp);
      composer.addPass(new OutputPass());
      this.composer = composer;
      this.horror = sp;
      sp.uniforms.resolution.value.set(w * this.renderer.getPixelRatio(), h * this.renderer.getPixelRatio());
    } catch (err) {
      console.warn('Post-processing unavailable, falling back to direct rendering', err);
      this.composer = null;
      this.horror = null;
    }
  }

  private buildTraps() {
    for (const t of TRAPS) {
      const m = makeTrap();
      m.group.position.set(t.x, FLOOR_Y[t.floor] + 0.005, t.z);
      m.group.rotation.y = Math.random() * Math.PI;
      this.scene.add(m.group);
      setTrapAngle(m, 0);
      this.traps.push({ ...m, sprung: false, t: 0, x: t.x, z: t.z, floor: t.floor });
    }
  }

  private spawnItems() {
    const spots = [...ITEM_SPOTS];
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    const add = (id: ItemId, s: { x: number; y: number; z: number; floor: Floor }, noteIndex = -1) => {
      const isKey = id.endsWith('_key');
      const obj = id === 'bottle' ? makeBottle() : id === 'note' ? makeNote() : makeKey(id);
      obj.position.set(s.x, s.y + (isKey ? 0.014 : id === 'note' ? 0.004 : 0), s.z);
      if (isKey) obj.rotation.y = Math.random() * Math.PI * 2;
      if (id === 'bottle') obj.rotation.y = Math.random() * Math.PI * 2;
      const index = this.items.length;
      let glint: THREE.Sprite | null = null;
      if (isKey) {
        glint = makeGlint(id === 'silver_key' ? 0xcfe8ff : id === 'door_key' ? 0x8fc4ff : id === 'padlock_key' ? 0xff9a9a : 0xffe08a);
        glint.position.set(0, 0.07, 0);
        obj.add(glint);
      }
      // forgiving invisible pickup hitbox (raycasts ignore visibility)
      const pr = id === 'note' ? 0.2 : id === 'bottle' ? 0.14 : 0.13;
      const proxy = new THREE.Mesh(new THREE.SphereGeometry(pr, 6, 4), new THREE.MeshBasicMaterial());
      proxy.position.set(0, id === 'bottle' ? 0.12 : 0.05, 0);
      proxy.visible = false;
      obj.add(proxy);
      obj.traverse((o) => {
        if (!(o instanceof THREE.Sprite)) o.userData.interact = { type: 'item', index };
      });
      this.scene.add(obj);
      this.items.push({ id, noteIndex, obj, glint, floor: s.floor, taken: false, phase: Math.random() * 6 });
    };
    add('brass_key', spots[0]);
    add('silver_key', spots[1]);
    for (let i = 0; i < 6; i++) add('bottle', spots[2 + i]);
    for (const f of FIXED_ITEMS) add(f.id as ItemId, f);
    NOTES.forEach((n, i) => add('note', n, i));
  }

  private bindEvents() {
    const on = (t: EventTarget, type: string, fn: (e: never) => void) => {
      const h = fn as unknown as EventListener;
      t.addEventListener(type, h);
      this.handlers.push([t, type, h]);
    };
    on(window, 'resize', () => this.onResize());
    on(document, 'keydown', (e: KeyboardEvent) => this.onKeyDown(e));
    on(document, 'keyup', (e: KeyboardEvent) => this.keys.delete(e.code));
    on(window, 'blur', () => this.keys.clear());
    on(document, 'mousemove', (e: MouseEvent) => this.onMouseMove(e));
    on(this.canvas, 'mousedown', (e: MouseEvent) => this.onMouseDown(e));
    on(document, 'mouseup', () => {
      this.dragging = false;
    });
    on(document, 'pointerlockchange', () => this.onLockChange());
    on(document, 'pointerlockerror', () => this.lockFailed());
    on(document, 'visibilitychange', () => {
      if (document.hidden && this.phase === 'playing') this.pause();
    });
    on(this.canvas, 'contextmenu', (e: Event) => e.preventDefault());
  }

  private onResize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
      this.horror?.uniforms.resolution.value.set(w * this.renderer.getPixelRatio(), h * this.renderer.getPixelRatio());
    }
  }

  // ====================================================================== public api
  setSettings(s: Settings) {
    this.settings = s;
    this.audio.setVolume(s.volume);
    this.ambient.intensity = this.baseAmbient * s.brightness;
  }

  start() {
    if (this.phase !== 'ready') return;
    this.audio.init();
    this.audio.setVolume(this.settings.volume);
    this.phase = 'playing';
    this.lastT = performance.now();
    this.requestLock();
    this.cb.onPhase('playing', { day: this.day, maxDays: this.maxDays, dayChange: true });
    setTimeout(() => {
      if (!this.disposed) this.cb.onMessage('Find the keys. Get out. Don\'t let Granny hear you.', 'info');
    }, 1500);
  }

  resume() {
    if (this.phase !== 'paused') return;
    this.phase = 'playing';
    this.audio.resume();
    this.lastT = performance.now();
    this.requestLock();
    this.cb.onPhase('playing', { day: this.day, maxDays: this.maxDays });
  }

  pause() {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.keys.clear();
    this.audio.suspend();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.cb.onPhase('paused');
  }

  /** debug helper (used by automated visual checks) */
  debugTeleport(x: number, z: number, floor: Floor, yaw: number, pitch = 0) {
    const p = this.player;
    p.x = x;
    p.z = z;
    p.floor = floor;
    p.y = groundY(x, z, floor);
    p.yaw = yaw;
    p.pitch = pitch;
  }
  debugAct() {
    this.interactT = 0;
    this.updateInteraction(0);
    const t = this.promptFor(this.target).text;
    this.interact();
    return t;
  }
  debugStep(n: number, dt = 0.05) {
    for (let i = 0; i < n; i++) this.update(dt);
  }
  debugGive(ids: string[]) {
    for (const id of ids) {
      if (id === 'bottle') this.inv.bottles = 3;
      else (this.inv as Record<string, number | boolean>)[id] = true;
    }
  }
  debugGrannyTo(x: number, z: number, floor: Floor, yaw: number) {
    this.granny.x = x;
    this.granny.z = z;
    this.granny.floor = floor;
    this.granny.yaw = yaw;
    this.granny.model.group.position.set(x, groundY(x, z, floor), z);
    this.granny.model.group.rotation.y = yaw;
  }
  debugInfo() {
    const g = this.granny;
    const doors: Record<string, number> = {};
    this.world.doors.forEach((d) => (doors[d.def.id] = Math.round(d.open * 100) / 100));
    return { trapped: this.player.trapped, prompt: this.promptFor(this.target).text, hide: this.player.hide.state, doors, bottles: this.inv.bottles, phase: this.phase, granny: { x: g.x, z: g.z, floor: g.floor, state: g.state }, player: { x: this.player.x, z: this.player.z, floor: this.player.floor }, inv: this.inv, items: this.items.filter((i) => !i.taken && i.id !== 'bottle' && i.id !== 'note').map((i) => ({ id: i.id, x: i.obj.position.x, y: i.obj.position.y, z: i.obj.position.z })) };
  }

  closeNote() {
    this.noteOpenFrom = null;
    this.cb.onNote(null);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const [t, type, h] of this.handlers) t.removeEventListener(type, h);
    this.handlers = [];
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.audio.dispose();
    this.world.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else if (m && !(m as THREE.Material & { map?: unknown }).map) m.dispose();
      }
    });
    this.composer?.dispose();
    this.renderer.dispose();
    disposeMaterials();
    disposeTextures();
    if (this.canvas.parentElement === this.container) this.container.removeChild(this.canvas);
  }

  // ====================================================================== input
  private requestLock() {
    if (this.noLock) return;
    try {
      const r = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (r && typeof r.catch === 'function') r.catch(() => this.lockFailed());
    } catch {
      this.lockFailed();
    }
  }

  private lockFailed() {
    if (this.hadLock) {
      if (this.phase === 'playing') this.pause();
      return;
    }
    if (!this.noLock) {
      this.noLock = true;
      this.cb.onMessage('Mouse capture unavailable here — drag the mouse or use the arrow keys to look around.', 'warn');
    }
  }

  private onLockChange() {
    if (document.pointerLockElement === this.canvas) {
      this.locked = true;
      this.hadLock = true;
    } else {
      this.locked = false;
      if (this.phase === 'playing' && !this.noLock) this.pause();
    }
  }

  private onKeyDown(e: KeyboardEvent) {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    if (e.repeat) {
      this.keys.add(e.code);
      return;
    }
    this.keys.add(e.code);
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (this.phase === 'playing' && (this.noLock || e.code === 'KeyP')) this.pause();
      else if (this.phase === 'paused' && e.code === 'KeyP') this.resume();
      return;
    }
    if (this.phase !== 'playing') return;
    if (e.code === 'KeyE') this.interact();
    else if (e.code === 'KeyF') this.toggleFlash();
    else if (e.code === 'KeyQ') this.throwBottle();
  }

  private onMouseMove(e: MouseEvent) {
    if (this.phase !== 'playing') return;
    if (!this.locked && !this.dragging) return;
    const s = 0.0021 * this.settings.sensitivity;
    const p = this.player;
    p.yaw -= e.movementX * s;
    p.pitch = clamp(p.pitch - e.movementY * s, -1.45, 1.45);
  }

  private onMouseDown(e: MouseEvent) {
    if (this.phase !== 'playing') return;
    if (e.button === 0) {
      if (this.locked) this.throwBottle();
      else if (this.noLock) this.dragging = true;
    } else if (e.button === 2) {
      if (this.locked) this.interact();
    }
  }

  private toggleFlash() {
    if (this.player.hide.state !== 'none') return;
    this.flashOn = !this.flashOn;
    this.audio.footstep('crouch');
  }

  // ====================================================================== main loop
  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    let dt = (now - this.lastT) / 1000;
    this.lastT = now;
    dt = Math.min(dt, 0.05);
    this.time += dt;

    if (this.phase === 'paused' || this.phase === 'gameover' || this.phase === 'win') {
      this.render(dt);
      return;
    }
    this.update(dt);
    this.render(dt);
  };

  private render(dt: number) {
    if (this.horror) {
      const u = this.horror.uniforms;
      u.time.value = this.time;
      u.fear.value = this.fear;
      u.pulse.value = this.pulse;
      u.damage.value = this.damage;
      u.tunnel.value = this.player.hide.state === 'inside' ? 1 : this.player.hide.state === 'none' ? 0 : 0.6;
    }
    this.pulse = Math.max(0, this.pulse - dt * 2.2);
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  private update(dt: number) {
    const p = this.player;
    this.world.update(dt, this.time);
    this.updateLightning(dt);

    if (this.phase === 'ready') {
      // slow menu camera drift
      p.yaw = PLAYER_SPAWN.yaw + Math.sin(this.time * 0.15) * 0.5;
      p.pitch = -0.08 + Math.sin(this.time * 0.11) * 0.04;
      this.updateCamera(dt);
      this.granny.update(dt, this.buildEnv(dt));
      this.noises.length = 0;
      return;
    }

    this.elapsed += dt;
    if (this.phase === 'playing') {
      this.updatePlayer(dt);
      this.updateInteraction(dt);
    } else if (this.phase === 'caught') {
      this.updateCaught(dt);
    }
    if (this.winT >= 0) this.updateWin(dt);

    this.updateTraps(dt);
    this.updateProjectiles(dt);
    this.updateItems(dt);

    // granny
    if (!this.debugFreeze && (this.phase !== 'caught' || this.granny.state === 'catching')) {
      this.granny.update(dt, this.buildEnv(dt));
    }
    this.noises.length = 0;
    if (this.granny.justSpotted) {
      this.granny.justSpotted = false;
      this.audio.stinger();
      this.shake = Math.max(this.shake, 0.35);
      this.cb.onMessage('SHE SAW YOU! RUN!', 'bad');
    }
    if (this.granny.justStunned) {
      this.granny.justStunned = false;
      this.cb.onMessage('Direct hit! She\'s stunned — go!', 'good');
    }

    this.updateFear(dt);
    this.updateCamera(dt);
    this.updateAudio(dt);

    this.damage = Math.max(0, this.damage - dt * 0.9);
    this.shake = Math.max(0, this.shake - dt * 1.6);
    this.noiseLevel = Math.max(0, this.noiseLevel - dt * 0.9);

    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.1;
      this.pushHud();
    }
  }

  private buildEnv(_dt: number): GrannyEnv {
    const p = this.player;
    const v = this.playerView;
    v.x = p.x;
    v.y = p.y;
    v.z = p.z;
    v.floor = p.floor;
    v.hidden = p.hide.state !== 'none';
    v.hideIndex = p.hide.idx;
    v.crouch = p.crouch;
    v.flashlight = this.flashOn;
    v.speed = p.speed;
    v.seenHiding = this.seenHiding;
    this.granny.speedMul = 1 + (this.day - 1) * 0.045;
    return this.env;
  }

  // ====================================================================== player
  private updatePlayer(dt: number) {
    const p = this.player;
    const k = this.keys;
    const ls = 1.9 * dt;
    if (k.has('ArrowLeft')) p.yaw += ls;
    if (k.has('ArrowRight')) p.yaw -= ls;
    if (k.has('ArrowUp')) p.pitch = clamp(p.pitch + ls, -1.45, 1.45);
    if (k.has('ArrowDown')) p.pitch = clamp(p.pitch - ls, -1.45, 1.45);

    if (p.hide.state !== 'none') {
      this.updateHide(dt);
      return;
    }
    if (this.winT >= 0) return;

    const fwd = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    const str = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    p.crouch = k.has('KeyC') || k.has('ControlLeft') || k.has('ControlRight');
    let wx = -Math.sin(p.yaw) * fwd + Math.cos(p.yaw) * str;
    let wz = -Math.cos(p.yaw) * fwd - Math.sin(p.yaw) * str;
    const len = Math.hypot(wx, wz);
    if (len > 0) {
      wx /= len;
      wz /= len;
    }
    const wantSprint = (k.has('ShiftLeft') || k.has('ShiftRight')) && len > 0 && !p.crouch && fwd >= 0 && !p.exhausted && p.trapped <= 0;
    p.sprinting = wantSprint;
    if (wantSprint) {
      p.stamina -= dt / 5.2;
      if (p.stamina <= 0) {
        p.stamina = 0;
        p.exhausted = true;
        this.cb.onMessage('Out of breath!', 'warn');
      }
    } else {
      p.stamina = Math.min(1, p.stamina + dt / (len > 0 ? 8 : 4.5));
      if (p.exhausted && p.stamina > 0.35) p.exhausted = false;
    }
    let speed = p.crouch ? 1.35 : wantSprint ? 4.7 : p.exhausted ? 2.2 : 2.75;
    if (p.trapped > 0) {
      speed = 0;
      p.trapped -= dt;
      if (p.trapped <= 0) this.cb.onMessage('You wrench your leg free...', 'info');
    }
    const a = 1 - Math.exp(-dt * 10);
    p.vx += (wx * speed - p.vx) * a;
    p.vz += (wz * speed - p.vz) * a;
    const px = p.x;
    const pz = p.z;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.floor = floorAt(p.x, p.z, p.floor);
    resolveCircle(p, 0.3, p.floor);
    const moved = Math.hypot(p.x - px, p.z - pz);
    p.speed = moved / Math.max(dt, 1e-4);

    p.stepDist += moved;
    const stride = wantSprint ? 1.8 : p.crouch ? 0.95 : 1.3;
    if (p.stepDist >= stride) {
      p.stepDist -= stride;
      this.onFootstep(wantSprint);
    }
    p.bob += moved * (wantSprint ? 4.2 : 3.4);

    const gy = groundY(p.x, p.z, p.floor);
    p.y += (gy - p.y) * Math.min(1, dt * 16);
    const eyeT = p.crouch ? 1.0 : 1.62;
    p.eye += (eyeT - p.eye) * Math.min(1, dt * 9);

    // note auto-close
    if (this.noteOpenFrom) {
      this.noteTimer -= dt;
      if (this.noteTimer <= 0 || Math.hypot(p.x - this.noteOpenFrom.x, p.z - this.noteOpenFrom.z) > 2.6) this.closeNote();
    }
  }

  private onFootstep(sprint: boolean) {
    const p = this.player;
    this.audio.footstep(p.crouch ? 'crouch' : sprint ? 'run' : 'walk');
    const radius = p.crouch ? 2.2 : sprint ? 14 : 6.5;
    this.emitNoise(p.x, p.z, p.floor, radius);
    if (!p.crouch) {
      for (const z of CREAK_ZONES) {
        if (z.floor === p.floor && p.x > z.x1 && p.x < z.x2 && p.z > z.z1 && p.z < z.z2 && Math.random() < 0.55) {
          this.audio.creak(undefined, 1.1);
          this.emitNoise(p.x, p.z, p.floor, sprint ? 24 : 16);
          break;
        }
      }
    }
  }

  private emitNoise(x: number, z: number, floor: Floor, radius: number) {
    this.noises.push({ x, z, floor, radius });
    this.noiseLevel = Math.max(this.noiseLevel, Math.min(1, radius / 22));
  }

  // ---------------------------------------------------------------- hiding
  private enterHide(idx: number) {
    const hs = this.world.hides[idx];
    if (!hs) return;
    const p = this.player;
    if (this.granny.state === 'chase' && this.granny.canSee) this.seenHiding = true;
    p.hide.state = 'entering';
    p.hide.idx = idx;
    p.hide.t = 0;
    p.hide.inside = 0;
    p.hide.fromX = p.x;
    p.hide.fromY = p.y + p.eye;
    p.hide.fromZ = p.z;
    p.hide.fromYaw = p.yaw;
    this.flashWasOn = this.flashOn;
    this.flashOn = false;
    hs.target = 1;
    p.vx = p.vz = 0;
    this.audio.creak(undefined, 0.5);
    this.closeNote();
  }

  private exitHide() {
    const p = this.player;
    if (p.hide.state !== 'inside') return;
    const hs = this.world.hides[p.hide.idx];
    p.hide.state = 'exiting';
    p.hide.t = 0;
    if (hs) hs.target = 1;
    this.audio.creak(undefined, 0.5);
  }

  private updateHide(dt: number) {
    const p = this.player;
    const hs = this.world.hides[p.hide.idx];
    if (!hs) {
      p.hide.state = 'none';
      return;
    }
    const sp = hs.spot;
    const fy = FLOOR_Y[sp.floor];
    const inY = fy + (sp.type === 'wardrobe' ? 1.5 : 0.2);
    const facing = Math.atan2(-sp.fx, -sp.fz);
    const h = p.hide;
    if (h.state === 'entering') {
      h.t += dt / 0.6;
      const e = smooth(clamp(h.t, 0, 1));
      h.cx = h.fromX + (sp.x - h.fromX) * e;
      h.cy = h.fromY + (inY - h.fromY) * e;
      h.cz = h.fromZ + (sp.z - h.fromZ) * e;
      p.yaw = h.fromYaw + wrapPI(facing - h.fromYaw) * e;
      p.pitch += (0 - p.pitch) * Math.min(1, dt * 6);
      if (h.t >= 0.5) hs.target = 0;
      if (h.t >= 1) {
        h.state = 'inside';
        h.inside = 0;
        p.x = sp.x;
        p.z = sp.z;
        p.floor = sp.floor;
        p.y = fy;
        this.cb.onMessage('Hidden. Hold still... (E to leave)', 'info');
      }
    } else if (h.state === 'inside') {
      h.inside += dt;
      h.cx = sp.x;
      h.cy = inY;
      h.cz = sp.z;
      p.x = sp.x;
      p.z = sp.z;
      p.speed = 0;
      p.yaw = facing + clamp(wrapPI(p.yaw - facing), -0.7, 0.7);
      p.pitch = clamp(p.pitch, -0.45, 0.45);
    } else if (h.state === 'exiting') {
      h.t += dt / 0.5;
      const e = smooth(clamp(h.t, 0, 1));
      h.cx = sp.x + (sp.checkX - sp.x) * e;
      h.cz = sp.z + (sp.checkZ - sp.z) * e;
      h.cy = inY + (fy + 1.62 - inY) * e;
      if (h.t >= 1) {
        p.x = sp.checkX;
        p.z = sp.checkZ;
        p.y = fy;
        p.floor = sp.floor;
        p.eye = 1.62;
        p.vx = p.vz = 0;
        h.state = 'none';
        h.idx = -1;
        this.seenHiding = false;
        this.flashOn = this.flashWasOn;
        setTimeout(() => {
          hs.target = 0;
        }, 500);
      }
    }
  }

  // ---------------------------------------------------------------- traps / projectiles / items
  private updateTraps(dt: number) {
    const p = this.player;
    for (const t of this.traps) {
      if (t.sprung) {
        if (t.t < 1) {
          t.t = Math.min(1, t.t + dt * 9);
          setTrapAngle(t, t.t);
        }
        continue;
      }
      if (this.phase === 'playing' && p.hide.state === 'none' && p.floor === t.floor && Math.hypot(p.x - t.x, p.z - t.z) < 0.42) {
        t.sprung = true;
        p.trapped = 2.8;
        p.vx = p.vz = 0;
        this.audio.trapSnap({ x: t.x, y: FLOOR_Y[t.floor] + 0.1, z: t.z });
        this.audio.scream();
        this.emitNoise(t.x, t.z, t.floor, 30);
        this.shake = 1;
        this.damage = 0.8;
        this.cb.onMessage('BEAR TRAP! Granny heard that...', 'bad');
      }
      // notice a trap with the torch
      if (!this.trapNoticed && this.flashOn && p.floor === t.floor && Math.hypot(p.x - t.x, p.z - t.z) < 3.5) {
        this.trapNoticed = true;
        this.cb.onMessage('A bear trap! Walk around it.', 'warn');
      }
    }
  }

  private throwBottle() {
    const p = this.player;
    if (this.phase !== 'playing' || p.hide.state !== 'none' || p.trapped > 0 || this.winT >= 0) return;
    if (this.inv.bottles <= 0) {
      return;
    }
    this.inv.bottles--;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const mesh = makeBottle();
    const pos = new THREE.Vector3(p.x, p.y + p.eye - 0.1, p.z).addScaledVector(dir, 0.5);
    mesh.position.copy(pos);
    this.scene.add(mesh);
    const vel = dir.clone().multiplyScalar(11.5);
    vel.y += 1.6;
    this.projectiles.push({ mesh, pos, vel, floor: p.floor, spin: new THREE.Vector3(rand(-9, 9), rand(-4, 4), rand(-9, 9)) });
    this.audio.whoosh();
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      let broke = false;
      const sub = 3;
      for (let s = 0; s < sub && !broke; s++) {
        const d = dt / sub;
        pr.vel.y -= 9.8 * d;
        const nx = pr.pos.x + pr.vel.x * d;
        const nz = pr.pos.z + pr.vel.z * d;
        const ny = pr.pos.y + pr.vel.y * d;
        let x = nx;
        let z = nz;
        if (pointBlockedSight(nx, pr.pos.z, pr.floor)) {
          pr.vel.x *= -0.3;
          x = pr.pos.x;
        }
        if (pointBlockedSight(x, nz, pr.floor)) {
          pr.vel.z *= -0.3;
          z = pr.pos.z;
        }
        pr.pos.set(x, ny, z);
        const gy = groundY(x, z, pr.floor);
        // granny hit
        const g = this.granny;
        if (g.state !== 'stunned' && g.state !== 'catching' && g.floor === pr.floor) {
          if (Math.hypot(g.x - x, g.z - z) < 0.55 && ny > g.y + 0.2 && ny < g.y + 1.75) {
            this.breakBottle(pr.pos, pr.floor);
            g.stun(this.env);
            broke = true;
            break;
          }
        }
        if (ny <= gy + 0.04) {
          pr.pos.y = gy;
          this.breakBottle(pr.pos, pr.floor);
          broke = true;
        }
      }
      if (broke) {
        this.scene.remove(pr.mesh);
        this.projectiles.splice(i, 1);
      } else {
        pr.mesh.position.copy(pr.pos);
        pr.mesh.rotation.x += pr.spin.x * dt;
        pr.mesh.rotation.y += pr.spin.y * dt;
        pr.mesh.rotation.z += pr.spin.z * dt;
      }
    }
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      s.life -= dt;
      s.vel.y -= 9.8 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      const gy = groundY(s.mesh.position.x, s.mesh.position.z, s.floor);
      if (s.mesh.position.y < gy + 0.01) {
        s.mesh.position.y = gy + 0.005;
        s.vel.set(0, 0, 0);
      }
      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        this.shards.splice(i, 1);
      }
    }
  }

  private breakBottle(pos: THREE.Vector3, floor: Floor) {
    this.audio.glassBreak({ x: pos.x, y: pos.y + 0.1, z: pos.z });
    this.emitNoise(pos.x, pos.z, floor, 26);
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(this.shardGeo, this.shardMat);
      m.position.copy(pos);
      m.position.y += 0.05;
      m.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      this.scene.add(m);
      this.shards.push({ mesh: m, vel: new THREE.Vector3(rand(-2, 2), rand(0.5, 2.8), rand(-2, 2)), life: rand(6, 12), floor });
    }
  }

  private updateItems(dt: number) {
    for (const it of this.items) {
      if (it.taken || !it.glint) continue;
      const t = this.time * 2.2 + it.phase;
      const m = it.glint.material as THREE.SpriteMaterial;
      m.opacity = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t));
      it.glint.scale.setScalar(0.18 + 0.12 * (0.5 + 0.5 * Math.sin(t * 1.3)));
    }
    void dt;
  }

  // ====================================================================== interaction
  private updateInteraction(dt: number) {
    this.interactT -= dt;
    if (this.interactT > 0) return;
    this.interactT = 0.07;
    const p = this.player;
    if (p.hide.state !== 'none') {
      this.target = null;
      return;
    }
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.raycaster.set(this.camera.position, dir);
    this.raycaster.far = 2.7;
    const list: THREE.Object3D[] = [...this.world.staticMeshes, ...this.world.hitMeshes];
    for (const it of this.items) if (!it.taken && it.floor === p.floor) list.push(it.obj);
    const hits = this.raycaster.intersectObjects(list, true);
    this.target = null;
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.interact) o = o.parent;
      if (o) {
        const inter = o.userData.interact as Target;
        this.target = inter;
      }
      break;
    }
  }

  private promptFor(t: Target | null): { text: string | null; tone: 'normal' | 'locked' } {
    const p = this.player;
    if (p.hide.state === 'inside') return { text: p.hide.inside > 0.6 ? 'Leave hiding spot' : null, tone: 'normal' };
    if (!t || p.hide.state !== 'none') return { text: null, tone: 'normal' };
    switch (t.type) {
      case 'door': {
        const d = this.world.doorById.get(t.id);
        if (!d) return { text: null, tone: 'normal' };
        if (d.locked) {
          const need = d.locked === 'brass' ? this.inv.brass_key : this.inv.silver_key;
          return need ? { text: `Unlock ${d.def.name}`, tone: 'normal' } : { text: `${d.def.name} — locked`, tone: 'locked' };
        }
        return { text: `${d.target === 1 ? 'Close' : 'Open'} door`, tone: 'normal' };
      }
      case 'front':
        return { text: this.inv.padlock_key && this.inv.door_key ? 'Unlock the front door' : 'Front door — locked', tone: this.inv.padlock_key && this.inv.door_key ? 'normal' : 'locked' };
      case 'item': {
        const it = this.items[t.index];
        if (!it) return { text: null, tone: 'normal' };
        if (it.id === 'note') return { text: 'Read note', tone: 'normal' };
        return { text: `Pick up ${ITEM_NAMES[it.id]}`, tone: 'normal' };
      }
      case 'hide': {
        const h = this.world.hides[t.index];
        return { text: h?.spot.type === 'bed' ? 'Hide under bed' : 'Hide in wardrobe', tone: 'normal' };
      }
    }
  }

  private interact() {
    const p = this.player;
    if (this.noteOpenFrom) {
      this.closeNote();
      return;
    }
    if (p.hide.state === 'inside') {
      if (p.hide.inside > 0.6) this.exitHide();
      return;
    }
    if (p.hide.state !== 'none' || p.trapped > 0 || this.winT >= 0) return;
    const t = this.target;
    if (!t) return;
    switch (t.type) {
      case 'door':
        this.useDoor(t.id);
        break;
      case 'front':
        this.useFront();
        break;
      case 'item':
        this.pickup(t.index);
        break;
      case 'hide':
        this.enterHide(t.index);
        break;
    }
  }

  private useDoor(id: string) {
    const d = this.world.doorById.get(id);
    if (!d) return;
    const p = this.player;
    const pos = { x: d.cx, y: d.fy + 1.2, z: d.cz };
    if (d.locked) {
      const key = d.locked === 'brass' ? 'brass_key' : 'silver_key';
      if (this.inv[key]) {
        this.inv[key] = false;
        d.locked = null;
        this.audio.unlock();
        this.emitNoise(p.x, p.z, p.floor, 5);
        this.cb.onMessage(`Unlocked the ${d.def.name}.`, 'good');
        this.world.openDoor(id, p.x, p.z);
        this.audio.doorOpen(pos);
      } else {
        this.audio.doorLocked(pos);
        this.emitNoise(d.cx, d.cz, d.def.floor, 9);
        this.cb.onMessage(`The ${d.def.name} is locked. It needs the ${d.locked === 'brass' ? 'Brass' : 'Silver'} Key.`, 'warn');
      }
      return;
    }
    if (d.target === 1) {
      // closing: make sure nobody stands in the doorway
      if (Math.hypot(p.x - d.cx, p.z - d.cz) < 0.75 || Math.hypot(this.granny.x - d.cx, this.granny.z - d.cz) < 0.9) return;
      this.world.closeDoor(id);
      this.audio.doorClose(pos);
      this.emitNoise(d.cx, d.cz, d.def.floor, 6);
    } else {
      this.world.openDoor(id, p.x, p.z);
      this.audio.doorOpen(pos);
      this.emitNoise(d.cx, d.cz, d.def.floor, p.crouch ? 2.5 : 4.5);
    }
  }

  private useFront() {
    const inv = this.inv;
    if (!inv.padlock_key && !inv.door_key) {
      this.cb.onMessage('Two heavy locks hold this door shut. I need the Padlock Key and the Front Door Key.', 'warn');
      this.audio.doorLocked({ x: 10, y: 1.2, z: 16 });
      this.emitNoise(10, 15, 0, 8);
      return;
    }
    if (!inv.padlock_key) {
      this.cb.onMessage('The padlock is still locked. Where is the Padlock Key?', 'warn');
      this.audio.doorLocked({ x: 10, y: 1.2, z: 16 });
      return;
    }
    if (!inv.door_key) {
      this.cb.onMessage('The deadbolt won\'t budge. I need the Front Door Key.', 'warn');
      this.audio.doorLocked({ x: 10, y: 1.2, z: 16 });
      return;
    }
    // escape!
    inv.padlock_key = false;
    inv.door_key = false;
    this.audio.unlock();
    setTimeout(() => this.audio.unlock(), 500);
    this.winT = 0;
    this.cb.onMessage('Click... click... The door swings open!', 'good');
    const f = this.world.frontLocks;
    if (f) {
      f.padlock.visible = false;
      f.deadbolt.visible = false;
    }
    const chain = this.world.hitMeshes.find((o) => o.name === 'chain');
    if (chain) chain.visible = false;
    const fd = this.world.doorById.get('front');
    if (fd) fd.locked = null;
    setTimeout(() => {
      this.world.openDoor('front', this.player.x, this.player.z);
      this.audio.doorOpen({ x: 10, y: 1.2, z: 16 });
    }, 900);
  }

  private pickup(index: number) {
    const it = this.items[index];
    if (!it || it.taken) return;
    if (it.id === 'note') {
      const n = NOTES[it.noteIndex];
      this.audio.paper();
      this.cb.onNote({ title: n.title, text: n.text });
      this.noteOpenFrom = { x: this.player.x, z: this.player.z, floor: this.player.floor };
      this.noteTimer = 18;
      return;
    }
    if (it.id === 'bottle') {
      if (this.inv.bottles >= 3) {
        this.cb.onMessage('You can\'t carry any more bottles.', 'warn');
        return;
      }
      this.inv.bottles++;
      this.cb.onMessage('Picked up a bottle. Throw it (Click / Q) to make a distraction.', 'info');
    } else {
      this.inv[it.id as 'brass_key' | 'silver_key' | 'padlock_key' | 'door_key'] = true;
      this.cb.onMessage(`Picked up the ${ITEM_NAMES[it.id]}.`, 'good');
    }
    it.taken = true;
    this.scene.remove(it.obj);
    this.audio.pickup();
  }

  // ====================================================================== catch / respawn / win
  private onCaught() {
    if (this.phase !== 'playing') return;
    this.phase = 'caught';
    this.caughtT = 0;
    this.closeNote();
    this.granny.startCatch();
    this.audio.caughtHit();
    const p = this.player;
    if (p.hide.state !== 'none') {
      const hs = this.world.hides[p.hide.idx];
      if (hs) {
        p.x = hs.spot.checkX;
        p.z = hs.spot.checkZ;
        p.floor = hs.spot.floor;
        p.y = FLOOR_Y[hs.spot.floor];
        hs.target = 1;
      }
      p.hide.state = 'none';
      p.hide.idx = -1;
      p.eye = 1.62;
    }
    this.seenHiding = false;
    this.shake = 1.4;
    this.damage = 1;
    this.cb.onPhase('caught', { day: this.day, maxDays: this.maxDays });
  }

  private updateCaught(dt: number) {
    const p = this.player;
    this.caughtT += dt;
    const g = this.granny;
    const dx = g.x - p.x;
    const dz = g.z - p.z;
    const ty = Math.atan2(-dx, -dz);
    p.yaw += wrapPI(ty - p.yaw) * Math.min(1, dt * 9);
    p.pitch += (0.3 - p.pitch) * Math.min(1, dt * 5);
    this.damage = Math.max(this.damage, 0.6);
    this.shake = Math.max(this.shake, 0.5);
    if (this.caughtT > 2.7) this.nextDay();
  }

  private nextDay() {
    this.day++;
    if (this.day > this.maxDays) {
      this.phase = 'gameover';
      this.audio.setTension(0);
      if (document.pointerLockElement === this.canvas) document.exitPointerLock();
      this.cb.onPhase('gameover', { day: this.maxDays, maxDays: this.maxDays, time: this.elapsed });
      return;
    }
    const p = this.player;
    p.x = PLAYER_SPAWN.x;
    p.z = PLAYER_SPAWN.z;
    p.floor = PLAYER_SPAWN.floor;
    p.y = FLOOR_Y[PLAYER_SPAWN.floor];
    p.yaw = PLAYER_SPAWN.yaw;
    p.pitch = 0;
    p.vx = p.vz = 0;
    p.trapped = 0;
    p.stamina = 1;
    p.exhausted = false;
    p.crouch = false;
    p.eye = 1.62;
    p.hide.state = 'none';
    this.flashOn = true;
    this.damage = 0;
    this.shake = 0;
    // granny goes far away
    const far = NAV_NODES.filter((n) => n.floor === 0 && Math.hypot(n.x - p.x, n.z - p.z) > 13 && !n.id.startsWith('gS') && n.room !== 'study');
    const n = far[Math.floor(Math.random() * far.length)];
    this.granny.reset(n ? n.id : GRANNY_SPAWN_NODE);
    this.phase = 'playing';
    this.lastT = performance.now();
    this.cb.onPhase('playing', { day: this.day, maxDays: this.maxDays, dayChange: true });
    this.cb.onMessage(`Day ${this.day}. Granny is faster today...`, 'warn');
  }

  private updateWin(dt: number) {
    this.winT += dt;
    const p = this.player;
    // walk toward the door
    const tx = 10;
    const tz = 15.2;
    const dx = tx - p.x;
    const dz = tz - p.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.3 && this.winT > 0.8) {
      const s = Math.min(d, dt * 1.6);
      p.x += (dx / d) * s;
      p.z += (dz / d) * s;
    }
    const ty = Math.atan2(-dx, -dz);
    p.yaw += wrapPI(ty - p.yaw) * Math.min(1, dt * 2.5);
    p.pitch += (0.05 - p.pitch) * Math.min(1, dt * 3);
    this.whiteout = clamp((this.winT - 1.4) / 2.2, 0, 1);
    if (this.winT > 0.9 && this.winT - dt <= 0.9) this.audio.win();
    if (this.winT > 4.2 && this.phase === 'playing') {
      this.phase = 'win';
      this.audio.setTension(0);
      if (document.pointerLockElement === this.canvas) document.exitPointerLock();
      this.cb.onPhase('win', { day: this.day, maxDays: this.maxDays, time: this.elapsed });
    }
  }

  // ====================================================================== atmosphere
  private updateLightning(dt: number) {
    this.lightningT -= dt;
    if (this.lightningT <= 0 && this.phase !== 'ready') {
      this.lightningT = rand(20, 50);
      this.flashClock = 0;
      this.audio.thunder(rand(0.35, 2.2));
    } else if (this.lightningT <= 0) {
      this.lightningT = rand(8, 14);
      this.flashClock = 0;
    }
    this.flashClock += dt;
    const c = this.flashClock;
    let v = 0;
    if (c < 0.09) v = 1;
    else if (c < 0.18) v = 0.2;
    else if (c < 0.28) v = 0.85;
    else if (c < 3) v = Math.exp(-(c - 0.28) * 7);
    if (v < 0.01) v = 0;
    this.world.setFlash(v);
    this.ambient.intensity = this.baseAmbient * this.settings.brightness * (1 + v * 4.5);
  }

  private updateFear(dt: number) {
    const g = this.granny;
    const p = this.player;
    const dx = g.x - p.x;
    const dz = g.z - p.z;
    let d = Math.hypot(dx, dz);
    if (g.floor !== p.floor) d += 5;
    let target = clamp(1 - d / 15, 0, 1);
    target = Math.pow(target, 1.4);
    if (g.state === 'chase') target = Math.max(target, 0.6 + (d < 7 ? 0.3 : 0));
    if (g.state === 'stunned' || g.state === 'catching') target = g.state === 'catching' ? 1 : target * 0.4;
    this.fear += (target - this.fear) * Math.min(1, dt * 2.2);
  }

  private updateAudio(dt: number) {
    const p = this.player;
    const g = this.granny;
    const cam = this.camera.position;
    this.audio.setListener({ x: cam.x, y: cam.y, z: cam.z }, p.yaw);
    const floors: Floor[] = g.floor === p.floor ? [g.floor] : [g.floor, p.floor];
    const occluded = Math.abs(g.y - p.y) > 2.5 || segmentBlocked(g.x, g.z, p.x, p.z, floors, 0.04, 'sight');
    this.audio.updateGranny({ x: g.x, y: g.y + 1.2, z: g.z }, g.voiceMode(), occluded, dt);
    this.audio.setTension(g.state === 'chase' ? 0.4 + 0.6 * this.fear : this.fear * 0.5);
    this.audio.ambient(dt, { x: p.x, y: p.y, z: p.z });
    // heartbeat
    if (this.fear > 0.22 && this.phase === 'playing') {
      this.heartT -= dt;
      if (this.heartT <= 0) {
        this.heartT = 1.15 - this.fear * 0.7;
        this.audio.heartbeat(this.fear);
        this.pulse = 0.6 + this.fear * 0.4;
      }
    }
  }

  private updateCamera(dt: number) {
    const p = this.player;
    const cam = this.camera;
    let x = p.x;
    let y = p.y + p.eye;
    let z = p.z;
    if (p.hide.state !== 'none') {
      x = p.hide.cx;
      y = p.hide.cy;
      z = p.hide.cz;
    } else {
      const bobAmp = clamp(p.speed / 2.75, 0, 1.6) * (p.crouch ? 0.6 : 1);
      y += Math.sin(p.bob) * 0.03 * bobAmp;
      x += Math.cos(p.yaw) * Math.cos(p.bob * 0.5) * 0.012 * bobAmp;
      z += -Math.sin(p.yaw) * Math.cos(p.bob * 0.5) * 0.012 * bobAmp;
    }
    const sh = this.shake * this.shake * 0.05;
    cam.position.set(x + rand(-sh, sh), y + rand(-sh, sh), z + rand(-sh, sh));
    const roll = p.trapped > 0 ? Math.sin(this.time * 30) * 0.02 : 0;
    cam.rotation.set(p.pitch + rand(-sh, sh) * 0.4, p.yaw, roll);
    const targetFov = 72 + (p.sprinting ? 7 : 0) + this.fear * 4 - (p.hide.state === 'inside' ? 8 : 0);
    cam.fov += (targetFov - cam.fov) * Math.min(1, dt * 6);
    cam.updateProjectionMatrix();

    // flashlight follows with a little lag
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    this.flashDir.lerp(fwd, 1 - Math.exp(-dt * 13)).normalize();
    const right = new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
    const fp = cam.position.clone().addScaledVector(right, 0.16);
    fp.y -= 0.14;
    this.flashLight.position.copy(fp);
    this.flashLight.target.position.copy(fp).addScaledVector(this.flashDir, 6);
    let k = this.flashOn ? 1 : 0;
    if (this.flashOn) {
      const nearGranny = this.fear > 0.45 && this.granny.state !== 'stunned';
      if (nearGranny && Math.random() < this.fear * 0.12) k = rand(0.05, 0.4);
      else if (Math.random() < 0.002) k = 0.2;
    }
    this.flashLight.intensity = 17 * k;
  }

  // ====================================================================== HUD
  private pushHud() {
    const p = this.player;
    const pr = this.promptFor(this.target);
    const room = roomAt(p.x, p.z, p.floor);
    const studyOpen = !this.world.doorById.get('g_study')?.locked;
    const masterOpen = !this.world.doorById.get('u_master')?.locked;
    const hs = p.hide.idx >= 0 ? this.world.hides[p.hide.idx] : null;
    let objective: string;
    const inv = this.inv;
    if (inv.padlock_key && inv.door_key) objective = 'You have both keys — get to the front door!';
    else {
      const parts: string[] = [];
      if (!inv.padlock_key) parts.push(studyOpen ? 'Take the Padlock Key from the Study' : inv.brass_key ? 'Open the Study (Brass Key)' : 'Find the Brass Key');
      if (!inv.door_key) parts.push(masterOpen ? 'Take the Front Door Key from the Master Bedroom' : inv.silver_key ? 'Open the Master Bedroom (Silver Key)' : 'Find the Silver Key');
      objective = parts.join('  •  ');
    }
    this.cb.onHud({
      day: Math.min(this.day, this.maxDays),
      maxDays: this.maxDays,
      stamina: p.stamina,
      exhausted: p.exhausted,
      noise: p.hide.state === 'inside' ? 0 : p.crouch && p.speed < 1.6 ? Math.min(this.noiseLevel, 0.15) : this.noiseLevel,
      prompt: pr.text,
      promptTone: pr.tone,
      brass: inv.brass_key,
      silver: inv.silver_key,
      padlock: inv.padlock_key,
      doorKey: inv.door_key,
      studyOpen,
      masterOpen,
      bottles: inv.bottles,
      hidden: p.hide.state === 'inside',
      hideType: hs ? hs.spot.type : null,
      fear: this.fear,
      flashlight: this.flashOn,
      crouch: p.crouch,
      trapped: p.trapped > 0,
      room: room ? room.name : '',
      objective,
      whiteout: this.whiteout,
      grannyState: this.granny.state,
      damage: this.damage,
      noLock: this.noLock,
    });
  }
}
