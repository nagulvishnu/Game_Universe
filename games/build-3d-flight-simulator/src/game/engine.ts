import * as THREE from 'three';
import { AIRCRAFT_CLASS_LABEL, LIVERIES, getAircraft, type AircraftClass, type AircraftSpec } from './aircraft';
import { animateModel, buildAircraft, buildCockpit, type AircraftModel } from './aircraftModels';
import { buildAirport, buildHelipad, type AirportAsset } from './airport';
import { AudioEngine } from './audio';
import {
  CloudSystem, ParticleSystem, RainSystem, WEATHER, WEATHER_LABEL, computeAtmosphere, createAtmosphere, createOcean, createSky, lerpWeather,
  type WeatherId, type WeatherState,
} from './environment';
import { MissionRunner, startPosition, type MissionDef, type MissionHud, type MissionResult, type Services, type Target } from './missions';
import {
  bankOf, createState, headingOf, pitchOf, placeInAir, placeOnGround, stepFlight, type Controls, type Env, type FlightState, type Touchdown,
} from './physics';
import type { Settings } from './save';
import { TerrainSystem, TreeSystem, buildCity } from './terrain';
import {
  AIRPORTS, CITIES, HELIPADS, WORLD_HALF, airportLocal, airportSdf, desertAmount, getAirport, nearestAirport, terrainHeight, type Airport,
} from './worldData';
import { clamp, lerp } from './noise';

export interface FlightStats { time: number; distanceKm: number; maxAlt: number; maxSpeed: number; landings: number; hardLandings: number; crashed: boolean; kills: number; rescues: number }
export interface Ils { icao: string; rwy: string; dist: number; loc: number; gs: number }
export interface HudSnapshot {
  ias: number; tas: number; gs: number; mach: number; alt: number; agl: number; vs: number; heading: number; pitch: number; bank: number;
  throttle: number; thrust: number; ab: boolean; gear: number; gearCmd: boolean; fixedGear: boolean; flaps: number; flapsMax: number; brake: boolean; airbrake: number;
  fuel: number; fuelKg: number; integrity: number; g: number; aoa: number; stall: boolean; onGround: boolean; warnings: string[];
  cam: number; assist: boolean; cls: AircraftClass; aircraft: string; windDir: number; windSpeed: number; hour: number; weather: string;
  mission: MissionHud; ils: Ils | null; target: { sx: number; sy: number; on: boolean; dist: number; label: string } | null;
  enemies: { sx: number; sy: number; dist: number; type: string; locked: boolean }[];
  lock: { dist: number } | null; ammo: { gun: number; missiles: number } | null;
  stats: FlightStats; inCloud: number; flash: number; blackout: number; rain: number; vne: number; vApp: number; vRef: number; servicing: boolean; rpm: number; landingLight: boolean;
  turb: number; fighter: boolean; heli: boolean; nav: { dist: number; icao: string; bearing: number } | null; stallSpeed: number;
}
export interface MapState { x: number; z: number; heading: number; waypoints: { x: number; z: number; label: string; kind: string }[]; enemies: { x: number; z: number }[]; target: { x: number; z: number } | null }

export interface EngineCallbacks {
  onSnapshot(s: HudSnapshot): void;
  onToast(text: string, tone: 'info' | 'good' | 'bad'): void;
  onEnd(result: MissionResult, stats: FlightStats, def: MissionDef): void;
  onPauseRequest(): void;
  onMapToggle(): void;
}

export interface GameConfig {
  aircraftId: string; liveryIdx: number; mission: MissionDef; settings: Settings; airport?: string; hourOverride?: number; weatherOverride?: WeatherId; dynamicWeather?: boolean;
}

type Mode = 'menu' | 'hangar' | 'play' | 'ended';
const UP = new THREE.Vector3(0, 1, 0);

interface Bullet { pos: THREE.Vector3; vel: THREE.Vector3; life: number; alive: boolean }
interface Missile { pos: THREE.Vector3; vel: THREE.Vector3; target: Target | null; life: number; alive: boolean; mesh: THREE.Mesh }

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private cb: EngineCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(70, 1, 1, 100000);
  private hScene = new THREE.Scene();
  private hCam = new THREE.PerspectiveCamera(40, 1, 0.5, 400);
  private hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  private sun = new THREE.DirectionalLight(0xffffff, 2);
  private terrain = new TerrainSystem();
  private trees = new TreeSystem();
  private sky = createSky();
  private ocean = createOcean();
  private clouds = new CloudSystem(900);
  private rain = new RainSystem(3200);
  private smoke = new ParticleSystem(1400, false, 0.5);
  private fire = new ParticleSystem(900, true, 1.2);
  private airports: { ap: Airport; asset: AirportAsset }[] = [];
  private cityMats: THREE.MeshStandardMaterial[] = [];
  private markerGroup = new THREE.Group();
  private markerObjs: { obj: THREE.Object3D; m: import('./missions').Marker; kind: string }[] = [];
  private targetGroup = new THREE.Group();
  private targetMeshes = new Map<number, THREE.Object3D>();
  private missiles: Missile[] = [];
  private bullets: Bullet[] = [];
  audio = new AudioEngine();
  private atm = createAtmosphere();
  private weather: WeatherState = { ...WEATHER.clear };
  private weatherTarget: WeatherState = { ...WEATHER.clear };
  private weatherId: WeatherId = 'clear';
  private dynamicWeather = false;
  private weatherTimer = 0;
  private hour = 12;
  private timeScale = 1;
  private flash = 0;
  private flashTimer = 5;

  mode: Mode = 'menu';
  paused = false;
  private settings!: Settings;
  private def: MissionDef | null = null;
  private cfg: GameConfig | null = null;
  private spec: AircraftSpec = getAircraft('liner320');
  private st: FlightState = createState(getAircraft('liner320'));
  private model: AircraftModel | null = null;
  private modelKey = '';
  private cockpit: ReturnType<typeof buildCockpit> | null = null;
  private runner: MissionRunner | null = null;
  private ctl = { pitch: 0, roll: 0, yaw: 0 };
  private keys = new Set<string>();
  private landingLight = false;
  private camMode = 0;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private camQ = new THREE.Quaternion();
  private orbit = { yaw: 0, pitch: 0, dragging: false };
  private cine = { t: 0, shot: 0, pos: new THREE.Vector3(), fov: 60 };
  private shake = 0;
  private time = 0;
  private lastSnap = 0;
  private stats: FlightStats = { time: 0, distanceKm: 0, maxAlt: 0, maxSpeed: 0, landings: 0, hardLandings: 0, crashed: false, kills: 0, rescues: 0 };
  private prevPos = new THREE.Vector3();
  private env: Env = { wind: new THREE.Vector3(), turbulence: 0, assist: true, noThrust: false, frozen: false };
  private windDir = 0.8;
  private gamepadPrev: boolean[] = [];
  private gun = { cool: 0, ammo: 600, missileCool: 0, missiles: 6 };
  private lock: Target | null = null;
  private serviceT = 0;
  private servicing = false;
  private inCloud = 0;
  private cloudTick = 0;
  private warnT = 0;
  private blackout = 0;
  private crashSmoke = 0;
  private endedTimer = 0;
  private raf = 0;
  private lastT = 0;
  private disposed = false;
  private hangar = { yaw: 0.6, pitch: 0.18, dist: 30, model: null as AircraftModel | null, root: new THREE.Group(), drag: false, spec: getAircraft('liner320') };
  private menuT = 0;
  private menuSpecIdx = 0;
  private pendingTouchdown: Touchdown | null = null;
  private tdSmoke = 0;
  private quality: Settings['quality'] = 'medium';
  private mapCanvas: HTMLCanvasElement | null = null;
  private needResize = true;
  private fogColorTmp = new THREE.Color();

  constructor(canvas: HTMLCanvasElement, cb: EngineCallbacks, settings: Settings) {
    this.canvas = canvas;
    this.cb = cb;
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.fog = new THREE.FogExp2(0xaaccee, 3e-5);
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.scene.add(this.terrain.group, this.trees.mesh, this.sky.mesh, this.ocean.mesh, this.clouds.mesh, this.rain.mesh, this.smoke.points, this.fire.points);
    this.scene.add(this.markerGroup, this.targetGroup, this.camera);
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 900;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.4;
    for (const c of CITIES) {
      const cm = buildCity(c);
      this.scene.add(cm.group);
      this.cityMats.push(cm.windows);
    }
    for (const ap of AIRPORTS) {
      const asset = buildAirport(ap);
      this.scene.add(asset.group);
      this.airports.push({ ap, asset });
    }
    for (const h of HELIPADS) this.scene.add(buildHelipad(h));
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe6e8ec, roughness: 0.4 }));
      m.visible = false;
      this.scene.add(m);
      this.missiles.push({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), target: null, life: 0, alive: false, mesh: m });
    }
    for (let i = 0; i < 90; i++) this.bullets.push({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, alive: false });
    this.buildHangarScene();
    this.applyQuality(settings.quality);
    this.audio.setVolume(settings.volume);
    this.audio.setMuted(settings.muted);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibility);
    this.resetWorldAround(-2500, 1500);
    this.showMenu();
    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.loop);
    setTimeout(() => this.worldMap(), 400);
  }

  /* ---------------------------------------------------------------- */
  /* setup helpers                                                     */
  /* ---------------------------------------------------------------- */
  applySettings(s: Settings) {
    this.settings = s;
    this.audio.setVolume(s.volume);
    this.audio.setMuted(s.muted);
    this.env.assist = s.assist;
    if (s.quality !== this.quality) this.applyQuality(s.quality);
    this.needResize = true;
  }

  private applyQuality(q: Settings['quality']) {
    this.quality = q;
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(q === 'low' ? Math.min(dpr, 0.85) : q === 'medium' ? Math.min(dpr, 1.25) : Math.min(dpr, 2));
    this.renderer.shadowMap.enabled = q !== 'low';
    this.sun.castShadow = q !== 'low';
    const size = q === 'high' ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.clouds.mesh.count = q === 'low' ? 450 : q === 'medium' ? 750 : 900;
    this.needResize = true;
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.hCam.aspect = w / h;
    this.hCam.updateProjectionMatrix();
    this.updatePxScale();
    this.needResize = false;
  }

  private updatePxScale() {
    const h = this.renderer.domElement.height;
    const scale = h / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.smoke.setScale(scale);
    this.fire.setScale(scale);
    for (const a of this.airports) a.asset.lights.mat.uniforms.uScale.value = scale;
  }

  private resetWorldAround(x: number, z: number) {
    this.terrain.init(x, z);
    this.trees.update(x + 1e5, z + 1e5, 0);
    this.trees.update(x, z, 100);
  }

  private loadAircraft(spec: AircraftSpec, livery: number) {
    const key = spec.id + ':' + livery;
    if (this.model && this.modelKey === key) return;
    if (this.model) this.scene.remove(this.model.root);
    this.model = buildAircraft(spec, LIVERIES[livery % LIVERIES.length]);
    this.modelKey = key;
    this.scene.add(this.model.root);
    if (this.cockpit) this.camera.remove(this.cockpit.group);
    this.cockpit = buildCockpit(spec);
    this.camera.add(this.cockpit.group);
    this.cockpit.group.visible = false;
  }

  /* ---------------------------------------------------------------- */
  /* menu / hangar                                                     */
  /* ---------------------------------------------------------------- */
  showMenu() {
    this.mode = 'menu';
    this.paused = false;
    this.audio.stopEngine();
    this.runner = null;
    this.clearMarkers();
    this.targetGroup.clear();
    this.targetMeshes.clear();
    this.setWeatherNow('clear');
    this.hour = 17.4;
    this.timeScale = 0;
    const specs = ['liner320', 'falcon22', 'lynx45', 'titan90', 'hawk60', 'sparrow172'];
    this.menuSpecIdx = (this.menuSpecIdx + 1) % specs.length;
    this.spec = getAircraft(specs[this.menuSpecIdx]);
    this.loadAircraft(this.spec, this.menuSpecIdx);
    this.model!.root.visible = true;
    this.menuT = 0;
    this.camMode = 2;
    this.hemi.visible = true;
    this.resetWorldAround(-2500, 1500);
  }

  private updateMenu(dt: number) {
    this.menuT += dt;
    const ap = getAirport('SKY');
    const R = 1500;
    const sp = this.spec.cls === 'helicopter' ? 25 : Math.min(this.spec.vCruise * 0.6, 120);
    const w = sp / R;
    const a = this.menuT * w;
    const cx = ap.x - 800;
    const cz = ap.z + 800;
    const x = cx + Math.cos(a) * R;
    const z = cz + Math.sin(a) * R;
    const y = 420 + Math.sin(this.menuT * 0.2) * 40;
    const hdg = Math.atan2(-Math.sin(a), Math.cos(a)) + Math.PI / 2 * 0; // tangent
    const fx = -Math.sin(a);
    const fz = Math.cos(a);
    const heading = Math.atan2(fx, -fz);
    void hdg;
    const q = new THREE.Quaternion().setFromAxisAngle(UP, -heading);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, -1), -0.28));
    const m = this.model!;
    m.root.position.set(x, y, z);
    m.root.quaternion.copy(q);
    this.st.pos.set(x, y, z);
    this.st.vel.set(fx * sp, 0, fz * sp);
    animateModel(m, this.spec, {
      pitch: 0, roll: 0.15, yaw: 0, gear: 0, flaps: 0, propAngle: this.menuT * 90, rotorAngle: this.menuT * 38, rpm: 1, throttle: 0.6, ab: false, time: this.menuT, night: this.atm.night, landingLight: false, cockpit: false,
    });
    // orbit camera
    const ang = this.menuT * 0.09 + 1.2;
    const rad = this.spec.length * 2.0 + 14;
    this.camera.position.set(x + Math.cos(ang) * rad, y + this.spec.length * 0.25, z + Math.sin(ang) * rad);
    this.camera.lookAt(x, y, z);
    this.camera.fov = 52;
    this.camera.near = 1;
    this.camera.updateProjectionMatrix();
    this.updateWorld(dt, new THREE.Vector3(x, y, z), this.st.vel);
  }

  private buildHangarScene() {
    const s = this.hScene;
    s.background = new THREE.Color(0x0a0f18);
    s.fog = new THREE.Fog(0x0a0f18, 60, 160);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1a2230, roughness: 0.35, metalness: 0.6 }));
    floor.receiveShadow = true;
    s.add(floor);
    for (let i = 1; i <= 5; i++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(i * 8 - 0.06, i * 8, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: i === 2 ? 0x38bdf8 : 0x24324a, transparent: true, opacity: i === 2 ? 0.8 : 0.5 }));
      ring.position.y = 0.02;
      s.add(ring);
    }
    const back = new THREE.Mesh(new THREE.CylinderGeometry(90, 90, 80, 48, 1, true), new THREE.MeshBasicMaterial({ color: 0x0e1626, side: THREE.BackSide }));
    back.position.y = 30;
    s.add(back);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 40, 0.5), new THREE.MeshBasicMaterial({ color: 0x1b2a45 }));
      bar.position.set(Math.cos(a) * 85, 20, Math.sin(a) * 85);
      s.add(bar);
    }
    s.add(new THREE.AmbientLight(0x6a7da0, 0.9));
    const key = new THREE.SpotLight(0xffffff, 2600, 0, 0.8, 0.7, 1.6);
    key.position.set(30, 50, 25);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    s.add(key);
    const rim = new THREE.DirectionalLight(0x38bdf8, 1.8);
    rim.position.set(-30, 10, -25);
    s.add(rim);
    const rim2 = new THREE.DirectionalLight(0xffb070, 1.2);
    rim2.position.set(25, 8, -30);
    s.add(rim2);
    s.add(this.hangar.root);
  }

  showHangar(aircraftId: string, liveryIdx: number) {
    this.mode = 'hangar';
    this.audio.stopEngine();
    const spec = getAircraft(aircraftId);
    this.hangar.spec = spec;
    if (this.hangar.model) this.hangar.root.remove(this.hangar.model.root);
    const m = buildAircraft(spec, LIVERIES[liveryIdx % LIVERIES.length]);
    m.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    const s = 22 / Math.max(spec.length, spec.span * 0.9);
    m.root.scale.setScalar(s);
    const lowest = Math.min(...spec.wheels.map((w) => w.y));
    m.root.position.y = -lowest * s + 0.05;
    this.hangar.root.clear();
    this.hangar.root.add(m.root);
    this.hangar.model = m;
    this.hangar.dist = 52;
  }

  hangarDrag(dx: number, dy: number) {
    this.hangar.yaw -= dx * 0.008;
    this.hangar.pitch = clamp(this.hangar.pitch + dy * 0.006, -0.1, 1.1);
  }
  hangarZoom(d: number) { this.hangar.dist = clamp(this.hangar.dist + d * 0.03, 18, 70); }

  private updateHangar(dt: number) {
    const h = this.hangar;
    if (!h.drag) h.yaw += dt * 0.25;
    const m = h.model;
    if (m) animateModel(m, h.spec, { pitch: Math.sin(this.time) * 0.3, roll: Math.sin(this.time * 0.7) * 0.4, yaw: 0, gear: 1, flaps: 0.3 + 0.3 * Math.sin(this.time * 0.5), propAngle: this.time * 12, rotorAngle: this.time * 20, rpm: 0.8, throttle: 0.2, ab: false, time: this.time, night: 1, landingLight: false, cockpit: false });
    const cx = Math.sin(h.yaw) * Math.cos(h.pitch) * h.dist;
    const cz = Math.cos(h.yaw) * Math.cos(h.pitch) * h.dist;
    this.hCam.position.set(cx, 4 + Math.sin(h.pitch) * h.dist, cz);
    this.hCam.lookAt(-4, 3.2, 0);
  }

  /* ---------------------------------------------------------------- */
  /* start game                                                        */
  /* ---------------------------------------------------------------- */
  startGame(cfg: GameConfig) {
    this.cfg = cfg;
    this.def = cfg.mission;
    this.settings = cfg.settings;
    this.spec = getAircraft(cfg.aircraftId);
    const spec = this.spec;
    this.mode = 'play';
    this.paused = false;
    this.endedTimer = 0;
    this.audio.init();
    this.audio.resume();
    this.stats = { time: 0, distanceKm: 0, maxAlt: 0, maxSpeed: 0, landings: 0, hardLandings: 0, crashed: false, kills: 0, rescues: 0 };
    this.loadAircraft(spec, cfg.liveryIdx);
    this.model!.root.visible = true;
    this.model!.root.scale.setScalar(1);
    this.st = createState(spec);
    this.st.fuel = spec.fuelCap * (this.def.kind === 'free' ? 1 : 0.85);
    this.env.assist = cfg.settings.assist;
    this.env.noThrust = false;
    this.env.frozen = false;
    this.ctl = { pitch: 0, roll: 0, yaw: 0 };
    this.keys.clear();
    this.gun = { cool: 0, ammo: 600, missileCool: 0, missiles: 6 };
    this.lock = null;
    this.bullets.forEach((b) => (b.alive = false));
    this.missiles.forEach((m) => { m.alive = false; m.mesh.visible = false; });
    this.landingLight = false;
    this.crashSmoke = 0;
    this.servicing = false;
    this.serviceT = 0;

    const def = this.def;
    let startAp = def.kind === 'free' && cfg.airport ? getAirport(cfg.airport) : undefined;
    const sp = startPosition(def, spec);
    if (startAp) {
      const ap = startAp;
      const heli = spec.cls === 'helicopter';
      const u = -(ap.length / 2 - Math.min(140, ap.length * 0.08));
      const x = heli ? ap.x + ap.right.x * 175 - ap.fwd.x * 70 : ap.x + ap.fwd.x * u;
      const z = heli ? ap.z + ap.right.z * 175 - ap.fwd.z * 70 : ap.z + ap.fwd.z * u;
      this.resetWorldAround(x, z);
      placeOnGround(this.st, spec, x, z, ap.heading, ap.elev);
    } else {
      startAp = sp.ap;
      this.resetWorldAround(sp.x, sp.z);
      if (sp.ground) placeOnGround(this.st, spec, sp.x, sp.z, sp.heading, sp.y);
      else {
        placeInAir(this.st, spec, sp.x, sp.y, sp.z, sp.heading, sp.speed, sp.gear);
        if (spec.cls === 'helicopter') this.st.vel.set(Math.sin(sp.heading) * 25, 0, -Math.cos(sp.heading) * 25);
      }
    }
    if (def.kind === 'landing' && def.landing?.engineOut) { this.env.noThrust = true; this.st.throttle = 0; this.st.thrustOut = 0; }
    this.prevPos.copy(this.st.pos);
    // weather & time
    const wid = cfg.weatherOverride ?? def.weather;
    this.setWeatherNow(wid);
    this.hour = cfg.hourOverride ?? def.hour;
    this.timeScale = def.kind === 'free' ? cfg.settings.timeScale : 0.12;
    this.dynamicWeather = !!cfg.dynamicWeather;
    this.weatherTimer = 150;
    this.windDir = Math.random() * Math.PI * 2;
    // runner
    this.runner = new MissionRunner(def, spec, this.services());
    this.buildMarkers();
    this.targetGroup.clear();
    this.targetMeshes.clear();
    // audio
    this.audio.startEngine(spec.thrustKind === 'jet' ? 'jet' : spec.thrustKind === 'prop' ? 'prop' : 'heli');
    this.camMode = 0;
    this.applyCamMode();
    this.camPos.copy(this.st.pos).add(new THREE.Vector3(0, 12, 50));
    this.camQ.copy(this.st.quat);
    this.updateModelTransform();
    this.needResize = true;
    this.cb.onToast(def.kind === 'free' ? `${spec.name} ready at ${startAp?.name ?? 'airport'}` : def.title, 'info');
  }

  private services(): Services {
    return {
      notify: (t, tone = 'info') => this.cb.onToast(t, tone),
      sfx: (n) => {
        const a = this.audio;
        if (n === 'checkpoint') a.checkpoint();
        else if (n === 'chime') a.chime();
        else if (n === 'fail') a.fail();
        else if (n === 'beep') a.beep();
        else if (n === 'winch') a.winch();
        else if (n === 'explosion') a.explosion();
      },
      setPayload: (kg) => { this.st.payload = kg; },
      freeze: (f) => { this.env.frozen = f; },
    };
  }

  restart() {
    if (this.cfg) this.startGame(this.cfg);
  }

  setPaused(p: boolean) {
    if (this.mode !== 'play') return;
    this.paused = p;
    if (p) this.audio.suspend(); else this.audio.resume();
  }

  endFlight() {
    // finish free flight / abort mission
    if (this.mode !== 'play' || !this.runner) return;
    if (this.def!.kind === 'free') {
      this.finishWith({ success: true, title: 'Flight Complete', score: 0, stars: 0, credits: Math.round(this.stats.distanceKm * 2), xp: Math.round(this.stats.time / 20), message: 'Thanks for flying with Skybound.', time: this.stats.time, lines: [] });
    } else {
      this.finishWith({ success: false, title: 'Mission Aborted', score: 0, stars: 0, credits: 0, xp: 0, message: 'You aborted the mission.', time: this.stats.time, lines: [] });
    }
  }

  private finishWith(r: MissionResult) {
    if (this.mode !== 'play') return;
    this.mode = 'ended';
    this.stats.time = this.runner?.time ?? this.stats.time;
    this.stats.kills = this.runner?.kills ?? 0;
    this.stats.rescues = this.runner?.rescued ?? 0;
    this.audio.stopEngine();
    this.camMode = 2;
    this.applyCamMode();
    this.cine.t = 99;
    this.cb.onEnd(r, { ...this.stats }, this.def!);
  }

  /* ---------------------------------------------------------------- */
  /* markers & targets                                                 */
  /* ---------------------------------------------------------------- */
  private clearMarkers() {
    this.markerGroup.clear();
    this.markerObjs = [];
  }

  private buildMarkers() {
    this.clearMarkers();
    if (!this.runner) return;
    for (const m of this.runner.markers) {
      let obj: THREE.Object3D;
      if (m.kind === 'ring') {
        obj = new THREE.Mesh(new THREE.TorusGeometry(m.r, m.r * 0.05, 8, 40), new THREE.MeshBasicMaterial({ color: m.color, transparent: true, opacity: 0.9, depthWrite: false }));
        obj.rotation.y = Math.PI - m.yaw;
        obj.position.set(m.x, m.y, m.z);
      } else {
        const g = new THREE.Group();
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(m.r * 0.5, m.r * 0.5, 900, 14, 1, true), new THREE.MeshBasicMaterial({ color: m.color, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        beam.position.y = 450;
        const ring = new THREE.Mesh(new THREE.RingGeometry(m.r * 0.9, m.r * 1.15, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: m.color, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
        ring.position.y = 0.6;
        g.add(beam, ring);
        g.position.set(m.x, m.y, m.z);
        obj = g;
      }
      this.markerGroup.add(obj);
      this.markerObjs.push({ obj, m, kind: m.kind });
    }
  }

  private makeTargetMesh(t: Target): THREE.Object3D {
    const g = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.6, metalness: 0.4 });
    const red = new THREE.MeshStandardMaterial({ color: 0xc02a2a, roughness: 0.5, emissive: 0x330808 });
    if (t.type === 'drone') {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 9, 10).rotateX(Math.PI / 2), dark);
      const w = new THREE.Mesh(new THREE.BoxGeometry(10, 0.15, 3.5), red);
      w.position.z = 1.5;
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.2, 1.8), dark);
      tail.position.set(0, 1, 3.8);
      g.add(f, w, tail);
      g.scale.setScalar(1.3);
    } else if (t.type === 'ship') {
      const hull = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 80), new THREE.MeshStandardMaterial({ color: 0x5b6470, roughness: 0.6 }));
      hull.position.y = 2;
      const sup = new THREE.Mesh(new THREE.BoxGeometry(10, 9, 22), new THREE.MeshStandardMaterial({ color: 0x8d949c, roughness: 0.6 }));
      sup.position.set(0, 9, 8);
      const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 12, 8).rotateX(Math.PI / 2), dark);
      gun.position.set(0, 7, -20);
      g.add(hull, sup, gun);
    } else {
      const base = new THREE.Mesh(new THREE.BoxGeometry(14, 5, 14), new THREE.MeshStandardMaterial({ color: 0x5c6258, roughness: 0.8 }));
      base.position.y = 2.5;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 12, 8), dark);
      mast.position.y = 11;
      const dish = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), red);
      dish.position.y = 16;
      dish.rotation.x = -0.7;
      g.add(base, mast, dish);
      g.position.y = -4;
    }
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    return g;
  }

  /* ---------------------------------------------------------------- */
  /* input                                                             */
  /* ---------------------------------------------------------------- */
  private onKeyDown = (e: KeyboardEvent) => {
    if (this.mode !== 'play') return;
    const k = e.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(k) || (e.ctrlKey && k.startsWith('Key') && k !== 'KeyR')) e.preventDefault();
    if (e.repeat) { this.keys.add(k); return; }
    this.keys.add(k);
    switch (k) {
      case 'KeyG': this.toggleGear(); break;
      case 'KeyF': this.setFlaps(1); break;
      case 'KeyV': this.setFlaps(-1); break;
      case 'KeyC': this.camMode = (this.camMode + 1) % 3; this.applyCamMode(); break;
      case 'Digit1': this.camMode = 0; this.applyCamMode(); break;
      case 'Digit2': this.camMode = 1; this.applyCamMode(); break;
      case 'Digit3': this.camMode = 2; this.applyCamMode(); break;
      case 'KeyL': this.landingLight = !this.landingLight; this.audio.click(); break;
      case 'KeyZ': this.st.throttle = 1; break;
      case 'KeyX': this.st.throttle = 0; break;
      case 'KeyP': case 'Escape': this.cb.onPauseRequest(); break;
      case 'KeyM': this.cb.onMapToggle(); break;
      case 'Enter': this.fireMissile(); break;
      case 'KeyH': this.env.assist = !this.env.assist; this.cb.onToast(this.env.assist ? 'Flight assist ON' : 'Flight assist OFF (realistic)', 'info'); break;
      default: break;
    }
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  private onBlur = () => { this.keys.clear(); };
  private onVisibility = () => { if (document.hidden && this.mode === 'play' && !this.paused) this.cb.onPauseRequest(); };
  private pdx = 0;
  private pdy = 0;
  private onPointerDown = (e: PointerEvent) => {
    this.pdx = e.clientX;
    this.pdy = e.clientY;
    if (this.mode === 'hangar') this.hangar.drag = true;
    else if (this.mode === 'play') this.orbit.dragging = true;
  };
  private onPointerMove = (e: PointerEvent) => {
    const dx = e.clientX - this.pdx;
    const dy = e.clientY - this.pdy;
    this.pdx = e.clientX;
    this.pdy = e.clientY;
    if (this.hangar.drag && this.mode === 'hangar') this.hangarDrag(dx, dy);
    else if (this.orbit.dragging && this.mode === 'play') {
      this.orbit.yaw -= dx * 0.006;
      this.orbit.pitch = clamp(this.orbit.pitch + dy * 0.005, -1.0, 1.2);
    }
  };
  private onPointerUp = () => { this.hangar.drag = false; this.orbit.dragging = false; };
  private onWheel = (e: WheelEvent) => { if (this.mode === 'hangar') this.hangarZoom(e.deltaY); };

  private toggleGear() {
    const st = this.st;
    if (this.spec.fixedGear) { this.cb.onToast(this.spec.cls === 'helicopter' ? 'Skids are fixed' : 'Fixed landing gear', 'info'); return; }
    if (st.onGround && st.gearCmd && Math.hypot(st.vel.x, st.vel.z) > 3) { this.cb.onToast('Cannot retract gear on the ground', 'bad'); return; }
    st.gearCmd = !st.gearCmd;
    this.audio.gear();
    this.cb.onToast(st.gearCmd ? 'Landing gear DOWN' : 'Landing gear UP', 'info');
  }
  private setFlaps(d: number) {
    const st = this.st;
    if (this.spec.flapLevels === 0) return;
    st.flapsCmd = clamp(st.flapsCmd + d, 0, this.spec.flapLevels);
    this.audio.click();
    this.cb.onToast(`Flaps ${st.flapsCmd}/${this.spec.flapLevels}`, 'info');
  }
  private applyCamMode() {
    const cockpit = this.camMode === 1 && this.mode !== 'ended';
    if (this.cockpit) this.cockpit.group.visible = cockpit;
    if (this.model) for (const o of this.model.hide) o.visible = !cockpit;
    this.camera.near = cockpit ? 0.15 : 1;
    this.camera.fov = cockpit ? this.settings.fov + 8 : this.settings.fov;
    this.camera.updateProjectionMatrix();
    this.updatePxScale();
    this.orbit.yaw = 0;
    this.orbit.pitch = 0;
    this.cine.t = 99;
  }

  private pollGamepad(dt: number): { p: number; r: number; y: number; t: number } | null {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && pads[0];
    if (!gp) return null;
    const dz = (v: number) => (Math.abs(v) < 0.12 ? 0 : v);
    const btn = (i: number) => !!gp.buttons[i]?.pressed;
    const edge = (i: number, fn: () => void) => { const now = btn(i); if (now && !this.gamepadPrev[i]) fn(); this.gamepadPrev[i] = now; };
    edge(1, () => this.toggleGear());
    edge(2, () => this.setFlaps(1));
    edge(5, () => this.setFlaps(-1));
    edge(3, () => { this.camMode = (this.camMode + 1) % 3; this.applyCamMode(); });
    edge(9, () => this.cb.onPauseRequest());
    edge(4, () => this.fireMissile());
    void dt;
    return { p: dz(gp.axes[1] ?? 0), r: dz(gp.axes[0] ?? 0), y: dz(gp.axes[2] ?? 0), t: (gp.buttons[7]?.value ?? 0) - (gp.buttons[6]?.value ?? 0) };
  }

  private readControls(dt: number): Controls {
    const k = this.keys;
    const inv = this.settings.invertPitch ? -1 : 1;
    let tp = ((k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0)) * inv;
    let tr = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let ty = (k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0);
    let ta = (k.has('ShiftLeft') || k.has('ShiftRight') ? 1 : 0) - (k.has('ControlLeft') || k.has('ControlRight') ? 1 : 0);
    const gp = this.pollGamepad(dt);
    let gpActive = false;
    if (gp) {
      if (gp.p || gp.r || gp.y || gp.t) gpActive = true;
      if (gp.p) tp = gp.p * inv;
      if (gp.r) tr = gp.r;
      if (gp.y) ty = gp.y;
      if (gp.t) ta = gp.t;
    }
    void gpActive;
    const ramp = (cur: number, tgt: number) => {
      const rate = tgt === 0 ? 5 : Math.sign(tgt) !== Math.sign(cur) && cur !== 0 ? 9 : 3.4;
      const d = tgt - cur;
      return cur + clamp(d, -rate * dt, rate * dt);
    };
    this.ctl.pitch = ramp(this.ctl.pitch, tp);
    this.ctl.roll = ramp(this.ctl.roll, tr);
    this.ctl.yaw = ramp(this.ctl.yaw, ty);
    const heli = this.spec.thrustKind === 'heli';
    if (ta !== 0) {
      if (heli) { if (!this.env.assist) this.st.throttle = clamp(this.st.throttle + ta * 0.28 * dt, 0, 1); }
      else this.st.throttle = clamp(this.st.throttle + ta * 0.45 * dt, 0, 1);
    }
    const fighter = this.spec.cls === 'fighter';
    const brake = k.has('KeyB') || (!fighter && k.has('Space')) || !!(gp && this.gamepadPrev[0]);
    return { pitch: this.ctl.pitch, roll: this.ctl.roll, yaw: this.ctl.yaw, throttleAxis: heli ? ta : ta, brake };
  }

  /* ---------------------------------------------------------------- */
  /* weather                                                           */
  /* ---------------------------------------------------------------- */
  private setWeatherNow(id: WeatherId) {
    this.weatherId = id;
    this.weather = { ...WEATHER[id] };
    this.weatherTarget = { ...WEATHER[id] };
  }
  setWeatherTarget(id: WeatherId) { this.weatherId = id; this.weatherTarget = { ...WEATHER[id] }; }

  /* ---------------------------------------------------------------- */
  /* main loop                                                         */
  /* ---------------------------------------------------------------- */
  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, Math.max(0.0005, (now - this.lastT) / 1000));
    this.lastT = now;
    if (this.needResize) this.resize();
    this.time += dt;
    if (this.mode === 'hangar') {
      this.updateHangar(dt);
      this.renderer.render(this.hScene, this.hCam);
      return;
    }
    if (this.mode === 'menu') this.updateMenu(dt);
    else if (this.mode === 'play' && !this.paused) this.updatePlay(dt);
    else if (this.mode === 'ended') this.updateEnded(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private updatePlay(dt: number) {
    const st = this.st;
    const spec = this.spec;
    const controls = this.readControls(dt);
    const wea = this.weather;
    lerpWeather(this.weather, this.weatherTarget, Math.min(1, dt * 0.15));
    if (this.dynamicWeather) {
      this.weatherTimer -= dt;
      if (this.weatherTimer <= 0) {
        this.weatherTimer = 120 + Math.random() * 180;
        const order: WeatherId[] = ['clear', 'partly', 'overcast', 'rain', 'storm'];
        const i = order.indexOf(this.weatherId);
        const ni = clamp(i + (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.3 ? 2 : 1), 0, 4);
        this.setWeatherTarget(order[ni]);
        this.cb.onToast(`Weather changing: ${WEATHER_LABEL[order[ni]]}`, 'info');
      }
    }
    // wind
    const wspd = wea.wind;
    this.env.wind.set(Math.sin(this.windDir) * wspd, 0, -Math.cos(this.windDir) * wspd);
    this.env.turbulence = wea.turb * (st.agl < 3 && st.onGround ? 0.3 : 1);
    const frozenStart = this.env.frozen;
    const n = Math.min(4, Math.ceil(dt / (1 / 100)));
    const sdt = dt / n;
    this.pendingTouchdown = null;
    let result: ReturnType<typeof stepFlight> | null = null;
    for (let i = 0; i < n && !st.crashed; i++) {
      result = stepFlight(st, spec, controls, this.env, sdt);
      if (result.touchdown && st.lastTouchdown) this.pendingTouchdown = st.lastTouchdown;
    }
    if (st.crashed && !this.stats.crashed) this.onCrash();
    // gentle lightning + weather effects
    this.flashTimer -= dt;
    if (wea.storm > 0.5 && this.flashTimer <= 0) {
      this.flash = 1;
      this.flashTimer = 3 + Math.random() * 9;
      this.audio.thunder();
    }
    this.flash = Math.max(0, this.flash - dt * 3.2);
    // touchdown fx
    if (this.pendingTouchdown) {
      const td = this.pendingTouchdown;
      this.audio.touchdown(td.sink);
      this.stats.landings++;
      if (td.sink > spec.maxSink) this.stats.hardLandings++;
      this.tdSmoke = 0.5;
      if (td.sink > spec.maxSink) this.cb.onToast('HARD LANDING – airframe damaged', 'bad');
    }
    if (this.tdSmoke > 0) {
      this.tdSmoke -= dt;
      this.emitTireSmoke(dt);
    }
    // stats
    const spd = st.vel.length();
    this.stats.time += dt;
    this.stats.distanceKm += (spd * dt) / 1000;
    this.stats.maxAlt = Math.max(this.stats.maxAlt, st.pos.y);
    this.stats.maxSpeed = Math.max(this.stats.maxSpeed, spd);
    // servicing
    this.updateService(dt);
    // out-of-bounds
    const oob = Math.max(Math.abs(st.pos.x), Math.abs(st.pos.z)) - WORLD_HALF;
    if (oob > 1500) {
      this.warnT -= dt;
      if (this.warnT <= 0) { this.cb.onToast('LEAVING FLIGHT AREA – TURN BACK', 'bad'); this.warnT = 4; }
      if (oob > 9000 && this.runner && !this.runner.result) this.runner.abort('You left the flight area.', this.playerInfo());
    }
    // weapons
    this.updateWeapons(dt);
    // mission
    if (this.runner) {
      this.runner.update(dt, this.playerInfo());
      this.syncMarkers();
      this.syncTargets(dt);
      if (this.runner.result && this.mode === 'play') {
        const r = this.runner.result;
        this.finishWith(r);
      }
    }
    if (frozenStart && !this.env.frozen) this.cb.onToast('GO!', 'good');
    // blackout from high G
    const targetBlack = st.gLoad > 6 ? clamp((st.gLoad - 6) / 3, 0, 1) : st.gLoad < -2 ? clamp((-2 - st.gLoad) / 2, 0, 0.8) : 0;
    this.blackout += (targetBlack - this.blackout) * Math.min(1, dt * (targetBlack > this.blackout ? 0.8 : 1.2));
    // warnings audio
    this.updateWarnings(dt);
    // visuals
    this.updateModelTransform();
    this.updateEffects(dt);
    this.updateCamera(dt);
    this.updateWorld(dt, this.camera.position, st.vel);
    this.audio.update(st.thrustOut, spd, st.afterburner, st.rpm, wea.wind, wea.rain, this.camMode === 1);
    // snapshot
    this.lastSnap += dt;
    if (this.lastSnap > 0.066) { this.lastSnap = 0; this.cb.onSnapshot(this.buildSnapshot()); }
  }

  private updateEnded(dt: number) {
    this.endedTimer += dt;
    const st = this.st;
    if (st.crashed) {
      if (this.crashSmoke > 0) {
        this.crashSmoke -= dt;
        for (let i = 0; i < 2; i++) this.smoke.emit(st.pos.x + (Math.random() - 0.5) * 8, st.pos.y + 1 + Math.random() * 3, st.pos.z + (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 3, 6 + Math.random() * 4, (Math.random() - 0.5) * 3, 6, 6, 28, 0.08, 0.08, 0.08, 0.7);
        if (Math.random() < 0.4) this.fire.emit(st.pos.x + (Math.random() - 0.5) * 6, st.pos.y + 1, st.pos.z + (Math.random() - 0.5) * 6, 0, 5, 0, 0.8, 6, 2, 1, 0.5, 0.1, 0.8);
      }
    } else {
      // keep flying forward for cinematic result camera
      this.env.frozen = false;
      stepFlight(st, this.spec, { pitch: 0, roll: 0, yaw: 0, throttleAxis: 0, brake: true }, this.env, dt);
    }
    this.updateModelTransform();
    this.updateEffects(dt);
    this.updateCamera(dt);
    this.updateWorld(dt, this.camera.position, st.vel);
    this.audio.update(0, 0, false, 0, this.weather.wind, this.weather.rain, false);
  }

  private playerInfo() {
    const st = this.st;
    const info = { st, spec: this.spec, heading: headingOf(st.quat), gs: Math.hypot(st.vel.x, st.vel.z), touchdown: this.pendingTouchdown, turb: this.env.turbulence };
    return info;
  }

  private onCrash() {
    const st = this.st;
    this.stats.crashed = true;
    this.audio.crash();
    this.audio.stopEngine();
    this.crashSmoke = 25;
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * 25;
      this.fire.emit(st.pos.x, st.pos.y + 1, st.pos.z, Math.cos(a) * e, Math.random() * 25, Math.sin(a) * e, 0.8 + Math.random() * 1.2, 10, 4, 1, 0.55, 0.12, 0.9);
    }
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * 14;
      this.smoke.emit(st.pos.x, st.pos.y + 2, st.pos.z, Math.cos(a) * e, Math.random() * 12, Math.sin(a) * e, 4 + Math.random() * 4, 8, 30, 0.1, 0.1, 0.1, 0.8);
    }
    if (this.model) this.model.root.visible = false;
    this.camMode = 2;
    this.applyCamMode();
    this.cine.t = 99;
    if (this.model) for (const o of this.model.hide) o.visible = true;
  }

  private updateService(dt: number) {
    const st = this.st;
    const spd = Math.hypot(st.vel.x, st.vel.z);
    const ap = nearestAirport(st.pos.x, st.pos.z);
    const inside = st.onGround && spd < 1.5 && ap.dist < 3500 && airportSdf(ap.ap, st.pos.x, st.pos.z) < 40;
    const canServe = inside && !(this.runner && this.runner.def.kind === 'transport' && this.runner.stage === 'load');
    if (canServe && (st.fuel < this.spec.fuelCap - 1 || st.integrity < 99.5) && st.throttle < 0.15) {
      this.serviceT += dt;
      if (this.serviceT > 2.5) {
        this.servicing = true;
        st.fuel = Math.min(this.spec.fuelCap, st.fuel + this.spec.fuelCap * 0.05 * dt);
        st.integrity = Math.min(100, st.integrity + 3 * dt);
      }
    } else { this.serviceT = 0; this.servicing = false; }
  }

  private updateWarnings(dt: number) {
    const w = this.st.warnings;
    this.warnT -= dt * 0;
    if (!this.warnClock) this.warnClock = 0;
    this.warnClock -= dt;
    if (this.warnClock <= 0) {
      if (w.has('PULL UP')) { this.audio.pullUp(); this.warnClock = 0.35; }
      else if (w.has('STALL')) { this.audio.stall(); this.warnClock = 0.28; }
      else if (w.has('GEAR')) { this.audio.beep(700); this.warnClock = 0.7; }
      else if (w.has('OVERSPEED')) { this.audio.beep(1500); this.warnClock = 0.25; }
    }
  }
  private warnClock = 0;

  /* ---------------------------------------------------------------- */
  /* visuals                                                           */
  /* ---------------------------------------------------------------- */
  private updateModelTransform() {
    const m = this.model;
    if (!m) return;
    const st = this.st;
    m.root.position.copy(st.pos);
    m.root.quaternion.copy(st.quat);
    const heli = this.spec.thrustKind === 'heli';
    animateModel(m, this.spec, {
      pitch: this.ctl.pitch, roll: this.ctl.roll, yaw: this.ctl.yaw, gear: st.gear, flaps: st.flaps, propAngle: st.propAngle, rotorAngle: st.rotorAngle,
      rpm: st.rpm, throttle: heli ? st.rpm * 0.8 : st.thrustOut, ab: st.afterburner, time: this.time, night: this.atm.night, landingLight: this.landingLight, cockpit: this.camMode === 1 && this.mode === 'play',
    });
    if (this.cockpit) {
      this.cockpit.yoke.rotation.z = -this.ctl.roll * 0.7;
      this.cockpit.yoke.position.z = -0.55 + this.ctl.pitch * 0.06;
    }
  }

  private emitTireSmoke(dt: number) {
    const st = this.st;
    const spd = Math.hypot(st.vel.x, st.vel.z);
    if (spd < 8 || st.surface !== 'pavement') return;
    for (const w of this.spec.wheels) {
      if (w.kind !== 'main') continue;
      const p = new THREE.Vector3(w.x, w.y, w.z).applyQuaternion(st.quat).add(st.pos);
      if (Math.random() < 90 * dt) this.smoke.emit(p.x, p.y + 0.2, p.z, st.vel.x * 0.1, 1.2, st.vel.z * 0.1, 1.6, 1.5, 6, 0.85, 0.85, 0.85, 0.5);
    }
  }

  private updateEffects(dt: number) {
    const st = this.st;
    const spec = this.spec;
    const m = this.model;
    if (!m || st.crashed) { this.smoke.update(dt); this.fire.update(dt); return; }
    const alt = st.pos.y;
    const spd = st.vel.length();
    const tmp = new THREE.Vector3();
    // contrails
    if (alt > 6500 && spec.thrustKind === 'jet' && spd > 60 && this.weather.cloud < 1) {
      const a = clamp((alt - 6500) / 2000, 0, 1) * 0.55;
      for (const w of m.wingtips) {
        if (spec.cls === 'airliner' || spec.cls === 'cargo') continue;
        tmp.copy(w).applyQuaternion(st.quat).add(st.pos);
        if (Math.random() < 120 * dt) this.smoke.emit(tmp.x, tmp.y, tmp.z, 0, 0, 0, 5, 2, 9, 1, 1, 1, a);
      }
      if (spec.cls === 'airliner' || spec.cls === 'cargo') {
        for (const e of m.exhaust) {
          tmp.copy(e).applyQuaternion(st.quat).add(st.pos);
          if (Math.random() < 100 * dt) this.smoke.emit(tmp.x, tmp.y, tmp.z, 0, 0, 0, 7, 3, 12, 1, 1, 1, a);
        }
      }
    }
    // damage smoke / fire
    if (st.integrity < 55) {
      const k = (55 - st.integrity) / 55;
      tmp.copy(m.exhaust[0] ?? new THREE.Vector3(0, 0, 3)).applyQuaternion(st.quat).add(st.pos);
      if (Math.random() < (20 + 60 * k) * dt) this.smoke.emit(tmp.x, tmp.y, tmp.z, -st.vel.x * 0.05, 1, -st.vel.z * 0.05, 3 + k * 3, 1.5, 7 + 6 * k, 0.1, 0.1, 0.1, 0.6);
      if (st.integrity < 25 && Math.random() < 40 * dt) this.fire.emit(tmp.x, tmp.y, tmp.z, 0, 1, 0, 0.5, 2.5, 0.5, 1, 0.5, 0.1, 0.8);
    }
    // engine heat shimmer / afterburner sparks
    if (st.afterburner) {
      for (const e of m.exhaust) {
        tmp.copy(e).applyQuaternion(st.quat).add(st.pos);
        if (Math.random() < 50 * dt) this.fire.emit(tmp.x, tmp.y, tmp.z, -st.vel.x * 0.2, 0, -st.vel.z * 0.2, 0.25, 1.4, 0.3, 1, 0.55, 0.15, 0.6);
      }
    }
    // dust from helicopter downwash
    if (spec.thrustKind === 'heli' && st.agl < 25 && st.rpm > 0.8 && st.thrustOut > 0.3) {
      const surf = st.surface;
      const wet = this.weather.rain > 0.3;
      if (surf !== 'pavement' || wet) {
        const col = desertAmount(st.pos.x, st.pos.z) > 0.4 ? [0.8, 0.7, 0.5] : [0.55, 0.5, 0.4];
        for (let i = 0; i < 2; i++) {
          const a = Math.random() * Math.PI * 2;
          const g = Math.max(terrainHeight(st.pos.x, st.pos.z), 0);
          this.smoke.emit(st.pos.x + Math.cos(a) * 3, g + 0.5, st.pos.z + Math.sin(a) * 3, Math.cos(a) * 12, 1.5, Math.sin(a) * 12, 1.6, 2, 9, col[0], col[1], col[2], 0.3);
        }
      }
    }
    this.smoke.update(dt);
    this.fire.update(dt);
  }

  private updateCamera(dt: number) {
    const st = this.st;
    const spec = this.spec;
    const cam = this.camera;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(st.quat);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(st.quat);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(st.quat);
    const baseFov = this.settings.fov;
    let shakeAmt = this.env.turbulence * 0.04 + st.stallAmt * 0.12 + (st.afterburner ? 0.01 : 0) + (st.scrape > 5 ? 0.25 : 0);
    if (st.onGround && !st.crashed) shakeAmt += Math.min(0.03, Math.hypot(st.vel.x, st.vel.z) * 0.0003);
    this.shake += (shakeAmt - this.shake) * Math.min(1, dt * 6);
    if (!this.orbit.dragging && this.camMode === 0) {
      this.orbit.yaw *= Math.exp(-dt * 1.8);
      this.orbit.pitch *= Math.exp(-dt * 1.8);
    }
    const mode = this.mode === 'ended' ? 2 : this.camMode;
    if (mode === 1) {
      const off = new THREE.Vector3(spec.cockpit.x, spec.cockpit.y, spec.cockpit.z);
      off.y -= (st.gLoad - 1) * 0.015;
      const p = off.applyQuaternion(st.quat).add(st.pos);
      cam.position.copy(p);
      const look = new THREE.Quaternion().setFromEuler(new THREE.Euler(-this.orbit.pitch * 0.8, this.orbit.yaw * 1.0, 0, 'YXZ'));
      cam.quaternion.copy(st.quat).multiply(look);
      if (this.shake > 0.001) {
        cam.position.addScaledVector(up, (Math.random() - 0.5) * this.shake * 0.12);
        cam.position.addScaledVector(right, (Math.random() - 0.5) * this.shake * 0.12);
        cam.rotateZ((Math.random() - 0.5) * this.shake * 0.05);
      }
      cam.fov = lerp(cam.fov, baseFov + 8 + Math.min(18, st.vel.length() * 0.03) * 0, 0.1);
    } else if (mode === 0) {
      const camUp = new THREE.Vector3(0, 1, 0).lerp(up, 0.3).normalize();
      const dist = spec.chase.dist * (1 + Math.min(0.25, st.vel.length() * 0.0006));
      const o = new THREE.Vector3(0, spec.chase.height, dist);
      const basis = new THREE.Matrix4().lookAt(new THREE.Vector3(), fwd, camUp);
      const bq = new THREE.Quaternion().setFromRotationMatrix(basis);
      this.camQ.slerp(bq, 1 - Math.exp(-dt * 5));
      const orb = new THREE.Quaternion().setFromEuler(new THREE.Euler(-this.orbit.pitch, this.orbit.yaw, 0, 'YXZ'));
      const qq = this.camQ.clone().multiply(orb);
      const desired = o.clone().applyQuaternion(qq).add(st.pos);
      this.camPos.lerp(desired, 1 - Math.exp(-dt * 7));
      cam.position.copy(this.camPos);
      this.camLook.copy(st.pos).addScaledVector(fwd, dist * 0.3).addScaledVector(camUp, spec.chase.height * 0.25);
      cam.lookAt(this.camLook);
      if (this.shake > 0.001) cam.position.addScaledVector(up, (Math.random() - 0.5) * this.shake * 0.4);
      cam.fov = lerp(cam.fov, baseFov + clamp(st.vel.length() * 0.02, 0, 10), 0.08);
    } else {
      this.updateCinematic(dt, fwd, right, up);
    }
    // keep above terrain
    const gh = terrainHeight(cam.position.x, cam.position.z);
    const minY = Math.max(gh, 0) + (mode === 1 ? 0.3 : 2.5);
    if (cam.position.y < minY && mode !== 1) cam.position.y = minY;
    if (cam.fov !== this.cineFovPrev) { cam.updateProjectionMatrix(); this.cineFovPrev = cam.fov; this.updatePxScale(); }
  }
  private cineFovPrev = 0;

  private updateCinematic(dt: number, fwd: THREE.Vector3, right: THREE.Vector3, up: THREE.Vector3) {
    const st = this.st;
    const cam = this.camera;
    const spec = this.spec;
    this.cine.t += dt;
    const L = spec.length;
    const crashed = st.crashed;
    if (this.cine.t > 7 || this.cine.t === 99) {
      this.cine.t = 0;
      this.cine.shot = (this.cine.shot + 1 + Math.floor(Math.random() * 2)) % 5;
      const v = st.vel.clone();
      const sp = v.length();
      const dir = sp > 5 ? v.clone().normalize() : fwd.clone();
      const side = new THREE.Vector3().crossVectors(dir, UP).normalize();
      switch (this.cine.shot) {
        case 0: // fly-by ahead
          this.cine.pos.copy(st.pos).addScaledVector(dir, Math.min(500, sp * 4 + 80)).addScaledVector(side, 45 + L).add(new THREE.Vector3(0, 6, 0));
          this.cine.fov = 38;
          break;
        case 2: // low ground
          this.cine.pos.copy(st.pos).addScaledVector(dir, Math.min(700, sp * 5 + 60)).addScaledVector(side, 60 + L * 1.5);
          this.cine.pos.y = Math.max(terrainHeight(this.cine.pos.x, this.cine.pos.z), 0) + 3;
          this.cine.fov = 32;
          break;
        case 4: // far tracking
          this.cine.pos.copy(st.pos).addScaledVector(dir, -L * 3).addScaledVector(side, -L * 2.2).add(new THREE.Vector3(0, L * 0.5, 0));
          this.cine.fov = 55;
          break;
        default: this.cine.fov = 60;
      }
    }
    const shot = this.cine.shot;
    const t = this.cine.t;
    if (crashed) {
      cam.position.lerp(st.pos.clone().add(new THREE.Vector3(40, 22, 40)), 0.02);
      cam.lookAt(st.pos);
      cam.fov = 55;
      return;
    }
    if (shot === 1) { // wing view
      const p = new THREE.Vector3(spec.span * 0.5 + 3, 1.5 + L * 0.05, L * 0.1).applyQuaternion(st.quat).add(st.pos);
      cam.position.lerp(p, 1 - Math.exp(-dt * 8));
      cam.lookAt(st.pos.clone().addScaledVector(fwd, L * 0.3));
      cam.fov = 60;
    } else if (shot === 3) { // orbit
      const a = t * 0.5 + 1;
      const r = L * 1.7 + 20;
      const p = new THREE.Vector3(Math.cos(a) * r, L * 0.2 + 3, Math.sin(a) * r).applyQuaternion(st.quat).add(st.pos);
      cam.position.lerp(p, 1 - Math.exp(-dt * 5));
      cam.lookAt(st.pos);
      cam.fov = 50;
    } else {
      if (shot === 4) {
        const dir = st.vel.length() > 5 ? st.vel.clone().normalize() : fwd;
        this.cine.pos.copy(st.pos).addScaledVector(dir, -L * 3).addScaledVector(up, L * 0.35).addScaledVector(right, -L * 2.2);
      }
      cam.position.copy(this.cine.pos);
      cam.lookAt(st.pos);
    }
    cam.fov = lerp(cam.fov, this.cine.fov, 0.1);
    void right;
  }

  private updateWorld(dt: number, camPos: THREE.Vector3, vel: THREE.Vector3) {
    const w = this.weather;
    const hh = this.timeScale * dt / 60;
    this.hour = (this.hour + hh) % 24;
    computeAtmosphere(this.atm, this.hour, w, this.flash);
    const a = this.atm;
    // in-cloud effect
    this.cloudTick -= dt;
    if (this.cloudTick <= 0 && this.mode !== 'menu') {
      this.cloudTick = 0.2;
      this.inCloud = this.clouds.densityAt(this.camera.position, w.cloud, 1 + w.storm * 0.5);
    }
    const cloudFog = this.inCloud * 0.0028;
    const fog = this.scene.fog as THREE.FogExp2;
    fog.density = w.fog + cloudFog;
    this.fogColorTmp.copy(a.fog);
    if (this.inCloud > 0.05) this.fogColorTmp.lerp(new THREE.Color(0.75, 0.78, 0.82).multiplyScalar(0.3 + 0.7 * a.sunIntensity), this.inCloud * 0.8);
    fog.color.copy(this.fogColorTmp);
    this.hemi.color.copy(a.hemiSky);
    this.hemi.groundColor.copy(a.hemiGround);
    this.hemi.intensity = a.hemiIntensity;
    const px = this.mode === 'play' || this.mode === 'ended' ? this.st.pos : camPos;
    this.sun.color.copy(a.lightColor);
    this.sun.intensity = a.lightIntensity;
    const sdist = 300;
    this.sun.position.copy(px).addScaledVector(a.lightDir, sdist);
    this.sun.target.position.copy(px);
    const half = this.mode === 'menu' ? 80 : Math.max(60, this.spec.length * 2.3);
    const sc = this.sun.shadow.camera;
    if (sc.right !== half) { sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.updateProjectionMatrix(); }
    // sky / ocean follow camera
    this.sky.mesh.position.copy(camPos);
    const su = this.sky.mat.uniforms;
    su.uZenith.value.copy(a.zenith);
    su.uHorizon.value.copy(a.horizon);
    su.uSunDir.value.copy(a.sunDir);
    su.uSunColor.value.copy(a.sunColor);
    su.uMoonDir.value.copy(a.moonDir);
    su.uStars.value = a.stars;
    su.uDark.value = w.dark;
    this.ocean.mesh.position.set(camPos.x, 0, camPos.z);
    const ou = this.ocean.mat.uniforms;
    ou.uTime.value = this.time;
    ou.uSunDir.value.copy(a.lightDir);
    ou.uSunColor.value.copy(a.lightColor);
    ou.uSunI.value = Math.min(1.3, a.lightIntensity / 3);
    ou.uHorizon.value.copy(a.horizon);
    ou.uZenith.value.copy(a.zenith);
    ou.uSea.value = w.sea;
    ou.uNight.value = a.night;
    // clouds & rain
    const windV = new THREE.Vector2(Math.sin(this.windDir) * w.wind, -Math.cos(this.windDir) * w.wind);
    this.clouds.update(dt, camPos, windV, w, a);
    this.rain.update(dt, camPos, vel, w.rain);
    // terrain / trees
    this.terrain.update(camPos.x, camPos.z);
    this.trees.update(camPos.x, camPos.z, camPos.y - Math.max(terrainHeight(camPos.x, camPos.z), 0));
    // night lights
    const lightInt = 0.22 + 0.9 * a.night + w.dark * 0.15;
    for (const c of this.cityMats) c.emissiveIntensity = a.night * 1.4;
    for (const ap of this.airports) {
      ap.asset.lights.mat.uniforms.uInt.value = lightInt;
      for (const wm of ap.asset.windowMats) wm.emissiveIntensity = a.night * 1.2;
      ap.asset.group.visible = Math.hypot(ap.ap.x - camPos.x, ap.ap.z - camPos.z) < 24000;
    }
  }

  private syncMarkers() {
    const t = this.time;
    for (const mo of this.markerObjs) {
      const m = mo.m;
      mo.obj.visible = m.active;
      if (!m.active) continue;
      if (mo.kind === 'ring') {
        const mat = (mo.obj as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.opacity = m.dim ? 0.35 : 0.65 + 0.3 * Math.sin(t * 6);
        mo.obj.scale.setScalar(m.dim ? 1 : 1 + 0.03 * Math.sin(t * 6));
      }
    }
  }

  private syncTargets(dt: number) {
    if (!this.runner) return;
    for (const tg of this.runner.targets) {
      let o = this.targetMeshes.get(tg.id);
      if (!o) {
        o = this.makeTargetMesh(tg);
        this.targetGroup.add(o);
        this.targetMeshes.set(tg.id, o);
      }
      if (!tg.alive) {
        if (o.visible) {
          o.visible = false;
          for (let i = 0; i < 70; i++) {
            const a = Math.random() * Math.PI * 2;
            const e = Math.random() * 20;
            this.fire.emit(tg.pos.x, tg.pos.y + 3, tg.pos.z, Math.cos(a) * e, Math.random() * 18, Math.sin(a) * e, 0.7 + Math.random(), 9, 3, 1, 0.55, 0.12, 0.9);
            this.smoke.emit(tg.pos.x, tg.pos.y + 3, tg.pos.z, Math.cos(a) * e * 0.5, Math.random() * 10, Math.sin(a) * e * 0.5, 4 + Math.random() * 3, 8, 26, 0.1, 0.1, 0.1, 0.7);
          }
        }
        continue;
      }
      o.position.copy(tg.pos);
      if (tg.type === 'drone') {
        o.rotation.y = -tg.heading;
        o.rotation.z = -tg.turn * 0.8;
      } else if (tg.type === 'ship') o.rotation.y = -tg.heading;
      if (tg.type === 'ground' && Math.random() < 0.02) void dt;
    }
  }

  /* ---------------------------------------------------------------- */
  /* weapons                                                           */
  /* ---------------------------------------------------------------- */
  private updateLock() {
    const st = this.st;
    this.lock = null;
    if (!this.runner || this.spec.cls !== 'fighter') return;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(st.quat);
    let best = 0.9;
    for (const t of this.runner.targets) {
      if (!t.alive) continue;
      const d = new THREE.Vector3().subVectors(t.pos, st.pos);
      const dist = d.length();
      if (dist > 7000 || dist < 80) continue;
      const c = d.normalize().dot(fwd);
      if (c > best) { best = c; this.lock = t; }
    }
    if (this.lock && best < 0.9) this.lock = null;
  }

  private fireMissile() {
    if (this.mode !== 'play' || this.spec.cls !== 'fighter' || this.paused) return;
    if (this.gun.missiles <= 0) { this.cb.onToast('No missiles remaining', 'bad'); return; }
    if (this.gun.missileCool > 0) return;
    const slot = this.missiles.find((m) => !m.alive);
    if (!slot) return;
    const st = this.st;
    const side = this.gun.missiles % 2 === 0 ? -1 : 1;
    const p = new THREE.Vector3(side * 2.4, -0.6, 0).applyQuaternion(st.quat).add(st.pos);
    slot.pos.copy(p);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(st.quat);
    slot.vel.copy(st.vel).addScaledVector(fwd, 60);
    slot.target = this.lock;
    slot.life = 9;
    slot.alive = true;
    slot.mesh.visible = true;
    this.gun.missiles--;
    this.gun.missileCool = 0.9;
    this.audio.missile();
    this.cb.onToast(this.lock ? 'FOX 2 – missile away' : 'Missile fired (no lock)', 'info');
  }

  private updateWeapons(dt: number) {
    if (this.spec.cls !== 'fighter') return;
    const st = this.st;
    this.gun.cool -= dt;
    this.gun.missileCool -= dt;
    this.updateLock();
    const fire = this.keys.has('Space') && this.mode === 'play' && !st.crashed && this.gun.ammo > 0 && !this.env.frozen;
    if (fire && this.gun.cool <= 0) {
      this.gun.cool = 0.055;
      const b = this.bullets.find((x) => !x.alive);
      if (b) {
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(st.quat);
        const side = new THREE.Vector3(1, 0, 0).applyQuaternion(st.quat);
        b.pos.copy(st.pos).addScaledVector(fwd, 6).addScaledVector(side, (Math.random() - 0.5) * 0.6);
        b.vel.copy(st.vel).addScaledVector(fwd, 950).addScaledVector(side, (Math.random() - 0.5) * 6).addScaledVector(UP, (Math.random() - 0.5) * 6);
        b.life = 1.5;
        b.alive = true;
        this.gun.ammo--;
        if (this.runner) this.runner.shots++;
        if (Math.random() < 0.5) this.audio.gun();
      }
    }
    const tgs = this.runner ? this.runner.targets : [];
    const seg = new THREE.Vector3();
    const to = new THREE.Vector3();
    for (const b of this.bullets) {
      if (!b.alive) continue;
      b.life -= dt;
      const prev = b.pos.clone();
      b.vel.y -= 9.81 * dt * 0.6;
      b.pos.addScaledVector(b.vel, dt);
      this.fire.emit(b.pos.x, b.pos.y, b.pos.z, 0, 0, 0, 0.1, 1.1, 0.5, 1, 0.85, 0.4, 0.9);
      if (b.life <= 0 || b.pos.y < terrainHeight(b.pos.x, b.pos.z)) {
        if (b.pos.y < Math.max(terrainHeight(b.pos.x, b.pos.z), 0)) this.smoke.emit(b.pos.x, b.pos.y + 0.5, b.pos.z, 0, 3, 0, 1, 1, 5, 0.6, 0.55, 0.45, 0.5);
        b.alive = false;
        continue;
      }
      seg.subVectors(b.pos, prev);
      const sl2 = seg.lengthSq();
      for (const t of tgs) {
        if (!t.alive) continue;
        to.subVectors(t.pos, prev);
        const u = clamp(to.dot(seg) / sl2, 0, 1);
        const cp = prev.clone().addScaledVector(seg, u);
        if (cp.distanceTo(t.pos) < t.radius + 4) {
          this.runner!.damageTarget(t, 1);
          this.fire.emit(cp.x, cp.y, cp.z, 0, 2, 0, 0.3, 4, 1, 1, 0.6, 0.2, 0.9);
          b.alive = false;
          break;
        }
      }
    }
    for (const m of this.missiles) {
      if (!m.alive) continue;
      m.life -= dt;
      const sp = Math.min(650, m.vel.length() + 260 * dt);
      const dir = m.vel.clone().normalize();
      if (m.target && m.target.alive) {
        const want = new THREE.Vector3().subVectors(m.target.pos, m.pos);
        const dist = want.length();
        want.normalize();
        const ang = Math.acos(clamp(dir.dot(want), -1, 1));
        const turn = Math.min(ang, 2.6 * dt);
        if (ang > 1e-4) {
          const axis = new THREE.Vector3().crossVectors(dir, want).normalize();
          dir.applyAxisAngle(axis, turn);
        }
        if (dist < 30) {
          this.runner!.damageTarget(m.target, 100);
          m.alive = false;
          m.mesh.visible = false;
          for (let i = 0; i < 30; i++) this.fire.emit(m.pos.x, m.pos.y, m.pos.z, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 0.6, 8, 2, 1, 0.6, 0.2, 0.9);
          continue;
        }
      }
      m.vel.copy(dir).multiplyScalar(sp);
      m.pos.addScaledVector(m.vel, dt);
      m.mesh.position.copy(m.pos);
      m.mesh.lookAt(m.pos.clone().add(m.vel));
      this.smoke.emit(m.pos.x, m.pos.y, m.pos.z, 0, 0, 0, 2.5, 1.5, 6, 0.9, 0.9, 0.9, 0.5);
      this.fire.emit(m.pos.x, m.pos.y, m.pos.z, 0, 0, 0, 0.12, 2, 0.5, 1, 0.7, 0.3, 0.9);
      if (m.life <= 0 || m.pos.y < Math.max(terrainHeight(m.pos.x, m.pos.z), 0)) {
        m.alive = false;
        m.mesh.visible = false;
        this.fire.emit(m.pos.x, m.pos.y, m.pos.z, 0, 4, 0, 0.6, 8, 2, 1, 0.6, 0.2, 0.9);
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* HUD snapshot                                                      */
  /* ---------------------------------------------------------------- */
  private project(p: THREE.Vector3) {
    const v = p.clone().project(this.camera);
    const behind = new THREE.Vector3().subVectors(p, this.camera.position).dot(new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion)) < 0;
    return { sx: (v.x * 0.5 + 0.5), sy: (-v.y * 0.5 + 0.5), on: !behind && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 };
  }

  private computeIls(): Ils | null {
    const st = this.st;
    let ap: Airport | null = null;
    if (this.runner && this.runner.def.kind !== 'free' && (this.runner as unknown as { landAp: Airport | null }).landAp && ['land', 'approach', 'rtb'].includes(this.runner.stage)) {
      ap = (this.runner as unknown as { landAp: Airport }).landAp;
    } else {
      const n = nearestAirport(st.pos.x, st.pos.z);
      if (n.dist < 16000) ap = n.ap;
    }
    if (!ap) return null;
    const { u, v } = airportLocal(ap, st.pos.x, st.pos.z);
    const hdg = headingOf(st.quat);
    const hdiff = Math.cos(hdg - ap.heading);
    const dir = hdiff >= 0 ? 1 : -1;
    const dist = dir > 0 ? -(u + ap.length / 2) : u - ap.length / 2;
    if (dist < 150 || dist > 16000) return null;
    const lat = dir > 0 ? v : -v;
    const locAng = Math.atan2(lat, dist);
    if (Math.abs(locAng) > 0.45 || Math.abs(hdiff) < 0.7) return null;
    const hAbove = st.pos.y - ap.elev;
    const gsAng = Math.atan2(hAbove, dist);
    const rwyHdg = dir > 0 ? ap.headingDeg : (ap.headingDeg + 180) % 360;
    const rwy = String(Math.round(rwyHdg / 10) % 36 || 36).padStart(2, '0');
    return { icao: ap.icao, rwy, dist, loc: (locAng * 180) / Math.PI, gs: ((gsAng - (3 * Math.PI) / 180) * 180) / Math.PI };
  }

  private buildSnapshot(): HudSnapshot {
    const st = this.st;
    const spec = this.spec;
    const heli = spec.thrustKind === 'heli';
    const runner = this.runner;
    const mh: MissionHud = runner ? runner.hud : { title: '', objective: '' };
    let target: HudSnapshot['target'] = null;
    if (mh.target) {
      const p = this.project(new THREE.Vector3(mh.target.x, mh.target.y, mh.target.z));
      target = { ...p, dist: Math.hypot(mh.target.x - st.pos.x, mh.target.z - st.pos.z), label: mh.target.label };
    }
    const enemies: HudSnapshot['enemies'] = [];
    if (runner) {
      for (const t of runner.targets) {
        if (!t.alive) continue;
        const dist = t.pos.distanceTo(st.pos);
        if (dist > 14000) continue;
        const p = this.project(t.pos);
        if (p.on) enemies.push({ sx: p.sx, sy: p.sy, dist, type: t.type, locked: this.lock === t });
      }
    }
    const nav = nearestAirport(st.pos.x, st.pos.z);
    const hdg = headingOf(st.quat);
    const abx = nav.ap.x - st.pos.x;
    const abz = nav.ap.z - st.pos.z;
    let bearing = (Math.atan2(abx, -abz) * 180) / Math.PI;
    bearing = (bearing + 360) % 360;
    const vs = st.vel.y;
    const stallSpeed = spec.thrustKind === 'heli' ? 0 : Math.sqrt((2 * (spec.mass + st.fuel + st.payload) * 9.81) / (1.225 * spec.S * (spec.CLa * spec.alphaStall + spec.CL0 + spec.flapCL * st.flaps)));
    return {
      ias: st.ias, tas: st.tas, gs: Math.hypot(st.vel.x, st.vel.z), mach: st.mach, alt: st.pos.y, agl: Math.max(0, st.agl), vs, heading: (hdg * 180) / Math.PI,
      pitch: (pitchOf(st.quat) * 180) / Math.PI, bank: (bankOf(st.quat) * 180) / Math.PI,
      throttle: st.throttle, thrust: st.thrustOut, ab: st.afterburner, gear: st.gear, gearCmd: st.gearCmd, fixedGear: !!spec.fixedGear, flaps: st.flapsCmd, flapsMax: spec.flapLevels,
      brake: this.keys.has('KeyB') || this.keys.has('Space'), airbrake: st.airbrake, fuel: st.fuel / spec.fuelCap, fuelKg: st.fuel, integrity: st.integrity, g: st.gLoad,
      aoa: (st.alpha * 180) / Math.PI, stall: st.warnings.has('STALL'), onGround: st.onGround, warnings: [...st.warnings], cam: this.camMode, assist: this.env.assist, cls: spec.cls,
      aircraft: spec.name, windDir: (this.windDir * 180) / Math.PI, windSpeed: this.weather.wind, hour: this.hour, weather: WEATHER_LABEL[this.weatherId],
      mission: mh, ils: this.computeIls(), target, enemies,
      lock: this.lock ? { dist: this.lock.pos.distanceTo(st.pos) } : null,
      ammo: spec.cls === 'fighter' ? { gun: this.gun.ammo, missiles: this.gun.missiles } : null,
      stats: { ...this.stats }, inCloud: this.inCloud, flash: this.flash, blackout: this.blackout, rain: this.weather.rain, vne: spec.vne, vApp: spec.vApp, vRef: spec.vRef,
      servicing: this.servicing, rpm: st.rpm, landingLight: this.landingLight, turb: this.env.turbulence, fighter: spec.cls === 'fighter', heli,
      nav: { dist: nav.dist, icao: nav.ap.icao, bearing }, stallSpeed,
    };
  }

  getMapState(): MapState {
    const st = this.st;
    const r = this.runner;
    return {
      x: st.pos.x, z: st.pos.z, heading: headingOf(st.quat),
      waypoints: r ? r.waypoints : [],
      enemies: r ? r.targets.filter((t) => t.alive).map((t) => ({ x: t.pos.x, z: t.pos.z })) : [],
      target: r && r.hud.target ? { x: r.hud.target.x, z: r.hud.target.z } : null,
    };
  }

  /** Low-resolution world map (±22 km) rendered once. */
  worldMap(): HTMLCanvasElement {
    if (this.mapCanvas) return this.mapCanvas;
    const S = 440;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(S, S);
    const ext = 22000;
    const hs = new Float32Array(S * S);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) hs[j * S + i] = terrainHeight((i / S) * 2 * ext - ext, (j / S) * 2 * ext - ext);
    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        const h = hs[j * S + i];
        const x = (i / S) * 2 * ext - ext;
        const z = (j / S) * 2 * ext - ext;
        const hl = hs[j * S + Math.max(0, i - 1)];
        const hr = hs[j * S + Math.min(S - 1, i + 1)];
        const sh = clamp(1 + (hl - hr) * 0.004, 0.65, 1.3);
        let r: number, g: number, b: number;
        if (h < 0) { const t = clamp(-h / 120, 0, 1); r = 22 - 12 * t; g = 110 - 60 * t; b = 150 - 60 * t; } else if (h < 3) { r = 214; g = 200; b = 150; } else if (desertAmount(x, z) > 0.45) { r = 214; g = 180; b = 118; } else if (h > 1700) { r = 235; g = 238; b = 242; } else if (h > 700) { r = 130; g = 124; b = 114; } else { const t = clamp(h / 400, 0, 1); r = 92 - 30 * t; g = 142 - 30 * t; b = 70 - 18 * t; }
        const k = (j * S + i) * 4;
        img.data[k] = clamp(r * sh, 0, 255); img.data[k + 1] = clamp(g * sh, 0, 255); img.data[k + 2] = clamp(b * sh, 0, 255); img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    this.mapCanvas = c;
    return c;
  }

  getSpecLabel() { return AIRCRAFT_CLASS_LABEL[this.spec.cls]; }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('wheel', this.onWheel);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.audio.dispose();
    this.renderer.dispose();
  }
}
