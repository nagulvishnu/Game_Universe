import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { useStore, effectiveStats, type MissionConfig } from './store';
import { WEAPONS, ENEMIES, BOSSES, ABILITY_INFO, ENVIRONMENTS, MISSIONS, type WeaponDef, type EnemyDef, type BossDef } from '../data/gameData';
import { applyDamage, homeVelocity, bossPhase, missionRating, clamp, rand, type HealthState } from './engine';
import { audio } from './audio';
import { PlayerShipModel, EnemyShipModel, BossModel, StationModel, TransportModel, DroneModel } from './ShipModels';

const ARENA = 850;
const V3 = () => new THREE.Vector3();

interface Ent {
  id: number; def: EnemyDef; pos: THREE.Vector3; vel: THREE.Vector3; quat: THREE.Quaternion;
  hp: HealthState; fireCd: number; stateT: number; seed: number; disabled: number; lastHit: number;
  spawnCd: number; teleportCd: number; targetKind: 'player' | 'ally' | 'station'; radius: number;
}
interface Proj {
  active: boolean; friendly: boolean; pos: THREE.Vector3; vel: THREE.Vector3; life: number;
  damage: number; color: string; size: number; aoe: number; homing: number; targetId: number;
  shieldMult: number; hullMult: number; kind: string; bounces: number; speed: number; emp: boolean; lastHitId: number;
}
interface Particle { pos: THREE.Vector3; vel: THREE.Vector3; life: number; maxLife: number; color: THREE.Color; size: number; }
interface Pickup { id: number; kind: 'repair' | 'energy' | 'ammo' | 'credits' | 'ult'; pos: THREE.Vector3; }
interface Asteroid { pos: THREE.Vector3; scale: number; hp: number; rotAxis: THREE.Vector3; rotSpeed: number; alive: boolean; }

const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map(e => [e.id, e]));
const WEAPON_BY_ID: Record<string, WeaponDef> = Object.fromEntries(WEAPONS.map(w => [w.id, w]));
const BOSS_BY_ID: Record<string, BossDef> = Object.fromEntries(BOSSES.map(b => [b.id, b]));

function nebulaTexture(color: string): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, color + 'aa'); grad.addColorStop(0.4, color + '44'); grad.addColorStop(1, color + '00');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    const x = 40 + Math.random() * 176, y = 40 + Math.random() * 176, r = 8 + Math.random() * 42;
    const gg = g.createRadialGradient(x, y, 0, x, y, r);
    gg.addColorStop(0, color + '55'); gg.addColorStop(1, color + '00');
    g.fillStyle = gg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  return new THREE.CanvasTexture(c);
}

export default function GameCanvas() {
  const settings = useStore(s => s.settings);
  const dpr: [number, number] = settings.quality === 'low' ? [0.6, 1] : settings.quality === 'medium' ? [0.8, 1.5] : [1, 2];
  return (
    <Canvas dpr={dpr} gl={{ antialias: settings.quality !== 'low', powerPreference: 'high-performance' }} camera={{ fov: 62, near: 0.1, far: 6000, position: [0, 4, 14] }}>
      <Scene />
    </Canvas>
  );
}

function Scene() {
  const config = useStore(s => s.config) as MissionConfig;
  const save = useStore(s => s.save);
  const settings = useStore(s => s.settings);
  const paused = useStore(s => s.paused);
  const { camera, gl } = useThree();
  const stats = useMemo(() => effectiveStats(save), []); // eslint-disable-line react-hooks/exhaustive-deps
  const env = ENVIRONMENTS[config.env];

  const [roster, setRoster] = useState<{ id: number; defId: string }[]>([]);
  const [bossDef, setBossDef] = useState<BossDef | null>(null);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [droneIds, setDroneIds] = useState<number[]>([]);

  const playerRef = useRef<THREE.Group>(null);
  const shieldBubbleRef = useRef<THREE.Mesh>(null);
  const enemyRefs = useRef(new Map<number, THREE.Group>());
  const bossRef = useRef<THREE.Group>(null);
  const allyRef = useRef<THREE.Group>(null);
  const stationRef = useRef<THREE.Group>(null);
  const droneRefs = useRef(new Map<number, THREE.Group>());
  const projMeshRef = useRef<THREE.InstancedMesh>(null);
  const eProjMeshRef = useRef<THREE.InstancedMesh>(null);
  const particleMeshRef = useRef<THREE.InstancedMesh>(null);
  const asteroidMeshRef = useRef<THREE.InstancedMesh>(null);
  const beamMeshRef = useRef<THREE.Mesh>(null);
  const arcMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);
  const flashRef = useRef<THREE.PointLight>(null);

  const W = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!W.current) {
    const ownedPrimaries = save.ownedWeapons.filter(id => WEAPON_BY_ID[id]?.slot === 'primary');
    const ownedSecondaries = save.ownedWeapons.filter(id => WEAPON_BY_ID[id]?.slot === 'secondary');
    const ammo: Record<string, number> = {};
    WEAPONS.forEach(w => { ammo[w.id] = w.ammo; });
    W.current = {
      t: 0, phase: 'intro', phaseT: 0, ended: false,
      player: {
        pos: new THREE.Vector3(0, 0, 60), vel: V3(), yaw: 0, pitch: 0, roll: 0,
        hp: { hull: stats.hull, maxHull: stats.hull, shield: stats.shield, maxShield: stats.shield, armor: stats.armor } as HealthState,
        energy: stats.energy, boost: stats.boost, ult: 0, lastDamageAt: -99,
        primaryId: save.primaryId, secondaryId: save.secondaryId,
        primaries: ownedPrimaries, secondaries: ownedSecondaries, ammo,
        fireCd: 0, secCd: 0, charge: 0, charging: false,
        lockTarget: -1, lockProgress: 0,
        abilityCd: 0, cloak: 0, barrier: 0, overdrive: 0, repairPool: 0,
        shots: 0, hits: 0,
      },
      keys: new Set<string>(), mouseL: false, mouseR: false, mouseDX: 0, mouseDY: 0, pointerLocked: false,
      enemies: new Map<number, Ent>(), nextId: 1,
      projs: [] as Proj[], particles: [] as Particle[], rings: [] as { pos: THREE.Vector3; t: number; max: number; color: string }[],
      arcs: [] as { pts: THREE.Vector3[]; t: number }[],
      beam: null as null | { to: THREE.Vector3; color: string },
      boss: null as null | { def: BossDef; pos: THREE.Vector3; vel: THREE.Vector3; hp: HealthState; patternT: number; patternIdx: number; fireT: number; phase: number; telegraph: number; lastDamageAt: number; dead: boolean },
      ally: null as null | { pos: THREE.Vector3; hp: HealthState; angle: number },
      station: null as null | { pos: THREE.Vector3; hp: HealthState },
      drones: [] as { id: number; pos: THREE.Vector3; fireCd: number; life: number }[],
      wave: 0, waveState: 'pending', kills: 0, score: 0, combo: 0, comboT: 0, creditsEarned: 0,
      shake: 0, timeScale: 1, timeFracture: 0, gravityWell: null as null | { pos: THREE.Vector3; t: number },
      hudT: 0, fpsAcc: 0, fpsN: 0, fps: 60, dialogueShown: false, bossQueue: [] as string[],
      asteroidsDestroyed: 0, warningT: 0, lockBeepT: 0, shieldHitFlash: 0,
      camPos: new THREE.Vector3(0, 4, 74), asteroids: [] as Asteroid[],
    };
    // asteroids
    const count = Math.round(env.asteroidCount * (config.kind === 'asteroid' ? 1.9 : 1) * (settings.quality === 'low' ? 0.55 : 1));
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = rand(90, ARENA * 0.92), y = rand(-160, 160);
      W.current.asteroids.push({ pos: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), scale: rand(2.5, 9), hp: rand(30, 140), rotAxis: new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(), rotSpeed: rand(0.05, 0.4), alive: true });
    }
    if (config.type === 'escort') W.current.ally = { pos: new THREE.Vector3(-40, 0, -40), hp: { hull: 900, maxHull: 900, shield: 250, maxShield: 250, armor: 3 }, angle: 0 };
    if (config.type === 'defense') W.current.station = { pos: new THREE.Vector3(0, 0, -140), hp: { hull: 2600, maxHull: 2600, shield: 600, maxShield: 600, armor: 4 } };
    if (config.kind === 'bossrush') W.current.bossQueue = BOSSES.map(b => b.id);
  }
  const w = W.current;

  const nebTexA = useMemo(() => nebulaTexture(env.nebulaA), []); // eslint-disable-line react-hooks/exhaustive-deps
  const nebTexB = useMemo(() => nebulaTexture(env.nebulaB), []); // eslint-disable-line react-hooks/exhaustive-deps
  const nebulaSprites = useMemo(() => Array.from({ length: settings.quality === 'low' ? 7 : 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2 + rand(-0.3, 0.3);
    return { pos: [Math.cos(a) * rand(1500, 2300), rand(-600, 600), Math.sin(a) * rand(1500, 2300)] as [number, number, number], scale: rand(900, 1800), tex: i % 2 ? 'b' : 'a', opacity: rand(0.35, 0.7) };
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ───────────── input ─────────────
  const lockPointer = () => {
    try {
      const r = gl.domElement.requestPointerLock() as unknown as Promise<void> | undefined;
      if (r && typeof r.catch === 'function') r.catch(() => { /* relock cooldown — user can click again */ });
    } catch { /* pointer lock unavailable */ }
  };

  useEffect(() => {
    audio.init(); audio.startEngine(); audio.setMusic('combat');
    const kd = (e: KeyboardEvent) => {
      if (['Space', 'Tab', 'ControlLeft'].includes(e.code)) e.preventDefault();
      w.keys.add(e.code);
      if (e.code === 'Escape') { const st = useStore.getState(); if (st.screen === 'playing') st.setPaused(true); }
      if (e.code === 'KeyQ') cycleWeapon('primary');
      if (e.code === 'KeyR') cycleWeapon('secondary');
      if (e.code === 'KeyE') triggerAbility();
      if (e.code === 'KeyF') triggerUltimate();
    };
    const ku = (e: KeyboardEvent) => w.keys.delete(e.code);
    const md = (e: MouseEvent) => {
      audio.init();
      if (useStore.getState().screen !== 'playing') return;
      if (!w.pointerLocked) { lockPointer(); return; }
      if (e.button === 0) w.mouseL = true;
      if (e.button === 2) w.mouseR = true;
    };
    const mu = (e: MouseEvent) => {
      if (e.button === 0) { w.mouseL = false; releaseCharge(); }
      if (e.button === 2) { if (w.mouseR) releaseSecondary(); w.mouseR = false; }
    };
    const mm = (e: MouseEvent) => { if (w.pointerLocked) { w.mouseDX += e.movementX; w.mouseDY += e.movementY; } };
    const ctx = (e: Event) => e.preventDefault();
    const plc = () => {
      w.pointerLocked = document.pointerLockElement === gl.domElement;
      if (!w.pointerLocked && !w.ended && w.t > 1) {
        const st = useStore.getState();
        if (st.screen === 'playing') st.setPaused(true);
      }
    };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    window.addEventListener('mousedown', md); window.addEventListener('mouseup', mu);
    window.addEventListener('mousemove', mm); window.addEventListener('contextmenu', ctx);
    document.addEventListener('pointerlockchange', plc);
    lockPointer();
    return () => {
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
      window.removeEventListener('mousedown', md); window.removeEventListener('mouseup', mu);
      window.removeEventListener('mousemove', mm); window.removeEventListener('contextmenu', ctx);
      document.removeEventListener('pointerlockchange', plc);
      audio.stopEngine();
      if (document.pointerLockElement) document.exitPointerLock();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ───────────── helpers ─────────────
  function notify(text: string, color = '#38bdf8') { useStore.getState().pushNotification(text, color); }

  function cycleWeapon(slot: 'primary' | 'secondary') {
    const p = w.player;
    const list = slot === 'primary' ? p.primaries : p.secondaries;
    if (list.length < 2) return;
    const cur = slot === 'primary' ? p.primaryId : p.secondaryId;
    const next = list[(list.indexOf(cur) + 1) % list.length];
    if (slot === 'primary') p.primaryId = next; else p.secondaryId = next;
    p.charge = 0; p.charging = false;
    audio.click(); notify(`${slot === 'primary' ? 'Primary' : 'Secondary'}: ${WEAPON_BY_ID[next].name}`, '#facc15');
  }

  function spawnExplosion(pos: THREE.Vector3, color: string, count: number, speed = 26, size = 1) {
    const mult = settings.quality === 'low' ? 0.4 : settings.quality === 'medium' ? 0.7 : 1;
    const n = Math.round(count * mult);
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      if (w.particles.length > 900) break;
      const dir = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
      const life = rand(0.4, 1.3);
      w.particles.push({ pos: pos.clone(), vel: dir.multiplyScalar(rand(speed * 0.2, speed)), life, maxLife: life, color: c.clone().offsetHSL(rand(-0.05, 0.05), 0, rand(-0.15, 0.25)), size: rand(0.5, 1.4) * size });
    }
    if (count >= 26) w.rings.push({ pos: pos.clone(), t: 0, max: rand(30, 60) * size, color });
    if (flashRef.current) { flashRef.current.position.copy(pos); flashRef.current.color.set(color); flashRef.current.intensity = 160; }
  }

  function fireProj(friendly: boolean, from: THREE.Vector3, dir: THREE.Vector3, def: Partial<Proj> & { damage: number; speed: number; color: string }) {
    w.projs.push({
      active: true, friendly, pos: from.clone(), vel: dir.clone().normalize().multiplyScalar(def.speed),
      life: (def as any).range ? (def as any).range / def.speed : 4, damage: def.damage, color: def.color,
      size: def.size ?? 0.35, aoe: def.aoe ?? 0, homing: def.homing ?? 0, targetId: def.targetId ?? -1,
      shieldMult: def.shieldMult ?? 1, hullMult: def.hullMult ?? 1, kind: def.kind ?? 'projectile',
      bounces: def.bounces ?? 0, speed: def.speed, emp: def.emp ?? false, lastHitId: -1,
    });
  }

  function playerForward(): THREE.Vector3 {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(w.player.pitch, w.player.yaw, 0, 'YXZ'));
    return new THREE.Vector3(0, 0, -1).applyQuaternion(q);
  }

  function nearestEnemyTo(pos: THREE.Vector3, maxDist = 1e9, excludeId = -1): Ent | null {
    let best: Ent | null = null, bd = maxDist;
    w.enemies.forEach((e: Ent) => { if (e.id === excludeId) return; const d = e.pos.distanceTo(pos); if (d < bd) { bd = d; best = e; } });
    return best;
  }

  function dropPickup(pos: THREE.Vector3) {
    if (Math.random() > 0.22) return;
    const kinds = ['repair', 'energy', 'ammo', 'credits', 'ult'] as const;
    const pk: Pickup = { id: w.nextId++, kind: kinds[Math.floor(Math.random() * kinds.length)], pos: pos.clone() };
    setPickups(prev => [...prev.slice(-14), pk]);
    w.pickupList = [...(w.pickupList ?? []), pk];
  }

  function damageEnemy(e: Ent, dmg: number, shieldMult: number, hullMult: number, hitPos: THREE.Vector3, emp = false) {
    const res = applyDamage(e.hp, dmg, shieldMult, hullMult);
    e.hp = res.next; e.lastHit = w.t;
    if (emp) { e.disabled = Math.max(e.disabled, 3); }
    if (res.shieldDamage > 0 && res.hullDamage === 0) audio.shieldHit(); else audio.hullHit();
    spawnExplosion(hitPos, res.hullDamage > 0 ? '#fb923c' : e.def.color, res.hullDamage > 0 ? 6 : 3, 12, 0.6);
    w.player.hits++; w.player.ult = clamp(w.player.ult + dmg * 0.06, 0, 100);
    w.hitmark = w.t;
    if (res.killed) killEnemy(e);
  }

  function killEnemy(e: Ent) {
    w.enemies.delete(e.id);
    setRoster(prev => prev.filter(r => r.id !== e.id));
    w.kills++; w.combo++; w.comboT = 5;
    const mult = 1 + Math.min(2, w.combo * 0.06);
    const gained = Math.round(e.def.score * mult);
    w.score += gained; w.creditsEarned += e.def.credits;
    w.player.ult = clamp(w.player.ult + 5, 0, 100);
    spawnExplosion(e.pos, e.def.color, e.def.behavior === 'heavy' || e.def.behavior === 'carrier' ? 60 : 30, 30, e.def.scale);
    audio.explosion(e.def.scale > 1.4);
    const d = e.pos.distanceTo(w.player.pos);
    if (d < 90) w.shake = Math.min(1.2, w.shake + (1 - d / 90) * 0.5);
    dropPickup(e.pos);
    if (e.def.behavior === 'kamikaze' && d < 26) damagePlayer(26, e.pos);
  }

  function damagePlayer(dmg: number, fromPos?: THREE.Vector3) {
    const p = w.player;
    if (p.barrier > 0 || w.phase !== 'combat' || w.ended) return;
    const res = applyDamage(p.hp, dmg, 1, 1);
    p.hp = res.next; p.lastDamageAt = w.t;
    w.dmgFlash = w.t; w.shake = Math.min(1.4, w.shake + 0.35);
    audio.playerHit();
    if (fromPos) spawnExplosion(p.pos, '#f87171', 5, 10, 0.7);
    if (res.killed) endMission(false);
  }

  function damageBoss(dmg: number, shieldMult: number, hullMult: number, hitPos: THREE.Vector3, emp = false) {
    const b = w.boss; if (!b || b.dead) return;
    // weak-point core: hits near the front core do +50%
    const corePos = b.pos.clone().add(new THREE.Vector3(0, 0, -b.def.scale * 1.1).applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(w.player.pos.x - b.pos.x, w.player.pos.z - b.pos.z), 0))));
    const crit = hitPos.distanceTo(corePos) < b.def.scale * 1.5 && b.hp.shield <= 0;
    const res = applyDamage(b.hp, dmg * (crit ? 1.5 : 1), shieldMult, hullMult);
    b.hp = res.next; b.lastDamageAt = w.t;
    if (emp) b.hp.shield = Math.max(0, b.hp.shield - dmg * 2);
    w.player.hits++; w.hitmark = w.t; w.player.ult = clamp(w.player.ult + dmg * 0.03, 0, 100);
    spawnExplosion(hitPos, crit ? '#fde047' : b.def.color, crit ? 12 : 5, 18, 1.2);
    if (res.shieldDamage > 0 && res.hullDamage === 0) audio.shieldHit(); else audio.hullHit();
    const frac = b.hp.hull / b.hp.maxHull;
    const ph = bossPhase(frac);
    if (ph !== b.phase) {
      b.phase = ph;
      notify(`${b.def.name} — PHASE ${ph}${ph === 3 ? ' — ENRAGED' : ''}`, '#f87171');
      audio.bossAlarm(); w.shake = Math.min(1.5, w.shake + 0.6);
      b.hp.shield = Math.min(b.hp.maxShield, b.hp.shield + b.hp.maxShield * 0.35);
      spawnWaveGroup(2, true);
    }
    if (res.killed) killBoss();
  }

  function killBoss() {
    const b = w.boss; if (!b) return;
    b.dead = true;
    w.score += 5000; w.creditsEarned += b.def.reward; w.bossKilled = true;
    for (let i = 0; i < 7; i++) spawnExplosion(b.pos.clone().add(new THREE.Vector3(rand(-14, 14), rand(-6, 6), rand(-18, 18))), i % 2 ? b.def.color : '#fdba74', 50, 40, 2.4);
    w.rings.push({ pos: b.pos.clone(), t: 0, max: 260, color: b.def.color });
    audio.explosion(true); setTimeout(() => audio.explosion(true), 350);
    w.shake = 1.6;
    notify(`${b.def.name} DESTROYED`, '#facc15');
    w.boss = null; setBossDef(null);
    // clear remaining minions in shockwave
    [...w.enemies.values()].forEach((e: Ent) => { if (e.pos.distanceTo(b.pos) < 200) killEnemy(e); });
    if (config.kind === 'bossrush') {
      if (w.bossQueue.length > 0) {
        w.player.hp.hull = Math.min(w.player.hp.maxHull, w.player.hp.hull + w.player.hp.maxHull * 0.4);
        w.player.hp.shield = w.player.hp.maxShield;
        notify('Hull patched +40%. Next boss incoming…', '#4ade80');
        w.waveState = 'pending'; w.phaseT = 0;
      } else endMission(true);
    } else if (config.type === 'boss' || config.type === 'defense') {
      endMission(true);
    }
  }

  function spawnEnemy(defId: string, nearPos?: THREE.Vector3) {
    const def = ENEMY_BY_ID[defId];
    const diff = config.difficulty * (1 + (w.wave - 1) * 0.07);
    const a = Math.random() * Math.PI * 2;
    const base = nearPos ?? w.player.pos;
    const pos = base.clone().add(new THREE.Vector3(Math.cos(a) * rand(190, 320), rand(-70, 70), Math.sin(a) * rand(190, 320)));
    pos.x = clamp(pos.x, -ARENA, ARENA); pos.z = clamp(pos.z, -ARENA, ARENA); pos.y = clamp(pos.y, -260, 260);
    const hull = def.hull * (0.8 + diff * 0.22), shield = def.shield * (0.8 + diff * 0.2);
    const e: Ent = {
      id: w.nextId++, def, pos, vel: V3(), quat: new THREE.Quaternion(),
      hp: { hull, maxHull: hull, shield, maxShield: shield, armor: def.behavior === 'heavy' ? 3 : 0 },
      fireCd: rand(0.5, 1.6), stateT: rand(1, 3), seed: Math.random() * 100, disabled: 0, lastHit: -99,
      spawnCd: 5, teleportCd: rand(2, 5),
      targetKind: config.type === 'defense' && Math.random() < 0.55 ? 'station' : config.type === 'escort' && Math.random() < 0.5 ? 'ally' : 'player',
      radius: 2.6 * def.scale,
    };
    w.enemies.set(e.id, e);
    setRoster(prev => [...prev, { id: e.id, defId }]);
    spawnExplosion(pos, def.color, 8, 10, 1);
    return e;
  }

  function waveComposition(waveNum: number): string[] {
    const d = config.difficulty + waveNum * 0.35;
    const comp: string[] = [];
    const n = Math.min(4 + waveNum * 2, 14);
    const pool: string[] = ['scout', 'scout', 'interceptor'];
    if (d > 1.3) pool.push('kamikaze', 'lancer');
    if (d > 1.9) pool.push('lancer', 'wraith', 'gunship');
    if (d > 2.6) pool.push('wraith', 'beamship', 'cruiser');
    if (d > 3.4) pool.push('carrier', 'gunship', 'beamship');
    for (let i = 0; i < n; i++) comp.push(pool[Math.floor(Math.random() * pool.length)]);
    return comp;
  }

  function spawnWaveGroup(count: number, nearBoss = false) {
    const comp = waveComposition(Math.max(1, w.wave));
    for (let i = 0; i < count; i++) spawnEnemy(comp[Math.floor(Math.random() * comp.length)], nearBoss && w.boss ? w.boss.pos : undefined);
  }

  function startNextWave() {
    w.wave++;
    const comp = waveComposition(w.wave);
    comp.forEach(id => spawnEnemy(id));
    w.waveState = 'active';
    notify(config.kind === 'survival' || config.kind === 'endless' || w.wave > config.waves ? `WAVE ${w.wave} — ${comp.length} hostiles` : `Wave ${w.wave} of ${config.waves} — ${comp.length} hostiles`, '#f97316');
    // mid-mission comms (campaign, second wave)
    if (config.kind === 'campaign' && w.wave === 2 && config.missionId) {
      const dlg = MISSIONS.find(mm => mm.id === config.missionId)?.dialogue?.[1];
      if (dlg) { useStore.getState().setDialogue(dlg); setTimeout(() => useStore.getState().setDialogue(null), 6500); }
    }
    audio.warning();
  }

  function spawnBoss(bossId: string) {
    const def = BOSS_BY_ID[bossId];
    const diff = config.difficulty;
    const hull = def.hull * (0.65 + diff * 0.14), shield = def.shield * (0.65 + diff * 0.13);
    w.boss = {
      def, pos: w.player.pos.clone().add(new THREE.Vector3(0, 20, -420)), vel: V3(),
      hp: { hull, maxHull: hull, shield, maxShield: shield, armor: 2 },
      patternT: 2, patternIdx: 0, fireT: 1, phase: 1, telegraph: 0, lastDamageAt: -99, dead: false,
    };
    setBossDef(def);
    w.phase = 'boss-intro'; w.phaseT = 0;
    audio.bossAlarm(); audio.setMusic('boss');
    useStore.getState().setDialogue({ speaker: def.name, text: `${def.title}. ${def.quote}` });
    setTimeout(() => useStore.getState().setDialogue(null), 6000);
  }

  // ───────────── weapons ─────────────
  function firePrimary(dt: number) {
    const p = w.player;
    const def = WEAPON_BY_ID[p.primaryId];
    p.fireCd -= dt;
    const rate = def.fireRate * (p.overdrive > 0 ? 1.6 : 1);
    if (def.kind === 'charge') {
      if (w.mouseL && p.energy >= 4) { p.charging = true; p.charge = clamp(p.charge + dt / (def.chargeTime ?? 1), 0, 1); }
      return;
    }
    if (!w.mouseL || p.fireCd > 0) { if (!w.mouseL) w.beam = null; return; }
    if (p.energy < def.energyCost) { w.beam = null; return; }
    p.energy -= def.energyCost;
    p.fireCd = 1 / rate;
    const fwd = playerForward();
    const origin = p.pos.clone().add(fwd.clone().multiplyScalar(3));

    if (def.kind === 'beam') {
      // hitscan beam
      let hitPos = origin.clone().add(fwd.clone().multiplyScalar(def.range));
      let bestD = def.range; let hitEnt: Ent | null = null; let hitBoss = false;
      w.enemies.forEach((e: Ent) => {
        const to = e.pos.clone().sub(origin); const along = to.dot(fwd);
        if (along > 0 && along < bestD) { const perp = to.clone().sub(fwd.clone().multiplyScalar(along)).length(); if (perp < e.radius + 2.2) { bestD = along; hitEnt = e; hitPos = e.pos.clone(); } }
      });
      if (w.boss) {
        const to = w.boss.pos.clone().sub(origin); const along = to.dot(fwd);
        if (along > 0 && along < bestD + 30) { const perp = to.clone().sub(fwd.clone().multiplyScalar(along)).length(); if (perp < w.boss.def.scale * 3.4) { hitBoss = true; hitEnt = null; hitPos = origin.clone().add(fwd.clone().multiplyScalar(Math.max(4, along - w.boss.def.scale * 2))); } }
      }
      w.beam = { to: hitPos, color: def.color };
      const dps = def.damage * stats.damageMult / rate;
      if (hitEnt) damageEnemy(hitEnt, dps, def.shieldMult, def.hullMult, hitPos);
      else if (hitBoss) damageBoss(dps, def.shieldMult, def.hullMult, hitPos);
      p.shots++; audio.shoot('beam');
      return;
    }

    if (def.kind === 'arc') {
      // chain lightning to nearest in cone, then chain
      let current: Ent | null = null; let bd = def.range;
      w.enemies.forEach((e: Ent) => {
        const to = e.pos.clone().sub(p.pos); const d = to.length();
        if (d < bd && to.normalize().dot(fwd) > 0.55) { bd = d; current = e; }
      });
      const pts: THREE.Vector3[] = [origin.clone()];
      let dmg = def.damage * stats.damageMult;
      const hitIds = new Set<number>();
      let from = p.pos.clone();
      for (let chain = 0; chain < 4 && current; chain++) {
        const e: Ent = current;
        pts.push(e.pos.clone());
        damageEnemy(e, dmg, def.shieldMult, def.hullMult, e.pos);
        hitIds.add(e.id); from = e.pos; dmg *= 0.72;
        current = nearestEnemyTo(from, 120, -1);
        if (current && hitIds.has((current as Ent).id)) current = null;
      }
      if (w.boss && w.boss.pos.distanceTo(p.pos) < def.range && w.boss.pos.clone().sub(p.pos).normalize().dot(fwd) > 0.5) {
        pts.push(w.boss.pos.clone()); damageBoss(def.damage * stats.damageMult, def.shieldMult, def.hullMult, w.boss.pos);
      }
      if (pts.length > 1) w.arcs.push({ pts, t: 0 });
      p.shots++; audio.shoot('arc');
      return;
    }

    // projectile weapons with assisted aim
    let aimDir = fwd.clone();
    let bestAim: THREE.Vector3 | null = null; let bestDot = 0.985;
    w.enemies.forEach((e: Ent) => {
      const to = e.pos.clone().sub(p.pos); const d = to.length();
      if (d < def.range) { const dot = to.normalize().dot(fwd); if (dot > bestDot) { bestDot = dot; bestAim = to; } }
    });
    if (w.boss) { const to = w.boss.pos.clone().sub(p.pos); if (to.length() < def.range + 200 && to.normalize().dot(fwd) > 0.96) bestAim = to; }
    if (bestAim) aimDir = aimDir.lerp((bestAim as THREE.Vector3).clone().normalize(), 0.65).normalize();

    for (let i = 0; i < def.projectiles; i++) {
      const dir = aimDir.clone();
      dir.x += rand(-def.spread, def.spread); dir.y += rand(-def.spread, def.spread); dir.z += rand(-def.spread, def.spread);
      const side = def.projectiles > 1 ? (i === 0 ? -1 : 1) : 0;
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(p.pitch, p.yaw, 0, 'YXZ')));
      fireProj(true, origin.clone().add(right.multiplyScalar(side * 1.1)), dir, {
        damage: def.damage * stats.damageMult, speed: def.speed, color: def.color, size: def.size,
        aoe: def.aoe, shieldMult: def.shieldMult, hullMult: def.hullMult, kind: def.kind,
        bounces: def.kind === 'ricochet' ? 2 : 0, range: def.range,
      } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      p.shots++;
    }
    audio.shoot(def.kind);
    w.shake = Math.min(1, w.shake + (def.damage > 25 ? 0.16 : 0.03));
  }

  function releaseCharge() {
    const p = w.player;
    const def = WEAPON_BY_ID[p.primaryId];
    if (def.kind !== 'charge' || !p.charging) return;
    p.charging = false;
    if (p.charge < 0.15) { p.charge = 0; return; }
    const dmg = def.damage * stats.damageMult * (0.3 + p.charge * 1.1);
    p.energy = Math.max(0, p.energy - def.energyCost * p.charge);
    const fwd = playerForward();
    fireProj(true, p.pos.clone().add(fwd.clone().multiplyScalar(3)), fwd, { damage: dmg, speed: def.speed, color: def.color, size: def.size * (0.8 + p.charge), aoe: def.aoe, shieldMult: def.shieldMult, hullMult: def.hullMult, kind: 'charge', range: def.range } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    p.shots++; p.charge = 0;
    audio.shoot('charge'); w.shake = Math.min(1.2, w.shake + 0.3);
  }

  function updateLockOn(dt: number) {
    const p = w.player;
    const def = WEAPON_BY_ID[p.secondaryId];
    if (!w.mouseR || (def.kind !== 'homing' && def.kind !== 'singularity')) {
      if (!w.mouseR) { p.lockProgress = Math.max(0, p.lockProgress - dt * 2); if (p.lockProgress === 0) p.lockTarget = -1; }
      return;
    }
    // find best target near reticle
    const fwd = playerForward();
    let bestId = -1, bestDot = 0.9;
    w.enemies.forEach((e: Ent) => {
      const to = e.pos.clone().sub(p.pos); const d = to.length();
      if (d < 950) { const dot = to.normalize().dot(fwd); if (dot > bestDot) { bestDot = dot; bestId = e.id; } }
    });
    if (w.boss && w.boss.pos.clone().sub(p.pos).normalize().dot(fwd) > 0.85) bestId = -999;
    if (bestId !== p.lockTarget) { p.lockTarget = bestId; p.lockProgress = 0; }
    if (bestId !== -1) {
      p.lockProgress = clamp(p.lockProgress + dt * 1.15, 0, 1);
      w.lockBeepT -= dt;
      if (w.lockBeepT <= 0) { audio.lock(p.lockProgress); w.lockBeepT = p.lockProgress >= 1 ? 0.4 : 0.16; if (p.lockProgress >= 1) audio.locked(); }
    }
  }

  function releaseSecondary() {
    const p = w.player;
    if (useStore.getState().screen !== 'playing' || w.ended) return;
    const def = WEAPON_BY_ID[p.secondaryId];
    if (def.kind !== 'homing' && def.kind !== 'singularity') return;
    fireSecondary(def);
  }

  function fireSecondary(def: WeaponDef) {
    const p = w.player;
    if (p.secCd > 0) return;
    if (def.ammo >= 0 && p.ammo[def.id] <= 0) { notify(`${def.name} — NO AMMO. Press R to cycle.`, '#f87171'); audio.denied(); return; }
    p.secCd = 1 / def.fireRate;
    if (def.ammo >= 0) p.ammo[def.id]--;
    const fwd = playerForward();
    const locked = p.lockProgress >= 0.7 ? p.lockTarget : -1;
    for (let i = 0; i < def.projectiles; i++) {
      const dir = fwd.clone();
      dir.x += rand(-def.spread, def.spread) + (i - (def.projectiles - 1) / 2) * 0.03;
      dir.y += rand(-def.spread, def.spread);
      dir.z += rand(-def.spread, def.spread);
      fireProj(true, p.pos.clone().add(fwd.clone().multiplyScalar(3)), dir, {
        damage: def.damage * stats.damageMult, speed: def.speed, color: def.color, size: def.size,
        aoe: def.aoe, homing: def.homing, targetId: locked, shieldMult: def.shieldMult, hullMult: def.hullMult,
        kind: def.kind, range: def.range, emp: def.id === 'emp-missile',
      } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      p.shots++;
    }
    audio.missile();
    if (locked !== -1) notify('Missile away — tracking', '#fb923c');
  }

  function fireSecondaryHeld(dt: number) {
    const p = w.player;
    p.secCd -= dt;
    const def = WEAPON_BY_ID[p.secondaryId];
    if (def.kind === 'homing' || def.kind === 'singularity') return; // released-based
    if (w.mouseR && p.secCd <= 0) fireSecondary(def);
  }

  // ───────────── abilities ─────────────
  function triggerAbility() {
    const p = w.player;
    if (useStore.getState().screen !== 'playing' || w.ended) return;
    if (p.abilityCd > 0) { audio.denied(); return; }
    const ability = stats.ship.ability;
    const info = ABILITY_INFO[ability];
    p.abilityCd = info.cooldown * stats.abilityCdMult;
    audio.ability();
    const fwd = playerForward();
    switch (ability) {
      case 'overdrive': p.overdrive = 5; notify('AFTERBURNER OVERDRIVE', '#38bdf8'); break;
      case 'barrier': p.barrier = 4; notify('BARRIER DOME ACTIVE', '#facc15'); break;
      case 'cloak': p.cloak = 5; notify('TACTICAL CLOAK ENGAGED', '#a78bfa'); break;
      case 'phase': {
        spawnExplosion(p.pos, stats.ship.accent, 16, 14, 1);
        p.pos.add(fwd.multiplyScalar(95));
        p.pos.x = clamp(p.pos.x, -ARENA, ARENA); p.pos.z = clamp(p.pos.z, -ARENA, ARENA);
        spawnExplosion(p.pos, stats.ship.accent, 16, 14, 1);
        audio.teleport(); notify('PHASE SHIFT', '#fde047'); break;
      }
      case 'emp': {
        audio.emp(); w.rings.push({ pos: p.pos.clone(), t: 0, max: 140, color: '#67e8f9' });
        w.enemies.forEach((e: Ent) => { if (e.pos.distanceTo(p.pos) < 140) { e.disabled = 3.5; e.hp.shield = 0; spawnExplosion(e.pos, '#67e8f9', 10, 12, 0.8); } });
        if (w.boss && w.boss.pos.distanceTo(p.pos) < 160) w.boss.hp.shield = Math.max(0, w.boss.hp.shield - 250);
        notify('EMP BURST', '#67e8f9'); break;
      }
      case 'orbital': {
        const target = nearestEnemyTo(p.pos.clone().add(fwd.clone().multiplyScalar(120)), 500);
        const center = target ? target.pos.clone() : p.pos.clone().add(fwd.clone().multiplyScalar(130));
        for (let i = 0; i < 8; i++) {
          setTimeout(() => {
            if (w.ended) return;
            const at = center.clone().add(new THREE.Vector3(rand(-40, 40), rand(-15, 15), rand(-40, 40)));
            spawnExplosion(at, '#fb923c', 34, 34, 1.8); audio.explosion(true);
            w.enemies.forEach((e: Ent) => { if (e.pos.distanceTo(at) < 46) damageEnemy(e, 90 * stats.damageMult, 1, 1.2, e.pos); });
            if (w.boss && w.boss.pos.distanceTo(at) < 70) damageBoss(90 * stats.damageMult, 1, 1.2, at);
            w.shake = Math.min(1.2, w.shake + 0.25);
          }, i * 160);
        }
        notify('ORBITAL STRIKE INBOUND', '#fb923c'); break;
      }
      case 'drones': {
        const ids: number[] = [];
        for (let i = 0; i < 3; i++) { const id = w.nextId++; w.drones.push({ id, pos: p.pos.clone().add(new THREE.Vector3(rand(-6, 6), rand(-4, 4), rand(-6, 6))), fireCd: rand(0.2, 0.8), life: 20 }); ids.push(id); }
        setDroneIds(prev => [...prev, ...ids]);
        notify('DRONE SWARM DEPLOYED', '#34d399'); break;
      }
      case 'timefracture': w.timeFracture = 5; notify('TIME FRACTURE', '#e879f9'); w.rings.push({ pos: p.pos.clone(), t: 0, max: 300, color: '#e879f9' }); break;
      case 'repair': p.repairPool = p.hp.maxHull * 0.3; notify('REPAIR NANITES RELEASED', '#4ade80'); break;
      case 'gravity': {
        const center = p.pos.clone().add(fwd.clone().multiplyScalar(120));
        w.gravityWell = { pos: center, t: 4 };
        w.rings.push({ pos: center, t: 0, max: 120, color: '#c084fc' });
        notify('GRAVITY SNARE', '#c084fc'); break;
      }
    }
  }

  function triggerUltimate() {
    const p = w.player;
    if (useStore.getState().screen !== 'playing' || w.ended) return;
    if (p.ult < 100) { audio.denied(); notify(`Ultimate at ${Math.round(p.ult)}% — keep fighting`, '#94a3b8'); return; }
    p.ult = 0;
    useStore.getState().updateSave(s => ({ ...s, stats: { ...s.stats, ultsUsed: (s.stats.ultsUsed ?? 0) + 1 } }));
    audio.ultimate();
    notify('★ STARFALL PROTOCOL ★', '#facc15');
    w.rings.push({ pos: p.pos.clone(), t: 0, max: 200, color: '#facc15' });
    // nova damage
    w.enemies.forEach((e: Ent) => { if (e.pos.distanceTo(p.pos) < 190) damageEnemy(e, 130 * stats.damageMult, 1.3, 1.3, e.pos); });
    if (w.boss && w.boss.pos.distanceTo(p.pos) < 230) damageBoss(320 * stats.damageMult, 1.3, 1.3, w.boss.pos);
    // homing missile rain on every enemy
    const targets = [...w.enemies.values()] as Ent[];
    targets.slice(0, 14).forEach((e, i) => {
      setTimeout(() => {
        if (w.ended) return;
        const dir = new THREE.Vector3(rand(-1, 1), rand(0.4, 1), rand(-1, 1)).normalize();
        fireProj(true, p.pos.clone(), dir, { damage: 65 * stats.damageMult, speed: 180, color: '#facc15', size: 0.55, aoe: 12, homing: 4.2, targetId: e.id, shieldMult: 1.1, hullMult: 1.2, kind: 'homing', range: 1200 } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
        audio.missile();
      }, i * 110);
    });
    if (w.boss) for (let i = 0; i < 5; i++) setTimeout(() => { if (!w.ended) fireProj(true, p.pos.clone(), new THREE.Vector3(rand(-1, 1), rand(-0.5, 1), rand(-1, 1)).normalize(), { damage: 80 * stats.damageMult, speed: 180, color: '#facc15', size: 0.6, aoe: 14, homing: 3.6, targetId: -999, shieldMult: 1.1, hullMult: 1.25, kind: 'homing', range: 1400 } as any); }, i * 130); // eslint-disable-line @typescript-eslint/no-explicit-any
    w.shake = Math.min(1.4, w.shake + 0.5);
  }

  // ───────────── mission flow ─────────────
  function endMission(success: boolean) {
    if (w.ended) return;
    w.ended = true; w.phase = success ? 'victory' : 'defeat'; w.phaseT = 0;
    if (!success) { spawnExplosion(w.player.pos, '#f87171', 90, 36, 2); audio.explosion(true); audio.fail(); }
    else audio.success();
    const p = w.player;
    const accuracy = p.shots > 0 ? clamp(p.hits / p.shots, 0, 1) : 0;
    const hullFrac = clamp(p.hp.hull / p.hp.maxHull, 0, 1);
    const { grade, points } = missionRating(hullFrac, w.t, w.kills, accuracy);
    const baseCredits = success ? config.reward : Math.round(config.reward * 0.15);
    const creditsEarned = baseCredits + w.creditsEarned;
    const xpEarned = success ? config.xp + w.kills * 4 : Math.round(w.kills * 2);
    useStore.getState().updateSave(s => ({ ...s, stats: { ...s.stats, shotsFired: (s.stats.shotsFired ?? 0) + p.shots } }));
    setTimeout(() => {
      useStore.getState().finishMission({
        success, kills: w.kills, score: w.score + (success ? points : 0), time: w.t, accuracy,
        creditsEarned, xpEarned, grade: success ? grade : '—', points, bossKilled: !!w.bossKilled, newAchievements: [], hullFrac,
      });
    }, success ? 1600 : 2200);
  }

  function checkObjectives(dt: number) {
    if (w.ended) return;
    const alive = w.enemies.size;
    // wave flow for wave-based configs
    if (w.phase === 'combat' && !w.boss) {
      if (w.waveState === 'pending' || (w.waveState === 'active' && alive === 0)) {
        if (config.kind === 'survival' || config.kind === 'endless' || config.kind === 'asteroid' || config.kind === 'timeattack') {
          if (w.wave >= 1) { w.creditsEarned += 120 + w.wave * 30; w.player.hp.hull = Math.min(w.player.hp.maxHull, w.player.hp.hull + 8); }
          startNextWave();
        } else if (config.kind === 'bossrush') {
          if (w.bossQueue.length > 0) { spawnBoss(w.bossQueue.shift()!); }
        } else if (w.wave < config.waves || (config.type === 'survival-time' && w.t < config.timeLimit)) {
          startNextWave();
        } else if (config.bossId) {
          w.waveState = 'boss'; spawnBoss(config.bossId);
        } else if (config.type !== 'survival-time') {
          endMission(true); return;
        }
      }
    }
    // type-specific success/fail
    if (config.type === 'destroy' && config.kind !== 'campaign' && w.kills >= config.killTarget && config.killTarget > 0) { endMission(true); return; }
    if (config.kind === 'timeattack') {
      if (w.kills >= config.killTarget) { endMission(true); return; }
      if (w.t > config.timeLimit) { endMission(false); return; }
    }
    if (config.type === 'survival-time' && w.t >= config.timeLimit && w.kills >= config.killTarget) { endMission(true); return; }
    if (config.kind === 'asteroid' && (w.kills + w.asteroidsDestroyed) >= config.killTarget) { endMission(true); return; }
    if (w.ally && w.ally.hp.hull <= 0) { notify('Transport destroyed!', '#f87171'); endMission(false); return; }
    if (w.station && w.station.hp.hull <= 0) { notify('Station destroyed!', '#f87171'); endMission(false); return; }
    void dt;
  }

  // ───────────── per-frame sim ─────────────
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpV = useMemo(() => new THREE.Vector3(), []);
  const tmpV2 = useMemo(() => new THREE.Vector3(), []);
  const tmpQ = useMemo(() => new THREE.Quaternion(), []);
  const tmpC = useMemo(() => new THREE.Color(), []);

  useFrame((state, rawDt) => {
    if (paused) return;
    const dt = Math.min(rawDt, 0.05);
    w.fpsAcc += rawDt; w.fpsN++; if (w.fpsAcc > 0.5) { w.fps = Math.round(w.fpsN / w.fpsAcc); w.fpsAcc = 0; w.fpsN = 0; }
    w.t += dt;
    w.phaseT += dt;
    const p = w.player;
    const enemyDt = dt * (w.timeFracture > 0 ? 0.35 : 1);
    if (w.timeFracture > 0) w.timeFracture -= dt;

    if (w.phase === 'intro' && w.phaseT > 2.4) {
      w.phase = 'combat'; w.phaseT = 0;
      if (!w.dialogueShown) {
        w.dialogueShown = true;
        notify(config.objectiveText, '#facc15');
        if (config.kind === 'campaign' && config.missionId) {
          const dlg = MISSIONS.find(mm => mm.id === config.missionId)?.dialogue?.[0];
          if (dlg) { useStore.getState().setDialogue(dlg); setTimeout(() => useStore.getState().setDialogue(null), 7000); }
        }
      }
    }
    if (w.phase === 'boss-intro' && w.phaseT > 3) { w.phase = 'combat'; w.phaseT = 0; }

    // ── player flight ──
    const sens = 0.0022 * settings.sensitivity;
    const yawRate = -w.mouseDX * sens; w.mouseDX = 0;
    const pitchRate = (settings.invertY ? w.mouseDY : -w.mouseDY) * sens; w.mouseDY = 0;
    p.yaw += clamp(yawRate, -0.09, 0.09) * stats.maneuver;
    p.pitch = clamp(p.pitch + clamp(pitchRate, -0.09, 0.09) * stats.maneuver, -1.35, 1.35);
    p.roll = THREE.MathUtils.lerp(p.roll, clamp(-yawRate * 26, -1.1, 1.1) + (w.keys.has('KeyA') ? 0.35 : 0) - (w.keys.has('KeyD') ? 0.35 : 0), 0.12);

    tmpQ.setFromEuler(new THREE.Euler(p.pitch, p.yaw, 0, 'YXZ'));
    const fwd = tmpV.set(0, 0, -1).applyQuaternion(tmpQ).clone();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(tmpQ);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(tmpQ);
    const boosting = (w.keys.has('ShiftLeft') || w.keys.has('ShiftRight')) && p.boost > 1 && (w.keys.has('KeyW'));
    const speedMax = stats.speed * (boosting ? 2.05 : 1) * (p.overdrive > 0 ? 1.7 : 1);
    const thrustVec = new THREE.Vector3();
    if (w.keys.has('KeyW')) thrustVec.add(fwd);
    if (w.keys.has('KeyS')) thrustVec.addScaledVector(fwd, -0.55);
    if (w.keys.has('KeyA')) thrustVec.addScaledVector(right, -0.8);
    if (w.keys.has('KeyD')) thrustVec.addScaledVector(right, 0.8);
    if (w.keys.has('Space')) thrustVec.addScaledVector(up, 0.8);
    if (w.keys.has('ControlLeft') || w.keys.has('KeyC')) thrustVec.addScaledVector(up, -0.8);
    if (thrustVec.lengthSq() > 0) p.vel.addScaledVector(thrustVec.normalize(), stats.accel * (boosting ? 1.7 : 1) * dt);
    p.vel.multiplyScalar(Math.pow(0.45, dt)); // damping — arcade feel
    if (p.vel.length() > speedMax) p.vel.setLength(speedMax);
    p.pos.addScaledVector(p.vel, dt);
    // arena bounds (soft pushback)
    const flat = Math.hypot(p.pos.x, p.pos.z);
    if (flat > ARENA) { p.pos.x *= ARENA / flat; p.pos.z *= ARENA / flat; if (Math.floor(w.t * 2) !== Math.floor((w.t - dt) * 2)) notify('⚠ Leaving combat zone — turn back', '#f87171'); }
    p.pos.y = clamp(p.pos.y, -300, 300);

    if (boosting) { p.boost = Math.max(0, p.boost - 26 * dt); if (Math.random() < 0.3) audio.boost(); }
    else p.boost = Math.min(stats.boost, p.boost + 11 * dt);
    p.energy = Math.min(stats.energy, p.energy + 16 * (1 + (save.upgrades.energy ?? 0) * 0.08) * dt);
    if (w.t - p.lastDamageAt > 4.5) p.hp.shield = Math.min(p.hp.maxShield, p.hp.shield + p.hp.maxShield * 0.09 * dt);
    if (p.repairPool > 0) { const amt = Math.min(p.repairPool, 22 * dt); p.hp.hull = Math.min(p.hp.maxHull, p.hp.hull + amt); p.repairPool -= amt; }
    p.abilityCd = Math.max(0, p.abilityCd - dt);
    p.cloak = Math.max(0, p.cloak - dt); p.barrier = Math.max(0, p.barrier - dt); p.overdrive = Math.max(0, p.overdrive - dt);
    w.comboT -= dt; if (w.comboT <= 0) w.combo = 0;
    audio.setEngine(clamp(p.vel.length() / (stats.speed * 2), 0, 1));

    // engine particles
    if ((w.keys.has('KeyW') || p.vel.length() > 8) && settings.quality !== 'low' && Math.random() < 0.7) {
      w.particles.push({ pos: p.pos.clone().addScaledVector(fwd, -3.4 * stats.ship.scale), vel: fwd.clone().multiplyScalar(-12).add(new THREE.Vector3(rand(-1.5, 1.5), rand(-1.5, 1.5), rand(-1.5, 1.5))), life: 0.5, maxLife: 0.5, color: new THREE.Color(stats.ship.accent), size: 0.55 });
    }

    if (playerRef.current) {
      playerRef.current.position.copy(p.pos);
      playerRef.current.quaternion.setFromEuler(new THREE.Euler(p.pitch, p.yaw, p.roll, 'YXZ'));
      playerRef.current.visible = !(w.ended && w.phase === 'defeat');
    }
    if (shieldBubbleRef.current) {
      const m = shieldBubbleRef.current.material as THREE.MeshBasicMaterial;
      const active = p.barrier > 0;
      const hit = w.t - p.lastDamageAt < 0.25 && p.hp.shield > 0;
      shieldBubbleRef.current.visible = active || hit;
      m.opacity = active ? 0.4 : 0.22;
      m.color.set(active ? '#facc15' : '#38bdf8');
      shieldBubbleRef.current.position.copy(p.pos);
    }

    // ── weapons ──
    if (w.phase === 'combat' && !w.ended) {
      firePrimary(dt);
      updateLockOn(dt);
      fireSecondaryHeld(dt);
    } else w.beam = null;

    // gravity well
    if (w.gravityWell) {
      w.gravityWell.t -= dt;
      w.enemies.forEach((e: Ent) => { const d = w.gravityWell.pos.clone().sub(e.pos); const dist = d.length(); if (dist < 170 && dist > 4) e.vel.addScaledVector(d.normalize(), 90 * dt); });
      if (w.gravityWell.t <= 0) w.gravityWell = null;
    }

    // ── ally / station ──
    if (w.ally) {
      w.ally.angle += dt * 0.045;
      const target = new THREE.Vector3(Math.cos(w.ally.angle) * 260, Math.sin(w.t * 0.2) * 18, Math.sin(w.ally.angle) * 260);
      const toT = target.clone().sub(w.ally.pos);
      w.ally.pos.addScaledVector(toT.normalize(), Math.min(11 * dt, toT.length()));
      if (allyRef.current) { allyRef.current.position.copy(w.ally.pos); allyRef.current.lookAt(target); allyRef.current.rotateY(Math.PI); }
      if (w.ally.hp.shield < w.ally.hp.maxShield) w.ally.hp.shield += 4 * dt;
    }
    if (w.station && stationRef.current) stationRef.current.position.copy(w.station.pos);

    // ── drones ──
    let dronesChanged = false;
    w.drones = w.drones.filter((d: any) => { d.life -= dt; if (d.life <= 0) { dronesChanged = true; spawnExplosion(d.pos, '#34d399', 8, 10, 0.7); return false; } return true; }); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (dronesChanged) setDroneIds(w.drones.map((d: any) => d.id)); // eslint-disable-line @typescript-eslint/no-explicit-any
    w.drones.forEach((d: any, i: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const anchor = p.pos.clone().add(new THREE.Vector3(Math.cos(w.t * 1.4 + i * 2.1) * 7, Math.sin(w.t * 1.8 + i) * 2.4, Math.sin(w.t * 1.4 + i * 2.1) * 7));
      d.pos.lerp(anchor, 0.06);
      const g = droneRefs.current.get(d.id);
      if (g) { g.position.copy(d.pos); g.rotation.y += dt * 3; }
      d.fireCd -= dt;
      if (d.fireCd <= 0) {
        const tgt = nearestEnemyTo(d.pos, 240);
        if (tgt) { fireProj(true, d.pos.clone(), tgt.pos.clone().sub(d.pos).normalize(), { damage: 7 * stats.damageMult, speed: 300, color: '#34d399', size: 0.3, range: 300 } as any); d.fireCd = 0.55; } // eslint-disable-line @typescript-eslint/no-explicit-any
        else d.fireCd = 0.3;
      }
    });

    // ── enemies AI ──
    const camCloak = p.cloak > 0;
    w.enemies.forEach((e: Ent) => {
      const edt = e.disabled > 0 ? dt * 0.15 : enemyDt;
      if (e.disabled > 0) { e.disabled -= dt; if (Math.random() < 0.15) spawnExplosion(e.pos, '#67e8f9', 2, 6, 0.5); }
      e.stateT -= edt; e.fireCd -= edt;
      // pick target position
      let targetPos = p.pos;
      if (e.targetKind === 'ally' && w.ally) targetPos = w.ally.pos;
      if (e.targetKind === 'station' && w.station) targetPos = w.station.pos;
      if (camCloak && e.targetKind === 'player') targetPos = tmpV2.set(Math.sin(e.seed + w.t * 0.3) * 200, Math.sin(e.seed * 2) * 60, Math.cos(e.seed + w.t * 0.3) * 200);
      const toT = targetPos.clone().sub(e.pos);
      const dist = toT.length();
      const dirT = toT.clone().normalize();
      const weave = new THREE.Vector3(Math.sin(w.t * 1.7 + e.seed), Math.sin(w.t * 2.3 + e.seed * 1.7) * 0.5, Math.cos(w.t * 1.4 + e.seed)).multiplyScalar(e.def.behavior === 'swarm' ? 0.85 : 0.45);
      let desired = dirT.clone();
      const beh = e.def.behavior;
      const standoff = beh === 'sniper' ? 240 : beh === 'heavy' || beh === 'carrier' ? 130 : beh === 'kamikaze' ? 0 : 62;
      if (dist < standoff * 0.7) desired.addScaledVector(dirT, -1.4); // back off / orbit
      else if (dist < standoff * 1.35) {
        // strafe orbit
        const orbit = new THREE.Vector3(-dirT.z, 0.25 * Math.sin(e.seed), dirT.x).normalize();
        desired.copy(orbit.multiplyScalar(Math.sin(e.seed) > 0 ? 1 : -1)).addScaledVector(dirT, 0.15);
      }
      desired.add(weave);
      // evade burst after being hit
      if (w.t - e.lastHit < 0.6 && beh !== 'kamikaze') desired.add(new THREE.Vector3(Math.sin(e.seed * 9), 0.8, Math.cos(e.seed * 7)).multiplyScalar(1.3));
      // retreat when crippled
      if (e.hp.hull / e.hp.maxHull < 0.22 && beh === 'fighter') desired.addScaledVector(dirT, -0.8);
      // separation from asteroids (cheap: push from arena center clutter ignored)
      const spd = e.def.speed * (e.disabled > 0 ? 0.25 : 1);
      e.vel.lerp(desired.normalize().multiplyScalar(spd), 1 - Math.pow(0.12, edt));
      e.pos.addScaledVector(e.vel, edt);
      e.pos.x = clamp(e.pos.x, -ARENA, ARENA); e.pos.z = clamp(e.pos.z, -ARENA, ARENA); e.pos.y = clamp(e.pos.y, -280, 280);
      // face velocity
      if (e.vel.lengthSq() > 1) {
        const m = new THREE.Matrix4().lookAt(e.pos, e.pos.clone().add(e.vel), new THREE.Vector3(0, 1, 0));
        e.quat.setFromRotationMatrix(m);
      }
      const g = enemyRefs.current.get(e.id);
      if (g) { g.position.copy(e.pos); g.quaternion.copy(e.quat); if (beh === 'kamikaze') g.rotation.z += dt * 4; }

      // kamikaze detonation
      if (beh === 'kamikaze' && e.targetKind === 'player' && dist < 11 && !camCloak) { damagePlayer(e.def.damage, e.pos); killEnemy(e); return; }
      if (beh === 'kamikaze' && e.targetKind !== 'player' && dist < 16) {
        const victim = e.targetKind === 'ally' ? w.ally : w.station;
        if (victim) victim.hp = applyDamage(victim.hp, e.def.damage * 1.6, 1, 1).next;
        killEnemy(e); return;
      }
      // teleporter blink
      if (beh === 'teleporter') {
        e.teleportCd -= edt;
        if (e.teleportCd <= 0) {
          spawnExplosion(e.pos, e.def.color, 10, 8, 0.8);
          e.pos.copy(p.pos).add(new THREE.Vector3(rand(-130, 130), rand(-40, 40), rand(-130, 130)));
          audio.teleport(); spawnExplosion(e.pos, e.def.color, 10, 8, 0.8);
          e.teleportCd = rand(3.5, 6);
        }
      }
      // carrier spawns drones
      if (beh === 'carrier') {
        e.spawnCd -= edt;
        if (e.spawnCd <= 0 && w.enemies.size < 26) { spawnEnemy('scout', e.pos); e.spawnCd = 6.5; }
      }
      // firing
      if (e.fireCd <= 0 && e.disabled <= 0 && w.phase === 'combat' && !w.ended && !(camCloak && e.targetKind === 'player')) {
        const range = beh === 'sniper' ? 560 : 330;
        if (dist < range) {
          e.fireCd = (1 / Math.max(0.15, e.def.fireRate)) * rand(0.8, 1.3) / Math.sqrt(config.difficulty);
          const inaccuracy = beh === 'heavy' ? 0.045 : 0.03;
          const lead = targetPos.clone();
          if (e.targetKind === 'player') lead.addScaledVector(p.vel, dist / 260 * 0.55);
          const shotDir = lead.sub(e.pos).normalize();
          shotDir.x += rand(-inaccuracy, inaccuracy); shotDir.y += rand(-inaccuracy, inaccuracy); shotDir.z += rand(-inaccuracy, inaccuracy);
          const isMissile = e.def.id === 'cruiser';
          fireProj(false, e.pos.clone().addScaledVector(shotDir, e.radius + 1), shotDir, {
            damage: e.def.damage * (0.7 + config.difficulty * 0.12), speed: isMissile ? 120 : 250,
            color: e.def.color, size: isMissile ? 0.55 : 0.34, aoe: isMissile ? 10 : 0,
            homing: isMissile ? 1.7 : 0, targetId: isMissile ? -1 : -2, // -1 = seek player for enemy missiles
            range: 800, kind: isMissile ? 'homing' : 'projectile',
          } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
          if (beh === 'heavy') { // burst
            for (let i = 0; i < 2; i++) { const d2 = shotDir.clone(); d2.x += rand(-0.06, 0.06); d2.y += rand(-0.06, 0.06); fireProj(false, e.pos.clone(), d2, { damage: e.def.damage * 0.7, speed: 250, color: e.def.color, size: 0.3, range: 700 } as any); } // eslint-disable-line @typescript-eslint/no-explicit-any
          }
          if (dist < 300) audio.shoot();
        } else e.fireCd = 0.3;
      }
      // shield regen
      if (w.t - e.lastHit > 6) e.hp.shield = Math.min(e.hp.maxShield, e.hp.shield + e.hp.maxShield * 0.05 * edt);
    });

    // ── boss AI ──
    if (w.boss) {
      const b = w.boss;
      const bdt = enemyDt;
      // slow stalk: keep ~220m from player
      const toP = p.pos.clone().sub(b.pos); const distP = toP.length();
      const want = distP > 260 ? toP.normalize() : distP < 150 ? toP.normalize().multiplyScalar(-0.6) : new THREE.Vector3(-toP.z, 0, toP.x).normalize().multiplyScalar(0.5);
      b.vel.lerp(want.multiplyScalar(b.def.speed * (b.phase === 3 ? 1.5 : 1)), 0.01);
      b.pos.addScaledVector(b.vel, bdt);
      b.pos.x = clamp(b.pos.x, -ARENA, ARENA); b.pos.z = clamp(b.pos.z, -ARENA, ARENA); b.pos.y = clamp(b.pos.y, -200, 200);
      if (bossRef.current) {
        bossRef.current.position.copy(b.pos);
        bossRef.current.lookAt(p.pos);
        bossRef.current.rotateY(Math.PI); // model nose is -Z; lookAt faces +Z to target
        const introScale = w.phase === 'boss-intro' ? clamp(w.phaseT / 2, 0.2, 1) : 1;
        bossRef.current.scale.setScalar(introScale);
      }
      if (w.t - b.lastDamageAt > 7) b.hp.shield = Math.min(b.hp.maxShield, b.hp.shield + b.hp.maxShield * 0.03 * bdt);
      if (w.phase === 'combat' && !w.ended) {
        b.patternT -= bdt;
        b.fireT -= bdt;
        const rateMult = b.phase === 3 ? 0.55 : b.phase === 2 ? 0.8 : 1;
        // continuous turret fire
        if (b.fireT <= 0) {
          b.fireT = 0.55 * rateMult;
          const dir = p.pos.clone().addScaledVector(p.vel, distP / 300 * 0.5).sub(b.pos).normalize();
          dir.x += rand(-0.03, 0.03); dir.y += rand(-0.03, 0.03);
          fireProj(false, b.pos.clone().add(new THREE.Vector3(rand(-10, 10), rand(-3, 5), rand(-8, 8))), dir, { damage: 9 + config.difficulty, speed: 270, color: b.def.color, size: 0.5, range: 1200 } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
        }
        if (b.patternT <= 0) {
          b.patternIdx = (b.patternIdx + 1) % b.def.patterns.length;
          const pattern = b.def.patterns[b.patternIdx];
          b.patternT = (pattern === 'spiral' ? 5 : pattern === 'siegecannon' ? 7 : 4.2) * rateMult + 1.2;
          b.currentPattern = pattern; b.currentPatternT = 0;
          if (pattern === 'missiles') {
            notify('⚠ Incoming missile volley', '#fb923c');
            for (let i = 0; i < 4 + b.phase * 2; i++) setTimeout(() => { if (w.boss && !w.ended) fireProj(false, b.pos.clone(), new THREE.Vector3(rand(-1, 1), rand(0.2, 1), rand(-1, 1)).normalize(), { damage: 20, speed: 130, color: '#fb923c', size: 0.6, aoe: 12, homing: 2.0, targetId: -1, range: 1400, kind: 'homing' } as any); }, i * 180); // eslint-disable-line @typescript-eslint/no-explicit-any
            audio.missile();
          } else if (pattern === 'spawn' || pattern === 'drones') {
            notify('Boss deploying reinforcements', '#f472b6');
            spawnWaveGroup(2 + b.phase, true);
          } else if (pattern === 'teleport') {
            spawnExplosion(b.pos, b.def.color, 40, 20, 2);
            b.pos.copy(p.pos).add(new THREE.Vector3(rand(-260, 260), rand(-60, 80), rand(-260, 260)));
            spawnExplosion(b.pos, b.def.color, 40, 20, 2);
            audio.teleport(); notify(`${b.def.name} phase-shifted!`, '#a78bfa');
          } else if (pattern === 'siegecannon') {
            b.telegraph = 1.6; notify('⚠⚠ SIEGE CANNON CHARGING — EVADE', '#ef4444'); audio.bossAlarm();
          } else if (pattern === 'beam') {
            b.telegraph = 1.1; notify('⚠ Beam weapon charging', '#f472b6');
          } else if (pattern === 'charge') {
            b.vel.copy(p.pos.clone().sub(b.pos).normalize().multiplyScalar(b.def.speed * 7));
            notify('⚠ It\'s charging you!', '#f87171');
          } else if (pattern === 'broadside' || pattern === 'barrage') {
            for (let i = 0; i < 14; i++) setTimeout(() => {
              if (!w.boss || w.ended) return;
              const dir = p.pos.clone().sub(b.pos).normalize(); dir.x += rand(-0.09, 0.09); dir.y += rand(-0.09, 0.09); dir.z += rand(-0.09, 0.09);
              fireProj(false, b.pos.clone().add(new THREE.Vector3(rand(-14, 14), rand(-4, 6), rand(-10, 10))), dir, { damage: 8, speed: 300, color: b.def.color, size: 0.45, range: 1200 } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
            }, i * 90);
          }
        }
        // ongoing spiral
        if (b.currentPattern === 'spiral') {
          b.currentPatternT = (b.currentPatternT ?? 0) + bdt;
          if (Math.floor(b.currentPatternT * 7) !== Math.floor((b.currentPatternT - bdt) * 7)) {
            const base = b.currentPatternT * 2.4;
            for (let k = 0; k < 3; k++) {
              const a = base + (k * Math.PI * 2) / 3;
              fireProj(false, b.pos.clone(), new THREE.Vector3(Math.cos(a), Math.sin(a * 1.3) * 0.35, Math.sin(a)), { damage: 8, speed: 150, color: b.def.color, size: 0.5, range: 1100 } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
            }
          }
        }
        // telegraph resolution
        if (b.telegraph > 0) {
          b.telegraph -= bdt;
          if (b.telegraph <= 0) {
            const dir = p.pos.clone().sub(b.pos).normalize();
            if (b.currentPattern === 'siegecannon') {
              fireProj(false, b.pos.clone().addScaledVector(dir, 16), dir, { damage: 65, speed: 420, color: '#fef08a', size: 2.2, aoe: 22, range: 1600 } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
              audio.shoot('charge'); w.shake = Math.min(1.4, w.shake + 0.4);
            } else if (b.currentPattern === 'beam') {
              // beam hits if player roughly in the line
              const along = p.pos.clone().sub(b.pos).dot(dir);
              const perp = p.pos.clone().sub(b.pos).sub(dir.clone().multiplyScalar(along)).length();
              for (let i = 0; i < 14; i++) spawnExplosion(b.pos.clone().addScaledVector(dir, i * 34), b.def.color, 3, 6, 1.4);
              if (along > 0 && perp < 15 && p.cloak <= 0) damagePlayer(38, b.pos);
              audio.shoot('beam');
            }
          }
        }
      }
    }

    // ── projectiles ──
    let missileThreat = false;
    for (const pr of w.projs as Proj[]) {
      if (!pr.active) continue;
      const pdt = pr.friendly ? dt : enemyDt;
      pr.life -= pdt;
      if (pr.life <= 0) { pr.active = false; if (pr.aoe > 0) explodeAoE(pr); continue; }
      // homing
      if (pr.homing > 0) {
        let tp: THREE.Vector3 | null = null;
        if (pr.friendly) {
          if (pr.targetId === -999 && w.boss) tp = w.boss.pos;
          else { const e = w.enemies.get(pr.targetId); if (e) tp = e.pos; else if (w.boss && Math.random() < 0.02) tp = w.boss.pos; }
          // singularity pulls enemies
          if (pr.kind === 'singularity') w.enemies.forEach((e: Ent) => { const d = pr.pos.clone().sub(e.pos); if (d.length() < 90) e.vel.addScaledVector(d.normalize(), 120 * pdt); });
        } else if (pr.targetId === -1) { tp = p.pos; if (pr.pos.distanceTo(p.pos) < 160) missileThreat = true; }
        else if (pr.targetId === -2) tp = null;
        if (tp) {
          const nv = homeVelocity([pr.pos.x, pr.pos.y, pr.pos.z], [pr.vel.x, pr.vel.y, pr.vel.z], [tp.x, tp.y, tp.z], pr.speed, pr.homing, pdt);
          pr.vel.set(nv[0], nv[1], nv[2]);
        }
      }
      pr.pos.addScaledVector(pr.vel, pdt);
      if (pr.kind === 'homing' || pr.kind === 'singularity') { /* trail */
        if (Math.random() < 0.6) w.particles.push({ pos: pr.pos.clone(), vel: new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)), life: 0.35, maxLife: 0.35, color: new THREE.Color(pr.color), size: 0.4 });
      }
      // collisions
      if (pr.friendly) {
        let consumed = false;
        for (const e of [...w.enemies.values()] as Ent[]) {
          if (e.id === pr.lastHitId) continue;
          if (pr.pos.distanceTo(e.pos) < e.radius + pr.size + 0.9) {
            if (pr.aoe > 0) explodeAoE(pr); else damageEnemy(e, pr.damage, pr.shieldMult, pr.hullMult, pr.pos, pr.emp);
            pr.lastHitId = e.id;
            if (pr.bounces > 0) {
              const next = nearestEnemyTo(pr.pos, 160, e.id);
              if (next) { pr.vel.copy(next.pos.clone().sub(pr.pos).normalize().multiplyScalar(pr.speed)); pr.bounces--; spawnExplosion(pr.pos, pr.color, 4, 8, 0.5); consumed = false; break; }
            }
            consumed = true; break;
          }
        }
        if (!consumed && w.boss && pr.pos.distanceTo(w.boss.pos) < w.boss.def.scale * 3.1 + pr.size) {
          if (pr.aoe > 0) explodeAoE(pr); else damageBoss(pr.damage, pr.shieldMult, pr.hullMult, pr.pos, pr.emp);
          consumed = true;
        }
        if (!consumed) {
          for (const a of w.asteroids as Asteroid[]) {
            if (!a.alive) continue;
            if (pr.pos.distanceTo(a.pos) < a.scale + pr.size) {
              a.hp -= pr.damage; spawnExplosion(pr.pos, '#a8a29e', 5, 10, 0.7);
              if (a.hp <= 0) { a.alive = false; w.asteroidsDestroyed++; w.score += 25; spawnExplosion(a.pos, '#d6d3d1', 26, 20, 1.4); audio.explosion(false); dropPickup(a.pos); }
              if (pr.aoe > 0) explodeAoE(pr);
              consumed = true; break;
            }
          }
        }
        if (consumed) pr.active = false;
      } else {
        // enemy projectile vs player / ally / station
        if (p.cloak <= 0 && pr.pos.distanceTo(p.pos) < 2.6 * stats.ship.scale + pr.size) {
          if (pr.aoe > 0) { explodeAoE(pr); } else damagePlayer(pr.damage, pr.pos);
          pr.active = false; continue;
        }
        if (w.ally && pr.pos.distanceTo(w.ally.pos) < 7) {
          w.ally.hp = applyDamage(w.ally.hp, pr.damage, 1, 1).next;
          spawnExplosion(pr.pos, '#a3e635', 5, 10, 0.8); pr.active = false; continue;
        }
        if (w.station && pr.pos.distanceTo(w.station.pos) < 17) {
          w.station.hp = applyDamage(w.station.hp, pr.damage, 1, 1).next;
          spawnExplosion(pr.pos, '#38bdf8', 5, 10, 0.8); pr.active = false; continue;
        }
        for (const a of w.asteroids as Asteroid[]) {
          if (a.alive && pr.pos.distanceTo(a.pos) < a.scale) { spawnExplosion(pr.pos, '#a8a29e', 3, 8, 0.5); pr.active = false; break; }
        }
      }
    }
    w.projs = (w.projs as Proj[]).filter(pr => pr.active);
    w.missileThreat = missileThreat;
    if (missileThreat) { w.warningT -= dt; if (w.warningT <= 0) { audio.warning(); w.warningT = 0.55; } }

    function explodeAoE(pr: Proj) {
      spawnExplosion(pr.pos, pr.color, pr.aoe > 20 ? 44 : 22, 26, pr.aoe > 20 ? 2 : 1.2);
      audio.explosion(pr.aoe > 18);
      if (pr.friendly) {
        [...w.enemies.values()].forEach((e: Ent) => { const d = e.pos.distanceTo(pr.pos); if (d < pr.aoe + e.radius) damageEnemy(e, pr.damage * (1 - d / (pr.aoe * 2.4)), pr.shieldMult, pr.hullMult, e.pos, pr.emp); });
        if (w.boss && w.boss.pos.distanceTo(pr.pos) < pr.aoe + w.boss.def.scale * 3) damageBoss(pr.damage, pr.shieldMult, pr.hullMult, pr.pos, pr.emp);
        (w.asteroids as Asteroid[]).forEach(a => { if (a.alive && a.pos.distanceTo(pr.pos) < pr.aoe + a.scale) { a.hp -= pr.damage; if (a.hp <= 0) { a.alive = false; w.asteroidsDestroyed++; spawnExplosion(a.pos, '#d6d3d1', 22, 18, 1.2); } } });
      } else {
        if (p.pos.distanceTo(pr.pos) < pr.aoe + 3) damagePlayer(pr.damage * 0.85, pr.pos);
        if (w.ally && w.ally.pos.distanceTo(pr.pos) < pr.aoe + 6) w.ally.hp = applyDamage(w.ally.hp, pr.damage, 1, 1).next;
        if (w.station && w.station.pos.distanceTo(pr.pos) < pr.aoe + 15) w.station.hp = applyDamage(w.station.hp, pr.damage, 1, 1).next;
      }
      const d = pr.pos.distanceTo(p.pos);
      if (d < 100) w.shake = Math.min(1.3, w.shake + (1 - d / 100) * 0.4);
    }

    // player vs enemies/asteroids collision
    w.enemies.forEach((e: Ent) => {
      if (e.pos.distanceTo(p.pos) < e.radius + 2.6 * stats.ship.scale) {
        if (e.def.behavior === 'kamikaze') { damagePlayer(e.def.damage, e.pos); killEnemy(e); }
        else { damagePlayer(10, e.pos); damageEnemy(e, 18, 1, 1, e.pos); p.vel.add(p.pos.clone().sub(e.pos).normalize().multiplyScalar(14)); }
      }
    });
    if (w.collideCd === undefined || w.t - w.collideCd > 0.7) {
      for (const a of w.asteroids as Asteroid[]) {
        if (a.alive && p.pos.distanceTo(a.pos) < a.scale + 2.4 * stats.ship.scale) {
          w.collideCd = w.t;
          damagePlayer(12 + p.vel.length() * 0.12, a.pos);
          p.vel.copy(p.pos.clone().sub(a.pos).normalize().multiplyScalar(Math.max(16, p.vel.length() * 0.5)));
          a.hp -= 25; if (a.hp <= 0) { a.alive = false; w.asteroidsDestroyed++; spawnExplosion(a.pos, '#d6d3d1', 24, 18, 1.3); }
          break;
        }
      }
    }

    // pickups
    if (w.pickupList?.length) {
      const remain: Pickup[] = [];
      let changed = false;
      for (const pk of w.pickupList as Pickup[]) {
        if (pk.pos.distanceTo(p.pos) < 9) {
          changed = true; audio.pickup();
          if (pk.kind === 'repair') { p.hp.hull = Math.min(p.hp.maxHull, p.hp.hull + p.hp.maxHull * 0.22); notify('+22% Hull repaired', '#4ade80'); }
          if (pk.kind === 'energy') { p.energy = stats.energy; p.boost = stats.boost; notify('Energy & boost restored', '#38bdf8'); }
          if (pk.kind === 'ammo') { Object.keys(p.ammo).forEach(k => { const wd = WEAPON_BY_ID[k]; if (wd.ammo > 0) p.ammo[k] = Math.min(wd.ammo, p.ammo[k] + Math.ceil(wd.ammo * 0.5)); }); notify('Secondary ammo restocked', '#fb923c'); }
          if (pk.kind === 'credits') { w.creditsEarned += 120; notify('+120 salvage credits', '#facc15'); }
          if (pk.kind === 'ult') { p.ult = clamp(p.ult + 35, 0, 100); notify('+35% Ultimate charge', '#e879f9'); }
          spawnExplosion(pk.pos, '#ffffff', 8, 8, 0.6);
        } else remain.push(pk);
      }
      w.pickupList = remain;
      if (changed) setPickups(remain);
    }

    checkObjectives(dt);

    // ── render: projectiles instanced ──
    const renderProjs = (mesh: THREE.InstancedMesh | null, friendly: boolean) => {
      if (!mesh) return;
      let i = 0;
      for (const pr of w.projs as Proj[]) {
        if (pr.friendly !== friendly || i >= 480) continue;
        dummy.position.copy(pr.pos);
        dummy.lookAt(pr.pos.clone().add(pr.vel));
        const s = pr.size;
        dummy.scale.set(s, s, s * (pr.kind === 'homing' ? 3.2 : 4.5));
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, tmpC.set(pr.color));
        i++;
      }
      mesh.count = i;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    renderProjs(projMeshRef.current, true);
    renderProjs(eProjMeshRef.current, false);

    // particles
    if (particleMeshRef.current) {
      let i = 0;
      w.particles = (w.particles as Particle[]).filter(pt => { pt.life -= dt; return pt.life > 0; });
      for (const pt of w.particles as Particle[]) {
        if (i >= 950) break;
        pt.pos.addScaledVector(pt.vel, dt);
        pt.vel.multiplyScalar(Math.pow(0.25, dt));
        const frac = pt.life / pt.maxLife;
        dummy.position.copy(pt.pos);
        dummy.scale.setScalar(Math.max(0.02, pt.size * frac));
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        particleMeshRef.current.setMatrixAt(i, dummy.matrix);
        particleMeshRef.current.setColorAt(i, pt.color);
        i++;
      }
      particleMeshRef.current.count = i;
      particleMeshRef.current.instanceMatrix.needsUpdate = true;
      if (particleMeshRef.current.instanceColor) particleMeshRef.current.instanceColor.needsUpdate = true;
    }
    if (flashRef.current) flashRef.current.intensity = Math.max(0, flashRef.current.intensity - dt * 700);

    // asteroids
    if (asteroidMeshRef.current) {
      (w.asteroids as Asteroid[]).forEach((a, i) => {
        dummy.position.copy(a.pos);
        dummy.quaternion.setFromAxisAngle(a.rotAxis, w.t * a.rotSpeed + i);
        dummy.scale.setScalar(a.alive ? a.scale : 0.0001);
        dummy.updateMatrix();
        asteroidMeshRef.current!.setMatrixAt(i, dummy.matrix);
      });
      asteroidMeshRef.current.count = (w.asteroids as Asteroid[]).length;
      asteroidMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    // beam visual
    if (beamMeshRef.current) {
      if (w.beam) {
        const from = p.pos.clone().add(fwd.clone().multiplyScalar(3));
        const to = w.beam.to as THREE.Vector3;
        const mid = from.clone().add(to).multiplyScalar(0.5);
        const len = from.distanceTo(to);
        beamMeshRef.current.visible = true;
        beamMeshRef.current.position.copy(mid);
        beamMeshRef.current.lookAt(to);
        beamMeshRef.current.scale.set(1, 1, len);
        (beamMeshRef.current.material as THREE.MeshBasicMaterial).color.set(w.beam.color);
      } else beamMeshRef.current.visible = false;
    }
    // arcs visual (first segment chain as cylinders)
    w.arcs = (w.arcs as any[]).filter((a: any) => { a.t += dt; return a.t < 0.16; }); // eslint-disable-line @typescript-eslint/no-explicit-any
    arcMeshRefs.current.forEach((m, i) => {
      if (!m) return;
      const arc = (w.arcs as any[])[0]; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (arc && arc.pts[i] && arc.pts[i + 1]) {
        const from = arc.pts[i] as THREE.Vector3, to = arc.pts[i + 1] as THREE.Vector3;
        m.visible = true;
        m.position.copy(from.clone().add(to).multiplyScalar(0.5));
        m.lookAt(to);
        m.scale.set(1, 1, from.distanceTo(to));
      } else m.visible = false;
    });
    // rings
    w.rings = (w.rings as any[]).filter((r: any) => { r.t += dt * 1.4; return r.t < 1; }); // eslint-disable-line @typescript-eslint/no-explicit-any
    ringRefs.current.forEach((m, i) => {
      if (!m) return;
      const r = (w.rings as any[])[i]; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (r) {
        m.visible = true;
        m.position.copy(r.pos);
        m.lookAt(camera.position);
        const s = 2 + r.t * r.max;
        m.scale.set(s, s, 1);
        const mat = m.material as THREE.MeshBasicMaterial;
        mat.color.set(r.color); mat.opacity = (1 - r.t) * 0.85;
      } else m.visible = false;
    });

    // ── camera ──
    const camQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(p.pitch, p.yaw, p.roll * 0.35, 'YXZ'));
    const camOffset = new THREE.Vector3(0, 2.7 * stats.ship.scale, 9.5 * stats.ship.scale).applyQuaternion(camQ);
    const camTarget = p.pos.clone().add(camOffset);
    if (w.phase === 'boss-intro' && w.boss) {
      // cinematic: swing toward boss
      const mid = p.pos.clone().add(w.boss.pos).multiplyScalar(0.5);
      camera.position.lerp(p.pos.clone().add(new THREE.Vector3(14, 8, 16)), 0.03);
      camera.lookAt(mid);
    } else {
      const lag = w.phase === 'intro' ? 0.02 : 1 - Math.pow(0.0001, dt);
      w.camPos.lerp(camTarget, Math.min(1, lag));
      camera.position.copy(w.camPos);
      if (w.shake > 0.01 && settings.screenEffects) {
        const s = w.shake * settings.cameraShake * 0.55;
        camera.position.x += rand(-s, s); camera.position.y += rand(-s, s); camera.position.z += rand(-s, s);
      }
      camera.lookAt(p.pos.clone().addScaledVector(fwd, 26).add(new THREE.Vector3(0, 1.2, 0)));
    }
    w.shake = Math.max(0, w.shake - dt * 2.4);
    const pc = camera as THREE.PerspectiveCamera;
    const targetFov = boosting ? 74 : p.overdrive > 0 ? 70 : 62;
    if (Math.abs(pc.fov - targetFov) > 0.1) { pc.fov = THREE.MathUtils.lerp(pc.fov, targetFov, 0.06); pc.updateProjectionMatrix(); }

    // ── HUD sync @ ~12Hz ──
    w.hudT -= dt;
    if (w.hudT <= 0) {
      w.hudT = 0.085;
      const markers: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
      const proj = (pos: THREE.Vector3) => {
        const v = pos.clone().project(camera);
        const behind = v.z > 1;
        let x = (v.x * 0.5 + 0.5) * 100, y = (-v.y * 0.5 + 0.5) * 100;
        const off = behind || x < 0 || x > 100 || y < 0 || y > 100;
        if (behind) { x = 100 - x; y = 100; }
        return { x: clamp(x, 2.5, 97.5), y: clamp(y, 4, 96), off };
      };
      w.enemies.forEach((e: Ent) => {
        const s2 = proj(e.pos);
        markers.push({ id: e.id, x: s2.x, y: s2.y, dist: Math.round(e.pos.distanceTo(p.pos)), frac: e.hp.hull / e.hp.maxHull, shieldFrac: e.hp.maxShield > 0 ? e.hp.shield / e.hp.maxShield : 0, isBoss: false, offscreen: s2.off, name: e.def.name, locked: p.lockTarget === e.id && p.lockProgress >= 0.7, isAlly: false });
      });
      if (w.boss) { const s2 = proj(w.boss.pos); markers.push({ id: -999, x: s2.x, y: s2.y, dist: Math.round(w.boss.pos.distanceTo(p.pos)), frac: w.boss.hp.hull / w.boss.hp.maxHull, shieldFrac: w.boss.hp.shield / w.boss.hp.maxShield, isBoss: true, offscreen: s2.off, name: w.boss.def.name, locked: p.lockTarget === -999 && p.lockProgress >= 0.7, isAlly: false }); }
      if (w.ally) { const s2 = proj(w.ally.pos); markers.push({ id: -500, x: s2.x, y: s2.y, dist: Math.round(w.ally.pos.distanceTo(p.pos)), frac: w.ally.hp.hull / w.ally.hp.maxHull, shieldFrac: 0, isBoss: false, offscreen: s2.off, name: 'HAULER-7', locked: false, isAlly: true }); }
      if (w.station) { const s2 = proj(w.station.pos); markers.push({ id: -501, x: s2.x, y: s2.y, dist: Math.round(w.station.pos.distanceTo(p.pos)), frac: w.station.hp.hull / w.station.hp.maxHull, shieldFrac: 0, isBoss: false, offscreen: s2.off, name: 'STATION', locked: false, isAlly: true }); }

      const allyObj = w.ally ?? w.station;
      let progress = '';
      if (config.kind === 'timeattack') progress = `${w.kills} / ${config.killTarget} destroyed`;
      else if (config.kind === 'asteroid') progress = `${w.kills + w.asteroidsDestroyed} / ${config.killTarget} cleared`;
      else if (config.type === 'survival-time') progress = `${w.kills} / ${config.killTarget} kills · survive ${Math.max(0, Math.ceil(config.timeLimit - w.t))}s`;
      else if (w.boss) progress = `Destroy ${w.boss.def.name}`;
      else if (config.kind === 'survival' || config.kind === 'endless') progress = `Wave ${w.wave} — survive`;
      else progress = `Wave ${Math.min(w.wave, config.waves)} / ${config.waves} · ${w.enemies.size} hostiles`;

      const prim = WEAPON_BY_ID[p.primaryId], sec = WEAPON_BY_ID[p.secondaryId];
      useStore.getState().setHud({
        hull: Math.ceil(p.hp.hull), maxHull: p.hp.maxHull, shield: Math.ceil(p.hp.shield), maxShield: p.hp.maxShield,
        speed: Math.round(p.vel.length() * 3.6), boost: (p.boost / stats.boost) * 100, energy: p.energy, maxEnergy: stats.energy,
        ult: p.ult, abilityCd: p.abilityCd, abilityMax: ABILITY_INFO[stats.ship.ability].cooldown * stats.abilityCdMult, abilityName: stats.ship.abilityName,
        primaryName: prim.name, secondaryName: sec.name, ammo: sec.ammo >= 0 ? p.ammo[sec.id] : -1, charge: p.charge,
        kills: w.kills, score: w.score, wave: Math.max(1, w.wave), enemiesLeft: w.enemies.size,
        objectiveProgress: progress, timeLeft: config.timeLimit > 0 ? Math.max(0, config.timeLimit - w.t) : 0, elapsed: w.t,
        bossName: w.boss ? w.boss.def.name : '', bossFrac: w.boss ? w.boss.hp.hull / w.boss.hp.maxHull : 0,
        bossShieldFrac: w.boss ? w.boss.hp.shield / w.boss.hp.maxShield : 0, bossPhase: w.boss ? w.boss.phase : 0,
        allyFrac: allyObj ? allyObj.hp.hull / allyObj.hp.maxHull : -1, allyName: w.ally ? 'HAULER-7' : w.station ? 'STATION INTEGRITY' : '',
        lockProgress: p.lockProgress, lockName: p.lockTarget === -999 ? (w.boss?.def.name ?? '') : (w.enemies.get(p.lockTarget)?.def.name ?? ''),
        missileWarning: !!w.missileThreat, hitmarker: w.hitmark ?? 0, damageFlash: w.dmgFlash ?? 0,
        markers, fps: w.fps, combo: w.combo,
      });
      // expose elapsed seconds to HUD for flashing indicators without extra renders
      (window as any).__sfTime = w.t; // eslint-disable-line @typescript-eslint/no-explicit-any
    }
    void state;
  });

  const pickupColors: Record<string, string> = { repair: '#4ade80', energy: '#38bdf8', ammo: '#fb923c', credits: '#facc15', ult: '#e879f9' };
  // beam cylinders: rotate geometry so length axis is Z (matches lookAt +Z and scale.z = length)
  const beamGeo = useMemo(() => new THREE.CylinderGeometry(0.22, 0.22, 1, 8, 1, true).rotateX(Math.PI / 2), []);
  const arcGeo = useMemo(() => new THREE.CylinderGeometry(0.15, 0.15, 1, 5, 1, true).rotateX(Math.PI / 2), []);

  return (
    <>
      <color attach="background" args={[env.sky]} />
      <fog attach="fog" args={[env.fog, 500, 3200]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[300, 400, 200]} intensity={1.6} color={env.light} />
      <pointLight ref={flashRef} intensity={0} distance={160} />
      <Stars radius={2600} depth={900} count={settings.quality === 'low' ? 3500 : 8000} factor={14} saturation={0.4} fade speed={0.6} />

      {/* nebulae */}
      {nebulaSprites.map((s, i) => (
        <sprite key={i} position={s.pos} scale={[s.scale, s.scale, 1]}>
          <spriteMaterial map={s.tex === 'a' ? nebTexA : nebTexB} transparent opacity={s.opacity} depthWrite={false} />
        </sprite>
      ))}

      {/* planet */}
      <group position={[-1500, 420, -1900]}>
        <mesh>
          <sphereGeometry args={[330, 32, 32]} />
          <meshStandardMaterial color={env.planet} emissive={env.planet} emissiveIntensity={0.22} roughness={0.8} metalness={0.1} />
        </mesh>
        <mesh scale={1.06}>
          <sphereGeometry args={[330, 32, 32]} />
          <meshBasicMaterial color={env.planet} transparent opacity={0.1} side={THREE.BackSide} />
        </mesh>
        {env.planetRing && (
          <mesh rotation={[Math.PI / 2.4, 0, 0.4]}>
            <ringGeometry args={[420, 640, 48]} />
            <meshBasicMaterial color={env.planet} transparent opacity={0.3} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
      {/* distant moon */}
      <mesh position={[1700, -500, -1500]}>
        <sphereGeometry args={[130, 24, 24]} />
        <meshStandardMaterial color="#94a3b8" roughness={1} emissive="#334155" emissiveIntensity={0.2} />
      </mesh>
      {config.env === 'blackhole' && (
        <group position={[900, 300, -2200]}>
          <mesh><sphereGeometry args={[120, 24, 24]} /><meshBasicMaterial color="#000000" /></mesh>
          <mesh rotation={[Math.PI / 2.2, 0, 0]}><ringGeometry args={[130, 340, 48]} /><meshBasicMaterial color="#c084fc" transparent opacity={0.55} side={THREE.DoubleSide} toneMapped={false} /></mesh>
          <pointLight color="#c084fc" intensity={400} distance={3000} />
        </group>
      )}

      {/* player */}
      <group ref={playerRef}>
        <PlayerShipModel color={stats.ship.color} accent={stats.ship.accent} scale={stats.ship.scale} wingSpan={stats.ship.wingSpan} thrust={w.keys.has('KeyW') ? 1 : 0.3} />
      </group>
      <mesh ref={shieldBubbleRef} visible={false}>
        <sphereGeometry args={[4.6 * stats.ship.scale, 18, 14]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* enemies */}
      {roster.map(r => {
        const def = ENEMY_BY_ID[r.defId];
        return (
          <group key={r.id} ref={(g: THREE.Group | null) => { if (g) enemyRefs.current.set(r.id, g); else enemyRefs.current.delete(r.id); }}>
            <EnemyShipModel color={def.color} scale={def.scale} behavior={def.behavior} />
          </group>
        );
      })}

      {/* boss */}
      {bossDef && (
        <group ref={bossRef}>
          <BossModel color={bossDef.color} scale={bossDef.scale} bossId={bossDef.id} />
        </group>
      )}

      {/* ally / station */}
      {config.type === 'escort' && <group ref={allyRef}><TransportModel /></group>}
      {config.type === 'defense' && <group ref={stationRef} position={[0, 0, -140]}><StationModel /></group>}

      {/* drones */}
      {droneIds.map(id => (
        <group key={id} ref={(g: THREE.Group | null) => { if (g) droneRefs.current.set(id, g); else droneRefs.current.delete(id); }}>
          <DroneModel color={stats.ship.accent} />
        </group>
      ))}

      {/* pickups */}
      {pickups.map(pk => (
        <group key={pk.id} position={[pk.pos.x, pk.pos.y, pk.pos.z]}>
          <mesh>
            <octahedronGeometry args={[1.3, 0]} />
            <meshBasicMaterial color={pickupColors[pk.kind]} toneMapped={false} />
          </mesh>
          <pointLight color={pickupColors[pk.kind]} intensity={10} distance={18} />
        </group>
      ))}

      {/* instanced fields */}
      <instancedMesh ref={projMeshRef} args={[undefined, undefined, 480]} frustumCulled={false}>
        <sphereGeometry args={[0.32, 6, 6]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={eProjMeshRef} args={[undefined, undefined, 480]} frustumCulled={false}>
        <sphereGeometry args={[0.34, 6, 6]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={particleMeshRef} args={[undefined, undefined, 950]} frustumCulled={false}>
        <sphereGeometry args={[0.42, 5, 5]} />
        <meshBasicMaterial toneMapped={false} transparent opacity={0.9} />
      </instancedMesh>
      <instancedMesh ref={asteroidMeshRef} args={[undefined, undefined, Math.max(1, (W.current.asteroids as Asteroid[]).length)]} frustumCulled={false}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={config.env === 'frozen' ? '#7dd3fc' : config.env === 'volcanic' ? '#7c2d12' : '#57534e'} roughness={0.95} metalness={0.15} emissive={config.env === 'volcanic' ? '#ea580c' : '#000000'} emissiveIntensity={config.env === 'volcanic' ? 0.25 : 0} />
      </instancedMesh>

      {/* beam + arcs + rings */}
      <mesh ref={beamMeshRef} visible={false} geometry={beamGeo}>
        <meshBasicMaterial color="#f472b6" transparent opacity={0.85} toneMapped={false} />
      </mesh>
      {[0, 1, 2, 3].map(i => (
        <mesh key={i} ref={(m: THREE.Mesh | null) => { arcMeshRefs.current[i] = m; }} visible={false} geometry={arcGeo}>
          <meshBasicMaterial color="#a5f3fc" transparent opacity={0.9} toneMapped={false} />
        </mesh>
      ))}
      {[0, 1, 2, 3, 4, 5].map(i => (
        <mesh key={i} ref={(m: THREE.Mesh | null) => { ringRefs.current[i] = m; }} visible={false}>
          <ringGeometry args={[0.86, 1, 40]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.7} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}
