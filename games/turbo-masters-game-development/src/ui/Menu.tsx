import { useEffect, useState } from "react";
import { CARS, PAINTS, defaultCustom } from "../game/data";
import { host } from "../game/host";
import { audio } from "../game/audio";
import { getShowroom } from "./shared";
import { Chip } from "./kit";
import { useSave } from "../game/store";

export type MenuPick = "quick" | "championship" | "timetrial" | "battle" | "garage" | "settings" | "credits";
const ITEMS: { id: MenuPick; label: string; sub: string; color: string }[] = [
  { id: "quick", label: "Play · Quick Race", sub: "2 players · split-screen", color: "#17e0ff" },
  { id: "championship", label: "Championship", sub: "6 rounds · points", color: "#ffd21f" },
  { id: "timetrial", label: "Time Trial", sub: "chase the ghost", color: "#7affc0" },
  { id: "battle", label: "Battle Race", sub: "power-ups & traps", color: "#ff2fd0" },
  { id: "garage", label: "Garage", sub: "paint · wheels · upgrades", color: "#b07aff" },
  { id: "settings", label: "Settings", sub: "audio · graphics · controls", color: "#9fb4d8" },
  { id: "credits", label: "Credits", sub: "", color: "#9fb4d8" },
];

export default function Menu({ onPick }: { onPick: (p: MenuPick) => void }) {
  const [idx, setIdx] = useState(0);
  const [car, setCar] = useState(0);
  const [sel, setSel] = useState(0);
  const save = useSave();

  useEffect(() => {
    const sr = getShowroom();
    sr.setLayout("single");
    sr.celebrate = false;
    sr.auto = true;
    sr.shift = 0.2;
    sr.zoom = 1;
    sr.setAccents("#17e0ff", "#ff2fd0");
    host.setScene(sr);
    audio.startMusic({ bpm: 100, root: 57, scale: "pent", wave: "triangle" }, "menu");
    return () => {
      sr.shift = 0;
      audio.stopMusic();
    };
  }, []);

  useEffect(() => {
    const sr = getShowroom();
    const def = CARS[car];
    const cfg = { ...defaultCustom(def), primary: PAINTS[(car * 3 + 1) % PAINTS.length], secondary: def.paint[1] };
    if (car % 3 === 0) cfg.primary = def.paint[0];
    sr.setCar(0, def, cfg);
    const t = setTimeout(() => setCar((c) => (c + 1) % CARS.length), 5200);
    return () => clearTimeout(t);
  }, [car]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === "ArrowDown" || e.code === "KeyS") { setSel((s) => (s + 1) % ITEMS.length); audio.ui("move"); }
      if (e.code === "ArrowUp" || e.code === "KeyW") { setSel((s) => (s + ITEMS.length - 1) % ITEMS.length); audio.ui("move"); }
      if (e.code === "Enter" || e.code === "Space") { audio.ui("select"); onPick(ITEMS[sel].id); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [sel, onPick]);

  const def = CARS[car];
  void idx; void setIdx;
  return (
    <div className="absolute inset-0 select-none overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(90deg, rgba(4,5,12,0.92) 0%, rgba(4,5,12,0.55) 34%, rgba(4,5,12,0) 62%), linear-gradient(0deg, rgba(4,5,12,0.85), transparent 30%)" }} />
      <div className="absolute left-[4.5vw] top-[6vh] anim-left">
        <div className="font-display font-black italic leading-[0.9] logo-grad" style={{ fontSize: "clamp(40px,7vw,96px)", filter: "drop-shadow(0 0 22px rgba(23,224,255,0.55))" }}>
          TURBO
          <br />
          MASTERS
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-[3px] w-16 bg-[#ff2fd0] shadow-[0_0_12px_#ff2fd0]" />
          <div className="font-display text-[11px] md:text-xs tracking-[0.35em] text-cyan-200/90 uppercase">Anime-inspired · Local 2-player racing</div>
        </div>
      </div>

      <div className="absolute left-[4.5vw] bottom-[8vh] flex flex-col gap-2 w-[min(380px,80vw)]">
        {ITEMS.map((it, i) => (
          <button
            key={it.id}
            onMouseEnter={() => { setSel(i); audio.ui("move"); }}
            onClick={() => { audio.ui("select"); onPick(it.id); }}
            className="group relative text-left chamfer-sm transition-all duration-150 anim-left"
            style={{ animationDelay: `${i * 55}ms`, background: sel === i ? `linear-gradient(90deg, ${it.color}33, ${it.color}08)` : "rgba(8,10,24,0.55)", borderLeft: `4px solid ${sel === i ? it.color : "rgba(120,150,220,0.25)"}`, transform: sel === i ? "translateX(14px)" : "none", padding: "9px 18px" }}
          >
            <div className="font-display font-bold italic uppercase tracking-widest text-[15px] md:text-lg" style={{ color: sel === i ? "#fff" : "#a9b8d8", textShadow: sel === i ? `0 0 16px ${it.color}` : "none" }}>
              {it.label}
            </div>
            {it.sub && <div className="text-[12px] tracking-wider uppercase" style={{ color: sel === i ? it.color : "#6f7fa3" }}>{it.sub}</div>}
          </button>
        ))}
      </div>

      <div className="absolute right-[4vw] bottom-[7vh] text-right anim-right" key={def.id}>
        <Chip color="#ff2fd0">{def.cat}</Chip>
        <div className="font-display font-black italic text-3xl md:text-5xl uppercase text-white mt-2" style={{ textShadow: "0 0 30px rgba(23,224,255,0.6)" }}>{def.name}</div>
        <div className="text-cyan-100/70 tracking-wider uppercase text-sm">{def.blurb}</div>
      </div>

      <div className="absolute right-[4vw] top-[5vh] flex gap-6 text-right">
        {[0, 1].map((p) => (
          <div key={p} className="glass chamfer-sm px-4 py-2">
            <div className="font-display text-[11px] tracking-widest" style={{ color: p ? "#ff2fd0" : "#17e0ff" }}>PLAYER {p + 1}</div>
            <div className="font-display font-bold text-lg text-yellow-300">¤{save.profiles[p].money.toLocaleString()}</div>
            <div className="text-[11px] text-slate-400 uppercase">{save.profiles[p].stats.wins} wins · {save.profiles[p].unlocked.length}/12 cars</div>
          </div>
        ))}
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 bottom-3 text-[11px] text-slate-400/80 tracking-widest uppercase hidden md:block">
        P1 <b className="text-cyan-300">W A S D</b> · Shift nitro · Space drift &nbsp;|&nbsp; P2 <b className="text-pink-300">Arrows</b> · R-Shift nitro · Enter drift
      </div>
    </div>
  );
}
