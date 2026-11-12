import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Board } from "../chess/Board";
import { OPERA_GAME } from "../chess/data";
import { START_FEN, trackPieces } from "../chess/rules";
import { useStore } from "../chess/store";
import type { Route } from "../App";

function OperaBackground() {
  const s = useStore((st) => st.settings);
  const moves = useMemo(() => { const c = new Chess(); OPERA_GAME.forEach((m) => c.move(m)); return c.history({ verbose: true }); }, []);
  const [k, setK] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setK((x) => (x >= moves.length + 2 ? 0 : x + 1)), 1700);
    return () => clearInterval(id);
  }, [moves.length]);
  const shown = moves.slice(0, Math.min(k, moves.length));
  const pieces = useMemo(() => trackPieces(START_FEN, shown), [shown.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const last = shown[shown.length - 1];
  return (
    <div className="ci-menu-bg" aria-hidden>
      <div><Board pieces={pieces} orientation="w" theme={s.boardTheme} pieceStyle={s.pieceStyle} showCoords={false} lastMove={last ? { from: last.from, to: last.to } : null} interactiveColor={null} animations /></div>
    </div>
  );
}

interface CardDef { icon: string; title: string; desc: string; go: Route; featured?: boolean }
const CARDS: CardDef[] = [
  { icon: "♔", title: "Play Local", desc: "Two players, one board. Configurable clocks, undo, draw offers and board flip.", go: { name: "setup", kind: "local" }, featured: true },
  { icon: "🤖", title: "Play Against AI", desc: "Five difficulty levels powered by a real alpha-beta search engine.", go: { name: "setup", kind: "ai" }, featured: true },
  { icon: "🧩", title: "Puzzles", desc: "Mates, forks, pins, skewers, discoveries and defence — with hints.", go: { name: "puzzles", mode: "library" } },
  { icon: "🎓", title: "Training", desc: "Interactive lessons from piece movement to basic checkmates.", go: { name: "training" } },
  { icon: "⏱", title: "Time Challenge", desc: "Bullet, Blitz and Rapid presets — or your own clock.", go: { name: "setup", kind: "time" } },
  { icon: "📖", title: "Opening Explorer", desc: "Step through 15 popular openings, then test yourself.", go: { name: "openings" } },
  { icon: "📅", title: "Daily Challenge", desc: "A fresh tactical puzzle every day.", go: { name: "puzzles", mode: "daily" } },
  { icon: "⚡", title: "Puzzle Rush", desc: "Solve as many as you can in three minutes.", go: { name: "puzzles", mode: "rush" } },
  { icon: "♾", title: "Survival Chess", desc: "Increasingly hard positions. Three lives. How far can you go?", go: { name: "puzzles", mode: "survival" } },
  { icon: "🙈", title: "Blindfold Training", desc: "Opponent pieces vanish. Trust your visualisation.", go: { name: "setup", kind: "ai", blindfold: true } },
  { icon: "📊", title: "Statistics", desc: "Your record, streaks, puzzle progress and match history.", go: { name: "stats" } },
  { icon: "⚙", title: "Settings", desc: "Board themes, piece collections, sound and gameplay.", go: { name: "settings" } },
];

export function Menu({ go }: { go: (r: Route) => void }) {
  const toggleMode = useStore((st) => st.settings.uiMode);
  const upd = useStore((st) => st.updateSettings);
  return (
    <div className="ci-menu">
      <OperaBackground />
      <div className="ci-menu-veil" />
      <div className="ci-menu-inner">
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="ci-btn icon" aria-label="Toggle light / dark" onClick={() => upd({ uiMode: toggleMode === "dark" ? "light" : "dark" })}>{toggleMode === "dark" ? "☀" : "☾"}</button>
        </div>
        <header style={{ textAlign: "center", marginTop: 4 }}>
          <div className="ci-logo"><div className="ci-logo-mark ci-serif">♞</div></div>
          <h1 className="ci-logo-text ci-serif" style={{ margin: "14px 0 6px" }}>CHESS <em>INFINITY</em></h1>
          <p className="ci-muted ci-serif" style={{ fontSize: "1.1rem", fontStyle: "italic", margin: 0 }}>Every Move Creates a New Possibility.</p>
          <div style={{ marginTop: 18 }}>
            <button className="ci-btn primary" style={{ padding: ".85rem 2rem", fontSize: "1.05rem" }} onClick={() => go({ name: "setup", kind: "local" })}>▶ Quick Play</button>
          </div>
        </header>
        <div className="ci-cards">
          {CARDS.map((c, i) => (
            <button key={c.title} className={`ci-card ${c.featured ? "featured" : ""}`} style={{ animationDelay: `${i * 40}ms` }} onClick={() => go(c.go)}>
              <div className="ico">{c.icon}</div><h3>{c.title}</h3><p>{c.desc}</p>
            </button>
          ))}
        </div>
        <p className="ci-muted" style={{ textAlign: "center", marginTop: 34, fontSize: ".78rem" }}>Background: Morphy’s “Opera Game” (1858), playing itself.</p>
      </div>
    </div>
  );
}
