import { useMemo, useState } from "react";
import { Chess } from "chess.js";
import type { Move } from "chess.js";
import { analyzePositions } from "../chess/engine/ai";
import type { EvalResult } from "../chess/engine/handler";

const ANALYSIS_DEPTH = 4;
type Cls = "best" | "excellent" | "good" | "inaccuracy" | "mistake" | "blunder";
const winPct = (cp: number) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);

export function Analysis({ moves, startFen }: { moves: Move[]; startFen: string }) {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [prog, setProg] = useState(0);
  const [evals, setEvals] = useState<EvalResult[] | null>(null);

  const run = async () => {
    setState("running"); setProg(0);
    try {
      const fens = [startFen, ...moves.map((m) => m.after)];
      const res = await analyzePositions(fens, (d, t) => setProg(d / t), ANALYSIS_DEPTH, 280);
      setEvals(res); setState("done");
    } catch { setState("error"); }
  };

  const data = useMemo(() => {
    if (!evals) return null;
    const white = evals.map((e, i) => { const fenTurn = (i === 0 ? startFen : moves[i - 1].after).split(" ")[1]; return fenTurn === "w" ? e.score : -e.score; });
    const rows = moves.map((m, i) => {
      const before = white[i], after = white[i + 1];
      const wb = winPct(m.color === "w" ? before : -before), wa = winPct(m.color === "w" ? after : -after);
      const drop = Math.max(0, wb - wa);
      const uci = m.from + m.to + (m.promotion ?? "");
      const bestUci = evals[i].uci;
      let cls: Cls = drop < 2 ? (uci === bestUci ? "best" : "excellent") : drop < 6 ? "good" : drop < 12 ? "inaccuracy" : drop < 22 ? "mistake" : "blunder";
      if (uci === bestUci) cls = "best";
      const acc = Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669));
      let better: string | null = null;
      if (bestUci && uci !== bestUci && (cls === "inaccuracy" || cls === "mistake" || cls === "blunder")) {
        try { better = new Chess(m.before).move({ from: bestUci.slice(0, 2), to: bestUci.slice(2, 4), promotion: bestUci[4] }).san; } catch { better = null; }
      }
      const missed = wb > 80 && wa < 60 && (cls === "mistake" || cls === "blunder");
      return { m, i, cls, drop, acc, better, missed, cp: after };
    });
    const accOf = (c: "w" | "b") => { const r = rows.filter((x) => x.m.color === c); return r.length ? Math.round(r.reduce((a, b) => a + b.acc, 0) / r.length) : null; };
    const count = (c: "w" | "b", k: Cls) => rows.filter((x) => x.m.color === c && x.cls === k).length;
    return { white, rows, accW: accOf("w"), accB: accOf("b"), count };
  }, [evals, moves, startFen]);

  if (moves.length === 0) return <p className="ci-muted">No moves to analyse.</p>;
  return (
    <div>
      {state !== "done" && (
        <div className="ci-bubble">
          <p style={{ margin: "0 0 10px" }}>Every position is evaluated by the built-in search engine (depth {ANALYSIS_DEPTH}, ≈0.3 s per position). Nothing is shown until the engine has actually evaluated the game.</p>
          {state === "running" ? (<><div className="ci-bar"><i style={{ width: `${prog * 100}%` }} /></div><small className="ci-muted">Analysing… {Math.round(prog * 100)}%</small></>) : (
            <button className="ci-btn primary" onClick={run}>🔍 Run engine analysis</button>)}
          {state === "error" && <p style={{ color: "#ff6b73" }}>Analysis was interrupted. Try again.</p>}
        </div>
      )}
      {data && (
        <>
          <div className="ci-stats-grid" style={{ marginBottom: 12 }}>
            <div className="ci-stat"><b>{data.accW ?? "–"}%</b><span>White accuracy</span></div>
            <div className="ci-stat"><b>{data.accB ?? "–"}%</b><span>Black accuracy</span></div>
            <div className="ci-stat"><b>{data.count("w", "blunder") + data.count("b", "blunder")}</b><span>Blunders</span></div>
            <div className="ci-stat"><b>{data.count("w", "mistake") + data.count("b", "mistake")}</b><span>Mistakes</span></div>
            <div className="ci-stat"><b>{data.count("w", "inaccuracy") + data.count("b", "inaccuracy")}</b><span>Inaccuracies</span></div>
          </div>
          <EvalGraph white={data.white} />
          <small className="ci-muted">Accuracy estimated from the engine’s win-probability change (depth {ANALYSIS_DEPTH}). It is an estimate, not a full-strength engine verdict.</small>
          <table className="ci-table" style={{ marginTop: 10 }}>
            <thead><tr><th>#</th><th>Move</th><th>Class</th><th>Eval</th><th>Suggestion</th></tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.i}>
                  <td>{Math.floor(r.i / 2) + 1}{r.m.color === "w" ? "." : "…"}</td><td><b>{r.m.san}</b></td>
                  <td><span className={`ci-cls cls-${r.cls}`}>{r.cls}</span>{r.missed && <span className="ci-cls cls-mistake" style={{ marginLeft: 4 }}>missed chance</span>}</td>
                  <td>{Math.abs(r.cp) >= 1400 ? "mate" : (r.cp / 100 > 0 ? "+" : "") + (r.cp / 100).toFixed(1)}</td>
                  <td>{r.better ? <>Better: <b>{r.better}</b></> : <span className="ci-muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function EvalGraph({ white }: { white: number[] }) {
  const w = 600, h = 110; const n = white.length;
  const pts = white.map((cp, i) => `${(i / Math.max(1, n - 1)) * w},${h / 2 - (Math.max(-800, Math.min(800, cp)) / 800) * (h / 2 - 6)}`);
  return (
    <svg className="ci-eval" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Evaluation graph">
      <line x1="0" x2={w} y1={h / 2} y2={h / 2} stroke="currentColor" strokeOpacity=".3" strokeDasharray="4 4" />
      <polyline points={`0,${h / 2} ${pts.join(" ")} ${w},${h / 2}`} fill="rgba(230,167,86,.25)" stroke="none" />
      <polyline points={pts.join(" ")} fill="none" stroke="var(--accent)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
