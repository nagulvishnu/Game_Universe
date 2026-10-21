import { AMMO_TYPES, DEFAULT_LOADOUT_CONFIG, getAttachmentById } from '../data/customization';
import {
  AmmoType,
  AttachmentSlot,
  ComputedWeaponStats,
  EnemyClass,
  HitRegion,
  WeaponDefinition,
  WeaponLoadoutConfig,
} from '../types/game';

// Tactical game-scale constants tuned for 40m - 340m sightlines (Sniper Elite style tactile ballistics)
export const GRAVITY_ACCEL = 9.81;
export const BALLISTIC_SPEED_SCALE = 0.35; // Maps 800 m/s -> 280 world-m/s so 140m flight = 0.50s
export const WIND_DRIFT_FACTOR = 0.16;

export interface BallisticStepPoint {
  x: number;
  y: number;
  z: number;
  t: number;
}

export interface ProjectileState {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  prevX: number;
  prevY: number;
  prevZ: number;
  originX: number;
  originY: number;
  originZ: number;
  windX: number;
  dropMultiplier: number;
  damage: number;
  effectiveRange: number;
  armorPenetration: number;
  fromPlayer: boolean;
  isKillcamCandidate: boolean;
  age: number;
}

export function computeWeaponStats(
  weapon: WeaponDefinition,
  loadout: Partial<WeaponLoadoutConfig> | undefined,
  ammoType: AmmoType = 'standard'
): ComputedWeaponStats {
  const merged: WeaponLoadoutConfig = {
    ...DEFAULT_LOADOUT_CONFIG,
    ...(loadout ?? {}),
  };
  const ammo = AMMO_TYPES[ammoType] ?? AMMO_TYPES.standard;

  let damage = weapon.damage;
  let effectiveRange = weapon.effectiveRange;
  let accuracy = weapon.accuracy;
  let muzzleVelocity = weapon.muzzleVelocity;
  let recoil = weapon.recoil;
  let magSize = weapon.magSize;
  let reloadTime = weapon.reloadTime;
  let adsSpeed = weapon.adsSpeed;
  let swayFactor = Math.max(0.2, (105 - weapon.accuracy) / 35);
  let isSuppressed = weapon.defaultSuppressed;

  const slots: AttachmentSlot[] = [
    'optic',
    'muzzle',
    'barrel',
    'underbarrel',
    'stock',
    'magazine',
    'skin',
    'reticle',
    'charm',
  ];

  for (const slot of slots) {
    const attId = merged[slot];
    const att = getAttachmentById(attId);
    const mod = att.statModifiers;
    if (mod.damage) damage += mod.damage;
    if (mod.effectiveRange) effectiveRange += mod.effectiveRange;
    if (mod.accuracy) accuracy += mod.accuracy;
    if (mod.muzzleVelocity) muzzleVelocity += mod.muzzleVelocity;
    if (mod.recoil) recoil += mod.recoil;
    if (mod.magSizeBonus) magSize += mod.magSizeBonus;
    if (mod.reloadTimeMultiplier) reloadTime *= mod.reloadTimeMultiplier;
    if (mod.adsSpeedMultiplier) adsSpeed *= mod.adsSpeedMultiplier;
    if (mod.swayMultiplier) swayFactor *= mod.swayMultiplier;
    if (att.suppressed) isSuppressed = true;
  }

  // Apply ammunition multipliers
  damage = Math.round(damage * ammo.damageMultiplier);
  muzzleVelocity = Math.round(muzzleVelocity * ammo.velocityMultiplier);
  effectiveRange = Math.round(effectiveRange * (0.65 + 0.35 * ammo.velocityMultiplier));

  accuracy = Math.min(99.5, Math.max(40, accuracy));
  recoil = Math.min(95, Math.max(8, recoil));
  magSize = Math.max(1, magSize);
  reloadTime = Number(Math.max(1.0, reloadTime).toFixed(2));
  adsSpeed = Number(Math.max(0.11, adsSpeed).toFixed(2));

  const baseArmorPen =
    weapon.visual.family === 'anti_materiel' || weapon.visual.family === 'rail_prototype'
      ? 0.85
      : weapon.damage >= 115
      ? 0.55
      : 0.3;

  const armorPenetration = Math.min(1, baseArmorPen + ammo.armorPenBonus);

  const baseSound = isSuppressed ? 24 : 96;
  const soundRadius = Math.round(baseSound * ammo.soundMultiplier);

  const opticAtt = getAttachmentById(merged.optic);
  const reticleAtt = getAttachmentById(merged.reticle);

  return {
    damage,
    effectiveRange,
    accuracy,
    muzzleVelocity,
    recoil,
    fireRateRpm: weapon.fireRateRpm,
    magSize,
    reloadTime,
    adsSpeed,
    swayFactor: Number(swayFactor.toFixed(3)),
    isSuppressed,
    armorPenetration: Number(armorPenetration.toFixed(2)),
    soundRadius,
    opticType: opticAtt.opticType ?? 'standard',
    zoomLevels: opticAtt.zoomLevels ?? [4, 8],
    reticleStyle: reticleAtt.reticleStyle ?? 'mil_dot',
  };
}

/**
 * Computes projectile drop (meters downward) and lateral wind drift (meters along world X/crosswind)
 * at a given target distance in meters.
 */
export function calculateBallisticOffset(
  distanceMeters: number,
  muzzleVelocity: number,
  windSpeedMps: number,
  ammoType: AmmoType = 'standard'
): { flightTime: number; dropMeters: number; windDriftMeters: number } {
  const ammo = AMMO_TYPES[ammoType] ?? AMMO_TYPES.standard;
  const scaledSpeed = Math.max(80, muzzleVelocity * BALLISTIC_SPEED_SCALE);
  const flightTime = distanceMeters / scaledSpeed;
  const dropMeters = 0.5 * GRAVITY_ACCEL * flightTime * flightTime * ammo.dropMultiplier;
  const windDriftMeters = windSpeedMps * flightTime * flightTime * WIND_DRIFT_FACTOR * 10;

  return {
    flightTime,
    dropMeters,
    windDriftMeters,
  };
}

/**
 * Generates 3D world points along the predicted trajectory curve for Training Mode / Tracer Preview.
 */
export function generateTrajectoryArc(
  origin: [number, number, number],
  dir: [number, number, number],
  muzzleVelocity: number,
  windX: number,
  ammoType: AmmoType,
  maxDistance = 280,
  steps = 24
): BallisticStepPoint[] {
  const ammo = AMMO_TYPES[ammoType] ?? AMMO_TYPES.standard;
  const speed = Math.max(80, muzzleVelocity * BALLISTIC_SPEED_SCALE);
  const totalTime = maxDistance / speed;
  const dt = totalTime / steps;

  const points: BallisticStepPoint[] = [];
  let px = origin[0];
  let py = origin[1];
  let pz = origin[2];
  let vx = dir[0] * speed;
  let vy = dir[1] * speed;
  let vz = dir[2] * speed;

  points.push({ x: px, y: py, z: pz, t: 0 });
  for (let i = 1; i <= steps; i++) {
    vy -= GRAVITY_ACCEL * ammo.dropMultiplier * dt;
    vx += windX * WIND_DRIFT_FACTOR * 20 * dt;
    px += vx * dt;
    py += vy * dt;
    pz += vz * dt;
    points.push({ x: px, y: py, z: pz, t: i * dt });
  }
  return points;
}

/**
 * Steps an active projectile forward by `dt` seconds with gravity and crosswind.
 */
export function stepProjectile(proj: ProjectileState, dt: number): void {
  proj.prevX = proj.x;
  proj.prevY = proj.y;
  proj.prevZ = proj.z;

  proj.vy -= GRAVITY_ACCEL * proj.dropMultiplier * dt;
  proj.vx += proj.windX * WIND_DRIFT_FACTOR * 20 * dt;

  proj.x += proj.vx * dt;
  proj.y += proj.vy * dt;
  proj.z += proj.vz * dt;
  proj.age += dt;
}

/**
 * Computes final damage dealt to an enemy or destructible target based on hit region,
 * distance falloff, target armor rating, and weapon armor penetration.
 */
export function calculateImpactDamage(params: {
  baseDamage: number;
  distanceMeters: number;
  effectiveRange: number;
  armorPenetration: number;
  hitRegion: HitRegion;
  enemyClass: EnemyClass;
}): { finalDamage: number; isHeadshot: boolean; armorMitigated: boolean } {
  const {
    baseDamage,
    distanceMeters,
    effectiveRange,
    armorPenetration,
    hitRegion,
    enemyClass,
  } = params;

  let regionMult = 1.0;
  let isHeadshot = false;
  if (hitRegion === 'head') {
    regionMult = 2.65;
    isHeadshot = true;
  } else if (hitRegion === 'weakpoint') {
    regionMult = 2.2;
    isHeadshot = true;
  } else if (hitRegion === 'limbs') {
    regionMult = 0.65;
  } else if (hitRegion === 'armor') {
    regionMult = 0.5;
  }

  // Distance falloff only beyond effective range (never below 68% energy)
  let rangeMult = 1.0;
  if (distanceMeters > effectiveRange) {
    const excess = distanceMeters - effectiveRange;
    rangeMult = Math.max(0.68, 1 - excess / (effectiveRange * 1.8));
  }

  // Enemy class armor factor
  let targetArmor = 0;
  if (enemyClass === 'armored') {
    targetArmor = hitRegion === 'head' ? 0.35 : 0.6;
  } else if (enemyClass === 'commander') {
    targetArmor = hitRegion === 'head' || hitRegion === 'weakpoint' ? 0.3 : 0.72;
  } else if (enemyClass === 'sabotage_node') {
    targetArmor = 0.35;
  } else if (enemyClass === 'reinforcement') {
    targetArmor = 0.25;
  }

  const unmitigatedArmor = Math.max(0, targetArmor * (1 - armorPenetration));
  const armorMult = 1 - unmitigatedArmor * 0.75;
  const armorMitigated = unmitigatedArmor > 0.22;

  const finalDamage = Math.max(8, Math.round(baseDamage * regionMult * rangeMult * armorMult));

  return {
    finalDamage,
    isHeadshot,
    armorMitigated,
  };
}
