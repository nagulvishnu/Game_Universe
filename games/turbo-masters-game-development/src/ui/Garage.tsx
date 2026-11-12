import { useEffect, useRef, useState } from "react";
import { CARS, DECALS, EXHAUSTS, MAX_UPGRADE, NEONS, PAINTS, SPOILERS, TINTS, UPGRADES, WHEELS, Custom, carById, upgradeCost, derive } from "../game/data";
import { host } from "../game/host";
import { audio } from "../game/audio";
import { buyCar, buyUpgrade, store, useSave } from "../game/store";
import { Bar, Btn, Chip, Panel } from "./kit";
import { boosted, getShowroom, money } from "./shared";

const TABS = ["Paint", "Wheels", "Body", "Neon", "Upgrades"] as const;

function Swatches({ value, onPick, colors }: { value: string; onPick: (c: string) => void; colors: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {colors.map((c) => (
        <button key={c} onClick={() => { audio.ui("move"); onPick(c); }} className="w-7 h-7 border-2 transition-transform hover:scale-110" style={{ background: c === "off" ? "repeating-linear-gradient(45deg,#222,#222 4px,#444 4px,#444 8px)" : c, borderColor: value.toLowerCase() === c.toLowerCase() ? "#fff" : "rgba(255,255,255,0.15)", boxShadow: value.toLowerCase() === c.toLowerCase() ? `0 0 12px ${c === "off" ? "#fff" : c}` : "none" }} title={c} />
      ))}
    </div>
  );
}
function Cycler({ label, value, options, onChange }: { label: string; value: number; options: string[]; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 text-[11px] uppercase tracking-widest text-slate-400">{label}</div>
      <button className="w-7 h-8 bg-white/10 hover:bg-white/25" onClick={() => { audio.ui("move"); onChange((value + options.length - 1) % options.length); }}>‹</button>
      <div className="flex-1 min-w-[120px] text-center font-display text-xs uppercase py-2 bg-black/30 text-cyan-100">{options[value]}</div>
      <button className="w-7 h-8 bg-white/10 hover:bg-white/25" onClick={() => { audio.ui("move"); onChange((value + 1) % options.length); }}>›</button>
    </div>
  );
}

export default function Garage({ player, onBack, setPlayer }: { player: number; onBack: () => void; setPlayer: (p: number) => void }) {
  const save = useSave();
  const pr = save.profiles[player];
  const [view, setView] = useState(pr.selected);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Paint");
  const col = player ? "#ff2fd0" : "#17e0ff";
  const def = carById(view);
  const cfg = pr.custom[view];
  const up = pr.upgrades[view];
  const owned = pr.unlocked.includes(view);
  const drag = useRef<{ x: number; yaw: number } | null>(null);

  useEffect(() => { setView(store.get().profiles[player].selected); }, [player]);
  useEffect(() => {
    const sr = getShowroom();
    sr.setLayout("single");
    sr.auto = true;
    sr.shift = 0.12;
    sr.celebrate = false;
    sr.zoom = 1;
    sr.setAccents(player ? "#ff2fd0" : "#17e0ff", "#7a2bff");
    host.setScene(sr);
    return () => { sr.shift = 0; sr.auto = true; };
  }, [player]);
  useEffect(() => {
    const sr = getShowroom();
    sr.setCar(0, def, cfg);
  }, [def, cfg]);

  const patch = (p: Partial<Custom>) => store.update((d) => { Object.assign(d.profiles[player].custom[view], p); });
  const b = boosted(def, up);
  const d0 = derive(def, up);

  const pickCar = (id: string) => {
    audio.ui("move");
    setView(id);
    if (pr.unlocked.includes(id)) store.update((d) => { d.profiles[player].selected = id; });
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col">
      <div className="pointer-events-auto flex items-center gap-3 px-5 pt-4">
        <Btn variant="ghost" small onClick={onBack}>‹ Back</Btn>
        <div className="font-display font-black italic text-3xl uppercase" style={{ color: col, textShadow: `0 0 22px ${col}` }}>Garage</div>
        <div className="flex ml-4 gap-1">
          {[0, 1].map((p) => (
            <button key={p} onClick={() => { audio.ui("select"); setPlayer(p); }} className="chamfer-sm px-4 py-1.5 font-display text-xs uppercase tracking-widest" style={{ background: p === player ? (p ? "#ff2fd0" : "#17e0ff") : "rgba(255,255,255,0.06)", color: p === player ? "#04050c" : "#9fb4d8" }}>
              Player {p + 1}
            </button>
          ))}
        </div>
        <div className="ml-auto glass chamfer-sm px-4 py-1.5 font-display font-bold text-yellow-300 text-lg">{money(pr.money)}</div>
      </div>

      <div className="flex-1 flex min-h-0 gap-3 px-5 py-3">
        {/* car list */}
        <Panel className="pointer-events-auto w-[270px] p-2 overflow-y-auto scroll-thin anim-left" color={col}>
          {CARS.map((c) => {
            const has = pr.unlocked.includes(c.id);
            const on = c.id === view;
            return (
              <button key={c.id} onClick={() => pickCar(c.id)} className="w-full text-left px-3 py-2 mb-1 flex items-center gap-2 transition-all" style={{ background: on ? `linear-gradient(90deg, ${col}33, transparent)` : "rgba(255,255,255,0.03)", borderLeft: `3px solid ${on ? col : "transparent"}` }}>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-[13px] uppercase italic truncate" style={{ color: on ? "#fff" : "#b9c6e4" }}>{c.name}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">{c.cat}</div>
                </div>
                {has ? (pr.selected === c.id ? <Chip color="#7affc0">Equipped</Chip> : <Chip color="#6f82a8">Owned</Chip>) : <span className="text-[11px] text-yellow-300 font-display">🔒 {money(c.price)}</span>}
              </button>
            );
          })}
        </Panel>

        {/* drag area */}
        <div
          className="flex-1 pointer-events-auto cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); const sr = getShowroom(); drag.current = { x: e.clientX, yaw: sr.slots[0].pivot.rotation.y }; sr.auto = false; sr.userYaw[0] = drag.current.yaw; }}
          onPointerMove={(e) => { if (drag.current) getShowroom().userYaw[0] = drag.current.yaw + (e.clientX - drag.current.x) * 0.012; }}
          onPointerUp={() => { drag.current = null; setTimeout(() => { if (!drag.current) getShowroom().auto = true; }, 2500); }}
          onWheel={(e) => { const sr = getShowroom(); sr.zoom = Math.max(0.7, Math.min(1.8, sr.zoom - e.deltaY * 0.001)); }}
        >
          <div className="h-full flex flex-col justify-between items-center py-2">
            <div className="text-center anim-up">
              <Chip color={col}>{def.cat}</Chip>
              <div className="font-display font-black italic text-4xl uppercase text-white mt-1" style={{ textShadow: `0 0 28px ${col}` }}>{def.name}</div>
              <div className="text-slate-300/70 text-sm uppercase tracking-wider">{def.blurb}</div>
            </div>
            <div className="text-[11px] uppercase tracking-widest text-slate-400/70">Drag to rotate · scroll to zoom</div>
          </div>
        </div>

        {/* customize panel */}
        <Panel className="pointer-events-auto w-[360px] flex flex-col anim-right" color={col}>
          <div className="flex border-b border-white/10">
            {TABS.map((t) => (
              <button key={t} onClick={() => { audio.ui("move"); setTab(t); }} className="flex-1 py-2.5 font-display text-[10px] uppercase tracking-widest transition-colors" style={{ color: tab === t ? "#04050c" : "#9fb4d8", background: tab === t ? col : "transparent" }}>
                {t}
              </button>
            ))}
          </div>
          <div className="p-3 overflow-y-auto scroll-thin flex-1 grid gap-3 content-start">
            {!owned && (
              <div className="bg-yellow-400/10 border border-yellow-300/40 p-2 text-sm text-yellow-200 flex items-center gap-2">
                🔒 Locked — unlock to equip and upgrade.
                <div className="flex-1" />
                <Btn small variant="solid" color="#ffd21f" disabled={pr.money < def.price} onClick={() => { if (buyCar(player, def.id)) { audio.ui("buy"); store.update((d) => { d.profiles[player].selected = def.id; }); } }}>Buy {money(def.price)}</Btn>
              </div>
            )}
            {tab === "Paint" && (
              <>
                <div><div className="text-[11px] uppercase tracking-widest text-slate-400 mb-1.5">Primary paint</div><Swatches value={cfg.primary} onPick={(c) => patch({ primary: c })} colors={PAINTS} />
                  <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">Custom <input type="color" value={cfg.primary} onChange={(e) => patch({ primary: e.target.value })} className="w-10 h-6 bg-transparent" /></label></div>
                <div><div className="text-[11px] uppercase tracking-widest text-slate-400 mb-1.5">Secondary paint</div><Swatches value={cfg.secondary} onPick={(c) => patch({ secondary: c })} colors={PAINTS} />
                  <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">Custom <input type="color" value={cfg.secondary} onChange={(e) => patch({ secondary: e.target.value })} className="w-10 h-6 bg-transparent" /></label></div>
                <Cycler label="Decal" value={cfg.decal} options={DECALS} onChange={(v) => patch({ decal: v })} />
                <Btn small variant="ghost" onClick={() => patch({ primary: def.paint[0], secondary: def.paint[1], decal: 0 })}>Reset to factory</Btn>
              </>
            )}
            {tab === "Wheels" && (
              <>
                <Cycler label="Design" value={cfg.wheel} options={WHEELS} onChange={(v) => patch({ wheel: v })} />
                <div><div className="text-[11px] uppercase tracking-widest text-slate-400 mb-1.5">Rim color</div>
                  <Swatches value={cfg.rim} onPick={(c) => patch({ rim: c })} colors={["#d8dde4", "#ffd21f", "#17e0ff", "#ff2fd0", "#2a2e36", "#ff5a1f", "#c8102e", "#19c37d", "#ffffff", "#b87333"]} /></div>
              </>
            )}
            {tab === "Body" && (
              <>
                <Cycler label="Spoiler" value={cfg.spoiler} options={SPOILERS} onChange={(v) => patch({ spoiler: v })} />
                <Cycler label="Exhaust" value={cfg.exhaust} options={EXHAUSTS} onChange={(v) => patch({ exhaust: v })} />
                <Cycler label="Window tint" value={cfg.tint} options={TINTS} onChange={(v) => patch({ tint: v })} />
                <div className="flex items-center gap-2">
                  <div className="w-24 text-[11px] uppercase tracking-widest text-slate-400">Plate</div>
                  <input value={cfg.plate} maxLength={8} onChange={(e) => patch({ plate: e.target.value.toUpperCase() })} onKeyDown={(e) => e.stopPropagation()} className="flex-1 bg-black/40 border border-white/20 px-3 py-2 font-display text-sm tracking-[0.3em] text-yellow-200 outline-none focus:border-cyan-300" />
                </div>
              </>
            )}
            {tab === "Neon" && (
              <div><div className="text-[11px] uppercase tracking-widest text-slate-400 mb-1.5">Underglow</div><Swatches value={cfg.neon} onPick={(c) => patch({ neon: c })} colors={NEONS} />
                <div className="text-xs text-slate-400 mt-3">Neon underglow lights the road beneath your car during races.</div></div>
            )}
            {tab === "Upgrades" && (
              <div className="grid gap-2">
                {UPGRADES.map((u, i) => {
                  const lvl = up[i];
                  const cost = upgradeCost(lvl);
                  return (
                    <div key={u.id} className="bg-white/5 p-2 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-display text-[12px] uppercase tracking-wider text-white">{u.name}</div>
                        <div className="text-[11px] text-slate-400">{u.desc}</div>
                        <div className="flex gap-1 mt-1">{Array.from({ length: MAX_UPGRADE }).map((_, k) => <div key={k} className="h-1.5 w-6 skew-x" style={{ background: k < lvl ? "#ffd21f" : "rgba(255,255,255,0.15)", boxShadow: k < lvl ? "0 0 8px #ffd21f" : "none" }} />)}</div>
                      </div>
                      {lvl >= MAX_UPGRADE ? <Chip color="#7affc0">MAX</Chip> : <Btn small variant="primary" color="#ffd21f" disabled={!owned || pr.money < cost} onClick={() => buyUpgrade(player, view, i) && audio.ui("buy")}>{money(cost)}</Btn>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="p-3 border-t border-white/10 grid gap-1.5">
            <Bar label="Top speed" value={b.base.speed} bonus={b.bonus.speed} color={col} />
            <Bar label="Accel" value={b.base.accel} bonus={b.bonus.accel} color={col} />
            <Bar label="Handling" value={b.base.handling} bonus={b.bonus.handling} color={col} />
            <Bar label="Drift" value={b.base.drift} color={col} />
            <Bar label="Nitro" value={b.base.nitro} bonus={b.bonus.nitro} color={col} />
            <Bar label="Braking" value={b.base.braking} bonus={b.bonus.braking} color={col} />
            <div className="text-[11px] text-slate-400 uppercase tracking-wider mt-1">{Math.round(d0.topSpeed * 3.6)} km/h · {def.mass.toFixed(2)} t · gold = upgrade bonus</div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
