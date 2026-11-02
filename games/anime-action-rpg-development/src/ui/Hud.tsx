import { useEffect, useState } from 'react';
import { useHud } from '../game/hud';
import { useGame } from '../game/store';
import { xpToNext } from '../game/data';
import { Bar } from './common';
import { game } from '../game/engine';

function Skill({ k, name, cd, max, cost, en, color, icon }: { k: string; name: string; cd: number; max: number; cost: number; en: number; color: string; icon: string }) {
  const f = max > 0 ? Math.min(1, cd / max) : 0; const lack = en < cost && cd <= 0;
  return (
    <div className="relative h-14 w-14 overflow-hidden rounded-xl text-center" title={name} style={{ border: `2px solid ${cd > 0 ? '#555' : color}`, background: `radial-gradient(circle, ${color}55, #0c0818)`, opacity: lack ? 0.55 : 1, boxShadow: cd <= 0 && !lack ? `0 0 12px ${color}88` : 'none' }}>
      <div className="mt-1 text-2xl leading-none">{icon}</div>
      <div className="text-[10px] font-black text-white">{k}</div>
      {cd > 0 && <div className="absolute inset-x-0 bottom-0 bg-black/70" style={{ height: `${f * 100}%` }} />}
      {cd > 0 && <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-white">{cd.toFixed(1)}</div>}
      {cost > 0 && <div className="absolute right-0.5 top-0 text-[9px] font-bold text-sky-300">{cost}</div>}
    </div>
  );
}

export default function Hud() {
  const h = useHud(); const lvl = useGame((s) => s.player.level); const xp = useGame((s) => s.player.xp); const gold = useGame((s) => s.player.gold); const sp = useGame((s) => s.player.skillPts); const ap = useGame((s) => s.player.attrPts);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  const banner = h.banner && now - h.banner.t < 3300 ? h.banner : null; const lu = h.levelUp && now - h.levelUp.t < 2600 ? h.levelUp : null; const perfect = now - h.perfect < 700;
  const tfReady = h.tf >= 100 && !h.tfActive;
  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none">
      {/* player panel */}
      <div className="absolute left-4 top-4 w-80">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-violet-300 bg-gradient-to-br from-violet-700 to-indigo-950 text-xl font-black shadow-[0_0_14px_#8a4aff]" style={h.tfActive ? { borderColor: '#ffe9a0', boxShadow: '0 0 20px #ffd24a' } : {}}>{lvl}</div>
          <div className="flex-1 space-y-1">
            <Bar v={h.hp} max={h.maxHp} color="#f0405a" h={16} label={`${Math.ceil(h.hp)} / ${h.maxHp}`} />
            <Bar v={h.en} max={h.maxEn} color="#3aa0ff" h={11} label={`${Math.floor(h.en)} / ${h.maxEn}`} />
            <div className="relative">
              <Bar v={h.tfActive ? h.tfTime : h.tf} max={h.tfActive ? h.tfMax : 100} color={h.tfActive ? '#ffd24a' : tfReady ? '#ff7adf' : '#a060ff'} h={10} glow={tfReady || h.tfActive} label={h.tfActive ? `${h.tfName.toUpperCase()}  ${h.tfTime.toFixed(0)}s` : tfReady ? 'AWAKENING READY — PRESS T' : `AWAKENING ${Math.floor(h.tf)}%`} />
            </div>
          </div>
        </div>
        <div className="mt-1 flex items-center gap-2"><div className="flex-1"><Bar v={xp} max={xpToNext(lvl)} color="#e8c040" h={5} /></div><div className="text-[10px] font-bold text-amber-300">🪙 {gold}</div></div>
        {(sp > 0 || ap > 0) && <div className="mt-1 text-[11px] font-bold text-emerald-300">{sp > 0 && `✦ ${sp} skill pt [K]  `}{ap > 0 && `◆ ${ap} attribute pt [C]`}</div>}
        <div className="mt-1 flex gap-2 text-[11px] font-bold">{h.status.burn > 0 && <span className="rounded bg-orange-600/80 px-1.5">🔥 BURN</span>}{h.status.slow > 0 && <span className="rounded bg-sky-600/80 px-1.5">❄ SLOW</span>}{h.status.poison > 0 && <span className="rounded bg-lime-600/80 px-1.5">☠ POISON</span>}</div>
      </div>

      {/* objective */}
      <div className="absolute right-4 top-4 w-72 text-right">
        <div className="text-[11px] font-bold uppercase tracking-[.25em] text-violet-300">{h.location}</div>
        <div className="mt-1 rounded-lg bg-black/45 px-3 py-2 text-sm" style={{ borderRight: '3px solid #c084fc' }}>
          <div className="text-[10px] font-bold uppercase tracking-widest text-amber-300">Objective</div>
          <div className="text-zinc-100">{h.objective}</div>{h.objDist > 0 && <div className="text-xs text-sky-300">◈ {h.objDist} m</div>}
        </div>
        <div className="mt-1 text-[10px] text-zinc-500">{h.fps} FPS</div>
      </div>

      {/* boss */}
      {h.boss && (
        <div className="absolute left-1/2 top-5 w-[min(720px,70vw)] -translate-x-1/2 text-center" style={{ animation: 'fadeUp .5s' }}>
          <div className="text-xs font-bold uppercase tracking-[.4em] text-rose-300">{h.boss.title}</div>
          <div className="text-2xl font-black tracking-[.15em] text-white drop-shadow-[0_2px_8px_#000]">{h.boss.name}{h.boss.phase > 0 && <span className="ml-3 text-sm text-rose-400">PHASE {h.boss.phase + 1}</span>}</div>
          <div className="relative mt-1 h-5 overflow-hidden rounded-sm bg-black/70 ring-2 ring-rose-900"><div className="h-full" style={{ width: `${(h.boss.hp / h.boss.max) * 100}%`, background: 'linear-gradient(180deg,#ff4a5a,#a0102a)', transition: 'width .15s' }} /><div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold">{Math.ceil(h.boss.hp)} / {h.boss.max}</div></div>
          <div className="mx-auto mt-1 h-1.5 w-1/2 overflow-hidden rounded bg-black/60"><div className="h-full" style={{ width: `${Math.min(1, h.boss.stagger) * 100}%`, background: h.boss.staggered ? '#ffe14a' : '#ffa030' }} /></div>
          {h.boss.staggered && <div className="text-sm font-black text-yellow-300">STAGGERED — ATTACK!</div>}
        </div>
      )}
      {!h.boss && h.target && (
        <div className="absolute left-1/2 top-5 w-72 -translate-x-1/2 text-center">
          <div className="text-sm font-bold text-white drop-shadow">🎯 {h.target.name} <span className="text-xs text-zinc-300">Lv {h.target.level}</span></div>
          <Bar v={h.target.hp} max={h.target.max} color="#ff5a5a" h={8} />
        </div>
      )}

      {/* skills */}
      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-end gap-2">
        <div className="mr-3 flex gap-1.5 text-center">
          {([['1', '🧪', h.potions.hp], ['2', '⚗️', h.potions.en], ['3', '🔮', h.potions.elixir]] as const).map(([k, ic, n]) => (<div key={k} className="relative h-10 w-10 rounded-lg border border-white/25 bg-black/55 text-lg leading-10"><span className={n ? '' : 'opacity-30'}>{ic}</span><span className="absolute left-0.5 top-0 text-[9px] font-bold text-zinc-300">{k}</span><span className="absolute bottom-0 right-1 text-[10px] font-bold text-white">{n}</span></div>))}
        </div>
        <Skill k="E" name="Abyssal Burst" cd={h.cd.e} max={h.cd.eMax} cost={h.costs.e} en={h.en} color="#c084fc" icon="🔮" />
        <Skill k="R" name="Shadow Rift" cd={h.cd.r} max={h.cd.rMax} cost={h.costs.r} en={h.en} color="#8a4aff" icon="🌀" />
        <Skill k="V" name="Abyssal Judgment" cd={h.cd.v} max={h.cd.vMax} cost={h.costs.v} en={h.en} color="#ff3d7f" icon="☄️" />
        <div className="relative h-14 w-14 overflow-hidden rounded-xl text-center" style={{ border: `2px solid ${tfReady ? '#ff7adf' : h.tfActive ? '#ffd24a' : '#555'}`, background: 'radial-gradient(circle,#ff9edb44,#0c0818)', animation: tfReady ? 'pulseGlow 1s infinite' : undefined, ['--g' as any]: '#ff7adf' }} title="Abyssal Awakening"><div className="mt-1 text-2xl">✨</div><div className="text-[10px] font-black">T</div></div>
      </div>
      {h.combo > 1 && <div className="absolute bottom-28 left-1/2 -translate-x-1/2 text-center"><div className="text-3xl font-black italic text-amber-300 drop-shadow-[0_2px_6px_#000]">{h.combo} HIT</div></div>}

      {/* prompt / hints */}
      {h.prompt && <div className="absolute bottom-36 left-1/2 -translate-x-1/2 rounded-lg border border-amber-300/60 bg-black/70 px-4 py-2 text-base font-bold text-amber-200" style={{ animation: 'fadeUp .2s' }}>{h.prompt}</div>}
      {h.hint && <div className="absolute bottom-48 left-1/2 -translate-x-1/2 rounded bg-black/60 px-3 py-1 text-sm font-semibold text-rose-200">{h.hint}</div>}

      {/* toasts */}
      <div className="absolute bottom-24 left-4 w-72 space-y-1">
        {h.toasts.map((t) => (<div key={t.id} className="flex items-center gap-2 rounded-lg bg-black/65 px-3 py-1.5 text-sm font-bold" style={{ borderLeft: `3px solid ${t.color}`, color: t.color, animation: 'slideIn .25s' }}><span>{t.icon}</span><span>{t.text}</span></div>))}
      </div>

      {/* banner */}
      {banner && <div key={banner.t} className="absolute inset-x-0 top-[28%] text-center" style={{ animation: 'bannerIn 3.2s forwards' }}><div className="text-5xl font-black tracking-[.12em] text-white drop-shadow-[0_4px_16px_#000]" style={{ textShadow: `0 0 30px ${banner.sub.startsWith('#') ? banner.sub : '#c084fc'}` }}>{banner.title}</div>{banner.sub && !banner.sub.startsWith('#') && <div className="mt-2 text-lg font-semibold tracking-[.3em] text-zinc-200">{banner.sub}</div>}</div>}
      {lu && <div key={lu.t} className="absolute inset-x-0 top-[22%] text-center" style={{ animation: 'lvl 2.5s forwards' }}><div className="text-6xl font-black text-yellow-300 drop-shadow-[0_0_24px_#ffb000]">LEVEL UP!</div><div className="text-2xl font-bold text-white">Level {lu.lvl}</div></div>}
      {perfect && <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 160px 30px rgba(120,200,255,.35)' }} />}
      {h.locked && <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-rose-400/70 opacity-0" />}

      {/* controls hint */}
      <div className="absolute bottom-4 right-4 w-56 rounded-lg bg-black/45 p-2 text-[10px] leading-snug text-zinc-300">
        <b className="text-violet-300">WASD</b> move · <b className="text-violet-300">Mouse</b> camera · <b className="text-violet-300">F/LMB</b> attack · <b className="text-violet-300">S×2</b> sweep · <b className="text-violet-300">E R V T</b> skills · <b className="text-violet-300">Q</b> block/parry · <b className="text-violet-300">Shift</b> sprint/dodge · <b className="text-violet-300">Space</b> jump · <b className="text-violet-300">RMB</b> lock-on · <b className="text-violet-300">G</b> interact · <b className="text-violet-300">I C K J M</b> menus · <b className="text-violet-300">Esc</b> pause
      </div>
      {h.pointer !== 'locked' && h.pointer !== 'failed' && !h.banner && <div className="absolute left-1/2 top-16 -translate-x-1/2 rounded bg-black/70 px-3 py-1 text-xs text-sky-200">Click the game to capture the mouse · press Esc to release it</div>}
      {h.pointer === 'locked' && <div className="absolute left-4 top-[7.5rem] text-[10px] text-zinc-500">Mouse captured — Esc releases the cursor</div>}
      {h.pointer === 'failed' && <div className="absolute left-4 top-[7.5rem] text-[10px] text-amber-400">Pointer lock unavailable — move the mouse over the game to steer the camera</div>}
      <div className="absolute inset-0 bg-black transition-opacity duration-500" style={{ opacity: h.fade }} />
      {h.dead && (
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center bg-black/70" style={{ animation: 'fadeUp .8s' }}>
          <div className="text-6xl font-black tracking-[.2em] text-rose-500 drop-shadow-[0_0_30px_#f00]">YOU HAVE FALLEN</div>
          <div className="mt-2 text-zinc-300">The Abyss claims another… but the Awakening is not yet done.</div>
          <button className="btn btn-red mt-6 !px-8 !py-3 text-lg" onClick={() => game?.respawn()}>Revive in Hearthvale (−10% gold)</button>
        </div>
      )}
    </div>
  );
}
