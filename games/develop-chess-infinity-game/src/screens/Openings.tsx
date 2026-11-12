import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import type { Move } from "chess.js";
import { OPENINGS } from "../chess/data";
import type { Opening } from "../chess/data";
import { useFreeBoard } from "../chess/useFreeBoard";
import type { FreeBoard } from "../chess/useFreeBoard";
import { useStore } from "../chess/store";
import { FreeBoardView, TopBar } from "../components/ui";
import { START_FEN } from "../chess/rules";
import type { Color } from "../chess/rules";
import { sfx } from "../chess/audio";

function sanToUci(fen: string, san: string): string | null {
  try { const m = new Chess(fen).move(san); return m.from + m.to + (m.promotion ?? ""); } catch { return null; }
}

function OpeningView({ op }: { op: Opening }) {
  const autoQueen = useStore((s) => s.settings.autoQueen);
  const [mode, setMode] = useState<"explore" | "practice">("explore");
  const [idx, setIdx] = useState(0);
  const [auto, setAuto] = useState(false);
  const [side, setSide] = useState<Color>("w");
  const [msg, setMsg] = useState<{ t: string; k: "good" | "bad" } | null>(null);
  const pIdx = useRef(0);
  const fbRef = useRef<FreeBoard | null>(null);

  const handle = (mv: Move) => {
    const expected = op.moves[pIdx.current];
    if (mv.san === expected) {
      pIdx.current++; sfx.success();
      if (pIdx.current >= op.moves.length) { setMsg({ t: `🎉 Line complete — you know the ${op.name}!`, k: "good" }); return; }
      setMsg({ t: "✓ Book move", k: "good" });
      const reply = sanToUci(fbRef.current!.chess.fen(), op.moves[pIdx.current]);
      setTimeout(() => { if (reply) { fbRef.current?.play(reply); pIdx.current++; if (pIdx.current >= op.moves.length) setMsg({ t: `🎉 Line complete — you know the ${op.name}!`, k: "good" }); } }, 500);
    } else { sfx.error(); setMsg({ t: `Not the main line. The book move is ${expected}.`, k: "bad" }); setTimeout(() => fbRef.current?.undo(), 700); }
  };
  const fb = useFreeBoard(START_FEN, { autoQueen, onUserMove: handle });
  fbRef.current = fb;

  useEffect(() => { // explore: show first idx moves
    if (mode !== "explore") return;
    fb.setLine(op.moves.slice(0, idx)); fb.setPlayer(null);
  }, [idx, mode, op]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => setIdx((i) => { if (i >= op.moves.length) { setAuto(false); return i; } return i + 1; }), 1100);
    return () => clearInterval(id);
  }, [auto, op]);

  const startPractice = (c: Color) => {
    setMode("practice"); setSide(c); setAuto(false); setMsg({ t: `Play the ${c === "w" ? "White" : "Black"} moves of the ${op.name}.`, k: "good" });
    pIdx.current = 0; fb.reset(START_FEN, c);
    if (c === "b") { const u = sanToUci(START_FEN, op.moves[0]); pIdx.current = 1; setTimeout(() => { if (u) fbRef.current?.play(u); }, 500); }
  };

  return (
    <div className="ci-two">
      <FreeBoardView fb={fb} orientation={mode === "practice" ? side : "w"} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="ci-glass ci-panel">
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}><span className="ci-chip accent">{op.eco}</span><span className="ci-chip">{op.style}</span></div>
          <h2 className="ci-serif" style={{ margin: "0 0 8px" }}>{op.name}</h2>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }} className="ci-muted">{op.ideas.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
        <div className="ci-glass ci-panel">
          <div className="ci-label" style={{ marginBottom: 8 }}>Main line</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {op.moves.map((m, i) => (
              <button key={i} className={`ci-mv ${mode === "explore" && idx === i + 1 ? "cur" : ""}`} onClick={() => { setMode("explore"); setAuto(false); setIdx(i + 1); }}>
                {i % 2 === 0 ? `${i / 2 + 1}. ` : ""}{m}
              </button>
            ))}
          </div>
          {mode === "explore" && (
            <div className="ci-navrow" style={{ marginTop: 12 }}>
              <button className="ci-btn sm" onClick={() => { setAuto(false); setIdx(0); }} aria-label="Start">⏮</button>
              <button className="ci-btn sm" onClick={() => { setAuto(false); setIdx(Math.max(0, idx - 1)); }} aria-label="Previous">◀</button>
              <button className="ci-btn sm primary" onClick={() => { if (idx >= op.moves.length) setIdx(0); setAuto(!auto); }}>{auto ? "⏸ Pause" : "▶ Auto-play"}</button>
              <button className="ci-btn sm" onClick={() => { setAuto(false); setIdx(Math.min(op.moves.length, idx + 1)); }} aria-label="Next">▶</button>
              <button className="ci-btn sm" onClick={() => { setAuto(false); setIdx(op.moves.length); }} aria-label="End">⏭</button>
            </div>
          )}
        </div>
        <div className="ci-glass ci-panel">
          <div className="ci-label" style={{ marginBottom: 8 }}>Practice this line</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="ci-btn sm" onClick={() => startPractice("w")}>Play as White</button>
            <button className="ci-btn sm" onClick={() => startPractice("b")}>Play as Black</button>
            {mode === "practice" && <button className="ci-btn sm" onClick={() => { setMode("explore"); setIdx(0); setMsg(null); }}>Back to explorer</button>}
          </div>
          {msg && <div className={`ci-bubble ${msg.k}`} style={{ marginTop: 10 }} role="status">{msg.t}</div>}
        </div>
      </div>
    </div>
  );
}

export function Openings({ back }: { back: () => void }) {
  const [op, setOp] = useState<Opening | null>(null);
  return (
    <div>
      <TopBar title={op ? "Opening Explorer" : "Opening Explorer"} onBack={op ? () => setOp(null) : back} />
      <div className="ci-page" style={{ maxWidth: 1000 }}>
        {op ? <OpeningView key={op.id} op={op} /> : (
          <div className="ci-cards" style={{ marginTop: 0 }}>
            {OPENINGS.map((o) => (
              <button key={o.id} className="ci-card" onClick={() => setOp(o)}>
                <div style={{ display: "flex", gap: 6 }}><span className="ci-chip accent">{o.eco}</span><span className="ci-chip">{o.style}</span></div>
                <h3>{o.name}</h3>
                <p>{o.moves.slice(0, 6).map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}.${m}` : m)).join(" ")} …</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
