import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import type { Move } from "chess.js";
import { START_FEN, capturedBy, claimable, colorName, gameStatus, kingSquare, materialOf, timeoutResult, trackPieces, repetitionCount, safeChess } from "./rules";
import type { Color, GameResult, PType } from "./rules";
import { aiMove, cancelAI, evalPosition } from "./engine/ai";
import { sfx } from "./audio";
import type { BoardFx } from "./Board";

export interface GameConfig {
  kind: "local" | "ai" | "time";
  opponent: "human" | "ai";
  aiLevel: number;
  humanColor: Color;
  clock: { base: number; inc: number } | null; // seconds
  startFen?: string;
  pgn?: string;
  blindfold?: boolean;
  imported?: boolean;
  names: { w: string; b: string };
}
export interface FinishInfo { moves: Move[]; pgn: string; duration: number }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useGame(cfg: GameConfig, opts: { autoQueen: boolean; animations: boolean; onFinish: (r: GameResult, info: FinishInfo) => void }) {
  const init = useRef<{ chess: Chess; startFen: string } | null>(null);
  if (!init.current) {
    let chess: Chess; let startFen = cfg.startFen ?? START_FEN;
    if (cfg.pgn) {
      chess = new Chess(); chess.loadPgn(cfg.pgn);
      startFen = chess.history({ verbose: true })[0]?.before ?? chess.fen();
    } else chess = safeChess(cfg.startFen);
    init.current = { chess, startFen };
  }
  const { chess, startFen } = init.current;
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);
  const redo = useRef<Move[]>([]);
  const [result, setResult] = useState<GameResult | null>(null);
  const resultRef = useRef<GameResult | null>(null);
  const [view, setView] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<{ from: string; to: string } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [fx, setFx] = useState<BoardFx | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lock = useRef(0);
  const startedAt = useRef(Date.now());
  const optsRef = useRef(opts); optsRef.current = opts;

  const base = cfg.clock ? cfg.clock.base * 1000 : 0; const inc = cfg.clock ? cfg.clock.inc * 1000 : 0;
  const clk = useRef({ w: base, b: base, turnStart: 0, running: false });
  const [clocks, setClocks] = useState({ w: base, b: base });

  const moves = useMemo(() => chess.history({ verbose: true }), [chess, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const live = view === null;
  const shown = live ? moves : moves.slice(0, view);
  const pieces = useMemo(() => trackPieces(startFen, shown), [startFen, shown.length, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastShown = shown[shown.length - 1] ?? null;
  const captured = useMemo(() => capturedBy(shown), [shown.length, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const material = materialOf(pieces);
  const checkSquare = lastShown && /[+#]$/.test(lastShown.san) ? kingSquare(pieces, lastShown.color === "w" ? "b" : "w") ?? null : null;
  const mateSquare = lastShown && lastShown.san.endsWith("#") ? checkSquare : null;
  const turn = chess.turn();

  const getPgn = useCallback((r?: GameResult | null) => {
    try {
      chess.setHeader("Event", "Chess Infinity"); chess.setHeader("Site", "Chess Infinity");
      chess.setHeader("Date", new Date().toISOString().slice(0, 10).replace(/-/g, "."));
      chess.setHeader("White", cfg.names.w); chess.setHeader("Black", cfg.names.b);
      const rr = r ?? resultRef.current;
      chess.setHeader("Result", rr ? (rr.winner === "w" ? "1-0" : rr.winner === "b" ? "0-1" : "1/2-1/2") : "*");
    } catch { /* headers are best-effort */ }
    return chess.pgn();
  }, [chess, cfg.names.w, cfg.names.b]);

  const finish = useCallback((r: GameResult) => {
    if (resultRef.current) return;
    resultRef.current = r; setResult(r); setSelected(null); setPending(null); setThinking(false);
    clk.current.running = false;
    const duration = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    if (r.kind === "checkmate") sfx.mate();
    else if (r.winner === null) sfx.draw();
    else if (cfg.opponent === "ai" && r.winner !== cfg.humanColor) sfx.lose();
    else sfx.win();
    cancelAI();
    optsRef.current.onFinish(r, { moves: chess.history({ verbose: true }), pgn: getPgn(r), duration });
  }, [chess, cfg.opponent, cfg.humanColor, getPgn]);

  const doMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    if (resultRef.current || Date.now() < lock.current) return false;
    const c = clk.current; const t = chess.turn();
    if (cfg.clock && c.running && c[t] - (Date.now() - c.turnStart) <= 0) { finish(timeoutResult(chess, t)); return false; }
    let mv: Move;
    try { mv = chess.move({ from, to, promotion }); } catch { return false; }
    redo.current = [];
    setView(null); setSelected(null); setPending(null);
    lock.current = Date.now() + (optsRef.current.animations ? 190 : 0);
    if (cfg.clock) {
      const now = Date.now();
      if (c.running) c[mv.color] = c[mv.color] - (now - c.turnStart) + inc;
      c.running = true; c.turnStart = now;
      setClocks({ w: Math.max(0, c.w), b: Math.max(0, c.b) });
    }
    const status = gameStatus(chess, startFen);
    if (mv.flags.includes("k") || mv.flags.includes("q")) sfx.castle();
    if (mv.promotion) { sfx.promote(); setFx({ key: `${chess.history().length}p`, square: mv.to, kind: "promote" }); }
    else if (mv.captured) { sfx.capture(); setFx({ key: `${chess.history().length}c`, square: mv.to, kind: "capture" }); }
    else if (!mv.flags.includes("k") && !mv.flags.includes("q")) sfx.move();
    if (mv.san.endsWith("#")) { /* mate sound is played by finish() */ } else if (mv.san.endsWith("+")) setTimeout(() => sfx.check(), 120);
    bump();
    if (status) finish(status);
    return true;
  }, [chess, cfg.clock, inc, startFen, finish, bump]);

  // clock ticking
  useEffect(() => {
    if (!cfg.clock || result) return;
    const id = setInterval(() => {
      const c = clk.current; if (!c.running || resultRef.current) return;
      const t = chess.turn(); const rem = c[t] - (Date.now() - c.turnStart);
      setClocks({ w: Math.max(0, t === "w" ? rem : c.w), b: Math.max(0, t === "b" ? rem : c.b) });
      if (rem <= 0) finish(timeoutResult(chess, t));
    }, 100);
    return () => clearInterval(id);
  }, [cfg.clock, result, chess, finish]);

  // initial position may already be over (imported game)
  useEffect(() => { const s = gameStatus(chess, startFen); if (s) finish(s); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // AI turn
  const aiColor: Color | null = cfg.opponent === "ai" ? (cfg.humanColor === "w" ? "b" : "w") : null;
  const fen = chess.fen();
  const aiTurn = !!aiColor && turn === aiColor && !result && live;
  useEffect(() => {
    if (!aiTurn || !aiColor) return;
    let alive = true; let done = false;
    setThinking(true);
    const t0 = Date.now(); const c = clk.current;
    const remaining = cfg.clock ? c[aiColor] - (c.running ? Date.now() - c.turnStart : 0) : undefined;
    const cap = remaining !== undefined ? Math.max(120, remaining / 30) : undefined;
    (async () => {
      try {
        const r = await aiMove(fen, cfg.aiLevel, cap);
        await sleep(Math.max(0, 500 - (Date.now() - t0)));
        done = true; if (!alive) return;
        setThinking(false); lock.current = 0;
        let ok = false;
        if (r.uci) ok = doMove(r.uci.slice(0, 2), r.uci.slice(2, 4), r.uci[4]);
        if (!ok && !resultRef.current) { const legal = chess.moves({ verbose: true }); const m = legal[Math.floor(Math.random() * legal.length)]; if (m) doMove(m.from, m.to, m.promotion); }
      } catch { /* cancelled */ }
    })();
    return () => { alive = false; if (!done) cancelAI(); };
  }, [aiTurn, fen]); // eslint-disable-line react-hooks/exhaustive-deps

  const humanCan = (color: Color) => cfg.opponent === "human" || color === cfg.humanColor;
  const interactiveColor: Color | null = result || !live || thinking || pending ? null : humanCan(turn) ? turn : null;

  const select = useCallback((sq: string | null) => {
    if (!sq || resultRef.current || !live) { setSelected(null); return; }
    const p = chess.get(sq as never);
    if (!p || p.color !== chess.turn() || !humanCan(p.color) || thinking) { setSelected(null); return; }
    setSelected(sq); sfx.click();
  }, [chess, live, thinking, cfg.opponent, cfg.humanColor]); // eslint-disable-line react-hooks/exhaustive-deps

  const targets = useMemo(() => {
    const t: Record<string, boolean> = {};
    if (selected && live) for (const m of chess.moves({ square: selected as never, verbose: true })) t[m.to] = m.flags.includes("c") || m.flags.includes("e");
    return t;
  }, [selected, live, tick, chess]); // eslint-disable-line react-hooks/exhaustive-deps

  const tryMove = useCallback((from: string, to: string) => {
    const cands = chess.moves({ square: from as never, verbose: true }).filter((m) => m.to === to);
    if (!cands.length) { sfx.error(); return; }
    if (cands[0].promotion) { if (optsRef.current.autoQueen) doMove(from, to, "q"); else setPending({ from, to }); return; }
    doMove(from, to);
  }, [chess, doMove]);

  const promote = useCallback((p: PType) => { if (pending) doMove(pending.from, pending.to, p); }, [pending, doMove]);

  const timed = !!cfg.clock;
  const undoStep = cfg.opponent === "ai" ? (turn === cfg.humanColor ? 2 : 1) : 1;
  const canUndo = !timed && !result && moves.length > 0 && (cfg.opponent === "human" || moves.length >= undoStep || turn !== cfg.humanColor);
  const undo = useCallback(() => {
    if (!canUndo) return;
    cancelAI(); setThinking(false);
    const n = Math.min(undoStep, chess.history().length);
    for (let i = 0; i < n; i++) { const m = chess.undo(); if (m) redo.current.push(m); }
    setSelected(null); setPending(null); setView(null); lock.current = 0; sfx.click(); bump();
  }, [canUndo, undoStep, chess, bump]);
  const canRedo = !timed && !result && redo.current.length > 0 && !thinking;
  const redoMove = useCallback(() => {
    if (!canRedo) return;
    const n = cfg.opponent === "ai" ? Math.min(2, redo.current.length) : 1;
    for (let i = 0; i < n; i++) { const m = redo.current.pop(); if (m) { try { chess.move(m.san); } catch { redo.current = []; } } }
    setSelected(null); setView(null); sfx.move(); bump();
  }, [canRedo, cfg.opponent, chess, bump]);

  const goto = useCallback((i: number) => {
    const n = chess.history().length; setSelected(null); setPending(null);
    if (i >= n) setView(null); else setView(Math.max(0, i));
  }, [chess]);

  const resign = useCallback((color: Color) => {
    const winner: Color = color === "w" ? "b" : "w";
    finish({ kind: "resign", winner, text: `${colorName(color)} resigned — ${colorName(winner)} wins` });
  }, [finish]);
  const agreeDraw = useCallback(() => finish({ kind: "agreement", winner: null, text: "Draw by agreement" }), [finish]);
  const offerDrawToAI = useCallback(async () => {
    if (!aiColor) return;
    setNotice("Opponent is considering your draw offer…");
    try {
      const r = await evalPosition(chess.fen(), 3, 500);
      const aiScore = turn === aiColor ? r.score : -r.score;
      if (aiScore <= -80 && chess.history().length >= 10) agreeDraw(); else setNotice("Draw offer declined by the computer.");
    } catch { setNotice(null); }
    setTimeout(() => setNotice(null), 3000);
  }, [aiColor, chess, turn, agreeDraw]);
  const claim = useMemo(() => claimable(chess, startFen), [tick, chess, startFen]); // eslint-disable-line react-hooks/exhaustive-deps
  const claimDraw = useCallback(() => {
    const cl = claimable(chess, startFen);
    if (cl.threefold) finish({ kind: "threefold", winner: null, text: `Draw claimed — threefold repetition (${repetitionCount(chess, startFen)}×)` });
    else if (cl.fifty) finish({ kind: "fifty", winner: null, text: "Draw claimed — fifty-move rule" });
  }, [chess, startFen, finish]);

  return {
    chess, startFen, moves, shown, tick, turn, live, view, pieces, lastShown, captured, material, checkSquare, mateSquare,
    result, selected, targets, pending, thinking, fx, notice, clocks, interactiveColor, aiColor,
    claim, canUndo, canRedo, timed, redoCount: redo.current.length,
    select, tryMove, promote, cancelPromotion: () => setPending(null), undo, redo: redoMove, goto, resign, agreeDraw, offerDrawToAI, claimDraw, getPgn,
    setNotice, inCheck: chess.inCheck(), hasStarted: moves.length > 0,
  };
}
export type GameApi = ReturnType<typeof useGame>;
