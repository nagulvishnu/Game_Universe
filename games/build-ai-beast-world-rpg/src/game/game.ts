import * as THREE from "three";
import { World, CAMPS, glowSprite, type Chest, type Portal, type Tablet, type Npc } from "./world";
import { SEA, HALF, TERRAIN_SIZE, BIOMES } from "./terrain";
import { Environment } from "./env";
import { FX } from "./fx";
import { audio } from "./audio";
import { input } from "./input";
import { buildPlayer, buildVesper, type Model } from "./models";
import { Enemy, Beast, Warden, angDiff } from "./enemy";
import { QUESTS, TABLETS, GEAR, gearById, gearScore, RARITY, RARITY_COL, type Gear, type Slot } from "./data";
import { addScore, getName } from "./store";
import { clamp, lerp, smooth } from "./noise";

export interface Hud {
  screen: "start" | "play" | "pause" | "dead" | "menu" | "victory";
  hp: number; maxHp: number; st: number; maxSt: number; en: number; level: number; xp: number; xpNext: number; sp: number;
  score: number; combo: number; mult: number; cores: number; coreT: number; coreMax: number;
  cd: { s1: number; s2: number; vs: number; sense: number; core: number };
  unlock: { s2: boolean; vesper: boolean; mount: boolean; ult: boolean; sense: boolean };
  ultReady: boolean; region: string; quest: { id: string; title: string; desc: string; dist: number; ang: number } | null;
  boss: { name: string; title: string; hp: number; max: number; phase: number; shield: boolean; poise: number } | null;
  prompt: string | null; hint: string | null; banner: { id: number; text: string; sub: string; color: string } | null;
  toasts: { id: number; text: string; color: string }[];
  dialogue: { name: string; text: string; i: number; n: number } | null;
  subtitle: { name: string; text: string } | null;
  underwater: boolean; o2: number; fade: number; charge: number; lock: boolean; mounted: boolean; gliding: boolean; climbing: boolean;
  tod: number; weather: string; bossWon: boolean; hurt: number; slow: boolean; cine: boolean; swimming: boolean;
  final: { score: number; kills: number; time: number; level: number; rank: number; id: number; name: string; boss: boolean; title: string } | null;
  fps: number; locked: boolean; stats: { kills: number; chests: number; tablets: number; discoveries: number; portals: number };
}

const COMBO = [
  { dur: 0.34, hit: 0.1, dmg: 1.0, range: 3.7, arc: 2.4, lunge: 3.8, poise: 8, kb: 3.5, col: 0x9ff0ff, tilt: -0.35, roll: -0.6 },
  { dur: 0.36, hit: 0.1, dmg: 1.1, range: 3.7, arc: 2.6, lunge: 3.8, poise: 8, kb: 3.5, col: 0x9ff0ff, tilt: 0.35, roll: 0.7 },
  { dur: 0.42, hit: 0.13, dmg: 1.35, range: 3.9, arc: 2.9, lunge: 4.8, poise: 12, kb: 4.5, col: 0xbfe8ff, tilt: -1.0, roll: 0 },
  { dur: 0.68, hit: 0.24, dmg: 2.3, range: 4.7, arc: 3.7, lunge: 6, poise: 30, kb: 10, col: 0xffd890, tilt: 0.1, roll: 0.15 },
];
interface ActState { kind: string; t: number; dur: number; hitT: number; hit: boolean; i: number; dir: THREE.Vector3; data: Record<string, number>; hitSet: Set<number> }
interface Proj { pos: THREE.Vector3; vel: THREE.Vector3; life: number; dmg: number; mesh: THREE.Object3D; homing: number; radius: number; friendly: boolean; color: number; mult: number }
interface Orb { pos: THREE.Vector3; vel: THREE.Vector3; kind: string; t: number; sprite: THREE.Sprite }
interface Bloom { pos: THREE.Vector3; t: number; mesh: THREE.Mesh; tick: number }
interface CampState { def: (typeof CAMPS)[number]; enemies: Enemy[]; spawned: boolean; cleared: boolean; respawnAt: number }

const V3 = THREE.Vector3;
const SKILL_DEFS = [
  { id: "blade", name: "Blade Mastery", desc: "+8% damage per rank", max: 5 },
  { id: "vital", name: "Vitality", desc: "+45 max HP per rank", max: 5 },
  { id: "endur", name: "Endurance", desc: "+20 stamina per rank", max: 5 },
  { id: "flow", name: "Energy Flow", desc: "+20% energy from hits", max: 3 },
  { id: "bond", name: "Vesper Bond", desc: "+25% Vesper damage, faster assists", max: 5 },
  { id: "core", name: "Core Affinity", desc: "+6s Beast Core duration", max: 3 },
  { id: "wind", name: "Windrunner", desc: "Glide and climb cost 15% less stamina", max: 3 },
  { id: "gale", name: "Gale Mastery", desc: "Gale Rend cooldown -12%", max: 3 },
];
export { SKILL_DEFS };

export class Game {
  host: HTMLElement;
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  world: World;
  env: Environment;
  fx: FX;
  mobile: boolean;
  clock = new THREE.Clock();
  disposeInput: () => void;
  canvas: HTMLCanvasElement;
  onHud: ((h: Hud) => void) | null = null;
  hudT = 0;
  mode: "start" | "play" | "pause" | "dead" | "menu" | "victory" = "start";
  time = 0; runTime = 0;
  timeScale = 1; slowT = 0; slowScale = 1; hitStopT = 0;
  fade = 0; fadeTarget = 0;
  pixelRatio = 1; maxPR = 1; frameAcc = 0; frameN = 0; fps = 60; qT = 0;

  // player
  pm: Model; vm: Model;
  p = {
    pos: new V3(0, 0, 0), vel: new V3(), yaw: 0, vy: 0, hp: 200, st: 100, en: 0, level: 1, xp: 0, sp: 0,
    grounded: true, coyote: 0, airT: 0, swim: false, dive: false, climb: false, glide: false, mounted: false, flying: false,
    act: null as ActState | null, comboIdx: 0, comboTimer: 0, airIdx: 0, dodgeCd: 0, stRegenT: 0,
    blocking: false, blockT: 0, charge: 0, charging: false, counter: 0, perfectCd: 0, iframes: 0, stagger: 0,
    dead: false, o2: 18, cd: { s1: 0, s2: 0, vs: 0, sense: 0 }, synergy: 0, coreT: 0, coreMax: 28, cores: 1,
    sprint: false, walk: 0, moveSpeed: 0, hurtT: 0, lastGround: 0, landT: 0, wasGrounded: true,
    speedFov: 0, aimY: 0, glideT: 0, plunging: false, dashT: 0,
  };
  owned = new Set<string>(["rustblade", "wanderrags"]);
  equipped: Record<Slot, string | null> = { weapon: "rustblade", armor: "wanderrags", charm: null };
  skills: Record<string, number> = {};
  score = 0; combo = 0; comboT = 0;
  stats = { kills: 0, chests: 0, tablets: 0, discoveries: 0, portals: 0, parries: 0, perfects: 0 };
  buf: Record<string, number> = {};
  lockTarget: Enemy | null = null;

  // camera
  yaw = 0; pitch = 0.35; camDist = 7.5; fov = 60; shakeT = 0;
  cine: { t: number; dur: number; fn: (k: number) => void; end?: () => void; skippable: boolean } | null = null;
  camPos = new V3(); camLook = new V3();
  startOrbit = 0;

  // entities
  enemies: Enemy[] = [];
  projs: Proj[] = [];
  orbs: Orb[] = [];
  blooms: Bloom[] = [];
  camps: CampState[] = [];
  grazers = new Map<number, Enemy>();
  attackers = 0; maxAttackers = 2;
  boss!: Warden;
  bossActive = false; bossWon = false; bossLost = false;
  roamT = 30; senseT = 0;
  vesper = { pos: new V3(2, 0, -2), yaw: 0, state: "follow", t: 0, target: null as Enemy | null, from: new V3(), assistCd: 4, boltCd: 1, form: 0, scale: 0.9, vy: 0, alert: 0, sniff: null as Chest | null, hit: false, walk: 0, spd: 0, last: new V3(), pingT: 0 };

  // story / ui state
  quest = 0; questsDone = new Set<string>();
  dialogue: { name: string; lines: string[]; i: number; done?: () => void } | null = null;
  subtitle: { name: string; text: string; t: number } | null = null;
  toasts: { id: number; text: string; color: string; t: number }[] = [];
  bannerObj: { id: number; text: string; sub: string; color: string; t: number } | null = null;
  hintObj: { text: string; t: number } | null = null;
  seq = 1;
  currentRegion = -1; regionsSeen = new Set<number>();
  talk: Record<string, number> = {};
  finalObj: Hud["final"] = null;
  tut: Record<string, boolean> = {};
  prompt: string | null = null; interactTarget: { kind: string; obj: unknown } | null = null;
  coreTaken = new Set<string>();
  mechanicSeen = false;
  tidewallWarn = 0;

  // map
  mapBase: HTMLCanvasElement; fogC: HTMLCanvasElement; fogCtx: CanvasRenderingContext2D; mapSize = 360; fogSize = 180;
  fogT = 0;
  minimap: HTMLCanvasElement | null = null; mapCanvas: HTMLCanvasElement | null = null; miniT = 0;
  barEls = new Map<number, { el: HTMLElement; fill: HTMLElement }>();
  barLayer: HTMLElement; lockEl: HTMLElement;
  tide: THREE.Mesh; skyray: THREE.Group;
  tmpV = new V3();

  constructor(host: HTMLElement) {
    this.host = host;
    this.mobile = input.touch || /Android|iPhone|iPad/i.test(navigator.userAgent);
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.mobile, powerPreference: "high-performance" });
    this.maxPR = Math.min(window.devicePixelRatio || 1, this.mobile ? 1.5 : 2);
    this.pixelRatio = this.maxPR;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.shadowMap.enabled = !this.mobile;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.canvas = this.renderer.domElement;
    this.canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none";
    host.appendChild(this.canvas);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.3, 2800);
    this.world = new World(this.mobile);
    this.scene.add(this.world.root);
    this.env = new Environment(this.scene, !this.mobile);
    this.env.onThunder = () => audio.thunder();
    this.fx = new FX(this.scene, host);
    this.pm = buildPlayer(); this.vm = buildVesper();
    this.pm.root.traverse((o) => { o.castShadow = !this.mobile; });
    this.scene.add(this.pm.root, this.vm.root);
    // dynamic layers for dom
    this.barLayer = document.createElement("div");
    this.barLayer.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:4";
    this.lockEl = document.createElement("div");
    this.lockEl.style.cssText = "position:absolute;left:0;top:0;width:46px;height:46px;border:2px solid #ffd24a;border-radius:50%;box-shadow:0 0 12px #ffd24a, inset 0 0 8px #ffd24a;display:none;pointer-events:none;will-change:transform";
    this.barLayer.appendChild(this.lockEl);
    host.appendChild(this.barLayer);
    // tidewall
    this.tide = new THREE.Mesh(new THREE.CylinderGeometry(900, 900, 500, 64, 1, true), new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uT: { value: 0 } },
      vertexShader: "varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ",
      fragmentShader: `varying vec3 vP; uniform float uT; void main(){ float h=(vP.y+250.0)/500.0; float w=sin(vP.x*0.02+uT*0.5)*sin(vP.z*0.017-uT*0.4)*0.5+0.5; float a=(1.0-h)*0.5*(0.5+w*0.7); gl_FragColor=vec4(vec3(0.3,0.7,1.0)*a*1.3, a*0.6); }`,
    }));
    this.tide.position.y = 120; this.tide.frustumCulled = false; this.scene.add(this.tide);
    // skyray silhouette
    this.skyray = new THREE.Group();
    {
      const s = new THREE.Shape(); s.moveTo(0, 30); s.lineTo(120, -10); s.lineTo(30, -6); s.lineTo(0, -60); s.lineTo(-30, -6); s.lineTo(-120, -10);
      const m = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color: 0x0a0d18, transparent: true, opacity: 0.5, side: THREE.DoubleSide, fog: false }));
      m.rotation.x = Math.PI / 2; this.skyray.add(m);
      this.skyray.position.set(-400, 520, 100); this.scene.add(this.skyray);
    }
    // map base
    this.mapBase = document.createElement("canvas"); this.mapBase.width = this.mapBase.height = this.mapSize;
    this.fogC = document.createElement("canvas"); this.fogC.width = this.fogC.height = this.fogSize;
    this.fogCtx = this.fogC.getContext("2d")!;
    this.buildMapBase();

    this.disposeInput = input.attach(this.canvas);
    this.canvas.addEventListener("mousedown", () => { if (!input.touch && !input.locked && this.mode === "play") this.requestLock(); });
    this.onResize = this.onResize.bind(this);
    window.addEventListener("resize", this.onResize);
    this.onResize();
    document.addEventListener("pointerlockchange", this.onLockChange);
    document.addEventListener("visibilitychange", this.onVis);

    this.boss = new Warden(this, 0, 0);
    this.resetRun();
    this.mode = "start";
    this.env.time = 0.62;
    this.renderer.setAnimationLoop(this.tick);
  }

  onLockChange = () => {
    if (!document.pointerLockElement && this.mode === "play" && !input.touch && !this.menuOpening) this.pause();
  };
  menuOpening = false;
  onVis = () => { if (document.hidden && this.mode === "play") this.pause(); };

  onResize() {
    const w = this.host.clientWidth || window.innerWidth, h = this.host.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.disposeInput();
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("pointerlockchange", this.onLockChange);
    document.removeEventListener("visibilitychange", this.onVis);
    audio.setMode("off");
    this.fx.dispose(); this.barLayer.remove();
    this.renderer.dispose();
    this.canvas.remove();
  }

  /* ---------------- run lifecycle ---------------- */
  resetRun() {
    const p = this.p, w = this.world;
    for (const e of this.enemies) e.dispose();
    this.enemies = []; this.grazers.clear();
    for (const pr of this.projs) this.scene.remove(pr.mesh);
    this.projs = [];
    for (const o of this.orbs) this.scene.remove(o.sprite);
    this.orbs = [];
    for (const b of this.blooms) this.scene.remove(b.mesh);
    this.blooms = [];
    for (const b of this.barEls.values()) b.el.remove();
    this.barEls.clear();
    this.fx.clear();
    this.boss.dispose();
    this.boss = new Warden(this, 0, 0);
    const st = w.stadium; const tp = st.throne;
    this.boss.pos.set(tp.x, w.ground(tp.x, tp.z), tp.z); this.boss.home.copy(this.boss.pos);
    this.boss.yaw = Math.atan2(st.center.x - tp.x, st.center.z - tp.z);
    this.boss.root.position.copy(this.boss.pos); this.boss.root.rotation.y = this.boss.yaw;
    this.enemies.push(this.boss);
    st.gateClosed = false; st.gateY = -13; st.gate.position.y = -13;
    for (const pl of st.pillars) { pl.down = false; pl.fall = 0; pl.col.on = true; pl.g.rotation.set(0, 0, 0); }
    st.floorMat.emissive.set(0x2fb8ff);
    for (const c of w.chests) { c.opened = false; c.openT = 0; c.revealed = false; c.lid.rotation.x = 0; c.glow.material.opacity = 0.7; }
    for (const t of w.tablets) t.read = false;
    for (const po of w.portals) { po.active = false; po.found = false; }
    for (const po of w.pois) po.discovered = false;
    this.camps = CAMPS.filter((c) => c.id !== "c_start").map((def) => ({ def, enemies: [], spawned: false, cleared: false, respawnAt: 0 }));
    this.fogCtx.globalCompositeOperation = "source-over"; this.fogCtx.fillStyle = "#000"; this.fogCtx.fillRect(0, 0, this.fogSize, this.fogSize);

    p.pos.set(0, 0, 0); p.pos.y = w.ground(0, 0); p.vel.set(0, 0, 0); p.yaw = 0.3; p.vy = 0;
    p.level = 1; p.xp = 0; p.sp = 0; this.skills = {};
    this.owned = new Set(["rustblade", "wanderrags"]); this.equipped = { weapon: "rustblade", armor: "wanderrags", charm: null };
    p.hp = this.maxHp(); p.st = this.maxSt(); p.en = 0; p.cores = 1; p.coreT = 0;
    p.grounded = true; p.swim = p.dive = p.climb = p.glide = p.mounted = p.flying = false; p.act = null; p.dead = false;
    p.cd = { s1: 0, s2: 0, vs: 0, sense: 0 }; p.counter = 0; p.iframes = 0; p.stagger = 0; p.o2 = 18; p.blocking = false; p.charging = false; p.charge = 0;
    p.comboIdx = 0; p.comboTimer = 0; p.plunging = false; p.hurtT = 0;
    this.score = 0; this.combo = 0; this.comboT = 0;
    this.stats = { kills: 0, chests: 0, tablets: 0, discoveries: 0, portals: 0, parries: 0, perfects: 0 };
    this.quest = 0; this.questsDone.clear(); this.regionsSeen.clear(); this.currentRegion = -1; this.talk = {}; this.tut = {};
    this.coreTaken.clear(); this.bossActive = false; this.bossWon = false; this.mechanicSeen = false;
    this.dialogue = null; this.subtitle = null; this.toasts = []; this.bannerObj = null; this.hintObj = null; this.finalObj = null;
    this.lockTarget = null; this.cine = null; this.timeScale = 1; this.slowT = 0; this.hitStopT = 0; this.runTime = 0;
    this.roamT = 35; this.env.time = 0.3; this.env.weather = "clear"; this.env.wI = 0; this.env.nextChange = 60;
    const v = this.vesper; v.pos.set(2, p.pos.y, -2); v.state = "follow"; v.form = 0; v.assistCd = 4; v.target = null;
    this.yaw = Math.PI + 0.3; this.pitch = 0.35;
    this.revealFog(0, 0, 90);
    this.fade = 0; this.fadeTarget = 0;
  }

  startGame() {
    audio.init();
    this.resetRun();
    this.mode = "play";
    audio.setMode("explore");
    this.requestLock();
    // intro cinematic
    const p = this.p;
    p.act = { kind: "wake", t: 0, dur: 3.4, hitT: 99, hit: false, i: 0, dir: new V3(), data: {}, hitSet: new Set() };
    this.startCine(3.4, (k) => {
      const e = 1 - Math.pow(1 - k, 3);
      const pos = p.pos;
      const a = 2.4 + e * 0.9;
      this.camera.position.set(pos.x + Math.sin(a) * (14 - e * 6.5), pos.y + 22 - e * 20, pos.z + Math.cos(a) * (14 - e * 6.5));
      this.camLook.set(pos.x, pos.y + 0.6 + e, pos.z);
      this.camera.lookAt(this.camLook);
      this.camera.fov = 45 + e * 15; this.camera.updateProjectionMatrix();
    }, () => {
      p.act = null; this.yaw = Math.PI + 0.35;
      this.hint(input.touch ? "Left stick: move · tap ⚔ to attack" : "WASD move · Mouse look · Click / J attack", 7);
      this.banner("AWAKEN", "The Wastelands · Cinder Flats", "#ffb066");
      setTimeout(() => { if (this.mode === "play" && !this.p.dead) this.ambush(); }, 1500);
    }, true);
    this.banner("AI BEAST WORLD", "Day 0 — you do not remember how you came to be here", "#ffe0a0");
    audio.vesper();
  }
  restart() {
    // instant restart: no intro, immediate action
    audio.init();
    if (this.mode === "dead" && !this.finalObj) this.finishRun("RUN ENDED");
    this.resetRun();
    this.mode = "play";
    this.requestLock();
    audio.setMode("explore");
    this.hint(input.touch ? "Tap ⚔ to attack — dodge incoming strikes" : "Dodge with Shift — attack with Click / J", 5);
    this.fade = 1; this.fadeTarget = 0;
    this.yaw = Math.PI + 0.35;
    setTimeout(() => { if (this.mode === "play" && !this.p.dead) this.ambush(); }, 700);
  }
  ambush() {
    const p = this.p;
    for (let i = 0; i < 3; i++) {
      const a = this.yaw + Math.PI + (i - 1) * 0.55 + (Math.random() - 0.5) * 0.2, d = 15 + Math.random() * 3;
      // spawn in front of camera view (behind camera yaw is "forward" for the camera convention)
      const x = p.pos.x + Math.sin(a + Math.PI) * d, z = p.pos.z + Math.cos(a + Math.PI) * d;
      const e = this.spawnEnemy("skitter", x, z, { aggro: true, camp: "start" });
      this.fx.burst(e.pos, 16, 0xb8a68c, 7, 1.2, 0.7, 6);
      this.fx.column(e.pos, 0xffa060, 1.2, 8, 0.5);
    }
    audio.roar(); this.fx.addShake(0.35);
    this.toast("Beasts are closing in!", "#ff8a6a");
  }
  requestLock() { if (!input.touch) { try { this.canvas.requestPointerLock(); } catch { /* ignore */ } } }
  pause() {
    if (this.mode !== "play") return;
    this.mode = "pause"; audio.setMode("off");
    if (document.pointerLockElement) document.exitPointerLock();
  }
  resume() {
    if (this.mode !== "pause" && this.mode !== "menu") return;
    this.mode = "play"; this.menuOpening = false; this.requestLock(); this.updateMusic();
  }
  openMenu() {
    if (this.mode !== "play") return;
    this.menuOpening = true;
    this.mode = "menu"; if (document.pointerLockElement) document.exitPointerLock();
  }
  endRun(title = "RUN ENDED") { this.finishRun(title); }
  toTitle() {
    this.mode = "start"; audio.setMode("off");
    if (document.pointerLockElement) document.exitPointerLock();
    this.resetRun(); this.mode = "start"; this.env.time = 0.62;
  }

  /* ---------------- loop ---------------- */
  tick = () => {
    let dt = Math.min(this.clock.getDelta(), 0.05);
    this.frameAcc += dt; this.frameN++;
    if (this.frameAcc > 1.5) { this.fps = this.frameN / this.frameAcc; this.adaptQuality(this.frameAcc / this.frameN); this.frameAcc = 0; this.frameN = 0; }
    const realDt = dt;
    if (this.hitStopT > 0) { this.hitStopT -= realDt; dt *= 0.04; }
    else if (this.slowT > 0) { this.slowT -= realDt; dt *= this.slowScale; }
    this.timeScale = dt / Math.max(realDt, 1e-5);
    if (this.mode === "play") this.update(dt, realDt);
    else if (this.mode === "start") this.updateStart(realDt);
    else if (this.mode === "dead") this.updateDead(dt, realDt);
    else this.updateStatic(realDt);
    if (this.fade !== this.fadeTarget) this.fade += clamp(this.fadeTarget - this.fade, -realDt * 3, realDt * 3);
    this.tide.material instanceof THREE.ShaderMaterial && (this.tide.material.uniforms.uT.value = this.time);
    this.renderer.render(this.scene, this.camera);
    input.endFrame();
    this.hudT -= realDt;
    if (this.hudT <= 0) { this.hudT = 0.085; this.emitHud(); }
    this.miniT -= realDt;
    if (this.miniT <= 0) { this.miniT = 0.07; if (this.minimap) this.drawMinimap(); if (this.mapCanvas && (this.mode === "menu" || this.mode === "pause")) this.drawMap(); }
  };
  adaptQuality(avg: number) {
    if (avg > 0.024 && this.pixelRatio > 0.7) { this.pixelRatio = Math.max(0.7, this.pixelRatio - 0.15); this.renderer.setPixelRatio(this.pixelRatio); this.onResize(); }
    else if (avg < 0.0155 && this.pixelRatio < this.maxPR) { this.pixelRatio = Math.min(this.maxPR, this.pixelRatio + 0.1); this.renderer.setPixelRatio(this.pixelRatio); this.onResize(); }
  }

  updateStart(dt: number) {
    this.time += dt; this.startOrbit += dt * 0.08;
    const c = this.p.pos;
    const a = this.startOrbit + 1.2;
    this.camera.position.set(c.x + Math.sin(a) * 22, c.y + 8 + Math.sin(this.time * 0.2) * 1.5, c.z + Math.cos(a) * 22);
    this.camera.lookAt(c.x, c.y + 3.5, c.z);
    this.camera.fov = 52; this.camera.updateProjectionMatrix();
    this.env.update(dt, this.camera, c, 0, false, false);
    this.world.update(this.time, this.camera.position);
    this.pm.root.position.copy(c); this.pm.root.rotation.y = a + Math.PI;
    this.animatePlayer(dt);
    this.updateVesper(dt);
    this.fx.update(dt, this.camera, this.renderer.domElement.height);
    if (Math.random() < dt * 8) this.fx.emit(c.x + (Math.random() - 0.5) * 20, c.y + 0.5, c.z + (Math.random() - 0.5) * 20, 0.5, 2, 0.3, 0xffa060, 0.35, 3, 0, 0);
  }
  updateStatic(dt: number) {
    this.time += dt;
    this.world.update(this.time, this.camera.position);
    this.fx.update(0, this.camera, this.renderer.domElement.height);
  }
  updateDead(dt: number, realDt: number) {
    this.time += realDt;
    const p = this.p;
    this.fx.update(dt, this.camera, this.renderer.domElement.height);
    this.world.update(this.time, this.camera.position);
    this.animatePlayer(dt);
    const a = this.time * 0.15;
    this.camera.position.lerp(this.tmpV.set(p.pos.x + Math.sin(a) * 9, p.pos.y + 5.5, p.pos.z + Math.cos(a) * 9), 0.03);
    this.camera.lookAt(p.pos.x, p.pos.y + 0.5, p.pos.z);
    this.env.update(dt, this.camera, p.pos, this.world.terrain.biomeAt(p.pos.x, p.pos.z), false, false);
    for (const e of this.enemies) if (e.alive) e.update(dt * 0.3);
  }

  update(dt: number, realDt: number) {
    const p = this.p;
    this.time += dt; this.runTime += dt;
    // buffers
    for (const k in this.buf) this.buf[k] = Math.max(0, this.buf[k] - realDt);
    for (const k of ["attack", "dodge", "skill1", "skill2", "vesper", "heavy", "jump", "ult", "core"] as const) if (input.pressed(k)) this.buf[k] = 0.2;
    if (input.pressed("pause")) { this.pause(); return; }
    if (input.pressed("map")) { this.openMenu(); return; }
    // cinematic skip
    if (this.cine?.skippable && (input.pressed("attack") || input.pressed("jump") || input.pressed("advance") || input.pressed("interact"))) { this.cine.t = this.cine.dur; }
    // dialogue
    if (this.dialogue) {
      if (input.pressed("advance") || input.pressed("interact") || input.pressed("attack") || input.pressed("jump")) this.advanceDialogue();
      this.updateCamera(realDt, true);
      this.env.update(realDt, this.camera, p.pos, this.currentRegionIdx(), false, false);
      this.world.update(this.time, this.camera.position);
      this.animatePlayer(realDt); this.updateVesper(realDt * 0.2);
      this.fx.update(realDt, this.camera, this.renderer.domElement.height);
      this.updateOverlays(realDt);
      return;
    }
    const cinActive = !!this.cine;
    this.attackers = this.enemies.reduce((n, e) => n + (e.alive && !e.isBoss && e.kind !== "kite" && (e.state === "windup" || e.state === "attack") ? 1 : 0), 0);
    if (!cinActive && !p.dead) { this.handleLook(); this.handleActions(dt); }
    this.updatePlayer(dt);
    this.updateVesper(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateBlooms(dt);
    this.updateOrbs(dt);
    this.updateSpawns(dt);
    this.updateDiscovery(dt);
    this.updateStory(dt);
    this.updateBoss(dt);
    this.updateInteract();
    const reg = this.currentRegionIdx();
    this.env.update(dt, this.camera, p.pos, reg, this.bossActive && !this.bossWon, this.camera.position.y < SEA - 0.2);
    this.world.update(this.time, this.camera.position);
    this.updateCamera(dt, false);
    this.fx.update(dt, this.camera, this.renderer.domElement.height);
    this.updateOverlays(realDt);
    this.updateMusic();
    this.skyray.position.x += dt * 6; if (this.skyray.position.x > 900) this.skyray.position.x = -900;
    this.skyray.position.z = this.p.pos.z + 200; this.skyray.lookAt(this.skyray.position.x, 0, this.skyray.position.z);
    // cine tick
    if (this.cine) {
      this.cine.t += realDt;
      const k = Math.min(1, this.cine.t / this.cine.dur);
      this.cine.fn(k);
      if (this.cine.t >= this.cine.dur) { const e = this.cine.end; this.cine = null; e?.(); }
    }
    if (this.fx.shake > 0) this.fx.shake = Math.max(0, this.fx.shake - realDt * 2.6);
  }

  updateMusic() {
    if (this.mode !== "play") return;
    if (this.bossActive && !this.bossWon && this.boss.alive) audio.setMode("boss");
    else {
      const near = this.enemies.some((e) => e.alive && e.aggro && e.kind !== "grazer" && e.dist < 40);
      audio.setMode(near ? "combat" : "explore");
    }
    audio.setWind(this.env.wI * (this.env.weather === "storm" || this.env.weather === "sand" ? 1 : 0.5) + (this.p.glide ? 0.5 : 0));
  }
  currentRegionIdx() { return this.world.terrain.biomeAt(this.p.pos.x, this.p.pos.z); }

  /* ---------------- camera ---------------- */
  handleLook() {
    const s = 0.0024 * input.sens;
    this.yaw -= input.look.x * s; this.pitch += input.look.y * s;
    const ks = 2.2 * (1 / 60);
    if (input.keys.has("ArrowLeft")) this.yaw += ks * 1.0; if (input.keys.has("ArrowRight")) this.yaw -= ks * 1.0;
    if (input.keys.has("ArrowUp")) this.pitch -= ks * 0.6; if (input.keys.has("ArrowDown")) this.pitch += ks * 0.6;
    this.pitch = clamp(this.pitch, -0.45, 1.3);
  }
  updateCamera(dt: number, still: boolean) {
    if (this.cine) return;
    const p = this.p, w = this.world;
    // lock-on
    const lt = this.lockTarget;
    if (lt && (!lt.alive || lt.dist > 45)) this.lockTarget = null;
    if (this.lockTarget && !still) {
      const l = this.lockTarget;
      const want = Math.atan2(p.pos.x - l.pos.x, p.pos.z - l.pos.z) + Math.PI; // yaw so camera forward points to target
      this.yaw += angDiff(want, this.yaw) * Math.min(1, dt * 6);
      const dh = (l.pos.y + l.height * 0.5) - (p.pos.y + 1.4), dd = Math.hypot(l.pos.x - p.pos.x, l.pos.z - p.pos.z);
      this.pitch += (clamp(0.32 - Math.atan2(dh, dd + 3) * 0.7, -0.2, 0.9) - this.pitch) * Math.min(1, dt * 3);
    }
    const bossCam = this.bossActive && !this.bossWon && this.boss.alive;
    const wantDist = (p.mounted ? 10.5 : p.glide ? 9 : 7.4) + (bossCam ? 4 : 0) + (this.lockTarget?.elite ? 2 : 0);
    this.camDist += (wantDist - this.camDist) * Math.min(1, dt * 3);
    const target = this.tmpV.set(p.pos.x, p.pos.y + (p.mounted ? 2.6 : p.swim ? 0.9 : 1.55), p.pos.z);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    let d = this.camDist;
    const rx = -fz, rz = fx;
    const sh = 0.55;
    for (let it = 0; it < 6; it++) {
      const cx = target.x - fx * cp * d + rx * sh, cz = target.z - fz * cp * d + rz * sh, cy = target.y + sp * d;
      if (cy > w.floor(cx, cz, cy) + 0.7) break;
      d *= 0.8;
    }
    const cx = target.x - fx * cp * d + rx * sh, cz = target.z - fz * cp * d + rz * sh;
    let cy = target.y + sp * d;
    cy = Math.max(cy, w.floor(cx, cz, cy) + 0.7);
    if (this.cinematicHold) { /* hold */ }
    this.camera.position.set(cx, cy, cz);
    // shake
    const sk = this.fx.shake * this.fx.shake;
    if (sk > 0.0005) this.camera.position.add(this.tmpV2.set((Math.random() - 0.5) * sk * 0.9, (Math.random() - 0.5) * sk * 0.9, (Math.random() - 0.5) * sk * 0.9));
    this.camLook.set(target.x + rx * sh * 0.4, target.y + 0.15, target.z + rz * sh * 0.4);
    this.camera.lookAt(this.camLook);
    // fov
    const spd = Math.hypot(p.vel.x, p.vel.z);
    const wantFov = 60 + clamp((spd - 6) * 1.1, 0, 10) + (p.glide ? 6 : 0) + p.speedFov + (this.fx.shake > 0.5 ? 2 : 0);
    this.fov += (wantFov - this.fov) * Math.min(1, dt * 6);
    p.speedFov *= Math.exp(-dt * 6);
    this.camera.fov = this.fov; this.camera.updateProjectionMatrix();
    if (p.dead) return;
  }
  cinematicHold = false;
  tmpV2 = new V3();
  startCine(dur: number, fn: (k: number) => void, end?: () => void, skippable = false) {
    this.cine = { t: 0, dur, fn, end, skippable };
  }

  /* ---------------- HUD ---------------- */
  banner(text: string, sub = "", color = "#ffe0a0") { this.bannerObj = { id: this.seq++, text, sub, color, t: 4 }; }
  toast(text: string, color = "#ffffff") { this.toasts.push({ id: this.seq++, text, color, t: 3.4 }); if (this.toasts.length > 5) this.toasts.shift(); }
  hint(text: string, sec = 6) { this.hintObj = { text, t: sec }; }
  say(name: string, lines: string[], done?: () => void) { this.dialogue = { name, lines, i: 0, done }; audio.ui(); }
  advanceDialogue() {
    const d = this.dialogue; if (!d) return;
    audio.ui();
    d.i++;
    if (d.i >= d.lines.length) { this.dialogue = null; d.done?.(); }
  }
  updateOverlays(dt: number) {
    if (this.bannerObj) { this.bannerObj.t -= dt; if (this.bannerObj.t <= 0) this.bannerObj = null; }
    if (this.hintObj) { this.hintObj.t -= dt; if (this.hintObj.t <= 0) this.hintObj = null; }
    if (this.subtitle) { this.subtitle.t -= dt; if (this.subtitle.t <= 0) this.subtitle = null; }
    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter((t) => t.t > 0);
    this.updateBars();
  }
  updateBars() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    const used = new Set<number>();
    const cam = this.camera;
    for (const e of this.enemies) {
      if (!e.alive || e.isBoss || e.kind === "grazer" || !e.aggro || e.dist > 38 || e.hp >= e.maxHp * 0.999 && e.state !== "windup") continue;
      this.tmpV.copy(e.pos); this.tmpV.y += e.height * e.def.scale * 0.5 + 1.2;
      this.tmpV.project(cam);
      if (this.tmpV.z > 1) continue;
      used.add(e.id);
      let b = this.barEls.get(e.id);
      if (!b) {
        const el = document.createElement("div");
        el.style.cssText = "position:absolute;left:0;top:0;width:" + (e.elite ? 90 : 52) + "px;height:6px;background:#000a;border:1px solid #000;border-radius:3px;overflow:hidden;will-change:transform";
        const fill = document.createElement("div"); fill.style.cssText = "height:100%;background:linear-gradient(#ff8a6a,#d83a2a);";
        el.appendChild(fill); this.barLayer.appendChild(el); b = { el, fill }; this.barEls.set(e.id, b);
      }
      b.el.style.transform = `translate(${(this.tmpV.x * 0.5 + 0.5) * w}px,${(-this.tmpV.y * 0.5 + 0.5) * h}px) translate(-50%,-50%)`;
      b.fill.style.width = (e.hp / e.maxHp) * 100 + "%";
    }
    for (const [id, b] of this.barEls) if (!used.has(id)) { b.el.remove(); this.barEls.delete(id); }
    if (this.lockTarget && this.lockTarget.alive) {
      this.tmpV.copy(this.lockTarget.pos); this.tmpV.y += this.lockTarget.height * this.lockTarget.def.scale * 0.5 + 0.3; this.tmpV.project(cam);
      if (this.tmpV.z < 1) { this.lockEl.style.display = "block"; this.lockEl.style.transform = `translate(${(this.tmpV.x * 0.5 + 0.5) * w - 23}px,${(-this.tmpV.y * 0.5 + 0.5) * h - 23}px)`; } else this.lockEl.style.display = "none";
    } else this.lockEl.style.display = "none";
  }

  questTarget(): THREE.Vector3 | null {
    const id = QUESTS[this.quest]?.id;
    const w = this.world;
    if (id === "tablet") return w.tablets[0].pos;
    if (id === "village") return w.npcs[0].pos;
    if (id === "portal") return w.portals[0].pos;
    if (id === "warden") return w.stadium.center;
    return null;
  }

  emitHud() {
    if (!this.onHud) return;
    const p = this.p;
    const qt = this.questTarget();
    const q = QUESTS[this.quest];
    let quest: Hud["quest"] = null;
    if (q) {
      let dist = -1, ang = 0;
      if (qt) { dist = Math.hypot(qt.x - p.pos.x, qt.z - p.pos.z); ang = Math.atan2(qt.x - p.pos.x, qt.z - p.pos.z) - this.yaw; }
      quest = { id: q.id, title: q.title, desc: q.desc, dist, ang };
    }
    const b = this.boss;
    const boss: Hud["boss"] = this.bossActive && !this.bossWon && b.alive ? { name: "THE WARDEN", title: "Keeper of the Last Gate", hp: Math.max(0, b.hp), max: b.maxHp, phase: b.phase, shield: b.shield, poise: b.poise / b.maxPoise } : null;
    const cdf = (c: number, m: number) => clamp(c / m, 0, 1);
    const lv = p.level;
    this.onHud({
      screen: this.mode === "pause" ? "pause" : this.mode,
      hp: p.hp, maxHp: this.maxHp(), st: p.st, maxSt: this.maxSt(), en: p.en, level: lv, xp: p.xp, xpNext: this.xpNext(), sp: p.sp,
      score: Math.floor(this.score), combo: this.combo, mult: this.mult(), cores: p.cores, coreT: p.coreT, coreMax: this.coreDur(),
      cd: { s1: cdf(p.cd.s1, this.galeCd()), s2: cdf(p.cd.s2, 11), vs: cdf(p.cd.vs, this.vsCd()), sense: cdf(p.cd.sense, 14), core: 0 },
      unlock: { s2: lv >= 2, vesper: lv >= 2, mount: lv >= 3, ult: lv >= 4, sense: lv >= 2 },
      ultReady: p.en >= 100, region: this.world.regionName(p.pos.x, p.pos.z), quest, boss,
      prompt: this.prompt, hint: this.hintObj?.text ?? null, banner: this.bannerObj ? { id: this.bannerObj.id, text: this.bannerObj.text, sub: this.bannerObj.sub, color: this.bannerObj.color } : null,
      toasts: this.toasts.map((t) => ({ id: t.id, text: t.text, color: t.color })),
      dialogue: this.dialogue ? { name: this.dialogue.name, text: this.dialogue.lines[this.dialogue.i], i: this.dialogue.i, n: this.dialogue.lines.length } : null,
      subtitle: this.subtitle ? { name: this.subtitle.name, text: this.subtitle.text } : null,
      underwater: this.camera.position.y < SEA - 0.1, o2: p.o2, fade: this.fade, charge: p.charging ? clamp(p.charge, 0, 1) : 0,
      lock: !!this.lockTarget, mounted: p.mounted, gliding: p.glide, climbing: p.climb, swimming: p.swim,
      tod: this.env.time, weather: this.env.weather, bossWon: this.bossWon, hurt: p.hurtT, slow: this.slowT > 0 && this.slowScale < 0.6, cine: !!this.cine,
      final: this.finalObj, fps: Math.round(this.fps), locked: input.locked,
      stats: { kills: this.stats.kills, chests: this.stats.chests, tablets: this.stats.tablets, discoveries: this.stats.discoveries, portals: this.stats.portals },
    });
  }

  /* ---------------- map ---------------- */
  buildMapBase() {
    const S = this.mapSize, ctx = this.mapBase.getContext("2d")!;
    const img = ctx.createImageData(S, S);
    const T = this.world.terrain;
    const cols = [[150, 128, 100], [70, 130, 70], [214, 178, 108], [150, 160, 165]];
    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        const x = (i / S) * TERRAIN_SIZE - HALF, z = (j / S) * TERRAIN_SIZE - HALF;
        const h = T.groundAt(x, z);
        const k = (j * S + i) * 4;
        let r: number, g: number, b: number;
        if (h < SEA) { const d = clamp(-h / 30, 0, 1); r = 30 - d * 15; g = 90 - d * 40; b = 140 - d * 40; }
        else {
          const bi = T.biomeAt(x, z); const c = cols[bi];
          const sh = clamp((T.groundAt(x - 6, z - 6) - h) * 0.08 + 1, 0.6, 1.4);
          const hh = 0.8 + clamp(h / 120, 0, 0.5);
          r = c[0] * sh * hh; g = c[1] * sh * hh; b = c[2] * sh * hh;
          if (h > 95) { r = g = b = 235 * sh; }
        }
        img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  revealFog(x: number, z: number, r: number) {
    const f = this.fogCtx, s = this.fogSize / TERRAIN_SIZE;
    const cx = (x + HALF) * s, cy = (z + HALF) * s, rr = r * s;
    f.globalCompositeOperation = "destination-out";
    const g = f.createRadialGradient(cx, cy, rr * 0.4, cx, cy, rr);
    g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
    f.fillStyle = g; f.beginPath(); f.arc(cx, cy, rr, 0, 7); f.fill();
  }
  w2m(x: number, z: number): [number, number] { return [((x + HALF) / TERRAIN_SIZE) * this.mapSize, ((z + HALF) / TERRAIN_SIZE) * this.mapSize]; }
  drawMarkers(ctx: CanvasRenderingContext2D, scale: number, labels: boolean) {
    const w = this.world;
    const dot = (x: number, z: number, col: string, r: number) => { const [mx, my] = this.w2m(x, z); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(mx, my, r / scale, 0, 7); ctx.fill(); ctx.strokeStyle = "#000a"; ctx.lineWidth = 1 / scale; ctx.stroke(); };
    for (const c of w.chests) if (!c.opened && (c.revealed)) dot(c.pos.x, c.pos.z, RARITY_COL[Math.min(4, c.tier + 1)], 3.5);
    for (const t of w.tablets) if (!t.read && this.isSeen(t.pos.x, t.pos.z)) dot(t.pos.x, t.pos.z, "#56e8ff", 3);
    for (const pt of w.portals) if (pt.found) {
      const [mx, my] = this.w2m(pt.pos.x, pt.pos.z);
      ctx.save(); ctx.translate(mx, my); ctx.rotate(Math.PI / 4); const s = 5 / scale; ctx.fillStyle = pt.active ? "#56e8ff" : "#777"; ctx.fillRect(-s / 2, -s / 2, s, s); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1 / scale; ctx.strokeRect(-s / 2, -s / 2, s, s); ctx.restore();
    }
    for (const po of w.pois) if (po.discovered && po.kind !== "portal") {
      dot(po.pos.x, po.pos.z, po.kind === "stadium" ? "#ff6a4a" : po.kind === "village" ? "#ffd070" : "#ffffff", po.kind === "stadium" ? 5 : 3.2);
      if (labels) { const [mx, my] = this.w2m(po.pos.x, po.pos.z); ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000"; ctx.lineWidth = 3 / scale; ctx.font = `bold ${11 / scale}px sans-serif`; ctx.textAlign = "center"; ctx.strokeText(po.name, mx, my - 8 / scale); ctx.fillText(po.name, mx, my - 8 / scale); }
    }
    if (this.senseT > 0) for (const e of this.enemies) if (e.alive && e.kind !== "grazer") dot(e.pos.x, e.pos.z, "#ff4a3a", 3);
    const qt = this.questTarget();
    if (qt) {
      const [mx, my] = this.w2m(qt.x, qt.z);
      ctx.save(); ctx.translate(mx, my); ctx.rotate(Math.PI / 4); const s = 7 / scale; ctx.fillStyle = "#ffd24a"; ctx.fillRect(-s / 2, -s / 2, s, s); ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5 / scale; ctx.strokeRect(-s / 2, -s / 2, s, s); ctx.restore();
    }
  }
  isSeen(x: number, z: number) {
    const s = this.fogSize / TERRAIN_SIZE;
    return this.fogCtx.getImageData(Math.floor((x + HALF) * s), Math.floor((z + HALF) * s), 1, 1).data[3] < 128;
  }
  drawMinimap() {
    const c = this.minimap!; const ctx = c.getContext("2d")!; const S = c.width, R = S / 2;
    const p = this.p;
    ctx.clearRect(0, 0, S, S);
    ctx.save(); ctx.beginPath(); ctx.arc(R, R, R - 2, 0, 7); ctx.clip();
    ctx.fillStyle = "#06101c"; ctx.fillRect(0, 0, S, S);
    const scale = (R / 230) / (this.mapSize / TERRAIN_SIZE);
    const [mx, my] = this.w2m(p.pos.x, p.pos.z);
    ctx.translate(R, R); ctx.rotate(this.yaw - Math.PI); ctx.scale(scale, scale); ctx.translate(-mx, -my);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.mapBase, 0, 0);
    ctx.globalAlpha = 0.88; ctx.drawImage(this.fogC, 0, 0, this.mapSize, this.mapSize); ctx.globalAlpha = 1;
    this.drawMarkers(ctx, scale, false);
    for (const e of this.enemies) if (e.alive && e.aggro && e.kind !== "grazer" && e.dist < 60) { const [ex, ey] = this.w2m(e.pos.x, e.pos.z); ctx.fillStyle = "#ff3b2e"; ctx.beginPath(); ctx.arc(ex, ey, 2.5 / scale, 0, 7); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = "#e8d9a8"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(R, R, R - 2, 0, 7); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(R, R - 8); ctx.lineTo(R + 6, R + 7); ctx.lineTo(R, R + 3); ctx.lineTo(R - 6, R + 7); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  drawMap() {
    const c = this.mapCanvas!; const ctx = c.getContext("2d")!; const S = c.width;
    const sc = S / this.mapSize;
    ctx.fillStyle = "#06101c"; ctx.fillRect(0, 0, S, S);
    ctx.save(); ctx.scale(sc, sc);
    ctx.drawImage(this.mapBase, 0, 0);
    ctx.globalAlpha = 0.9; ctx.drawImage(this.fogC, 0, 0, this.mapSize, this.mapSize); ctx.globalAlpha = 1;
    this.drawMarkers(ctx, sc, true);
    const [mx, my] = this.w2m(this.p.pos.x, this.p.pos.z);
    ctx.translate(mx, my); ctx.rotate(Math.PI - this.yaw);
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5 / sc;
    const k = 9 / sc; ctx.beginPath(); ctx.moveTo(0, -k); ctx.lineTo(k * 0.7, k * 0.8); ctx.lineTo(0, k * 0.3); ctx.lineTo(-k * 0.7, k * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  mapClick(nx: number, ny: number) {
    if (this.bossActive && !this.bossWon) { this.toast("The gate is sealed — no Waystone answers.", "#ff8a6a"); return; }
    const x = nx * TERRAIN_SIZE - HALF, z = ny * TERRAIN_SIZE - HALF;
    let best: Portal | null = null, bd = 90;
    for (const pt of this.world.portals) if (pt.active) { const d = Math.hypot(pt.pos.x - x, pt.pos.z - z); if (d < bd) { bd = d; best = pt; } }
    if (best) this.teleport(best);
    else this.toast("Select an active Waystone to travel", "#ffd24a");
  }
  teleport(pt: Portal) {
    this.fadeTarget = 1; audio.portal();
    this.mode = "play"; this.menuOpening = false; this.requestLock();
    this.cine = { t: 0, dur: 0.6, skippable: false, fn: () => {}, end: () => {
      const p = this.p;
      p.pos.set(pt.pos.x + Math.sin(0) * 0, 0, pt.pos.z + 5); p.pos.y = this.world.floor(p.pos.x, p.pos.z, pt.pos.y + 2);
      p.vel.set(0, 0, 0); p.vy = 0; p.mounted = false; this.vesper.pos.copy(p.pos);
      this.fadeTarget = 0; this.fx.ring(p.pos, 0x56e8ff, 1, 10, 0.8); this.toast("Arrived at " + pt.name, "#56e8ff");
      this.revealFog(p.pos.x, p.pos.z, 90);
    } };
  }

  /* ---------------- player stats ---------------- */
  gearStats() {
    let atk = 0, hp = 0;
    for (const s of ["weapon", "armor", "charm"] as Slot[]) { const id = this.equipped[s]; if (id) { const g = gearById(id); atk += g.atk; hp += g.hp; } }
    return { atk, hp };
  }
  sk(id: string) { return this.skills[id] || 0; }
  maxHp() { return 200 + (this.p.level - 1) * 28 + this.gearStats().hp + this.sk("vital") * 45; }
  maxSt() { return 100 + this.sk("endur") * 20; }
  xpNext() { const l = this.p.level; return Math.round(50 + l * l * 14 + l * 30); }
  mult() { return 1 + Math.min(3, Math.floor(this.combo / 6) * 0.25); }
  atkPower() { const p = this.p; return (18 + p.level * 3.2 + this.gearStats().atk) * (1 + 0.08 * this.sk("blade")) * (p.coreT > 0 ? 1.3 : 1) * (p.counter > 0 ? 1.5 : 1); }
  coreDur() { return 28 + this.sk("core") * 6; }
  galeCd() { return 6 * (1 - this.sk("gale") * 0.12); }
  vsCd() { return 8 * (1 - this.sk("bond") * 0.05); }
  staminaUse(n: number) { this.p.st = Math.max(0, this.p.st - n); this.p.stRegenT = 0.7; }
  addScorePts(n: number, at?: THREE.Vector3, color = "#ffe08a") {
    this.score += n;
    if (at && n >= 100) this.fx.number(at.clone().setY(at.y + 2.4), "+" + Math.floor(n), color, 16);
  }
  gainXp(n: number) {
    const p = this.p; p.xp += n;
    while (p.xp >= this.xpNext() && p.level < 30) {
      p.xp -= this.xpNext(); p.level++; p.sp++;
      p.hp = Math.min(this.maxHp(), p.hp + this.maxHp() * 0.35);
      audio.level(); this.fx.ring(p.pos, 0xffe08a, 1, 9, 0.7); this.fx.column(p.pos, 0xffe08a, 1.5, 14, 0.7);
      this.fx.burst(p.pos.clone().setY(p.pos.y + 1), 30, 0xffe08a, 9, 1, 1, -1);
      let sub = "+1 Skill Point";
      if (p.level === 2) sub = "Gravity Bloom · Vesper Strike · Vesper Sense unlocked";
      else if (p.level === 3) sub = "Vesper can now be ridden (V)";
      else if (p.level === 4) sub = "Astral Judgement unlocked (R)";
      this.banner("LEVEL " + p.level, sub, "#ffe08a");
      this.addScorePts(150 * p.level);
    }
  }
  giveGear(g: Gear, quiet = false) {
    if (this.owned.has(g.id)) return false;
    this.owned.add(g.id);
    const cur = this.equipped[g.slot];
    const better = !cur || gearScore(g) > gearScore(gearById(cur));
    if (better) this.equipped[g.slot] = g.id;
    if (!quiet) this.toast(`${better ? "Equipped" : "Found"}: ${g.name} (${RARITY[g.rarity]})`, RARITY_COL[g.rarity]);
    const mh = this.maxHp(); if (better) this.p.hp = Math.min(mh, this.p.hp + (g.hp || 0));
    return true;
  }
  equip(id: string) { const g = gearById(id); if (this.owned.has(id)) { this.equipped[g.slot] = id; audio.ui(); } }
  spendSkill(id: string) {
    const d = SKILL_DEFS.find((s) => s.id === id)!; const p = this.p;
    if (p.sp > 0 && this.sk(id) < d.max) { p.sp--; this.skills[id] = this.sk(id) + 1; audio.pickup(); p.hp = Math.min(this.maxHp(), p.hp + 40); }
  }

  /* ---------------- player update ---------------- */
  canCancel(kind: "dodge" | "skill") {
    const a = this.p.act; if (!a) return true;
    if (a.kind === "ult" || a.kind === "core" || a.kind === "wake" || a.kind === "plunge") return false;
    if (a.kind === "charging") return true;
    if (kind === "dodge") return a.kind !== "dodge" && (a.hit || a.t > 0.12 || a.kind === "gale" || a.kind === "bloom" || a.kind === "call");
    if (["atk", "heavy", "rush", "air", "spin"].includes(a.kind)) return a.hit || a.t > a.dur * 0.55;
    return a.t > a.dur * 0.7;
  }
  hasTarget() { return this.enemies.some((e) => e.alive && e.kind !== "grazer" && e.dist < 40); }

  pickTarget(maxD: number, cone: number, prefer?: THREE.Vector3): Enemy | null {
    const p = this.p;
    if (this.lockTarget && this.lockTarget.alive && this.lockTarget.dist < maxD * 1.8) return this.lockTarget;
    let dirx = Math.sin(p.yaw), dirz = Math.cos(p.yaw);
    if (prefer) { dirx = prefer.x; dirz = prefer.z; }
    let best: Enemy | null = null, bs = 1e9;
    for (const e of this.enemies) {
      if (!e.alive || e.kind === "grazer" || (e.isBoss && (e as Warden).dormant)) continue;
      const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dz) - e.radius;
      if (d > maxD) continue;
      const ang = Math.abs(angDiff(Math.atan2(dx, dz), Math.atan2(dirx, dirz)));
      if (ang > cone) continue;
      const s = d + ang * 6;
      if (s < bs) { bs = s; best = e; }
    }
    return best;
  }
  faceTarget(e: Enemy) { this.p.yaw = Math.atan2(e.pos.x - this.p.pos.x, e.pos.z - this.p.pos.z); }

  newAct(kind: string, dur: number, hitT: number, i = 0): ActState {
    const p = this.p;
    const a: ActState = { kind, t: 0, dur, hitT, hit: false, i, dir: new V3(Math.sin(p.yaw), 0, Math.cos(p.yaw)), data: {}, hitSet: new Set() };
    p.act = a; p.charging = false; p.charge = 0; p.blocking = false;
    return a;
  }
  moveDirWorld() {
    const mv = input.moveVec();
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    return { x: fx * mv.y - fz * mv.x, z: fz * mv.y + fx * mv.x, moving: Math.abs(mv.x) + Math.abs(mv.y) > 0.1 };
  }

  handleActions(dt: number) {
    const p = this.p, I = input, lv = p.level;
    if (I.pressed("lock")) this.toggleLock();
    if (I.pressed("mount")) this.toggleMount();
    if (I.pressed("interact") && this.interactTarget) this.doInteract();
    if (p.stagger > 0) { p.blocking = false; return; }
    // block / parry
    const wantBlock = I.down("block") && (!p.act || p.act.kind === "charging" || this.canCancel("skill")) && !p.swim && !p.climb && !p.glide && !p.flying && p.st > 0;
    if (wantBlock && !p.blocking) { p.blocking = true; p.blockT = 0; if (p.act) { p.act = null; p.charging = false; } audio.tone(500, 0.06, "square", 0.06); }
    if (!wantBlock) p.blocking = false;
    if (p.blocking) { p.blockT += dt; this.staminaUse(0); }
    // dodge
    if (this.buf.dodge > 0 && p.dodgeCd <= 0 && p.st >= 8 && !p.swim && this.canCancel("dodge")) { this.buf.dodge = 0; this.startDodge(); return; }
    if (p.swim || p.climb) return;
    const free = this.canCancel("skill");
    // ultimate
    if (this.buf.ult > 0 && lv >= 4 && p.en >= 100 && free && !p.plunging) { this.buf.ult = 0; this.startUlt(); return; }
    else if (this.buf.ult > 0 && free) { this.buf.ult = 0; if (lv < 4) this.toast("Astral Judgement unlocks at level 4", "#ffd24a"); else this.toast("Energy not full", "#9ff0ff"); }
    // core
    if (this.buf.core > 0 && free) { this.buf.core = 0; this.tryCore(); return; }
    // skills
    if (this.buf.skill1 > 0 && p.cd.s1 <= 0 && free) { this.buf.skill1 = 0; this.startGale(); return; }
    if (this.buf.skill2 > 0 && free) { this.buf.skill2 = 0; if (lv < 2) this.toast("Gravity Bloom unlocks at level 2", "#ffd24a"); else if (p.cd.s2 <= 0) { this.startBloom(); return; } }
    if (this.buf.vesper > 0 && free) { this.buf.vesper = 0; if (lv < 2) this.toast("Vesper Strike unlocks at level 2", "#ffd24a"); else if (p.cd.vs <= 0) { this.startCall(); return; } }
    if (I.pressed("sense")) { if (lv < 2) this.toast("Vesper Sense unlocks at level 2", "#ffd24a"); else this.doSense(); }
    // heavy
    if (this.buf.heavy > 0 && free && p.st >= 10) {
      this.buf.heavy = 0;
      if (!p.grounded && p.pos.y - this.world.floor(p.pos.x, p.pos.z, p.pos.y) > 2.5) this.startPlunge(); else this.startHeavy();
      return;
    }
    // attack
    if (this.buf.attack > 0 && (!p.act || p.act.kind === "charging")) {
      if (p.mounted && !p.flying && false) return;
      this.buf.attack = 0; this.startAttack();
    }
    // charging continuation is managed in updateAct
  }
  toggleLock() {
    if (this.lockTarget) { this.lockTarget = null; return; }
    const e = this.pickTarget(34, 1.7); if (e) { this.lockTarget = e; audio.ui(); } else this.toast("No target", "#aaa");
  }
  toggleMount() {
    const p = this.p;
    if (p.level < 3) { this.toast("Vesper can be ridden from level 3", "#ffd24a"); return; }
    if (p.swim) return;
    p.mounted = !p.mounted; audio.vesper();
    this.fx.burst(p.pos.clone().setY(p.pos.y + 1), 20, 0xffb04a, 7, 1, 0.6, -1);
    this.fx.ring(p.pos, 0xffb04a, 1, 5, 0.4);
    if (!p.mounted) { p.flying = false; this.vesper.pos.copy(p.pos); }
    else { this.vesper.pos.copy(p.pos); p.glide = false; }
  }

  startDodge() {
    const p = this.p, md = this.moveDirWorld();
    let dx = md.x, dz = md.z;
    if (!md.moving) { dx = -Math.sin(p.yaw); dz = -Math.cos(p.yaw); }
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const a = this.newAct("dodge", 0.34, 99);
    a.dir.set(dx, 0, dz);
    if (md.moving) p.yaw = Math.atan2(dx, dz);
    p.vel.set(dx * 18.5, 0, dz * 18.5);
    if (!p.grounded) p.vy = Math.max(p.vy, 0);
    p.glide = false; p.iframes = 0.3; p.dodgeCd = 0.38; this.staminaUse(p.grounded ? 14 : 10);
    p.speedFov = 7; audio.dodge();
    this.fx.dustPuff(p.pos, 6);
  }
  startAttack() {
    const p = this.p;
    const md = this.moveDirWorld();
    const air = !p.grounded && p.pos.y - this.world.floor(p.pos.x, p.pos.z, p.pos.y) > 1.2;
    const tgt = this.pickTarget(air ? 9 : 7.5, 1.3, md.moving ? new V3(md.x, 0, md.z) : undefined);
    if (tgt) this.faceTarget(tgt); else if (md.moving) p.yaw = Math.atan2(md.x, md.z);
    this.tutorial("attack");
    if (air) {
      if (p.airIdx >= 3) return;
      const i = p.airIdx++;
      const a = this.newAct("air", 0.34, 0.1, i); void a;
      p.vy = Math.max(p.vy, 2.2); p.glide = false;
      audio.swing(i); return;
    }
    if (p.sprint && md.moving && p.grounded && p.st > 12) {
      this.newAct("rush", 0.62, 0.2); this.staminaUse(10); audio.swing(2); p.speedFov = 5; return;
    }
    const idx = p.comboTimer > 0 ? p.comboIdx : 0;
    const a = this.newAct("atk", COMBO[idx].dur, COMBO[idx].hit, idx);
    if (tgt && tgt.dist - tgt.radius < 1.9) a.data.noLunge = 1;
    audio.swing(idx);
    // swing arc FX right at the start so it feels instant
    const c = COMBO[idx];
    const f = a.dir, pos = this.tmpV.set(p.pos.x + f.x * 0.9, p.pos.y + 1.1, p.pos.z + f.z * 0.9);
    this.fx.slash(pos, p.yaw, c.range * 0.72, c.arc, c.col, c.tilt, c.roll, 0.2);
  }
  startHeavy() {
    const p = this.p;
    const tgt = this.pickTarget(8, 1.3); if (tgt) this.faceTarget(tgt);
    this.newAct("heavy", 0.85, 0.42); this.staminaUse(16); audio.tone(120, 0.4, "sawtooth", 0.1, 200);
    p.vel.multiplyScalar(0.2);
  }
  startPlunge() {
    const p = this.p;
    this.newAct("plunge", 5, 99); p.plunging = true; p.vy = -42; p.glide = false; this.staminaUse(10);
    audio.tone(500, 0.5, "sawtooth", 0.1, -350);
  }
  startCharging() {
    const p = this.p;
    this.newAct("charging", 99, 99); p.charging = true; p.charge = 0;
  }
  startSpin(power: number) {
    const p = this.p;
    const a = this.newAct("spin", 0.62, 0.17);
    a.data.power = power;
    this.staminaUse(18); audio.skill(); p.speedFov = 4;
    this.fx.ring(p.pos, 0xbfe8ff, 1, 6, 0.4);
  }
  startGale() {
    const p = this.p, md = this.moveDirWorld();
    const tgt = this.pickTarget(14, 1.6, md.moving ? new V3(md.x, 0, md.z) : undefined);
    if (tgt) this.faceTarget(tgt); else if (md.moving) p.yaw = Math.atan2(md.x, md.z);
    this.newAct("gale", 0.5, 99);
    p.cd.s1 = this.galeCd(); p.iframes = 0.28; p.vy = Math.max(p.vy, 0);
    p.synergy = 2.6; p.speedFov = 12; audio.skill();
    this.fx.ring(p.pos, 0x7ae8ff, 0.5, 4, 0.3, 1);
  }
  startBloom() {
    const p = this.p;
    const tgt = this.pickTarget(16, 1.5);
    if (tgt) this.faceTarget(tgt);
    const a = this.newAct("bloom", 0.6, 0.2);
    const f = a.dir;
    a.data.tx = tgt ? tgt.pos.x : p.pos.x + f.x * 9; a.data.tz = tgt ? tgt.pos.z : p.pos.z + f.z * 9;
    p.cd.s2 = 11; p.synergy = 2.6; audio.bloom();
  }
  startCall() {
    const p = this.p;
    const tgt = this.pickTarget(26, 2.2);
    if (tgt) this.faceTarget(tgt);
    this.newAct("call", 0.4, 0.12);
    p.cd.vs = this.vsCd(); audio.vesper();
    this.vesper.target = tgt;
  }
  startUlt() {
    const p = this.p;
    const a = this.newAct("ult", 2.7, 99); void a;
    p.en = 0; p.iframes = 3; p.vel.set(0, 0, 0); p.vy = 0; p.glide = false;
    audio.ult(); this.slow(0.2, 0.5);
    this.fx.flash("#ffffff", 0.8, 500);
    const o = p.pos.clone();
    const spots: Enemy[] = this.enemies.filter((e) => e.alive && e.kind !== "grazer" && e.dist < 22 && !(e.isBoss && (e as Warden).dormant));
    this.startCine(2.7, (k) => {
      const a2 = 0.6 + k * 2.2, r = 9 + Math.sin(k * 3.14) * 3;
      this.camera.position.set(o.x + Math.sin(a2) * r, o.y + 3 + k * 4, o.z + Math.cos(a2) * r);
      this.camLook.set(o.x, o.y + 2.5, o.z); this.camera.lookAt(this.camLook);
      this.camera.fov = 55 + Math.sin(k * 3.14) * 12; this.camera.updateProjectionMatrix();
    }, () => { p.act = null; });
    // schedule strikes
    for (let i = 0; i < 7; i++) {
      setTimeout(() => {
        if (this.mode !== "play") return;
        const t = spots.length ? spots[i % spots.length] : null;
        const pos = t && t.alive ? t.pos.clone() : new V3(o.x + (Math.random() - 0.5) * 24, 0, o.z + (Math.random() - 0.5) * 24);
        pos.y = this.world.ground(pos.x, pos.z);
        this.astralStrike(pos, i === 6);
      }, 600 + i * 230);
    }
    setTimeout(() => { if (this.mode === "play") this.astralBlast(o); }, 2300);
  }
  astralStrike(pos: THREE.Vector3, last: boolean) {
    this.fx.column(pos, 0xffe8a0, 2.4, 70, 0.5); this.fx.ring(pos, 0xffe8a0, 1, 7, 0.4); this.fx.burst(pos.clone().setY(pos.y + 1), 22, 0xffe8a0, 12, 1.2, 0.7, 6);
    this.fx.addShake(0.5); audio.hit(true); audio.tone(900, 0.3, "triangle", 0.12, -500);
    for (const e of this.enemies) {
      if (!e.alive || (e.isBoss && (e as Warden).dormant)) continue;
      if (Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) < 5 + e.radius) this.hitEnemy(e, last ? 2.0 : 1.2, { poise: 14, kb: 4, noStop: true });
    }
    this.hitPylonsAt(pos, 6, this.atkPower() * 1.2);
  }
  astralBlast(o: THREE.Vector3) {
    this.fx.sphere(o.clone().setY(o.y + 1.5), 0xffe8a0, 1, 17, 0.8); this.fx.ring(o, 0xffffff, 1, 22, 0.8); this.fx.flash("#fff4c0", 0.9, 700);
    this.fx.burst(o.clone().setY(o.y + 1.5), 80, 0xffe8a0, 26, 1.6, 1.2, 4);
    this.fx.addShake(1.3); audio.boom(); this.hitStopT = 0.12;
    for (const e of this.enemies) {
      if (!e.alive || (e.isBoss && (e as Warden).dormant)) continue;
      if (Math.hypot(e.pos.x - o.x, e.pos.z - o.z) < 17 + e.radius) this.hitEnemy(e, 3.6, { poise: 60, kb: 14, launch: true, noStop: true });
    }
    this.hitPylonsAt(o, 17, this.atkPower() * 3);
  }
  tryCore() {
    const p = this.p;
    if (p.cores <= 0) { this.toast("No Beast Core — they are dropped by the mightiest Beasts", "#ffb066"); return; }
    if (p.coreT > 0) { this.toast("Vesper is already ascended", "#ffb066"); return; }
    p.cores--; this.newAct("core", 2.2, 99); p.iframes = 2.4; p.vel.set(0, 0, 0);
    audio.core(); this.slow(0.3, 1.2);
    const v = this.vesper, o = p.pos.clone();
    this.startCine(2.2, (k) => {
      const tp = v.pos;
      const a = 1.0 + k * 1.8, r = 7 - k * 2;
      this.camera.position.set(tp.x + Math.sin(a) * r, tp.y + 1.8 + k * 1.5, tp.z + Math.cos(a) * r);
      this.camLook.set(tp.x, tp.y + 1.2, tp.z); this.camera.lookAt(this.camLook);
      this.camera.fov = 52 - k * 6; this.camera.updateProjectionMatrix();
      if (Math.random() < 0.7) this.fx.emit(tp.x + (Math.random() - 0.5) * 2, tp.y + Math.random() * 2, tp.z + (Math.random() - 0.5) * 2, 0, 5 + Math.random() * 5, 0, 0xffa040, 0.8, 0.9, 0, 0);
    }, () => { p.act = null; });
    setTimeout(() => {
      if (this.mode !== "play") return;
      p.coreT = this.coreDur(); p.coreMax = p.coreT;
      this.fx.flash("#ffd890", 0.95, 900); this.fx.sphere(v.pos.clone().setY(v.pos.y + 1.2), 0xffa040, 1, 14, 0.7); this.fx.ring(v.pos, 0xffd070, 1, 28, 0.9); this.fx.addShake(1.0);
      this.fx.burst(v.pos.clone().setY(v.pos.y + 1.5), 90, 0xffa040, 22, 1.5, 1.4, -1);
      audio.roar(); this.banner("VESPER ASCENDED", "Beast Core awakened — " + Math.round(p.coreT) + " seconds", "#ffb04a");
      void o;
    }, 1100);
  }
  endCore() {
    this.fx.ring(this.vesper.pos, 0xffa040, 1, 10, 0.6); this.toast("Vesper's flame settles…", "#ffb066"); this.p.flying = false; audio.tone(400, 0.8, "sine", 0.15, -250);
  }
  doSense() {
    const p = this.p;
    if (p.cd.sense > 0) return;
    p.cd.sense = 14; this.senseT = 9; audio.vesper(); audio.discover();
    this.fx.ring(p.pos, 0x7ae8ff, 1, 160, 1.2, 0.5);
    let n = 0;
    for (const c of this.world.chests) if (!c.opened && Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z) < 170 && !c.revealed) { c.revealed = true; n++; }
    this.toast(n ? `Vesper senses ${n} hidden treasure${n > 1 ? "s" : ""}!` : "Vesper senses nothing new nearby", "#7ae8ff");
    this.vesper.alert = 1.5;
  }
  slow(scale: number, dur: number) { this.slowScale = scale; this.slowT = dur; }
  hitStop(s: number) { this.hitStopT = Math.max(this.hitStopT, s); }
  addShake(a: number) { this.fx.addShake(a); }

  /* ---------------- player physics ---------------- */
  updatePlayer(dt: number) {
    const p = this.p, w = this.world, I = input;
    p.comboTimer -= dt; if (p.comboTimer <= 0 && !p.act) p.comboIdx = 0;
    p.dodgeCd -= dt; p.counter -= dt; p.perfectCd -= dt; p.iframes -= dt; p.stagger -= dt; p.hurtT = Math.max(0, p.hurtT - dt * 2); p.synergy -= dt;
    p.cd.s1 -= dt; p.cd.s2 -= dt; p.cd.vs -= dt; p.cd.sense -= dt;
    this.comboT -= dt; if (this.comboT <= 0 && this.combo > 0) this.combo = 0;
    if (this.senseT > 0) this.senseT -= dt;
    if (p.coreT > 0) { p.coreT -= dt; if (p.coreT <= 0) this.endCore(); }
    p.flying = p.mounted && p.coreT > 0;
    p.stRegenT -= dt;
    p.coyote -= dt;
    const maxSt = this.maxSt(), maxHp = this.maxHp();
    if (p.hp < maxHp && !this.hasAggro()) p.hp = Math.min(maxHp, p.hp + dt * 1.2);

    const md = (this.cine || p.dead) ? { x: 0, z: 0, moving: false } : this.moveDirWorld();
    const gy = w.ground(p.pos.x, p.pos.z);
    let fl = w.floor(p.pos.x, p.pos.z, p.pos.y);
    const deep = fl < SEA - 1.1;
    const act = p.act;
    const rooted = !!act && ["atk", "heavy", "rush", "air", "dodge", "gale", "spin", "plunge", "ult", "core", "wake", "bloom", "call"].includes(act.kind);
    if (p.dead) { p.vel.multiplyScalar(0.9); }

    // --- water state ---
    if (!p.swim && deep && p.pos.y <= SEA - 0.4 && !p.flying && !p.glide) {
      p.swim = true; p.mounted = false; p.climb = false; p.vy = 0; audio.splash();
      this.fx.burst(new V3(p.pos.x, SEA, p.pos.z), 24, 0xbfe8ff, 8, 0.8, 0.7, 14); this.fx.ring(new V3(p.pos.x, SEA, p.pos.z), 0xbfe8ff, 0.5, 4, 0.6, 0);
    }
    if (p.swim && (!deep || (fl > SEA - 0.9))) { p.swim = false; p.dive = false; }
    // --- update act (before movement so it can set velocities) ---
    if (act) this.updateAct(dt);

    // sprint
    const sprintKey = (I.down("dodge") && I.heldFor("dodge") > 0.16) || I.down("sprint");
    p.sprint = sprintKey && md.moving && !p.blocking && !p.charging && !rooted && (p.st > 1 || p.mounted);
    // --- horizontal ---
    let speed = 5.7;
    if (p.sprint) speed = 9.6;
    if (p.mounted && !p.flying) speed *= 1.75;
    if (p.flying) speed = p.sprint ? 31 : 21;
    if (p.blocking) speed *= 0.45;
    if (p.charging) speed *= 0.4;
    if (p.swim) speed = p.sprint ? 6.8 : 4.2;
    p.climb = false;
    let tx = md.x * speed, tz = md.z * speed;
    if (!p.swim && !p.flying && !p.glide && md.moving && (p.grounded || p.wasGrounded) && !rooted) {
      const ax = p.pos.x + md.x * 0.9, az = p.pos.z + md.z * 0.9;
      const slopeAhead = (w.ground(ax, az) - gy) / 0.9;
      const limit = p.mounted ? 1.9 : 1.1;
      if (slopeAhead > limit) {
        if (p.st > 0.5 && !p.mounted) {
          p.climb = true; tx = md.x * 2.5; tz = md.z * 2.5;
          this.staminaUse(0); p.st -= 9 * (1 - this.sk("wind") * 0.15) * dt;
          if (Math.random() < dt * 6) this.fx.emit(p.pos.x, p.pos.y + 1.2, p.pos.z, 0, 0.5, 0, 0xc8b898, 0.35, 0.5, 0, 0);
        } else if (!p.mounted) { tx = 0; tz = 0; if (!this.tut.nostam) { this.tut.nostam = true; this.toast("Out of stamina — find a gentler slope to rest", "#ffd24a"); } }
        else { tx = 0; tz = 0; }
      } else if (slopeAhead > 0.2) { const k = 1 - clamp(slopeAhead, 0, 1) * 0.35; tx *= k; tz *= k; }
    }
    if (p.glide) { const gs = p.mounted ? 17 : 13; const dx = md.moving ? md.x : Math.sin(p.yaw), dz = md.moving ? md.z : Math.cos(p.yaw); tx = dx * gs * (md.moving ? 1 : 0.75); tz = dz * gs * (md.moving ? 1 : 0.75); }
    if (!rooted) {
      const ac = p.swim ? 10 : p.grounded ? 48 : p.glide ? 5 : 14;
      const k = Math.min(1, ac * dt);
      p.vel.x += (tx - p.vel.x) * k; p.vel.z += (tz - p.vel.z) * k;
      // facing
      const lt = this.lockTarget;
      if (lt && lt.alive && (p.blocking || p.charging) ) this.faceTarget(lt);
      else if (md.moving) { const want = Math.atan2(md.x, md.z); p.yaw += clamp(angDiff(want, p.yaw), -17 * dt, 17 * dt); }
      else if (lt && lt.alive && !p.grounded === false) { /* keep */ }
    } else if (act && !["atk", "heavy", "rush", "air", "gale", "dodge", "spin"].includes(act.kind)) {
      p.vel.x *= Math.exp(-8 * dt); p.vel.z *= Math.exp(-8 * dt);
    } else if (act && act.kind !== "dodge" && act.kind !== "gale") {
      // light friction after lunge
      if (act.t > (act.kind === "heavy" ? act.hitT + 0.1 : 0.2)) { p.vel.x *= Math.exp(-14 * dt); p.vel.z *= Math.exp(-14 * dt); }
    }
    p.moveSpeed = Math.hypot(p.vel.x, p.vel.z);
    if (p.sprint && !p.mounted && !p.swim) { this.staminaUse(0); p.st -= 11 * dt; if (p.st <= 0) p.sprint = false; if (p.grounded && Math.random() < dt * 14) this.fx.dustPuff(p.pos, 1); }
    if (p.sprint && p.swim) p.st -= 9 * dt;

    // --- vertical ---
    let jumped = false;
    const surfaceY = SEA - 0.55;
    if (p.swim) {
      p.glide = false; p.climb = false;
      const wantDown = I.down("descend") && !p.dead;
      const wantUp = I.down("jump") && !p.dead;
      const headUnder = p.pos.y < SEA - 1.55;
      let vyT = 0;
      if (wantDown) vyT = -3.8; else if (wantUp) vyT = 4.5;
      else if (p.pos.y < surfaceY - 0.2 && !p.dive) vyT = 3.5;
      p.vy += (vyT - p.vy) * Math.min(1, dt * 8);
      p.dive = p.pos.y < SEA - 1.0;
      if (!wantDown && !wantUp && p.dive && p.pos.y < SEA - 1.0) p.vy *= 0.85;
      if (this.buf.jump > 0 && !p.dive && !p.dead) { this.buf.jump = 0; p.swim = false; p.vy = 9; jumped = true; p.grounded = false; p.pos.y = SEA - 0.3; audio.splash(); }
      if (!jumped) {
        p.pos.y += p.vy * dt;
        if (p.pos.y > surfaceY) { p.pos.y = surfaceY; if (p.vy > 0) p.vy = 0; }
        if (p.pos.y < fl + 0.5) { p.pos.y = fl + 0.5; if (p.vy < 0) p.vy = 0; }
      }
      p.o2 = headUnder ? p.o2 - dt : Math.min(18, p.o2 + dt * 8);
      if (p.o2 <= 0) { p.hp -= 6 * dt; p.hurtT = 0.3; if (p.hp <= 0) this.die(); }
      if (p.moveSpeed > 1 && Math.random() < dt * 5 && !headUnder) this.fx.ring(new V3(p.pos.x, SEA, p.pos.z), 0xbfe8ff, 0.3, 2, 0.8, 0);
      if (headUnder && Math.random() < dt * 4) this.fx.emit(p.pos.x, p.pos.y + 1.6, p.pos.z, 0, 1.5, 0, 0xbfe8ff, 0.2, 1.2, 0, 0);
      p.grounded = false; p.airT = 0;
    } else {
      p.o2 = Math.min(18, p.o2 + dt * 8);
      // jump
      const canJump = (p.grounded || p.coyote > 0 || p.climb) && (!p.act || this.canCancel("dodge")) && !p.dead && !(p.act && ["dodge"].includes(p.act.kind));
      if (this.buf.jump > 0 && canJump && !this.cine) {
        this.buf.jump = 0; jumped = true;
        p.vy = p.flying ? 9 : p.mounted ? 14 : p.climb ? 9.5 : 11.6;
        if (p.climb) { p.vel.x -= md.x * 3; p.vel.z -= md.z * 3; }
        p.grounded = false; p.coyote = 0; p.climb = false;
        this.fx.dustPuff(p.pos, 5);
        if (p.act && p.act.kind === "charging") { p.act = null; p.charging = false; }
      }
      // glide start
      if (I.pressed("jump") && !p.grounded && !jumped && p.airT > 0.18 && !p.glide && !p.flying && !p.dead && (!p.act || p.act.kind === "charging") && !p.plunging && (p.st > 6 || p.mounted)) {
        p.glide = true; audio.tone(400, 0.25, "sine", 0.08, 300);
        this.tutorial("glide");
      }
      if (p.glide && (!I.down("jump") || p.grounded || (p.st <= 0 && !p.mounted) || p.flying || p.act)) { p.glide = false; }
      // gravity
      if (p.flying) {
        const up = I.down("jump") ? 1 : I.down("descend") ? -1 : 0;
        p.vy += ((up * 10) - p.vy) * Math.min(1, dt * 5);
        if (p.pos.y > 400) p.vy = Math.min(p.vy, 0);
      } else if (p.climb) p.vy = 0;
      else if (p.plunging) p.vy = -42;
      else if (p.act && p.act.kind === "air") p.vy += (0.8 - p.vy) * Math.min(1, dt * 12);
      else if (p.act && (p.act.kind === "gale" || p.act.kind === "dodge")) p.vy *= Math.exp(-6 * dt);
      else if (p.glide) { p.vy += (-2.4 - p.vy) * Math.min(1, dt * 3); p.st -= (p.mounted ? 0 : 7 * (1 - this.sk("wind") * 0.15)) * dt; if (p.st < 0) p.st = 0; p.glideT += dt; }
      else p.vy = Math.max(-46, p.vy - 30 * dt);
      // updrafts
      for (const u of w.updrafts) {
        if (Math.hypot(p.pos.x - u.x, p.pos.z - u.z) < u.r && p.pos.y > u.base - 3 && p.pos.y < u.top) {
          if (p.glide) p.vy = Math.min(11, p.vy + 40 * dt); else if (!p.grounded) p.vy = Math.min(6, p.vy + 16 * dt);
          if (Math.random() < dt * 20) this.fx.emit(u.x + (Math.random() - 0.5) * 8, p.pos.y - 3, u.z + (Math.random() - 0.5) * 8, 0, 9, 0, 0xbff4ff, 0.5, 0.7, 0, 0);
        }
      }
      p.pos.y += p.vy * dt;
    }
    // integrate horizontal
    const oldX = p.pos.x, oldZ = p.pos.z;
    p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt;
    const ign = p.pos.y > gy + 15 || (this.bossActive && p.pos.y > gy + 14);
    w.collide(p.pos, 0.55, ign);
    // tidewall
    const rr = Math.hypot(p.pos.x, p.pos.z);
    if (rr > 855) {
      p.pos.x *= 855 / rr; p.pos.z *= 855 / rr;
      if (this.time - this.tidewallWarn > 8) { this.tidewallWarn = this.time; this.banner("THE TIDEWALL", "Beyond: five oceans, seven continents — sealed. For now.", "#9fd8ff"); audio.tone(100, 1.2, "sine", 0.2, 40); }
    }
    // floor resolution
    fl = w.floor(p.pos.x, p.pos.z, p.pos.y);
    const wasG = p.grounded;
    if (!p.swim) {
      if (p.pos.y <= fl) {
        const fall = p.vy;
        p.pos.y = fl;
        if (!wasG && !jumped && p.airT > 0.2) this.land(fall);
        p.vy = Math.max(0, p.vy);
        p.grounded = true; p.coyote = 0.11; p.airT = 0; p.glide = false; p.airIdx = 0;
      } else if (wasG && p.vy <= 0 && p.pos.y - fl < 0.55 && !jumped) {
        p.pos.y = fl; p.grounded = true; p.coyote = 0.11;
      } else { p.grounded = false; p.airT += dt; if (p.flying && p.pos.y - fl < 0.3) p.grounded = true; }
      if (p.climb) { p.pos.y = Math.max(p.pos.y, fl); }
    }
    p.wasGrounded = wasG;
    void oldX; void oldZ;
    // stamina regen
    const busy = p.sprint || p.climb || p.glide || p.blocking;
    if (!busy && p.stRegenT <= 0 && !p.dead) p.st = Math.min(maxSt, p.st + (p.grounded || p.swim ? 30 : 12) * dt);
    p.st = clamp(p.st, 0, maxSt);
    p.en = clamp(p.en, 0, 100);
    // walking dust & mount trail
    if (p.flying && Math.random() < dt * 40) this.fx.emit(p.pos.x + (Math.random() - 0.5), p.pos.y + 0.5, p.pos.z + (Math.random() - 0.5), 0, 0.5, 0, 0xffa040, 0.7, 0.6, 0, 0);
    if (p.coreT > 0 && Math.random() < dt * 20) { const v = this.vesper; this.fx.emit(v.pos.x + (Math.random() - 0.5) * 1.4, v.pos.y + 0.6 + Math.random() * 1.5, v.pos.z + (Math.random() - 0.5) * 1.4, 0, 1.5, 0, 0xff8a30, 0.6, 0.8, -1, 0); }
    // model
    this.pm.root.position.copy(p.pos);
    this.pm.root.rotation.y = p.yaw;
    this.animatePlayer(dt);
    if (p.hp <= 0 && !p.dead) this.die();
  }
  hasAggro() { return this.enemies.some((e) => e.alive && e.aggro && e.kind !== "grazer" && e.dist < 45); }
  land(vy: number) {
    const p = this.p;
    if (vy < -9) { this.fx.dustPuff(p.pos, 8); if (vy < -20) { this.fx.addShake(0.25); audio.tone(80, 0.15, "sine", 0.2, -30); } }
    p.landT = 0.2;
    if (p.plunging) this.plungeLand();
  }
  plungeLand() {
    const p = this.p;
    p.plunging = false; p.act = null;
    this.fx.ring(p.pos, 0xffd890, 1, 8, 0.5); this.fx.burst(p.pos.clone().setY(p.pos.y + 0.5), 40, 0xd8c8a0, 14, 1.4, 0.9, 10);
    this.fx.sphere(p.pos.clone().setY(p.pos.y + 0.5), 0xffe0a0, 1, 6, 0.3);
    this.fx.addShake(0.8); audio.boom(); this.hitStopT = 0.06;
    this.meleeHit({ range: 7, arc: 7, mult: 2.8, poise: 50, kb: 12, launch: false, heavy: true, air: false });
    this.hitPylonsAt(p.pos, 8, this.atkPower() * 2.5);
  }

  /* ---------------- acts ---------------- */
  updateAct(dt: number) {
    const p = this.p, a = p.act!;
    a.t += dt;
    switch (a.kind) {
      case "wake": { p.vel.set(0, 0, 0); break; }
      case "dodge": {
        const k = a.t / a.dur;
        const sp = 18.5 * (k < 0.6 ? 1 : Math.max(0, 1 - (k - 0.6) / 0.4));
        p.vel.x = a.dir.x * sp; p.vel.z = a.dir.z * sp;
        if (Math.random() < 0.8) this.fx.emit(p.pos.x, p.pos.y + 0.9, p.pos.z, 0, 0, 0, 0x7ae8ff, 0.9, 0.35, 0, 3);
        if (a.t >= a.dur) { p.act = null; }
        break;
      }
      case "atk": {
        const c = COMBO[a.i];
        if (a.t < c.hit + 0.05 && !a.data.noLunge) { const s = c.lunge / 0.15; p.vel.x = a.dir.x * s; p.vel.z = a.dir.z * s; }
        if (!a.hit && a.t >= c.hit) {
          a.hit = true;
          const n = this.meleeHit({ range: c.range, arc: c.arc, mult: c.dmg, poise: c.poise, kb: c.kb, heavy: !!(c as { fin?: boolean }).fin || a.i === 3 });
          if (a.i === 3) { this.fx.addShake(0.35); this.fx.ring(p.pos, 0xffd890, 0.5, 5, 0.3); }
          if (!n) audio.tone(200, 0.05, "sine", 0.03);
        }
        if (a.t >= c.dur * 0.62 && this.buf.attack > 0 && p.act === a) {
          this.buf.attack = 0; p.comboIdx = (a.i + 1) % 4; p.comboTimer = 0.6;
          this.startAttack(); return;
        }
        if (a.t >= c.dur) {
          p.act = null; p.comboIdx = (a.i + 1) % 4; p.comboTimer = 0.55;
          if (input.down("attack") && input.heldFor("attack") > 0.28 && p.st > 5) this.startCharging();
        }
        break;
      }
      case "charging": {
        p.charge += dt / 0.7; p.charging = true;
        const t = this.tmpV; this.pm.parts.tip.getWorldPosition(t);
        if (Math.random() < 0.7) this.fx.emit(t.x + (Math.random() - 0.5) * 2.5, t.y + (Math.random() - 0.5) * 2.5, t.z + (Math.random() - 0.5) * 2.5, 0, 0, 0, 0x9ff0ff, 0.5, 0.25, 0, 0);
        if (p.charge >= 1 && !a.data.full) { a.data.full = 1; audio.tone(1000, 0.2, "triangle", 0.1, 400); this.fx.ring(p.pos, 0x9ff0ff, 0.5, 3, 0.3, 1); }
        if (!input.down("attack")) {
          if (p.charge >= 0.72) this.startSpin(p.charge >= 1 ? 1.25 : 1); else { p.act = null; p.charging = false; }
          p.charge = 0;
        }
        break;
      }
      case "spin": {
        const pw = a.data.power || 1;
        if (!a.hit && a.t >= a.hitT) {
          a.hit = true; p.charging = false;
          this.fx.slash(this.tmpV.set(p.pos.x, p.pos.y + 1.0, p.pos.z), p.yaw, 6.2, 6.2, 0xbfe8ff, 0.05, 0, 0.35);
          this.fx.slash(this.tmpV.set(p.pos.x, p.pos.y + 1.2, p.pos.z), p.yaw + 3.14, 6.2, 6.2, 0xffffff, 0.05, 0, 0.35);
          this.fx.ring(p.pos, 0xbfe8ff, 1, 7, 0.4); this.fx.addShake(0.45);
          this.meleeHit({ range: 5.8, arc: 7, mult: 2.8 * pw * (p.st >= 1 ? 1 : 0.7), poise: 40, kb: 10, heavy: true });
        }
        if (a.t >= a.dur) p.act = null;
        break;
      }
      case "heavy": {
        if (a.t < a.hitT) { p.vel.x *= 0.8; p.vel.z *= 0.8; }
        if (!a.hit && a.t >= a.hitT) {
          a.hit = true;
          p.vel.x = a.dir.x * 14; p.vel.z = a.dir.z * 14;
          const f = a.dir; const pos = this.tmpV.set(p.pos.x + f.x * 1.4, p.pos.y + 1.3, p.pos.z + f.z * 1.4);
          this.fx.slash(pos, p.yaw, 4.8, 3.2, 0xffd890, 1.0, 0, 0.3);
          this.fx.ring(new V3(p.pos.x + f.x * 3, p.pos.y, p.pos.z + f.z * 3), 0xffd890, 0.5, 3.5, 0.3);
          this.fx.burst(new V3(p.pos.x + f.x * 3, p.pos.y + 0.3, p.pos.z + f.z * 3), 14, 0xd8c8a0, 8, 1, 0.5, 8);
          this.fx.addShake(0.45); audio.hit(true);
          this.meleeHit({ range: 4.9, arc: 3.2, mult: 2.7, poise: 55, kb: 11, heavy: true });
        }
        if (a.t >= a.dur) p.act = null;
        break;
      }
      case "rush": {
        if (a.t < 0.22) { p.vel.x = a.dir.x * 28; p.vel.z = a.dir.z * 28; if (Math.random() < 0.8) this.fx.emit(p.pos.x, p.pos.y + 1, p.pos.z, 0, 0, 0, 0xffd890, 0.7, 0.3, 0, 2); }
        if (!a.hit && a.t >= a.hitT) {
          a.hit = true;
          this.fx.slash(this.tmpV.set(p.pos.x + a.dir.x, p.pos.y + 1.1, p.pos.z + a.dir.z), p.yaw, 4.4, 2.8, 0xffd890, -0.2, 0, 0.28);
          this.meleeHit({ range: 4.3, arc: 2.9, mult: 1.8, poise: 28, kb: 8, heavy: true });
        }
        if (a.t >= a.dur) p.act = null;
        break;
      }
      case "air": {
        const hitT = a.hitT;
        if (!a.hit && a.t >= hitT) {
          a.hit = true;
          const col = [0x9ff0ff, 0xbfe8ff, 0xffd890][a.i];
          this.fx.slash(this.tmpV.set(p.pos.x + a.dir.x * 0.6, p.pos.y + 1.2, p.pos.z + a.dir.z * 0.6), p.yaw, 4.2, 3.4, col, [-0.5, 0.5, -1.1][a.i], 0, 0.22);
          this.meleeHit({ range: 4.4, arc: 3.5, mult: [1.0, 1.1, 1.6][a.i], poise: [8, 8, 22][a.i], kb: 3, air: true, heavy: a.i === 2 });
          p.vy = Math.max(p.vy, 3.2);
        }
        if (a.t >= 0.2 && this.buf.attack > 0 && p.airIdx < 3) { this.buf.attack = 0; this.startAttack(); return; }
        if (a.t >= a.dur) p.act = null;
        break;
      }
      case "gale": {
        if (a.t < 0.2) {
          p.vel.x = a.dir.x * 42; p.vel.z = a.dir.z * 42;
          this.fx.emit(p.pos.x, p.pos.y + 1, p.pos.z, 0, 0, 0, 0x9ff0ff, 1.2, 0.4, 0, 2);
          this.fx.emit(p.pos.x + (Math.random() - 0.5) * 1.5, p.pos.y + 0.4 + Math.random() * 1.2, p.pos.z + (Math.random() - 0.5), -a.dir.x * 4, 1, -a.dir.z * 4, 0xffffff, 0.6, 0.4, 0, 2);
          for (const e of this.enemies) {
            if (!e.alive || a.hitSet.has(e.id) || (e.isBoss && (e as Warden).dormant)) continue;
            if (Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < 2.6 + e.radius && Math.abs(e.pos.y - p.pos.y) < 4 + e.height * 0.5) {
              a.hitSet.add(e.id);
              this.hitEnemy(e, 1.9, { poise: 22, kb: 6, launch: true, heavy: true });
              p.en += 6;
            }
          }
          this.hitPylonsAt(p.pos, 3.5, this.atkPower() * 1.5);
        }
        if (a.t >= 0.18 && !a.hit) { a.hit = true; this.fx.slash(this.tmpV.set(p.pos.x, p.pos.y + 1.1, p.pos.z), p.yaw, 4.5, 3.0, 0x9ff0ff, 0, 0, 0.3); }
        if (a.t >= a.dur) p.act = null;
        break;
      }
      case "bloom": {
        if (!a.hit && a.t >= a.hitT) {
          a.hit = true;
          const pos = new V3(a.data.tx, 0, a.data.tz); pos.y = this.world.ground(pos.x, pos.z) + 1.5;
          const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xb070ff, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
          m.position.copy(pos); this.scene.add(m);
          this.blooms.push({ pos, t: 0, mesh: m, tick: 0 });
          this.fx.ring(pos, 0xb070ff, 1, 9, 0.6, -1);
        }
        if (a.t >= a.dur) p.act = null;
        break;
      }
      case "call": {
        if (!a.hit && a.t >= a.hitT) { a.hit = true; this.vesperStrike(); }
        if (a.t >= a.dur) p.act = null;
        break;
      }
      case "plunge": { /* handled by landing */ if (a.t > 4) { p.act = null; p.plunging = false; } if (Math.random() < 0.9) this.fx.emit(p.pos.x, p.pos.y + 1, p.pos.z, 0, 4, 0, 0xffe0a0, 0.8, 0.3, 0, 2); break; }
      case "ult": case "core": { p.vel.x *= 0.8; p.vel.z *= 0.8; break; }
    }
  }

  /* ---------------- combat ---------------- */
  meleeHit(o: { range: number; arc: number; mult: number; poise: number; kb: number; launch?: boolean; air?: boolean; heavy?: boolean }) {
    const p = this.p;
    let n = 0;
    for (const e of this.enemies) {
      if (!e.alive || (e.isBoss && (e as Warden).dormant) || e.kind === "grazer" && false) continue;
      const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > o.range + e.radius) continue;
      const vy = Math.abs((e.pos.y + e.height * 0.4) - (p.pos.y + 1));
      if (vy > (o.air ? 5 : 3.6) + e.height * 0.4) continue;
      if (o.arc < 6 && d > e.radius + 0.9 && Math.abs(angDiff(Math.atan2(dx, dz), p.yaw)) > o.arc / 2 + Math.atan2(e.radius, Math.max(d, 0.1)) * 0.8) continue;
      this.hitEnemy(e, o.mult, { poise: o.poise, kb: o.kb, launch: o.launch, air: o.air, heavy: o.heavy });
      n++;
    }
    n += this.hitPylonsAt(p.pos, o.range + 1.5, this.atkPower() * o.mult, o.arc < 6 ? p.yaw : undefined, o.arc);
    // reflect projectiles
    for (const pr of this.projs) {
      if (pr.friendly) continue;
      const dx = pr.pos.x - p.pos.x, dz = pr.pos.z - p.pos.z;
      if (Math.hypot(dx, dz) < o.range + 1 && (o.arc >= 6 || Math.abs(angDiff(Math.atan2(dx, dz), p.yaw)) < o.arc / 2 + 0.3)) { this.reflect(pr); n++; }
    }
    if (n > 0 && this.vesperEcho()) { /* echo handled */ }
    return n;
  }
  vesperEcho() {
    const p = this.p;
    if (p.coreT <= 0) return false;
    const t = this.pickTarget(28, 3.2);
    if (!t) return false;
    const from = this.vesper.pos.clone(); from.y += 1.6;
    const to = t.pos.clone(); to.y += t.height * 0.5;
    this.projectile(from, to.sub(from).normalize(), { speed: 38, dmg: 0, mult: 0.55 * (1 + 0.25 * this.sk("bond")), color: 0xff9a30, homing: 3, life: 1.2, radius: 0.5, friendly: true });
    return true;
  }
  reflect(pr: Proj) {
    pr.friendly = true; pr.mult = 3 + pr.dmg * 0.1; pr.vel.negate().multiplyScalar(1.4); pr.life = 3; pr.homing = 5;
    const m = pr.mesh as THREE.Sprite; if (m.material) (m.material as THREE.SpriteMaterial).color.set(0x9ff0ff);
    this.fx.burst(pr.pos, 12, 0x9ff0ff, 9, 0.8, 0.4, 0); audio.parry(); this.fx.number(pr.pos, "REFLECT", "#9ff0ff", 20); this.addScorePts(100, pr.pos, "#9ff0ff");
  }
  hitPylonsAt(c: THREE.Vector3, range: number, dmg: number, yaw?: number, arc = 7) {
    let n = 0;
    for (const py of this.boss.pylons) {
      if (!py.alive) continue;
      const dx = py.pos.x - c.x, dz = py.pos.z - c.z, d = Math.hypot(dx, dz);
      if (d > range + 1.4) continue;
      if (yaw !== undefined && arc < 6 && d > 2.4 && Math.abs(angDiff(Math.atan2(dx, dz), yaw)) > arc / 2 + 0.3) continue;
      py.hit(dmg); n++; audio.hit(true);
      this.fx.number(py.pos.clone().setY(py.pos.y + 5), String(Math.round(dmg)), "#d8a8ff", 22);
      this.hitStopT = Math.max(this.hitStopT, 0.03);
    }
    return n;
  }
  hitEnemy(e: Enemy, mult: number, o: { poise?: number; kb?: number; launch?: boolean; air?: boolean; heavy?: boolean; noStop?: boolean; vesper?: boolean }) {
    const p = this.p;
    let dmg = this.atkPower() * mult * (o.vesper ? 1 + 0.25 * this.sk("bond") : 1) * (0.93 + Math.random() * 0.14);
    const crit = Math.random() < 0.1 + (p.counter > 0 ? 0.25 : 0);
    if (crit) dmg *= 1.6;
    const vm = e.vulnMul(p.pos);
    dmg *= vm;
    dmg = Math.max(1, Math.round(dmg));
    const dir = new V3(e.pos.x - p.pos.x, 0, e.pos.z - p.pos.z).normalize();
    const kb = dir.clone().multiplyScalar(o.kb ?? 3);
    const r = e.receive(dmg, { poise: o.poise, kb, launch: o.launch, air: o.air, from: p.pos }) as { killed: boolean; broke: boolean; immune?: boolean };
    const hp = e.pos.clone(); hp.y += e.height * 0.55 * e.def.scale * (e.kind === "colossus" ? 0.6 : 1);
    if (r.immune) {
      this.fx.number(hp, "IMMUNE", "#c890ff", 18); audio.tone(300, 0.1, "square", 0.08, -100); this.fx.burst(hp, 6, 0xc890ff, 7, 0.6, 0.3, 0); return;
    }
    // feedback
    const big = !!o.heavy;
    this.fx.number(hp.clone().add(this.tmpV.set(0, 0.8, 0)), String(dmg), crit ? "#ffe04a" : vm > 1.3 ? "#ffb04a" : "#ffffff", crit ? 30 : big ? 26 : 21);
    this.fx.burst(hp, big ? 14 : 8, crit ? 0xffe04a : 0xfff0d0, big ? 10 : 7, big ? 0.9 : 0.7, 0.4, 8);
    this.fx.spray(hp, dir, big ? 10 : 5, 0xff7a4a, 10, 0.6, 0.35);
    audio.hit(big, crit);
    if (!o.noStop) this.hitStopT = Math.max(this.hitStopT, big ? 0.075 : crit ? 0.06 : 0.04);
    this.fx.addShake(big ? 0.38 : 0.16);
    if (vm > 1.3 && !e.isBoss) this.fx.number(hp.clone().setY(hp.y + 1.6), e.kind === "colossus" && vm > 1.5 && e.state !== "dizzy" ? "WEAK POINT" : "EXPOSED", "#ffb04a", 15);
    // energy / combo
    if (!o.vesper) p.en = Math.min(100, p.en + (big ? 6 : 3) * (1 + 0.2 * this.sk("flow")) * (p.coreT > 0 ? 1.4 : 1));
    this.combo++; this.comboT = 3.4;
    this.addScorePts(5 * this.mult());
    if (this.combo === 10 || this.combo === 25 || this.combo === 50) { this.fx.number(p.pos.clone().setY(p.pos.y + 3), this.combo + " HIT COMBO", "#ffd24a", 24); }
    if (p.coreT > 0 && !o.vesper && !o.noStop && mult < 3) this.vesperEcho();
    this.tutorial("hit");
    if (r.killed) e.die();
  }

  hurtPlayer(dmg: number, from: THREE.Vector3, o: { unblock?: boolean; enemy?: Enemy; kb?: number; ring?: boolean; proj?: boolean } = {}) {
    const p = this.p;
    if (p.dead || this.mode !== "play" || (this.cine && !this.bossActive)) return false;
    if (this.cine && this.bossActive && !this.bossWon && this.boss.state === "intro") return false;
    // i-frames (dodge etc.)
    if (p.iframes > 0) {
      if (p.act && p.act.kind === "dodge" && p.perfectCd <= 0) this.perfectDodge(from);
      return false;
    }
    const ang = Math.abs(angDiff(Math.atan2(from.x - p.pos.x, from.z - p.pos.z), p.yaw));
    if (p.blocking && !o.unblock && !o.ring && ang < 1.9) {
      if (p.blockT <= 0.24) { this.parry(o.enemy, from); return false; }
      const red = dmg * 0.22;
      p.st -= dmg * 0.9; p.stRegenT = 1;
      this.fx.burst(p.pos.clone().setY(p.pos.y + 1.2), 10, 0xffe8a0, 8, 0.7, 0.3, 4); audio.tone(300, 0.1, "square", 0.15, -100); this.fx.addShake(0.25);
      this.fx.number(p.pos.clone().setY(p.pos.y + 2.2), "BLOCK", "#9fd8ff", 18);
      const d = new V3(p.pos.x - from.x, 0, p.pos.z - from.z).normalize(); p.vel.x += d.x * 4; p.vel.z += d.z * 4;
      if (p.st <= 0) { p.st = 0; p.blocking = false; p.stagger = 0.6; p.act = null; this.fx.number(p.pos.clone().setY(p.pos.y + 2.8), "GUARD BREAK", "#ff8a6a", 20); dmg *= 0.7; }
      else { p.hp -= Math.round(red); p.hurtT = 0.4; if (p.hp <= 0) this.die(); return true; }
    }
    p.hp -= Math.round(dmg);
    p.hurtT = 1; p.stRegenT = 0.8;
    this.fx.flash("#ff2a1a", clamp(dmg / 45, 0.18, 0.45), 350);
    this.fx.addShake(clamp(dmg / 40, 0.3, 0.9));
    this.fx.number(p.pos.clone().setY(p.pos.y + 2.2), "-" + Math.round(dmg), "#ff6a5a", 26);
    this.fx.burst(p.pos.clone().setY(p.pos.y + 1.2), 12, 0xff4a3a, 8, 0.8, 0.5, 6);
    audio.hurt(); this.hitStopT = Math.max(this.hitStopT, 0.05);
    const d = new V3(p.pos.x - from.x, 0, p.pos.z - from.z).normalize();
    const k = o.kb ?? 4; p.vel.x += d.x * k; p.vel.z += d.z * k;
    if (dmg >= 16 && !(p.act && p.act.kind === "heavy" && false)) { p.stagger = 0.3; if (p.act && p.act.kind !== "ult" && p.act.kind !== "core") { p.act = null; p.charging = false; } p.glide = false; p.plunging = false; }
    this.combo = 0; this.comboT = 0;
    if (!p.grounded && dmg >= 16) p.vy = Math.max(p.vy, 3);
    this.tutorial("hurt");
    if (p.hp <= 0) this.die();
    return true;
  }
  parry(e: Enemy | undefined, from: THREE.Vector3) {
    const p = this.p;
    this.stats.parries++;
    p.counter = 2.6; p.en = Math.min(100, p.en + 18);
    const pos = p.pos.clone(); pos.y += 1.3;
    this.fx.burst(pos, 26, 0xffffff, 14, 1.0, 0.5, 2); this.fx.ring(pos, 0xffffff, 0.3, 4, 0.3, 0); this.fx.sphere(pos, 0xbfe8ff, 0.3, 2.4, 0.2);
    this.fx.flash("#ffffff", 0.3, 220);
    audio.parry(); this.hitStopT = 0.11; this.slow(0.35, 0.35); this.fx.addShake(0.6);
    this.fx.number(p.pos.clone().setY(p.pos.y + 2.6), "PARRY!", "#ffffff", 30);
    this.addScorePts(150 * this.mult(), p.pos, "#ffffff");
    if (e && e.alive) {
      if (e.isBoss) { e.poise -= 160; if (e.poise <= 0) (e as Warden).expose(2.8); else e.flash = 0.15; }
      else { e.cancelAtk(); e.poise = e.maxPoise; e.setState("stagger"); e.stunDur = e.elite ? 1.6 : 1.5; e.vel.x -= Math.sin(e.yaw) * 4; e.vel.z -= Math.cos(e.yaw) * 4; }
      this.faceTarget(e);
    }
    this.tutorial("parry");
    void from;
  }
  perfectDodge(from: THREE.Vector3) {
    const p = this.p;
    p.perfectCd = 1.6; p.counter = 3; p.en = Math.min(100, p.en + 14); p.iframes = Math.max(p.iframes, 0.35);
    this.stats.perfects++;
    this.slow(0.28, 0.9);
    this.fx.number(p.pos.clone().setY(p.pos.y + 2.6), "PERFECT DODGE", "#7ae8ff", 28);
    this.fx.ring(p.pos, 0x7ae8ff, 0.5, 6, 0.5, 0.6); this.fx.flash("#7ae8ff", 0.22, 500);
    this.fx.burst(p.pos.clone().setY(p.pos.y + 1), 22, 0x7ae8ff, 10, 0.9, 0.7, 0);
    audio.perfect(); this.addScorePts(100 * this.mult(), p.pos, "#7ae8ff");
    this.tutorial("perfect"); void from;
  }
  tutorial(k: string) {
    if (this.tut[k]) return;
    this.tut[k] = true;
    const t = input.touch;
    if (k === "hit") setTimeout(() => this.hint(t ? "Tap the dodge button just as enemies strike for a PERFECT DODGE" : "Tap Shift as an enemy strikes — dodge through it for a PERFECT DODGE", 6), 800);
    else if (k === "perfect") setTimeout(() => this.hint(t ? "Hold block, then tap just before a hit lands to PARRY" : "Right-click just before a hit lands to PARRY — red telegraphs can be parried, purple cannot", 7), 1500);
    else if (k === "glide") this.hint("Hold jump to glide — rise on blue wind currents", 4);
  }

  die() {
    const p = this.p;
    if (p.dead) return;
    p.dead = true; p.hp = 0; p.act = null; p.blocking = false; p.charging = false; p.glide = false;
    this.slow(0.25, 1.6); audio.tone(100, 1.5, "sawtooth", 0.2, -60);
    this.fx.flash("#300", 0.6, 1200);
    this.lockTarget = null; this.cine = null;
    this.mode = "dead"; this.slowT = 2;
    audio.setMode("off");
    if (document.pointerLockElement) document.exitPointerLock();
    setTimeout(() => this.finishRun("YOU HAVE FALLEN"), 1700);
  }
  finishRun(title: string) {
    if (this.finalObj) return;
    const p = this.p;
    const bonus = this.bossWon ? 5000 : 0;
    const total = Math.floor(this.score + bonus);
    const { entry, rank } = addScore({ name: getName(), score: total, level: p.level, kills: this.stats.kills, time: Math.round(this.runTime), boss: this.bossWon });
    this.finalObj = { score: total, kills: this.stats.kills, time: Math.round(this.runTime), level: p.level, rank, id: entry.id, name: entry.name, boss: this.bossWon, title };
    if (this.mode !== "dead") this.mode = "dead";
    audio.setMode("off");
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /* ---------------- Vesper ---------------- */
  updateVesper(dt: number) {
    const v = this.vesper, p = this.p, w = this.world;
    v.t += dt; v.alert -= dt;
    const asc = p.coreT > 0;
    v.form += ((asc ? 1 : 0) - v.form) * Math.min(1, dt * 3);
    const wantScale = p.mounted ? 2.0 + v.form * 0.5 : 0.9 + v.form * 1.1;
    v.scale += (wantScale - v.scale) * Math.min(1, dt * 5);
    let hover = v.form * 1.6;
    let airborne = false;
    if (this.mode === "start") {
      const a = this.startOrbit * 0.0 + 0.6;
      v.pos.set(p.pos.x + Math.sin(a) * 2.6, w.ground(p.pos.x + 2, p.pos.z + 1), p.pos.z + Math.cos(a) * 2.6);
      v.yaw = a + 3.1;
    } else if (p.mounted) {
      v.pos.copy(p.pos); v.yaw = p.yaw; v.state = "mount"; v.spd = p.moveSpeed;
      airborne = !p.grounded;
    } else {
      if (v.state === "mount") v.state = "follow";
      if (v.state === "follow") {
        // anchor
        let tx = p.pos.x - Math.sin(p.yaw) * 2.8 - Math.cos(p.yaw) * 1.8, tz = p.pos.z - Math.cos(p.yaw) * 2.8 + Math.sin(p.yaw) * 1.8;
        let lookAt: THREE.Vector3 | null = null;
        const foe = this.enemies.find((e) => e.alive && e.aggro && e.kind !== "grazer" && e.dist < 22 && !e.isBoss) ?? (this.bossActive && this.boss.alive ? this.boss : undefined);
        v.sniff = null;
        if (foe) {
          const dx = foe.pos.x - p.pos.x, dz = foe.pos.z - p.pos.z, d = Math.hypot(dx, dz) || 1;
          tx = p.pos.x + (dx / d) * 3 + (dz / d) * 1.8; tz = p.pos.z + (dz / d) * 3 - (dx / d) * 1.8; lookAt = foe.pos;
          if (v.alert <= 0 && v.pingT <= 0) { v.alert = 0.5; v.pingT = 6; audio.tone(180, 0.2, "sawtooth", 0.05, 40); }
        } else {
          let best: Chest | null = null, bd = 24;
          for (const c of w.chests) { if (c.opened || c.underwater) continue; const d = Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z); if (d < bd) { bd = d; best = c; } }
          if (best && !p.sprint) {
            v.sniff = best;
            const dx = best.pos.x - p.pos.x, dz = best.pos.z - p.pos.z, d = Math.hypot(dx, dz) || 1;
            const reach = Math.min(d - 2.2, 13);
            tx = p.pos.x + (dx / d) * reach; tz = p.pos.z + (dz / d) * reach; lookAt = best.pos;
            if (d < 24 && Math.random() < dt * 0.9) this.fx.emit(best.pos.x, best.pos.y + 1.5, best.pos.z, 0, 2, 0, 0xffe08a, 0.5, 1.2, 0, 0);
          }
        }
        v.pingT -= dt;
        const dx = tx - v.pos.x, dz = tz - v.pos.z, d = Math.hypot(dx, dz);
        if (d > 45) { v.pos.x = tx; v.pos.z = tz; this.fx.burst(v.pos, 14, 0xffb04a, 6, 0.8, 0.5, 0); }
        else if (d > 0.4) {
          const sp = clamp(d * 3.4, 0, p.sprint ? 15 : 10.5) * (asc ? 1.5 : 1);
          v.pos.x += (dx / d) * sp * dt; v.pos.z += (dz / d) * sp * dt;
          const wy = Math.atan2(dx, dz); v.yaw += clamp(angDiff(wy, v.yaw), -12 * dt, 12 * dt);
        } else if (lookAt) v.yaw += clamp(angDiff(Math.atan2(lookAt.x - v.pos.x, lookAt.z - v.pos.z), v.yaw), -6 * dt, 6 * dt);
        else v.yaw += clamp(angDiff(p.yaw, v.yaw), -3 * dt, 3 * dt);
        if (lookAt && d <= 3) v.yaw += clamp(angDiff(Math.atan2(lookAt.x - v.pos.x, lookAt.z - v.pos.z), v.yaw), -8 * dt, 8 * dt);
        v.spd = d > 0.4 ? Math.min(d * 3.4, 12) : 0;
        // assists
        v.assistCd -= dt; v.boltCd -= dt;
        if (!p.dead) {
          if (asc) {
            if (v.boltCd <= 0) {
              const t = this.pickTarget(30, 3.2);
              if (t) {
                v.boltCd = 1.1 - 0.06 * this.sk("bond");
                const from = v.pos.clone(); from.y += 1.8 * v.scale / 2;
                const to = t.pos.clone(); to.y += t.height * 0.5;
                this.projectile(from, to.sub(from).normalize(), { speed: 34, dmg: 0, mult: 0.9, color: 0xff8a30, homing: 3, life: 1.4, radius: 0.6, friendly: true });
                audio.tone(600, 0.15, "sawtooth", 0.06, -300);
              }
            }
          } else if (v.assistCd <= 0) {
            const t = this.enemies.filter((e) => e.alive && e.aggro && e.kind !== "grazer" && !e.isBoss && e.dist < 13).sort((a, b) => a.dist - b.dist)[0] ?? (this.bossActive && this.boss.alive && this.boss.dist < 20 && !this.boss.shield ? this.boss : undefined);
            if (t) { v.assistCd = 7 - 0.5 * this.sk("bond"); this.beginVesperStrike(t, true); }
          }
        }
      } else if (v.state === "strike") this.updateVesperStrike(dt);
      airborne = !p.grounded && p.pos.y > w.ground(p.pos.x, p.pos.z) + 3;
    }
    const gy = w.floor(v.pos.x, v.pos.z, p.pos.y);
    let wantY = gy + hover;
    if (gy < SEA) wantY = SEA + 0.1 + hover;
    if (airborne && !p.mounted) wantY = Math.max(wantY, p.pos.y - 0.8);
    if (v.state === "strike") wantY = Math.max(gy, v.pos.y);
    if (this.mode === "start") v.pos.y = wantY;
    else if (p.mounted) v.pos.y = p.pos.y;
    else v.pos.y += (wantY - v.pos.y) * Math.min(1, dt * 7);
    // model
    const m = this.vm.root, pr = this.vm.parts;
    m.position.copy(v.pos); m.rotation.y = v.yaw; m.scale.setScalar(v.scale);
    v.walk += v.spd * dt * 1.0;
    const amp = clamp(v.spd / 8, 0, 1) * 0.8;
    const flying = airborne || hover > 0.5 || (p.mounted && (p.glide || p.flying));
    this.vm.legs.forEach((l, i) => { l.rotation.x = flying ? -0.6 : Math.sin(v.walk * 1.2 + (i % 2 ? 0 : Math.PI) + (i > 1 ? Math.PI * 0.6 : 0)) * amp; });
    this.vm.tail!.forEach((s, i) => { s.rotation.y = Math.sin(v.t * 3 - i * 0.8) * (0.25 + amp * 0.15); s.rotation.x = 0.1 + Math.sin(v.t * 2 - i * 0.5) * 0.1; });
    pr.body.position.y = Math.abs(Math.sin(v.walk * 1.2)) * 0.08 * amp;
    pr.head.rotation.x = v.sniff ? 0.5 + Math.sin(v.t * 6) * 0.1 : Math.sin(v.t * 1.3) * 0.05;
    const wingsOn = flying || v.form > 0.2;
    pr.wings.visible = wingsOn;
    if (wingsOn) {
      const f = flying ? Math.sin(v.t * (v.form > 0.2 ? 7 : 10)) * 0.5 : 0.1;
      pr.wLg.rotation.z = -0.3 + f; pr.wRg.rotation.z = 0.3 - f;
      (pr.wm.userData.m as THREE.MeshBasicMaterial).opacity = 0.4 + v.form * 0.45;
    }
    (pr.halo as THREE.Sprite).material.opacity = v.form * 0.75 + (v.alert > 0 ? 0.3 : 0);
    // mounted rider placement
    if (p.mounted) this.pm.root.position.y = p.pos.y + 0.82 * v.scale;
  }
  beginVesperStrike(t: Enemy | null, auto: boolean) {
    const v = this.vesper;
    v.state = "strike"; v.t = 0; v.from.copy(v.pos); v.target = t; v.hit = false; (v as { auto?: boolean }).auto = auto;
    (v as { tp?: THREE.Vector3 }).tp = t ? t.pos.clone() : new V3(this.p.pos.x + Math.sin(this.p.yaw) * 12, 0, this.p.pos.z + Math.cos(this.p.yaw) * 12);
    audio.vesper();
  }
  vesperStrike() { this.beginVesperStrike(this.vesper.target ?? this.pickTarget(26, 3), false); }
  updateVesperStrike(dt: number) {
    const v = this.vesper as typeof this.vesper & { auto?: boolean; tp?: THREE.Vector3 };
    const p = this.p;
    const t = v.target && v.target.alive ? v.target : null;
    if (t) v.tp!.copy(t.pos);
    const tp = v.tp!;
    const dx = tp.x - v.from.x, dz = tp.z - v.from.z, d = Math.hypot(dx, dz) || 1;
    const dashT = 0.2;
    if (v.t < dashT) {
      const k = v.t / dashT, e = k * k;
      const stop = Math.max(0, d - (t ? t.radius + 1.0 : 0));
      v.pos.x = v.from.x + (dx / d) * stop * e; v.pos.z = v.from.z + (dz / d) * stop * e;
      v.yaw = Math.atan2(dx, dz);
      v.spd = 20;
      this.fx.emit(v.pos.x, v.pos.y + 0.8, v.pos.z, 0, 0, 0, 0xffa040, 1.0, 0.4, 0, 2);
    } else if (!v.hit) {
      v.hit = true;
      const c = v.pos.clone(); c.y += 0.8;
      const syn = !v.auto && p.synergy > 0;
      const mult = (v.auto ? 0.9 : 2.3) * (syn ? 1.7 : 1);
      this.fx.sphere(c, 0xffa040, 0.5, 5, 0.35); this.fx.ring(v.pos, 0xffd070, 0.5, 6, 0.4); this.fx.burst(c, 24, 0xffa040, 12, 1, 0.6, 6);
      this.fx.addShake(0.4); audio.hit(true); audio.tone(500, 0.2, "sawtooth", 0.1, -300);
      for (const e of this.enemies) {
        if (!e.alive || (e.isBoss && (e as Warden).dormant)) continue;
        if (Math.hypot(e.pos.x - v.pos.x, e.pos.z - v.pos.z) < 4.8 + e.radius) this.hitEnemy(e, mult, { poise: 34, kb: 7, heavy: true, vesper: true, noStop: v.auto });
      }
      this.hitPylonsAt(v.pos, 5, this.atkPower() * mult);
      if (syn) { p.synergy = 0; p.en = Math.min(100, p.en + 15); this.fx.number(p.pos.clone().setY(p.pos.y + 2.8), "BEAST SYNERGY", "#ffb04a", 24); this.addScorePts(200 * this.mult(), p.pos, "#ffb04a"); }
    } else {
      // return
      const ax = p.pos.x - Math.sin(p.yaw) * 2.8, az = p.pos.z - Math.cos(p.yaw) * 2.8;
      const k = Math.min(1, (v.t - dashT) / 0.45);
      v.pos.x += (ax - v.pos.x) * Math.min(1, dt * 9); v.pos.z += (az - v.pos.z) * Math.min(1, dt * 9);
      v.yaw += clamp(angDiff(Math.atan2(ax - v.pos.x, az - v.pos.z), v.yaw), -12 * dt, 12 * dt);
      v.spd = 12;
      if (k >= 1) { v.state = "follow"; v.target = null; }
    }
  }

  /* ---------------- player visuals ---------------- */
  animatePlayer(dt: number) {
    const p = this.p, pr = this.pm.parts, [legL, legR] = this.pm.legs;
    const body = pr.body, armL = pr.armL, armR = pr.armR, sword = pr.sword, cape = pr.cape, glider = pr.glider;
    const startMode = this.mode === "start";
    const spd = startMode ? 0 : p.moveSpeed;
    p.walk += spd * dt * 0.95;
    const k = Math.min(1, spd / 9);
    const sw = Math.sin(p.walk) * 0.95 * Math.min(1, spd / 5);
    const f = Math.min(1, dt * 18);
    const T = { bx: 0, by: 0, bz: 0, bpy: 0, lL: sw, lR: -sw, aLx: -sw * 0.7, aLz: 0.08, aRx: sw * 0.7, aRz: -0.08, sx: 1.25, capeX: 0.12 + k * 0.7, glide: false, sy: 1 };
    T.bx = p.sprint ? 0.32 : spd > 1 ? 0.14 : 0;
    const a = p.act;
    const t = this.time;
    if (!startMode && p.mounted) { T.lL = -1.15; T.lR = -1.15; T.aLx = -0.9; T.aRx = -0.5; T.bx = 0.2 + k * 0.15; }
    else if (!p.grounded && !p.swim && !p.climb && !startMode) {
      if (p.glide) { T.bx = 1.25; T.aLx = 0; T.aRx = 0; T.aLz = -1.35; T.aRz = 1.35; T.lL = -0.2; T.lR = 0.2; T.glide = true; T.capeX = 1.3; }
      else if (p.vy > 0) { T.lL = -0.7; T.lR = 0.35; T.aLx = -2.2; T.aRx = -2.0; T.aLz = -0.3; T.aRz = 0.3; T.bx = 0.05; }
      else { T.lL = 0.3; T.lR = -0.5; T.aLx = -0.4; T.aRx = -0.4; T.aLz = -1.1; T.aRz = 1.1; }
    }
    if (p.swim) { const s = Math.sin(t * 6); T.bx = 1.3; T.by = 0; T.lL = s * 0.6; T.lR = -s * 0.6; T.aLx = -2.6 + s * 0.8; T.aRx = -2.6 - s * 0.8; T.aLz = -0.2; T.aRz = 0.2; T.bpy = -0.55; }
    if (p.climb) { const s = Math.sin(t * 7); T.bx = -0.2; T.aLx = -2.6 + s * 0.7; T.aRx = -2.6 - s * 0.7; T.lL = s * 0.7; T.lR = -s * 0.7; }
    if (p.blocking) { T.aRx = -1.5; T.aLx = -1.3; T.aRz = 0.5; T.aLz = -0.4; T.sx = 0.2; T.bx = 0.1; }
    if (p.charging) { T.aRx = -2.4; T.aRz = -0.6; T.sx = 0.9; T.bx = 0.2; }
    let byRot = 0; let spinK = -1;
    if (a) {
      const kk = a.t / a.dur;
      if (a.kind === "atk") {
        const c = COMBO[a.i], ease = clamp(a.t / (c.hit * 2 + 0.05), 0, 1), e2 = 1 - Math.pow(1 - ease, 2);
        T.aRx = lerp(-2.7, 0.8, e2); T.aRz = c.roll * lerp(1.2, -1.2, e2) - 0.1; T.sx = 1.25; T.bx = 0.25;
        if (a.i === 3) { spinK = e2; T.aRx = lerp(-3, 1.0, e2); }
        byRot = -c.roll * 0.9 * (e2 - 0.5);
      } else if (a.kind === "air") { const e2 = clamp(a.t / 0.2, 0, 1); T.aRx = lerp(-2.6, 0.7, e2); T.aRz = (a.i % 2 ? 1 : -1) * lerp(1, -1, e2); T.bx = 0.2; T.lL = -0.5; T.lR = 0.4; }
      else if (a.kind === "heavy") { const e2 = clamp((a.t - 0.3) / 0.14, 0, 1); T.aRx = a.t < a.hitT ? lerp(-1, -3.2, clamp(a.t / 0.38, 0, 1)) : lerp(-3.2, 1.2, e2); T.aLx = T.aRx; T.bx = a.t < a.hitT ? -0.25 : 0.55; T.sx = 0.3; }
      else if (a.kind === "spin") { spinK = clamp(a.t / a.dur, 0, 1) * 2; T.aRx = -1.4; T.aRz = 1.4; T.bx = 0.15; }
      else if (a.kind === "rush" || a.kind === "gale") { T.bx = 0.75; T.aRx = -1.7; T.aRz = 0; T.aLx = 0.8; T.lL = 0.9; T.lR = -0.9; }
      else if (a.kind === "dodge") { T.bx = 0.7; T.sy = 0.88; T.lL = 1.0; T.lR = -0.9; T.aLx = 0.8; T.aRx = 0.8; }
      else if (a.kind === "bloom") { T.aLx = -1.6; T.aRx = -1.6; T.aLz = -0.3; T.aRz = 0.3; }
      else if (a.kind === "call") { T.aRx = -2.8; T.aRz = 0.3; T.aLx = -0.5; }
      else if (a.kind === "plunge") { T.aRx = 3.1; T.aLx = 3.1; T.bx = 0.1; T.lL = 0; T.lR = 0; T.sx = 2.5; }
      else if (a.kind === "ult" || a.kind === "core") { T.aLx = -2.9; T.aRx = -2.9; T.aLz = -0.3; T.aRz = 0.3; T.bx = -0.15; T.bpy = Math.sin(kk * 3.14) * 0.9; T.lL = 0.1; T.lR = -0.1; }
      else if (a.kind === "wake") { const e = clamp((kk - 0.45) / 0.45, 0, 1); T.bx = lerp(-1.5, 0, e * e); T.bpy = lerp(-0.2, 0, e); T.lL = T.lR = 0; T.aLx = T.aRx = lerp(-0.2, 0, e); }
    }
    if (p.stagger > 0) { T.bx = -0.4; T.aLx = -0.5; T.aRx = -0.5; }
    if (p.dead) { T.bx = -1.55; T.bpy = -0.7; T.lL = T.lR = 0; T.aLx = T.aRx = 0; }
    if (a && a.kind === "wake" && !startMode) { /* handled */ }
    body.rotation.x += (T.bx - body.rotation.x) * f;
    body.rotation.z += (T.bz - body.rotation.z) * f;
    body.rotation.y = spinK >= 0 ? spinK * 6.283 : body.rotation.y + (byRot - body.rotation.y) * f;
    body.position.y += (T.bpy + Math.abs(Math.sin(p.walk)) * 0.05 * k - body.position.y) * f;
    legL.rotation.x += (T.lL - legL.rotation.x) * f; legR.rotation.x += (T.lR - legR.rotation.x) * f;
    armL.rotation.x += (T.aLx - armL.rotation.x) * f; armR.rotation.x += (T.aRx - armR.rotation.x) * f;
    armL.rotation.z += (T.aLz - armL.rotation.z) * f; armR.rotation.z += (T.aRz - armR.rotation.z) * f;
    sword.rotation.x += (T.sx - sword.rotation.x) * f;
    cape.rotation.x += (T.capeX + Math.sin(t * 9) * 0.06 * k - cape.rotation.x) * f;
    glider.visible = T.glide;
    if (T.glide) { glider.rotation.z = 0; (glider.children[0] as THREE.Mesh).rotation.z = Math.sin(t * 4) * 0.04; }
    this.pm.root.scale.y += (T.sy - this.pm.root.scale.y) * f;
    if (p.mounted) { this.pm.root.position.y = this.pm.root.position.y; }
    else if (!p.swim && !startMode) this.pm.root.position.y = p.pos.y;
    // sword trail particles during swings
    if (a && (a.kind === "atk" || a.kind === "air" || a.kind === "heavy" || a.kind === "rush" || a.kind === "spin" || a.kind === "gale") && a.t < 0.35) {
      this.pm.parts.tip.getWorldPosition(this.tmpV);
      this.fx.emit(this.tmpV.x, this.tmpV.y, this.tmpV.z, 0, 0, 0, a.kind === "heavy" ? 0xffd890 : 0x9ff0ff, 0.5, 0.25, 0, 0);
    }
    if (p.dead) this.pm.root.position.y = p.pos.y;
  }

  /* ---------------- enemies ---------------- */
  updateEnemies(dt: number) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.isBoss && e.removed) { e.root.visible = false; continue; }
      e.update(dt);
      if (e.removed && !e.isBoss) { e.dispose(); this.enemies.splice(i, 1); this.barEls.get(e.id)?.el.remove(); this.barEls.delete(e.id); if (this.lockTarget === e) this.lockTarget = null; }
      else if (!e.isBoss && e.roamer && e.dist > 240) { e.dispose(); this.enemies.splice(i, 1); }
    }
  }
  spawnEnemy(kind: string, x: number, z: number, o: { camp?: string; aggro?: boolean; roamer?: boolean } = {}) {
    const biome = this.world.terrain.biomeAt(x, z);
    const sc = [1, 1.15, 1.25, 1.4][biome], dm = [1, 1.1, 1.2, 1.35][biome];
    const e = new Beast(this, kind, x, z, biome, kind === "grazer" ? 1 : sc);
    e.dmgMul = dm; e.camp = o.camp ?? ""; e.roamer = !!o.roamer;
    if (o.aggro) { e.aggro = true; e.setState("chase"); }
    this.enemies.push(e);
    return e;
  }
  alertFx(e: Enemy) {
    const s = glowSprite(0xff4a3a, 2.0, 1); s.position.set(0, e.height * e.def.scale + 1.3, 0); e.root.add(s); e.alertSprite = s;
    if (e.kind !== "grazer") { this.vesper.alert = 1; if (e.elite) { audio.roar(); this.fx.addShake(0.3); this.toast(e.name + " notices you!", "#ff8a6a"); } else audio.tone(260, 0.12, "sawtooth", 0.05, 120); }
  }
  updateSpawns(dt: number) {
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    this.spawnT = 0.5;
    const p = this.p, now = this.time;
    const nearStadium = Math.hypot(p.pos.x - this.world.stadium.center.x, p.pos.z - this.world.stadium.center.z) < 70;
    for (const c of this.camps) {
      const d = Math.hypot(p.pos.x - c.def.x, p.pos.z - c.def.z);
      if (!c.spawned) {
        if (d < 130 && now >= c.respawnAt && !this.bossActive && !nearStadium && (!c.cleared || !c.def.elite || !this.coreTaken.has(c.def.id) && c.def.id !== "e_waste" || false)) {
          if (c.cleared && c.def.elite && c.def.id !== "e_waste") continue;
          c.spawned = true; c.cleared = false; c.enemies = [];
          for (const [kind, n] of c.def.spawns) for (let i = 0; i < n; i++) {
            const a = Math.random() * 6.28, r = 3 + Math.random() * c.def.r;
            const e = this.spawnEnemy(kind, c.def.x + Math.cos(a) * r, c.def.z + Math.sin(a) * r, { camp: c.def.id }); c.enemies.push(e);
          }
          if (c.def.elite) {
            const e = this.spawnEnemy(c.def.elite, c.def.x, c.def.z, { camp: c.def.id });
            e.coreDrop = ["e_forest", "e_desert", "e_frost"].includes(c.def.id); c.enemies.push(e);
          }
        }
      } else {
        if (d > 240) { for (const e of c.enemies) if (e.alive) { e.dispose(); const i = this.enemies.indexOf(e); if (i >= 0) this.enemies.splice(i, 1); } c.spawned = false; c.enemies = []; }
        else if (c.enemies.every((e) => !e.alive)) { c.spawned = false; c.cleared = true; c.respawnAt = now + (c.def.elite ? 300 : 150); c.enemies = []; }
      }
    }
    // roamers
    this.roamT -= 0.5;
    if (this.roamT <= 0 && !this.bossActive && !this.cine && !nearStadium && !p.swim && !p.dead) {
      this.roamT = 38 + Math.random() * 40;
      const alive = this.enemies.filter((e) => e.alive && e.kind !== "grazer" && !e.isBoss).length;
      if (alive < 7) {
        const b = this.currentRegionIdx();
        const table = [["skitter", "skitter", "horn", "kite"], ["horn", "kite", "kite", "skitter"], ["skitter", "kite", "horn", "kite"], ["skitter", "horn", "horn", "skitter"]][b];
        const kind = table[Math.floor(Math.random() * table.length)];
        for (let tries = 0; tries < 8; tries++) {
          const a = Math.random() * 6.28, r = 55 + Math.random() * 20;
          const x = p.pos.x + Math.cos(a) * r, z = p.pos.z + Math.sin(a) * r;
          if (this.world.ground(x, z) < 2 || Math.hypot(x, z) > 800) continue;
          const n = kind === "skitter" ? 2 : 1;
          for (let i = 0; i < n; i++) { const e = this.spawnEnemy(kind, x + i * 2, z, { roamer: true, aggro: true }); if (i === 0) this.toast("Something stalks you — a " + e.name + "!", "#ff8a6a"); }
          audio.tone(150, 0.4, "sawtooth", 0.08, -60);
          break;
        }
      }
    }
    // grazers
    let count = 0; for (const g of this.grazers.values()) if (g.alive) count++;
    this.world.grazerSpots.forEach((s, i) => {
      const d = Math.hypot(p.pos.x - s.x, p.pos.z - s.z);
      const g = this.grazers.get(i);
      if (!g && d < 100 && count < 7 && Math.random() < 0.3) { const e = this.spawnEnemy("grazer", s.x, s.z); this.grazers.set(i, e); count++; }
      else if (g && d > 200) { g.dispose(); const k = this.enemies.indexOf(g); if (k >= 0) this.enemies.splice(k, 1); this.grazers.delete(i); }
      else if (g && g.removed) this.grazers.delete(i);
    });
  }
  spawnT = 0;

  onKill(e: Enemy) {
    const p = this.p;
    const c = e.pos.clone(); c.y += e.height * 0.5 * e.def.scale;
    this.fx.burst(c, e.elite || e.isBoss ? 60 : 24, e.kind === "grazer" ? 0x9fe08a : 0xffb070, e.elite ? 14 : 10, 1.1, 0.8, 4);
    this.fx.ring(e.pos, 0xffd8a0, 0.5, e.elite ? 9 : 4, 0.5, 0.3);
    if (e.kind === "grazer") {
      this.gainXp(e.def.xp); this.addScorePts(e.def.score, e.pos);
      this.spawnOrb("hp", c); this.spawnOrb("hp", c); audio.pickup();
      return;
    }
    this.stats.kills++;
    audio.tone(220, 0.25, "square", 0.1, -120); this.hitStopT = Math.max(this.hitStopT, e.elite ? 0.14 : 0.06);
    if (e.elite) { this.slow(0.4, 0.6); this.fx.addShake(0.8); }
    const pts = Math.round(e.def.score * this.mult());
    this.addScorePts(pts, e.pos, "#ffe08a");
    this.gainXp(e.def.xp);
    p.en = Math.min(100, p.en + (e.elite ? 25 : 8));
    const hpOrbs = e.elite ? 3 : Math.random() < (e.def.tier >= 1 ? 0.55 : 0.28) ? 1 : 0;
    for (let i = 0; i < hpOrbs; i++) this.spawnOrb("hp", c);
    for (let i = 0; i < (e.elite ? 3 : Math.random() < 0.5 ? 1 : 0); i++) this.spawnOrb("en", c);
    if (e.coreDrop && !this.coreTaken.has(e.camp)) { this.coreTaken.add(e.camp); this.spawnOrb("core", c); this.banner("A BEAST CORE FALLS", "Rare — spend it wisely", "#ffb04a"); }
    if (e.elite && !e.coreDrop && this.rollGear(1.0 + 0)) { /* gear drop */ }
    if (e.elite && !e.isBoss) { const g = this.pickGear(2, 3); if (g) this.giveGear(g); }
    if (this.lockTarget === e) this.lockTarget = null;
    if (e.isBoss) this.bossDefeated();
    this.tutorial2("kill");
  }
  rollGear(_c: number) { return false; }
  tutorial2(k: string) {
    if (this.tut[k]) return; this.tut[k] = true;
    setTimeout(() => this.hint(input.touch ? "Level 2 unlocks Gale Rend — launch enemies, then attack in the air" : "E — Gale Rend launches enemies skyward · jump + attack to juggle them", 7), 2500);
  }
  pickGear(minR: number, maxR: number): Gear | null {
    const pool = GEAR.filter((g) => g.rarity >= minR && g.rarity <= maxR && !this.owned.has(g.id) && g.id !== "wardensedge");
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  spawnOrb(kind: string, pos: THREE.Vector3) {
    const col = kind === "hp" ? 0x7dff8a : kind === "en" ? 0x7ae8ff : 0xffa030;
    const s = glowSprite(col, kind === "core" ? 3 : 1.1, 1); s.position.copy(pos); this.scene.add(s);
    const a = Math.random() * 6.28, sp = 3 + Math.random() * 3;
    this.orbs.push({ pos: pos.clone(), vel: new V3(Math.cos(a) * sp, 6 + Math.random() * 3, Math.sin(a) * sp), kind, t: 0, sprite: s });
  }
  updateOrbs(dt: number) {
    const p = this.p;
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i]; o.t += dt;
      const dx = p.pos.x - o.pos.x, dy = p.pos.y + 1 - o.pos.y, dz = p.pos.z - o.pos.z, d = Math.hypot(dx, dy, dz);
      if (o.t > 0.45 && d < (o.kind === "core" ? 16 : 9)) { const s = (o.kind === "core" ? 12 : 16) * Math.min(1, 1.3 - d / 12 + 0.4); o.vel.set(dx / d * s, dy / d * s, dz / d * s); }
      else { o.vel.y -= 16 * dt; o.vel.x *= Math.exp(-2 * dt); o.vel.z *= Math.exp(-2 * dt); }
      o.pos.addScaledVector(o.vel, dt);
      const g = this.world.ground(o.pos.x, o.pos.z) + 0.6;
      if (o.pos.y < g) { o.pos.y = g; o.vel.y = Math.abs(o.vel.y) * 0.3; }
      o.sprite.position.copy(o.pos);
      o.sprite.scale.setScalar((o.kind === "core" ? 3 : 1.1) * (1 + Math.sin(this.time * 8 + i) * 0.15));
      if (d < 1.5 && !p.dead) {
        if (o.kind === "hp") { p.hp = Math.min(this.maxHp(), p.hp + this.maxHp() * 0.1); this.fx.number(p.pos.clone().setY(p.pos.y + 2.4), "+" + Math.round(this.maxHp() * 0.1), "#7dff8a", 17); audio.pickup(); }
        else if (o.kind === "en") { p.en = Math.min(100, p.en + 12); audio.pickup(); }
        else if (o.kind === "core") { p.cores = Math.min(3, p.cores + 1); audio.core(); this.banner("BEAST CORE ACQUIRED", "Press B to ascend Vesper — " + p.cores + " held", "#ffb04a"); this.fx.flash("#ffd890", 0.4, 600); this.addScorePts(1000, p.pos, "#ffb04a"); this.tutorial3(); }
        this.fx.burst(o.pos, 8, o.kind === "hp" ? 0x7dff8a : o.kind === "en" ? 0x7ae8ff : 0xffa030, 6, 0.6, 0.4, 0);
        this.scene.remove(o.sprite); this.orbs.splice(i, 1);
      }
    }
  }
  tutorial3() { if (!this.tut.core) { this.tut.core = true; setTimeout(() => this.hint(input.touch ? "Tap the Core button to ascend Vesper — use it at the right moment" : "Press B to ascend Vesper — it lasts ~30s, so save it for a hard fight", 8), 2500); } }

  /* ---------------- projectiles & blooms ---------------- */
  projectile(from: THREE.Vector3, dir: THREE.Vector3, o: { speed: number; dmg: number; color: number; homing?: number; life?: number; radius?: number; friendly?: boolean; mult?: number }) {
    const s = glowSprite(o.color, o.friendly ? 1.4 : 1.8, 1); s.position.copy(from); this.scene.add(s);
    this.projs.push({ pos: from.clone(), vel: dir.clone().multiplyScalar(o.speed), life: o.life ?? 3, dmg: o.dmg, mesh: s, homing: o.homing ?? 0, radius: o.radius ?? 0.5, friendly: !!o.friendly, color: o.color, mult: o.mult ?? 1 });
  }
  updateProjectiles(dt: number) {
    const p = this.p;
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const pr = this.projs[i];
      pr.life -= dt;
      const sp = pr.vel.length();
      if (pr.homing > 0) {
        let tgt: THREE.Vector3 | null = null;
        if (pr.friendly) { let bd = 30; for (const e of this.enemies) { if (!e.alive || (e.isBoss && (e as Warden).dormant)) continue; const d = e.pos.distanceTo(pr.pos); if (d < bd) { bd = d; tgt = this.tmpV2.copy(e.pos).setY(e.pos.y + e.height * 0.5); } } }
        else tgt = this.tmpV2.set(p.pos.x, p.pos.y + 1.1, p.pos.z);
        if (tgt) { const want = tgt.clone().sub(pr.pos).normalize().multiplyScalar(sp); pr.vel.lerp(want, Math.min(1, pr.homing * dt)); pr.vel.setLength(sp); }
      }
      pr.pos.addScaledVector(pr.vel, dt);
      pr.mesh.position.copy(pr.pos);
      this.fx.emit(pr.pos.x, pr.pos.y, pr.pos.z, 0, 0, 0, pr.color, 0.5, 0.3, 0, 0);
      let dead = pr.life <= 0;
      const gy = this.world.floor(pr.pos.x, pr.pos.z, pr.pos.y);
      if (pr.pos.y < gy) dead = true;
      if (pr.friendly) {
        for (const e of this.enemies) {
          if (!e.alive || (e.isBoss && (e as Warden).dormant)) continue;
          const cy = e.pos.y + e.height * 0.5 * e.def.scale;
          if (Math.hypot(e.pos.x - pr.pos.x, e.pos.z - pr.pos.z) < e.radius + pr.radius && Math.abs(cy - pr.pos.y) < e.height * 0.8 + 1) {
            this.hitEnemy(e, pr.mult, { poise: 12, kb: 3, vesper: true, noStop: true, heavy: pr.mult >= 2 });
            this.fx.burst(pr.pos, 12, pr.color, 9, 0.8, 0.4, 4); this.fx.sphere(pr.pos, pr.color, 0.3, 2.2, 0.2); dead = true; break;
          }
        }
        if (!dead) for (const py of this.boss.pylons) if (py.alive && py.pos.distanceTo(pr.pos) < 4) { py.hit(this.atkPower() * pr.mult); dead = true; }
      } else if (!p.dead) {
        const d = Math.hypot(p.pos.x - pr.pos.x, p.pos.z - pr.pos.z);
        if (d < pr.radius + 0.7 && Math.abs(p.pos.y + 1.1 - pr.pos.y) < 1.6) {
          const ang = Math.abs(angDiff(Math.atan2(pr.pos.x - p.pos.x, pr.pos.z - p.pos.z), p.yaw));
          if (p.blocking && p.blockT < 0.32 && ang < 1.9) { this.reflect(pr); this.parryFx(); }
          else { this.hurtPlayer(pr.dmg, pr.pos, { proj: true, kb: 3 }); this.fx.burst(pr.pos, 10, pr.color, 8, 0.8, 0.4, 4); dead = true; }
        }
      }
      if (dead) { this.fx.burst(pr.pos, 6, pr.color, 5, 0.6, 0.3, 4); this.scene.remove(pr.mesh); (pr.mesh as THREE.Sprite).material.dispose(); this.projs.splice(i, 1); }
    }
  }
  parryFx() { this.p.counter = 2.6; this.p.en = Math.min(100, this.p.en + 10); this.hitStopT = 0.08; }
  updateBlooms(dt: number) {
    for (let i = this.blooms.length - 1; i >= 0; i--) {
      const b = this.blooms[i]; b.t += dt; b.tick -= dt;
      const k = b.t / 1.8;
      b.mesh.scale.setScalar(0.7 + Math.sin(b.t * 14) * 0.08 + k * 0.8);
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = 0.5 + k * 0.4;
      for (let n = 0; n < 2; n++) { const a = Math.random() * 6.28, r = 7 + Math.random() * 2; this.fx.emit(b.pos.x + Math.cos(a) * r, b.pos.y + (Math.random() - 0.5) * 3, b.pos.z + Math.sin(a) * r, -Math.cos(a) * 9, 0, -Math.sin(a) * 9, 0xb070ff, 0.5, 0.7, 0, 0); }
      for (const e of this.enemies) {
        if (!e.alive || (e.isBoss && (e as Warden).dormant)) continue;
        const dx = b.pos.x - e.pos.x, dz = b.pos.z - e.pos.z, d = Math.hypot(dx, dz);
        if (d < 10 + e.radius && d > 0.5) { const pull = e.isBoss ? 0 : e.elite ? 2.5 : 9; e.pos.x += (dx / d) * pull * dt; e.pos.z += (dz / d) * pull * dt; }
      }
      if (b.tick <= 0) { b.tick = 0.45; for (const e of this.enemies) { if (!e.alive || (e.isBoss && (e as Warden).dormant)) continue; if (Math.hypot(b.pos.x - e.pos.x, b.pos.z - e.pos.z) < 9 + e.radius) this.hitEnemy(e, 0.35, { poise: 4, kb: 0, noStop: true }); } }
      if (b.t >= 1.8) {
        this.fx.sphere(b.pos, 0xc890ff, 1, 9, 0.5); this.fx.ring(b.pos, 0xc890ff, 1, 10, 0.5, -1); this.fx.burst(b.pos, 50, 0xc890ff, 18, 1.2, 0.8, 4); this.fx.addShake(0.7); audio.boom(); this.hitStopT = 0.07;
        for (const e of this.enemies) { if (!e.alive || (e.isBoss && (e as Warden).dormant)) continue; if (Math.hypot(b.pos.x - e.pos.x, b.pos.z - e.pos.z) < 9 + e.radius) this.hitEnemy(e, 2.8, { poise: 60, kb: 9, heavy: true, noStop: true }); }
        this.hitPylonsAt(b.pos, 9, this.atkPower() * 2.5);
        this.scene.remove(b.mesh); this.blooms.splice(i, 1);
      }
    }
  }

  /* ---------------- discovery, story, interaction ---------------- */
  updateDiscovery(dt: number) {
    this.fogT -= dt;
    if (this.fogT > 0) return;
    this.fogT = 0.5;
    const p = this.p;
    this.revealFog(p.pos.x, p.pos.z, p.flying || p.glide ? 120 : 75);
    const bi = this.currentRegionIdx();
    if (bi !== this.currentRegion) {
      this.currentRegion = bi;
      const first = !this.regionsSeen.has(bi);
      this.regionsSeen.add(bi);
      if (this.mode === "play" && !this.cine && this.runTime > 5) {
        this.banner(BIOMES[bi].name.toUpperCase(), "The Wastelands · Kaldraxis" + (first ? " — new region" : ""), "#ffe0a0");
        if (first) { this.addScorePts(300); this.gainXp(40); }
      }
    }
    for (const po of this.world.pois) {
      if (po.discovered) continue;
      const d = Math.hypot(p.pos.x - po.pos.x, p.pos.z - po.pos.z);
      if (d < po.r && (po.hidden ? Math.abs(p.pos.y - po.pos.y) < 25 || po.kind === "wind" : true)) {
        po.discovered = true; this.stats.discoveries++;
        const secret = po.kind === "secret";
        if (po.kind === "portal") { const pt = this.world.portals.find((x) => x.id === po.id); if (pt) pt.found = true; }
        if (po.id === "start") continue;
        this.banner(secret ? "SECRET DISCOVERED" : "DISCOVERED", po.name, secret ? "#9ff0ff" : "#ffe0a0");
        audio.discover(); this.addScorePts(secret ? 1500 : 250); this.gainXp(secret ? 220 : 45);
        if (po.kind === "wind") this.hint("Wind currents lift gliders — jump, then hold jump inside the glowing column", 6);
        if (po.kind === "stadium") this.hint("Warden Stadium. Its gate stands open… for now.", 5);
      }
    }
  }
  completeQuest() {
    const q = QUESTS[this.quest]; if (!q) return;
    this.questsDone.add(q.id);
    this.banner("QUEST COMPLETE", q.title, "#ffd24a"); audio.discover();
    this.addScorePts(500); this.gainXp(70 + this.quest * 30);
    this.quest++;
    const nq = QUESTS[this.quest];
    if (nq) setTimeout(() => { if (this.mode === "play") this.toast("New objective: " + nq.title, "#ffd24a"); }, 1800);
  }
  updateStory(_dt: number) {
    const id = QUESTS[this.quest]?.id;
    if (id === "wake" && this.stats.kills >= 3) {
      this.completeQuest();
      setTimeout(() => {
        if (this.mode !== "play") return;
        this.say("Vesper", [
          "♪ The little beast presses against your leg, ember-eyes wide. It hums — a lullaby you almost remember. ♪",
          "You have no name. No past. But the thing at your heel will not leave your side — and when it hums, the ruins to the north hum back.",
        ]);
      }, 1200);
    } else if (id === "level" && this.p.level >= 4) this.completeQuest();
    if (this.quest === 5 && !this.tut.warden && this.stats.discoveries > 0) { /* hint once near */ }
  }
  currentInteractables() { return this.world; }
  updateInteract() {
    const p = this.p, w = this.world;
    this.prompt = null; this.interactTarget = null;
    if (this.cine || p.dead || this.dialogue) return;
    let best = 1e9;
    const consider = (d: number, dy: number, lim: number, kind: string, obj: unknown, txt: string) => { if (d < lim && Math.abs(dy) < 3.2 && d < best) { best = d; this.interactTarget = { kind, obj }; this.prompt = txt; } };
    for (const c of w.chests) if (!c.opened) consider(Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z), c.pos.y - p.pos.y - (c.underwater ? 0.6 : 0), 3.4, "chest", c, "Open " + c.name);
    for (const t of w.tablets) consider(Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z), t.pos.y - p.pos.y - 1, 3.6, "tablet", t, t.read ? "Re-read Tablet" : "Read Ancient Tablet");
    for (const pt of w.portals) consider(Math.hypot(pt.pos.x - p.pos.x, pt.pos.z - p.pos.z), pt.pos.y - p.pos.y, 5.5, "portal", pt, pt.active ? "Travel — " + pt.name : "Awaken Waystone");
    for (const n of w.npcs) consider(Math.hypot(n.pos.x - p.pos.x, n.pos.z - p.pos.z), n.pos.y - p.pos.y, 3.8, "npc", n, "Talk to " + n.name);
  }
  doInteract() {
    const it = this.interactTarget; if (!it) return;
    const p = this.p;
    if (it.kind === "chest") this.openChest(it.obj as Chest);
    else if (it.kind === "tablet") this.readTablet(it.obj as Tablet);
    else if (it.kind === "portal") {
      const pt = it.obj as Portal;
      if (!pt.active) {
        pt.active = true; pt.found = true; this.stats.portals++; audio.portal();
        this.fx.ring(pt.pos, 0x56e8ff, 1, 14, 0.9, 0); this.fx.column(pt.pos, 0x56e8ff, 3, 50, 0.9); this.fx.addShake(0.4); this.fx.flash("#56e8ff", 0.3, 500);
        this.banner("WAYSTONE AWAKENED", pt.name + " — fast travel unlocked", "#56e8ff");
        this.addScorePts(300); this.gainXp(60);
        if (QUESTS[this.quest]?.id === "portal") setTimeout(() => this.completeQuest(), 1200);
        if (this.stats.portals === 1) setTimeout(() => this.say("Vesper", ["♪ The Waystone's song matches Vesper's hum, note for note. ♪", "Whoever carved these stones knew your companion's voice. Open the map (Tab) to travel between awakened Waystones."]), 1600);
      } else { this.menuTab = "map"; this.openMenu(); }
    } else if (it.kind === "npc") {
      const n = it.obj as Npc;
      const t = (this.talk[n.id] = (this.talk[n.id] || 0) + 1);
      const lines = n.id === "maren" && t > 1 ? n.lines.slice(2, 4) : n.lines;
      this.say(n.name, lines, () => { if (n.id === "maren" && QUESTS[this.quest]?.id === "village") this.completeQuest(); });
    }
    void p;
  }
  menuTab = "map";
  readTablet(t: Tablet) {
    const first = !t.read; t.read = true;
    const info = TABLETS[t.id - 1];
    audio.discover();
    this.say(info.title, [info.text], () => {
      if (first) {
        this.stats.tablets++; this.addScorePts(400); this.gainXp(80);
        this.toast(`Tablets read: ${this.stats.tablets} / ${this.world.tablets.length}`, "#56e8ff");
        if (QUESTS[this.quest]?.id === "tablet") { this.completeQuest(); setTimeout(() => this.say("Vesper", ["♪ Vesper nudges the carving, then you — as if the words on the stone were meant for your ears alone. ♪"]), 1500); }
      }
    });
    this.fx.burst(t.pos, 14, 0x56e8ff, 6, 0.6, 0.8, -1);
  }
  openChest(c: Chest) {
    c.opened = true; this.stats.chests++;
    audio.chest();
    const pos = c.pos.clone(); pos.y += 0.8;
    this.fx.burst(pos, 36, RARITY_COL[Math.min(4, c.tier + 1)] ? parseInt(RARITY_COL[Math.min(4, c.tier + 1)].slice(1), 16) : 0xffe08a, 9, 1.1, 1, -1);
    this.fx.column(c.pos, 0xffe08a, 1.2, 14, 0.7); this.fx.ring(c.pos, 0xffe08a, 0.5, 4, 0.5);
    this.addScorePts(150 * (c.tier + 1), c.pos); this.gainXp(30 + c.tier * 35);
    const p = this.p;
    p.hp = Math.min(this.maxHp(), p.hp + 40);
    let g: Gear | null = null;
    if (c.name === "Skyglass Reliquary") {
      g = gearById("voidpearl"); this.giveGear(g);
      p.cores = Math.min(3, p.cores + 1); this.banner("BEAST CORE FOUND", "The Skyglass Reliquary held a Core, humming for Vesper", "#ffb04a"); this.tutorial3();
    } else {
      const roll = Math.random();
      const lo = c.tier === 0 ? 0 : c.tier === 1 ? 1 : 2, hi = c.tier === 0 ? 1 : c.tier === 1 ? 2 : 3;
      if (roll < 0.55 + c.tier * 0.12) g = this.pickGear(lo, hi);
      if (g) this.giveGear(g);
      else { this.toast("+Essence cache — XP and healing", "#ffe08a"); this.gainXp(40 + c.tier * 40); p.en = Math.min(100, p.en + 30); }
      if (Math.random() < 0.35 + c.tier * 0.1) { this.spawnOrb("hp", pos); this.spawnOrb("en", pos); }
    }
    this.toast(`${c.name} opened (${this.stats.chests}/${this.world.chests.length})`, "#ffe08a");
  }

  /* ---------------- boss ---------------- */
  updateBoss(_dt: number) {
    const b = this.boss, st = this.world.stadium, p = this.p;
    if (!this.bossActive && !b.started && !p.dead && !this.cine && this.mode === "play") {
      const d = Math.hypot(p.pos.x - st.center.x, p.pos.z - st.center.z);
      if (d < 35 && p.pos.y < st.center.y + 12) this.startBossFight();
    }
    if (this.bossActive && !this.bossWon && p.dead) { /* player lost */ }
  }
  startBossFight() {
    const b = this.boss, st = this.world.stadium, p = this.p;
    this.bossActive = true; st.gateClosed = true; b.begin();
    audio.boom(); this.lockTarget = null; p.blocking = false; p.charging = false; p.act = null; p.glide = false;
    const bp = b.pos.clone();
    const pp = p.pos.clone();
    this.startCine(4.6, (k) => {
      const dir = new V3(pp.x - bp.x, 0, pp.z - bp.z).normalize();
      const ang = Math.atan2(dir.z, dir.x) + Math.sin(k * 2.2) * 0.6;
      const r = lerp(24, 15, k);
      const camA = new V3(bp.x + Math.cos(ang) * r, bp.y + lerp(3, 9, smooth(0, 0.7, k)), bp.z + Math.sin(ang) * r);
      const behind = new V3(pp.x - Math.sin(p.yaw) * 7, pp.y + 3.2, pp.z - Math.cos(p.yaw) * 7);
      const s = smooth(0.62, 1, k);
      this.camera.position.lerpVectors(camA, behind, s);
      const look = new V3(bp.x, bp.y + lerp(3, 7, k), bp.z).lerp(new V3(pp.x, pp.y + 1.5, pp.z), s * 0.5);
      this.camLook.copy(look); this.camera.lookAt(look);
      this.camera.fov = lerp(48, 62, k); this.camera.updateProjectionMatrix();
      if (k > 0.35 && !this.tut.bossRoar) { this.tut.bossRoar = true; audio.roar(); this.fx.addShake(1.2); this.fx.ring(bp, 0xff8a30, 2, 40, 1.2); this.fx.flash("#fff", 0.35, 400); this.banner("THE WARDEN", "Keeper of the Last Gate", "#ff9a5a"); this.fx.burst(bp.clone().setY(bp.y + 6), 60, 0xffa060, 18, 1.4, 1.2, 0); }
      if (k > 0.5 && !this.tut.bossSub) { this.tut.bossSub = true; this.subtitle = { name: "The Warden", text: "Binder. You return, and remember nothing. Good. Let us see if you still mean the oath.", t: 4.5 }; }
    }, () => {
      this.hint(input.touch ? "Parry red cleaves · jump shockwaves · lure the charge into a pillar" : "Parry red cleaves · jump the shockwaves · lure its charge into a pillar to topple it", 8);
    });
    this.tut.bossRoar = false; this.tut.bossSub = false;
    this.world.stadium.floorMat.emissive.set(0xff6a3a);
  }
  discoverMechanic() { if (!this.mechanicSeen) { this.mechanicSeen = true; this.toast("Toppled pillars stun the Warden — and cannot be reused", "#ffd24a"); } }
  bossDefeated() {
    const b = this.boss, p = this.p, st = this.world.stadium;
    this.bossWon = true; this.bossActive = true;
    this.slow(0.2, 3); this.fx.flash("#ffffff", 0.9, 1500); this.fx.addShake(1.5); audio.roar();
    const bp = b.pos.clone();
    this.env.setWeather("clear");
    st.floorMat.emissive.set(0x2fb8ff);
    this.cine = null;
    this.startCine(6.5, (k) => {
      const a = 1.2 + k * 1.6, r = lerp(26, 18, k);
      this.camera.position.set(bp.x + Math.cos(a) * r, bp.y + 6 + k * 4, bp.z + Math.sin(a) * r);
      this.camLook.set(bp.x, bp.y + lerp(5, 8, k), bp.z); this.camera.lookAt(this.camLook);
      this.camera.fov = 50; this.camera.updateProjectionMatrix();
      if (k > 0.75 && !this.tut.bossBeam) { this.tut.bossBeam = true; this.fx.column(bp, 0x9ff0ff, 4, 120, 1.5); this.fx.sphere(bp.clone().setY(bp.y + 5), 0x9ff0ff, 1, 22, 1); this.fx.flash("#9ff0ff", 0.6, 900); audio.boom(); }
    }, () => {
      st.gateClosed = false;
      p.hp = Math.min(this.maxHp(), p.hp + this.maxHp() * 0.5);
      this.giveGear(gearById("wardensedge"));
      this.p.cores = Math.min(3, this.p.cores + 1);
      this.addScorePts(6000); this.gainXp(1500);
      this.banner("THE WARDEN FALLS", "Beast Core obtained · Warden's Edge claimed", "#9ff0ff");
      if (QUESTS[this.quest]?.id !== "warden") this.quest = QUESTS.findIndex((q) => q.id === "warden");
      this.completeQuest();
      this.tutorial3();
      this.say("The Warden", [
        "…So. The Binder still has their hands.",
        "The gate was never to keep you out, Wayfarer. It was to keep you from remembering what you built it to hold.",
        "Six more Wardens wait beyond the Tidewall. Each guards a verse of the Song you broke. And each will ask the same question: do you still mean it?",
      ], () => {
        this.say("Vesper", ["♪ The humming grows louder. For a heartbeat, you remember the sound of a voice that was yours. ♪", "The Wastelands are open to you now. Beyond the Tidewall, the world waits — but so does everything you left behind."], () => this.victory());
      });
    });
  }
  victory() {
    this.mode = "victory"; audio.setMode("off");
    this.finalObj = null;
    if (document.pointerLockElement) document.exitPointerLock();
  }
  continueAfterVictory() { this.mode = "play"; this.requestLock(); this.bossActive = true; this.updateMusic(); }
}
