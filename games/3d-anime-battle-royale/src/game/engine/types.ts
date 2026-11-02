import { Vector3 } from 'three';
import { AmmoType, WeaponInst } from '../data/weapons';
import { Look } from '../data/characters';

export type Stance = 'stand' | 'crouch' | 'prone';
export type FState = 'plane' | 'freefall' | 'chute' | 'ground' | 'vehicle' | 'dead';
export type Personality = 'aggressive' | 'defensive' | 'looter' | 'tactical' | 'sniper';
export type BotMode = 'plane' | 'drop' | 'loot' | 'roam' | 'zone' | 'fight' | 'cover' | 'heal' | 'hunt' | 'reload';

export interface Cmd {
  mx: number; mz: number; sprint: boolean; jump: boolean; crouch: boolean; prone: boolean; fire: boolean; aim: boolean; reload: boolean;
  aimDir: Vector3 | null;
}
export const newCmd = (): Cmd => ({ mx: 0, mz: 0, sprint: false, jump: false, crouch: false, prone: false, fire: false, aim: false, reload: false, aimDir: null });

export interface Bot {
  personality: Personality;
  skill: number; // 0.3..0.95 aim quality
  react: number; // reaction delay
  mode: BotMode;
  thinkT: number;
  path: [number, number][];
  pathI: number;
  goal: [number, number] | null;
  goalKind: string;
  lootTarget: number; // loot id
  enemy: number; // fighter id
  lastSeen: [number, number, number] | null; // x,z,time
  seenSince: number;
  coverPos: [number, number] | null;
  stuckT: number;
  lastPos: [number, number];
  strafeDir: number; strafeT: number;
  grenadeCd: number;
  jumpPlan: { x: number; z: number; t: number; tx: number; tz: number; chuteAlt: number };
  landed: boolean;
  repathT: number;
  heardPos: [number, number, number] | null;
  burstT: number; burstPause: number;
  zoneT: number;
  roamT: number;
  fightT: number;
  noLootT: number;
  doorStage: number;
  aimErr: number;
  accT: number; // accumulated dt for slow ticks
  flashedT: number;
  visible: boolean;
  skip: Record<number, number>;
  switchT: number;
  wanderT: number;
}

export interface Vehicle {
  id: number; type: 'jeep' | 'sports' | 'bike';
  pos: Vector3; vel: Vector3; yaw: number; speed: number; steer: number; pitch: number; roll: number;
  hp: number; maxHp: number; driver: Fighter | null; dead: boolean; burnT: number; grounded: boolean; wheel: number;
}

export interface Loot { id: number; x: number; y: number; z: number; item: string; qty: number; inst?: WeaponInst; cond?: number; respawn?: boolean; t: number }

export interface Bullet {
  active: boolean; x: number; y: number; z: number; px: number; py: number; pz: number; vx: number; vy: number; vz: number;
  owner: number; weapon: string; dmg: number; hs: number; travelled: number; maxDist: number; range: number; color: string; life: number; sup: boolean;
}

export interface Grenade { x: number; y: number; z: number; vx: number; vy: number; vz: number; fuse: number; type: 'frag' | 'smoke' | 'flash'; owner: number; active: boolean; bounces: number }
export interface Smoke { x: number; y: number; z: number; t: number; r: number }

export type FxEvent =
  | { k: 'muzzle'; x: number; y: number; z: number; dx: number; dy: number; dz: number; color: string; big: number; sup: boolean }
  | { k: 'impact'; x: number; y: number; z: number; nx: number; ny: number; nz: number; kind: 'world' | 'flesh' | 'metal' }
  | { k: 'explosion'; x: number; y: number; z: number; r: number }
  | { k: 'smoke'; x: number; y: number; z: number }
  | { k: 'flash'; x: number; y: number; z: number }
  | { k: 'dust'; x: number; y: number; z: number };

export type SoundEvent =
  | { k: 'shot'; x: number; y: number; z: number; f: number; len: number; noise: number; pitch: number; sup: boolean; own: boolean }
  | { k: 'impact'; x: number; y: number; z: number }
  | { k: 'explosion'; x: number; y: number; z: number }
  | { k: 'step'; x: number; y: number; z: number; run: boolean }
  | { k: 'reload'; x: number; y: number; z: number }
  | { k: 'pickup' } | { k: 'hit'; head: boolean } | { k: 'kill' } | { k: 'zone' } | { k: 'chute'; x: number; y: number; z: number }
  | { k: 'throw'; x: number; y: number; z: number } | { k: 'land'; x: number; y: number; z: number } | { k: 'heal' } | { k: 'click' };

export interface FeedItem { t: number; killer: string; victim: string; weapon: string; head: boolean; you: boolean; me: boolean }

export class Fighter {
  pos = new Vector3(); vel = new Vector3();
  yaw = 0; pitch = 0; bodyYaw = 0;
  hp = 100; armor = 0; armorHp = 0; helmet = 0; helmetHp = 0; pack = 0;
  state: FState = 'plane'; stance: Stance = 'stand'; grounded = true; inWater = false;
  slots: (WeaponInst | null)[] = [null, null, null];
  cur = 0;
  ammo: Record<AmmoType, number> = { light: 0, rifle: 0, sniper: 0, shell: 0 };
  heal: Record<string, number> = { bandage: 0, medkit: 0 };
  throws: Record<string, number> = { frag: 0, smoke: 0, flash: 0 };
  atts: Record<string, number> = {};
  fireCd = 0; reloadT = 0; reloadTotal = 0; switchT = 0; healT = 0; healItem = ''; burstLeft = 0; shotSinceT = 0; throwT = 0; throwType = '';
  aiming = false; sprinting = false; moving = false;
  cmd: Cmd = newCmd();
  // animation
  stride = 0; landT = 0; hitT = 0; deadT = 0; victory = false; kickT = 0; speedSm = 0; lean = 0; lastShot = -99; hitDir = 0;
  alive = true; placement = 0; killedBy = ''; killerId = -1; diedAt = 0; lastDmgT = -99; lastDmgFrom = -1;
  kills = 0; damageDealt = 0; headshots = 0; distance = 0; shots = 0; flashT = 0; stepT = 0;
  bot: Bot | null = null;
  vehicle: Vehicle | null = null;
  vehSeat = 0;
  weaponKills: Record<string, number> = {};
  weaponShots: Record<string, number> = {};
  dummy = false; dummyT = 0; dummyMove = 0; dummyHome = new Vector3();
  prevFire = false; bloom = 0; spawnPos = new Vector3();
  fallStart = 0; chuteOpen = false; freefallT = 0; landedAt = 0;
  constructor(public id: number, public name: string, public isPlayer: boolean, public charId: string, public look: Look) {}
  get weapon(): WeaponInst | null { return this.slots[this.cur]; }
  get eyeY() { return this.stance === 'stand' ? 1.62 : this.stance === 'crouch' ? 1.1 : 0.4; }
  get height() { return this.stance === 'stand' ? 1.8 : this.stance === 'crouch' ? 1.3 : 0.6; }
}
