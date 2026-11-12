import { useEffect, useMemo, useRef, useState } from "react";
import { CARS, MODES, Mode, RaceSettings, TRACKS, TrackDef, carById, Tod, Weather } from "../game/data";
import { host } from "../game/host";
import { audio } from "../game/audio";
import { input } from "../game/input";
import { buyCar, store, useSave } from "../game/store";
import { Bar, Btn, Chip, Kbd } from "./kit";
import { boosted, getShowroom, money } from "./shared";

export function TrackMini({ t, color }: { t: TrackDef; color: string }) {
  const pts = t.pts;
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[2]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const sc = Math.max(maxX - minX, maxZ - minZ);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${(10 + ((p[0] - minX) / sc) * 80).toFixed(1)},${(10 + ((p[2] - minZ) / sc) * 80).toFixed(1)}`).join(" ") + "Z";
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <path d={d} fill="none" stroke={color} strokeWidth="5" strokeLinejoin="round" opacity="0.25" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
    </svg>
  );
}

const TODS: (Tod | "auto")[] = ["auto", "sunny", "sunset", "night"];
const WEATHERS: (Weather | "auto")[] = ["auto", "clear", "rain", "heavy", "fog", "storm"];

function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] tracking-[0.25em] uppercase text-slate-400">{label}</div>
      <div className="flex items-center gap-1">
        <button className="w-6 h-7 bg-white/10 hover:bg-white/25 text-white" onClick={() => { audio.ui("move"); onChange(options[(options.indexOf(value) + options.length - 1) % options.length]); }}>‹</button>
        <div className="min-w-[78px] text-center font-display text-xs uppercase tracking-wider text-cyan-200 py-1.5 bg-black/30">{value}</div>
        <button className="w-6 h-7 bg-white/10 hover:bg-white/25 text-white" onClick={() => { audio.ui("move"); onChange(options[(options.indexOf(value) + 1) % options.length]); }}>›</button>
      </div>
    </div>
  );
}

export default function Setup({ mode, settings, setSettings, onBack, onStart, onGarage }: {
  mode: Mode; settings: RaceSettings; setSettings: (s: RaceSettings) => void; onBack: () => void; onStart: () => void; onGarage: (p: number) => void;
}) {
  const save = useSave();
  const [ready, setReady] = useState<[boolean, boolean]>([false, false]);
  const [pads, setPads] = useState(input.pads());
  const m = MODES.find((x) => x.id === mode)!;
  const colors = ["#17e0ff", "#ff2fd0"];

  useEffect(() => {
    const sr = getShowroom();
    sr.setLayout("dual");
    sr.auto = true;
    sr.shift = 0;
    sr.celebrate = false;
    sr.zoom = 1;
    sr.setAccents(colors[0], colors[1]);
    host.setScene(sr);
    audio.startMusic({ bpm: 100, root: 57, scale: "pent", wave: "triangle" }, "menu");
    const iv = setInterval(() => setPads(input.pads()), 600);
    return () => { clearInterval(iv); audio.stopMusic(); };
    // eslint-disable-next-line
  }, []);

  const sel = [save.profiles[0].selected, save.profiles[1].selected];
  useEffect(() => {
    const sr = getShowroom();
    [0, 1].forEach((p) => {
      const def = carById(sel[p]);
      sr.setCar(p, def, save.profiles[p].custom[def.id]);
    });
  });

  const owned = (p: number) => save.profiles[p].unlocked.includes(sel[p]);
  const cycle = (p: number, dir: number) => {
    const i = CARS.findIndex((c) => c.id === sel[p]);
    const next = CARS[(i + dir + CARS.length) % CARS.length].id;
    audio.ui("move");
    store.update((d) => { d.profiles[p].selected = next; });
    setReady((r) => (p ? [r[0], false] : [false, r[1]]));
  };
  const toggleReady = (p: number) => {
    if (!owned(p)) { audio.ui("error"); return; }
    audio.ui("ready");
    setReady((r) => (p ? [r[0], !r[1]] : [!r[0], r[1]]));
  };
  const latest = useRef({ cycle, toggleReady, ready, onStart });
  latest.current = { cycle, toggleReady, ready, onStart };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const L = latest.current;
      if (e.code === "KeyA") L.cycle(0, -1);
      if (e.code === "KeyD") L.cycle(0, 1);
      if (e.code === "KeyF") L.toggleReady(0);
      if (e.code === "ArrowLeft") L.cycle(1, -1);
      if (e.code === "ArrowRight") L.cycle(1, 1);
      if (e.code === "KeyK") L.toggleReady(1);
      if (e.code === "Enter" && L.ready[0] && L.ready[1]) L.onStart();
      if (e.code === "Escape") onBack();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line
  }, []);

  const cyclePad = (p: number) => {
    const opts = [-1, ...pads.map((g) => g.index)];
    const cur = save.profiles[p].pad;
    const next = opts[(opts.indexOf(cur) + 1) % opts.length] ?? -1;
    audio.ui("move");
    store.update((d) => { d.profiles[p].pad = next; });
  };
  const padLabel = (p: number) => {
    const gi = input.padFor(p);
    const sel = save.profiles[p].pad;
    if (gi < 0) return sel >= 0 ? "PAD DISCONNECTED" : pads.length ? "PAD: AUTO (FREE)" : "NO GAMEPAD";
    const g = pads.find((x) => x.index === gi);
    return `PAD ${gi + 1}${g ? " · " + g.id.slice(0, 18) : ""}`;
  };

  const bothReady = ready[0] && ready[1];
  const champ = mode === "championship";
  const setTrack = (id: string) => { audio.ui("move"); setSettings({ ...settings, track: id, laps: TRACKS.find((t) => t.id === id)!.laps }); };
  const stats = useMemo(() => [0, 1].map((p) => { const d = carById(sel[p]); return { d, b: boosted(d, save.profiles[p].upgrades[d.id]) }; }), [sel[0], sel[1], save]);

  return (
    <div className="absolute inset-0 flex flex-col pointer-events-none">
      {/* header */}
      <div className="pointer-events-auto flex items-center gap-4 px-5 pt-4">
        <Btn variant="ghost" small onClick={onBack}>‹ Back</Btn>
        <div className="font-display font-black italic text-2xl md:text-3xl uppercase text-white" style={{ textShadow: "0 0 22px #17e0ff88" }}>{m.name}</div>
        <div className="hidden md:block text-slate-300/70 text-sm uppercase tracking-wider">{m.blurb}</div>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-xs uppercase tracking-widest text-slate-400 hidden lg:block">{bothReady ? "Both ready!" : "Press ready on both sides"}</div>
          <Btn variant="solid" color="#7affc0" disabled={!bothReady} onClick={onStart}>Start Race ▸</Btn>
        </div>
      </div>

      {/* race settings strip */}
      <div className="pointer-events-auto mx-5 mt-3 glass chamfer px-3 py-2 flex items-center gap-3 overflow-x-auto scroll-thin">
        {champ ? (
          <div className="flex items-center gap-2 flex-1 min-w-[520px]">
            <div className="font-display text-xs tracking-widest text-yellow-300 uppercase mr-2">6 rounds</div>
            {TRACKS.map((t, i) => (
              <div key={t.id} className="flex items-center gap-1 px-2 py-1 bg-white/5 text-xs uppercase tracking-wider">
                <span className="font-display text-yellow-300">{i + 1}</span> {t.name}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-2">
            {TRACKS.map((t) => {
              const on = settings.track === t.id;
              return (
                <button key={t.id} onClick={() => setTrack(t.id)} className="chamfer-sm relative w-[132px] h-[62px] text-left px-2 py-1 transition-all" style={{ background: `linear-gradient(135deg, ${t.accent}${on ? "55" : "1a"}, ${t.accent2}${on ? "33" : "0d"})`, border: `1px solid ${on ? t.accent : "rgba(120,150,220,0.2)"}`, boxShadow: on ? `0 0 18px ${t.accent}66` : "none", transform: on ? "translateY(-2px)" : "none" }}>
                  <div className="absolute right-1 top-1 w-9 h-9 opacity-90"><TrackMini t={t} color={t.accent} /></div>
                  <div className="font-display font-bold text-[11px] uppercase leading-tight pr-9" style={{ color: on ? "#fff" : "#b9c6e4" }}>{t.name}</div>
                  <div className="text-[10px] text-slate-300/70 uppercase mt-1 pr-8">{t.sub}</div>
                </button>
              );
            })}
          </div>
        )}
        <div className="flex gap-3 ml-auto items-end shrink-0">
          <div className="flex flex-col gap-1">
            <div className="text-[10px] tracking-[0.25em] uppercase text-slate-400">Laps</div>
            <div className="flex items-center gap-1">
              <button className="w-6 h-7 bg-white/10 hover:bg-white/25" onClick={() => { audio.ui("move"); setSettings({ ...settings, laps: Math.max(1, settings.laps - 1) }); }}>–</button>
              <div className="w-10 text-center font-display text-sm text-cyan-200 py-1 bg-black/30">{settings.laps}</div>
              <button className="w-6 h-7 bg-white/10 hover:bg-white/25" onClick={() => { audio.ui("move"); setSettings({ ...settings, laps: Math.min(10, settings.laps + 1) }); }}>+</button>
            </div>
          </div>
          <Select label="Time" value={settings.tod} options={TODS} onChange={(v) => setSettings({ ...settings, tod: v })} />
          <Select label="Weather" value={settings.weather} options={WEATHERS} onChange={(v) => setSettings({ ...settings, weather: v })} />
        </div>
      </div>
      {!champ && (
        <div className="px-6 mt-1 text-[12px] uppercase tracking-wider text-slate-300/70">
          {TRACKS.find((t) => t.id === settings.track)?.desc}
        </div>
      )}

      <div className="flex-1" />

      {/* player panels */}
      <div className="grid grid-cols-2 gap-3 px-5 pb-4">
        {[0, 1].map((p) => {
          const { d, b } = stats[p];
          const col = colors[p];
          const locked = !owned(p);
          return (
            <div key={p} className={`pointer-events-auto glass chamfer p-3 ${p ? "anim-right" : "anim-left"}`} style={{ borderColor: col + "66", boxShadow: ready[p] ? `0 0 30px ${col}66, inset 0 0 30px ${col}22` : undefined }}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-display font-black italic text-lg" style={{ color: col, textShadow: `0 0 14px ${col}` }}>PLAYER {p + 1}</div>
                    <Chip color={col}>{d.cat}</Chip>
                    {ready[p] && <Chip color="#7affc0">READY</Chip>}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <button className="w-8 h-9 bg-white/10 hover:bg-white/25 text-lg" onClick={() => cycle(p, -1)}>‹</button>
                    <div className="flex-1 min-w-0 text-center">
                      <div className="font-display font-bold italic uppercase text-xl truncate text-white">{d.name}</div>
                      <div className="text-[11px] uppercase tracking-wider text-slate-400 truncate">{d.blurb}</div>
                    </div>
                    <button className="w-8 h-9 bg-white/10 hover:bg-white/25 text-lg" onClick={() => cycle(p, 1)}>›</button>
                  </div>
                  <div className="mt-1.5 text-[11px] text-slate-400 uppercase flex gap-2 flex-wrap items-center">
                    {p === 0 ? <><Kbd>A</Kbd><Kbd>D</Kbd> car <Kbd>F</Kbd> ready</> : <><Kbd>←</Kbd><Kbd>→</Kbd> car <Kbd>K</Kbd> ready</>}
                    <button onClick={() => cyclePad(p)} className="ml-auto px-2 py-0.5 border border-white/20 text-[10px] hover:bg-white/10" style={{ color: input.padFor(p) >= 0 ? "#7affc0" : "#8896b8" }}>🎮 {padLabel(p)}</button>
                  </div>
                </div>
                <div className="w-[46%] grid gap-1.5 pt-1">
                  <Bar label="Top speed" value={b.base.speed} bonus={b.bonus.speed} color={col} />
                  <Bar label="Accel" value={b.base.accel} bonus={b.bonus.accel} color={col} />
                  <Bar label="Handling" value={b.base.handling} bonus={b.bonus.handling} color={col} />
                  <Bar label="Drift" value={b.base.drift} color={col} />
                  <Bar label="Nitro" value={b.base.nitro} bonus={b.bonus.nitro} color={col} />
                  <Bar label="Braking" value={b.base.braking} bonus={b.bonus.braking} color={col} />
                </div>
              </div>
              <div className="flex gap-2 mt-2 items-center">
                <Btn small variant="ghost" onClick={() => onGarage(p)}>Garage / Customize</Btn>
                <div className="text-xs text-yellow-300 font-display">{money(save.profiles[p].money)}</div>
                <div className="flex-1" />
                {locked ? (
                  <Btn small color="#ffd21f" variant="solid" disabled={save.profiles[p].money < d.price} onClick={() => buyCar(p, d.id) && audio.ui("buy")}>Unlock {money(d.price)}</Btn>
                ) : (
                  <Btn small color={col} variant={ready[p] ? "solid" : "primary"} onClick={() => toggleReady(p)}>{ready[p] ? "Ready ✓" : "Ready?"}</Btn>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
