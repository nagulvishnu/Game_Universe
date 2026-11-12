// Shadow army: extraction sequence, summoning, squads/commands AI, shadow XP.
import * as THREE from 'three';
import type { Ally, Enemy, Game, V3 } from './game';
import { RANKS, SHADOWS, SHADOW_RANK_COLORS } from './data';
import { bus, shadowStats, shadowXpNeed, useGame, type ShadowRec } from './store';
import { makeGoblin, makeIgris, makeKnight, makeLizard, makeSerpent, newPose, pose, setFlash } from './models';
import { walkable } from './world';
import { hitEnemy, removeEnemy } from './enemies';
import * as story from './story';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const angDiff = (a: number, b: number) => {
  let d = b - a;
  while (d > Math.PI) d -= 6.2832;
  while (d < -Math.PI) d += 6.2832;
  return d;
};
const CMDS = ['follow', 'attack', 'defend', 'hold', 'regroup'];

export function canExtract(_g: Game, e: Enemy) {
  return !!useGame.getState().save.flags.necro && e.def.extract > 0 && !!SHADOWS[e.def.key] && !e.noLoot;
}

export function tryExtract(g: Game, doIt: boolean): string | null {
  const sv = useGame.getState().save;
  if (!sv.flags.necro || g.extraction) return null;
  let best: Enemy | null = null,
    bd = 4.8;
  for (const e of g.enemies) {
    if (!e.dead || !e.corpse || e.extracted || e.extracting) continue;
    const d = e.pos.distanceTo(g.P.pos);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  if (!best) return null;
  const chance =
    best.def.key === 'igris'
      ? [35, 70, 100][Math.min(2, best.tries)]
      : Math.min(95, Math.round((best.def.extract + g.derived.extractBonus) * 100));
  if (!doIt) return `[E] Extract Shadow: ${best.def.name}  (10 MP, ${chance}% chance)`;
  if (g.P.mp < 10) {
    useGame.getState().notify({ title: 'NOT ENOUGH MANA', text: 'Extraction costs 10 MP.' });
    return null;
  }
  g.P.mp -= 10;
  best.extracting = true;
  g.extraction = { e: best, t: 0 };
  g.slow = { t: 2.1, s: 0.45 };
  bus.emit('sfx', 'extract');
  g.fx.decal(best.pos.x, best.pos.z, 3.6, 2.6);
  const dir = V(best.pos.x - g.P.pos.x, 0, best.pos.z - g.P.pos.z).normalize();
  g.P.yaw = Math.atan2(dir.x, dir.z);
  g.banner('SHADOW EXTRACTION', best.def.name, '#b26bff', 2);
  return null;
}
export function extractionUpdate(g: Game, dt: number) {
  const x = g.extraction;
  if (!x) return;
  const e: Enemy = x.e;
  x.t += dt;
  const k = Math.min(1, x.t / 1.5);
  const P = g.P;
  P.ps.cast = 1;
  P.castT = 0.15;
  (e as any).extractAnim = k;
  e.rig.root.position.y = -1.7 * k * k;
  e.rig.root.scale.setScalar(1 - 0.25 * k);
  for (let i = 0; i < 3; i++) {
    const a = Math.random() * 6.28,
      r = 2.5 + Math.random() * 1.5;
    g.fx.burst(e.pos.x + Math.cos(a) * r, 0.2, e.pos.z + Math.sin(a) * r, 1, {
      speed: 0.2,
      life: 0.6,
      size: 0.35,
      c0: 0x6a2cff,
      c1: 0xd4a0ff,
      spread: 0.1,
    });
  }
  g.fx.burst(e.pos.x, 0.3, e.pos.z, 2, {
    speed: 1.5,
    up: 3 + k * 4,
    life: 1.2,
    size: 0.3,
    c0: 0xd4a0ff,
    c1: 0x300060,
    grav: -2,
  });
  g.fx.burst(e.pos.x, 0.3, e.pos.z, 2, {
    speed: 2,
    up: 2,
    life: 1.2,
    size: 0.8,
    end: 1.6,
    c0: 0x120022,
    c1: 0x000000,
    smoke: true,
  });
  g.shake = Math.max(g.shake, 0.12 + k * 0.15);
  if (x.t >= 1.7) {
    g.extraction = null;
    const d = e.def;
    const sv = useGame.getState();
    let ch = d.extract + g.derived.extractBonus;
    if (d.key === 'igris') ch = [0.35, 0.7, 1][Math.min(2, e.tries)];
    e.tries++;
    const ok = Math.random() < ch;
    (e as any).extractAnim = undefined;
    if (ok) {
      e.extracted = true;
      const rec = sv.addShadow(d.key);
      removeEnemy(g, e);
      bus.emit('sfx', 'arise');
      g.shake = 0.7;
      const rankHex = new THREE.Color(SHADOW_RANK_COLORS[rec.rank] ?? '#8a4aff').getHex();
      g.fx.shock(e.pos.x, 0, e.pos.z, rankHex, 12, 1);
      g.fx.shadowBurst(e.pos.x, 1, e.pos.z, 50, 5);
      g.fx.burst(e.pos.x, 1, e.pos.z, 30, { speed: 5, up: 3, life: 1, size: 0.3, c0: 0xffffff, c1: rankHex });
      useGame.getState().setArise({ stage: 1, text: 'ARISE' });
      setTimeout(
        () =>
          useGame
            .getState()
            .setArise({ stage: 2, name: rec.name, rank: RANKS[rec.rank], text: 'SHADOW EXTRACTION COMPLETE' }),
        1900
      );
      setTimeout(() => useGame.getState().setArise(null), 5200);
      sv.addScore(d.key === 'igris' ? 3000 : 400);
      sv.questEvent('extract', d.key, 1);
      summonShadow(g, rec, true, e.pos);
      story.onExtract?.(g, d.key);
    } else {
      e.rig.root.position.y = 0;
      e.rig.root.scale.setScalar(1);
      e.extracting = false;
      bus.emit('sfx', 'hurt');
      g.shake = 0.3;
      if (d.key === 'igris') {
        sv.notify({ title: 'EXTRACTION FAILED', text: 'The shadow resists... Try again (Press E).' });
        g.banner('EXTRACTION FAILED', 'The shadow resists...', '#ff4a5a', 2.4);
      } else {
        sv.notify({ title: 'EXTRACTION FAILED', text: d.name + ' dissolved into nothing.' });
        removeEnemy(g, e);
        g.fx.shadowBurst(e.pos.x, 0.5, e.pos.z, 10, 2);
      }
    }
  }
}

function buildRig(key: string) {
  switch (SHADOWS[key].model) {
    case 'igris':
      return makeIgris(true);
    case 'knight':
      return makeKnight(true);
    case 'goblin':
      return makeGoblin(true);
    case 'lizard':
      return makeLizard(true);
    default:
      return makeSerpent({ n: 9, rad: 0.26, c1: 0, c2: 0, legs: true, shadow: true });
  }
}
export function summonShadow(g: Game, rec: ShadowRec, silent = false, at?: V3) {
  if (g.allies.some((a) => a.rec.id === rec.id)) return;
  const budget = useGame.getState().settings.army;
  if (g.allies.length >= budget) {
    if (!silent)
      useGame.getState().notify({
        title: 'ARMY BUDGET REACHED',
        text: `Max ${budget} active shadows (Settings > Army budget). Others stay safely in storage.`,
      });
    return;
  }
  const def = SHADOWS[rec.key];
  const st = shadowStats(rec);
  const rig = buildRig(rec.key);
  const p = at ? at.clone() : V(g.P.pos.x + (Math.random() - 0.5) * 4, 0, g.P.pos.z + (Math.random() - 0.5) * 4);
  if (!at && !walkable(g.zone, p.x, p.z, 0.5)) p.copy(g.P.pos);
  const a: Ally = {
    rec,
    def,
    rig,
    ps: newPose(),
    pos: p,
    yaw: g.P.yaw,
    hp: st.hp,
    maxHp: st.hp,
    st,
    state: 'rise',
    t: 0,
    target: null,
    tgtT: Math.random() * 0.4,
    atkT: -1,
    atkCd: 0,
    cmd: g.cmd,
    hold: null,
    slot: g.allies.length,
    combo: 0,
    regroupT: 0,
    rushCd: 3,
    r: 0.6 * def.scale,
    flash: 0,
    hit: false,
    vel: V(),
    dash: 0,
  };
  rig.root.position.set(p.x, -2.5, p.z);
  rig.root.scale.setScalar(0.7);
  g.scene.add(rig.root);
  g.allies.push(a);
  useGame.getState().patchShadow(rec.id, { state: 'summoned' });
  g.fx.shadowBurst(p.x, 0.4, p.z, 26, 2.8);
  const rankColor = new THREE.Color(SHADOW_RANK_COLORS[rec.rank] ?? '#7a3cff').getHex();
  g.fx.shock(p.x, 0, p.z, rankColor, 4.2, 0.8);
  g.fx.burst(p.x, 0.15, p.z, 12, {
    speed: 1.6,
    up: 4.5,
    life: 1.1,
    size: 0.2,
    c0: 0xd4a0ff,
    c1: rankColor,
    grav: -1.5,
  });
  if (!silent) {
    bus.emit('sfx', 'summon');
    g.fx.decal(p.x, p.z, 2.4, 1.6);
  }
}
export function dismissAll(g: Game, ids?: string[]) {
  for (const a of g.allies.slice()) {
    if (ids && !ids.includes(a.rec.id)) continue;
    g.fx.shadowBurst(a.pos.x, 0.8, a.pos.z, 18, 2.5);
    g.fx.burst(a.pos.x, 0.6, a.pos.z, 12, {
      speed: 0.8,
      up: 3.6,
      life: 1,
      size: 0.16,
      c0: 0xd4a0ff,
      c1: 0x2a0a5a,
      grav: -1,
    });
    g.fx.shock(a.pos.x, 0, a.pos.z, 0x8a4aff, 2.8, 0.6);
    g.scene.remove(a.rig.root);
    g.allies = g.allies.filter((q) => q !== a);
    useGame.getState().patchShadow(a.rec.id, { state: 'stored' });
  }
  if (!ids || ids.length) bus.emit('sfx', 'extract');
}
export function setCommand(g: Game, cmd: string) {
  g.cmd = cmd;
  for (const a of g.allies) {
    a.cmd = cmd;
    if (cmd === 'hold') a.hold = a.pos.clone();
    if (cmd === 'regroup') {
      a.regroupT = 3;
      a.target = null;
    }
    if (cmd !== 'hold') a.hold = null;
  }
  g.fx.shock(g.P.pos.x, 0, g.P.pos.z, 0xb26bff, 5, 0.5);
  useGame.getState().notify({
    title: 'SHADOW COMMAND',
    text: cmd.toUpperCase() + (g.allies.length ? ` (${g.allies.length} active)` : ''),
  });
  bus.emit('sfx', 'ui');
}
export function summonDefault(g: Game) {
  const sv = useGame.getState().save;
  let list = sv.shadows.filter((s) => s.squad === 1);
  if (!list.length) list = sv.shadows.filter((s) => s.favorite);
  if (!list.length) list = sv.shadows.slice();
  list = list.slice().sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.rank - a.rank || b.level - a.level);
  list.slice(0, useGame.getState().settings.army).forEach((r, i) => setTimeout(() => summonShadow(g, r), i * 90));
  if (!list.length)
    useGame.getState().notify({ title: 'NO SHADOWS', text: 'Extract defeated enemies to build your army.' });
}
export function grantShadowXp(g: Game, e: Enemy) {
  for (const a of g.allies) {
    if (a.state === 'dead' || a.pos.distanceTo(e.pos) > 45) continue;
    const r = a.rec;
    let xp = r.xp + e.def.xp * 0.6;
    let lvl = r.level;
    let up = false;
    while (xp >= shadowXpNeed(lvl) && lvl < 50) {
      xp -= shadowXpNeed(lvl);
      lvl++;
      up = true;
    }
    useGame.getState().patchShadow(r.id, { xp, level: lvl, kills: r.kills + 1 });
    if (up) {
      a.rec = { ...r, xp, level: lvl };
      const st = shadowStats(a.rec);
      const ratio = a.hp / a.maxHp;
      a.st = st;
      a.maxHp = st.hp;
      a.hp = st.hp * Math.max(ratio, 0.6);
      g.fx.shock(a.pos.x, 0, a.pos.z, 0xb26bff, 4, 0.6);
      useGame.getState().notify({ kind: 'levelup', title: 'SHADOW LEVEL UP', text: `${r.name} reached Lv ${lvl}` });
    }
  }
}

export function updateAllies(g: Game, dt: number) {
  const P = g.P;
  const n = g.allies.length;
  const dom = !!g.domain;
  g.allies.forEach((a, idx) => {
    const ps = a.ps;
    ps.t = g.t;
    a.t += dt;
    a.slot = idx;
    const dist = a.pos.distanceTo(P.pos);
    a.rig.root.visible = dist < 90;
    if (a.flash > 0) {
      a.flash -= dt;
      if (a.flash <= 0) setFlash(a.rig, false);
    }
    if (a.state === 'dead') {
      ps.dead = Math.min(1, a.t * 1.5);
      pose(a.rig, ps);
      a.rig.root.position.y = -Math.max(0, a.t - 0.5) * 0.9;
      if (a.t > 0.25 && Math.random() < 0.35)
        g.fx.burst(a.pos.x + (Math.random() - 0.5) * 0.8, 0.5 + Math.random() * 1.2, a.pos.z + (Math.random() - 0.5) * 0.8, 1, {
          speed: 0.4,
          up: 1.8,
          life: 1,
          size: 0.34,
          c0: 0x6a2cff,
          c1: 0x120022,
          smoke: true,
        });
      if (a.t > 1.6) {
        g.fx.shadowBurst(a.pos.x, 0.4, a.pos.z, 14, 1.6);
        g.fx.burst(a.pos.x, 0.7, a.pos.z, 10, {
          speed: 1.4,
          up: 3,
          life: 0.9,
          size: 0.16,
          c0: 0xd4a0ff,
          c1: 0x3a0a6a,
        });
        g.scene.remove(a.rig.root);
        g.allies = g.allies.filter((q) => q !== a);
        useGame.getState().patchShadow(a.rec.id, { state: 'stored' });
      }
      return;
    }
    if (a.state === 'rise') {
      const k = Math.min(1, a.t / 1.1);
      const e = k * k * (3 - 2 * k);
      a.rig.root.position.set(a.pos.x, -2.5 * (1 - e), a.pos.z);
      a.rig.root.scale.setScalar(0.7 + 0.3 * e + Math.sin(k * Math.PI) * 0.04);
      if (Math.random() < 0.55)
        g.fx.burst(a.pos.x, 0.2, a.pos.z, 1, {
          speed: 1,
          up: 2.4,
          life: 0.8,
          size: 0.4,
          c0: 0x120022,
          c1: 0x050008,
          smoke: true,
        });
      if (Math.random() < 0.4)
        g.fx.burst(a.pos.x, 0.3, a.pos.z, 1, {
          speed: 0.6,
          up: 2.2,
          life: 0.7,
          size: 0.14,
          c0: 0xd4a0ff,
          c1: 0x4a1c9a,
        });
      pose(a.rig, ps);
      if (a.t >= 1.1) {
        a.state = 'idle';
        a.rig.root.position.y = 0;
        a.rig.root.scale.setScalar(1);
        g.fx.shock(a.pos.x, 0, a.pos.z, 0xb26bff, 2.6, 0.5);
      }
      return;
    }
    const boost = dom && g.inDomain(a.pos) ? 1.3 : 1;
    if (Math.random() < 0.02)
      g.fx.burst(a.pos.x, 0.2, a.pos.z, 1, { speed: 0.3, up: 1.5, life: 0.9, size: 0.3, c0: 0x6a2cff, c1: 0x120022 });
    a.tgtT -= dt;
    a.atkCd -= dt;
    a.rushCd -= dt;
    a.regroupT -= dt;
    if (a.tgtT <= 0) {
      a.tgtT = 0.35 + (idx % 5) * 0.03;
      let best: Enemy | null = null;
      let bd = 1e9;
      const centre = a.cmd === 'hold' && a.hold ? a.hold : P.pos;
      const rng = a.cmd === 'attack' ? 45 : a.cmd === 'hold' ? 4 : a.cmd === 'defend' ? 10 : 11;
      if (a.cmd === 'attack' && g.lock && !g.lock.dead) best = g.lock;
      else if (a.regroupT <= 0)
        for (const e of g.enemies) {
          if (e.dead || e.state === 'rise' || e.invuln) continue;
          const d = Math.hypot(e.pos.x - centre.x, e.pos.z - centre.z);
          if (d < rng && d < bd) {
            bd = d;
            best = e;
          }
        }
      a.target = best;
    }
    let tx = 0,
      tz = 0,
      speed = a.st.speed * boost,
      moving = false;
    const t = a.target && !a.target.dead ? a.target : null;
    if (a.target && a.target.dead) a.target = null;
    if (a.dash > 0) {
      a.dash -= dt;
      const dd = V(a.vel.x, 0, a.vel.z);
      a.pos.addScaledVector(dd, dt);
      if (a.dash <= 0 && t) {
        g.fx.shock(a.pos.x, 0, a.pos.z, 0xff2a3a, 4, 0.4);
        for (const e of g.enemies)
          if (!e.dead && e.pos.distanceTo(a.pos) < 4)
            hitEnemy(g, e, a.st.atk * 1.5, {
              knock: 6,
              dir: V(e.pos.x - a.pos.x, 0, e.pos.z - a.pos.z).normalize(),
              color: '#c88aff',
              ally: a,
            });
        bus.emit('sfx', 'slam');
      }
      ps.move = 1.4;
      ps.phase += dt * 14;
      a.rig.root.position.set(a.pos.x, 0, a.pos.z);
      pose(a.rig, ps);
      return;
    }
    if (a.atkT >= 0) {
      a.atkT += dt;
      const total = a.def.style === 'combo' ? 0.9 : 0.55;
      ps.atk = Math.min(
        1,
        (a.atkT % (total / (a.def.style === 'combo' ? 3 : 1))) / (total / (a.def.style === 'combo' ? 3 : 1))
      );
      ps.kind = a.rig.kind === 'hum' ? ['slash1', 'slash2', 'stab'][a.combo % 3] : 'bite';
      if (t) a.yaw += angDiff(a.yaw, Math.atan2(t.pos.x - a.pos.x, t.pos.z - a.pos.z)) * Math.min(1, dt * 10);
      const hits = a.def.style === 'combo' ? [0.15, 0.45, 0.75] : [0.25];
      if (!a.hit && hits.some((h) => a.atkT >= h && a.atkT - dt < h) && t) {
        const dmg =
          a.st.atk * boost * (0.9 + Math.random() * 0.2) * (a.rec.key === 'igris' && a.combo % 3 === 2 ? 1.6 : 1);
        hitEnemy(g, t, dmg, {
          knock: 2,
          dir: V(t.pos.x - a.pos.x, 0, t.pos.z - a.pos.z).normalize(),
          color: '#c88aff',
          ally: a,
        });
        a.combo++;
        if (a.rig.kind === 'hum' && Math.random() < 0.6) g.fx.sparks(t.pos.x, 1.2, t.pos.z, 0xb26bff, 5);
      }
      if (a.atkT >= total) {
        a.atkT = -1;
        a.atkCd = a.def.style === 'combo' ? 0.5 : 0.7;
        ps.atk = -1;
      }
    } else if (a.regroupT > 0) {
      tx = P.pos.x;
      tz = P.pos.z;
      speed *= 1.8;
      moving = true;
    } else if (t) {
      const dx = t.pos.x - a.pos.x,
        dz = t.pos.z - a.pos.z;
      const d = Math.hypot(dx, dz);
      a.yaw += angDiff(a.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 10);
      const reach = (a.rec.key === 'igris' ? 3.0 : 2.1) + t.r;
      if (a.rec.key === 'igris' && a.rushCd <= 0 && d > 7 && d < 22) {
        a.rushCd = 7;
        a.dash = 0.28;
        a.vel.set((dx / 0.28) * (1 - 3 / d), 0, (dz / 0.28) * (1 - 3 / d));
        g.fx.sparks(a.pos.x, 1, a.pos.z, 0xff2a3a, 12);
        bus.emit('sfx', 'dash');
      } else if (d > reach) {
        tx = t.pos.x;
        tz = t.pos.z;
        moving = true;
        speed *= 1.1;
      } else if (a.atkCd <= 0) {
        a.atkT = 0;
        a.hit = false;
        if (a.def.style === 'combo') a.combo = 0;
        bus.emit('sfx', 'swing', 2);
      }
      if (a.atkT >= 0) a.hit = false;
    } else {
      const m = Math.max(1, n);
      const ang =
        P.yaw + Math.PI + ((idx % 2 ? 1 : -1) * Math.ceil((idx + 1) / 2) * 0.55) / (1 + Math.floor(m / 12) * 0.2);
      const rad = 2.6 + Math.floor(idx / 8) * 1.7;
      if (a.cmd === 'hold' && a.hold) {
        tx = a.hold.x;
        tz = a.hold.z;
      } else if (a.cmd === 'defend') {
        tx = P.pos.x + Math.sin(ang) * (rad + 1);
        tz = P.pos.z + Math.cos(ang) * (rad + 1);
      } else {
        tx = P.pos.x + Math.sin(ang) * rad;
        tz = P.pos.z + Math.cos(ang) * rad;
      }
      const d = Math.hypot(tx - a.pos.x, tz - a.pos.z);
      moving = d > 0.9;
      if (d > 8) speed *= 1.7;
      if (dist > 45) {
        a.pos.set(P.pos.x + (Math.random() - 0.5) * 3, 0, P.pos.z + (Math.random() - 0.5) * 3);
        g.fx.shadowBurst(a.pos.x, 1, a.pos.z, 10, 2);
      }
    }
    if (moving) {
      const dx = tx - a.pos.x,
        dz = tz - a.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const sp = Math.min(speed, d * 5);
      const nx = a.pos.x + (dx / d) * sp * dt,
        nz = a.pos.z + (dz / d) * sp * dt;
      if (walkable(g.zone, nx, nz, a.r * 0.8)) {
        a.pos.x = nx;
        a.pos.z = nz;
      } else if (walkable(g.zone, nx, a.pos.z, a.r * 0.8)) a.pos.x = nx;
      else if (walkable(g.zone, a.pos.x, nz, a.r * 0.8)) a.pos.z = nz;
      a.yaw += angDiff(a.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 10);
      ps.move = Math.min(1.4, sp / 5);
      ps.phase += dt * (5 + sp * 1.1);
    } else ps.move = 0;
    for (const o of g.allies) {
      if (o === a || o.state === 'dead') continue;
      const sx = a.pos.x - o.pos.x,
        sz = a.pos.z - o.pos.z;
      const sd = Math.hypot(sx, sz);
      if (sd < 0.9 && sd > 0.01) {
        a.pos.x += (sx / sd) * dt * 2;
        a.pos.z += (sz / sd) * dt * 2;
      }
    }
    a.rig.root.position.set(a.pos.x, 0, a.pos.z);
    a.rig.root.rotation.y = a.yaw;
    pose(a.rig, ps);
  });
}
export { CMDS };
