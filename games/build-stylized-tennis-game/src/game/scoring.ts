import type { Rules } from './constants';

export interface ScoreState {
  points: [number, number];
  games: [number, number];
  sets: [number, number][]; // completed sets
  setsWon: [number, number];
  tb: boolean;
  server: 0 | 1; // serving team
  serveGames: [number, number]; // service games played per team (partner rotation)
  tbFirst: 0 | 1;
  winner: -1 | 0 | 1;
}
export interface PointResult {
  game: boolean;
  set: boolean;
  match: boolean;
  tbStart: boolean;
  sideChange: boolean;
}

export function newScore(firstServer: 0 | 1 = 0): ScoreState {
  return { points: [0, 0], games: [0, 0], sets: [], setsWon: [0, 0], tb: false, server: firstServer, serveGames: [0, 0], tbFirst: firstServer, winner: -1 };
}

export function pointWon(s: ScoreState, r: Rules, t: 0 | 1): PointResult {
  const res: PointResult = { game: false, set: false, match: false, tbStart: false, sideChange: false };
  s.points[t]++;
  const a = s.points[t];
  const b = s.points[1 - t];
  let gameWon = false;
  if (s.tb) {
    const total = a + b;
    const target = r.games >= 6 ? 7 : 5;
    if (a >= target && a - b >= 2) gameWon = true;
    else {
      s.server = ((s.tbFirst + Math.floor((total + 1) / 2)) % 2) as 0 | 1;
      res.sideChange = total % 6 === 0;
    }
  } else if (r.noAd) {
    gameWon = a >= 4;
  } else {
    gameWon = a >= 4 && a - b >= 2;
  }
  if (!gameWon) return res;

  res.game = true;
  const wasTb = s.tb;
  s.games[t]++;
  s.points = [0, 0];
  s.tb = false;
  const g = s.games[t];
  const o = s.games[1 - t];
  const setWon = (g >= r.games && g - o >= 2) || (wasTb && g > o);
  if (setWon) {
    res.set = true;
    s.sets.push([s.games[0], s.games[1]]);
    s.setsWon[t]++;
    s.games = [0, 0];
    if (s.setsWon[t] >= r.setsToWin) {
      res.match = true;
      s.winner = t;
    }
  }
  // who serves next
  if (wasTb) {
    s.server = (1 - s.tbFirst) as 0 | 1;
    s.serveGames[s.tbFirst]++;
  } else {
    s.serveGames[s.server]++;
    s.server = (1 - s.server) as 0 | 1;
  }
  if (!res.match && r.tiebreak && s.games[0] === r.games && s.games[1] === r.games) {
    s.tb = true;
    s.tbFirst = s.server;
    res.tbStart = true;
  }
  return res;
}

/** Which service court: 0 = deuce (right), 1 = ad (left). */
export function serveSide(s: ScoreState): 0 | 1 {
  return ((s.points[0] + s.points[1]) % 2) as 0 | 1;
}
/** Which partner serves (doubles). */
export function serverSlot(s: ScoreState): 0 | 1 {
  return (s.serveGames[s.server] % 2) as 0 | 1;
}

const PT = ['0', '15', '30', '40'];
export function pointLabels(s: ScoreState, r: Rules): [string, string] {
  if (s.tb) return [String(s.points[0]), String(s.points[1])];
  const [a, b] = s.points;
  if (a >= 3 && b >= 3 && !r.noAd) {
    if (a === b) return ['40', '40'];
    return a > b ? ['AD', '40'] : ['40', 'AD'];
  }
  if (a >= 3 && b >= 3 && r.noAd) return ['40', '40'];
  return [PT[Math.min(a, 3)], PT[Math.min(b, 3)]];
}
export function isDeuce(s: ScoreState, r: Rules) {
  return !s.tb && !r.noAd && s.points[0] >= 3 && s.points[0] === s.points[1];
}
export function callOut(s: ScoreState, r: Rules): string {
  const [a, b] = pointLabels(s, r);
  if (s.tb) return `${a}, ${b}`;
  if (isDeuce(s, r)) return 'Deuce';
  if (a === 'AD') return 'Advantage player one';
  if (b === 'AD') return 'Advantage player two';
  const w = (x: string) => (x === '0' ? 'love' : x);
  if (a === b) return `${w(a)} all`;
  return `${w(a)}, ${w(b)}`;
}
