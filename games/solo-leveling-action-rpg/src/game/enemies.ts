// Monster + boss AI: attack patterns, telegraphs, phases, damage reactions, death & loot.
import * as THREE from 'three';
import type { Enemy, Game, V3 } from './game';
import { ENEMIES, ITEMS } from './data';
import { bus, useGame } from './store';
import {
  makeGoblin,
  makeGuardian,
  makeIgris,
  makeKnight,
  makeLizard,
  makeSerpent,
  newPose,
  pose,
  setFlash,
} from './models';
import { walkable } from './world';
import { grantShadowXp, canExtract } from './army';
import * as story from './story';

export interface Atk {
  name: string;
  kind: string;
  min: number;
  max: number;
  wind: number;
  strike: number;
  rec: number;
  dmg: number;
  shape: 'cone' | 'circle' | 'line' | 'proj' | 'multi';
  reach: number;
  arc?: number;
  rad?: number;
  front?: number;
  dash?: number;
  tele?: boolean;
  knock: number;
  cd: number;
  hits?: number[];
  phase?: number;
  poison?: number;
  width?: number;
  weight?: number;
}
export interface AtkRun {
  d: Atk;
  t: number;
  fired: number;
  dir: V3;
  origin: V3;
  dashHit: boolean;
  cx: number;
  cz: number;
}
const ATK: Record<string, Atk[]> = {
  goblin: [
    {
      name: 'club',
      kind: 'slash1',
      min: 0,
      max: 2.1,
      wind: 0.45,
      strike: 0.1,
      rec: 0.5,
      dmg: 1,
      shape: 'cone',
      reach: 2.1,
      arc: 110,
      knock: 2,
      cd: 1.1,
    },
  ],
  lizard: [
    {
      name: 'pounce',
      kind: 'bite',
      min: 0,
      max: 3.4,
      wind: 0.4,
      strike: 0.3,
      rec: 0.55,
      dmg: 1,
      shape: 'line',
      reach: 3.4,
      dash: 9,
      knock: 3,
      cd: 1.8,
      width: 1.6,
    },
  ],
  centipede: [
    {
      name: 'bite',
      kind: 'bite',
      min: 0,
      max: 2.1,
      wind: 0.3,
      strike: 0.1,
      rec: 0.4,
      dmg: 1,
      shape: 'cone',
      reach: 2.4,
      arc: 120,
      knock: 2,
      cd: 0.9,
    },
  ],
  knight: [
    {
      name: 'slash',
      kind: 'slash1',
      min: 0,
      max: 2.7,
      wind: 0.55,
      strike: 0.12,
      rec: 0.55,
      dmg: 1,
      shape: 'cone',
      reach: 2.8,
      arc: 120,
      knock: 3,
      cd: 1.3,
    },
    {
      name: 'overhead',
      kind: 'overhead',
      min: 0,
      max: 3,
      wind: 0.85,
      strike: 0.15,
      rec: 0.7,
      dmg: 1.7,
      shape: 'cone',
      reach: 3.3,
      arc: 90,
      knock: 6,
      cd: 3.5,
      weight: 0.5,
    },
  ],
  guardian: [
    {
      name: 'slam',
      kind: 'overhead',
      min: 0,
      max: 4.6,
      wind: 1.0,
      strike: 0.2,
      rec: 1.0,
      dmg: 1.4,
      shape: 'circle',
      reach: 3.4,
      rad: 3.4,
      front: 3.2,
      tele: true,
      knock: 7,
      cd: 3,
    },
    {
      name: 'sweep',
      kind: 'slash1',
      min: 0,
      max: 4.3,
      wind: 0.9,
      strike: 0.15,
      rec: 0.8,
      dmg: 1,
      shape: 'cone',
      reach: 4.7,
      arc: 180,
      knock: 6,
      cd: 2.4,
    },
  ],
  kasaka: [
    {
      name: 'bite',
      kind: 'bite',
      min: 0,
      max: 8,
      wind: 0.55,
      strike: 0.3,
      rec: 0.6,
      dmg: 1,
      shape: 'line',
      reach: 8,
      dash: 15,
      knock: 5,
      cd: 2.2,
      tele: true,
      width: 2.6,
    },
    {
      name: 'tail',
      kind: 'slash1',
      min: 0,
      max: 6,
      wind: 0.9,
      strike: 0.15,
      rec: 0.8,
      dmg: 1.1,
      shape: 'circle',
      reach: 5.5,
      rad: 5.5,
      front: 0,
      tele: true,
      knock: 8,
      cd: 4,
    },
    {
      name: 'spit',
      kind: 'spit',
      min: 6,
      max: 24,
      wind: 0.7,
      strike: 0.1,
      rec: 0.6,
      dmg: 0.7,
      shape: 'proj',
      reach: 24,
      poison: 4,
      knock: 0,
      cd: 3.5,
    },
    {
      name: 'burst',
      kind: 'slash1',
      min: 0,
      max: 12,
      wind: 1.3,
      strike: 0.2,
      rec: 1,
      dmg: 1.5,
      shape: 'circle',
      reach: 9,
      rad: 9,
      front: 0,
      tele: true,
      knock: 10,
      cd: 9,
      phase: 2,
    },
  ],
  igris: [
    {
      name: 'combo',
      kind: 'multi',
      min: 0,
      max: 4.4,
      wind: 0.4,
      strike: 0,
      rec: 0.6,
      dmg: 0.9,
      shape: 'multi',
      reach: 3.7,
      arc: 130,
      knock: 3,
      cd: 1.8,
      hits: [0.5, 0.9, 1.3],
    },
    {
      name: 'dash',
      kind: 'stab',
      min: 5.5,
      max: 20,
      wind: 0.65,
      strike: 0.35,
      rec: 0.7,
      dmg: 1.5,
      shape: 'line',
      reach: 16,
      dash: 34,
      tele: true,
      knock: 7,
      cd: 4.5,
      width: 2.6,
    },
    {
      name: 'slam',
      kind: 'overhead',
      min: 0,
      max: 7,
      wind: 1.0,
      strike: 0.2,
      rec: 1.0,
      dmg: 1.8,
      shape: 'circle',
      reach: 6.5,
      rad: 6.5,
      front: 0,
      tele: true,
      knock: 10,
      cd: 7,
      phase: 2,
    },
    {
      name: 'charged',
      kind: 'overhead',
      min: 0,
      max: 14,
      wind: 1.7,
      strike: 0.2,
      rec: 1.2,
      dmg: 2.8,
      shape: 'circle',
      reach: 10,
      rad: 10,
      front: 0,
      tele: true,
      knock: 14,
      cd: 11,
      phase: 3,
    },
  ],
};
const RAD: Record<string, number> = {
  goblin: 0.45,
  lizard: 0.7,
  centipede: 0.55,
  kasaka: 1.8,
  knight: 0.65,
  guardian: 1.1,
  igris: 0.85,
};
const SPIT_GEO = new THREE.SphereGeometry(0.45, 10, 8);
const SPIT_MAT = new THREE.MeshBasicMaterial({ color: 0x8aff5a });
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const angDiff = (a: number, b: number) => {
  let d = b - a;
  while (d > Math.PI) d -= 6.2832;
  while (d < -Math.PI) d += 6.2832;
  return d;
};

export function spawnEnemy(
  g: Game,
  key: string,
  x: number,
  z: number,
  o: { rise?: boolean; aggro?: boolean; hpMul?: number; atkMul?: number; flag?: string; noLoot?: boolean } = {}
): Enemy {
  const def = { ...ENEMIES[key] };
  if (o.atkMul) def.atk *= o.atkMul;
  let rig;
  switch (def.model) {
    case 'goblin':
      rig = makeGoblin();
      break;
    case 'lizard':
      rig = makeLizard();
      break;
    case 'centipede':
      rig = makeSerpent({ n: 9, rad: 0.26, c1: 0x5a3a1a, c2: 0x8a4a1a, legs: true });
      break;
    case 'serpent':
      rig = makeSerpent({ n: 18, rad: 0.7, c1: 0x1f5a2a, c2: 0x35a04a, hood: true });
      break;
    case 'knight':
      rig = makeKnight();
      break;
    case 'guardian':
      rig = makeGuardian();
      break;
    default:
      rig = makeIgris();
  }
  const hp = def.hp * (o.hpMul ?? 1);
  const e: Enemy = {
    id: g.enemyId++,
    def,
    rig,
    ps: newPose(),
    pos: V(x, 0, z),
    yaw: 0,
    vel: V(),
    hp,
    maxHp: hp,
    r: RAD[key] ?? 0.6,
    state: o.rise ? 'rise' : o.aggro ? 'chase' : 'idle',
    t: 0,
    atk: null,
    cd: 0.8,
    target: null,
    tgtT: 0,
    dead: false,
    deadT: 0,
    corpse: false,
    extracted: false,
    tries: 0,
    extracting: false,
    poison: 0,
    poisonDps: 0,
    lift: 0,
    slow: 1,
    flash: 0,
    phase: 1,
    speedMul: 1,
    stun: 0,
    boss: !!def.boss,
    blockT: 0,
    hurtT: 0,
    combo: 0,
    last: '',
    invuln: false,
    noLoot: o.noLoot,
    flag: o.flag,
    riposte: false,
    glow: 0,
  };
  (e as any).cds = {};
  if (def.boss) e.aura = 0;
  e.yaw = Math.atan2(g.P.pos.x - x, g.P.pos.z - z);
  rig.root.position.copy(e.pos);
  rig.root.rotation.y = e.yaw;
  if (o.rise) {
    rig.root.position.y = -2.5;
    e.invuln = true;
    g.fx.shadowBurst(x, 0.3, z, 14, 2);
    g.fx.dust(x, z, 8);
  }
  g.scene.add(rig.root);
  g.enemies.push(e);
  if (o.aggro) e.state = o.rise ? 'rise' : 'chase';
  if (o.aggro) (e as any).aggro = true;
  return e;
}
export function removeEnemy(g: Game, e: Enemy) {
  g.scene.remove(e.rig.root);
  g.enemies = g.enemies.filter((q) => q !== e);
  if (g.lock === e) g.lock = null;
  if (g.lastHitEnemy === e) g.lastHitEnemy = null;
}

function tpos(g: Game, e: Enemy): V3 {
  return e.target && e.target !== 'player' && e.target.hp > 0 && e.target.state !== 'dead' ? e.target.pos : g.P.pos;
}
function pickTarget(g: Game, e: Enemy) {
  let best: any = 'player';
  let bd = e.pos.distanceTo(g.P.pos) * 0.85;
  for (const a of g.allies) {
    if (a.state === 'dead' || a.state === 'rise') continue;
    const d = e.pos.distanceTo(a.pos);
    if (d < bd) {
      bd = d;
      best = a;
    }
  }
  e.target = best;
}

export function hitEnemy(
  g: Game,
  e: Enemy,
  dmg: number,
  o: {
    knock?: number;
    dir?: V3;
    crit?: boolean;
    color?: string;
    poison?: number;
    heavy?: boolean;
    fromPlayer?: boolean;
    stagger?: number;
    ally?: any;
  } = {}
) {
  if (e.dead || e.invuln) return;
  const dir = o.dir || V(0, 0, 0);
  if (e.state === 'block') {
    const front = Math.abs(angDiff(e.yaw, Math.atan2(-dir.x, -dir.z))) < 1.3;
    if (front) {
      dmg *= 0.08;
      e.riposte = true;
      g.fx.sparks(e.pos.x, 1.6, e.pos.z, 0xffffff, 18);
      bus.emit('sfx', 'clang');
      g.fx.num(e.pos.clone().add(V(0, 3, 0)), 'BLOCKED', '#9ad8ff');
      g.hitstop = Math.max(g.hitstop, 0.08);
      g.shake = Math.max(g.shake, 0.22);
    }
  }
  const dm = Math.max(1, Math.round(dmg - e.def.def * 0.5));
  e.hp -= dm;
  e.flash = 0.07;
  setFlash(e.rig, true);
  (e as any).aggro = true;
  if (e.state === 'idle') e.state = 'chase';
  if (o.fromPlayer) g.lastHitEnemy = e;
  const h = e.rig.height * e.def.scale;
  g.fx.num(e.pos.clone().add(V(0, h * 0.9 + 0.8, 0)), String(dm), o.crit ? '#ffd24a' : o.color || '#ffffff', !!o.crit);
  g.fx.sparks(e.pos.x, h * 0.55, e.pos.z, o.crit ? 0xffd24a : 0xffffff, o.crit ? 22 : 10);
  if (o.fromPlayer) {
    g.hitstop = Math.max(g.hitstop, o.crit ? 0.09 : o.heavy ? 0.08 : 0.04);
    g.shake = Math.max(g.shake, o.crit ? 0.22 : o.heavy ? 0.18 : 0.08);
    if (o.crit || o.heavy) g.fx.shock(e.pos.x, 0.05, e.pos.z, o.crit ? 0xffd24a : 0xffffff, o.crit ? 3 : 2.2, 0.25);
  }
  bus.emit('sfx', o.crit ? 'crit' : 'hit');
  const kn = (o.knock ?? 1) * (e.boss ? 0.1 : 0.14);
  if (kn > 0 && dir.lengthSq() > 0) {
    const nx = e.pos.x + dir.x * kn,
      nz = e.pos.z + dir.z * kn;
    if (walkable(g.zone, nx, nz, e.r * 0.7)) {
      e.pos.x = nx;
      e.pos.z = nz;
    }
  }
  if (o.poison) {
    e.poison = Math.max(e.poison, o.poison);
    e.poisonDps = g.derived.atk * 0.14;
  }
  if (!e.boss) {
    if (e.state !== 'rise' && (o.knock ?? 1) >= 1) {
      e.state = 'hurt';
      e.hurtT = (o.knock ?? 1) >= 5 ? 0.6 : 0.28;
      e.atk = null;
      g.fx.clearTele();
    }
  } else if (o.stagger || (o.heavy && e.state !== 'atk')) {
    if (e.state !== 'atk' || (e.atk && e.atk.t < e.atk.d.wind * 0.5)) {
      e.state = 'hurt';
      e.hurtT = o.stagger || 0.35;
      e.atk = null;
      g.fx.clearTele();
    }
  }
  if (e.boss) {
    const r = e.hp / e.maxHp;
    const thr = e.def.key === 'igris' ? [0.66, 0.33] : [0.5];
    const ph = 1 + thr.filter((t) => r < t).length;
    if (ph > e.phase) bossPhase(g, e, ph);
  }
  if (e.hp <= 0) killEnemy(g, e);
}
function bossPhase(g: Game, e: Enemy, ph: number) {
  e.phase = ph;
  e.atk = null;
  e.state = 'hurt';
  e.hurtT = 1.1;
  e.invuln = true;
  g.fx.clearTele();
  setTimeout(() => {
    e.invuln = false;
  }, 1100);
  e.speedMul *= 1.15;
  bus.emit('sfx', 'roar', 1);
  bus.emit('sfx', 'boss');
  g.shake = 0.7;
  g.fx.shock(e.pos.x, 0, e.pos.z, e.def.key === 'igris' ? 0xff2030 : 0x6dff7a, 12, 0.8);
  g.fx.burst(e.pos.x, 1, e.pos.z, 40, {
    speed: 7,
    up: 3,
    life: 1,
    size: 0.4,
    c0: 0xffffff,
    c1: e.def.key === 'igris' ? 0xff1030 : 0x4aff6a,
  });
  const pcol = e.def.key === 'igris' ? 0xff2030 : 0x4aff6a;
  g.fx.pillar(e.pos.x, e.pos.z, pcol, 9, 1.3);
  g.fx.crack(e.pos.x, e.pos.z, 5.2, 4, pcol);
  g.fx.flash(e.pos.x, 1.6, e.pos.z, pcol, 4.2, 0.4);
  g.fx.soul(e.pos.x, e.pos.z, pcol, 20);
  g.slow = { t: 0.6, s: 0.4 };
  g.banner(
    e.def.key === 'igris' ? (ph === 2 ? 'IGRIS GROWS FIERCE' : 'IGRIS UNLEASHES HIS POWER') : 'KASAKA ENRAGED',
    'Phase ' + ph,
    '#ff4a5a',
    2.2
  );
  e.aura = ph;
  if (e.def.key === 'igris' && ph === 2)
    for (let i = 0; i < 2; i++) {
      const a = i * 3.14 + 1;
      g.spawn('knight', e.pos.x + Math.cos(a) * 10, e.pos.z + Math.sin(a) * 10, { rise: true, aggro: true });
    }
  story.onPhase?.(g, e, ph);
}
export function killEnemy(g: Game, e: Enemy) {
  if (e.dead) return;
  e.dead = true;
  e.state = 'dead';
  e.deadT = 0;
  e.hp = 0;
  e.atk = null;
  g.fx.clearTele();
  const st = useGame.getState();
  const d = e.def;
  if (g.lock === e) g.lock = null;
  bus.emit('sfx', 'death');
  const mult = 1 + Math.min(g.combo, 30) * 0.04;
  st.addScore(d.xp * 2 * mult + (e.boss ? d.xp * 6 : 0));
  if (!e.noLoot) {
    st.addXp(d.xp);
    st.addGold(d.gold);
  }
  st.questEvent('kill', d.key, 1);
  if (!e.noLoot)
    for (const [id, ch] of d.drops)
      if (Math.random() < ch) {
        st.addItem(id, 1);
        if (ITEMS[id].kind === 'equip' && id !== 'knight_killer') {
          /* auto-loot */
        }
      }
  grantShadowXp(g, e);
  g.fx.shadowBurst(e.pos.x, 0.8, e.pos.z, e.boss ? 40 : 10, 2);
  g.fx.sparks(e.pos.x, 1, e.pos.z, 0xffffff, 16);
  g.fx.soul(e.pos.x, e.pos.z, e.boss ? 0xffd24a : 0x9ad8ff, e.boss ? 28 : 7);
  if (e.boss) {
    g.slow = { t: 1.5, s: 0.25 };
    g.shake = 0.9;
    g.fx.shock(e.pos.x, 0, e.pos.z, 0xffffff, 14, 1);
    g.fx.flash(e.pos.x, 1.6, e.pos.z, 0xffffff, 4.4, 0.5);
    g.fx.crack(e.pos.x, e.pos.z, 5.4, 4.5, 0xffd24a);
    g.banner('TARGET DEFEATED', d.name, '#9ad8ff', 3);
  }
  e.corpse = canExtract(g, e);
  story.onKill(g, e);
  useGame
    .getState()
    .persist('auto')
    .catch(() => {});
}

function inCone(ox: number, oz: number, dir: V3, reach: number, arc: number, px: number, pz: number, pr: number) {
  const dx = px - ox,
    dz = pz - oz;
  const d = Math.hypot(dx, dz);
  if (d > reach + pr) return false;
  if (arc >= 359 || d < pr + 0.6) return true;
  return Math.abs(angDiff(Math.atan2(dir.x, dir.z), Math.atan2(dx, dz))) < (arc * Math.PI) / 360;
}
function strike(g: Game, e: Enemy, run: AtkRun) {
  const d = run.d;
  const dmg = e.def.atk * d.dmg;
  const P = g.P;
  const test = (px: number, pz: number, pr: number) => {
    if (d.shape === 'circle') return Math.hypot(px - run.cx, pz - run.cz) < (d.rad || 3) + pr;
    if (d.shape === 'line') return false;
    return inCone(e.pos.x, e.pos.z, run.dir, d.reach, d.arc || 100, px, pz, pr);
  };
  if (d.shape === 'circle') {
    g.fx.shock(run.cx, 0, run.cz, 0xff5a3a, d.rad || 3, 0.45);
    g.fx.dust(run.cx, run.cz, 14);
    g.fx.crack(run.cx, run.cz, Math.min(4.2, (d.rad || 3) * 1.15), 2.2, 0xff5a3a);
    g.shake = Math.max(g.shake, 0.4);
    bus.emit('sfx', 'slam');
  } else {
    bus.emit('sfx', 'swing', 1);
    if (e.boss)
      g.fx.slash(
        e.pos.x + run.dir.x * 2.2,
        e.rig.height * 0.55,
        e.pos.z + run.dir.z * 2.2,
        e.def.key === 'igris' ? 0xff2030 : 0x8aff5a,
        3.2,
        Math.atan2(run.dir.x, run.dir.z) - g.camYaw,
        1.1
      );
  }
  if (test(P.pos.x, P.pos.z, 0.4) && Math.abs(P.pos.y) < 1.8) g.hurtPlayer(dmg, e.pos, d.knock, d.poison || 0);
  for (const a of g.allies)
    if (a.state !== 'dead' && a.state !== 'rise' && test(a.pos.x, a.pos.z, a.r)) hitAlly(g, a, dmg, e.pos);
}
export function hitAlly(g: Game, a: any, dmg: number, from: V3) {
  const dm =
    Math.max(1, Math.round(dmg - a.st.def * 0.5)) *
    (a.rec.key === 'igris' && a.rec.level >= 10 ? 0.6 : 1) *
    (a.rec.key === 'knight' ? 0.8 : 1);
  a.hp -= dm;
  a.flash = 0.06;
  setFlash(a.rig, true);
  g.fx.num(a.pos.clone().add(V(0, 2.2, 0)), String(Math.round(dm)), '#c88aff');
  g.fx.burst(a.pos.x, 1, a.pos.z, 6, { speed: 3, life: 0.4, c0: 0xb26bff, c1: 0x300060 });
  const dir = V(a.pos.x - from.x, 0, a.pos.z - from.z).normalize();
  a.pos.addScaledVector(dir, 0.3);
  if (a.hp <= 0) {
    a.state = 'dead';
    a.t = 0;
    useGame.getState().notify({
      kind: 'system',
      title: 'SHADOW RETURNED',
      text: a.rec.name + ' fell and returned to the shadow realm.',
    });
  }
}
function chooseAttack(_g: Game, e: Enemy, dist: number): Atk | null {
  const list = (ATK[e.def.key] || []).filter(
    (a) => (!a.phase || e.phase >= a.phase) && dist >= a.min && dist <= a.max && ((e as any).cds[a.name] ?? 0) <= 0
  );
  if (!list.length) return null;
  let tot = 0;
  list.forEach((a) => (tot += a.weight ?? 1));
  let r = Math.random() * tot;
  for (const a of list) {
    r -= a.weight ?? 1;
    if (r <= 0) return a;
  }
  return list[0];
}
function startAttack(g: Game, e: Enemy, a: Atk) {
  const tp = tpos(g, e);
  const dir = V(tp.x - e.pos.x, 0, tp.z - e.pos.z).normalize();
  e.atk = { d: a, t: 0, fired: 0, dir, origin: e.pos.clone(), dashHit: false, cx: 0, cz: 0 };
  e.state = 'atk';
  (e as any).cds[a.name] = a.cd;
  e.cd = 0.25 + Math.random() * 0.4;
  e.last = a.name;
  const run = e.atk;
  run.cx = e.pos.x + dir.x * (a.front ?? 0);
  run.cz = e.pos.z + dir.z * (a.front ?? 0);
  if (a.tele) {
    if (a.shape === 'circle') g.fx.telegraph('circle', run.cx, run.cz, 0, a.rad || 3, 1, a.wind, 0xff2a3a);
    else if (a.shape === 'line')
      g.fx.telegraph('rect', e.pos.x, e.pos.z, Math.atan2(dir.x, dir.z), a.width || 2.4, a.reach, a.wind, 0xff2a3a);
  }
  if (e.boss) bus.emit('sfx', 'growl');
  else if (Math.random() < 0.3) bus.emit('sfx', 'growl');
}

export function updateEnemies(g: Game, dt: number) {
  const P = g.P;
  const draw = useGame.getState().settings.draw;
  const inDomain = (x: number, z: number) => !!g.domain && Math.hypot(x - g.domain.x, z - g.domain.z) < g.domain.r;
  for (const e of g.enemies.slice()) {
    const ps = e.ps;
    ps.t = g.t;
    const dist = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z);
    e.rig.root.visible = dist < draw * 0.85;
    if (e.flash > 0) {
      e.flash -= dt;
      if (e.flash <= 0) setFlash(e.rig, false);
    }
    if (e.dead) {
      e.deadT += dt;
      ps.dead = Math.min(1, e.deadT * 1.4);
      pose(e.rig, ps);
      const ex = (e as any).extractAnim as number | undefined;
      if (e.corpse && !e.extracted) {
        if (Math.random() < 0.15)
          g.fx.burst(e.pos.x, 0.3, e.pos.z, 1, {
            speed: 0.5,
            up: 1.2,
            life: 1.2,
            size: 0.18,
            c0: 0xd4a0ff,
            c1: 0x6a2cff,
          });
        if (e.def.key !== 'igris' && e.deadT > 30 && !e.extracting) {
          removeEnemy(g, e);
        }
      } else if (!e.extracting && ex === undefined) {
        if (e.deadT > (e.boss ? 5 : 2.2)) {
          e.rig.root.position.y -= dt * 1.2;
          if (e.rig.root.position.y < -2.5) removeEnemy(g, e);
        }
      }
      continue;
    }
    if (e.poison > 0) {
      e.poison -= dt;
      e.hp -= e.poisonDps * dt;
      if (Math.random() < 0.1)
        g.fx.burst(e.pos.x, 1.2, e.pos.z, 1, { speed: 0.4, up: 1, life: 0.6, size: 0.18, c0: 0x9aff6a, c1: 0x1a6a2a });
      if (e.hp <= 0) {
        killEnemy(g, e);
        continue;
      }
    }
    if (dist > 140 && e.state === 'idle') continue;
    const far = dist > 60 && !(e as any).aggro;
    if (far && (g.enemyId + e.id) % 3 !== Math.floor(g.t * 60) % 3) {
      pose(e.rig, ps);
      continue;
    }
    e.t += dt;
    for (const k of Object.keys((e as any).cds)) (e as any).cds[k] -= dt;
    e.cd -= dt;
    e.slow = inDomain(e.pos.x, e.pos.z) ? 0.65 : 1;
    // rise
    if (e.state === 'rise') {
      const k = Math.min(1, e.t / 1.0);
      e.rig.root.position.y = -2.5 * (1 - k);
      if (Math.random() < 0.5)
        g.fx.burst(e.pos.x, 0.2, e.pos.z, 1, {
          speed: 1,
          up: 2,
          life: 0.8,
          size: 0.4,
          c0: 0x120022,
          c1: 0x050008,
          smoke: true,
        });
      if (e.t >= 1.0) {
        e.state = 'chase';
        e.invuln = false;
        e.rig.root.position.y = 0;
        (e as any).aggro = true;
        if (e.boss) bus.emit('sfx', 'roar');
      }
      e.rig.root.rotation.y = e.yaw;
      pose(e.rig, ps);
      continue;
    }
    // lifted by Ruler's Authority
    if (e.lift > 0) {
      e.lift -= dt;
      const k = e.lift / 1.4;
      const y = Math.sin(Math.min(1, (1 - k) * 3)) * 3;
      e.rig.root.position.y = y * (k > 0.1 ? 1 : k * 10);
      e.rig.root.rotation.y += dt * 4;
      if (e.lift <= 0) {
        e.rig.root.position.y = 0;
        hitEnemy(g, e, g.derived.atk * 2.6 * g.derived.skillMul, { knock: 0, color: '#d4a0ff', crit: true });
        g.fx.shock(e.pos.x, 0, e.pos.z, 0xb26bff, 4, 0.4);
        g.fx.dust(e.pos.x, e.pos.z, 8);
        bus.emit('sfx', 'slam');
      }
      pose(e.rig, ps);
      continue;
    }
    if (e.state === 'hurt') {
      e.hurtT -= dt;
      ps.hurt = Math.max(0, e.hurtT * 3);
      if (e.hurtT <= 0) {
        e.state = 'chase';
        ps.hurt = 0;
      }
      e.rig.root.rotation.y = e.yaw;
      pose(e.rig, ps);
      continue;
    }
    // target selection
    e.tgtT -= dt;
    if (e.tgtT <= 0) {
      e.tgtT = 0.5;
      pickTarget(g, e);
    }
    const tp = tpos(g, e);
    const dx = tp.x - e.pos.x,
      dz = tp.z - e.pos.z;
    const td = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    if (e.state === 'idle') {
      if (td < e.def.detect && !P.dead) {
        e.state = 'chase';
        (e as any).aggro = true;
        bus.emit('sfx', 'growl');
      } else {
        ps.move = 0;
        pose(e.rig, ps);
        e.rig.root.position.set(e.pos.x, e.rig.root.position.y, e.pos.z);
        continue;
      }
    }
    let speed = e.def.speed * e.speedMul * e.slow;
    let mvx = 0,
      mvz = 0;
    ps.rear = 0;
    ps.block = 0;
    ps.atk = -1;
    if (e.state === 'block') {
      e.blockT -= dt;
      ps.block = 1;
      speed = 0;
      e.yaw += angDiff(e.yaw, want) * Math.min(1, dt * 6);
      if (e.riposte) {
        e.riposte = false;
        const a = ATK.igris[0];
        e.blockT = 0;
        startAttack(g, e, { ...a, wind: 0.18, hits: [0.28, 0.65, 1.0], cd: 1 });
      } else if (e.blockT <= 0) {
        e.state = 'chase';
        e.cd = 0.2;
      }
    } else if (e.state === 'atk' && e.atk) {
      const run = e.atk;
      const a = run.d;
      run.t += dt;
      const total = a.wind + a.strike + a.rec + (a.hits ? a.hits[a.hits.length - 1] - a.wind : 0);
      speed = 0;
      if (run.t < a.wind * (a.shape === 'line' ? 0.6 : 0.75)) {
        e.yaw += angDiff(e.yaw, want) * Math.min(1, dt * (e.boss ? 7 : 4));
        run.dir.set(Math.sin(e.yaw), 0, Math.cos(e.yaw));
        if (a.shape === 'circle' && a.front) {
          run.cx = e.pos.x + run.dir.x * a.front;
          run.cz = e.pos.z + run.dir.z * a.front;
        }
        if (a.tele && a.shape === 'line') {
          /* telegraph static */
        }
      }
      ps.atk = Math.min(1, run.t / total);
      ps.kind = a.kind;
      if (e.rig.kind === 'serp')
        ps.rear = Math.min(1, run.t / a.wind) * (a.kind === 'spit' || a.kind === 'bite' ? 0.9 : 0.3);
      if (a.shape === 'multi') {
        const hs = a.hits!;
        const idx = run.fired;
        ps.kind = ['slash1', 'slash2', 'stab'][Math.min(2, idx)];
        const hitAt = hs[Math.min(idx, hs.length - 1)];
        ps.atk = Math.max(0, Math.min(1, (run.t - (hitAt - 0.22)) / 0.45));
        if (idx < hs.length && run.t >= hs[idx]) {
          run.fired++;
          e.yaw = want;
          run.dir.set(Math.sin(e.yaw), 0, Math.cos(e.yaw));
          const nx = e.pos.x + run.dir.x * 1.1,
            nz = e.pos.z + run.dir.z * 1.1;
          if (walkable(g.zone, nx, nz, e.r) && td > 2) {
            e.pos.x = nx;
            e.pos.z = nz;
          }
          strike(g, e, run);
          g.fx.sparks(e.pos.x + run.dir.x * 2, 1.4, e.pos.z + run.dir.z * 2, 0xff2030, 8);
        } else if (idx >= hs.length && run.t < hs[hs.length - 1] + 0.1) {
          /* recover */
        }
        if (e.rig.weapon && e.def.key === 'igris') {
          /* weapon glow handled by emissive */
        }
      } else if (a.shape === 'proj') {
        if (run.fired === 0 && run.t >= a.wind) {
          run.fired = 1;
          const m = new THREE.Mesh(SPIT_GEO, SPIT_MAT);
          const pos = e.pos.clone().add(V(run.dir.x * 2.5, 2.2, run.dir.z * 2.5));
          m.position.copy(pos);
          g.scene.add(m);
          const v = run.dir.clone().multiplyScalar(15);
          const dd = Math.max(2, td);
          v.y = -(2.0 / (dd / 15)) * 0.8;
          g.projs.push({
            mesh: m,
            pos,
            vel: v,
            dmg: e.def.atk * a.dmg,
            life: 2.4,
            radius: 0.8,
            mine: false,
            pierce: false,
            hit: new Set(),
            poison: a.poison,
            kind: 'spit',
          });
          bus.emit('sfx', 'bolt');
        }
      } else if (a.shape === 'line') {
        if (run.t >= a.wind && run.t < a.wind + a.strike) {
          const sp = a.dash || 10;
          const nx = e.pos.x + run.dir.x * sp * dt,
            nz = e.pos.z + run.dir.z * sp * dt;
          if (walkable(g.zone, nx, nz, e.r * 0.8)) {
            e.pos.x = nx;
            e.pos.z = nz;
          }
          if (!run.dashHit) {
            for (const tg of [
              { p: P.pos, a: null as any },
              ...g.allies.filter((q) => q.state !== 'dead' && q.state !== 'rise').map((q) => ({ p: q.pos, a: q })),
            ]) {
              const rx = tg.p.x - e.pos.x,
                rz = tg.p.z - e.pos.z;
              const along = rx * run.dir.x + rz * run.dir.z;
              const side = Math.abs(rx * run.dir.z - rz * run.dir.x);
              if (along > -e.r && along < e.r + 1.2 && side < (a.width || 1.6) / 2 + 0.3) {
                if (!tg.a) {
                  g.hurtPlayer(e.def.atk * a.dmg, e.pos, a.knock, a.poison || 0);
                  run.dashHit = true;
                } else hitAlly(g, tg.a, e.def.atk * a.dmg, e.pos);
              }
            }
            if (Math.random() < 0.6)
              g.fx.burst(e.pos.x, 0.5, e.pos.z, 1, {
                speed: 1,
                life: 0.4,
                size: 0.5,
                c0: 0xff2030,
                c1: 0x300008,
                smoke: true,
              });
          }
        }
      } else if (run.fired === 0 && run.t >= a.wind) {
        run.fired = 1;
        strike(g, e, run);
        if (e.def.key === 'guardian') g.fx.dust(run.cx, run.cz, 10);
        if (a.shape === 'circle' && a.rad && a.rad > 6) {
          g.slow = { t: 0.25, s: 0.4 };
        }
      }
      if (run.t >= total) {
        e.atk = null;
        e.state = 'chase';
      }
    } else {
      // chase / strafe
      e.yaw += angDiff(e.yaw, want) * Math.min(1, dt * 8);
      const atk = e.cd <= 0 && !P.dead ? chooseAttack(g, e, td - e.r * 0.5) : null;
      if (atk) startAttack(g, e, atk);
      else if (
        e.def.key === 'igris' &&
        e.cd <= 0 &&
        td < 8 &&
        Math.random() < dt * 0.5 &&
        ((e as any).cds.block ?? 0) <= 0 &&
        P.atk
      ) {
        e.state = 'block';
        e.blockT = 1.5;
        (e as any).cds.block = 5;
        g.fx.sparks(e.pos.x, 1.6, e.pos.z, 0xffffff, 8);
      } else {
        const stand = e.boss
          ? Math.min(3.2, (ATK[e.def.key]?.[0]?.max ?? 2) * 0.8)
          : (ATK[e.def.key]?.[0]?.max ?? 2) * 0.7;
        if (td > stand) {
          mvx = Math.sin(want);
          mvz = Math.cos(want);
        } else if (e.boss || e.def.key === 'knight') {
          const s = Math.sin(g.t * 0.7 + e.id) > 0 ? 1 : -1;
          mvx = Math.cos(want) * s * 0.6;
          mvz = -Math.sin(want) * s * 0.6;
          speed *= 0.6;
        } else speed = 0;
      }
    }
    // separation
    for (const o of g.enemies) {
      if (o === e || o.dead) continue;
      const sx = e.pos.x - o.pos.x,
        sz = e.pos.z - o.pos.z;
      const sd = Math.hypot(sx, sz);
      const mr = e.r + o.r;
      if (sd < mr && sd > 0.001) {
        mvx += (sx / sd) * 0.8;
        mvz += (sz / sd) * 0.8;
      }
    }
    const ml = Math.hypot(mvx, mvz);
    if (ml > 0.01 && speed > 0) {
      mvx /= Math.max(1, ml);
      mvz /= Math.max(1, ml);
      const nx = e.pos.x + mvx * speed * dt,
        nz = e.pos.z + mvz * speed * dt;
      const rr = e.r * 0.8;
      if (walkable(g.zone, nx, nz, rr)) {
        e.pos.x = nx;
        e.pos.z = nz;
      } else if (walkable(g.zone, nx, e.pos.z, rr)) e.pos.x = nx;
      else if (walkable(g.zone, e.pos.x, nz, rr)) e.pos.z = nz;
    }
    ps.move = speed > 0 ? Math.min(1.4, (ml > 0.01 ? speed : 0) / 5) : 0;
    ps.phase += dt * (5 + speed * 1.2) * (ps.move > 0.05 ? 1 : 0);
    if (e.def.key === 'igris') ps.block = e.state === 'block' ? 1 : 0;
    if (P.dead && e.state === 'chase') {
      /* gloat */
    }
    e.rig.root.position.set(e.pos.x, e.rig.root.position.y > 0 ? e.rig.root.position.y : 0, e.pos.z);
    e.rig.root.rotation.y = e.yaw;
    pose(e.rig, ps);
  }
}
