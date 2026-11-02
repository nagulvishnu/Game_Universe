import type { Difficulty } from '../game/types';

export interface TournamentDef {
  id: string;
  name: string;
  size: 4 | 8 | 16 | 32;
  tier: number;
  fee: number;
  prize: number;
  xp: number;
  rep: number;
  stadium: string;
  difficulty: Difficulty;
  partLevel: number;
  req: { level: number; prev?: string; rivals: number; points?: number };
  rivalIds: string[];
  rewardPart?: string;
  intro: string;
  venue: string;
}

export const TOURNAMENTS: TournamentDef[] = [
  { id: 'local', name: 'Local Tournament', size: 4, tier: 1, fee: 300, prize: 2000, xp: 250, rep: 40, stadium: 'park', difficulty: 'Easy', partLevel: 3, req: { level: 2, rivals: 2 }, rivalIds: ['daichi', 'yuzu'], rewardPart: 'storm-wing', intro: 'The friendliest bracket in the city. Four bladers, one trophy.', venue: 'Competition District Desk' },
  { id: 'district', name: 'District Championship', size: 8, tier: 2, fee: 600, prize: 4000, xp: 450, rep: 70, stadium: 'dojo', difficulty: 'Normal', partLevel: 6, req: { level: 5, prev: 'local', rivals: 6 }, rivalIds: ['sora', 'hikari', 'kaito', 'gonzo'], rewardPart: 'heavy-disc', intro: 'Eight district champions fight for the right to enter the city circuit.', venue: 'Competition District Desk' },
  { id: 'city', name: 'City Championship', size: 8, tier: 3, fee: 1000, prize: 7000, xp: 700, rep: 110, stadium: 'arena', difficulty: 'Hard', partLevel: 9, req: { level: 8, prev: 'district', rivals: 10 }, rivalIds: ['raijin', 'akane', 'zephyr', 'reina'], rewardPart: 'twin-fury', intro: 'The best of the city gather at the Colosseum. The crowd roars.', venue: 'Competition District Desk' },
  { id: 'elite', name: 'Elite Championship', size: 16, tier: 4, fee: 2500, prize: 15000, xp: 1100, rep: 180, stadium: 'neon', difficulty: 'Hard', partLevel: 12, req: { level: 12, prev: 'city', rivals: 13, points: 50000 }, rivalIds: ['tobias', 'jun', 'bruno', 'lucian', 'seraphina'], rewardPart: 'prism-disc', intro: 'Only bladers with 50,000 qualification points may enter. Neon lights, deadly opponents.', venue: 'Competition District Desk' },
  { id: 'regional', name: 'Regional Championship', size: 16, tier: 5, fee: 4000, prize: 24000, xp: 1500, rep: 260, stadium: 'arena', difficulty: 'Expert', partLevel: 14, req: { level: 15, prev: 'elite', rivals: 16 }, rivalIds: ['gideon', 'kaede', 'lucian', 'seraphina', 'tobias'], rewardPart: 'phantom-claw', intro: 'Regional stars from across the country descend on the city.', venue: 'Championship District Desk' },
  { id: 'national', name: 'National Championship', size: 32, tier: 6, fee: 6000, prize: 40000, xp: 2200, rep: 400, stadium: 'gold', difficulty: 'Expert', partLevel: 16, req: { level: 18, prev: 'regional', rivals: 19 }, rivalIds: ['valkyrie', 'ozymandias', 'gideon', 'kaede', 'lucian'], rewardPart: 'titan-crown', intro: 'Thirty-two of the nation\'s finest. Only one will face the World Champion.', venue: 'Championship District Desk' },
  { id: 'world', name: 'World Championship', size: 32, tier: 7, fee: 10000, prize: 100000, xp: 4000, rep: 800, stadium: 'gold', difficulty: 'Champion', partLevel: 18, req: { level: 21, prev: 'national', rivals: 21 }, rivalIds: ['aurelia', 'valkyrie', 'ozymandias', 'lucian', 'gideon', 'kaede'], rewardPart: 'world-sovereign', intro: 'The ultimate stage. The whole world is watching. Become the World Champion.', venue: 'Championship District Desk' },
];
export const TOURNAMENT_MAP: Record<string, TournamentDef> = Object.fromEntries(TOURNAMENTS.map((t) => [t.id, t]));
