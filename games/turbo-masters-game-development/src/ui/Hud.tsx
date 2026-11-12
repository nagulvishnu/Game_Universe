import { useEffect, useRef, useState } from "react";
import { HudPlayer, HudState } from "../game/race";
import { Gfx, carById } from "../game/data";
import { host } from "../game/host";
import { fmtTime, ordinal } from "../game/util";
import { hudStore, useHud } from "./shared";

const COLORS = ["#17e0ff", "#ff2fd0"];
const ITEM_ICON: Record<string, string> = { boost: "🚀", shield: "🛡️", emp: "⚡", oil: "🛢️", snare: "🌀", flare: "🔥" };
const ITEM_NAME: Record<string, string> = { boost: "TURBO BOOST", shield: "SHIELD", emp: "EMP BLAST", oil: "OIL SLICK", snare: "GRAVITY SNARE", flare: "COUNTER-FLARE" };

function useSize() {
  const [s, setS] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const f = () => setS({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return s;
}

function Speedo({ hp, color, nitroColor }: { hp: HudPlayer; color: string; nitroColor: string }) {
  const R = 74, cx = 90, cy = 90;
  const start = -225, sweep = 270;
  const max = 360;
  const frac = Math.min(1, hp.speed / max);
  const pt = (deg: number, r: number) => [cx + Math.cos((deg * Math.PI) / 180) * r, cy + Math.sin((deg * Math.PI) / 180) * r];
  const arc = (f0: number, f1: number, r: number) => {
    const a0 = start + sweep * f0, a1 = start + sweep * f1;
    const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r);
    return `M${x0},${y0} A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1},${y1}`;
  };
  const ticks = [];
  for (let k = 0; k <= 18; k++) {
    const a = start + (sweep * k) / 18;
    const [x0, y0] = pt(a, R - 4), [x1, y1] = pt(a, R + (k % 3 === 0 ? 7 : 3));
    ticks.push(<line key={k} x1={x0} y1={y0} x2={x1} y2={y1} stroke={k >= 16 ? "#ff4a4a" : "#9fb4d8"} strokeWidth={k % 3 === 0 ? 2 : 1} opacity={0.8} />);
    if (k % 3 === 0) { const [tx, ty] = pt(a, R - 17); ticks.push(<text key={"t" + k} x={tx} y={ty + 3} fontSize="9" textAnchor="middle" fill="#9fb4d8" fontFamily="Orbitron">{k * 20}</text>); }
  }
  const act = hp.nitroOn ? nitroColor : color;
  const needleA = start + sweep * frac;
  const [nx, ny] = pt(needleA, R - 8);
  return (
    <svg width="190" height="170" viewBox="0 0 180 170" style={{ filter: "drop-shadow(0 0 8px rgba(0,0,0,0.8))" }}>
      <circle cx={cx} cy={cy} r={R + 12} fill="rgba(4,6,16,0.62)" stroke="rgba(160,190,255,0.25)" />
      <path d={arc(0, 1, R)} stroke="rgba(255,255,255,0.1)" strokeWidth="7" fill="none" />
      <path d={arc(0, Math.max(0.002, frac), R)} stroke={frac > 0.88 ? "#ff4a4a" : act} strokeWidth="7" fill="none" style={{ filter: `drop-shadow(0 0 6px ${act})` }} />
      {ticks}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill="#fff" />
      <text x={cx} y={cy + 30} textAnchor="middle" fontSize="34" fontWeight="900" fill="#fff" fontFamily="Orbitron" style={{ fontStyle: "italic" }}>{Math.round(hp.speed)}</text>
      <text x={cx} y={cy + 43} textAnchor="middle" fontSize="9" fill="#9fb4d8" fontFamily="Orbitron" letterSpacing="2">KM/H</text>
      <g transform={`translate(${cx - 52},${cy - 22})`}>
        <rect width="30" height="30" fill="rgba(255,255,255,0.08)" stroke={act} />
        <text x="15" y="23" textAnchor="middle" fontSize="22" fontWeight="900" fill={act} fontFamily="Orbitron">{hp.gear}</text>
      </g>
      <rect x={cx + 14} y={cy - 12} width="42" height="6" fill="rgba(255,255,255,0.12)" />
      <rect x={cx + 14} y={cy - 12} width={42 * Math.min(1, hp.rpm)} height="6" fill={hp.rpm > 0.9 ? "#ff4a4a" : "#ffd21f"} />
      <text x={cx + 35} y={cy - 17} textAnchor="middle" fontSize="7" fill="#9fb4d8" fontFamily="Orbitron">RPM</text>
    </svg>
  );
}

function Minimap({ hud, p, map }: { hud: HudState; p: number; map: { pts: number[][]; w: number; h: number } }) {
  const S = 110;
  const sc = 92;
  const ox = (S - map.w * sc) / 2, oy = (S - map.h * sc) / 2;
  const d = map.pts.map((q, i) => `${i ? "L" : "M"}${(ox + q[0] * sc).toFixed(1)},${(oy + q[1] * sc).toFixed(1)}`).join(" ") + "Z";
  const me = hud.players[p], op = hud.players[1 - p];
  return (
    <svg width={S} height={S} className="rounded-sm" style={{ background: "rgba(4,6,16,0.55)", border: "1px solid rgba(160,190,255,0.25)" }}>
      <path d={d} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="7" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="rgba(160,190,255,0.8)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx={ox + op.mx * sc} cy={oy + op.mz * sc} r="4" fill={COLORS[1 - p]} opacity="0.8" />
      <circle cx={ox + me.mx * sc} cy={oy + me.mz * sc} r="5.5" fill={COLORS[p]} stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}

function FxCanvas({ p, post }: { p: number; post: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    let raf = 0;
    const lines = Array.from({ length: 46 }, () => ({ a: Math.random() * Math.PI * 2, r: 0.35 + Math.random() * 0.5, l: 0.1 + Math.random() * 0.3, s: 0.6 + Math.random() }));
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      const g = cv.getContext("2d")!;
      g.clearRect(0, 0, w, h);
      const hs = hudStore.get();
      if (!hs || !post) return;
      const fx = hs.speedFx[p] ?? 0;
      const hp = hs.players[p];
      const cx = w / 2, cy = h * 0.5, R = Math.hypot(w, h) / 2;
      const v = g.createRadialGradient(cx, cy, R * 0.55, cx, cy, R);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, `rgba(0,0,12,${0.5 + fx * 0.15})`);
      g.fillStyle = v;
      g.fillRect(0, 0, w, h);
      if (fx > 0.25) {
        g.lineCap = "round";
        for (const l of lines) {
          const a = l.a, r0 = R * (l.r + ((performance.now() * 0.0011 * l.s) % 0.5)) ;
          const len = R * l.l * fx;
          g.strokeStyle = `rgba(${hp.nitroOn ? "140,210,255" : "255,255,255"},${0.1 + 0.25 * fx})`;
          g.lineWidth = 1 + fx * 1.6;
          g.beginPath();
          g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
          g.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len));
          g.stroke();
        }
      }
      if (hp.nitroOn || hp.boost) {
        const c = g.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 0.95);
        c.addColorStop(0, "rgba(0,0,0,0)");
        c.addColorStop(1, hp.nitroOn ? "rgba(40,160,255,0.38)" : "rgba(255,210,60,0.25)");
        g.fillStyle = c;
        g.fillRect(0, 0, w, h);
      }
      if (hp.stun > 0) { g.fillStyle = `rgba(160,90,255,${0.15 + Math.random() * 0.15})`; g.fillRect(0, 0, w, h); }
      if (hp.damage > 0.6) { g.fillStyle = `rgba(255,30,30,${(hp.damage - 0.6) * 0.15})`; g.fillRect(0, 0, w, h); }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [p, post]);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

function PlayerHud({ hud, p, rect, map, post, carId }: { hud: HudState; p: number; rect: { x: number; y: number; w: number; h: number }; map: any; post: boolean; carId: string }) {
  const hp = hud.players[p];
  const color = COLORS[p];
  const scale = Math.max(0.55, Math.min(1.7, Math.min(rect.w / 800, rect.h / 450)));
  const nitroColor = carById(carId).nitroColor;
  const fx = hud.speedFx[p] ?? 0;
  void fx;
  const gapTxt = hp.gap > 0 ? `▲ +${Math.abs(hp.gap).toFixed(0)}m` : `▼ -${Math.abs(hp.gap).toFixed(0)}m`;
  return (
    <div className="absolute overflow-hidden" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, pointerEvents: "none" }}>
      <FxCanvas p={p} post={post} />
      <div className="absolute origin-top-left" style={{ width: rect.w / scale, height: rect.h / scale, transform: `scale(${scale})` }}>
        {/* position + lap */}
        <div className="absolute left-4 top-3">
          {hud.mode !== "timetrial" ? (
            <div className="flex items-end gap-2">
              <div className="font-display font-black italic leading-none" style={{ fontSize: 64, color: hp.pos === 1 ? "#ffd21f" : "#fff", textShadow: `0 0 20px ${hp.pos === 1 ? "#ffd21f" : color}` }}>{ordinal(hp.pos)}</div>
              <div className="font-display text-sm text-slate-300 pb-2">/ 2</div>
              <div className="font-display text-xs pb-2.5" style={{ color: hp.gap > 0 ? "#7affc0" : "#ff8a6a" }}>{gapTxt}</div>
            </div>
          ) : (
            <div className="font-display font-black italic text-3xl" style={{ color }}>TIME TRIAL</div>
          )}
          <div className="flex items-center gap-3 mt-1">
            <div className="font-display font-bold text-lg tracking-wider">LAP <span style={{ color }}>{hp.lap}</span>/{hp.laps}</div>
            <div className="flex gap-1">{Array.from({ length: hp.cps }).map((_, i) => <div key={i} className="w-2.5 h-1.5 skew-x" style={{ background: i < hp.cp ? color : "rgba(255,255,255,0.2)", boxShadow: i < hp.cp ? `0 0 6px ${color}` : "none" }} />)}</div>
          </div>
          <div className="font-display text-[11px] tracking-[0.25em] mt-1 uppercase" style={{ color }}>{hp.name}</div>
        </div>
        {/* timer */}
        <div className="absolute left-1/2 -translate-x-1/2 top-3 text-center">
          <div className="font-display font-bold text-2xl tabular-nums" style={{ textShadow: "0 0 10px #000" }}>{fmtTime(hud.phase === "countdown" ? 0 : hp.lapTime)}</div>
          <div className="font-display text-[11px] tracking-widest text-slate-300 tabular-nums">
            BEST <span className="text-yellow-300">{fmtTime(isFinite(hp.bestLap) ? hp.bestLap : hp.record || null)}</span>
          </div>
          {hp.onGhost && <div className="font-display text-[10px] tracking-widest text-cyan-300">👻 GHOST ACTIVE</div>}
        </div>
        {/* minimap */}
        <div className="absolute right-3 top-3"><Minimap hud={hud} p={p} map={map} /></div>
        {/* speedo */}
        <div className="absolute right-2 bottom-1"><Speedo hp={hp} color={color} nitroColor={nitroColor} /></div>
        {/* nitro + drift */}
        <div className="absolute left-4 bottom-4 w-[300px]">
          {hp.drift > 20 && (
            <div className="mb-2 font-display font-black italic text-3xl" style={{ color: "#7be6ff", textShadow: "0 0 18px #17e0ff" }}>
              DRIFT <span className="tabular-nums">{hp.drift}</span>
            </div>
          )}
          {hud.mode === "battle" && (
            <div className="mb-2 flex items-center gap-2 p-1.5 glass chamfer-sm w-[210px]">
              <div className="w-11 h-11 flex items-center justify-center text-2xl bg-black/40 border border-white/20" style={{ boxShadow: hp.item ? `0 0 14px ${color}` : "none" }}>{hp.item ? ITEM_ICON[hp.item] : "·"}</div>
              <div className="leading-tight">
                <div className="font-display text-[11px] uppercase tracking-wider" style={{ color: hp.item ? "#fff" : "#6f82a8" }}>{hp.item ? ITEM_NAME[hp.item] : "NO ITEM"}</div>
                <div className="text-[11px] text-slate-400">{hp.item ? `press ${p ? "K" : "F"} to use` : "drive through item boxes"}</div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            {hp.shield > 0 && <span className="text-xs px-1.5 py-0.5 bg-emerald-400/20 border border-emerald-300 text-emerald-200 font-display">SHIELD</span>}
            {hp.flare > 0 && <span className="text-xs px-1.5 py-0.5 bg-orange-400/20 border border-orange-300 text-orange-200 font-display">FLARE</span>}
            {hp.snare > 0 && <span className="text-xs px-1.5 py-0.5 bg-pink-400/20 border border-pink-300 text-pink-200 font-display blink">SNARED</span>}
            {hp.stun > 0 && <span className="text-xs px-1.5 py-0.5 bg-violet-400/20 border border-violet-300 text-violet-200 font-display blink">EMP</span>}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="font-display text-[11px] tracking-widest w-14" style={{ color: hp.nitroLock ? "#ff6a4a" : nitroColor }}>NITRO</div>
            <div className="relative h-4 flex-1 skew-x overflow-hidden" style={{ background: "rgba(255,255,255,0.12)", border: `1px solid ${nitroColor}88` }}>
              <div className="absolute inset-y-0 left-0" style={{ width: `${hp.nitro * 100}%`, background: `linear-gradient(90deg, ${nitroColor}88, ${nitroColor})`, boxShadow: `0 0 14px ${nitroColor}`, animation: hp.nitroOn ? "pulse-glow 0.2s infinite" : undefined }} />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="font-display text-[10px] tracking-widest w-14 text-slate-400">DAMAGE</div>
            <div className="relative h-1.5 flex-1 skew-x overflow-hidden bg-white/10"><div className="absolute inset-y-0 left-0" style={{ width: `${hp.damage * 100}%`, background: hp.damage > 0.6 ? "#ff3a3a" : "#ffb000" }} /></div>
          </div>
        </div>
        {/* center toasts */}
        {hp.toast && (
          <div key={hp.toast.id} className="absolute left-1/2 -translate-x-1/2 text-center whitespace-nowrap font-display font-black italic" style={{ top: "30%", fontSize: 34, color: hp.toast.color, textShadow: `0 0 22px ${hp.toast.color}, 0 2px 0 #000`, animation: "toast-pop 2.2s ease-out forwards" }}>
            {hp.toast.text}
          </div>
        )}
        {hp.wrongWay && <div className="absolute left-1/2 -translate-x-1/2 font-display font-black text-4xl text-red-500 blink" style={{ top: "42%", textShadow: "0 0 20px #f00" }}>▼ WRONG WAY ▼</div>}
        {hp.finished && (
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: "rgba(0,0,10,0.35)" }}>
            <div className="font-display font-black italic text-6xl text-yellow-300 text-glow">FINISHED</div>
            <div className="font-display text-2xl text-white mt-1">{hud.mode === "timetrial" ? "" : ordinal(hp.pos)} · {fmtTime(hp.finishTime)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Hud({ getMap, getCars, gfx, getRects }: { getMap: () => any; getCars: () => string[]; gfx: Gfx; getRects: () => { x: number; y: number; w: number; h: number }[] }) {
  const hud = useHud();
  const { w, h } = useSize();
  void w; void h;
  if (!hud) return null;
  const rects = getRects();
  const map = getMap();
  const cars = getCars();
  const cd = hud.countdown;
  return (
    <div className="absolute inset-0 pointer-events-none">
      {[0, 1].map((p) => <PlayerHud key={p} hud={hud} p={p} rect={rects[p]} map={map} post={gfx.post} carId={cars[p]} />)}
      {/* split divider */}
      {hud.vertical ? <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[3px]" style={{ background: "linear-gradient(180deg,#17e0ff,#ff2fd0)", boxShadow: "0 0 14px #ff2fd0aa" }} /> : <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[3px]" style={{ background: "linear-gradient(90deg,#17e0ff,#ff2fd0)", boxShadow: "0 0 14px #ff2fd0aa" }} />}
      {/* top info */}
      <div className="absolute left-1/2 -translate-x-1/2 top-0 px-3 py-0.5 text-[10px] font-display tracking-[0.3em] uppercase bg-black/60 text-slate-300 z-10">
        {hud.mode === "championship" ? `Round ${(hud.round ?? 0) + 1}/${hud.rounds} · ` : ""}{hud.trackName}
        {gfx.fps && <span className="ml-3 text-emerald-300">{Math.round(host.fps)} FPS</span>}
      </div>
      {/* countdown */}
      {hud.phase === "countdown" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="flex gap-3 mb-3 p-2 bg-black/60 chamfer-sm">
            {[0, 1, 2].map((i) => {
              const lit = cd === 3 ? 1 : cd === 2 ? 2 : cd === 1 ? 3 : 0;
              return <div key={i} className="w-7 h-7 rounded-full" style={{ background: i < lit ? "#ff2a2a" : "#2a0a0a", boxShadow: i < lit ? "0 0 18px #ff2222" : "none" }} />;
            })}
          </div>
          {cd >= 1 && <div key={cd} className="font-display font-black italic text-white text-glow" style={{ fontSize: "min(24vh,200px)", animation: "count-pop 1s ease-out forwards" }}>{cd}</div>}
        </div>
      )}
      {hud.phase === "racing" && hud.time < 1.4 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="font-display font-black italic text-emerald-300 text-glow" style={{ fontSize: "min(22vh,180px)", animation: "count-pop 1.3s ease-out forwards" }}>GO!</div>
        </div>
      )}
      {hud.phase === "finished" && (
        <div className="absolute inset-x-0 bottom-[8%] text-center font-display font-black italic text-4xl text-white text-glow blink" style={{ animationDuration: "1.4s" }}>RACE COMPLETE</div>
      )}
    </div>
  );
}
