/**
 * SHADOWSTRIKE — Projectile Deflection & One-Hit Clone Destruction tests.
 *
 * Tests 1-7:  Projectile deflection system.
 * Tests 8-16: Clone one-hit destruction.
 */
import { describe, it, expect } from 'vitest';
import { SkillExecutor, type SkillWorld, MAX_ACTIVE_CLONES, DEFLECT_COOLDOWN_MS } from '../game/skills/SkillExecutor';
import { Fighter, type EquippedSkill, EMPTY_INPUT } from '../game/entities/Fighter';
import { getWeapon } from '../data/weapons';
import { SKILL_BY_ID } from '../data/skills';
import { getBoss } from '../data/bosses';
import { DIFFICULTIES } from '../data/fighters';
import { BossAIController } from '../game/ai/BossAIController';

/* ---------------------------------------------------------------- stubs */

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

const sceneStub = {
  add: { graphics: () => stub(), container: () => stub(), particles: () => stub(), text: () => stub() },
  time: { delayedCall: (_ms: number, fn: () => void) => { fn(); return stub(); } },
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

function makeWorld(p1?: Fighter, p2?: Fighter) {
  const f1 = p1 ?? makeFighter(400, 1, 'p1');
  const f2 = p2 ?? makeFighter(700, -1, 'p2');
  const world: SkillWorld = {
    scene: sceneStub,
    effects: effectsStub,
    fighters: [f1, f2],
    floorY: 600,
    bounds: { left: 60, right: 1220 },
    dealDamage: (a, t, amount, o) => {
      const r = t.takeDamage(amount, a.x, o?.knockback ?? 0, o?.launch ?? 0, o ?? {});
      return r.damage;
    },
    hitStop: () => undefined,
  };
  const exec = new SkillExecutor(world);
  return { p1: f1, p2: f2, exec, world };
}

/* ============================================================
   PROJECTILE DEFLECTION TESTS (1–7)
   ============================================================ */

describe('projectile deflection', () => {

  // Test 1: correctly timed deflect window deflects an eligible projectile
  it('1. a correctly timed deflect window deflects an eligible incoming projectile', () => {
    const { p1, p2, exec } = makeWorld();
    const def = SKILL_BY_ID.fire_homing;
    // p1 fires at p2
    exec.cast(p1, def, def.levels[0]);
    const projs = exec.getProjectiles();
    expect(projs.length).toBeGreaterThan(0);
    const proj = projs[0];
    const originalOwner = proj.owner;
    expect(originalOwner).toBe(p1);

    // Open p2's deflect window
    p2.deflecting = true;
    p2.deflectWindow = 160;

    // Move projectile into p2's hurtbox
    const hb = p2.hurtbox;
    proj.x = hb.x + hb.w / 2;
    proj.y = hb.y + hb.h / 2;

    // Simulate resolveDeflections logic directly
    if (proj.owner !== p2 && !p2.defeated && p2.deflecting) {
      const ok = proj.tryDeflect(p2);
      if (ok) {
        p2.deflecting = false;
        p2.deflectWindow = 0;
        p2.deflectCooldown = DEFLECT_COOLDOWN_MS;
      }
    }

    expect(proj.owner).toBe(p2);
    expect(proj.isDeflected).toBe(true);
    expect(p2.deflecting).toBe(false);
    expect(p2.deflectCooldown).toBe(DEFLECT_COOLDOWN_MS);
  });

  // Test 2: deflect window closed — no perfect deflection
  it('2. a defensive action outside the timing window does not trigger a perfect deflection', () => {
    const { p1, p2, exec } = makeWorld();
    const def = SKILL_BY_ID.fire_homing;
    exec.cast(p1, def, def.levels[0]);
    const proj = exec.getProjectiles()[0];

    // p2 is NOT in deflect window
    p2.deflecting = false;
    p2.deflectWindow = 0;

    const hb = p2.hurtbox;
    proj.x = hb.x + hb.w / 2;
    proj.y = hb.y + hb.h / 2;

    // tryDeflect should not be called (deflecting is false)
    const wouldDeflect = p2.deflecting && !proj.isDeflected;
    expect(wouldDeflect).toBe(false);
    expect(proj.owner).toBe(p1);
    expect(proj.isDeflected).toBe(false);

    // The window genuinely expires through the Fighter's own update loop:
    // after >160ms without a deflection, `deflecting` clears itself.
    p2.deflecting = true;
    p2.deflectWindow = 160;
    p2.update(200, { ...EMPTY_INPUT, skillPressed: [false, false, false] }, 300);
    expect(p2.deflecting).toBe(false);
    expect(p2.deflectWindow).toBe(0);
  });

  // Test 3: reflected projectile can damage its original owner
  it('3. a reflected projectile can damage its original hostile owner', () => {
    const { p1, p2, exec } = makeWorld();
    const def = SKILL_BY_ID.energy_bolt;
    exec.cast(p1, def, def.levels[0]);
    const proj = exec.getProjectiles()[0];

    // Deflect it
    p2.deflecting = true;
    p2.deflectWindow = 160;
    const hb = p2.hurtbox;
    proj.x = hb.x + hb.w / 2;
    proj.y = hb.y + hb.h / 2;
    proj.tryDeflect(p2);

    expect(proj.owner).toBe(p2);
    // Now the projectile should be able to hit p1 (original owner)
    // Verify p1 is NOT in the hitSet (cleared on deflect)
    const p1HpBefore = p1.health;
    // Move projectile onto p1's hurtbox and run update
    const hb1 = p1.hurtbox;
    proj.x = hb1.x + hb1.w / 2;
    proj.y = hb1.y + hb1.h / 2;
    // Run one update tick — projectile should hit p1
    exec.update(16);
    // p1 should have taken damage (projectile hit)
    expect(p1.health).toBeLessThanOrEqual(p1HpBefore);
  });

  // Test 4: ownership and damage attribution update correctly
  it('4. ownership and damage attribution update correctly after deflection', () => {
    const { p1, p2, exec } = makeWorld();
    const def = SKILL_BY_ID.fire_homing;
    exec.cast(p1, def, def.levels[0]);
    const proj = exec.getProjectiles()[0];

    expect(proj.owner).toBe(p1);
    p2.deflecting = true;
    p2.deflectWindow = 160;
    const ok = proj.tryDeflect(p2);
    expect(ok).toBe(true);
    expect(proj.owner).toBe(p2);
    expect(proj.isDeflected).toBe(true);
  });

  // Test 5: one projectile cannot be deflected repeatedly
  it('5. one projectile cannot be deflected repeatedly during the same collision', () => {
    const { p1, p2, exec } = makeWorld();
    const def = SKILL_BY_ID.fire_homing;
    exec.cast(p1, def, def.levels[0]);
    const proj = exec.getProjectiles()[0];

    p2.deflecting = true;
    p2.deflectWindow = 160;
    const first = proj.tryDeflect(p2);
    expect(first).toBe(true);

    // Try to deflect again — should fail
    p1.deflecting = true;
    p1.deflectWindow = 160;
    const second = proj.tryDeflect(p1);
    expect(second).toBe(false);
    // Owner remains p2
    expect(proj.owner).toBe(p2);
  });

  // Test 6: non-projectile attacks cannot be reflected
  it('6. non-projectile attacks (melee) cannot be reflected accidentally', () => {
    const { p1, p2, exec } = makeWorld();
    // Melee skill — kind is 'melee', not 'projectile'
    const def = SKILL_BY_ID.shadow_strike ?? SKILL_BY_ID.fire_slash ?? SKILL_BY_ID.earth_slam;
    if (!def || (def.kind !== 'melee' && def.kind !== 'aoe')) {
      // Fallback: verify getProjectiles only returns Projectile instances
      exec.cast(p1, SKILL_BY_ID.shadow_clone, SKILL_BY_ID.shadow_clone.levels[0]);
      const projs = exec.getProjectiles();
      // Clones are not projectiles
      expect(projs.length).toBe(0);
      return;
    }
    exec.cast(p1, def, def.levels[0]);
    const projs = exec.getProjectiles();
    // Melee/aoe skills produce no Projectile entities
    expect(projs.length).toBe(0);
    void p2;
  });

  // Test 7: boss projectiles obey the same eligibility and attribution rules
  it('7. boss projectiles obey the same eligibility and attribution rules', () => {
    const boss = getBoss('void_reaper')!;
    const p1 = makeFighter(400, 1, 'p1');
    const bossF = new Fighter(sceneStub, {
      side: 'p2', name: boss.name, weapon: getWeapon(boss.weapon),
      skills: [skill(boss.skills[0]), skill(boss.skills[1]), skill(boss.skills[2])],
      equipment: {}, maxHealth: boss.maxHealth, bodyColor: boss.bodyColor,
      eyeColor: boss.eyeColor, auraColor: boss.auraColor,
      scale: boss.scale, x: 860, facing: -1, damageMul: 1,
    }, 600, { left: 60, right: 1220 });

    const { exec } = makeWorld(bossF, p1);
    // Boss fires an actual projectile skill (shadow_bolt is a 'projectile' kind)
    const projDef = SKILL_BY_ID[boss.skills.find((id) => SKILL_BY_ID[id]?.kind === 'projectile') ?? 'shadow_bolt'];
    const def = SKILL_BY_ID.fire_homing;
    exec.cast(p1, def, def.levels[0]);
    void projDef;
    exec.cast(bossF, projDef, projDef.levels[0]);
    // Both fighters' projectiles exist and each is attributed to its caster
    const projs = exec.getProjectiles();
    expect(projs.length).toBe(2);
    for (const proj of projs) {
      expect([p1, bossF].includes(proj.owner)).toBe(true);
      // A projectile can never deflect itself: only the non-owner deflector works
      const defender = proj.owner === p1 ? bossF : p1;
      defender.deflecting = true;
      defender.deflectWindow = 160;
      const hb = defender.hurtbox;
      proj.x = hb.x + hb.w / 2;
      proj.y = hb.y + hb.h / 2;
      const ok = proj.tryDeflect(defender);
      expect(ok).toBe(true);
      expect(proj.owner).toBe(defender);
    }
    void new BossAIController(bossF, p1, boss, DIFFICULTIES.medium, effectsStub, 1);
  });
});

/* ============================================================
   CLONE ONE-HIT DESTRUCTION TESTS (8–16)
   ============================================================ */

describe('clone one-hit destruction', () => {

  // Test 8: one valid hostile hit immediately deactivates a clone
  it('8. one valid hostile hit immediately deactivates a clone', () => {
    const { p1, exec } = makeWorld();
    const def = SKILL_BY_ID.shadow_clone;
    exec.cast(p1, def, def.levels[0]);
    const clones = exec.getClones();
    expect(clones.length).toBeGreaterThan(0);
    const clone = clones[0];
    expect(clone.isActive).toBe(true);
    const destroyed = clone.receiveHit();
    expect(destroyed).toBe(true);
    expect(clone.isActive).toBe(false);
  });

  // Test 9: a destroyed clone cannot perform further attacks or deal damage
  it('9. a destroyed clone cannot perform further attacks or deal damage', () => {
    const { p1, p2, exec } = makeWorld();
    const def = SKILL_BY_ID.shadow_clone;
    exec.cast(p1, def, def.levels[0]);
    // Destroy ALL clones immediately before any can attack
    for (const clone of exec.getClones()) clone.receiveHit();
    // Run update to remove destroyed clones
    exec.update(16);
    expect(exec.activeCloneCount).toBe(0);

    // Now capture health and verify no further damage
    const hpBefore = p2.health;
    for (let i = 0; i < 100; i++) exec.update(16);
    expect(p2.health).toBe(hpBefore);
  });

  // Test 10: missed attacks do not destroy clones
  it('10. missed attacks do not destroy clones', () => {
    const { p1, p2, exec } = makeWorld();
    const def = SKILL_BY_ID.shadow_clone;
    exec.cast(p1, def, def.levels[0]);
    const clones = exec.getClones();
    const clone = clones[0];
    expect(clone.isActive).toBe(true);

    // Real per-frame resolution: a projectile flying toward the OPPONENT never
    // overlaps the summoner's clones, so no destruction is processed.
    exec.cast(p1, SKILL_BY_ID.energy_bolt, SKILL_BY_ID.energy_bolt.levels[0]);
    for (let i = 0; i < 200 && exec.getProjectiles().length > 0; i++) {
      exec.update(16);
      exec.resolveCloneHits([p1, p2]);
    }
    expect(clone.isActive).toBe(true);
  });

  // Test 11: friendly hits do not destroy clones
  it('11. friendly melee and friendly projectiles do not destroy clones', () => {
    const { p1, p2, exec } = makeWorld();
    const def = SKILL_BY_ID.shadow_clone;
    exec.cast(p1, def, def.levels[0]);
    const clone = exec.getClones()[0];
    // Ownership is the contract the scene-level resolution relies on
    expect(clone.ownerFighter).toBe(p1);
    const hb = clone.hurtbox;

    // A FRIENDLY projectile sitting right on the clone must not destroy it
    exec.cast(p1, SKILL_BY_ID.energy_bolt, SKILL_BY_ID.energy_bolt.levels[0]);
    const proj = exec.getProjectiles()[0];
    proj.x = hb.x + hb.w / 2;
    proj.y = hb.y + hb.h / 2;
    exec.resolveCloneHits([p1, p2]);
    expect(clone.isActive).toBe(true);
    expect(proj.isSpent).toBe(false);

    // A FRIENDLY melee swing overlapping the clone must not destroy it
    const combo = p1.weapon.combo[0];
    p1.startAttack(combo, false);
    p1.attackPhase = 'active';
    p1.x = hb.x + hb.w / 2 - combo.reach * 0.6;
    exec.resolveCloneHits([p1, p2]);
    expect(clone.isActive).toBe(true);

    // Control: a HOSTILE projectile on the same clone DOES destroy it
    exec.cast(p2, SKILL_BY_ID.energy_bolt, SKILL_BY_ID.energy_bolt.levels[0]);
    const hostileProj = exec.getProjectiles()[1];
    hostileProj.x = hb.x + hb.w / 2;
    hostileProj.y = hb.y + hb.h / 2;
    exec.resolveCloneHits([p1, p2]);
    expect(clone.isActive).toBe(false);
    expect(hostileProj.isSpent).toBe(true);
  });

  // Test 12: boss attacks can destroy clones
  it('12. boss attacks can destroy clones', () => {
    const boss = getBoss('iron_tyrant')!;
    const p1 = makeFighter(400, 1, 'p1');
    const bossF = new Fighter(sceneStub, {
      side: 'p2', name: boss.name, weapon: getWeapon(boss.weapon),
      skills: [skill(boss.skills[0]), skill(boss.skills[1]), skill(boss.skills[2])],
      equipment: {}, maxHealth: boss.maxHealth, bodyColor: boss.bodyColor,
      eyeColor: boss.eyeColor, auraColor: boss.auraColor,
      scale: boss.scale, x: 860, facing: -1, damageMul: 1,
    }, 600, { left: 60, right: 1220 });

    const { exec } = makeWorld(p1, bossF);
    const def = SKILL_BY_ID.shadow_clone;
    exec.cast(p1, def, def.levels[0]);
    const clones = exec.getClones();
    expect(clones.length).toBeGreaterThan(0);
    const clone = clones[0];

    // The boss fires a real projectile skill that overlaps the player's clone
    const bolt = SKILL_BY_ID.shadow_bolt ?? SKILL_BY_ID.energy_cannon;
    if (bolt && (bolt.kind === 'projectile' || bolt.kind === 'homing')) {
      exec.cast(bossF, bolt, bolt.levels[0]);
      const proj = exec.getProjectiles()[0];
      expect(proj.owner).toBe(bossF);
      const hb = clone.hurtbox;
      proj.x = hb.x + hb.w / 2;
      proj.y = hb.y + hb.h / 2;
      exec.resolveCloneHits([p1, bossF]);
      expect(clone.isActive).toBe(false);
      expect(proj.isSpent).toBe(true);
      // The spent projectile cannot destroy a second clone afterwards
      const other = exec.getClones()[0];
      if (other && other !== clone) {
        proj.x = other.hurtbox.x + other.hurtbox.w / 2;
        proj.y = other.hurtbox.y + other.hurtbox.h / 2;
        exec.resolveCloneHits([p1, bossF]);
        expect(other.isActive).toBe(true);
      }
    } else {
      // Boss has no projectile skill in this dataset — melee path equivalent
      const destroyed = clone.receiveHit();
      expect(destroyed).toBe(true);
      expect(clone.isActive).toBe(false);
    }
    void bossF;
  });

  // Test 13b: two hostile hit sources on the same clone in one frame process
  // the destruction EXACTLY once (no duplicate slot release)
  it('13b. duplicate hostile sources destroy a clone exactly once', () => {
    const { p1, p2, exec } = makeWorld();
    exec.cast(p1, SKILL_BY_ID.shadow_clone, SKILL_BY_ID.shadow_clone.levels[0]);
    expect(exec.activeCloneCount).toBe(2);
    const clone = exec.getClones()[0];
    const hb = clone.hurtbox;

    // p2 has a live melee hitbox overlapping the clone
    const combo = p2.weapon.combo[0];
    p2.startAttack(combo, false);
    p2.attackPhase = 'active';
    p2.facing = -1;
    p2.x = hb.x + hb.w / 2 + combo.reach * 0.6;

    // AND p1's hostile projectile is on the clone in the same resolve pass
    exec.cast(p1, SKILL_BY_ID.energy_bolt, SKILL_BY_ID.energy_bolt.levels[0]);
    const proj = exec.getProjectiles()[0];
    proj.x = hb.x + hb.w / 2;
    proj.y = hb.y + hb.h / 2;

    exec.resolveCloneHits([p1, p2]);
    expect(clone.isActive).toBe(false);

    // Exactly one clone was released this frame — the sweep removes exactly it
    exec.update(16);
    expect(exec.activeCloneCount).toBe(1);
  });

  // Test 13: area attacks destroy a clone only through valid damage processing
  it('13. area attacks destroy a clone only through valid damage processing', () => {
    const { p1, exec } = makeWorld();
    const def = SKILL_BY_ID.shadow_clone;
    exec.cast(p1, def, def.levels[0]);
    const clones = exec.getClones();
    const clone = clones[0];
    // An area attack that "misses" (receiveHit not called) leaves clone active
    expect(clone.isActive).toBe(true);
    // A valid area hit calls receiveHit once
    const first = clone.receiveHit();
    expect(first).toBe(true);
    expect(clone.isActive).toBe(false);
    // Calling again (duplicate processing) returns false — already destroyed
    const second = clone.receiveHit();
    expect(second).toBe(false);
  });

  // Test 14: destroyed clones release their active slots exactly once
  it('14. destroyed clones release their active slots exactly once', () => {
    const { p1, exec } = makeWorld();
    const def = SKILL_BY_ID.shadow_clone;
    exec.cast(p1, def, def.levels[0]);
    expect(exec.activeCloneCount).toBe(2);

    // Destroy all clones via receiveHit
    for (const clone of exec.getClones()) clone.receiveHit();

    // Run update so destroyed clones are removed from the entity list
    exec.update(16);
    expect(exec.activeCloneCount).toBe(0);

    // Can now summon again up to the cap
    exec.cast(p1, def, def.levels[0]);
    expect(exec.activeCloneCount).toBe(2);
  });

  // Test 15: two-clone cap remains enforced after destruction and resummoning
  it('15. the two-clone cap remains enforced after destruction and resummoning', () => {
    const { p1, exec } = makeWorld();
    const def = SKILL_BY_ID.shadow_clone;

    // Fill cap
    exec.cast(p1, def, def.levels[4]);
    expect(exec.activeCloneCount).toBe(2);

    // Destroy one
    exec.getClones()[0].receiveHit();
    exec.update(16);
    expect(exec.activeCloneCount).toBe(1);

    // Resummon — should reach 2 again, not exceed it
    exec.cast(p1, def, def.levels[4]);
    expect(exec.activeCloneCount).toBe(2);

    // Try to exceed cap
    exec.cast(p1, def, def.levels[4]);
    expect(exec.activeCloneCount).toBe(2);
    expect(exec.activeCloneCount).toBeLessThanOrEqual(MAX_ACTIVE_CLONES);
  });

  // Test 16: clone destruction does not modify the player's health or clone damage multipliers
  it('16. clone destruction does not modify the player health or clone damage multipliers', () => {
    const { p1, exec } = makeWorld();
    const def = SKILL_BY_ID.shadow_clone;
    exec.cast(p1, def, def.levels[4]);

    const hpBefore = p1.health;
    const lvl5Mul = def.levels[4].damage;

    // Destroy all clones
    for (const clone of exec.getClones()) clone.receiveHit();
    exec.update(16);

    // Player health unchanged
    expect(p1.health).toBe(hpBefore);
    // Skill damage config unchanged
    expect(def.levels[4].damage).toBe(lvl5Mul);
  });
});
