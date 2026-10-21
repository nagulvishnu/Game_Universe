import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  ActiveDecoy,
  ActiveSensor,
  ActiveSmokeCloud,
  createEnemyFromSpec,
  EnemyEntity,
  intersectSegmentWithEnemy,
  notifyAcousticEvent,
  notifyBulletImpactNearEnemies,
  updateEnemiesAI,
} from '../ai/enemyAI';
import { soundEngine } from '../audio/soundEngine';
import {
  BALLISTIC_SPEED_SCALE,
  calculateBallisticOffset,
  calculateImpactDamage,
  computeWeaponStats,
  generateTrajectoryArc,
  ProjectileState,
  stepProjectile,
} from '../combat/ballistics';
import { AMMO_TYPES, getEquipmentById } from '../data/customization';
import { getWeaponById } from '../data/weapons';
import { liveInput } from '../game/inputState';
import {
  ActiveObjectiveProgress,
  AmmoType,
  EquipmentId,
  GameSettings,
  HudSnapshot,
  KillFeedItem,
  MinimapBlip,
  MissionDefinition,
  WeaponLoadoutConfig,
} from '../types/game';
import { ProceduralRifle } from '../weapons/ProceduralRifle';
import { EnemyCharacterMesh } from './EnemyCharacterMesh';
import {
  buildWorldForBiome,
  castWorldSegment,
  GeneratedWorld,
  getSupportFloorHeight,
  getTerrainHeight,
  resolveHorizontalCollision,
} from './WorldBuilder';

interface ParticleBurst {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

interface BulletTracer {
  id: number;
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  color: string;
  life: number;
}

interface IntelCrateState {
  id: string;
  x: number;
  y: number;
  z: number;
  collected: boolean;
}

export interface MissionEndPayload {
  victory: boolean;
  failureReason?: string;
  shotsFired: number;
  shotsHit: number;
  kills: number;
  headshots: number;
  longestShot: number;
  timeSeconds: number;
  alarmsTriggered: number;
  optionalCompletedCount: number;
}

interface CoreSimulationProps {
  mission: MissionDefinition;
  world: GeneratedWorld;
  weaponId: string;
  loadout: WeaponLoadoutConfig;
  initialAmmoType: AmmoType;
  equippedSlots: [EquipmentId, EquipmentId];
  settings: GameSettings;
  paused: boolean;
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onMissionEnd: (payload: MissionEndPayload) => void;
  onThermalStateChange: (thermal: boolean, lowlight: boolean) => void;
}

const CoreSimulation: React.FC<CoreSimulationProps> = ({
  mission,
  world,
  weaponId,
  loadout,
  initialAmmoType,
  equippedSlots,
  settings,
  paused,
  onHudUpdate,
  onMissionEnd,
  onThermalStateChange,
}) => {
  const { camera } = useThree();
  const weapon = useMemo(() => getWeaponById(weaponId), [weaponId]);
  const [ammoType, setAmmoType] = useState<AmmoType>(initialAmmoType);
  const stats = useMemo(
    () => computeWeaponStats(weapon, loadout, ammoType),
    [weapon, loadout, ammoType]
  );

  // Mutable high-frequency game simulation state (60fps, zero React re-renders per frame)
  const enemiesRef = useRef<EnemyEntity[]>([]);
  const projectilesRef = useRef<ProjectileState[]>([]);
  const particlesRef = useRef<ParticleBurst[]>([]);
  const tracersRef = useRef<BulletTracer[]>([]);
  const smokesRef = useRef<ActiveSmokeCloud[]>([]);
  const decoysRef = useRef<ActiveDecoy[]>([]);
  const sensorsRef = useRef<ActiveSensor[]>([]);
  const intelRef = useRef<IntelCrateState[]>([]);

  const simRef = useRef({
    initialized: false,
    ended: false,
    playerX: mission.playerSpawn[0],
    playerY: mission.playerSpawn[1],
    playerZ: mission.playerSpawn[2],
    yaw: mission.initialYaw,
    pitch: -0.04,
    recoilPitch: 0,
    recoilYaw: 0,
    shakeIntensity: 0,
    isCrouching: false,
    isScoped: false,
    isBinoculars: false,
    isThirdPerson: settings.thirdPersonDefault,
    zoomIndex: 0,
    currentFov: 65,
    health: 100,
    maxHealth: 100,
    stamina: 100,
    isHoldingBreath: false,
    heartbeatTimer: 0,
    ammoInMag: stats.magSize,
    reserveAmmo: mission.mode === 'free_sniper' ? 999 : stats.magSize * 7,
    fireTimer: 0,
    boltCycleTimer: 0,
    boltCycleDuration: 0.65,
    reloadTimer: 0,
    muzzleFlash: 0,
    elapsed: 0,
    currentWave: 1,
    totalWaves: mission.wavesCount ?? 1,
    waveSpawnDelay: 0,
    shotsFired: 0,
    shotsHit: 0,
    kills: 0,
    priorityKills: 0,
    sabotageCount: 0,
    intelCollected: 0,
    longshotCount: 0,
    headshots: 0,
    longestShot: 0,
    alarmsTriggered: 0,
    reachedExtraction: false,
    score: 0,
    comboCount: 0,
    rangefinderMeters: 100,
    hudSyncTimer: 0,
    pulseRevealTimer: 0,
    equipmentCharges: {
      binoculars: 99,
      pulse_reveal: getEquipmentById('pulse_reveal').maxCharges,
      decoy: getEquipmentById('decoy').maxCharges,
      smoke: getEquipmentById('smoke').maxCharges,
      motion_sensor: getEquipmentById('motion_sensor').maxCharges,
      supply_kit: getEquipmentById('supply_kit').maxCharges,
    } as Record<EquipmentId, number>,
    equipmentCooldowns: {
      binoculars: 0,
      pulse_reveal: 0,
      decoy: 0,
      smoke: 0,
      motion_sensor: 0,
      supply_kit: 0,
    } as Record<EquipmentId, number>,
    killFeed: [] as KillFeedItem[],
    hitMarker: null as HudSnapshot['hitMarker'],
    damageDirectionRad: null as number | null,
    damageFlashTime: 0,
    killcamTimer: 0,
    killcamTarget: [0, 0, 0] as [number, number, number],
    killcamOrigin: [0, 0, 0] as [number, number, number],
    killcamDistance: 0,
    nextProjId: 1,
    walkBobTime: 0,
    lastWallMs: 0,
  });

  // Viewmodel & 3rd-person character refs
  const viewmodelGroupRef = useRef<THREE.Group>(null);
  const playerRigRef = useRef<THREE.Group>(null);
  const trajectoryLineObj = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const mat = new THREE.LineBasicMaterial({ color: '#f43f5e', linewidth: 2 });
    const ln = new THREE.Line(geo, mat);
    ln.visible = false;
    ln.frustumCulled = false;
    return ln;
  }, []);
  const [, forceSceneRefresh] = useState(0);

  // Initialize entities when mission starts
  useEffect(() => {
    world.barrels.forEach((b) => {
      b.exploded = false;
    });
    enemiesRef.current = mission.enemies.map((spec) => createEnemyFromSpec(spec, world));
    intelRef.current = (mission.intelPositions ?? []).map((pos, idx) => ({
      id: `intel_${idx}`,
      x: pos[0],
      y: Math.max(pos[1], getSupportFloorHeight(world, pos[0], pos[2], pos[1] + 1)),
      z: pos[2],
      collected: false,
    }));
    projectilesRef.current = [];
    particlesRef.current = [];
    tracersRef.current = [];
    smokesRef.current = [];
    decoysRef.current = [];
    sensorsRef.current = [];

    const startFloor = getSupportFloorHeight(
      world,
      mission.playerSpawn[0],
      mission.playerSpawn[2],
      mission.playerSpawn[1] + 2
    );
    simRef.current.playerX = mission.playerSpawn[0];
    simRef.current.playerY = startFloor;
    simRef.current.playerZ = mission.playerSpawn[2];
    simRef.current.yaw = mission.initialYaw;
    simRef.current.pitch = -0.088;
    simRef.current.ended = false;
    simRef.current.initialized = true;

    soundEngine.startAmbience(mission.weather);
    forceSceneRefresh((n) => n + 1);

    return () => {
      soundEngine.stopAmbience();
    };
  }, [mission, world]);

  const spawnExplosionAt = (cx: number, cy: number, cz: number, damageRadius = 11) => {
    soundEngine.playExplosion();
    const s = simRef.current;
    s.shakeIntensity = Math.min(1.0, s.shakeIntensity + 0.65);

    for (let p = 0; p < 22; p++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 4 + Math.random() * 14;
      particlesRef.current.push({
        id: s.nextProjId++,
        x: cx,
        y: cy + 0.6,
        z: cz,
        vx: Math.cos(ang) * spd,
        vy: 3 + Math.random() * 11,
        vz: Math.sin(ang) * spd,
        color: p % 2 === 0 ? '#f97316' : '#fde047',
        size: 0.35 + Math.random() * 0.4,
        life: 0.65 + Math.random() * 0.5,
        maxLife: 1.15,
      });
    }

    // Damage enemies within blast radius
    for (const enemy of enemiesRef.current) {
      if (enemy.state === 'dead' || enemy.enemyClass === 'hostage') continue;
      const d = Math.hypot(enemy.x - cx, enemy.y - cy, enemy.z - cz);
      if (d <= damageRadius) {
        const blastDmg = Math.round(180 * (1 - d / (damageRadius + 2)));
        enemy.hp -= blastDmg;
        if (enemy.hp <= 0) {
          enemy.hp = 0;
          enemy.state = 'dead';
          s.kills += 1;
          if (enemy.isPriorityTarget) s.priorityKills += 1;
          if (enemy.enemyClass === 'sabotage_node') s.sabotageCount += 1;
          s.score += 350;
          s.killFeed = [
            {
              id: s.nextProjId++,
              text: `${enemy.name} [EXPLOSIVE]`,
              subtext: '+350 PTS',
              isHeadshot: false,
              distance: Math.round(Math.hypot(enemy.x - s.playerX, enemy.z - s.playerZ)),
              timestamp: Date.now(),
            },
            ...s.killFeed.slice(0, 4),
          ];
          soundEngine.playHitMarker(true);
        }
      }
    }
    notifyAcousticEvent(enemiesRef.current, [cx, cy, cz], 110, false);
  };

  const activateEquipment = (eqId: EquipmentId) => {
    const s = simRef.current;
    if (s.equipmentCharges[eqId] <= 0 || s.equipmentCooldowns[eqId] > 0) return;

    const def = getEquipmentById(eqId);
    s.equipmentCharges[eqId] -= 1;
    s.equipmentCooldowns[eqId] = def.cooldown;
    soundEngine.playUiTone('objective');

    if (eqId === 'pulse_reveal') {
      s.pulseRevealTimer = 12;
      for (const e of enemiesRef.current) {
        if (e.state !== 'dead') e.tagged = true;
      }
    } else if (eqId === 'supply_kit') {
      s.health = Math.min(s.maxHealth, s.health + 65);
      s.stamina = 100;
      s.reserveAmmo += stats.magSize * 2;
    } else if (eqId === 'smoke') {
      smokesRef.current.push({
        x: s.playerX,
        y: s.playerY + 1.1,
        z: s.playerZ - 1.5,
        radius: 6.5,
        remaining: 15,
      });
    } else if (eqId === 'motion_sensor') {
      sensorsRef.current.push({
        x: s.playerX + Math.sin(s.yaw) * -3,
        y: s.playerY,
        z: s.playerZ + Math.cos(s.yaw) * -3,
        radius: 32,
        remaining: 45,
      });
    } else if (eqId === 'decoy') {
      // Throw decoy toward aim point up to 65m
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const hit = castWorldSegment(
        world,
        camera.position.x,
        camera.position.y,
        camera.position.z,
        camera.position.x + dir.x * 75,
        camera.position.y + dir.y * 75,
        camera.position.z + dir.z * 75,
        false
      );
      const tx = hit ? hit.point[0] : s.playerX + dir.x * 35;
      const tz = hit ? hit.point[2] : s.playerZ + dir.z * 35;
      const ty = getSupportFloorHeight(world, tx, tz, 12);
      decoysRef.current.push({ x: tx, y: ty, z: tz, remaining: 14, pulseTimer: 0.1 });
      notifyAcousticEvent(enemiesRef.current, [tx, ty, tz], 46, true);
    }
    forceSceneRefresh((n) => n + 1);
  };

  useFrame((_, rawDelta) => {
    const s = simRef.current;
    if (!s.initialized || paused || s.ended) return;

    const timerDt = Math.min(0.25, rawDelta);
    const realDt = Math.min(0.1, rawDelta);
    // Bullet-time slow motion factor during lethal killcam
    const timeScale = s.killcamTimer > 0 ? 0.28 : 1.0;
    const dt = realDt * timeScale;

    if (s.killcamTimer > 0) {
      s.killcamTimer = Math.max(0, s.killcamTimer - timerDt);
    }

    s.elapsed += timerDt * timeScale;
    if (s.health < s.maxHealth && s.damageFlashTime <= 0) {
      // Slow tactical health regen when out of fire
      s.health = Math.min(s.maxHealth, s.health + 1.8 * dt);
    }
    if (s.damageFlashTime > 0) s.damageFlashTime = Math.max(0, s.damageFlashTime - timerDt);
    if (s.shakeIntensity > 0) s.shakeIntensity = Math.max(0, s.shakeIntensity - timerDt * 2.6);
    if (s.muzzleFlash > 0) s.muzzleFlash = Math.max(0, s.muzzleFlash - timerDt * 9);
    if (s.pulseRevealTimer > 0) s.pulseRevealTimer = Math.max(0, s.pulseRevealTimer - timerDt);

    // Tick equipment cooldowns
    (Object.keys(s.equipmentCooldowns) as EquipmentId[]).forEach((k) => {
      if (s.equipmentCooldowns[k] > 0) {
        s.equipmentCooldowns[k] = Math.max(0, s.equipmentCooldowns[k] - timerDt);
      }
    });

    // Handle discrete button requests from liveInput
    const kb = settings.keyBindings;
    if (liveInput.crouchToggleRequested) {
      liveInput.crouchToggleRequested = false;
      s.isCrouching = !s.isCrouching;
    }
    if (liveInput.cameraModeToggleRequested) {
      liveInput.cameraModeToggleRequested = false;
      s.isThirdPerson = !s.isThirdPerson;
      soundEngine.playUiTone('click');
    }
    if (liveInput.toggleScopeRequested) {
      liveInput.toggleScopeRequested = false;
      s.isScoped = !s.isScoped;
      if (s.isScoped) s.isBinoculars = false;
      onThermalStateChange(
        s.isScoped && stats.opticType === 'thermal',
        s.isScoped && stats.opticType === 'lowlight'
      );
      soundEngine.playUiTone('scope');
    }
    if (liveInput.binocularsToggleRequested) {
      liveInput.binocularsToggleRequested = false;
      s.isBinoculars = !s.isBinoculars;
      if (s.isBinoculars) {
        s.isScoped = false;
        onThermalStateChange(false, false);
      }
      soundEngine.playUiTone('scope');
    }
    if (liveInput.zoomDeltaSteps !== 0) {
      const steps = liveInput.zoomDeltaSteps;
      liveInput.zoomDeltaSteps = 0;
      if (s.isScoped && stats.zoomLevels.length > 1) {
        s.zoomIndex =
          (s.zoomIndex + steps + stats.zoomLevels.length) % stats.zoomLevels.length;
        soundEngine.playUiTone('scope');
      }
    }
    if (liveInput.ammoCycleRequested) {
      liveInput.ammoCycleRequested = false;
      const order: AmmoType[] = ['standard', 'ap', 'subsonic', 'high_velocity', 'training'];
      const next = order[(order.indexOf(ammoType) + 1) % order.length];
      setAmmoType(next);
      soundEngine.playUiTone('click');
    }
    if (liveInput.equipment1Requested) {
      liveInput.equipment1Requested = false;
      activateEquipment(equippedSlots[0]);
    }
    if (liveInput.equipment2Requested) {
      liveInput.equipment2Requested = false;
      activateEquipment(equippedSlots[1]);
    }

    // Reload handling
    if (
      (liveInput.reloadRequested || (s.ammoInMag === 0 && s.fireTimer <= 0)) &&
      s.reloadTimer <= 0 &&
      s.ammoInMag < stats.magSize &&
      s.reserveAmmo > 0
    ) {
      liveInput.reloadRequested = false;
      s.reloadTimer = stats.reloadTime;
      s.isScoped = false;
      onThermalStateChange(false, false);
      soundEngine.playReload(stats.reloadTime);
    } else {
      liveInput.reloadRequested = false;
    }

    if (s.reloadTimer > 0) {
      s.reloadTimer -= timerDt;
      if (s.reloadTimer <= 0) {
        const needed = stats.magSize - s.ammoInMag;
        const take = mission.mode === 'free_sniper' ? needed : Math.min(needed, s.reserveAmmo);
        s.ammoInMag += take;
        if (mission.mode !== 'free_sniper') s.reserveAmmo -= take;
      }
    }

    if (s.fireTimer > 0) s.fireTimer -= timerDt;
    if (s.boltCycleTimer > 0) s.boltCycleTimer -= timerDt;

    // Look rotation (Yaw & Pitch)
    const zoomMag = s.isScoped
      ? stats.zoomLevels[s.zoomIndex % stats.zoomLevels.length]
      : s.isBinoculars
      ? 10
      : 1;
    const sensScale =
      0.0022 *
      settings.mouseSensitivity *
      (zoomMag > 1 ? settings.scopeSensitivity * (2.6 / zoomMag) : 1.0);

    // Precision Arrow-Key Look Support (great for trackpads & fine 20x micro-adjustments!)
    const keyLookSpeed = (zoomMag > 1 ? 0.55 / Math.sqrt(zoomMag) : 1.35) * realDt;
    if (liveInput.keysDown.has('ArrowLeft')) s.yaw += keyLookSpeed;
    if (liveInput.keysDown.has('ArrowRight')) s.yaw -= keyLookSpeed;
    if (liveInput.keysDown.has('ArrowUp')) s.pitch += keyLookSpeed * 0.75;
    if (liveInput.keysDown.has('ArrowDown')) s.pitch -= keyLookSpeed * 0.75;

    const invertMult = settings.invertY ? 1 : -1;
    s.yaw -= liveInput.lookDeltaX * sensScale;
    s.pitch += liveInput.lookDeltaY * sensScale * invertMult;
    s.pitch = Math.max(-1.28, Math.min(1.18, s.pitch));
    liveInput.lookDeltaX = 0;
    liveInput.lookDeltaY = 0;

    // Smooth recoil recovery
    s.recoilPitch = THREE.MathUtils.lerp(s.recoilPitch, 0, Math.min(1, realDt * 7.5));
    s.recoilYaw = THREE.MathUtils.lerp(s.recoilYaw, 0, Math.min(1, realDt * 7.5));

    // Breath Hold (Shift or Space when Scoped)
    const sprintKeyDown =
      liveInput.keysDown.has(kb.sprint) ||
      liveInput.keysDown.has('ShiftRight') ||
      liveInput.touchSprint;
    const wantBreathHold =
      (s.isScoped || s.isBinoculars) &&
      (sprintKeyDown || liveInput.keysDown.has('Space') || liveInput.touchBreathHold) &&
      s.stamina > 4;

    s.isHoldingBreath = wantBreathHold;
    if (wantBreathHold) {
      s.stamina = Math.max(0, s.stamina - 22 * realDt);
      s.heartbeatTimer -= realDt;
      if (s.heartbeatTimer <= 0) {
        s.heartbeatTimer = 0.95;
        soundEngine.playHeartbeat();
      }
    }

    // Player Movement (WASD + Touch Stick)
    let moveForward = liveInput.touchMoveY;
    let moveRight = liveInput.touchMoveX;
    if (liveInput.keysDown.has(kb.moveForward)) moveForward += 1;
    if (liveInput.keysDown.has(kb.moveBackward)) moveForward -= 1;
    if (liveInput.keysDown.has(kb.moveRight)) moveRight += 1;
    if (liveInput.keysDown.has(kb.moveLeft)) moveRight -= 1;

    const moveMag = Math.hypot(moveForward, moveRight);
    const isSprinting =
      !s.isScoped && !s.isBinoculars && sprintKeyDown && moveMag > 0.1 && s.stamina > 5;

    if (isSprinting) {
      s.isCrouching = false;
      s.stamina = Math.max(0, s.stamina - 16 * realDt);
    } else if (!wantBreathHold) {
      s.stamina = Math.min(100, s.stamina + 20 * realDt);
    }

    if (moveMag > 0.05 && s.killcamTimer <= 0) {
      const normF = moveForward / Math.max(1, moveMag);
      const normR = moveRight / Math.max(1, moveMag);
      const baseSpeed = isSprinting ? 8.4 : s.isCrouching ? 2.8 : s.isScoped ? 2.4 : 5.2;

      // Forward in Three.js camera facing -Z rotated by yaw: (-sin(yaw), 0, -cos(yaw))
      const fx = -Math.sin(s.yaw);
      const fz = -Math.cos(s.yaw);
      const rx = Math.cos(s.yaw);
      const rz = -Math.sin(s.yaw);

      const nx = s.playerX + (fx * normF + rx * normR) * baseSpeed * realDt;
      const nz = s.playerZ + (fz * normF + rz * normR) * baseSpeed * realDt;

      const resolved = resolveHorizontalCollision(world, nx, nz, s.playerY, 0.5);
      s.playerX = resolved.x;
      s.playerZ = resolved.z;
      s.walkBobTime += realDt * (isSprinting ? 12 : 7);
    }

    const targetFloor = getSupportFloorHeight(world, s.playerX, s.playerZ, s.playerY);
    s.playerY = THREE.MathUtils.lerp(s.playerY, targetFloor, Math.min(1, realDt * 14));

    // Scope & Weapon Sway
    const postureMult = s.isCrouching ? 0.55 : 1.0;
    const breathMult = s.isHoldingBreath ? 0.06 : 1.0;
    const swayAmp =
      (s.isScoped ? 0.0048 : 0.0012) * stats.swayFactor * postureMult * breathMult;
    const swayX = Math.sin(s.elapsed * 1.65) * swayAmp + Math.cos(s.elapsed * 0.85) * swayAmp * 0.5;
    const swayY = Math.cos(s.elapsed * 1.25) * swayAmp * 0.85;

    // Camera Positioning & Smooth FOV Zoom Transition
    const eyeHeight = s.isCrouching ? 1.08 : 1.68;
    const shakeX = (Math.random() - 0.5) * 0.08 * s.shakeIntensity;
    const shakeY = (Math.random() - 0.5) * 0.08 * s.shakeIntensity;

    const finalYaw = s.yaw + s.recoilYaw + swayX;
    const finalPitch = s.pitch + s.recoilPitch + swayY;

    const perspCam = camera as THREE.PerspectiveCamera;
    if (s.killcamTimer > 0) {
      // Bullet-time follow camera zooming cleanly toward the struck target!
      const prog = 1 - s.killcamTimer / 0.95;
      const camPos = new THREE.Vector3(
        THREE.MathUtils.lerp(s.killcamOrigin[0], s.killcamTarget[0], prog * 0.78),
        THREE.MathUtils.lerp(s.killcamOrigin[1] + 0.35, s.killcamTarget[1] + 0.65, prog * 0.78),
        THREE.MathUtils.lerp(s.killcamOrigin[2], s.killcamTarget[2], prog * 0.78)
      );
      perspCam.position.copy(camPos);
      perspCam.lookAt(s.killcamTarget[0], s.killcamTarget[1] + 0.25, s.killcamTarget[2]);
      perspCam.fov = THREE.MathUtils.lerp(perspCam.fov, 36, 0.2);
      perspCam.updateProjectionMatrix();
    } else if (s.isThirdPerson && !s.isScoped && !s.isBinoculars) {
      // Over-the-shoulder Third-Person Tactical Camera
      const backX = Math.sin(finalYaw) * 2.8 + Math.cos(finalYaw) * 0.72;
      const backZ = Math.cos(finalYaw) * 2.8 - Math.sin(finalYaw) * 0.72;
      perspCam.position.set(
        s.playerX + backX + shakeX,
        s.playerY + eyeHeight + 0.48 - finalPitch * 1.1 + shakeY,
        s.playerZ + backZ
      );
      perspCam.rotation.order = 'YXZ';
      perspCam.rotation.set(finalPitch, finalYaw, 0);
      s.currentFov = THREE.MathUtils.lerp(s.currentFov, 68, Math.min(1, realDt * 12));
      perspCam.fov = s.currentFov;
      perspCam.updateProjectionMatrix();
    } else {
      // First-Person Sniper / Scoped Camera
      const bobY = moveMag > 0.05 && !s.isScoped ? Math.sin(s.walkBobTime) * 0.035 : 0;
      perspCam.position.set(
        s.playerX + shakeX,
        s.playerY + eyeHeight + bobY + shakeY,
        s.playerZ
      );
      perspCam.rotation.order = 'YXZ';
      perspCam.rotation.set(finalPitch, finalYaw, 0);

      const targetFov = s.isScoped ? 65 / zoomMag : s.isBinoculars ? 65 / 8.5 : 65;
      s.currentFov = THREE.MathUtils.lerp(
        s.currentFov,
        targetFov,
        Math.min(1, realDt / Math.max(0.06, stats.adsSpeed * 0.65))
      );
      perspCam.fov = s.currentFov;
      perspCam.updateProjectionMatrix();
    }

    // Position 1st-Person Procedural Rifle Viewmodel attached to camera
    if (viewmodelGroupRef.current) {
      const showVm = !s.isScoped && !s.isBinoculars && !s.isThirdPerson && s.killcamTimer <= 0;
      viewmodelGroupRef.current.visible = showVm;
      if (showVm) {
        viewmodelGroupRef.current.position.copy(perspCam.position);
        viewmodelGroupRef.current.quaternion.copy(perspCam.quaternion);
        viewmodelGroupRef.current.translateX(0.21);
        viewmodelGroupRef.current.translateY(-0.155 + Math.sin(s.walkBobTime) * 0.012);
        viewmodelGroupRef.current.translateZ(-0.58 + s.recoilPitch * 0.45);
        viewmodelGroupRef.current.rotateY(0.06);
      }
    }

    // Update 3rd-Person Player Character Rig
    if (playerRigRef.current) {
      playerRigRef.current.visible = s.isThirdPerson && !s.isScoped && !s.isBinoculars;
      playerRigRef.current.position.set(s.playerX, s.playerY, s.playerZ);
      playerRigRef.current.rotation.set(0, finalYaw + Math.PI, 0);
    }

    // Rangefinder & Binocular Auto-Tagging along crosshair ray
    const aimDir = new THREE.Vector3();
    perspCam.getWorldDirection(aimDir);
    let measuredDist = 220;
    const worldRayHit = castWorldSegment(
      world,
      perspCam.position.x,
      perspCam.position.y,
      perspCam.position.z,
      perspCam.position.x + aimDir.x * 320,
      perspCam.position.y + aimDir.y * 320,
      perspCam.position.z + aimDir.z * 320,
      false
    );
    if (worldRayHit) {
      measuredDist = Math.hypot(
        worldRayHit.point[0] - perspCam.position.x,
        worldRayHit.point[1] - perspCam.position.y,
        worldRayHit.point[2] - perspCam.position.z
      );
    }

    // Check enemy directly near sightline for exact laser rangefinding & Binocular marking
    for (const enemy of enemiesRef.current) {
      if (enemy.state === 'dead') continue;
      const toEx = enemy.x - perspCam.position.x;
      const toEy = enemy.y + 1.2 - perspCam.position.y;
      const toEz = enemy.z - perspCam.position.z;
      const d = Math.hypot(toEx, toEy, toEz);
      const dot = (toEx * aimDir.x + toEy * aimDir.y + toEz * aimDir.z) / Math.max(0.01, d);
      if (dot > 0.9965) {
        if (d < measuredDist + 3) {
          measuredDist = d;
        }
        if (s.isBinoculars && !enemy.tagged) {
          enemy.tagged = true;
          soundEngine.playUiTone('click');
        }
      }
    }
    s.rangefinderMeters = Math.round(measuredDist);

    // Update Trajectory Preview Line when Training Ammo OR Scoped Helper Active
    {
      const showArc =
        s.isScoped &&
        s.killcamTimer <= 0 &&
        Boolean(
          AMMO_TYPES[ammoType]?.showTrajectoryArc ||
            (settings.showTrajectoryHelper && s.isHoldingBreath)
        );
      trajectoryLineObj.visible = showArc;
      if (showArc) {
        const arcPts = generateTrajectoryArc(
          [
            perspCam.position.x + aimDir.x * 0.8 - 0.05,
            perspCam.position.y + aimDir.y * 0.8 - 0.08,
            perspCam.position.z + aimDir.z * 0.8,
          ],
          [aimDir.x, aimDir.y, aimDir.z],
          stats.muzzleVelocity,
          mission.windX,
          ammoType,
          Math.min(280, s.rangefinderMeters + 15),
          20
        );
        const posArr = new Float32Array(arcPts.length * 3);
        arcPts.forEach((pt, idx) => {
          posArr[idx * 3] = pt.x;
          posArr[idx * 3 + 1] = pt.y;
          posArr[idx * 3 + 2] = pt.z;
        });
        trajectoryLineObj.geometry.setAttribute(
          'position',
          new THREE.BufferAttribute(posArr, 3)
        );
      }
    }

    // Firing Sniper Rifle
    if (liveInput.fireRequested) {
      liveInput.fireRequested = false;
      if (
        !s.isBinoculars &&
        s.reloadTimer <= 0 &&
        s.fireTimer <= 0 &&
        s.ammoInMag > 0 &&
        s.killcamTimer <= 0
      ) {
        s.ammoInMag -= 1;
        s.shotsFired += 1;
        const cycleTime = 60 / stats.fireRateRpm;
        s.fireTimer = cycleTime;
        if (weapon.action === 'bolt') {
          s.boltCycleDuration = Math.min(0.85, cycleTime * 0.72);
          s.boltCycleTimer = s.boltCycleDuration;
          soundEngine.playBoltCycle(0.24);
        }

        s.muzzleFlash = 1.0;
        const kick = (stats.recoil / 100) * (s.isCrouching ? 0.042 : 0.068);
        s.recoilPitch += kick;
        s.recoilYaw += (Math.random() - 0.5) * kick * 0.35;
        s.shakeIntensity = Math.min(1.0, s.shakeIntensity + (stats.recoil / 100) * 0.45);

        soundEngine.playRifleShot(stats.isSuppressed, stats.damage >= 130);

        // Hipfire spread if unscoped; laser-accurate when scoped
        const hipSpread = s.isScoped ? 0.0004 : ((102 - stats.accuracy) / 100) * 0.032;
        const shotDir = new THREE.Vector3(
          aimDir.x + (Math.random() - 0.5) * hipSpread,
          aimDir.y + (Math.random() - 0.5) * hipSpread,
          aimDir.z + (Math.random() - 0.5) * hipSpread
        ).normalize();

        const speed = stats.muzzleVelocity * BALLISTIC_SPEED_SCALE;
        const ammoDef = AMMO_TYPES[ammoType] ?? AMMO_TYPES.standard;

        projectilesRef.current.push({
          id: s.nextProjId++,
          x: perspCam.position.x + shotDir.x * 0.6,
          y: perspCam.position.y + shotDir.y * 0.6,
          z: perspCam.position.z + shotDir.z * 0.6,
          prevX: perspCam.position.x,
          prevY: perspCam.position.y,
          prevZ: perspCam.position.z,
          originX: perspCam.position.x,
          originY: perspCam.position.y,
          originZ: perspCam.position.z,
          vx: shotDir.x * speed,
          vy: shotDir.y * speed,
          vz: shotDir.z * speed,
          windX: mission.windX,
          dropMultiplier: ammoDef.dropMultiplier,
          damage: stats.damage,
          effectiveRange: stats.effectiveRange,
          armorPenetration: stats.armorPenetration,
          fromPlayer: true,
          isKillcamCandidate: settings.enableKillcamReplay,
          age: 0,
        });

        // Alert enemies within gunshot acoustic radius
        notifyAcousticEvent(
          enemiesRef.current,
          [s.playerX, s.playerY, s.playerZ],
          stats.soundRadius,
          false
        );
      } else if (s.isBinoculars) {
        // Left-clicking in Binoculars marks targets immediately
        soundEngine.playUiTone('click');
      }
    }

    // Step Active Projectiles (with 3 sub-steps per frame so fast bullets never tunnel past targets!)
    const activeProjs = projectilesRef.current;
    for (let i = activeProjs.length - 1; i >= 0; i--) {
      const p = activeProjs[i];
      let removed = false;
      const subSteps = 3;
      const subDt = dt / subSteps;

      for (let step = 0; step < subSteps; step++) {
        stepProjectile(p, subDt);

        // Leave glowing supersonic bullet tracer segment
        tracersRef.current.push({
          id: s.nextProjId++,
          ax: p.prevX,
          ay: p.prevY,
          az: p.prevZ,
          bx: p.x,
          by: p.y,
          bz: p.z,
          color: weapon.visual.family === 'rail_prototype' ? '#22d3ee' : '#fef08a',
          life: 0.16,
        });

        // 1. Check Explosive Barrels
        for (const brl of world.barrels) {
          if (brl.exploded) continue;
          const bDist = Math.hypot(p.x - brl.x, p.z - brl.z);
          if (bDist <= 0.65 && p.y >= brl.y && p.y <= brl.y + 1.35) {
            brl.exploded = true;
            s.shotsHit += 1;
            spawnExplosionAt(brl.x, brl.y, brl.z, 11.5);
            forceSceneRefresh((n) => n + 1);
            removed = true;
            break;
          }
        }
        if (removed) break;

        // 2. Check World Solid Geometry / Terrain Hit
        const worldHit = castWorldSegment(
          world,
          p.prevX,
          p.prevY,
          p.prevZ,
          p.x,
          p.y,
          p.z,
          false
        );

        // 3. Check Enemy Hitboxes
        let bestEnemy: EnemyEntity | null = null;
        let bestHit: ReturnType<typeof intersectSegmentWithEnemy> = null;
        for (const enemy of enemiesRef.current) {
          const hit = intersectSegmentWithEnemy(p.prevX, p.prevY, p.prevZ, p.x, p.y, p.z, enemy);
          if (hit && (!bestHit || hit.t < bestHit.t)) {
            if (!worldHit || hit.t <= worldHit.t) {
              bestHit = hit;
              bestEnemy = enemy;
            }
          }
        }

        if (bestEnemy && bestHit) {
          const shotDist = Math.round(
            Math.hypot(
              bestHit.point[0] - p.originX,
              bestHit.point[1] - p.originY,
              bestHit.point[2] - p.originZ
            )
          );

          // Friendly fire check on Hostages -> immediate mission failure!
          if (bestEnemy.enemyClass === 'hostage') {
            bestEnemy.state = 'dead';
            s.ended = true;
            onMissionEnd({
              victory: false,
              failureReason: `Friendly casualty! ${bestEnemy.name} was struck by sniper fire.`,
              shotsFired: s.shotsFired,
              shotsHit: s.shotsHit,
              kills: s.kills,
              headshots: s.headshots,
              longestShot: s.longestShot,
              timeSeconds: s.elapsed,
              alarmsTriggered: s.alarmsTriggered,
              optionalCompletedCount: 0,
            });
            removed = true;
            break;
          }

          s.shotsHit += 1;
          const dmgResult = calculateImpactDamage({
            baseDamage: p.damage,
            distanceMeters: shotDist,
            effectiveRange: p.effectiveRange,
            armorPenetration: p.armorPenetration,
            hitRegion: bestHit.hitRegion,
            enemyClass: bestEnemy.enemyClass,
          });

          bestEnemy.hp -= dmgResult.finalDamage;
          bestEnemy.hitFlashTimer = 0.22;

          // Spawn blood/spark impact burst
          const isMetalTarget =
            bestEnemy.enemyClass === 'target_dummy' ||
            bestEnemy.enemyClass === 'sabotage_node' ||
            dmgResult.armorMitigated;
          for (let k = 0; k < 10; k++) {
            particlesRef.current.push({
              id: s.nextProjId++,
              x: bestHit.point[0],
              y: bestHit.point[1],
              z: bestHit.point[2],
              vx: (Math.random() - 0.5) * 7,
              vy: Math.random() * 5,
              vz: (Math.random() - 0.5) * 7,
              color: isMetalTarget ? '#fde047' : '#ef4444',
              size: 0.14 + Math.random() * 0.14,
              life: 0.45,
              maxLife: 0.45,
            });
          }

          // Multi-Stage Boss Relocation Check
          if (
            bestEnemy.isBoss &&
            bestEnemy.hp > 0 &&
            bestEnemy.bossStagePositions.length > bestEnemy.bossStage
          ) {
            const nextThreshold =
              bestEnemy.maxHp *
              (1 - (bestEnemy.bossStage + 1) / (bestEnemy.bossStagePositions.length + 1));
            if (bestEnemy.hp <= nextThreshold) {
              const nextSpot = bestEnemy.bossStagePositions[bestEnemy.bossStage];
              smokesRef.current.push({
                x: bestEnemy.x,
                y: bestEnemy.y + 1,
                z: bestEnemy.z,
                radius: 5.5,
                remaining: 9,
              });
              bestEnemy.bossStage += 1;
              bestEnemy.x = nextSpot[0];
              bestEnemy.z = nextSpot[2];
              bestEnemy.y = Math.max(
                nextSpot[1],
                getSupportFloorHeight(world, nextSpot[0], nextSpot[2], nextSpot[1] + 1)
              );
              bestEnemy.patrolPoints = [[bestEnemy.x, bestEnemy.y, bestEnemy.z]];
              s.killFeed = [
                {
                  id: s.nextProjId++,
                  text: `${bestEnemy.name} RELOCATING!`,
                  subtext: `STAGE ${bestEnemy.bossStage + 1} VANTAGE`,
                  isHeadshot: false,
                  distance: shotDist,
                  timestamp: Date.now(),
                },
                ...s.killFeed.slice(0, 4),
              ];
            }
          }

          if (bestEnemy.hp <= 0) {
            bestEnemy.hp = 0;
            bestEnemy.state = 'dead';
            s.kills += 1;
            s.comboCount += 1;
            if (dmgResult.isHeadshot) s.headshots += 1;
            if (bestEnemy.isPriorityTarget) s.priorityKills += 1;
            if (bestEnemy.enemyClass === 'sabotage_node') {
              s.sabotageCount += 1;
              spawnExplosionAt(bestEnemy.x, bestEnemy.y + 1, bestEnemy.z, 6);
            }
            if (shotDist >= 170) s.longshotCount += 1;
            s.longestShot = Math.max(s.longestShot, shotDist);

            const pts =
              (dmgResult.isHeadshot ? 450 : 250) +
              Math.round(shotDist * 1.5) +
              (bestEnemy.isPriorityTarget ? 500 : 0);
            s.score += pts;

            s.hitMarker = {
              type: dmgResult.isHeadshot ? 'headshot' : 'kill',
              timestamp: Date.now(),
            };
            soundEngine.playHitMarker(dmgResult.isHeadshot, false);

            s.killFeed = [
              {
                id: s.nextProjId++,
                text: `${dmgResult.isHeadshot ? 'HEADSHOT // ' : 'ELIMINATED // '}${bestEnemy.name}`,
                subtext: `${shotDist}m • +${pts} PTS`,
                isHeadshot: dmgResult.isHeadshot,
                distance: shotDist,
                timestamp: Date.now(),
              },
              ...s.killFeed.slice(0, 4),
            ];

            // Trigger cinematic bullet-time killcam on long headshots or priority targets!
            if (
              p.isKillcamCandidate &&
              bestEnemy.enemyClass !== 'target_dummy' &&
              (bestEnemy.isPriorityTarget || (dmgResult.isHeadshot && shotDist >= 85))
            ) {
              s.killcamTimer = 0.95;
              s.killcamOrigin = [p.originX, p.originY, p.originZ];
              s.killcamTarget = [bestHit.point[0], bestHit.point[1], bestHit.point[2]];
              s.killcamDistance = shotDist;
            }
          } else {
            // Non-lethal hit reaction
            bestEnemy.suspicion = 100;
            bestEnemy.state = 'engaging';
            bestEnemy.stateTimer = 14;
            bestEnemy.investigateTarget = [s.playerX, s.playerY, s.playerZ];
            s.hitMarker = {
              type: dmgResult.armorMitigated ? 'armor' : 'normal',
              timestamp: Date.now(),
            };
            soundEngine.playHitMarker(false, dmgResult.armorMitigated);
          }

          notifyBulletImpactNearEnemies(
            enemiesRef.current,
            bestHit.point,
            [s.playerX, s.playerY, s.playerZ]
          );
          removed = true;
          break;
        }

        if (worldHit) {
          for (let k = 0; k < 7; k++) {
            particlesRef.current.push({
              id: s.nextProjId++,
              x: worldHit.point[0],
              y: worldHit.point[1],
              z: worldHit.point[2],
              vx: (Math.random() - 0.5) * 6,
              vy: Math.random() * 4.5,
              vz: (Math.random() - 0.5) * 6,
              color: worldHit.material === 'metal' ? '#fde047' : '#d6d3d1',
              size: 0.13,
              life: 0.4,
              maxLife: 0.4,
            });
          }
          notifyBulletImpactNearEnemies(
            enemiesRef.current,
            worldHit.point,
            [s.playerX, s.playerY, s.playerZ]
          );
          removed = true;
          break;
        }

        if (p.age > 3.5) {
          removed = true;
          break;
        }
      }

      if (removed) {
        activeProjs.splice(i, 1);
      }
    }

    // Update Smokes, Decoys, Sensors, Particles, Tracers
    for (let i = smokesRef.current.length - 1; i >= 0; i--) {
      smokesRef.current[i].remaining -= dt;
      if (smokesRef.current[i].remaining <= 0) smokesRef.current.splice(i, 1);
    }
    for (let i = sensorsRef.current.length - 1; i >= 0; i--) {
      sensorsRef.current[i].remaining -= dt;
      if (sensorsRef.current[i].remaining <= 0) sensorsRef.current.splice(i, 1);
    }
    for (let i = decoysRef.current.length - 1; i >= 0; i--) {
      const dec = decoysRef.current[i];
      dec.remaining -= dt;
      dec.pulseTimer -= dt;
      if (dec.pulseTimer <= 0) {
        dec.pulseTimer = 2.5;
        notifyAcousticEvent(enemiesRef.current, [dec.x, dec.y, dec.z], 45, true);
      }
      if (dec.remaining <= 0) decoysRef.current.splice(i, 1);
    }
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const pt = particlesRef.current[i];
      pt.vy -= 9.8 * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.z += pt.vz * dt;
      pt.life -= realDt;
      if (pt.life <= 0) particlesRef.current.splice(i, 1);
    }
    for (let i = tracersRef.current.length - 1; i >= 0; i--) {
      tracersRef.current[i].life -= realDt;
      if (tracersRef.current[i].life <= 0) tracersRef.current.splice(i, 1);
    }

    // Update AI State Machines
    const aiSummary = updateEnemiesAI(
      enemiesRef.current,
      dt,
      [s.playerX, s.playerY, s.playerZ],
      s.isCrouching,
      world,
      smokesRef.current,
      sensorsRef.current,
      {
        onAlarmRaised: () => {
          s.alarmsTriggered += 1;
          soundEngine.playUiTone('alert');
          if (mission.failOnAlarm) {
            s.ended = true;
            onMissionEnd({
              victory: false,
              failureReason: 'Covert Directive Violated — Hostile Combat Alarm Triggered!',
              shotsFired: s.shotsFired,
              shotsHit: s.shotsHit,
              kills: s.kills,
              headshots: s.headshots,
              longestShot: s.longestShot,
              timeSeconds: s.elapsed,
              alarmsTriggered: s.alarmsTriggered,
              optionalCompletedCount: 0,
            });
          }
        },
        onSpawnReinforcements: (commander) => {
          const reinforcementSpecs = [
            createEnemyFromSpec(
              {
                id: `qrf_${Date.now()}_a`,
                enemyClass: 'reinforcement',
                name: 'QRF Shock Trooper',
                position: [commander.x - 4, commander.y, commander.z + 4],
                patrolPoints: [[s.playerX * 0.3, 0, -20]],
              },
              world
            ),
            createEnemyFromSpec(
              {
                id: `qrf_${Date.now()}_b`,
                enemyClass: 'scout',
                name: 'QRF Flanker',
                position: [commander.x + 4, commander.y, commander.z + 4],
                patrolPoints: [[s.playerX * 0.3, 0, -15]],
              },
              world
            ),
          ];
          reinforcementSpecs.forEach((u) => {
            u.state = 'alerted';
            u.suspicion = 80;
            u.hasCalledReinforcements = true;
            u.investigateTarget = [s.playerX, s.playerY, s.playerZ];
            u.stateTimer = 14;
            enemiesRef.current.push(u);
          });
          s.killFeed = [
            {
              id: s.nextProjId++,
              text: 'REINFORCEMENTS DEPLOYED!',
              subtext: `${commander.name} radioed QRF`,
              isHeadshot: false,
              distance: 0,
              timestamp: Date.now(),
            },
            ...s.killFeed.slice(0, 4),
          ];
          forceSceneRefresh((n) => n + 1);
        },
        onEnemyFire: (enemy, dmg, isSniperShot) => {
          soundEngine.playEnemyShot(isSniperShot);
          // Hit probability reduced when player is crouching or moving
          const hitChance = isSniperShot ? 0.82 : s.isCrouching ? 0.38 : 0.58;
          if (Math.random() < hitChance) {
            s.health -= dmg;
            s.damageFlashTime = 0.42;
            s.shakeIntensity = Math.min(1.0, s.shakeIntensity + (isSniperShot ? 0.5 : 0.22));
            s.damageDirectionRad = Math.atan2(enemy.x - s.playerX, enemy.z - s.playerZ) - s.yaw;
            if (s.health <= 0 && !s.ended) {
              s.health = 0;
              s.ended = true;
              onMissionEnd({
                victory: false,
                failureReason: `KIA — Neutralized by ${enemy.name}.`,
                shotsFired: s.shotsFired,
                shotsHit: s.shotsHit,
                kills: s.kills,
                headshots: s.headshots,
                longestShot: s.longestShot,
                timeSeconds: s.elapsed,
                alarmsTriggered: s.alarmsTriggered,
                optionalCompletedCount: 0,
              });
            }
          }
        },
      }
    );

    // Check Intel Interaction (E key or auto-pickup within 2.6m!)
    let interactionPrompt: string | null = null;
    for (const intel of intelRef.current) {
      if (intel.collected) continue;
      const dist = Math.hypot(s.playerX - intel.x, s.playerZ - intel.z);
      if (dist <= 4.0) {
        interactionPrompt = 'Press [E] or tap Interact to Secure Encrypted Intel';
        if (liveInput.interactRequested || dist <= 2.1) {
          liveInput.interactRequested = false;
          intel.collected = true;
          s.intelCollected += 1;
          s.score += 600;
          soundEngine.playUiTone('objective');
          forceSceneRefresh((n) => n + 1);
        }
      }
    }
    liveInput.interactRequested = false;

    // Wave Survival Spawning Check
    if (s.totalWaves > 1) {
      const livingHostiles = enemiesRef.current.filter(
        (e) =>
          e.state !== 'dead' &&
          e.enemyClass !== 'hostage' &&
          e.enemyClass !== 'target_dummy' &&
          e.enemyClass !== 'sabotage_node'
      );
      if (livingHostiles.length === 0 && s.currentWave < s.totalWaves) {
        s.currentWave += 1;
        s.reserveAmmo += stats.magSize * 2;
        s.health = Math.min(s.maxHealth, s.health + 35);
        soundEngine.playUiTone('objective');

        const waveCount = 3 + s.currentWave;
        for (let w = 0; w < waveCount; w++) {
          const sx = (w % 2 === 0 ? -1 : 1) * (8 + w * 6);
          const sz = -25 - w * 22;
          const cls =
            w === waveCount - 1
              ? 'counter_sniper'
              : w % 2 === 0
              ? 'armored'
              : 'scout';
          const unit = createEnemyFromSpec(
            {
              id: `wave_${s.currentWave}_${w}`,
              enemyClass: cls,
              name: `Wave ${s.currentWave} ${cls.replace('_', ' ').toUpperCase()}`,
              position: [sx, 0, sz],
              patrolPoints: [[sx * 0.4, 0, sz + 25]],
            },
            world
          );
          unit.state = 'alerted';
          unit.suspicion = 85;
          unit.investigateTarget = [s.playerX, s.playerY, s.playerZ];
          unit.stateTimer = 20;
          enemiesRef.current.push(unit);
        }
        forceSceneRefresh((n) => n + 1);
      }
    }

    // Evaluate Mission Timer Failure
    const remainingSeconds =
      mission.timeLimitSeconds !== undefined
        ? Math.max(0, mission.timeLimitSeconds - s.elapsed)
        : null;
    if (remainingSeconds !== null && remainingSeconds <= 0 && !s.ended) {
      s.ended = true;
      onMissionEnd({
        victory: false,
        failureReason: 'Deadline Expired — Mission timer reached zero.',
        shotsFired: s.shotsFired,
        shotsHit: s.shotsHit,
        kills: s.kills,
        headshots: s.headshots,
        longestShot: s.longestShot,
        timeSeconds: s.elapsed,
        alarmsTriggered: s.alarmsTriggered,
        optionalCompletedCount: 0,
      });
      return;
    }

    // Evaluate Objectives Progress & Extraction
    const nonExtractionObjectives = mission.objectives.filter(
      (o) => !o.optional && o.type !== 'reach_extraction'
    );

    const computeObjCurrent = (obj: (typeof mission.objectives)[number]): number => {
      switch (obj.type) {
        case 'eliminate_all':
        case 'hit_targets':
          return s.kills;
        case 'eliminate_priority':
          return s.priorityKills;
        case 'sabotage':
          return s.sabotageCount;
        case 'collect_intel':
          return s.intelCollected;
        case 'protect_hostages':
          return enemiesRef.current.filter(
            (e) => e.enemyClass === 'hostage' && e.state !== 'dead'
          ).length;
        case 'survive_waves': {
          const anyAlive = enemiesRef.current.some(
            (e) =>
              e.state !== 'dead' &&
              e.enemyClass !== 'hostage' &&
              e.enemyClass !== 'target_dummy' &&
              e.enemyClass !== 'sabotage_node'
          );
          return s.currentWave >= s.totalWaves && !anyAlive
            ? s.totalWaves
            : Math.max(0, s.currentWave - 1);
        }
        case 'no_alarms':
          return s.alarmsTriggered === 0 ? 1 : 0;
        case 'headshot_count':
          return s.headshots;
        case 'longshot_hit':
          return s.longshotCount;
        case 'reach_extraction':
          return s.reachedExtraction ? 1 : 0;
        default:
          return 0;
      }
    };

    const allPreExtractionDone = nonExtractionObjectives.every((o) => {
      if (o.type === 'no_alarms' || o.type === 'protect_hostages') {
        return computeObjCurrent(o) >= o.targetCount;
      }
      return computeObjCurrent(o) >= o.targetCount;
    });

    if (mission.requireExtraction && allPreExtractionDone) {
      const dExt = Math.hypot(
        s.playerX - mission.extractionPoint[0],
        s.playerZ - mission.extractionPoint[2]
      );
      if (dExt <= 4.5) {
        s.reachedExtraction = true;
      } else if (!interactionPrompt && dExt <= 12) {
        interactionPrompt = 'Step into Green Extraction Ring to Complete Mission';
      }
    }

    const activeProgress: ActiveObjectiveProgress[] = mission.objectives.map((o) => {
      const cur = computeObjCurrent(o);
      return {
        id: o.id,
        title: o.title,
        current: Math.min(o.targetCount, cur),
        target: o.targetCount,
        completed: cur >= o.targetCount,
        failed: o.type === 'no_alarms' && s.alarmsTriggered > 0,
        optional: o.optional,
      };
    });

    const primaryObjectives = activeProgress.filter((o) => !o.optional);
    // Check if primary objectives complete (ignoring passive protect_hostages / no_alarms until active goals finish)
    const activeGoals = mission.objectives.filter(
      (o) => !o.optional && o.type !== 'protect_hostages' && o.type !== 'no_alarms'
    );
    const activeGoalsDone =
      activeGoals.length > 0 &&
      activeGoals.every((g) => computeObjCurrent(g) >= g.targetCount) &&
      primaryObjectives.every((pObj) => pObj.completed);

    if (activeGoalsDone && s.killcamTimer <= 0 && !s.ended) {
      s.ended = true;
      soundEngine.playUiTone('objective');
      const optCount = activeProgress.filter((o) => o.optional && o.completed).length;
      onMissionEnd({
        victory: true,
        shotsFired: s.shotsFired,
        shotsHit: s.shotsHit,
        kills: s.kills,
        headshots: s.headshots,
        longestShot: s.longestShot,
        timeSeconds: s.elapsed,
        alarmsTriggered: s.alarmsTriggered,
        optionalCompletedCount: optCount,
      });
      return;
    }

    // Throttle React HUD Snapshot updates to ~18 Hz
    s.hudSyncTimer -= realDt;
    if (s.hudSyncTimer <= 0) {
      s.hudSyncTimer = 0.055;

      const ballisticCalc = calculateBallisticOffset(
        s.rangefinderMeters,
        stats.muzzleVelocity,
        mission.windX,
        ammoType
      );
      // Angular mils (~ meters / (dist / 1000))
      const distKm = Math.max(0.02, s.rangefinderMeters / 1000);
      const dropMils = ballisticCalc.dropMeters / distKm;
      const windMils = ballisticCalc.windDriftMeters / distKm;

      const blips: MinimapBlip[] = [];
      for (const e of enemiesRef.current) {
        if (e.state === 'dead') continue;
        const visibleOnRadar =
          e.tagged ||
          s.pulseRevealTimer > 0 ||
          e.enemyClass === 'hostage' ||
          e.enemyClass === 'sabotage_node' ||
          e.state === 'engaging';
        if (visibleOnRadar) {
          blips.push({
            id: e.id,
            x: e.x,
            z: e.z,
            type:
              e.enemyClass === 'hostage'
                ? 'hostage'
                : e.enemyClass === 'sabotage_node'
                ? 'sabotage'
                : e.isPriorityTarget
                ? 'priority'
                : 'enemy',
            alertState: e.state,
            tagged: e.tagged,
          });
        }
      }
      for (const intel of intelRef.current) {
        if (!intel.collected) {
          blips.push({ id: intel.id, x: intel.x, z: intel.z, type: 'intel', tagged: true });
        }
      }
      if (mission.requireExtraction) {
        blips.push({
          id: 'extraction',
          x: mission.extractionPoint[0],
          z: mission.extractionPoint[2],
          type: 'extraction',
          tagged: true,
        });
      }

      const activeBoss = enemiesRef.current.find((e) => e.isBoss && e.state !== 'dead');

      onHudUpdate({
        health: Math.round(s.health),
        maxHealth: s.maxHealth,
        stamina: Math.round(s.stamina),
        isHoldingBreath: s.isHoldingBreath,
        isScoped: s.isScoped,
        isBinoculars: s.isBinoculars,
        isThirdPerson: s.isThirdPerson,
        isCrouching: s.isCrouching,
        isReloading: s.reloadTimer > 0,
        isCyclingBolt: s.boltCycleTimer > 0,
        currentZoom: zoomMag,
        opticType: stats.opticType,
        reticleStyle: stats.reticleStyle,
        ammoInMag: s.ammoInMag,
        magSize: stats.magSize,
        reserveAmmo: s.reserveAmmo,
        currentAmmoType: ammoType,
        weaponName: weapon.name,
        isSuppressed: stats.isSuppressed,
        windX: mission.windX,
        rangefinderMeters: s.rangefinderMeters,
        dropCompensationMils: Number(dropMils.toFixed(2)),
        windDriftMils: Number(windMils.toFixed(2)),
        globalAlertLevel: aiSummary.maxAlertLevel,
        alertStatusLabel: aiSummary.statusLabel,
        playerX: s.playerX,
        playerZ: s.playerZ,
        playerYaw: s.yaw,
        elapsedSeconds: s.elapsed,
        remainingSeconds,
        currentWave: s.currentWave,
        totalWaves: s.totalWaves,
        score: s.score,
        comboCount: s.comboCount,
        shotsFired: s.shotsFired,
        shotsHit: s.shotsHit,
        kills: s.kills,
        headshots: s.headshots,
        longestShot: s.longestShot,
        alarmsTriggered: s.alarmsTriggered,
        interactionPrompt,
        equipmentCharges: { ...s.equipmentCharges },
        equipmentCooldowns: { ...s.equipmentCooldowns },
        activeEquipmentSlots: equippedSlots,
        objectives: activeProgress,
        killFeed: s.killFeed,
        hitMarker: s.hitMarker,
        damageDirectionRad: s.damageDirectionRad,
        damageFlashTime: s.damageFlashTime,
        killcamActive: s.killcamTimer > 0,
        killcamDistance: s.killcamDistance,
        tacticalMapOpen: liveInput.tacticalMapHeld,
        minimapBlips: blips,
        bossBar: activeBoss
          ? {
              name: activeBoss.name,
              hp: Math.max(0, activeBoss.hp),
              maxHp: activeBoss.maxHp,
              stageText:
                activeBoss.bossStagePositions.length > 0
                  ? `STAGE ${activeBoss.bossStage + 1}/${activeBoss.bossStagePositions.length + 1}`
                  : 'ELITE HVT',
            }
          : null,
      });
    }
  });

  // Procedural Terrain Geometry with Vertex Colors matching Biome Heightfield
  const terrainGeometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(240, 360, 84, 120);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, -65);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cPrim = new THREE.Color(world.palette.groundPrimary);
    const cSec = new THREE.Color(world.palette.groundSecondary);
    const temp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const vy = getTerrainHeight(world.biome, vx, vz);
      pos.setY(i, vy);

      const mix = Math.min(1, Math.max(0, (vy / 9) * 0.7 + (Math.abs(vx) < 16 ? 0.35 : 0)));
      temp.copy(cPrim).lerp(cSec, mix);
      colors[i * 3] = temp.r;
      colors[i * 3 + 1] = temp.g;
      colors[i * 3 + 2] = temp.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [world]);

  const s = simRef.current;
  const boltProg =
    s.boltCycleTimer > 0 ? 1 - s.boltCycleTimer / Math.max(0.1, s.boltCycleDuration) : 0;
  const reloadProg =
    s.reloadTimer > 0 ? 1 - s.reloadTimer / Math.max(0.2, stats.reloadTime) : 0;

  const isThermal = s.isScoped && stats.opticType === 'thermal';

  return (
    <>
      {/* Terrain Mesh */}
      <mesh geometry={terrainGeometry} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.92} metalness={0.05} />
      </mesh>

      {/* Distant Horizon Mountain Peaks for Cinematic Depth */}
      {[-120, -65, -10, 48, 110].map((mx, i) => (
        <mesh key={`peak_${i}`} position={[mx, 22 + (i % 3) * 8, -238]}>
          <coneGeometry args={[52 + (i % 2) * 14, 58 + (i % 3) * 18, 6]} />
          <meshStandardMaterial
            color={world.biome === 'desert_base' ? '#9c7c54' : '#334155'}
            roughness={0.95}
          />
        </mesh>
      ))}

      {/* Modular Buildings, Towers, Parapets, Containers, Cover */}
      {world.boxes.map((b) => {
        const w = b.maxX - b.minX;
        const h = b.maxY - b.minY;
        const d = b.maxZ - b.minZ;
        return (
          <mesh
            key={b.id}
            position={[(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2]}
            castShadow={settings.graphicsQuality !== 'low'}
            receiveShadow
          >
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial
              color={isThermal ? '#1e293b' : b.color}
              roughness={b.materialType === 'metal' ? 0.42 : 0.85}
              metalness={b.materialType === 'metal' ? 0.55 : 0.08}
            />
          </mesh>
        );
      })}

      {/* Climbable Tactical Access Ramps */}
      {world.ramps.map((r) => {
        const rise = r.yTop - r.yBottom;
        const hyp = Math.hypot(r.length, rise);
        const pitch = Math.atan2(rise, r.length);
        return (
          <mesh
            key={r.id}
            position={[r.x, (r.yBottom + r.yTop) / 2 - 0.1, r.z]}
            rotation={[r.dir === 'north' ? pitch : -pitch, 0, 0]}
            receiveShadow
          >
            <boxGeometry args={[r.width, 0.25, hyp]} />
            <meshStandardMaterial color={r.color} metalness={0.4} roughness={0.65} />
          </mesh>
        );
      })}

      {/* Foliage / Trees */}
      {world.trees.map((t, idx) => (
        <group key={`tree_${idx}`} position={[t.x, t.y, t.z]} scale={t.scale} rotation={[0, t.rotY, 0]}>
          <mesh position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.22, 0.34, 2.4, 6]} />
            <meshStandardMaterial color="#3f2e22" roughness={0.9} />
          </mesh>
          <mesh position={[0, 3.6, 0]} castShadow={settings.graphicsQuality === 'high'}>
            <coneGeometry args={[1.85, 4.4, 7]} />
            <meshStandardMaterial color={isThermal ? '#0f172a' : t.color} roughness={0.85} />
          </mesh>
        </group>
      ))}

      {/* Boulders / Rocks */}
      {world.rocks.map((rk, idx) => (
        <mesh
          key={`rock_${idx}`}
          position={[rk.x, rk.y + rk.scale[1] * 0.35, rk.z]}
          scale={rk.scale}
          rotation={[0, rk.rotY, 0]}
          castShadow={settings.graphicsQuality === 'high'}
        >
          <dodecahedronGeometry args={[0.9, 0]} />
          <meshStandardMaterial color={isThermal ? '#1e293b' : rk.color} roughness={0.9} />
        </mesh>
      ))}

      {/* Range Distance Marker Boards */}
      {world.signs.map((sg) => (
        <group key={sg.distanceLabel} position={[sg.x, sg.y, sg.z]}>
          <mesh position={[0, 1.1, 0]}>
            <boxGeometry args={[0.16, 2.2, 0.16]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[0, 2.1, 0]}>
            <boxGeometry args={[2.2, 0.9, 0.14]} />
            <meshStandardMaterial color="#f59e0b" emissive="#b45309" emissiveIntensity={0.45} />
          </mesh>
        </group>
      ))}

      {/* Destructible Red Fuel Barrels */}
      {world.barrels.map((brl) =>
        brl.exploded ? null : (
          <group key={brl.id} position={[brl.x, brl.y, brl.z]}>
            <mesh position={[0, 0.62, 0]} castShadow>
              <cylinderGeometry args={[0.44, 0.44, 1.24, 14]} />
              <meshStandardMaterial
                color="#dc2626"
                emissive={isThermal ? '#f97316' : '#7f1d1d'}
                emissiveIntensity={isThermal ? 1.1 : 0.25}
                metalness={0.45}
                roughness={0.4}
              />
            </mesh>
            <mesh position={[0, 0.62, 0]}>
              <cylinderGeometry args={[0.455, 0.455, 0.22, 14]} />
              <meshStandardMaterial color="#facc15" />
            </mesh>
          </group>
        )
      )}

      {/* Collectible Encrypted Intel Cases */}
      {intelRef.current.map((intel) =>
        intel.collected ? null : (
          <group key={intel.id} position={[intel.x, intel.y, intel.z]}>
            <mesh position={[0, 0.22, 0]}>
              <boxGeometry args={[0.75, 0.42, 0.55]} />
              <meshStandardMaterial color="#0284c7" emissive="#0ea5e9" emissiveIntensity={1.1} />
            </mesh>
            <pointLight position={[0, 0.8, 0]} color="#38bdf8" intensity={2.2} distance={8} />
          </group>
        )
      )}

      {/* Green Overwatch Extraction Beacon Ring */}
      {mission.requireExtraction && (
        <group
          position={[
            mission.extractionPoint[0],
            getSupportFloorHeight(
              world,
              mission.extractionPoint[0],
              mission.extractionPoint[2],
              mission.extractionPoint[1] + 2
            ),
            mission.extractionPoint[2],
          ]}
        >
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
            <ringGeometry args={[2.6, 3.2, 32]} />
            <meshBasicMaterial color="#10b981" side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 3.5, 0]}>
            <cylinderGeometry args={[2.8, 2.8, 7, 20, 1, true]} />
            <meshBasicMaterial
              color="#10b981"
              transparent
              opacity={0.14}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}

      {/* Active Smoke Screens, Decoys & Sensors */}
      {smokesRef.current.map((sm, idx) => (
        <mesh key={`smoke_${idx}`} position={[sm.x, sm.y + 1.2, sm.z]}>
          <sphereGeometry args={[sm.radius * 0.72, 14, 14]} />
          <meshStandardMaterial color="#94a3b8" transparent opacity={0.62} roughness={1} />
        </mesh>
      ))}
      {decoysRef.current.map((dc, idx) => (
        <mesh key={`decoy_${idx}`} position={[dc.x, dc.y + 0.25, dc.z]}>
          <octahedronGeometry args={[0.3, 0]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
      ))}
      {sensorsRef.current.map((sn, idx) => (
        <mesh key={`sens_${idx}`} position={[sn.x, sn.y + 0.2, sn.z]}>
          <cylinderGeometry args={[0.25, 0.3, 0.3, 10]} />
          <meshBasicMaterial color="#22d3ee" />
        </mesh>
      ))}

      {/* Articulated Enemy & Target Rigs */}
      {enemiesRef.current.map((enemy) => (
        <EnemyCharacterMesh
          key={enemy.id}
          enemy={enemy}
          thermalActive={isThermal}
        />
      ))}

      {/* Dynamic Bullet Tracers */}
      <BulletEffectsLayer tracersRef={tracersRef} particlesRef={particlesRef} />

      {/* Atmospheric Weather Particles (Snow / Rain / Dust) */}
      {mission.weather !== 'clear' && mission.weather !== 'fog' && (
        <WeatherParticles weather={mission.weather} quality={settings.graphicsQuality} />
      )}

      {/* Optional Scoped Ballistic Trajectory Preview Line */}
      <primitive object={trajectoryLineObj} />

      {/* 3rd-Person Articulated Player Character Model */}
      <group ref={playerRigRef} visible={false}>
        <mesh position={[-0.14, 0.44, 0]}>
          <boxGeometry args={[0.19, 0.88, 0.22]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        <mesh position={[0.14, 0.44, 0]}>
          <boxGeometry args={[0.19, 0.88, 0.22]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        <mesh position={[0, 1.16, 0]}>
          <boxGeometry args={[0.52, 0.58, 0.3]} />
          <meshStandardMaterial color="#364935" />
        </mesh>
        <mesh position={[0, 1.62, 0]}>
          <sphereGeometry args={[0.22, 12, 12]} />
          <meshStandardMaterial color="#272e25" />
        </mesh>
        <group position={[0.22, 1.26, 0.32]} rotation={[0, Math.PI, 0]} scale={0.75}>
          <ProceduralRifle weapon={weapon} loadout={loadout} />
        </group>
      </group>

      {/* 1st-Person Procedural Sniper Rifle Viewmodel */}
      <group ref={viewmodelGroupRef}>
        <ProceduralRifle
          weapon={weapon}
          loadout={loadout}
          boltCycleProgress={boltProg}
          reloadProgress={reloadProg}
          muzzleFlashIntensity={s.muzzleFlash}
          scale={0.85}
        />
      </group>
    </>
  );
};

const BulletEffectsLayer: React.FC<{
  tracersRef: React.MutableRefObject<BulletTracer[]>;
  particlesRef: React.MutableRefObject<ParticleBurst[]>;
}> = ({ tracersRef, particlesRef }) => {
  const [, setTick] = useState(0);
  useFrame(() => {
    if (tracersRef.current.length > 0 || particlesRef.current.length > 0) {
      setTick((t) => (t + 1) % 10000);
    }
  });

  return (
    <>
      {tracersRef.current.map((tr) => {
        const midX = (tr.ax + tr.bx) / 2;
        const midY = (tr.ay + tr.by) / 2;
        const midZ = (tr.az + tr.bz) / 2;
        const len = Math.max(0.2, Math.hypot(tr.bx - tr.ax, tr.by - tr.ay, tr.bz - tr.az));
        const dir = new THREE.Vector3(tr.bx - tr.ax, tr.by - tr.ay, tr.bz - tr.az).normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        return (
          <mesh key={tr.id} position={[midX, midY, midZ]} quaternion={quat}>
            <cylinderGeometry args={[0.028, 0.028, len, 6]} />
            <meshBasicMaterial color={tr.color} transparent opacity={Math.min(1, tr.life * 6)} />
          </mesh>
        );
      })}
      {particlesRef.current.map((p) => (
        <mesh key={p.id} position={[p.x, p.y, p.z]}>
          <boxGeometry args={[p.size, p.size, p.size]} />
          <meshBasicMaterial
            color={p.color}
            transparent
            opacity={Math.max(0, p.life / p.maxLife)}
          />
        </mesh>
      ))}
    </>
  );
};

const WeatherParticles: React.FC<{
  weather: 'dust' | 'rain' | 'snow';
  quality: GameSettings['graphicsQuality'];
}> = ({ weather, quality }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const count = quality === 'low' ? 180 : quality === 'medium' ? 380 : 650;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 140;
      arr[i * 3 + 1] = Math.random() * 36;
      arr[i * 3 + 2] = 85 - Math.random() * 250;
    }
    return arr;
  }, [count]);

  useFrame((_, dt) => {
    if (!pointsRef.current) return;
    const pos = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const fallSpeed = weather === 'rain' ? 28 : weather === 'snow' ? 4.5 : 1.6;
    const driftSpeed = weather === 'dust' ? 8.5 : 2.2;

    for (let i = 0; i < count; i++) {
      let y = pos.getY(i) - fallSpeed * dt;
      let x = pos.getX(i) + driftSpeed * dt;
      if (y < 0) y = 35;
      if (x > 70) x = -70;
      pos.setY(i, y);
      pos.setX(i, x);
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={weather === 'rain' ? 0.16 : weather === 'snow' ? 0.3 : 0.24}
        color={weather === 'rain' ? '#93c5fd' : weather === 'snow' ? '#ffffff' : '#fcd34d'}
        transparent
        opacity={weather === 'dust' ? 0.45 : 0.72}
      />
    </points>
  );
};

export interface LevelSceneContainerProps {
  mission: MissionDefinition;
  weaponId: string;
  loadout: WeaponLoadoutConfig;
  ammoType: AmmoType;
  equippedSlots: [EquipmentId, EquipmentId];
  settings: GameSettings;
  paused: boolean;
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onMissionEnd: (payload: MissionEndPayload) => void;
}

export const LevelScene: React.FC<LevelSceneContainerProps> = ({
  mission,
  weaponId,
  loadout,
  ammoType,
  equippedSlots,
  settings,
  paused,
  onHudUpdate,
  onMissionEnd,
}) => {
  const world = useMemo(
    () => buildWorldForBiome(mission.biome, mission.campaignIndex ?? 1),
    [mission.biome, mission.campaignIndex]
  );

  const [visionMode, setVisionMode] = useState<{ thermal: boolean; lowlight: boolean }>({
    thermal: false,
    lowlight: false,
  });

  const isNight = mission.timeOfDay === 'night';
  const isDawn = mission.timeOfDay === 'dawn';
  const isDusk = mission.timeOfDay === 'dusk';

  const bgSky = visionMode.thermal
    ? '#090d16'
    : visionMode.lowlight
    ? '#062819'
    : isNight
    ? '#132036'
    : isDawn
    ? '#7a9ab2'
    : isDusk
    ? '#5c4b68'
    : world.palette.skyHorizon;

  const ambientInt = visionMode.lowlight
    ? 2.1
    : visionMode.thermal
    ? 0.55
    : isNight
    ? 0.62
    : world.palette.ambientIntensity;

  const sunInt = visionMode.lowlight
    ? 1.35
    : isNight
    ? 0.78
    : isDawn || isDusk
    ? world.palette.sunIntensity * 0.9
    : world.palette.sunIntensity;

  return (
    <div className="w-full h-full relative cursor-crosshair">
      <Canvas
        shadows={settings.graphicsQuality !== 'low'}
        dpr={settings.graphicsQuality === 'low' ? [0.85, 1] : [1, 1.75]}
        camera={{ fov: 65, near: 0.12, far: 520 }}
        onPointerDown={(e) => {
          if (paused) return;
          const target = e.currentTarget;
          if (!document.pointerLockElement && target.requestPointerLock) {
            try {
              target.requestPointerLock();
            } catch {
              // Sandbox fallback handled smoothly via mouse drag / move listener
            }
          }
        }}
      >
        <color attach="background" args={[bgSky]} />
        <fog
          attach="fog"
          args={[
            bgSky,
            visionMode.thermal ? 130 : world.palette.fogNear,
            visionMode.thermal ? 460 : world.palette.fogFar,
          ]}
        />

        <ambientLight
          color={visionMode.lowlight ? '#6ee7b7' : '#ffffff'}
          intensity={ambientInt}
        />
        <hemisphereLight
          args={[world.palette.skyTop, world.palette.groundPrimary, 0.45]}
        />
        <directionalLight
          position={[45, 78, 42]}
          intensity={sunInt}
          color={visionMode.lowlight ? '#34d399' : world.palette.sunColor}
          castShadow={settings.graphicsQuality !== 'low'}
          shadow-mapSize-width={settings.graphicsQuality === 'high' ? 2048 : 1024}
          shadow-mapSize-height={settings.graphicsQuality === 'high' ? 2048 : 1024}
          shadow-camera-near={5}
          shadow-camera-far={300}
          shadow-camera-left={-95}
          shadow-camera-right={95}
          shadow-camera-top={180}
          shadow-camera-bottom={-180}
        />

        <CoreSimulation
          mission={mission}
          world={world}
          weaponId={weaponId}
          loadout={loadout}
          initialAmmoType={ammoType}
          equippedSlots={equippedSlots}
          settings={settings}
          paused={paused}
          onHudUpdate={onHudUpdate}
          onMissionEnd={onMissionEnd}
          onThermalStateChange={(thermal, lowlight) => setVisionMode({ thermal, lowlight })}
        />
      </Canvas>
    </div>
  );
};
