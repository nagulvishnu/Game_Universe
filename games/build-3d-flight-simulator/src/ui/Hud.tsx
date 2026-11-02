import { useEffect, useRef, useState } from 'react';
import type { GameEngine, HudSnapshot } from '@/game/engine';
import { AIRPORTS, HELIPADS } from '@/game/worldData';
import type { Settings } from '@/game/save';
import { Bar, altStr, altUnit, speedStr, speedUnit, vsStr } from './common';

const G = '#7dffc0';
const glow = { textShadow: '0 0 6px rgba(80,255,170,0.55), 0 1px 2px #000' } as const;

function SpeedTape({ s, u }: { s: HudSnapshot; u: Settings['units'] }) {
  const val = u === 'aviation' ? s.ias * 1.94384 : s.ias * 3.6;
  const step = u === 'aviation' ? 10 : 20;
  const px = u === 'aviation' ? 3.2 : 1.6;
  const base = Math.round(val / step) * step;
  const marks = [];
  for (let i = -6; i <= 6; i++) {
    const v = base + i * step;
    if (v < 0) continue;
    marks.push(
      <div key={v} className="absolute right-0 flex items-center gap-1" style={{ top: 130 + (val - v) * px - 8 }}>
        <span className="text-[11px] font-mono" style={{ color: G, opacity: 0.85 }}>{v}</span>
        <span className="w-2 h-px" style={{ background: G }} />
      </div>,
    );
  }
  const danger = s.ias > s.vne * 0.95;
  const slow = !s.onGround && s.stallSpeed > 0 && s.ias < s.stallSpeed * 1.12;
  return (
    <div className="relative w-[84px] h-[260px] overflow-hidden rounded-lg bg-black/30 border border-white/10" style={{ maskImage: 'linear-gradient(transparent, #000 14%, #000 86%, transparent)' }}>
      {marks}
      <div className="absolute left-0 right-0 top-[114px] h-8 flex items-center justify-center rounded border-2 bg-black/70" style={{ borderColor: danger ? '#f87171' : slow ? '#fbbf24' : G }}>
        <span className="font-mono font-bold text-lg" style={{ color: danger ? '#f87171' : slow ? '#fbbf24' : G }}>{Math.round(val)}</span>
      </div>
    </div>
  );
}

function AltTape({ s, u }: { s: HudSnapshot; u: Settings['units'] }) {
  const val = u === 'aviation' ? s.alt * 3.28084 : s.alt;
  const step = u === 'aviation' ? 100 : 50;
  const px = u === 'aviation' ? 0.28 : 0.85;
  const base = Math.round(val / step) * step;
  const marks = [];
  for (let i = -6; i <= 6; i++) {
    const v = base + i * step;
    marks.push(
      <div key={v} className="absolute left-0 flex items-center gap-1" style={{ top: 130 + (val - v) * px * 1 - 8 }}>
        <span className="w-2 h-px" style={{ background: G }} />
        <span className="text-[11px] font-mono" style={{ color: G, opacity: 0.85 }}>{v}</span>
      </div>,
    );
  }
  return (
    <div className="relative w-[96px] h-[260px] overflow-hidden rounded-lg bg-black/30 border border-white/10" style={{ maskImage: 'linear-gradient(transparent, #000 14%, #000 86%, transparent)' }}>
      {marks}
      <div className="absolute left-0 right-0 top-[114px] h-8 flex items-center justify-center rounded border-2 bg-black/70" style={{ borderColor: G }}>
        <span className="font-mono font-bold text-lg" style={{ color: G }}>{Math.round(val)}</span>
      </div>
    </div>
  );
}

function Compass({ heading }: { heading: number }) {
  const labels = [];
  for (let d = -360; d <= 720; d += 10) {
    const n = ((d % 360) + 360) % 360;
    const txt = n === 0 ? 'N' : n === 90 ? 'E' : n === 180 ? 'S' : n === 270 ? 'W' : n % 30 === 0 ? String(n / 10).padStart(2, '0') : '';
    labels.push(
      <div key={d} className="absolute top-0 flex flex-col items-center" style={{ left: d * 5, width: 0 }}>
        <span className="w-px" style={{ height: n % 30 === 0 ? 10 : 6, background: G }} />
        <span className="text-[11px] font-mono font-bold -ml-0" style={{ color: txt.length === 1 ? '#fbbf24' : G, transform: 'translateX(0)' }}>{txt}</span>
      </div>,
    );
  }
  return (
    <div className="relative w-[360px] h-9 overflow-hidden rounded-lg bg-black/30 border border-white/10" style={{ maskImage: 'linear-gradient(90deg, transparent, #000 15%, #000 85%, transparent)' }}>
      <div className="absolute top-1" style={{ transform: `translateX(${180 - heading * 5}px)` }}>{labels}</div>
    </div>
  );
}

function PitchLadder({ s }: { s: HudSnapshot }) {
  const ppd = 9;
  const lines = [];
  for (let d = -40; d <= 40; d += 5) {
    if (d === 0) continue;
    const major = d % 10 === 0;
    lines.push(
      <div key={d} className="absolute left-1/2 flex items-center" style={{ top: -d * ppd, transform: 'translate(-50%,-50%)' }}>
        <span className="h-px" style={{ width: major ? 50 : 26, background: G, opacity: d < 0 ? 0.6 : 0.9, borderTop: d < 0 ? `1px dashed ${G}` : undefined }} />
        {major && <span className="mx-2 text-[10px] font-mono w-5 text-center" style={{ color: G }}>{Math.abs(d)}</span>}
        <span className="h-px" style={{ width: major ? 50 : 26, background: G, opacity: d < 0 ? 0.6 : 0.9, borderTop: d < 0 ? `1px dashed ${G}` : undefined }} />
      </div>,
    );
  }
  const gamma = (Math.atan2(s.vs, Math.max(s.gs, 1)) * 180) / Math.PI;
  const fpm = (s.pitch - gamma) * ppd;
  return (
    <div className="absolute left-1/2 top-1/2 w-[320px] h-[320px] -translate-x-1/2 -translate-y-1/2 overflow-hidden pointer-events-none" style={{ maskImage: 'radial-gradient(circle, #000 55%, transparent 72%)' }}>
      <div className="absolute inset-0" style={{ transform: `rotate(${-s.bank}deg)` }}>
        <div className="absolute left-0 right-0 top-1/2" style={{ transform: `translateY(${s.pitch * ppd}px)` }}>
          <div className="absolute left-0 right-0 h-px" style={{ background: G, boxShadow: `0 0 6px ${G}` }} />
          {lines}
        </div>
      </div>
      {/* flight path marker */}
      {!s.onGround && s.gs > 8 && (
        <div className="absolute left-1/2 top-1/2" style={{ transform: `translate(-50%, calc(-50% + ${fpm}px))` }}>
          <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: G }} />
          <div className="absolute -left-4 top-1/2 w-3 h-0.5" style={{ background: G }} />
          <div className="absolute -right-4 top-1/2 w-3 h-0.5" style={{ background: G }} />
          <div className="absolute left-1/2 -top-3 w-0.5 h-3" style={{ background: G }} />
        </div>
      )}
    </div>
  );
}

function Adi({ s }: { s: HudSnapshot }) {
  return (
    <div className="relative w-[120px] h-[120px] rounded-full overflow-hidden border-2 border-white/30 shadow-xl bg-black">
      <div className="absolute inset-[-100%]" style={{ transform: `rotate(${-s.bank}deg) translateY(${s.pitch * 1.8}px)`, background: 'linear-gradient(#2f7fd8 0 50%, #7a5a33 50% 100%)' }}>
        <div className="absolute left-0 right-0 top-1/2 h-px bg-white" />
        {[-20, -10, 10, 20].map((d) => (
          <div key={d} className="absolute left-1/2 h-px bg-white/80" style={{ top: `calc(50% - ${d * 1.8}px)`, width: Math.abs(d) === 10 ? 26 : 40, transform: 'translateX(-50%)' }} />
        ))}
      </div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-0.5 bg-amber-300" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-300" />
      <div className="absolute left-1/2 top-[3px] -translate-x-1/2 text-amber-300 text-[10px]">▼</div>
    </div>
  );
}

function GearLights({ s }: { s: HudSnapshot }) {
  const down = s.gear > 0.98;
  const up = s.gear < 0.02;
  const col = down ? '#34d399' : up ? '#334155' : '#ef4444';
  const lamp = (cls: string) => <span className={`w-3.5 h-3.5 rounded-full ${cls}`} style={{ background: col, boxShadow: `0 0 8px ${col}` }} />;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-[10px] tracking-widest text-slate-300">{s.fixedGear ? (s.heli ? 'SKIDS' : 'GEAR FIXED') : 'GEAR'}</div>
      <div className="flex items-end gap-2">
        {lamp('')}
        <div className="flex flex-col gap-1">{lamp('')}</div>
        {lamp('')}
      </div>
      <div className="text-[10px] font-bold tracking-widest" style={{ color: col === '#334155' ? '#94a3b8' : col }}>{down ? 'DOWN' : up ? 'UP' : 'TRANSIT'}</div>
    </div>
  );
}

export function MiniMap({ engine, big, onClose }: { engine: GameEngine; big?: boolean; onClose?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    const size = big ? 760 : 190;
    cv.width = size;
    cv.height = size;
    const ext = 22000;
    const draw = () => {
      const m = engine.getMapState();
      const map = engine.worldMap();
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      if (big) {
        ctx.drawImage(map, 0, 0, size, size);
        const k = size / (2 * ext);
        const px = (x: number) => (x + ext) * k;
        ctx.font = '11px sans-serif';
        for (const a of AIRPORTS) {
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(px(a.x), px(a.z), 4, 0, 7);
          ctx.fill();
          ctx.strokeStyle = '#0ea5e9';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.shadowColor = '#000';
          ctx.shadowBlur = 4;
          ctx.fillText(a.icao, px(a.x) + 7, px(a.z) + 4);
          ctx.shadowBlur = 0;
        }
        for (const h of HELIPADS) { ctx.fillStyle = '#f87171'; ctx.fillRect(px(h.x) - 3, px(h.z) - 3, 6, 6); }
        for (const w of m.waypoints) { ctx.fillStyle = w.kind === 'enemy' ? '#f43f5e' : '#fbbf24'; ctx.beginPath(); ctx.arc(px(w.x), px(w.z), 5, 0, 7); ctx.fill(); }
        ctx.translate(px(m.x), px(m.z));
        ctx.rotate(m.heading);
        ctx.fillStyle = '#22d3ee';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -11); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8); ctx.closePath();
        ctx.fill(); ctx.stroke();
      } else {
        const view = 7000; // metres shown across the map
        const k = size / view;
        const mk = map.width / (2 * ext);
        const mk2 = size / (2 * ext);
        void mk2;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, 7);
        ctx.clip();
        ctx.translate(size / 2, size / 2);
        ctx.rotate(-m.heading);
        ctx.scale(k / mk, k / mk);
        ctx.translate(-((m.x + ext) * mk), -((m.z + ext) * mk));
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(map, 0, 0);
        ctx.restore();
        ctx.save();
        ctx.translate(size / 2, size / 2);
        ctx.rotate(-m.heading);
        const toS = (x: number, z: number) => [(x - m.x) * k, (z - m.z) * k];
        for (const a of AIRPORTS) {
          const [x, y] = toS(a.x, a.z);
          if (Math.hypot(x, y) > size / 2 + 20) continue;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(a.heading);
          ctx.fillStyle = '#fff';
          ctx.fillRect(-2, -a.length * k * 0.5, 4, a.length * k);
          ctx.restore();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 10px sans-serif';
          ctx.shadowColor = '#000';
          ctx.shadowBlur = 3;
          ctx.save();
          ctx.translate(x + 6, y - 6);
          ctx.rotate(m.heading);
          ctx.fillText(a.icao, 0, 0);
          ctx.restore();
          ctx.shadowBlur = 0;
        }
        for (const w of m.waypoints) {
          const [x, y] = toS(w.x, w.z);
          const d = Math.hypot(x, y);
          const cl = d > size / 2 - 8 ? (size / 2 - 8) / d : 1;
          ctx.fillStyle = w.kind === 'enemy' ? '#f43f5e' : '#fbbf24';
          ctx.beginPath();
          ctx.arc(x * cl, y * cl, w.kind === 'enemy' ? 3.5 : 5, 0, 7);
          ctx.fill();
        }
        ctx.restore();
        ctx.save();
        ctx.translate(size / 2, size / 2);
        ctx.fillStyle = '#22d3ee';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath();
        ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    };
    draw();
    const id = setInterval(draw, 120);
    return () => clearInterval(id);
  }, [engine, big]);
  if (big) {
    return (
      <div className="absolute inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
        <div className="relative rounded-2xl border border-white/20 bg-slate-950 p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-2 px-1">
            <span className="text-sm tracking-widest font-bold text-sky-300 uppercase">World Map</span>
            <button className="text-xs text-slate-300 hover:text-white cursor-pointer" onClick={onClose}>close [M]</button>
          </div>
          <canvas ref={ref} className="rounded-xl" style={{ width: 'min(76vh, 90vw)', height: 'min(76vh, 90vw)' }} />
          <div className="text-[11px] text-slate-400 mt-2 px-1">White = airports • red squares = hospitals • yellow = mission waypoints • cyan arrow = you</div>
        </div>
      </div>
    );
  }
  return (
    <div className="relative">
      <canvas ref={ref} className="rounded-full border-2 border-white/30 shadow-xl bg-slate-900" style={{ width: 190, height: 190 }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] bg-slate-950 border border-white/20 rounded px-1 text-sky-300 font-bold">N↑ HDG</div>
    </div>
  );
}

function IlsPanel({ s }: { s: HudSnapshot }) {
  const ils = s.ils!;
  const lx = Math.max(-1, Math.min(1, ils.loc / 2.5));
  const gy = Math.max(-1, Math.min(1, ils.gs / 1.2));
  return (
    <div className="relative w-[120px] h-[120px] rounded-xl bg-black/50 border border-white/15">
      <div className="absolute top-1 left-0 right-0 text-center text-[10px] font-bold tracking-widest text-emerald-300">ILS {ils.icao} {ils.rwy}</div>
      <div className="absolute left-1/2 top-[18px] bottom-[18px] w-px bg-white/30" />
      <div className="absolute top-1/2 left-[10px] right-[10px] h-px bg-white/30" />
      <div className="absolute w-4 h-4 rotate-45 bg-fuchsia-400 border border-white" style={{ left: `calc(50% + ${lx * 44}px - 8px)`, top: 'calc(50% - 8px)' }} />
      <div className="absolute w-4 h-4 rotate-45 bg-fuchsia-400 border border-white" style={{ top: `calc(50% + ${gy * 38}px - 8px)`, left: 'calc(50% - 8px)' }} />
      <div className="absolute bottom-1 left-0 right-0 text-center text-[10px] font-mono text-slate-200">{(ils.dist / 1000).toFixed(1)} km</div>
    </div>
  );
}

export function Hud({ s, engine, settings }: { s: HudSnapshot; engine: GameEngine; settings: Settings }) {
  const u = settings.units;
  const calc = () => Math.max(0.6, Math.min(1.15, Math.min(window.innerWidth / 1280, window.innerHeight / 720)));
  const [sc, setSc] = useState(calc);
  useEffect(() => {
    const f = () => setSc(calc());
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  const mission = s.mission;
  const warn = s.warnings.filter((w) => w !== 'LOW FUEL' || true);
  const critical = s.warnings.includes('PULL UP') ? 'PULL UP' : s.warnings.includes('STALL') ? 'STALL' : s.warnings.includes('GEAR') ? 'GEAR!' : s.warnings.includes('OVERSPEED') ? 'OVERSPEED' : s.warnings.includes('FUEL EMPTY') ? 'FUEL EMPTY' : null;
  const fuelCol = s.fuel > 0.3 ? '#34d399' : s.fuel > 0.12 ? '#fbbf24' : '#ef4444';
  const intCol = s.integrity > 60 ? '#34d399' : s.integrity > 30 ? '#fbbf24' : '#ef4444';
  const camNames = ['CHASE', 'COCKPIT', 'CINEMATIC'];
  const edgeArrow = (t: NonNullable<HudSnapshot['target']>) => {
    if (t.on) return null;
    const dx = t.sx - 0.5;
    const dy = t.sy - 0.5;
    const ang = Math.atan2(dy, dx);
    const x = 50 + Math.cos(ang) * 40;
    const y = 50 + Math.sin(ang) * 36;
    return <div className="absolute text-amber-300 text-2xl" style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) rotate(${ang + Math.PI / 2}rad)`, ...glow }}>▲</div>;
  };
  return (
    <div className="absolute left-0 top-0 pointer-events-none select-none text-white" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', width: `${100 / sc}%`, height: `${100 / sc}%`, transform: `scale(${sc})`, transformOrigin: '0 0' }}>
      {/* environment overlays */}
      {s.inCloud > 0.05 && <div className="absolute inset-0 bg-white" style={{ opacity: Math.min(0.55, s.inCloud * 0.6) }} />}
      {s.flash > 0.02 && <div className="absolute inset-0 bg-white" style={{ opacity: s.flash * 0.7 }} />}
      {s.blackout > 0.02 && <div className="absolute inset-0" style={{ background: `radial-gradient(circle, rgba(0,0,0,${s.blackout * 0.4}) 10%, rgba(0,0,0,${Math.min(1, s.blackout * 1.2)}) 75%)` }} />}
      {s.integrity < 35 && <div className="absolute inset-0 animate-pulse" style={{ boxShadow: 'inset 0 0 120px rgba(239,68,68,0.45)' }} />}
      {s.rain > 0.3 && s.cam === 1 && (
        <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.35) 0 2px, transparent 3px), radial-gradient(circle at 70% 20%, rgba(255,255,255,0.3) 0 3px, transparent 4px), radial-gradient(circle at 45% 70%, rgba(255,255,255,0.3) 0 2px, transparent 3px), radial-gradient(circle at 85% 65%, rgba(255,255,255,0.25) 0 3px, transparent 4px)', backgroundSize: '260px 200px' }} />
      )}

      {/* center pitch ladder */}
      <PitchLadder s={s} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full" style={{ background: G, boxShadow: `0 0 6px ${G}` }} />

      {/* enemies */}
      {s.enemies.map((e, i) => (
        <div key={i} className="absolute" style={{ left: `${e.sx * 100}%`, top: `${e.sy * 100}%`, transform: 'translate(-50%,-50%)' }}>
          <div className={`w-9 h-9 border-2 ${e.locked ? 'border-red-500 rotate-45 animate-pulse' : 'border-red-400/80'}`} style={{ boxShadow: '0 0 6px rgba(255,0,0,0.5)' }} />
          <div className="absolute left-full ml-1 top-0 text-[10px] text-red-300 whitespace-nowrap" style={glow}>{e.type.toUpperCase()} {(e.dist / 1000).toFixed(1)}</div>
        </div>
      ))}
      {/* objective marker */}
      {s.target && s.target.on && (
        <div className="absolute" style={{ left: `${s.target.sx * 100}%`, top: `${s.target.sy * 100}%`, transform: 'translate(-50%,-50%)' }}>
          <div className="w-7 h-7 rotate-45 border-2 border-amber-300" style={{ boxShadow: '0 0 10px rgba(251,191,36,0.8)' }} />
          <div className="absolute top-8 left-1/2 -translate-x-1/2 text-[11px] text-amber-200 whitespace-nowrap font-bold" style={glow}>{s.target.label} · {s.target.dist > 1500 ? (s.target.dist / 1000).toFixed(1) + ' km' : Math.round(s.target.dist) + ' m'}</div>
        </div>
      )}
      {s.target && edgeArrow(s.target)}

      {/* top: compass & mission */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
        <Compass heading={s.heading} />
        <div className="text-sm font-bold -mt-0.5" style={{ color: G, ...glow }}>▼ {String(Math.round(s.heading) % 360).padStart(3, '0')}°</div>
      </div>
      <div className="absolute top-3 left-3 max-w-[340px]">
        {mission.title && (
          <div className="rounded-xl bg-slate-950/70 border border-white/10 backdrop-blur px-4 py-3 shadow-xl">
            <div className="text-[10px] tracking-[0.25em] text-sky-300 uppercase">{mission.title}</div>
            <div className="text-base font-bold leading-tight mt-0.5" style={{ fontFamily: 'system-ui, sans-serif' }}>{mission.objective}</div>
            {mission.sub && <div className="text-xs text-slate-300 mt-0.5" style={{ fontFamily: 'system-ui, sans-serif' }}>{mission.sub}</div>}
            {mission.progress && <Bar className="mt-2" value={mission.progress.value} color={mission.progress.color} label={mission.progress.label} />}
            {mission.meters?.map((m) => <Bar key={m.label} className="mt-2" value={m.value} color={m.color} label={m.label} right={`${Math.round(m.value * 100)}%`} />)}
            {mission.notes?.map((n) => <div key={n} className="mt-1.5 text-xs text-amber-300 font-bold">{n}</div>)}
          </div>
        )}
      </div>
      <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
        {mission.timer && <div className="px-3 py-1 rounded-lg bg-slate-950/70 border border-white/10 text-xl font-bold text-amber-300">{mission.timer}</div>}
        {mission.count && <div className="px-3 py-1 rounded-lg bg-slate-950/70 border border-white/10 text-sm text-sky-200">{mission.count}</div>}
        <div className="px-3 py-1 rounded-lg bg-slate-950/60 border border-white/10 text-[11px] text-slate-300 text-right leading-snug">
          {s.aircraft}<br />
          {Math.floor(s.hour).toString().padStart(2, '0')}:{Math.floor((s.hour % 1) * 60).toString().padStart(2, '0')} · {s.weather}<br />
          Wind {String(Math.round(s.windDir) % 360).padStart(3, '0')}° / {speedStr(s.windSpeed, u)} {speedUnit(u)}
        </div>
        <div className="text-[10px] text-slate-400">[{camNames[s.cam]}] · assist {s.assist ? 'ON' : 'OFF'}</div>
      </div>

      {/* warnings */}
      {critical && (
        <div className="absolute left-1/2 top-[22%] -translate-x-1/2 px-6 py-2 rounded-lg bg-red-600/80 border-2 border-red-300 text-2xl font-black tracking-[0.3em] animate-pulse">{critical}</div>
      )}
      {!critical && s.warnings.length > 0 && (
        <div className="absolute left-1/2 top-[22%] -translate-x-1/2 px-4 py-1 rounded bg-amber-500/80 text-slate-950 text-sm font-black tracking-widest">{warn[0]}</div>
      )}
      {s.servicing && <div className="absolute left-1/2 top-[30%] -translate-x-1/2 px-4 py-1 rounded bg-emerald-500/80 text-slate-950 font-black tracking-widest text-sm animate-pulse">REFUELLING & REPAIRING…</div>}

      {/* left: speed */}
      <div className="absolute left-[4%] top-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
        <div className="text-[10px] tracking-widest text-slate-300">IAS {speedUnit(u)}</div>
        <SpeedTape s={s} u={u} />
        <div className="text-[11px] text-slate-300 mt-1">GS {speedStr(s.gs, u)} · M {s.mach.toFixed(2)}</div>
      </div>
      {/* right: altitude */}
      <div className="absolute right-[4%] top-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
        <div className="text-[10px] tracking-widest text-slate-300">ALT {altUnit(u)}</div>
        <AltTape s={s} u={u} />
        <div className="text-[11px] text-slate-300 mt-1">AGL {altStr(s.agl, u)}</div>
        <div className="text-xs font-bold" style={{ color: s.vs < -8 ? '#f87171' : G }}>VS {vsStr(s.vs, u) > 0 ? '+' : ''}{vsStr(s.vs, u)} {u === 'aviation' ? 'FPM' : 'M/S'}</div>
      </div>

      {/* bottom left: engine & systems */}
      <div className="absolute bottom-3 left-3 flex items-end gap-3">
        <div className="rounded-xl bg-slate-950/70 border border-white/10 backdrop-blur px-4 py-3 w-[250px] space-y-2.5">
          <div>
            <div className="flex justify-between text-[10px] tracking-widest text-slate-300 mb-1">
              <span>{s.heli ? 'COLLECTIVE' : 'THROTTLE'}</span>
              <span>{Math.round(s.throttle * 100)}%{s.ab ? ' · AB' : ''}</span>
            </div>
            <div className="h-3 rounded-full bg-white/10 overflow-hidden relative">
              <div className="h-full rounded-full" style={{ width: `${s.throttle * 100}%`, background: s.ab ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : 'linear-gradient(90deg,#38bdf8,#34d399)' }} />
              <div className="absolute inset-y-0 w-0.5 bg-white" style={{ left: `${s.thrust * 100}%` }} />
            </div>
          </div>
          <Bar label="FUEL" right={`${Math.round(s.fuelKg)} kg`} value={s.fuel} color={fuelCol} />
          <Bar label="INTEGRITY" right={`${Math.round(s.integrity)}%`} value={s.integrity / 100} color={intCol} />
          <div className="flex justify-between text-[11px] text-slate-200">
            <span>G <b style={{ color: Math.abs(s.g) > 4 ? '#fbbf24' : G }}>{s.g.toFixed(1)}</b></span>
            {!s.heli && <span>AoA <b style={{ color: s.stall ? '#f87171' : G }}>{s.aoa.toFixed(0)}°</b></span>}
            <span>FLAPS <b>{s.flapsMax ? `${s.flaps}/${s.flapsMax}` : '—'}</b></span>
            <span className={s.brake ? 'text-red-400 font-bold' : 'text-slate-500'}>BRK</span>
          </div>
          {s.ammo && <div className="flex justify-between text-[11px]"><span>CANNON <b className="text-amber-300">{s.ammo.gun}</b></span><span>MISSILES <b className="text-amber-300">{s.ammo.missiles}</b></span></div>}
        </div>
        <div className="rounded-xl bg-slate-950/70 border border-white/10 backdrop-blur px-3 py-3"><GearLights s={s} /></div>
      </div>

      {/* bottom center: ADI */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-end gap-3">
        <Adi s={s} />
        {s.ils && <IlsPanel s={s} />}
      </div>

      {/* bottom right: map */}
      <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1">
        {s.nav && <div className="text-[11px] px-2 py-0.5 rounded bg-slate-950/70 border border-white/10 text-slate-200">Nearest {s.nav.icao} · {(s.nav.dist / 1000).toFixed(1)} km · brg {String(Math.round(s.nav.bearing)).padStart(3, '0')}°</div>}
        <MiniMap engine={engine} />
      </div>
    </div>
  );
}
