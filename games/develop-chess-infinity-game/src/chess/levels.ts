export interface AiLevel {
  id: number; name: string; elo: string; desc: string;
  depth: number; timeMs: number;
  /** softmax temperature over root-move scores (centipawns); 0 = always best */
  temp: number;
  /** chance of replacing the move with a random legal move */
  random: number;
  /** if true score all root moves at a fixed depth (needed for temperature selection) */
  multi: boolean;
}

export const AI_LEVELS: AiLevel[] = [
  { id: 1, name: "Beginner", elo: "~500", desc: "Looks one move ahead and often blunders.", depth: 1, timeMs: 400, temp: 220, random: 0.3, multi: true },
  { id: 2, name: "Easy", elo: "~900", desc: "Sees simple threats, misses deeper tactics.", depth: 2, timeMs: 800, temp: 110, random: 0.1, multi: true },
  { id: 3, name: "Medium", elo: "~1300", desc: "Solid tactics up to three plies with small errors.", depth: 3, timeMs: 1500, temp: 35, random: 0, multi: true },
  { id: 4, name: "Hard", elo: "~1700", desc: "Full alpha-beta search with quiescence — rarely errs.", depth: 6, timeMs: 1600, temp: 0, random: 0, multi: false },
  { id: 5, name: "Expert", elo: "~2000", desc: "Deep iterative search with pruning and move ordering.", depth: 12, timeMs: 4000, temp: 0, random: 0, multi: false },
];
