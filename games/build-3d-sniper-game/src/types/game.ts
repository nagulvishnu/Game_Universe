export type WeaponTier = 'Entry' | 'Intermediate' | 'Advanced' | 'Elite';

export type WeaponFamily =
  | 'classic_bolt'
  | 'scout_light'
  | 'heritage_bolt'
  | 'chassis_precision'
  | 'integrally_suppressed'
  | 'heavy_bull'
  | 'bullpup_covert'
  | 'anti_materiel'
  | 'semi_dmr'
  | 'rail_prototype';

export type OpticType = 'standard' | 'variable' | 'lowlight' | 'thermal';

export type AttachmentSlot =
  | 'optic'
  | 'muzzle'
  | 'barrel'
  | 'underbarrel'
  | 'stock'
  | 'magazine'
  | 'skin'
  | 'reticle'
  | 'charm';

export type AmmoType = 'standard' | 'ap' | 'subsonic' | 'high_velocity' | 'training';

export type EquipmentId =
  | 'binoculars'
  | 'motion_sensor'
  | 'decoy'
  | 'smoke'
  | 'pulse_reveal'
  | 'supply_kit';

export type BiomeId =
  | 'training_range'
  | 'forest_outpost'
  | 'desert_base'
  | 'industrial_harbor'
  | 'mountain_frontier'
  | 'urban_district';

export type GameModeId =
  | 'campaign'
  | 'free_sniper'
  | 'precision_challenge'
  | 'survival'
  | 'stealth_ops'
  | 'time_attack'
  | 'longshot_trials'
  | 'daily_contracts';

export type EnemyClass =
  | 'guard'
  | 'armored'
  | 'scout'
  | 'counter_sniper'
  | 'commander'
  | 'reinforcement'
  | 'hostage'
  | 'target_dummy'
  | 'sabotage_node';

export type AIState =
  | 'patrol'
  | 'suspicious'
  | 'alerted'
  | 'investigating'
  | 'engaging'
  | 'returning'
  | 'dead';

export type HitRegion = 'head' | 'torso' | 'limbs' | 'weakpoint' | 'armor';

export type MissionGrade = 'S' | 'A' | 'B' | 'C';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export type ScreenName =
  | 'main_menu'
  | 'campaign_map'
  | 'mission_briefing'
  | 'loading'
  | 'playing'
  | 'weapon_workshop'
  | 'contract_board'
  | 'game_modes'
  | 'progression'
  | 'leaderboard'
  | 'settings'
  | 'mission_victory'
  | 'mission_failure';

export interface WeaponVisualProfile {
  family: WeaponFamily;
  receiverColor: string;
  stockColor: string;
  accentColor: string;
  barrelLength: number; // relative units
  barrelThickness: number;
  hasFlutedBarrel?: boolean;
  builtInSuppressor?: boolean;
  muzzleBrakeStyle: 'standard' | 'clam_heavy' | 'prong' | 'integrated_baffle' | 'rail_emitter';
  magazineStyle: 'flush' | 'box_5' | 'box_10' | 'heavy_50';
}

export interface WeaponDefinition {
  id: string;
  name: string;
  code: string;
  tier: WeaponTier;
  action: 'bolt' | 'semi';
  description: string;
  damage: number;
  effectiveRange: number; // meters
  accuracy: number; // 0..100
  muzzleVelocity: number; // m/s
  recoil: number; // 1..100
  fireRateRpm: number;
  magSize: number;
  reloadTime: number; // seconds
  adsSpeed: number; // seconds
  compatibleOptics: OpticType[];
  defaultSuppressed: boolean;
  unlockRank: number;
  price: number;
  visual: WeaponVisualProfile;
}

export interface AttachmentDefinition {
  id: string;
  slot: AttachmentSlot;
  name: string;
  description: string;
  price: number;
  unlockRank: number;
  opticType?: OpticType;
  zoomLevels?: number[];
  suppressed?: boolean;
  statModifiers: {
    damage?: number;
    effectiveRange?: number;
    accuracy?: number;
    muzzleVelocity?: number;
    recoil?: number;
    magSizeBonus?: number;
    reloadTimeMultiplier?: number;
    adsSpeedMultiplier?: number;
    swayMultiplier?: number;
  };
  cosmeticColor?: string;
  secondaryColor?: string;
  reticleStyle?: 'mil_dot' | 'chevron' | 'horus_grid' | 'cross_illuminated';
  charmType?: 'none' | 'brass_casing' | 'wolf_medallion' | 'meridian_shard';
}

export interface WeaponLoadoutConfig {
  optic: string;
  muzzle: string;
  barrel: string;
  underbarrel: string;
  stock: string;
  magazine: string;
  skin: string;
  reticle: string;
  charm: string;
}

export interface ComputedWeaponStats {
  damage: number;
  effectiveRange: number;
  accuracy: number;
  muzzleVelocity: number;
  recoil: number;
  fireRateRpm: number;
  magSize: number;
  reloadTime: number;
  adsSpeed: number;
  swayFactor: number;
  isSuppressed: boolean;
  armorPenetration: number; // 0..1
  soundRadius: number; // meters
  opticType: OpticType;
  zoomLevels: number[];
  reticleStyle: 'mil_dot' | 'chevron' | 'horus_grid' | 'cross_illuminated';
}

export interface AmmoDefinition {
  id: AmmoType;
  name: string;
  shortName: string;
  description: string;
  pricePerPack: number;
  velocityMultiplier: number;
  damageMultiplier: number;
  armorPenBonus: number;
  soundMultiplier: number;
  dropMultiplier: number;
  showTrajectoryArc?: boolean;
}

export interface EquipmentDefinition {
  id: EquipmentId;
  name: string;
  keyHint: string;
  description: string;
  maxCharges: number;
  cooldown: number;
  price: number;
  unlockRank: number;
}

export interface Vec3Tuple {
  x: number;
  y: number;
  z: number;
}

export interface EnemySpawnSpec {
  id: string;
  enemyClass: EnemyClass;
  name?: string;
  position: [number, number, number];
  patrolPoints?: [number, number, number][];
  isPriorityTarget?: boolean;
  isBoss?: boolean;
  bossStagePositions?: [number, number, number][];
  movingTargetSpeed?: number;
}

export interface ObjectiveSpec {
  id: string;
  title: string;
  type:
    | 'eliminate_all'
    | 'eliminate_priority'
    | 'sabotage'
    | 'collect_intel'
    | 'protect_hostages'
    | 'reach_extraction'
    | 'hit_targets'
    | 'survive_waves'
    | 'no_alarms'
    | 'headshot_count'
    | 'longshot_hit'
    | 'accuracy_threshold';
  targetCount: number;
  optional?: boolean;
  minDistance?: number;
}

export interface MissionDefinition {
  id: string;
  campaignIndex?: number; // 1..12 for campaign
  mode: GameModeId;
  codeName: string;
  title: string;
  subtitle: string;
  biome: BiomeId;
  timeOfDay: 'dawn' | 'day' | 'dusk' | 'night';
  weather: 'clear' | 'fog' | 'dust' | 'rain' | 'snow';
  windX: number; // m/s lateral wind
  briefingText: string;
  commanderDialogue: string;
  debriefSuccess: string;
  playerSpawn: [number, number, number];
  initialYaw: number;
  extractionPoint: [number, number, number];
  requireExtraction: boolean;
  timeLimitSeconds?: number;
  failOnAlarm?: boolean;
  wavesCount?: number;
  baseRewardCredits: number;
  baseRewardXp: number;
  unlockRank?: number;
  enemies: EnemySpawnSpec[];
  intelPositions?: [number, number, number][];
  objectives: ObjectiveSpec[];
}

export interface ContractDefinition {
  id: string;
  title: string;
  category:
    | 'Precision'
    | 'Stealth'
    | 'Longshot'
    | 'Priority'
    | 'Recon'
    | 'Rescue'
    | 'Sabotage'
    | 'Timed'
    | 'Survival'
    | 'Clean Op';
  description: string;
  rewardCredits: number;
  rewardXp: number;
  isDaily?: boolean;
  mission: MissionDefinition;
}

export interface HighScoreEntry {
  id: string;
  missionId: string;
  missionTitle: string;
  mode: GameModeId;
  score: number;
  grade: MissionGrade;
  longestShot: number;
  accuracy: number;
  headshots: number;
  timeSeconds: number;
  weaponName: string;
  timestamp: number;
}

export interface KeyBindings {
  moveForward: string;
  moveBackward: string;
  moveLeft: string;
  moveRight: string;
  sprint: string;
  crouch: string;
  reload: string;
  interact: string;
  binoculars: string;
  cameraToggle: string;
  equipment1: string;
  equipment2: string;
  ammoCycle: string;
  tacticalMap: string;
}

export interface GameSettings {
  mouseSensitivity: number;
  scopeSensitivity: number;
  invertY: boolean;
  graphicsQuality: GraphicsQuality;
  masterVolume: number;
  sfxVolume: number;
  ambienceVolume: number;
  muted: boolean;
  thirdPersonDefault: boolean;
  showTrajectoryHelper: boolean;
  enableKillcamReplay: boolean;
  showTouchControls: 'auto' | 'always' | 'off';
  keyBindings: KeyBindings;
}

export interface MissionCompletionRecord {
  completed: boolean;
  bestScore: number;
  bestGrade: MissionGrade;
  bestTimeSeconds: number;
  longestShot: number;
  timesCompleted: number;
}

export interface PlayerSaveData {
  version: number;
  hasStartedGame: boolean;
  rank: number;
  xp: number;
  credits: number;
  equippedWeaponId: string;
  equippedAmmo: AmmoType;
  equippedSlots: [EquipmentId, EquipmentId];
  unlockedWeapons: string[];
  ownedAttachments: string[];
  unlockedEquipment: EquipmentId[];
  weaponLoadouts: Record<string, WeaponLoadoutConfig>;
  missionRecords: Record<string, MissionCompletionRecord>;
  completedContracts: string[];
  dailySeedDate: string;
  achievements: string[];
  highScores: HighScoreEntry[];
  lifetimeStats: {
    totalKills: number;
    totalHeadshots: number;
    shotsFired: number;
    shotsHit: number;
    longestShotMeters: number;
    stealthCompletions: number;
  };
  settings: GameSettings;
}

export interface ActiveObjectiveProgress {
  id: string;
  title: string;
  current: number;
  target: number;
  completed: boolean;
  failed?: boolean;
  optional?: boolean;
}

export interface KillFeedItem {
  id: number;
  text: string;
  subtext: string;
  isHeadshot: boolean;
  distance: number;
  timestamp: number;
}

export interface MinimapBlip {
  id: string;
  x: number;
  z: number;
  type: 'enemy' | 'priority' | 'hostage' | 'intel' | 'sabotage' | 'extraction' | 'sensor';
  alertState?: AIState;
  tagged: boolean;
}

export interface HudSnapshot {
  health: number;
  maxHealth: number;
  stamina: number; // breath hold / sprint 0..100
  isHoldingBreath: boolean;
  isScoped: boolean;
  isBinoculars: boolean;
  isThirdPerson: boolean;
  isCrouching: boolean;
  isReloading: boolean;
  isCyclingBolt: boolean;
  currentZoom: number;
  opticType: OpticType;
  reticleStyle: 'mil_dot' | 'chevron' | 'horus_grid' | 'cross_illuminated';
  ammoInMag: number;
  magSize: number;
  reserveAmmo: number;
  currentAmmoType: AmmoType;
  weaponName: string;
  isSuppressed: boolean;
  windX: number;
  rangefinderMeters: number;
  dropCompensationMils: number;
  windDriftMils: number;
  globalAlertLevel: number; // 0..100
  alertStatusLabel: 'UNAWARE' | 'SUSPICIOUS' | 'SEARCHING' | 'COMBAT ALERT';
  playerX: number;
  playerZ: number;
  playerYaw: number;
  elapsedSeconds: number;
  remainingSeconds: number | null;
  currentWave: number;
  totalWaves: number;
  score: number;
  comboCount: number;
  shotsFired: number;
  shotsHit: number;
  kills: number;
  headshots: number;
  longestShot: number;
  alarmsTriggered: number;
  interactionPrompt: string | null;
  equipmentCharges: Record<EquipmentId, number>;
  equipmentCooldowns: Record<EquipmentId, number>;
  activeEquipmentSlots: [EquipmentId, EquipmentId];
  objectives: ActiveObjectiveProgress[];
  killFeed: KillFeedItem[];
  hitMarker: { type: 'normal' | 'headshot' | 'armor' | 'kill'; timestamp: number } | null;
  damageDirectionRad: number | null;
  damageFlashTime: number;
  killcamActive: boolean;
  killcamDistance: number;
  tacticalMapOpen: boolean;
  minimapBlips: MinimapBlip[];
  bossBar: { name: string; hp: number; maxHp: number; stageText: string } | null;
}

export interface MissionResultSummary {
  victory: boolean;
  failureReason?: string;
  mission: MissionDefinition;
  score: number;
  grade: MissionGrade;
  shotsFired: number;
  shotsHit: number;
  accuracy: number;
  kills: number;
  headshots: number;
  longestShot: number;
  timeSeconds: number;
  alarmsTriggered: number;
  optionalCompletedCount: number;
  creditsEarned: number;
  xpEarned: number;
  firstTimeBonus: boolean;
  rankedUpTo?: number;
  newlyUnlockedWeapons: string[];
  newAchievements: string[];
}
