import { AIState, EnemyClass, EnemySpawnSpec, HitRegion } from '../types/game';
import {
  castWorldSegment,
  GeneratedWorld,
  getSupportFloorHeight,
  resolveHorizontalCollision,
} from '../world/WorldBuilder';

export interface ActiveSmokeCloud {
  x: number;
  y: number;
  z: number;
  radius: number;
  remaining: number;
}

export interface ActiveDecoy {
  x: number;
  y: number;
  z: number;
  remaining: number;
  pulseTimer: number;
}

export interface ActiveSensor {
  x: number;
  y: number;
  z: number;
  radius: number;
  remaining: number;
}

export interface EnemyEntity {
  id: string;
  name: string;
  enemyClass: EnemyClass;
  isPriorityTarget: boolean;
  isBoss: boolean;
  bossStage: number;
  bossStagePositions: [number, number, number][];
  x: number;
  y: number;
  z: number;
  spawnX: number;
  spawnY: number;
  spawnZ: number;
  rotY: number;
  hp: number;
  maxHp: number;
  speed: number;
  visionRange: number;
  state: AIState;
  suspicion: number; // 0..100
  stateTimer: number;
  fireCooldown: number;
  sniperGlintCharge: number; // 0..1 before counter-sniper fires
  tagged: boolean;
  patrolPoints: [number, number, number][];
  patrolIndex: number;
  investigateTarget: [number, number, number] | null;
  hitFlashTimer: number;
  deathProgress: number; // 0..1 fall animation
  hasCalledReinforcements: boolean;
  movingTargetSpeed: number;
  movingPhase: number;
  animTime: number;
  isMoving: boolean;
}

export function getEnemyMaxHp(enemyClass: EnemyClass, isBoss = false): number {
  let base = 95;
  switch (enemyClass) {
    case 'guard':
      base = 90;
      break;
    case 'scout':
      base = 75;
      break;
    case 'counter_sniper':
      base = 85;
      break;
    case 'reinforcement':
      base = 105;
      break;
    case 'armored':
      base = 175;
      break;
    case 'commander':
      base = 210;
      break;
    case 'hostage':
      base = 60;
      break;
    case 'target_dummy':
      base = 50;
      break;
    case 'sabotage_node':
      base = 130;
      break;
  }
  return isBoss ? Math.round(base * 1.85) : base;
}

export function createEnemyFromSpec(spec: EnemySpawnSpec, world: GeneratedWorld): EnemyEntity {
  const [sx, sy, sz] = spec.position;
  const floorY = Math.max(sy, getSupportFloorHeight(world, sx, sz, sy + 1.2));
  const maxHp = getEnemyMaxHp(spec.enemyClass, spec.isBoss);

  const defaultNameMap: Record<EnemyClass, string> = {
    guard: 'Meridian Trooper',
    armored: 'Heavy Enforcer',
    scout: 'Recon Scout',
    counter_sniper: 'Overwatch Marksman',
    commander: 'Field Commander',
    reinforcement: 'QRF Shock Unit',
    hostage: 'Captured Informant',
    target_dummy: 'Ballistic Steel Target',
    sabotage_node: 'Telemetry Array',
  };

  let speed = 2.6;
  let visionRange = 64;
  if (spec.enemyClass === 'scout') {
    speed = 4.1;
    visionRange = 76;
  } else if (spec.enemyClass === 'armored') {
    speed = 1.95;
    visionRange = 58;
  } else if (spec.enemyClass === 'counter_sniper') {
    speed = 3.0;
    visionRange = 84;
  } else if (spec.enemyClass === 'commander') {
    speed = 2.8;
    visionRange = 72;
  } else if (
    spec.enemyClass === 'hostage' ||
    spec.enemyClass === 'target_dummy' ||
    spec.enemyClass === 'sabotage_node'
  ) {
    speed = 0;
    visionRange = 0;
  }

  return {
    id: spec.id,
    name: spec.name ?? defaultNameMap[spec.enemyClass],
    enemyClass: spec.enemyClass,
    isPriorityTarget: Boolean(spec.isPriorityTarget),
    isBoss: Boolean(spec.isBoss),
    bossStage: 0,
    bossStagePositions: spec.bossStagePositions ?? [],
    x: sx,
    y: floorY,
    z: sz,
    spawnX: sx,
    spawnY: floorY,
    spawnZ: sz,
    rotY: 0,
    hp: maxHp,
    maxHp,
    speed,
    visionRange,
    state: 'patrol',
    suspicion: 0,
    stateTimer: 0,
    fireCooldown: 1.5 + Math.random() * 1.5,
    sniperGlintCharge: 0,
    tagged: spec.enemyClass === 'target_dummy' || spec.enemyClass === 'sabotage_node',
    patrolPoints:
      spec.patrolPoints && spec.patrolPoints.length > 0
        ? spec.patrolPoints
        : [[sx, floorY, sz]],
    patrolIndex: 0,
    investigateTarget: null,
    hitFlashTimer: 0,
    deathProgress: 0,
    hasCalledReinforcements: false,
    movingTargetSpeed: spec.movingTargetSpeed ?? 0,
    movingPhase: Math.random() * Math.PI * 2,
    animTime: Math.random() * 10,
    isMoving: false,
  };
}

/**
 * Checks whether a 3D projectile segment [A -> B] hits an active entity's head, torso, limbs, or weakpoint.
 */
export function intersectSegmentWithEnemy(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  enemy: EnemyEntity
): { hitRegion: HitRegion; point: [number, number, number]; t: number } | null {
  if (enemy.state === 'dead') return null;

  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const segLenSq = dx * dx + dy * dy + dz * dz;
  if (segLenSq < 1e-9) return null;

  // Parameter t closest in XZ to enemy center
  const projT = Math.max(
    0,
    Math.min(1, ((enemy.x - ax) * dx + (enemy.z - az) * dz) / (dx * dx + dz * dz + 1e-6))
  );
  const px = ax + dx * projT;
  const py = ay + dy * projT;
  const pz = az + dz * projT;

  const radialDist = Math.hypot(px - enemy.x, pz - enemy.z);

  if (enemy.enemyClass === 'sabotage_node') {
    if (radialDist <= 0.95 && py >= enemy.y && py <= enemy.y + 2.3) {
      const region: HitRegion = py >= enemy.y + 1.45 ? 'weakpoint' : 'armor';
      return { hitRegion: region, point: [px, py, pz], t: projT };
    }
    return null;
  }

  if (enemy.enemyClass === 'target_dummy') {
    if (radialDist <= 0.72 && py >= enemy.y + 0.25 && py <= enemy.y + 1.95) {
      const bullseyeDist = Math.hypot(px - enemy.x, py - (enemy.y + 1.55));
      const region: HitRegion = bullseyeDist <= 0.26 ? 'head' : 'torso';
      return { hitRegion: region, point: [px, py, pz], t: projT };
    }
    return null;
  }

  // Humanoid articulated hit zones:
  // Feet to 0.88m: Limbs
  // 0.88m to 1.44m: Torso
  // 1.44m to 1.88m: Head (radius 0.27m generous enough for satisfying skill shots!)
  const relY = py - enemy.y;
  if (relY < 0 || relY > 1.9) return null;

  if (relY >= 1.43 && relY <= 1.9) {
    if (radialDist <= 0.3) {
      return { hitRegion: 'head', point: [px, py, pz], t: projT };
    }
    return null;
  }

  if (relY >= 0.86 && relY < 1.43) {
    if (radialDist <= 0.44) {
      return { hitRegion: 'torso', point: [px, py, pz], t: projT };
    }
    return null;
  }

  if (radialDist <= 0.38) {
    return { hitRegion: 'limbs', point: [px, py, pz], t: projT };
  }

  return null;
}

function isBlockedBySmoke(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  smokes: ActiveSmokeCloud[]
): boolean {
  for (let i = 0; i < smokes.length; i++) {
    const s = smokes[i];
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const lenSq = dx * dx + dy * dy + dz * dz;
    if (lenSq < 0.01) continue;
    const t = Math.max(0, Math.min(1, ((s.x - ax) * dx + (s.y - ay) * dy + (s.z - az) * dz) / lenSq));
    const cx = ax + dx * t;
    const cy = ay + dy * t;
    const cz = az + dz * t;
    const dist = Math.hypot(cx - s.x, cy - s.y, cz - s.z);
    if (dist <= s.radius) return true;
  }
  return false;
}

export function canEnemySeePlayer(
  enemy: EnemyEntity,
  playerPos: [number, number, number],
  playerCrouching: boolean,
  world: GeneratedWorld,
  smokes: ActiveSmokeCloud[]
): boolean {
  if (enemy.visionRange <= 0 || enemy.state === 'dead') return false;

  const dx = playerPos[0] - enemy.x;
  const dy = playerPos[1] + 1.35 - (enemy.y + 1.55);
  const dz = playerPos[2] - enemy.z;
  const dist = Math.hypot(dx, dy, dz);

  const effectiveRange =
    enemy.state === 'alerted' || enemy.state === 'engaging' || enemy.state === 'investigating'
      ? enemy.visionRange * 2.8
      : playerCrouching
      ? enemy.visionRange * 0.58
      : enemy.visionRange;

  if (dist > effectiveRange) return false;

  // Check FOV cone (140 deg on patrol, 360 deg if already alerted/investigating)
  if (enemy.state === 'patrol' || enemy.state === 'returning') {
    const forwardX = Math.sin(enemy.rotY);
    const forwardZ = Math.cos(enemy.rotY);
    const invHoriz = 1 / Math.max(0.001, Math.hypot(dx, dz));
    const dot = (dx * invHoriz) * forwardX + (dz * invHoriz) * forwardZ;
    if (dot < -0.15) return false;
  }

  // Smoke check
  if (
    isBlockedBySmoke(
      enemy.x,
      enemy.y + 1.55,
      enemy.z,
      playerPos[0],
      playerPos[1] + 1.35,
      playerPos[2],
      smokes
    )
  ) {
    return false;
  }

  // Solid geometry & terrain LOS check — enemies NEVER detect player through walls
  const hit = castWorldSegment(
    world,
    enemy.x,
    enemy.y + 1.55,
    enemy.z,
    playerPos[0],
    playerPos[1] + 1.35,
    playerPos[2],
    true
  );

  return hit === null;
}

export interface EnemyUpdateCallbacks {
  onEnemyFire: (enemy: EnemyEntity, accuracyDamage: number, isSniperShot: boolean) => void;
  onSpawnReinforcements: (commander: EnemyEntity) => void;
  onAlarmRaised: () => void;
}

/**
 * Updates all AI units for a frame delta `dt`.
 */
export function updateEnemiesAI(
  enemies: EnemyEntity[],
  dt: number,
  playerPos: [number, number, number],
  playerCrouching: boolean,
  world: GeneratedWorld,
  smokes: ActiveSmokeCloud[],
  sensors: ActiveSensor[],
  callbacks: EnemyUpdateCallbacks
): { maxAlertLevel: number; statusLabel: 'UNAWARE' | 'SUSPICIOUS' | 'SEARCHING' | 'COMBAT ALERT' } {
  let maxAlertLevel = 0;
  let anyEngaging = false;
  let anySearching = false;
  let anySuspicious = false;

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e.hitFlashTimer > 0) e.hitFlashTimer = Math.max(0, e.hitFlashTimer - dt);

    if (e.state === 'dead') {
      if (e.deathProgress < 1) {
        e.deathProgress = Math.min(1, e.deathProgress + dt * 2.8);
      }
      continue;
    }

    // Proximity sensor tagging check
    if (!e.tagged) {
      for (let s = 0; s < sensors.length; s++) {
        const sen = sensors[s];
        if (Math.hypot(e.x - sen.x, e.z - sen.z) <= sen.radius) {
          e.tagged = true;
          break;
        }
      }
    }

    // Moving range target oscillation
    if (e.enemyClass === 'target_dummy') {
      if (e.movingTargetSpeed > 0) {
        e.movingPhase += dt * e.movingTargetSpeed * 0.45;
        e.x = e.spawnX + Math.sin(e.movingPhase) * 9.5;
        e.y = getSupportFloorHeight(world, e.x, e.z, e.y + 1.0);
      }
      continue;
    }

    if (e.enemyClass === 'sabotage_node' || e.enemyClass === 'hostage') {
      e.animTime += dt;
      continue;
    }

    const seesPlayer = canEnemySeePlayer(e, playerPos, playerCrouching, world, smokes);
    const distToPlayer = Math.hypot(playerPos[0] - e.x, playerPos[2] - e.z);

    if (seesPlayer) {
      const fillRate =
        e.enemyClass === 'scout' || e.enemyClass === 'counter_sniper'
          ? 78
          : distToPlayer < 55
          ? 65
          : 38;
      e.suspicion = Math.min(100, e.suspicion + fillRate * dt);
      e.investigateTarget = [playerPos[0], playerPos[1], playerPos[2]];

      if (e.suspicion >= 100 && e.state !== 'engaging') {
        const wasCombat = e.state === 'alerted';
        e.state = 'engaging';
        e.stateTimer = 14;
        if (!wasCombat) {
          callbacks.onAlarmRaised();
        }
        // Alert nearby squadmates within 26m radio link
        for (let j = 0; j < enemies.length; j++) {
          const ally = enemies[j];
          if (
            ally !== e &&
            ally.state !== 'dead' &&
            ally.visionRange > 0 &&
            Math.hypot(ally.x - e.x, ally.z - e.z) < 28
          ) {
            if (ally.state === 'patrol' || ally.state === 'suspicious') {
              ally.state = 'investigating';
              ally.suspicion = Math.max(ally.suspicion, 70);
              ally.investigateTarget = [playerPos[0], playerPos[1], playerPos[2]];
              ally.stateTimer = 11;
            }
          }
        }
      } else if (e.suspicion >= 35 && e.state === 'patrol') {
        e.state = 'suspicious';
        e.stateTimer = 6;
      }
    } else {
      // Decay suspicion slowly when out of LOS
      if (e.state === 'engaging') {
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) {
          e.state = 'investigating';
          e.stateTimer = 10;
        }
      } else if (e.state === 'investigating' || e.state === 'alerted') {
        e.stateTimer -= dt;
        e.suspicion = Math.max(25, e.suspicion - 6 * dt);
        if (e.stateTimer <= 0) {
          e.state = 'returning';
        }
      } else if (e.state === 'suspicious') {
        e.stateTimer -= dt;
        e.suspicion = Math.max(0, e.suspicion - 12 * dt);
        if (e.stateTimer <= 0 && e.suspicion <= 5) {
          e.state = 'patrol';
        }
      } else {
        e.suspicion = Math.max(0, e.suspicion - 15 * dt);
      }
    }

    // Commander calls reinforcements once upon full combat alert
    if (
      e.state === 'engaging' &&
      !e.hasCalledReinforcements &&
      e.enemyClass === 'commander'
    ) {
      e.hasCalledReinforcements = true;
      callbacks.onSpawnReinforcements(e);
    }

    // Movement & orientation per state
    let moveTarget: [number, number] | null = null;
    let speedMult = 1.0;

    if (e.state === 'patrol') {
      const wp = e.patrolPoints[e.patrolIndex % e.patrolPoints.length];
      const dWp = Math.hypot(wp[0] - e.x, wp[2] - e.z);
      if (dWp < 1.2) {
        if (e.patrolPoints.length > 1) {
          e.patrolIndex = (e.patrolIndex + 1) % e.patrolPoints.length;
        }
      } else {
        moveTarget = [wp[0], wp[2]];
        speedMult = 0.65;
      }
    } else if (e.state === 'suspicious') {
      if (e.investigateTarget) {
        e.rotY = Math.atan2(e.investigateTarget[0] - e.x, e.investigateTarget[2] - e.z);
      }
      e.sniperGlintCharge = 0;
    } else if (e.state === 'investigating' || e.state === 'alerted') {
      if (e.investigateTarget) {
        const dInv = Math.hypot(e.investigateTarget[0] - e.x, e.investigateTarget[2] - e.z);
        if (dInv > 6.5 && e.enemyClass !== 'counter_sniper') {
          moveTarget = [e.investigateTarget[0], e.investigateTarget[2]];
          speedMult = 1.05;
        } else {
          e.rotY = Math.atan2(
            e.investigateTarget[0] - e.x + Math.sin(e.animTime * 1.5) * 3,
            e.investigateTarget[2] - e.z
          );
        }
      }
    } else if (e.state === 'returning') {
      const home = e.patrolPoints[0];
      const dHome = Math.hypot(home[0] - e.x, home[2] - e.z);
      if (dHome < 1.5) {
        e.state = 'patrol';
      } else {
        moveTarget = [home[0], home[2]];
        speedMult = 0.8;
      }
    } else if (e.state === 'engaging') {
      // Face player
      e.rotY = Math.atan2(playerPos[0] - e.x, playerPos[2] - e.z);

      // Strafe tactically if in open, counter-snipers hold vantage until shot
      if (e.enemyClass !== 'counter_sniper' && distToPlayer > 32) {
        const strafeDir = Math.sin(e.animTime * 0.9) > 0 ? 1 : -1;
        const perpX = Math.cos(e.rotY) * strafeDir;
        const perpZ = -Math.sin(e.rotY) * strafeDir;
        moveTarget = [e.x + perpX * 4, e.z + perpZ * 4];
        speedMult = 0.72;
      }

      // Firing logic when player is visible
      if (seesPlayer) {
        if (e.enemyClass === 'counter_sniper') {
          e.sniperGlintCharge += dt * 0.55;
          if (e.sniperGlintCharge >= 1.0) {
            e.sniperGlintCharge = 0;
            callbacks.onEnemyFire(e, 26, true);
            // Counter-sniper shifts position laterally after firing!
            if (e.patrolPoints.length > 1) {
              e.patrolIndex = (e.patrolIndex + 1) % e.patrolPoints.length;
            }
          }
        } else {
          e.fireCooldown -= dt;
          if (e.fireCooldown <= 0) {
            e.fireCooldown = e.enemyClass === 'scout' ? 1.4 : 2.1 + Math.random() * 0.9;
            const dmg = e.enemyClass === 'commander' ? 14 : e.enemyClass === 'armored' ? 12 : 9;
            callbacks.onEnemyFire(e, dmg, false);
          }
        }
      } else {
        e.sniperGlintCharge = Math.max(0, e.sniperGlintCharge - dt);
      }
    }

    if (moveTarget && e.speed > 0) {
      const mdx = moveTarget[0] - e.x;
      const mdz = moveTarget[1] - e.z;
      const mlen = Math.hypot(mdx, mdz);
      if (mlen > 0.15) {
        const step = e.speed * speedMult * dt;
        const nx = e.x + (mdx / mlen) * step;
        const nz = e.z + (mdz / mlen) * step;
        const resolved = resolveHorizontalCollision(world, nx, nz, e.y, 0.48);
        e.x = resolved.x;
        e.z = resolved.z;
        e.y = getSupportFloorHeight(world, e.x, e.z, e.y);
        if (e.state !== 'engaging') {
          e.rotY = Math.atan2(mdx, mdz);
        }
        e.isMoving = true;
        e.animTime += dt * speedMult * 5.2;
      } else {
        e.isMoving = false;
        e.animTime += dt;
      }
    } else {
      e.isMoving = false;
      e.animTime += dt;
    }

    maxAlertLevel = Math.max(maxAlertLevel, e.suspicion);
    if (e.state === 'engaging') anyEngaging = true;
    else if (e.state === 'investigating' || e.state === 'alerted') anySearching = true;
    else if (e.state === 'suspicious') anySuspicious = true;
  }

  const statusLabel: 'UNAWARE' | 'SUSPICIOUS' | 'SEARCHING' | 'COMBAT ALERT' = anyEngaging
    ? 'COMBAT ALERT'
    : anySearching
    ? 'SEARCHING'
    : anySuspicious
    ? 'SUSPICIOUS'
    : 'UNAWARE';

  return { maxAlertLevel: Math.round(maxAlertLevel), statusLabel };
}

/**
 * Alerts enemies who hear an unsuppressed / nearby gunshot or decoy pulse.
 */
export function notifyAcousticEvent(
  enemies: EnemyEntity[],
  sourcePos: [number, number, number],
  radius: number,
  isDecoy = false
): void {
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e.state === 'dead' || e.visionRange <= 0) continue;
    const d = Math.hypot(e.x - sourcePos[0], e.z - sourcePos[2]);
    if (d <= radius) {
      e.investigateTarget = [sourcePos[0], sourcePos[1], sourcePos[2]];
      if (isDecoy) {
        if (e.state !== 'engaging') {
          e.state = 'investigating';
          e.suspicion = Math.max(e.suspicion, 55);
          e.stateTimer = 11;
        }
      } else {
        e.suspicion = Math.min(100, e.suspicion + (d < radius * 0.45 ? 75 : 45));
        if (e.state === 'patrol' || e.state === 'suspicious' || e.state === 'returning') {
          e.state = 'investigating';
          e.stateTimer = 12;
        }
      }
    }
  }
}

/**
 * Notifies nearby allies when a unit takes lethal or heavy sniper fire (bullet impact witness).
 */
export function notifyBulletImpactNearEnemies(
  enemies: EnemyEntity[],
  impactPoint: [number, number, number],
  shooterPos: [number, number, number]
): void {
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e.state === 'dead' || e.visionRange <= 0) continue;
    const d = Math.hypot(e.x - impactPoint[0], e.z - impactPoint[2]);
    if (d <= 15) {
      e.suspicion = Math.min(100, e.suspicion + 65);
      // Estimate general direction of shooter with slight error
      e.investigateTarget = [
        shooterPos[0] + (Math.random() - 0.5) * 10,
        shooterPos[1],
        shooterPos[2] + (Math.random() - 0.5) * 10,
      ];
      if (e.state !== 'engaging') {
        e.state = 'alerted';
        e.stateTimer = 13;
      }
    }
  }
}
