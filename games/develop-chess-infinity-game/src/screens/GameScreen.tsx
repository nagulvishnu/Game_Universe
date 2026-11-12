import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import type { Move } from "chess.js";
import { Board } from "../chess/Board";
import { PieceSvg } from "../chess/pieces";
import { useGame } from "../chess/useGame";
import type { GameApi, GameConfig } from "../chess/useGame";
import { useStore } from "../chess/store";
import { AI_LEVELS } from "../chess/levels";
import { capturedBy, colorName, formatClock } from "../chess/rules";
import type { Color, GameResult } from "../chess/rules";
import { Confirm, Modal, PiecePicker, Switch, ThemePicker, TopBar } from "../components/ui";
import { Analysis } from "./Analysis";
import { setMusic, sfx } from "../chess/audio";

function PlayerBar({ g, color, cfg, clock }: { g: GameApi; color: Color; cfg: GameConfig; clock: number }) {
  const opp: Color = color === "w" ? "b" : "w";
  const adv = g.material[color] - g.material[opp];
  const isAI = cfg.opponent === "ai" && color === g.aiColor;
  const active = !g.result && g.turn === color;
  const grouped = g.captured[color];
  return (
    <div className={`ci-player ${active ? "turn" : ""}`}>
      <div className={`ci-avatar ${color}`}>{isAI ? "🤖" : color === "w" ? "♔" : "♚"}</div>
      <div style={{ minWidth: 0 }}>
        <div className="ci-pname">{cfg.names[color]}{!isAI && cfg.opponent === "ai" ? " (you)" : ""}</div>
        <div className="ci-captured">
          {grouped.map((t, i) => <PieceSvg key={i} type={t} color={opp} styleId={useStore.getState().settings.pieceStyle} />)}
          {adv > 0 && <span className="adv">+{adv}</span>}
        </div>
      </div>
      {cfg.clock && <div className={`ci-clock ${active && g.hasStarted ? "active" : ""} ${clock < 10000 && g.hasStarted && !g.result ? "low" : ""}`} aria-label={`${colorName(color)} clock`}>{formatClock(clock)}</div>}
    </div>
  );
}

function ResultModal({ g, cfg, r, duration, onRematch, onNew, onMenu, onClose }: { g: GameApi; cfg: GameConfig; r: GameResult; duration: number; onRematch: () => void; onNew: () => void; onMenu: () => void; onClose: () => void }) {
  const [tab, setTab] = useState<"summary" | "analysis">("summary");
  const [copied, setCopied] = useState(false);
  const cap = capturedBy(g.moves);
  const humanWon = cfg.opponent === "ai" ? r.winner === cfg.humanColor : r.winner === "w";
  const title = r.winner === null ? "Draw" : cfg.opponent === "ai" ? (humanWon ? "Victory!" : "Defeat") : `${colorName(r.winner)} wins!`;
  const icon = r.winner === null ? "🤝" : cfg.opponent === "ai" && !humanWon ? "🥀" : "🏆";
  const pts = (list: string[]) => list.reduce((a, t) => a + ({ p: 1, n: 3, b: 3, r: 5, q: 9 } as Record<string, number>)[t], 0);
  const mm = Math.floor(duration / 60), ss = duration % 60;
  return (
    <Modal wide onClose={onClose}>
      <div className="ci-result-head">
        <div className="ci-trophy">{icon}</div>
        <h2 className="ci-serif" style={{ fontSize: "2rem" }}>{title}</h2>
        <div className="ci-muted">{r.text}</div>
      </div>
      <div className="ci-stats-grid">
        <div className="ci-stat"><b>{mm}:{String(ss).padStart(2, "0")}</b><span>Duration</span></div>
        <div className="ci-stat"><b>{Math.ceil(g.moves.length / 2)}</b><span>Moves</span></div>
        <div className="ci-stat"><b>{cap.w.length}</b><span>Captured by White ({pts(cap.w)} pts)</span></div>
        <div className="ci-stat"><b>{cap.b.length}</b><span>Captured by Black ({pts(cap.b)} pts)</span></div>
      </div>
      <div className="ci-tabs">
        <button className={`ci-opt ${tab === "summary" ? "on" : ""}`} onClick={() => setTab("summary")}>Summary</button>
        <button className={`ci-opt ${tab === "analysis" ? "on" : ""}`} onClick={() => setTab("analysis")}>Engine analysis</button>
      </div>
      {tab === "summary" ? (
        <div style={{ maxHeight: 240, overflowY: "auto" }}>
          <MoveTable moves={g.moves} />
        </div>
      ) : <Analysis moves={g.moves} startFen={g.startFen} />}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
        <button className="ci-btn primary" onClick={onRematch}>↻ Rematch</button>
        <button className="ci-btn" onClick={onNew}>New game</button>
        <button className="ci-btn" onClick={onMenu}>Main menu</button>
        <button className="ci-btn" onClick={onClose}>Review board</button>
        <button className="ci-btn" onClick={() => { void navigator.clipboard?.writeText(g.getPgn(r)).catch(() => undefined); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied ✓" : "Copy PGN"}</button>
      </div>
    </Modal>
  );
}

function MoveTable({ moves }: { moves: Move[] }) {
  const rows: [Move, Move | undefined][] = [];
  for (let i = 0; i < moves.length; i += 2) rows.push([moves[i], moves[i + 1]]);
  return (
    <table className="ci-table"><tbody>
      {rows.map(([a, b], i) => <tr key={i}><td className="ci-muted" style={{ width: 40 }}>{i + 1}.</td><td><b>{a.san}</b></td><td><b>{b?.san ?? ""}</b></td></tr>)}
    </tbody></table>
  );
}

export function GameScreen({ cfg, onExit, onRematch, onNewGame, onStart }: { cfg: GameConfig; onExit: () => void; onRematch: () => void; onNewGame: () => void; onStart: (c: GameConfig) => void }) {
  const s = useStore((st) => st.settings); const upd = useStore((st) => st.updateSettings); const recordGame = useStore((st) => st.recordGame);
  const [orientation, setOrientation] = useState<Color>(cfg.opponent === "ai" ? cfg.humanColor : "w");
  const [dialog, setDialog] = useState<null | "exit" | "resign" | "draw" | "position" | "style">(null);
  const [showResult, setShowResult] = useState(false);
  const [banner, setBanner] = useState(false);
  const [peek, setPeek] = useState(false);
  const [duration, setDuration] = useState(0);
  const [importText, setImportText] = useState("");
  const [importErr, setImportErr] = useState("");
  const [copied, setCopied] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const g = useGame(cfg, {
    autoQueen: s.autoQueen, animations: s.animations,
    onFinish: (r, info) => {
      setDuration(info.duration);
      if (r.kind === "checkmate") { setBanner(true); setTimeout(() => setBanner(false), 2300); }
      setTimeout(() => setShowResult(true), r.kind === "checkmate" ? 2400 : 700);
      if (cfg.imported && info.moves.length === 0) return;
      const vsAI = cfg.opponent === "ai";
      const persp: Color = vsAI ? cfg.humanColor : "w";
      const result = r.winner === null ? "draw" : r.winner === persp ? "win" : "loss";
      const lv = AI_LEVELS[cfg.aiLevel - 1];
      recordGame({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), date: Date.now(),
        mode: cfg.kind === "local" ? "Local 2-player" : `${cfg.kind === "time" ? "Time challenge" : "vs AI"}${vsAI ? ` · ${lv.name}` : ""}${cfg.clock ? ` · ${cfg.clock.base / 60}+${cfg.clock.inc}` : ""}`,
        white: cfg.names.w, black: cfg.names.b, result,
        outcome: vsAI ? (result === "win" ? "Victory" : result === "loss" ? "Defeat" : "Draw") : r.winner ? `${colorName(r.winner)} won` : "Draw",
        reason: r.kind, moves: Math.ceil(info.moves.length / 2), duration: info.duration, pgn: info.pgn,
      }, true);
    },
  });

  useEffect(() => { if (cfg.opponent === "human" && s.autoFlip && g.moves.length > 0 && !g.result) setOrientation(g.turn); }, [g.turn, g.moves.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [g.moves.length]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "INPUT") return;
      const cur = g.view ?? g.moves.length;
      if (e.key === "ArrowLeft") g.goto(cur - 1); else if (e.key === "ArrowRight") g.goto(cur + 1);
      else if (e.key === "ArrowUp") g.goto(0); else if (e.key === "ArrowDown") g.goto(g.moves.length);
      else if (e.key.toLowerCase() === "f") setOrientation((o) => (o === "w" ? "b" : "w"));
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  });
  useEffect(() => { if (g.notice) { const t = setTimeout(() => g.setNotice(null), 3200); return () => clearTimeout(t); } }, [g.notice]); // eslint-disable-line react-hooks/exhaustive-deps

  const top: Color = orientation === "w" ? "b" : "w"; const bottom: Color = orientation;
  const cur = g.view ?? g.moves.length;
  const lv = AI_LEVELS[cfg.aiLevel - 1];
  const title = cfg.kind === "local" ? "Local 2-Player" : cfg.kind === "ai" ? `vs ${lv.name} AI${cfg.blindfold ? " · Blindfold" : ""}` : `Time Challenge${cfg.clock ? ` · ${cfg.clock.base / 60}+${cfg.clock.inc}` : ""}`;
  const requestExit = () => (g.result || g.moves.length === 0 ? onExit() : setDialog("exit"));

  const pairs: [Move, Move | undefined, number][] = [];
  for (let i = 0; i < g.moves.length; i += 2) pairs.push([g.moves[i], g.moves[i + 1], i]);

  const statusText = g.result ? g.result.text : !g.live ? `Reviewing move ${cur} of ${g.moves.length}` : `${colorName(g.turn)} to move${g.inCheck ? " — Check!" : ""}`;

  const doImport = (kind: "fen" | "pgn") => {
    setImportErr("");
    const t = importText.trim(); if (!t) return;
    const base: GameConfig = { kind: "local", opponent: "human", aiLevel: 3, humanColor: "w", clock: null, names: { w: "Player 1", b: "Player 2" } };
    try {
      if (kind === "fen") { new Chess(t); onStart({ ...base, startFen: t }); }
      else { new Chess().loadPgn(t); onStart({ ...base, pgn: t, imported: true }); }
    } catch (e) { setImportErr(`Invalid ${kind.toUpperCase()}: ${String((e as Error).message).slice(0, 120)}`); }
  };
  const copy = (k: string, text: string) => { void navigator.clipboard?.writeText(text).catch(() => undefined); setCopied(k); setTimeout(() => setCopied(""), 1400); };

  return (
    <div>
      <TopBar title={title} onBack={requestExit} right={
        <>
          <button className="ci-btn icon" aria-label="Toggle sound" title="Sound effects" onClick={() => upd({ sound: !s.sound })}>{s.sound ? "🔊" : "🔇"}</button>
          <button className="ci-btn icon" aria-label="Toggle music" title="Background music" onClick={() => { upd({ music: !s.music }); setMusic(!s.music); }}>{s.music ? "🎵" : "🎶"}</button>
          <button className="ci-btn icon" aria-label="Board settings" title="Board & pieces" onClick={() => setDialog("style")}>🎨</button>
        </>
      } />
      <div className="ci-game-main">
        <div className="ci-board-col">
          <PlayerBar g={g} color={top} cfg={cfg} clock={g.clocks[top]} />
          <Board
            pieces={g.pieces} orientation={orientation} theme={s.boardTheme} pieceStyle={s.pieceStyle} showCoords={s.coords} animations={s.animations}
            lastMove={s.highlightLast && g.lastShown ? { from: g.lastShown.from, to: g.lastShown.to } : null}
            checkSquare={g.checkSquare} mateSquare={g.mateSquare} selected={g.selected} targets={g.targets} interactiveColor={g.interactiveColor}
            hideColor={cfg.blindfold && !peek && !g.result ? g.aiColor : null} fx={g.fx} showLegal={s.legalMoves} arrowsEnabled
            promotion={g.pending ? { to: g.pending.to, color: g.turn } : null}
            onSelect={g.select} onMove={g.tryMove} onPromote={g.promote} onCancelPromotion={g.cancelPromotion}
          >
            {banner && <div className="ci-mate-banner"><div className="ci-mate-sweep" /><div><h2 className="ci-serif">CHECKMATE</h2><p>{g.result?.winner ? `${cfg.names[g.result.winner]} wins` : ""}</p></div></div>}
          </Board>
          <PlayerBar g={g} color={bottom} cfg={cfg} clock={g.clocks[bottom]} />
        </div>

        <aside className="ci-side">
          <div className="ci-glass ci-panel">
            <div className="ci-status" data-testid="status">
              {!g.result && g.live && <span className="ci-dotlive" />}
              <span>{statusText}</span>
              {g.thinking && <span className="ci-thinking" aria-label="Computer is thinking"><i /><i /><i /></span>}
            </div>
            {g.claim.threefold && !g.result && <button className="ci-btn sm" style={{ marginTop: 10 }} onClick={g.claimDraw}>½ Claim draw — threefold repetition</button>}
            {!g.claim.threefold && g.claim.fifty && !g.result && <button className="ci-btn sm" style={{ marginTop: 10 }} onClick={g.claimDraw}>½ Claim draw — fifty-move rule</button>}
            {cfg.blindfold && !g.result && <button className="ci-btn sm" style={{ marginTop: 10 }} onPointerDown={() => setPeek(true)} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)}>👁 Hold to peek</button>}
          </div>

          <div className="ci-glass ci-panel">
            <div className="ci-navrow">
              <button className="ci-btn sm" aria-label="First move" onClick={() => g.goto(0)} disabled={cur === 0}>⏮</button>
              <button className="ci-btn sm" aria-label="Previous move" onClick={() => g.goto(cur - 1)} disabled={cur === 0}>◀</button>
              <button className="ci-btn sm" aria-label="Next move" onClick={() => g.goto(cur + 1)} disabled={cur >= g.moves.length}>▶</button>
              <button className="ci-btn sm" aria-label="Latest move" onClick={() => g.goto(g.moves.length)} disabled={cur >= g.moves.length}>⏭</button>
            </div>
            <div className="ci-movelist" ref={listRef} data-testid="movelist">
              {g.moves.length === 0 && <span className="ci-muted" style={{ gridColumn: "1 / -1", padding: 6 }}>No moves yet.</span>}
              {pairs.map(([a, b, i]) => (
                <div key={i} style={{ display: "contents" }}>
                  <span className="n">{i / 2 + 1}.</span>
                  <button className={`ci-mv ${cur === i + 1 ? "cur" : ""}`} onClick={() => g.goto(i + 1)}>{a.san}</button>
                  {b ? <button className={`ci-mv ${cur === i + 2 ? "cur" : ""}`} onClick={() => g.goto(i + 2)}>{b.san}</button> : <span />}
                </div>
              ))}
            </div>
          </div>

          <div className="ci-glass ci-panel">
            <div className="ci-controls">
              <button className="ci-btn" onClick={g.undo} disabled={!g.canUndo} title={g.timed ? "Undo is disabled in timed games" : "Undo"}><span>↶</span><span>Undo</span></button>
              <button className="ci-btn" onClick={g.redo} disabled={!g.canRedo}><span>↷</span><span>Redo</span></button>
              <button className="ci-btn" onClick={() => setOrientation((o) => (o === "w" ? "b" : "w"))}><span>⇅</span><span>Flip</span></button>
              <button className="ci-btn" onClick={() => setDialog("position")}><span>⎘</span><span>FEN/PGN</span></button>
              <button className="ci-btn" disabled={!!g.result || g.moves.length === 0} onClick={() => (cfg.opponent === "ai" ? void g.offerDrawToAI() : setDialog("draw"))}><span>½</span><span>Draw</span></button>
              <button className="ci-btn danger" disabled={!!g.result} onClick={() => setDialog("resign")}><span>⚑</span><span>Resign</span></button>
              <button className="ci-btn" onClick={onRematch}><span>↻</span><span>Restart</span></button>
              {g.result ? <button className="ci-btn primary" onClick={() => setShowResult(true)}><span>★</span><span>Result</span></button> : <button className="ci-btn" onClick={requestExit}><span>⌂</span><span>Menu</span></button>}
            </div>
            <p className="ci-muted" style={{ fontSize: ".72rem", margin: "10px 0 0" }}>Right-click and drag on the board to draw arrows · ← → to browse moves · F flips the board.</p>
          </div>
        </aside>
      </div>

      {g.notice && <div className="ci-toast" role="status">{g.notice}</div>}
      {dialog === "exit" && <Confirm danger title="Leave this game?" text="The current game is in progress and will be lost." confirm="Leave game" cancel="Keep playing" onConfirm={onExit} onCancel={() => setDialog(null)} />}
      {dialog === "resign" && (cfg.opponent === "ai"
        ? <Confirm danger title="Resign the game?" text="You will lose this game." confirm="Resign" onConfirm={() => { setDialog(null); g.resign(cfg.humanColor); }} onCancel={() => setDialog(null)} />
        : <Modal onClose={() => setDialog(null)}><h2 className="ci-serif">Who resigns?</h2><p className="ci-muted">The other player wins immediately.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="ci-btn danger" onClick={() => { setDialog(null); g.resign("w"); }}>{cfg.names.w} (White)</button>
            <button className="ci-btn danger" onClick={() => { setDialog(null); g.resign("b"); }}>{cfg.names.b} (Black)</button>
            <button className="ci-btn" onClick={() => setDialog(null)}>Cancel</button></div></Modal>)}
      {dialog === "draw" && <Confirm title="Draw offer" text={`${cfg.names[g.turn]} offers a draw. Does ${cfg.names[g.turn === "w" ? "b" : "w"]} accept?`} confirm="Accept draw" cancel="Decline" onConfirm={() => { setDialog(null); g.agreeDraw(); }} onCancel={() => setDialog(null)} />}
      {dialog === "position" && (
        <Modal wide onClose={() => setDialog(null)}>
          <h2 className="ci-serif">Position & game notation</h2>
          <div className="ci-field"><div className="ci-label">Current FEN</div><input className="ci-input" readOnly value={g.chess.fen()} onFocus={(e) => e.target.select()} />
            <div><button className="ci-btn sm" onClick={() => copy("fen", g.chess.fen())}>{copied === "fen" ? "Copied ✓" : "Copy FEN"}</button></div></div>
          <div className="ci-field"><div className="ci-label">PGN export</div><textarea className="ci-input" readOnly value={g.getPgn()} onFocus={(e) => e.target.select()} />
            <div><button className="ci-btn sm" onClick={() => copy("pgn", g.getPgn())}>{copied === "pgn" ? "Copied ✓" : "Copy PGN"}</button></div></div>
          <div className="ci-field"><div className="ci-label">Import (starts a new local game)</div><textarea className="ci-input" value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Paste a FEN or PGN…" />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="ci-btn sm" onClick={() => doImport("fen")}>Load FEN</button>
              <button className="ci-btn sm" onClick={() => doImport("pgn")}>Load PGN</button>
            </div>
            {importErr && <small style={{ color: "#ff6b73" }} role="alert">{importErr}</small>}</div>
          <div style={{ textAlign: "right" }}><button className="ci-btn" onClick={() => setDialog(null)}>Close</button></div>
        </Modal>
      )}
      {dialog === "style" && (
        <Modal wide onClose={() => setDialog(null)}>
          <h2 className="ci-serif">Board & pieces</h2>
          <div className="ci-field"><div className="ci-label">Board theme</div><ThemePicker /></div>
          <div className="ci-field"><div className="ci-label">Pieces</div><PiecePicker /></div>
          <Switch label="Coordinates" on={s.coords} onChange={(v) => upd({ coords: v })} />
          <Switch label="Legal move hints" on={s.legalMoves} onChange={(v) => upd({ legalMoves: v })} />
          <Switch label="Sound effects" on={s.sound} onChange={(v) => { upd({ sound: v }); if (v) sfx.click(); }} />
          <div style={{ textAlign: "right" }}><button className="ci-btn primary" onClick={() => setDialog(null)}>Done</button></div>
        </Modal>
      )}
      {showResult && g.result && <ResultModal g={g} cfg={cfg} r={g.result} duration={duration} onRematch={onRematch} onNew={onNewGame} onMenu={onExit} onClose={() => setShowResult(false)} />}
    </div>
  );
}
