import { PARTS, PART_MAP } from '../../data/parts';
import { RIVALS } from '../../data/rivals';
import { TOURNAMENTS, TOURNAMENT_MAP, type TournamentDef } from '../../data/tournaments';
import { DEFAULT_TRANSFER, transfer } from '../economy/economy';
import { MAX_LEVEL, type SaveData } from '../persistence/save';
import { applyEncounterWin, FINISH_POINTS, type EncounterOutcome } from '../rivals/encounter';
import { advanceAI } from '../tournaments/competitors';
import { champion, isEliminated, matchPair, nextPlayerMatch, recordWinner, roundName } from '../tournaments/bracket';
import { DIFFICULTIES, type BattleResult, type Finish, type RivalDef, type Requirement } from '../types';

export const xpForLevel = (l: number) => 50 + 22 * (l - 1) + 2 * (l - 1) ** 2;
export const REP_TITLES: [number, string][] = [[0, 'Rookie'], [40, 'Local Face'], [120, 'Rising Star'], [300, 'District Hero'], [600, 'City Legend'], [1000, 'Elite Contender'], [1600, 'National Star'], [2600, 'World Icon']];
export const repTitle = (rep: number) => [...REP_TITLES].reverse().find(([t]) => rep >= t)![1];
const XP_BASE = { Beginner: 35, Easy: 55, Normal: 90, Hard: 140, Expert: 220, Champion: 340 };
const FINISH_XP: Record<Finish, number> = { SPIN: 1, RING_OUT: 1.2, BURST: 1.5 };

export function addXp(level: number, xp: number, amount: number) {
  const levelUps: number[] = [];
  let l = level, x = xp + Math.max(0, Math.round(amount));
  while (l < MAX_LEVEL && x >= xpForLevel(l)) { x -= xpForLevel(l); l++; levelUps.push(l); }
  if (l >= MAX_LEVEL) x = Math.min(x, xpForLevel(MAX_LEVEL) - 1);
  return { level: l, xp: x, levelUps };
}

export function unlocksAtLevel(level: number): string[] {
  const out: string[] = [];
  for (const p of PARTS) if (!p.reward && p.unlockLevel === level && level > 1) out.push(`Part: ${p.name}`);
  for (const r of RIVALS) if (r.req.level === level) out.push(`Rival: ${r.name}`);
  for (const t of TOURNAMENTS) if (t.req.level === level) out.push(`Tournament: ${t.name}`);
  return out;
}

export interface BattleSummary {
  battleId: string;
  mode: 'rival' | 'tournament' | 'quick' | 'training';
  won: boolean;
  finish: Finish;
  time: number;
  stamina: [number, number];
  playerName: string;
  opponentName: string;
  encounter?: EncounterOutcome & { total: number };
  transfer?: { amount: number; direction: 'gain' | 'loss' | 'none' };
  prize: number;
  bonus?: { desc: string; points: number; part?: string };
  xp: number;
  rep: number;
  levelUps: number[];
  unlocks: string[];
  pointsAfter: number;
  levelAfter: number;
  tournament?: { name: string; round: string; eliminated?: boolean; champion?: boolean; prize?: number; part?: string };
  note?: string;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export function meetsRequirement(req: Requirement, s: SaveData): string[] {
  const missing: string[] = [];
  if (req.level && s.level < req.level) missing.push(`Reach level ${req.level}`);
  if (req.rep && s.reputation < req.rep) missing.push(`Reach ${req.rep} reputation`);
  for (const id of req.defeated ?? []) if (!s.rivals[id]?.defeated) missing.push(`Defeat ${RIVALS.find((r) => r.id === id)?.name ?? id}`);
  if (req.tournament && s.tournaments[req.tournament]?.wins < 1) missing.push(`Win the ${TOURNAMENT_MAP[req.tournament]?.name}`);
  return missing;
}

function applyXpRep(s: SaveData, xp: number, rep: number, sum: BattleSummary) {
  const r = addXp(s.level, s.xp, xp);
  s.level = r.level;
  s.xp = r.xp;
  s.reputation += Math.max(0, Math.round(rep));
  sum.xp += Math.round(xp);
  sum.rep += Math.round(rep);
  sum.levelUps.push(...r.levelUps);
  for (const l of r.levelUps) sum.unlocks.push(...unlocksAtLevel(l));
}

function baseSummary(s: SaveData, battleId: string, mode: BattleSummary['mode'], res: BattleResult, opponentName: string): BattleSummary {
  return {
    battleId, mode, won: res.winner === 0, finish: res.finish, time: res.time, stamina: res.stamina,
    playerName: s.config.name, opponentName, prize: 0, xp: 0, rep: 0, levelUps: [], unlocks: [], pointsAfter: s.points, levelAfter: s.level,
  };
}

/** Settle an official rival battle. Pure + idempotent per battleId. */
export function settleRivalBattle(save: SaveData, rival: RivalDef, res: BattleResult, battleId: string): { save: SaveData; summary: BattleSummary | null } {
  if (save.lastBattleId === battleId) return { save, summary: null };
  const s = clone(save);
  s.lastBattleId = battleId;
  const prog = s.rivals[rival.id];
  const sum = baseSummary(s, battleId, 'rival', res, rival.name);
  s.stats.battles++;
  if (res.winner === 0) {
    s.stats.wins++;
    s.stats.finishes[res.finish]++;
    prog.wins++;
    const enc = applyEncounterWin({ points: prog.points, defeated: prog.defeated }, res.finish);
    prog.points = enc.points;
    prog.defeated = enc.defeated;
    sum.encounter = { ...enc, total: enc.points };
    const t = transfer(s.points, prog.wallet, DEFAULT_TRANSFER);
    s.points = t.winnerAfter;
    prog.wallet = t.loserAfter;
    s.stats.pointsWon += t.amount;
    sum.transfer = { amount: t.amount, direction: t.amount > 0 ? 'gain' : 'none' };
    const mult = res.finish === 'BURST' ? 1.3 : res.finish === 'RING_OUT' ? 1.15 : 1;
    sum.prize = Math.round(rival.reward * mult);
    s.points += sum.prize;
    if (rival.special && !prog.bonusClaimed && rival.special.need.includes(res.finish)) {
      prog.bonusClaimed = true;
      s.points += rival.special.bonus;
      sum.bonus = { desc: rival.special.desc, points: rival.special.bonus, part: rival.special.part };
      if (rival.special.part && !s.owned.includes(rival.special.part)) s.owned.push(rival.special.part);
    }
    const di = DIFFICULTIES.indexOf(rival.difficulty);
    applyXpRep(s, XP_BASE[rival.difficulty] * FINISH_XP[res.finish], (2 + di * 2) * FINISH_POINTS[res.finish], sum);
  } else {
    s.stats.losses++;
    prog.losses++;
    const t = transfer(prog.wallet, s.points, DEFAULT_TRANSFER); // player is the loser
    s.points = t.loserAfter;
    prog.wallet = t.winnerAfter;
    s.stats.pointsLost += t.amount;
    sum.transfer = { amount: t.amount, direction: t.amount > 0 ? 'loss' : 'none' };
    applyXpRep(s, 12, 0, sum);
  }
  sum.pointsAfter = s.points;
  sum.levelAfter = s.level;
  return { save: s, summary: sum };
}

export function checkTournament(t: TournamentDef, s: SaveData): string[] {
  const m: string[] = [];
  if (s.level < t.req.level) m.push(`Reach level ${t.req.level}`);
  if (t.req.prev && s.tournaments[t.req.prev].wins < 1) m.push(`Win the ${TOURNAMENT_MAP[t.req.prev].name}`);
  const defeated = Object.values(s.rivals).filter((r) => r.defeated).length;
  if (defeated < t.req.rivals) m.push(`Defeat ${t.req.rivals} rivals (${defeated}/${t.req.rivals})`);
  if (t.req.points && s.points < t.req.points) m.push(`Hold ${t.req.points.toLocaleString()} points (qualification)`);
  if (s.points < t.fee) m.push(`Entry fee ${t.fee.toLocaleString()} points`);
  return m;
}

/** Settle one tournament match played by the player. */
export function settleTournamentMatch(save: SaveData, t: TournamentDef, res: BattleResult, battleId: string): { save: SaveData; summary: BattleSummary | null } {
  if (save.lastBattleId === battleId) return { save, summary: null };
  const s = clone(save);
  const rec = s.tournaments[t.id];
  const act = rec.active;
  if (!act || act.status !== 'active') return { save, summary: null };
  const nm = nextPlayerMatch(act);
  if (!nm) return { save, summary: null };
  s.lastBattleId = battleId;
  const pIdx = act.entrants.indexOf('player');
  const [a, b] = matchPair(act, nm.round, nm.match);
  const oppIdx = a === pIdx ? b! : a!;
  const winnerIdx = res.winner === 0 ? pIdx : oppIdx;
  let next = recordWinner(act, nm.round, nm.match, winnerIdx, res.finish);
  next = advanceAI(next);
  const sum = baseSummary(s, battleId, 'tournament', res, '');
  sum.tournament = { name: t.name, round: roundName(t.size, nm.round) };
  s.stats.battles++;
  if (res.winner === 0) {
    s.stats.wins++;
    s.stats.finishes[res.finish]++;
    const pts = 100 * t.tier;
    s.points += pts;
    sum.prize = pts;
    applyXpRep(s, t.xp * 0.12 * FINISH_XP[res.finish], t.tier * 3, sum);
    if (champion(next) === pIdx) {
      next = { ...next, status: 'won' };
      rec.wins++;
      s.points += t.prize;
      sum.prize += t.prize;
      applyXpRep(s, t.xp, t.rep, sum);
      sum.tournament.champion = true;
      sum.tournament.prize = t.prize;
      if (t.rewardPart) {
        sum.tournament.part = t.rewardPart;
        if (!s.owned.includes(t.rewardPart)) s.owned.push(t.rewardPart);
      }
      rec.history.push({ at: Date.now(), result: `Champion of the ${t.name}` });
    }
  } else {
    s.stats.losses++;
    next = { ...next, status: 'eliminated' };
    sum.tournament.eliminated = true;
    applyXpRep(s, 15 + t.tier * 5, 0, sum);
    rec.history.push({ at: Date.now(), result: `Eliminated in the ${roundName(t.size, nm.round)} of the ${t.name}` });
  }
  if (next.status === 'active' && isEliminated(next)) next = { ...next, status: 'eliminated' };
  rec.active = next;
  sum.pointsAfter = s.points;
  sum.levelAfter = s.level;
  return { save: s, summary: sum };
}

export function partName(id: string) { return PART_MAP[id]?.name ?? id; }
