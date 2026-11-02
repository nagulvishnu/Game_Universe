import { AIRCRAFT, AIRCRAFT_CLASS_LABEL, LIVERIES, type AircraftClass, type AircraftSpec } from '@/game/aircraft';
import { WEATHER_LABEL, WEATHER_ORDER, type WeatherId } from '@/game/environment';
import { CAREER, MISSIONS, MODES, TRIALS, courseLength, fmtTime, getMission, type MissionDef, type MissionResult, type ModeId } from '@/game/missions';
import { RANKS, rankOf, type SaveData, type Settings } from '@/game/save';
import { AIRPORTS } from '@/game/worldData';
import type { FlightStats } from '@/game/engine';
import { Bar, Btn, Kbd, Panel, Stars, fmtMoney } from './common';
import { cn } from '@/utils/cn';
import { GAME_META } from '@/game/meta';

/* ------------------------------------------------------------------ */
export function TitleScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-20 bg-gradient-to-b from-slate-950/70 via-slate-950/10 to-slate-950/80">
      <div className="text-[11px] tracking-[0.6em] text-sky-300 uppercase mb-3">A browser flight experience</div>
      <h1 className="text-6xl md:text-8xl font-black tracking-tight leading-none" style={{ textShadow: '0 6px 40px rgba(14,165,233,0.55)' }}>
        SKY<span className="text-sky-400">BOUND</span>
      </h1>
      <div className="mt-2 text-lg md:text-2xl font-light tracking-[0.5em] text-slate-200 uppercase">Flight Simulator</div>
      <div className="mt-10">
        <Btn className="text-lg px-10 py-4 animate-pulse" onClick={onStart}>Take off ✈</Btn>
      </div>
      <div className="mt-8 flex gap-6 text-xs text-slate-300 flex-wrap justify-center px-6">
        <span>6 aircraft</span><span>•</span><span>9 airports</span><span>•</span><span>8 game modes</span><span>•</span><span>day / night & storms</span>
      </div>
      <div className="absolute bottom-4 text-[11px] text-slate-400">v{GAME_META.version} · Best with a keyboard · Sound on 🔊</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function MainMenu({ save, onMode, onHangar, onSettings, onControls }: { save: SaveData; onMode: (m: ModeId) => void; onHangar: () => void; onSettings: () => void; onControls: () => void }) {
  const rank = rankOf(save.xp);
  const t = save.totals;
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-gradient-to-r from-slate-950/85 via-slate-950/50 to-slate-950/20">
      <div className="min-h-full max-w-6xl mx-auto px-6 py-8 flex flex-col">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-4xl font-black tracking-tight">SKY<span className="text-sky-400">BOUND</span></h1>
            <div className="text-xs tracking-[0.4em] text-slate-300 uppercase">Select your mission</div>
          </div>
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={onHangar}>✈ Hangar</Btn>
            <Btn variant="ghost" onClick={onControls}>⌨ Controls</Btn>
            <Btn variant="ghost" onClick={onSettings}>⚙ Settings</Btn>
          </div>
        </div>
        <div className="grid lg:grid-cols-[1fr_300px] gap-6 flex-1">
          <div className="grid sm:grid-cols-2 gap-4 content-start">
            {MODES.map((m) => (
              <button key={m.id} onClick={() => onMode(m.id)} className="group text-left cursor-pointer">
                <Panel className="p-5 h-full transition group-hover:-translate-y-1 group-hover:border-white/40 relative overflow-hidden">
                  <div className="absolute -right-4 -top-6 text-[110px] leading-none opacity-[0.07] group-hover:opacity-20 transition" style={{ color: m.color }}>{m.icon}</div>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl font-bold" style={{ background: m.color + '33', color: m.color, border: `1px solid ${m.color}66` }}>{m.icon}</div>
                    <div>
                      <div className="font-extrabold text-lg tracking-wide">{m.name}</div>
                      <div className="text-xs text-slate-300 mt-0.5">{m.tagline}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-[11px] uppercase tracking-widest text-slate-400">
                    {m.id === 'free' ? 'Unlimited' : m.id === 'career' ? `${save.careerDone.length}/${CAREER.length} contracts` : `${MISSIONS.filter((x) => x.mode === m.id).length} missions`}
                  </div>
                </Panel>
              </button>
            ))}
          </div>
          <div className="space-y-4">
            <Panel className="p-5">
              <div className="text-[10px] tracking-[0.3em] text-sky-300 uppercase">Pilot profile</div>
              <div className="text-xl font-extrabold mt-1">{rank.name}</div>
              <Bar className="mt-2" value={rank.progress} color="#fbbf24" label={`${save.xp} XP`} right={rank.next.xp > 0 ? `next: ${rank.next.name}` : ''} />
              <div className="mt-4 text-3xl font-black text-emerald-300">{fmtMoney(save.credits)}</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400">Credits</div>
            </Panel>
            <Panel className="p-5 text-sm">
              <div className="text-[10px] tracking-[0.3em] text-sky-300 uppercase mb-2">Flight log</div>
              <div className="grid grid-cols-2 gap-y-1.5 text-slate-200">
                <span className="text-slate-400">Flights</span><span className="text-right font-mono">{t.flights}</span>
                <span className="text-slate-400">Landings</span><span className="text-right font-mono">{t.landings}</span>
                <span className="text-slate-400">Crashes</span><span className="text-right font-mono">{t.crashes}</span>
                <span className="text-slate-400">Distance</span><span className="text-right font-mono">{Math.round(t.distanceKm)} km</span>
                <span className="text-slate-400">Hours</span><span className="text-right font-mono">{(t.hours).toFixed(1)}</span>
                <span className="text-slate-400">Max alt</span><span className="text-right font-mono">{Math.round(t.maxAlt * 3.28)} ft</span>
                <span className="text-slate-400">Top speed</span><span className="text-right font-mono">{Math.round(t.maxSpeed * 1.944)} kt</span>
                <span className="text-slate-400">Kills</span><span className="text-right font-mono">{t.kills}</span>
                <span className="text-slate-400">Rescues</span><span className="text-right font-mono">{t.rescues}</span>
              </div>
            </Panel>
            <div className="text-[11px] text-slate-400 leading-relaxed px-1">Ranks: {RANKS.map((r) => r.name).join(' → ')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export interface FreeCfg { airport: string; weather: WeatherId; hour: number; dynamic: boolean }

const Chip = ({ children, on, onClick }: { children: React.ReactNode; on?: boolean; onClick?: () => void }) => (
  <button onClick={onClick} className={cn('px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase border transition cursor-pointer', on ? 'bg-sky-500 text-slate-950 border-sky-300' : 'bg-white/5 border-white/15 text-slate-200 hover:bg-white/15')}>{children}</button>
);

function FreeSetup({ cfg, setCfg, onNext }: { cfg: FreeCfg; setCfg: (c: FreeCfg) => void; onNext: () => void }) {
  const ap = AIRPORTS.find((a) => a.id === cfg.airport)!;
  const hh = Math.floor(cfg.hour).toString().padStart(2, '0');
  const mm = Math.floor((cfg.hour % 1) * 60).toString().padStart(2, '0');
  return (
    <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6">
      <Panel className="p-5">
        <div className="text-[10px] tracking-[0.3em] text-sky-300 uppercase mb-3">Departure airport</div>
        <div className="grid sm:grid-cols-2 gap-2">
          {AIRPORTS.map((a) => (
            <button key={a.id} onClick={() => setCfg({ ...cfg, airport: a.id })} className={cn('text-left px-4 py-3 rounded-xl border transition cursor-pointer', cfg.airport === a.id ? 'bg-sky-500/20 border-sky-400' : 'bg-white/5 border-white/10 hover:bg-white/10')}>
              <div className="font-bold text-sm">{a.name}</div>
              <div className="text-[11px] text-slate-400">{a.icao} · {a.kind} · RWY {Math.round(a.length)} m · {Math.round(a.elev * 3.28)} ft</div>
            </button>
          ))}
        </div>
      </Panel>
      <div className="space-y-4">
        <Panel className="p-5">
          <div className="text-[10px] tracking-[0.3em] text-sky-300 uppercase mb-3">Weather</div>
          <div className="flex flex-wrap gap-2">
            {WEATHER_ORDER.map((w) => <Chip key={w} on={cfg.weather === w} onClick={() => setCfg({ ...cfg, weather: w })}>{WEATHER_LABEL[w]}</Chip>)}
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-200 cursor-pointer"><input type="checkbox" checked={cfg.dynamic} onChange={(e) => setCfg({ ...cfg, dynamic: e.target.checked })} /> Dynamic weather (changes during flight)</label>
        </Panel>
        <Panel className="p-5">
          <div className="text-[10px] tracking-[0.3em] text-sky-300 uppercase mb-3">Time of day · {hh}:{mm}</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {[['Dawn', 6.1], ['Morning', 9], ['Noon', 12.5], ['Sunset', 18.2], ['Night', 23]].map(([n, h]) => <Chip key={n as string} on={Math.abs(cfg.hour - (h as number)) < 0.3} onClick={() => setCfg({ ...cfg, hour: h as number })}>{n}</Chip>)}
          </div>
          <input type="range" min={0} max={24} step={0.1} value={cfg.hour} onChange={(e) => setCfg({ ...cfg, hour: parseFloat(e.target.value) })} className="w-full accent-sky-400" />
          <div className="text-[11px] text-slate-400 mt-1">The day/night cycle keeps running during free flight (speed in Settings).</div>
        </Panel>
        <Panel className="p-5">
          <div className="font-bold">{ap.name}</div>
          <div className="text-xs text-slate-300 mt-1">Start on the runway with engines idling. Land anywhere at an airport and stop to refuel and repair automatically.</div>
          <Btn className="mt-4 w-full" onClick={onNext}>Choose aircraft →</Btn>
        </Panel>
      </div>
    </div>
  );
}

function MissionCard({ m, save, locked, onPick, index }: { m: MissionDef; save: SaveData; locked?: boolean; onPick: () => void; index?: number }) {
  const stars = save.stars[m.id] ?? 0;
  const mode = MODES.find((x) => x.id === m.mode)!;
  return (
    <button disabled={locked} onClick={onPick} className="text-left cursor-pointer disabled:cursor-not-allowed group">
      <Panel className={cn('p-5 h-full transition relative', locked ? 'opacity-40' : 'group-hover:-translate-y-1 group-hover:border-white/40')}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase" style={{ color: mode.color }}>{index !== undefined ? `Contract ${index + 1} · ` : ''}{mode.name}</div>
            <div className="text-lg font-extrabold leading-tight mt-0.5">{m.title}</div>
          </div>
          {locked ? <span className="text-2xl">🔒</span> : <Stars n={stars} />}
        </div>
        <p className="text-sm text-slate-300 mt-2 leading-snug">{m.brief}</p>
        <div className="flex flex-wrap gap-1.5 mt-3 text-[10px] uppercase tracking-wider">
          <span className="px-2 py-0.5 rounded bg-white/10">Difficulty {'●'.repeat(m.difficulty)}{'○'.repeat(3 - m.difficulty)}</span>
          <span className="px-2 py-0.5 rounded bg-white/10">{WEATHER_LABEL[m.weather]}</span>
          <span className="px-2 py-0.5 rounded bg-white/10">{Math.floor(m.hour).toString().padStart(2, '0')}:{Math.floor((m.hour % 1) * 60).toString().padStart(2, '0')}</span>
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">{fmtMoney(m.reward)}</span>
        </div>
        <div className="mt-2 text-[10px] text-slate-400 uppercase tracking-widest">{m.allowed.length === 6 ? 'Any aircraft' : m.allowed.map((c) => AIRCRAFT_CLASS_LABEL[c]).join(' · ')}</div>
        {m.kind === 'trial' && (() => {
          const best = Object.entries(save.best).filter(([k]) => k.startsWith(m.trial!.course + ':')).sort((a, b) => a[1] - b[1])[0];
          return <div className="mt-2 text-xs text-cyan-300">Course {(courseLength(TRIALS[m.trial!.course]) / 1000).toFixed(1)} km{best ? ` · best ${fmtTime(best[1])}` : ''}</div>;
        })()}
      </Panel>
    </button>
  );
}

export function MissionSelect({ mode, save, freeCfg, setFreeCfg, onBack, onPick, onFreeNext }: {
  mode: ModeId; save: SaveData; freeCfg: FreeCfg; setFreeCfg: (c: FreeCfg) => void; onBack: () => void; onPick: (m: MissionDef) => void; onFreeNext: () => void;
}) {
  const info = MODES.find((m) => m.id === mode)!;
  let list: MissionDef[] = [];
  if (mode === 'career') list = CAREER.map(getMission);
  else if (mode !== 'free') list = MISSIONS.filter((m) => m.mode === mode);
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-gradient-to-b from-slate-950/85 to-slate-950/70">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Btn variant="ghost" onClick={onBack}>← Back</Btn>
          <div>
            <h2 className="text-3xl font-black tracking-tight" style={{ color: info.color }}>{info.icon} {info.name}</h2>
            <div className="text-sm text-slate-300">{info.tagline}</div>
          </div>
        </div>
        {mode === 'free' && <FreeSetup cfg={freeCfg} setCfg={setFreeCfg} onNext={onFreeNext} />}
        {mode !== 'free' && (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {list.map((m, i) => {
              const locked = mode === 'career' && i > 0 && !save.careerDone.includes(CAREER[i - 1]);
              return <MissionCard key={m.id} m={m} save={save} locked={locked} index={mode === 'career' ? i : undefined} onPick={() => onPick(m)} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function Rating({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-20 uppercase tracking-widest text-slate-400">{label}</span>
      <div className="flex-1 flex gap-0.5">
        {Array.from({ length: 10 }).map((_, i) => <span key={i} className={cn('h-2 flex-1 rounded-sm', i < v ? 'bg-sky-400' : 'bg-white/10')} />)}
      </div>
    </div>
  );
}

export function HangarScreen({ allowed, aircraftId, setAircraft, livery, setLivery, onBack, onLaunch, mission }: {
  allowed: AircraftClass[]; aircraftId: string; setAircraft: (id: string) => void; livery: number; setLivery: (i: number) => void; onBack: () => void; onLaunch?: () => void; mission: MissionDef | null;
}) {
  const spec = AIRCRAFT.find((a) => a.id === aircraftId) as AircraftSpec;
  const range = Math.round((spec.fuelCap / Math.max(spec.burn, 0.001)) * spec.vCruise * 0.6 / 1000);
  return (
    <div className="absolute inset-0 z-20 pointer-events-none flex flex-col">
      <div className="pointer-events-auto flex items-center justify-between px-6 pt-5">
        <div className="flex items-center gap-4">
          <Btn variant="ghost" onClick={onBack}>← Back</Btn>
          <div>
            <div className="text-[10px] tracking-[0.4em] text-sky-300 uppercase">Hangar</div>
            <div className="text-2xl font-black">{mission ? mission.title : 'Aircraft selection'}</div>
          </div>
        </div>
        {onLaunch && <Btn variant="amber" className="text-base px-8" onClick={onLaunch}>Launch ✈</Btn>}
      </div>
      <div className="flex-1 flex items-stretch justify-between px-6 py-4 gap-4 min-h-0">
        <Panel className="pointer-events-auto w-[270px] p-3 overflow-y-auto">
          {AIRCRAFT.map((a) => {
            const ok = allowed.includes(a.cls);
            return (
              <button key={a.id} disabled={!ok} onClick={() => setAircraft(a.id)} className={cn('w-full text-left px-3 py-2.5 rounded-xl mb-1.5 border transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-30', aircraftId === a.id ? 'bg-sky-500/25 border-sky-400' : 'border-transparent hover:bg-white/10')}>
                <div className="text-[10px] uppercase tracking-widest text-slate-400">{AIRCRAFT_CLASS_LABEL[a.cls]}{mission && mission.recommended === a.id ? ' · recommended' : ''}</div>
                <div className="font-extrabold">{a.name}</div>
                <div className="text-[11px] text-slate-400">{a.maker}</div>
              </button>
            );
          })}
          <div className="mt-3 px-1 text-[11px] text-slate-400">Drag to rotate · scroll to zoom</div>
        </Panel>
        <div className="flex-1" />
        <Panel className="pointer-events-auto w-[340px] p-5 overflow-y-auto">
          <div className="text-[10px] tracking-[0.3em] text-sky-300 uppercase">{spec.role}</div>
          <div className="text-2xl font-black">{spec.name}</div>
          <div className="text-xs text-slate-400 mb-2">{spec.maker}</div>
          <p className="text-sm text-slate-200 leading-snug">{spec.blurb}</p>
          <div className="mt-4 space-y-1.5">
            <Rating label="Speed" v={spec.ratings.speed} />
            <Rating label="Agility" v={spec.ratings.agility} />
            <Rating label="Payload" v={spec.ratings.cargo} />
            <Rating label="Range" v={spec.ratings.range} />
            <Rating label="Ease" v={spec.ratings.ease} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-y-1.5 text-xs">
            {[
              ['Cruise', spec.thrustKind === 'heli' ? `${Math.round(spec.vCruise * 1.944)} kt` : `${Math.round(spec.vCruise * 1.944)} kt`],
              ['Max speed (Vne)', `${Math.round(spec.vne * 1.944)} kt`],
              ['Ceiling', `${Math.round(spec.ceiling * 3.28).toLocaleString()} ft`],
              ['Range (est.)', `${range} km`],
              ['Empty mass', `${spec.mass.toLocaleString()} kg`],
              ['Fuel', `${spec.fuelCap.toLocaleString()} kg`],
              ['Payload', spec.payloadMax ? `${spec.payloadMax.toLocaleString()} kg` : '—'],
              ['Seats', spec.pax ? String(spec.pax) : '—'],
              ['G limit', `${spec.gMax} G`],
              ['Length / span', `${spec.length} / ${spec.span} m`],
            ].map(([k, v]) => (
              <div key={k} className="contents"><span className="text-slate-400">{k}</span><span className="text-right font-mono">{v}</span></div>
            ))}
          </div>
          <div className="mt-4 text-[10px] tracking-[0.3em] text-sky-300 uppercase mb-2">Livery</div>
          <div className="flex gap-2 flex-wrap">
            {LIVERIES.map((l, i) => (
              <button key={l.name} title={l.name} onClick={() => setLivery(i)} className={cn('w-10 h-10 rounded-lg border-2 overflow-hidden cursor-pointer', livery === i ? 'border-sky-400 scale-110' : 'border-white/20')} style={{ background: `linear-gradient(135deg, #${l.primary.toString(16).padStart(6, '0')} 50%, #${l.accent.toString(16).padStart(6, '0')} 50%)` }} />
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <Panel className={cn('p-6 max-h-[90vh] overflow-y-auto w-full', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <div onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-black tracking-wide uppercase">{title}</h3>
            <button onClick={onClose} className="text-slate-300 hover:text-white text-2xl leading-none cursor-pointer">×</button>
          </div>
          {children}
        </div>
      </Panel>
    </div>
  );
}

export function SettingsPanel({ s, set }: { s: Settings; set: (s: Settings) => void }) {
  const row = 'flex items-center justify-between gap-4 py-2 border-b border-white/5';
  return (
    <div className="text-sm">
      <div className={row}><span>Master volume</span><input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => set({ ...s, volume: parseFloat(e.target.value) })} className="w-44 accent-sky-400" /></div>
      <div className={row}><span>Mute</span><input type="checkbox" checked={s.muted} onChange={(e) => set({ ...s, muted: e.target.checked })} /></div>
      <div className={row}><span>Flight assist <span className="text-slate-400 text-xs">(wing levelling, stall protection)</span></span><input type="checkbox" checked={s.assist} onChange={(e) => set({ ...s, assist: e.target.checked })} /></div>
      <div className={row}><span>Invert pitch controls</span><input type="checkbox" checked={s.invertPitch} onChange={(e) => set({ ...s, invertPitch: e.target.checked })} /></div>
      <div className={row}><span>Units</span><div className="flex gap-2"><Chip on={s.units === 'aviation'} onClick={() => set({ ...s, units: 'aviation' })}>kt / ft</Chip><Chip on={s.units === 'metric'} onClick={() => set({ ...s, units: 'metric' })}>km/h / m</Chip></div></div>
      <div className={row}><span>Graphics quality</span><div className="flex gap-2">{(['low', 'medium', 'high'] as const).map((q) => <Chip key={q} on={s.quality === q} onClick={() => set({ ...s, quality: q })}>{q}</Chip>)}</div></div>
      <div className={row}><span>Field of view <b className="font-mono">{s.fov}°</b></span><input type="range" min={55} max={100} step={1} value={s.fov} onChange={(e) => set({ ...s, fov: parseInt(e.target.value) })} className="w-44 accent-sky-400" /></div>
      <div className={row}><span>Day/night speed (free flight) <b className="font-mono">×{s.timeScale}</b></span><input type="range" min={0} max={10} step={0.5} value={s.timeScale} onChange={(e) => set({ ...s, timeScale: parseFloat(e.target.value) })} className="w-44 accent-sky-400" /></div>
      <div className={row}><span>Control hints</span><input type="checkbox" checked={s.hints} onChange={(e) => set({ ...s, hints: e.target.checked })} /></div>
      <div className="text-[11px] text-slate-400 mt-3">Tip: if the game feels slow, choose “Low” quality – it reduces resolution, shadows and cloud density.</div>
    </div>
  );
}

export function ControlsPanel() {
  const rows: [string, string][] = [
    ['Pitch (stick)', 'W / S  or  ↑ / ↓   (W = nose down, S = nose up)'],
    ['Roll / bank', 'A / D  or  ← / →'],
    ['Rudder / yaw  (nose-wheel steering)', 'Q / E'],
    ['Throttle / collective', 'Shift (up) · Ctrl (down) · Z full · X idle'],
    ['Landing gear', 'G'],
    ['Flaps', 'F (extend) · V (retract)'],
    ['Wheel brakes / air-brake / reverse thrust', 'B  (Space on non-fighters)'],
    ['Cannon  (fighter)', 'Space'],
    ['Missile  (fighter, locks on in front)', 'Enter'],
    ['Camera: chase / cockpit / cinematic', 'C  or  1 · 2 · 3   (drag mouse to look around)'],
    ['Landing lights', 'L'],
    ['Flight assist toggle', 'H'],
    ['World map', 'M'],
    ['Pause / menu', 'P or Esc'],
    ['Gamepad', 'Sticks fly · RT/LT throttle · A brake · B gear · X flaps · Y camera · Start pause'],
  ];
  return (
    <div className="text-sm space-y-1.5">
      {rows.map(([a, b]) => (
        <div key={a} className="flex justify-between gap-4 py-1.5 border-b border-white/5"><span className="text-slate-300">{a}</span><span className="text-right font-mono text-xs text-sky-200 max-w-[55%]">{b}</span></div>
      ))}
      <div className="pt-3 text-xs text-slate-400 leading-relaxed">
        <b className="text-slate-200">Takeoff:</b> release brakes, push throttle to full, rotate (pull back) near rotation speed, retract gear once climbing.<br />
        <b className="text-slate-200">Landing:</b> gear down + flaps, descend on a 3° glideslope (follow the ILS diamonds), flare gently, throttle idle, brake. Helicopters: collective Shift/Ctrl, W to move forward.
      </div>
    </div>
  );
}

export function PauseMenu({ onResume, onRestart, onSettings, onControls, onExit, onEnd, freeFlight }: { onResume: () => void; onRestart: () => void; onSettings: () => void; onControls: () => void; onExit: () => void; onEnd: () => void; freeFlight: boolean }) {
  return (
    <div className="absolute inset-0 z-40 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center">
      <Panel className="p-8 w-[360px] flex flex-col gap-3">
        <div className="text-center mb-2">
          <div className="text-[10px] tracking-[0.4em] text-sky-300 uppercase">Paused</div>
          <div className="text-3xl font-black">SKYBOUND</div>
        </div>
        <Btn onClick={onResume}>Resume</Btn>
        <Btn variant="ghost" onClick={onRestart}>Restart</Btn>
        <Btn variant="ghost" onClick={onControls}>Controls</Btn>
        <Btn variant="ghost" onClick={onSettings}>Settings</Btn>
        <Btn variant="ghost" onClick={onEnd}>{freeFlight ? 'Finish flight' : 'Abort mission'}</Btn>
        <Btn variant="danger" onClick={onExit}>Exit to menu</Btn>
      </Panel>
    </div>
  );
}

export function ResultsScreen({ r, stats, onRetry, onNext, onMenu, onHangar, canNext }: { r: MissionResult; stats: FlightStats; onRetry: () => void; onNext: (() => void) | null; onMenu: () => void; onHangar: () => void; canNext: boolean }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] p-4 overflow-y-auto">
      <Panel className="w-full max-w-2xl p-7 my-auto">
        <div className="text-center">
          <div className={cn('text-[11px] tracking-[0.4em] uppercase font-bold', r.success ? 'text-emerald-300' : 'text-rose-300')}>{r.success ? 'Mission complete' : 'Mission failed'}</div>
          <h2 className="text-4xl font-black mt-1">{r.title}</h2>
          {r.success && r.stars > 0 && <div className="mt-2"><Stars n={r.stars} size="text-4xl" /></div>}
          <p className="text-slate-300 mt-2">{r.message}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-5 mt-6">
          <div className="space-y-1.5 text-sm">
            {r.score > 0 && <div className="flex justify-between text-lg font-black"><span>Score</span><span className="text-sky-300">{r.score}</span></div>}
            {r.lines.map((l, i) => <div key={i} className="flex justify-between gap-3"><span className="text-slate-400">{l.label}</span><span className="font-mono text-right">{l.value}</span></div>)}
          </div>
          <div className="space-y-1.5 text-sm bg-white/5 rounded-xl p-4">
            <div className="text-[10px] tracking-widest uppercase text-sky-300 mb-1">Flight statistics</div>
            <div className="flex justify-between"><span className="text-slate-400">Flight time</span><span className="font-mono">{fmtTime(stats.time)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Distance</span><span className="font-mono">{stats.distanceKm.toFixed(1)} km</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Max altitude</span><span className="font-mono">{Math.round(stats.maxAlt * 3.28).toLocaleString()} ft</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Top speed</span><span className="font-mono">{Math.round(stats.maxSpeed * 1.944)} kt</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Landings</span><span className="font-mono">{stats.landings}</span></div>
            <div className="pt-2 mt-2 border-t border-white/10 flex justify-between text-base"><span>Reward</span><span className="font-black text-emerald-300">+{fmtMoney(r.credits)} · +{r.xp} XP</span></div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-center mt-6">
          <Btn onClick={onRetry}>↻ Retry</Btn>
          {canNext && onNext && <Btn variant="amber" onClick={onNext}>Next →</Btn>}
          <Btn variant="ghost" onClick={onHangar}>Hangar</Btn>
          <Btn variant="ghost" onClick={onMenu}>Main menu</Btn>
        </div>
      </Panel>
    </div>
  );
}

export function Toasts({ items }: { items: { id: number; text: string; tone: string }[] }) {
  return (
    <div className="absolute top-[18%] left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 pointer-events-none">
      {items.map((t) => (
        <div key={t.id} className={cn('px-5 py-2 rounded-full text-sm font-bold tracking-wide shadow-xl border backdrop-blur animate-[toast_0.3s_ease-out]', t.tone === 'good' ? 'bg-emerald-500/80 border-emerald-300 text-slate-950' : t.tone === 'bad' ? 'bg-rose-600/85 border-rose-300' : 'bg-slate-900/85 border-white/20')}>{t.text}</div>
      ))}
    </div>
  );
}

export function HintBar({ heli, fighter }: { heli: boolean; fighter: boolean }) {
  return (
    <div className="absolute bottom-[170px] left-1/2 -translate-x-1/2 z-20 pointer-events-none">
      <div className="px-4 py-2 rounded-xl bg-slate-950/75 border border-white/10 text-[11px] text-slate-200 flex flex-wrap gap-x-4 gap-y-1 justify-center max-w-[720px]">
        <span><Kbd>Shift</Kbd>/<Kbd>Ctrl</Kbd> {heli ? 'collective' : 'throttle'}</span>
        <span><Kbd>W</Kbd><Kbd>S</Kbd> pitch</span>
        <span><Kbd>A</Kbd><Kbd>D</Kbd> bank</span>
        <span><Kbd>Q</Kbd><Kbd>E</Kbd> yaw</span>
        <span><Kbd>G</Kbd> gear</span>
        <span><Kbd>F</Kbd>/<Kbd>V</Kbd> flaps</span>
        <span><Kbd>B</Kbd> brake</span>
        <span><Kbd>C</Kbd> camera</span>
        {fighter && <span><Kbd>Space</Kbd> cannon <Kbd>Enter</Kbd> missile</span>}
        <span><Kbd>M</Kbd> map</span>
      </div>
    </div>
  );
}
