import { ReactNode, useEffect } from "react";
import { useGame, useHud, Screen } from "../store";
import { HERO, HeroId, UPGRADES, ENEMY_INFO, xpNeeded, MAX_LEVEL } from "../data";
import { AbilityIcon, Portrait } from "./icons";
import { engine } from "../game/engine";
import { MISSIONS, missionState } from "../game/missions";
import { sfx } from "../game/audio";
import { G } from "../game/core";

const F = { fontFamily: "Rajdhani, 'Segoe UI', sans-serif" } as const;
const O = { fontFamily: "Orbitron, Rajdhani, sans-serif" } as const;

function Btn({ children, onClick, primary, disabled, small, color }: { children: ReactNode; onClick?: () => void; primary?: boolean; disabled?: boolean; small?: boolean; color?: string }) {
  return (
    <button
      disabled={disabled}
      onClick={() => { sfx("ui"); onClick?.(); }}
      onMouseEnter={() => sfx("ui", undefined, 0.3)}
      className={`anime-btn ${primary ? "anime-btn-primary" : ""} ${small ? "py-1.5 text-sm" : "py-3 text-xl"}`}
      style={{ ...F, ...(color ? { ["--c" as any]: color } : {}) }}
    >
      <span>{children}</span>
    </button>
  );
}
const Title = ({ children, sub }: { children: ReactNode; sub?: string }) => (
  <div className="mb-4">
    <div className="text-4xl font-black italic tracking-[.12em]" style={{ ...O, textShadow: "0 0 24px #ff7a1a, 3px 3px 0 #8a5cff" }}>{children}</div>
    {sub && <div className="mt-1 text-sm tracking-[.3em] text-white/60">{sub}</div>}
  </div>
);
const go = (s: Screen, back?: Screen) => useGame.getState().setScreen(s, back);

export function MainMenu() {
  const st = useGame();
  return (
    <div className="absolute inset-0 flex" style={{ ...F, background: "linear-gradient(90deg,rgba(6,6,18,.92) 0%,rgba(6,6,18,.55) 45%,rgba(6,6,18,0) 75%)" }}>
      <div className="flex w-[560px] flex-col justify-center pl-16">
        <div className="logo-wrap">
          <div className="text-[92px] font-black italic leading-[.85] tracking-tight" style={{ ...O, background: "linear-gradient(180deg,#fff 10%,#ffd23f 45%,#ff6a1a 80%)", WebkitBackgroundClip: "text", color: "transparent", filter: "drop-shadow(0 0 22px #ff6a1a) drop-shadow(5px 5px 0 #6a3cff)" }}>HERO</div>
          <div className="text-[92px] font-black italic leading-[.95] tracking-tight" style={{ ...O, background: "linear-gradient(180deg,#fff 10%,#9fe8ff 45%,#8a5cff 85%)", WebkitBackgroundClip: "text", color: "transparent", filter: "drop-shadow(0 0 22px #8a5cff) drop-shadow(5px 5px 0 #ff6a1a)" }}>CITY</div>
        </div>
        <div className="mb-8 mt-3 text-lg font-semibold tracking-[.22em] text-white/80">TWO HEROES. ONE CITY. ENDLESS BATTLES.</div>
        <div className="flex w-[340px] flex-col gap-3">
          <Btn primary onClick={() => go("playing")}>{st.started ? "▶ RESUME" : st.missionsDone.length || st.level > 1 ? "▶ CONTINUE" : "▶ PLAY"}</Btn>
          <Btn onClick={() => go("select", "menu")}>CHARACTER SELECT</Btn>
          <Btn onClick={() => go("settings", "menu")}>SETTINGS</Btn>
          <Btn onClick={() => go("info", "menu")}>GAME INFO</Btn>
        </div>
        <div className="mt-6 flex items-center gap-4 text-sm tracking-widest text-white/60">
          <span>HERO: <b style={{ color: HERO[st.hero].color2 }}>{HERO[st.hero].name}</b></span>
          <span>LEVEL <b className="text-white">{st.level}</b></span>
          <span>MISSIONS <b className="text-white">{st.missionsDone.length}/{MISSIONS.length}</b></span>
          <button className="pointer-events-auto text-xs underline opacity-60 hover:opacity-100" onClick={() => { if (confirm("Reset all saved progress?")) st.resetProgress(); }}>reset save</button>
        </div>
      </div>
      <div className="absolute bottom-4 right-6 text-right text-xs tracking-widest text-white/40">WASD · MOUSE · SPACE ×2 FLY · TAB SWITCH HERO · ESC PAUSE</div>
    </div>
  );
}

export function CharacterSelect() {
  const { hero, setHero, back, started } = useGame();
  const d = HERO[hero];
  const kb = back === "paused";
  return (
    <div className="absolute inset-0" style={F}>
      <div className="absolute left-8 top-8"><Title sub="CHOOSE YOUR HERO — BOTH ARE AVAILABLE FROM THE START">CHARACTER SELECT</Title></div>
      <div className="absolute left-8 top-[150px] flex w-[250px] flex-col gap-4">
        {(["kairo", "ryujin"] as HeroId[]).map((h) => (
          <button key={h} onClick={() => { sfx("ui"); setHero(h); }} className="relative flex items-center gap-3 p-2 text-left transition-transform hover:translate-x-1"
            style={{ background: hero === h ? `linear-gradient(90deg,${HERO[h].color}55,rgba(8,10,22,.85))` : "rgba(8,10,22,.8)", border: `2px solid ${hero === h ? HERO[h].color2 : "#445"}`, boxShadow: hero === h ? `0 0 22px ${HERO[h].color}` : "none", clipPath: "polygon(0 0,100% 0,94% 100%,0 100%)" }}>
            <div style={{ width: 72, height: 72, overflow: "hidden", border: `2px solid ${HERO[h].color}` }}><Portrait hero={h} size={72} /></div>
            <div>
              <div className="text-2xl font-black italic tracking-wider" style={{ ...O, color: HERO[h].color2 }}>{HERO[h].name}</div>
              <div className="text-xs tracking-widest text-white/60">{HERO[h].title.toUpperCase()}</div>
            </div>
          </button>
        ))}
        <div className="mt-2 text-xs leading-relaxed tracking-wide text-white/50">Press <b>TAB</b> in-game to swap heroes instantly. Each hero keeps their own health, energy and cooldowns.</div>
      </div>
      <div className="absolute bottom-8 right-8 top-8 flex w-[470px] flex-col overflow-hidden p-5" style={{ background: "linear-gradient(160deg,rgba(8,10,24,.9),rgba(20,12,40,.82))", borderRight: `5px solid ${d.color}`, clipPath: "polygon(5% 0,100% 0,100% 100%,0 100%)" }}>
        <div className="pl-4">
          <div className="text-4xl font-black italic tracking-widest" style={{ ...O, color: d.color2, textShadow: `0 0 18px ${d.color}` }}>{d.name}</div>
          <div className="mb-2 text-sm font-bold tracking-[.3em]" style={{ color: d.color }}>{d.title.toUpperCase()}</div>
          <p className="text-[15px] leading-snug text-white/85">{d.desc}</p>
          <div className="mb-2 mt-2 text-xs font-bold tracking-widest text-white/60">STYLE · {d.style}</div>
        </div>
        <div className="mt-1 flex-1 space-y-1.5 overflow-y-auto pl-4 pr-1">
          {d.abilities.map((a) => (
            <div key={a.key} className="flex gap-3 p-1.5" style={{ background: "rgba(255,255,255,.05)", borderLeft: `3px solid ${a.key === "X" ? "#fff" : d.color}` }}>
              <div className="relative flex shrink-0 items-center justify-center" style={{ width: 48, height: 48, background: "rgba(0,0,0,.5)" }}>
                <AbilityIcon id={a.icon} color={d.color2} size={38} />
                <span className="absolute -left-1 -top-1 px-1 text-[11px] font-black" style={{ background: d.color, color: "#111" }}>{a.key}</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2"><span className="text-[17px] font-black italic tracking-wide">{a.name.toUpperCase()}</span>{a.key !== "X" && <span className="text-[11px] text-sky-300">⚡{a.cost} · {a.cd}s</span>}</div>
                <div className="text-[13px] leading-tight text-white/70">{a.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-3 pl-4">
          <Btn small onClick={() => go(back)}>◀ BACK</Btn>
          <Btn small primary onClick={() => go("playing")}>{kb || started ? `RESUME AS ${d.name}` : `PLAY AS ${d.name}`}</Btn>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, v, min, max, step, onChange, fmt }: { label: string; v: number; min: number; max: number; step: number; onChange: (n: number) => void; fmt?: (n: number) => string }) {
  return (
    <label className="flex items-center gap-4 py-1.5 text-lg">
      <span className="w-48 tracking-widest text-white/80">{label}</span>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => onChange(parseFloat(e.target.value))} className="flex-1 accent-orange-400" />
      <span className="w-14 text-right font-bold text-yellow-200">{fmt ? fmt(v) : v.toFixed(2)}</span>
    </label>
  );
}
const Toggle = ({ label, v, onChange }: { label: string; v: boolean; onChange: (b: boolean) => void }) => (
  <div className="flex items-center gap-4 py-1.5 text-lg"><span className="w-48 tracking-widest text-white/80">{label}</span>
    <button onClick={() => { sfx("ui"); onChange(!v); }} className="px-4 py-0.5 font-bold" style={{ background: v ? "#ffd23f" : "#333", color: v ? "#111" : "#aaa", transform: "skewX(-12deg)" }}>{v ? "ON" : "OFF"}</button></div>
);
function Shell({ title, sub, children, onBack, wide }: { title: string; sub?: string; children: ReactNode; onBack: () => void; wide?: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ ...F, background: "radial-gradient(circle at 50% 40%,rgba(14,10,36,.9),rgba(3,3,10,.96))" }}>
      <div className={`relative max-h-[90vh] overflow-y-auto p-8 ${wide ? "w-[1000px]" : "w-[660px]"} max-w-[96vw]`} style={{ background: "linear-gradient(160deg,rgba(14,18,40,.95),rgba(24,12,44,.9))", border: "2px solid #ffffff33", borderTop: "4px solid #ffd23f", boxShadow: "0 0 50px #8a5cff44" }}>
        <Title sub={sub}>{title}</Title>
        {children}
        <div className="mt-6"><Btn small onClick={onBack}>◀ BACK</Btn></div>
      </div>
    </div>
  );
}

export function Settings() {
  const { settings: s, setSettings, back } = useGame();
  return (
    <Shell title="SETTINGS" sub="GRAPHICS · AUDIO · CONTROLS" onBack={() => go(back)}>
      <div className="mb-2 flex items-center gap-4 text-lg"><span className="w-48 tracking-widest text-white/80">GRAPHICS QUALITY</span>
        {(["low", "medium", "high"] as const).map((q) => (
          <button key={q} onClick={() => { sfx("ui"); setSettings({ quality: q }); }} className="px-5 py-1 font-bold uppercase" style={{ background: s.quality === q ? "linear-gradient(90deg,#ff7a1a,#ffd23f)" : "#222a", color: s.quality === q ? "#111" : "#bbb", transform: "skewX(-12deg)" }}>{q}</button>
        ))}
      </div>
      <div className="mb-3 text-xs tracking-wide text-white/50">Low: no bloom, fewer particles · Medium: bloom + effects · High: real-time shadows, full particles, sharper resolution.</div>
      <Slider label="MASTER VOLUME" v={s.master} min={0} max={1} step={0.05} onChange={(n) => setSettings({ master: n })} fmt={(n) => Math.round(n * 100) + "%"} />
      <Slider label="MUSIC" v={s.music} min={0} max={1} step={0.05} onChange={(n) => setSettings({ music: n })} fmt={(n) => Math.round(n * 100) + "%"} />
      <Slider label="SOUND EFFECTS" v={s.sfx} min={0} max={1} step={0.05} onChange={(n) => setSettings({ sfx: n })} fmt={(n) => Math.round(n * 100) + "%"} />
      <Slider label="MOUSE SENSITIVITY" v={s.sens} min={0.3} max={2.5} step={0.05} onChange={(n) => setSettings({ sens: n })} fmt={(n) => n.toFixed(2)} />
      <Slider label="FIELD OF VIEW" v={s.fov} min={55} max={95} step={1} onChange={(n) => setSettings({ fov: n })} fmt={(n) => Math.round(n) + "°"} />
      <Toggle label="SCREEN SHAKE" v={s.shake} onChange={(b) => setSettings({ shake: b })} />
      <Toggle label="VOICE SHOUTS" v={s.voice} onChange={(b) => setSettings({ voice: b })} />
    </Shell>
  );
}

const CONTROLS: [string, string][] = [
  ["W A S D", "Move"], ["Mouse", "Camera"], ["Space", "Jump (again in air = double jump)"], ["Space ×2 (quick)", "Activate flight (C descend, Shift boost)"], ["Shift + Space", "Super jump"],
  ["Shift", "Sprint"], ["LMB", "Light combo (4 hits) / aerial attack"], ["RMB (hold)", "Charged heavy attack"], ["C", "Dodge roll (i-frames) / descend in flight"], ["T / Wheel / Z", "Lock-on / switch target"],
  ["Q", "Movement ability (Flame Dash / Shadow Step)"], ["E  R  F", "Hero abilities"], ["V", "Shadow Extraction (Ryujin) · B dismiss"], ["X", "ULTIMATE (when meter is full)"], ["Tab", "Switch hero"], ["Esc", "Pause"],
];
export function Info() {
  const { back } = useGame();
  return (
    <Shell wide title="GAME INFO" sub="CONTROLS · ENEMIES · TIPS" onBack={() => go(back)}>
      <div className="grid grid-cols-2 gap-8">
        <div>
          <div className="mb-2 text-sm font-bold tracking-[.3em] text-yellow-300">CONTROLS</div>
          {CONTROLS.map(([k, v]) => (<div key={k} className="flex gap-3 border-b border-white/10 py-1 text-[15px]"><span className="w-40 shrink-0 font-bold text-orange-300">{k}</span><span className="text-white/80">{v}</span></div>))}
        </div>
        <div>
          <div className="mb-2 text-sm font-bold tracking-[.3em] text-yellow-300">ENEMY UNIVERSE</div>
          {Object.entries(ENEMY_INFO).map(([k, v]) => (<div key={k} className="border-b border-white/10 py-1 text-[15px]"><b className="text-rose-300">{v.name}</b> — <span className="text-white/75">{v.desc}</span></div>))}
          <div className="mt-2 text-[15px] text-white/75"><b className="text-red-300">BOSSES</b> — Titan the Destroyer · Void Reaper · Emperor Zero</div>
          <div className="mb-2 mt-5 text-sm font-bold tracking-[.3em] text-yellow-300">TIPS</div>
          <ul className="list-disc space-y-1 pl-5 text-[14px] text-white/75">
            <li>Gold beams are missions. Red beams are boss fights. Grey = locked.</li>
            <li>Golden orbs on rooftops grant XP and energy — fly up and grab them.</li>
            <li>Dodge right before a hit lands for a PERFECT DODGE (slow-mo + ultimate charge).</li>
            <li>Ryujin: defeated enemies leave a shadow — press V near it to bind a permanent companion.</li>
            <li>Explosive barrels and cars react to your attacks. Civilians flee from danger.</li>
            <li>Level-ups give upgrade points — spend them in the pause menu.</li>
          </ul>
        </div>
      </div>
    </Shell>
  );
}

export function Pause() {
  const m = useHud((s) => s.mission);
  const st = useGame();
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ ...F, background: "radial-gradient(circle,rgba(8,8,24,.6),rgba(3,3,10,.9))" }}>
      <div className="w-[420px] p-8" style={{ background: "linear-gradient(160deg,rgba(14,18,40,.95),rgba(24,12,44,.92))", border: "2px solid #ffffff33", borderTop: "4px solid #ffd23f" }}>
        <Title sub={`LEVEL ${st.level} · ${HERO[st.hero].name}`}>PAUSED</Title>
        <div className="flex flex-col gap-2.5">
          <Btn primary onClick={() => go("playing")}>▶ RESUME</Btn>
          <Btn onClick={() => go("select", "paused")}>CHARACTER SELECTION</Btn>
          <Btn onClick={() => go("upgrades", "paused")}>UPGRADES {st.points > 0 && <b className="text-yellow-300">★{st.points}</b>}</Btn>
          <Btn onClick={() => go("missions", "paused")}>MISSION LOG</Btn>
          <Btn onClick={() => go("settings", "paused")}>SETTINGS</Btn>
          <Btn onClick={() => go("info", "paused")}>CONTROLS & INFO</Btn>
          {m && <Btn small color="#ff6a6a" onClick={() => { engine.abandonMission(); go("playing"); }}>ABANDON MISSION</Btn>}
          <Btn onClick={() => { useGame.setState({ started: false }); go("menu"); }}>RETURN TO MAIN MENU</Btn>
        </div>
      </div>
    </div>
  );
}

export function Upgrades() {
  const { points, upgrades, buyUpgrade, level, xp, back } = useGame();
  const need = xpNeeded(level);
  return (
    <Shell wide title="UPGRADES" sub={`LEVEL ${level}${level >= MAX_LEVEL ? " (MAX)" : ` · XP ${xp}/${need}`} · ★ ${points} POINTS AVAILABLE`} onBack={() => go(back)}>
      <div className="mb-3 text-sm text-white/60">Upgrades are shared by both heroes. Earn points by levelling up (kill enemies, collect orbs) and completing missions.</div>
      <div className="grid grid-cols-2 gap-3">
        {UPGRADES.map((u) => {
          const r = upgrades[u.id] || 0;
          return (
            <div key={u.id} className="flex items-center gap-4 p-3" style={{ background: "rgba(255,255,255,.05)", borderLeft: "4px solid #ffd23f" }}>
              <div className="flex-1">
                <div className="text-xl font-black italic tracking-wide">{u.name.toUpperCase()}</div>
                <div className="text-sm text-white/65">{u.desc}</div>
                <div className="mt-1 flex gap-1">{Array.from({ length: u.max }).map((_, i) => <div key={i} className="h-2 w-8" style={{ background: i < r ? "linear-gradient(90deg,#ff7a1a,#ffd23f)" : "#333", transform: "skewX(-20deg)" }} />)}</div>
              </div>
              <Btn small disabled={points < 1 || r >= u.max} onClick={() => buyUpgrade(u.id)}>{r >= u.max ? "MAX" : "+1 ★"}</Btn>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

export function MissionLog() {
  const { back, missionsDone } = useGame();
  useEffect(() => {}, []);
  return (
    <Shell wide title="MISSION LOG" sub={`${missionsDone.length}/${MISSIONS.length} COMPLETED`} onBack={() => go(back)}>
      <div className="space-y-2">
        {MISSIONS.map((m) => {
          const s = missionState(m);
          const col = s === "done" ? "#6dff9a" : s === "locked" ? "#778" : s === "active" ? "#5ad0ff" : m.boss ? "#ff6a6a" : "#ffd23f";
          return (
            <div key={m.id} className="flex items-center gap-4 p-3" style={{ background: "rgba(255,255,255,.05)", borderLeft: `5px solid ${col}`, opacity: s === "locked" ? 0.6 : 1 }}>
              <div className="flex-1">
                <div className="flex items-baseline gap-3"><span className="text-xl font-black italic tracking-wide">{m.name.toUpperCase()}</span><span className="text-xs tracking-widest text-white/50">{m.district.toUpperCase()}</span>{m.boss && <span className="px-1.5 text-[10px] font-black" style={{ background: "#ff4a4a", color: "#111" }}>BOSS</span>}</div>
                <div className="text-sm text-white/70">{m.brief}</div>
              </div>
              <div className="text-right text-sm"><div className="font-bold" style={{ color: col }}>{s === "locked" ? `🔒 ${m.gate?.()}` : s.toUpperCase()}</div><div className="text-white/50">+{m.xp} XP</div></div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

export function Dead() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ ...F, background: "radial-gradient(circle,rgba(60,0,10,.55),rgba(0,0,0,.92))" }}>
      <div className="text-7xl font-black italic tracking-[.15em] text-red-500" style={{ ...O, textShadow: "0 0 40px #f00" }}>DEFEATED</div>
      <div className="mb-8 mt-2 text-lg tracking-[.3em] text-white/70">THE CITY STILL NEEDS ITS HEROES</div>
      <div className="w-[320px]"><Btn primary onClick={() => engine.respawn()}>↻ RESPAWN AT HERO TOWER</Btn></div>
    </div>
  );
}
export const _g = G;
