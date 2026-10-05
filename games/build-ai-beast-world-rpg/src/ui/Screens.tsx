import { useEffect, useState } from "react";
import type { Game, Hud } from "../game/game";
import { loadScores, renameScore, getName, loadSettings, saveSettings } from "../game/store";
import { audio } from "../game/audio";
import { input } from "../game/input";
import { HELP_LINES } from "../game/data";

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function ScoreTable({ highlight, compact }: { highlight?: number; compact?: boolean }) {
  const list = loadScores();
  return (
    <div className="panel p-4 w-full">
      <div className="font-title text-lg mb-2 tracking-[.2em]" style={{ color: "#ffd98a" }}>HALL OF WAYFARERS</div>
      {list.length === 0 && <div className="opacity-60 text-sm py-4 text-center">No legends yet. Be the first.</div>}
      <table className="w-full text-sm">
        <tbody>
          {list.slice(0, compact ? 5 : 10).map((s, i) => (
            <tr key={s.id} className="border-t border-white/10" style={{ background: s.id === highlight ? "rgba(255,200,100,.18)" : "transparent", color: s.id === highlight ? "#fff1c8" : undefined }}>
              <td className="py-1 w-7 font-bold" style={{ color: i === 0 ? "#ffd24a" : i === 1 ? "#d8dde6" : i === 2 ? "#e0a070" : "#9a9080" }}>{i + 1}</td>
              <td className="font-semibold truncate max-w-[120px]">{s.name}{s.boss ? " ⚔" : ""}</td>
              <td className="text-right tabular-nums font-bold">{s.score.toLocaleString()}</td>
              <td className="text-right opacity-60 text-xs pl-2">Lv{s.level}</td>
              <td className="text-right opacity-50 text-xs pl-2 hidden sm:table-cell">{fmtTime(s.time)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Controls() {
  const touch = input.touch;
  return (
    <div className="panel p-4 text-sm leading-relaxed">
      <div className="font-title tracking-[.2em] mb-2" style={{ color: "#ffd98a" }}>CONTROLS</div>
      {touch ? (
        <ul className="space-y-1 opacity-90">
          <li>Left thumb: move (push to the edge to sprint) · Right side: drag to look</li>
          <li>⚔️ attack combo (hold after a hit to charge) · 🔨 heavy · ⤴ jump (hold in air to glide) · 💨 dodge</li>
          <li>🌪️ Gale Rend · 🔮 Gravity Bloom · 🦊 Vesper Strike · ☄️ Astral Judgement</li>
          <li>🛡️ block (tap right before impact to parry) · 🔥 Beast Core · 🐾 mount · 👁️ sense · 🎯 lock-on</li>
        </ul>
      ) : (
        <ul className="space-y-1 opacity-90">{HELP_LINES.map((l) => <li key={l}>{l}</li>)}<li>Hold C / Ctrl to dive underwater · Space to surface · Arrow keys also turn the camera</li></ul>
      )}
    </div>
  );
}

export function StartScreen({ game }: { game: Game }) {
  const [view, setView] = useState<"main" | "controls">("main");
  const best = loadScores()[0];
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.code === "Enter") game.startGame(); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [game]);
  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ background: "radial-gradient(ellipse at 30% 40%, rgba(10,6,20,.2), rgba(5,3,12,.85) 75%)", pointerEvents: "auto" }}>
      <div className="min-h-full mx-auto flex flex-col md:flex-row gap-6 items-center md:items-stretch justify-center p-5 w-full max-w-6xl">
        <div className="flex-1 flex flex-col justify-center items-center md:items-start text-center md:text-left anim-up">
          <div className="text-xs tracking-[.5em] opacity-75 mb-2" style={{ color: "#7ae8ff" }}>AN ORIGINAL OPEN-WORLD ACTION RPG</div>
          <h1 className="font-title font-extrabold leading-[.95]" style={{ fontSize: "clamp(40px, min(9vw, 14vh), 112px)", background: "linear-gradient(180deg,#fff4d0 10%,#ffb45a 55%,#c4501a 100%)", WebkitBackgroundClip: "text", color: "transparent", filter: "drop-shadow(0 0 28px rgba(255,140,60,.55)) drop-shadow(0 4px 0 #1a0a02)" }}>AI BEAST<br />WORLD</h1>
          <p className="mt-4 max-w-md text-base md:text-lg opacity-90" style={{ textShadow: "0 2px 8px #000" }}>You wake in ash with no name — and a small, humming ember of a Beast that refuses to leave your side. Seven continents. Seventy states. Two hundred eighty regions. Five oceans. One broken Song.</p>
          <div className="flex flex-wrap gap-3 mt-6 justify-center md:justify-start">
            <button className="btn" style={{ fontSize: "1.1rem", padding: "0.9rem 2rem" }} onClick={() => game.startGame()}>▶ Begin the Awakening</button>
            <button className="btn ghost" onClick={() => setView(view === "main" ? "controls" : "main")}>{view === "main" ? "Controls" : "Back"}</button>
            <button className="btn ghost" onClick={() => { const m = !audio.muted; audio.setMuted(m); const s = loadSettings(); saveSettings({ ...s, muted: m }); setView(view); }}>{audio.muted ? "🔇 Muted" : "🔊 Sound"}</button>
          </div>
          <div className="mt-4 text-xs opacity-70 tracking-wider">{best ? `Best run: ${best.score.toLocaleString()} (Lv ${best.level})` : "Press Enter or tap Begin"} · Press <span className="keycap">Enter</span></div>
        </div>
        <div className="w-full md:w-[340px] flex flex-col gap-4 justify-center anim-up" style={{ animationDelay: ".15s" }}>
          {view === "controls" ? <Controls /> : <ScoreTable />}
          <div className="panel p-3 text-xs opacity-85 leading-relaxed">
            <b style={{ color: "#ffd98a" }}>Core loop:</b> fight with timing — parry red telegraphs, dodge purple ones — chain Gale Rend → Air Attack → Vesper Strike → Astral Judgement, uncover tablets, treasures and Waystones, and awaken Vesper with a rare Beast Core. Topple the Warden.
          </div>
        </div>
      </div>
    </div>
  );
}

export function PauseScreen({ game }: { game: Game; hud: Hud }) {
  const [s, setS] = useState(loadSettings());
  const upd = (n: Partial<typeof s>) => { const v = { ...s, ...n }; setS(v); saveSettings(v); audio.setVolume(v.vol); audio.setMuted(v.muted); input.sens = v.sens; };
  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 overflow-y-auto" style={{ background: "rgba(5,3,12,.72)", pointerEvents: "auto" }}>
      <div className="flex flex-col md:flex-row gap-4 max-w-4xl w-full">
        <div className="panel p-6 flex-1 flex flex-col gap-3 anim-up">
          <div className="font-title text-3xl tracking-[.3em] text-center" style={{ color: "#ffd98a" }}>PAUSED</div>
          <button className="btn" onClick={() => game.resume()}>Resume</button>
          <button className="btn ghost" onClick={() => { game.menuTab = "map"; game.mode = "play"; game.openMenu(); }}>Map · Journal · Character</button>
          <button className="btn ghost" onClick={() => game.restart()}>Restart Run</button>
          <button className="btn ghost" onClick={() => game.endRun("RUN ENDED")}>End Run & Save Score</button>
          <button className="btn ghost" onClick={() => game.toTitle()}>Quit to Title</button>
          <div className="mt-2 text-sm space-y-2">
            <label className="flex items-center gap-3">Volume <input type="range" min={0} max={1} step={0.05} value={s.vol} onChange={(e) => upd({ vol: +e.target.value })} className="flex-1" /></label>
            <label className="flex items-center gap-3">Look speed <input type="range" min={0.4} max={2.5} step={0.1} value={s.sens} onChange={(e) => upd({ sens: +e.target.value })} className="flex-1" /></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={s.muted} onChange={(e) => upd({ muted: e.target.checked })} /> Mute all audio</label>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-4 anim-up" style={{ animationDelay: ".1s" }}><Controls /><ScoreTable compact /></div>
      </div>
    </div>
  );
}

export function DeadScreen({ game, hud }: { game: Game; hud: Hud }) {
  const f = hud.final;
  const [name, setName] = useState(getName());
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") { if (e.code === "Enter") (e.target as HTMLInputElement).blur(); return; }
      if (e.code === "KeyR" || e.code === "Enter" || e.code === "Space") game.restart();
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [game]);
  if (!f) return <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="font-title text-5xl tracking-[.3em] animate-pulse" style={{ color: "#ff7a6a", textShadow: "0 0 30px #a00" }}>FALLEN</div></div>;
  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 overflow-y-auto" style={{ background: "radial-gradient(circle, rgba(60,5,5,.55), rgba(5,2,8,.9))", pointerEvents: "auto" }}>
      <div className="flex flex-col md:flex-row gap-5 max-w-4xl w-full items-stretch">
        <div className="panel p-6 flex-1 text-center anim-up" style={{ borderColor: f.boss ? "#9ff0ff" : "#ff8a6a" }}>
          <div className="font-title text-4xl md:text-5xl tracking-[.15em]" style={{ color: f.boss ? "#9ff0ff" : "#ff8a6a", textShadow: "0 0 24px currentColor" }}>{f.title}</div>
          <div className="mt-4 text-xs tracking-[.4em] opacity-70">FINAL SCORE</div>
          <div className="font-title text-6xl my-1" style={{ color: "#ffe9b8", textShadow: "0 0 24px rgba(255,160,60,.7)" }}>{f.score.toLocaleString()}</div>
          {f.rank >= 0 && f.rank < 10 && <div className="font-bold tracking-widest animate-pulse" style={{ color: "#ffd24a" }}>★ {f.rank === 0 ? "NEW HIGH SCORE" : `RANK #${f.rank + 1}`} ★</div>}
          <div className="grid grid-cols-3 gap-2 my-4 text-sm">
            <div className="panel p-2"><div className="opacity-60 text-xs">Beasts slain</div><b className="text-xl">{f.kills}</b></div>
            <div className="panel p-2"><div className="opacity-60 text-xs">Level</div><b className="text-xl">{f.level}</b></div>
            <div className="panel p-2"><div className="opacity-60 text-xs">Time</div><b className="text-xl">{fmtTime(f.time)}</b></div>
          </div>
          <div className="text-xs opacity-70 mb-3">Discoveries {hud.stats.discoveries} · Chests {hud.stats.chests} · Tablets {hud.stats.tablets} · Waystones {hud.stats.portals}</div>
          <div className="flex items-center gap-2 justify-center mb-4">
            <span className="text-xs opacity-70 tracking-widest">NAME</span>
            <input value={name} maxLength={14} onChange={(e) => setName(e.target.value.toUpperCase())} onBlur={() => renameScore(f.id, name || "WAYFARER")} className="px-2 py-1 rounded bg-black/50 border border-white/30 text-center font-bold tracking-widest w-44" style={{ userSelect: "text" }} />
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button className="btn" onClick={() => { renameScore(f.id, name || "WAYFARER"); game.restart(); }}>↻ Restart (R)</button>
            <button className="btn ghost" onClick={() => { renameScore(f.id, name || "WAYFARER"); game.toTitle(); }}>Title</button>
          </div>
        </div>
        <div className="w-full md:w-[340px] anim-up" style={{ animationDelay: ".12s" }}><ScoreTable highlight={f.id} /></div>
      </div>
    </div>
  );
}

export function VictoryScreen({ game, hud }: { game: Game; hud: Hud }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-4" style={{ background: "radial-gradient(circle, rgba(10,40,60,.5), rgba(3,5,12,.9))", pointerEvents: "auto" }}>
      <div className="panel p-8 max-w-xl text-center anim-up" style={{ borderColor: "#9ff0ff" }}>
        <div className="text-xs tracking-[.5em] opacity-70" style={{ color: "#9ff0ff" }}>THE FIRST GATE</div>
        <div className="font-title text-4xl md:text-5xl my-2" style={{ color: "#bff4ff", textShadow: "0 0 28px #3ac0ff" }}>THE WARDEN HAS FALLEN</div>
        <p className="opacity-90 text-sm md:text-base">The Wastelands are yours to roam. Six Wardens still wait beyond the Tidewall — but Vesper remembers a little more now. Keep exploring: tablets, Waystones, caves and a floating isle remain.</p>
        <div className="my-4 font-title text-4xl" style={{ color: "#ffe9b8" }}>{hud.score.toLocaleString()}</div>
        <div className="flex gap-3 justify-center flex-wrap">
          <button className="btn" onClick={() => game.continueAfterVictory()}>Continue Exploring</button>
          <button className="btn ghost" onClick={() => { game.continueAfterVictory(); game.endRun("VICTORY — THE WARDEN FALLS"); }}>End Run & Save Score</button>
        </div>
      </div>
    </div>
  );
}
