import { useState } from "react";
import { Chess } from "chess.js";
import { AI_LEVELS } from "../chess/levels";
import type { GameConfig } from "../chess/useGame";
import type { Color } from "../chess/rules";
import { TopBar } from "../components/ui";
import { Switch } from "../components/ui";

const PRESETS = [
  { id: "1+0", label: "1+0", group: "Bullet", base: 60, inc: 0 },
  { id: "2+1", label: "2+1", group: "Bullet", base: 120, inc: 1 },
  { id: "3+0", label: "3+0", group: "Blitz", base: 180, inc: 0 },
  { id: "5+3", label: "5+3", group: "Blitz", base: 300, inc: 3 },
  { id: "10+0", label: "10+0", group: "Rapid", base: 600, inc: 0 },
  { id: "15+10", label: "15+10", group: "Rapid", base: 900, inc: 10 },
];

export function Setup({ kind, blindfold: bf, back, start }: { kind: "local" | "ai" | "time"; blindfold?: boolean; back: () => void; start: (c: GameConfig) => void }) {
  const [level, setLevel] = useState(3);
  const [color, setColor] = useState<Color | "random">("w");
  const [preset, setPreset] = useState(kind === "time" ? "5+3" : "none");
  const [cMin, setCMin] = useState(5); const [cInc, setCInc] = useState(2);
  const [opp, setOpp] = useState<"ai" | "human">(kind === "ai" ? "ai" : kind === "time" ? "ai" : "human");
  const [p1, setP1] = useState(""); const [p2, setP2] = useState("");
  const [blind, setBlind] = useState(!!bf);
  const [adv, setAdv] = useState(false); const [fen, setFen] = useState(""); const [pgn, setPgn] = useState("");
  const [err, setErr] = useState("");

  const title = kind === "local" ? "Local 2-Player" : kind === "ai" ? (bf ? "Blindfold Training" : "Play Against AI") : "Time Challenge";
  const vsAI = opp === "ai";

  const go = () => {
    setErr("");
    let clock: GameConfig["clock"] = null;
    if (preset === "custom") clock = { base: Math.max(10, Math.round(cMin * 60)), inc: Math.max(0, cInc) };
    else { const p = PRESETS.find((x) => x.id === preset); if (p) clock = { base: p.base, inc: p.inc }; }
    const human: Color = color === "random" ? (Math.random() < 0.5 ? "w" : "b") : color;
    const lv = AI_LEVELS[level - 1];
    const cfg: GameConfig = {
      kind, opponent: opp, aiLevel: level, humanColor: vsAI ? human : "w", clock, blindfold: vsAI && blind,
      names: vsAI ? (human === "w" ? { w: p1 || "You", b: `AI · ${lv.name}` } : { w: `AI · ${lv.name}`, b: p1 || "You" }) : { w: p1 || "Player 1", b: p2 || "Player 2" },
    };
    try {
      if (pgn.trim()) { const c = new Chess(); c.loadPgn(pgn.trim()); cfg.pgn = pgn.trim(); cfg.imported = true; }
      else if (fen.trim()) { new Chess(fen.trim()); cfg.startFen = fen.trim(); }
    } catch (e) { setErr(`Could not load position: ${String((e as Error).message ?? e).slice(0, 140)}`); return; }
    start(cfg);
  };

  return (
    <div>
      <TopBar title={title} onBack={back} />
      <div className="ci-page" style={{ maxWidth: 760 }}>
        <div className="ci-glass ci-panel" style={{ padding: 22 }}>
          {kind === "time" && (
            <div className="ci-field"><div className="ci-label">Opponent</div>
              <div className="ci-seg">
                <button className={`ci-opt ${opp === "ai" ? "on" : ""}`} onClick={() => setOpp("ai")}>🤖 Computer</button>
                <button className={`ci-opt ${opp === "human" ? "on" : ""}`} onClick={() => setOpp("human")}>👥 Local player</button>
              </div></div>
          )}
          {vsAI && (
            <>
              <div className="ci-field"><div className="ci-label">Difficulty</div>
                <div className="ci-level">{AI_LEVELS.map((l) => (
                  <button key={l.id} className={level === l.id ? "on" : ""} onClick={() => setLevel(l.id)} aria-pressed={level === l.id}><b>{l.id}. {l.name}</b><span>{l.elo} est.</span></button>
                ))}</div>
                <small className="ci-muted">{AI_LEVELS[level - 1].desc} Strength is controlled by search depth, time and move-selection noise.</small></div>
              <div className="ci-field"><div className="ci-label">Play as</div>
                <div className="ci-seg">{([["w", "♔ White"], ["b", "♚ Black"], ["random", "🎲 Random"]] as const).map(([c, l]) => <button key={c} className={`ci-opt ${color === c ? "on" : ""}`} onClick={() => setColor(c)}>{l}</button>)}</div></div>
            </>
          )}
          <div className="ci-field"><div className="ci-label">Clock</div>
            <div className="ci-seg">
              {kind !== "time" && <button className={`ci-opt ${preset === "none" ? "on" : ""}`} onClick={() => setPreset("none")}>No clock</button>}
              {PRESETS.map((p) => <button key={p.id} className={`ci-opt ${preset === p.id ? "on" : ""}`} onClick={() => setPreset(p.id)}>{p.group} {p.label}</button>)}
              <button className={`ci-opt ${preset === "custom" ? "on" : ""}`} onClick={() => setPreset("custom")}>Custom</button>
            </div>
            {preset === "custom" && (
              <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                <label className="ci-label">Minutes <input className="ci-input" type="number" min={0.5} max={180} step={0.5} value={cMin} onChange={(e) => setCMin(parseFloat(e.target.value) || 1)} style={{ width: 110, display: "block", marginTop: 4 }} /></label>
                <label className="ci-label">Increment (s) <input className="ci-input" type="number" min={0} max={60} value={cInc} onChange={(e) => setCInc(parseInt(e.target.value) || 0)} style={{ width: 110, display: "block", marginTop: 4 }} /></label>
              </div>
            )}
          </div>
          {!vsAI ? (
            <div className="ci-field"><div className="ci-label">Players</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input className="ci-input" placeholder="Player 1 (White)" value={p1} maxLength={18} onChange={(e) => setP1(e.target.value)} />
                <input className="ci-input" placeholder="Player 2 (Black)" value={p2} maxLength={18} onChange={(e) => setP2(e.target.value)} />
              </div></div>
          ) : (
            <>
              <div className="ci-field"><input className="ci-input" placeholder="Your name (optional)" value={p1} maxLength={18} onChange={(e) => setP1(e.target.value)} /></div>
              <Switch label="Blindfold mode" desc="Hide the computer’s pieces. Moves still appear in the move list; hold Peek to look." on={blind} onChange={setBlind} />
            </>
          )}
          <button className="ci-btn sm" onClick={() => setAdv(!adv)} style={{ marginTop: 6 }}>{adv ? "Hide" : "Show"} advanced: start from FEN / PGN</button>
          {adv && (
            <div style={{ marginTop: 12 }}>
              <div className="ci-field"><div className="ci-label">Custom start position (FEN)</div><input className="ci-input" value={fen} onChange={(e) => setFen(e.target.value)} placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" /></div>
              <div className="ci-field"><div className="ci-label">…or import a game (PGN)</div><textarea className="ci-input" value={pgn} onChange={(e) => setPgn(e.target.value)} placeholder="1. e4 e5 2. Nf3 Nc6 …" /></div>
            </div>
          )}
          {err && <p style={{ color: "#ff6b73" }} role="alert">{err}</p>}
          <button className="ci-btn primary block" style={{ marginTop: 18, padding: ".9rem", fontSize: "1.05rem" }} onClick={go}>Start game</button>
        </div>
      </div>
    </div>
  );
}
