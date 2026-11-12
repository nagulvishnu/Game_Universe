import { useEffect, useRef } from "react";
import { useGame, useHud } from "../store";
import { HERO, xpNeeded } from "../data";
import { AbilityIcon, Portrait } from "./icons";
import { G } from "../game/core";

const Bar = ({ v, max, color, h = 14, label, slant = true }: { v: number; max: number; color: string; h?: number; label?: string; slant?: boolean }) => (
  <div className="relative overflow-hidden" style={{ height: h, background: "rgba(5,8,18,.78)", border: "1px solid rgba(255,255,255,.25)", transform: slant ? "skewX(-18deg)" : undefined }}>
    <div className="absolute inset-y-0 left-0" style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%`, background: color, transition: "width .12s linear", boxShadow: `0 0 10px ${color}` }} />
    {label && <div className="absolute inset-0 flex items-center px-2 text-[10px] font-bold tracking-widest text-white/90" style={{ transform: slant ? "skewX(18deg)" : undefined, textShadow: "0 1px 2px #000" }}>{label}</div>}
  </div>
);

const KEYS_ORDER = ["Q", "E", "R", "F", "V"];

export default function Hud() {
  const h = useHud();
  const { level, xp, points, hero: _h } = useGame();
  void _h;
  const def = HERO[h.hero];
  const other = h.hero === "kairo" ? "ryujin" : "kairo";
  const mmRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => { G.minimapCanvas = mmRef.current; return () => { G.minimapCanvas = null; }; }, []);
  const abilities = def.abilities.filter((a) => a.key !== "X");
  const ordered = KEYS_ORDER.map((k) => abilities.find((a) => a.key === k)).filter(Boolean) as typeof abilities;
  const ultReady = h.ult >= 100;
  const perfect = performance.now() - h.perfect < 900;
  return (
    <div className="pointer-events-none absolute inset-0 select-none" style={{ fontFamily: "Rajdhani, 'Segoe UI', sans-serif", color: "#fff" }}>
      {/* top-left hero panel */}
      <div className="hero-hud-player absolute left-5 top-5 flex gap-3">
        <div className="relative" style={{ width: 96, height: 96 }}>
          <div className="absolute inset-0 overflow-hidden" style={{ border: `3px solid ${def.color}`, boxShadow: `0 0 18px ${def.color}`, clipPath: "polygon(12% 0,100% 0,88% 100%,0 100%)" }}>
            <Portrait hero={h.hero} size={96} />
          </div>
          <div className="absolute -bottom-2 -left-1 px-2 text-[11px] font-black italic tracking-widest" style={{ background: def.color, color: "#111", transform: "skewX(-12deg)" }}>LV {level}</div>
        </div>
        <div className="w-[300px] pt-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black italic tracking-wider" style={{ color: def.color2, textShadow: `0 0 12px ${def.color}`, fontFamily: "Orbitron, Rajdhani, sans-serif" }}>{def.name}</span>
            <span className="text-xs tracking-widest text-white/60">{def.title.toUpperCase()}</span>
          </div>
          <div className="mt-1 space-y-1.5">
            <Bar v={h.hp} max={h.maxHp} color={h.hp / h.maxHp < 0.3 ? "linear-gradient(90deg,#ff2a4a,#ff6a7a)" : "linear-gradient(90deg,#3ddc6a,#b8ff6a)"} h={17} label={`HP ${Math.ceil(h.hp)} / ${Math.round(h.maxHp)}`} />
            <Bar v={h.en} max={h.maxEn} color={`linear-gradient(90deg,${def.color},${def.color2})`} h={11} label={`ENERGY`} />
            <div className="relative">
              <Bar v={h.ult} max={100} color={ultReady ? "linear-gradient(90deg,#fff,#ffd23f,#ff7a1a)" : "linear-gradient(90deg,#8a5cff,#3fd0ff)"} h={10} label={ultReady ? "ULTIMATE READY — PRESS [X]" : `ULTIMATE ${Math.floor(h.ult)}%`} />
              {ultReady && <div className="absolute inset-0 animate-pulse" style={{ boxShadow: `0 0 20px ${def.color2}`, transform: "skewX(-18deg)" }} />}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px] tracking-wider text-white/70">
            <span className="px-1.5 py-0.5" style={{ background: "rgba(0,0,0,.55)", border: "1px solid rgba(255,255,255,.2)" }}>[TAB] {HERO[other].name}</span>
            <div className="w-24"><Bar v={h.otherHp} max={h.otherMax} color={h.otherHp <= 0 ? "#555" : HERO[other].color} h={6} slant={false} /></div>
            {h.allies > 0 && <span className="text-violet-300">☠ {h.allies}</span>}
            {h.flying && <span className="text-sky-300">✈ FLIGHT</span>}
          </div>
          <div className="mt-1 h-1 w-56 bg-white/10"><div className="h-full" style={{ width: `${(xp / xpNeeded(level)) * 100}%`, background: "#ffd23f" }} /></div>
          {points > 0 && <div className="mt-1 text-[11px] font-bold tracking-widest text-yellow-300">★ {points} UPGRADE POINT{points > 1 ? "S" : ""} — OPEN PAUSE MENU</div>}
        </div>
      </div>

      {/* boss bar */}
      {h.bossName && (
        <div className="absolute left-1/2 top-4 w-[620px] max-w-[60vw] -translate-x-1/2">
          <div className="mb-1 flex items-end justify-between">
            <span className="text-2xl font-black italic tracking-widest" style={{ fontFamily: "Orbitron, sans-serif", textShadow: "0 0 14px #f33" }}>{h.bossName.toUpperCase()}</span>
            <span className="text-sm font-bold tracking-widest text-red-300">STAGE {["I", "II", "III"][Math.max(0, h.bossStage - 1)]}</span>
          </div>
          <div className="relative" style={{ height: 22, background: "rgba(0,0,0,.8)", border: "2px solid #fff", transform: "skewX(-14deg)" }}>
            <div className="absolute inset-y-0 left-0" style={{ width: `${(h.bossHp / h.bossMax) * 100}%`, background: "linear-gradient(90deg,#ff1a3a,#ff7a4a)", transition: "width .15s", boxShadow: "0 0 16px #f33" }} />
            {[0.33, 0.66].map((p) => <div key={p} className="absolute inset-y-0 w-[2px] bg-white/80" style={{ left: `${p * 100}%` }} />)}
          </div>
        </div>
      )}

      {/* minimap */}
      <div className="hero-hud-map absolute right-5 top-5 flex flex-col items-end gap-2">
        <div className="relative" style={{ width: 176, height: 176 }}>
          <canvas ref={mmRef} width={176} height={176} className="rounded-full" style={{ boxShadow: `0 0 20px ${def.color}88`, background: "#000" }} />
        </div>
        <div className="text-right leading-tight">
          <div className="text-sm font-bold tracking-widest text-yellow-200">{h.district.toUpperCase()}</div>
          <div className="text-xs tracking-widest text-white/60">{h.clock}</div>
        </div>
        {h.mission && (
          <div className="hero-hud-mission w-[300px] p-3" style={{ background: "linear-gradient(135deg,rgba(10,14,30,.88),rgba(30,20,50,.7))", borderLeft: "4px solid #ffd23f", clipPath: "polygon(0 0,100% 0,100% 100%,6% 100%)" }}>
            <div className="text-[11px] font-bold tracking-[.25em] text-yellow-300">MISSION</div>
            <div className="text-lg font-black italic tracking-wide">{h.mission.toUpperCase()}</div>
            {h.objectives.map((o, i) => (<div key={i} className="mt-0.5 flex gap-2 text-[13px] text-white/90"><span className="text-emerald-300">▸</span>{o}</div>))}
          </div>
        )}
      </div>

      {/* toasts */}
      <div className="absolute left-5 top-[250px] flex flex-col gap-1.5">
        {h.toasts.map((t) => (<div key={t.id} className="toast-in max-w-[420px] px-3 py-1.5 text-sm font-semibold" style={{ background: "rgba(8,10,22,.82)", borderLeft: `4px solid ${t.color}`, color: t.color, textShadow: "0 1px 2px #000" }}>{t.text}</div>))}
      </div>

      {/* banner */}
      {h.banner && (
        <div key={h.banner.key} className="banner absolute left-0 right-0 top-[26%] text-center">
          <div className="text-5xl font-black italic tracking-[.12em]" style={{ fontFamily: "Orbitron, sans-serif", color: "#fff", textShadow: `0 0 30px ${h.banner.color}, 0 0 60px ${h.banner.color}, 4px 4px 0 ${h.banner.color}66` }}>{h.banner.title}</div>
          {h.banner.sub && <div className="mx-auto mt-2 max-w-[760px] text-lg font-semibold tracking-[.2em]" style={{ color: h.banner.color }}>{h.banner.sub}</div>}
        </div>
      )}

      {perfect && <div className="absolute left-1/2 top-[38%] -translate-x-1/2 text-4xl font-black italic tracking-widest text-cyan-200 banner" style={{ fontFamily: "Orbitron, sans-serif", textShadow: "0 0 20px #3cf" }}>PERFECT DODGE</div>}

      {h.lock && <div className="absolute left-1/2 top-[12%] -translate-x-1/2 text-xs font-bold tracking-[.3em] text-rose-300">LOCKED ON · {h.lock.toUpperCase()}</div>}
      {h.charge > 0.05 && (
        <div className="absolute left-1/2 top-[56%] w-40 -translate-x-1/2"><Bar v={h.charge} max={1} color={`linear-gradient(90deg,${def.color},${def.color2})`} h={8} /></div>
      )}
      {h.prompt && <div className="absolute bottom-[150px] left-1/2 -translate-x-1/2 px-5 py-2 text-lg font-bold tracking-widest" style={{ background: "rgba(8,10,22,.85)", border: "1px solid #ffd23f", color: "#ffd23f" }}>{h.prompt}</div>}

      {/* abilities */}
      <div className="hero-hud-abilities absolute bottom-5 left-1/2 flex -translate-x-1/2 items-end gap-3">
        {ordered.map((a) => {
          const c = h.cds[a.key];
          const cd = c?.cd ?? 0, frac = c ? Math.min(1, cd / (c.max || 1)) : 0;
          const ok = c?.ok;
          return (
            <div key={a.key} className="relative" style={{ width: 66, height: 66, transform: "skewX(-8deg)", background: "linear-gradient(160deg,rgba(20,24,44,.92),rgba(8,10,22,.92))", border: `2px solid ${cd > 0 ? "#555" : ok ? def.color2 : "#744"}`, boxShadow: cd <= 0 && ok ? `0 0 14px ${def.color}` : "none", opacity: ok ? 1 : 0.6 }}>
              <div className="flex h-full w-full items-center justify-center" style={{ transform: "skewX(8deg)" }}><AbilityIcon id={a.icon} color={def.color2} size={42} /></div>
              {cd > 0 && <div className="absolute inset-0" style={{ background: `conic-gradient(rgba(0,0,0,.72) ${frac * 360}deg, transparent 0)` }} />}
              {cd > 0 && <div className="absolute inset-0 flex items-center justify-center text-xl font-black" style={{ transform: "skewX(8deg)", textShadow: "0 0 6px #000" }}>{cd.toFixed(cd < 10 ? 1 : 0)}</div>}
              <div className="absolute -top-2.5 left-1 px-1.5 text-[11px] font-black" style={{ background: def.color, color: "#111" }}>{a.key}</div>
              <div className="absolute -bottom-2 right-0 px-1 text-[10px] font-bold text-sky-200" style={{ background: "#0008" }}>{a.cost}</div>
            </div>
          );
        })}
        <div className="relative ml-3" style={{ width: 84, height: 84, borderRadius: "50%", background: ultReady ? `radial-gradient(circle,${def.color2},${def.color})` : "rgba(8,10,22,.9)", border: `3px solid ${ultReady ? "#fff" : "#556"}`, boxShadow: ultReady ? `0 0 28px ${def.color2}` : "none" }}>
          <svg className="absolute inset-0" viewBox="0 0 84 84"><circle cx="42" cy="42" r="38" fill="none" stroke={def.color2} strokeWidth="4" strokeDasharray={`${(h.ult / 100) * 238.7} 238.7`} transform="rotate(-90 42 42)" /></svg>
          <div className="flex h-full w-full items-center justify-center"><AbilityIcon id={def.abilities[def.abilities.length - 1].icon} color={ultReady ? "#111" : "#99a"} size={50} /></div>
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 text-[11px] font-black" style={{ background: ultReady ? "#fff" : def.color, color: "#111" }}>X</div>
        </div>
        <div className="ml-2 mb-1 text-[11px] leading-tight tracking-wider text-white/70">
          <div><b className="text-white">LMB</b> combo · <b className="text-white">RMB</b> heavy</div>
          <div><b className="text-white">C</b> dodge · <b className="text-white">T</b> lock</div>
        </div>
      </div>
    </div>
  );
}
