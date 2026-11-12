import { useEffect, useState, useSyncExternalStore } from "react";
import { useApp, type Quality } from "../game/store";
import { audio } from "../game/audio";
import { input } from "../game/input";
import { generateArt, getArt } from "../game/showcase";
import { ACTIONS, ACTION_LABEL, FIGHTERS, PAD_BUTTON_NAMES, PLAYER_COLORS, keyLabel, type Action } from "../game/data";
import { Btn, ShowCanvas, StatBar, elIcon } from "./ui";

// ------------------------------------------------------------------ boot
export function Boot() {
  const go = useApp((s) => s.go);
  const [p, setP] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => { generateArt(setP).then(() => setReady(true)); }, []);
  const start = () => { if (!ready) return; audio.init(); audio.play("ready"); audio.music("menu"); go("menu"); };
  useEffect(() => {
    const k = () => start();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  return (
    <div className="absolute inset-0 bg-arena flex flex-col items-center justify-center cursor-pointer overflow-hidden" onClick={start}>
      <div className="speedlines" />
      <div className="logo text-[16vmin] relative z-10 text-center">ANIME<br />CLASH</div>
      <div className="relative z-10 mt-10 w-[34vw] max-w-[420px]">
        {!ready ? (
          <>
            <div className="h-2 bg-white/10 skew-x-[-20deg] overflow-hidden"><div className="h-full bg-gradient-to-r from-pink-500 to-cyan-300 transition-all" style={{ width: `${p * 100}%` }} /></div>
            <div className="text-center mt-3 tracking-[.5em] text-white/60 text-sm">FORGING FIGHTERS…</div>
          </>
        ) : (
          <div className="text-center text-2xl tracking-[.4em] font-bold pulse">CLICK OR PRESS ANY KEY</div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ main menu
export function MainMenu() {
  const { go, setMode } = useApp();
  return (
    <div className="absolute inset-0 bg-arena overflow-hidden">
      <div className="speedlines" />
      <div className="absolute top-0 bottom-0 right-0 left-[16%] opacity-95" style={{ maskImage: "linear-gradient(90deg, transparent, #000 18%)" }}><ShowCanvas chars={[0, 1, 2, 3]} spacing={1.8} camZ={8.4} camY={1.7} lookY={1.15} fov={30} pose="hero" orbit /></div>
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
      <div className="absolute left-[3vw] top-[3vh] z-10 slidel">
        <div className="logo text-[11vmin]">ANIME<br />CLASH</div>
        <div className="tracking-[.55em] text-pink-300 font-bold text-sm mt-3 pl-2">3D LOCAL MULTIPLAYER FIGHTER</div>
      </div>
      <div className="absolute left-[3vw] bottom-[5vh] w-[19rem] z-10 flex flex-col gap-1.5 menu-compact">
        {[
          ["PLAY", () => go("modes")],
          ["TRAINING", () => { setMode("practice"); go("select"); }],
          ["CHARACTER GALLERY", () => go("gallery")],
          ["SETTINGS", () => go("settings")],
          ["CREDITS", () => go("credits")],
        ].map(([t, f], i) => (
          <div key={t as string} className="fadein" style={{ animationDelay: `${0.15 * i + 0.3}s` }}><Btn onClick={f as () => void}>{t as string}</Btn></div>
        ))}
      </div>
      <div className="absolute right-6 bottom-4 text-xs tracking-widest text-white/40 z-10">P1: WASD + F G R T V C X B · P2: ARROWS + J K U I O L ⇧ ⌃ · GAMEPADS SUPPORTED</div>
    </div>
  );
}

// ------------------------------------------------------------------ mode select
export function ModeSelect() {
  const { go, setMode, resetTourney } = useApp();
  const modes = [
    { id: "versus", t: "VERSUS", d: "Best of three rounds. Pick your fighters and your arena. Two players, one keyboard.", c: "#ff4a5c", ic: "⚔️" },
    { id: "tournament", t: "TOURNAMENT", d: "First to two match wins takes the crown. Arenas rotate and you re-pick fighters between matches.", c: "#ffd23f", ic: "🏆" },
    { id: "practice", t: "TRAINING", d: "Infinite health, damage numbers, combo counters and cooldown readouts. Master parries and combos.", c: "#7fe6ff", ic: "🎯" },
  ] as const;
  return (
    <div className="absolute inset-0 bg-arena flex flex-col items-center justify-center overflow-hidden">
      <div className="speedlines" />
      <div className="font-display text-7xl mb-10 relative z-10 fadein">SELECT MODE</div>
      <div className="flex gap-6 relative z-10">
        {modes.map((m, i) => (
          <button key={m.id} className="card panel w-72 h-96 p-6 text-left flex flex-col justify-between slider" style={{ animationDelay: `${i * 0.1}s`, borderTop: `4px solid ${m.c}` }}
            onMouseEnter={() => audio.play("ui_move", 0.6)}
            onClick={() => { audio.play("ui_select"); setMode(m.id); if (m.id === "tournament") resetTourney(); go("select"); }}>
            <div className="text-7xl">{m.ic}</div>
            <div><div className="font-display text-5xl" style={{ color: m.c }}>{m.t}</div><div className="text-white/70 mt-2 leading-snug">{m.d}</div></div>
          </button>
        ))}
      </div>
      <div className="relative z-10 mt-10"><Btn small onClick={() => go("menu")} sound="ui_back">← BACK</Btn></div>
    </div>
  );
}

// ------------------------------------------------------------------ gallery
export function Gallery() {
  const go = useApp((s) => s.go);
  const [i, setI] = useState(0);
  const [pose, setPose] = useState<"idle" | "hero" | "charge" | "roar" | "victory">("hero");
  const [form, setForm] = useState(false);
  const f = FIGHTERS[i];
  return (
    <div className="absolute inset-0 bg-arena overflow-hidden">
      <div className="speedlines" />
      <div className="absolute top-0 bottom-0 left-0 right-[28rem]"><ShowCanvas chars={[i]} pose={pose} forms={form} camZ={6.2} camY={1.4} lookY={1.0} orbit={false} /></div>
      <div className="absolute left-8 top-6 z-10 flex gap-3">
        {FIGHTERS.map((x, k) => (
          <button key={x.id} onClick={() => { audio.play("ui_select"); setI(k); }} className={`card w-24 h-24 ${k === i ? "ring-4 ring-white scale-110" : "opacity-70"}`} style={{ borderBottom: `5px solid ${x.color}` }}>
            <img src={getArt(k, "face")} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
      <div className="absolute right-8 top-6 bottom-6 w-[27rem] panel p-6 z-10 overflow-auto fadein" key={i}>
        <div className="text-sm tracking-[.5em]" style={{ color: f.color }}>{elIcon[f.element]} {f.element.toUpperCase()}</div>
        <div className="font-display text-7xl leading-none">{f.name}</div>
        <div className="font-display text-2xl text-white/70 mb-3">{f.title}</div>
        <p className="text-white/70 mb-4">{f.desc}</p>
        <div className="space-y-1.5 mb-4">
          <StatBar label="Power" v={f.stats.power} color={f.color} /><StatBar label="Speed" v={f.stats.speed} color={f.color} />
          <StatBar label="Range" v={f.stats.range} color={f.color} /><StatBar label="Defense" v={f.stats.defense} color={f.color} /><StatBar label="Technique" v={f.stats.technique} color={f.color} />
        </div>
        {f.abilities.map((a) => (
          <div key={a.key} className="mb-2 border-l-4 pl-3" style={{ borderColor: f.color }}>
            <div className="font-bold tracking-wider"><span className="text-xs mr-2 px-1.5 py-0.5 bg-white/15">{a.key}</span>{a.name}</div>
            <div className="text-sm text-white/60">{a.desc}</div>
          </div>
        ))}
        <div className="mt-3 text-sm text-yellow-300/90">FORM: {f.formName} — ×1.3 damage, ×1.2 speed, enhanced specials, unique ultimate “{f.ult.exName}”.</div>
      </div>
      <div className="absolute left-8 bottom-6 z-10 flex gap-2 items-center flex-wrap max-w-[50vw]">
        {(["idle", "hero", "charge", "roar", "victory"] as const).map((p) => <Btn key={p} small on={pose === p} onClick={() => setPose(p)}>{p.toUpperCase()}</Btn>)}
        <Btn small on={form} onClick={() => setForm(!form)}>TRANSFORMED</Btn>
        <Btn small onClick={() => go("menu")} sound="ui_back">← BACK</Btn>
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 bottom-24 text-white/40 tracking-widest text-xs z-10">DRAG TO ROTATE</div>
    </div>
  );
}

// ------------------------------------------------------------------ controls panel (shared)
export function useInputVersion() { return useSyncExternalStore(input.subscribe, input.getVersion); }

export function ControlsPanel() {
  useInputVersion();
  const pads = input.connectedPads();
  const [listen, setListen] = useState<string>("");
  const done = () => setListen("");
  return (
    <div>
      <div className="grid grid-cols-2 gap-5">
        {([0, 1] as const).map((p) => (
          <div key={p} className="panel p-4" style={{ borderTop: `3px solid ${PLAYER_COLORS[p]}` }}>
            <div className="font-display text-3xl mb-1" style={{ color: PLAYER_COLORS[p] }}>PLAYER {p + 1}</div>
            <div className="flex items-center gap-2 mb-2 text-sm">
              <span className="text-white/60">CONTROLLER</span>
              <select className="bg-black/60 border border-white/30 px-2 py-1 flex-1" value={input.padAssign[p]} onChange={(e) => input.assignPad(p, Number(e.target.value))}>
                <option value={-1}>None (keyboard only)</option>
                {pads.map((g) => <option key={g.index} value={g.index}>{`Pad ${g.index + 1}: ${g.id.slice(0, 32)}`}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 gap-y-1 items-center text-sm">
              <div className="text-white/40 text-xs">ACTION</div><div className="text-white/40 text-xs">KEY</div><div className="text-white/40 text-xs">PAD</div>
              {ACTIONS.map((a: Action) => {
                const id = `${p}${a}`;
                const pb = input.padMap[p][a];
                return (
                  <div key={id} className="contents">
                    <div className="text-white/80">{ACTION_LABEL[a]}</div>
                    <button className={`min-w-[5.5rem] px-2 py-0.5 border ${listen === "k" + id ? "border-yellow-300 text-yellow-300 pulse" : "border-white/30 hover:border-white"} bg-black/50 font-bold`}
                      onClick={() => { setListen("k" + id); input.remapKey(p, a, done); }}>{listen === "k" + id ? "PRESS…" : keyLabel(input.bindings[p][a])}</button>
                    <button className={`min-w-[3.2rem] px-2 py-0.5 border ${listen === "p" + id ? "border-yellow-300 text-yellow-300 pulse" : "border-white/20 hover:border-white"} bg-black/50`}
                      onClick={() => { setListen("p" + id); input.remapPad(p, a, done); if (input.padAssign[p] < 0) setListen(""); }}>{listen === "p" + id ? "…" : pb !== undefined ? PAD_BUTTON_NAMES[pb] ?? pb : "—"}</button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3">
        <Btn small onClick={() => { input.resetBindings(); }}>RESET DEFAULTS</Btn>
        <div className="text-yellow-300 text-sm min-h-[1.2rem]">{input.message}</div>
      </div>
      <div className="text-xs text-white/40 mt-2">Tip: some keyboards cannot register many simultaneous keys (ghosting). Use gamepads for the most reliable two-player play. Conflicting keys are automatically swapped.</div>
    </div>
  );
}

// ------------------------------------------------------------------ settings
export function Settings() {
  const { settings, setSettings, go, prevScreen } = useApp();
  const [tab, setTab] = useState<"gfx" | "audio" | "controls">("gfx");
  const Q: Quality[] = ["low", "medium", "high", "ultra"];
  const Slider = ({ label, k }: { label: string; k: "master" | "music" | "sfx" | "shake" }) => (
    <div className="mb-4">
      <div className="flex justify-between tracking-widest text-sm"><span>{label}</span><span>{Math.round(settings[k] * 100)}%</span></div>
      <input type="range" min={0} max={1} step={0.01} value={settings[k]} onChange={(e) => { setSettings({ [k]: Number(e.target.value) }); if (k === "sfx") audio.play("punch"); }} />
    </div>
  );
  return (
    <div className="absolute inset-0 bg-arena overflow-auto">
      <div className="speedlines" />
      <div className="relative z-10 max-w-6xl mx-auto p-8">
        <div className="font-display text-6xl mb-4">SETTINGS</div>
        <div className="flex gap-2 mb-5">{(["gfx", "audio", "controls"] as const).map((t) => <Btn key={t} small on={tab === t} onClick={() => setTab(t)}>{t === "gfx" ? "GRAPHICS" : t.toUpperCase()}</Btn>)}</div>
        {tab === "gfx" && (
          <div className="panel p-6 max-w-2xl fadein">
            <div className="tracking-widest text-sm mb-2">GRAPHICS QUALITY</div>
            <div className="flex gap-2 mb-2">{Q.map((q) => <Btn key={q} small on={settings.quality === q} onClick={() => setSettings({ quality: q })}>{q.toUpperCase()}</Btn>)}</div>
            <div className="text-white/50 text-sm mb-5">Low: 0.8× resolution, small shadows, reduced particles · Medium: MSAA 2× · High: 2K shadows, MSAA 4×, full VFX · Ultra: 4K shadows, 2× resolution, dense VFX. Applies at the next match.</div>
            <Slider label="SCREEN SHAKE" k="shake" />
            <div className="flex gap-2"><Btn small on={settings.damageNumbers} onClick={() => setSettings({ damageNumbers: !settings.damageNumbers })}>DAMAGE NUMBERS: {settings.damageNumbers ? "ON" : "OFF"}</Btn>
              <Btn small on={settings.fpsCounter} onClick={() => setSettings({ fpsCounter: !settings.fpsCounter })}>FPS COUNTER: {settings.fpsCounter ? "ON" : "OFF"}</Btn></div>
          </div>
        )}
        {tab === "audio" && (
          <div className="panel p-6 max-w-2xl fadein">
            <Slider label="MASTER VOLUME" k="master" /><Slider label="MUSIC VOLUME" k="music" /><Slider label="SOUND EFFECTS VOLUME" k="sfx" />
          </div>
        )}
        {tab === "controls" && <div className="fadein"><ControlsPanel /></div>}
        <div className="mt-6"><Btn small onClick={() => go(prevScreen === "settings" ? "menu" : prevScreen === "game" ? "menu" : "menu")} sound="ui_back">← BACK</Btn></div>
      </div>
    </div>
  );
}

export function Credits() {
  const go = useApp((s) => s.go);
  return (
    <div className="absolute inset-0 bg-arena flex flex-col items-center justify-center text-center overflow-hidden">
      <div className="speedlines" />
      <div className="relative z-10 max-w-2xl fadein">
        <div className="logo text-8xl mb-6">ANIME CLASH</div>
        <p className="text-xl text-white/80 leading-relaxed">Every fighter, arena, effect, texture and sound in this game is generated procedurally in your browser — original work, no external assets.</p>
        <p className="mt-4 text-white/60">Built with Three.js, React, Zustand and the Web Audio API.<br />Models: procedural toon-shaded rigs · Audio: synthesized music &amp; SFX · VFX: pooled GPU particles.</p>
        <p className="mt-4 text-white/50 text-sm">Known limits: floor reflections use environment maps (no planar mirror); animation is pose-blended rather than motion-captured.</p>
        <div className="mt-8"><Btn small onClick={() => go("menu")} sound="ui_back">← BACK</Btn></div>
      </div>
    </div>
  );
}
