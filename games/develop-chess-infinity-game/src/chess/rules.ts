import { Chess } from "chess.js";
import type { Move } from "chess.js";

export type Color = "w" | "b";
export type PType = "p" | "n" | "b" | "r" | "q" | "k";
export interface TPiece { id: string; type: PType; color: Color; square: string }
export type EndKind = "checkmate" | "stalemate" | "resign" | "timeout" | "agreement" | "insufficient" | "fivefold" | "seventyfive" | "threefold" | "fifty";
export interface GameResult { kind: EndKind; winner: Color | null; text: string }

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
export const FILES = "abcdefgh";
export const PIECE_VALUE: Record<PType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const colorName = (c: Color) => (c === "w" ? "White" : "Black");

export const posKey = (fen: string) => fen.split(" ").slice(0, 3).join(" ");
export const halfmoveClock = (fen: string) => parseInt(fen.split(" ")[4] || "0") || 0;

export function repetitionCount(chess: Chess, startFen: string): number {
  const keys = [posKey(startFen), ...chess.history({ verbose: true }).map((m) => posKey(m.after))];
  const cur = posKey(chess.fen());
  return keys.filter((k) => k === cur).length;
}

/** Automatic game-ending conditions (no player claim required). */
export function gameStatus(chess: Chess, startFen: string): GameResult | null {
  if (chess.isCheckmate()) {
    const winner: Color = chess.turn() === "w" ? "b" : "w";
    return { kind: "checkmate", winner, text: `Checkmate — ${colorName(winner)} wins` };
  }
  if (chess.isStalemate()) return { kind: "stalemate", winner: null, text: "Draw by stalemate" };
  if (chess.isInsufficientMaterial()) return { kind: "insufficient", winner: null, text: "Draw — insufficient material" };
  if (repetitionCount(chess, startFen) >= 5) return { kind: "fivefold", winner: null, text: "Draw by fivefold repetition" };
  if (halfmoveClock(chess.fen()) >= 150) return { kind: "seventyfive", winner: null, text: "Draw by the seventy-five-move rule" };
  return null;
}

export function claimable(chess: Chess, startFen: string): { threefold: boolean; fifty: boolean } {
  return { threefold: repetitionCount(chess, startFen) >= 3, fifty: halfmoveClock(chess.fen()) >= 100 };
}

const squareColor = (sq: string) => (FILES.indexOf(sq[0]) + parseInt(sq[1])) % 2;

/** Can `color` still deliver checkmate by any sequence of legal moves (FIDE timeout rule)? */
export function hasMatingMaterial(chess: Chess, color: Color): boolean {
  const all = chess.board().flat().filter(Boolean) as { type: PType; color: Color; square: string }[];
  const mine = all.filter((p) => p.color === color && p.type !== "k");
  const theirs = all.filter((p) => p.color !== color && p.type !== "k");
  if (mine.some((p) => p.type === "p" || p.type === "r" || p.type === "q")) return true;
  if (mine.length >= 2) {
    const onlyBishops = mine.every((p) => p.type === "b") && theirs.every((p) => p.type === "b");
    if (onlyBishops) {
      const cols = new Set([...mine, ...theirs].map((p) => squareColor(p.square)));
      if (cols.size === 1) return false;
    }
    return true;
  }
  if (mine.length === 0) return false;
  if (theirs.length === 0) return false;
  if (mine[0].type === "b" && theirs.every((p) => p.type === "b" && squareColor(p.square) === squareColor(mine[0].square))) return false;
  return true;
}

export function timeoutResult(chess: Chess, loser: Color): GameResult {
  const winner: Color = loser === "w" ? "b" : "w";
  if (hasMatingMaterial(chess, winner)) return { kind: "timeout", winner, text: `${colorName(loser)} ran out of time — ${colorName(winner)} wins` };
  return { kind: "timeout", winner: null, text: `${colorName(loser)} ran out of time, but ${colorName(winner)} cannot mate — draw` };
}

/* ---------- piece tracking (stable ids for smooth animation) ---------- */
export function initialPieces(fen: string): TPiece[] {
  const out: TPiece[] = [];
  fen.split(" ")[0].split("/").forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) { f += parseInt(ch); continue; }
      const sq = FILES[f] + (8 - i);
      out.push({ id: `i${sq}`, type: ch.toLowerCase() as PType, color: ch === ch.toUpperCase() ? "w" : "b", square: sq });
      f++;
    }
  });
  return out;
}

export function applyMoveToPieces(pieces: TPiece[], m: Pick<Move, "from" | "to" | "flags" | "promotion">): TPiece[] {
  const capSq = m.flags.includes("e") ? m.to[0] + m.from[1] : m.to;
  let next = pieces.filter((p) => p.square !== capSq);
  next = next.map((p) => {
    if (p.square === m.from) return { ...p, square: m.to, type: (m.promotion ?? p.type) as PType };
    if (m.flags.includes("k") && p.type === "r" && p.square === "h" + m.from[1]) return { ...p, square: "f" + m.from[1] };
    if (m.flags.includes("q") && p.type === "r" && p.square === "a" + m.from[1]) return { ...p, square: "d" + m.from[1] };
    return p;
  });
  return next;
}

export function trackPieces(startFen: string, moves: Pick<Move, "from" | "to" | "flags" | "promotion">[]): TPiece[] {
  let pcs = initialPieces(startFen);
  for (const m of moves) pcs = applyMoveToPieces(pcs, m);
  return pcs;
}

export function capturedBy(moves: Move[]): { w: PType[]; b: PType[] } {
  const res: { w: PType[]; b: PType[] } = { w: [], b: [] };
  for (const m of moves) if (m.captured) res[m.color].push(m.captured as PType);
  const order: PType[] = ["q", "r", "b", "n", "p"];
  res.w.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  res.b.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return res;
}

export function materialOf(pieces: TPiece[]): { w: number; b: number } {
  const r = { w: 0, b: 0 };
  for (const p of pieces) r[p.color] += PIECE_VALUE[p.type];
  return r;
}

export function kingSquare(pieces: TPiece[], color: Color) {
  return pieces.find((p) => p.type === "k" && p.color === color)?.square;
}

export function safeChess(fen?: string): Chess {
  try { return fen ? new Chess(fen) : new Chess(); } catch { return new Chess(); }
}

export function formatClock(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalTenths = Math.floor(ms / 100);
  const s = Math.floor(totalTenths / 10);
  if (ms < 10000) return `0:0${s}.${totalTenths % 10}`;
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
