import { useState } from "react";
import { useStore } from "../chess/store";
import { PUZZLES, LESSONS } from "../chess/data";
import { TopBar } from "../components/ui";

const fmtTime = (s: number) => { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return h ? `${h}h ${m}m` : m ? `${m}m ${s % 60}s` : `${s}s`; };

export function Stats({ back }: { back: () => void }) {
  const { stats, puzzles, training } = useStore();
  const [copied, setCopied] = useState<string | null>(null);
  const decided = stats.wins + stats.losses + stats.draws;
  const winPct = decided ? Math.round((stats.wins / decided) * 100) : 0;
  const solved = Object.keys(puzzles.solved).filter((id) => PUZZLES.some((p) => p.id === id)).length;
  const lessons = LESSONS.filter((l) => training.done[l.id]).length;
  const acc = puzzles.attempts ? Math.round((puzzles.correct / puzzles.attempts) * 100) : 0;
  const items: [string, string | number][] = [
    ["Total games", stats.games], ["Wins", stats.wins], ["Losses", stats.losses], ["Draws", stats.draws], ["Win rate", `${winPct}%`],
    ["Current streak", stats.streak], ["Best streak", stats.bestStreak], ["Time played", fmtTime(stats.playTime)],
  ];
  return (
    <div>
      <TopBar title="Statistics" onBack={back} />
      <div className="ci-page">
        <div className="ci-stats-grid">{items.map(([l, v]) => <div key={l} className="ci-stat"><b>{v}</b><span>{l}</span></div>)}</div>
        <p className="ci-muted" style={{ fontSize: ".78rem" }}>Wins, losses and draws count games against the computer and Player 1 (White) in local games.</p>
        <div className="ci-two" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", marginTop: 16 }}>
          <div className="ci-glass ci-panel">
            <div className="ci-label">Puzzles</div>
            <h3 style={{ margin: "6px 0" }}>{solved} / {PUZZLES.length} completed</h3>
            <div className="ci-bar"><i style={{ width: `${(solved / PUZZLES.length) * 100}%` }} /></div>
            <p className="ci-muted" style={{ fontSize: ".85rem" }}>Attempts {puzzles.attempts} · Accuracy {acc}% · Hints used {puzzles.hintsUsed}<br />Puzzle Rush best {puzzles.rushBest} · Survival best {puzzles.survivalBest} · Dailies {Object.keys(puzzles.daily).length}</p>
          </div>
          <div className="ci-glass ci-panel">
            <div className="ci-label">Training</div>
            <h3 style={{ margin: "6px 0" }}>{lessons} / {LESSONS.length} lessons</h3>
            <div className="ci-bar"><i style={{ width: `${(lessons / LESSONS.length) * 100}%` }} /></div>
          </div>
        </div>
        <div className="ci-glass" style={{ marginTop: 16, overflow: "hidden" }}>
          <div className="ci-panel"><div className="ci-label">Recent matches</div></div>
          {stats.history.length === 0 && <p className="ci-muted" style={{ padding: "0 16px 16px" }}>No games yet — finish a match and it will appear here.</p>}
          {stats.history.map((h) => (
            <div key={h.id} className="ci-hist-row">
              <div>
                <b className={h.result === "win" ? "ci-badge-w" : h.result === "loss" ? "ci-badge-l" : "ci-badge-d"}>{h.outcome}</b> · {h.white} vs {h.black}
                <div className="ci-muted" style={{ fontSize: ".76rem" }}>{h.mode} · {h.reason} · {h.moves} moves · {fmtTime(h.duration)} · {new Date(h.date).toLocaleString()}</div>
              </div>
              <button className="ci-btn sm" onClick={() => { void navigator.clipboard?.writeText(h.pgn).catch(() => undefined); setCopied(h.id); setTimeout(() => setCopied(null), 1500); }}>{copied === h.id ? "Copied ✓" : "Copy PGN"}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
