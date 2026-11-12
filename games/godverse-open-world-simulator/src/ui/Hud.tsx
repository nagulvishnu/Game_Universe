import { useEffect, useRef, useState } from 'react';
import { useHud, ref, hud } from '../game/store';
import { POWER_MAP, POWERS, CATS, FORM_MAP, WEATHERS, FORMS } from '../game/types';
import { RIVAL_GODS } from '../game/godwars';
import { SPEED_NAMES } from '../game/player';
import { readGameSave } from '../game/save';
import { Icon } from './icons';

const CAT_MAP = Object.fromEntries(CATS.map((c) => [c.id, c]));

function fmtHour(h: number) {
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function Minimap() {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0, last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 66) return; last = t;
      const g = ref.game, c = cv.current; if (!g || !c || !g.minimap) return;
      const ctx = c.getContext('2d')!; const w = c.width, h = c.height;
      const px = ((g.player.pos.x + 2100) / 4200) * 256, pz = ((g.player.pos.z + 2100) / 4200) * 256;
      ctx.fillStyle = '#04101c'; ctx.fillRect(0, 0, w, h);
      ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(g.input.yaw);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(g.minimap, px - 96, pz - 96, 192, 192, -w, -h, 2 * w, 2 * h);
      // entities dots
      ctx.restore();
      ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(g.input.yaw);
      const k = (w / 96) * (256 / 4200) * 1.0; // px per world unit (source 96 img px -> w px)
      const scale = (2 * w) / 192 * (256 / 4200);
      void k;
      for (const p of g.disasters.tornadoes) { ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.arc((p.pos.x - g.player.pos.x) * scale, (p.pos.z - g.player.pos.z) * scale, 3, 0, 7); ctx.fill(); }
      for (const p of g.disasters.holes) { ctx.fillStyle = '#b070ff'; ctx.beginPath(); ctx.arc((p.pos.x - g.player.pos.x) * scale, (p.pos.z - g.player.pos.z) * scale, 4, 0, 7); ctx.fill(); }
      for (const p of g.disasters.portals) { ctx.strokeStyle = '#ff9a3d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc((p.pos.x - g.player.pos.x) * scale, (p.pos.z - g.player.pos.z) * scale, 4, 0, 7); ctx.stroke(); }
      ctx.restore();
      ctx.save(); ctx.translate(w / 2, h / 2);
      ctx.fillStyle = '#ffd24d'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="relative h-[168px] w-[168px] overflow-hidden rounded-full border border-white/20 shadow-[0_0_30px_rgba(80,120,255,0.25)]" aria-label="Minimap">
      <canvas ref={cv} width={168} height={168} />
      <div className="pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 text-[10px] font-bold tracking-widest text-white/80">N↑</div>
      <div className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: 'inset 0 0 24px rgba(0,0,0,0.7)' }} />
    </div>
  );
}

function Crosshair() {
  const power = useHud((s) => s.power);
  const charge = useHud((s) => s.charge);
  const started = useHud((s) => s.started);
  const [info, setInfo] = useState('');
  useEffect(() => {
    const id = setInterval(() => {
      const g = ref.game; if (!g) return;
      const a = g.aim;
      setInfo(a.hit === 'sky' ? '' : `${a.hit === 'god' ? 'Rival God' : a.hit === 'building' ? 'Structure' : a.hit === 'planet' ? 'Planet' : 'Ground'} · ${a.dist > 3000 ? '∞' : Math.round(a.dist) + ' m'}`);
    }, 120);
    return () => clearInterval(id);
  }, []);
  if (!started) return null;
  const c = POWER_MAP[power].color;
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 rounded-full border opacity-70" style={{ borderColor: c, boxShadow: `0 0 14px ${c}55` }} />
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />
        {[0, 90, 180, 270].map((r) => (
          <div key={r} className="absolute left-1/2 top-1/2 h-2.5 w-px" style={{ background: c, transform: `rotate(${r}deg) translateY(-36px)`, transformOrigin: '0 0' }} />
        ))}
        {charge > 0 && (
          <svg className="absolute -inset-2" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
            <circle cx="40" cy="40" r="36" fill="none" stroke={c} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${charge * 226} 226`} transform="rotate(-90 40 40)" />
          </svg>
        )}
      </div>
      {info && <div className="absolute left-1/2 top-[68px] -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold tracking-wider text-white/70">{info}</div>}
    </div>
  );
}

function PlayerCard() {
  const s = useHud((x) => x);
  const f = FORM_MAP[s.form];
  const status = s.space > 0.5 ? 'ORBITAL FLIGHT' : s.underwater ? 'SUBMERGED' : s.flying ? (s.speed > 20 ? 'FLYING' : 'HOVERING') : 'GROUNDED';
  return (
    <div className="glass anim-up w-[290px] rounded-2xl p-3">
      <div className="flex items-center gap-3">
        <div className="relative grid h-14 w-14 shrink-0 place-items-center rounded-xl" style={{ background: `radial-gradient(circle at 50% 35%, ${f.color}66, ${f.color}11 70%)`, border: `1px solid ${f.color}88`, boxShadow: `0 0 24px ${f.color}55` }}>
          <Icon name={f.icon} size={28} color={f.color} />
        </div>
        <div className="min-w-0">
          <div className="tiny-label">The Almighty</div>
          <div className="display truncate text-[15px] font-bold" style={{ color: f.color, textShadow: `0 0 12px ${f.color}88` }}>{f.name}</div>
          <div className="text-[12px] text-white/60">{f.tagline}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
        <div className="rounded-lg bg-white/5 px-2 py-1.5">
          <div className="tiny-label">Status</div>
          <div className="flex items-center gap-1 font-bold tracking-wide text-sky-200"><Icon name="Feather" size={13} />{status}</div>
        </div>
        <div className="rounded-lg bg-white/5 px-2 py-1.5">
          <div className="tiny-label">Velocity</div>
          <div className="font-bold tabular-nums text-amber-200">{s.speed.toLocaleString()} <span className="text-[10px] text-white/50">m/s</span></div>
        </div>
        <div className="rounded-lg bg-white/5 px-2 py-1.5">
          <div className="tiny-label">Speed Mode</div>
          <div className="font-bold text-yellow-200">{SPEED_NAMES[s.speedLevel]}</div>
        </div>
        <div className="rounded-lg bg-white/5 px-2 py-1.5">
          <div className="tiny-label">Altitude</div>
          <div className="font-bold tabular-nums text-emerald-200">{s.alt.toLocaleString()} <span className="text-[10px] text-white/50">m</span></div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] font-bold tracking-widest">
        {s.invuln ? (
          <span className="flex items-center gap-1 rounded-full bg-sky-400/15 px-2 py-0.5 text-sky-200"><Icon name="Shield" size={12} /> INVULNERABLE</span>
        ) : (
          <div className="flex-1">
            <div className="flex items-center justify-between text-rose-200"><span>MORTAL</span><span>{s.hp} HP</span></div>
            <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-rose-400 transition-all" style={{ width: `${s.hp}%` }} /></div>
          </div>
        )}
        {s.timeMode !== 'normal' && <span className="rounded-full bg-cyan-300/15 px-2 py-0.5 uppercase text-cyan-100">{s.timeMode === 'fast' ? 'time ×' + s.timeScale : 'time ' + s.timeMode}</span>}
      </div>
    </div>
  );
}

function WorldCard() {
  const s = useHud((x) => x);
  const w = WEATHERS.find((x) => x.id === s.weather) ?? WEATHERS[0];
  const night = s.hour < 6 || s.hour >= 18.5;
  return (
    <div className="glass anim-up w-[250px] rounded-2xl p-3 text-right">
      <div className="flex items-center justify-end gap-2">
        <Icon name={night ? 'Moon' : 'Sun'} size={20} color={night ? '#a8b8ff' : '#ffd24d'} />
        <div className="display text-2xl font-bold tabular-nums">{fmtHour(s.hour)}</div>
      </div>
      <div className="mt-1 flex items-center justify-end gap-1.5 text-[13px] text-white/75"><Icon name={w.icon} size={15} />{w.name}</div>
      <div className="mt-2 border-t border-white/10 pt-2">
        <div className="tiny-label">Location</div>
        <div className="text-[14px] font-bold text-cyan-100">{s.zone}</div>
        <div className="mt-1 font-mono text-[12px] tabular-nums text-white/70">X {s.x} &nbsp; Y {s.y} &nbsp; Z {s.z}</div>
      </div>
      <div className="mt-1 text-[10px] tracking-widest text-white/40">{s.fps} FPS</div>
    </div>
  );
}

function PowerBar() {
  const s = useHud((x) => x);
  const p = POWER_MAP[s.power];
  const cat = CAT_MAP[p.cat];
  const same = POWERS.filter((x) => x.cat === p.cat && s.unlockedPowers.includes(x.id));
  const g = () => ref.game!;
  return (
    <div className="pointer-events-auto glass anim-up w-[min(600px,92vw)] rounded-2xl p-3">
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl" style={{ background: `radial-gradient(circle at 50% 30%, ${p.color}77, ${p.color}14 75%)`, border: `1px solid ${p.color}99`, boxShadow: `0 0 26px ${p.color}55` }}>
          <Icon name={p.icon} size={30} color={p.color} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="tiny-label" style={{ color: cat.color }}>{cat.name}</span>
            <span className="rounded bg-white/10 px-1.5 text-[10px] font-bold tracking-widest text-white/70">{p.hint}</span>
          </div>
          <div className="display truncate text-[17px] font-bold" style={{ color: p.color }}>{p.name}</div>
          <div className="truncate text-[12px] text-white/60">{p.desc}</div>
        </div>
        <div className="hidden shrink-0 flex-col gap-1 text-[11px] text-white/60 sm:flex">
          <span><kbd className="rounded bg-white/10 px-1.5 font-bold text-white">Q</kbd> Power wheel</span>
          <span><kbd className="rounded bg-white/10 px-1.5 font-bold text-white">Tab</kbd> God panel</span>
          <span><kbd className="rounded bg-white/10 px-1.5 font-bold text-white">1–6</kbd> Forms</span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1" role="listbox" aria-label={`${cat.name} powers`}>
        {same.map((x) => (
          <button key={x.id} role="option" aria-selected={x.id === s.power} title={x.name} onClick={() => g().powers.select(x.id)}
            className="grid h-8 w-8 place-items-center rounded-lg border transition hover:scale-110" style={{ borderColor: x.id === s.power ? x.color : 'rgba(255,255,255,0.1)', background: x.id === s.power ? `${x.color}33` : 'rgba(255,255,255,0.04)' }}>
            <Icon name={x.icon} size={16} color={x.id === s.power ? x.color : '#aab4d8'} />
          </button>
        ))}
        <span className="ml-auto text-[10px] tracking-widest text-white/35">SCROLL · {s.unlockedPowers.length} POWERS OWNED</span>
      </div>
    </div>
  );
}

function WarPanel() {
  const s = useHud((state) => state);
  const god = RIVAL_GODS.find((candidate) => candidate.id === s.selectedGod) ?? RIVAL_GODS[0];
  const available = RIVAL_GODS.filter((candidate) => !s.ownedRegions.includes(candidate.region));
  if (!s.started) return null;
  return (
    <div className="pointer-events-auto glass anim-up w-[min(360px,92vw)] rounded-2xl p-3">
      {s.warActive || s.warStatus === 'victory' ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="tiny-label">{s.warActive ? 'DIVINE CHALLENGE' : 'REGION CLAIMED'}</div>
              <div className="display text-[15px] font-bold" style={{ color: `#${god.color.toString(16).padStart(6, '0')}` }}>{god.name} · {god.region}</div>
              <div className="text-[11px] text-white/60">{god.title}</div>
            </div>
            <div className="text-right text-[11px] font-bold tracking-widest text-white/70">{s.warActive ? `${Math.ceil(s.warGodHp)} / ${s.warGodMaxHp} HP` : 'POWERS CLAIMED'}</div>
          </div>
          {s.warActive ? (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, (s.warGodHp / s.warGodMaxHp) * 100)}%`, background: `#${god.color.toString(16).padStart(6, '0')}` }} />
            </div>
          ) : s.warChoice === 'none' ? (
            <div className="mt-2">
              <div className="text-[12px] text-white/75">Choose their fate to claim the region and all {god.powers.length} powers:</div>
              <div className="mt-2 flex gap-2">
                <button className="flex-1 rounded-lg border border-sky-300/40 bg-sky-300/10 px-2 py-1.5 text-[11px] font-bold text-sky-100 hover:bg-sky-300/20" onClick={() => ref.game?.godWars.resolve('imprisoned')}>IMPRISON</button>
                <button className="flex-1 rounded-lg border border-rose-300/40 bg-rose-300/10 px-2 py-1.5 text-[11px] font-bold text-rose-100 hover:bg-rose-300/20" onClick={() => ref.game?.godWars.resolve('killed')}>KILL</button>
              </div>
            </div>
          ) : (
            <div className="mt-2 text-[11px] font-semibold tracking-wide text-emerald-100">
              {s.warChoice === 'imprisoned' ? 'The god is imprisoned. Their region and powers are yours.' : 'The god is gone. Their region and powers are yours.'}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="tiny-label">PANTHEON · {s.ownedRegions.length} REGION{s.ownedRegions.length === 1 ? '' : 'S'} CONTROLLED</div>
          {available.length ? (
            <>
              <div className="mt-1 flex items-center gap-2">
                <select aria-label="Choose rival god" value={god.id} disabled={s.warActive}
                  onChange={(e) => ref.game?.godWars.select(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-white/15 bg-slate-950/90 px-2 py-2 text-[12px] font-bold text-white">
                  {available.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.region}</option>)}
                </select>
                <button disabled={s.warActive} onClick={() => ref.game?.godWars.challenge(god.id)}
                  className="rounded-lg border border-amber-300/40 bg-amber-300/15 px-3 py-2 text-[11px] font-bold tracking-wider text-amber-100 transition hover:bg-amber-300/25 disabled:opacity-40">
                  CHALLENGE
                </button>
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-white/50">
                <span>{s.warStatus === 'defeat' ? 'Defeated — challenge again when ready' : `${god.title} · ${god.hp} HP`}</span>
                <span>{s.unlockedPowers.length} powers</span>
              </div>
            </>
          ) : (
            <div className="mt-2 text-[11px] font-semibold tracking-wide text-emerald-100">All regions are under your control.</div>
          )}
        </>
      )}
      <div className="mt-2 flex flex-wrap gap-1">
        {god.powers.map((id) => {
          const power = POWER_MAP[id];
          return <span key={id} className="rounded-md border px-1.5 py-0.5 text-[9px] font-semibold tracking-wide"
            style={{ borderColor: `${power.color}55`, background: `${power.color}12`, color: power.color }}>{power.name}</span>;
        })}
      </div>
    </div>
  );
}

function Toasts() {
  const t = useHud((s) => s.toasts);
  return (
    <div className="pointer-events-none absolute left-1/2 top-5 flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
      {t.map((x) => (
        <div key={x.id} className="toast glass rounded-full px-4 py-1.5 text-[14px] font-bold tracking-wide" style={{ color: x.color, borderColor: x.color + '66', boxShadow: `0 0 20px ${x.color}33` }}>{x.text}</div>
      ))}
    </div>
  );
}

function Overlays() {
  const s = useHud((x) => x);
  const f = FORM_MAP[s.form];
  const sp = Math.min(1, Math.max(0, (s.speed - 150) / 1500));
  return (
    <>
      {s.underwater && <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle, rgba(10,90,120,0.28), rgba(0,40,70,0.55))', backdropFilter: 'blur(1.5px) saturate(1.2)' }} />}
      {s.timeMode === 'freeze' && (
        <div className="pointer-events-none absolute inset-0" style={{ backdropFilter: 'grayscale(0.85) contrast(1.15) brightness(1.05)', background: 'radial-gradient(circle, transparent 40%, rgba(120,220,255,0.28))' }}>
          <div className="display absolute bottom-40 left-1/2 -translate-x-1/2 text-xs tracking-[0.5em] text-cyan-100/80">— TIME STOPPED —</div>
        </div>
      )}
      {s.timeMode === 'reverse' && (
        <div className="pointer-events-none absolute inset-0" style={{ backdropFilter: 'sepia(0.7) hue-rotate(-10deg) contrast(1.1)', background: 'repeating-linear-gradient(0deg, rgba(255,160,60,0.07) 0 2px, transparent 2px 5px)', animation: 'scan 0.6s linear infinite' }}>
          <div className="display absolute left-1/2 top-24 -translate-x-1/2 text-sm tracking-[0.5em] text-orange-200/90">◀◀ REWINDING</div>
        </div>
      )}
      {s.timeMode === 'fast' && <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle, transparent 50%, rgba(255,220,120,0.14))' }} />}
      {sp > 0 && <div className="speedlines pointer-events-none absolute inset-0" style={{ opacity: sp * 0.7 }} />}
      {s.hit > 0 && <div key={'h' + s.hit} className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle, transparent 40%, rgba(255,0,40,0.6))', animation: 'hitFlash 0.6s ease-out forwards' }} />}
      {s.flash > 0 && <div key={'f' + s.flash} className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(circle, #ffffff, ${f.color}aa 45%, transparent 75%)`, animation: 'flashOut 1.1s ease-out forwards' }} />}
      {s.space > 0.5 && <div className="display pointer-events-none absolute bottom-48 left-1/2 -translate-x-1/2 text-[11px] tracking-[0.6em] text-indigo-200/60">OUTER SPACE</div>}
    </>
  );
}

function Help() {
  const open = useHud((s) => s.helpOpen);
  if (!open) return null;
  const rows: [string, string][] = [
    ['W A S D', 'Move / fly (flight follows camera pitch)'], ['Space', 'Jump · ascend · double-tap = toggle flight'], ['C / Ctrl', 'Descend (flight)'], ['Shift', 'Boost / sprint'],
    ['Mouse', 'Look · Left click = use power'], ['Scroll', 'Cycle powers (Alt+scroll = camera zoom)'], ['Q', 'Radial power wheel'], ['G', 'Dismount Shadow Dragon'], ['Tab / P', 'God control panel'],
    ['1 – 6', 'Transform instantly'], ['F', 'Toggle flight'], ['R', 'Cycle speed mode'], ['Z', 'Freeze time'], ['X (hold)', 'Reverse time'], ['T', 'Teleport to target'], ['H', 'This help'],
  ];
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
      <div className="glass anim-up w-[480px] rounded-2xl p-5">
        <div className="display mb-3 text-sm tracking-[0.3em] text-white/80">CONTROLS</div>
        <div className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
          {rows.map(([k, v]) => (<><kbd key={k} className="rounded bg-white/10 px-2 py-0.5 text-center font-bold text-amber-100">{k}</kbd><span key={v} className="text-white/75">{v}</span></>))}
        </div>
      </div>
    </div>
  );
}

function StartScreen() {
  const s = useHud((x) => x);
  const [msg, setMsg] = useState('Forging reality…');
  const [hasSave, setHasSave] = useState(false);
  const [saveError, setSaveError] = useState('');
  useEffect(() => { const id = setInterval(() => setMsg(hud.get().loadMsg), 100); return () => clearInterval(id); }, []);
  useEffect(() => {
    try {
      setHasSave(readGameSave() !== null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not read the saved game.');
    }
  }, []);
  if (s.started) return null;
  const continueGame = () => {
    try {
      ref.game?.continueFromSave();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not continue the saved game.');
    }
  };
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 grid place-items-center overflow-hidden" style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(40,50,110,0.55), rgba(3,4,12,0.92) 70%)', backdropFilter: 'blur(3px)' }}>
      <div className="relative mx-4 max-w-[760px] text-center">
        <div className="tiny-label mb-2" style={{ letterSpacing: '0.5em' }}>The ultimate god-mode simulator</div>
        <h1 className="display text-[clamp(44px,9vw,92px)] font-black leading-none" style={{ background: 'linear-gradient(180deg,#fff,#ffd24d 55%,#ff7a2a)', WebkitBackgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 0 30px rgba(255,190,70,0.45))' }}>GODVERSE</h1>
        <p className="mx-auto mt-4 max-w-[600px] text-[17px] text-white/75">Begin with a handful of divine skills. Challenge the gods who rule the regions, defeat them in direct combat, and claim their powers and lands.</p>
        <div className="mt-8">
          {!s.ready ? (
            <div className="mx-auto w-[320px]">
              <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="bar-anim h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-500 transition-all" style={{ width: `${Math.max(6, s.loading * 100)}%` }} /></div>
              <div className="mt-2 text-sm tracking-widest text-white/60">{msg}</div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              {hasSave && (
                <button onClick={continueGame} autoFocus className="display group relative rounded-full px-10 py-4 text-lg font-bold tracking-[0.25em] text-black transition hover:scale-105" style={{ background: 'linear-gradient(90deg,#a8ffd2,#43d69b)', boxShadow: '0 0 50px rgba(80,230,160,0.35)' }}>
                  CONTINUE REIGN
                </button>
              )}
              <button onClick={() => ref.game?.start()} autoFocus={!hasSave} className="display group relative rounded-full px-10 py-4 text-lg font-bold tracking-[0.25em] text-black transition hover:scale-105" style={{ background: 'linear-gradient(90deg,#ffe27a,#ff9a3a)', boxShadow: '0 0 50px rgba(255,170,60,0.55)' }}>
                BEGIN NEW REIGN
              </button>
            </div>
          )}
        </div>
        {saveError && <p role="alert" className="mt-3 text-sm text-rose-200">{saveError}</p>}
        <div className="mx-auto mt-8 grid max-w-[640px] grid-cols-2 gap-x-6 gap-y-1 text-left text-[13px] text-white/60 sm:grid-cols-3">
          {[['WASD', 'move / fly'], ['Space ×2', 'toggle flight'], ['Shift', 'boost'], ['Mouse L-click', 'use power'], ['Q', 'power wheel'], ['Tab', 'god panel'], ['1–6', 'transform'], ['Z / X', 'freeze / rewind'], ['R', 'speed mode']].map(([k, v]) => (
            <div key={k}><span className="font-bold text-amber-200">{k}</span> · {v}</div>
          ))}
        </div>
        <div className="mt-6 flex justify-center gap-2">{FORMS.map((f) => <span key={f.id} className="grid h-8 w-8 place-items-center rounded-full border" style={{ borderColor: f.color + '88', background: f.color + '22' }}><Icon name={f.icon} size={15} color={f.color} /></span>)}</div>
      </div>
    </div>
  );
}

function PauseHint() {
  const s = useHud((x) => x);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const f = () => setGone(true);
    window.addEventListener('keydown', f, { once: true }); window.addEventListener('mousedown', f, { once: true });
    return () => { window.removeEventListener('keydown', f); window.removeEventListener('mousedown', f); };
  }, []);
  useEffect(() => { if (!s.locked) setGone(false); }, [s.locked]);
  if (!s.started || s.locked || s.panelOpen || s.wheelOpen || gone) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[30%] grid place-items-center">
      <div className="glass anim-up rounded-full px-5 py-2 text-sm font-semibold tracking-wider text-white/85">Click the world to capture the mouse (or right-drag to look) · <span className="text-amber-200">Tab</span> opens the God Panel</div>
    </div>
  );
}

export function Hud() {
  const started = useHud((s) => s.started);
  const panel = useHud((s) => s.panelOpen);
  const wheel = useHud((s) => s.wheelOpen);
  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      <Overlays />
      {started && !panel && (
        <>
          <div className="absolute left-4 top-4"><PlayerCard /></div>
          <div className="absolute right-4 top-4"><WorldCard /></div>
          <div className="absolute left-1/2 top-4 -translate-x-1/2"><WarPanel /></div>
          <div className="absolute bottom-4 left-4 flex flex-col items-start gap-2"><Pop /><Minimap /></div>
          <div className="absolute inset-x-0 bottom-4 flex justify-center"><div className={wheel ? 'opacity-0' : ''}><PowerBar /></div></div>
          <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
            <button className="pointer-events-auto glass display rounded-xl px-4 py-2.5 text-[12px] font-bold tracking-[0.2em] text-emerald-100 transition hover:scale-105 hover:text-white" onClick={() => {
              try {
                ref.game?.saveState();
              } catch (error) {
                const message = error instanceof Error ? error.message : 'Could not save the game.';
                ref.game?.toast(message, '#ff8888');
              }
            }} aria-label="Save game state"><Icon name="Save" size={14} className="mr-2 inline -mt-0.5" />SAVE STATE</button>
            <button className="pointer-events-auto glass display rounded-xl px-4 py-2.5 text-[12px] font-bold tracking-[0.2em] text-amber-100 transition hover:scale-105 hover:text-white" onClick={() => ref.game?.setPanel(true)} aria-label="Open God Control Panel"><Icon name="Settings" size={14} className="mr-2 inline -mt-0.5" />GOD PANEL</button>
            <button className="pointer-events-auto glass rounded-xl px-4 py-2 text-[12px] font-bold tracking-[0.2em] text-sky-100 transition hover:scale-105" onClick={() => ref.game?.setWheel(true)} aria-label="Open Power Wheel"><Icon name="Orbit" size={14} className="mr-2 inline -mt-0.5" />POWER WHEEL</button>
          </div>
          <Crosshair />
          <Help />
          <PauseHint />
        </>
      )}
      <Toasts />
      <StartScreen />
    </div>
  );
}

function Pop() {
  const s = useHud((x) => x);
  const items: [string, number, string][] = [['Users', s.npc, 'Population'], ['Car', s.veh, 'Vehicles'], ['PawPrint', s.animals, 'Wildlife'], ['Building2', s.buildings, 'Buildings']];
  return (
    <div className="glass rounded-xl p-2 text-[12px]">
      {items.map(([ic, n, label]) => (
        <div key={label} className="flex items-center gap-2 py-0.5"><Icon name={ic} size={13} color="#9fb4ff" /><span className="w-16 text-white/55">{label}</span><span className="font-bold tabular-nums text-white">{n}</span></div>
      ))}
    </div>
  );
}
