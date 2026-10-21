import { describe, expect, it } from 'vitest';
import {
  canEnemySeePlayer,
  createEnemyFromSpec,
  intersectSegmentWithEnemy,
  notifyAcousticEvent,
  updateEnemiesAI,
} from '../ai/enemyAI';
import {
  calculateBallisticOffset,
  calculateImpactDamage,
  computeWeaponStats,
} from '../combat/ballistics';
import {
  CAMPAIGN_MISSIONS,
  CONTRACT_OPERATIONS,
  createModeMission,
  getDailyContracts,
} from '../data/missions';
import { getWeaponById, WEAPONS } from '../data/weapons';
import {
  createDefaultSaveData,
  evaluateMissionOutcome,
  validateAndMigrateSave,
} from '../save/storage';
import { BiomeId } from '../types/game';
import { buildWorldForBiome } from '../world/WorldBuilder';

describe('SNIPER: DEADLINE — Core Gameplay & Systems Suite', () => {
  it('defines all 15 distinct sniper rifles across 4 progression tiers', () => {
    expect(WEAPONS.length).toBe(15);
    const ids = new Set(WEAPONS.map((w) => w.id));
    expect(ids.size).toBe(15);

    const tiers = new Set(WEAPONS.map((w) => w.tier));
    expect(tiers.has('Entry')).toBe(true);
    expect(tiers.has('Intermediate')).toBe(true);
    expect(tiers.has('Advanced')).toBe(true);
    expect(tiers.has('Elite')).toBe(true);
  });

  it('computes meaningful stat differences from attachments and ammunition types', () => {
    const ranger = getWeaponById('ranger_m70');
    const baseStats = computeWeaponStats(ranger, undefined, 'standard');

    const upgradedStats = computeWeaponStats(
      ranger,
      {
        optic: 'optic_variable',
        muzzle: 'muzzle_suppressor',
        barrel: 'barrel_heavy_long',
        magazine: 'mag_extended',
      },
      'ap'
    );

    expect(upgradedStats.isSuppressed).toBe(true);
    expect(upgradedStats.soundRadius).toBeLessThan(baseStats.soundRadius);
    expect(upgradedStats.magSize).toBe(baseStats.magSize + 3);
    expect(upgradedStats.armorPenetration).toBeGreaterThan(baseStats.armorPenetration);
    expect(upgradedStats.zoomLevels).toEqual([4, 12, 20]);
  });

  it('calculates consistent projectile gravitational drop and crosswind drift', () => {
    const near = calculateBallisticOffset(60, 800, 5.0, 'standard');
    const far = calculateBallisticOffset(220, 800, 5.0, 'standard');
    const hiVelFar = calculateBallisticOffset(220, 800, 5.0, 'high_velocity');

    expect(far.dropMeters).toBeGreaterThan(near.dropMeters * 4);
    expect(far.windDriftMeters).toBeGreaterThan(near.windDriftMeters * 4);
    expect(hiVelFar.dropMeters).toBeLessThan(far.dropMeters);
  });

  it('applies head, torso, limb, and armor penetration damage rules accurately', () => {
    const headHit = calculateImpactDamage({
      baseDamage: 100,
      distanceMeters: 150,
      effectiveRange: 250,
      armorPenetration: 0.3,
      hitRegion: 'head',
      enemyClass: 'guard',
    });
    const torsoHit = calculateImpactDamage({
      baseDamage: 100,
      distanceMeters: 150,
      effectiveRange: 250,
      armorPenetration: 0.3,
      hitRegion: 'torso',
      enemyClass: 'guard',
    });
    const limbHit = calculateImpactDamage({
      baseDamage: 100,
      distanceMeters: 150,
      effectiveRange: 250,
      armorPenetration: 0.3,
      hitRegion: 'limbs',
      enemyClass: 'guard',
    });

    expect(headHit.isHeadshot).toBe(true);
    expect(headHit.finalDamage).toBeGreaterThan(torsoHit.finalDamage * 2);
    expect(torsoHit.finalDamage).toBeGreaterThan(limbHit.finalDamage);

    // AP vs Armored Commander
    const lowPen = calculateImpactDamage({
      baseDamage: 100,
      distanceMeters: 150,
      effectiveRange: 250,
      armorPenetration: 0.2,
      hitRegion: 'torso',
      enemyClass: 'commander',
    });
    const highPen = calculateImpactDamage({
      baseDamage: 100,
      distanceMeters: 150,
      effectiveRange: 250,
      armorPenetration: 0.95,
      hitRegion: 'torso',
      enemyClass: 'commander',
    });
    expect(highPen.finalDamage).toBeGreaterThan(lowPen.finalDamage);
  });

  it('builds all 6 distinct 3D biomes and enforces solid wall & smoke occlusion on AI vision', () => {
    const biomes: BiomeId[] = [
      'training_range',
      'forest_outpost',
      'desert_base',
      'industrial_harbor',
      'mountain_frontier',
      'urban_district',
    ];
    for (const b of biomes) {
      const w = buildWorldForBiome(b, 1);
      expect(w.boxes.length).toBeGreaterThan(8);
    }

    const harborWorld = buildWorldForBiome('industrial_harbor', 1);
    // Place enemy facing +Z directly behind warehouse_alpha (centered at x = -22, z = -55, width 14, height 6.2)
    const guardBehindWall = createEnemyFromSpec(
      {
        id: 'test_guard',
        enemyClass: 'guard',
        position: [-22, 0, -70],
      },
      harborWorld
    );
    guardBehindWall.rotY = 0; // facing +Z toward player at (-22, 0, 10)

    const seesThroughWarehouse = canEnemySeePlayer(
      guardBehindWall,
      [-22, 0, 10],
      false,
      harborWorld,
      []
    );
    expect(seesThroughWarehouse).toBe(false);

    // Place guard in open clear lane at (0, 0, -25) facing +Z toward player at (0, 0, -5)
    const openGuard = createEnemyFromSpec(
      {
        id: 'open_guard',
        enemyClass: 'guard',
        position: [0, 0, -25],
      },
      harborWorld
    );
    openGuard.rotY = 0;
    expect(canEnemySeePlayer(openGuard, [0, 0, -5], false, harborWorld, [])).toBe(true);

    // Deploy smoke cloud directly between openGuard and player -> blocks sight!
    expect(
      canEnemySeePlayer(openGuard, [0, 0, -5], false, harborWorld, [
        { x: 0, y: 1, z: -15, radius: 6, remaining: 10 },
      ])
    ).toBe(false);
  });

  it('transitions AI states upon acoustic events, head hitboxes, and direct combat sight', () => {
    const world = buildWorldForBiome('training_range', 1);
    const guard = createEnemyFromSpec(
      {
        id: 'ai_1',
        enemyClass: 'scout',
        position: [0, 0, -20],
      },
      world
    );
    guard.rotY = 0;

    // Test headshot segment intersection at y = guard.y + 1.65
    const hit = intersectSegmentWithEnemy(
      0,
      guard.y + 1.65,
      -18,
      0,
      guard.y + 1.65,
      -22,
      guard
    );
    expect(hit?.hitRegion).toBe('head');

    // Acoustic gunshot alert transitions patrol -> investigating
    notifyAcousticEvent([guard], [4, 0, 10], 80, false);
    expect(guard.state).toBe('investigating');

    // Full line of sight fills suspicion to engaging and triggers alarm
    let alarms = 0;
    updateEnemiesAI([guard], 1.5, [0, 0, 0], false, world, [], [], {
      onAlarmRaised: () => {
        alarms += 1;
      },
      onEnemyFire: () => {},
      onSpawnReinforcements: () => {},
    });
    expect(guard.state).toBe('engaging');
    expect(alarms).toBe(1);
  });

  it('validates all 12 campaign missions, 10 contracts, daily rotation, grading, and save migration', () => {
    expect(CAMPAIGN_MISSIONS.length).toBe(12);
    expect(CONTRACT_OPERATIONS.length).toBe(10);

    const dailies = getDailyContracts('2026-10-20');
    expect(dailies.length).toBe(3);
    expect(createModeMission('free_sniper', 'desert_base').biome).toBe('desert_base');

    // Corrupted partial save migration safely falls back while keeping valid fields
    const migrated = validateAndMigrateSave({
      xp: 1900,
      credits: 4500,
      unlockedWeapons: ['phantom_sr'],
      settings: { invertY: true },
    });
    expect(migrated.rank).toBeGreaterThanOrEqual(3);
    expect(migrated.unlockedWeapons).toContain('ranger_m70');
    expect(migrated.unlockedWeapons).toContain('phantom_sr');
    expect(migrated.settings.invertY).toBe(true);

    // First-time victory vs replay anti-exploit stipend check
    const initial = createDefaultSaveData();
    const firstRun = evaluateMissionOutcome({
      save: initial,
      mission: CAMPAIGN_MISSIONS[0],
      victory: true,
      shotsFired: 7,
      shotsHit: 7,
      kills: 7,
      headshots: 5,
      longestShot: 200,
      timeSeconds: 45,
      alarmsTriggered: 0,
      optionalCompletedCount: 1,
      weaponName: 'Ranger M70',
    });
    expect(firstRun.summary.grade).toBe('S');
    expect(firstRun.summary.firstTimeBonus).toBe(true);

    const secondRun = evaluateMissionOutcome({
      save: firstRun.updatedSave,
      mission: CAMPAIGN_MISSIONS[0],
      victory: true,
      shotsFired: 7,
      shotsHit: 7,
      kills: 7,
      headshots: 5,
      longestShot: 200,
      timeSeconds: 45,
      alarmsTriggered: 0,
      optionalCompletedCount: 1,
      weaponName: 'Ranger M70',
    });
    expect(secondRun.summary.firstTimeBonus).toBe(false);
    expect(secondRun.summary.creditsEarned).toBeLessThan(firstRun.summary.creditsEarned);
  });
});
