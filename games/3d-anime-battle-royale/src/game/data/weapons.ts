export type AmmoType = 'light' | 'rifle' | 'sniper' | 'shell';
export type WeaponCat = 'AR' | 'SMG' | 'SNIPER' | 'SHOTGUN' | 'PISTOL' | 'LMG';
export type FireMode = 'auto' | 'semi' | 'burst' | 'bolt' | 'pump';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type AttachSlot = 'sight' | 'mag' | 'muzzle' | 'grip';

export interface WeaponDef {
  id: string;
  name: string;
  cat: WeaponCat;
  ammo: AmmoType;
  mode: FireMode;
  dmg: number; // per bullet / pellet
  pellets: number;
  rpm: number;
  mag: number;
  reload: number; // seconds for full reload (per-shell for shotguns uses reloadEach)
  reloadEach?: number;
  range: number; // effective range (m)
  recoil: number; // degrees of vertical kick per shot
  spread: number; // hip-fire cone (radians)
  adsMul: number; // spread multiplier while aiming
  hs: number; // headshot multiplier
  speed: number; // bullet speed m/s
  moveMul: number;
  zoom: number; // ADS zoom factor
  rarity: Rarity;
  burst?: number;
  color: string;
  tracer: string;
  loud: number; // hearing radius
  sfx: { f: number; len: number; noise: number; pitch: number };
  grip: number; // z position of foregrip (weapon-local) for left hand
  len: number; // visual length
}

export const WEAPONS: Record<string, WeaponDef> = {
  ar01: {
    id: 'ar01', name: 'AR-01', cat: 'AR', ammo: 'rifle', mode: 'auto', dmg: 21, pellets: 1, rpm: 640, mag: 30, reload: 2.2,
    range: 110, recoil: 0.65, spread: 0.028, adsMul: 0.35, hs: 1.6, speed: 520, moveMul: 0.95, zoom: 1.35, rarity: 'uncommon',
    color: '#4a5568', tracer: '#ffe9a8', loud: 220, sfx: { f: 150, len: 0.1, noise: 0.8, pitch: 1 }, grip: 0.38, len: 0.95,
  },
  viper: {
    id: 'viper', name: 'VIPER', cat: 'AR', ammo: 'rifle', mode: 'burst', burst: 3, dmg: 27, pellets: 1, rpm: 560, mag: 30, reload: 2.4,
    range: 130, recoil: 0.8, spread: 0.022, adsMul: 0.3, hs: 1.7, speed: 560, moveMul: 0.93, zoom: 1.45, rarity: 'rare',
    color: '#2d6a4f', tracer: '#aaffcc', loud: 230, sfx: { f: 125, len: 0.12, noise: 0.85, pitch: 0.9 }, grip: 0.4, len: 1.0,
  },
  phantom: {
    id: 'phantom', name: 'PHANTOM', cat: 'SMG', ammo: 'light', mode: 'auto', dmg: 15, pellets: 1, rpm: 850, mag: 25, reload: 1.7,
    range: 55, recoil: 0.4, spread: 0.034, adsMul: 0.45, hs: 1.4, speed: 400, moveMul: 1.05, zoom: 1.2, rarity: 'uncommon',
    color: '#5b3a8c', tracer: '#d9b3ff', loud: 150, sfx: { f: 210, len: 0.07, noise: 0.7, pitch: 1.3 }, grip: 0.26, len: 0.6,
  },
  rapid9: {
    id: 'rapid9', name: 'RAPID-9', cat: 'SMG', ammo: 'light', mode: 'auto', dmg: 11.5, pellets: 1, rpm: 1050, mag: 32, reload: 1.6,
    range: 45, recoil: 0.32, spread: 0.04, adsMul: 0.5, hs: 1.35, speed: 380, moveMul: 1.08, zoom: 1.15, rarity: 'common',
    color: '#c05621', tracer: '#ffcf8a', loud: 140, sfx: { f: 250, len: 0.06, noise: 0.65, pitch: 1.5 }, grip: 0.22, len: 0.5,
  },
  longshot: {
    id: 'longshot', name: 'LONGSHOT', cat: 'SNIPER', ammo: 'sniper', mode: 'bolt', dmg: 98, pellets: 1, rpm: 42, mag: 5, reload: 3.2,
    range: 380, recoil: 3.0, spread: 0.06, adsMul: 0.02, hs: 2.6, speed: 900, moveMul: 0.82, zoom: 4, rarity: 'epic',
    color: '#1a202c', tracer: '#9ad9ff', loud: 420, sfx: { f: 70, len: 0.35, noise: 0.9, pitch: 0.55 }, grip: 0.7, len: 1.45,
  },
  eagle: {
    id: 'eagle', name: 'EAGLE EYE', cat: 'SNIPER', ammo: 'sniper', mode: 'semi', dmg: 64, pellets: 1, rpm: 130, mag: 10, reload: 3.0,
    range: 300, recoil: 1.9, spread: 0.05, adsMul: 0.04, hs: 2.2, speed: 820, moveMul: 0.85, zoom: 3, rarity: 'epic',
    color: '#744210', tracer: '#ffd48a', loud: 380, sfx: { f: 85, len: 0.28, noise: 0.9, pitch: 0.65 }, grip: 0.6, len: 1.3,
  },
  thunder12: {
    id: 'thunder12', name: 'THUNDER-12', cat: 'SHOTGUN', ammo: 'shell', mode: 'pump', dmg: 12, pellets: 9, rpm: 75, mag: 6, reload: 3, reloadEach: 0.55,
    range: 22, recoil: 2.2, spread: 0.085, adsMul: 0.7, hs: 1.5, speed: 300, moveMul: 0.95, zoom: 1.2, rarity: 'rare',
    color: '#8b2d2d', tracer: '#ffb38a', loud: 280, sfx: { f: 90, len: 0.22, noise: 1, pitch: 0.7 }, grip: 0.42, len: 1.0,
  },
  strike9: {
    id: 'strike9', name: 'STRIKE-9', cat: 'PISTOL', ammo: 'light', mode: 'semi', dmg: 23, pellets: 1, rpm: 420, mag: 15, reload: 1.4,
    range: 45, recoil: 0.9, spread: 0.03, adsMul: 0.5, hs: 1.8, speed: 380, moveMul: 1.08, zoom: 1.15, rarity: 'common',
    color: '#718096', tracer: '#ffffff', loud: 130, sfx: { f: 230, len: 0.08, noise: 0.7, pitch: 1.2 }, grip: 0.0, len: 0.3,
  },
  titan: {
    id: 'titan', name: 'TITAN LMG', cat: 'LMG', ammo: 'rifle', mode: 'auto', dmg: 23, pellets: 1, rpm: 620, mag: 100, reload: 5.2,
    range: 100, recoil: 0.7, spread: 0.04, adsMul: 0.5, hs: 1.4, speed: 500, moveMul: 0.82, zoom: 1.3, rarity: 'legendary',
    color: '#9b2c2c', tracer: '#ff9a7a', loud: 260, sfx: { f: 100, len: 0.11, noise: 0.9, pitch: 0.8 }, grip: 0.5, len: 1.2,
  },
};

export interface AttachDef {
  id: string; name: string; slot: AttachSlot; rarity: Rarity; weight: number;
  zoom?: number; cats?: WeaponCat[]; recoilMul?: number; spreadMul?: number; magMul?: number; suppress?: boolean; adsBonus?: number;
}

export const ATTACHMENTS: Record<string, AttachDef> = {
  reddot: { id: 'reddot', name: 'Red-Dot Sight', slot: 'sight', rarity: 'common', weight: 2, zoom: 1.5, cats: ['AR', 'SMG', 'LMG', 'SHOTGUN', 'PISTOL'], adsBonus: 0.85 },
  scope2: { id: 'scope2', name: '2x Scope', slot: 'sight', rarity: 'uncommon', weight: 3, zoom: 2.2, cats: ['AR', 'SMG', 'LMG'] },
  scope4: { id: 'scope4', name: '4x Scope', slot: 'sight', rarity: 'rare', weight: 3, zoom: 4, cats: ['AR', 'LMG', 'SNIPER'] },
  scope8: { id: 'scope8', name: '8x Scope', slot: 'sight', rarity: 'epic', weight: 4, zoom: 7, cats: ['SNIPER'] },
  extmag: { id: 'extmag', name: 'Extended Magazine', slot: 'mag', rarity: 'uncommon', weight: 3, magMul: 1.4 },
  suppressor: { id: 'suppressor', name: 'Suppressor', slot: 'muzzle', rarity: 'rare', weight: 3, suppress: true, cats: ['AR', 'SMG', 'SNIPER', 'PISTOL', 'LMG'] },
  compensator: { id: 'compensator', name: 'Recoil Compensator', slot: 'muzzle', rarity: 'uncommon', weight: 2, recoilMul: 0.68, cats: ['AR', 'SMG', 'LMG', 'SNIPER', 'PISTOL', 'SHOTGUN'] },
  foregrip: { id: 'foregrip', name: 'Foregrip', slot: 'grip', rarity: 'uncommon', weight: 2, recoilMul: 0.82, spreadMul: 0.85, cats: ['AR', 'SMG', 'LMG', 'SHOTGUN'] },
};

export const AMMO_NAMES: Record<AmmoType, string> = { light: '9mm', rifle: '5.56 Rifle', sniper: '.308 Sniper', shell: '12ga Shell' };
export const AMMO_WEIGHT = 0.1;

export interface WeaponInst {
  id: string;
  mag: number;
  att: { sight?: string; mag?: string; muzzle?: string; grip?: string };
}

export function weaponStats(w: WeaponInst) {
  const d = WEAPONS[w.id];
  let recoil = 1, spread = 1, magMul = 1, suppress = false, zoom = d.zoom, ads = 1;
  for (const k of ['sight', 'mag', 'muzzle', 'grip'] as AttachSlot[]) {
    const a = w.att[k] ? ATTACHMENTS[w.att[k]!] : null;
    if (!a) continue;
    recoil *= a.recoilMul ?? 1;
    spread *= a.spreadMul ?? 1;
    magMul *= a.magMul ?? 1;
    ads *= a.adsBonus ?? 1;
    if (a.suppress) suppress = true;
    if (a.zoom) zoom = Math.max(zoom, a.zoom);
  }
  return {
    def: d,
    recoil: d.recoil * recoil,
    spread: d.spread * spread,
    adsMul: d.adsMul * ads,
    magSize: Math.round(d.mag * magMul),
    suppress,
    zoom,
    dmg: d.dmg,
    interval: 60 / d.rpm,
  };
}

export function weaponScore(id: string) {
  const d = WEAPONS[id];
  const dps = d.dmg * d.pellets * (d.rpm / 60) * (d.cat === 'SNIPER' ? 0.6 : d.cat === 'SHOTGUN' ? 0.5 : 1);
  return dps * (0.6 + d.range / 300) * (d.cat === 'PISTOL' ? 0.5 : 1);
}

export function newWeapon(id: string, full = true): WeaponInst {
  return { id, mag: full ? WEAPONS[id].mag : 0, att: {} };
}
