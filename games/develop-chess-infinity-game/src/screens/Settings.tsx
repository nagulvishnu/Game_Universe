import { useState } from "react";
import { Board } from "../chess/Board";
import { START_FEN, initialPieces } from "../chess/rules";
import { useStore } from "../chess/store";
import { Confirm, PiecePicker, Switch, ThemePicker, TopBar } from "../components/ui";

export function Settings({ back }: { back: () => void }) {
  const s = useStore((st) => st.settings); const upd = useStore((st) => st.updateSettings); const reset = useStore((st) => st.resetAll);
  const [confirm, setConfirm] = useState(false);
  return (
    <div>
      <TopBar title="Settings" onBack={back} />
      <div className="ci-page">
        <div className="ci-two" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(260px,340px)" }}>
          <div>
            <div className="ci-field"><div className="ci-label">Appearance</div>
              <div className="ci-seg">{(["dark", "light"] as const).map((m) => <button key={m} className={`ci-opt ${s.uiMode === m ? "on" : ""}`} onClick={() => upd({ uiMode: m })}>{m === "dark" ? "☾ Dark" : "☀ Light"}</button>)}</div></div>
            <div className="ci-field"><div className="ci-label">Board theme</div><ThemePicker /><small className="ci-muted">Choosing a theme also applies its matching piece collection; change pieces separately below.</small></div>
            <div className="ci-field"><div className="ci-label">Piece collection</div><PiecePicker /></div>
            <div className="ci-glass ci-panel" style={{ marginBottom: 16 }}>
              <div className="ci-label">Gameplay</div>
              <Switch label="Coordinate labels" on={s.coords} onChange={(v) => upd({ coords: v })} />
              <Switch label="Show legal moves" desc="Dots and rings on destination squares" on={s.legalMoves} onChange={(v) => upd({ legalMoves: v })} />
              <Switch label="Highlight last move" on={s.highlightLast} onChange={(v) => upd({ highlightLast: v })} />
              <Switch label="Piece animations" on={s.animations} onChange={(v) => upd({ animations: v })} />
              <Switch label="Auto-queen promotion" desc="Skip the promotion chooser" on={s.autoQueen} onChange={(v) => upd({ autoQueen: v })} />
              <Switch label="Auto-flip board (local play)" desc="Rotate the board to the player to move" on={s.autoFlip} onChange={(v) => upd({ autoFlip: v })} />
            </div>
            <div className="ci-glass ci-panel" style={{ marginBottom: 16 }}>
              <div className="ci-label">Audio</div>
              <Switch label="Sound effects" on={s.sound} onChange={(v) => upd({ sound: v })} />
              <Switch label="Background music" desc="Soft generative ambience" on={s.music} onChange={(v) => upd({ music: v })} />
              <div className="ci-field" style={{ margin: "8px 0 0" }}><div className="ci-label">Volume {Math.round(s.volume * 100)}%</div>
                <input className="ci-range" type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => upd({ volume: parseFloat(e.target.value) })} aria-label="Volume" /></div>
            </div>
            <div className="ci-glass ci-panel">
              <div className="ci-label">Data</div>
              <p className="ci-muted" style={{ fontSize: ".85rem" }}>Preferences, statistics, puzzle and training progress are stored in this browser.</p>
              <button className="ci-btn danger" onClick={() => setConfirm(true)}>Reset all saved data</button>
            </div>
          </div>
          <div style={{ position: "sticky", top: 12, alignSelf: "start" }}>
            <div className="ci-label" style={{ marginBottom: 8 }}>Preview</div>
            <Board pieces={initialPieces(START_FEN)} orientation="w" theme={s.boardTheme} pieceStyle={s.pieceStyle} showCoords={s.coords} lastMove={s.highlightLast ? { from: "e2", to: "e4" } : null} interactiveColor={null} />
          </div>
        </div>
      </div>
      {confirm && <Confirm danger title="Reset all data?" text="This permanently deletes your statistics, match history, puzzle and training progress, and restores default settings." confirm="Reset everything" onConfirm={() => { reset(); setConfirm(false); }} onCancel={() => setConfirm(false)} />}
    </div>
  );
}
