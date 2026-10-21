import { describe, it, expect, beforeEach } from 'vitest';
import { Fighter, EMPTY_INPUT, type FighterInput, type EquippedSkill } from '../game/entities/Fighter';
import { getWeapon } from '../data/weapons';
import { SKILL_BY_ID } from '../data/skills';

/** Minimal stub standing in for Phaser display objects. */
function stubGfx(): unknown {
  const obj: Record<string, unknown> = {};
  return new Proxy(obj, {
    get(target, prop) {
      if (prop === 'scaleX' || prop === 'x' || prop === 'y') return (target[prop as string] as number) ?? 0;
      return (...args: unknown[]) => { void args; return new Proxy(target, this as ProxyHandler<object>); };
    },
    set(target, prop, value) { target[prop as string] = value; return true; },
  });
}

const mockScene = {
  add: {
    graphics: () => stubGfx(),
    container: () => stubGfx(),
  },
} as unknown as Phaser.Scene;

function skill(id: string): EquippedSkill {
  const def = SKILL_BY_ID[id];
  return { def, level: 1, cfg: def.levels[0], cooldown: 0 };
}

function makeFighter(weaponId = 'shadow_katana', x = 400): Fighter {
  return new Fighter(mockScene, {
    side: 'p1', name: 'TEST', weapon: getWeapon(weaponId),
    skills: [skill('fire_homing'), skill('laser_beam'), skill('shadow_clone')],
    equipment: {}, maxHealth: 100, bodyColor: 0, eyeColor: 0, auraColor: 0,
    scale: 1, x, facing: 1,
  }, 600, { left: 60, right: 1220 });
}

const input = (patch: Partial<FighterInput> = {}): FighterInput => ({
  ...EMPTY_INPUT, skillPressed: [false, false, false], ...patch,
});

function step(f: Fighter, i: FighterInput, ms: number, opponentX = 900, dt = 16) {
  let elapsed = 0;
  while (elapsed < ms) {
    f.update(dt, i, opponentX);
    // edge flags only fire once
    i = { ...i, attackPressed: false, attackReleased: false, jumpPressed: false, dodgePressed: false, skillPressed: [false, false, false] };
    elapsed += dt;
  }
}

describe('movement controller', () => {
  let f: Fighter;
  beforeEach(() => { f = makeFighter(); });

  it('moves right and left deterministically', () => {
    const x0 = f.x;
    step(f, input({ right: true }), 300);
    expect(f.x).toBeGreaterThan(x0 + 20);
    const x1 = f.x;
    step(f, input({ left: true }), 300);
    expect(f.x).toBeLessThan(x1);
  });

  it('stops when input is released (no drift)', () => {
    step(f, input({ right: true }), 250);
    step(f, input(), 400);
    const resting = f.x;
    step(f, input(), 400);
    expect(Math.abs(f.x - resting)).toBeLessThan(0.5);
    expect(f.vx).toBe(0);
  });

  it('jumps and lands back on the floor', () => {
    step(f, input({ jumpPressed: true, up: true }), 60);
    expect(f.onGround).toBe(false);
    expect(f.y).toBeLessThan(600);
    step(f, input(), 1600);
    expect(f.onGround).toBe(true);
    expect(f.y).toBe(600);
  });

  it('crouches while holding down', () => {
    step(f, input({ down: true }), 120);
    expect(f.state).toBe('crouch');
  });

  it('clamps to arena boundaries', () => {
    step(f, input({ left: true }), 6000);
    expect(f.x).toBeGreaterThanOrEqual(60);
    step(f, input({ right: true }), 9000);
    expect(f.x).toBeLessThanOrEqual(1220);
  });

  it('grants invulnerability frames during a dodge', () => {
    step(f, input({ dodgePressed: true }), 20);
    expect(f.state).toBe('dash');
    expect(f.invuln).toBeGreaterThan(0);
    const before = f.health;
    f.takeDamage(30, 900, 100, 0);
    expect(f.health).toBe(before);
    step(f, input(), 900);
    expect(f.invuln).toBe(0);
  });
});

describe('melee combat', () => {
  let f: Fighter;
  beforeEach(() => { f = makeFighter(); });

  it('chains a three-hit combo in order then resets', () => {
    const seen: string[] = [];
    const tap = () => {
      step(f, input({ attackPressed: true, attackHeld: true }), 32);
      step(f, input({ attackReleased: true }), 16);
      seen.push(f.attack?.id ?? 'none');
      const a = f.attack!;
      step(f, input(), a.startup + a.active + a.recovery + 40);
    };
    tap(); tap(); tap();
    expect(seen).toEqual(['shadow_katana_a1', 'shadow_katana_a2', 'shadow_katana_a3']);
    // combo window expires -> back to hit 1
    step(f, input(), 700);
    tap();
    expect(seen[3]).toBe('shadow_katana_a1');
  });

  it('produces a charged heavy attack when the button is held past the threshold', () => {
    const w = getWeapon('shadow_katana');
    step(f, input({ attackPressed: true, attackHeld: true }), 32);
    step(f, input({ attackHeld: true }), w.chargeTime + 200);
    expect(f.charging).toBe(true);
    step(f, input({ attackReleased: true }), 16);
    expect(f.attack?.heavy).toBe(true);
    expect(f.attackCharged).toBe(true);
    expect(f.attackPower).toBeGreaterThan(1);
  });

  it('keeps hitboxes inactive outside the active frames', () => {
    const w = getWeapon('shadow_katana');
    step(f, input({ attackPressed: true, attackHeld: true }), 16);
    step(f, input({ attackReleased: true }), 16);
    const a = f.attack!;
    expect(f.attackPhase).toBe('startup');
    expect(f.getActiveHitbox()).toBeNull();
    step(f, input(), a.startup + 10);
    expect(f.attackPhase).toBe('active');
    expect(f.getActiveHitbox()).not.toBeNull();
    step(f, input(), a.active + 20);
    expect(f.attackPhase).toBe('recovery');
    expect(f.getActiveHitbox()).toBeNull();
    step(f, input(), a.recovery + 40);
    expect(f.attack).toBeNull();
    void w;
  });

  it('blocks damage from the front and breaks the guard under pressure', () => {
    const d = makeFighter('shadow_katana', 500);
    step(d, input({ block: true }), 64);
    expect(d.state).toBe('block');
    const r = d.takeDamage(20, 900, 100, 0, { guardDamage: 20 });
    expect(r.blocked).toBe(true);
    expect(r.damage).toBeLessThan(20 * 0.3);
    let broke = false;
    for (let i = 0; i < 12 && !broke; i++) {
      step(d, input({ block: true }), 32);
      broke = d.takeDamage(20, 900, 100, 0, { guardDamage: 20 }).broke;
    }
    expect(broke).toBe(true);
    expect(d.guardBreakTime).toBeGreaterThan(0);
  });

  it('does not block attacks that land from behind', () => {
    const d = makeFighter('shadow_katana', 500);
    step(d, input({ block: true }), 64, 900); // facing right
    const r = d.takeDamage(20, 100, 100, 0);
    expect(r.blocked).toBe(false);
    expect(r.damage).toBe(20);
  });

  it('prevents all damage after defeat', () => {
    f.takeDamage(500, 900, 0, 0);
    expect(f.defeated).toBe(true);
    expect(f.health).toBe(0);
    const r = f.takeDamage(40, 900, 0, 0);
    expect(r.damage).toBe(0);
    expect(f.health).toBe(0);
  });

  it('tracks combo counts and resets them after the decay window', () => {
    f.registerCombo(); f.registerCombo(); f.registerCombo();
    expect(f.comboCount).toBe(3);
    expect(f.highestCombo).toBe(3);
    step(f, input(), 1700);
    expect(f.comboCount).toBe(0);
    expect(f.highestCombo).toBe(3);
  });

  it('fully resets state between rounds', () => {
    f.takeDamage(40, 900, 120, 0);
    f.skills[0].cooldown = 5000;
    f.resetForRound(420, 1);
    expect(f.health).toBe(f.maxHealth);
    expect(f.guard).toBe(f.maxGuard);
    expect(f.state).toBe('idle');
    expect(f.skills[0].cooldown).toBe(0);
    expect(f.defeated).toBe(false);
  });
});

describe('weapons change real combat behaviour', () => {
  it('gives different weapons different frame data and reach in play', () => {
    const fast = makeFighter('phantom_daggers');
    const slow = makeFighter('quake_hammer');
    expect(fast.weapon.combo[0].startup).toBeLessThan(slow.weapon.combo[0].startup);
    expect(fast.moveSpeed).toBeGreaterThan(slow.moveSpeed);

    const hitbox = (f: Fighter) => {
      step(f, input({ attackPressed: true, attackHeld: true }), 16);
      step(f, input({ attackReleased: true }), 16);
      step(f, input(), f.attack!.startup + 10);
      return f.getActiveHitbox()!;
    };
    const hFast = hitbox(fast);
    const hSlow = hitbox(slow);
    expect(hSlow.w).toBeGreaterThan(hFast.w);
  });

  it('supports every weapon through a full attack cycle', () => {
    for (const id of ['iron_fists', 'void_scythe', 'storm_spear', 'spirit_chain', 'arcane_blade', 'twin_hatchets']) {
      const f = makeFighter(id);
      step(f, input({ attackPressed: true, attackHeld: true }), 16);
      step(f, input({ attackReleased: true }), 16);
      const a = f.attack!;
      expect(a).toBeTruthy();
      step(f, input(), a.startup + Math.max(1, a.active / 2));
      expect(f.getActiveHitbox()).not.toBeNull();
      step(f, input(), a.active + a.recovery + 60);
      expect(f.attack).toBeNull();
      expect(f.state).toBe('idle');
    }
  });
});

describe('skills', () => {
  it('starts casts and enforces cooldowns', () => {
    const f = makeFighter();
    step(f, input({ skillPressed: [true, false, false] }), 16);
    expect(f.state).toBe('cast');
    expect(f.skills[0].cooldown).toBeGreaterThan(0);
    step(f, input(), 400);
    const castEvent = f.events.find((e) => e.type === 'cast');
    expect(castEvent).toBeTruthy();
    f.events.length = 0;
    // second activation while on cooldown is refused
    step(f, input({ skillPressed: [true, false, false] }), 16);
    expect(f.state).not.toBe('cast');
  });

  it('ticks cooldowns down over time and allows reuse', () => {
    const f = makeFighter();
    f.skills[1].cooldown = 500;
    step(f, input(), 600);
    expect(f.skills[1].cooldown).toBe(0);
    step(f, input({ skillPressed: [false, true, false] }), 16);
    expect(f.state).toBe('cast');
  });

  it('applies statuses and shields through takeDamage', () => {
    const f = makeFighter();
    f.status.shield = 30;
    const r = f.takeDamage(20, 900, 0, 0);
    expect(r.damage).toBe(0);
    expect(f.status.shield).toBe(10);
    expect(f.health).toBe(f.maxHealth);
  });
});
