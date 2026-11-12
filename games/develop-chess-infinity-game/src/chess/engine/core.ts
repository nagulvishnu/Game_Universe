/* Chess Infinity — compact 0x88 engine core: move generation, evaluation, search, mate solver.
   Used by the AI worker, post-game analysis and puzzle verification. Game rules shown to the
   player are enforced by chess.js; this module is independently validated against perft. */

export const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
const CAP = 1, EP = 2, CK = 4, CQ = 8, DP = 16;
const KN = [33, 31, 18, 14, -33, -31, -18, -14];
const KG = [1, -1, 16, -16, 17, 15, -17, -15];
const BD = [17, 15, -17, -15];
const RD = [1, -1, 16, -16];
const TYPE_CH = ".pnbrqk";
const CASTLE_MASK = new Int8Array(128).fill(15);
CASTLE_MASK[4] = 12; CASTLE_MASK[0] = 13; CASTLE_MASK[7] = 14;
CASTLE_MASK[116] = 3; CASTLE_MASK[112] = 7; CASTLE_MASK[119] = 11;

export const mFrom = (m: number) => m & 127;
export const mTo = (m: number) => (m >> 7) & 127;
export const mPromo = (m: number) => (m >> 14) & 7;
export const mFlags = (m: number) => m >> 17;
const mk = (f: number, t: number, promo = 0, flags = 0) => f | (t << 7) | (promo << 14) | (flags << 17);

export const sqName = (s: number) => "abcdefgh"[s & 15] + ((s >> 4) + 1);
export const nameSq = (n: string) => (n.charCodeAt(0) - 97) + (parseInt(n[1]) - 1) * 16;
export const moveToUci = (m: number) => sqName(mFrom(m)) + sqName(mTo(m)) + (mPromo(m) ? TYPE_CH[mPromo(m)] : "");

export class Position {
  b = new Int8Array(128);
  side = 0; castle = 0; ep = -1; half = 0; full = 1;
  ksq = [4, 116];
  stM: number[] = []; stCap: number[] = []; stCastle: number[] = []; stEp: number[] = []; stHalf: number[] = [];
  nullStack: number[] = [];

  static fromFen(fen: string): Position {
    const p = new Position();
    const parts = fen.trim().split(/\s+/);
    const rows = parts[0].split("/");
    rows.forEach((row, i) => {
      let f = 0; const rank = 7 - i;
      for (const ch of row) {
        if (/\d/.test(ch)) { f += parseInt(ch); continue; }
        const white = ch === ch.toUpperCase();
        const t = TYPE_CH.indexOf(ch.toLowerCase());
        const sq = rank * 16 + f;
        p.b[sq] = t | (white ? 0 : 8);
        if (t === KING) p.ksq[white ? 0 : 1] = sq;
        f++;
      }
    });
    p.side = parts[1] === "b" ? 1 : 0;
    const c = parts[2] || "-";
    p.castle = (c.includes("K") ? 1 : 0) | (c.includes("Q") ? 2 : 0) | (c.includes("k") ? 4 : 0) | (c.includes("q") ? 8 : 0);
    p.ep = parts[3] && parts[3] !== "-" ? nameSq(parts[3]) : -1;
    p.half = parseInt(parts[4] || "0") || 0;
    p.full = parseInt(parts[5] || "1") || 1;
    return p;
  }

  isAttacked(sq: number, by: number): boolean {
    const b = this.b; const c = by << 3;
    if (by === 0) {
      let s = sq - 15; if (!(s & 0x88) && b[s] === PAWN) return true;
      s = sq - 17; if (!(s & 0x88) && b[s] === PAWN) return true;
    } else {
      let s = sq + 15; if (!(s & 0x88) && b[s] === (PAWN | 8)) return true;
      s = sq + 17; if (!(s & 0x88) && b[s] === (PAWN | 8)) return true;
    }
    for (const d of KN) { const s = sq + d; if (!(s & 0x88) && b[s] === (KNIGHT | c)) return true; }
    for (const d of KG) { const s = sq + d; if (!(s & 0x88) && b[s] === (KING | c)) return true; }
    for (const d of BD) {
      let s = sq + d;
      while (!(s & 0x88)) { const p = b[s]; if (p) { if (p === (BISHOP | c) || p === (QUEEN | c)) return true; break; } s += d; }
    }
    for (const d of RD) {
      let s = sq + d;
      while (!(s & 0x88)) { const p = b[s]; if (p) { if (p === (ROOK | c) || p === (QUEEN | c)) return true; break; } s += d; }
    }
    return false;
  }

  inCheck(side = this.side) { return this.isAttacked(this.ksq[side], side ^ 1); }

  gen(capsOnly = false): number[] {
    const out: number[] = []; const b = this.b; const us = this.side; const them = us ^ 1;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = b[sq];
      if (!p || (p >> 3) !== us) continue;
      const t = p & 7;
      if (t === PAWN) {
        const dir = us === 0 ? 16 : -16; const r = sq >> 4;
        const promoRank = us === 0 ? 6 : 1; const startRank = us === 0 ? 1 : 6;
        const one = sq + dir;
        if (!(one & 0x88) && !b[one]) {
          if (r === promoRank) {
            out.push(mk(sq, one, QUEEN));
            if (!capsOnly) { out.push(mk(sq, one, ROOK)); out.push(mk(sq, one, BISHOP)); out.push(mk(sq, one, KNIGHT)); }
          } else if (!capsOnly) {
            out.push(mk(sq, one));
            if (r === startRank && !b[one + dir]) out.push(mk(sq, one + dir, 0, DP));
          }
        }
        for (const d of us === 0 ? [15, 17] : [-15, -17]) {
          const to = sq + d; if (to & 0x88) continue;
          const tp = b[to];
          if (tp && (tp >> 3) === them) {
            if (r === promoRank) { for (const pr of [QUEEN, ROOK, BISHOP, KNIGHT]) out.push(mk(sq, to, pr, CAP)); }
            else out.push(mk(sq, to, 0, CAP));
          } else if (!tp && to === this.ep) out.push(mk(sq, to, 0, CAP | EP));
        }
      } else if (t === KNIGHT || t === KING) {
        for (const d of t === KNIGHT ? KN : KG) {
          const to = sq + d; if (to & 0x88) continue;
          const tp = b[to];
          if (!tp) { if (!capsOnly) out.push(mk(sq, to)); }
          else if ((tp >> 3) === them) out.push(mk(sq, to, 0, CAP));
        }
        if (t === KING && !capsOnly) {
          if (us === 0 && sq === 4) {
            if ((this.castle & 1) && !b[5] && !b[6] && b[7] === ROOK && !this.isAttacked(4, 1) && !this.isAttacked(5, 1) && !this.isAttacked(6, 1)) out.push(mk(4, 6, 0, CK));
            if ((this.castle & 2) && !b[3] && !b[2] && !b[1] && b[0] === ROOK && !this.isAttacked(4, 1) && !this.isAttacked(3, 1) && !this.isAttacked(2, 1)) out.push(mk(4, 2, 0, CQ));
          } else if (us === 1 && sq === 116) {
            const BR = ROOK | 8;
            if ((this.castle & 4) && !b[117] && !b[118] && b[119] === BR && !this.isAttacked(116, 0) && !this.isAttacked(117, 0) && !this.isAttacked(118, 0)) out.push(mk(116, 118, 0, CK));
            if ((this.castle & 8) && !b[115] && !b[114] && !b[113] && b[112] === BR && !this.isAttacked(116, 0) && !this.isAttacked(115, 0) && !this.isAttacked(114, 0)) out.push(mk(116, 114, 0, CQ));
          }
        }
      } else {
        const dirs = t === BISHOP ? BD : t === ROOK ? RD : KG;
        for (const d of dirs) {
          let to = sq + d;
          while (!(to & 0x88)) {
            const tp = b[to];
            if (!tp) { if (!capsOnly) out.push(mk(sq, to)); }
            else { if ((tp >> 3) === them) out.push(mk(sq, to, 0, CAP)); break; }
            to += d;
          }
        }
      }
    }
    return out;
  }

  make(m: number) {
    const b = this.b; const from = mFrom(m), to = mTo(m), promo = mPromo(m), flags = mFlags(m);
    const us = this.side; const p = b[from];
    let cap = b[to];
    this.stM.push(m); this.stCastle.push(this.castle); this.stEp.push(this.ep); this.stHalf.push(this.half);
    if (flags & EP) { const cs = to + (us === 0 ? -16 : 16); cap = b[cs]; b[cs] = 0; }
    this.stCap.push(cap);
    b[to] = promo ? (promo | (us << 3)) : p; b[from] = 0;
    if (flags & CK) { b[to - 1] = b[to + 1]; b[to + 1] = 0; }
    else if (flags & CQ) { b[to + 1] = b[to - 2]; b[to - 2] = 0; }
    if ((p & 7) === KING) this.ksq[us] = to;
    this.half = ((p & 7) === PAWN || cap) ? 0 : this.half + 1;
    this.ep = flags & DP ? (from + to) >> 1 : -1;
    this.castle &= CASTLE_MASK[from] & CASTLE_MASK[to];
    this.side ^= 1; if (us === 1) this.full++;
  }

  unmake() {
    const b = this.b; const m = this.stM.pop()!; const cap = this.stCap.pop()!;
    this.castle = this.stCastle.pop()!; this.ep = this.stEp.pop()!; this.half = this.stHalf.pop()!;
    const from = mFrom(m), to = mTo(m), promo = mPromo(m), flags = mFlags(m);
    this.side ^= 1; const us = this.side;
    const p = promo ? (PAWN | (us << 3)) : b[to];
    b[from] = p;
    if (flags & EP) { b[to] = 0; b[to + (us === 0 ? -16 : 16)] = cap; } else b[to] = cap;
    if (flags & CK) { b[to + 1] = b[to - 1]; b[to - 1] = 0; }
    else if (flags & CQ) { b[to - 2] = b[to + 1]; b[to + 1] = 0; }
    if ((p & 7) === KING) this.ksq[us] = from;
    if (us === 1) this.full--;
  }

  makeNull() { this.nullStack.push(this.ep); this.ep = -1; this.side ^= 1; }
  unmakeNull() { this.side ^= 1; this.ep = this.nullStack.pop()!; }

  legal(): number[] {
    const res: number[] = []; const us = this.side;
    for (const m of this.gen()) {
      this.make(m);
      if (!this.isAttacked(this.ksq[us], us ^ 1)) res.push(m);
      this.unmake();
    }
    return res;
  }

  findMove(uci: string): number | null {
    for (const m of this.legal()) if (moveToUci(m) === uci) return m;
    return null;
  }
}

export function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  let n = 0; const us = pos.side;
  for (const m of pos.gen()) {
    pos.make(m);
    if (!pos.isAttacked(pos.ksq[us], us ^ 1)) n += depth === 1 ? 1 : perft(pos, depth - 1);
    pos.unmake();
  }
  return n;
}

/* ---------------- Evaluation ---------------- */
const VAL = [0, 100, 320, 330, 500, 900, 0];
const PST: number[][] = [
  [],
  [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
];
const KING_END = [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50];

export function evaluate(pos: Position): number {
  const b = pos.b; let score = 0; let npm = 0;
  const bishops = [0, 0]; const pawns = [0, 0];
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) { sq += 7; continue; }
    const p = b[sq]; if (!p) continue;
    const t = p & 7; if (t !== PAWN && t !== KING) npm += VAL[t];
  }
  const endgame = npm <= 2600;
  const mat = [0, 0];
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) { sq += 7; continue; }
    const p = b[sq]; if (!p) continue;
    const t = p & 7; const c = p >> 3; const f = sq & 15; const r = sq >> 4;
    const idx = c === 0 ? (7 - r) * 8 + f : r * 8 + f;
    const table = t === KING && endgame ? KING_END : PST[t];
    const v = VAL[t] + table[idx];
    if (t !== KING) mat[c] += VAL[t];
    if (t === BISHOP) bishops[c]++;
    if (t === PAWN) pawns[c]++;
    score += c === 0 ? v : -v;
  }
  if (bishops[0] >= 2) score += 30;
  if (bishops[1] >= 2) score -= 30;
  // mop-up: drive the lone king to the edge when far ahead
  const diff = mat[0] - mat[1];
  if (Math.abs(diff) >= 300 && endgame) {
    const win = diff > 0 ? 0 : 1; const lose = win ^ 1;
    if (pawns[lose] === 0 || Math.abs(diff) >= 800) {
      const lk = pos.ksq[lose], wk = pos.ksq[win];
      const lf = lk & 15, lr = lk >> 4, wf = wk & 15, wr = wk >> 4;
      const centre = Math.abs(lf - 3.5) + Math.abs(lr - 3.5);
      const dist = Math.abs(lf - wf) + Math.abs(lr - wr);
      const bonus = Math.round(centre * 12 + (14 - dist) * 6);
      score += win === 0 ? bonus : -bonus;
    }
  }
  return pos.side === 0 ? score : -score;
}

/* ---------------- Search ---------------- */
export const MATE = 30000;
const INF = 32000;

export interface SearchResult { move: number | null; score: number; depth: number; nodes: number }

class Searcher {
  nodes = 0; stop = false; deadline = 0;
  killers: number[][] = Array.from({ length: 128 }, () => [0, 0]);
  hist = new Int32Array(2 * 128 * 128);
  pv0 = 0;
  constructor(public pos: Position) {}

  hasPieces(side: number) {
    const b = this.pos.b;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = b[sq]; if (p && (p >> 3) === side) { const t = p & 7; if (t > PAWN && t < KING) return true; }
    }
    return false;
  }

  score(m: number, ply: number): number {
    const b = this.pos.b; const fl = mFlags(m);
    if (ply === 0 && m === this.pv0) return 1e7;
    let s = 0;
    if (fl & CAP) {
      const victim = fl & EP ? PAWN : (b[mTo(m)] & 7);
      s = 10000 + VAL[victim] * 10 - VAL[b[mFrom(m)] & 7] / 10;
    } else {
      if (m === this.killers[ply][0]) s = 9000; else if (m === this.killers[ply][1]) s = 8000;
      else s = this.hist[(this.pos.side * 128 + mFrom(m)) * 128 + mTo(m)];
    }
    if (mPromo(m)) s += 9500 + VAL[mPromo(m)];
    return s;
  }

  order(moves: number[], ply: number) {
    const sc = moves.map((m) => this.score(m, ply));
    const idx = moves.map((_, i) => i).sort((a, b) => sc[b] - sc[a]);
    return idx.map((i) => moves[i]);
  }

  qsearch(alpha: number, beta: number, ply: number): number {
    const pos = this.pos;
    if ((++this.nodes & 2047) === 0 && Date.now() > this.deadline) this.stop = true;
    if (this.stop) return 0;
    const stand = evaluate(pos);
    if (stand >= beta) return beta;
    if (ply >= 100) return stand;
    if (stand > alpha) alpha = stand;
    const us = pos.side;
    for (const m of this.order(pos.gen(true), ply)) {
      pos.make(m);
      if (pos.isAttacked(pos.ksq[us], us ^ 1)) { pos.unmake(); continue; }
      const s = -this.qsearch(-beta, -alpha, ply + 1);
      pos.unmake();
      if (this.stop) return 0;
      if (s >= beta) return beta;
      if (s > alpha) alpha = s;
    }
    return alpha;
  }

  negamax(depth: number, alpha: number, beta: number, ply: number, allowNull: boolean): number {
    const pos = this.pos;
    if ((++this.nodes & 2047) === 0 && Date.now() > this.deadline) this.stop = true;
    if (this.stop) return 0;
    const us = pos.side;
    const inChk = pos.inCheck();
    if (inChk && ply < 60) depth++;
    if (depth <= 0) return this.qsearch(alpha, beta, ply);
    if (ply > 0 && pos.half >= 100) return 0;
    if (allowNull && !inChk && depth >= 3 && ply > 0 && this.hasPieces(us)) {
      pos.makeNull();
      const s = -this.negamax(depth - 3, -beta, -beta + 1, ply + 1, false);
      pos.unmakeNull();
      if (this.stop) return 0;
      if (s >= beta) return beta;
    }
    let legal = 0; let best = -INF;
    for (const m of this.order(pos.gen(), ply)) {
      pos.make(m);
      if (pos.isAttacked(pos.ksq[us], us ^ 1)) { pos.unmake(); continue; }
      legal++;
      let s: number;
      const quiet = !(mFlags(m) & CAP) && !mPromo(m);
      if (legal > 4 && depth >= 3 && quiet && !inChk) {
        s = -this.negamax(depth - 2, -alpha - 1, -alpha, ply + 1, true);
        if (s > alpha) s = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
      } else s = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
      pos.unmake();
      if (this.stop) return 0;
      if (s > best) best = s;
      if (s > alpha) {
        alpha = s;
        if (alpha >= beta) {
          if (quiet) {
            if (this.killers[ply][0] !== m) { this.killers[ply][1] = this.killers[ply][0]; this.killers[ply][0] = m; }
            this.hist[(us * 128 + mFrom(m)) * 128 + mTo(m)] += depth * depth;
          }
          break;
        }
      }
    }
    if (legal === 0) return inChk ? -MATE + ply : 0;
    return best;
  }
}

export function search(pos: Position, maxDepth: number, timeMs: number): SearchResult {
  const s = new Searcher(pos);
  s.deadline = Date.now() + timeMs;
  const legal = pos.legal();
  if (legal.length === 0) return { move: null, score: pos.inCheck() ? -MATE : 0, depth: 0, nodes: 0 };
  let best = legal[0]; let bestScore = 0; let done = 0;
  for (let d = 1; d <= maxDepth; d++) {
    s.pv0 = best;
    let alpha = -INF; let iterBest = 0; let iterScore = -INF;
    for (const m of s.order(legal, 0)) {
      pos.make(m);
      const sc = -s.negamax(d - 1, -INF, -alpha, 1, true);
      pos.unmake();
      if (s.stop) break;
      if (sc > iterScore) { iterScore = sc; iterBest = m; }
      if (sc > alpha) alpha = sc;
    }
    if (s.stop) { break; }
    best = iterBest; bestScore = iterScore; done = d;
    if (Math.abs(bestScore) > MATE - 100) break;
  }
  return { move: best, score: bestScore, depth: done, nodes: s.nodes };
}

/** Score every legal root move at a fixed depth (used for weaker AI levels and puzzle verification). */
export function rootScores(pos: Position, depth: number, timeMs = 4000): { move: number; score: number }[] {
  const s = new Searcher(pos); s.deadline = Date.now() + timeMs;
  const res: { move: number; score: number }[] = [];
  for (const m of pos.legal()) {
    pos.make(m);
    const sc = -s.negamax(depth - 1, -INF, INF, 1, true);
    pos.unmake();
    res.push({ move: m, score: sc });
  }
  return res.sort((a, b) => b.score - a.score);
}

/* ---------------- Mate solver ---------------- */
export function allRepliesMated(pos: Position, n: number): boolean {
  const moves = pos.legal();
  if (moves.length === 0) return pos.inCheck();
  for (const m of moves) {
    pos.make(m);
    const ok = canMate(pos, n);
    pos.unmake();
    if (!ok) return false;
  }
  return true;
}
/** Side to move can force mate within n of its own moves. */
export function canMate(pos: Position, n: number): boolean {
  if (n <= 0) return false;
  for (const m of pos.legal()) {
    pos.make(m);
    const replies = pos.legal();
    let ok: boolean;
    if (replies.length === 0) ok = pos.inCheck();
    else if (n <= 1) ok = false;
    else ok = allRepliesMated(pos, n - 1);
    pos.unmake();
    if (ok) return true;
  }
  return false;
}
/** All first moves (uci) that force mate within n moves. */
export function mateMoves(fen: string, n: number): string[] {
  const pos = Position.fromFen(fen); const res: string[] = [];
  for (const m of pos.legal()) {
    pos.make(m);
    const replies = pos.legal();
    let ok: boolean;
    if (replies.length === 0) ok = pos.inCheck();
    else if (n <= 1) ok = false;
    else ok = allRepliesMated(pos, n - 1);
    pos.unmake();
    if (ok) res.push(moveToUci(m));
  }
  return res;
}
/** Smallest n <= maxN for which the side to move has a forced mate, else null. */
export function mateDistance(fen: string, maxN = 3): number | null {
  for (let n = 1; n <= maxN; n++) if (mateMoves(fen, n).length) return n;
  return null;
}
/** Opponent reply that resists longest after a mating first move (fen = position after our move). */
export function stubbornReply(fen: string, remaining: number): string | null {
  const pos = Position.fromFen(fen); const moves = pos.legal();
  if (!moves.length) return null;
  let best: string | null = null; let bestN = -1;
  for (const m of moves) {
    pos.make(m);
    let n = 1; while (n <= remaining && !canMate(pos, n)) n++;
    pos.unmake();
    if (n > bestN) { bestN = n; best = moveToUci(m); }
  }
  return best;
}
