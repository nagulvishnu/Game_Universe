import { DISTRICT_CENTERS } from '../../data/rivals';
import type { DistrictId } from '../types';

export interface DistrictInfo {
  id: DistrictId;
  name: string;
  tagline: string;
  color: string;
  ground: string;
}

export const DISTRICTS: DistrictInfo[] = [
  { id: 'residential', name: 'Sakura Heights', tagline: 'Residential District', color: '#ff8fb8', ground: '#8fbf7a' },
  { id: 'shopping', name: 'Neon Bazaar', tagline: 'Shopping District', color: '#35d0ff', ground: '#a9a9b8' },
  { id: 'training', name: 'Dojo Row', tagline: 'Training District', color: '#ffb13a', ground: '#b8a27a' },
  { id: 'competition', name: 'Coliseum Plaza', tagline: 'Competition District', color: '#ff4d6d', ground: '#b0aab8' },
  { id: 'elite', name: 'Skyline Terrace', tagline: 'Elite District', color: '#b57cff', ground: '#6c6a86' },
  { id: 'championship', name: 'Crown Boulevard', tagline: 'Championship District', color: '#ffd24a', ground: '#d8ccb0' },
];
export const DISTRICT_MAP = Object.fromEntries(DISTRICTS.map((d) => [d.id, d])) as Record<DistrictId, DistrictInfo>;

export const WORLD = { minX: -108, maxX: 108, minZ: -70, maxZ: 70 };

/** Which district a world position belongs to (nearest centre). */
export function districtAt(x: number, z: number): DistrictInfo {
  let best = DISTRICTS[0];
  let bd = Infinity;
  for (const d of DISTRICTS) {
    const c = DISTRICT_CENTERS[d.id];
    const dd = Math.hypot(x - c.x, (z - c.z) * 1.1);
    if (dd < bd) { bd = dd; best = d; }
  }
  return best;
}

export type InteractType = 'shop' | 'training' | 'tournament' | 'board' | 'bench' | 'publicbattle';
export interface Interactable {
  id: string;
  type: InteractType;
  x: number;
  z: number;
  label: string;
  district: DistrictId;
  tab?: string;
}

const P = 9;
const mk = (d: DistrictId, id: string, type: InteractType, sx: number, sz: number, label: string, tab?: string): Interactable => ({
  id, type, district: d, label, tab, x: DISTRICT_CENTERS[d].x + sx * P, z: DISTRICT_CENTERS[d].z + sz * P,
});

export const INTERACTABLES: Interactable[] = [
  mk('residential', 'res-battle', 'publicbattle', 1, 1, 'Public Battle Spot'),
  mk('residential', 'res-bench', 'bench', -1, 1, 'Park Bench'),
  mk('residential', 'res-board', 'board', -1, -1, 'Community Board'),
  mk('shopping', 'shop-garage', 'shop', 1, 1, 'Bey Garage', 'layer'),
  mk('shopping', 'shop-gear', 'shop', -1, 1, 'Gear Gallery', 'driver'),
  mk('shopping', 'shop-board', 'board', 1, -1, 'Tournament Notice Board'),
  mk('shopping', 'shop-bench', 'bench', -1, -1, 'Plaza Bench'),
  mk('training', 'tr-a', 'training', 1, 1, 'Practice Stadium A'),
  mk('training', 'tr-b', 'training', -1, 1, 'Practice Stadium B'),
  mk('training', 'tr-board', 'board', 1, -1, 'Training Board'),
  mk('training', 'tr-bench', 'bench', -1, -1, 'Dojo Bench'),
  mk('competition', 'comp-desk', 'tournament', 1, 1, 'Registration Desk'),
  mk('competition', 'comp-board', 'board', -1, 1, 'Tournament Bracket Board'),
  mk('competition', 'comp-bench', 'bench', 1, -1, 'Spectator Bench'),
  mk('competition', 'comp-battle', 'publicbattle', -1, -1, 'Public Battle Spot'),
  mk('elite', 'el-shop', 'shop', 1, 1, 'Elite Boutique', 'disc'),
  mk('elite', 'el-board', 'board', -1, 1, 'Elite Rankings Board'),
  mk('elite', 'el-bench', 'bench', 1, -1, 'Terrace Bench'),
  mk('elite', 'el-battle', 'publicbattle', -1, -1, 'Neon Battle Spot'),
  mk('championship', 'ch-desk', 'tournament', 1, 1, 'Championship Desk'),
  mk('championship', 'ch-board', 'board', -1, 1, 'Hall of Champions'),
  mk('championship', 'ch-bench', 'bench', 1, -1, 'Crown Bench'),
  mk('championship', 'ch-shop', 'shop', -1, -1, "Champion's Forge", 'accessory'),
];
export const INTERACT_MAP = Object.fromEntries(INTERACTABLES.map((i) => [i.id, i]));

export const DESK_BY_VENUE: Record<string, { x: number; z: number }> = {
  'Competition District Desk': { x: INTERACT_MAP['comp-desk'].x, z: INTERACT_MAP['comp-desk'].z },
  'Championship District Desk': { x: INTERACT_MAP['ch-desk'].x, z: INTERACT_MAP['ch-desk'].z },
};
