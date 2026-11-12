import { useRef } from 'react';
import { touchState } from '../game/input';
import { useUI, HudTiming } from '../game/store';
import { STAGES } from '../game/modes';
import { cn } from '../utils/cn';
import { Btn, Confetti, Slider, fmtTime } from './ui';
import { ScoresTable } from './Screens';

const FEED_STYLE: Record<string, string> = {
  perfect: 'text-yellow-300 text-4xl sm:text-5xl drop-shadow-[0_0_14px_rgba(255,210,63,.9)]',
  special: 'text-pink-300 text-3xl sm:text-5xl drop-shadow-[0_0_16px_rgba(255,61,154,.95)]',
  good: 'text-lime-300 text-3xl sm:text-4xl',
  normal: 'text-white text-2xl sm:text-3xl',
  poor: 'text-red-300 text-2xl sm:text-3xl',
  bad: 'text-red-400 text-3xl sm:text-4xl',
  big: 'text-white text-4xl sm:text-6xl drop-shadow-[0_0_14px_rgba(46,230,255,.9)]',
  info: 'text-cyan-200 text-2xl sm:text-3xl',
};

function TimingRing({ t }: { t: HudTiming }) {
  const col = !t.inReach ? '#8aa0c8' : t.grade === 'perfect' ? '#ffd23f' : t.grade === 'good' ? '#7dffb0' : t.grade === 'normal' ? '#ffffff' : '#ff7a7a';
  const scale = 1 + (1 - t.prox) * 1.2;
  return (
    <div className="pointer-events-none absolute bottom-[7%] left-1/2 -translate-x-1/2">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border-2 border-white/40" />
        <div className="absolute inset-0 rounded-full border-4" style={{ transform: `scale(${scale})`, borderColor: col, boxShadow: t.inReach && t.grade === 'perfect' ? '0 0 22px #ffd23f' : 'none', transition: 'transform 90ms linear, border-color 90ms' }} />
        <div className={cn('absolute inset-0 grid place-items-center font-display text-[10px] font-black', t.inReach && t.grade === 'perfect' && 'animate-pulse')} style={{ color: col }}>{t.inReach ? t.grade.toUpperCase() : 'REACH'}</div>
      </div>
    </div>
  );
}

function Scoreboard() {
  const hud = useUI((s) => s.hud)!;
  if (hud.drill) {
    const d = hud.drill;
    return (
      <div className="glass pointer-events-none absolute left-1/2 top-[max(0.5rem,env(safe-area-inset-top))] z-20 -translate-x-1/2 rounded-2xl px-4 py-2 text-center">
        <div className="font-display text-[10px] font-extrabold uppercase tracking-[0.3em] text-cyan-300">{d.label}</div>
        <div className="flex items-center gap-4 sm:gap-6">
          <div><div className="font-display text-3xl font-black text-white sm:text-4xl">{d.score}</div><div className="text-[10px] uppercase text-slate-400">score</div></div>
          <div><div className="font-display text-xl font-black text-yellow-300">x{d.streak}</div><div className="text-[10px] uppercase text-slate-400">streak</div></div>
          {d.kind === 'movement' ? <div><div className="font-display text-xl font-black text-orange-300">{d.cones}</div><div className="text-[10px] uppercase text-slate-400">cones</div></div> : <div><div className="font-display text-xl font-black text-lime-300">{d.zoneHits}</div><div className="text-[10px] uppercase text-slate-400">targets</div></div>}
          {d.timeLimit > 0 && <div><div className={cn('font-display text-xl font-black', d.timeLeft < 10 ? 'text-red-400' : 'text-white')}>{fmtTime(d.timeLeft)}</div><div className="text-[10px] uppercase text-slate-400">time</div></div>}
          {d.goal > 0 && d.kind !== 'accuracy' && <div><div className="font-display text-xl font-black text-pink-300">{d.kind === 'blitz' ? d.goal : d.kind === 'perfectSmash' ? `${d.perfectSmashes}/${d.goal}` : `${d.best}/${d.goal}`}</div><div className="text-[10px] uppercase text-slate-400">goal</div></div>}
          {d.kind === 'accuracy' && <div><div className="font-display text-xl font-black text-pink-300">{d.returns ? Math.round((d.zoneHits / d.returns) * 100) : 0}%</div><div className="text-[10px] uppercase text-slate-400">goal {d.goal}%</div></div>}
        </div>
      </div>
    );
  }
  const name = (i: number) => hud.teams[i].names.map((n) => n.split(' ')[0]).join(' / ');
  const serving = (i: number) => hud.serverTeam === i;
  const pips = (g: number, rev = false) => (
    <div className={cn('flex gap-1', rev && 'flex-row-reverse')}>{Array.from({ length: hud.gamesToWin }).map((_, k) => <span key={k} className={cn('h-2.5 w-2.5 rounded-full border border-white/50', k < g && 'bg-yellow-300 shadow-[0_0_8px_#ffd23f]')} />)}</div>
  );
  return (
    <div className="pointer-events-none absolute left-1/2 top-[max(0.5rem,env(safe-area-inset-top))] z-20 -translate-x-1/2 text-center">
      <div className="glass flex items-stretch overflow-hidden rounded-2xl">
        <div className="flex min-w-[88px] flex-col items-end justify-center bg-cyan-500/15 px-3 sm:min-w-[130px]">
          <div className="max-w-[110px] truncate text-xs font-bold uppercase text-cyan-100 sm:max-w-[160px] sm:text-sm">{serving(0) && <span className="mx-1 inline-block h-2.5 w-2.5 rounded-full bg-yellow-300 shadow-[0_0_8px_#ffd23f]" />}{name(0)}</div>
          {hud.gamesToWin > 1 && pips(hud.teams[0].games)}
        </div>
        <div className="flex items-center gap-2 px-3 py-1 font-display text-3xl font-black text-white sm:text-4xl">
          <span className="min-w-[1.6ch] text-right">{hud.teams[0].score}</span><span className="text-cyan-300">:</span><span className="min-w-[1.6ch] text-left">{hud.teams[1].score}</span>
        </div>
        <div className="flex min-w-[88px] flex-col items-start justify-center bg-pink-500/15 px-3 sm:min-w-[130px]">
          <div className="max-w-[110px] truncate text-xs font-bold uppercase text-pink-100 sm:max-w-[160px] sm:text-sm">{name(1)}{serving(1) && <span className="mx-1 inline-block h-2.5 w-2.5 rounded-full bg-yellow-300 shadow-[0_0_8px_#ffd23f]" />}</div>
          {hud.gamesToWin > 1 && pips(hud.teams[1].games, false)}
        </div>
      </div>
      <div className="mt-1 text-[11px] font-bold uppercase tracking-widest text-slate-200/90">
        Game {hud.gameNo} · to {hud.pointsToWin} · {fmtTime(hud.time)}{hud.arcade ? ' · ARCADE' : ''}
      </div>
      {hud.matchPoint && hud.phase === 'rally' && <div className="mt-1 inline-block animate-pulse rounded bg-red-500/80 px-2 py-0.5 font-display text-[10px] font-black uppercase tracking-widest text-white">Match point</div>}
    </div>
  );
}

function Viewport({ i }: { i: number }) {
  const hud = useUI((s) => s.hud);
  const feed = useUI((s) => s.feed);
  const isTouch = useUI((s) => s.isTouch);
  if (!hud) return null;
  const meter = hud.meters[i] ?? 0;
  const full = meter >= 100;
  const timing = hud.timings[i];
  const show = feed.filter((f) => f.vp === i).slice(-3);
  const label = hud.humans === 2 ? `P${i + 1}` : 'P1';
  return (
    <div className="pointer-events-none relative h-full min-h-0 min-w-0 flex-1">
      <div className="absolute left-2 top-16 z-10 rounded-md bg-black/40 px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-cyan-200">{label}{hud.humans === 2 ? (i === 0 ? ' · WASD' : ' · ARROWS') : ''}</div>
      <div className="absolute left-1/2 top-[24%] z-10 flex w-full -translate-x-1/2 flex-col items-center gap-1">
        {show.map((f) => <div key={f.id} className={cn('anim-feed font-display font-black uppercase italic tracking-wide', FEED_STYLE[f.kind] ?? FEED_STYLE.normal)}>{f.text}</div>)}
      </div>
      {timing?.show && <TimingRing t={timing} />}
      <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-10 w-36 sm:w-52" style={{ marginBottom: isTouch && hud.humans === 1 ? '0px' : undefined }}>
        <div className="mb-0.5 flex justify-between font-display text-[10px] font-extrabold uppercase tracking-widest"><span className={full ? 'text-yellow-300' : 'text-slate-300'}>{full ? 'SUPER READY · SPACE' : 'Super'}</span></div>
        <div className={cn('h-2.5 overflow-hidden rounded-full bg-black/55 ring-1 ring-white/20', full && 'meter-full')}>
          <div className={cn('h-full rounded-full transition-[width] duration-150', full ? 'bg-gradient-to-r from-yellow-300 to-pink-500' : 'bg-gradient-to-r from-cyan-400 to-blue-500')} style={{ width: `${meter}%` }} />
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/45"><div className="h-full rounded-full bg-lime-300/90 transition-[width] duration-150" style={{ width: `${(hud.stamina[i] ?? 1) * 100}%` }} /></div>
      </div>
      {hud.time < 9 && !isTouch && hud.phase !== 'over' && (
        <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-3 z-10 hidden max-w-[260px] rounded-lg bg-black/50 px-3 py-2 text-xs leading-snug text-slate-100 sm:block" style={{ animation: 'hintFade 9s forwards' }}>
          {hud.humans === 2 && i === 1 ? <><b>Arrows</b> move · <b>Num1</b> clear · <b>Num2</b> drop · <b>Num3/4</b> side · <b>R-Shift</b> jump/smash · <b>Enter</b> sprint</> : <><b>WASD</b> move · <b>1</b> clear · <b>2</b> drop · <b>3/4</b> side shots · <b>Space</b> jump-smash · <b>Shift</b> sprint · press when the ring turns <b className="text-yellow-300">gold</b></>}
        </div>
      )}
    </div>
  );
}

function TouchControls() {
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const knob = useRef<HTMLDivElement>(null);
  const sprintHeld = useRef(false);
  const R = 56;
  const move = (e: React.PointerEvent) => {
    const o = origin.current; if (!o || e.pointerId !== o.id) return;
    let dx = e.clientX - o.x, dy = e.clientY - o.y;
    const m = Math.hypot(dx, dy);
    if (m > R) { dx = (dx / m) * R; dy = (dy / m) * R; }
    touchState.mx = dx / R; touchState.my = -dy / R; touchState.active = true;
    touchState.sprint = sprintHeld.current || Math.hypot(touchState.mx, touchState.my) > 0.93;
    if (knob.current) knob.current.style.transform = `translate(${dx}px,${dy}px)`;
  };
  const end = () => {
    origin.current = null; touchState.mx = 0; touchState.my = 0; touchState.sprint = sprintHeld.current;
    if (knob.current) knob.current.style.transform = 'translate(0,0)';
  };
  const btn = (label: string, sub: string, shot: number, cls: string) => (
    <button key={label}
      onPointerDown={(e) => { e.preventDefault(); touchState.active = true; touchState.shot = shot; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
      className={cn('pointer-events-auto grid h-14 w-14 select-none place-items-center rounded-full border-2 font-display text-[11px] font-black leading-tight text-white shadow-lg active:scale-90 sm:h-16 sm:w-16', cls)} style={{ touchAction: 'none' }}>
      <span>{label}<br /><span className="text-[8px] opacity-80">{sub}</span></span>
    </button>
  );
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div className="pointer-events-auto absolute bottom-0 left-0 h-[55%] w-[46%]" style={{ touchAction: 'none' }}
        onPointerDown={(e) => { origin.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); move(e); }}
        onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        <div className="absolute bottom-10 left-8 grid h-32 w-32 place-items-center rounded-full border-2 border-white/25 bg-white/5 sm:h-36 sm:w-36">
          <div ref={knob} className="h-14 w-14 rounded-full border-2 border-cyan-300/80 bg-cyan-400/30 shadow-[0_0_16px_rgba(46,230,255,.6)]" />
        </div>
      </div>
      <div className="absolute bottom-6 right-3 grid grid-cols-3 items-end gap-2 sm:right-6">
        {btn('◀', '4', 4, 'border-orange-300/70 bg-orange-500/40')}
        {btn('CLEAR', '1', 1, 'border-cyan-300/70 bg-cyan-500/40')}
        {btn('▶', '3', 3, 'border-orange-300/70 bg-orange-500/40')}
        <button onPointerDown={(e) => { e.preventDefault(); sprintHeld.current = true; touchState.sprint = true; touchState.active = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
          onPointerUp={() => { sprintHeld.current = false; touchState.sprint = false; }} onPointerCancel={() => { sprintHeld.current = false; touchState.sprint = false; }}
          className="pointer-events-auto grid h-14 w-14 select-none place-items-center rounded-full border-2 border-lime-300/70 bg-lime-500/30 font-display text-[10px] font-black text-white active:scale-90 sm:h-16 sm:w-16" style={{ touchAction: 'none' }}>RUN</button>
        {btn('DROP', '2', 2, 'border-blue-300/70 bg-blue-500/40')}
        <button onPointerDown={(e) => { e.preventDefault(); touchState.active = true; touchState.jump = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
          className="pointer-events-auto grid h-16 w-16 select-none place-items-center rounded-full border-2 border-pink-300/80 bg-pink-500/50 font-display text-[11px] font-black leading-tight text-white shadow-[0_0_18px_rgba(255,61,154,.6)] active:scale-90 sm:h-[72px] sm:w-[72px]" style={{ touchAction: 'none' }}>JUMP<br />SMASH</button>
      </div>
    </div>
  );
}

export function Hud() {
  const hud = useUI((s) => s.hud);
  const launch = useUI((s) => s.launch);
  const paused = useUI((s) => s.paused);
  const setPaused = useUI((s) => s.setPaused);
  const isTouch = useUI((s) => s.isTouch);
  const { settings, setSettings, quitToMenu, engine } = useUI();
  const humans = Math.max(1, launch?.humans ?? 1);
  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      <div className={cn('absolute inset-0 flex', humans > 1 ? 'flex-col [@media(min-aspect-ratio:1/1)]:flex-row' : '')}>
        {Array.from({ length: humans }).map((_, i) => <Viewport key={i} i={i} />)}
      </div>
      {humans > 1 && <div className="absolute left-0 top-1/2 h-[2px] w-full bg-cyan-300/40 [@media(min-aspect-ratio:1/1)]:left-1/2 [@media(min-aspect-ratio:1/1)]:top-0 [@media(min-aspect-ratio:1/1)]:h-full [@media(min-aspect-ratio:1/1)]:w-[2px]" />}
      {hud && <Scoreboard />}
      {hud && (hud.msg || hud.sub) && (
        <div className="absolute inset-x-0 top-[34%] z-20 flex flex-col items-center text-center">
          {hud.msg && <div key={hud.msg} className="anim-pop font-display text-3xl font-black uppercase italic text-white drop-shadow-[0_0_18px_rgba(46,230,255,.9)] sm:text-6xl">{hud.msg}</div>}
          {hud.sub && <div className="mt-2 rounded-lg bg-black/45 px-3 py-1 text-sm font-bold uppercase tracking-wider text-cyan-100 sm:text-lg">{hud.sub}</div>}
        </div>
      )}
      {hud?.drill?.msg && <div key={hud.drill.msg + hud.drill.score} className="anim-pop absolute inset-x-0 top-[30%] z-20 text-center font-display text-2xl font-black uppercase italic text-yellow-300 drop-shadow-[0_0_14px_rgba(255,210,63,.8)] sm:text-4xl">{hud.drill.msg}</div>}
      {isTouch && !paused && humans >= 1 && launch && <TouchControls />}
      <button onClick={() => setPaused(true)} className="pointer-events-auto absolute right-2 top-[max(0.5rem,env(safe-area-inset-top))] z-40 grid h-10 w-10 place-items-center rounded-xl border border-white/25 bg-black/50 text-lg text-white active:scale-90" aria-label="Pause"><span className="flex gap-1"><i className="block h-4 w-1.5 rounded bg-white" /><i className="block h-4 w-1.5 rounded bg-white" /></span></button>
      {paused && (
        <div className="pointer-events-auto absolute inset-0 z-50 grid place-items-center bg-black/65 backdrop-blur-sm anim-fade">
          <div className="glass w-[min(92vw,420px)] rounded-3xl p-6 text-center">
            <h2 className="font-display text-3xl font-black uppercase italic text-white glow-text">Paused</h2>
            <div className="mt-4 flex flex-col gap-2.5">
              <Btn big onClick={() => setPaused(false)}>▶ Resume</Btn>
              <Btn variant="hot" onClick={() => { setPaused(false); engine?.restart(); }}>↻ Restart (R)</Btn>
              <Btn variant="ghost" onClick={() => { setPaused(false); quitToMenu(); }}>Quit to menu</Btn>
            </div>
            <div className="mt-5 text-left">
              <Slider label="Master" value={settings.master} onChange={(v) => setSettings({ master: v })} />
              <Slider label="Music" value={settings.music} onChange={(v) => setSettings({ music: v })} />
              <Slider label="Effects" value={settings.sfx} onChange={(v) => setSettings({ sfx: v })} />
            </div>
            <p className="text-xs text-slate-400">Esc / P resume · R restart · C camera (P2: O)</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Results ----------------
export function ResultsScreen() {
  const r = useUI((s) => s.result);
  const { go, engine, tournament } = useUI();
  if (!r) return null;
  const drill = r.kind === 'drill';
  const versus = r.label.startsWith('Local 2-Player');
  let head: string;
  if (drill) head = r.success === undefined ? 'Session complete' : r.success ? 'Challenge complete!' : 'Challenge failed';
  else if (versus) head = `${r.names[r.winner]} wins!`;
  else head = r.humanWon ? 'Victory!' : 'Defeat';
  const good = drill ? r.success !== false : versus || r.humanWon;
  const tile = (k: string, v: string | number) => <div className="glass rounded-xl p-3 text-center"><div className="font-display text-xl font-black text-white sm:text-2xl">{v}</div><div className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">{k}</div></div>;
  const ctx = r.context;
  const cont = () => {
    if (ctx?.type === 'tournament') go(tournament && tournament.champion === tournament.humanIdx ? 'trophy' : 'bracket');
    else if (ctx?.type === 'championship') go(r.humanWon && ctx.stage === STAGES.length - 1 ? 'trophy' : 'championship');
  };
  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-b from-[#04050d]/85 to-[#070b1f]/95 anim-fade">
      {good && <Confetti />}
      <div className="scroll-y mx-auto flex h-full max-w-3xl flex-col items-center px-4 py-6">
        <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.35em] text-cyan-300">{r.label}</div>
        <h2 className={cn('anim-pop mt-1 text-center font-display text-4xl font-black uppercase italic sm:text-6xl', good ? 'text-yellow-300 drop-shadow-[0_0_20px_rgba(255,210,63,.8)]' : 'text-red-300 drop-shadow-[0_0_20px_rgba(255,80,80,.6)]')}>{head}</h2>
        {!drill && (
          <>
            <div className="mt-3 flex items-center gap-4 font-display text-5xl font-black text-white sm:text-7xl"><span>{r.final[0]}</span><span className="text-cyan-300">–</span><span>{r.final[1]}</span></div>
            <div className="mt-1 text-center text-sm text-slate-300">{r.names[0]} vs {r.names[1]}{r.games.length > 1 ? ` · Games: ${r.games.map((g) => `${g[0]}-${g[1]}`).join(', ')}` : ''}</div>
          </>
        )}
        {drill && r.drill && <div className="mt-3 font-display text-5xl font-black text-white sm:text-7xl">{r.drill.score}</div>}
        <div className="mt-5 grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
          {tile('Duration', fmtTime(r.duration))}
          {!drill && tile('Rallies', r.rallies)}
          {tile('Longest rally / streak', r.longest)}
          {!drill && tile('Smash points', `${r.smashPoints[0]} – ${r.smashPoints[1]}`)}
          {tile('Perfect hits', drill ? r.perfect[0] : `${r.perfect[0]} – ${r.perfect[1]}`)}
          {tile('Shot accuracy', drill ? `${r.accuracy[0]}%` : `${r.accuracy[0]}% – ${r.accuracy[1]}%`)}
          {drill && r.drill && tile('Returns', r.drill.returns)}
          {drill && r.drill && tile('Target zones', r.drill.zoneHits)}
          {drill && r.drill && tile('Misses', r.drill.misses)}
        </div>
        {r.score > 0 && (
          <div className="mt-5 w-full text-center">
            <div className="font-display text-2xl font-black text-cyan-200">Score {r.score.toLocaleString()}</div>
            {r.newHigh && <div className="anim-pop mt-1 inline-block rounded-full bg-yellow-300 px-4 py-1 font-display text-sm font-black uppercase text-slate-900">New high score · rank #{r.rank}</div>}
          </div>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Btn variant="gold" big onClick={() => engine?.restart()}>↻ Rematch (R)</Btn>
          {ctx && <Btn big onClick={cont}>Continue ▶</Btn>}
          <Btn variant="ghost" big onClick={() => useUI.getState().quitToMenu()}>Menu</Btn>
        </div>
        <div className="mt-6 w-full"><div className="mb-2 font-display text-xs font-extrabold uppercase tracking-[0.3em] text-yellow-300">Local high scores</div><ScoresTable limit={5} /></div>
      </div>
    </div>
  );
}
