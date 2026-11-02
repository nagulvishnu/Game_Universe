// Phase 7 — 3D vertical slice: explore, encounter, transform, battle, return.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildMechRig, poseRig, type MechRig } from './mechRig';
import { buildOpponentRig, type OpponentRig } from './opponentRig';
import { BattleBridge } from './battleBridge';
import { makeSliceState, canTransition, type SlicePhase, type SliceState } from './sliceState';
import { SPECIES } from '../game/data';
import type { CardId } from '../game/types';

export type ProtoPhase = 'driving' | 'toRobot' | 'robot' | 'toCar';

export interface BenchSegment {
  name: string; seconds: number; frames: number;
  avgFps: number; p50Ms: number; p95Ms: number; worstMs: number;
}

export interface ProtoState {
  phase: ProtoPhase;
  t: number;
  stage: string;
  speed: number;
  fps: number;
  quality: 'high' | 'low';
  drawCalls: number;
  triangles: number;
  frameMs: number;
  p95Ms: number;
  shadows: boolean;
  dpr: number;
  benchRunning: boolean;
  // Phase 7 additions
  slicePhase: SlicePhase;
  playerHp: number;
  playerMaxHp: number;
  opponentHp: number;
  opponentMaxHp: number;
  lockedCards: CardId[] | null;
  cardCooldowns: [number, number, number];
  playerTurn: boolean;
  battleBusy: boolean;
  battleOutcome: 'victory' | 'defeat' | null;
  encounterInRange: boolean;
}

const STAGES = [
  '1/7 BRAKE & SETTLE',
  '2/7 WHEELS REPOSITION',
  '3/7 CHASSIS LIFTS',
  '4/7 PANELS -> ARMS',
  '5/7 SECTIONS SEPARATE',
  '6/7 LEGS EXTEND & LOCK',
  '7/7 HEAD RISE / LAND',
];

function stageFor(t: number): string {
  if (t <= 0.001) return 'CAR MODE';
  if (t >= 0.999) return 'ROBOT MODE';
  if (t < 0.12) return STAGES[0];
  if (t < 0.35) return STAGES[1];
  if (t < 0.55) return STAGES[2];
  if (t < 0.68) return STAGES[3];
  if (t < 0.78) return STAGES[4];
  if (t < 0.88) return STAGES[5];
  return STAGES[6];
}

const TO_ROBOT_MS = 2400;
const TO_CAR_MS = 1900;
const BOUNDS = 26;
const ENCOUNTER_RANGE = 5.5;
const ENCOUNTER_COOLDOWN_S = 3;
// Opponent species used for battle stats (SENTINEL-X uses ferrion-level stats)
const OPPONENT_SPECIES = SPECIES['ferrion'];
const OPPONENT_LEVEL = 3;
// Player species (AURORA-01 maps to blaze stats)
const PLAYER_SPECIES = SPECIES['blaze'];
const PLAYER_LEVEL = 3;

export class Proto3DApp {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private rig: MechRig;
  private opponent: OpponentRig;
  private dirLight: THREE.DirectionalLight;
  private ro: ResizeObserver;
  private container: HTMLElement;

  phase: ProtoPhase = 'driving';
  t = 0;
  private tweenDir: 0 | 1 | -1 = 0;
  private tweenStart = 0;

  private speed = 0;
  private heading = 0;
  private walkPhase = 0;
  private attackT = -1;

  private camYaw = Math.PI;
  private camPitch = 0.42;
  private camDist = 9;
  private camPos = new THREE.Vector3(0, 4, 9);
  private dragging = false;
  private lastPointer = { x: 0, y: 0 };

  private keys = new Set<string>();
  private raf = 0;
  private last = 0;
  private fps = 0;
  private quality: 'high' | 'low' = 'high';
  private disposed = false;

  private static readonly FT_CAP = 240;
  private ftBuf = new Float32Array(Proto3DApp.FT_CAP);
  private ftIdx = 0;
  private ftCount = 0;
  private ftSum = 0;
  private smoothedMs = 16.7;

  private wheelSpin = 0;
  private decor: THREE.Object3D[] = [];

  // Phase 7 slice state
  private slice: SliceState = makeSliceState();
  private battle: BattleBridge | null = null;
  private encounterCooldownTimer = 0;
  private battleAnimT = -1;
  private opponentAttackTimer = 0;
  private pendingOpponentTurn = false;
  private readonly opponentPos = new THREE.Vector3(8, 0, 8);
  private encounterInRange = false;
  onStateChange: (() => void) | null = null;

  // Phase 6C benchmark state
  private benchActive = false;
  private benchSegIdx = 0;
  private benchSegStart = 0;
  private benchSegName = '';
  private benchFrames = new Float32Array(4096);
  private benchFrameCount = 0;
  private benchResults: BenchSegment[] = [];
  private static readonly BENCH_SEGS: { name: string; durMs: number; setup: (app: Proto3DApp) => void }[] = [
    { name: 'car idle', durMs: 6000, setup: (a) => { a.keys.clear(); a.benchClearTo(0); } },
    { name: 'car drive', durMs: 8000, setup: (a) => { a.benchClearTo(0); a.keys.add('KeyW'); } },
    { name: 'transform to robot', durMs: 2800, setup: (a) => { a.keys.clear(); a.requestTransform(1); } },
    { name: 'robot walk', durMs: 8000, setup: (a) => { a.benchClearTo(1); a.keys.add('KeyW'); } },
    { name: 'robot attack', durMs: 6000, setup: (a) => { a.keys.clear(); a.keys.add('KeyJ'); } },
    { name: 'transform to car', durMs: 2300, setup: (a) => { a.keys.clear(); a.requestTransform(-1); } },
    { name: 'car idle (end)', durMs: 4000, setup: (a) => { a.benchClearTo(0); } },
  ];

  constructor(container: HTMLElement) {
    this.container = container;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0618);
    this.scene.fog = new THREE.Fog(0x0a0618, 30, 70);
    {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environmentIntensity = 0.55;
      pmrem.dispose();
    }

    this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 200);

    const hemi = new THREE.HemisphereLight(0x6a5fc0, 0x1a0f30, 1.0);
    this.scene.add(hemi);
    this.dirLight = new THREE.DirectionalLight(0xfff2e0, 2.1);
    this.dirLight.position.set(8, 14, 6);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(1024, 1024);
    const sc = this.dirLight.shadow.camera;
    sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.far = 50;
    this.scene.add(this.dirLight);
    const rim = new THREE.DirectionalLight(0x35f0ff, 0.5);
    rim.position.set(-6, 5, -8);
    this.scene.add(rim);

    // ground
    const groundGeo = new THREE.PlaneGeometry(90, 90);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x241a42, metalness: 0.2, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    const grid = new THREE.GridHelper(90, 45, 0x3d2f73, 0x241a45);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.5;
    grid.position.y = 0.01;
    this.scene.add(grid);

    this.buildDecor();

    // player rig
    this.rig = buildMechRig();
    this.scene.add(this.rig.root);
    poseRig(this.rig, 0);

    // opponent
    this.opponent = buildOpponentRig();
    this.opponent.root.position.copy(this.opponentPos);
    this.opponent.root.rotation.y = Math.PI;
    this.scene.add(this.opponent.root);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.addEventListener('wheel', this.onWheel, { passive: false });

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);

    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private buildDecor(): void {
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x3a2f5e, metalness: 0.15, roughness: 0.85 });
    const rockGeos: THREE.BufferGeometry[] = [];
    const rockBase = new THREE.DodecahedronGeometry(1, 0);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const rad = 14 + (i % 4) * 3.5;
      const g = rockBase.clone();
      const mtx = new THREE.Matrix4().compose(
        new THREE.Vector3(Math.cos(a) * rad, 0.4 + (i % 3) * 0.15, Math.sin(a) * rad),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(i * 0.7, i * 1.3, i * 0.4)),
        new THREE.Vector3().setScalar(0.6 + (i % 3) * 0.35),
      );
      g.applyMatrix4(mtx);
      rockGeos.push(g);
    }
    rockBase.dispose();
    const mergedRocks = mergeGeometries(rockGeos, false)!;
    for (const g of rockGeos) g.dispose();
    const rocks = new THREE.Mesh(mergedRocks, rockMat);
    rocks.castShadow = true;
    this.scene.add(rocks);
    this.decor.push(rocks);

    const pylonGeo = new THREE.CylinderGeometry(0.12, 0.18, 3.2, 8);
    const pylonMat = new THREE.MeshStandardMaterial({ color: 0x242c48, metalness: 0.7, roughness: 0.4 });
    const tipMat = new THREE.MeshStandardMaterial({ color: 0x18e0ff, emissive: 0x18e0ff, emissiveIntensity: 2 });
    const shaftGeos: THREE.BufferGeometry[] = [];
    const tipGeos: THREE.BufferGeometry[] = [];
    const tipBase = new THREE.SphereGeometry(0.16, 10, 8);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      const px = Math.cos(a) * 20, pz = Math.sin(a) * 20;
      const s = pylonGeo.clone();
      s.applyMatrix4(new THREE.Matrix4().makeTranslation(px, 1.6, pz));
      shaftGeos.push(s);
      const tp = tipBase.clone();
      tp.applyMatrix4(new THREE.Matrix4().makeTranslation(px, 3.3, pz));
      tipGeos.push(tp);
    }
    tipBase.dispose();
    pylonGeo.dispose();
    const mergedShafts = mergeGeometries(shaftGeos, false)!;
    const mergedTips = mergeGeometries(tipGeos, false)!;
    for (const g of shaftGeos) g.dispose();
    for (const g of tipGeos) g.dispose();
    const shafts = new THREE.Mesh(mergedShafts, pylonMat);
    shafts.castShadow = true;
    const tips = new THREE.Mesh(mergedTips, tipMat);
    this.scene.add(shafts, tips);
    this.decor.push(shafts, tips);

    // road ring around the arena
    const roadGeo = new THREE.RingGeometry(10, 11, 48);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1a1430, metalness: 0.1, roughness: 0.95 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.005;
    road.receiveShadow = true;
    this.scene.add(road);
    this.decor.push(road);
  }

  // ---------- public API ----------
  requestToRobot(): void { this.requestTransform(1); }
  requestToCar(): void { this.requestTransform(-1); }

  getState(): ProtoState {
    const info = this.renderer.info.render;
    const s = this.slice;
    return {
      phase: this.phase, t: this.t, stage: stageFor(this.t),
      speed: this.speed, fps: this.fps, quality: this.quality,
      drawCalls: info.calls, triangles: info.triangles,
      frameMs: this.smoothedMs, p95Ms: this.frameP95(),
      shadows: this.renderer.shadowMap.enabled,
      dpr: this.renderer.getPixelRatio(),
      benchRunning: this.benchActive,
      slicePhase: s.phase,
      playerHp: this.battle?.player.hp ?? 0,
      playerMaxHp: this.battle?.player.maxHp ?? 0,
      opponentHp: this.battle?.opponent.hp ?? 0,
      opponentMaxHp: this.battle?.opponent.maxHp ?? 0,
      lockedCards: s.lockedCards,
      cardCooldowns: s.cardCooldowns,
      playerTurn: s.playerTurn,
      battleBusy: s.busy,
      battleOutcome: s.battleOutcome,
      encounterInRange: this.encounterInRange,
    };
  }

  private frameP95(): number {
    const n = this.ftCount;
    if (n < 2) return 0;
    const arr = Array.from(this.ftBuf.subarray(0, n)).sort((a, b) => a - b);
    return arr[Math.min(n - 1, Math.floor(n * 0.95))];
  }

  toggleQuality(): void {
    this.quality = this.quality === 'high' ? 'low' : 'high';
    if (this.quality === 'low') {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      this.renderer.shadowMap.enabled = true;
    }
    this.resize();
  }

  // ---------- Phase 7 public battle API ----------

  confirmEncounter(): void {
    if (!canTransition(this.slice, 'toRobot')) return;
    this.slice.phase = 'toRobot';
    this.requestTransform(1);
    this.onStateChange?.();
  }

  cancelEncounter(): void {
    if (!canTransition(this.slice, 'explore')) return;
    this.slice.phase = 'explore';
    this.startEncounterCooldown();
    this.onStateChange?.();
  }

  startBattleWithCards(cards: CardId[]): void {
    if (this.slice.phase !== 'battle' || this.battle) return;
    if (cards.length !== 3) return;
    this.battle = new BattleBridge(PLAYER_SPECIES, PLAYER_LEVEL, OPPONENT_SPECIES, OPPONENT_LEVEL);
    this.battle.lockCards(cards);
    this.slice.lockedCards = [...cards];
    this.slice.cardCooldowns = [0, 0, 0];
    const result = this.battle.beginPlayerTurn();
    this.slice.playerTurn = this.battle.playerTurn;
    this.slice.cardCooldowns = this.battle.cooldowns;
    this.slice.busy = false;
    this.applyBattleResult(result);
    this.onStateChange?.();
  }

  playCard(idx: number): void {
    if (this.slice.phase !== 'battle' || !this.battle) return;
    if (!this.slice.playerTurn || this.slice.busy) return;
    if (this.slice.cardCooldowns[idx] > 0) return;
    this.slice.busy = true;
    this.slice.playerTurn = false;
    const result = this.battle.playCard(idx);
    this.slice.cardCooldowns = this.battle.cooldowns;
    this.applyBattleResult(result);
    if (!result.battleOver) {
      this.pendingOpponentTurn = true;
      this.opponentAttackTimer = 0.7;
    }
    this.onStateChange?.();
  }

  continueAfterBattle(): void {
    if (!canTransition(this.slice, 'toCar')) return;
    this.slice.phase = 'toCar';
    this.requestTransform(-1);
    this.onStateChange?.();
  }

  private applyBattleResult(result: { battleOver: boolean; playerWon: boolean | null }): void {
    if (result.battleOver) {
      this.slice.busy = false;
      this.slice.playerTurn = false;
      this.pendingOpponentTurn = false;
      if (canTransition(this.slice, 'battleResult')) {
        this.slice.phase = 'battleResult';
        this.slice.battleOutcome = result.playerWon ? 'victory' : 'defeat';
      }
    }
  }

  private startEncounterCooldown(): void {
    this.slice.encounterCooldown = true;
    this.encounterCooldownTimer = ENCOUNTER_COOLDOWN_S;
  }

  // ---------- Phase 6C benchmark ----------
  private benchClearTo(target: 0 | 1): void {
    this.tweenDir = 0;
    this.t = target;
    this.phase = target === 1 ? 'robot' : 'driving';
    this.attackT = -1;
    this.walkPhase = 0;
  }

  startBenchmark(): void {
    if (this.benchActive) return;
    this.benchActive = true;
    this.benchSegIdx = 0;
    this.benchFrameCount = 0;
    this.benchResults = [];
    this.benchSegName = Proto3DApp.BENCH_SEGS[0].name;
    Proto3DApp.BENCH_SEGS[0].setup(this);
    this.benchSegStart = performance.now();
    console.info('[proto3d] benchmark started — 7 segments, ~37s total');
  }

  private stepBenchmark(now: number, frameMs: number): void {
    if (!this.benchActive) return;
    const segs = Proto3DApp.BENCH_SEGS;
    if (this.benchFrameCount < this.benchFrames.length) {
      this.benchFrames[this.benchFrameCount++] = Math.min(250, frameMs);
    }
    if (now - this.benchSegStart >= segs[this.benchSegIdx].durMs) {
      const n = this.benchFrameCount;
      const slice = Array.from(this.benchFrames.subarray(0, n)).sort((a, b) => a - b);
      const sum = slice.reduce((a, b) => a + b, 0);
      this.benchResults.push({
        name: this.benchSegName, seconds: (now - this.benchSegStart) / 1000,
        frames: n, avgFps: n > 0 ? 1000 / (sum / n) : 0,
        p50Ms: n > 0 ? slice[Math.floor(n * 0.5)] : 0,
        p95Ms: n > 0 ? slice[Math.min(n - 1, Math.floor(n * 0.95))] : 0,
        worstMs: n > 0 ? slice[n - 1] : 0,
      });
      this.benchFrameCount = 0;
      this.benchSegIdx++;
      if (this.benchSegIdx >= segs.length) {
        this.benchActive = false;
        this.keys.clear();
        const meta = {
          userAgent: navigator.userAgent,
          screen: `${screen.width}x${screen.height}`,
          dpr: this.renderer.getPixelRatio(),
          quality: this.quality,
          shadows: this.renderer.shadowMap.enabled,
          canvas: `${this.renderer.domElement.width}x${this.renderer.domElement.height}`,
          note: 'Headless/SwiftShader numbers do NOT represent discrete-GPU performance.',
        };
        const report = { meta, segments: this.benchResults };
        console.info('[proto3d] BENCH RESULT ' + JSON.stringify(report));
        (window as unknown as { __proto3dBench?: unknown }).__proto3dBench = report;
        return;
      }
      this.benchSegName = segs[this.benchSegIdx].name;
      segs[this.benchSegIdx].setup(this);
      this.benchSegStart = now;
      console.info(`[proto3d] bench segment ${this.benchSegIdx + 1}/${segs.length}: ${this.benchSegName}`);
    }
    if (this.benchSegName === 'robot attack' && this.attackT < 0) this.attackT = 0;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.removeEventListener('wheel', this.onWheel);
    this.rig.dispose();
    this.opponent.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ---------- transform state machine ----------
  private requestTransform(dir: 1 | -1): void {
    if (this.tweenDir !== 0) return;
    if (dir === 1 && this.phase === 'robot') return;
    if (dir === -1 && this.phase === ('car' as ProtoPhase)) return;
    if (dir === 1 && this.t >= 1) return;
    if (dir === -1 && this.t <= 0) return;
    this.tweenDir = dir;
    this.tweenStart = performance.now();
    this.phase = dir === 1 ? 'toRobot' : 'toCar';
    this.speed = 0;
    this.attackT = -1;
  }

  private stepTween(now: number): void {
    if (this.tweenDir === 0) return;
    const dir = this.tweenDir;
    const dur = dir === 1 ? TO_ROBOT_MS : TO_CAR_MS;
    const u = Math.min(1, (now - this.tweenStart) / dur);
    this.t = dir === 1 ? u : 1 - u;
    if (u >= 1) {
      this.tweenDir = 0;
      this.phase = this.t >= 1 ? 'robot' : 'driving';
      // Phase 7: advance slice state when transform completes
      if (this.phase === 'robot' && this.slice.phase === 'toRobot') {
        this.slice.phase = 'battle';
        this.onStateChange?.();
      } else if (this.phase === 'driving' && this.slice.phase === 'toCar') {
        this.slice.phase = 'explore';
        this.battle = null;
        this.slice.lockedCards = null;
        this.slice.cardCooldowns = [0, 0, 0];
        this.slice.playerTurn = false;
        this.slice.busy = false;
        this.slice.battleOutcome = null;
        this.startEncounterCooldown();
        this.onStateChange?.();
      }
    }
  }

  // ---------- input ----------
  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    this.keys.add(e.code);
    const sp = this.slice.phase;
    if (e.code === 'KeyT' && sp === 'explore') this.requestTransform(1);
    if (e.code === 'KeyG' && sp === 'explore') this.requestTransform(-1);
    if (e.code === 'KeyQ') this.toggleQuality();
    if (e.code === 'KeyJ' && this.phase === 'robot' && this.attackT < 0 && sp === 'explore') this.attackT = 0;
    if (e.code === 'KeyB' && sp === 'explore') this.startBenchmark();
    if (e.code === 'KeyE') {
      if (sp === 'encounterIntro') this.confirmEncounter();
      else if (sp === 'battleResult') this.continueAfterBattle();
    }
    if (e.code === 'Escape' && sp === 'encounterIntro') this.cancelEncounter();
    if (sp === 'battle' && this.battle) {
      if (e.code === 'Digit1') this.playCard(0);
      if (e.code === 'Digit2') this.playCard(1);
      if (e.code === 'Digit3') this.playCard(2);
    }
  };
  private onKeyUp = (e: KeyboardEvent): void => { this.keys.delete(e.code); };
  private onPointerDown = (e: PointerEvent): void => {
    this.dragging = true;
    this.lastPointer = { x: e.clientX, y: e.clientY };
  };
  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastPointer.x;
    const dy = e.clientY - this.lastPointer.y;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.camYaw -= dx * 0.006;
    this.camPitch = Math.max(0.12, Math.min(1.25, this.camPitch + dy * 0.004));
  };
  private onPointerUp = (): void => { this.dragging = false; };
  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.camDist = Math.max(4.5, Math.min(16, this.camDist + e.deltaY * 0.01));
  };

  // ---------- movement ----------
  private stepMovement(dt: number): void {
    const sliceLocked = this.slice.phase !== 'explore';
    const locked = this.tweenDir !== 0 || sliceLocked;
    const up = this.keys.has('KeyW') || this.keys.has('ArrowUp');
    const down = this.keys.has('KeyS') || this.keys.has('ArrowDown');
    const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    const right = this.keys.has('KeyD') || this.keys.has('ArrowRight');
    const root = this.rig.root;

    if (this.t < 0.5) {
      if (!locked) {
        const accel = 9, maxF = 13, maxR = 4.5;
        if (up) this.speed = Math.min(maxF, this.speed + accel * dt);
        else if (down) this.speed = Math.max(-maxR, this.speed - accel * 1.4 * dt);
        else this.speed *= Math.pow(0.35, dt);
        const steer = 2.1 * (left ? 1 : 0) + (right ? -1 : 0);
        this.heading += steer * dt * Math.min(1, Math.abs(this.speed) / 4) * Math.sign(this.speed || 1);
      } else {
        this.speed *= Math.pow(0.02, dt);
      }
      root.rotation.y = this.heading;
      const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
      root.position.x += fx * this.speed * dt;
      root.position.z += fz * this.speed * dt;
      this.wheelSpin += this.speed * dt * 2.8;
    } else {
      const mz = locked ? 0 : (up ? 1 : 0) + (down ? -1 : 0);
      if (!locked) {
        if (left) this.heading += 2.4 * dt;
        if (right) this.heading -= 2.4 * dt;
        root.rotation.y = this.heading;
        const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
        root.position.x += fx * mz * 3.2 * dt;
        root.position.z += fz * mz * 3.2 * dt;
        if (mz !== 0) this.walkPhase += dt * 7;
      }
      this.speed = 0;
      const swing = mz !== 0 ? Math.sin(this.walkPhase) : 0;
      const attack = this.attackT >= 0 ? this.attackT : -1;
      if (this.attackT >= 0) {
        this.attackT += dt / 0.38;
        if (this.attackT > 1) this.attackT = -1;
      }
      poseRobotMotion(this.rig, this.t, swing, attack, performance.now() * 0.001);
    }
    root.position.x = Math.max(-BOUNDS, Math.min(BOUNDS, root.position.x));
    root.position.z = Math.max(-BOUNDS, Math.min(BOUNDS, root.position.z));
    const spin = this.wheelSpin;
    for (const wh of this.rig.wheels) wh.rotation.x = spin;
  }

  // ---------- encounter detection ----------
  private stepEncounter(dt: number): void {
    if (this.slice.encounterCooldown) {
      this.encounterCooldownTimer -= dt;
      if (this.encounterCooldownTimer <= 0) {
        this.slice.encounterCooldown = false;
        this.encounterCooldownTimer = 0;
      }
    }
    const root = this.rig.root;
    const dx = root.position.x - this.opponentPos.x;
    const dz = root.position.z - this.opponentPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    this.encounterInRange = dist < ENCOUNTER_RANGE;
    if (
      this.encounterInRange &&
      this.slice.phase === 'explore' &&
      !this.slice.encounterCooldown &&
      this.tweenDir === 0
    ) {
      this.slice.phase = 'encounterIntro';
      this.speed = 0;
      this.onStateChange?.();
    }
  }

  // ---------- opponent turn timer ----------
  private stepOpponentTurn(dt: number): void {
    if (!this.pendingOpponentTurn || !this.battle) return;
    this.opponentAttackTimer -= dt;
    if (this.opponentAttackTimer > 0) return;
    this.pendingOpponentTurn = false;
    this.battleAnimT = 0;
    const result = this.battle.opponentTurn();
    this.slice.cardCooldowns = this.battle.cooldowns;
    this.applyBattleResult(result);
    if (!result.battleOver) {
      const self = this;
      setTimeout(() => {
        if (self.disposed || self.slice.phase !== 'battle' || !self.battle) return;
        const tr = self.battle.beginPlayerTurn();
        self.slice.playerTurn = self.battle.playerTurn;
        self.slice.cardCooldowns = self.battle.cooldowns;
        self.slice.busy = false;
        self.applyBattleResult(tr);
        self.onStateChange?.();
      }, 600);
    }
    this.onStateChange?.();
  }

  private getBattleCameraTarget(): THREE.Vector3 {
    const playerPos = this.rig.root.position.clone();
    const oppPos = this.opponentPos.clone();
    return playerPos.add(oppPos).multiplyScalar(0.5).add(new THREE.Vector3(0, 1.5, 0));
  }

  // ---------- per-frame ----------
  private tick = (now: number): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;

    const frameMs = Math.max(dt * 1000, 1e-3);
    if (this.ftCount === Proto3DApp.FT_CAP) this.ftSum -= this.ftBuf[this.ftIdx];
    else this.ftCount++;
    this.ftBuf[this.ftIdx] = frameMs;
    this.ftSum += frameMs;
    this.ftIdx = (this.ftIdx + 1) % Proto3DApp.FT_CAP;
    this.fps = 1000 / (this.ftSum / this.ftCount);
    this.smoothedMs += (frameMs - this.smoothedMs) * 0.05;
    this.stepBenchmark(now, frameMs);

    this.stepTween(now);
    poseRig(this.rig, this.t);
    this.stepMovement(dt);
    this.stepEncounter(dt);
    this.stepOpponentTurn(dt);

    // opponent idle + attack animation
    this.opponent.animateIdle(now * 0.001);
    if (this.battleAnimT >= 0) {
      this.battleAnimT += dt / 0.5;
      this.opponent.animateAttack(Math.min(1, this.battleAnimT));
      if (this.battleAnimT >= 1) this.battleAnimT = -1;
    }

    // transform flourish
    const root = this.rig.root;
    const dip = this.tweenDir !== 0 || (this.t > 0 && this.t < 1)
      ? -0.07 * Math.sin(Math.PI * Math.min(1, this.t / 0.2)) * (this.t < 0.2 ? 1 : 0)
      : 0;
    root.rotation.x = dip;
    const landU = (this.t - 0.9) / 0.1;
    root.position.y = landU > 0 && landU < 1 ? -0.12 * Math.sin(Math.PI * landU) : 0;

    const burstU = (this.t - 0.9) / 0.1;
    if (burstU > 0 && burstU < 1) {
      this.rig.burstRing.visible = true;
      const s = 0.4 + burstU * 3.2;
      this.rig.burstRing.scale.set(s, s, s);
      const mat = this.rig.burstRing.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.85 * (1 - burstU);
      for (const a of this.rig.accents) a.emissiveIntensity = 1.6 + 2.4 * (1 - burstU);
    } else if (this.rig.burstRing.visible) {
      this.rig.burstRing.visible = false;
      for (const a of this.rig.accents) a.emissiveIntensity = 1.6;
    }

    // camera
    let target: THREE.Vector3;
    let desiredDist = this.camDist;
    if (this.slice.phase === 'battle' || this.slice.phase === 'battleResult') {
      target = this.getBattleCameraTarget();
      desiredDist = 11;
    } else {
      target = new THREE.Vector3(root.position.x, root.position.y + (this.t > 0.5 ? 1.3 : 0.7), root.position.z);
    }
    const cx = target.x + desiredDist * Math.cos(this.camPitch) * Math.sin(this.camYaw);
    const cy = target.y + desiredDist * Math.sin(this.camPitch);
    const cz = target.z + desiredDist * Math.cos(this.camPitch) * Math.cos(this.camYaw);
    this.camPos.lerp(new THREE.Vector3(cx, cy, cz), 1 - Math.pow(0.001, dt));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(target);

    this.dirLight.position.set(root.position.x + 8, 14, root.position.z + 6);
    this.dirLight.target.position.copy(root.position);
    this.dirLight.target.updateMatrixWorld();

    this.renderer.render(this.scene, this.camera);
  };

  private resize(): void {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}

/** Robot-only motion layered on top of the base pose (walk swing / attack). */
function poseRobotMotion(rig: MechRig, t: number, swing: number, attack: number, time: number): void {
  if (t < 0.98) return;
  const byName = (n: string) => rig.parts.find((p) => p.name === n);
  const hipL = byName('hipL'), hipR = byName('hipR');
  const shinL = byName('shinL'), shinR = byName('shinR');
  const frR = byName('forearmR'), frL = byName('forearmL');
  const head = byName('head');
  if (hipL && hipR && shinL && shinR) {
    hipL.group.rotation.x = swing * 0.5;
    hipR.group.rotation.x = -swing * 0.5;
    shinL.group.rotation.x = -Math.max(0, -swing) * 0.7;
    shinR.group.rotation.x = -Math.max(0, swing) * 0.7;
  }
  if (frR && frL) {
    frL.group.rotation.x = 0.12 - swing * 0.35;
    if (attack >= 0) {
      const punch = Math.sin(Math.PI * attack);
      frR.group.rotation.x = 0.12 - punch * 1.9;
      frR.group.position.z = punch * 0.45;
    } else {
      frR.group.rotation.x = 0.12 + swing * 0.35;
      frR.group.position.z = 0;
    }
  }
  if (head) head.group.rotation.y = Math.sin(time * 0.7) * 0.18;
}
