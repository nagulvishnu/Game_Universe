import * as THREE from "three";
import {
  DISTRICTS,
  GARAGE_KINDS,
  MISSIONS,
  UPGRADES,
  VEHICLES,
  WEAPONS,
  WEAPON_ORDER,
  blockCenter,
  districtAt,
  roadCenter,
  type Blip,
  type DistrictId,
  type HudState,
  type Mission,
  type UpgradeId,
  type Vec2,
  type VehicleKind,
  type WeaponId,
} from "./data";
import { buildCity, type CityWorld } from "./city";
import {
  buildPed,
  buildPickupMesh,
  buildVehicle,
  buildWeaponMesh,
  getGlowTexture,
  mat,
  type BuiltPed,
  type PickupKind,
} from "./models";
import { GameAudio } from "./audio";

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

type PedKind = "civ" | "cop" | "gang" | "boss";

interface Ped {
  group: THREE.Group;
  limbs: Pick<BuiltPed, "armL" | "armR" | "legL" | "legR">;
  pos: THREE.Vector3;
  heading: number;
  hp: number;
  maxHp: number;
  kind: PedKind;
  state: "idle" | "walk" | "flee" | "hostile" | "dead";
  target: THREE.Vector3;
  timer: number;
  fireCd: number;
  phase: number;
  speed: number;
  marked: boolean;
  deadT: number;
  panicked: number;
  name: string;
  gun: THREE.Group | null;
}

interface Vehicle {
  kind: VehicleKind;
  spec: (typeof VEHICLES)[VehicleKind];
  group: THREE.Group;
  wheels: THREE.Object3D[];
  rotors: THREE.Object3D[];
  policeLights: THREE.Mesh[];
  pos: THREE.Vector3;
  heading: number;
  speed: number;
  health: number;
  maxHealth: number;
  ai: "none" | "traffic" | "chase";
  dir: THREE.Vector3;
  navTo: THREE.Vector3;
  nitro: number;
  pitch: number;
  roll: number;
  vertical: number;
  airborne: boolean;
  occupied: boolean;
  destroyed: boolean;
  deadT: number;
  siren: number;
  boostT: number;
}

interface Projectile {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  damage: number;
  radius: number;
  owner: "player" | "enemy";
  explosive: boolean;
}

interface WorldEffect {
  obj: THREE.Object3D;
  life: number;
  max: number;
  vel?: THREE.Vector3;
  grow?: number;
  light?: THREE.PointLight;
}

interface Pickup {
  kind: PickupKind;
  group: THREE.Group;
  pos: THREE.Vector3;
  active: boolean;
  respawn: number;
  bob: number;
}

interface Crate {
  group: THREE.Group;
  pos: THREE.Vector3;
  active: boolean;
}

interface MissionState {
  mission: Mission;
  step: number;
  enemies: Ped[];
  crates: Crate[];
  timer: number;
  waveTimer: number;
  vehicleHintT: number;
  startedAt: number;
}

interface PlayerState {
  group: THREE.Group;
  limbs: Pick<BuiltPed, "armL" | "armR" | "legL" | "legR">;
  hand: THREE.Group;
  pos: THREE.Vector3;
  heading: number;
  vy: number;
  grounded: boolean;
  health: number;
  armor: number;
  stamina: number;
  inVehicle: Vehicle | null;
  fireCd: number;
  reloading: number;
  dead: boolean;
  phase: number;
  cash: number;
  xp: number;
  level: number;
  skillPoints: number;
  medkits: number;
  wanted: number;
  heatTimer: number;
  starTimer: number;
  wantedReason: string;
  aimT: number;
  weapon: WeaponId;
  ammo: Record<WeaponId, { mag: number; reserve: number }>;
  owned: Partial<Record<UpgradeId, number>>;
  completed: string[];
  kills: number;
  respawnAt: { x: number; z: number };
}

export interface ToastPayload {
  title: string;
  body?: string;
  tone?: "info" | "success" | "danger" | "reward" | "mission";
}

export type GameEventType =
  | "hitmarker"
  | "damage"
  | "kill"
  | "wasted"
  | "wanted"
  | "missionComplete"
  | "levelUp"
  | "quest";

export interface GameEvent {
  type: GameEventType;
  title?: string;
  body?: string;
  value?: number;
}

export interface GameCallbacks {
  onHud: (hud: HudState) => void;
  onToast: (toast: ToastPayload) => void;
  onEvent: (event: GameEvent) => void;
  onEscape?: () => void;
}

export interface GameApi {
  setPaused: (paused: boolean) => void;
  spawnVehicle: (kind: VehicleKind) => void;
  startMission: (id: string) => void;
  abandonMission: () => void;
  fastTravel: (id: DistrictId) => void;
  buyUpgrade: (id: UpgradeId) => void;
  buyAmmo: (weapon: WeaponId) => void;
  useMedkit: () => void;
  respawn: () => void;
  setQuality: (q: "high" | "performance") => void;
  resetProgress: () => void;
  toggleMute: () => void;
  fireDown: () => void;
  fireUp: () => void;
  setVirtualInput: (code: string, down: boolean) => void;
  setMoveAxis: (x: number, y: number) => void;
  selectWeapon: (weapon: WeaponId) => void;
  interact: () => void;
  requestPointerLock: () => void;
  dispose: () => void;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerpAngle = (a: number, b: number, t: number) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * clamp(t, 0, 1);
};
const fwd = (h: number) => new THREE.Vector3(Math.sin(h), 0, Math.cos(h));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pickOne = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const SAVE_KEY = "havoc-city-save-v1";

const PED_NAMES = [
  "Marlow", "Kess", "Dax", "Ivy", "Rook", "Sable", "Nero", "Juno", "Cruz", "Vega",
  "Onyx", "Rue", "Mako", "Kira", "Vex", "Hale", "Tess", "Bram", "Lou", "Ash",
];

const SHIRTS = ["#39424e", "#5b2c38", "#2f4a43", "#4b3f5c", "#5c4a2e", "#243748", "#4d4d4d", "#6b3a2a"];
const PANTS = ["#1d2126", "#22262c", "#2b3038", "#30363f", "#24282e"];
const SKINS = ["#b97a56", "#8d5a3b", "#d9a076", "#6f4730", "#e2b48f", "#a06a4b"];
const TRAFFIC_COLORS = ["#b9c6d2", "#37506b", "#7a2e36", "#c9c3a6", "#2d3a34", "#5a6272", "#8a5a2b", "#e2e6ea"];

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------

export class Game {
  private container: HTMLElement;
  private cb: GameCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private city: CityWorld;
  private colliderBoxes: THREE.Box3[] = [];
  private audio = new GameAudio();
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;
  private paused = false;
  private quality: "high" | "performance" = "high";

  private player: PlayerState;
  private playerRig: BuiltPed;
  private weaponMesh: THREE.Group | null = null;
  private peds: Ped[] = [];
  private vehicles: Vehicle[] = [];
  private pickups: Pickup[] = [];
  private projectiles: Projectile[] = [];
  private effects: WorldEffect[] = [];
  private tracers: { line: THREE.Line; life: number }[] = [];
  private marker: THREE.Group;
  private markerBeam: THREE.Mesh;
  private mission: MissionState | null = null;
  private copSpawnT = 0;
  private copCarT = 0;
  private hudT = 0;
  private saveT = 0;
  private elapsed = 0;
  private frames = 0;
  private gameMinutes = 21 * 60 + 40;
  private fps = 60;
  private muted = false;
  private clockString = "21:40";

  private keys = new Set<string>();
  private virtualMove = { x: 0, y: 0 };
  private trigger = false;
  private firedThisPress = false;
  private cameraYaw = Math.PI * 0.25;
  private cameraPitch = 0.2;
  private zoom = 0;
  private snapCamera = true;
  private dragging = false;
  private lastPointer = { x: 0, y: 0 };
  private pointerLocked = false;
  private lastDragT = -10;
  private shake = 0;
  private hitMarkerT = 0;
  private respawnCooldown = 0;

  constructor(container: HTMLElement, cb: GameCallbacks) {
    this.container = container;
    this.cb = cb;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.touchAction = "none";
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(64, container.clientWidth / Math.max(1, container.clientHeight), 0.3, 2400);
    this.city = buildCity(this.scene);
    this.colliderBoxes = this.city.colliders.map(
      (c) => new THREE.Box3(new THREE.Vector3(c.minX, 0, c.minZ), new THREE.Vector3(c.maxX, c.height, c.maxZ))
    );

    const save = this.loadSave();
    this.playerRig = buildPed({ player: true, skin: "#b97a56", shirt: "#252b22", pants: "#191d21", cap: true, hair: "#161210" });
    this.playerRig.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.scene.add(this.playerRig.group);
    const start = { x: 26, z: -26 };
    this.player = {
      group: this.playerRig.group,
      limbs: this.playerRig,
      hand: this.playerRig.hand,
      pos: new THREE.Vector3(start.x, 0.12, start.z),
      heading: -Math.PI / 4,
      vy: 0,
      grounded: true,
      health: 100,
      armor: 25,
      stamina: 100,
      inVehicle: null,
      fireCd: 0,
      reloading: 0,
      dead: false,
      phase: 0,
      cash: save?.cash ?? 4200,
      xp: save?.xp ?? 0,
      level: save?.level ?? 1,
      skillPoints: save?.skillPoints ?? 1,
      medkits: 2,
      wanted: 0,
      heatTimer: 0,
      starTimer: 0,
      wantedReason: "",
      aimT: 0,
      weapon: "pistol",
      ammo: this.initialAmmo(),
      owned: save?.owned ?? {},
      completed: save?.completed ?? [],
      kills: 0,
      respawnAt: { x: 26, z: -26 },
    };
    if (save?.muted) {
      this.muted = true;
      this.audio.setMuted(true);
    }
    this.player.group.position.copy(this.player.pos);
    this.player.group.rotation.y = this.player.heading;
    this.cameraYaw = -Math.PI / 4;
    this.applyHealthStats();

    // third-person camera must be placed behind the player before the first frame
    const camDir = fwd(this.cameraYaw);
    this.camera.position.set(
      this.player.pos.x - camDir.x * 7.5,
      this.player.pos.y + 3.4,
      this.player.pos.z - camDir.z * 7.5
    );
    this.camera.lookAt(this.player.pos.x, this.player.pos.y + 1.6, this.player.pos.z);
    this.setWeapon("pistol");

    this.marker = this.buildMarker();
    this.scene.add(this.marker);
    this.markerBeam = this.marker.children[0] as THREE.Mesh;
    this.marker.visible = false;

    this.populateWorld();
    this.bindEvents();
    this.audio.init();
    this.audio.engineStart();
    this.loop();
    this.emitHud();
    setTimeout(() => this.cb.onToast({ title: "HAVOC CITY", body: "You made it. Rue is waiting near the Spire — press Tab for missions.", tone: "info" }), 900);
    setTimeout(() => this.cb.onToast({ title: "Welcome, Rookie", body: "WASD move · Mouse look · Left click shoot · E vehicles · G garage", tone: "success" }), 4300);
  }

  // -------------------------------------------------------------------------
  // setup
  // -------------------------------------------------------------------------

  private initialAmmo(): PlayerState["ammo"] {
    const out = {} as PlayerState["ammo"];
    for (const id of WEAPON_ORDER) {
      const w = WEAPONS[id];
      out[id] = { mag: w.mag, reserve: w.reserve === Infinity ? Infinity : Math.floor(w.reserve * 0.45) };
    }
    out.rocket.reserve = 3;
    return out;
  }

  private loadSave():
    | { cash: number; xp: number; level: number; skillPoints: number; owned: Partial<Record<UpgradeId, number>>; completed: string[]; muted?: boolean }
    | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private save() {
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          cash: this.player.cash,
          xp: this.player.xp,
          level: this.player.level,
          skillPoints: this.player.skillPoints,
          owned: this.player.owned,
          completed: this.player.completed,
          muted: this.muted,
        })
      );
    } catch {
      /* storage might be disabled */
    }
  }

  private applyHealthStats() {
    this.player.health = this.maxHealth();
    this.player.armor = 25 + (this.player.owned.armorPlating ?? 0) * 25;
    if (this.player.medkits <= 0) this.player.medkits = 2;
  }

  private maxHealth() {
    return 100 + (this.player.owned.ironSkin ?? 0) * 25;
  }
  private maxArmor() {
    return 50 + (this.player.owned.armorPlating ?? 0) * 25;
  }
  private magSize(w: WeaponId) {
    const base = WEAPONS[w].mag;
    if (!isFinite(base)) return Infinity;
    return Math.round(base * (1 + (this.player.owned.extendedMag ?? 0) * 0.5));
  }
  private damageMult() {
    return (1 + (this.player.owned.gunslinger ?? 0) * 0.12) * (this.buffActive("Overdrive") ? 1.5 : 1);
  }
  private cashMult() {
    return 1 + (this.player.owned.scavenger ?? 0) * 0.2;
  }
  private driveMult() {
    return 1 + (this.player.owned.wheelman ?? 0) * 0.15;
  }
  private buffs: { name: string; seconds: number }[] = [];
  private buffActive(name: string) {
    return this.buffs.some((b) => b.name === name && b.seconds > 0);
  }

  private bindEvents() {
    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("pointerup", this.onWindowPointerUp);
    window.addEventListener("mousemove", this.onWindowMouseMove);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    const c = this.renderer.domElement;
    c.addEventListener("pointerdown", this.onCanvasPointerDown);
    c.addEventListener("pointermove", this.onCanvasPointerMove);
    c.addEventListener("pointerup", this.onCanvasPointerUp);
    c.addEventListener("wheel", this.onWheel, { passive: false });
    c.addEventListener("contextmenu", this.onContextMenu);
  }

  private onCanvasPointerMove = (e: PointerEvent) => {
    if (this.paused || !this.dragging) return;
    const dx = e.clientX - this.lastPointer.x;
    const dy = e.clientY - this.lastPointer.y;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    if (e.pointerType === "touch" || this.dragging) {
      this.cameraYaw -= dx * 0.006;
      this.cameraPitch = clamp(this.cameraPitch + dy * 0.004, -0.06, 1.2);
      this.lastDragT = this.elapsed;
    }
  };

  private onResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };
  private onBlur = () => {
    this.keys.clear();
    this.trigger = false;
  };
  private onContextMenu = (e: Event) => e.preventDefault();
  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
  };
  private onWindowMouseMove = (e: MouseEvent) => {
    if (this.paused) return;
    if (this.pointerLocked) {
      this.cameraYaw -= e.movementX * 0.0026;
      this.cameraPitch = clamp(this.cameraPitch + e.movementY * 0.0022, -0.06, 1.2);
      this.lastDragT = this.elapsed;
    }
  };
  private onCanvasPointerDown = (e: PointerEvent) => {
    if (this.paused) return;
    this.audio.init();
    if (e.pointerType === "mouse" && !this.pointerLocked && e.button === 0) {
      this.requestLock();
    }
    if (e.button === 2 || e.pointerType === "touch") {
      this.dragging = true;
      this.lastPointer = { x: e.clientX, y: e.clientY };
    }
    if (e.pointerType === "mouse" && e.button === 0) {
      this.trigger = true;
      this.firedThisPress = false;
    }
  };
  private onCanvasPointerUp = () => {
    this.trigger = false;
    this.dragging = false;
  };
  private onWindowPointerUp = () => {
    this.trigger = false;
    this.dragging = false;
  };
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.zoom = clamp(this.zoom + e.deltaY * 0.012, -3, 12);
  };
  private onKeyDown = (e: KeyboardEvent) => {
    if (this.paused) return;
    const code = e.code;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(code)) e.preventDefault();
    if (e.repeat) {
      this.keys.add(code);
      return;
    }
    this.keys.add(code);
    if (code === "KeyE") this.interact();
    if (code === "KeyR") this.startReload();
    if (code === "KeyH") this.useMedkit();
    if (code === "KeyQ") this.cycleWeapon();
    if (code === "KeyF" && this.player.inVehicle?.kind === "tank") this.fireTankShell();
    if (/^Digit[1-6]$/.test(code)) {
      const idx = parseInt(code.slice(5), 10);
      this.setWeapon(WEAPON_ORDER[idx - 1]);
    }
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private requestLock() {
    const el = this.renderer.domElement;
    try {
      if (document.pointerLockElement !== el) void el.requestPointerLock?.();
    } catch {
      /* ignore */
    }
  }

  // -------------------------------------------------------------------------
  // world population
  // -------------------------------------------------------------------------

  private populateWorld() {
    const parked: [VehicleKind, number, number, number][] = [
      ["sports", 21, -21, 2.4],
      ["muscle", 26, -6, 0],
      ["suv", -26, 10, Math.PI / 2],
      ["taxi", 78, 10, Math.PI],
      ["police", 130, 78, Math.PI / 2],
      ["bike", 78, 26, 0],
      ["sportbike", 130, -26, Math.PI],
      ["sports", 78, 26, Math.PI / 2],
      ["muscle", 26, 130, 0],
      ["truck", -78, 130, Math.PI / 2],
      ["suv", -130, 130, 0],
      ["truck", 182, 130, Math.PI / 2],
      ["muscle", 182, 78, Math.PI],
      ["heli", 78, -78, 0],
      ["tank", 130, 182, Math.PI / 2],
      ["plane", 166, 186, Math.PI / 2],
      ["suv", -182, -130, 0],
      ["sports", -130, -78, Math.PI / 2],
    ];
    for (const [kind, x, z, heading] of parked) {
      this.createVehicle(kind, x, z, heading, "none");
    }
    // traffic
    for (let i = 0; i < 20; i++) {
      const kx = Math.floor(rand(1, 9));
      const kz = Math.floor(rand(1, 9));
      const x = roadCenter(kx) + rand(-12, 12) * 0;
      const z = roadCenter(kz);
      const axisX = Math.random() > 0.5;
      const dir = axisX ? new THREE.Vector3(Math.random() > 0.5 ? 1 : -1, 0, 0) : new THREE.Vector3(0, 0, Math.random() > 0.5 ? 1 : -1);
      const kind = pickOne<VehicleKind>(["taxi", "suv", "muscle", "sports", "truck", "police"]);
      const v = this.createVehicle(kind, x + (axisX ? 0 : rand(-10, 10)), z + (axisX ? rand(-10, 10) : 0), Math.atan2(dir.x, dir.z), "traffic");
      v.dir.copy(dir);
      v.navTo.set(x + dir.x * 52, 0, z + dir.z * 52);
    }
    // pedestrians
    for (let i = 0; i < 58; i++) {
      const p = this.randomSidewalk();
      this.createPed("civ", p.x, p.z);
    }
    // world pickups
    const kinds: PickupKind[] = ["health", "armor", "cash", "ammo", "nitro", "skill"];
    const spots: Vec2[] = [
      [10, 44], [46, 26], [-30, 18], [72, -70], [120, -40], [160, 20],
      [-80, 150], [-130, 170], [-40, 120], [150, 150], [100, 190], [-150, -150],
      [-180, -100], [-110, -60], [0, 100], [60, 60], [-60, -40], [200, 120],
    ];
    spots.forEach((s, i) => this.createPickup(kinds[i % kinds.length], s[0], s[1]));
  }

  private createVehicle(kind: VehicleKind, x: number, z: number, heading: number, ai: Vehicle["ai"]): Vehicle {
    const spec = VEHICLES[kind];
    const color = ai === "traffic" && kind !== "police" ? pickOne(TRAFFIC_COLORS) : spec.color;
    const built = buildVehicle(kind, color);
    const offsetY = kind === "plane" ? -0.4 : kind === "heli" ? -0.5 : 0.05;
    built.group.position.set(x, offsetY, z);
    built.group.rotation.y = heading;
    built.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    this.scene.add(built.group);
    const v: Vehicle = {
      kind,
      spec,
      group: built.group,
      wheels: built.wheels,
      rotors: built.rotors,
      policeLights: built.policeLights,
      pos: new THREE.Vector3(x, kind === "plane" || kind === "heli" ? 0.0 : 0.05, z),
      heading,
      speed: 0,
      health: spec.health,
      maxHealth: spec.health,
      ai,
      dir: new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading)),
      navTo: new THREE.Vector3(x, 0, z + 52),
      nitro: 100,
      pitch: 0,
      roll: 0,
      vertical: 0,
      airborne: false,
      occupied: false,
      destroyed: false,
      deadT: 0,
      siren: 0,
      boostT: 0,
      offsetY,
    } as Vehicle & { offsetY: number };
    this.vehicles.push(v);
    return v;
  }

  private randomSidewalk(): { x: number; z: number } {
    for (let attempt = 0; attempt < 20; attempt++) {
      const bx = Math.floor(rand(0, 9));
      const bz = Math.floor(rand(0, 9));
      if (bx >= 7 && bz >= 7) continue;
      const side = Math.floor(rand(0, 4));
      const cx = blockCenter(bx);
      const cz = blockCenter(bz);
      const width = rand(-16, 16);
      const point =
        side === 0
          ? { x: cx + width, z: cz - 16.6 }
          : side === 1
          ? { x: cx + width, z: cz + 16.6 }
          : side === 2
          ? { x: cx - 16.6, z: cz + width }
          : { x: cx + 16.6, z: cz + width };
      if (!this.insideBuilding(point.x, point.z, 0.5)) return point;
    }
    return { x: 26, z: 34 };
  }

  private createPed(kind: PedKind, x: number, z: number, marked = false): Ped {
    const cop = kind === "cop";
    const enemy = kind === "gang" || kind === "boss";
    const rig = buildPed({
      shirt: enemy ? "#3d1119" : pickOne(SHIRTS),
      pants: pickOne(PANTS),
      skin: pickOne(SKINS),
      hair: pickOne(["#17110c", "#2b1c12", "#090909", "#5c3a1e"]),
      cop,
      enemy,
      female: Math.random() > 0.55,
    });
    rig.group.position.set(x, 0.1, z);
    rig.group.rotation.y = rand(0, Math.PI * 2);
    if (kind === "boss") rig.group.scale.setScalar(1.12);
    rig.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    this.scene.add(rig.group);
    let gun: THREE.Group | null = null;
    if (cop || enemy) {
      gun = buildWeaponMesh(enemy ? "smg" : "pistol");
      if (gun) {
        gun.scale.setScalar(0.72);
        gun.position.set(0, -0.06, 0.24);
        gun.rotation.x = 0.1;
        rig.hand.add(gun);
      }
      rig.armR.rotation.x = -1.35;
    }
    const p: Ped = {
      group: rig.group,
      limbs: rig,
      pos: new THREE.Vector3(x, 0.1, z),
      heading: rig.group.rotation.y,
      hp: kind === "boss" ? 380 : enemy ? 90 : cop ? 130 : 55,
      maxHp: kind === "boss" ? 380 : enemy ? 90 : cop ? 130 : 55,
      kind,
      state: enemy ? "hostile" : "walk",
      target: new THREE.Vector3(x, 0.1, z),
      timer: rand(1, 5),
      fireCd: rand(0.8, 2.4),
      phase: rand(0, 6),
      speed: rand(1.3, 2.2),
      marked,
      deadT: 0,
      panicked: 0,
      name: pickOne(PED_NAMES),
      gun,
    };
    this.peds.push(p);
    return p;
  }

  private createPickup(kind: PickupKind, x: number, z: number) {
    if (this.insideBuilding(x, z, 1.2)) {
      const spot = this.findOpenSpot(x, z, 5);
      x = spot.x;
      z = spot.z;
    }
    const group = buildPickupMesh(kind);
    group.position.set(x, 1.1, z);
    this.scene.add(group);
    this.pickups.push({ kind, group, pos: new THREE.Vector3(x, 1.1, z), active: true, respawn: 0, bob: rand(0, 6) });
  }

  private buildMarker() {
    const group = new THREE.Group();
    const beamMat = new THREE.MeshBasicMaterial({ color: "#c8ff3d", transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 60, 20, 1, true), beamMat);
    beam.position.y = 30;
    group.add(beam);
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.7, 40), new THREE.MeshBasicMaterial({ color: "#c8ff3d", transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.3;
    group.add(ring);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: "#c8ff3d", transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(8);
    halo.position.y = 1.4;
    group.add(halo);
    return group;
  }

  // -------------------------------------------------------------------------
  // loop
  // -------------------------------------------------------------------------

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const raw = this.clock.getDelta();
    const dt = this.paused ? 0 : Math.min(raw, 0.05);
    if (raw > 0) this.fps = this.fps * 0.94 + (1 / raw) * 0.06;
    if (!this.paused) {
      this.elapsed += dt;
      this.frames++;
      this.gameMinutes = (this.gameMinutes + dt * 0.55) % 1440;
      const mins = Math.floor(this.gameMinutes);
      this.clockString = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
      this.update(dt);
      this.hudT += dt;
      if (this.hudT > 0.11) {
        this.hudT = 0;
        this.emitHud();
      }
      this.saveT += dt;
      if (this.saveT > 20) {
        this.saveT = 0;
        this.save();
      }
    }
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number) {
    if (this.hitMarkerT > 0) this.hitMarkerT -= dt;
    if (this.respawnCooldown > 0) this.respawnCooldown -= dt;
    this.updateBuffs(dt);
    if (!this.player.dead) this.updatePlayer(dt);
    this.updateVehicles(dt);
    this.updatePeds(dt);
    this.updateProjectiles(dt);
    this.updateEffects(dt);
    this.updatePickups(dt);
    this.updateMission(dt);
    this.updateWanted(dt);
    this.updateTrafficCars(dt);
    this.updateMarker(dt);
    this.updateCamera(dt);
    this.cleanup();
    const p = this.player.inVehicle ? this.player.inVehicle.pos : this.player.pos;
    this.city.sun.position.set(p.x + 110, 175, p.z + 80);
    this.city.sun.target.position.set(p.x, 0, p.z);
    this.audio.setEngine(!!this.player.inVehicle && this.player.inVehicle.speed !== 0, this.player.inVehicle?.speed ?? 0, this.player.inVehicle?.kind ?? "car");
  }

  private updateBuffs(dt: number) {
    this.buffs = this.buffs.filter((b) => b.seconds > 0);
    for (const b of this.buffs) b.seconds -= dt;
  }

  // -------------------------------------------------------------------------
  // player on foot
  // -------------------------------------------------------------------------

  private updatePlayer(dt: number) {
    const pl = this.player;
    if (pl.inVehicle) {
      this.updatePlayerVehicle(dt);
      return;
    }
    if (this.respawnCooldown > 0) return;
    const k = this.keys;
    let mf = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
    let mr = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0);
    mf += this.virtualMove.y;
    mr += this.virtualMove.x;
    mf = clamp(mf, -1, 1);
    mr = clamp(mr, -1, 1);
    const moving = Math.abs(mf) + Math.abs(mr) > 0.08;
    const sprint = (k.has("ShiftLeft") || k.has("ShiftRight")) && pl.stamina > 1;
    const weapon = WEAPONS[pl.weapon];
    const aiming = this.trigger || this.keys.has("ShiftRight") || pl.aimT > 0;
    const base = (sprint ? 9.4 : 5.9) * (this.buffActive("Overdrive") ? 1.2 : 1) * (aiming ? 0.55 : 1);
    const forward = fwd(this.cameraYaw);
    const right = new THREE.Vector3(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));
    const move = new THREE.Vector3().addScaledVector(forward, mf).addScaledVector(right, mr);
    if (move.lengthSq() > 1) move.normalize();
    if (moving) {
      pl.pos.addScaledVector(move, base * dt * Math.min(1, move.length()));
      pl.heading = Math.atan2(move.x, move.z);
      pl.phase += dt * (sprint ? 13 : 9);
    } else {
      pl.phase += dt * 1.4;
    }
    if (aiming) pl.heading = this.cameraYaw;
    if ((k.has("Space") || this.keys.has("Space")) && pl.grounded) {
      pl.vy = 7.2;
      pl.grounded = false;
    }
    pl.vy -= 21 * dt;
    pl.pos.y += pl.vy * dt;
    if (pl.pos.y <= 0.12) {
      pl.pos.y = 0.12;
      pl.vy = 0;
      pl.grounded = true;
    }
    this.resolveCollision(pl.pos, 0.48);
    pl.pos.x = clamp(pl.pos.x, -240, 240);
    pl.pos.z = clamp(pl.pos.z, -240, 240);
    if (sprint && moving) pl.stamina = clamp(pl.stamina - dt * 16, 0, 100);
    else pl.stamina = clamp(pl.stamina + dt * 12, 0, 100);
    pl.group.position.copy(pl.pos);
    pl.group.rotation.y = pl.heading;
    const swing = moving ? Math.sin(pl.phase) * (sprint ? 0.85 : 0.55) : Math.sin(pl.phase * 0.6) * 0.04;
    pl.limbs.legL.rotation.x = swing;
    pl.limbs.legR.rotation.x = -swing;
    if (weapon.id === "fists" || !aiming) {
      pl.limbs.armL.rotation.x = -swing * 0.8;
      pl.limbs.armR.rotation.x = swing * 0.8;
    } else {
      pl.limbs.armL.rotation.x = -0.5;
      pl.limbs.armR.rotation.x = -1.45;
    }
    if (this.trigger) {
      pl.aimT = 0.6;
      if (pl.fireCd <= 0 && (!this.firedThisPress || weapon.auto)) {
        this.fireWeapon();
        this.firedThisPress = true;
      }
    }
    pl.aimT = Math.max(0, pl.aimT - dt);
    pl.fireCd -= dt;
    if (pl.reloading > 0) {
      pl.reloading -= dt;
      if (pl.reloading <= 0) this.finishReload();
    }
  }

  private updatePlayerVehicle(dt: number) {
    const v = this.player.inVehicle!;
    const k = this.keys;
    const spec = v.spec;
    const isAircraft = spec.cls === "Aircraft";
    const isHeli = v.kind === "heli";
    const isPlane = v.kind === "plane";
    v.occupied = true;
    const throttle = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0) + this.virtualMove.y;
    const steer = (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0) - (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - this.virtualMove.x;
    const handbrake = k.has("Space") && !isAircraft;
    const nitroKey = k.has("ShiftLeft") || k.has("ShiftRight");
    const nitroActive = nitroKey && v.nitro > 0 && !isAircraft;
    if (nitroActive) {
      v.nitro = Math.max(0, v.nitro - dt * 30);
      v.boostT = 0.25;
    } else {
      v.nitro = Math.min(100, v.nitro + dt * 7);
    }
    let maxSpeed = spec.maxSpeed * this.driveMult() * (nitroActive ? 1.5 : 1);
    if (isPlane) maxSpeed = spec.maxSpeed;
    const accel = spec.accel * (isPlane || isHeli ? 1 : this.driveMult());
    if (isPlane) {
      v.speed += throttle * accel * dt;
      v.speed -= (1 - Math.abs(throttle)) * 4.5 * dt;
      v.speed = clamp(v.speed, 0, maxSpeed);
      if (!v.airborne && v.speed > 24) {
        v.airborne = true;
        v.pitch = 0.26;
        this.cb.onToast({ title: "Wheels up", body: "Space / Ctrl to pitch · A-D to bank · W to throttle", tone: "info" });
        this.audio.setEngine(true, v.speed, "plane");
      }
      if (v.airborne) {
        if (k.has("Space")) v.pitch = clamp(v.pitch + dt * 0.65, -0.7, 0.7);
        else if (k.has("ControlLeft") || k.has("KeyC")) v.pitch = clamp(v.pitch - dt * 0.65, -0.7, 0.7);
        else v.pitch *= 1 - dt * 0.35;
        v.roll = lerpAngle(v.roll, steer * 0.42, dt * 4);
        v.heading += steer * dt * 1.05;
        v.pos.y += Math.sin(v.pitch) * v.speed * dt;
        if (v.pos.y < 1.2) {
          v.pos.y = 1.2;
          if (v.speed > 26) v.pitch = Math.max(v.pitch, 0.16);
          else {
            v.airborne = false;
            v.pitch = 0;
          }
        }
        v.pos.y = Math.min(v.pos.y, 180);
      } else {
        v.heading += steer * dt * 1.4 * clamp(v.speed / 20, 0, 1);
      }
      const f = fwd(v.heading);
      v.pos.x += f.x * v.speed * dt;
      v.pos.z += f.z * v.speed * dt;
    } else if (isHeli) {
      if (throttle !== 0) v.speed = clamp(v.speed + throttle * accel * 0.6 * dt, -spec.maxSpeed * 0.45, maxSpeed);
      else v.speed *= 1 - 1.6 * dt;
      v.heading += -steer * dt * 1.35;
      const ascend = (k.has("Space") ? 1 : 0) - (k.has("ControlLeft") || k.has("KeyC") ? 1 : 0);
      v.vertical += ascend * 24 * dt;
      v.vertical *= 1 - 2.2 * dt;
      v.pos.y = clamp(v.pos.y + v.vertical * dt + (ascend > 0 ? 5 * dt : 0), 1.0, 170);
      if (v.pos.y <= 1.01) v.vertical = Math.max(0, v.vertical);
      v.pitch = lerpAngle(v.pitch, -v.speed * 0.006 + ascend * 0.04, dt * 2);
      v.roll = lerpAngle(v.roll, steer * 0.12, dt * 3);
      const f = fwd(v.heading);
      v.pos.x += f.x * v.speed * dt;
      v.pos.z += f.z * v.speed * dt;
    } else {
      v.speed += throttle * accel * dt;
      if (handbrake) v.speed *= 1 - 4.2 * dt;
      if (throttle === 0) v.speed *= 1 - 1.15 * dt;
      v.speed = clamp(v.speed, -maxSpeed * 0.32, maxSpeed);
      const turn = steer * spec.handling * this.driveMult() * dt * clamp(Math.abs(v.speed) / 13, 0.15, 1);
      v.heading += turn * (v.speed < -0.4 ? -1 : 1);
      const f = fwd(v.heading);
      v.pos.addScaledVector(f, v.speed * dt);
      v.pitch = lerpAngle(v.pitch, -v.speed * 0.001, dt * 3);
      const hit = this.resolveCollision(v.pos, spec.kind === "truck" || spec.kind === "tank" ? 1.8 : 1.25);
      if (hit && Math.abs(v.speed) > 0.4) {
        const impact = Math.abs(v.speed);
        if (impact > 8) {
          this.damageVehicle(v, impact * 2.2);
          this.audio.crash();
          this.shake = Math.max(this.shake, Math.min(0.35, impact * 0.008));
          if (this.player.inVehicle === v) this.damagePlayer(Math.min(18, impact * 0.35), "crash");
        }
        v.speed *= -0.22;
      }
      // run over pedestrians
      for (const p of this.peds) {
        if (p.state === "dead") continue;
        const d = Math.hypot(p.pos.x - v.pos.x, p.pos.z - v.pos.z);
        if (d < 2.1 && Math.abs(v.speed) > 5) {
          this.hurtPed(p, 200, false);
          this.damageVehicle(v, 12);
          this.shake = Math.max(this.shake, 0.18);
          this.audio.hit();
        }
      }
    }
    v.pos.x = clamp(v.pos.x, -244, 244);
    v.pos.z = clamp(v.pos.z, -244, 244);
    if (!isAircraft || v.pos.y < 6) this.resolveCollision(v.pos, isPlane ? 2.6 : 1.4);
    this.syncVehicle(v);
    this.player.pos.copy(v.pos);
    this.player.pos.y = v.pos.y + 0.1;
    const pl = this.player;
    if (this.trigger && pl.fireCd <= 0 && (!this.firedThisPress || WEAPONS[pl.weapon].auto)) {
      this.fireWeapon();
      this.firedThisPress = true;
    }
    pl.fireCd -= dt;
    pl.aimT = Math.max(0, pl.aimT - dt);
    if (pl.reloading > 0) {
      pl.reloading -= dt;
      if (pl.reloading <= 0) this.finishReload();
    }
    if ((this.keys.has("KeyE") || false) && v.pos.y < 4) {
      /* handled by interact */
    }
  }

  // -------------------------------------------------------------------------
  // vehicles (AI + sync)
  // -------------------------------------------------------------------------

  private syncVehicle(v: Vehicle) {
    const extra = (v as Vehicle & { offsetY?: number }).offsetY ?? 0;
    v.group.position.set(v.pos.x, v.pos.y + extra, v.pos.z);
    v.group.rotation.y = v.heading;
    if (v.kind === "plane" || v.kind === "heli") {
      v.group.rotation.x = -v.pitch;
      v.group.rotation.z = -v.roll;
    }
    for (const w of v.wheels) w.rotation.x += v.speed * 0.016;
    for (const r of v.rotors) r.rotation.y += (v.kind === "heli" ? 24 : 38) * 0.016;
    if (v.policeLights.length) {
      v.siren += 0.016;
      const on = Math.floor(v.siren * 7) % 2 === 0;
      v.policeLights[0].visible = on;
      if (v.policeLights[1]) v.policeLights[1].visible = !on;
    }
  }

  private resolveCollision(pos: THREE.Vector3, radius: number): boolean {
    let hit = false;
    for (const c of this.city.colliders) {
      if (pos.y > c.height + 0.5) continue;
      const nx = clamp(pos.x, c.minX, c.maxX);
      const nz = clamp(pos.z, c.minZ, c.maxZ);
      const dx = pos.x - nx;
      const dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        const d = Math.sqrt(d2);
        if (d < 0.0001) {
          pos.x = c.maxX + radius;
        } else {
          const push = radius - d;
          pos.x += (dx / d) * push;
          pos.z += (dz / d) * push;
        }
        hit = true;
      }
    }
    return hit;
  }

  private insideBuilding(x: number, z: number, pad = 0) {
    for (const c of this.city.colliders) {
      if (x > c.minX - pad && x < c.maxX + pad && z > c.minZ - pad && z < c.maxZ + pad) return true;
    }
    return false;
  }

  private updateVehicles(dt: number) {
    for (const v of this.vehicles) {
      if (v.destroyed) {
        v.deadT += dt;
        if (v.deadT > 8) v.group.visible = false;
        continue;
      }
      if (this.player.inVehicle === v) continue;
      const pd = v.pos.distanceTo(this.player.pos);
      v.group.visible = pd < 150;
      if (v.ai === "chase") {
        this.updateChaseCar(v, dt);
        this.syncVehicle(v);
      } else if (v.ai === "none" && v.speed !== 0) {
        // free-rolling vehicle after impact
        v.speed *= 1 - 1.4 * dt;
        v.pos.addScaledVector(fwd(v.heading), v.speed * dt);
        this.resolveCollision(v.pos, 1.2);
        this.syncVehicle(v);
      }
    }
    // player vehicle collision with traffic
    const pv = this.player.inVehicle;
    if (pv && !pv.destroyed) {
      for (const v of this.vehicles) {
        if (v === pv || v.destroyed) continue;
        const d = Math.hypot(v.pos.x - pv.pos.x, v.pos.z - pv.pos.z);
        if (d < 3.2 && Math.abs(pv.speed) > 3) {
          const push = (3.2 - d) / 2;
          const dx = (v.pos.x - pv.pos.x) / (d || 1);
          const dz = (v.pos.z - pv.pos.z) / (d || 1);
          v.pos.x += dx * push;
          v.pos.z += dz * push;
          pv.pos.x -= dx * push;
          pv.pos.z -= dz * push;
          v.speed += pv.speed * 0.35;
          pv.speed *= 0.72;
          this.damageVehicle(v, Math.abs(pv.speed) * 1.5);
          this.damageVehicle(pv, Math.abs(pv.speed) * 0.9);
          this.audio.crash();
          this.shake = Math.max(this.shake, 0.22);
          this.syncVehicle(v);
        }
      }
    }
  }

  private updateTrafficCars(dt: number) {
    for (const v of this.vehicles) {
      if (v.ai !== "traffic" || v.destroyed) continue;
      const target = v.navTo;
      const dx = target.x - v.pos.x;
      const dz = target.z - v.pos.z;
      const dist = Math.hypot(dx, dz);
      const desired = Math.atan2(dx, dz);
      v.heading = lerpAngle(v.heading, desired, dt * 1.6);
      const targetSpeed = dist < 6 ? 5 : v.kind === "truck" ? 8 : 11;
      v.speed += clamp(targetSpeed - v.speed, -8 * dt, 6 * dt);
      v.pos.addScaledVector(fwd(v.heading), v.speed * dt);
      v.pos.x = clamp(v.pos.x, -236, 236);
      v.pos.z = clamp(v.pos.z, -236, 236);
      if (dist < 5) {
        const kx = Math.round((v.pos.x + 234) / 52);
        const kz = Math.round((v.pos.z + 234) / 52);
        let options = [
          { x: 1, z: 0 },
          { x: -1, z: 0 },
          { x: 0, z: 1 },
          { x: 0, z: -1 },
        ].filter((o) => !(o.x === -Math.sign(v.dir.x) && o.z === -Math.sign(v.dir.z) && (o.x !== 0 || o.z !== 0)));
        if (RND_TRAFFIC() < 0.55) {
          options = options.filter((o) => o.x === Math.sign(v.dir.x) && o.z === Math.sign(v.dir.z));
          if (!options.length) options = [{ x: 1, z: 0 }];
        }
        const dir = pickOne(options);
        v.dir.set(dir.x, 0, dir.z);
        const nx = clamp(kx + dir.x, 0, 9);
        const nz = clamp(kz + dir.z, 0, 9);
        v.navTo.set(roadCenter(nx) + (dir.x === 0 ? (Math.random() > 0.5 ? 3 : -3) : 0), 0, roadCenter(nz) + (dir.z === 0 ? (Math.random() > 0.5 ? 3 : -3) : 0));
      }
      this.syncVehicle(v);
      // avoid player collision
      const dpx = v.pos.x - this.player.pos.x;
      const dpz = v.pos.z - this.player.pos.z;
      if (!this.player.inVehicle && Math.hypot(dpx, dpz) < 2.4) {
        this.player.pos.x += (dpx / (Math.hypot(dpx, dpz) || 1)) * 2.2;
        this.player.pos.z += (dpz / (Math.hypot(dpx, dpz) || 1)) * 2.2;
      }
    }
  }

  private updateChaseCar(v: Vehicle, dt: number) {
    const p = this.player.inVehicle ? this.player.inVehicle.pos : this.player.pos;
    const distance = Math.hypot(p.x - v.pos.x, p.z - v.pos.z);
    const desired = Math.atan2(p.x - v.pos.x, p.z - v.pos.z);
    v.heading = lerpAngle(v.heading, desired, dt * 2.2);
    const targetSpeed = distance > 14 ? v.spec.maxSpeed * 0.62 : distance > 8 ? 6 : 0;
    v.speed += clamp(targetSpeed - v.speed, -14 * dt, 8 * dt);
    v.pos.addScaledVector(fwd(v.heading), v.speed * dt);
    v.pos.x = clamp(v.pos.x, -240, 240);
    v.pos.z = clamp(v.pos.z, -240, 240);
    v.siren += dt;
    // ram the player on foot
    if (!this.player.inVehicle && distance < 2.6 && v.speed > 4) {
      this.damagePlayer(16, "police car");
      v.speed *= -0.4;
    }
  }

  private damageVehicle(v: Vehicle, amt: number) {
    if (v.destroyed) return;
    v.health -= amt;
    if (v.ai === "traffic" && v.health < v.maxHealth) {
      v.ai = "none";
      v.speed *= 0.4;
    }
    if (v.health <= 0) this.explodeVehicle(v);
  }

  private explodeVehicle(v: Vehicle) {
    if (v.destroyed) return;
    v.destroyed = true;
    v.health = 0;
    v.deadT = 0;
    this.explode(v.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 8, 90, "player");
    v.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          if ("color" in m) (m as THREE.MeshStandardMaterial).color = new THREE.Color("#191512");
        });
      }
    });
    if (v === this.player.inVehicle) {
      this.exitVehicle(true);
      this.damagePlayer(55, "exploding vehicle");
    }
  }

  // -------------------------------------------------------------------------
  // pedestrians
  // -------------------------------------------------------------------------

  private updatePeds(dt: number) {
    const playerPos = this.player.inVehicle ? this.player.inVehicle.pos : this.player.pos;
    for (const p of this.peds) {
      if (p.state === "dead") {
        p.deadT += dt;
        p.group.visible = p.pos.distanceTo(playerPos) < 80;
        p.group.rotation.x = lerpAngle(p.group.rotation.x, -Math.PI / 2, dt * 5);
        p.group.position.y = Math.max(0.2, p.group.position.y - dt * 0.2);
        if (p.deadT > 9) p.group.visible = false;
        continue;
      }
      const dx = playerPos.x - p.pos.x;
      const dz = playerPos.z - p.pos.z;
      const dist = Math.hypot(dx, dz);
      const hostile = p.kind === "gang" || p.kind === "boss" || (p.kind === "cop" && this.player.wanted > 0) || p.state === "hostile";
      if (hostile) {
        p.state = "hostile";
        const desired = Math.atan2(dx, dz);
        p.heading = lerpAngle(p.heading, desired, dt * 5);
        if (dist > 13) {
          p.pos.x += Math.sin(p.heading) * 3.7 * dt;
          p.pos.z += Math.cos(p.heading) * 3.7 * dt;
          p.phase += dt * 8;
          this.resolveCollision(p.pos, 0.42);
        } else if (dist < 5) {
          p.pos.x -= Math.sin(p.heading) * 1.6 * dt;
          p.pos.z -= Math.cos(p.heading) * 1.6 * dt;
          p.phase += dt * 4;
        }
        p.fireCd -= dt;
        if (p.fireCd <= 0 && dist < 34 && !this.player.dead) {
          p.fireCd = p.kind === "boss" ? rand(0.45, 0.85) : rand(1.1, 2.1);
          if (!this.lineBlocked(p.pos, playerPos)) this.enemyShoot(p, dist);
        }
        if (p.gun) p.limbs.armR.rotation.x = -1.45;
      } else if (p.panicked > 0) {
        p.panicked -= dt;
        p.state = "flee";
        const away = Math.atan2(-dx, -dz);
        p.heading = lerpAngle(p.heading, away, dt * 4);
        p.pos.x += Math.sin(p.heading) * 6.2 * dt;
        p.pos.z += Math.cos(p.heading) * 6.2 * dt;
        p.phase += dt * 14;
        this.resolveCollision(p.pos, 0.4);
        if (p.panicked <= 0) p.state = "walk";
      } else {
        p.state = "walk";
        p.timer -= dt;
        const tdx = p.target.x - p.pos.x;
        const tdz = p.target.z - p.pos.z;
        const td = Math.hypot(tdx, tdz);
        if (td < 1.2 || p.timer < 0) {
          const pt = this.randomSidewalk();
          p.target.set(pt.x, 0.1, pt.z);
          p.timer = rand(5, 14);
          p.state = "idle";
        }
        if (p.state === "walk" && td > 0.4) {
          p.heading = lerpAngle(p.heading, Math.atan2(tdx, tdz), dt * 3);
          p.pos.x += Math.sin(p.heading) * p.speed * dt;
          p.pos.z += Math.cos(p.heading) * p.speed * dt;
          p.phase += dt * 5.5;
          this.resolveCollision(p.pos, 0.4);
        }
        if (p.state === "idle" && td > 3) p.state = "walk";
      }
      p.pos.x = clamp(p.pos.x, -238, 238);
      p.pos.z = clamp(p.pos.z, -238, 238);
      p.group.position.set(p.pos.x, 0.1, p.pos.z);
      p.group.visible = dist < 105 || p.marked;
      p.group.rotation.y = p.heading;
      const swing = Math.sin(p.phase) * (p.state === "flee" || hostile ? 0.8 : 0.45);
      p.limbs.legL.rotation.x = swing;
      p.limbs.legR.rotation.x = -swing;
      if (!p.gun) {
        p.limbs.armL.rotation.x = -swing * 0.8;
        p.limbs.armR.rotation.x = swing * 0.8;
      }
    }
  }

  private enemyShoot(p: Ped, dist: number) {
    const origin = p.pos.clone().add(new THREE.Vector3(0, 1.35, 0));
    const target = (this.player.inVehicle ? this.player.inVehicle.pos.clone().add(new THREE.Vector3(0, 1, 0)) : this.player.pos.clone().add(new THREE.Vector3(0, 1.1, 0)));
    const accuracy = clamp(0.82 - dist * 0.017, 0.22, 0.8) * (p.kind === "boss" ? 1.2 : 1);
    const hit = Math.random() < accuracy;
    if (!hit) {
      target.x += rand(-2.4, 2.4);
      target.z += rand(-2.4, 2.4);
      target.y += rand(-0.6, 0.9);
    }
    this.spawnTracer(origin, target, "#ff5a3d");
    this.audio.shot("pistol");
    this.muzzleFlash(origin, "#ffb347", 1.2);
    if (hit) {
      const dmg = p.kind === "boss" ? rand(10, 17) : rand(5, 11);
      this.damagePlayer(dmg, p.kind === "cop" ? "HCPD" : "hostile gunfire");
    }
    // alert nearby civilians
    for (const other of this.peds) {
      if (other.kind === "civ" && Math.hypot(other.pos.x - p.pos.x, other.pos.z - p.pos.z) < 20) other.panicked = rand(5, 10);
    }
  }

  private hurtPed(p: Ped, amount: number, headshot: boolean) {
    if (p.state === "dead") return;
    p.hp -= amount * (headshot ? 2 : 1);
    const blood = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), new THREE.MeshBasicMaterial({ color: "#9b0f1a" }));
    blood.position.copy(p.pos).add(new THREE.Vector3(0, headshot ? 1.8 : 1.1, 0));
    this.scene.add(blood);
    this.effects.push({ obj: blood, life: 0.45, max: 0.45, vel: new THREE.Vector3(rand(-2, 2), rand(1, 3), rand(-2, 2)), grow: 1.5 });
    if (p.kind === "civ") p.panicked = 10;
    if (p.hp <= 0) {
      p.state = "dead";
      p.deadT = 0;
      p.gun && (p.gun.visible = false);
      this.hitMarkerT = 0.14;
      const reward = p.kind === "boss" ? 2500 : p.kind === "gang" ? 180 : p.kind === "cop" ? 120 : 0;
      if (p.kind !== "civ") {
        this.player.kills++;
        this.addXp(p.kind === "boss" ? 500 : p.kind === "gang" ? 55 : 35, false);
        if (reward > 0) this.awardCash(reward);
        this.cb.onEvent({ type: "kill", title: p.kind === "boss" ? "KINGPIN DOWN" : "TARGET DOWN", body: reward > 0 ? `+$${reward}` : undefined, value: reward });
      }
      if (p.kind === "cop") this.increaseWanted(2, "cop killer");
      if (p.kind === "civ") this.increaseWanted(1, "civilian casualties");
      if (this.mission) {
        const idx = this.mission.enemies.indexOf(p);
        if (idx >= 0) this.emitHud();
      }
      this.audio.hit();
    }
  }

  // -------------------------------------------------------------------------
  // combat
  // -------------------------------------------------------------------------

  private setWeapon(w: WeaponId) {
    this.player.weapon = w;
    if (this.weaponMesh) {
      this.player.hand.remove(this.weaponMesh);
      this.weaponMesh = null;
    }
    this.weaponMesh = buildWeaponMesh(w);
    if (this.weaponMesh) {
      this.weaponMesh.scale.setScalar(0.7);
      this.weaponMesh.position.set(0, -0.05, 0.24);
      this.weaponMesh.rotation.x = 0.06;
      this.player.hand.add(this.weaponMesh);
    }
    this.audio.ui();
  }

  private cycleWeapon() {
    const idx = WEAPON_ORDER.indexOf(this.player.weapon);
    this.setWeapon(WEAPON_ORDER[(idx + 1) % WEAPON_ORDER.length]);
  }

  private cameraRay(): { origin: THREE.Vector3; dir: THREE.Vector3 } {
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    // gentle aim assist
    let best: Ped | null = null;
    let bestDot = 0.988;
    const pv = this.player.inVehicle ? null : this.player.pos;
    for (const p of this.peds) {
      if (p.state === "dead") continue;
      if (p.kind === "civ" && !this.player.wanted) continue;
      const pos = p.pos.clone().add(new THREE.Vector3(0, 1.1, 0));
      const to = pos.sub(origin);
      const d = to.length();
      if (d > 75) continue;
      to.normalize();
      const dot = to.dot(dir);
      if (dot > bestDot) {
        bestDot = dot;
        best = p;
      }
    }
    if (best) {
      const target = best.pos.clone().add(new THREE.Vector3(0, 1.15, 0));
      const nudge = target.sub(origin).normalize();
      dir.lerp(nudge, 0.72).normalize();
    }
    void pv;
    return { origin, dir };
  }

  private fireWeapon() {
    const w = WEAPONS[this.player.weapon];
    if (this.player.inVehicle?.kind === "tank") {
      this.fireTankShell();
      return;
    }
    const ammo = this.player.ammo[this.player.weapon];
    if (w.mag !== Infinity && ammo.mag <= 0) {
      this.audio.empty();
      this.startReload();
      return;
    }
    if (w.mag !== Infinity) ammo.mag--;
    this.player.fireCd = w.fireRate;
    this.audio.shot(this.player.weapon);
    this.shake = Math.max(this.shake, w.damage > 100 ? 0.4 : 0.07);
    if (this.player.weapon === "fists") {
      const origin = this.camera.position.clone();
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      const target = origin.clone().addScaledVector(dir, 2.4);
      this.spawnTracer(target.clone().addScaledVector(dir, -2), target, "#ffffff");
      for (const p of this.peds) {
        if (p.state === "dead") continue;
        if (p.pos.distanceTo(this.player.pos) < 2.8) {
          const to = p.pos.clone().add(new THREE.Vector3(0, 1.1, 0)).sub(origin).normalize();
          if (to.dot(dir) > 0.7) this.hurtPed(p, w.damage * this.damageMult(), false);
        }
      }
      return;
    }
    const { origin, dir } = this.cameraRay();
    const hit = this.raycast(origin, dir, w.range);
    const end = hit ? hit.point : origin.clone().addScaledVector(dir, w.range);
    const muzzle = this.player.inVehicle
      ? this.player.inVehicle.pos.clone().add(new THREE.Vector3(0, 1.2, 0))
      : this.player.pos.clone().add(new THREE.Vector3(0, 1.5, 0)).addScaledVector(dir, 0.7);
    this.muzzleFlash(muzzle, w.color, 1.6);
    for (let i = 0; i < Math.min(w.pellets, 4); i++) {
      const d = dir.clone();
      if (w.spread) {
        d.x += rand(-w.spread, w.spread);
        d.y += rand(-w.spread, w.spread);
        d.z += rand(-w.spread, w.spread);
        d.normalize();
      }
      const single = i === 0 ? hit : this.raycast(origin, d, w.range);
      const point = single ? single.point : end;
      this.spawnTracer(muzzle, point, w.color);
      if (single?.ped) {
        this.hurtPed(single.ped, w.damage * this.damageMult(), !!single.head);
        this.hitMarkerT = 0.1;
      } else if (single?.vehicle) {
        this.damageVehicle(single.vehicle, w.damage * this.damageMult() * 1.7);
        this.spark(point, "#ffd27a");
        if (single.vehicle.ai !== "none") this.increaseWanted(1, "shots fired");
      } else if (single) {
        this.spark(point, "#ffd27a");
      }
    }
    if (w.explosive) this.launchProjectile(origin.clone().addScaledVector(dir, 1.2), dir, "player");
    if (ammo.mag <= 0) this.startReload();
  }

  private fireTankShell() {
    if (this.player.inVehicle?.kind !== "tank") return;
    const { dir } = this.cameraRay();
    const start = this.player.inVehicle.pos.clone().add(new THREE.Vector3(0, 2.2, 0)).addScaledVector(dir, 3.5);
    this.launchProjectile(start, dir, "player", 320, 8.5);
    this.audio.explosion();
    this.shake = 0.55;
  }

  private launchProjectile(origin: THREE.Vector3, dir: THREE.Vector3, owner: "player" | "enemy", damage = 240, radius = 7) {
    const g = new THREE.Group();
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat("#ffd23d", { emissive: "#ff9d00", emissiveIntensity: 2.5 }));
    g.add(orb);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: "#ffb347", transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(1.7);
    g.add(halo);
    g.position.copy(origin);
    this.scene.add(g);
    this.projectiles.push({
      mesh: g,
      pos: origin.clone(),
      vel: dir.clone().multiplyScalar(85),
      life: 3,
      damage,
      radius,
      owner,
      explosive: true,
    });
  }

  private raycast(origin: THREE.Vector3, dir: THREE.Vector3, range: number) {
    const ray = new THREE.Ray(origin, dir);
    let nearest = range;
    let result: { point: THREE.Vector3; ped?: Ped; vehicle?: Vehicle; head?: boolean } | null = null;
    for (const box of this.colliderBoxes) {
      const p = ray.intersectBox(box, new THREE.Vector3());
      if (p) {
        const d = p.distanceTo(origin);
        if (d < nearest) {
          nearest = d;
          result = { point: p };
        }
      }
    }
    // ground
    if (dir.y < -0.001) {
      const t = -origin.y / dir.y;
      if (t > 0 && t < nearest) {
        nearest = t;
        result = { point: origin.clone().addScaledVector(dir, t) };
      }
    }
    for (const p of this.peds) {
      if (p.state === "dead") continue;
      const body = new THREE.Box3(
        new THREE.Vector3(p.pos.x - 0.38, p.pos.y + 0.35, p.pos.z - 0.34),
        new THREE.Vector3(p.pos.x + 0.38, p.pos.y + 1.72, p.pos.z + 0.34)
      );
      const hitPoint = ray.intersectBox(body, new THREE.Vector3());
      if (hitPoint) {
        const d = hitPoint.distanceTo(origin);
        if (d < nearest) {
          nearest = d;
          result = { point: hitPoint, ped: p };
        }
      }
      const head = new THREE.Sphere(p.pos.clone().add(new THREE.Vector3(0, 1.86, 0)), 0.24);
      const hp = ray.intersectSphere(head, new THREE.Vector3());
      if (hp) {
        const d = hp.distanceTo(origin);
        if (d < nearest) {
          nearest = d;
          result = { point: hp, ped: p, head: true };
        }
      }
    }
    for (const v of this.vehicles) {
      if (v.destroyed) continue;
      const center = v.pos.clone().add(new THREE.Vector3(0, 0.9, 0));
      const sphere = new THREE.Sphere(center, v.kind === "truck" || v.kind === "tank" ? 2.4 : 1.6);
      const hp = ray.intersectSphere(sphere, new THREE.Vector3());
      if (hp) {
        const d = hp.distanceTo(origin);
        if (d < nearest) {
          nearest = d;
          result = { point: hp, vehicle: v };
        }
      }
    }
    return result;
  }

  private lineBlocked(from: THREE.Vector3, to: THREE.Vector3) {
    const origin = from.clone().add(new THREE.Vector3(0, 1.3, 0));
    const end = to.clone().add(new THREE.Vector3(0, 1.1, 0));
    const dir = end.clone().sub(origin);
    const dist = dir.length();
    dir.normalize();
    const ray = new THREE.Ray(origin, dir);
    for (const box of this.colliderBoxes) {
      const p = ray.intersectBox(box, new THREE.Vector3());
      if (p && p.distanceTo(origin) < dist) return true;
    }
    return false;
  }

  private damagePlayer(amount: number, reason: string) {
    if (this.player.dead) return;
    const pl = this.player;
    let dmg = amount;
    if (pl.armor > 0) {
      const absorbed = Math.min(pl.armor, dmg * 0.7);
      pl.armor -= absorbed;
      dmg -= absorbed;
    }
    if (this.buffActive("Shield")) dmg *= 0.4;
    pl.health -= dmg;
    this.shake = Math.max(this.shake, 0.12);
    this.cb.onEvent({ type: "damage", value: dmg });
    if (pl.health <= 0) {
      pl.health = 0;
      this.die(reason);
    }
  }

  private die(reason: string) {
    if (this.player.dead) return;
    this.player.dead = true;
    this.trigger = false;
    this.cb.onEvent({ type: "wasted", title: "WASTED", body: reason });
    this.audio.explosion();
    if (this.player.inVehicle) this.exitVehicle(true);
    if (this.mission) this.cb.onToast({ title: "Contract failed", body: `${this.mission.mission.title} — you were wasted.`, tone: "danger" });
    this.clearMissionEntities();
    this.mission = null;
    this.emitHud();
  }

  private increaseWanted(n: number, reason: string) {
    if (this.player.dead) return;
    const prev = this.player.wanted;
    this.player.wanted = Math.min(5, this.player.wanted + n);
    this.player.wantedReason = reason;
    this.player.heatTimer = 26;
    this.player.starTimer = 9;
    if (this.player.wanted > prev) {
      this.cb.onEvent({ type: "wanted", title: "WANTED", body: reason.toUpperCase() });
      this.audio.wanted();
    }
  }

  // -------------------------------------------------------------------------
  // wanted & cops
  // -------------------------------------------------------------------------

  private updateWanted(dt: number) {
    const pl = this.player;
    if (pl.wanted > 0) {
      pl.heatTimer -= dt;
      if (pl.heatTimer <= 0) {
        pl.starTimer -= dt;
        if (pl.starTimer <= 0) {
          pl.wanted--;
          pl.starTimer = 10;
          if (pl.wanted === 0) {
            pl.wantedReason = "";
            this.cb.onToast({ title: "Heat cleared", body: "Dispatch has lost interest. For now.", tone: "success" });
            for (const v of this.vehicles) {
              if (v.ai !== "chase") continue;
              v.ai = "traffic";
              const kx = clamp(Math.round((v.pos.x + 234) / 52), 0, 9);
              const kz = clamp(Math.round((v.pos.z + 234) / 52), 0, 9);
              v.navTo.set(roadCenter(clamp(kx + 1, 0, 9)), 0, roadCenter(kz));
            }
          }
        }
      }
      this.copSpawnT -= dt;
      const cops = this.peds.filter((p) => p.kind === "cop" && p.state !== "dead").length;
      if (this.copSpawnT <= 0 && cops < 2 + pl.wanted * 2) {
        this.copSpawnT = Math.max(1.6, 5 - pl.wanted * 0.6);
        const point = this.randomSpawnNearPlayer(28, 60);
        this.createPed("cop", point.x, point.z);
      }
      if (pl.wanted >= 2) {
        this.copCarT -= dt;
        const chaseCars = this.vehicles.filter((v) => v.ai === "chase").length;
        if (this.copCarT <= 0 && chaseCars < pl.wanted) {
          this.copCarT = 9;
          const point = this.randomSpawnNearPlayer(35, 70);
          const car = this.createVehicle("police", point.x, point.z, rand(0, Math.PI * 2), "chase");
          car.navTo.set(pl.pos.x, 0, pl.pos.z);
        }
      }
    } else {
      this.copSpawnT = Math.min(this.copSpawnT, 2);
      for (const p of this.peds) {
        if (p.kind === "cop" && p.state === "hostile") {
          p.state = "walk";
          p.fireCd = 3;
        }
      }
    }
  }

  private randomSpawnNearPlayer(min: number, max: number): { x: number; z: number } {
    const base = this.player.inVehicle ? this.player.inVehicle.pos : this.player.pos;
    for (let i = 0; i < 20; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(min, max);
      const x = clamp(base.x + Math.cos(a) * d, -230, 230);
      const z = clamp(base.z + Math.sin(a) * d, -230, 230);
      if (!this.insideBuilding(x, z, 0.8)) {
        this.resolveCollision(new THREE.Vector3(x, 0.1, z), 0.5);
        return { x, z };
      }
    }
    return { x: 26, z: 26 };
  }

  // -------------------------------------------------------------------------
  // pickups + effects
  // -------------------------------------------------------------------------

  private updatePickups(dt: number) {
    const pos = this.player.inVehicle ? this.player.inVehicle.pos : this.player.pos;
    for (const p of this.pickups) {
      if (!p.active) {
        p.respawn -= dt;
        if (p.respawn <= 0) {
          p.active = true;
          p.group.visible = true;
        }
        continue;
      }
      p.bob += dt * 2;
      p.group.position.y = p.pos.y + Math.sin(p.bob) * 0.22;
      p.group.rotation.y += dt * 1.4;
      if (Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z) < 2.6) this.collectPickup(p);
    }
    for (const e of this.effects) {
      e.life -= dt;
      if (e.vel) {
        e.obj.position.addScaledVector(e.vel, dt);
        e.vel.y -= 9 * dt;
      }
      if (e.grow) e.obj.scale.addScalar(e.grow * dt);
    }
  }

  private collectPickup(p: Pickup) {
    p.active = false;
    p.group.visible = false;
    p.respawn = 55;
    this.audio.pickup();
    const pl = this.player;
    switch (p.kind) {
      case "health":
        if (pl.health >= this.maxHealth()) {
          pl.medkits = Math.min(5, pl.medkits + 1);
          this.cb.onToast({ title: "Medkit stored", body: `${pl.medkits} in your kit — press H to use`, tone: "success" });
        } else {
          pl.health = Math.min(this.maxHealth(), pl.health + 40);
          this.cb.onToast({ title: "+40 Health", tone: "success" });
        }
        break;
      case "armor":
        pl.armor = Math.min(this.maxArmor(), pl.armor + 30);
        this.cb.onToast({ title: "+30 Armor", tone: "success" });
        break;
      case "cash": {
        const amount = Math.round(rand(180, 640) * this.cashMult());
        this.awardCash(amount);
        this.cb.onToast({ title: `+$${amount}`, body: "Loose cash from the street", tone: "reward" });
        break;
      }
      case "ammo": {
        for (const id of WEAPON_ORDER) {
          if (id === "fists") continue;
          pl.ammo[id].reserve = Math.min(WEAPONS[id].reserve, pl.ammo[id].reserve + Math.ceil(WEAPONS[id].mag * 1.5));
        }
        this.cb.onToast({ title: "Ammo replenished", body: "All firearms resupplied", tone: "success" });
        break;
      }
      case "nitro":
        this.buffs.push({ name: "Overdrive", seconds: 20 });
        if (pl.inVehicle) pl.inVehicle.nitro = 100;
        this.cb.onToast({ title: "OVERDRIVE", body: "+50% damage and speed for 20s", tone: "reward" });
        break;
      case "skill":
        pl.skillPoints += 1;
        pl.armor = Math.min(this.maxArmor(), pl.armor + 15);
        this.cb.onToast({ title: "Skill shard", body: "+1 skill point — spend it in Loadout (I)", tone: "reward" });
        break;
    }
    this.cb.onEvent({ type: "quest", title: p.kind.toUpperCase() });
    this.emitHud();
  }

  private updateEffects(dt: number) {
    for (const e of this.effects) {
      e.life -= dt;
      if (e.vel) {
        e.obj.position.addScaledVector(e.vel, dt);
        e.vel.y -= 9 * dt;
      }
      if (e.grow) e.obj.scale.addScalar(e.grow * dt);
      if (e.light) e.light.intensity = Math.max(0, e.light.intensity * (1 - dt * 4));
      const targetScale = e.light ? 0 : 0;
      void targetScale;
      if (e.life <= 0) {
        this.scene.remove(e.obj);
        if (e.light) this.scene.remove(e.light);
      }
    }
    this.effects = this.effects.filter((e) => e.life > 0);
    for (const t of this.tracers) t.life -= dt;
    for (const t of this.tracers.filter((t) => t.life <= 0)) {
      this.scene.remove(t.line);
      t.line.geometry.dispose();
    }
    this.tracers = this.tracers.filter((t) => t.life > 0);
  }

  private spark(point: THREE.Vector3, color: string) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    sprite.position.copy(point);
    sprite.scale.setScalar(1.1);
    this.scene.add(sprite);
    this.effects.push({ obj: sprite, life: 0.18, max: 0.18, grow: 2.2 });
  }

  private muzzleFlash(at: THREE.Vector3, color: string, size: number) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }));
    sprite.position.copy(at);
    sprite.scale.setScalar(size);
    this.scene.add(sprite);
    const light = new THREE.PointLight(color, 30, 10, 2);
    light.position.copy(at);
    this.scene.add(light);
    this.effects.push({ obj: sprite, life: 0.07, max: 0.07, light });
  }

  private spawnTracer(from: THREE.Vector3, to: THREE.Vector3, color: string) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09 });
  }

  private explode(point: THREE.Vector3, radius: number, damage: number, owner: "player" | "enemy") {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshBasicMaterial({ color: "#ffb347", transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    sphere.position.copy(point);
    this.scene.add(sphere);
    const light = new THREE.PointLight("#ff8c1a", 400, 40, 2);
    light.position.copy(point);
    this.scene.add(light);
    this.effects.push({ obj: sphere, life: 0.5, max: 0.5, grow: 14, light });
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: i % 2 ? "#ffd23d" : "#ff5a1a", transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.position.copy(point);
      this.scene.add(s);
      this.effects.push({ obj: s, life: rand(0.3, 0.9), max: 1, vel: new THREE.Vector3(rand(-9, 9), rand(2, 12), rand(-9, 9)) });
    }
    this.audio.explosion();
    this.shake = Math.max(this.shake, 0.7);
    for (const p of this.peds) {
      if (p.state === "dead") continue;
      const d = p.pos.distanceTo(point);
      if (d < radius) this.hurtPed(p, damage * (1 - d / radius), false);
    }
    for (const v of this.vehicles) {
      if (v.destroyed) continue;
      const d = v.pos.distanceTo(point);
      if (d < radius) this.damageVehicle(v, damage * (1 - d / radius));
    }
    const pd = (this.player.inVehicle ? this.player.inVehicle.pos : this.player.pos).distanceTo(point);
    if (pd < radius && owner === "player") this.damagePlayer(damage * 0.35 * (1 - pd / radius), "explosion");
    for (const p of this.peds) if (p.kind === "civ" && p.pos.distanceTo(point) < 40) p.panicked = 12;
  }

  private updateProjectiles(dt: number) {
    for (const pr of this.projectiles) {
      pr.life -= dt;
      const next = pr.pos.clone().addScaledVector(pr.vel, dt);
      let boom = false;
      if (next.y < 0.3) boom = true;
      if (this.insideBuilding(next.x, next.z, 0)) boom = true;
      for (const p of this.peds) {
        if (p.state !== "dead" && p.pos.distanceTo(next) < 1.5) boom = true;
      }
      for (const v of this.vehicles) {
        if (!v.destroyed && v !== this.player.inVehicle && v.pos.distanceTo(next) < 2.2) boom = true;
      }
      pr.pos.copy(next);
      pr.mesh.position.copy(next);
      if (pr.life <= 0) boom = true;
      if (boom) {
        this.explode(pr.pos.clone(), pr.radius, pr.damage, pr.owner);
        this.scene.remove(pr.mesh);
        pr.life = 0;
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0);
  }

  // -------------------------------------------------------------------------
  // missions
  // -------------------------------------------------------------------------

  private missionBlipPos(): Vec3Like | null {
    if (!this.mission) return null;
    const step = this.mission.mission.steps[this.mission.step];
    return step ? { x: step.target[0], z: step.target[1] } : null;
  }

  private updateMarker(dt: number) {
    const pos = this.missionBlipPos();
    if (!pos) {
      this.marker.visible = false;
      return;
    }
    this.marker.visible = true;
    this.marker.position.set(pos.x, 0.2, pos.z);
    this.marker.rotation.y += dt * 0.7;
    if (this.markerBeam) {
      const s = 1 + Math.sin(this.elapsed * 2.2) * 0.06;
      this.markerBeam.scale.set(s, 1, s);
    }
  }

  private startMission(id: string) {
    const mission = MISSIONS.find((m) => m.id === id);
    if (!mission) return;
    if (this.mission) this.abandonMission();
    const first = mission.steps[0];
    const district = DISTRICTS.find((d) => d.id === mission.district)!;
    const deploy = first.kind === "vehicle" || first.kind === "eliminate" || first.kind === "collect"
      ? { x: district.center[0], z: district.center[1] }
      : { x: first.target[0], z: first.target[1] };
    const spot = this.findOpenSpot(deploy.x, deploy.z, first.kind === "reach" ? 22 : 14);
    if (this.player.inVehicle) this.exitVehicle(true);
    this.player.pos.set(spot.x, 0.12, spot.z);
    this.player.group.position.copy(this.player.pos);
    this.player.dead = false;
    this.player.health = Math.max(this.player.health, 60);
    this.cameraYaw = Math.atan2(first.target[0] - spot.x, first.target[1] - spot.z);
    this.mission = { mission, step: 0, enemies: [], crates: [], timer: 0, waveTimer: 0, vehicleHintT: 3, startedAt: this.elapsed };
    this.increaseMissionPrep();
    this.audio.ui();
    this.cb.onToast({ title: `CONTRACT: ${mission.title}`, body: `${mission.giver} · ${first.text}`, tone: "mission" });
  }

  private increaseMissionPrep() {
    const st = this.mission;
    if (!st) return;
    if (this.player.health < this.maxHealth() * 0.6) this.player.health = Math.round(this.maxHealth() * 0.75);
    if (this.player.armor < 10) this.player.armor = Math.min(this.maxArmor(), 25);
    this.prepareStep();
  }

  private prepareStep() {
    const st = this.mission;
    if (!st) return;
    const step = st.mission.steps[st.step];
    this.clearMissionEnemies();
    for (const c of st.crates) this.scene.remove(c.group);
    st.crates = [];
    st.timer = step.kind === "survive" ? step.seconds ?? 40 : 0;
    st.waveTimer = 8;
    st.vehicleHintT = 2.5;
    if (step.kind === "eliminate" || step.kind === "survive") {
      const count = step.kind === "survive" ? 3 : step.count ?? 4;
      for (let i = 0; i < count; i++) {
        const spot = this.findOpenSpot(step.target[0], step.target[1], 13);
        const isBoss = st.mission.id === "kingpin" && step.kind === "eliminate" && i === count - 1;
        const p = this.createPed(isBoss ? "boss" : "gang", spot.x, spot.z, true);
        st.enemies.push(p);
      }
      if (step.kind === "survive") this.increaseWanted(2, "contract heat");
    }
    if (step.kind === "collect") {
      for (let i = 0; i < (step.count ?? 3); i++) {
        const spot = this.findOpenSpot(step.target[0], step.target[1], 14);
        const g = new THREE.Group();
        const crateMat = mat("#b98d3a", { roughness: 0.8, metalness: 0.2 });
        const crate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), crateMat);
        crate.scale.set(1.4, 1.1, 1.4);
        g.add(crate);
        for (const s of [-1, 1]) {
          const strip = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.12, 1.46), mat("#c8ff3d", { emissive: "#c8ff3d", emissiveIntensity: 1.2 }));
          strip.position.y = s * 0.35;
          g.add(strip);
        }
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: "#c8ff3d", transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
        halo.scale.setScalar(3);
        g.add(halo);
        g.position.set(spot.x, 1, spot.z);
        this.scene.add(g);
        st.crates.push({ group: g, pos: new THREE.Vector3(spot.x, 1, spot.z), active: true });
      }
    }
    if (step.kind === "vehicle" && step.vehicleKind) {
      const existing = this.vehicles.some((v) => !v.destroyed && v.kind === step.vehicleKind && v.pos.distanceTo(this.player.pos) < 70);
      if (!existing) {
        const spot = this.findOpenSpot(this.player.pos.x, this.player.pos.z, 12);
        this.createVehicle(step.vehicleKind, spot.x, spot.z, this.cameraYaw, "none");
        this.cb.onToast({ title: "Vehicle delivered", body: `${VEHICLES[step.vehicleKind].name} is waiting nearby.`, tone: "info" });
      }
    }
  }

  private clearMissionEnemies() {
    if (!this.mission) return;
    for (const p of this.mission.enemies) {
      p.marked = false;
      this.scene.remove(p.group);
      const i = this.peds.indexOf(p);
      if (i >= 0) this.peds.splice(i, 1);
    }
    this.mission.enemies = [];
  }

  private clearMissionEntities() {
    if (!this.mission) return;
    this.clearMissionEnemies();
    for (const c of this.mission.crates) this.scene.remove(c.group);
    this.mission.crates = [];
  }

  private abandonMission() {
    if (!this.mission) return;
    this.clearMissionEntities();
    this.cb.onToast({ title: "Contract abandoned", body: this.mission.mission.title, tone: "danger" });
    this.mission = null;
    this.emitHud();
  }

  private completeMission() {
    const st = this.mission;
    if (!st) return;
    const m = st.mission;
    const cash = Math.round(m.reward * this.cashMult());
    this.awardCash(cash);
    this.addXp(m.xp, false);
    if (!this.player.completed.includes(m.id)) this.player.completed.push(m.id);
    this.clearMissionEntities();
    this.mission = null;
    this.save();
    this.audio.missionComplete();
    this.cb.onToast({ title: `${m.title.toUpperCase()} COMPLETE`, body: `+$${cash.toLocaleString()} · +${m.xp} XP`, tone: "reward" });
    this.cb.onEvent({ type: "missionComplete", title: m.title, body: `+$${cash.toLocaleString()}`, value: cash });
    this.emitHud();
  }

  private updateMission(dt: number) {
    const st = this.mission;
    if (!st || this.player.dead) return;
    const step = st.mission.steps[st.step];
    if (!step) {
      this.completeMission();
      return;
    }
    const pos = this.player.inVehicle ? this.player.inVehicle.pos : this.player.pos;
    const target = { x: step.target[0], z: step.target[1] };
    const dist = Math.hypot(pos.x - target.x, pos.z - target.z);
    st.vehicleHintT -= dt;
    if (step.kind === "reach") {
      if (dist < (step.radius ?? 8)) this.advanceStep();
    } else if (step.kind === "vehicle") {
      const rightVehicle = this.player.inVehicle?.kind === step.vehicleKind;
      if (rightVehicle && dist < (step.radius ?? 10)) this.advanceStep();
      if (step.vehicleKind && !rightVehicle && dist < (step.radius ?? 10) && st.vehicleHintT <= 0) {
        st.vehicleHintT = 8;
        this.cb.onToast({ title: "Wrong ride", body: `${step.text} — you need a ${VEHICLES[step.vehicleKind].name}.`, tone: "danger" });
      }
      if (step.vehicleKind) {
        const near = this.vehicles.some((v) => v.kind === step.vehicleKind && !v.destroyed && v.pos.distanceTo(this.player.pos) < 90);
        if (!near && st.vehicleHintT <= 0) {
          const spot = this.findOpenSpot(this.player.pos.x, this.player.pos.z, 14);
          this.createVehicle(step.vehicleKind, spot.x, spot.z, this.cameraYaw, "none");
          st.vehicleHintT = 12;
          this.cb.onToast({ title: "Replacement vehicle", body: "Delivered nearby — don't lose this one.", tone: "info" });
        }
      }
    } else if (step.kind === "eliminate") {
      const alive = st.enemies.filter((p) => p.state !== "dead");
      if (alive.length === 0) this.advanceStep();
    } else if (step.kind === "collect") {
      for (const c of st.crates) {
        if (!c.active) continue;
        c.group.rotation.y += dt * 1.2;
        c.group.position.y = c.pos.y + Math.sin(this.elapsed * 2 + c.pos.x) * 0.15;
        if (pos.distanceTo(c.pos) < 3) {
          c.active = false;
          c.group.visible = false;
          this.audio.pickup();
          this.cb.onToast({ title: "Crate secured", body: `${st.crates.filter((x) => !x.active).length}/${st.crates.length}`, tone: "success" });
          this.emitHud();
        }
      }
      if (st.crates.every((c) => !c.active)) this.advanceStep();
    } else if (step.kind === "survive") {
      st.timer -= dt;
      st.waveTimer -= dt;
      if (st.waveTimer <= 0) {
        st.waveTimer = 11;
        const spot = this.findOpenSpot(step.target[0], step.target[1], 18);
        const p = this.createPed("gang", spot.x, spot.z, true);
        st.enemies.push(p);
        if (this.player.wanted === 0) this.increaseWanted(2, "contract heat");
      }
      if (st.timer <= 0) this.advanceStep();
    }
  }

  private advanceStep() {
    const st = this.mission;
    if (!st) return;
    st.step++;
    if (st.step >= st.mission.steps.length) {
      this.completeMission();
      return;
    }
    this.audio.pickup();
    this.prepareStep();
    this.cb.onToast({ title: "Objective complete", body: st.mission.steps[st.step].text, tone: "success" });
    this.emitHud();
  }

  private findOpenSpot(x: number, z: number, minDist = 12): { x: number; z: number } {
    for (let radius = minDist; radius < minDist + 30; radius += 3) {
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2 + rand(-0.1, 0.1);
        const px = clamp(x + Math.cos(a) * radius, -232, 232);
        const pz = clamp(z + Math.sin(a) * radius, -232, 232);
        if (!this.insideBuilding(px, pz, 1.4)) return { x: px, z: pz };
      }
    }
    return { x: clamp(x, -232, 232), z: clamp(z, -232, 232) };
  }

  // -------------------------------------------------------------------------
  // vehicle enter / exit & interaction
  // -------------------------------------------------------------------------

  private interact() {
    if (this.player.dead) return;
    if (this.player.inVehicle) {
      this.exitVehicle();
      return;
    }
    let best: Vehicle | null = null;
    let bestD = 9;
    for (const v of this.vehicles) {
      if (v.destroyed) continue;
      const d = v.pos.distanceTo(this.player.pos);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    if (best) this.enterVehicle(best);
  }

  private enterVehicle(v: Vehicle) {
    this.player.inVehicle = v;
    v.occupied = true;
    v.ai = "none";
    this.player.group.visible = false;
    this.player.pos.copy(v.pos);
    const spec = v.spec;
    this.cameraYaw = v.heading;
    this.zoom = 0;
    this.snapCamera = true;
    if (v.kind === "police") this.increaseWanted(1, "grand theft auto");
    this.audio.ui();
    this.cb.onToast({ title: spec.name, body: `${spec.brand} · ${spec.cls} · E to exit${spec.cls === "Aircraft" ? " · Space/Ctrl altitude" : ""}`, tone: "info" });
  }

  private exitVehicle(force = false) {
    const v = this.player.inVehicle;
    if (!v) return;
    if (!force && (v.kind === "heli" || v.kind === "plane") && v.pos.y > 4) {
      this.cb.onToast({ title: "Too high", body: "Land before bailing out.", tone: "danger" });
      return;
    }
    this.player.inVehicle = null;
    v.occupied = false;
    this.player.group.visible = true;
    let side = new THREE.Vector3(Math.cos(v.heading), 0, -Math.sin(v.heading)).multiplyScalar(2.6);
    const spot = v.pos.clone().add(side);
    if (this.insideBuilding(spot.x, spot.z, 0.4)) {
      side = new THREE.Vector3(-Math.cos(v.heading), 0, Math.sin(v.heading)).multiplyScalar(2.6);
      spot.copy(v.pos).add(side);
    }
    this.player.pos.set(spot.x, 0.12, spot.z);
    this.resolveCollision(this.player.pos, 0.5);
    this.player.vy = 0;
    this.player.group.position.copy(this.player.pos);
    this.player.group.visible = true;
    v.speed *= 0.4;
    this.audio.setEngine(false);
  }

  private updateCamera(dt: number) {
    const pl = this.player;
    const v = pl.inVehicle;
    pl.group.visible = !v;
    if (v && this.elapsed - this.lastDragT > 1.2 && Math.abs(v.speed) > 2) {
      this.cameraYaw = lerpAngle(this.cameraYaw, v.heading, dt * 1.8);
    }
    const target = v
      ? v.pos.clone().add(new THREE.Vector3(0, v.kind === "plane" || v.kind === "tank" ? 2.6 : 2.1, 0))
      : pl.pos.clone().add(new THREE.Vector3(0, 1.55, 0));
    const baseDist = v ? v.spec.cameraDist : 6.6;
    let dist = clamp(baseDist + this.zoom + (v ? Math.min(4, Math.abs(v.speed) * 0.06) : 0), 3.2, 26);
    const pitch = this.cameraPitch;
    const dir = fwd(this.cameraYaw);
    // pull camera in when a building blocks the view
    for (let t = 0.25; t <= 1; t += 0.12) {
      const px = target.x - dir.x * dist * Math.cos(pitch) * t;
      const pz = target.z - dir.z * dist * Math.cos(pitch) * t;
      const py = target.y + Math.sin(pitch) * dist * t;
      let blocked = false;
      for (const c of this.city.colliders) {
        if (c.height > py && px > c.minX - 0.4 && px < c.maxX + 0.4 && pz > c.minZ - 0.4 && pz < c.maxZ + 0.4) {
          blocked = true;
          break;
        }
      }
      if (blocked) {
        dist = Math.max(2.8, dist * t * 0.9);
        break;
      }
    }
    const desired = new THREE.Vector3(
      target.x - dir.x * dist * Math.cos(pitch),
      target.y + Math.sin(pitch) * dist,
      target.z - dir.z * dist * Math.cos(pitch)
    );
    this.shake *= 1 - dt * 4;
    if (this.shake > 0.002) {
      desired.x += rand(-this.shake, this.shake) * 2.2;
      desired.y += rand(-this.shake, this.shake) * 1.6;
      desired.z += rand(-this.shake, this.shake) * 2.2;
    }
    if (this.snapCamera) {
      this.camera.position.copy(desired);
      this.snapCamera = false;
    } else {
      this.camera.position.lerp(desired, clamp(dt * 10, 0, 1));
    }
    const lookAt = target.clone().addScaledVector(dir, dist * 1.6 + 18);
    this.camera.lookAt(lookAt);
    const fov = v ? clamp(64 + Math.abs(v.speed) * 0.22, 64, 78) : 64;
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * clamp(dt * 4, 0, 1);
      this.camera.updateProjectionMatrix();
    }
  }

  // -------------------------------------------------------------------------
  // hud
  // -------------------------------------------------------------------------

  private emitHud() {
    if (this.disposed) return;
    const pl = this.player;
    const pos = pl.inVehicle ? pl.inVehicle.pos : pl.pos;
    const inV = pl.inVehicle;
    const ammo = pl.weapon === "fists" ? { mag: Infinity, reserve: Infinity } : pl.ammo[pl.weapon];
    const nearbyVehicle = this.nearestVehicleToEnter();
    const blips: Blip[] = [];
    if (this.mission) {
      const step = this.mission.mission.steps[this.mission.step];
      if (step) blips.push({ x: step.target[0], z: step.target[1], kind: "mission" });
      for (const p of this.mission.enemies) if (p.state !== "dead") blips.push({ x: p.pos.x, z: p.pos.z, kind: "enemy" });
      for (const c of this.mission.crates) if (c.active) blips.push({ x: c.pos.x, z: c.pos.z, kind: "pickup" });
    }
    for (const p of this.peds) {
      if (p.state === "dead") continue;
      if (p.pos.distanceTo(pos) > 120) continue;
      if (p.kind === "cop") blips.push({ x: p.pos.x, z: p.pos.z, kind: "police" });
      else if (p.state === "hostile") blips.push({ x: p.pos.x, z: p.pos.z, kind: "enemy" });
    }
    for (const v of this.vehicles) {
      if (v.destroyed) continue;
      if (v.pos.distanceTo(pos) < 90) blips.push({ x: v.pos.x, z: v.pos.z, kind: "vehicle" });
    }
    for (const p of this.pickups) if (p.active && p.pos.distanceTo(pos) < 70) blips.push({ x: p.pos.x, z: p.pos.z, kind: "pickup" });
    blips.push({ x: this.city.garage.x, z: this.city.garage.z, kind: "garage" });
    blips.push({ x: this.city.hospital.x, z: this.city.hospital.z, kind: "hospital" });

    const missionHud = this.mission
      ? (() => {
          const step = this.mission!.mission.steps[this.mission!.step];
          if (!step) return null;
          let progress = 0;
          let progressMax = 1;
          if (step.kind === "eliminate") {
            progressMax = step.count ?? 4;
            progress = progressMax - this.mission!.enemies.filter((p) => p.state !== "dead").length;
          } else if (step.kind === "collect") {
            progressMax = this.mission!.crates.length || step.count || 3;
            progress = this.mission!.crates.filter((c) => !c.active).length;
          } else if (step.kind === "survive") {
            progressMax = step.seconds ?? 40;
            progress = progressMax - this.mission!.timer;
          } else {
            progressMax = (step.radius ?? 9) + 120;
            progress = Math.max(0, progressMax - Math.hypot(pos.x - step.target[0], pos.z - step.target[1]));
          }
          return {
            id: this.mission!.mission.id,
            title: this.mission!.mission.title,
            step: step.text,
            stepIndex: this.mission!.step,
            stepCount: this.mission!.mission.steps.length,
            progress,
            progressMax,
            kind: step.kind,
            target: step.target,
          };
        })()
      : null;

    const hud: HudState = {
      health: Math.max(0, Math.round(pl.health)),
      maxHealth: this.maxHealth(),
      armor: Math.max(0, Math.round(pl.armor)),
      maxArmor: this.maxArmor(),
      cash: pl.cash,
      xp: pl.xp,
      level: pl.level,
      xpNext: this.xpNext(),
      skillPoints: pl.skillPoints,
      wanted: pl.wanted,
      district: districtAt(pos.x, pos.z),
      weapon: pl.weapon,
      ammo: isFinite(ammo.mag) ? ammo.mag : -1,
      reserve: isFinite(ammo.reserve) ? ammo.reserve : -1,
      reloading: pl.reloading > 0,
      inVehicle: inV
        ? {
            kind: inV.kind,
            name: inV.spec.name,
            speed: Math.abs(inV.speed) * 3.6,
            health: Math.max(0, inV.health),
            maxHealth: inV.maxHealth,
            nitro: inV.nitro,
            airborne: inV.airborne || inV.pos.y > 3,
          }
        : null,
      mission: missionHud,
      completed: pl.completed,
      ownedUpgrades: pl.owned,
      medkits: pl.medkits,
      nearby: nearbyVehicle ? { kind: nearbyVehicle.kind, name: nearbyVehicle.spec.name } : null,
      interaction: inV ? "E — Exit vehicle" : nearbyVehicle ? `E — Drive ${nearbyVehicle.spec.name}` : null,
      blips,
      clock: this.clockString,
      dead: pl.dead,
      muted: this.muted,
      quality: this.quality,
      wantedReason: pl.wantedReason,
      enemiesRemaining: this.mission ? this.mission.enemies.filter((p) => p.state !== "dead").length : 0,
      fps: Math.round(this.fps),
      x: pos.x,
      z: pos.z,
      heading: inV ? inV.heading : this.player.heading,
      speedOnFoot: 0,
      boosts: this.buffs.map((b) => ({ name: b.name, seconds: Math.ceil(b.seconds) })),
      quickTravelLocked: !!this.mission,
    };
    this.cb.onHud(hud);
  }

  private nearestVehicleToEnter(): Vehicle | null {
    if (this.player.inVehicle || this.player.dead) return null;
    let best: Vehicle | null = null;
    let bestD = 9;
    for (const v of this.vehicles) {
      if (v.destroyed) continue;
      const d = v.pos.distanceTo(this.player.pos);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  private xpNext() {
    return 500 + (this.player.level - 1) * 420;
  }

  private addXp(amount: number, announce = true) {
    const pl = this.player;
    pl.xp += amount;
    while (pl.xp >= this.xpNext()) {
      pl.xp -= this.xpNext();
      pl.level++;
      pl.skillPoints++;
      pl.health = this.maxHealth();
      pl.armor = Math.min(this.maxArmor(), pl.armor + 25);
      this.audio.levelUp();
      this.cb.onEvent({ type: "levelUp", title: `LEVEL ${pl.level}`, body: "+1 skill point · health restored", value: pl.level });
      this.cb.onToast({ title: `LEVEL ${pl.level}`, body: "New skill point available. Open Loadout (I).", tone: "reward" });
    }
    if (announce) this.cb.onEvent({ type: "quest", title: `+${amount} XP` });
  }

  private awardCash(amount: number) {
    this.player.cash += amount;
  }

  private startReload() {
    const w = WEAPONS[this.player.weapon];
    if (w.mag === Infinity) return;
    const ammo = this.player.ammo[this.player.weapon];
    if (this.player.reloading > 0 || ammo.mag >= this.magSize(this.player.weapon) || ammo.reserve <= 0) return;
    this.player.reloading = this.player.weapon === "shotgun" ? 1.5 : this.player.weapon === "rocket" ? 2 : 0.95;
    this.audio.ui();
  }

  private finishReload() {
    const pl = this.player;
    const w = WEAPONS[pl.weapon];
    if (w.mag === Infinity) return;
    const ammo = pl.ammo[pl.weapon];
    const size = this.magSize(pl.weapon);
    const need = size - ammo.mag;
    const take = Math.min(need, ammo.reserve);
    ammo.mag += take;
    ammo.reserve -= take;
    pl.reloading = 0;
  }

  private useMedkit() {
    const pl = this.player;
    if (pl.medkits <= 0 || pl.health >= this.maxHealth() || pl.dead) {
      this.cb.onToast({ title: "No medkits", body: "Find green health pickups around the city.", tone: "danger" });
      return;
    }
    pl.medkits--;
    pl.health = Math.min(this.maxHealth(), pl.health + 65);
    this.audio.pickup();
    this.cb.onToast({ title: "+65 Health", body: `${pl.medkits} medkit${pl.medkits === 1 ? "" : "s"} left`, tone: "success" });
  }

  // -------------------------------------------------------------------------
  // cleanup
  // -------------------------------------------------------------------------

  private cleanup() {
    // keep the population bounded and cull far civilians
    if (this.peds.length > 105) {
      const p = this.player.inVehicle ? this.player.inVehicle.pos : this.player.pos;
      let removed = 0;
      this.peds = this.peds.filter((ped) => {
        if (removed > 8) return true;
        if (ped.kind === "civ" && ped.pos.distanceTo(p) > 180) {
          removed++;
          this.scene.remove(ped.group);
          return false;
        }
        return true;
      });
    }
    for (const v of this.vehicles) {
      if (v.destroyed && v.deadT > 8 && v.group.parent) this.scene.remove(v.group);
    }
    this.vehicles = this.vehicles.filter((v) => !(v.destroyed && v.deadT > 8.2));
    this.peds = this.peds.filter((p) => !(p.state === "dead" && p.deadT > 10));
    if (this.player.health < this.maxHealth() * 0.25 && this.player.health > 0) {
      this.hitMarkerT = 0;
    }
  }

  // -------------------------------------------------------------------------
  // public API
  // -------------------------------------------------------------------------

  getApi(): GameApi {
    return {
      setPaused: (p) => {
        this.paused = p;
        this.trigger = false;
        this.keys.clear();
        if (p && document.pointerLockElement) document.exitPointerLock();
      },
      spawnVehicle: (kind) => {
        if (!GARAGE_KINDS.includes(kind)) return;
        const spot = this.findOpenSpot(this.player.pos.x, this.player.pos.z, 11);
        const v = this.createVehicle(kind, spot.x, spot.z, this.cameraYaw + Math.PI, "none");
        v.pos.y = 0.05;
        this.syncVehicle(v);
        this.audio.ui();
        this.cb.onToast({ title: `${v.spec.name} delivered`, body: `${v.spec.brand} · walk up and press E`, tone: "success" });
      },
      startMission: (id) => this.startMission(id),
      abandonMission: () => this.abandonMission(),
      fastTravel: (id) => {
        if (this.mission) {
          this.cb.onToast({ title: "GPS locked", body: "Finish or abandon the contract before fast travel.", tone: "danger" });
          return;
        }
        const d = DISTRICTS.find((x) => x.id === id);
        if (!d) return;
        const spot = this.findOpenSpot(d.center[0], d.center[1], 8);
        if (this.player.inVehicle) this.exitVehicle(true);
        this.player.pos.set(spot.x, 0.12, spot.z);
        this.player.group.position.copy(this.player.pos);
        this.player.group.visible = true;
        this.cameraYaw = Math.atan2(d.center[0] - spot.x, d.center[1] - spot.z);
        this.snapCamera = true;
        this.audio.ui();
        this.cb.onToast({ title: d.short.toUpperCase(), body: d.tagline, tone: "info" });
        this.save();
        this.emitHud();
      },
      buyUpgrade: (id) => {
        const up = UPGRADES.find((u) => u.id === id);
        if (!up) return;
        const owned = this.player.owned[id] ?? 0;
        if (owned >= up.max) {
          this.cb.onToast({ title: "Fully upgraded", body: `${up.name} is already maxed.`, tone: "info" });
          return;
        }
        const currency = up.currency === "cash" ? this.player.cash : this.player.skillPoints;
        if (currency < up.cost) {
          this.cb.onToast({ title: "Not enough " + up.currency, body: `${up.name} needs ${up.cost} ${up.currency}.`, tone: "danger" });
          return;
        }
        if (up.currency === "cash") this.player.cash -= up.cost;
        else this.player.skillPoints -= up.cost;
        this.player.owned[id] = owned + 1;
        if (id === "ironSkin") this.player.health = Math.min(this.maxHealth(), this.player.health + 25);
        if (id === "armorPlating") this.player.armor = Math.min(this.maxArmor(), this.player.armor + 25);
        this.audio.pickup();
        this.cb.onToast({ title: `${up.name} · Rank ${owned + 1}`, body: up.effect, tone: "reward" });
        this.save();
        this.emitHud();
      },
      buyAmmo: (weapon) => {
        if (weapon === "fists") return;
        const cost = 600;
        if (this.player.cash < cost) {
          this.cb.onToast({ title: "Not enough cash", body: "Ammo resupply costs $600.", tone: "danger" });
          return;
        }
        this.player.cash -= cost;
        this.player.ammo[weapon].reserve = WEAPONS[weapon].reserve;
        this.player.ammo[weapon].mag = this.magSize(weapon);
        this.audio.pickup();
        this.cb.onToast({ title: `${WEAPONS[weapon].name} restocked`, body: `-$${cost}`, tone: "success" });
        this.emitHud();
      },
      useMedkit: () => this.useMedkit(),
      respawn: () => {
        if (!this.player.dead) return;
        const hospital = this.city.hospital;
        const spot = this.findOpenSpot(hospital.x, hospital.z, 16);
        this.player.pos.set(spot.x, 0.12, spot.z);
        this.player.group.position.copy(this.player.pos);
        this.player.group.visible = true;
        this.player.dead = false;
        this.player.health = this.maxHealth();
        this.player.armor = Math.max(10, Math.floor(this.maxArmor() * 0.3));
        this.player.cash = Math.max(0, Math.floor(this.player.cash * 0.9));
        this.player.wanted = 0;
        this.player.wantedReason = "";
        this.player.medkits = Math.max(1, this.player.medkits);
        this.cameraYaw = 0;
        this.snapCamera = true;
        this.respawnCooldown = 1;
        for (const v of this.vehicles) if (v.ai === "chase") v.ai = "traffic";
        for (const p of this.peds) if (p.kind === "cop") p.state = "walk";
        this.audio.pickup();
        this.cb.onToast({ title: "Patched up", body: "St. Jude Trauma Center · 10% medical fee taken", tone: "info" });
        this.emitHud();
      },
      setQuality: (q) => {
        this.quality = q;
        const high = q === "high";
        this.renderer.shadowMap.enabled = high;
        this.renderer.setPixelRatio(high ? Math.min(window.devicePixelRatio, 1.25) : 0.85);
        this.city.sun.castShadow = high;
        this.renderer.shadowMap.needsUpdate = true;
        this.emitHud();
        this.cb.onToast({ title: high ? "High fidelity" : "Performance mode", body: high ? "Shadows and full resolution enabled" : "Shadows off · reduced resolution", tone: "info" });
      },
      resetProgress: () => {
        try {
          localStorage.removeItem(SAVE_KEY);
        } catch {
          /* noop */
        }
        this.player.cash = 4200;
        this.player.xp = 0;
        this.player.level = 1;
        this.player.skillPoints = 1;
        this.player.owned = {};
        this.player.completed = [];
        this.player.health = 100;
        this.player.armor = 25;
        this.clearMissionEntities();
        this.mission = null;
        this.cb.onToast({ title: "Progress reset", body: "New city, same instincts.", tone: "info" });
        this.emitHud();
      },
      toggleMute: () => {
        this.muted = !this.muted;
        this.audio.setMuted(this.muted);
        this.emitHud();
      },
      fireDown: () => {
        this.trigger = true;
        this.firedThisPress = false;
      },
      fireUp: () => {
        this.trigger = false;
      },
      setVirtualInput: (code, down) => {
        if (down) this.keys.add(code);
        else this.keys.delete(code);
        if (code === "KeyE" && down) this.interact();
      },
      setMoveAxis: (x, y) => {
        this.virtualMove.x = clamp(x, -1, 1);
        this.virtualMove.y = clamp(y, -1, 1);
      },
      selectWeapon: (w) => this.setWeapon(w),
      interact: () => this.interact(),
      requestPointerLock: () => this.requestLock(),
      dispose: () => this.dispose(),
    };
  }

  private dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.save();
    this.audio.dispose();
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("pointerup", this.onWindowPointerUp);
    window.removeEventListener("mousemove", this.onWindowMouseMove);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    const c = this.renderer.domElement;
    c.removeEventListener("pointerdown", this.onCanvasPointerDown);
    c.removeEventListener("pointermove", this.onCanvasPointerMove);
    c.removeEventListener("pointerup", this.onCanvasPointerUp);
    c.removeEventListener("wheel", this.onWheel);
    c.removeEventListener("contextmenu", this.onContextMenu);
    if (document.pointerLockElement === c) document.exitPointerLock();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose?.();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => m?.dispose?.());
      }
    });
    this.renderer.dispose();
    if (c.parentElement === this.container) this.container.removeChild(c);
  }
}

interface Vec3Like {
  x: number;
  z: number;
}

let trafficSeed = 987654321;
function RND_TRAFFIC() {
  trafficSeed = (trafficSeed * 1664525 + 3902639183) % 4294967296;
  return trafficSeed / 4294967296;
}
