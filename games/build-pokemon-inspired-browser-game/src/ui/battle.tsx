import { useEffect, useRef, useState } from 'react';
import { ITEMS, SPECIES, TYPE_COLOR, TYPE_ICON, maxHp, movesOf, typeMult } from '../game/data';
import { HpBar, MonCanvas, useG } from './common';

type Sub = 'main' | 'fight' | 'orb' | 'bag' | 'party';

export function BattlePanel() {
  const g = useG(); const b = g.b!; const p = g.p!;
  const [sub, setSub] = useState<Sub>('main');
  const menuOk = b.phase === 'menu';
  const forced = b.phase === 'forceSwitch';
  const pm = p.party[b.pi]; const em = b.enemies[b.ei];
  const moves = movesOf(pm);
  const orbs = Object.keys(p.items).filter((k) => ITEMS[k]?.kind === 'orb' && p.items[k] > 0);
  const heals = Object.keys(p.items).filter((k) => ITEMS[k]?.kind === 'heal' && p.items[k] > 0);
  const wild = b.kind === 'wild';
  const mega = g.canMega();
  const view: Sub = forced ? 'party' : menuOk ? sub : 'main';

  useEffect(() => { if (menuOk) setSub('main'); }, [menuOk, b.pi, b.ei]);

  const ref = useRef({ view, moves, orbs, wild, menuOk, forced, mega });
  ref.current = { view, moves, orbs, wild, menuOk, forced, mega };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const s = ref.current; if (g.paused || (!s.menuOk && !s.forced)) return;
      const n = e.code.startsWith('Digit') ? Number(e.code.slice(5)) : 0;
      if (e.code === 'Backspace') { setSub('main'); return; }
      if (s.forced) { if (n >= 1 && n <= 6) void g.chooseSwitch(n - 1); return; }
      if (e.code === 'KeyE' && s.mega) { void g.doMega(); return; }
      if (s.view === 'main') {
        if (n === 1) setSub('fight'); else if (n === 2 && s.wild && s.orbs.length) setSub('orb');
        else if (n === 3) setSub('bag'); else if (n === 4) setSub('party'); else if (n === 5 && s.wild) void g.act({ t: 'run' });
      } else if (s.view === 'fight') { if (n >= 1 && n <= s.moves.length) void g.act({ t: 'move', i: n - 1 }); }
      else if (s.view === 'orb') { if (n >= 1 && n <= s.orbs.length) void g.act({ t: 'orb', id: s.orbs[n - 1] }); }
      else if (s.view === 'party') { if (n >= 1 && n <= 6) void g.act({ t: 'switch', idx: n - 1 }); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [g]);

  const big = 'btn !py-2 text-sm sm:text-base flex items-center justify-center gap-1.5';
  return (
    <div className="panel mx-auto flex w-full max-w-5xl flex-col gap-2 p-2 sm:flex-row sm:p-3" style={{ height: 'clamp(168px, 31dvh, 232px)' }}>
      <div className="relative flex min-h-[46px] flex-1 flex-col justify-center rounded-xl border-2 border-[#0b0a1e] bg-[#f4f1ff] px-3 py-1.5 text-[#1d1a33] sm:min-h-0 sm:px-4">
        <p key={b.msg} className="anim-slide text-sm font-extrabold leading-snug sm:text-lg">{b.msg || '…'}</p>
        {b.tutorial && menuOk && <p className="mt-1 text-[11px] font-bold text-[#c2410c] sm:text-xs">💡 Tip: use FIGHT to weaken it, then throw an ORB — low HP means better odds!</p>}
        {!b.tutorial && menuOk && wild && sub === 'main' && <p className="mt-0.5 text-[11px] font-semibold text-[#5a5690] sm:text-xs">Catch odds are shown on each orb.</p>}
      </div>

      <div className="min-h-0 flex-1 sm:flex-[1.15]">
        {!menuOk && !forced && <div className="flex h-full items-center justify-center text-sm font-bold text-[#9aa0d8]"><span className="anim-blink">…</span></div>}

        {(menuOk || forced) && view === 'main' && (
          <div className="grid h-full grid-cols-3 grid-rows-2 gap-1.5">
            <button className={`${big} btn-red`} onClick={() => setSub('fight')}>⚔️ FIGHT<kbd className="hidden text-[10px] opacity-70 sm:inline">1</kbd></button>
            <button className={`${big} btn-gold`} disabled={!wild || !orbs.length} onClick={() => setSub('orb')}>🔴 ORBS<kbd className="hidden text-[10px] opacity-70 sm:inline">2</kbd></button>
            <button className={`${big} btn-green`} onClick={() => setSub('bag')}>🎒 BAG<kbd className="hidden text-[10px] opacity-70 sm:inline">3</kbd></button>
            <button className={`${big} btn-blue`} onClick={() => setSub('party')}>🐾 TEAM<kbd className="hidden text-[10px] opacity-70 sm:inline">4</kbd></button>
            <button className={`${big} btn-dark`} disabled={!wild} onClick={() => void g.act({ t: 'run' })}>🏃 RUN<kbd className="hidden text-[10px] opacity-70 sm:inline">5</kbd></button>
            <button className={`${big} ${mega ? 'mega-btn' : 'btn-dark'}`} disabled={!mega} onClick={() => void g.doMega()}>✨ MEGA<kbd className="hidden text-[10px] opacity-70 sm:inline">E</kbd></button>
          </div>
        )}

        {menuOk && view === 'fight' && (
          <div className="flex h-full flex-col gap-1">
            <div className="grid min-h-0 flex-1 grid-cols-2 gap-1.5">
              {moves.map((m, i) => {
                const eff = typeMult(m.type, SPECIES[em.sp].types);
                return (
                  <button key={m.id} onClick={() => void g.act({ t: 'move', i })}
                    className="btn relative flex flex-col items-start justify-center !px-2 !py-1 text-left leading-tight"
                    style={{ background: `linear-gradient(180deg, ${TYPE_COLOR[m.type]}, ${TYPE_COLOR[m.type]}cc)`, color: '#1d1a33' }}>
                    <span className="flex w-full items-center justify-between gap-1 text-[12px] font-extrabold sm:text-sm"><span className="truncate">{TYPE_ICON[m.type]} {m.name}</span><kbd className="hidden text-[10px] opacity-60 sm:inline">{i + 1}</kbd></span>
                    <span className="flex w-full items-center justify-between text-[10px] font-bold opacity-80 sm:text-[11px]">
                      <span>PWR {m.power}{m.prio ? ' ⚡' : ''}</span>
                      <span className={`rounded px-1 font-extrabold ${eff > 1 ? 'bg-[#1d1a33] text-[#ffd23f]' : eff === 0 ? 'bg-[#1d1a33] text-[#ff7a7a]' : eff < 1 ? 'bg-[#1d1a33]/70 text-[#c8cee8]' : ''}`}>
                        {eff > 1 ? `×${eff} ▲` : eff === 0 ? '×0 ✖' : eff < 1 ? `×${eff} ▼` : ''}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <button className="btn btn-dark !py-0.5 text-xs" onClick={() => setSub('main')}>← Back</button>
          </div>
        )}

        {menuOk && view === 'orb' && (
          <div className="flex h-full flex-col gap-1">
            <div className="scroll-y flex min-h-0 flex-1 flex-col gap-1">
              {orbs.map((id, i) => {
                const pct = Math.round(g.catchChance(id) * 100);
                return (
                  <button key={id} className="btn btn-dark flex items-center gap-2 !py-1.5 text-left" onClick={() => void g.act({ t: 'orb', id })}>
                    <span className="text-xl">{ITEMS[id].icon}</span>
                    <span className="flex-1 text-sm">{ITEMS[id].name} <span className="text-[#ffd23f]">×{p.items[id]}</span></span>
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-extrabold text-[#1d1a33]" style={{ background: pct > 60 ? '#5fe070' : pct > 30 ? '#ffd23f' : '#ff7a6a' }}>~{pct}%</span>
                    <kbd className="hidden text-[10px] opacity-60 sm:inline">{i + 1}</kbd>
                  </button>
                );
              })}
              {!orbs.length && <p className="p-2 text-center text-sm text-[#9aa0d8]">No orbs left! Buy more at a Mart.</p>}
            </div>
            <button className="btn btn-dark !py-0.5 text-xs" onClick={() => setSub('main')}>← Back</button>
          </div>
        )}

        {menuOk && view === 'bag' && (
          <div className="flex h-full flex-col gap-1">
            <div className="scroll-y flex min-h-0 flex-1 flex-col gap-1">
              {heals.map((id) => (
                <button key={id} className="btn btn-dark flex items-center gap-2 !py-1.5 text-left" disabled={pm.hp >= maxHp(pm)} onClick={() => void g.act({ t: 'item', id })}>
                  <span className="text-xl">{ITEMS[id].icon}</span><span className="flex-1 text-sm">{ITEMS[id].name} <span className="text-[#ffd23f]">×{p.items[id]}</span></span><span className="text-[11px] text-[#9aa0d8]">+{ITEMS[id].amount} HP</span>
                </button>
              ))}
              {!heals.length && <p className="p-2 text-center text-sm text-[#9aa0d8]">No healing items.</p>}
            </div>
            <button className="btn btn-dark !py-0.5 text-xs" onClick={() => setSub('main')}>← Back</button>
          </div>
        )}

        {(menuOk || forced) && view === 'party' && (
          <div className="flex h-full flex-col gap-1">
            <div className="scroll-y grid min-h-0 flex-1 grid-cols-2 content-start gap-1">
              {p.party.map((m, i) => (
                <button key={m.uid} disabled={m.hp <= 0 || i === b.pi}
                  onClick={() => forced ? void g.chooseSwitch(i) : void g.act({ t: 'switch', idx: i })}
                  className="btn btn-dark flex items-center gap-1.5 !p-1 text-left">
                  <MonCanvas sp={m.sp} size={30} dim={m.hp <= 0} />
                  <span className="min-w-0 flex-1 text-[11px] font-bold leading-tight"><span className="block truncate">{i + 1}. {SPECIES[m.sp].name} Lv.{m.level}</span><HpBar mon={m} /></span>
                </button>
              ))}
            </div>
            {!forced && <button className="btn btn-dark !py-0.5 text-xs" onClick={() => setSub('main')}>← Back</button>}
          </div>
        )}
      </div>
    </div>
  );
}

export function TouchControls() {
  const g = useG();
  const padRef = useRef<HTMLDivElement>(null);
  const [dir, setDir] = useState(-1);
  const [run, setRun] = useState(false);

  const calc = (e: React.PointerEvent) => {
    const r = padRef.current!.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < r.width * 0.1) return -1;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 1) : dy > 0 ? 0 : 3;
  };
  const upd = (d: number) => { setDir(d); g.setTouchDir(d); };
  const arrow = (d: number, cls: string, label: string) => (
    <div className={`absolute flex h-1/3 w-1/3 items-center justify-center rounded-xl text-xl font-black ${cls} ${dir === d ? 'bg-[#ffd23f] text-[#1d1a33]' : 'bg-[#2c2870] text-white'} border-[3px] border-[#0b0a1e]`}>{label}</div>
  );
  return (
    <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-3 py-2" style={{ height: 'clamp(130px, 24dvh, 190px)' }}>
      <div
        ref={padRef} className="relative aspect-square h-full touch-none"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); upd(calc(e)); }}
        onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') upd(calc(e)); }}
        onPointerUp={() => upd(-1)} onPointerCancel={() => upd(-1)}
      >
        {arrow(3, 'left-1/3 top-0', '▲')}{arrow(0, 'left-1/3 bottom-0', '▼')}{arrow(1, 'left-0 top-1/3', '◀')}{arrow(2, 'right-0 top-1/3', '▶')}
        <div className="absolute left-1/3 top-1/3 h-1/3 w-1/3 rounded-lg bg-[#1a1745]" />
      </div>
      <div className="flex flex-1 flex-col items-end gap-2">
        <div className="flex gap-2">
          <button className="btn btn-blue !px-3 !py-2 text-xs" onClick={() => g.openMenu('party')}>🐾 TEAM</button>
          <button className="btn btn-dark !px-3 !py-2 text-xs" onClick={() => g.togglePause()}>⏸</button>
        </div>
        <button
          className={`btn pixel !h-16 !w-16 rounded-full !text-[10px] touch-none ${run ? 'btn-gold' : 'btn-red'}`}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setRun(true); g.run = true; }}
          onPointerUp={() => { setRun(false); g.run = false; }} onPointerCancel={() => { setRun(false); g.run = false; }}
        >RUN</button>
      </div>
    </div>
  );
}
