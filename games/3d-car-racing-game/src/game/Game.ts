import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  AI_NAMES,
  CARS,
  DIFFICULTY_SKILL,
  PAINTS,
  THEMES,
  type CarDef,
  type Difficulty,
  type TrackDef,
} from "./data";
import { buildTrackData, type TrackData } from "./trackMath";
import {
  aiDrive,
  createSimCar,
  placeCar,
  rankCars,
  resolveBarrier,
  resolveCars,
  stepCar,
  updateLaps,
  wrapPi,
  type Env,
  type SimCar,
} from "./sim";
import { buildCar, type CarModel } from "./carModel";
import { buildSky, buildWeather, buildWorld, type World } from "./scenery";
import { GameAudio } from "./audio";
import { dotTexture, glowTexture } from "./textures";

export interface BoardEntry {
  id: number;
  name: string;
  car: string;
  color: number;
  isPlayer: boolean;
  place: number;
  lap: number;
  finished: boolean;
  finishTime: number;
  bestLap: number;
  gap: number;
}

export interface HudState {
  phase: "countdown" | "racing" | "finished";
  speed: number; // km/h
  gear: number;
  rpm: number;
  nitro: number;
  nitroOn: boolean;
  lap: number;
  laps: number;
  place: number;
  total: number;
  lapTime: number;
  bestLap: number;
  lastLap: number;
  raceTime: number;
  wrongWay: boolean;
  offRoad: boolean;
  board: BoardEntry[];
  cam: number;
  drift: boolean;
}

export interface GameOptions {
  track: TrackDef;
  car: CarDef;
  color: number;
  laps: number;
  aiCount: number;
  difficulty: Difficulty;
  recordLap: number;
  minimap: HTMLCanvasElement | null;
  onHud: (h: HudState) => void;
  onCountdown: (text: string) => void;
  onMessage: (text: string, kind: "info" | "good" | "warn") => void;
  onPauseChange: (paused: boolean) => void;
  onFinish: (position: number, time: number, best: number) => void;
  onReady: () => void;
}

export interface TouchInput {
  left: boolean;
  right: boolean;
  gas: boolean;
  brake: boolean;
  nitro: boolean;
  hand: boolean;
}

interface Racer {
  sim: SimCar;
  model: CarModel;
  wheelSpin: number;
  pitch: number;
  roll: number;
  tag: THREE.Sprite | null;
  skidLast: ({ x: number; z: number } | null)[];
  puff: number;
}

class Pool {
  sprites: THREE.Sprite[] = [];
  life: Float32Array;
  max: Float32Array;
  vel: Float32Array;
  s0: Float32Array;
  s1: Float32Array;
  o0: Float32Array;
  next = 0;
  constructor(
    private scene: THREE.Scene,
    private count: number,
    blending: THREE.Blending,
    map: THREE.Texture,
  ) {
    this.life = new Float32Array(count);
    this.max = new Float32Array(count).fill(1);
    this.vel = new Float32Array(count * 3);
    this.s0 = new Float32Array(count);
    this.s1 = new Float32Array(count);
    this.o0 = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const m = new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, blending, opacity: 0 });
      const s = new THREE.Sprite(m);
      s.visible = false;
      s.renderOrder = 5;
      scene.add(s);
      this.sprites.push(s);
    }
  }
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, s0: number, s1: number, o0: number, color: number) {
    const i = this.next++ % this.count;
    const s = this.sprites[i];
    s.position.set(x, y, z);
    s.visible = true;
    (s.material as THREE.SpriteMaterial).color.setHex(color);
    this.life[i] = life;
    this.max[i] = life;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.s0[i] = s0;
    this.s1[i] = s1;
    this.o0[i] = o0;
  }
  update(dt: number) {
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const s = this.sprites[i];
      if (this.life[i] <= 0) {
        s.visible = false;
        continue;
      }
      const k = 1 - this.life[i] / this.max[i];
      s.position.x += this.vel[i * 3] * dt;
      s.position.y += this.vel[i * 3 + 1] * dt;
      s.position.z += this.vel[i * 3 + 2] * dt;
      const sc = this.s0[i] + (this.s1[i] - this.s0[i]) * k;
      s.scale.set(sc, sc, 1);
      (s.material as THREE.SpriteMaterial).opacity = this.o0[i] * (1 - k);
    }
  }
  dispose() {
    this.sprites.forEach((s) => {
      this.scene.remove(s);
      (s.material as THREE.Material).dispose();
    });
  }
}

const SKID_MAX = 1400;

export class Game {
  private opts: GameOptions;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private container: HTMLElement;
  private track: TrackData;
  private theme;
  private env: Env;
  private world: World;
  private sky: ReturnType<typeof buildSky>;
  private weather: ReturnType<typeof buildWeather> | null = null;
  private sun: THREE.DirectionalLight;
  private racers: Racer[] = [];
  private player!: Racer;
  private audio = new GameAudio();
  private smoke: Pool;
  private fire: Pool;
  private skidMesh: THREE.Mesh;
  private skidPos: Float32Array;
  private skidIdx = 0;
  private headlight: THREE.SpotLight | null = null;
  private disposed = false;
  private raf = 0;
  private last = 0;
  private time = 0;
  private raceTime = 0;
  private countdown = 4.2;
  private lastBeep = 99;
  private phase: HudState["phase"] = "countdown";
  private paused = false;
  private keys = new Set<string>();
  private touch: TouchInput = { left: false, right: false, gas: false, brake: false, nitro: false, hand: false };
  private camMode = 0;
  private camAngle = 0;
  private camY = 0;
  private fov = 62;
  private shake = 0;
  private camVel = new THREE.Vector3();
  private prevCam = new THREE.Vector3();
  private hudTimer = 0;
  private miniTimer = 0;
  private lastLap = 0;
  private ro: ResizeObserver;
  private miniCache: { pts: [number, number][]; sc: number; ox: number; oy: number } | null = null;
  private pmrem: THREE.PMREMGenerator;
  private envTex: THREE.Texture;
  private winner = 0;
  private playerPlace = 0;
  private glow: THREE.Texture;
  private dot: THREE.Texture;
  private lastRank: SimCar[] = [];

  constructor(container: HTMLElement, opts: GameOptions) {
    this.opts = opts;
    this.container = container;
    const theme = THEMES[opts.track.theme];
    this.theme = theme;
    this.env = { roadGrip: theme.roadGrip, offroadGrip: theme.offroadGrip };

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = theme.exposure;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(62, w / h, 0.3, 4500);
    this.scene.fog = new THREE.FogExp2(theme.fog, theme.fogDensity);

    // environment reflections
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = theme.envIntensity;

    // lights
    const hemi = new THREE.HemisphereLight(theme.hemiSky, theme.hemiGround, theme.hemiIntensity);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(theme.sunColor, theme.sunIntensity);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -75;
    sc.right = 75;
    sc.top = 75;
    sc.bottom = -75;
    sc.near = 1;
    sc.far = 500;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.05;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // world
    this.track = buildTrackData(opts.track);
    this.sky = buildSky(this.scene, theme);
    this.world = buildWorld(this.scene, this.track, opts.track, theme);
    if (theme.weather !== "clear") this.weather = buildWeather(this.scene, theme.weather);

    this.glow = glowTexture();
    this.dot = dotTexture();
    this.smoke = new Pool(this.scene, 140, THREE.NormalBlending, this.glow);
    this.fire = new Pool(this.scene, 90, THREE.AdditiveBlending, this.dot);

    // skid marks
    this.skidPos = new Float32Array(SKID_MAX * 4 * 3);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(this.skidPos, 3));
    const idx = new Uint32Array(SKID_MAX * 6);
    for (let i = 0; i < SKID_MAX; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 1, i * 4 + 3, i * 4 + 2], i * 6);
    sg.setIndex(new THREE.BufferAttribute(idx, 1));
    this.skidMesh = new THREE.Mesh(
      sg,
      new THREE.MeshBasicMaterial({
        color: 0x050505,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        side: THREE.DoubleSide,
      }),
    );
    this.skidMesh.frustumCulled = false;
    this.scene.add(this.skidMesh);

    this.setupRacers();
    this.buildMinimap();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);

    // first camera placement
    this.camAngle = this.player.sim.psi;
    this.camY = this.player.sim.y + 3;
  }

  /* ------------------------------------------------------------ setup */

  private makeTag(name: string) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 56;
    const g = c.getContext("2d")!;
    g.fillStyle = "rgba(8,10,20,0.62)";
    const r = 10;
    g.beginPath();
    g.moveTo(r, 4);
    g.lineTo(256 - r, 4);
    g.quadraticCurveTo(252, 4, 252, r + 4);
    g.lineTo(252, 52 - r);
    g.quadraticCurveTo(252, 52, 256 - r - 4, 52);
    g.lineTo(r + 4, 52);
    g.quadraticCurveTo(4, 52, 4, 52 - r);
    g.lineTo(4, r + 4);
    g.quadraticCurveTo(4, 4, r + 4, 4);
    g.fill();
    g.fillStyle = "#fff";
    g.font = "bold 26px Arial, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(name, 128, 30);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
    s.scale.set(5, 1.1, 1);
    s.visible = false;
    s.renderOrder = 8;
    this.scene.add(s);
    return s;
  }

  private setupRacers() {
    const o = this.opts;
    const total = o.aiCount + 1;
    const skillBase = DIFFICULTY_SKILL[o.difficulty];
    const names = [...AI_NAMES].sort(() => Math.random() - 0.5);
    const playerSlot = Math.min(total - 1, 3);
    const numbers = new Set<number>();
    const num = () => {
      let n = 2 + Math.floor(Math.random() * 97);
      while (numbers.has(n)) n = 2 + Math.floor(Math.random() * 97);
      numbers.add(n);
      return n;
    };
    let ai = 0;
    for (let slot = 0; slot < total; slot++) {
      const isPlayer = slot === playerSlot;
      let def: CarDef;
      let color: number;
      let name: string;
      if (isPlayer) {
        def = o.car;
        color = o.color;
        name = "YOU";
      } else {
        def = CARS[Math.floor(Math.random() * CARS.length)];
        color = PAINTS[Math.floor(Math.random() * PAINTS.length)];
        if (color === o.color) color = PAINTS[(PAINTS.indexOf(color) + 3) % PAINTS.length];
        name = names[ai % names.length];
        ai++;
      }
      const model = buildCar(def, color, isPlayer ? 1 : num());
      const sim = createSimCar(slot, name, def, color, { len: model.len, wid: model.wid }, isPlayer);
      sim.skill = isPlayer ? 0.95 : Math.min(1, skillBase * (0.965 + Math.random() * 0.06));
      sim.aiBaseLane = (Math.random() - 0.5) * 6;
      sim.aiLane = sim.aiBaseLane;
      const row = Math.floor(slot / 2);
      placeCar(this.track, sim, -9 - row * 8.5 - (slot % 2) * 3, slot % 2 ? 3.6 : -3.6);
      model.group.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).receiveShadow = false;
      });
      this.scene.add(model.group);
      const r: Racer = {
        sim,
        model,
        wheelSpin: 0,
        pitch: 0,
        roll: 0,
        tag: isPlayer ? null : this.makeTag(name),
        skidLast: [null, null],
        puff: 0,
      };
      this.racers.push(r);
      if (isPlayer) this.player = r;
      this.syncModel(r, 0);
    }

    if (this.theme.night) {
      const sl = new THREE.SpotLight(0xfff1d6, 380, 130, 0.55, 0.6, 1.5);
      sl.position.set(0, this.player.model.headY + 0.3, this.player.model.headZ - 0.4);
      sl.target.position.set(0, 0.2, this.player.model.headZ + 25);
      this.player.model.group.add(sl);
      this.player.model.group.add(sl.target);
      this.headlight = sl;
    }
    this.lastRank = rankCars(this.racers.map((r) => r.sim));
  }

  private buildMinimap() {
    const pts = this.track.pts;
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    const size = 200;
    const pad = 16;
    const sc = Math.min((size - pad * 2) / (maxX - minX), (size - pad * 2) / (maxZ - minZ));
    const ox = size / 2 - ((minX + maxX) / 2) * sc;
    const oy = size / 2 - ((minZ + maxZ) / 2) * sc;
    const step = 3;
    const arr: [number, number][] = [];
    for (let i = 0; i < pts.length; i += step) arr.push([pts[i].x * sc + ox, pts[i].z * sc + oy]);
    this.miniCache = { pts: arr, sc, ox, oy };
  }

  /* ------------------------------------------------------------ input */

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(k);
    if (k === "c") this.camMode = (this.camMode + 1) % 3;
    if (k === "r" && this.phase === "racing") this.resetPlayer();
    if (k === "m") this.audio.setMuted(!this.audio.isMuted());
    if (k === "n") this.audio.setMusic(!this.audio.isMusic());
    if (k === "escape" || k === "p") this.setPaused(!this.paused);
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };
  private onBlur = () => {
    this.keys.clear();
    if (this.phase !== "finished" && !this.paused) this.setPaused(true);
  };

  setTouch(t: Partial<TouchInput>) {
    Object.assign(this.touch, t);
  }
  cycleCamera() {
    this.camMode = (this.camMode + 1) % 3;
  }
  resetPlayer() {
    const p = this.player.sim;
    if (p.finished) return;
    const s = p.sAbs;
    placeCar(this.track, p, s, 0, false);
    p.speed = 0;
    this.camAngle = p.psi;
    this.opts.onMessage("Car reset to track", "info");
  }
  toggleMute() {
    this.audio.setMuted(!this.audio.isMuted());
    return this.audio.isMuted();
  }
  toggleMusic() {
    this.audio.setMusic(!this.audio.isMusic());
    return this.audio.isMusic();
  }
  getAudio() {
    return { muted: this.audio.isMuted(), music: this.audio.isMusic() };
  }

  setPaused(p: boolean) {
    if (this.paused === p) return;
    this.paused = p;
    if (p) this.audio.update(0.15, 0, 0, 0, false, true);
    else this.last = performance.now();
    this.opts.onPauseChange(p);
  }

  private pollInput(sim: SimCar) {
    const k = this.keys;
    const t = this.touch;
    let throttle = k.has("arrowup") || k.has("w") || t.gas ? 1 : 0;
    let brake = k.has("arrowdown") || k.has("s") || t.brake ? 1 : 0;
    let steer = (k.has("arrowleft") || k.has("a") || t.left ? 1 : 0) - (k.has("arrowright") || k.has("d") || t.right ? 1 : 0);
    let nitro = k.has("shift") || k.has("e") || t.nitro;
    let hand = k.has(" ") || t.hand;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && pads[0];
    if (gp) {
      const ax = gp.axes[0] ?? 0;
      if (Math.abs(ax) > 0.12) steer = -ax;
      const rt = gp.buttons[7]?.value ?? 0;
      const lt = gp.buttons[6]?.value ?? 0;
      if (rt > 0.05) throttle = Math.max(throttle, rt);
      if (lt > 0.05) brake = Math.max(brake, lt);
      if (gp.buttons[0]?.pressed || gp.buttons[5]?.pressed) nitro = true;
      if (gp.buttons[2]?.pressed || gp.buttons[1]?.pressed) hand = true;
    }
    sim.throttle = throttle;
    sim.brake = brake;
    sim.steerIn = steer;
    sim.nitroWant = nitro;
    sim.hand = hand;
  }

  /* ------------------------------------------------------------ loop */

  start() {
    this.audio.init();
    this.audio.resume();
    this.last = performance.now();
    this.opts.onReady();
    const loop = (now: number) => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      this.tick(now);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private tick(now: number) {
    let dt = (now - this.last) / 1000;
    this.last = now;
    dt = Math.min(0.05, Math.max(0, dt));
    if (this.paused) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.time += dt;

    // phase handling
    if (this.phase === "countdown") {
      this.countdown -= dt;
      const c = Math.ceil(this.countdown - 1.2);
      if (this.countdown > 1.2) {
        if (c !== this.lastBeep && c >= 1 && c <= 3) {
          this.lastBeep = c;
          this.audio.beep(false);
          this.opts.onCountdown(String(c));
        }
      } else if (this.lastBeep !== 0) {
        this.lastBeep = 0;
        this.audio.beep(true);
        this.opts.onCountdown("GO!");
        this.phase = "racing";
        this.raceTime = 0;
        this.opts.onMessage("Race started — good luck!", "good");
      }
    }

    if (this.phase !== "countdown") {
      this.simulate(dt);
    } else {
      // allow revving on the grid
      this.pollInput(this.player.sim);
      for (const r of this.racers) {
        const s = r.sim;
        s.rpm += ((this.player === r ? 0.2 + s.throttle * 0.7 : 0.25) - s.rpm) * Math.min(1, dt * 8);
        s.hit = 0;
        s.carHit = 0;
      }
    }

    // visuals
    for (const r of this.racers) this.syncModel(r, dt);
    this.updateEffects(dt);
    this.updateCamera(dt);
    this.updateLights();
    this.world.update(dt, this.time, this.camera);
    this.sky.update(this.camera);
    if (this.weather) this.weather.update(this.camera, this.time, this.camVel);

    // audio
    const p = this.player.sim;
    const skid = p.sliding || (p.brake > 0.8 && p.speed > 22) ? Math.min(1, Math.abs(p.vs) / 8 + 0.35) : p.onRoad ? 0 : 0.2;
    this.audio.update(p.rpm, p.throttle, Math.min(1, Math.abs(p.speed) / 80), skid, p.nitroOn, false);

    // hud
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.06;
      this.emitHud();
    }
    this.miniTimer -= dt;
    if (this.miniTimer <= 0) {
      this.miniTimer = 0.05;
      this.drawMinimap();
    }

    this.renderer.render(this.scene, this.camera);
  }

  private simulate(dt: number) {
    const steps = Math.max(1, Math.ceil(dt / (1 / 90)));
    const h = dt / steps;
    const track = this.track;
    const sims = this.racers.map((r) => r.sim);
    const player = this.player.sim;
    for (let s = 0; s < steps; s++) {
      this.raceTime += h;
      for (const car of sims) {
        car.hit = 0;
        car.carHit = 0;
        if (car.auto) {
          let band = 1;
          if (!car.isPlayer) {
            const d = car.total - player.total;
            band = d > 0 ? 1 - Math.min(0.06, d / 1800) : 1 + Math.min(0.045, -d / 2200);
          }
          aiDrive(track, car, sims, h, this.env, band);
        } else {
          this.pollInput(car);
        }
        stepCar(track, car, h, this.env);
      }
      resolveCars(sims);
      for (const car of sims) {
        const hit0 = car.hit;
        resolveBarrier(track, car, h);
        car.hit = Math.max(car.hit, hit0);
        if (updateLaps(track, car, this.raceTime, this.opts.laps)) this.onLap(car);
      }
    }
    // impacts feedback for the player
    if (player.hit > 2.5 || player.carHit > 2.5) {
      const imp = Math.max(player.hit, player.carHit);
      this.audio.thump(imp);
      this.shake = Math.min(1, this.shake + imp / 14);
      this.sparks(this.player, imp);
    }
    for (const r of this.racers) {
      if (r !== this.player && (r.sim.hit > 4 || r.sim.carHit > 4)) this.sparks(r, 6);
    }
    this.lastRank = rankCars(sims);
  }

  private onLap(car: SimCar) {
    const lt = car.lapTimes[car.lapTimes.length - 1];
    if (car.isPlayer || (car === this.player.sim)) {
      this.lastLap = lt;
      const lapsLeft = this.opts.laps - car.lapsDone;
      if (!car.finished) {
        const isBest = lt <= car.bestLap + 1e-6;
        const rec = this.opts.recordLap;
        if (isFinite(rec) && lt < rec && isBest) {
          this.opts.onMessage(`NEW TRACK RECORD  ${fmt(lt)}`, "good");
          this.audio.jingle();
        } else if (isBest && car.lapsDone > 1) {
          this.opts.onMessage(`Best lap  ${fmt(lt)}`, "good");
        } else {
          this.opts.onMessage(`Lap ${car.lapsDone} complete  ${fmt(lt)}`, "info");
        }
        if (lapsLeft === 1) this.opts.onMessage("FINAL LAP!", "warn");
      }
    }
    if (car.finished) {
      this.winner++;
      car.place = this.winner;
      if (car === this.player.sim) {
        this.playerPlace = car.place;
        this.phase = "finished";
        car.auto = true;
        car.skill = 0.9;
        car.aiBaseLane = 0;
        this.audio.jingle();
        this.opts.onFinish(car.place, car.finishTime, isFinite(car.bestLap) ? car.bestLap : lt);
      }
    }
  }

  /* ------------------------------------------------------------ visuals */

  private syncModel(r: Racer, dt: number) {
    const s = r.sim;
    const m = r.model;
    m.group.position.set(s.x, s.y, s.z);
    m.group.rotation.y = s.psi;
    const p = this.track.pts[s.idx];
    const slopePitch = -Math.atan(p.slope * Math.cos(s.relPsi));
    const targetPitch = slopePitch + THREE.MathUtils.clamp(-s.longAcc * 0.0032, -0.05, 0.05);
    const targetRoll = THREE.MathUtils.clamp(-s.yaw * s.speed * 0.0016, -0.07, 0.07) + THREE.MathUtils.clamp(s.vs * -0.004, -0.04, 0.04);
    const k = Math.min(1, dt * 9);
    r.pitch += (targetPitch - r.pitch) * (dt === 0 ? 1 : k);
    r.roll += (targetRoll - r.roll) * (dt === 0 ? 1 : k);
    m.tilt.rotation.set(r.pitch, 0, r.roll);
    r.wheelSpin += (s.speed * dt) / m.wheels[0].radius;
    for (const w of m.wheels) {
      w.spin.rotation.x = r.wheelSpin;
      if (w.front) w.pivot.rotation.y = s.steer * 0.42;
    }
    m.brakeMat.emissiveIntensity = s.brake > 0.1 && s.speed > 0.5 ? 4.5 : 0.9;
    const fl = s.nitroOn;
    for (const f of m.flames) {
      f.visible = fl;
      if (fl) {
        const sc = 0.7 + Math.random() * 0.7;
        f.scale.set(1, 1, sc);
        f.rotation.z = Math.random() * 6;
      }
    }
    // name tag
    if (r.tag) {
      const dx = s.x - this.camera.position.x;
      const dz = s.z - this.camera.position.z;
      const d = Math.hypot(dx, dz);
      r.tag.visible = d < 85 && d > 6 && this.phase !== "countdown";
      r.tag.position.set(s.x, s.y + 2.9 + d * 0.012, s.z);
      const sc = 0.9 + d * 0.012;
      r.tag.scale.set(5 * sc, 1.1 * sc, 1);
      (r.tag.material as THREE.SpriteMaterial).opacity = THREE.MathUtils.clamp((85 - d) / 30, 0, 1);
    }
  }

  private sparks(r: Racer, imp: number) {
    const s = r.sim;
    for (let i = 0; i < 6 + imp; i++) {
      this.fire.spawn(
        s.x + (Math.random() - 0.5) * 2,
        s.y + 0.4 + Math.random() * 0.6,
        s.z + (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 9,
        Math.random() * 5,
        (Math.random() - 0.5) * 9,
        0.35 + Math.random() * 0.3,
        0.35,
        0.05,
        1,
        0xffb347,
      );
    }
  }

  private updateEffects(dt: number) {
    const camPos = this.camera.position;
    const smokeCol = this.theme.id === "alpine" ? 0xffffff : 0xdddddd;
    for (const r of this.racers) {
      const s = r.sim;
      const m = r.model;
      if (this.phase === "countdown") continue;
      const fx = Math.sin(s.psi);
      const fz = Math.cos(s.psi);
      const sx = fz;
      const sz = -fx;
      const rear = m.wheels[2].pivot.position;
      const dist = Math.hypot(s.x - camPos.x, s.z - camPos.z);
      const sliding =
        (s.sliding || (s.brake > 0.8 && s.speed > 22) || (s.hand && Math.abs(s.speed) > 12)) && s.onRoad;
      const near = dist < 120;
      for (let w = 0; w < 2; w++) {
        const side = w === 0 ? -1 : 1;
        const wx = s.x + sx * side * rear.x + fx * rear.z;
        const wz = s.z + sz * side * rear.x + fz * rear.z;
        // skid marks
        if (sliding && near) {
          const last = r.skidLast[w];
          if (last) {
            this.addSkid(last.x, last.z, wx, wz, s.y + 0.04);
          }
          r.skidLast[w] = { x: wx, z: wz };
        } else r.skidLast[w] = null;
      }
      // smoke / dust
      if (near) {
        r.puff -= dt;
        if (r.puff <= 0) {
          if (sliding) {
            r.puff = 0.03;
            for (const side of [-1, 1]) {
              this.smoke.spawn(
                s.x + sx * side * rear.x + fx * rear.z,
                s.y + 0.25,
                s.z + sz * side * rear.x + fz * rear.z,
                (Math.random() - 0.5) * 1.5,
                0.8 + Math.random(),
                (Math.random() - 0.5) * 1.5,
                0.9 + Math.random() * 0.5,
                1.2,
                4.5,
                0.38,
                smokeCol,
              );
            }
          } else if (!s.onRoad && Math.abs(s.speed) > 8) {
            r.puff = 0.04;
            const col = this.theme.id === "alpine" ? 0xffffff : this.theme.runoff;
            for (const side of [-1, 1]) {
              this.smoke.spawn(
                s.x + sx * side * rear.x + fx * rear.z,
                s.y + 0.2,
                s.z + sz * side * rear.x + fz * rear.z,
                (Math.random() - 0.5) * 2,
                1 + Math.random() * 1.5,
                (Math.random() - 0.5) * 2,
                0.9,
                1.0,
                4.0,
                0.5,
                col,
              );
            }
          } else r.puff = 0.05;
        }
        if (s.nitroOn) {
          for (const side of [-0.28, 0.28]) {
            this.fire.spawn(
              s.x + sx * side * m.wid + fx * (m.headZ * -1 - 0.4),
              s.y + 0.4,
              s.z + sz * side * m.wid + fz * (m.headZ * -1 - 0.4),
              -fx * 6 + (Math.random() - 0.5),
              (Math.random() - 0.3) * 0.8,
              -fz * 6 + (Math.random() - 0.5),
              0.28,
              0.7,
              0.1,
              0.9,
              Math.random() > 0.5 ? 0x66bbff : 0xff9a3c,
            );
          }
        }
      }
    }
    this.smoke.update(dt);
    this.fire.update(dt);
    (this.skidMesh.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = this.skidDirty;
    this.skidDirty = false;
  }

  private skidDirty = false;
  private addSkid(x0: number, z0: number, x1: number, z1: number, y: number) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const l = Math.hypot(dx, dz);
    if (l < 0.01 || l > 4) return;
    const nx = (-dz / l) * 0.14;
    const nz = (dx / l) * 0.14;
    const i = this.skidIdx++ % SKID_MAX;
    this.skidPos.set([x0 + nx, y, z0 + nz, x0 - nx, y, z0 - nz, x1 + nx, y, z1 + nz, x1 - nx, y, z1 - nz], i * 12);
    this.skidDirty = true;
  }

  private updateCamera(dt: number) {
    const p = this.player.sim;
    const cam = this.camera;
    const speed01 = Math.min(1, Math.abs(p.speed) / 75);
    this.prevCam.copy(cam.position);

    let targetFov = 62 + speed01 * 14 + (p.nitroOn ? 10 : 0);
    let lookX: number, lookY: number, lookZ: number;

    if (this.phase === "countdown") {
      const k = Math.max(0, Math.min(1, (this.countdown - 1.2) / 3.0));
      const e = k * k * (3 - 2 * k);
      const a = p.psi + Math.PI * (1 + e * 1.25);
      const R = 6 + e * 9;
      cam.position.set(p.x + Math.sin(a) * R, p.y + 2.2 + e * 2.2, p.z + Math.cos(a) * R);
      lookX = p.x;
      lookY = p.y + 0.9;
      lookZ = p.z;
      this.camAngle = p.psi;
      this.camY = cam.position.y;
      targetFov = 55;
    } else if (this.camMode === 2) {
      const fx = Math.sin(p.psi);
      const fz = Math.cos(p.psi);
      const hy = this.player.model.headY;
      cam.position.set(p.x + fx * 0.15, p.y + hy + 0.55, p.z + fz * 0.15);
      lookX = p.x + fx * 30;
      lookZ = p.z + fz * 30;
      lookY = p.y + hy + 0.45 + this.track.pts[p.idx].slope * 30;
      this.camAngle = p.psi;
      targetFov = 72 + speed01 * 14 + (p.nitroOn ? 8 : 0);
    } else {
      let ta = p.psi;
      if (p.speed > 8) {
        const va = Math.atan2(p.vx, p.vz);
        ta = p.psi + wrapPi(va - p.psi) * 0.4;
      }
      this.camAngle += wrapPi(ta - this.camAngle) * Math.min(1, dt * (this.camMode === 0 ? 5 : 6.5));
      const near = this.camMode === 1;
      const dist = (near ? 5.3 : 7.8) + speed01 * (near ? 0.8 : 1.6) + (p.nitroOn ? 0.8 : 0);
      const height = (near ? 1.75 : 2.9) + speed01 * 0.2;
      const desiredY = p.y + height;
      this.camY += (desiredY - this.camY) * Math.min(1, dt * 7);
      cam.position.set(p.x - Math.sin(this.camAngle) * dist, this.camY, p.z - Math.cos(this.camAngle) * dist);
      lookX = p.x + Math.sin(this.camAngle) * 7;
      lookZ = p.z + Math.cos(this.camAngle) * 7;
      lookY = p.y + (near ? 1.1 : 1.3);
    }

    // shake
    if (this.shake > 0.001) {
      const sh = this.shake * 0.35;
      cam.position.x += (Math.random() - 0.5) * sh;
      cam.position.y += (Math.random() - 0.5) * sh;
      cam.position.z += (Math.random() - 0.5) * sh;
      this.shake *= Math.exp(-dt * 6);
    }
    // speed buzz
    if (p.nitroOn) {
      cam.position.y += (Math.random() - 0.5) * 0.04;
    }
    cam.lookAt(lookX, lookY, lookZ);
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 4);
    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }
    if (dt > 0) this.camVel.copy(cam.position).sub(this.prevCam).divideScalar(dt).clampLength(0, 110);
  }

  private updateLights() {
    const p = this.player.sim;
    const dir = this.sky.sunDir;
    this.sun.position.set(p.x + dir.x * 160, p.y + dir.y * 160, p.z + dir.z * 160);
    this.sun.target.position.set(p.x, p.y, p.z);
    this.sun.target.updateMatrixWorld();
  }

  /* ------------------------------------------------------------ hud */

  private emitHud() {
    const p = this.player.sim;
    const ranked = this.lastRank;
    const place = ranked.indexOf(p) + 1;
    const leader = ranked[0];
    const board: BoardEntry[] = ranked.map((c, i) => {
      const r = this.racers.find((q) => q.sim === c)!;
      return {
        id: c.id,
        name: c.name,
        car: r.model ? c.def.name : "",
        color: c.color,
        isPlayer: c === p,
        place: i + 1,
        lap: Math.min(this.opts.laps, Math.max(1, c.lapsDone + 1)),
        finished: c.finished,
        finishTime: c.finishTime,
        bestLap: c.bestLap,
        gap: i === 0 ? 0 : Math.max(0, (leader.total - c.total) / Math.max(25, Math.abs(c.speed))),
      };
    });
    const rel = p.relPsi;
    this.opts.onHud({
      phase: this.phase,
      speed: Math.abs(p.speed) * 3.6,
      gear: p.speed < -0.5 ? 0 : p.gear,
      rpm: p.rpm,
      nitro: p.nitro,
      nitroOn: p.nitroOn,
      lap: Math.min(this.opts.laps, Math.max(1, p.lapsDone + 1)),
      laps: this.opts.laps,
      place: this.phase === "finished" ? this.playerPlace : place,
      total: this.racers.length,
      lapTime: this.phase === "countdown" ? 0 : this.raceTime - p.lapStart,
      bestLap: p.bestLap,
      lastLap: this.lastLap,
      raceTime: this.raceTime,
      wrongWay: Math.abs(rel) > 2.2 && Math.abs(p.speed) > 4 && this.phase === "racing",
      offRoad: !p.onRoad,
      board,
      cam: this.camMode,
      drift: p.sliding,
    });
  }

  private drawMinimap() {
    const cv = this.opts.minimap;
    const mc = this.miniCache;
    if (!cv || !mc) return;
    const g = cv.getContext("2d");
    if (!g) return;
    const W = cv.width;
    g.clearRect(0, 0, W, W);
    g.lineJoin = "round";
    g.lineCap = "round";
    const path = () => {
      g.beginPath();
      mc.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
    };
    g.strokeStyle = "rgba(0,0,0,0.65)";
    g.lineWidth = 11;
    path();
    g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.88)";
    g.lineWidth = 6;
    path();
    g.stroke();
    // start line
    const [sx, sy] = mc.pts[0];
    g.fillStyle = "#ff3b3b";
    g.beginPath();
    g.arc(sx, sy, 5, 0, Math.PI * 2);
    g.fill();
    for (const r of this.racers) {
      const x = r.sim.x * mc.sc + mc.ox;
      const y = r.sim.z * mc.sc + mc.oy;
      g.fillStyle = r.sim.isPlayer ? "#00e5ff" : "#" + r.sim.color.toString(16).padStart(6, "0");
      g.strokeStyle = r.sim.isPlayer ? "#fff" : "rgba(0,0,0,0.8)";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x, y, r.sim.isPlayer ? 6.5 : 4.5, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  }

  /* ------------------------------------------------------------ lifecycle */

  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.ro.disconnect();
    this.audio.dispose();
    this.world.dispose();
    this.sky.dispose();
    this.weather?.dispose();
    this.smoke.dispose();
    this.fire.dispose();
    this.glow.dispose();
    this.dot.dispose();
    this.racers.forEach((r) => {
      r.model.dispose();
      if (r.tag) {
        (r.tag.material as THREE.SpriteMaterial).map?.dispose();
        r.tag.material.dispose();
      }
    });
    this.skidMesh.geometry.dispose();
    (this.skidMesh.material as THREE.Material).dispose();
    this.envTex.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    void this.headlight;
  }
}

export function fmt(t: number) {
  if (!isFinite(t) || t <= 0) return "--:--.---";
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}
