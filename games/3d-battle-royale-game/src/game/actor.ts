import * as THREE from 'three';
import { WEAPONS, type WeaponId, type AmmoType, type VehicleType, type VehicleDef, VEHICLES } from './data';
import type { Human, VehicleModel } from './models';

export interface Gun { id: WeaponId; mag: number }
export type Phase = 'plane' | 'fall' | 'chute' | 'ground' | 'vehicle';

export interface Loot {
  id: number;
  kind: 'weapon' | 'ammo' | 'medkit' | 'shield' | 'grenade' | 'bomb';
  wid?: WeaponId;
  ammo?: AmmoType;
  amount: number;
  x: number;
  z: number;
  rarity: number;
  b: number; // building index
  mesh: THREE.Group;
  taken: boolean;
  phase: number;
}

export interface BotAI {
  state: 'loot' | 'roam' | 'fight' | 'zone' | 'heal';
  think: number;
  tx: number; tz: number;
  target: Actor | null;
  los: boolean;
  strafe: number;
  strafeT: number;
  loot: Loot | null;
  stuck: number;
  lx: number; lz: number;
  unstuck: number;
  ux: number; uz: number;
  react: number;
  grenCd: number;
  jumpAt: number;
  landX: number; landZ: number;
  stage: number;
  navKey: number;
  skill: number;
  roamT: number;
  healT: number;
  speed: number;
}

export class Actor {
  id: number;
  name: string;
  isPlayer: boolean;
  x = 0; y = 0; z = 0;
  vx = 0; vy = 0; vz = 0;
  yaw = 0; pitch = 0;
  hp = 100;
  armor = 0;
  alive = true;
  phase: Phase = 'plane';
  melee: WeaponId = 'knife';
  guns: (Gun | null)[] = [null, null];
  slot = 0;
  ammo: Record<AmmoType, number> = { light: 0, rifle: 0, shell: 0 };
  gren = 0;
  bomb = 0;
  medkits = 0;
  cd = 0;
  reload = 0;
  swing = 0;
  healT = 0;
  kills = 0;
  dmg = 0;
  place = 0;
  vehicle: Vehicle | null = null;
  ramCd = 0;
  walkT = 0;
  speed = 0;
  pose = 0;
  squash = 0;
  recoil = 0;
  human: Human;
  ai: BotAI | null = null;
  color = 0;
  onGround = true;

  constructor(id: number, name: string, isPlayer: boolean, human: Human, color: number) {
    this.id = id;
    this.name = name;
    this.isPlayer = isPlayer;
    this.human = human;
    this.color = color;
  }

  get weaponId(): WeaponId {
    if (this.slot === 0) return this.melee;
    return this.guns[this.slot - 1]?.id ?? this.melee;
  }
  get gun(): Gun | null {
    return this.slot > 0 ? this.guns[this.slot - 1] : null;
  }
  get bestGunTier(): number {
    let t = 0;
    for (const g of this.guns) if (g) t = Math.max(t, WEAPONS[g.id].tier);
    return t;
  }
}

export class Vehicle {
  type: VehicleType;
  def: VehicleDef;
  x = 0; z = 0; yaw = 0; speed = 0;
  hp: number;
  driver: Actor | null = null;
  model: VehicleModel;
  wreck = false;
  smoke = 0;
  lean = 0;
  steer = 0;
  skid = 0;
  constructor(type: VehicleType, model: VehicleModel) {
    this.type = type;
    this.def = VEHICLES[type];
    this.hp = this.def.hp;
    this.model = model;
  }
}
