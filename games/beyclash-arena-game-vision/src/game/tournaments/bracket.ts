import type { Finish } from '../types';

export interface ActiveTournament {
  id: string;
  seed: number;
  /** competitor ids; length === bracket size (index 0..size-1 seeded positions) */
  entrants: string[];
  /** winners[round][match] = entrant index, or null if not decided */
  winners: (number | null)[][];
  finishes: (Finish | null)[][];
  status: 'active' | 'won' | 'eliminated';
}

export const roundsFor = (size: number) => Math.log2(size);

export function roundName(size: number, round: number): string {
  const total = roundsFor(size);
  const left = total - round;
  if (left === 1) return 'Final';
  if (left === 2) return 'Semi-final';
  if (left === 3) return 'Quarter-final';
  return `Round ${round + 1}`;
}

export function createBracket(id: string, seed: number, entrants: string[]): ActiveTournament {
  const size = entrants.length;
  if (size < 2 || (size & (size - 1)) !== 0) throw new Error('Bracket size must be a power of two');
  const winners: (number | null)[][] = [];
  const finishes: (Finish | null)[][] = [];
  for (let r = 0; r < roundsFor(size); r++) {
    const n = size / 2 ** (r + 1);
    winners.push(Array(n).fill(null));
    finishes.push(Array(n).fill(null));
  }
  return { id, seed, entrants, winners, finishes, status: 'active' };
}

export function matchPair(b: ActiveTournament, r: number, m: number): [number | null, number | null] {
  if (r === 0) return [2 * m, 2 * m + 1];
  return [b.winners[r - 1][2 * m], b.winners[r - 1][2 * m + 1]];
}

export function recordWinner(b: ActiveTournament, r: number, m: number, winnerIdx: number, finish: Finish): ActiveTournament {
  const [a, c] = matchPair(b, r, m);
  if (winnerIdx !== a && winnerIdx !== c) throw new Error('Winner is not part of that match');
  if (b.winners[r][m] !== null) return b; // never record twice
  const winners = b.winners.map((x) => x.slice());
  const finishes = b.finishes.map((x) => x.slice());
  winners[r][m] = winnerIdx;
  finishes[r][m] = finish;
  return { ...b, winners, finishes };
}

export function playerIndex(b: ActiveTournament): number {
  return b.entrants.indexOf('player');
}

export function champion(b: ActiveTournament): number | null {
  const last = b.winners[b.winners.length - 1];
  return last[0];
}

/** The next undecided match containing the player with both sides known. */
export function nextPlayerMatch(b: ActiveTournament): { round: number; match: number; opponent: number } | null {
  const p = playerIndex(b);
  for (let r = 0; r < b.winners.length; r++) {
    for (let m = 0; m < b.winners[r].length; m++) {
      if (b.winners[r][m] !== null) continue;
      const [x, y] = matchPair(b, r, m);
      if (x === null || y === null) continue;
      if (x === p) return { round: r, match: m, opponent: y };
      if (y === p) return { round: r, match: m, opponent: x };
    }
  }
  return null;
}

export function isEliminated(b: ActiveTournament): boolean {
  const p = playerIndex(b);
  for (let r = 0; r < b.winners.length; r++) {
    for (let m = 0; m < b.winners[r].length; m++) {
      const w = b.winners[r][m];
      if (w === null) continue;
      const [x, y] = matchPair(b, r, m);
      if ((x === p || y === p) && w !== p) return true;
    }
  }
  return false;
}

export function currentRound(b: ActiveTournament): number {
  const nm = nextPlayerMatch(b);
  if (nm) return nm.round;
  for (let r = 0; r < b.winners.length; r++) if (b.winners[r].some((w) => w === null)) return r;
  return b.winners.length - 1;
}
