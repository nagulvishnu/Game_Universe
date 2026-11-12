import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ARENAS, FIGHTERS, type MoveData } from "./data";
import { audio } from "./audio";
import { input, type PlayerInput } from "./input";
import { buildArena, type Arena } from "./arenas";
import { VFX, EL_COLORS, type El, type FxItem } from "./vfx";
import { Fighter } from "./fighter";
import { cancelUlt } from "./ultimates";
import { useHud, type MatchResult, type Mode, type Quality } from "./store";

export interface Projectile {
  owner: Fighter; mv: MoveData; pos: THREE.Vector3; vel: THREE.Vector3; radius: number; el: El; life: number;
  homing: number; group: THREE.Group; mats: THREE.Material[]; dmgMul: number; age: number; scale: number; dead: boolean; spear: boolean;
}
interface Zone {
  owner: Fighter; mv: MoveData; pos: THREE.Vector3; r: number; t: number; life: number; delay: number; tick: number; fx: FxItem[]; bars: FxItem[]; dead: boolean;
}

export interface GameConfig {
  p1: number; p2: number; arena: number; mode: Mode; quality: Quality; shake: number; damageNumbers: boolean; fps: boolean;
  onMatchEnd: (r: MatchResult) => void;
}

const QUALITY = {
  low: { pr: 0.8, shadow: 1024, particles: 2800, msaa: 0, qty: 0.55, bloomScale: 0.5 },
  medium: { pr: 1, shadow: 1024, particles: 4800, msaa: 2, qty: 0.8, bloomScale: 0.6 },
  high: { pr: 1.5, shadow: 2048, particles: 8000, msaa: 4, qty: 1, bloomScale: 0.75 },
  ultra: { pr: 2, shadow: 4096, particles: 13000, msaa: 4, qty: 1.4, bloomScale: 1 },
};

const POST_SHADER = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null }, uAberr: { value: 0 }, uVig: { value: 0.35 }, uBlur: { value: 0 },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) }, uInvert: { value: 0 }, uSat: { value: 1.12 }, uContrast: { value: 1.06 },
    uTint: { value: new THREE.Color(1, 1, 1) },
  },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uAberr, uVig, uBlur, uInvert, uSat, uContrast; uniform vec2 uCenter; uniform vec3 uTint; varying vec2 vUv;
    void main(){
      vec2 dir = vUv - uCenter; vec3 col;
      if (uBlur > 0.001) { vec3 s = vec3(0.0); for (int i = 0; i < 8; i++) { float t = float(i) / 8.0; s += texture2D(tDiffuse, vUv - dir * uBlur * t).rgb; } col = s / 8.0; }
      else col = texture2D(tDiffuse, vUv).rgb;
      if (uAberr > 0.0001) { col.r = texture2D(tDiffuse, vUv + dir * uAberr).r; col.b = texture2D(tDiffuse, vUv - dir * uAberr).b; }
      float l = dot(col, vec3(0.299, 0.587, 0.114)); col = mix(vec3(l), col, uSat);
      col = (col - 0.18) * uContrast + 0.18; col *= uTint;
      float v = smoothstep(0.95, 0.3, length(dir * vec2(1.0, 0.9)));
      col *= mix(1.0 - uVig, 1.0, v);
      col = mix(col, vec3(1.0) - clamp(col, 0.0, 1.0), uInvert);
      gl_FragColor = vec4(max(col, 0.0), 1.0); }`,
};

const sphereGeo = new THREE.SphereGeometry(1, 16, 12);
const coneGeo = new THREE.ConeGeometry(1, 1, 8).translate(0, 0.5, 0).rotateX(Math.PI / 2);

type Phase = "ready" | "intro" | "fight" | "ko" | "roundEnd" | "over";

export class Game {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  post: ShaderPass;
  vfx: VFX;
  arena: Arena;
  fighters: [Fighter, Fighter];
  projectiles: Projectile[] = [];
  zones: Zone[] = [];
  practice = { infHp: false, infKi: false };
  realDt = 0.016;
  time = 0;
  ultsActive = 0;
  timeScale = 1;
  phase: Phase = "ready";
  paused = false;
  private container: HTMLElement;
  private overlay: HTMLDivElement;
  private flashEl: HTMLDivElement;
  private lbTop: HTMLDivElement;
  private lbBot: HTMLDivElement;
  private bannerEl: HTMLDivElement;
  private dmgLayer: HTMLDivElement;
  private fpsEl: HTMLDivElement | null = null;
  private raf = 0;
  private last = 0;
  private disposed = false;
  private key: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private q = QUALITY.high;
  private pmrem: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget | null = null;
  // camera
  private camPos = new THREE.Vector3(0, 4, 16);
  private camLook = new THREE.Vector3(0, 1.4, 0);
  private shot: { pos: THREE.Vector3; look: THREE.Vector3; w: number } | null = null;
  private camBlend = 0;
  private shakeAmt = 0;
  private hitStopT = 0;
  private slow = { scale: 1, t: 0 };
  private invertT = 0;
  private blurAmt = 0;
  private blurSet = 0;
  private blurCenter = new THREE.Vector2(0.5, 0.5);
  private dim = 0;
  private dimTarget = 0;
  private dimTint = new THREE.Color(0, 0, 0);
  private aberr = 0;
  // match
  private rounds: [number, number] = [0, 0];
  private round = 1;
  private roundTime = 99;
  private phaseT = 0;
  private introStage = 0;
  private roundWinner: -1 | 0 | 1 = -1;
  private matchTime = 0;
  private hpLag: [number, number] = [1000, 1000];
  private hpLagDelay: [number, number] = [0, 0];
  private hudT = 0;
  private fpsAcc = 0;
  private fpsN = 0;
  private fpsVal = 60;
  private practiceResetT = 0;
  private lastResult: MatchResult | null = null;
  private tmpV = new THREE.Vector3();

  constructor(container: HTMLElement, public cfg: GameConfig) {
    this.container = container;
    this.q = QUALITY[cfg.quality];
    const w = container.clientWidth || 1280, h = container.clientHeight || 720;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", alpha: false, stencil: false });
    const pr = Math.min(window.devicePixelRatio || 1, this.q.pr);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 1500);
    this.camera.position.copy(this.camPos);

    // arena
    this.arena = buildArena(ARENAS[cfg.arena].id);
    this.scene.add(this.arena.group);
    this.scene.background = new THREE.Color(this.arena.fogColor);
    this.scene.fog = new THREE.FogExp2(this.arena.fogColor, this.arena.fogDensity);
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = this.pmrem.fromScene(this.arena.envScene, 0.04);
    this.scene.environment = this.envRT.texture;
    (this.scene as unknown as { environmentIntensity: number }).environmentIntensity = 0.7;

    // lights
    this.hemi = new THREE.HemisphereLight(this.arena.hemi.sky, this.arena.hemi.ground, this.arena.hemi.intensity);
    this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight(this.arena.sun.color, this.arena.sun.intensity);
    this.key.position.set(...this.arena.sun.pos);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(this.q.shadow, this.q.shadow);
    const sc = this.key.shadow.camera;
    sc.left = -17; sc.right = 17; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 60;
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.03;
    this.scene.add(this.key, this.key.target);

    // vfx
    this.vfx = new VFX(this.scene, this.q.particles);
    this.vfx.qty = this.q.qty;

    // post
    this.composer = new EffectComposer(this.renderer);
    (this.composer.renderTarget1 as THREE.WebGLRenderTarget).samples = this.q.msaa;
    (this.composer.renderTarget2 as THREE.WebGLRenderTarget).samples = this.q.msaa;
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w * this.q.bloomScale, h * this.q.bloomScale), this.arena.bloom, 0.65, 0.82);
    this.composer.addPass(this.bloom);
    this.post = new ShaderPass(POST_SHADER);
    this.composer.addPass(this.post);
    this.composer.addPass(new OutputPass());
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);

    // overlay DOM
    this.overlay = document.createElement("div");
    this.overlay.className = "ac-overlay";
    this.flashEl = document.createElement("div"); this.flashEl.className = "ac-flash";
    this.lbTop = document.createElement("div"); this.lbTop.className = "ac-lb ac-lb-top";
    this.lbBot = document.createElement("div"); this.lbBot.className = "ac-lb ac-lb-bot";
    this.bannerEl = document.createElement("div"); this.bannerEl.className = "ac-banner-wrap";
    this.dmgLayer = document.createElement("div"); this.dmgLayer.className = "ac-dmg-layer";
    this.overlay.append(this.flashEl, this.lbTop, this.lbBot, this.bannerEl, this.dmgLayer);
    if (cfg.fps) { this.fpsEl = document.createElement("div"); this.fpsEl.className = "ac-fps"; this.overlay.append(this.fpsEl); }
    container.appendChild(this.overlay);

    // fighters
    const f1 = new Fighter(0, FIGHTERS[cfg.p1], this);
    const f2 = new Fighter(1, FIGHTERS[cfg.p2], this);
    f1.opp = f2; f2.opp = f1;
    this.fighters = [f1, f2];
    this.hpLag = [f1.maxHp, f2.maxHp];
    this.resetPositions(true);
    this.practice = { infHp: false, infKi: false };

    this.camera.position.set(0, 4, 17);
    this.last = performance.now();
    window.addEventListener("resize", this.onResize);
    document.addEventListener("visibilitychange", this.onVis);
    this.raf = requestAnimationFrame(this.loop);
    this.onResize();
    this.compileShaders();
  }

  private compileShaders() {
    try { this.renderer.compile(this.scene, this.camera); } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------------- lifecycle
  begin() {
    if (this.phase !== "ready") return;
    audio.music(ARENAS[this.cfg.arena].music);
    audio.ambience(this.arena.ambience);
    this.startRound();
  }
  pause() { if (this.phase !== "ready" && this.phase !== "over") { this.paused = true; useHud.setState({ paused: true }); } }
  resume() { this.paused = false; this.last = performance.now(); input.clearHeld(); useHud.setState({ paused: false }); }
  private onVis = () => { if (document.hidden) this.pause(); };
  private onResize = () => {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w * this.q.bloomScale, h * this.q.bloomScale);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.vfx.setScale(h * Math.min(window.devicePixelRatio || 1, this.q.pr), this.camera.fov);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVis);
    audio.stopAmbience();
    this.fighters.forEach((f) => f.dispose());
    this.projectiles.forEach((p) => this.killProjectile(p, false));
    this.vfx.dispose();
    this.arena.dispose();
    this.envRT?.dispose();
    this.pmrem.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.overlay.remove();
    useHud.setState({ active: false, paused: false });
  }

  // ---------------------------------------------------------------------- effects API
  sfx(name: string, pos?: THREE.Vector3, vol = 1) {
    const pan = pos ? THREE.MathUtils.clamp((pos.x - this.camPos.x) / 16, -0.8, 0.8) : 0;
    audio.play(name, vol, pan);
  }
  shake(a: number) { this.shakeAmt = Math.min(1.2, Math.max(this.shakeAmt, a)); }
  hitstop(t: number) { this.hitStopT = Math.max(this.hitStopT, t); }
  slowmo(scale: number, dur: number) {
    if (this.slow.t <= 0 || scale < this.slow.scale) this.slow.scale = scale;
    this.slow.t = Math.max(this.slow.t, dur);
  }
  flashScreen(color: string, alpha: number, dur: number) {
    const e = this.flashEl;
    e.style.transition = "none";
    e.style.background = color;
    e.style.opacity = String(alpha);
    void e.offsetWidth;
    e.style.transition = `opacity ${dur}s ease-out`;
    e.style.opacity = "0";
  }
  impactFrame(dur = 0.06) { this.invertT = dur; }
  letterbox(on: boolean) {
    this.lbTop.classList.toggle("on", on);
    this.lbBot.classList.toggle("on", on);
  }
  banner(title: string, sub: string, color: string, dur = 1.4) {
    const el = document.createElement("div");
    el.className = "ac-banner";
    el.style.setProperty("--c", color);
    el.style.animationDuration = `${dur}s`;
    el.innerHTML = `<div class="ac-banner-sub">${sub}</div><div class="ac-banner-title">${title}</div>`;
    this.bannerEl.appendChild(el);
    setTimeout(() => el.remove(), dur * 1000 + 100);
  }
  announce(text: string, color = "#ffffff", dur = 1.1, size = 1) {
    const el = document.createElement("div");
    el.className = "ac-announce";
    el.style.setProperty("--c", color);
    el.style.fontSize = `${size * 9}vmin`;
    el.style.animationDuration = `${dur}s`;
    el.textContent = text;
    this.bannerEl.appendChild(el);
    setTimeout(() => el.remove(), dur * 1000 + 100);
  }
  setShot(pos: THREE.Vector3, look: THREE.Vector3, w = 1) { this.shot = { pos, look, w }; }
  setDim(v: number, tint?: number) { this.dimTarget = v; if (tint !== undefined) this.dimTint.set(tint); }
  radialBlur(a: number, world: THREE.Vector3) {
    this.blurSet = Math.max(this.blurSet, a);
    const p = this.tmpV.copy(world).project(this.camera);
    this.blurCenter.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5);
  }
  ultActiveFor(f: Fighter) { const o = f.opp; return o.state === "ult" && !!o.ultS && o.ultS.phase === 0; }
  private dmgText(text: string, p: THREE.Vector3, color: string, size = 1) {
    if (!this.cfg.damageNumbers && this.cfg.mode !== "practice") return;
    if (this.dmgLayer.childElementCount > 24) return;
    const v = this.tmpV.copy(p).project(this.camera);
    const el = document.createElement("div");
    el.className = "ac-dmg";
    el.style.left = `${(v.x * 0.5 + 0.5) * 100 + (Math.random() - 0.5) * 3}%`;
    el.style.top = `${(-v.y * 0.5 + 0.5) * 100}%`;
    el.style.color = color;
    el.style.fontSize = `${1.6 * size}rem`;
    el.textContent = text;
    this.dmgLayer.appendChild(el);
    setTimeout(() => el.remove(), 950);
  }

  clampToArena(pos: THREE.Vector3, f?: Fighter) {
    const rx = this.arena.rx, rz = this.arena.rz;
    const nx = pos.x / rx, nz = pos.z / rz;
    const d = nx * nx + nz * nz;
    if (d > 1) {
      const s = 1 / Math.sqrt(d);
      pos.x *= s; pos.z *= s;
      if (f) {
        const nxv = pos.x / (rx * rx), nzv = pos.z / (rz * rz);
        const l = Math.hypot(nxv, nzv) || 1;
        const vn = (f.vel.x * nxv + f.vel.z * nzv) / l;
        if (vn > 0) { f.vel.x -= (nxv / l) * vn; f.vel.z -= (nzv / l) * vn; }
      }
    }
  }

  // ---------------------------------------------------------------------- positions & rounds
  resetPositions(full = false) {
    const [a, b] = this.fighters;
    a.reset(-4.5, 0, Math.PI / 2, full);
    b.reset(4.5, 0, -Math.PI / 2, full);
    this.clearField();
  }
  private clearField() {
    this.projectiles.slice().forEach((p) => this.killProjectile(p, false));
    this.zones.forEach((z) => this.killZone(z));
    this.zones = [];
    this.vfx.clear();
    this.ultsActive = 0;
    this.setDim(0);
    this.letterbox(false);
    this.timeScale = 1; this.slow.t = 0; this.hitStopT = 0;
  }
  private startRound() {
    this.resetPositions(true);
    this.fighters.forEach((f) => { f.state = "locked"; });
    this.phase = "intro"; this.phaseT = 0; this.introStage = 0;
    this.roundTime = 99;
    this.hpLag = [this.fighters[0].maxHp, this.fighters[1].maxHp];
    this.camPos.set(0, 3.2, 14);
    if (this.cfg.mode === "practice") { this.announce("TRAINING", "#7fe6ff", 1.4, 0.9); }
    else this.announce(`ROUND ${this.round}`, "#ffffff", 1.5, 1.1);
    this.sfx("round");
  }
  private startFight() {
    this.phase = "fight";
    this.fighters.forEach((f) => f.setState("idle"));
    this.announce(this.cfg.mode === "practice" ? "GO!" : "FIGHT!", "#ffd23f", 1.0, 1.3);
    this.sfx("go");
  }
  private endRound(winner: -1 | 0 | 1, timeout: boolean) {
    if (this.phase !== "fight") return;
    this.phase = "ko"; this.phaseT = 0;
    this.roundWinner = winner;
    this.fighters.forEach((f) => { if (f.ultS) cancelUlt(this, f); });
    this.setDim(0); this.letterbox(false);
    if (winner === -1) { this.rounds[0]++; this.rounds[1]++; } else this.rounds[winner]++;
    if (timeout) { this.announce("TIME UP", "#ffffff", 1.6, 1.2); this.sfx("round"); }
    else { this.announce("K.O.", "#ff3b4a", 2.2, 2); this.slowmo(0.2, 1.6); this.sfx("ko"); this.shake(0.8); this.flashScreen("#ffffff", 0.8, 0.5); this.impactFrame(0.08); }
  }
  private afterKoPhase() {
    const w = this.roundWinner;
    this.phase = "roundEnd"; this.phaseT = 0;
    this.projectiles.slice().forEach((p) => this.killProjectile(p, false));
    this.zones.forEach((z) => this.killZone(z)); this.zones = [];
    if (w >= 0) {
      const f = this.fighters[w as 0 | 1];
      f.win();
      this.announce(w === 0 ? "PLAYER 1" : "PLAYER 2", w === 0 ? "#3da5ff" : "#ff4a5c", 2.2, 1.2);
      this.sfx("victory");
    } else this.announce("DRAW", "#ffffff", 2, 1.4);
  }
  private finishRoundEnd() {
    const matchOver = this.rounds[0] >= 2 || this.rounds[1] >= 2;
    if (matchOver) {
      this.phase = "over";
      const w: -1 | 0 | 1 = this.rounds[0] === this.rounds[1] ? (this.fighters[0].hp >= this.fighters[1].hp ? 0 : 1) : this.rounds[0] > this.rounds[1] ? 0 : 1;
      const res: MatchResult = {
        winner: w, rounds: [this.rounds[0], this.rounds[1]], stats: [this.fighters[0].stats, this.fighters[1].stats],
        duration: this.matchTime, chars: [this.cfg.p1, this.cfg.p2], arena: this.cfg.arena, mode: this.cfg.mode,
      };
      this.lastResult = res;
      this.flashScreen("#ffffff", 1, 0.8);
      setTimeout(() => { if (!this.disposed) this.cfg.onMatchEnd(res); }, 500);
    } else {
      this.round++;
      this.startRound();
    }
  }
  restartMatch() {
    this.rounds = [0, 0]; this.round = 1; this.matchTime = 0;
    this.fighters.forEach((f) => { f.stats = { damage: 0, maxCombo: 0, hits: 0, blocks: 0, parries: 0, ultimates: 0 }; f.ultMeter = 0; f.xf = 0; });
    this.phase = "ready";
    this.paused = false;
    useHud.setState({ paused: false });
    this.begin();
  }
  togglePractice(k: "infHp" | "infKi") { this.practice[k] = !this.practice[k]; }

  // ---------------------------------------------------------------------- combat
  meleeCheck(att: Fighter, mv: MoveData, opts: { landing?: boolean } = {}): boolean {
    const def = att.opp;
    if (def.state === "ko") return false;
    const f = att.face;
    const dx = def.pos.x - att.pos.x, dz = def.pos.z - att.pos.z;
    const fwd = dx * f.x + dz * f.z;
    const lat = Math.abs(dx * f.z - dz * f.x);
    const reach = mv.range + def.radius * 0.7;
    if (!opts.landing && (fwd < -0.35 || fwd > reach)) return false;
    if (opts.landing && Math.hypot(dx, dz) > 3.2) return false;
    if (!opts.landing && lat > mv.width * 0.5 + def.radius * 0.7) return false;
    const dy = def.pos.y - att.pos.y;
    if (dy > mv.vert || dy < -mv.vert * 0.7) return false;
    const pt = this.tmpV.set((att.pos.x + def.pos.x) / 2, Math.max(att.pos.y, def.pos.y) + 1.2, (att.pos.z + def.pos.z) / 2).clone();
    const r = this.dealHit(att, def, mv, { point: pt });
    return r !== "miss";
  }

  dealHit(att: Fighter, def: Fighter, mv: MoveData, o: { point?: THREE.Vector3; proj?: Projectile; dmgMul?: number } = {}): "hit" | "block" | "parry" | "miss" {
    if (def.state === "ko" || (def.invuln > 0 && def.state !== "frozen")) return "miss";
    if (this.phase !== "fight" && this.cfg.mode !== "practice") return "miss";
    const point = o.point ?? this.tmpV.copy(def.pos).setY(def.pos.y + 1.1).clone();
    let dx = def.pos.x - att.pos.x, dz = def.pos.z - att.pos.z;
    if (o.proj) { dx = o.proj.vel.x; dz = o.proj.vel.z; }
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl; dz /= dl;
    const el: El = (mv.element as El) ?? "none";
    const col = EL_COLORS[el];
    // ---- block / parry
    if (def.state === "block" && !mv.unblockable && !def.air) {
      if (def.parryOpen) {
        if (o.proj) {
          const p = o.proj;
          p.owner = def; p.vel.multiplyScalar(-1.3); p.dmgMul *= 1.25; p.age = 0; p.life = 3;
        } else {
          att.enterHit(0.8, -dx * 3, -dz * 3, 0);
        }
        def.parryFlash = 0.35; def.invuln = 0.35; def.parryOpen = false;
        def.ultMeter = Math.min(100, def.ultMeter + 8); def.ki = Math.min(100, def.ki + 15); def.guard = 100;
        def.stats.parries++;
        this.vfx.ring(point, 0xffe08a, 0.2, 2.6, 0.3, { billboard: true });
        this.vfx.burst({ p: point, n: 30, speed: [4, 14], size: [0.12, 0.3], life: [0.2, 0.5], color: 0xffffff, color2: 0xffd060, drag: 3 });
        this.vfx.flash(point, 0xffe08a, 14, 10, 0.25);
        this.sfx("parry", point);
        this.dmgText("PARRY!", point, "#ffe08a", 1.3);
        this.hitstop(0.12); this.slowmo(0.35, 0.2); this.aberr = 0.012;
        return "parry";
      }
      // normal block
      const chip = Math.max(1, mv.damage * 0.1 * att.dmgMul);
      def.guard -= mv.damage * 0.25 * mv.guardDmg;
      if (!this.practice.infHp) def.hp = Math.max(1, def.hp - chip);
      att.stats.damage += chip;
      def.stats.blocks++;
      def.ultMeter = Math.min(100, def.ultMeter + 2);
      att.ultMeter = Math.min(100, att.ultMeter + 2);
      this.vfx.burst({ p: point, n: 12, speed: [3, 9], size: [0.1, 0.22], life: [0.15, 0.35], color: 0xffffff, color2: col.main, drag: 3 });
      this.vfx.ring(point, 0xcfe0ff, 0.2, 1.4, 0.2, { billboard: true });
      this.sfx("block", point);
      this.hitstop(0.05);
      this.shake(0.08);
      def.rig.jitter = 0.05;
      if (def.guard <= 0) {
        def.guard = 0;
        def.cleanupForHit();
        def.setState("guardbreak");
        def.vel.set(dx * 4, 2, dz * 4);
        this.sfx("guardbreak", point);
        this.dmgText("GUARD BREAK!", point, "#ff8a3c", 1.2);
        this.shake(0.35); this.hitstop(0.1);
      } else {
        def.vel.x = dx * (2.5 + mv.knock * 0.5); def.vel.z = dz * (2.5 + mv.knock * 0.5);
        this.dmgText(String(Math.round(chip)), point, "#9fb4ff", 0.8);
      }
      if (att.combo > 0 && !o.proj) att.comboTimer = 0.1;
      return "block";
    }

    // ---- clean hit
    const armored = def.state === "ult" && def.ultS && def.ultS.phase <= 2;
    const scale = Math.max(0.35, 1 - 0.06 * att.combo);
    let dmg = mv.damage * att.dmgMul * (o.dmgMul ?? 1) * scale / def.def.defense;
    if (def.state === "frozen") dmg *= 1.35;
    if (armored) dmg *= 0.4;
    dmg = Math.max(1, Math.round(dmg));
    if (!this.practice.infHp) def.hp = Math.max(0, def.hp - dmg);
    att.stats.damage += dmg; att.stats.hits++;
    att.combo++; att.comboDmg += dmg; att.comboTimer = 1.3; att.lastDmg = dmg;
    att.stats.maxCombo = Math.max(att.stats.maxCombo, att.combo);
    const gainU = dmg * 0.09, gainX = dmg * 0.08;
    att.ultMeter = Math.min(100, att.ultMeter + gainU); att.ki = Math.min(100, att.ki + 3);
    def.ultMeter = Math.min(100, def.ultMeter + gainU * 0.7);
    if (!att.transformed) att.xf = Math.min(100, att.xf + gainX);
    if (!def.transformed) def.xf = Math.min(100, def.xf + gainX * 0.9);
    // reaction
    if (!armored) {
      let stun = mv.hitstun, kx = dx * mv.knock, kz = dz * mv.knock, launch = mv.launch;
      if (mv.pull) { kx = -dx * mv.pull; kz = -dz * mv.pull; stun = mv.hitstun; launch = 0; }
      if (def.state === "frozen" && !mv.freeze) { def.unfreeze(true); def.setState("idle"); launch = Math.max(launch, 7); kx = dx * 6; kz = dz * 6; }
      if (mv.freeze && def.state !== "frozen") def.freeze(mv.freeze);
      else if (!mv.freeze) def.enterHit(stun, kx, kz, launch);
      if (mv.slow) def.slowT = mv.slow;
    }
    // feedback
    const power = Math.min(2.2, 0.55 + dmg / 80);
    this.vfx.hit(point, el, power, new THREE.Vector3(dx, 0.3, dz));
    const snd = mv.damage >= 90 ? "heavy" : mv.sound === "kick" ? "kick" : "punch";
    this.sfx(snd, point);
    if (el === "lightning") this.sfx("thunder", point, 0.4);
    else if (el === "ice" && mv.damage > 50) this.sfx("ice", point, 0.6);
    else if (el === "fire" && mv.damage > 50) this.sfx("fire", point, 0.4);
    else if (el === "dark" && mv.damage > 50) this.sfx("dark", point, 0.4);
    this.hitstop(mv.hitstop);
    this.shake(Math.min(0.45, dmg / 260));
    def.rig.jitter = 0.14;
    this.dmgText(String(dmg), point, att.idx === 0 ? "#7cc4ff" : "#ff7a88", 0.9 + Math.min(1, dmg / 120));
    if (mv.damage >= 90 || mv.spike) {
      const br = this.arena.breakAt(point, 1.8);
      for (const b of br) { this.vfx.chunks(b.pos, 12, b.color, 7, 0.28); this.vfx.dust(b.pos, 10, 4); this.sfx("explosion", b.pos, 0.4); }
    }
    this.checkKO(att, def);
    return "hit";
  }

  ultHit(att: Fighter, def: Fighter, dmg: number, o: { knock?: number; kx?: number; kz?: number; launch?: number; el?: El; point?: THREE.Vector3; stun?: number; small?: boolean }): boolean {
    if (def.state === "ko" || def.invuln > 0) return false;
    const point = o.point ?? this.tmpV.copy(def.pos).setY(1).clone();
    const armored = def.state === "ult" && def.ultS && def.ultS.phase <= 2;
    const blocking = def.state === "block" && !def.air;
    let d = dmg * att.dmgMul / def.def.defense * (blocking ? 0.3 : 1) * (armored ? 0.4 : 1);
    if (def.state === "frozen") d *= 1.2;
    d = Math.round(d);
    if (!this.practice.infHp) def.hp = Math.max(0, def.hp - d);
    att.stats.damage += d; att.stats.hits++;
    att.combo++; att.comboDmg += d; att.comboTimer = 1.6; att.lastDmg = d;
    att.stats.maxCombo = Math.max(att.stats.maxCombo, att.combo);
    def.ultMeter = Math.min(100, def.ultMeter + d * 0.06);
    if (!def.transformed) def.xf = Math.min(100, def.xf + d * 0.1);
    if (blocking) {
      def.stats.blocks++;
      def.guard -= d * 0.8;
      def.vel.set((o.kx ?? 0) * 6, 1, (o.kz ?? 0) * 6);
      if (def.guard <= 0) { def.guard = 0; def.cleanupForHit(); def.setState("guardbreak"); this.dmgText("GUARD BREAK!", point, "#ff8a3c", 1.2); }
    } else if (!armored) {
      def.enterHit(o.stun ?? 0.9, (o.kx ?? 0) * (o.knock ?? 8), (o.kz ?? 0) * (o.knock ?? 8), o.launch ?? 9);
    }
    const el = o.el ?? "none";
    this.vfx.hit(point, el, o.small ? 1.2 : 2.2);
    this.hitstop(o.small ? 0.06 : 0.2);
    this.shake(o.small ? 0.4 : 0.8);
    this.aberr = 0.02;
    def.rig.jitter = 0.2;
    this.dmgText(String(d), point, "#ffd23f", 1.8);
    this.checkKO(att, def);
    return true;
  }

  ultClash(a: Fighter, b: Fighter) {
    cancelUlt(this, a); cancelUlt(this, b);
    a.invuln = b.invuln = 0.9;
    const p = new THREE.Vector3((a.pos.x + b.pos.x) / 2, 2, (a.pos.z + b.pos.z) / 2);
    const g0 = p.clone().setY(0);
    this.explode(g0, a.element, 2.6, { damage: false });
    this.explode(g0, b.element, 2.6, { damage: false });
    this.explode(g0, "none", 3.2, { damage: false });
    this.vfx.fx("sphere", p, 0xffffff, 1, 16, 0.5, { op: 1, hdr: 3 });
    this.vfx.fx("sphere", p, EL_COLORS[a.element].main, 1, 22, 0.8, { op: 0.5, hdr: 1.6 });
    this.vfx.fx("sphere", p, EL_COLORS[b.element].main, 1, 20, 0.9, { op: 0.5, hdr: 1.6 });
    this.vfx.ring(p, 0xffffff, 1, 40, 1.0, { billboard: true });
    this.vfx.ring(g0, 0xffffff, 1, 28, 1.0);
    this.vfx.flash(p, 0xffffff, 160, 60, 1.0);
    this.flashScreen("#ffffff", 1, 0.9);
    this.impactFrame(0.14);
    this.shake(1.1);
    this.slowmo(0.15, 0.7);
    this.banner("ULTIMATE CLASH!", "ENERGY COLLISION", "#ffd23f", 1.8);
    this.sfx("clash", p); this.sfx("bigexplosion", p);
    for (const [f, dir] of [[a, -1], [b, 1]] as const) {
      const d = Math.sign(f.pos.x - p.x) || dir;
      if (!this.practice.infHp) f.hp = Math.max(0, f.hp - 70);
      f.enterHit(0.9, d * 14, 0, 9);
      f.stats.damage += 0;
    }
    a.opp.stats.damage += 70; b.opp.stats.damage += 70;
    this.checkKO(a, b); this.checkKO(b, a);
    this.setDim(0);
  }

  private checkKO(att: Fighter, def: Fighter) {
    if (this.phase !== "fight") return;
    if (this.cfg.mode === "practice") {
      if (def.hp <= 0 && this.practiceResetT <= 0) { this.practiceResetT = 1.6; this.announce("RESET", "#7fe6ff", 1.4, 0.9); }
      return;
    }
    if (def.hp <= 0) {
      const dead0 = this.fighters[0].hp <= 0, dead1 = this.fighters[1].hp <= 0;
      const winner: -1 | 0 | 1 = dead0 && dead1 ? -1 : dead0 ? 1 : 0;
      def.vel.x *= 1.3;
      this.endRound(winner, false);
      void att;
    }
  }

  // ---------------------------------------------------------------------- projectiles
  fireProjectile(f: Fighter, mv: MoveData, i: number, n: number) {
    const base = f.face.clone();
    let yaw = 0;
    const fan = (mv.count ?? 1) === 1;
    if (n > 1) yaw = fan ? (i - (n - 1) / 2) * 0.24 : (Math.random() - 0.5) * 0.1;
    const dir = base.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).normalize();
    const el = mv.element as El;
    const c = EL_COLORS[el];
    const form = f.transformed;
    const sc = (mv.radius ?? 0.5) * (form ? 1.25 : 1);
    const pos = new THREE.Vector3(f.pos.x + dir.x * 0.9, f.pos.y + 1.2 + (n > 1 && !fan ? (Math.random() - 0.5) * 0.3 : 0), f.pos.z + dir.z * 0.9);
    const group = new THREE.Group();
    const mats: THREE.Material[] = [];
    const mk = (color: number, op: number, hdr: number, normal = false) => {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(hdr), transparent: true, opacity: op, blending: normal ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite: false });
      mats.push(m);
      return m;
    };
    const spear = el === "ice" && mv.type === "proj";
    const useColor = form ? f.def.formColor : c.main;
    if (el === "dark") {
      const core = new THREE.Mesh(sphereGeo, mk(0x000000, 1, 1, true)); core.scale.setScalar(sc * 0.85); core.renderOrder = 9; group.add(core);
      const sh = new THREE.Mesh(sphereGeo, mk(useColor, 0.5, 1.6)); sh.scale.setScalar(sc * 1.15); group.add(sh);
    } else if (spear) {
      const sp = new THREE.Mesh(coneGeo, mk(0xdff8ff, 0.95, 1.8)); sp.scale.set(sc * 0.7, sc * 0.7, sc * 5); sp.rotation.y = Math.PI; group.add(sp);
      const gl = new THREE.Mesh(sphereGeo, mk(useColor, 0.45, 1.4)); gl.scale.setScalar(sc * 1.1); group.add(gl);
    } else if (mv.type === "prison") {
      const core = new THREE.Mesh(sphereGeo, mk(0xffffff, 0.95, 1.8)); core.scale.setScalar(sc * 0.8); group.add(core);
      const sh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), mk(useColor, 0.6, 1.5)); sh.scale.setScalar(sc * 1.3); group.add(sh);
      mats.push();
    } else {
      const core = new THREE.Mesh(sphereGeo, mk(c.core, 0.95, 1.8)); core.scale.setScalar(sc * 0.65); group.add(core);
      const sh = new THREE.Mesh(sphereGeo, mk(useColor, 0.55, 1.5)); sh.scale.setScalar(sc * 1.25); group.add(sh);
    }
    group.position.copy(pos);
    this.scene.add(group);
    const speed = mv.speed ?? 20;
    const p: Projectile = { owner: f, mv, pos, vel: dir.clone().multiplyScalar(speed), radius: sc, el, life: 2.6, homing: (mv.homing ?? 0) * (form ? 1.4 : 1), group, mats, dmgMul: form ? 1.25 : 1, age: 0, scale: sc, dead: false, spear };
    this.projectiles.push(p);
    this.vfx.burst({ p: pos, n: 14, speed: [2, 8], size: [0.15, 0.35], life: [0.15, 0.4], color: c.core, color2: c.main, dir, spread: 0.7, drag: 3 });
    this.vfx.flash(pos, c.main, 10, 10, 0.15);
    this.sfx(mv.sound, pos, 0.8);
  }

  private killProjectile(p: Projectile, explode: boolean) {
    if (p.dead) { return; }
    p.dead = true;
    this.scene.remove(p.group);
    p.mats.forEach((m) => m.dispose());
    if (explode) {
      this.vfx.hit(p.pos, p.el, 0.9);
      this.vfx.burst({ p: p.pos, n: 20, speed: [3, 10], size: [0.15, 0.35], life: [0.2, 0.6], color: EL_COLORS[p.el].core, color2: EL_COLORS[p.el].main, drag: 2 });
    }
    const i = this.projectiles.indexOf(p);
    if (i >= 0) this.projectiles.splice(i, 1);
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles.slice()) {
      if (p.dead) continue;
      p.age += dt; p.life -= dt;
      const def = p.owner.opp;
      if (p.homing > 0 && p.age < 1.4 && def.state !== "ko") {
        const des = this.tmpV.set(def.pos.x - p.pos.x, def.pos.y + 1.0 - p.pos.y, def.pos.z - p.pos.z).normalize().multiplyScalar(p.vel.length());
        p.vel.lerp(des, Math.min(1, p.homing * dt));
      }
      p.pos.addScaledVector(p.vel, dt);
      p.group.position.copy(p.pos);
      if (p.spear) p.group.lookAt(p.pos.x + p.vel.x, p.pos.y + p.vel.y, p.pos.z + p.vel.z);
      else p.group.scale.setScalar(1 + Math.sin(p.age * 30) * 0.08);
      this.vfx.trail(p.pos, p.el, p.scale * 2);
      if (p.el === "dark" && Math.random() < 0.5) this.vfx.burst({ p: p.pos, n: 1, speed: [0.5, 1.5], size: [0.8, 1.4], life: [0.4, 0.7], color: 0x2a0a40, color2: 0x050008, smoke: true, jitter: 0.3 });
      this.vfx.flash(p.pos, EL_COLORS[p.el].main, 6, 7, 0.08);
      // vs opponent
      if (def.state !== "ko") {
        const dx = def.pos.x - p.pos.x, dz = def.pos.z - p.pos.z;
        const dh = Math.hypot(dx, dz);
        const dy = p.pos.y - def.pos.y;
        if (dh < p.radius + def.radius * 0.85 && dy > -0.3 && dy < 2.0) {
          const before = p.owner;
          const r = this.dealHit(p.owner, def, p.mv, { proj: p, point: p.pos.clone(), dmgMul: p.dmgMul });
          if (r === "parry") { if (p.owner !== before) { p.group.position.copy(p.pos); } continue; }
          if (r !== "miss") { this.killProjectile(p, true); continue; }
        }
      }
      // vs projectiles
      for (const q of this.projectiles) {
        if (q === p || q.dead || q.owner === p.owner) continue;
        if (q.pos.distanceTo(p.pos) < p.radius + q.radius) {
          const mid = p.pos.clone().add(q.pos).multiplyScalar(0.5);
          this.vfx.explosion(mid, p.el, 0.5, { debris: false, scorch: false });
          this.sfx("explosion", mid, 0.6);
          this.shake(0.15);
          this.killProjectile(q, false); this.killProjectile(p, false);
          break;
        }
      }
      if (p.dead) continue;
      const out = (p.pos.x / (this.arena.rx * 1.5)) ** 2 + (p.pos.z / (this.arena.rz * 1.6)) ** 2 > 1;
      if (p.life <= 0 || out || p.pos.y < 0.15) {
        if (p.pos.y < 0.15) this.vfx.scorch(p.pos, 0.8);
        this.killProjectile(p, true);
      }
    }
  }

  // ---------------------------------------------------------------------- zones
  spawnZone(f: Fighter, mv: MoveData, at: THREE.Vector3) {
    this.clampToArena(at);
    const r = (mv.zoneR ?? 2.5) * (f.transformed ? 1.3 : 1);
    const z: Zone = { owner: f, mv, pos: at.clone(), r, t: 0, life: (mv.zoneLife ?? 2.5) + 0.5, delay: 0.5, tick: 0, fx: [], bars: [], dead: false };
    const col = EL_COLORS[mv.element as El];
    const ring = this.vfx.fx("ring", new THREE.Vector3(at.x, 0.08, at.z), col.core, r, r, 1000, { hold: true, fadeIn: 0, op: 0.9, hdr: 2 });
    const disc = this.vfx.fx("disc", new THREE.Vector3(at.x, 0.06, at.z), col.main, r, r, 1000, { hold: true, fadeIn: 0, op: 0.18, hdr: 1.4 });
    if (ring) z.fx.push(ring);
    if (disc) z.fx.push(disc);
    this.zones.push(z);
    this.sfx("thunder", at, 0.7);
  }
  private killZone(z: Zone) {
    z.dead = true;
    [...z.fx, ...z.bars].forEach((it) => { it.active = false; it.mesh.visible = false; });
  }
  private updateZones(dt: number) {
    for (const z of this.zones) {
      if (z.dead) continue;
      z.t += dt;
      const col = EL_COLORS[z.mv.element as El];
      const def = z.owner.opp;
      if (z.t < z.delay) {
        // telegraph pulsing
        if (z.fx[0]) z.fx[0].mat.opacity = 0.4 + Math.sin(z.t * 30) * 0.3;
        continue;
      }
      if (z.bars.length === 0) {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const b = this.vfx.fx("cyl", new THREE.Vector3(z.pos.x + Math.cos(a) * z.r, 0, z.pos.z + Math.sin(a) * z.r), col.main, [0.1, 0.1, 0.1], [0.1, 5, 0.1], 1000, { hold: true, fadeIn: 0, op: 0.8, hdr: 2, ease: 4 });
          if (b) { z.bars.push(b); }
        }
        const dome = this.vfx.fx("dome", new THREE.Vector3(z.pos.x, 0, z.pos.z), col.main, z.r * 0.4, z.r, 1000, { hold: true, fadeIn: 0, op: 0.12, hdr: 1.4, ease: 3 });
        if (dome) z.bars.push(dome);
        this.vfx.shockwave(z.pos, "lightning", z.r * 1.8, 0.4);
        this.shake(0.3);
        this.sfx("thunder", z.pos);
      }
      if (z.fx[0]) { z.fx[0].mat.opacity = 0.8; }
      // crackle
      if (Math.random() < 0.8) {
        const a = Math.random() * 6.28, a2 = Math.random() * 6.28;
        this.vfx.bolt(new THREE.Vector3(z.pos.x + Math.cos(a) * z.r, rndr(0, 0.5), z.pos.z + Math.sin(a) * z.r), new THREE.Vector3(z.pos.x + Math.cos(a2) * z.r * 0.9, rndr(3, 5), z.pos.z + Math.sin(a2) * z.r * 0.9), col.main, 0.5, 0.1, 0.14);
      }
      this.vfx.flash(new THREE.Vector3(z.pos.x, 2.5, z.pos.z), col.main, 14, 14, 0.1);
      const inside = Math.hypot(def.pos.x - z.pos.x, def.pos.z - z.pos.z) < z.r && def.pos.y < 3.5;
      if (inside) def.slowT = Math.max(def.slowT, 0.3);
      z.tick -= dt;
      if (z.tick <= 0 && inside) {
        z.tick = 0.4;
        this.vfx.bolt(new THREE.Vector3(z.pos.x + rndr(-1, 1), 5, z.pos.z + rndr(-1, 1)), new THREE.Vector3(def.pos.x, def.pos.y + 1, def.pos.z), col.core, 0.4, 0.14, 0.2);
        this.dealHit(z.owner, def, z.mv, { point: new THREE.Vector3(def.pos.x, def.pos.y + 1, def.pos.z), dmgMul: 1 });
      }
      if (z.t > z.life) this.killZone(z);
    }
    this.zones = this.zones.filter((z) => !z.dead);
  }

  explode(pos: THREE.Vector3, el: El, size: number, o: { damage?: boolean } = {}) {
    this.vfx.explosion(pos, el, size);
    const br = this.arena.breakAt(pos, size * 3.2);
    for (const b of br) { this.vfx.chunks(b.pos, 14, b.color, 11, 0.3); this.vfx.dust(b.pos, 12, 5); }
    this.flashScreen("#ffffff", 0.0, 0.1);
    void o;
  }

  // ---------------------------------------------------------------------- main loop
  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    let rdt = (now - this.last) / 1000;
    this.last = now;
    rdt = Math.min(rdt, 1 / 20);
    if (rdt <= 0) return;
    this.realDt = rdt;
    // fps
    this.fpsAcc += rdt; this.fpsN++;
    if (this.fpsAcc > 0.5) { this.fpsVal = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; if (this.fpsEl) this.fpsEl.textContent = `${Math.round(this.fpsVal)} FPS`; }

    const i0 = input.poll(0), i1 = input.poll(1);
    if (input.pauseEdge && this.phase !== "ready" && this.phase !== "over") {
      if (this.paused) this.resume(); else this.pause();
    }
    if (this.phase === "fight" && this.cfg.mode === "practice") {
      // quick reset key
      if (input.consumeKey("Backspace")) this.resetPositionsPractice();
    }
    input.endFrame();

    if (!this.paused) this.step(rdt, i0, i1);
    this.render(rdt);
    this.hudT += rdt;
    if (this.hudT > 0.04) { this.hudT = 0; this.publishHud(); }
  };

  private resetPositionsPractice() {
    this.fighters.forEach((f) => { f.reset(f.idx === 0 ? -4.5 : 4.5, 0, f.idx === 0 ? Math.PI / 2 : -Math.PI / 2, false); f.setState("idle"); f.hp = f.maxHp; });
    this.clearField();
  }
  resetPractice() { if (this.cfg.mode === "practice") { this.resetPositionsPractice(); this.fighters.forEach((f) => { f.ultMeter = 0; f.xf = 0; f.ki = 100; }); this.resume(); } }

  private step(rdt: number, i0: PlayerInput, i1: PlayerInput) {
    // time scale / slowmo
    if (this.slow.t > 0) { this.slow.t -= rdt; this.timeScale += (this.slow.scale - this.timeScale) * Math.min(1, rdt * 30); if (this.slow.t <= 0) this.slow.scale = 1; }
    else this.timeScale += (1 - this.timeScale) * Math.min(1, rdt * 8);
    let dt = rdt * this.timeScale;
    const inHitstop = this.hitStopT > 0;
    if (inHitstop) { this.hitStopT -= rdt; dt = 0; }
    this.time += dt;

    // phases
    this.phaseT += rdt;
    if (this.phase === "intro") {
      if (this.phaseT > 1.7 && this.introStage === 0) { this.introStage = 1; this.startFight(); }
    } else if (this.phase === "ko") {
      if (this.phaseT > 2.2) this.afterKoPhase();
    } else if (this.phase === "roundEnd") {
      const w = this.roundWinner;
      if (w >= 0) {
        const f = this.fighters[w as 0 | 1];
        this.setShot(new THREE.Vector3(f.pos.x + 1.8, 1.6, f.pos.z + 5), new THREE.Vector3(f.pos.x, 1.5, f.pos.z), Math.min(1, this.phaseT / 0.6) * 0.9);
      }
      if (this.phaseT > 3.2) this.finishRoundEnd();
    }
    const fighting = this.phase === "fight";
    if (fighting) {
      if (this.cfg.mode !== "practice") {
        if (this.ultsActive === 0 && !this.fighters.some((f) => f.state === "transform")) this.roundTime -= dt;
        if (this.roundTime <= 0) {
          this.roundTime = 0;
          const [a, b] = this.fighters;
          const pa = a.hp / a.maxHp, pb = b.hp / b.maxHp;
          this.endRound(Math.abs(pa - pb) < 0.001 ? -1 : pa > pb ? 0 : 1, true);
        }
        this.matchTime += dt;
      } else {
        this.matchTime += dt;
        if (this.practiceResetT > 0) {
          this.practiceResetT -= rdt;
          if (this.practiceResetT <= 0) this.resetPositionsPractice();
        }
        // practice: reset regen
        if (this.practice.infHp) this.fighters.forEach((f) => { f.hp = f.maxHp; });
      }
    }

    if (dt > 0) {
      const inputs: (PlayerInput | null)[] = [fighting ? i0 : null, fighting ? i1 : null];
      // controls disabled while in cinematic phase 0 for opponent? no — retained.
      this.fighters.forEach((f, i) => f.update(dt, inputs[i]));
      this.updateProjectiles(dt);
      this.updateZones(dt);
      this.vfx.update(dt, this.camera);
      this.arena.update(dt, this.time, this.camLook);
    } else {
      this.fighters.forEach((f) => { f.rig.update(0, f.t); f.rig.jitter *= 0.9; });
      this.vfx.update(0, this.camera);
    }
    // hp lag
    for (let i = 0; i < 2; i++) {
      const f = this.fighters[i];
      if (this.hpLag[i] > f.hp) {
        this.hpLagDelay[i] += rdt;
        if (this.hpLagDelay[i] > 0.55) this.hpLag[i] = Math.max(f.hp, this.hpLag[i] - f.maxHp * 0.45 * rdt);
      } else { this.hpLag[i] = f.hp; this.hpLagDelay[i] = 0; }
    }
    if (this.invertT > 0) this.invertT -= rdt;
    this.aberr *= Math.exp(-5 * rdt);
  }

  // ---------------------------------------------------------------------- render
  private render(dt: number) {
    const a = this.fighters[0].pos, b = this.fighters[1].pos;
    // camera
    const mid = this.tmpV.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
    const dx = Math.abs(a.x - b.x), dz = Math.abs(a.z - b.z);
    const dy = Math.max(a.y, b.y);
    const tanH = Math.tan((this.camera.fov * Math.PI) / 360);
    const halfW = dx / 2 + 2.3 + dz * 0.15;
    const dW = halfW / (tanH * this.camera.aspect);
    const halfH = Math.max(1.7, dy * 0.55 + 1.6);
    const dH = halfH / tanH;
    const dist = THREE.MathUtils.clamp(Math.max(dW, dH * 0.8, 7.2), 7.2, 26) + dz * 0.35;
    const sway = Math.sin(this.time * 0.35) * 0.9;
    const baseX = THREE.MathUtils.clamp(mid.x + sway, -18, 18);
    const wantPos = new THREE.Vector3(baseX, 2.7 + dist * 0.13 + dy * 0.1, mid.z + dist);
    const wantLook = new THREE.Vector3(mid.x, 1.35 + dy * 0.3, mid.z);
    const sh = this.shot;
    const target = sh ? sh.w : 0;
    this.camBlend += (target - this.camBlend) * (1 - Math.exp(-(sh ? 6 : 3.5) * dt));
    this.shot = null;
    if (sh && this.camBlend > 0.001) { wantPos.lerp(sh.pos, this.camBlend); wantLook.lerp(sh.look, this.camBlend); }
    const k = 1 - Math.exp(-(this.camBlend > 0.3 ? 7 : 5.5) * dt);
    this.camPos.lerp(wantPos, k);
    this.camLook.lerp(wantLook, k);
    this.camera.position.copy(this.camPos);
    this.shakeAmt *= Math.exp(-7 * dt);
    const sa = this.shakeAmt * this.cfg.shake;
    if (sa > 0.005) {
      this.camera.position.x += (Math.random() - 0.5) * sa * 0.7;
      this.camera.position.y += (Math.random() - 0.5) * sa * 0.7;
    }
    this.camera.lookAt(this.camLook);
    if (sa > 0.005) this.camera.rotateZ((Math.random() - 0.5) * sa * 0.02);
    this.camera.updateMatrixWorld();

    // key light follows action
    this.key.position.set(mid.x + this.arena.sun.pos[0], this.arena.sun.pos[1], mid.z + this.arena.sun.pos[2]);
    this.key.target.position.set(mid.x, 0, mid.z);

    // dim / tint
    this.dim += (this.dimTarget - this.dim) * (1 - Math.exp(-4 * dt));
    this.dimTarget = 0;
    this.key.intensity = this.arena.sun.intensity * (1 - 0.7 * this.dim);
    this.hemi.intensity = this.arena.hemi.intensity * (1 - 0.6 * this.dim);
    this.renderer.toneMappingExposure = this.arena.exposure * (1 - 0.15 * this.dim);
    const bg = this.scene.background as THREE.Color;
    bg.set(this.arena.fogColor).lerp(this.dimTint, this.dim * 0.6);
    (this.scene.fog as THREE.FogExp2).color.copy(bg);
    this.bloom.strength = this.arena.bloom * (1 + this.dim * 0.1);

    // post uniforms
    const u = this.post.uniforms;
    u.uInvert.value = this.invertT > 0 ? 1 : 0;
    this.blurAmt += (this.blurSet - this.blurAmt) * (1 - Math.exp(-10 * dt));
    this.blurSet = 0;
    u.uBlur.value = this.blurAmt;
    (u.uCenter.value as THREE.Vector2).copy(this.blurCenter);
    u.uAberr.value = this.aberr + this.blurAmt * 0.05;
    u.uVig.value = 0.32 + this.dim * 0.25;
    (u.uTint.value as THREE.Color).setRGB(1, 1, 1);
    if (this.dim > 0.01) (u.uTint.value as THREE.Color).copy(new THREE.Color(1, 1, 1)).lerp(this.dimTint.clone().multiplyScalar(2.2).add(new THREE.Color(0.35, 0.35, 0.35)), this.dim * 0.22);

    // letterbox respects canvas; arena fixed lights
    this.composer.render(dt);
  }

  private publishHud() {
    const fs = this.fighters.map((f, i) => ({
      hp: f.hp, hpShown: this.hpLag[i], maxHp: f.maxHp, ki: f.ki, ult: f.ultMeter, xf: f.xf, transformed: f.transformed,
      xfLeft: f.xfTime, guard: f.guard, combo: f.combo, comboDmg: f.comboDmg,
      cd: [Math.max(0, f.cd.s1) / Math.max(0.01, f.def.s1.cd), Math.max(0, f.cd.s2) / Math.max(0.01, f.def.s2.cd), Math.max(0, f.cd.sig) / Math.max(0.01, f.def.sig.cd)] as [number, number, number],
      kiOk: [f.ki >= f.def.s1.ki, f.ki >= f.def.s2.ki, f.ki >= f.def.sig.ki] as [boolean, boolean, boolean],
      lastDmg: f.lastDmg,
    }));
    useHud.setState({
      active: true, f: fs as never, timer: Math.ceil(this.roundTime), round: this.round, wins: [this.rounds[0], this.rounds[1]],
      mode: this.cfg.mode, infHp: this.practice.infHp, infKi: this.practice.infKi, paused: this.paused, fps: this.fpsVal,
    });
  }

  get result() { return this.lastResult; }
}

function rndr(a: number, b: number) { return a + Math.random() * (b - a); }
