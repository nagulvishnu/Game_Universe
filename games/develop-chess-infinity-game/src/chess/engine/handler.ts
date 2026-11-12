import { Position, search, rootScores, moveToUci, MATE } from "./core";
import { AI_LEVELS } from "../levels";

export type EngineRequest =
  | { id: number; kind: "move"; fen: string; level: number; timeMs?: number }
  | { id: number; kind: "eval"; fen: string; depth: number; timeMs: number }
  | { id: number; kind: "analyze"; fens: string[]; depth: number; timeMs: number };
export interface EvalResult { uci: string | null; score: number; depth: number }

const clampCp = (s: number) => Math.max(-1500, Math.min(1500, s));
export const isMateScore = (s: number) => Math.abs(s) > MATE - 200;

export function moveForLevel(fen: string, levelId: number, timeCap?: number): EvalResult {
  const lvl = AI_LEVELS[Math.max(0, Math.min(4, levelId - 1))];
  const pos = Position.fromFen(fen);
  const legal = pos.legal();
  if (legal.length === 0) return { uci: null, score: 0, depth: 0 };
  const time = Math.min(lvl.timeMs, timeCap ?? lvl.timeMs);
  if (Math.random() < lvl.random) return { uci: moveToUci(legal[Math.floor(Math.random() * legal.length)]), score: 0, depth: 0 };
  if (lvl.multi) {
    const roots = rootScores(pos, lvl.depth, Math.max(150, time));
    const best = roots[0].score;
    if (lvl.temp <= 0) return { uci: moveToUci(roots[0].move), score: best, depth: lvl.depth };
    // never walk into a mate the engine can see, unless every move loses
    const pool = roots.filter((r) => r.score > -MATE + 500 || best <= -MATE + 500);
    const weights = pool.map((r) => Math.exp(Math.max(-30, (r.score - best) / lvl.temp)));
    const sum = weights.reduce((a, b) => a + b, 0);
    let x = Math.random() * sum; let pick = pool[0];
    for (let i = 0; i < pool.length; i++) { x -= weights[i]; if (x <= 0) { pick = pool[i]; break; } }
    return { uci: moveToUci(pick.move), score: best, depth: lvl.depth };
  }
  const r = search(pos, lvl.depth, Math.max(200, time));
  return { uci: r.move ? moveToUci(r.move) : moveToUci(legal[0]), score: r.score, depth: r.depth };
}

export function evalFen(fen: string, depth: number, timeMs: number): EvalResult {
  const pos = Position.fromFen(fen);
  const r = search(pos, depth, timeMs);
  return { uci: r.move ? moveToUci(r.move) : null, score: clampCp(r.score), depth: r.depth };
}

export function handle(req: EngineRequest, progress?: (done: number, total: number) => void): unknown {
  if (req.kind === "move") return moveForLevel(req.fen, req.level, req.timeMs);
  if (req.kind === "eval") return evalFen(req.fen, req.depth, req.timeMs);
  const out: EvalResult[] = [];
  req.fens.forEach((f, i) => { out.push(evalFen(f, req.depth, req.timeMs)); progress?.(i + 1, req.fens.length); });
  return out;
}
