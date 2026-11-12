import * as THREE from 'three';
import { audio } from '../audio';
import { COURT, COURTS, FX_COLORS, TRAIL_COLORS, courtById, defaultLook, type CourtId, type MatchConfig, type PlayerSpec } from '../constants';
import { input } from '../input';
import { Player, Sim, dirZ, sideZ, type SimEvent } from '../sim';
import { getData, type Profile, type Settings } from '../store';
import { Character } from './character';
import { buildCourt, type CourtScene } from './courts';
import { Flashes, Particles, Ripples, radialTexture } from './fx';

type ViewMode = 'menu' | 'garage' | 'match';
interface VP {
  cam: THREE.PerspectiveCamera;
  player: Player | null;
  ctrl: number;
  camMode: number;
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fovKick: number;
  ring: THREE.Sprite;
  ringTarget: THREE.Sprite;
  marker: THREE.Mesh;
  rect: { x: number; y: number; w: number; h: number };
}
const CAMS = [
  { dist: 7.2, h: 3.9, ahead: 12, fov: 58 },
  { dist: 11.5, h: 8.5, ahead: 6, fov: 55 },
  { dist: 4.6, h: 2.5, ahead: 14, fov: 64 },
];
export const CAM_NAMES = ['Standard', 'High', 'Close'];
const SPECIAL_COLORS: Record<string, number> = {
  'PERFECT POWER SERVE': 0xffa030,
  'PERFECT TOPSPIN': 0xff4fd8,
  'PERFECT CROSS-COURT': 0x4dd8ff,
  'PERFECT DROP SHOT': 0xb0ff6a,
  'PERFECT SMASH': 0xff3b3b,
  'PERFECT LOB': 0xffe27a,
  'SUPER RALLY SHOT': 0xff7a1a,
};
const GRADE_COLORS = [0xff5a5a, 0xffd23f, 0x6aff8a, 0x5af0ff];
const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

export class GameView {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  private container: HTMLElement;
  private curtain: HTMLDivElement;
  private hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  private sun = new THREE.DirectionalLight(0xffffff, 1);
  private court: CourtScene | null = null;
  courtId: CourtId = 'neon';
  sim: Sim | null = null;
  mode: ViewMode = 'menu';
  paused = false;
  settings: Settings = getData().settings;
  onEvent: ((e: SimEvent) => void) | null = null;
  onPause: (() => void) | null = null;
  onLayout: ((rects: VP['rect'][]) => void) | null = null;
  fps = 60;
  private vps: VP[] = [];
  private chars = new Map<number, Character>();
  private fx = new Particles(1800);
  private flashes = new Flashes(16);
  private ripples = new Ripples(10);
  private ball: THREE.Mesh;
  private ballShadow: THREE.Mesh;
  private ballAxis = new THREE.Vector3();
  private trailColor = 0xe8ffd0;
  private trailBig = false;
  private trailRainbow = false;
  private targetObjs: THREE.Group[] = [];
  private raf = 0;
  private last = performance.now();
  private t = 0;
  private timeScale = 1;
  private slowT = 0;
  private shake = 0;
  private excite = 0;
  private pixelRatio = 1;
  private maxPR = 1.5;
  private frameAcc = 0;
  private frameN = 0;
  private lowT = 0;
  private highT = 0;
  private demoOver = 0;
  private ceremony: { t: number; winner: number; trophy: THREE.Group | null; fw: number; active: boolean } = { t: 0, winner: -1, trophy: null, fw: 0, active: false };
  private garage: { char: Character; p: Player; look: Profile['look']; t: number; name: string } | null = null;
  private resizeObs: ResizeObserver;
  private layoutKey = '';
  private disposed = false;
  private demoLevel = 3;

  constructor(container: HTMLElement) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none';
    container.appendChild(this.canvas);
    this.curtain = document.createElement('div');
    this.curtain.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .28s ease;background:#000;z-index:2';
    container.appendChild(this.curtain);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.autoClear = true;
    this.applyQuality();

    // lights
    this.sun.castShadow = true;
    this.sun.position.set(26, 48, 18);
    this.sun.target.position.set(0, 0, 0);
    const sc = this.sun.shadow.camera;
    sc.left = -20;
    sc.right = 20;
    sc.top = 30;
    sc.bottom = -30;
    sc.near = 5;
    sc.far = 120;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.hemi, this.sun, this.sun.target);

    // ball
    const seam = document.createElement('canvas');
    seam.width = 128;
    seam.height = 64;
    const g = seam.getContext('2d')!;
    g.fillStyle = '#d6ff3a';
    g.fillRect(0, 0, 128, 64);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(0, 14);
    g.bezierCurveTo(40, 40, 80, -10, 128, 20);
    g.moveTo(0, 50);
    g.bezierCurveTo(40, 76, 80, 26, 128, 56);
    g.stroke();
    const seamTex = new THREE.CanvasTexture(seam);
    seamTex.colorSpace = THREE.SRGBColorSpace;
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), new THREE.MeshStandardMaterial({ map: seamTex, roughness: 0.6, emissive: 0x6a8a10, emissiveIntensity: 0.35 }));
    this.ball.castShadow = true;
    this.scene.add(this.ball);
    this.ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.ballShadow);
    this.scene.add(this.fx.points, this.flashes.group, this.ripples.group);

    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const mk = (a: number, b: number, o: number) => new THREE.Mesh(new THREE.RingGeometry(a, b, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xc6ff3a, transparent: true, opacity: o, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      g.add(mk(0.92, 1, 0.95), mk(0.55, 0.62, 0.7), mk(0.0, 0.2, 0.9));
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xc6ff3a, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
      g.add(disc);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x4de1ff, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
      beam.position.y = 2;
      beam.name = 'beam';
      g.add(beam);
      g.position.y = 0.05;
      g.visible = false;
      this.scene.add(g);
      this.targetObjs.push(g);
    }
    this.setCourt('neon', false);
    this.startDemo();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  // ------------------------------------------------------------------ setup
  applyQuality() {
    const q = this.settings.quality;
    const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.matchMedia('(pointer: coarse)').matches;
    const dpr = window.devicePixelRatio || 1;
    this.maxPR = q === 'low' ? 1 : q === 'medium' ? Math.min(dpr, 1.5) : q === 'high' ? Math.min(dpr, 2) : Math.min(dpr, mobile ? 1.25 : 1.75);
    this.pixelRatio = Math.min(this.maxPR, q === 'auto' ? this.maxPR : this.maxPR);
    this.renderer.setPixelRatio(this.pixelRatio);
    const size = q === 'low' ? 512 : q === 'medium' ? 1024 : 2048;
    this.sun.shadow.mapSize.set(mobile && q === 'auto' ? 1024 : size, mobile && q === 'auto' ? 1024 : size);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
    this.renderer.shadowMap.enabled = q !== 'low';
    this.resize();
  }
  private qualityLevel() {
    const q = this.settings.quality;
    return q === 'low' ? 0 : q === 'medium' ? 1 : q === 'high' ? 2 : 1;
  }

  setCourt(id: CourtId, animate = true) {
    if (!animate || !this.court) {
      this.swapCourt(id);
      return;
    }
    if (id === this.courtId) return;
    const th = courtById(id);
    this.curtain.style.background = '#' + th.accent.toString(16).padStart(6, '0');
    this.curtain.style.opacity = '1';
    window.setTimeout(() => {
      if (this.disposed) return;
      this.swapCourt(id);
      this.curtain.style.opacity = '0';
    }, 300);
  }
  private swapCourt(id: CourtId) {
    const th = courtById(id);
    if (this.court) {
      this.scene.remove(this.court.group);
      this.court.dispose();
    }
    this.courtId = id;
    this.court = buildCourt(th, this.qualityLevel());
    this.scene.add(this.court.group);
    this.scene.fog = new THREE.FogExp2(th.fog, th.fogDensity);
    this.hemi.color.setHex(th.hemiSky);
    this.hemi.groundColor.setHex(th.hemiGround);
    this.hemi.intensity = th.night ? 1.0 : 1.15;
    this.sun.color.setHex(th.sun);
    this.sun.intensity = th.sunIntensity;
    if (th.id === 'sunset') this.sun.position.set(-20, 26, -40);
    else this.sun.position.set(26, 48, 18);
    this.scene.background = new THREE.Color(th.skyBottom);
    this.renderer.shadowMap.needsUpdate = true;
  }

  private makeChars(sim: Sim) {
    for (const c of this.chars.values()) c.dispose();
    this.chars.clear();
    for (const p of sim.players) {
      const tagColor = p.team === 0 ? 0x5ac8ff : 0xff7a5a;
      const c = new Character(p.spec.look, p.spec.human >= 0 ? p.spec.name : '', tagColor, p.spec.human >= 0 && sim.cfg.mode !== 'demo');
      this.scene.add(c.root);
      this.chars.set(p.id, c);
    }
  }

  startDemo() {
    const mk = (n: string, lvl: number, i: number): PlayerSpec => ({ name: n, human: -1, level: lvl, personality: i % 2 ? 'aggressive' : 'balanced', look: defaultLook(i + 2) });
    const cfg: MatchConfig = {
      mode: 'demo',
      doubles: false,
      courtId: this.courtId,
      rules: { setsToWin: 1, games: 3, tiebreak: true, noAd: true, pace: 1 },
      teams: [[mk('Alex', this.demoLevel, 0)], [mk('Sam', this.demoLevel, 1)]],
      label: 'demo',
      multiplier: 1,
    };
    this.setSim(new Sim(cfg), 'menu');
  }

  startMatch(cfg: MatchConfig) {
    if (cfg.courtId !== this.courtId) this.swapCourt(cfg.courtId);
    input.clearEdges();
    this.setSim(new Sim(cfg), 'match');
    audio.startCrowd();
    audio.startMusic('match');
  }

  private setSim(sim: Sim, mode: ViewMode) {
    this.sim = sim;
    this.mode = mode;
    this.paused = false;
    this.ceremony.active = false;
    this.clearTrophy();
    this.timeScale = 1;
    this.slowT = 0;
    this.makeChars(sim);
    this.rebuildViewports();
    this.demoOver = 0;
    this.garage?.char.root.removeFromParent();
    this.garage = null;
  }

  restart() {
    if (this.sim && this.mode === 'match') this.startMatch(this.sim.cfg);
  }
  leaveMatch() {
    this.startDemo();
    audio.startMusic('menu');
  }

  setGarage(name: string, look: Profile['look']) {
    if (this.mode !== 'garage') {
      this.mode = 'garage';
      this.sim = null;
      for (const c of this.chars.values()) c.dispose();
      this.chars.clear();
      const spec: PlayerSpec = { name, human: 0, level: 1, personality: 'balanced', look };
      const p = new Player(99, 0, 0, spec);
      const char = new Character(look, name, 0x5ac8ff, false);
      this.scene.add(char.root);
      this.garage = { char, p, look, t: 0, name };
      p.x = 0;
      p.z = -9;
      p.yaw = 0;
      this.vps = [];
      this.rebuildViewports();
    }
    if (this.garage) {
      this.garage.look = look;
      this.garage.char.setLook(look);
    }
  }
  exitGarage() {
    if (this.mode === 'garage') {
      this.garage?.char.dispose();
      this.garage = null;
      this.startDemo();
    }
  }
  garageSwing() {
    if (this.garage) {
      this.garage.p.swing = { t: 0, key: 1, special: false, resolved: true, kind: 'fh', dur: 0.5 };
      const c = this.garage.char;
      c.flash(FX_COLORS[this.garage.look.racketFx], 1);
      const p = this.garage.p;
      this.fx.burst(p.x - 0.8, 1.1, p.z + 0.4, 18, 4, 0.6, 0.18, FX_COLORS[this.garage.look.racketFx]);
    }
  }

  private rebuildViewports() {
    for (const v of this.vps) {
      this.scene.remove(v.ring, v.ringTarget, v.marker);
    }
    this.vps = [];
    const sim = this.sim;
    const humans = sim && this.mode === 'match' ? sim.humans().sort((a, b) => a.spec.human - b.spec.human) : [];
    const n = Math.max(1, humans.length);
    for (let i = 0; i < n; i++) {
      const cam = new THREE.PerspectiveCamera(58, 1, 0.1, 700);
      cam.layers.enable(1 + i);
      const ringTex = radialTexture(0, false);
      const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
      ring.layers.set(1 + i);
      ring.renderOrder = 20;
      ring.visible = false;
      const ringTarget = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, transparent: true, depthTest: false, depthWrite: false, color: 0xffffff, opacity: 0.8 }));
      ringTarget.layers.set(1 + i);
      ringTarget.renderOrder = 21;
      ringTarget.visible = false;
      const marker = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      marker.rotation.x = -Math.PI / 2;
      marker.layers.set(1 + i);
      marker.visible = false;
      this.scene.add(ring, ringTarget, marker);
      const player = humans[i] ?? null;
      const vp: VP = { cam, player, ctrl: player ? player.spec.human : 0, camMode: 0, pos: new THREE.Vector3(0, 6, 22), look: new THREE.Vector3(0, 1, 0), fovKick: 0, ring, ringTarget, marker, rect: { x: 0, y: 0, w: 1, h: 1 } };
      if (player) {
        const preset = CAMS[0];
        vp.pos.set(player.x * 0.85, preset.h, player.z + sideZ(player.team) * preset.dist);
        vp.look.set(player.x * 0.45, 0.9, player.z + dirZ(player.team) * preset.ahead);
      }
      this.vps.push(vp);
    }
    this.layoutKey = '';
    this.resize();
  }

  // ------------------------------------------------------------------ sizing
  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    const n = this.vps.length;
    const landscape = w >= h * 1.05;
    const gap = 3;
    this.vps.forEach((v, i) => {
      if (n === 1) v.rect = { x: 0, y: 0, w, h };
      else if (landscape) {
        const hw = Math.floor((w - gap) / 2);
        v.rect = { x: i * (hw + gap), y: 0, w: hw, h };
      } else {
        const hh = Math.floor((h - gap) / 2);
        v.rect = { x: 0, y: i * (hh + gap), w, h: hh };
      }
      v.cam.aspect = v.rect.w / v.rect.h;
      v.cam.updateProjectionMatrix();
    });
    const key = this.vps.map((v) => Object.values(v.rect).join(',')).join('|');
    if (key !== this.layoutKey) {
      this.layoutKey = key;
      this.onLayout?.(this.vps.map((v) => ({ ...v.rect })));
    }
  }
  getRects() {
    return this.vps.map((v) => ({ ...v.rect }));
  }
  getCamMode(i: number) {
    return this.vps[i]?.camMode ?? 0;
  }

  // ------------------------------------------------------------------ loop
  private loop(now: number) {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    this.fpsTrack(dt);
    this.t += dt;
    if (input.consumePause() && this.mode === 'match' && this.sim && this.sim.phase !== 'over') this.onPause?.();
    const sim = this.sim;
    if (sim && !this.paused) {
      // slow motion easing
      this.slowT = Math.max(0, this.slowT - dt);
      const target = this.slowT > 0 ? 0.3 : 1;
      this.timeScale += (target - this.timeScale) * damp(this.slowT > 0 ? 18 : 6, dt);
      if (this.mode === 'match') this.pollInputs(sim);
      sim.update(dt * this.timeScale);
      this.handleEvents(sim, dt);
      if (this.mode === 'menu' && sim.phase === 'over') {
        this.demoOver += dt;
        if (this.demoOver > 2.5) this.startDemo();
      }
      if (this.mode === 'match' && sim.phase === 'over' && !this.ceremony.active) this.startCeremony(sim);
    }
    if (!this.paused || this.mode !== 'match') this.visuals(dt);
    this.render(dt);
  }

  private fpsTrack(dt: number) {
    this.frameAcc += dt;
    this.frameN++;
    if (this.frameAcc >= 1) {
      this.fps = this.frameN / this.frameAcc;
      const avg = this.frameAcc / this.frameN;
      this.frameAcc = 0;
      this.frameN = 0;
      if (this.settings.quality === 'auto') {
        if (avg > 0.021) {
          this.lowT++;
          this.highT = 0;
        } else if (avg < 0.0135) {
          this.highT++;
          this.lowT = 0;
        } else this.lowT = this.highT = 0;
        if (this.lowT >= 2 && this.pixelRatio > 0.7) {
          this.pixelRatio = Math.max(0.7, this.pixelRatio - 0.15);
          this.lowT = 0;
          this.resize();
        } else if (this.highT >= 5 && this.pixelRatio < this.maxPR) {
          this.pixelRatio = Math.min(this.maxPR, this.pixelRatio + 0.15);
          this.highT = 0;
          this.resize();
        }
      }
    }
  }

  private pollInputs(sim: Sim) {
    const humans = sim.humans();
    const merged = humans.length === 1;
    for (const p of humans) {
      const pi = input.poll((p.spec.human === 1 ? 1 : 0) as 0 | 1, merged);
      p.input.mx = pi.mx;
      p.input.mz = pi.mz;
      p.input.sprint = pi.sprint;
      if (pi.shot) p.input.shot = pi.shot;
      if (pi.special) p.input.special = true;
      if (pi.camera) {
        const vp = this.vps.find((v) => v.player === p) ?? this.vps[0];
        if (vp) vp.camMode = (vp.camMode + 1) % CAMS.length;
      }
    }
  }

  // ------------------------------------------------------------------ events -> effects
  private handleEvents(sim: Sim, _dt: number) {
    void _dt;
    const events = sim.events;
    if (!events.length) return;
    const st = this.settings;
    const shakeOn = st.shake;
    for (const e of events) {
      switch (e.type) {
        case 'hit': {
          const p = e.p;
          const look = p?.spec.look;
          const fxCol = look ? FX_COLORS[look.racketFx] : 0xffffff;
          const grade = e.grade ?? 1;
          const sp = e.special ?? null;
          const col = sp ? (SPECIAL_COLORS[sp] ?? 0xffd23f) : grade === 3 ? 0xffd23f : fxCol;
          if (e.label === 'machine') {
            this.fx.burst(e.x!, e.y!, e.z!, 10, 3, 0.4, 0.14, 0xcccccc, 2);
            break;
          }
          this.trailBig = !!sp;
          this.trailRainbow = false;
          if (sp) this.trailColor = col;
          else if (look) {
            if (look.trail === 4) this.trailRainbow = true;
            this.trailColor = TRAIL_COLORS[look.trail] ?? 0xe8ffd0;
          }
          const n = [4, 8, 14, 30][grade] + (sp ? 20 : 0);
          this.fx.burst(e.x!, e.y!, e.z!, n, 3.5 + grade * 1.6, 0.55, 0.14 + grade * 0.04, grade === 3 || sp ? col : fxCol === 0xffffff ? 0xfff3b0 : fxCol, 8);
          this.flashes.spawn(e.x!, e.y!, e.z!, 0.5 + grade * 0.25, grade === 3 ? 0xfff0a0 : 0xffffff, 0.22, false, 1.6);
          if (grade >= 2) this.flashes.spawn(e.x!, e.y!, e.z!, 0.4, col, 0.35, true, 5 + grade);
          if (p) this.chars.get(p.id)?.flash(col, grade === 3 ? 1 : 0.55);
          if (sp) {
            this.fx.burst(e.x!, e.y!, e.z!, 24, 8, 0.9, 0.2, col, 2);
            audio.special();
            this.excite = Math.max(this.excite, 0.8);
          }
          audio.hit(grade, !!sp, e.mode === 'serve');
          if (shakeOn) {
            const mine = this.vps.some((v) => v.player === p);
            this.shake = Math.max(this.shake, (mine ? 0.12 : 0.04) + grade * 0.05 + (sp ? 0.25 : 0));
          }
          const vp = this.vps.find((v) => v.player === p);
          if (vp) vp.fovKick = Math.min(vp.fovKick + (sp ? 4 : grade >= 2 ? 1.6 : 0.8), 6);
          if (st.slowmo && sp) {
            if (sp === 'PERFECT SMASH' || sp === 'SUPER RALLY SHOT') {
              this.slowT = 0.5;
              this.vps.forEach((v) => (v.fovKick = -5));
            } else this.slowT = Math.max(this.slowT, 0.22);
          }
          break;
        }
        case 'whiff':
          audio.whoosh();
          break;
        case 'bounce': {
          const s = e.surface!;
          const imp = e.impact ?? 5;
          this.fx.burst(e.x!, 0.08, e.z!, Math.min(12, 3 + imp * 0.5), 1 + imp * 0.12, 0.45, 0.2, s.dust, 4);
          this.ripples.spawn(e.x!, e.z!, 0.5 + imp * 0.04, e.inBounds ? 0xffffff : 0xff6a6a, 0.4);
          if (imp > 3) audio.bounce(imp, courtById(this.courtId).surface);
          break;
        }
        case 'net':
          audio.net(!!e.big);
          if (this.court) this.court.net.rotation.x = e.big ? 0.12 : 0.05;
          this.fx.burst(e.x ?? 0, e.y ?? 1, 0, e.big ? 14 : 6, 2, 0.5, 0.12, 0xffffff, 3);
          if (shakeOn) this.shake = Math.max(this.shake, 0.12);
          break;
        case 'toss':
          audio.toss();
          break;
        case 'tossmiss':
          break;
        case 'fault':
          audio.fault();
          if (shakeOn) this.shake = Math.max(this.shake, 0.1);
          audio.oh();
          break;
        case 'let':
          audio.fault();
          break;
        case 'point': {
          const mine = this.sim!.humans().some((h) => h.team === e.team);
          audio.point(mine || this.sim!.humans().length === 0);
          this.excite = 1;
          if (e.big && this.mode === 'match') {
            for (let i = 0; i < 40; i++) this.fx.emit((Math.random() - 0.5) * 10, 8 + Math.random() * 3, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 2, -2 - Math.random() * 2, (Math.random() - 0.5) * 2, 3, 0.14, [0xff4d6d, 0x3a86ff, 0xffbe0b, 0x2ec4b6, 0xffffff][i % 5], 0);
          }
          break;
        }
        case 'call':
          if (this.mode === 'match') audio.speak(e.text ?? '');
          break;
        default:
          break;
      }
      this.onEvent?.(e);
    }
    events.length = 0;
  }

  // ------------------------------------------------------------------ ceremony
  private clearTrophy() {
    if (this.ceremony.trophy) {
      this.scene.remove(this.ceremony.trophy);
      this.ceremony.trophy = null;
    }
  }
  private startCeremony(sim: Sim) {
    const winner = sim.playerWinner;
    this.ceremony = { t: 0, winner, trophy: null, fw: 0, active: true };
    const human = sim.humans().some((h) => h.team === winner);
    if (sim.humans().length === 0 || human) audio.victory();
    else audio.defeat();
    if (!sim.isDrill) {
      const g = new THREE.Group();
      const gold = new THREE.MeshStandardMaterial({ color: 0xffd23f, metalness: 0.95, roughness: 0.22, emissive: 0x6a4a00, emissiveIntensity: 0.5 });
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.38, 1.1, 20, 1, true), gold);
      cup.position.y = 1.9;
      cup.material.side = THREE.DoubleSide;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.8, 12), gold);
      stem.position.y = 1.15;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.3, 16), gold);
      base.position.y = 0.55;
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 1.6), new THREE.MeshStandardMaterial({ color: 0x222844, roughness: 0.4, metalness: 0.4 }));
      plinth.position.y = 0.22;
      g.add(cup, stem, base, plinth);
      for (const sx of [-1, 1]) {
        const h = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 8, 16, Math.PI), gold);
        h.position.set(sx * 0.82, 2.0, 0);
        h.rotation.z = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
        g.add(h);
      }
      g.position.set(0, 0, sideZ(winner) * 7);
      g.scale.setScalar(0.01);
      g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
      this.scene.add(g);
      this.ceremony.trophy = g;
    }
    this.excite = 1;
  }

  // ------------------------------------------------------------------ per-frame visuals
  private visuals(dt: number) {
    const sim = this.sim;
    const t = this.t;
    this.excite = Math.max(0, this.excite - dt * 0.35);
    this.court?.update(t, dt, this.excite);
    this.shake = Math.max(0, this.shake - dt * 1.6);
    const sdt = dt * (this.mode === 'match' ? this.timeScale : 1);
    this.fx.update(sdt);
    this.flashes.update(sdt);
    this.ripples.update(sdt);

    if (this.mode === 'garage' && this.garage) {
      const gg = this.garage;
      gg.t += dt;
      const p = gg.p;
      if (!p.swing && Math.floor(gg.t * 0.45) !== Math.floor((gg.t - dt) * 0.45)) this.garageSwing();
      if (p.swing) {
        p.swing.t += dt;
        if (p.swing.t > p.swing.dur) p.swing = null;
      }
      gg.char.update(p, dt, t, p.x, p.z + 5, gg.look);
      this.ball.visible = false;
      this.ballShadow.visible = false;
      return;
    }
    if (!sim) return;
    // characters
    const b = sim.ball;
    for (const p of sim.players) {
      const c = this.chars.get(p.id);
      c?.update(p, sdt, t, b.x, b.z, p.spec.look);
    }
    // ball
    const d = sim.drill;
    const visible = !(d && ((d.type === 'movement') || (!d.live && d.type !== 'serve' && b.held)));
    this.ball.visible = visible;
    this.ballShadow.visible = visible;
    if (visible) {
      this.ball.position.set(b.x, b.y, b.z);
      const hs = Math.hypot(b.vx, b.vz);
      if (hs > 0.5) {
        this.ballAxis.set(b.vz, 0, -b.vx).normalize();
        this.ball.rotateOnWorldAxis(this.ballAxis, (b.spin * 14 + hs * 0.5) * sdt);
      }
      this.ballShadow.position.set(b.x, 0.03, b.z);
      const sc = 1 / (1 + b.y * 0.18);
      this.ballShadow.scale.setScalar(sc * 1.1);
      (this.ballShadow.material as THREE.MeshBasicMaterial).opacity = 0.42 * sc;
      // trail + spin visualisation
      const sp = Math.hypot(b.vx, b.vy, b.vz);
      if (!b.held && sp > 7 && sdt > 0) {
        const n = this.trailBig ? 3 : 2;
        const c = this.trailRainbow ? new THREE.Color().setHSL((t * 0.8) % 1, 1, 0.6).getHex() : this.trailColor;
        for (let i = 0; i < n; i++) {
          const f = i / n;
          this.fx.emit(b.x - b.vx * sdt * f, b.y - b.vy * sdt * f, b.z - b.vz * sdt * f, 0, 0, 0, this.trailBig ? 0.55 : 0.32, this.trailBig ? 0.3 : 0.17, c, 0, this.trailBig ? 1 : 0.7);
        }
        if (Math.abs(b.spin) > 1.2) {
          const a = t * 26;
          const ox = Math.cos(a) * 0.26;
          const oy = Math.sin(a) * 0.26;
          const nx = b.vz / (hs + 0.001);
          const nz = -b.vx / (hs + 0.001);
          this.fx.emit(b.x + nx * ox, b.y + oy, b.z + nz * ox, 0, 0, 0, 0.25, 0.1, b.spin > 0 ? 0xff7a3a : 0x6ab8ff, 0, 0.9);
        }
      }
    }
    // drill targets
    const dr = sim.drill;
    this.targetObjs.forEach((g, i) => {
      const tg = dr && dr.type !== 'free' && dr.type !== 'perfect' ? dr.targets[i] : undefined;
      g.visible = !!tg;
      if (!tg) return;
      const pulse = 1 + Math.sin(t * 5 + i) * 0.04;
      g.position.set(tg.x, 0.05, tg.z);
      g.scale.set(tg.r * pulse, 1, tg.r * pulse);
      g.rotation.y = t * 0.5;
      const col = dr!.type === 'movement' ? 0x4de1ff : dr!.type === 'serve' ? 0xffd23f : 0xc6ff3a;
      g.children.forEach((c) => {
        const m = c as THREE.Mesh;
        if (m.name !== 'beam') (m.material as THREE.MeshBasicMaterial).color.setHex(col);
      });
      const beam = g.getObjectByName('beam');
      if (beam) beam.visible = dr!.type === 'movement';
    });
    // viewports: cameras, rings and landing marker
    this.vps.forEach((v) => this.updateCamera(v, dt));
    this.vps.forEach((v) => this.updateAids(v));
    if (this.mode === 'match') this.ceremonyUpdate(dt);
  }

  private updateAids(v: VP) {
    const sim = this.sim!;
    const p = v.player;
    const b = sim.ball;
    v.ring.visible = false;
    v.ringTarget.visible = false;
    v.marker.visible = false;
    if (!p || sim.phase === 'over' || sim.phase === 'point') return;
    const tm = p.timing;
    if (tm.active) {
      const s = 0.3 + tm.ring * 1.3;
      v.ring.visible = true;
      v.ring.position.set(b.x, b.y, b.z);
      v.ring.scale.set(s, s, 1);
      const col = GRADE_COLORS[tm.grade];
      (v.ring.material as THREE.SpriteMaterial).color.setHex(col);
      (v.ring.material as THREE.SpriteMaterial).opacity = 0.9;
      v.ringTarget.visible = true;
      v.ringTarget.position.copy(v.ring.position);
      v.ringTarget.scale.set(0.34, 0.34, 1);
    }
    if (sim.phase === 'rally' && b.lastTeam !== p.team && b.bounces === 0 && !b.held) {
      const s = sim.pred.find((q) => q.bounces >= 1);
      if (s && s.z * sideZ(p.team) > 0 && Math.abs(s.x) < 9) {
        v.marker.visible = true;
        v.marker.position.set(s.x, 0.04, s.z);
        const pulse = 1 + Math.sin(this.t * 10) * 0.12;
        v.marker.scale.setScalar(pulse);
        (v.marker.material as THREE.MeshBasicMaterial).opacity = 0.55;
      }
    }
  }

  private updateCamera(v: VP, dt: number) {
    const sim = this.sim;
    const cam = v.cam;
    const st = this.settings;
    const sens = st.camSens;
    if (this.ceremony.active && sim) {
      const c = this.ceremony;
      const tp = new THREE.Vector3(0, 1.6, sideZ(c.winner) * 7);
      const a = c.t * 0.35 + (c.winner === 0 ? 0 : Math.PI);
      const r = c.trophy ? 8.5 : 12;
      v.pos.lerp(new THREE.Vector3(tp.x + Math.sin(a) * r, 3 + Math.sin(c.t * 0.5) * 0.8, tp.z + Math.cos(a) * r), damp(2, dt));
      v.look.lerp(tp, damp(4, dt));
      cam.position.copy(v.pos);
      cam.lookAt(v.look);
      cam.fov += (50 - cam.fov) * damp(3, dt);
      cam.updateProjectionMatrix();
      return;
    }
    if (this.mode === 'menu' || !v.player || !sim) {
      const a = this.t * 0.09;
      const r = 27 + Math.sin(this.t * 0.2) * 3;
      const target = new THREE.Vector3(Math.sin(a) * r * 0.6, 7 + Math.sin(this.t * 0.31) * 2.5, Math.cos(a) * r);
      v.pos.lerp(target, damp(1.5, dt));
      cam.position.copy(v.pos);
      const ball = sim?.ball;
      v.look.lerp(new THREE.Vector3(ball ? ball.x * 0.3 : 0, 1.2, ball ? ball.z * 0.2 : 0), damp(2, dt));
      cam.lookAt(v.look);
      cam.fov = 52;
      cam.updateProjectionMatrix();
      return;
    }
    const p = v.player;
    const preset = CAMS[v.camMode];
    const sz = sideZ(p.team);
    const dz = dirZ(p.team);
    const b = sim.ball;
    const zl = COURT.halfLen + 9.8;
    const dx = p.x * 0.85;
    const dyy = preset.h + p.y * 0.35;
    const dzz = Math.max(-zl, Math.min(zl, p.z + sz * preset.dist));
    const rate = 2.2 + 2.6 * sens;
    const k = damp(rate, dt);
    v.pos.x += (dx - v.pos.x) * k;
    v.pos.y += (dyy - v.pos.y) * k;
    v.pos.z += (dzz - v.pos.z) * k;
    // look target: ahead of the player, assisted toward the ball
    let lx = p.x * 0.45;
    let ly = 0.9;
    let lz = p.z + dz * preset.ahead;
    const ballOk = !b.held && sim.phase !== 'point' && (b.z - v.pos.z) * dz > 3;
    if (ballOk) {
      const w = 0.32 * sens;
      lx += (b.x * 0.8 - lx) * w;
      ly += (Math.max(0.6, b.y * 0.5) - ly) * w;
      lz += (b.z - lz) * w * 0.5;
    }
    const lk = damp(5 + 2 * sens, dt);
    v.look.x += (lx - v.look.x) * lk;
    v.look.y += (ly - v.look.y) * lk;
    v.look.z += (lz - v.look.z) * lk;
    cam.position.copy(v.pos);
    if (this.shake > 0) {
      const s = this.shake * 0.08;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
    }
    cam.lookAt(v.look);
    v.fovKick += (0 - v.fovKick) * damp(6, dt);
    const fov = preset.fov + (p.sprinting ? 3 : 0) + v.fovKick;
    cam.fov += (fov - cam.fov) * damp(8, dt);
    cam.updateProjectionMatrix();
  }

  private ceremonyUpdate(dt: number) {
    const c = this.ceremony;
    if (!c.active) return;
    c.t += dt;
    if (c.trophy) {
      const s = Math.min(1, c.t / 1.2);
      const e = 1 - Math.pow(1 - s, 3);
      c.trophy.scale.setScalar(Math.max(0.01, e));
      c.trophy.rotation.y = c.t * 0.9;
      c.trophy.position.y = (1 - e) * -1.5;
      if (Math.random() < 0.6) this.fx.emit(c.trophy.position.x + (Math.random() - 0.5), 2.5 + Math.random(), c.trophy.position.z + (Math.random() - 0.5), 0, 0.6, 0, 0.8, 0.14, 0xffe27a, 0);
    }
    c.fw -= dt;
    if (c.fw <= 0) {
      c.fw = 0.45 + Math.random() * 0.4;
      const col = [0xff4d6d, 0x3a86ff, 0xffbe0b, 0x2ec4b6, 0xff7bf0, 0x80ed99][Math.floor(Math.random() * 6)];
      const x = (Math.random() - 0.5) * 36;
      const z = (Math.random() - 0.5) * 40;
      this.fx.burst(x, 14 + Math.random() * 10, z, 60, 9, 1.8, 0.4, col, 3.5);
      if (c.t > 0.4) audio.cheer(0.5);
    }
    for (let i = 0; i < 3; i++) {
      this.fx.emit((Math.random() - 0.5) * 24, 14, (Math.random() - 0.5) * 26, (Math.random() - 0.5) * 2, -2.5 - Math.random() * 2, (Math.random() - 0.5) * 2, 4, 0.16, [0xff4d6d, 0x3a86ff, 0xffbe0b, 0x2ec4b6, 0xffffff][Math.floor(Math.random() * 5)], 0);
    }
  }

  // ------------------------------------------------------------------ render
  private render(_dt: number) {
    void _dt;
    const r = this.renderer;
    const cssH = this.container.clientHeight || window.innerHeight;
    r.setScissorTest(true);
    r.shadowMap.needsUpdate = true;
    if (this.mode === 'garage' && this.garage) {
      if (!this.vps.length) this.rebuildViewports();
      const v = this.vps[0];
      if (v) {
        const gg = this.garage;
        const a = Math.sin(gg.t * 0.5) * 0.7 + 0.35;
        const tx = gg.p.x;
        const tz = gg.p.z;
        const wide = this.container.clientWidth > 700 ? 1 : 0;
        v.cam.position.set(tx + Math.sin(a) * 5.4 - wide * 0.4, 1.6, tz + Math.cos(a) * 5.4);
        v.cam.lookAt(tx - wide * 1.5, 1.05, tz);
        v.cam.fov = 40;
        v.cam.updateProjectionMatrix();
      }
    }
    const pr = this.pixelRatio;
    this.vps.forEach((v) => {
      // three.js multiplies viewport/scissor by the pixel ratio itself -> use CSS pixels
      const x = v.rect.x;
      const y = cssH - (v.rect.y + v.rect.h);
      r.setViewport(x, y, v.rect.w, v.rect.h);
      r.setScissor(x, y, v.rect.w, v.rect.h);
      this.fx.uniforms.scale.value = (v.rect.h * pr) / (2 * Math.tan((v.cam.fov * Math.PI) / 360));
      r.render(this.scene, v.cam);
    });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.court?.dispose();
    this.renderer.dispose();
    this.canvas.remove();
    this.curtain.remove();
  }
}

export { COURTS };
