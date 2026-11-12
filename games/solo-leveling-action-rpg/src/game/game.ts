// Core engine: renderer, loop, player controller, camera, combat resolution, zones, interactions.
import * as THREE from 'three';
import { create } from 'zustand';
import { ITEMS, RARITY_COLOR, STAT_KEYS, type EnemyDef } from './data';
import { bus, derive, useGame, useHud, type ShadowRec } from './store';
import { input } from './input';
import { audio } from './audio';
import { FX } from './fx';
import {
  disposeObj,
  makeGate,
  makeJinWoo,
  makeLabel,
  newPose,
  pose,
  setFlash,
  type PoseState,
  type Rig,
} from './models';
import { Particles } from './fx';
import { buildArena, buildCave, buildPenalty, buildSeoul, buildTemple, walkable, type Zone } from './world';
import { spawnEnemy, updateEnemies, hitEnemy, type AtkRun } from './enemies';
import { updateAllies, summonShadow, dismissAll, setCommand, extractionUpdate, tryExtract } from './army';
import { updateNPCs, clearNPCs } from './npcs';
import * as story from './story';
export const useFade = create<{ v: number }>(() => ({ v: 0 }));
export type V3 = THREE.Vector3;
export interface Enemy {
  id: number;
  def: EnemyDef;
  rig: Rig;
  ps: PoseState;
  pos: V3;
  yaw: number;
  vel: V3;
  hp: number;
  maxHp: number;
  r: number;
  state: 'rise' | 'chase' | 'atk' | 'hurt' | 'block' | 'dead' | 'idle';
  t: number;
  atk: AtkRun | null;
  cd: number;
  target: any;
  tgtT: number;
  dead: boolean;
  deadT: number;
  corpse: boolean;
  extracted: boolean;
  tries: number;
  extracting: boolean;
  poison: number;
  poisonDps: number;
  lift: number;
  slow: number;
  flash: number;
  phase: number;
  speedMul: number;
  stun: number;
  boss: boolean;
  blockT: number;
  hurtT: number;
  combo: number;
  last: string;
  aura?: number;
  invuln: boolean;
  noLoot?: boolean;
  flag?: string;
  riposte: boolean;
  glow: number;
}
export interface Ally {
  rec: ShadowRec;
  def: any;
  rig: Rig;
  ps: PoseState;
  pos: V3;
  yaw: number;
  hp: number;
  maxHp: number;
  st: { hp: number; atk: number; def: number; speed: number };
  state: 'rise' | 'idle' | 'move' | 'atk' | 'dead';
  t: number;
  target: Enemy | null;
  tgtT: number;
  atkT: number;
  atkCd: number;
  cmd: string;
  hold: V3 | null;
  slot: number;
  combo: number;
  regroupT: number;
  rushCd: number;
  r: number;
  flash: number;
  hit: boolean;
  vel: V3;
  dash: number;
}
export interface Interact {
  id: string;
  x: number;
  z: number;
  r: number;
  label: () => string | null;
  act: () => void;
}
export interface GateObj {
  id: string;
  key: string;
  group: THREE.Group;
  x: number;
  z: number;
  target: string;
  label: THREE.Mesh;
  closing: number;
  onEnter?: () => void;
  exit?: boolean;
  name: string;
}
export interface Proj {
  mesh: THREE.Object3D;
  pos: V3;
  vel: V3;
  dmg: number;
  life: number;
  radius: number;
  mine: boolean;
  pierce: boolean;
  hit: Set<any>;
  poison?: number;
  kind: string;
}
export interface Shot {
  dur: number;
  speaker?: string;
  text?: string;
  from: [number, number, number];
  to?: [number, number, number];
  look: [number, number, number];
  lookTo?: [number, number, number];
  cb?: () => void;
  shake?: number;
  fov?: number;
  sfx?: string;
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const tmpMenuA = new THREE.Color();
const tmpMenuB = new THREE.Color();
const WA: Record<
  string,
  {
    kind: string;
    dur: number;
    hit: number;
    m: number;
    reach: number;
    arc: number;
    lunge: number;
    knock: number;
    fin?: boolean;
  }[]
> = {
  dagger: [
    { kind: 'slash1', dur: 0.3, hit: 0.5, m: 1, reach: 2.4, arc: 140, lunge: 1.8, knock: 1 },
    { kind: 'slash2', dur: 0.28, hit: 0.5, m: 1, reach: 2.4, arc: 140, lunge: 1.8, knock: 1 },
    { kind: 'stab', dur: 0.42, hit: 0.5, m: 1.7, reach: 3.1, arc: 80, lunge: 3.4, knock: 3, fin: true },
  ],
  sword: [
    { kind: 'slash1', dur: 0.42, hit: 0.5, m: 1.2, reach: 3, arc: 150, lunge: 1.4, knock: 2 },
    { kind: 'slash2', dur: 0.42, hit: 0.5, m: 1.2, reach: 3, arc: 150, lunge: 1.4, knock: 2 },
    { kind: 'overhead', dur: 0.6, hit: 0.58, m: 2, reach: 3.3, arc: 120, lunge: 2.2, knock: 5, fin: true },
  ],
  greatsword: [
    { kind: 'overhead', dur: 0.75, hit: 0.6, m: 2.3, reach: 3.5, arc: 140, lunge: 1.2, knock: 6 },
    { kind: 'slash1', dur: 0.7, hit: 0.5, m: 2.1, reach: 4, arc: 210, lunge: 1, knock: 5, fin: true },
  ],
};
const WAVE_GEO = new THREE.RingGeometry(0.8, 1.1, 20, 1, 0, Math.PI);
WAVE_GEO.rotateX(Math.PI / 2);
const WAVE_MAT = new THREE.MeshBasicMaterial({
  color: 0x9a6aff,
  transparent: true,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
  depthWrite: false,
});
const ease = (x: number) => x * x * (3 - 2 * x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const angDiff = (a: number, b: number) => {
  let d = b - a;
  while (d > Math.PI) d -= 6.2832;
  while (d < -Math.PI) d += 6.2832;
  return d;
};

function radialTexture(inner = 'rgba(255,255,255,0.95)', outer = 'rgba(120,170,255,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(128, 128, 4, 128, 128, 126);
  gr.addColorStop(0, inner);
  gr.addColorStop(0.35, 'rgba(140,190,255,0.28)');
  gr.addColorStop(1, outer);
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

let envCache: THREE.CanvasTexture | null = null;
function environmentTexture() {
  if (envCache) return envCache;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#070a18');
  gr.addColorStop(0.42, '#1f3566');
  gr.addColorStop(0.52, '#5b7fc0');
  gr.addColorStop(0.6, '#2a2050');
  gr.addColorStop(1, '#05060c');
  g.fillStyle = gr;
  g.fillRect(0, 0, 512, 256);
  const glow = (x: number, y: number, r: number, col: string, a: number) => {
    const rg = g.createRadialGradient(x, y, 1, x, y, r);
    rg.addColorStop(0, col);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = a;
    g.fillStyle = rg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    g.globalAlpha = 1;
  };
  glow(110, 122, 70, '#8ab4ff', 0.8);
  glow(340, 110, 95, '#a86bff', 0.5);
  glow(440, 132, 55, '#ff9a6a', 0.3);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  envCache = t;
  return t;
}

function runeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 512, 512);
  g.translate(256, 256);
  g.strokeStyle = 'rgba(150,210,255,0.85)';
  g.shadowColor = '#6ab8ff';
  g.shadowBlur = 14;
  g.lineWidth = 2;
  [240, 214, 168, 96].forEach((r) => {
    g.beginPath();
    g.arc(0, 0, r, 0, 6.3);
    g.stroke();
  });
  g.lineWidth = 1.4;
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * 6.283;
    const r0 = k % 3 === 0 ? 168 : 206;
    g.beginPath();
    g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    g.lineTo(Math.cos(a) * 238, Math.sin(a) * 238);
    g.stroke();
  }
  g.strokeStyle = 'rgba(190,140,255,0.9)';
  g.shadowColor = '#a86bff';
  g.lineWidth = 2.5;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * 6.283;
    g.beginPath();
    g.moveTo(Math.cos(a) * 96, Math.sin(a) * 96);
    g.lineTo(Math.cos(a + 1.047) * 96, Math.sin(a + 1.047) * 96);
    g.stroke();
  }
  g.beginPath();
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * 6.283 - Math.PI / 2;
    g.lineTo(Math.cos(a) * 62, Math.sin(a) * 62);
  }
  g.closePath();
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Game {
  canvas!: HTMLCanvasElement;
  renderer!: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
  fx!: FX;
  hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1);
  sun = new THREE.DirectionalLight(0xffffff, 1);
  fill = new THREE.DirectionalLight(0x7a9aff, 0.35);
  zone!: Zone;
  seoul: Zone | null = null;
  t = 0;
  running = false;
  last = 0;
  raf = 0;
  P = {
    pos: V(),
    vel: V(),
    yaw: 0,
    rig: null as unknown as Rig,
    ps: newPose(),
    hp: 100,
    mp: 50,
    grounded: true,
    sprint: false,
    atk: null as null | {
      kind: string;
      t: number;
      dur: number;
      hitT: number;
      hit: boolean;
      m: number;
      reach: number;
      arc: number;
      lunge: number;
      knock: number;
      dir: V3;
      heavy?: boolean;
      fin?: boolean;
      plunge?: boolean;
    },
    comboIdx: 0,
    comboT: 9,
    queued: false,
    dodgeT: 0,
    dodgeCd: 0,
    dodgeDir: V(),
    dodgeEnd: -9,
    invuln: 0,
    holdT: 0,
    charging: false,
    cds: { dash: 0, special: 0, x: 0, z: 0, v: 0, r: 0 } as Record<string, number>,
    kneeling: false,
    dead: false,
    deadT: 0,
    poison: 0,
    domainT: 0,
    stepT: 0,
    runAcc: 0,
    castT: 0,
    hurtT: 0,
    lookKey: '',
    regen: 0,
    rush: null as null | { t: number; dir: V3; hitN: number },
    blinkT: 0,
  };
  enemies: Enemy[] = [];
  allies: Ally[] = [];
  gates: GateObj[] = [];
  interacts: Interact[] = [];
  projs: Proj[] = [];
  npcs: any[] = [];
  enemyId = 1;
  camYaw = 0;
  camPitch = 0.3;
  camDist = 5.6;
  private camTgt = new THREE.Vector3();
  private camDir = new THREE.Vector3();
  private camOff = new THREE.Vector3();
  private camWant = new THREE.Vector3();
  shake = 0;
  hitstop = 0;
  slow = { t: 0, s: 1 };
  lock: Enemy | null = null;
  lockSprite!: THREE.Sprite;
  fov = 62;
  cine: null | { shots: Shot[]; i: number; t: number; done?: () => void } = null;
  trans: null | { phase: number; t: number; cb: () => void } = null;
  hudT = 0;
  saveT = 0;
  combo = 0;
  comboTimer = 0;
  promptStr: string | null = null;
  nearest: Interact | null = null;
  miniCanvas: HTMLCanvasElement | null = null;
  lastHitEnemy: Enemy | null = null;
  domain: { x: number; z: number; t: number; r: number } | null = null;
  keyGate: GateObj | null = null;
  armyCarry: string[] = [];
  sayT = 0;
  derived = derive(useGame.getState().save);
  state: Record<string, any> = {};
  extraction: any = null;
  cmd = 'follow';
  private busSubs: (() => void)[] = [];
  private resizeHandler = () => this.resize();
  private sceneReady = false;
  private menuScene = new THREE.Scene();
  private menuCamera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
  private menuReady = false;
  private menuT = 0;
  private menuRig: Rig | null = null;
  private menuPose = newPose();
  private menuRing: THREE.Object3D | null = null;
  private menuRing2: THREE.Object3D | null = null;
  private menuShards: THREE.Object3D[] = [];
  private menuParticles: Particles | null = null;
  private menuGlow: THREE.Sprite | null = null;

  init(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    if (!this.renderer) {
      try {
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      } catch {
        throw new Error('WebGL is unavailable. Enable hardware acceleration or use a WebGL-capable browser.');
      }
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.18;
      this.renderer.setClearColor(0x03050d, 1);
    }
    if (!this.sceneReady) {
      this.scene.environment = environmentTexture();
      this.scene.environmentIntensity = 0.55;
      this.scene.add(this.hemi, this.sun, this.sun.target, this.fill, this.fill.target);
      this.sun.shadow.camera.near = 1;
      this.sun.shadow.camera.far = 150;
      this.sun.shadow.bias = -0.0003;
      this.sun.shadow.normalBias = 0.025;
      this.sun.shadow.radius = 2.3;
      this.fx = new FX(this.scene, 2500);
      this.fx.setScale(window.innerHeight, 62);
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d')!;
      g.strokeStyle = '#ff3a4a';
      g.lineWidth = 5;
      g.beginPath();
      g.arc(32, 32, 22, 0, 6.3);
      g.stroke();
      g.fillStyle = '#ff3a4a';
      [0, 1.57, 3.14, 4.71].forEach((a) => {
        g.beginPath();
        g.moveTo(32 + Math.cos(a) * 30, 32 + Math.sin(a) * 30);
        g.lineTo(32 + Math.cos(a + 0.2) * 22, 32 + Math.sin(a + 0.2) * 22);
        g.lineTo(32 + Math.cos(a - 0.2) * 22, 32 + Math.sin(a - 0.2) * 22);
        g.fill();
      });
      this.lockSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true })
      );
      this.lockSprite.renderOrder = 30;
      this.lockSprite.visible = false;
      this.scene.add(this.lockSprite);
      this.scene.add(this.camera);
      this.sceneReady = true;
    }
    input.attach(canvas);
    window.removeEventListener('resize', this.resizeHandler);
    window.addEventListener('resize', this.resizeHandler);
    this.bindEvents();
    this.applySettings();
    this.resize();
  }

  private bindEvents() {
    if (this.busSubs.length) return;
    this.busSubs.push(
      bus.on('ui', (a: string) => this.onUi(a)),
      bus.on('levelup', () => this.onLevelUp()),
      bus.on('equip', () => this.refreshModel(true)),
      bus.on('useItem', (id: string) => this.useItem(id)),
      bus.on('retry', () => this.retry()),
      bus.on('skipCine', () => {
        if (this.cine) this.skipCine();
      }),
      bus.on('applySettings', () => this.applySettings()),
      bus.on('command', (c: string) => setCommand(this, c)),
      bus.on('summon', (ids: string[]) =>
        ids.forEach((id) => {
          const r = useGame.getState().save.shadows.find((s) => s.id === id);
          if (r) summonShadow(this, r);
        })
      ),
      bus.on('dismiss', (ids: string[] | undefined) => dismissAll(this, ids)),
      bus.on('saveNow', () =>
        useGame
          .getState()
          .persist('manual')
          .then(() => useGame.getState().notify({ title: 'GAME SAVED' }))
      ),
      bus.on('travelTo', (z: string) => {
        this.state.travel?.(z);
      })
    );
  }

  dispose() {
    this.stop();
    this.busSubs.forEach((off) => off());
    this.busSubs = [];
    window.removeEventListener('resize', this.resizeHandler);
    // React StrictMode re-runs effects while the canvas is still mounted. Keep the
    // renderer/context alive in that case and only release it on a real unmount.
    if (this.canvas && !document.body.contains(this.canvas)) {
      this.renderer?.dispose();
      this.renderer = null as unknown as THREE.WebGLRenderer;
    }
  }
  applySettings() {
    const s = useGame.getState().settings;
    const pr = Math.min(window.devicePixelRatio || 1, 2) * s.resScale;
    this.renderer.setPixelRatio(pr);
    this.resize();
    const ss = [0, 1024, 2048, 3072][s.shadowQ];
    this.sun.castShadow = s.shadowQ > 0;
    if (ss && this.sun.shadow.mapSize.x !== ss) {
      this.sun.shadow.mapSize.set(ss, ss);
      this.sun.shadow.map?.dispose();
      (this.sun.shadow as any).map = null;
    }
    this.camera.far = s.draw;
    this.camera.updateProjectionMatrix();
    this.fx.density = Math.min(1, s.particles);
    if (this.zone) this.applyZoneLook();
  }
  resize() {
    const w = window.innerWidth,
      h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.menuCamera.aspect = w / h;
    this.menuCamera.updateProjectionMatrix();
    this.fx?.setScale(h * this.renderer.getPixelRatio(), this.camera.fov);
  }
  private buildMenuScene() {
    const s = this.menuScene;
    s.background = new THREE.Color(0x03050c);
    s.environment = environmentTexture();
    s.environmentIntensity = 0.72;
    s.fog = new THREE.Fog(0x03050c, 8, 24);
    const hemi = new THREE.HemisphereLight(0x9ec8ff, 0x120a24, 1.15);
    s.add(hemi);
    const key = new THREE.DirectionalLight(0xbfe4ff, 2.4);
    key.position.set(4, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -2;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.03;
    s.add(key);
    const rim = new THREE.PointLight(0x8a4aff, 44, 14, 1.5);
    rim.position.set(-3.2, 3.1, -3.4);
    s.add(rim);
    const fill = new THREE.PointLight(0x2a7aff, 26, 12, 1.5);
    fill.position.set(3.6, 1.8, -1.5);
    s.add(fill);
    const warm = new THREE.PointLight(0xff9a5a, 14, 10, 1.6);
    warm.position.set(-1.5, 1.2, 3.4);
    s.add(warm);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(7.5, 64),
      new THREE.MeshStandardMaterial({
        color: 0x060a16,
        metalness: 0.72,
        roughness: 0.28,
        emissive: 0x050a1c,
        emissiveIntensity: 1,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);
    const ringTex = runeTexture();
    const ring = new THREE.Mesh(
      new THREE.CircleGeometry(3.15, 64),
      new THREE.MeshBasicMaterial({
        map: ringTex,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    s.add(ring);
    this.menuRing = ring;
    const ring2 = new THREE.Mesh(
      new THREE.RingGeometry(3.5, 3.58, 96),
      new THREE.MeshBasicMaterial({
        color: 0x6ab8ff,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.y = 0.02;
    s.add(ring2);
    this.menuRing2 = ring2;
    // broken obsidian arch
    const archMat = new THREE.MeshStandardMaterial({ color: 0x0a0d18, metalness: 0.85, roughness: 0.32 });
    const archTrim = new THREE.MeshStandardMaterial({
      color: 0x181228,
      metalness: 0.9,
      roughness: 0.25,
      emissive: 0x3a1a7a,
      emissiveIntensity: 0.5,
    });
    [-1, 1].forEach((side) => {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.66, 5.2, 0.66), archMat);
      col.position.set(side * 2.75, 2.6, -1.8);
      col.rotation.z = side * 0.03;
      col.castShadow = true;
      s.add(col);
      for (let i = 0; i < 4; i++) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.07, 0.72), archTrim);
        band.position.set(side * 2.75, 0.7 + i * 1.35, -1.8);
        s.add(band);
      }
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.1, 4), archTrim);
      spike.position.set(side * 2.75, 5.75, -1.8);
      s.add(spike);
    });
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.55, 0.8), archMat);
    lintel.position.set(0, 5.35, -1.8);
    lintel.castShadow = true;
    s.add(lintel);
    const sigil = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 2.2),
      new THREE.MeshBasicMaterial({
        map: ringTex,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    sigil.position.set(0, 5.35, -1.35);
    s.add(sigil);
    // floating obsidian shards
    for (let i = 0; i < 16; i++) {
      const sh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.08 + Math.random() * 0.12, 0),
        new THREE.MeshStandardMaterial({
          color: 0x0b0a16,
          metalness: 0.8,
          roughness: 0.3,
          emissive: i % 3 === 0 ? 0x4a1c9a : 0x0a1a3a,
          emissiveIntensity: 0.6,
        })
      );
      const a = Math.random() * 6.283;
      const r = 1.2 + Math.random() * 3.2;
      sh.position.set(Math.cos(a) * r, 0.35 + Math.random() * 2.8, Math.sin(a) * r);
      sh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      sh.userData.orbit = { a, r, y: sh.position.y, sp: 0.03 + Math.random() * 0.06 };
      s.add(sh);
      this.menuShards.push(sh);
    }
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: radialTexture('rgba(140,180,255,0.5)', 'rgba(90,40,200,0)'),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.55,
      })
    );
    glow.position.set(0, 2.4, -4.5);
    glow.scale.setScalar(11);
    s.add(glow);
    this.menuGlow = glow;
    this.menuParticles = new Particles(s, 320, true);
    this.menuRig = makeJinWoo({
      stage: 6,
      armorColor: 0x14141c,
      weaponLook: 'killer',
      wtype: 'dagger',
    });
    this.menuRig.root.position.set(0, 0, 0);
    this.menuRig.root.rotation.y = -0.45;
    s.add(this.menuRig.root);
    this.menuReady = true;
  }
  frameMenu(dt: number) {
    if (!this.menuReady) this.buildMenuScene();
    if (!this.menuRig) return;
    this.menuT += dt;
    const t = this.menuT;
    const ps = this.menuPose;
    ps.t = t;
    ps.move = 0;
    ps.phase = t * 1.6;
    ps.atk = -1;
    pose(this.menuRig, ps);
    this.menuRig.root.rotation.y = -0.35 + Math.sin(t * 0.18) * 0.22;
    this.menuRig.root.position.y = Math.sin(t * 1.1) * 0.012;
    const a = -0.22 + Math.sin(t * 0.075) * 0.16;
    const r = 4.3;
    this.menuCamera.position.set(Math.sin(a) * r, 1.62 + Math.sin(t * 0.22) * 0.06, Math.cos(a) * r);
    this.menuCamera.lookAt(0, 1.06, 0);
    if (this.menuRing) this.menuRing.rotation.z += dt * 0.045;
    if (this.menuRing2) this.menuRing2.rotation.z -= dt * 0.09;
    for (const sh of this.menuShards) {
      const o = sh.userData.orbit as { a: number; r: number; y: number; sp: number };
      o.a += dt * o.sp;
      sh.position.x = Math.cos(o.a) * o.r;
      sh.position.z = Math.sin(o.a) * o.r;
      sh.position.y = o.y + Math.sin(t * 0.9 + o.a * 2) * 0.12;
      sh.rotation.x += dt * 0.3;
      sh.rotation.y += dt * 0.22;
    }
    if (this.menuGlow) {
      const m = this.menuGlow.material as THREE.SpriteMaterial;
      m.opacity = 0.45 + Math.sin(t * 0.8) * 0.08;
    }
    const parts = this.menuParticles;
    if (parts) {
      if (Math.random() < 0.6)
        parts.emit(
          (Math.random() - 0.5) * 5,
          0.1 + Math.random() * 0.4,
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 0.12,
          0.25 + Math.random() * 0.4,
          (Math.random() - 0.5) * 0.12,
          2 + Math.random() * 2.5,
          0.08,
          0,
          tmpMenuA.set(Math.random() < 0.4 ? 0x6ab8ff : 0xa86bff),
          tmpMenuB.set(0x12002a),
          -0.02,
          0.2
        );
      parts.update(dt);
    }
    this.renderer.render(this.menuScene, this.menuCamera);
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (t: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (t - this.last) / 1000);
      this.last = t;
      this.frame(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  // ------------------------------------------------ session / zones
  newSession(loadSaved: boolean) {
    this.clearEntities();
    this.state = { travel: (z: string) => this.travel(z) };
    this.P.dead = false;
    this.cine = null;
    this.trans = null;
    useFade.setState({ v: 0 });
    useGame.setState({ cine: null, dialog: null, arise: null, banner: null });
    const s = useGame.getState().save;
    this.derived = derive(s);
    this.P.hp = this.derived.maxHp;
    this.P.mp = this.derived.maxMp;
    this.P.lookKey = '';
    this.armyCarry = [];
    this.loadZone('seoul', loadSaved ? { restore: true } : { fresh: true });
    input.clear();
    if (loadSaved)
      useGame.getState().save.shadows.forEach((r) => {
        if (r.state === 'summoned') useGame.getState().patchShadow(r.id, { state: 'stored' });
      });
  }
  clearEntities() {
    this.enemies.forEach((e) => this.scene.remove(e.rig.root));
    this.enemies = [];
    this.allies.forEach((a) => this.scene.remove(a.rig.root));
    this.allies = [];
    clearNPCs(this);
    this.gates.forEach((g) => {
      this.scene.remove(g.group);
      this.scene.remove(g.label);
      disposeObj(g.group);
      disposeObj(g.label);
    });
    this.gates = [];
    this.interacts = [];
    this.projs.forEach((p) => this.scene.remove(p.mesh));
    this.projs = [];
    this.lock = null;
    this.extraction = null;
    this.domain = null;
    this.fx?.clearTele();
    this.keyGate = null;
  }
  applyZoneLook() {
    const z = this.zone;
    const s = useGame.getState().settings;
    this.scene.fog = new THREE.Fog(z.fog[0], z.fog[1], Math.min(z.fog[2], s.draw));
    this.scene.background = new THREE.Color(z.fog[0]);
    this.hemi.color.set(z.hemi[0]);
    this.hemi.groundColor.set(z.hemi[1]);
    this.hemi.intensity = z.ambient;
    this.sun.intensity = z.sun;
    const look: Record<string, [number, number, number]> = {
      seoul: [0xaab8ff, 0x6a8aff, 0.42],
      double: [0xff9a6a, 0xff6a3a, 0.3],
      venom: [0x8affb0, 0x2aff8a, 0.34],
      job: [0xff7a6a, 0xff2a3a, 0.4],
      raid: [0xff7a6a, 0xff2a3a, 0.4],
      penalty: [0xffc070, 0xff8a3a, 0.4],
    };
    const lk = look[z.id] ?? look.double;
    this.sun.color.set(lk[0]);
    this.fill.color.set(lk[1]);
    this.fill.intensity = lk[2];
    this.renderer.toneMappingExposure = z.dark ? 1.26 : 1.18;
    const R = z.shadowRadius;
    const c = this.sun.shadow.camera;
    c.left = -R;
    c.right = R;
    c.top = R;
    c.bottom = -R;
    c.updateProjectionMatrix();
  }
  loadZone(id: string, opts: any = {}) {
    const prev = this.zone;
    const carry = this.allies.filter((a) => a.state !== 'dead').map((a) => a.rec.id);
    this.clearEntities();
    if (prev) {
      this.scene.remove(prev.group);
      if (prev !== this.seoul) disposeObj(prev.group);
    }
    let z: Zone;
    if (id === 'seoul') {
      z = this.seoul || (this.seoul = buildSeoul());
    } else if (id === 'double') z = buildTemple();
    else if (id === 'venom') z = buildCave();
    else if (id === 'job' || id === 'raid') {
      z = buildArena();
      z.id = id;
      if (id === 'raid') z.name = 'C-Rank Raid Gate';
    } else z = buildPenalty();
    this.zone = z;
    this.scene.add(z.group);
    this.applyZoneLook();
    const sp = z.spawn;
    this.P.pos.set(sp[0], 0, sp[1]);
    this.P.yaw = sp[2];
    this.camYaw = sp[2];
    this.camPitch = 0.28;
    this.P.vel.set(0, 0, 0);
    this.refreshModel(true);
    audio.setMode(z.music);
    this.state.zoneT = 0;
    this.combo = 0;
    this.P.atk = null;
    this.P.rush = null;
    this.P.dodgeT = 0;
    this.P.invuln = 1;
    if (id !== 'seoul') {
      this.armyCarry = carry;
    }
    story.onEnter(this, id, opts);
    useHud.setState({ zone: z.name, boss: null, target: null });
    if (id !== 'seoul')
      this.armyCarry.forEach((rid) => {
        const r = useGame.getState().save.shadows.find((s) => s.id === rid);
        if (r) summonShadow(this, r, true);
      });
    else
      carry.forEach((rid) => {
        const r = useGame.getState().save.shadows.find((s) => s.id === rid);
        if (r) summonShadow(this, r, true);
      });
  }
  transition(cb: () => void) {
    if (this.trans) return;
    this.trans = { phase: 0, t: 0, cb };
  }
  travel(zone: string, opts: any = {}) {
    this.transition(() => {
      this.loadZone(zone, opts);
    });
  }
  addGate(
    key: string,
    x: number,
    z: number,
    target: string,
    o: { exit?: boolean; name?: string; onEnter?: () => void; big?: number; id?: string } = {}
  ) {
    const colors: Record<string, number> = {
      leak: 0x6ab4ff,
      double: 0xff8a3a,
      venom: 0x6dff7a,
      job: 0xff3a4a,
      raid: 0xb26bff,
      exit: 0x9ad8ff,
      penalty: 0xffc04a,
    };
    const grp = makeGate(colors[key] ?? 0x9ad8ff, o.big ?? 1);
    grp.position.set(x, 0, z);
    grp.rotation.y = Math.atan2(this.P.pos.x - x, this.P.pos.z - z);
    this.scene.add(grp);
    const name = o.name || key;
    const label = makeLabel(name, {
      w: 6,
      h: 1.5,
      color: '#' + new THREE.Color(colors[key] ?? 0x9ad8ff).getHexString(),
      font: 46,
    });
    label.position.set(x, (grp.userData.rad as number) * 2.3 + 0.8, z);
    this.scene.add(label);
    const gate: GateObj = {
      id: o.id || key + this.enemyId++,
      key,
      group: grp,
      x,
      z,
      target,
      label,
      closing: 0,
      onEnter: o.onEnter,
      exit: o.exit,
      name,
    };
    this.gates.push(gate);
    audio.sfx('gate');
    this.fx.shock(x, 0, z, colors[key] ?? 0x9ad8ff, 9, 1);
    return gate;
  }
  closeGate(g: GateObj) {
    g.closing = 0.001;
    audio.sfx('boom');
  }
  removeGate(g: GateObj) {
    this.scene.remove(g.group);
    this.scene.remove(g.label);
    disposeObj(g.group);
    disposeObj(g.label);
    this.gates = this.gates.filter((q) => q !== g);
  }
  spawn(key: string, x: number, z: number, o: any = {}) {
    return spawnEnemy(this, key, x, z, o);
  }

  // ------------------------------------------------ model / stats
  refreshModel(force = false) {
    const s = useGame.getState().save;
    const d = derive(s);
    this.derived = d;
    const ch = s.chapter;
    const stage = ch < 3 ? 0 : ch < 5 ? 3 : ch < 6 ? 4 : 6;
    const arm = s.equip.armor ? ITEMS[s.equip.armor] : null;
    const helm = s.equip.helmet ? ITEMS[s.equip.helmet] : null;
    const gloves = s.equip.gloves ? ITEMS[s.equip.gloves] : null;
    const boots = s.equip.boots ? ITEMS[s.equip.boots] : null;
    const accessory = s.equip.accessory ? ITEMS[s.equip.accessory] : null;
    const w = d.weapon;
    const key = `${stage}|${arm?.id}|${helm?.id}|${gloves?.id}|${boots?.id}|${accessory?.id}|${w?.id}`;
    if (!force && key === this.P.lookKey) return;
    this.P.lookKey = key;
    if (this.P.rig) this.scene.remove(this.P.rig.root);
    const trim = arm ? parseInt(RARITY_COLOR[arm.rarity].slice(1), 16) : stage >= 6 ? 0x8a5cff : 0x8a93a8;
    const rig = makeJinWoo({
      stage,
      armorColor: arm?.color,
      weaponLook: w?.look || 'rusty',
      wtype: w?.wtype || 'dagger',
      hasHelm: !!helm,
      hasGloves: !!gloves,
      hasBoots: !!boots,
      accessory: accessory?.id,
      trim,
    });
    this.P.rig = rig;
    rig.root.position.copy(this.P.pos);
    this.scene.add(rig.root);
    this.P.hp = Math.min(this.P.hp, d.maxHp);
    this.P.mp = Math.min(this.P.mp, d.maxMp);
  }
  onLevelUp() {
    const d = (this.derived = derive(useGame.getState().save));
    this.P.hp = d.maxHp;
    this.P.mp = d.maxMp;
    const p = this.P.pos;
    this.fx.shock(p.x, 0, p.z, 0x6ab4ff, 8, 0.9);
    this.fx.flash(p.x, 1.2, p.z, 0x8ad8ff, 3.2, 0.35);
    this.fx.pillar(p.x, p.z, 0x6ab4ff, 7.5, 0.8);
    this.fx.burst(p.x, 0.5, p.z, 40, { speed: 5, up: 4, life: 1.2, size: 0.25, c0: 0xffffff, c1: 0x4aa8ff, grav: -2 });
    this.shake = Math.max(this.shake, 0.2);
  }
  useItem(id: string) {
    const it = ITEMS[id];
    const st = useGame.getState();
    if (!it) return;
    if (it.kind === 'consumable') {
      if (!st.removeItem(id)) return;
      this.P.hp = Math.min(this.derived.maxHp, this.P.hp + (it.heal || 0));
      this.P.mp = Math.min(this.derived.maxMp, this.P.mp + (it.mana || 0));
      this.fx.burst(this.P.pos.x, 1, this.P.pos.z, 20, {
        speed: 2,
        up: 2,
        life: 0.8,
        c0: 0x80ffb0,
        c1: 0x2aff80,
        grav: -1,
      });
      bus.emit('sfx', 'levelup');
      st.notify({ title: it.name + ' used' });
    } else if (it.kind === 'key') {
      if (this.zone.id !== 'seoul') {
        st.notify({ title: 'Keys can only be used in Seoul' });
        return;
      }
      if (this.keyGate) {
        st.notify({ title: 'A key portal is already open' });
        return;
      }
      if (!st.removeItem(id)) return;
      const dir = V(-Math.sin(this.P.yaw), 0, -Math.cos(this.P.yaw)).multiplyScalar(-1);
      const px = this.P.pos.x + dir.x * 6,
        pz = this.P.pos.z + dir.z * 6;
      const k = id === 'key_venom' ? 'venom' : 'job';
      this.keyGate = this.addGate(k, px, pz, k, {
        name: k === 'venom' ? 'Instant Dungeon: Venom Cave' : 'Job Change Dungeon',
        id: 'key_' + k,
      });
      useGame.getState().setPanel('none');
      st.setScreen('playing');
    }
  }
  say(text: string, speaker?: string, dur = 3.5) {
    useGame.setState({ cine: this.cine ? useGame.getState().cine : { speaker, text, bars: false } });
    const my = ++this.sayT;
    setTimeout(() => {
      if (this.sayT === my && !this.cine) useGame.setState({ cine: null });
    }, dur * 1000);
  }
  banner(text: string, sub?: string, color?: string, dur = 2.6) {
    useGame.getState().setBanner({ text, sub, color, t: Date.now() });
    setTimeout(() => {
      const b = useGame.getState().banner;
      if (b && b.text === text) useGame.getState().setBanner(null);
    }, dur * 1000);
  }

  // ------------------------------------------------ cinematics
  cineSeq(shots: Shot[], done?: () => void) {
    this.cine = { shots, i: -1, t: 0, done };
    this.nextShot();
    input.clear();
  }
  nextShot() {
    const c = this.cine;
    if (!c) return;
    c.i++;
    if (c.i >= c.shots.length) {
      const d = c.done;
      this.cine = null;
      useGame.setState({ cine: null });
      this.camera.fov = 62;
      this.camera.updateProjectionMatrix();
      d?.();
      return;
    }
    const s = c.shots[c.i];
    c.t = 0;
    useGame.setState({ cine: { bars: true, speaker: s.speaker, text: s.text } });
    if (s.sfx) bus.emit('sfx', s.sfx);
    if (s.shake) this.shake = s.shake;
    s.cb?.();
  }
  skipCine() {
    const c = this.cine;
    if (!c) return;
    for (let i = c.i + 1; i < c.shots.length; i++) c.shots[i].cb?.();
    c.i = c.shots.length - 1;
    c.t = 999;
    this.nextShot();
  }
  updateCine(dt: number) {
    const c = this.cine!;
    const s = c.shots[c.i];
    if (!s) return;
    c.t += dt;
    const k = ease(Math.min(1, c.t / s.dur));
    const to = s.to || s.from;
    const lt = s.lookTo || s.look;
    this.camera.position.set(lerp(s.from[0], to[0], k), lerp(s.from[1], to[1], k), lerp(s.from[2], to[2], k));
    this.camera.lookAt(lerp(s.look[0], lt[0], k), lerp(s.look[1], lt[1], k), lerp(s.look[2], lt[2], k));
    if (s.fov && this.camera.fov !== s.fov) {
      this.camera.fov = s.fov;
      this.camera.updateProjectionMatrix();
    }
    if (c.t >= s.dur) this.nextShot();
  }

  // ------------------------------------------------ main frame
  onUi(a: string) {
    const st = useGame.getState();
    if (st.screen === 'menu' || st.screen === 'dead') return;
    if (this.cine || this.trans) return;
    if (a === 'pause') {
      if (st.panel !== 'none' || st.dialog) {
        st.setPanel('none');
        st.setDialog(null);
        st.setScreen('playing');
        return;
      }
      if (st.screen === 'paused') st.setScreen('playing');
      else {
        st.setScreen('paused');
        input.unlock();
      }
      return;
    }
    if (st.screen !== 'playing' && st.screen !== 'paused') return;
    const map: Record<string, any> = { status: 'status', inventory: 'inventory', map: 'map', quests: 'quests' };
    const p = map[a];
    if (!p) return;
    if (st.panel === p) {
      st.setPanel('none');
      st.setScreen('playing');
    } else {
      st.setPanel(p);
      st.setScreen('playing');
      input.unlock();
    }
  }
  frame(realDt: number) {
    const st = useGame.getState();
    if (st.screen === 'menu') {
      this.frameMenu(realDt);
      return;
    }
    const uiPaused = st.screen !== 'playing' || st.panel !== 'none' || !!st.dialog;
    if (!this.zone || !this.P.rig) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (!uiPaused) {
      let dt = realDt;
      if (this.hitstop > 0) {
        this.hitstop -= realDt;
        dt *= 0.04;
      }
      if (this.slow.t > 0) {
        this.slow.t -= realDt;
        dt *= this.slow.s;
      }
      this.update(dt, realDt);
    } else {
      input.lookX = input.lookY = 0;
      input.pressed.clear();
    }
    this.renderer.render(this.scene, this.camera);
  }
  update(dt: number, realDt: number) {
    this.t += dt;
    this.state.zoneT += dt;
    const P = this.P;
    if (this.trans) {
      const tr = this.trans;
      tr.t += realDt;
      if (tr.phase === 0) {
        useFade.setState({ v: Math.min(1, tr.t / 0.45) });
        if (tr.t >= 0.5) {
          tr.phase = 1;
          tr.t = 0;
          tr.cb();
        }
      } else {
        useFade.setState({ v: Math.max(0, 1 - Math.max(0, tr.t - 0.15) / 0.5) });
        if (tr.t > 0.65) {
          this.trans = null;
          useFade.setState({ v: 0 });
        }
      }
    }
    const locked = !!this.cine || !!this.trans || P.dead;
    if (!locked) {
      this.updateInput(dt);
    }
    this.updatePlayer(dt, locked);
    if (this.cine) this.updateCine(dt);
    else this.updateCamera(dt);
    updateEnemies(this, dt);
    updateAllies(this, dt);
    updateNPCs(this, dt);
    this.updateProjs(dt);
    extractionUpdate(this, dt);
    this.updateGates(dt);
    this.zone.update(dt, this.t, P.pos.x, P.pos.z);
    story.update(this, dt);
    this.fx.update(dt);
    this.sun.position.set(P.pos.x + 24, 38, P.pos.z + 14);
    this.sun.target.position.copy(P.pos);
    this.sun.target.updateMatrixWorld();
    this.fill.position.set(P.pos.x - 26, 24, P.pos.z - 16);
    this.fill.target.position.copy(P.pos);
    this.fill.target.updateMatrixWorld();
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    this.shake = Math.max(0, this.shake - dt * 1.6);
    this.hudT += realDt;
    if (this.hudT > 0.1) {
      this.hudT = 0;
      this.updateHud();
      this.drawMini();
    }
    this.saveT += realDt;
    if (this.saveT > 40) {
      this.saveT = 0;
      if (this.zone.id === 'seoul' && useGame.getState().save.chapter >= 1 && !P.dead)
        useGame.getState().persist('auto');
    }
  }

  // ------------------------------------------------ input -> actions
  updateInput(dt: number) {
    const P = this.P;
    const s = useGame.getState();
    const sv = s.save;
    const d = this.derived;
    const look = input.takeLook();
    const sens = 0.0022 * s.settings.sens;
    this.camYaw -= look.x * sens;
    this.camPitch = Math.max(-0.4, Math.min(1.1, this.camPitch + look.y * sens));
    const k = input.keys;
    const ar = (k.has('ArrowRight') ? 1 : 0) - (k.has('ArrowLeft') ? 1 : 0);
    this.camYaw -= ar * dt * 2.2;
    if (k.has('ArrowDown')) this.camPitch = Math.min(1.1, this.camPitch + dt * 1.5);
    if (input.hit('lock')) this.cycleLock();
    if (input.hit('unlock')) this.lock = null;
    for (let i = 1; i <= 5; i++)
      if (input.hit('cmd' + i)) {
        if (sv.flags.necro) setCommand(this, ['follow', 'attack', 'defend', 'hold', 'regroup'][i - 1]);
      }
    if (input.hit('summon')) {
      if (!sv.flags.necro) s.notify({ title: 'Locked', text: 'Shadow Summoning unlocks after the Job Change Quest.' });
      else if (input.held('sprint')) dismissAll(this);
      else if (!this.allies.length) bus.emit('summonDefault');
      else
        setCommand(
          this,
          ['follow', 'attack', 'defend', 'hold', 'regroup'][
            (['follow', 'attack', 'defend', 'hold', 'regroup'].indexOf(this.cmd) + 1) % 5
          ]
        );
    }
    if (input.hit('transform'))
      s.notify({
        title: 'SHADOW MONARCH TRANSFORMATION',
        text: 'Locked. Unlocks in a later Story Arc (not part of this build).',
      });
    if (input.hit('exchange')) this.shadowExchange();
    if (input.hit('dash')) this.skill('dash');
    if (input.hit('special')) this.skill('special');
    if (input.hit('skillX')) this.skill('x');
    if (input.hit('skillZ')) this.skill('z');
    if (input.hit('domain')) this.skill('v');
    P.dodgeCd -= dt;
    for (const k2 of Object.keys(P.cds)) P.cds[k2] = Math.max(0, P.cds[k2] - dt);
    P.mp = Math.min(d.maxMp, P.mp + d.mpRegen * dt * (this.domain && this.inDomain(P.pos) ? 2.5 : 1));
    P.hp = Math.min(d.maxHp, P.hp + (0.8 + (this.domain && this.inDomain(P.pos) ? d.maxHp * 0.02 : 0)) * dt);
    P.invuln = Math.max(0, P.invuln - dt);
    P.poison = Math.max(0, P.poison - dt);
    P.domainT = Math.max(0, P.domainT - dt);
    // kneel (story controlled)
    const wantKneel = input.held('interact') && story.canKneel(this);
    P.kneeling = wantKneel && !P.atk;
    if (P.kneeling) {
      P.ps.kneel = Math.min(1, P.ps.kneel + dt * 4);
      input.pressed.delete('attack');
      input.pressed.delete('jump');
      input.pressed.delete('dodge');
      return;
    }
    // jump / dodge / attack
    if (input.hit('jump') && P.grounded && !P.atk) {
      P.vel.y = 8.6;
      P.grounded = false;
      bus.emit('sfx', 'jump');
    }
    if (input.hit('dodge') && P.dodgeCd <= 0 && !P.atk?.plunge) this.dodge();
    const held = input.held('attack');
    if (input.hit('attack')) {
      if (!P.grounded && !P.atk) this.startAttack('air');
      else if (P.dodgeT > 0 || this.t - P.dodgeEnd < 0.35) this.startAttack('dodge');
      else if (!P.atk && !P.rush) this.startAttack('light');
      else if (P.atk && !P.atk.plunge) P.queued = true;
    }
    if (held && !P.atk && !P.rush) {
      P.holdT += dt;
      if (P.holdT > 0.45) {
        if (!P.charging) bus.emit('sfx', 'cast');
        P.charging = true;
        P.ps.cast = 0;
        if (Math.random() < 0.5)
          this.fx.burst(P.pos.x, 1.2, P.pos.z, 1, { speed: 2, life: 0.4, size: 0.15, c0: 0xffffff, c1: 0x6a4aff });
      }
    } else if (!held) {
      if (P.charging && P.holdT > 0.7 && !P.atk) this.startAttack('heavy');
      P.holdT = 0;
      P.charging = false;
    }
    if (P.atk) {
      P.holdT = Math.min(P.holdT, 0.4);
    }
    input.pressed.delete('attackUp');
  }
  moveDir(): { x: number; z: number; mag: number } {
    const a = input.axis();
    const f = { x: -Math.sin(this.camYaw), z: -Math.cos(this.camYaw) },
      r = { x: Math.cos(this.camYaw), z: -Math.sin(this.camYaw) };
    const x = f.x * a.y + r.x * a.x,
      z = f.z * a.y + r.z * a.x;
    return { x, z, mag: Math.min(1, Math.hypot(a.x, a.y)) };
  }
  weaponType() {
    return this.derived.weapon?.wtype || 'dagger';
  }
  startAttack(kind: 'light' | 'heavy' | 'air' | 'dodge') {
    const P = this.P;
    const wt = this.weaponType();
    const tbl = WA[wt];
    const as = this.derived.atkSpd;
    let def: any;
    if (kind === 'light') {
      if (P.comboT > 0.75) P.comboIdx = 0;
      def = tbl[P.comboIdx % tbl.length];
      P.comboIdx++;
    } else if (kind === 'heavy')
      def = {
        kind: 'overhead',
        dur: 0.75,
        hit: 0.6,
        m: 2.8,
        reach: tbl[0].reach + 1.2,
        arc: 170,
        lunge: 2.4,
        knock: 9,
        fin: true,
      };
    else if (kind === 'dodge')
      def = { kind: 'stab', dur: 0.4, hit: 0.45, m: 1.9, reach: 3.8, arc: 90, lunge: 4.5, knock: 4 };
    else def = { kind: 'plunge', dur: 5, hit: 99, m: 1.8, reach: 3.4, arc: 360, lunge: 0, knock: 6 };
    const dir = this.aimDir();
    P.yaw = Math.atan2(dir.x, dir.z);
    const dur = def.dur / as;
    P.atk = {
      kind: def.kind,
      t: 0,
      dur,
      hitT: def.hit * dur,
      hit: false,
      m: def.m,
      reach: def.reach,
      arc: def.arc,
      lunge: def.lunge,
      knock: def.knock,
      dir,
      heavy: kind === 'heavy',
      fin: def.fin,
      plunge: kind === 'air',
    };
    if (kind === 'air') {
      P.vel.y = -15;
    }
    P.queued = false;
    P.charging = false;
    P.holdT = 0;
    bus.emit('sfx', 'swing', P.comboIdx % 3);
  }
  aimDir(): V3 {
    const P = this.P;
    if (this.lock && !this.lock.dead) {
      return V(this.lock.pos.x - P.pos.x, 0, this.lock.pos.z - P.pos.z).normalize();
    }
    let best: Enemy | null = null,
      bd = 7;
    for (const e of this.enemies) {
      if (e.dead || e.state === 'rise') continue;
      const dd = e.pos.distanceTo(P.pos);
      if (dd < bd) {
        bd = dd;
        best = e;
      }
    }
    if (best) return V(best.pos.x - P.pos.x, 0, best.pos.z - P.pos.z).normalize();
    const m = this.moveDir();
    if (m.mag > 0.1) return V(m.x, 0, m.z).normalize();
    return V(Math.sin(P.yaw), 0, Math.cos(P.yaw));
  }
  dodge() {
    const P = this.P;
    const m = this.moveDir();
    const dir =
      m.mag > 0.1
        ? V(m.x, 0, m.z).normalize()
        : V(Math.sin(P.yaw), 0, Math.cos(P.yaw)).multiplyScalar(-1 * (this.lock ? 1 : -1));
    P.dodgeDir.copy(dir);
    P.dodgeT = 0.3;
    P.dodgeCd = 0.75;
    P.invuln = Math.max(P.invuln, 0.36);
    P.atk = null;
    if (!this.lock) P.yaw = Math.atan2(dir.x, dir.z);
    bus.emit('sfx', 'dash');
    this.fx.shadowBurst(P.pos.x, 0.8, P.pos.z, 8, 1.5);
    this.fx.dust(P.pos.x, P.pos.z, 6);
    this.fx.streak(P.pos.x, 0.65, P.pos.z, 0x9ad8ff, 1.8, 0);
    this.fx.flash(P.pos.x, 0.7, P.pos.z, 0x9ad8ff, 1.1, 0.12);
  }
  skill(n: string) {
    const P = this.P;
    const s = useGame.getState();
    const sv = s.save;
    const d = this.derived;
    if (P.atk && n !== 'dash') return;
    if (P.kneeling) return;
    const need = (flag: string, txt: string) => {
      if (!sv.flags[flag]) {
        s.notify({ title: 'SKILL LOCKED', text: txt });
        return false;
      }
      return true;
    };
    const cost = (c: number, cdName: string, cd: number) => {
      if (P.cds[cdName] > 0) return false;
      if (P.mp < c) {
        s.notify({ title: 'NOT ENOUGH MANA' });
        return false;
      }
      P.mp -= c;
      P.cds[cdName] = cd;
      return true;
    };
    const dir = this.aimDir();
    const p = P.pos;
    if (n === 'dash') {
      if (!need('awakened', 'Shadow Dash is granted by the System.')) return;
      if (!cost(0, 'dash', 2.6)) return;
      const m = this.moveDir();
      const dv = m.mag > 0.1 ? V(m.x, 0, m.z).normalize() : dir;
      this.fx.shadowBurst(p.x, 1, p.z, 18, 3);
      this.fx.flash(p.x, 1, p.z, 0x8a4aff, 2.2, 0.18);
      this.fx.streak(p.x, 0.9, p.z, 0xa86bff, 3.2, Math.atan2(dv.x, dv.z) - this.camYaw);
      P.blinkT = 0.15;
      P.invuln = 0.4;
      P.dodgeDir.copy(dv);
      P.dodgeT = 0.15;
      P.yaw = Math.atan2(dv.x, dv.z);
      bus.emit('sfx', 'dash');
      this.shake = 0.12;
      this.state.dashPow = 1;
    } else if (n === 'special') {
      if (!need('venomDone', 'Violent Slash is unlocked by clearing the Venom Cave.')) return;
      if (!cost(18, 'special', 4.5)) return;
      P.yaw = Math.atan2(dir.x, dir.z);
      P.atk = { kind: 'slash1', t: 0, dur: 0.4, hitT: 99, hit: true, m: 0, reach: 0, arc: 0, lunge: 0, knock: 0, dir };
      const specialColor = this.combatColor();
      this.fx.slash(p.x + dir.x * 1.5, 1.25, p.z + dir.z * 1.5, specialColor, 3.8, -0.7, 1.25);
      this.fx.flash(p.x + dir.x * 1.7, 1.1, p.z + dir.z * 1.7, specialColor, 2.6, 0.22);
      this.fx.streak(p.x, 1, p.z, specialColor, 3.4, Math.atan2(dir.x, dir.z) - this.camYaw);
      this.spawnWave(dir, d.atk * 2.4 * d.skillMul);
      bus.emit('sfx', 'cast');
      this.shake = 0.2;
    } else if (n === 'x') {
      if (!need('awakened', 'Dagger Rush requires the System.')) return;
      if (!cost(20, 'x', 6)) return;
      P.rush = { t: 0, dir: dir.clone(), hitN: 0 };
      P.yaw = Math.atan2(dir.x, dir.z);
      P.invuln = 0.6;
      bus.emit('sfx', 'dash');
    } else if (n === 'z') {
      if (!need('necro', "Ruler's Authority unlocks after the Job Change Quest.")) return;
      if (!cost(30, 'z', 9)) return;
      this.rulersAuthority(dir);
    } else if (n === 'v') {
      if (!need('necro', "Monarch's Domain unlocks after the Job Change Quest.")) return;
      if (!cost(40, 'v', 24)) return;
      this.domain = { x: p.x, z: p.z, t: 12, r: 12 };
      this.fx.decal(p.x, p.z, 12, 12);
      this.fx.shock(p.x, 0, p.z, 0x8a4aff, 14, 0.9);
      this.fx.burst(p.x, 0.5, p.z, 60, {
        speed: 6,
        up: 3,
        life: 1.4,
        size: 0.5,
        c0: 0x120022,
        c1: 0x6a2cff,
        smoke: true,
      });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * 6.283;
        this.fx.pillar(p.x + Math.cos(a) * 11.2, p.z + Math.sin(a) * 11.2, 0x8a4aff, 4.2, 0.42);
      }
      this.fx.flash(p.x, 1.4, p.z, 0x9a5aff, 4.2, 0.4);
      this.fx.shock(p.x, 0, p.z, 0xd4a0ff, 13, 1.1);
      bus.emit('sfx', 'domain');
      this.banner("MONARCH'S DOMAIN", 'Shadows empowered. Enemies slowed.', '#b26bff', 2);
      this.shake = 0.35;
      P.ps.cast = 1;
      P.castT = 0.6;
    }
  }
  inDomain(p: V3) {
    const d = this.domain;
    return !!d && Math.hypot(p.x - d.x, p.z - d.z) < d.r;
  }
  spawnWave(dir: V3, dmg: number) {
    const P = this.P;
    const group = new THREE.Group();
    const m = new THREE.Mesh(WAVE_GEO, WAVE_MAT);
    const m2 = new THREE.Mesh(WAVE_GEO, WAVE_MAT);
    m2.scale.set(1.22, 1, 1.22);
    m2.rotation.y = 0.28;
    group.add(m, m2);
    group.scale.set(2.2, 1, 2.2);
    group.rotation.y = Math.atan2(dir.x, dir.z);
    const pos = P.pos
      .clone()
      .add(V(0, 1.1, 0))
      .addScaledVector(dir, 1.2);
    group.position.copy(pos);
    this.scene.add(group);
    this.fx.flash(pos.x, pos.y, pos.z, this.combatColor(), 2.2, 0.2);
    this.fx.slash(pos.x, pos.y + 0.15, pos.z, this.combatColor(), 3.1, -0.7, 1.1);
    this.projs.push({
      mesh: group,
      pos,
      vel: dir.clone().multiplyScalar(22),
      dmg,
      life: 0.9,
      radius: 2,
      mine: true,
      pierce: true,
      hit: new Set(),
      kind: 'wave',
    });
  }
  rulersAuthority(dir: V3) {
    const P = this.P;
    const d = this.derived;
    P.ps.cast = 1;
    P.castT = 0.7;
    bus.emit('sfx', 'cast');
    this.shake = 0.3;
    this.fx.shock(P.pos.x + dir.x * 5, 0, P.pos.z + dir.z * 5, 0xb26bff, 14, 0.6);
    let n = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const to = V(e.pos.x - P.pos.x, 0, e.pos.z - P.pos.z);
      const dist = to.length();
      if (dist > 15) continue;
      if (to.normalize().dot(dir) < 0.35 && dist > 4) continue;
      n++;
      if (e.boss) {
        hitEnemy(this, e, d.atk * 1.8 * d.skillMul, { knock: 4, dir, color: '#c88aff', stagger: 0.8 });
      } else {
        e.lift = 1.4;
        e.stun = 1.4;
        e.state = 'hurt';
        e.atk = null;
        e.hurtT = 1.4;
      }
      this.fx.burst(e.pos.x, 1, e.pos.z, 16, { speed: 3, up: 3, life: 0.8, c0: 0xd4a0ff, c1: 0x6a2cff });
      this.fx.pillar(e.pos.x, e.pos.z, 0x8a4aff, 5.5, 0.7);
      this.fx.flash(e.pos.x, 1.3, e.pos.z, 0xc88aff, 1.8, 0.22);
    }
    this.fx.flash(P.pos.x + dir.x * 1.2, 1.5, P.pos.z + dir.z * 1.2, 0x8a4aff, 2.4, 0.25);
    this.fx.shock(P.pos.x, 0, P.pos.z, 0x8a4aff, 5.5, 0.45);
    if (!n) useGame.getState().notify({ title: "Ruler's Authority", text: 'No targets in range.' });
  }
  shadowExchange() {
    const s = useGame.getState();
    if (!s.save.flags.necro) {
      s.notify({ title: 'SKILL LOCKED', text: 'Shadow Exchange unlocks after the Job Change Quest.' });
      return;
    }
    const P = this.P;
    if (P.cds.r > 0) return;
    const fwd = V(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
    let best: Ally | null = null,
      bs = -9;
    for (const a of this.allies) {
      if (a.state === 'dead' || a.state === 'rise') continue;
      const to = V(a.pos.x - P.pos.x, 0, a.pos.z - P.pos.z);
      const sc = to.clone().normalize().dot(fwd) * 2 - to.length() * 0.02;
      if (sc > bs) {
        bs = sc;
        best = a;
      }
    }
    if (!best) {
      s.notify({ title: 'SHADOW EXCHANGE', text: 'No active shadows. Summon with C.' });
      return;
    }
    if (P.mp < 5) return;
    P.mp -= 5;
    P.cds.r = 3;
    const old = P.pos.clone();
    const dest = best.pos.clone();
    this.fx.shadowBurst(old.x, 1, old.z, 26, 3.4);
    this.fx.shadowBurst(dest.x, 1, dest.z, 26, 3.4);
    this.fx.pillar(old.x, old.z, 0x8a4aff, 5, 0.6);
    this.fx.pillar(dest.x, dest.z, 0x8a4aff, 5, 0.6);
    const mid = old.clone().add(dest).multiplyScalar(0.5);
    const yaw = Math.atan2(dest.x - old.x, dest.z - old.z);
    for (let i = -2; i <= 2; i++) {
      this.fx.streak(mid.x + Math.cos(yaw) * i * 0.7, 1 + Math.abs(i) * 0.08, mid.z - Math.sin(yaw) * i * 0.7, i === 0 ? 0xd4a0ff : 0x6a2cff, 3.2, yaw - this.camYaw);
    }
    this.fx.flash(dest.x, 1.2, dest.z, 0xc88aff, 2.6, 0.28);
    P.pos.copy(dest);
    P.pos.y = 0;
    best.pos.copy(old);
    P.invuln = 0.5;
    bus.emit('sfx', 'void');
    this.shake = 0.2;
    s.notify({ title: 'SHADOW EXCHANGE', text: 'Swapped with ' + best.rec.name });
  }
  cycleLock() {
    const P = this.P;
    const range = this.derived.lockRange;
    const list = this.enemies.filter((e) => !e.dead && e.state !== 'rise' && e.pos.distanceTo(P.pos) < range);
    if (!list.length) {
      this.lock = null;
      return;
    }
    const fwd = V(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
    list.sort((a, b) => {
      const sa = V(a.pos.x - P.pos.x, 0, a.pos.z - P.pos.z),
        sb = V(b.pos.x - P.pos.x, 0, b.pos.z - P.pos.z);
      return (
        sb.clone().normalize().dot(fwd) * 6 -
        sb.length() * 0.1 -
        (sa.clone().normalize().dot(fwd) * 6 - sa.length() * 0.1)
      );
    });
    if (!this.lock) {
      this.lock = list[0];
      return;
    }
    const i = list.indexOf(this.lock);
    if (i < 0) {
      this.lock = list[0];
      return;
    }
    this.lock = i + 1 < list.length ? list[i + 1] : null;
  }

  // ------------------------------------------------ player update
  updatePlayer(dt: number, locked: boolean) {
    const P = this.P;
    const rig = P.rig;
    const d = this.derived;
    const ps = P.ps;
    ps.t = this.t;
    const m = locked ? { x: 0, z: 0, mag: 0 } : this.moveDir();
    let vx = 0,
      vz = 0;
    let speed = 5.4 * d.spd;
    P.sprint = !locked && input.held('sprint') && m.mag > 0.1 && !P.atk;
    if (P.sprint) speed *= 1.65;
    if (P.kneeling || P.charging) speed = 0;
    else if (P.atk && !P.atk.plunge) speed *= 0.25;
    if (this.inDomainSlow()) speed *= 1;
    if (P.dodgeT > 0) {
      P.dodgeT -= dt;
      const sp = (P.blinkT > 0 ? 46 : 13.5) * (1 + (d.st.agi - 10) * 0.004);
      vx = P.dodgeDir.x * sp;
      vz = P.dodgeDir.z * sp;
      if (P.blinkT > 0) P.blinkT -= dt;
      if (P.dodgeT <= 0) {
        P.dodgeEnd = this.t;
        if (this.state.dashPow) {
          this.state.dashPow = 0;
          this.fx.shadowBurst(P.pos.x, 1, P.pos.z, 14, 2);
        }
      }
      if (Math.random() < 0.8)
        this.fx.burst(P.pos.x, 0.9, P.pos.z, 1, {
          speed: 0.3,
          life: 0.35,
          size: 0.7,
          c0: 0x2a0a5a,
          c1: 0x050008,
          smoke: true,
        });
    } else if (P.rush) {
      const r = P.rush;
      r.t += dt;
      vx = r.dir.x * 17;
      vz = r.dir.z * 17;
      const hits = Math.floor(r.t / 0.1);
      if (hits > r.hitN) {
        r.hitN = hits;
        this.meleeArea(
          P.pos.x + r.dir.x * 1.2,
          P.pos.z + r.dir.z * 1.2,
          2.8,
          d.atk * 0.8 * d.skillMul,
          2,
          r.dir,
          '#9ad8ff'
        );
        bus.emit('sfx', 'swing', 2);
        this.fx.slash(
          P.pos.x + r.dir.x * 1.8,
          1.2 + Math.random() * 0.4,
          P.pos.z + r.dir.z * 1.8,
          this.combatColor(),
          1.9,
          hits % 2 ? 0.8 : -0.8
        );
      }
      ps.atk = (r.t / 0.5) % 1;
      ps.kind = hits % 2 ? 'slash2' : 'slash1';
      if (Math.random() < 0.6)
        this.fx.streak(P.pos.x, 0.9, P.pos.z, this.combatColor(), 1.6, Math.atan2(r.dir.x, r.dir.z) - this.camYaw);
      if (r.t > 0.5) {
        P.rush = null;
        ps.atk = -1;
      }
    } else if (m.mag > 0.05 && speed > 0) {
      vx = m.x * speed;
      vz = m.z * speed;
      if (!P.atk && !this.lock) {
        const ty = Math.atan2(m.x, m.z);
        P.yaw += angDiff(P.yaw, ty) * Math.min(1, dt * 14);
      }
      if (this.lock && !P.atk) {
        const l = this.lock;
        P.yaw += angDiff(P.yaw, Math.atan2(l.pos.x - P.pos.x, l.pos.z - P.pos.z)) * Math.min(1, dt * 12);
      }
    } else if (this.lock && !P.atk && !locked) {
      const l = this.lock;
      P.yaw += angDiff(P.yaw, Math.atan2(l.pos.x - P.pos.x, l.pos.z - P.pos.z)) * Math.min(1, dt * 10);
    }
    // attack processing
    const A = P.atk;
    if (A) {
      A.t += dt;
      ps.atk = Math.min(1, A.t / A.dur);
      ps.kind = A.kind;
      if (A.plunge) {
        ps.atk = 0.5;
        if (P.grounded) {
          P.atk = null;
          this.meleeArea(P.pos.x, P.pos.z, 3.6, d.atk * 1.8, 8, V(0, 0, 0), '#ffd070', true);
          this.fx.dust(P.pos.x, P.pos.z, 14);
          this.fx.shock(P.pos.x, 0, P.pos.z, 0xffd070, 4.6, 0.45);
          this.fx.crack(P.pos.x, P.pos.z, 3.1, 2.8, 0xffcf70);
          this.fx.flash(P.pos.x, 0.6, P.pos.z, 0xffcf70, 2.8, 0.22);
          bus.emit('sfx', 'slam');
          this.shake = 0.35;
          this.hitstop = 0.06;
        }
      } else {
        if (A.t < A.dur * 0.55) {
          vx += (Math.sin(P.yaw) * A.lunge) / (A.dur * 0.55);
          vz += (Math.cos(P.yaw) * A.lunge) / (A.dur * 0.55);
        }
        if (!A.hit && A.t >= A.hitT) {
          A.hit = true;
          this.playerStrike(A);
        }
        if (A.t > A.dur * 0.3 && A.t < A.dur * 0.85) this.weaponTrail();
        if (A.t >= A.dur) {
          P.atk = null;
          ps.atk = -1;
          P.comboT = 0;
          if (P.queued) {
            P.queued = false;
            this.startAttack('light');
          }
        }
      }
    } else {
      P.comboT += dt;
      if (!P.rush) ps.atk = -1;
    }
    if (P.castT > 0) {
      P.castT -= dt;
      ps.cast = Math.min(1, P.castT * 3);
    } else if (!P.charging) ps.cast = 0;
    if (P.charging) {
      ps.atk = 0.4;
      ps.kind = 'raise';
    }
    if (!P.kneeling) ps.kneel = Math.max(0, ps.kneel - dt * 4);
    // move with collision
    const nx = P.pos.x + vx * dt,
      nz = P.pos.z + vz * dt;
    if (walkable(this.zone, nx, nz, 0.45)) {
      P.pos.x = nx;
      P.pos.z = nz;
    } else if (walkable(this.zone, nx, P.pos.z, 0.45)) P.pos.x = nx;
    else if (walkable(this.zone, P.pos.x, nz, 0.45)) P.pos.z = nz;
    // gravity
    P.vel.y -= 24 * dt;
    P.pos.y += P.vel.y * dt;
    if (P.pos.y <= 0) {
      if (!P.grounded && P.vel.y < -4) this.fx.dust(P.pos.x, P.pos.z, 4);
      P.pos.y = 0;
      P.vel.y = 0;
      P.grounded = true;
    } else P.grounded = false;
    const spd = Math.hypot(vx, vz);
    ps.move = P.kneeling ? 0 : Math.min(1.4, spd / 5.4);
    ps.phase += dt * (6 + spd * 0.9) * (spd > 0.1 ? 1 : 0);
    ps.air = !P.grounded;
    ps.hurt = Math.max(0, ps.hurt - dt * 4);
    ps.block = 0;
    if (P.grounded && spd > 1 && !P.atk) {
      P.stepT -= dt * (spd / 5);
      if (P.stepT <= 0) {
        P.stepT = 0.34;
        bus.emit('sfx', 'step', P.sprint ? 1 : 0);
        if (P.sprint) this.fx.dust(P.pos.x, P.pos.z, 1);
      }
    }
    if (P.sprint && spd > 1) {
      P.runAcc += spd * dt;
      if (P.runAcc >= 5) {
        useGame.getState().questEvent('run', '', Math.floor(P.runAcc));
        P.runAcc = P.runAcc % 1;
      }
    }
    if (P.dead) {
      P.deadT += dt;
      ps.dead = Math.min(1, P.deadT * 1.3);
    }
    pose(rig, ps);
    rig.root.position.copy(P.pos);
    rig.root.rotation.y = P.yaw;
    rig.root.visible = true;
    if (P.poison > 0) {
      P.hp -= 4 * dt;
      if (P.hp <= 0 && !P.dead) this.killPlayer('Succumbed to poison');
    }
  }
  inDomainSlow() {
    return false;
  }
  combatColor() {
    const look = this.derived.weapon?.look;
    const sv = useGame.getState().save;
    if (look === 'fang') return 0x7dff8a;
    if (look === 'killer' || look === 'igris') return 0xff3a4a;
    if (sv.flags.necro) return 0xb26bff;
    return 0x9ad8ff;
  }
  weaponTrail() {
    const w = this.P.rig.weapon;
    if (!w) return;
    w.updateWorldMatrix(true, false);
    const len = this.P.rig.weaponLen;
    const b = w.localToWorld(V(0, 0.05, 0)),
      t = w.localToWorld(V(0, len, 0));
    this.fx.trail(b, t, this.combatColor());
  }
  playerStrike(A: NonNullable<Game['P']['atk']>) {
    const P = this.P;
    const d = this.derived;
    const dir = V(Math.sin(P.yaw), 0, Math.cos(P.yaw));
    const n = this.meleeArea(P.pos.x, P.pos.z, A.reach, d.atk * A.m, A.knock, dir, '#ffffff', false, A.arc, A.heavy);
    const color = this.combatColor();
    const screenAng = Math.atan2(dir.x, dir.z) - this.camYaw - Math.PI;
    const rot =
      A.kind === 'overhead' ? -1.35 : A.kind === 'slash2' ? 0.75 + screenAng * 0.3 : A.kind === 'stab' ? -0.15 : -0.75 + screenAng * 0.3;
    this.fx.slash(
      P.pos.x + dir.x * 1.5,
      1.25 + (A.kind === 'overhead' ? 0.45 : 0),
      P.pos.z + dir.z * 1.5,
      color,
      A.heavy ? 3.4 : A.fin ? 2.9 : 2.35,
      rot,
      A.kind === 'overhead' ? 1.35 : 0.95
    );
    if (A.heavy || A.fin) {
      this.fx.dust(P.pos.x + dir.x * 2, P.pos.z + dir.z * 2, 6);
      if (A.heavy) {
        this.fx.shock(P.pos.x + dir.x * 2.2, 0, P.pos.z + dir.z * 2.2, color, 4.4, 0.38);
        this.fx.flash(P.pos.x + dir.x * 2.2, 0.5, P.pos.z + dir.z * 2.2, color, 2.4, 0.18);
        this.fx.crack(P.pos.x + dir.x * 2.4, P.pos.z + dir.z * 2.4, 2.2, 2.2, color);
        this.shake = Math.max(this.shake, 0.3);
        bus.emit('sfx', 'slam');
      }
    }
    if (n === 0) this.fx.sparks(P.pos.x + dir.x * 1.5, 1.1, P.pos.z + dir.z * 1.5, color, 4);
  }
  meleeArea(
    x: number,
    z: number,
    reach: number,
    dmg: number,
    knock: number,
    dir: V3,
    color: string,
    circle = false,
    arc = 360,
    heavy = false
  ) {
    let n = 0;
    const d = this.derived;
    const w = d.weapon;
    for (const e of this.enemies) {
      if (e.dead || e.state === 'rise' || e.invuln) continue;
      const dx = e.pos.x - x,
        dz = e.pos.z - z;
      const dist = Math.hypot(dx, dz);
      if (dist > reach + e.r) continue;
      if (!circle && arc < 359) {
        const a = Math.abs(angDiff(Math.atan2(dir.x, dir.z), Math.atan2(dx, dz)));
        if (a > (arc * Math.PI) / 360 && dist > e.r + 0.8) continue;
      }
      let dm = dmg * (0.9 + Math.random() * 0.2);
      const crit = Math.random() < d.crit;
      if (crit) dm *= 1.7;
      if (w?.id === 'knight_killer' && e.def.armored) dm *= 1.5;
      hitEnemy(this, e, dm, {
        knock,
        dir: V(dx, 0, dz).normalize(),
        crit,
        color: crit ? '#ffd24a' : color,
        poison: w?.id === 'venom_fang' ? 4 : 0,
        heavy,
        fromPlayer: true,
      });
      n++;
    }
    if (n) {
      this.combo++;
      this.comboTimer = 3;
      this.hitstop = Math.max(this.hitstop, heavy ? 0.1 : 0.05);
    }
    return n;
  }
  updateProjs(dt: number) {
    for (const p of this.projs.slice()) {
      p.life -= dt;
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);
      let dead = p.life <= 0;
      if (p.kind === 'wave') {
        p.mesh.scale.multiplyScalar(1 + dt * 0.6);
        this.fx.burst(p.pos.x, p.pos.y, p.pos.z, 1, { speed: 0.5, life: 0.4, size: 0.4, c0: 0xc8a0ff, c1: 0x4a1aff });
        if (Math.random() < 0.5) this.fx.flash(p.pos.x, p.pos.y, p.pos.z, this.combatColor(), 1.4, 0.12);
      } else {
        p.mesh.scale.setScalar(1 + Math.sin(this.t * 20) * 0.1);
        this.fx.burst(p.pos.x, p.pos.y, p.pos.z, 1, { speed: 0.3, life: 0.4, size: 0.3, c0: 0x9aff6a, c1: 0x1a6a2a });
      }
      if (p.mine) {
        for (const e of this.enemies) {
          if (e.dead || p.hit.has(e) || e.state === 'rise') continue;
          if (Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < p.radius + e.r) {
            p.hit.add(e);
            hitEnemy(this, e, p.dmg, {
              knock: 5,
              dir: p.vel.clone().setY(0).normalize(),
              color: '#c8a0ff',
              crit: true,
            });
            if (!p.pierce) dead = true;
          }
        }
      } else if (
        Math.hypot(this.P.pos.x - p.pos.x, this.P.pos.z - p.pos.z) < p.radius + 0.5 &&
        Math.abs(this.P.pos.y + 1 - p.pos.y) < 1.8
      ) {
        this.hurtPlayer(p.dmg, p.pos, 3, p.poison);
        dead = true;
      }
      if (!walkable(this.zone, p.pos.x, p.pos.z, 0.05)) dead = true;
      if (dead) {
        this.scene.remove(p.mesh);
        this.projs = this.projs.filter((q) => q !== p);
        this.fx.burst(p.pos.x, p.pos.y, p.pos.z, 8, {
          speed: 3,
          life: 0.4,
          size: 0.25,
          c0: p.mine ? 0xc8a0ff : 0x9aff6a,
          c1: 0x4a1aff,
        });
      }
    }
  }
  hurtPlayer(dmg: number, from: V3, knock = 2, poison = 0) {
    const P = this.P;
    if (P.invuln > 0 || P.dead || this.cine) return;
    const d = this.derived;
    const dm = Math.max(1, Math.round(dmg - d.def * 0.5));
    P.hp -= dm;
    P.ps.hurt = 1;
    P.invuln = 0.35;
    this.shake = Math.max(this.shake, 0.4);
    this.hitstop = Math.max(this.hitstop, 0.07);
    P.atk = null;
    P.charging = false;
    P.rush = null;
    this.combo = 0;
    const dir = V(P.pos.x - from.x, 0, P.pos.z - from.z).normalize();
    const nx = P.pos.x + dir.x * knock * 0.35,
      nz = P.pos.z + dir.z * knock * 0.35;
    if (walkable(this.zone, nx, nz, 0.45)) {
      P.pos.x = nx;
      P.pos.z = nz;
    }
    this.fx.num(P.pos.clone().add(V(0, 2, 0)), '-' + dm, '#ff4a5a', true);
    this.fx.sparks(P.pos.x, 1.2, P.pos.z, 0xff2a3a, 12);
    this.fx.flash(P.pos.x, 1.2, P.pos.z, 0xff2a3a, 1.9, 0.2);
    bus.emit('sfx', 'hurt');
    bus.emit('playerHurt', dm);
    if (poison) P.poison = Math.max(P.poison, poison);
    if (P.hp <= 0) this.killPlayer('Slain in ' + this.zone.name);
  }
  killPlayer(cause: string) {
    const P = this.P;
    if (P.dead) return;
    P.dead = true;
    P.deadT = 0;
    P.hp = 0;
    this.slow = { t: 1.2, s: 0.3 };
    bus.emit('sfx', 'death');
    this.lock = null;
    setTimeout(() => {
      const st = useGame.getState();
      st.submitScore('Fell: ' + this.zone.name);
      useGame.setState({ screen: 'dead', deathInfo: { score: st.runScore, cause } });
      input.unlock();
    }, 1500);
  }
  retry() {
    const st = useGame.getState();
    if (st.screen !== 'dead') return;
    useGame.setState({ screen: 'playing', deathInfo: null });
    this.P.dead = false;
    this.P.deadT = 0;
    this.P.ps.dead = 0;
    this.P.hp = this.derived.maxHp;
    this.P.mp = this.derived.maxMp;
    this.P.poison = 0;
    const id = this.zone.id;
    this.state.retry = true;
    if (id === 'seoul') this.loadZone('seoul', { restore: true, respawn: true });
    else this.loadZone(id, { retry: true });
  }

  // ------------------------------------------------ camera
  updateCamera(dt: number) {
    const P = this.P;
    if (this.lock && !this.lock.dead) {
      const l = this.lock;
      const ty = Math.atan2(P.pos.x - l.pos.x, P.pos.z - l.pos.z);
      this.camYaw += angDiff(this.camYaw, ty) * Math.min(1, dt * 4);
      if (l.pos.distanceTo(P.pos) > this.derived.lockRange * 1.6) this.lock = null;
    } else if (this.lock) this.lock = null;
    const fovT = 62 + (P.sprint ? 6 : 0) + (P.dodgeT > 0 ? 8 : 0);
    this.fov += (fovT - this.fov) * Math.min(1, dt * 6);
    if (Math.abs(this.camera.fov - this.fov) > 0.05) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
    const tgt = this.camTgt.set(P.pos.x, P.pos.y + 1.6, P.pos.z);
    const dist = this.camDist * (P.kneeling ? 0.8 : 1) * (this.extraction ? 0.7 : 1);
    const cp = Math.cos(this.camPitch),
      sp = Math.sin(this.camPitch);
    const dir = this.camDir.set(Math.sin(this.camYaw) * cp, sp, Math.cos(this.camYaw) * cp);
    let use = dist;
    for (let k = 1; k <= 8; k++) {
      const dd = (dist * k) / 8;
      const x = tgt.x + dir.x * dd,
        z = tgt.z + dir.z * dd;
      if (!walkable(this.zone, x, z, 0.3)) {
        use = Math.max(1.6, dd - 0.8);
        break;
      }
    }
    const off = this.camOff.set(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw)).multiplyScalar(0.7);
    const want = this.camWant.copy(tgt).addScaledVector(dir, use).add(off);
    want.y = Math.max(0.5, want.y);
    this.camera.position.lerp(want, Math.min(1, dt * 18));
    if (this.camera.position.distanceTo(want) > 8) this.camera.position.copy(want);
    const s = useGame.getState().settings.reducedMotion ? 0 : this.shake * 0.35;
    this.camera.position.x += (Math.random() - 0.5) * s;
    this.camera.position.y += (Math.random() - 0.5) * s;
    this.camera.lookAt(tgt.x + off.x * 0.8, tgt.y - 0.1 + (this.lock ? 0.2 : 0), tgt.z + off.z * 0.8);
    if (this.lock && !this.lock.dead) {
      this.lockSprite.visible = true;
      this.lockSprite.position.set(
        this.lock.pos.x,
        this.lock.rig.height * this.lock.def.scale * 0.6 + 1.2,
        this.lock.pos.z
      );
      this.lockSprite.scale.setScalar(0.9 + Math.sin(this.t * 6) * 0.08);
      (this.lockSprite.material as THREE.SpriteMaterial).rotation = this.t;
    } else this.lockSprite.visible = false;
  }

  // ------------------------------------------------ gates & interactions
  updateGates(dt: number) {
    for (const g of this.gates.slice()) {
      const ud = g.group.userData;
      if (ud.disc) {
        ud.disc.rotation.z += dt * 1.4;
        ud.ring.rotation.z -= dt * 0.4;
        ud.ring2.rotation.z += dt * 0.7;
        if (ud.ring3) ud.ring3.rotation.z -= dt * 0.9;
        if (ud.light) ud.light.intensity = 17 + Math.sin(this.t * 5.5 + g.x) * 4;
      }
      g.group.rotation.y = Math.atan2(this.P.pos.x - g.x, this.P.pos.z - g.z);
      if (g.closing > 0) {
        g.closing += dt;
        const k = Math.max(0, 1 - g.closing / 1.2);
        g.group.scale.setScalar(k);
        g.label.visible = k > 0.5;
        if (k <= 0) {
          this.removeGate(g);
          if (this.keyGate === g) this.keyGate = null;
        }
      } else if (Math.random() < 0.5)
        this.fx.burst(g.x + (Math.random() - 0.5) * 3, 0.3, g.z + (Math.random() - 0.5) * 3, 1, {
          speed: 0.6,
          up: 2,
          life: 1,
          size: 0.2,
          c0: 0xffffff,
          c1: (ud.ring?.material as any)?.color?.getHex() ?? 0x6ab4ff,
        });
      g.label.lookAt(this.camera.position);
    }
    // interact detection
    let best: Interact | null = null,
      bd = 1e9;
    const P = this.P;
    const gi = this.gates
      .filter((g) => g.closing === 0 && g.key !== 'leak')
      .map(
        (g) =>
          ({
            id: 'gate_' + g.id,
            x: g.x,
            z: g.z,
            r: 4.2,
            label: () => `Enter ${g.name}`,
            act: () => this.enterGate(g),
          }) as Interact
      );
    if (!this.cine && !this.trans && !P.dead)
      for (const it of [...this.interacts, ...gi]) {
        const dd = Math.hypot(it.x - P.pos.x, it.z - P.pos.z);
        if (dd < it.r && dd < bd) {
          const l = it.label();
          if (l) {
            best = it;
            bd = dd;
          }
        }
      }
    this.nearest = best;
    this.promptStr = best ? best.label() : null;
    if (!best && !this.cine) this.promptStr = tryExtract(this, false);
    if (input.hit('interact') && !this.cine && !P.dead) {
      if (best) best.act();
      else tryExtract(this, true);
    }
  }
  enterGate(g: GateObj) {
    if (this.trans) return;
    bus.emit('sfx', 'gate');
    const target = g.target;
    const cb = g.onEnter;
    this.transition(() => {
      if (cb) cb();
      useGame.getState().questEvent('enter', target);
      if (g.key === 'leak') return;
      this.loadZone(target, { from: this.zone.id });
    });
  }
  // ------------------------------------------------ HUD / minimap
  updateHud() {
    const P = this.P;
    const d = this.derived;
    const sv = useGame.getState().save;
    const boss = this.enemies.find((e) => e.boss && !e.dead && e.aura !== undefined && e.state !== 'rise');
    const tgt =
      this.lock && !this.lock.dead
        ? this.lock
        : this.lastHitEnemy && !this.lastHitEnemy.dead && this.lastHitEnemy.pos.distanceTo(P.pos) < 25
          ? this.lastHitEnemy
          : null;
    useHud.setState({
      hp: Math.max(0, Math.round(P.hp)),
      maxHp: d.maxHp,
      mp: Math.round(P.mp),
      maxMp: d.maxMp,
      target: tgt ? { name: tgt.def.name, hp: Math.round(tgt.hp), max: tgt.maxHp, rank: tgt.def.rank } : null,
      boss: boss
        ? { name: boss.def.name, hp: Math.max(0, Math.round(boss.hp)), max: boss.maxHp, phase: boss.phase }
        : null,
      prompt: this.promptStr,
      cds: { ...P.cds },
      army: this.allies.filter((a) => a.state !== 'dead').length,
      cmd: this.cmd,
      dailyLeft: sv.dailyLeft,
      combo: this.combo,
      locked: !!this.lock,
      weapon: d.weapon?.name || 'Fists',
      kneel: P.ps.kneel,
    });
  }
  drawMini() {
    const c = this.miniCanvas;
    if (!c) return;
    const g = c.getContext('2d')!;
    const S = c.width,
      R = 36;
    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath();
    g.arc(S / 2, S / 2, S / 2 - 2, 0, 6.3);
    g.clip();
    const bg = g.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2);
    bg.addColorStop(0, '#071a34');
    bg.addColorStop(0.7, '#040d20');
    bg.addColorStop(1, '#02060f');
    g.fillStyle = bg;
    g.fillRect(0, 0, S, S);
    const P = this.P;
    const sc = S / 2 / R;
    const rot = this.camYaw;
    const tx = (x: number, z: number): [number, number] => {
      const dx = x - P.pos.x,
        dz = z - P.pos.z;
      const cx = dx * Math.cos(rot) - dz * Math.sin(rot),
        cz = dx * Math.sin(rot) + dz * Math.cos(rot);
      return [S / 2 + cx * sc, S / 2 + cz * sc];
    };
    g.strokeStyle = 'rgba(86,180,255,0.09)';
    g.lineWidth = 1;
    [R / 3, (R * 2) / 3].forEach((rr) => {
      g.beginPath();
      g.arc(S / 2, S / 2, rr * sc, 0, 6.3);
      g.stroke();
    });
    g.beginPath();
    g.moveTo(S / 2 - 8, S / 2);
    g.lineTo(S / 2 + 8, S / 2);
    g.moveTo(S / 2, S / 2 - 8);
    g.lineTo(S / 2, S / 2 + 8);
    g.stroke();
    g.fillStyle = 'rgba(34,70,124,0.6)';
    for (const r of this.zone.rects) {
      const p = tx(r.x0, r.z0),
        q = tx(r.x1, r.z0),
        s = tx(r.x1, r.z1),
        u = tx(r.x0, r.z1);
      g.beginPath();
      g.moveTo(p[0], p[1]);
      g.lineTo(q[0], q[1]);
      g.lineTo(s[0], s[1]);
      g.lineTo(u[0], u[1]);
      g.fill();
    }
    g.fillStyle = 'rgba(52,100,168,0.46)';
    for (const r of this.zone.roads) {
      const p = tx(r.x0, r.z0);
      g.fillRect(p[0], p[1], (r.x1 - r.x0) * sc, (r.z1 - r.z0) * sc);
    }
    g.fillStyle = 'rgba(5,12,26,0.92)';
    g.strokeStyle = 'rgba(86,180,255,0.14)';
    for (const b of this.zone.boxes) {
      if (Math.abs(b.x - P.pos.x) > R + 20 || Math.abs(b.z - P.pos.z) > R + 20) continue;
      const p = tx(b.x - b.hw, b.z - b.hd);
      g.fillRect(p[0], p[1], b.hw * 2 * sc, b.hd * 2 * sc);
      g.strokeRect(p[0], p[1], b.hw * 2 * sc, b.hd * 2 * sc);
    }
    const clampPos = (x: number, z: number): [number, number] => {
      const [a, b] = tx(x, z);
      const dx = a - S / 2,
        dy = b - S / 2;
      const l = Math.hypot(dx, dy);
      if (l > S / 2 - 7) return [S / 2 + (dx / l) * (S / 2 - 7), S / 2 + (dy / l) * (S / 2 - 7)];
      return [a, b];
    };
    const dot = (x: number, z: number, col: string, r = 3, glow = false) => {
      const [X, Y] = clampPos(x, z);
      if (glow) {
        g.fillStyle = col + '33';
        g.beginPath();
        g.arc(X, Y, r * 2.4 + Math.sin(this.t * 4) * 1.2, 0, 6.3);
        g.fill();
      }
      g.fillStyle = col;
      g.beginPath();
      g.arc(X, Y, r, 0, 6.3);
      g.fill();
    };
    for (const n of this.npcs) if (n.kind === 'talk' && !n.hidden) dot(n.pos.x, n.pos.z, '#ffd24a', 2.6);
    for (const gt of this.gates) {
      const [X, Y] = clampPos(gt.x, gt.z);
      g.strokeStyle = 'rgba(178,107,255,0.85)';
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(X, Y, 5.5 + Math.sin(this.t * 3) * 1.2, 0, 6.3);
      g.stroke();
      g.fillStyle = '#b26bff';
      g.beginPath();
      g.arc(X, Y, 2.8, 0, 6.3);
      g.fill();
    }
    for (const a of this.allies) dot(a.pos.x, a.pos.z, '#b26bff', 2);
    for (const e of this.enemies) if (!e.dead) dot(e.pos.x, e.pos.z, e.boss ? '#ff2a2a' : '#ff6a6a', e.boss ? 4.5 : 2.2, e.boss);
    g.restore();
    // player marker
    g.save();
    g.translate(S / 2, S / 2);
    g.rotate(0);
    g.fillStyle = 'rgba(122,208,255,0.25)';
    g.beginPath();
    g.arc(0, 0, 9, 0, 6.3);
    g.fill();
    g.fillStyle = '#dff4ff';
    g.strokeStyle = '#56b4ff';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(0, -7);
    g.lineTo(5, 5);
    g.lineTo(0, 2.4);
    g.lineTo(-5, 5);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }
}
export const game = new Game();
export { STAT_KEYS, setFlash };
if (typeof window !== 'undefined') {
  (window as any).__game = game;
  (window as any).__store = useGame;
  (window as any).__hud = useHud;
}
if (typeof window !== 'undefined') {
  (window as any).__hit = hitEnemy;
  (window as any).__input = input;
}
