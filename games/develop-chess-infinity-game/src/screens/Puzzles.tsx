import { useEffect, useMemo, useRef, useState } from "react";
import type { Move } from "chess.js";
import { PUZZLES, THEME_LABEL, dailyPuzzle, todayKey } from "../chess/data";
import type { Puzzle, PuzzleTheme } from "../chess/data";
import { useFreeBoard } from "../chess/useFreeBoard";
import type { FreeBoard } from "../chess/useFreeBoard";
import { Position, allRepliesMated, mateMoves, stubbornReply } from "../chess/engine/core";
import { evalPosition } from "../chess/engine/ai";
import { useStore } from "../chess/store";
import { FreeBoardView, TopBar } from "../components/ui";
import { sfx } from "../chess/audio";
import type { Color } from "../chess/rules";

type Msg = { t: string; k: "good" | "bad" | "info" };

function PuzzleRunner({ puzzle, strict, onDone, extra }: { puzzle: Puzzle; strict?: boolean; onDone?: (ok: boolean) => void; extra?: React.ReactNode }) {
  const autoQueen = useStore((s) => s.settings.autoQueen);
  const recordPuzzle = useStore((s) => s.recordPuzzle); const addHint = useStore((s) => s.addHint);
  const color = puzzle.fen.split(" ")[1] as Color;
  const [status, setStatus] = useState<"solving" | "solved" | "failed">("solving");
  const [msg, setMsg] = useState<Msg | null>(null);
  const [hintLvl, setHintLvl] = useState(0);
  const moveCount = useRef(0);
  const fbRef = useRef<FreeBoard | null>(null);

  const handle = (mv: Move) => {
    const fb = fbRef.current!; const fenAfter = fb.chess.fen();
    moveCount.current++;
    const remaining = (puzzle.mateIn ?? 0) - (moveCount.current - 1);
    let ok = false; let finished = false;
    if (puzzle.mateIn) {
      if (mv.san.endsWith("#")) { ok = true; finished = true; }
      else if (remaining > 1 && allRepliesMated(Position.fromFen(fenAfter), remaining - 1)) ok = true;
    } else { ok = !!puzzle.accept?.includes(mv.from + mv.to + (mv.promotion ?? "")); finished = ok; }
    setHintLvl(0);
    if (ok && finished) {
      sfx.success(); setStatus("solved"); setMsg({ t: `✓ Solved! ${puzzle.explain}`, k: "good" }); recordPuzzle(puzzle.id, true);
      if (!puzzle.mateIn) void evalPosition(fenAfter, 3, 300).then((r) => { if (r.uci) setTimeout(() => fbRef.current?.play(r.uci!), 350); }).catch(() => undefined);
      setTimeout(() => onDone?.(true), strict ? 900 : 0);
    } else if (ok) {
      sfx.success(); setMsg({ t: "✓ Correct — keep going…", k: "good" });
      const reply = stubbornReply(fenAfter, remaining - 1);
      setTimeout(() => { if (reply) fbRef.current?.play(reply); }, 450);
    } else {
      sfx.error(); recordPuzzle(puzzle.id, false); moveCount.current--;
      if (strict) { setStatus("failed"); setMsg({ t: `✗ Wrong move. ${puzzle.explain}`, k: "bad" }); setTimeout(() => onDone?.(false), 1100); }
      else { setMsg({ t: "✗ Not the best move — try again.", k: "bad" }); setTimeout(() => fbRef.current?.undo(), 650); }
    }
  };
  const fb = useFreeBoard(puzzle.fen, { autoQueen, onUserMove: handle });
  fbRef.current = fb;
  useEffect(() => { fb.setPlayer(color); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hint = () => {
    if (status !== "solving" || fb.turn !== color) return;
    addHint();
    const uci = puzzle.mateIn ? mateMoves(fb.chess.fen(), puzzle.mateIn - moveCount.current)[0] : puzzle.accept?.[0];
    if (!uci) return;
    const lvl = hintLvl + 1; setHintLvl(lvl);
    fb.setHint(lvl === 1 ? { from: uci.slice(0, 2) } : { from: uci.slice(0, 2), to: uci.slice(2, 4) });
    setMsg({ t: lvl === 1 ? `Hint: ${puzzle.hint}` : "The green squares show the key move.", k: "info" });
  };
  const prompt = `${color === "w" ? "White" : "Black"} to move${puzzle.mateIn ? ` — checkmate in ${puzzle.mateIn}` : ` — ${THEME_LABEL[puzzle.theme].toLowerCase()}`}`;

  return (
    <div className="ci-two">
      <FreeBoardView fb={fb} orientation={color} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="ci-glass ci-panel">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            <span className="ci-chip accent">{THEME_LABEL[puzzle.theme]}</span>
            <span className="ci-chip">{"★".repeat(puzzle.difficulty)}{"☆".repeat(5 - puzzle.difficulty)}</span>
          </div>
          <h2 className="ci-serif" style={{ margin: "0 0 4px", fontSize: "1.3rem" }}>{puzzle.title}</h2>
          <div className="ci-muted" data-testid="prompt">{prompt}</div>
        </div>
        {msg && <div className={`ci-bubble ${msg.k === "good" ? "good" : msg.k === "bad" ? "bad" : ""}`} role="status">{msg.t}</div>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!strict && <button className="ci-btn" onClick={hint} disabled={status !== "solving"}>💡 Hint</button>}
          {!strict && <button className="ci-btn" onClick={() => { fb.reset(puzzle.fen, color); moveCount.current = 0; setStatus("solving"); setMsg(null); setHintLvl(0); }}>↺ Restart</button>}
        </div>
        {extra}
      </div>
    </div>
  );
}

function shuffle<T>(a: T[]): T[] { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }

export function Puzzles({ mode, back }: { mode: "library" | "daily" | "rush" | "survival"; back: () => void }) {
  const store = useStore();
  const titles = { library: "Puzzles", daily: "Daily Challenge", rush: "Puzzle Rush", survival: "Survival Chess" };

  /* ---------- library ---------- */
  const [filter, setFilter] = useState<PuzzleTheme | "all">("all");
  const [sel, setSel] = useState<Puzzle>(() => PUZZLES.find((p) => !store.puzzles.solved[p.id]) ?? PUZZLES[0]);
  const list = PUZZLES.filter((p) => filter === "all" || p.theme === filter);
  const solvedCount = PUZZLES.filter((p) => store.puzzles.solved[p.id]).length;

  /* ---------- daily ---------- */
  const daily = useMemo(() => dailyPuzzle(), []);
  const today = todayKey();

  /* ---------- rush / survival ---------- */
  const [phase, setPhase] = useState<"idle" | "run" | "over">("idle");
  const [queue, setQueue] = useState<Puzzle[]>([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [timeLeft, setTimeLeft] = useState(180);
  const endAt = useRef(0);
  const scoreRef = useRef(0);
  const best = mode === "rush" ? store.puzzles.rushBest : store.puzzles.survivalBest;

  const startRun = () => {
    const sorted = [...PUZZLES].sort((a, b) => a.difficulty - b.difficulty);
    setQueue(mode === "rush" ? [...shuffle(PUZZLES), ...shuffle(PUZZLES)] : sorted);
    scoreRef.current = 0; setIdx(0); setScore(0); setStrikes(0); setTimeLeft(180); endAt.current = Date.now() + 180000; setPhase("run");
  };
  const endRun = (finalScore: number) => {
    setPhase("over");
    if (mode === "rush") store.setRushBest(finalScore); else store.setSurvivalBest(finalScore);
  };
  useEffect(() => {
    if (mode !== "rush" || phase !== "run") return;
    const id = setInterval(() => { const left = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000)); setTimeLeft(left); if (left <= 0) { clearInterval(id); endRun(scoreRef.current); } }, 250);
    return () => clearInterval(id);
  }, [phase, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const onRunDone = (ok: boolean) => {
    const newScore = ok ? score + 1 : score; const newStrikes = ok ? strikes : strikes + 1;
    scoreRef.current = newScore; setScore(newScore); setStrikes(newStrikes);
    const maxStrikes = 3;
    if (newStrikes >= maxStrikes || (mode === "survival" && idx + 1 >= queue.length)) { endRun(newScore); return; }
    setIdx((i) => i + 1);
  };

  return (
    <div>
      <TopBar title={titles[mode]} onBack={back} right={<span className="ci-chip accent">{solvedCount}/{PUZZLES.length} solved</span>} />
      <div className="ci-page" style={{ maxWidth: 1000 }}>
        {mode === "library" && (
          <>
            <div className="ci-seg" style={{ marginBottom: 14 }}>
              <button className={`ci-opt ${filter === "all" ? "on" : ""}`} onClick={() => setFilter("all")}>All</button>
              {(Object.keys(THEME_LABEL) as PuzzleTheme[]).map((t) => <button key={t} className={`ci-opt ${filter === t ? "on" : ""}`} onClick={() => setFilter(t)}>{THEME_LABEL[t]}</button>)}
            </div>
            <PuzzleRunner key={sel.id} puzzle={sel} extra={
              <div className="ci-glass ci-panel" style={{ maxHeight: 280, overflowY: "auto" }}>
                <div className="ci-label" style={{ marginBottom: 6 }}>Puzzle collection · accuracy {store.puzzles.attempts ? Math.round((store.puzzles.correct / store.puzzles.attempts) * 100) : 0}% over {store.puzzles.attempts} attempts</div>
                {list.map((p) => (
                  <button key={p.id} className="ci-mv" style={{ display: "flex", width: "100%", justifyContent: "space-between", background: p.id === sel.id ? "var(--panel2)" : undefined }} onClick={() => setSel(p)}>
                    <span>{store.puzzles.solved[p.id] ? "✅" : "▫️"} {p.title}</span><span className="ci-muted">{THEME_LABEL[p.theme]}</span>
                  </button>
                ))}
                <button className="ci-btn sm primary" style={{ marginTop: 8 }} onClick={() => { const nxt = list.find((p) => !store.puzzles.solved[p.id] && p.id !== sel.id) ?? list[(list.findIndex((p) => p.id === sel.id) + 1) % list.length]; if (nxt) setSel(nxt); }}>Next puzzle →</button>
              </div>} />
          </>
        )}
        {mode === "daily" && (
          <>
            <div className="ci-bubble" style={{ marginBottom: 14 }}>📅 {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} — {store.puzzles.daily[today] ? "completed ✓ — come back tomorrow for a new challenge!" : "a new puzzle every day."} Dailies completed: {Object.keys(store.puzzles.daily).length}</div>
            <PuzzleRunner key={daily.id} puzzle={daily} onDone={(ok) => { if (ok) store.markDaily(today); }} />
          </>
        )}
        {(mode === "rush" || mode === "survival") && phase !== "run" && (
          <div className="ci-glass ci-panel" style={{ maxWidth: 520, margin: "20px auto", textAlign: "center", padding: 28 }}>
            <div style={{ fontSize: "3rem" }}>{mode === "rush" ? "⚡" : "♾"}</div>
            <h2 className="ci-serif">{phase === "over" ? (mode === "rush" ? "Time’s up!" : "Run over") : titles[mode]}</h2>
            {phase === "over" && <p style={{ fontSize: "1.4rem", fontWeight: 800 }}>Score: {score}</p>}
            <p className="ci-muted">{mode === "rush" ? "Solve as many puzzles as you can in 3 minutes. Three wrong moves end the run." : "Positions get harder every level. You have three lives and each puzzle is one attempt."}</p>
            <p className="ci-muted">Personal best: <b>{best}</b></p>
            <button className="ci-btn primary" onClick={startRun}>{phase === "over" ? "Play again" : "Start"}</button>
          </div>
        )}
        {(mode === "rush" || mode === "survival") && phase === "run" && queue[idx] && (
          <>
            <div className="ci-glass ci-panel" style={{ display: "flex", gap: 18, alignItems: "center", justifyContent: "center", marginBottom: 14, flexWrap: "wrap" }}>
              {mode === "rush" && <b style={{ fontSize: "1.5rem", fontFamily: "ui-monospace,monospace" }}>{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}</b>}
              {mode === "survival" && <b>Level {idx + 1}</b>}
              <b>Score {score}</b>
              <span className="ci-heart" aria-label={`${3 - strikes} lives left`}>{"♥".repeat(3 - strikes)}{"♡".repeat(strikes)}</span>
              <button className="ci-btn sm danger" onClick={() => endRun(score)}>End run</button>
            </div>
            <PuzzleRunner key={`${idx}-${queue[idx].id}`} puzzle={queue[idx]} strict onDone={onRunDone} />
          </>
        )}
      </div>
    </div>
  );
}
