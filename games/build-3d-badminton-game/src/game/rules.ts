// Pure badminton scoring / serving / landing-judgement rules.
import { COURT, RuleCfg } from './constants';

export interface TeamRS {
  score: number;
  games: number;
  side: 1 | -1;
  rightSlot: number; // slot index of the player currently in the right service court
}
export interface RulesState {
  cfg: RuleCfg;
  teams: [TeamRS, TeamRS];
  serverTeam: 0 | 1;
  gameNo: number;
  gameScores: [number, number][];
  matchWinner: -1 | 0 | 1;
}

export const RULE_PRESETS: Record<string, { label: string; pointsToWin: number; cap: number; gamesToWin: number }> = {
  quick: { label: 'Quick · 11 pts · 1 game', pointsToWin: 11, cap: 15, gamesToWin: 1 },
  standard: { label: 'Standard · 15 pts · 1 game', pointsToWin: 15, cap: 20, gamesToWin: 1 },
  full: { label: 'Full · 21 pts · best of 3', pointsToWin: 21, cap: 30, gamesToWin: 2 },
};

export function makeRules(cfg: RuleCfg, firstServer: 0 | 1 = 0): RulesState {
  return {
    cfg,
    teams: [
      { score: 0, games: 0, side: 1, rightSlot: 0 },
      { score: 0, games: 0, side: -1, rightSlot: 0 },
    ],
    serverTeam: firstServer,
    gameNo: 1,
    gameScores: [],
    matchWinner: -1,
  };
}

export interface ServeInfo {
  serverTeam: 0 | 1;
  receiverTeam: 0 | 1;
  serverSlot: number;
  receiverSlot: number;
  even: boolean;
  serverPos: { x: number; z: number };
  receiverPos: { x: number; z: number };
  targetXSign: number;
}

export function serveInfo(rs: RulesState): ServeInfo {
  const st = rs.teams[rs.serverTeam];
  const rTeam = (1 - rs.serverTeam) as 0 | 1;
  const rt = rs.teams[rTeam];
  const even = st.score % 2 === 0;
  const dbl = rs.cfg.doubles;
  const serverSlot = dbl ? (even ? st.rightSlot : 1 - st.rightSlot) : 0;
  const receiverSlot = dbl ? (even ? rt.rightSlot : 1 - rt.rightSlot) : 0;
  const sx = (even ? 1 : -1) * st.side * 1.5;
  return {
    serverTeam: rs.serverTeam,
    receiverTeam: rTeam,
    serverSlot,
    receiverSlot,
    even,
    serverPos: { x: sx, z: st.side * 2.7 },
    receiverPos: { x: -sx, z: rt.side * (dbl ? 2.9 : 4.4) },
    targetXSign: -Math.sign(sx),
  };
}

export type PointResult = 'point' | 'game' | 'match';

export function awardPoint(rs: RulesState, team: 0 | 1): PointResult {
  const t = rs.teams[team];
  t.score++;
  if (team === rs.serverTeam) {
    if (rs.cfg.doubles) t.rightSlot = 1 - t.rightSlot;
  } else {
    rs.serverTeam = team;
  }
  const o = rs.teams[1 - team];
  const { pointsToWin, cap, gamesToWin } = rs.cfg;
  const won = (t.score >= pointsToWin && t.score - o.score >= 2) || t.score >= cap;
  if (!won) return 'point';
  t.games++;
  rs.gameScores.push([rs.teams[0].score, rs.teams[1].score]);
  if (t.games >= gamesToWin) {
    rs.matchWinner = team;
    return 'match';
  }
  return 'game';
}

export function nextGame(rs: RulesState, winner: 0 | 1) {
  rs.teams.forEach((t) => {
    t.score = 0;
    t.side = (t.side === 1 ? -1 : 1) as 1 | -1;
    t.rightSlot = 0;
  });
  rs.serverTeam = winner;
  rs.gameNo++;
}

export interface LandingCtx {
  x: number;
  z: number;
  lastHitTeam: 0 | 1;
  isServe: boolean;
  netTouched: boolean;
  targetXSign: number;
}
export type FaultReason = 'in' | 'out' | 'net' | 'own' | 'service' | 'let';

export function judgeLanding(rs: RulesState, c: LandingCtx): { winner: 0 | 1 | -1; reason: FaultReason } {
  const cfg = rs.cfg;
  const hit = c.lastHitTeam;
  const other = (1 - hit) as 0 | 1;
  if (c.netTouched && Math.abs(c.z) < 0.12) return { winner: -1, reason: 'let' };
  const landSide = c.z > 0 ? 1 : -1;
  if (landSide === rs.teams[hit].side) return { winner: other, reason: c.netTouched ? 'net' : 'own' };
  const tol = 0.03;
  const wide = cfg.doubles || cfg.arcade;
  const hw = wide ? COURT.halfWidthD : COURT.halfWidthS;
  if (c.isServe && !cfg.arcade) {
    const hws = cfg.doubles ? COURT.halfWidthD : COURT.halfWidthS;
    const longZ = cfg.doubles ? COURT.longServiceD : COURT.halfLen;
    const az = Math.abs(c.z);
    const ok = Math.abs(c.x) <= hws + tol && c.x * c.targetXSign >= -tol && az >= COURT.shortService - tol && az <= longZ + tol;
    return ok ? { winner: hit, reason: 'in' } : { winner: other, reason: 'service' };
  }
  const ok = Math.abs(c.x) <= hw + tol && Math.abs(c.z) <= COURT.halfLen + tol;
  return ok ? { winner: hit, reason: 'in' } : { winner: other, reason: 'out' };
}
