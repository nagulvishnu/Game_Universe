export interface StadiumDef {
  id: string;
  name: string;
  desc: string;
  radius: number;
  pull: number; // bowl pull toward the centre
  pockets: number; // number of ring-out gaps in the wall
  pocketHalfAngle: number;
  floor: string;
  accent: string;
  wall: string;
  sky: string;
  crowd: number;
}

export const STADIUMS: StadiumDef[] = [
  { id: 'park', name: 'Sakura Park Dish', desc: 'Friendly neighbourhood dish. Gentle slope.', radius: 10, pull: 1.4, pockets: 3, pocketHalfAngle: 0.3, floor: '#3a4a7a', accent: '#ff8fb8', wall: '#d8dff0', sky: '#7fb5ff', crowd: 30 },
  { id: 'dojo', name: 'Training Dojo Bowl', desc: 'Steep bowl that keeps tops central.', radius: 10, pull: 2.2, pockets: 2, pocketHalfAngle: 0.3, floor: '#4a3a2a', accent: '#ffcf5a', wall: '#c9b79c', sky: '#9ac3ff', crowd: 20 },
  { id: 'arena', name: 'Colosseum Arena', desc: 'Official competition stadium.', radius: 10, pull: 1.5, pockets: 3, pocketHalfAngle: 0.3, floor: '#2c3e63', accent: '#35d0ff', wall: '#e6ebf5', sky: '#6aa6ff', crowd: 90 },
  { id: 'neon', name: 'Elite Neon Pit', desc: 'Flat and fast. Four wide ring-out gaps.', radius: 10, pull: 1.0, pockets: 4, pocketHalfAngle: 0.26, floor: '#1a1030', accent: '#c06bff', wall: '#2a2250', sky: '#1d1040', crowd: 60 },
  { id: 'gold', name: 'Championship Dome', desc: 'The grandest stage in the world.', radius: 10, pull: 1.6, pockets: 3, pocketHalfAngle: 0.3, floor: '#33224a', accent: '#ffd24a', wall: '#f5e6b8', sky: '#ffc27a', crowd: 140 },
];
export const STADIUM_MAP: Record<string, StadiumDef> = Object.fromEntries(STADIUMS.map((s) => [s.id, s]));
