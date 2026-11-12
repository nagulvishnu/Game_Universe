import { useCallback, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import type { Move } from "chess.js";
import { START_FEN, kingSquare, safeChess, trackPieces } from "./rules";
import type { Color, PType } from "./rules";
import type { BoardFx } from "./Board";
import { sfx } from "./audio";

/** A lightweight interactive board used by puzzles, training and the opening explorer. */
export function useFreeBoard(initialFen: string, opts: { autoQueen: boolean; onUserMove?: (mv: Move) => void }) {
  const [startFen, setStartFen] = useState(initialFen);
  const chessRef = useRef<Chess>(safeChess(initialFen));
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<{ from: string; to: string } | null>(null);
  const [player, setPlayer] = useState<Color | null>(null);
  const [hint, setHint] = useState<{ from: string; to?: string } | null>(null);
  const [fx, setFx] = useState<BoardFx | null>(null);
  const lock = useRef(0);
  const optsRef = useRef(opts); optsRef.current = opts;
  const chess = chessRef.current;

  const moves = useMemo(() => chess.history({ verbose: true }), [tick, chess]); // eslint-disable-line react-hooks/exhaustive-deps
  const pieces = useMemo(() => trackPieces(startFen, moves), [startFen, moves]);
  const last = moves[moves.length - 1] ?? null;
  const checkSquare = last && /[+#]$/.test(last.san) ? kingSquare(pieces, last.color === "w" ? "b" : "w") ?? null : null;
  const mateSquare = last && last.san.endsWith("#") ? checkSquare : null;

  const reset = useCallback((fen: string = START_FEN, who: Color | null = null) => {
    chessRef.current = safeChess(fen); setStartFen(fen); setSelected(null); setPending(null); setHint(null); setPlayer(who); setTick((t) => t + 1);
  }, []);
  /** replace position by replaying SAN moves from a start FEN (keeps piece ids stable for animation) */
  const setLine = useCallback((sans: string[], fen: string = START_FEN) => {
    const c = safeChess(fen);
    for (const s of sans) { try { c.move(s); } catch { break; } }
    chessRef.current = c; setStartFen(fen); setSelected(null); setPending(null); setHint(null); setTick((t) => t + 1);
  }, []);

  const apply = useCallback((from: string, to: string, promotion?: string, user = false): Move | null => {
    if (Date.now() < lock.current) return null;
    let mv: Move;
    try { mv = chessRef.current.move({ from, to, promotion }); } catch { return null; }
    lock.current = Date.now() + 190;
    setSelected(null); setPending(null); setHint(null);
    if (mv.promotion) { sfx.promote(); setFx({ key: mv.san + tick, square: mv.to, kind: "promote" }); }
    else if (mv.captured) { sfx.capture(); setFx({ key: mv.san + tick, square: mv.to, kind: "capture" }); }
    else if (mv.flags.includes("k") || mv.flags.includes("q")) sfx.castle(); else sfx.move();
    if (/[+]$/.test(mv.san)) setTimeout(() => sfx.check(), 120);
    setTick((t) => t + 1);
    if (user) optsRef.current.onUserMove?.(mv);
    return mv;
  }, [tick]);

  const play = useCallback((uci: string) => { lock.current = 0; return apply(uci.slice(0, 2), uci.slice(2, 4), uci[4]); }, [apply]);
  const undo = useCallback(() => { chessRef.current.undo(); setSelected(null); setTick((t) => t + 1); }, []);

  const turn = chess.turn();
  const interactiveColor: Color | null = player && player === turn && !pending ? player : null;

  const select = useCallback((sq: string | null) => {
    if (!sq) { setSelected(null); return; }
    const p = chessRef.current.get(sq as never);
    if (!p || p.color !== player || p.color !== chessRef.current.turn()) { setSelected(null); return; }
    setSelected(sq); sfx.click();
  }, [player]);
  const targets = useMemo(() => {
    const t: Record<string, boolean> = {};
    if (selected) for (const m of chessRef.current.moves({ square: selected as never, verbose: true })) t[m.to] = m.flags.includes("c") || m.flags.includes("e");
    return t;
  }, [selected, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const tryMove = useCallback((from: string, to: string) => {
    const c = chessRef.current.moves({ square: from as never, verbose: true }).filter((m) => m.to === to);
    if (!c.length) { sfx.error(); return; }
    if (c[0].promotion) { if (optsRef.current.autoQueen) apply(from, to, "q", true); else setPending({ from, to }); return; }
    apply(from, to, undefined, true);
  }, [apply]);
  const promote = useCallback((p: PType) => { if (pending) apply(pending.from, pending.to, p, true); }, [pending, apply]);

  return { chess, startFen, moves, pieces, last, checkSquare, mateSquare, selected, targets, pending, hint, fx, turn, interactiveColor, tick,
    reset, setLine, play, undo, select, tryMove, promote, cancelPromotion: () => setPending(null), setHint, setPlayer, fen: chess.fen() };
}
export type FreeBoard = ReturnType<typeof useFreeBoard>;
