/**
 * Skill execution tests — runs the real SkillExecutor against real Fighters
 * using lightweight stand-ins for Phaser display objects.
 */
import { describe, it, expect } from 'vitest';
import { SkillExecutor, type SkillWorld } from '../game/skills/SkillExecutor';
import { Fighter, type EquippedSkill } from '../game/entities/Fighter';
import { getWeapon } from '../data/weapons';
import { SKILL_BY_ID, SKILLS } from '../data/skills';

function stub(): unknown {
  const target: Record<string, unknown> = {};
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(t, prop) {
      if (prop in t) return t[prop as string];
      if (prop === 'scaleX' || prop === 'x' || prop === 'y' || prop === 'alpha') return 0;
      return () => new Proxy(t, handler);
    },
    set(t, prop, v) { t[prop as string] = v; return true; },
  };
  return new Proxy(target, handler);
}

const delayed: (() => void)[] = [];
const sceneStub = {
  add: { graphics: () => stub(), container: () => stub(), particles: () => stub(), text: () => stub() },
  time: { delayedCall: (_ms: number, fn: () => void) => { delayed.push(fn); return stub(); } },
  events: { on: () => undefined, off: () => undefined, emit: () => undefined },
  tweens: { add: () => stub() },
  cameras: { main: stub() },
} as unknown as Phaser.Scene;

const effectsStub = new Proxy({}, { get: () => () => undefined }) as unknown as SkillWorld['effects'];

function skill(id: string, level = 1): EquippedSkill {
  const def = SKILL_BY_ID[id];
  return { def, level, cfg: def.levels[level - 1], cooldown: 0 };
}

function makeFighter(x: number, facing: 1 | -1, side: 'p1' | 'p2'): Fighter {
  return new Fighter(sceneStub, {
    side, name: side, weapon: getWeapon('shadow_katana'),
    skills: [skill('fire_homing'), skill('laser_beam'), skill('shadow_clone')],
    equipment: {}, maxHealth: 100, bodyColor: 0, eyeColor: 0, auraColor: 0,
    scale: 1, x, facing,
  }, 600, { left: 60, right: 1220 });
}

function makeWorld() {
  const p1 = makeFighter(400, 1, 'p1');
  const p2 = makeFighter(600, -1, 'p2');
  let damageEvents = 0;
  const world: SkillWorld = {
    scene: sceneStub,
    effects: effectsStub,
    fighters: [p1, p2],
    floorY: 600,
    bounds: { left: 60, right: 1220 },
    dealDamage: (a, t, amount, o) => {
      damageEvents++;
      const r = t.takeDamage(amount, a.x, o?.knockback ?? 0, o?.launch ?? 0, o ?? {});
      return r.damage;
    },
    hitStop: () => undefined,
  };
  const exec = new SkillExecutor(world);
  return { p1, p2, exec, world, damage: () => damageEvents };
}

describe('skill executor', () => {
  it('spawns and cleans up a homing projectile that damages the target', () => {
    const { p1, p2, exec } = makeWorld();
    const def = SKILL_BY_ID.fire_homing;
    exec.cast(p1, def, def.levels[0]);
    expect(exec.activeCount).toBe(1);
    const hpBefore = p2.health;
    for (let i = 0; i < 120 && exec.activeCount > 0; i++) exec.update(16);
    expect(p2.health).toBeLessThan(hpBefore);
    expect(exec.activeCount).toBe(0); // projectile cleaned itself up
  });

  it('a straight projectile that misses never deals damage', () => {
    const { p1, p2, exec } = makeWorld();
    p2.x = 60; // behind the caster, who is facing right
    const def = SKILL_BY_ID.energy_bolt;
    exec.cast(p1, def, def.levels[0]);
    const hp = p2.health;
    for (let i = 0; i < 200 && exec.activeCount > 0; i++) exec.update(16);
    expect(p2.health).toBe(hp);
    expect(exec.activeCount).toBe(0);
  });

  it('beams tick damage only while active and then disappear', () => {
    const { p1, p2, exec } = makeWorld();
    const def = SKILL_BY_ID.laser_beam;
    exec.cast(p1, def, def.levels[0]);
    const hp = p2.health;
    for (let i = 0; i < 40; i++) exec.update(16);
    expect(p2.health).toBeLessThan(hp);
    const mid = p2.health;
    for (let i = 0; i < 200 && exec.activeCount > 0; i++) exec.update(16);
    expect(exec.activeCount).toBe(0);
    const after = p2.health;
    for (let i = 0; i < 60; i++) exec.update(16);
    expect(p2.health).toBe(after);
    expect(after).toBeLessThanOrEqual(mid);
  });

  it('shadow clones appear, act and expire without recursive summoning', () => {
    const { p1, exec } = makeWorld();
    const def = SKILL_BY_ID.shadow_clone;
    exec.cast(p1, def, def.levels[0]);
    const spawned = exec.activeCount;
    expect(spawned).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < 60; i++) exec.update(16);
    expect(exec.activeCount).toBeLessThanOrEqual(spawned);
    for (let i = 0; i < 600 && exec.activeCount > 0; i++) exec.update(16);
    expect(exec.activeCount).toBe(0);
  });

  it('upgrade perks change real behaviour (multishot fires more projectiles)', () => {
    const { p1, exec } = makeWorld();
    const def = SKILL_BY_ID.fire_homing;
    exec.cast(p1, def, def.levels[0]);
    const base = exec.activeCount;
    exec.clear();
    exec.cast(p1, def, def.levels[4]); // signature level includes multishot
    expect(exec.activeCount).toBeGreaterThan(base);
  });

  it('buffs apply timed status effects to the caster', () => {
    const { p1, exec } = makeWorld();
    const def = SKILL_BY_ID.def_barrier;
    exec.cast(p1, def, def.levels[4]);
    expect(p1.status.shield).toBeGreaterThan(0);
    expect(p1.status.damageBuff).toBeGreaterThan(0);
  });

  it('every catalogue skill resolves to a working execution path', () => {
    const { p1, exec } = makeWorld();
    let executed = 0;
    for (const def of SKILLS) {
      for (const lvl of [def.levels[0], def.levels[4]]) {
        const ok = exec.cast(p1, def, lvl);
        if (ok) executed++;
      }
      exec.update(16);
      exec.clear();
      while (delayed.length) delayed.pop();
    }
    expect(executed).toBe(SKILLS.length * 2);
    exec.clear();
    expect(exec.activeCount).toBe(0);
  });
});
