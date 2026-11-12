import { useEffect, useState } from "react";
import { useApp, useHud } from "../game/store";
import { input } from "../game/input";
import { audio } from "../game/audio";
import { ARENAS, FIGHTERS, PLAYER_COLORS, keyLabel, type Action } from "../game/data";
import { getArt } from "../game/showcase";
import { Btn, ShowCanvas, elIcon } from "./ui";
import { getGame } from "./GameView";
import { ControlsPanel } from "./Screens";

// ------------------------------------------------------------------ versus intro
export function Versus() {
  const { p1, p2, arena, go, mode } = useApp();
  const [n, setN] = useState(4);
  useEffect(() => {
    audio.play("bigexplosion", 0.5);
    const ts = [
      setTimeout(() => { setN(3); audio.play("count"); }, 2200),
      setTimeout(() => { setN(2); audio.play("count"); }, 3000),
      setTimeout(() => { setN(1); audio.play("count"); }, 3800),
      setTimeout(() => go("game"), 4600),
    ];
    return () => ts.forEach(clearTimeout);
  }, [go]);
  const f1 = FIGHTERS[p1], f2 = FIGHTERS[p2];
  return (
    <div className="absolute inset-0 overflow-hidden bg-arena" style={{ animation: n === 1 ? "none" : undefined }}>
      <div className="speedlines" />
      <div className="absolute inset-0" style={{ background: `linear-gradient(115deg, ${f1.color}55 0%, transparent 45%, transparent 55%, ${f2.color}55 100%)` }} />
      <div className="absolute left-[4%] bottom-0 h-[96%] slidel flex items-end"><img src={getArt(p1, "full")} className="h-full object-contain" style={{ filter: `drop-shadow(0 0 30px ${f1.color})` }} /></div>
      <div className="absolute right-[4%] bottom-0 h-[96%] slider flex items-end"><img src={getArt(p2, "full")} className="h-full object-contain -scale-x-100" style={{ filter: `drop-shadow(0 0 30px ${f2.color})` }} /></div>
      <div className="absolute left-[6%] top-[8%] slidel"><div className="font-display text-3xl" style={{ color: PLAYER_COLORS[0] }}>PLAYER 1</div><div className="font-display text-[9vmin] leading-none">{f1.name}</div><div className="font-display text-2xl text-white/70">{elIcon[f1.element]} {f1.title}</div></div>
      <div className="absolute right-[6%] top-[8%] slider text-right"><div className="font-display text-3xl" style={{ color: PLAYER_COLORS[1] }}>{mode === "practice" ? "PLAYER 2" : "PLAYER 2"}</div><div className="font-display text-[9vmin] leading-none">{f2.name}</div><div className="font-display text-2xl text-white/70">{f2.title} {elIcon[f2.element]}</div></div>
      <div className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 vs-text logo text-[26vmin]">VS</div>
      <div className="absolute left-1/2 bottom-[7%] -translate-x-1/2 text-center fadein" style={{ animationDelay: ".6s" }}>
        <div className="tracking-[.6em] text-sm text-white/60">{mode === "practice" ? "TRAINING" : mode === "tournament" ? "TOURNAMENT" : "VERSUS"} · ARENA</div>
        <div className="font-display text-6xl" style={{ textShadow: `0 0 24px ${ARENAS[arena].colorA}` }}>{ARENAS[arena].name}</div>
      </div>
      {n <= 3 && <div key={n} className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 font-display text-[30vmin] countdown text-white" style={{ textShadow: "0 0 60px #ff2bd6" }}>{n}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ HUD
function Meter({ v, color, h = 6, glow }: { v: number; color: string; h?: number; glow?: boolean }) {
  return <div className="bg-black/60 skew-x-[-20deg] overflow-hidden border border-white/30" style={{ height: h }}><div className={`h-full ${glow ? "pulse" : ""}`} style={{ width: `${Math.max(0, Math.min(100, v))}%`, background: color, boxShadow: glow ? `0 0 12px ${color}` : undefined }} /></div>;
}

function Side({ p }: { p: 0 | 1 }) {
  const f = useHud((s) => s.f[p]);
  const char = useApp((s) => (p === 0 ? s.p1 : s.p2));
  const wins = useHud((s) => s.wins[p]);
  const mode = useHud((s) => s.mode);
  const def = FIGHTERS[char];
  const hp = (f.hp / f.maxHp) * 100;
  const lag = (f.hpShown / f.maxHp) * 100;
  const low = hp < 25;
  const rev = p === 1;
  return (
    <div className={`flex gap-3 items-start ${rev ? "flex-row-reverse" : ""}`}>
      <div className="relative shrink-0">
        <img src={getArt(char, "face")} className="w-[5.2rem] h-[5.2rem] object-cover" style={{ border: `3px solid ${PLAYER_COLORS[p]}`, boxShadow: `0 0 18px ${f.transformed ? def.formColor.toString(16) && "#ffd23f" : PLAYER_COLORS[p]}`, background: "#0b0720", clipPath: "polygon(0 0, 100% 0, 100% 85%, 85% 100%, 0 100%)" }} />
        <div className="absolute -bottom-1 left-0 right-0 text-center font-display text-sm" style={{ background: PLAYER_COLORS[p] }}>P{p + 1}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className={`flex items-baseline gap-3 ${rev ? "flex-row-reverse" : ""}`}>
          <span className="font-display text-3xl leading-none">{def.name}</span>
          <span className="text-xs tracking-[.3em] text-white/60">{def.title}</span>
          {f.transformed && <span className="font-display text-lg text-yellow-300 pulse">{def.formName}</span>}
        </div>
        <div className="h-7 my-1"><div className="bar" style={{ transform: `skewX(${rev ? 20 : -20}deg)` }}>
          <i style={{ width: `${lag}%`, background: "#fff6" }} />
          <i className={low ? "pulse" : ""} style={{ width: `${hp}%`, background: low ? "linear-gradient(90deg,#ff2a2a,#ff8a3c)" : `linear-gradient(90deg, ${def.color}, ${def.color2})`, ...(rev ? { left: "auto", right: 0 } : {}) }} />
          {rev && <i style={{ width: `${lag}%`, background: "#fff6", left: "auto", right: 0, zIndex: 0 }} />}
        </div></div>
        <div style={{ transform: rev ? "scaleX(-1)" : undefined }} className="space-y-[3px]">
          <Meter v={f.ki} color="linear-gradient(90deg,#18d4ff,#7dffb0)" h={7} />
          <div className="flex gap-1">
            <div className="flex-1"><Meter v={f.ult} color="linear-gradient(90deg,#ffb020,#fff060)" h={7} glow={f.ult >= 100} /></div>
            <div className="flex-1"><Meter v={f.transformed ? (f.xfLeft / 20) * 100 : f.xf} color={f.transformed ? "linear-gradient(90deg,#ff2bd6,#fff)" : "linear-gradient(90deg,#8c3cff,#ff2bd6)"} h={7} glow={f.xf >= 100 || f.transformed} /></div>
          </div>
          <Meter v={f.guard} color="#9fb4ff" h={3} />
        </div>
        <div className={`flex gap-3 text-[11px] tracking-widest mt-0.5 ${rev ? "flex-row-reverse" : ""}`}>
          <span className="text-cyan-300">KI</span>
          <span className={f.ult >= 100 ? "text-yellow-300 pulse" : "text-white/40"}>{f.ult >= 100 ? "ULTIMATE READY" : `ULT ${Math.floor(f.ult)}%`}</span>
          <span className={f.xf >= 100 ? "text-pink-300 pulse" : "text-white/40"}>{f.transformed ? `FORM ${Math.ceil(f.xfLeft)}s` : f.xf >= 100 ? "TRANSFORM READY" : `FORM ${Math.floor(f.xf)}%`}</span>
          {mode !== "practice" && <span className="flex gap-1 ml-auto">{[0, 1].map((i) => <i key={i} className="w-3 h-3 rotate-45 border-2" style={{ borderColor: PLAYER_COLORS[p], background: i < wins ? PLAYER_COLORS[p] : "transparent", boxShadow: i < wins ? `0 0 8px ${PLAYER_COLORS[p]}` : "none" }} />)}</span>}
        </div>
      </div>
    </div>
  );
}

function Skills({ p }: { p: 0 | 1 }) {
  const f = useHud((s) => s.f[p]);
  useHud((s) => s.paused);
  const char = useApp((s) => (p === 0 ? s.p1 : s.p2));
  const def = FIGHTERS[char];
  const b = input.bindings[p];
  const items: { a: Action; name: string; cd: number; ok: boolean; lit: boolean; accent?: string }[] = [
    { a: "s1", name: def.s1.name, cd: f.cd[0], ok: f.kiOk[0], lit: false },
    { a: "s2", name: def.s2.name, cd: f.cd[1], ok: f.kiOk[1], lit: false },
    { a: "heavy", name: def.sig.name, cd: f.cd[2], ok: f.kiOk[2], lit: false },
    { a: "ult", name: def.ult.name, cd: f.ult >= 100 ? 0 : 1, ok: f.ult >= 100, lit: f.ult >= 100, accent: "#ffd23f" },
    { a: "transform", name: def.formName, cd: f.xf >= 100 && !f.transformed ? 0 : 1, ok: f.xf >= 100 && !f.transformed, lit: f.xf >= 100 && !f.transformed, accent: "#ff2bd6" },
  ];
  return (
    <div className={`flex gap-2 ${p === 1 ? "flex-row-reverse" : ""}`}>
      {items.map((it) => (
        <div key={it.a} className="relative w-[4.6rem] h-[4.6rem] panel overflow-hidden text-center" style={{ borderColor: it.lit ? it.accent : undefined, boxShadow: it.lit ? `0 0 18px ${it.accent}` : undefined, opacity: it.ok && it.cd <= 0 ? 1 : 0.7 }}>
          <div className="absolute inset-x-0 bottom-0 bg-black/70" style={{ height: `${Math.min(1, it.cd) * 100}%` }} />
          <div className="absolute top-0.5 left-1 right-1 font-display text-xl" style={{ color: it.accent ?? def.color }}>{keyLabel(b[it.a])}</div>
          <div className="absolute bottom-0.5 left-0.5 right-0.5 text-[9px] leading-[10px] font-bold tracking-wide uppercase">{it.name}</div>
          {!it.ok && it.cd <= 0 && <div className="absolute inset-0 bg-blue-900/60 flex items-center justify-center text-[10px]">NO KI</div>}
        </div>
      ))}
    </div>
  );
}

function Combo({ p }: { p: 0 | 1 }) {
  const f = useHud((s) => s.f[p]);
  if (f.combo < 2) return null;
  return (
    <div key={f.combo} className={`absolute top-[26%] ${p === 0 ? "left-[3%]" : "right-[3%] text-right"} font-display`} style={{ animation: "vspop .25s both", color: PLAYER_COLORS[p] }}>
      <div className="text-[9vmin] leading-none" style={{ textShadow: "0 0 20px currentColor, 3px 3px 0 #000" }}>{f.combo} <span className="text-[4vmin]">HITS</span></div>
      <div className="text-2xl text-white" style={{ textShadow: "2px 2px 0 #000" }}>{Math.round(f.comboDmg)} DAMAGE</div>
    </div>
  );
}

export function HUD() {
  const hud = useHud();
  const mode = useApp((s) => s.mode);
  const practice = mode === "practice";
  const prevent = (e: React.MouseEvent) => e.preventDefault();
  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      <div className="absolute top-3 left-4 right-4 grid grid-cols-[1fr_8.5rem_1fr] gap-5 items-start">
        <Side p={0} />
        <div className="text-center">
          <div className="font-display text-6xl leading-none" style={{ textShadow: "0 0 18px #ff2bd6, 3px 3px 0 #000", color: hud.timer <= 10 && !practice ? "#ff4a5c" : "#fff" }}>{practice ? "∞" : hud.timer}</div>
          <div className="text-[11px] tracking-[.4em] text-white/60">{practice ? "TRAINING" : `ROUND ${hud.round}`}</div>
        </div>
        <Side p={1} />
      </div>
      <Combo p={0} /><Combo p={1} />
      <div className="absolute bottom-3 left-4"><Skills p={0} /></div>
      <div className="absolute bottom-3 right-4"><Skills p={1} /></div>
      {practice && !hud.paused && (
        <div className="absolute top-[7.5rem] left-1/2 -translate-x-1/2 flex gap-2 pointer-events-auto items-center">
          <button tabIndex={-1} onMouseDown={prevent} onClick={() => getGame()?.togglePractice("infHp")} className={`px-3 py-1 text-sm font-bold tracking-widest panel ${hud.infHp ? "text-green-300" : "text-white/60"}`}>INFINITE HEALTH: {hud.infHp ? "ON" : "OFF"}</button>
          <button tabIndex={-1} onMouseDown={prevent} onClick={() => getGame()?.togglePractice("infKi")} className={`px-3 py-1 text-sm font-bold tracking-widest panel ${hud.infKi ? "text-green-300" : "text-white/60"}`}>INFINITE KI: {hud.infKi ? "ON" : "OFF"}</button>
          <button tabIndex={-1} onMouseDown={prevent} onClick={() => getGame()?.resetPractice()} className="px-3 py-1 text-sm font-bold tracking-widest panel text-cyan-300">RESET POSITIONS (BKSP)</button>
        </div>
      )}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[11px] tracking-[.3em] text-white/30">ESC / START: PAUSE</div>
      {hud.paused && <PauseMenu />}
    </div>
  );
}

function PauseMenu() {
  const go = useApp((s) => s.go);
  const mode = useApp((s) => s.mode);
  const [ctrl, setCtrl] = useState(false);
  const hud = useHud();
  return (
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center pointer-events-auto overflow-auto">
      <div className="w-[min(70rem,94vw)] fadein">
        <div className="font-display text-7xl text-center mb-4">PAUSED</div>
        {ctrl ? (
          <div className="bg-black/50 p-4"><ControlsPanel /><div className="mt-3"><Btn small onClick={() => setCtrl(false)} sound="ui_back">← BACK</Btn></div></div>
        ) : (
          <div className="w-[26rem] mx-auto flex flex-col gap-2">
            <Btn onClick={() => getGame()?.resume()}>RESUME</Btn>
            {mode === "practice" ? (
              <>
                <Btn onClick={() => getGame()?.togglePractice("infHp")} on={hud.infHp}>INFINITE HEALTH: {hud.infHp ? "ON" : "OFF"}</Btn>
                <Btn onClick={() => getGame()?.togglePractice("infKi")} on={hud.infKi}>INFINITE KI: {hud.infKi ? "ON" : "OFF"}</Btn>
                <Btn onClick={() => getGame()?.resetPractice()}>RESET POSITIONS</Btn>
              </>
            ) : <Btn onClick={() => { getGame()?.restartMatch(); }}>RESTART MATCH</Btn>}
            <Btn onClick={() => setCtrl(true)}>CONTROLS</Btn>
            <Btn onClick={() => go("menu")} sound="ui_back">QUIT TO MENU</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ results
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function Results() {
  const { result: r, go, rematch, mode, tourney } = useApp();
  useEffect(() => { audio.play("victory"); }, []);
  if (!r) return null;
  const w = r.winner === -1 ? 0 : r.winner;
  const wc = FIGHTERS[r.chars[w]];
  const decided = mode === "tournament" && (tourney.wins[0] >= 2 || tourney.wins[1] >= 2 || tourney.match >= 3);
  const rows: [string, (i: 0 | 1) => string | number][] = [
    ["ROUNDS WON", (i) => r.rounds[i]], ["TOTAL DAMAGE", (i) => Math.round(r.stats[i].damage)], ["HIGHEST COMBO", (i) => `${r.stats[i].maxCombo} HITS`],
    ["HITS LANDED", (i) => r.stats[i].hits], ["BLOCKS / PARRIES", (i) => `${r.stats[i].blocks} / ${r.stats[i].parries}`], ["ULTIMATES", (i) => r.stats[i].ultimates],
  ];
  return (
    <div className="absolute inset-0 bg-arena overflow-hidden">
      <div className="speedlines" />
      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 28% 60%, ${wc.color}55, transparent 55%)` }} />
      <div className="absolute left-0 top-0 bottom-0 w-[48%]"><ShowCanvas chars={[r.chars[w]]} pose="victory" camZ={5.2} camY={1.5} lookY={1.0} yaw={[0.3]} orbit /></div>
      <div className="absolute right-[4vw] top-[7vh] bottom-[3vh] w-[46%] flex flex-col justify-center slider">
        <div className="tracking-[.6em] text-sm text-white/60">{ARENAS[r.arena].name} · {mmss(r.duration)}</div>
        <div className="font-display text-[6.5vmin] leading-none" style={{ color: PLAYER_COLORS[w] }}>PLAYER {w + 1} WINS</div>
        <div className="logo text-[10vmin] mb-3">{wc.name}</div>
        <div className="panel p-4">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-8 gap-y-0.5 text-base">
            <div /><div className="font-display text-2xl text-center" style={{ color: PLAYER_COLORS[0] }}>P1 {FIGHTERS[r.chars[0]].name}</div><div className="font-display text-2xl text-center" style={{ color: PLAYER_COLORS[1] }}>P2 {FIGHTERS[r.chars[1]].name}</div>
            {rows.map(([l, f]) => (<div key={l} className="contents"><div className="text-white/60 tracking-widest">{l}</div><div className="text-center font-bold">{f(0)}</div><div className="text-center font-bold">{f(1)}</div></div>))}
            <div className="text-white/60 tracking-widest">MATCH DURATION</div><div className="col-span-2 text-center font-bold">{mmss(r.duration)}</div>
          </div>
        </div>
        {mode === "tournament" && <div className="mt-2 text-yellow-300 tracking-widest">TOURNAMENT STANDINGS — P1 {tourney.wins[0]} : {tourney.wins[1]} P2 (MATCH {tourney.match}/3)</div>}
        <div className="flex gap-3 mt-4 flex-wrap">
          {mode === "tournament" ? (
            <Btn small on onClick={() => go(decided ? "champion" : "select")}>{decided ? "CROWN THE CHAMPION 🏆" : "NEXT MATCH ▶"}</Btn>
          ) : <Btn small on onClick={rematch}>REMATCH</Btn>}
          {mode !== "tournament" && <Btn small onClick={() => go("select")}>CHARACTER SELECT</Btn>}
          <Btn small onClick={() => go("menu")} sound="ui_back">MAIN MENU</Btn>
        </div>
      </div>
    </div>
  );
}

export function Champion() {
  const { tourney, go, resetTourney } = useApp();
  const w: 0 | 1 = tourney.wins[0] === tourney.wins[1] ? ((tourney.history[tourney.history.length - 1]?.winner === 1 ? 1 : 0) as 0 | 1) : tourney.wins[0] > tourney.wins[1] ? 0 : 1;
  const last = [...tourney.history].reverse().find((h) => h.winner === w);
  const ch = last ? last.chars[w] : 0;
  const def = FIGHTERS[ch];
  useEffect(() => { audio.play("victory"); setTimeout(() => audio.play("bigexplosion", 0.4), 400); }, []);
  return (
    <div className="absolute inset-0 bg-arena overflow-hidden">
      <div className="speedlines" />
      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 55%, ${def.color}66, transparent 60%)` }} />
      <div className="absolute inset-0"><ShowCanvas chars={[ch]} pose="victory" camZ={5.4} camY={1.5} lookY={1.05} forms orbit /></div>
      <div className="absolute top-[4vh] left-0 right-0 text-center fadein">
        <div className="tracking-[.8em] text-yellow-300 text-lg">🏆 TOURNAMENT CHAMPION 🏆</div>
        <div className="font-display text-[11vmin] leading-none" style={{ color: PLAYER_COLORS[w], textShadow: `0 0 30px ${PLAYER_COLORS[w]}` }}>PLAYER {w + 1}</div>
        <div className="logo text-[12vmin]">{def.name}</div>
      </div>
      <div className="absolute left-6 bottom-6 panel p-4 w-72">
        <div className="font-display text-2xl mb-1">MATCH HISTORY</div>
        {tourney.history.map((h, i) => <div key={i} className="flex justify-between text-sm"><span>#{i + 1} {ARENAS[h.arena].name}</span><span style={{ color: PLAYER_COLORS[h.winner === 1 ? 1 : 0] }}>{h.winner < 0 ? "DRAW" : `P${h.winner + 1} — ${FIGHTERS[h.chars[h.winner]].name}`}</span></div>)}
        <div className="mt-1 text-yellow-300">FINAL: P1 {tourney.wins[0]} : {tourney.wins[1]} P2</div>
      </div>
      <div className="absolute right-6 bottom-6 flex gap-3">
        <Btn small on onClick={() => { resetTourney(); go("select"); }}>NEW TOURNAMENT</Btn>
        <Btn small onClick={() => { resetTourney(); go("menu"); }} sound="ui_back">MAIN MENU</Btn>
      </div>
    </div>
  );
}
