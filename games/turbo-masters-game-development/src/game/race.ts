import * as THREE from "three";
import { Scene3D, host } from "./host";
import { CARS, Custom, Gfx, Mode, RaceSettings, carById, trackById, EFFECT_MULT } from "./data";
import { buildWorld, World } from "./world";
import { Car, Env, Hooks, collideCars } from "./vehicle";
import { buildCar, CarModel } from "./carBuilder";
import { Vfx, Trail } from "./vfx";
import { audio } from "./audio";
import { input } from "./input";
import { clamp, damp, glowTexture, wrapAngle, disposeObject } from "./util";
import { Ghost, loadGhost, saveGhost, store } from "./store";

export interface PlayerSetup {
  carId: string;
  custom: Custom;
  upgrades: number[];
  name: string;
}
export interface RaceConfig {
  mode: Mode;
  settings: RaceSettings;
  players: [PlayerSetup, PlayerSetup];
  gfx: Gfx;
  round?: number;
  rounds?: number;
}
export interface HudPlayer {
  speed: number; gear: string; rpm: number; pos: number; lap: number; laps: number; cp: number; cps: number;
  lapTime: number; bestLap: number; lastLap: number; nitro: number; nitroOn: boolean; nitroLock: boolean; drift: number; driftTotal: number;
  item: string | null; itemCd: number; shield: number; stun: number; snare: number; flare: number; damage: number; boost: boolean;
  toast: { id: number; text: string; color: string } | null; wrongWay: boolean; finished: boolean; finishTime: number;
  gap: number; cam: number; mx: number; mz: number; name: string; record: number; onGhost: boolean; slip: number;
}
export interface HudState {
  phase: "countdown" | "racing" | "finished";
  countdown: number; // 3,2,1,0(GO),-1
  time: number;
  players: HudPlayer[];
  vertical: boolean;
  paused: boolean;
  mode: Mode;
  trackName: string;
  round?: number; rounds?: number;
  other: { mx: number; mz: number }[];
  speedFx: number[];
}
export interface PlayerResult {
  idx: number; name: string; carId: string; position: number; time: number; bestLap: number; maxSpeed: number; drift: number; nitroUsed: number;
  overtakes: number; reward: number; lapTimes: number[]; dnf: boolean; record: boolean; damage: number;
}
export interface RaceResult {
  mode: Mode; track: string; laps: number; players: PlayerResult[]; winner: number; round?: number; rounds?: number; settings: RaceSettings;
}

interface View { cam: THREE.PerspectiveCamera; off: THREE.Vector3; yaw: number; fov: number; init: boolean; ovT: number; look: THREE.Vector3; shakeV: THREE.Vector3 }
interface Box { x: number; y: number; z: number; mesh: THREE.Mesh; glow: THREE.Sprite; t: number }
interface Oil { x: number; z: number; y: number; life: number; owner: number; mesh: THREE.Mesh }

const ITEMS: Record<string, { name: string; color: string }> = {
  boost: { name: "TURBO BOOST", color: "#4fd0ff" },
  shield: { name: "SHIELD", color: "#7affc0" },
  emp: { name: "EMP BLAST", color: "#a05bff" },
  oil: { name: "OIL SLICK", color: "#ffb000" },
  snare: { name: "GRAVITY SNARE", color: "#ff4fe0" },
  flare: { name: "COUNTER-FLARE", color: "#ff7a3a" },
};

export function awardResults(res: RaceResult) {
  store.update((d) => {
    res.players.forEach((p) => {
      const pr = d.profiles[p.idx];
      pr.money += p.reward;
      pr.stats.races++;
      if (p.position === 1 && res.mode !== "timetrial") pr.stats.wins++;
      pr.stats.drift += p.drift;
      pr.stats.earned += p.reward;
      if (isFinite(p.bestLap)) {
        const old = pr.records[res.track];
        if (!old || p.bestLap < old) pr.records[res.track] = p.bestLap;
      }
    });
  });
}

const H = 1 / 120;

export class Race implements Scene3D {
  cfg: RaceConfig;
  world: World;
  vfx: Vfx;
  cars: Car[] = [];
  views: View[] = [];
  trails: Trail[][] = [];
  blobs: THREE.Mesh[] = [];
  spots: THREE.SpotLight[] = [];
  phase: "countdown" | "racing" | "finished" = "countdown";
  t = 0;
  raceTime = 0;
  acc = 0;
  paused = false;
  laps: number;
  vertical = true;
  boxes: Box[] = [];
  oils: Oil[] = [];
  toasts: ({ id: number; text: string; color: string } | null)[] = [null, null];
  toastTimer = [0, 0];
  toastId = 0;
  hudTimer = 0;
  ghosts: (CarModel | null)[] = [null, null];
  ghostData: (Ghost | null)[] = [null, null];
  lapFrames: number[][] = [[], []];
  frameClock = [0, 0];
  endTimer = 0;
  firstFinish = -1;
  cdBeep = -1;
  onHud: (h: HudState) => void;
  onFinish: (r: RaceResult) => void;
  gfx: Gfx;
  mapPts: number[][] = [];
  lastImpact = [0, 0];
  resetCd = [0, 0];
  wrongT = [0, 0];
  wrongToast = [0, 0];
  prevRank = [1, 2];
  speedFx = [0, 0];
  disposed = false;
  box = new THREE.Vector3();
  tmp = new THREE.Vector3();
  tmp2 = new THREE.Vector3();
  colors: THREE.Color[] = [];
  hooks: Hooks;
  env: Env;
  result: RaceResult | null = null;
  startGrid: number;

  constructor(cfg: RaceConfig, onHud: (h: HudState) => void, onFinish: (r: RaceResult) => void) {
    this.cfg = cfg;
    this.gfx = cfg.gfx;
    this.onHud = onHud;
    this.onFinish = onFinish;
    const def = trackById(cfg.settings.track);
    this.laps = cfg.settings.laps;
    host.renderer.shadowMap.enabled = cfg.gfx.shadows > 0;
    this.world = buildWorld(host.renderer, def, cfg.settings.tod, cfg.settings.weather, cfg.gfx);
    host.renderer.toneMappingExposure = this.world.exposure;
    const scene = this.world.scene;
    const track = this.world.track;
    this.vfx = new Vfx(EFFECT_MULT[cfg.gfx.effects], this.world.light);
    scene.add(this.vfx.root);
    this.env = { wet: this.world.wet, dark: this.world.dark, shoulderGrip: this.world.shoulderGrip, shoulderTop: this.world.shoulderTop };

    this.hooks = {
      onWall: (c, s, x, y, z) => {
        const now = this.t;
        const p = this.world.track;
        void p;
        this.vfx.sparks(x, y - 0.1, z, -c.vx * 0.02, -c.vz * 0.02, Math.min(8, 2 + s * 0.4), 9);
        if (s > 4 && now - this.lastImpact[c.idx] > 0.18) {
          this.lastImpact[c.idx] = now;
          audio.impact(s, c.idx === 0 ? -0.5 : 0.5);
          this.vfx.flash(x, y, z, 1.4 + s * 0.08, "#ffd8a0", 0.14);
          if (s > 9) this.vfx.smokePuff(x, y, z, 0, 0, 2.2, 0.5, 0.5);
          if (s > 13) this.vfx.debris(x, y, z, 10);
          if (s > 6) this.toast(c.idx, "IMPACT", "#ff6a4a");
        } else if (s <= 4 && now - this.lastImpact[c.idx] > 0.12) {
          this.lastImpact[c.idx] = now;
          audio.scrape(c.idx === 0 ? -0.5 : 0.5);
        }
      },
      onLand: (c, imp) => {
        if (imp > 5) {
          audio.land(imp, c.idx === 0 ? -0.5 : 0.5);
          for (let k = 0; k < 4; k++) this.vfx.dust(c.x + (Math.random() - 0.5) * 2, c.y, c.z + (Math.random() - 0.5) * 2, c.vx * 0.2, c.vz * 0.2, new THREE.Color("#c8b89a"), 1);
          this.vfx.ring(c.x, c.y, c.z, "#ffffff", 5, 0.4);
          if (imp > 10) this.vfx.sparks(c.x, c.y + 0.2, c.z, 0, 0, 14, 8);
        }
      },
      onNitro: (c) => {
        audio.nitroStart(c.idx === 0 ? -0.5 : 0.5);
        this.vfx.ring(c.x, c.y, c.z, c.def.nitroColor, 9, 0.55);
        this.vfx.flash(c.x - c.fx * 2, c.y + 0.5, c.z - c.fz * 2, 3.2, c.def.nitroColor, 0.25);
        this.views[c.idx].ovT = Math.max(this.views[c.idx].ovT, 0.35);
        this.toast(c.idx, "NITRO!", c.def.nitroColor);
      },
      onShift: (c) => audio.shift(c.idx === 0 ? -0.5 : 0.5),
      onDriftBank: (c, score, boost) => {
        audio.driftBank();
        this.toast(c.idx, boost > 0 ? `DRIFT +${score}  BOOST!` : `DRIFT +${score}`, boost > 0 ? "#ffe14f" : "#7be6ff");
        if (boost > 0) this.vfx.ring(c.x, c.y, c.z, "#ffe14f", 6, 0.4);
      },
      onCarHit: (a, b, s, x, y, z) => {
        if (this.t - this.lastImpact[0] > 0.15) {
          this.lastImpact[0] = this.t;
          audio.impact(s * 1.2);
        }
        this.vfx.sparks(x, y, z, 0, 0, 10 + s, 8);
        this.vfx.flash(x, y, z, 1.8, "#ffe0b0", 0.15);
        if (s > 8) this.vfx.debris(x, y, z, 8);
        void a; void b;
      },
    };

    // cars
    const N = track.N;
    this.startGrid = N - Math.round(10 / track.ds);
    const swap = (cfg.round ?? 0) % 2 === 1;
    for (let p = 0; p < 2; p++) {
      const ps = cfg.players[p];
      const car = new Car(p, carById(ps.carId), ps.custom, ps.upgrades);
      car.name = ps.name;
      const side = (p === 0) !== swap ? 1 : -1;
      car.place(track, this.startGrid, side * 3.4);
      car.progress = this.startGrid - N;
      car.best = car.progress;
      car.model.group.traverse((o: any) => {
        if (o.isMesh && !o.isSprite) o.castShadow = cfg.gfx.shadows > 0;
      });
      scene.add(car.model.group);
      this.cars.push(car);
      // trails
      const col = new THREE.Color(car.def.nitroColor);
      this.colors.push(col);
      const tr = [new Trail(26, col), new Trail(26, col)];
      tr.forEach((t) => scene.add(t.mesh));
      this.trails.push(tr);
      // blob shadow
      const blob = new THREE.Mesh(new THREE.PlaneGeometry(car.model.dims.W + 1.0, car.model.dims.L + 0.6), new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      blob.rotation.x = -Math.PI / 2;
      blob.renderOrder = 3;
      scene.add(blob);
      this.blobs.push(blob);
      // headlight
      if (this.world.dark && cfg.gfx.effects >= 1) {
        const sp = new THREE.SpotLight(0xfff0d8, 260, 80, 0.5, 0.65, 1.2);
        scene.add(sp, sp.target);
        this.spots.push(sp);
      }
      // camera
      const cam = new THREE.PerspectiveCamera(65, 1, 0.1, 2600);
      this.views.push({ cam, off: new THREE.Vector3(0, 3, -8), yaw: car.yaw, fov: 65, init: false, ovT: 0, look: new THREE.Vector3(), shakeV: new THREE.Vector3() });
      car.model.underglow.visible = car.cfg.neon !== "off";
    }
    // ghosts (time trial)
    if (cfg.mode === "timetrial") {
      for (let p = 0; p < 2; p++) {
        const g = loadGhost(def.id, p);
        if (g && g.frames.length > 40) {
          this.ghostData[p] = g;
          const d = carById(g.car);
          const cu: Custom = { ...cfg.players[p].custom, primary: g.primary };
          const m = buildCar(d, cu, { ghost: p === 0 ? "#4fc3ff" : "#ff5fd0" });
          m.group.visible = false;
          scene.add(m.group);
          this.ghosts[p] = m;
        }
      }
    }
    // item boxes (battle)
    if (cfg.mode === "battle") {
      const boxGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
      const tex = glowTexture();
      for (let k = 0; k < 8; k++) {
        const i = (k * N) / 8 + N / 16;
        [-4.2, 4.2].forEach((d, q) => {
          const pos = track.at(i, d);
          const col = new THREE.Color().setHSL(((k * 2 + q) * 0.13) % 1, 0.9, 0.55);
          const mesh = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.4, metalness: 0.3, roughness: 0.2, transparent: true, opacity: 0.88 }));
          const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: col, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.8 }));
          glow.scale.set(5, 5, 1);
          mesh.add(glow);
          mesh.position.set(pos.x, pos.y + 1.4, pos.z);
          scene.add(mesh);
          this.boxes.push({ x: pos.x, y: pos.y, z: pos.z, mesh, glow, t: 0 });
        });
      }
    }
    // minimap path
    const step = Math.max(1, Math.floor(N / 140));
    const w = track.maxX - track.minX, h = track.maxZ - track.minZ;
    const sc = Math.max(w, h);
    for (let i = 0; i < N; i += step) this.mapPts.push([(track.px[i] - track.minX) / sc, (track.pz[i] - track.minZ) / sc]);
    this.mapScale = { sc, w: w / sc, h: h / sc };

    // audio
    audio.unlock();
    audio.stopMusic();
    this.cars.forEach((c, i) => audio.startEngine(i, c.def.engine, 0.55));
    audio.weather(this.world.weather === "heavy" || this.world.weather === "storm" ? 1 : this.world.weather === "rain" ? 0.5 : 0, this.world.weather === "storm");
    this.world.onThunder = () => audio.thunder();
    input.capture = true;
    this.updateLayout();
    // prime cameras
    this.cars.forEach((_c, i) => this.updateCamera(i, 0.016, true));
    this.publishHud(true);
  }
  mapScale = { sc: 1, w: 1, h: 1 };

  toast(p: number, text: string, color = "#ffffff") {
    this.toasts[p] = { id: ++this.toastId, text, color };
    this.toastTimer[p] = 2.2;
  }

  updateLayout() {
    const W = host.w, Hh = host.h;
    this.vertical = this.gfx.split === "vertical" ? true : this.gfx.split === "horizontal" ? false : W / Hh >= 1.2;
  }
  rects(W: number, Hh: number): { x: number; y: number; w: number; h: number }[] {
    const gap = 3;
    if (this.vertical) {
      const w = Math.floor((W - gap) / 2);
      return [{ x: 0, y: 0, w, h: Hh }, { x: W - w, y: 0, w, h: Hh }];
    }
    const h = Math.floor((Hh - gap) / 2);
    return [{ x: 0, y: Hh - h, w: W, h }, { x: 0, y: 0, w: W, h }];
  }

  pause(on: boolean) {
    this.paused = on;
    audio.silenceEngines(on);
    if (!on) this.last = performance.now();
    this.publishHud(true);
  }
  last = 0;

  // ------------------------------------------------------------------ update
  update(dt: number) {
    if (this.paused || this.disposed) return;
    dt = Math.min(dt, 0.05);
    this.t += dt;
    this.updateLayout();
    // inputs
    for (let p = 0; p < 2; p++) {
      const c = this.cars[p];
      input.sample(p, c.input);
      if (c.finished) { c.input.throttle = 0; c.input.brake = 0.3; c.input.nitro = false; c.input.drift = false; c.input.item = false; c.input.reset = false; }
      if (c.input.cam) { c.camMode = (c.camMode + 1) % 4; this.toast(p, ["CHASE CAM", "CLOSE CAM", "HOOD CAM", "CINEMATIC CAM"][c.camMode], "#ffffff"); }
      this.resetCd[p] = Math.max(0, this.resetCd[p] - dt);
      if (c.input.reset && this.resetCd[p] <= 0 && this.phase === "racing") { c.respawn(this.world.track); this.resetCd[p] = 1.2; audio.ui("back"); }
      if (c.stuckT > 5) { c.respawn(this.world.track); c.stuckT = 0; this.toast(p, "RECOVERED", "#ffffff"); }
    }

    // phase logic
    if (this.phase === "countdown") {
      const k = this.t < 0.6 ? -1 : this.t < 1.6 ? 3 : this.t < 2.6 ? 2 : this.t < 3.6 ? 1 : 0;
      if (k !== this.cdBeep) {
        this.cdBeep = k;
        if (k >= 1) audio.beep(false);
        if (k === 0) {
          audio.beep(true);
          this.phase = "racing";
          this.raceTime = 0;
          audio.startMusic(trackById(this.cfg.settings.track).music, "race");
          this.cars.forEach((c, i) => { this.toast(i, "GO!", "#7affc0"); c.lapStart = 0; });
        }
      }
      this.cars.forEach((c) => { c.rpm = damp(c.rpm, 0.2 + c.input.throttle * 0.55, 8, dt); });
    }

    const can = this.phase !== "countdown";
    this.acc += dt;
    const battle = this.cfg.mode === "battle";
    const tt = this.cfg.mode === "timetrial";
    while (this.acc >= H) {
      this.acc -= H;
      if (this.phase === "racing") this.raceTime += H;
      for (let i = 0; i < 2; i++) {
        const c = this.cars[i];
        const opp = tt ? null : this.cars[1 - i];
        c.step(H, this.world.track, this.env, can, this.hooks, opp, this.t);
      }
      if (!tt) collideCars(this.cars[0], this.cars[1], this.hooks);
    }
    if (battle) this.updateItems(dt);

    // laps, checkpoints, ranking
    if (this.phase !== "countdown") this.updateRace(dt);

    // visuals
    for (let i = 0; i < 2; i++) {
      const c = this.cars[i];
      c.updateVisual(dt, this.t, this.env);
      this.blobs[i].position.set(c.x, c.y + 0.04, c.z);
      this.blobs[i].rotation.z = -c.yaw;
      (this.blobs[i].material as THREE.MeshBasicMaterial).opacity = c.grounded ? 0.55 : clamp(0.55 - c.airT * 0.5, 0.15, 0.55);
      if (this.spots[i]) {
        const sp = this.spots[i];
        sp.position.set(c.x + c.fx * 2, c.y + 1.1, c.z + c.fz * 2);
        sp.target.position.set(c.x + c.fx * 22, c.y - 0.5, c.z + c.fz * 22);
        sp.target.updateMatrixWorld();
      }
      this.emitFx(i, dt);
      this.updateAudio(i);
      this.updateGhost(i);
    }
    this.vfx.update(dt);
    this.world.update(dt, this.t);
    for (let i = 0; i < 2; i++) this.updateCamera(i, dt, false);

    for (let p = 0; p < 2; p++) {
      this.toastTimer[p] -= dt;
      if (this.toastTimer[p] <= 0) this.toasts[p] = null;
    }
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.05;
      this.publishHud(false);
    }
    if (this.phase === "finished") {
      this.endTimer += dt;
      if (this.endTimer > 3.2 && !this.result) {
        this.result = this.buildResult();
        this.onFinish(this.result);
      }
    }
  }

  // ------------------------------------------------------------------ race logic
  updateRace(dt: number) {
    const track = this.world.track;
    const N = track.N;
    const tt = this.cfg.mode === "timetrial";
    for (let i = 0; i < 2; i++) {
      const c = this.cars[i];
      if (c.finished) continue;
      // wrong way
      const dot = c.vx * c.proj.tx + c.vz * c.proj.tz;
      if (dot < -6 && c.speed > 6) this.wrongT[i] += dt; else this.wrongT[i] = Math.max(0, this.wrongT[i] - dt * 2);
      this.wrongToast[i] -= dt;
      if (this.wrongT[i] > 1.5 && this.wrongToast[i] <= 0 && this.phase === "racing") { this.toast(i, "WRONG WAY!", "#ff4a4a"); this.wrongToast[i] = 2.5; }
      // checkpoints
      const cpNow = Math.floor(c.best / (N / 8));
      if (cpNow > c.cp) {
        c.cp = cpNow;
        if (cpNow % 8 !== 0 && this.phase === "racing") { this.toast(i, `CHECKPOINT ${cpNow % 8}/8`, "#17e0ff"); c.nitro = Math.min(c.d.nitroCap, c.nitro + 3); }
      }
      const lapNow = Math.floor(c.best / N);
      if (lapNow > c.lap && this.phase === "racing") {
        const lt = this.raceTime - c.lapStart;
        c.lapStart = this.raceTime;
        c.lapTimes.push(lt);
        c.lap = lapNow;
        const isBest = lt < c.bestLap;
        if (isBest) c.bestLap = lt;
        if (tt) this.handleGhostLap(i, lt, isBest);
        this.lapFrames[i] = [];
        this.frameClock[i] = 0;
        if (c.lap >= this.laps) {
          c.finished = true;
          c.finishTime = this.raceTime;
          this.toast(i, "FINISHED!", "#ffe14f");
          audio.ui("ready");
          if (this.firstFinish < 0) this.firstFinish = i;
        } else {
          this.toast(i, c.lap === this.laps - 1 ? `FINAL LAP!` : `LAP ${c.lap + 1}/${this.laps}${isBest ? "  BEST!" : ""}`, isBest ? "#7affc0" : "#ffffff");
          audio.ui("select");
        }
      }
      // ghost recording
      if (tt) {
        this.frameClock[i] += dt;
        while (this.frameClock[i] >= 0.05) {
          this.frameClock[i] -= 0.05;
          this.lapFrames[i].push(+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2), +c.yaw.toFixed(3));
        }
      }
    }
    // ranks
    const order = [0, 1].sort((a, b) => {
      const ca = this.cars[a], cb = this.cars[b];
      if (ca.finished && cb.finished) return ca.finishTime - cb.finishTime;
      if (ca.finished) return -1;
      if (cb.finished) return 1;
      return cb.best - ca.best;
    });
    order.forEach((idx, r) => (this.cars[idx].rank = r + 1));
    if (!tt) {
      for (let i = 0; i < 2; i++) {
        const c = this.cars[i];
        if (c.rank < this.prevRank[i] && this.raceTime > 4 && !c.finished) {
          c.overtakes++;
          c.nitro = Math.min(c.d.nitroCap, c.nitro + 14);
          this.toast(i, "OVERTAKE!", "#ffe14f");
          this.views[i].ovT = 1.0;
        }
        this.prevRank[i] = c.rank;
      }
    } else {
      this.cars.forEach((c) => (c.rank = 1));
    }
    // end conditions
    if (this.phase === "racing") {
      const all = this.cars.every((c) => c.finished);
      const timeout = this.firstFinish >= 0 && !tt && this.raceTime - this.cars[this.firstFinish].finishTime > 25;
      if (all || timeout) {
        this.phase = "finished";
        this.endTimer = 0;
        audio.stopMusic();
        audio.victory();
      }
    }
  }

  handleGhostLap(i: number, lt: number, isBest: boolean) {
    const c = this.cars[i];
    if (!isBest) return;
    const id = this.world.track.def.id;
    const prev = loadGhost(id, i);
    const frames = this.lapFrames[i].slice();
    const g: Ghost = { time: lt, car: c.def.id, primary: c.cfg.primary, frames };
    if (!prev || lt < prev.time) {
      saveGhost(id, i, g);
      if (!this.ghostData[i] || lt < this.ghostData[i]!.time) {
        this.ghostData[i] = g;
        if (!this.ghosts[i]) {
          const m = buildCar(c.def, { ...c.cfg }, { ghost: i === 0 ? "#4fc3ff" : "#ff5fd0" });
          m.group.visible = false;
          this.world.scene.add(m.group);
          this.ghosts[i] = m;
        }
      }
      this.toast(i, "NEW PERSONAL BEST!", "#ffe14f");
    }
  }
  updateGhost(i: number) {
    const m = this.ghosts[i], g = this.ghostData[i];
    if (!m || !g || this.phase !== "racing") { if (m) m.group.visible = false; return; }
    const c = this.cars[i];
    const tl = this.raceTime - c.lapStart;
    const k = Math.floor(tl / 0.05);
    const n = g.frames.length / 4;
    if (k >= n - 1) { m.group.visible = false; return; }
    const f = (tl / 0.05) - k;
    const a = k * 4, b = (k + 1) * 4;
    m.group.visible = true;
    m.group.position.set(g.frames[a] + (g.frames[b] - g.frames[a]) * f, g.frames[a + 1] + (g.frames[b + 1] - g.frames[a + 1]) * f, g.frames[a + 2] + (g.frames[b + 2] - g.frames[a + 2]) * f);
    m.group.rotation.y = g.frames[a + 3] + wrapAngle(g.frames[b + 3] - g.frames[a + 3]) * f;
    m.wheels.forEach((w) => (w.spin.rotation.x += 0.5));
  }

  // ------------------------------------------------------------------ battle items
  rollItem(rank: number) {
    const lead = rank === 1;
    const w: [string, number][] = lead
      ? [["boost", 10], ["shield", 30], ["flare", 25], ["oil", 25], ["emp", 5], ["snare", 5]]
      : [["boost", 28], ["shield", 10], ["flare", 6], ["oil", 6], ["emp", 25], ["snare", 25]];
    const tot = w.reduce((s, x) => s + x[1], 0);
    let r = Math.random() * tot;
    for (const [k, v] of w) { r -= v; if (r <= 0) return k; }
    return "boost";
  }
  updateItems(dt: number) {
    const time = this.t;
    this.boxes.forEach((b, k) => {
      if (b.t > 0) { b.t -= dt; b.mesh.visible = b.t <= 0; }
      b.mesh.rotation.y += dt * 1.8;
      b.mesh.rotation.x = 0.3;
      b.mesh.position.y = b.y + 1.5 + Math.sin(time * 2 + k) * 0.25;
      if (b.t > 0) return;
      for (const c of this.cars) {
        if (c.item || c.itemCd > 0 || c.finished) continue;
        if ((c.x - b.x) ** 2 + (c.z - b.z) ** 2 < 11 && Math.abs(c.y - b.y) < 3) {
          c.item = this.rollItem(c.rank);
          b.t = 6;
          b.mesh.visible = false;
          audio.item("pickup");
          this.vfx.flash(b.x, b.y + 1.5, b.z, 3, ITEMS[c.item].color, 0.3);
          this.toast(c.idx, ITEMS[c.item].name, ITEMS[c.item].color);
        }
      }
    });
    // oils
    for (let k = this.oils.length - 1; k >= 0; k--) {
      const o = this.oils[k];
      o.life -= dt;
      if (o.life <= 0) { this.world.scene.remove(o.mesh); disposeObject(o.mesh); this.oils.splice(k, 1); continue; }
      (o.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(0.85, o.life * 0.5);
      for (const c of this.cars) {
        if (c.spin > 0 || c.invuln > 0 || !c.grounded) continue;
        if (c.idx === o.owner && 14 - o.life < 1.5) continue;
        if ((c.x - o.x) ** 2 + (c.z - o.z) ** 2 < 3.8 * 3.8) this.applyHit(c, "oil", this.cars[o.owner]);
      }
    }
    for (const c of this.cars) {
      if (c.input.item && c.item && c.itemCd <= 0 && this.phase === "racing") this.useItem(c);
    }
  }
  applyHit(t: Car, kind: string, src: Car, reflected = false) {
    if (t.flare > 0 && !reflected) {
      t.flare = 0;
      this.toast(t.idx, "REFLECTED!", "#ff7a3a");
      this.vfx.ring(t.x, t.y, t.z, "#ff7a3a", 8, 0.5);
      audio.item("flare");
      if (src !== t) this.applyHit(src, kind, t, true);
      t.nitro = Math.min(t.d.nitroCap, t.nitro + 25);
      return;
    }
    if (t.shield > 0) {
      t.shield = 0;
      this.toast(t.idx, "SHIELD BLOCKED", "#7affc0");
      this.vfx.ring(t.x, t.y, t.z, "#7affc0", 7, 0.45);
      audio.item("hit");
      return;
    }
    audio.item("hit");
    if (kind === "emp") {
      t.stun = 1.5; t.vx *= 0.6; t.vz *= 0.6; t.nitro = Math.max(0, t.nitro - 25);
      this.toast(t.idx, "EMP HIT!", "#a05bff");
      for (let k = 0; k < 24; k++) this.vfx.glow.emit(t.x + (Math.random() - 0.5) * 2, t.y + 0.4 + Math.random(), t.z + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 8, Math.random() * 6, (Math.random() - 0.5) * 8, 0.5, 0.35, 0.05, 0.6, 0.5, 1, 1, 8, 1);
    } else if (kind === "snare") {
      t.snare = 3.5;
      this.toast(t.idx, "SNARED!", "#ff4fe0");
      this.vfx.ring(t.x, t.y, t.z, "#ff4fe0", 6, 0.8);
    } else if (kind === "oil") {
      t.spin = 1.1; t.spinDir = Math.random() < 0.5 ? -1 : 1; t.vx *= 0.78; t.vz *= 0.78;
      this.toast(t.idx, "OIL SLICK!", "#ffb000");
    }
    t.shake = Math.max(t.shake, 0.5);
  }
  useItem(c: Car) {
    const opp = this.cars[1 - c.idx];
    const item = c.item!;
    const dx = opp.x - c.x, dz = opp.z - c.z;
    const dist = Math.hypot(dx, dz);
    const ahead = dx * c.fx + dz * c.fz > 0;
    switch (item) {
      case "boost":
        c.itemBoostT = 2.6; this.vfx.ring(c.x, c.y, c.z, "#4fd0ff", 9, 0.5); audio.item("boost"); break;
      case "shield":
        c.shield = 7; this.vfx.ring(c.x, c.y, c.z, "#7affc0", 6, 0.5); audio.item("shield"); this.toast(c.idx, "SHIELD UP", "#7affc0"); break;
      case "flare":
        c.flare = 8; audio.item("flare"); this.toast(c.idx, "FLARE ARMED", "#ff7a3a"); this.vfx.ring(c.x, c.y, c.z, "#ff7a3a", 5, 0.4); break;
      case "emp":
        audio.item("emp"); this.vfx.ring(c.x, c.y, c.z, "#a05bff", 55, 0.7);
        if (dist < 55 && !opp.finished) this.applyHit(opp, "emp", c); else this.toast(c.idx, "EMP MISSED", "#aaaaaa");
        break;
      case "snare":
        if (!ahead || dist > 130 || opp.finished) { this.toast(c.idx, "NO TARGET AHEAD", "#aaaaaa"); audio.ui("error"); return; }
        audio.item("snare"); this.applyHit(opp, "snare", c); break;
      case "oil": {
        const x = c.x - c.fx * 5, z = c.z - c.fz * 5;
        const m = new THREE.Mesh(new THREE.CircleGeometry(3.6, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x08040c, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }));
        m.position.set(x, c.y + 0.06, z);
        m.renderOrder = 4;
        this.world.scene.add(m);
        this.oils.push({ x, z, y: c.y, life: 14, owner: c.idx, mesh: m });
        audio.item("oil");
        if (this.oils.length > 6) { const o = this.oils.shift()!; this.world.scene.remove(o.mesh); disposeObject(o.mesh); }
        break;
      }
    }
    c.item = null;
    c.itemCd = 1.2;
  }

  // ------------------------------------------------------------------ effects
  emitFx(i: number, dt: number) {
    const c = this.cars[i];
    const v = this.vfx;
    const tmp = this.tmp;
    void dt;
    const sp = c.speed;
    const rs = Math.abs(c.slip);
    const sliding = c.grounded && sp > 8 && (rs > 0.14 || (c.braking && sp > 28 && c.d.brake > 0));
    const inten = clamp(Math.max((rs - 0.1) * 2.5, c.braking && sp > 30 ? 0.35 : 0, c.spin > 0 ? 0.9 : 0), 0, 1);
    for (let w = 2; w < 4; w++) {
      c.wheelWorld(w, tmp);
      const id = i * 2 + (w - 2);
      if (sliding && inten > 0.2 && !c.onShoulder) {
        v.skids.add(id, tmp.x, tmp.y, tmp.z, inten);
        v.tireSmoke(tmp.x, tmp.y, tmp.z, c.vx, c.vz, inten);
        if (c.drifting && inten > 0.5 && Math.random() < 0.18 * v.mult) v.sparks(tmp.x, tmp.y + 0.1, tmp.z, -c.fx * 0.3, -c.fz * 0.3, 2, 6);
      } else v.skids.stop(id);
      if (c.onShoulder && sp > 8 && c.grounded) {
        const col = this.world.track.def.shoulder === "sand" ? new THREE.Color("#d8b87a") : new THREE.Color("#8a8478");
        v.dust(tmp.x, tmp.y, tmp.z, c.vx, c.vz, col, clamp(sp / 50, 0.2, 1));
      }
      if (this.env.wet > 0.35 && sp > 16 && c.grounded && Math.random() < 0.6) v.spray(tmp.x, tmp.y, tmp.z, c.vx, c.vz, this.env.wet * clamp(sp / 70, 0.2, 1));
      if (this.world.rain && sp > 5 && Math.random() < 0.3 * v.mult) v.splash(tmp.x + (Math.random() - 0.5) * 2, tmp.y, tmp.z + (Math.random() - 0.5) * 2);
    }
    // exhaust / nitro
    const n = c.model.exhaustLocal.length;
    const fl = c.nitroOn ? 1 : c.boostT > 0 || c.itemBoostT > 0 ? 0.5 : c.popT > 0 ? 0.35 : 0;
    const col = this.colors[i];
    if (fl > 0) {
      for (let k = 0; k < n; k += n > 2 ? 1 : 1) {
        c.exhaustWorld(k, tmp);
        v.flame(tmp.x, tmp.y, tmp.z, -c.fx * (14 + c.speed * 0.15), -c.fz * (14 + c.speed * 0.15), col, fl);
        if (c.nitroOn && Math.random() < 0.5) v.embers(tmp.x, tmp.y, tmp.z, -c.fx * 12, -c.fz * 12, col);
      }
    }
    const lx = Math.cos(c.yaw), lz = -Math.sin(c.yaw);
    const tr = this.trails[i];
    const first = c.model.exhaustLocal.length > 1 ? 0 : 0, last = c.model.exhaustLocal.length - 1;
    const active = c.nitroOn || c.itemBoostT > 0 || c.boostT > 0.3;
    c.exhaustWorld(first, this.tmp2);
    tr[0].update(dt, this.tmp2.x - c.fx * 0.3, this.tmp2.y, this.tmp2.z - c.fz * 0.3, lx, lz, active, c.nitroOn ? 0.15 : 0.08);
    c.exhaustWorld(last, this.tmp2);
    tr[1].update(dt, this.tmp2.x - c.fx * 0.3, this.tmp2.y, this.tmp2.z - c.fz * 0.3, lx, lz, active && last !== first, c.nitroOn ? 0.15 : 0.08);
    // damage smoke
    if (c.damage > 0.4 && Math.random() < c.damage * 0.7) {
      v.smokePuff(c.x + c.fx * 1.6, c.y + 0.9, c.z + c.fz * 1.6, c.vx * 0.3, c.vz * 0.3, 1.2 + c.damage, 0.15, 0.4 * c.damage, 2, 1.4);
    }
    if (c.stun > 0 && Math.random() < 0.5) v.glow.emit(c.x + (Math.random() - 0.5) * 2, c.y + 0.6, c.z + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4, 0.3, 0.3, 0.05, 0.6, 0.5, 1, 1, 6, 1);
    if (c.shield > 0 && Math.random() < 0.3) v.glow.emit(c.x + (Math.random() - 0.5) * 3, c.y + 0.5 + Math.random(), c.z + (Math.random() - 0.5) * 3, 0, 1, 0, 0.5, 0.4, 0.05, 0.4, 1, 0.8, 0.7);
    // speed fx value for HUD overlay
    this.speedFx[i] = damp(this.speedFx[i], clamp((c.speed - 35) / 55, 0, 1) + (c.nitroOn ? 0.5 : 0), 5, 0.016);
  }

  updateAudio(i: number) {
    const c = this.cars[i];
    const rs = Math.abs(c.slip);
    let skid = c.grounded && c.speed > 8 ? clamp((rs - 0.1) * 3, 0, 1) : 0;
    if (c.braking && c.speed > 30) skid = Math.max(skid, 0.4);
    if (c.onShoulder) skid = Math.max(skid * 0.5, c.speed > 10 ? 0.2 : 0);
    audio.updateEngine(i, c.rpm, c.nitroOn ? 1 : Math.max(c.input.throttle, 0), c.nitroOn, this.phase === "finished" ? 0 : skid, c.speed, c.onShoulder);
  }

  // ------------------------------------------------------------------ camera
  updateCamera(i: number, dt: number, snap: boolean) {
    const c = this.cars[i];
    const v = this.views[i];
    const cam = v.cam;
    const mode = c.camMode;
    const speed = c.speed;
    const sp = clamp(speed / 80, 0, 1);
    const vang = speed > 5 ? Math.atan2(c.vx, c.vz) : c.yaw;
    const slipDiff = wrapAngle(vang - c.yaw);
    const targetYaw = c.yaw + slipDiff * 0.55;
    if (!v.init || snap) { v.yaw = c.yaw; v.init = true; }
    v.yaw += wrapAngle(targetYaw - v.yaw) * (1 - Math.exp(-6.5 * dt));
    v.ovT = Math.max(0, v.ovT - dt);
    const nitro = c.nitroOn ? 1 : 0;
    let dist = [7.4, 5.0, 0, 9][mode], hgt = [2.7, 1.75, 0, 1.6][mode];
    dist += sp * 1.4 + nitro * 1.4 + v.ovT * 1.0;
    let fovT = [62, 70, 78, 56][mode] + sp * 14 + nitro * 10 + (c.boostT > 0 || c.itemBoostT > 0 ? 5 : 0) + v.ovT * 8;
    if (!this.world.dark && false) fovT += 0;
    const cy = v.yaw;
    const gy = c.y;
    const tgt = this.tmp;
    if (mode === 2) {
      const s = Math.sin(c.yaw), co = Math.cos(c.yaw);
      v.off.set(s * 0.55, 1.12 + c.comp * 0.05, co * 0.55);
      cam.position.set(c.x + v.off.x, gy + v.off.y, c.z + v.off.z);
      tgt.set(c.x + Math.sin(c.yaw + slipDiff * 0.3) * 30, gy + 1.0 + c.pitch * -12, c.z + Math.cos(c.yaw + slipDiff * 0.3) * 30);
    } else if (mode === 3) {
      const a = c.yaw + Math.PI * 0.8 + Math.sin(this.t * 0.35 + i) * 0.9;
      const dOff = tgt.set(Math.sin(a) * dist, hgt + Math.sin(this.t * 0.6) * 0.5 + sp * 0.4, Math.cos(a) * dist);
      v.off.lerp(dOff, snap ? 1 : 1 - Math.exp(-3 * dt));
      cam.position.set(c.x + v.off.x, gy + v.off.y, c.z + v.off.z);
      tgt.set(c.x + c.fx * speed * 0.06, gy + 0.9, c.z + c.fz * speed * 0.06);
    } else {
      const lat = -slipDiff * 1.4 * clamp(speed / 30, 0, 1);
      const dOff = tgt.set(-Math.sin(cy) * dist + Math.cos(cy) * lat * 0.4, hgt, -Math.cos(cy) * dist - Math.sin(cy) * lat * 0.4);
      v.off.lerp(dOff, snap ? 1 : 1 - Math.exp(-11 * dt));
      cam.position.set(c.x + v.off.x, Math.max(gy + 0.7, gy + v.off.y), c.z + v.off.z);
      const la = 2 + speed * 0.1;
      tgt.set(c.x + Math.sin(c.yaw) * la, gy + 1.15 + (mode === 1 ? -0.1 : 0), c.z + Math.cos(c.yaw) * la);
    }
    v.look.lerp(tgt, snap ? 1 : 1 - Math.exp(-18 * dt));
    // shake
    const amp = this.gfx.shake ? (c.shake * 0.55 + nitro * 0.05 + sp * 0.012 + (c.onShoulder ? 0.04 * sp : 0)) : 0;
    if (amp > 0.001) {
      cam.position.x += (Math.random() - 0.5) * amp;
      cam.position.y += (Math.random() - 0.5) * amp;
      cam.position.z += (Math.random() - 0.5) * amp;
    }
    v.fov = damp(v.fov, fovT, 4, dt);
    cam.fov = v.fov;
    cam.lookAt(v.look.x, v.look.y, v.look.z);
    cam.rotateZ((this.gfx.shake ? (Math.random() - 0.5) * amp * 0.03 : 0) - c.roll * 0.35);
    // hide body in hood cam for clarity (keep everything, but hide spoiler/roof glare)
  }

  // ------------------------------------------------------------------ HUD
  publishHud(force: boolean) {
    void force;
    const track = this.world.track;
    const N = track.N;
    const mk = (i: number): HudPlayer => {
      const c = this.cars[i];
      const lapIdx = clamp(c.lap, 0, this.laps - 1);
      const cpIn = ((Math.floor(Math.max(0, c.best) / (N / 8)) % 8) + 8) % 8;
      const other = this.cars[1 - i];
      const gap = (c.best - other.best) * track.ds;
      const rec = store.get().profiles[i].records[track.def.id] ?? 0;
      return {
        speed: c.kmh, gear: c.gear < 0 ? "R" : c.gear === 0 ? "N" : String(c.gear), rpm: c.rpm, pos: c.rank, lap: lapIdx + 1, laps: this.laps, cp: cpIn, cps: 8,
        lapTime: this.phase === "racing" ? this.raceTime - c.lapStart : c.lapTimes.length ? c.lapTimes[c.lapTimes.length - 1] : 0,
        bestLap: c.bestLap, lastLap: c.lapTimes.length ? c.lapTimes[c.lapTimes.length - 1] : 0,
        nitro: c.nitro / c.d.nitroCap, nitroOn: c.nitroOn, nitroLock: c.nitroLock, drift: Math.round(c.driftCur), driftTotal: Math.round(c.driftTotal),
        item: c.item, itemCd: c.itemCd, shield: c.shield, stun: c.stun, snare: c.snare, flare: c.flare, damage: c.damage, boost: c.boostT > 0 || c.itemBoostT > 0,
        toast: this.toasts[i], wrongWay: this.wrongT[i] > 1.5, finished: c.finished, finishTime: c.finishTime, gap,
        cam: c.camMode, mx: (c.x - track.minX) / this.mapScale.sc, mz: (c.z - track.minZ) / this.mapScale.sc, name: c.name, record: rec, onGhost: !!this.ghosts[i], slip: c.slip,
      };
    };
    const h: HudState = {
      phase: this.phase, countdown: this.cdBeep, time: this.raceTime, players: [mk(0), mk(1)], vertical: this.vertical, paused: this.paused,
      mode: this.cfg.mode, trackName: track.def.name, round: this.cfg.round, rounds: this.cfg.rounds, other: [], speedFx: this.speedFx.slice(),
    };
    this.onHud(h);
  }
  getMap() {
    return { pts: this.mapPts, w: this.mapScale.w, h: this.mapScale.h };
  }
  /** viewport rectangles in CSS (top-left origin) coordinates, for the HUD overlay */
  getRects() {
    const H = host.h;
    return this.rects(host.w, H).map((r) => ({ x: r.x, y: H - r.y - r.h, w: r.w, h: r.h }));
  }

  // ------------------------------------------------------------------ results
  buildResult(): RaceResult {
    const order = [0, 1].sort((a, b) => {
      const ca = this.cars[a], cb = this.cars[b];
      if (this.cfg.mode === "timetrial") {
        const ta = ca.finished ? ca.finishTime : Infinity, tb = cb.finished ? cb.finishTime : Infinity;
        return ta - tb;
      }
      if (ca.finished && cb.finished) return ca.finishTime - cb.finishTime;
      if (ca.finished) return -1;
      if (cb.finished) return 1;
      return cb.best - ca.best;
    });
    const mode = this.cfg.mode;
    const players: PlayerResult[] = this.cars.map((c, i) => {
      const position = order.indexOf(i) + 1;
      const rec = store.get().profiles[i].records[this.world.track.def.id];
      const isRecord = isFinite(c.bestLap) && (!rec || c.bestLap < rec);
      let reward = mode === "timetrial" ? 400 + (isRecord ? 400 : 0) : position === 1 ? 1400 : 800;
      reward += Math.min(800, Math.round(c.driftTotal / 25)) + this.laps * 60 + (c.damage < 0.2 ? 150 : 0) + c.overtakes * 40;
      if (!c.finished) reward = Math.round(reward * 0.4);
      if (mode === "battle") reward = Math.round(reward * 1.1);
      if (mode === "championship") reward = Math.round(reward * 1.2);
      reward = Math.round(reward / 10) * 10;
      return {
        idx: i, name: c.name, carId: c.def.id, position, time: c.finished ? c.finishTime : Infinity, bestLap: c.bestLap, maxSpeed: c.maxSpeed, drift: c.driftTotal,
        nitroUsed: c.nitroUsed, overtakes: c.overtakes, reward, lapTimes: c.lapTimes.slice(), dnf: !c.finished, record: isRecord, damage: c.damage,
      };
    });
    return { mode, track: this.world.track.def.id, laps: this.laps, players, winner: order[0], round: this.cfg.round, rounds: this.cfg.rounds, settings: this.cfg.settings };
  }

  // ------------------------------------------------------------------ render
  render(r: THREE.WebGLRenderer, W: number, Hh: number) {
    if (this.disposed) return;
    const rects = this.rects(W, Hh);
    r.setScissorTest(true);
    const pr = host.pixelRatio;
    for (let p = 0; p < 2; p++) {
      const rc = rects[p];
      const v = this.views[p];
      const car = this.cars[p];
      v.cam.aspect = rc.w / rc.h;
      v.cam.updateProjectionMatrix();
      r.setViewport(rc.x, rc.y, rc.w, rc.h);
      r.setScissor(rc.x, rc.y, rc.w, rc.h);
      const scale = (rc.h * pr) / (2 * Math.tan((v.cam.fov * Math.PI) / 360));
      this.world.prepareView(v.cam, scale, this.t);
      this.vfx.setScale(scale);
      this.world.shadowTarget(car.x, car.y, car.z);
      // hood camera: hide own spoiler glare not needed
      r.clearDepth();
      r.render(this.world.scene, v.cam);
    }
    r.setScissorTest(false);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    input.capture = false;
    audio.stopEngines();
    audio.stopMusic();
    audio.stopWeather();
    this.cars.forEach((c) => disposeObject(c.model.group));
    this.ghosts.forEach((g) => g && disposeObject(g.group));
    this.trails.forEach((t) => t.forEach((x) => x.dispose()));
    this.vfx.dispose();
    this.world.dispose();
    host.renderer.renderLists.dispose();
  }
}

export { CARS };
