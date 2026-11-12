import { useEffect, useRef, useState } from 'react';
import { DIFFICULTIES } from '../game/constants';
import { input } from '../game/input';
import type { Sim, SimEvent } from '../game/sim';
import { CAM_NAMES, type GameView } from '../game/view/gameView';
import { Btn } from './kit';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const teamName = (sim: Sim, t: number) =>
  sim
    .teamPlayers(t)
    .map((p) => p.spec.name)
    .join(' / ');

interface Popup {
  id: number;
  vp: number; // -1 = global
  text: string;
  sub?: string;
  color: string;
  size: 'sm' | 'md' | 'lg';
}
const GRADE_TEXT = ['POOR', 'NORMAL', 'GOOD', 'PERFECT!'];
const GRADE_CSS = ['#ff7a7a', '#ffffff', '#6aff8a', '#5af0ff'];

export function Hud({ view, sim, rects, bus, touch, onPause }: { view: GameView; sim: Sim; rects: Rect[]; bus: Set<(e: SimEvent) => void>; touch: boolean; onPause: () => void }) {
  const [, setTick] = useState(0);
  const [popups, setPopups] = useState<Popup[]>([]);
  const idRef = useRef(1);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 100);
    return () => clearInterval(iv);
  }, []);
  const humans = sim.humans().sort((a, b) => a.spec.human - b.spec.human);
  useEffect(() => {
    const add = (p: Omit<Popup, 'id'>, ttl = 1300) => {
      const id = idRef.current++;
      setPopups((l) => [...l.filter((x) => !(x.vp === p.vp && x.size === p.size)).slice(-6), { ...p, id }]);
      setTimeout(() => setPopups((l) => l.filter((x) => x.id !== id)), ttl);
    };
    const fn = (e: SimEvent) => {
      if (e.type === 'hit' && e.p && e.p.human) {
        const vp = humans.indexOf(e.p);
        if (e.label === 'machine') return;
        const g = e.grade ?? 1;
        if (e.special) add({ vp, text: e.special, sub: GRADE_TEXT[g], color: '#ffd23f', size: 'lg' }, 1600);
        else add({ vp, text: GRADE_TEXT[g], sub: e.label, color: GRADE_CSS[g], size: g === 3 ? 'md' : 'sm' }, 1000);
      } else if (e.type === 'super') {
        humans.forEach((h, i) => h.team === e.team && add({ vp: i, text: 'SUPER READY', sub: 'Press SPECIAL', color: '#ffd23f', size: 'md' }, 1800));
      } else if (e.type === 'point') {
        add({ vp: -1, text: e.text ?? '', sub: sim.cfg.mode === 'demo' ? undefined : `${teamName(sim, e.team ?? 0)}`, color: e.reason === 'ace' ? '#ffd23f' : '#fff', size: 'lg' }, 1900);
      } else if (e.type === 'fault' || e.type === 'let') {
        add({ vp: -1, text: e.text ?? 'FAULT', color: '#ff7a7a', size: 'lg' }, 1300);
      } else if (e.type === 'drill' && e.text) {
        add({ vp: 0, text: e.text, color: '#c6ff3a', size: 'md' }, 1000);
      }
    };
    bus.add(fn);
    return () => {
      bus.delete(fn);
    };
  }, [bus, sim]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = sim.score;
  const labels = sim.labels();
  const drill = sim.drill;
  const isDemo = sim.cfg.mode === 'demo';
  const serverTeam = s.server;
  const intro = sim.elapsedReal < 3.2 && !isDemo;

  const scoreboard = !drill && (
    <div className="absolute left-1/2 top-2 -translate-x-1/2 z-20 pointer-events-none" style={{ minWidth: 230 }}>
      <div className="rounded-xl overflow-hidden border border-white/20 shadow-2xl" style={{ background: 'rgba(6,9,28,.88)', backdropFilter: 'blur(6px)' }}>
        {[0, 1].map((t) => (
          <div key={t} className="flex items-center gap-2 px-3 py-1" style={{ borderTop: t ? '1px solid rgba(255,255,255,.1)' : 'none', background: t === 0 ? 'linear-gradient(90deg,rgba(90,200,255,.22),transparent)' : 'linear-gradient(90deg,rgba(255,122,90,.22),transparent)' }}>
            <span className="w-2.5 text-xs" style={{ color: '#c6ff3a', textShadow: '0 0 8px #c6ff3a' }}>{serverTeam === t ? '●' : ''}</span>
            <span className="flex-1 font-extrabold text-[13px] max-w-[170px] truncate">{teamName(sim, t)}</span>
            {s.sets.map((st, i) => (
              <span key={i} className="w-5 text-center text-sm opacity-70">{st[t]}</span>
            ))}
            <span className="w-6 text-center text-lg font-black" style={{ color: '#4de1ff' }}>{s.games[t]}</span>
            <span className="w-9 text-center text-lg font-black rounded" style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }}>{labels[t]}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-3 mt-1 text-[11px] font-bold opacity-90" style={{ textShadow: '0 1px 3px #000' }}>
        <span>⏱ {mmss(sim.time)}</span>
        {s.tb && <span style={{ color: '#ff3ea5' }}>TIE-BREAK</span>}
        {sim.serveNum === 2 && <span style={{ color: '#ffd23f' }}>2ND SERVE</span>}
        {sim.rallyHits > 3 && sim.phase === 'rally' && <span style={{ color: '#c6ff3a' }}>RALLY {sim.rallyHits}</span>}
      </div>
    </div>
  );

  return (
    <div className="absolute inset-0 pointer-events-none z-10" style={{ fontFamily: 'inherit' }}>
      {scoreboard}
      {drill && (
        <div className="absolute left-1/2 top-2 -translate-x-1/2 z-20 rounded-xl px-4 py-2 border border-white/20 text-center" style={{ background: 'rgba(6,9,28,.88)' }}>
          <div className="title-font text-xs opacity-70">{sim.cfg.label} · {sim.cfg.drill}</div>
          <div className="flex gap-4 items-baseline justify-center">
            <span className="title-font text-3xl" style={{ color: '#c6ff3a' }}>{drill.score}</span>
            {isFinite(drill.timeLeft) && <span className="text-xl font-black" style={{ color: drill.timeLeft < 10 ? '#ff7a7a' : '#fff' }}>{mmss(drill.timeLeft)}</span>}
            {drill.maxFeeds > 0 && <span className="text-sm font-bold">{Math.min(drill.feeds, drill.maxFeeds)}/{drill.maxFeeds}</span>}
          </div>
          <div className="text-[11px] opacity-80 flex gap-3 justify-center">
            <span>Streak {drill.streak}</span>
            <span>Best {drill.best}</span>
            <span>Hits {drill.hits}</span>
            {drill.type === 'perfect' && <span>Perfects {drill.perfects}</span>}
            {drill.misses > 0 && <span>Miss {drill.misses}</span>}
          </div>
        </div>
      )}
      <button className="pointer-events-auto absolute right-2 top-2 z-30 chip" onClick={onPause} aria-label="Pause">
        ⏸
      </button>

      {rects.map((r, i) => {
        const p = humans[i];
        if (!p) return null;
        const serving = (sim.phase === 'serve' || sim.phase === 'toss') && sim.server === p && !drill?.type?.startsWith('mov');
        const mine = popups.filter((x) => x.vp === i);
        const meter = sim.meter[p.team];
        const keys = p.spec.human === 1 && humans.length > 1 ? 'Num 1-4' : '1-4';
        return (
          <div key={i} className="absolute overflow-hidden" style={{ left: r.x, top: r.y, width: r.w, height: r.h }}>
            <div className="absolute top-2 flex flex-col gap-1.5" style={{ width: Math.min(190, r.w * 0.4), marginTop: humans.length === 1 ? 4 : 0, ...(r.x > 0 ? { right: 52 } : { left: 8 }) }}>
              {humans.length > 1 && (
                <div className="title-font text-sm" style={{ color: p.team === 0 ? '#5ac8ff' : '#ff9a7a', textShadow: '0 2px 4px #000' }}>
                  P{p.spec.human + 1} · {p.spec.name}
                </div>
              )}
              <div className="mt-8 sm:mt-10" />
              <Meter label="STAMINA" value={p.stamina} color={p.exhausted ? '#ff5a5a' : '#6aff8a'} />
              {!drill && <Meter label={meter >= 1 ? 'SUPER READY' : 'SUPER RALLY'} value={meter} color="#ffd23f" glow={meter >= 1} />}
              <div className="text-[10px] opacity-70" style={{ textShadow: '0 1px 2px #000' }}>Cam: {CAM_NAMES[view.getCamMode(i)]}</div>
            </div>
            {/* popups */}
            <div className="absolute inset-x-0 flex flex-col items-center gap-1" style={{ top: '30%' }}>
              {mine.map((pp) => (
                <div key={pp.id} className="pop text-center" style={{ color: pp.color }}>
                  <div className="title-font" style={{ fontSize: pp.size === 'lg' ? 34 : pp.size === 'md' ? 26 : 18, textShadow: '0 3px 10px rgba(0,0,0,.8), 0 0 18px ' + pp.color }}>{pp.text}</div>
                  {pp.sub && <div className="text-xs font-bold opacity-90" style={{ textShadow: '0 1px 4px #000' }}>{pp.sub}</div>}
                </div>
              ))}
            </div>
            {/* serve hint */}
            {serving && view.settings.hints && !sim.players.some((q) => q.swing) && (
              <div className="absolute inset-x-0 text-center fade-up" style={{ bottom: touch ? '30%' : 56 }}>
                <span className="inline-block rounded-full px-4 py-1.5 text-sm font-extrabold" style={{ background: 'rgba(6,9,28,.8)', border: '1px solid #c6ff3a', color: '#c6ff3a' }}>
                  {sim.phase === 'serve' ? (touch ? 'TAP a shot button to toss' : `YOUR SERVE — press ${keys} to toss`) : 'Press again as the ring closes!'}
                </span>
                <div className="text-[11px] opacity-80 mt-1" style={{ textShadow: '0 1px 3px #000' }}>1 power · 2 kick · 3/4 slice · move to aim</div>
              </div>
            )}
          </div>
        );
      })}

      {/* global banners */}
      <div className="absolute inset-x-0 flex flex-col items-center" style={{ top: '14%' }}>
        {popups
          .filter((x) => x.vp === -1)
          .map((pp) => (
            <div key={pp.id} className="banner text-center" style={{ color: pp.color }}>
              <div className="title-font" style={{ fontSize: 'clamp(30px,6vw,64px)', textShadow: '0 5px 0 rgba(0,0,0,.4), 0 0 30px rgba(198,255,58,.5)' }}>{pp.text}</div>
              {pp.sub && <div className="text-sm font-extrabold" style={{ color: '#4de1ff' }}>{pp.sub}</div>}
            </div>
          ))}
      </div>
      {intro && view.settings.hints && (
        <div className="absolute inset-x-0 text-center fade-up" style={{ top: touch ? '20%' : '38%' }}>
          <div className="title-font text-3xl sm:text-5xl shimmer-text">Get Ready!</div>
          <div className="text-sm font-bold opacity-90 mt-1">{sim.cfg.label}{sim.cfg.mode === 'solo' || sim.cfg.mode === 'quick' ? ` · ${DIFFICULTIES[(sim.cfg.teams[1][0]?.level ?? 3) - 1]} AI` : ''}</div>
        </div>
      )}
      {sim.phase === 'rally' && sim.rallyHits === 0 && false}
    </div>
  );
}

function Meter({ label, value, color, glow }: { label: string; value: number; color: string; glow?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-extrabold tracking-widest" style={{ color, textShadow: '0 1px 3px #000' }}>{label}</div>
      <div className={`h-2.5 rounded-full overflow-hidden border border-white/30 ${glow ? 'meter-full' : ''}`} style={{ background: 'rgba(0,0,0,.5)' }}>
        <div className="h-full rounded-full" style={{ width: `${Math.round(value * 100)}%`, background: color, transition: 'width .1s linear' }} />
      </div>
    </div>
  );
}

export function PauseMenu({ onResume, onRestart, onQuit, onFinish, view, isDrill }: { onResume: () => void; onRestart: () => void; onQuit: () => void; onFinish?: () => void; view: GameView; isDrill: boolean }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55" style={{ backdropFilter: 'blur(4px)' }}>
      <div className="glass w-[min(92vw,380px)] p-5 fade-up">
        <div className="title-font text-3xl shimmer-text mb-1">Paused</div>
        <div className="text-xs opacity-70 mb-4">{view.sim?.cfg.label}</div>
        <div className="flex flex-col gap-2">
          <Btn primary onClick={onResume} icon="▶">Resume</Btn>
          <Btn onClick={onRestart} icon="🔄" sub="Instant restart (R)">Restart</Btn>
          {isDrill && onFinish && <Btn onClick={onFinish} icon="🏁" sub="End session and save score">Finish session</Btn>}
          <Btn onClick={onQuit} icon="🏠">Quit to menu</Btn>
        </div>
        <div className="text-[11px] opacity-60 mt-4 leading-relaxed">P1: WASD · 1-4 shots · Space special · Shift sprint · C camera<br />P2: Arrows · Num1-4 · R-Shift special · Enter sprint · O camera</div>
      </div>
    </div>
  );
}

export interface ResultData {
  won: boolean;
  humanTeams: number[];
  title: string;
  score: number;
  rank: number;
  newBest: boolean;
}
export function Results({ sim, data, onRematch, onMenu, onContinue, continueLabel, noRematch }: { sim: Sim; data: ResultData; onRematch: () => void; onMenu: () => void; onContinue?: () => void; continueLabel?: string; noRematch?: boolean }) {
  const drill = sim.drill;
  const st = sim.stats;
  const w = sim.playerWinner;
  const avg = sim.rallies.length ? (sim.rallies.reduce((a, b) => a + b, 0) / sim.rallies.length).toFixed(1) : '0';
  const rows: [string, string | number, string | number][] = [
    ['Points won', st[0].points, st[1].points],
    ['Aces', st[0].aces, st[1].aces],
    ['Winners', st[0].winners, st[1].winners],
    ['Unforced errors', st[0].ue, st[1].ue],
    ['Double faults', st[0].df, st[1].df],
    ['Perfect hits', st[0].perfects, st[1].perfects],
    ['Shots', st[0].hits, st[1].hits],
  ];
  const sets = sim.score.sets.map((x) => `${x[0]}-${x[1]}`).join('   ');
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-3 bg-black/45" style={{ backdropFilter: 'blur(3px)' }}>
      <div className="glass w-[min(96vw,560px)] max-h-[96vh] scroll p-5 fade-up">
        <div className="text-center">
          <div className="title-font text-4xl sm:text-5xl" style={{ color: data.won ? '#c6ff3a' : '#ff7a7a', textShadow: '0 0 30px currentColor' }}>{data.title}</div>
          {!drill && (
            <>
              <div className="text-lg font-bold mt-1">{teamName(sim, w)} wins</div>
              <div className="title-font text-3xl mt-1">{sets}</div>
              <div className="text-xs opacity-70">Match time {mmss(sim.time)} · Longest rally {sim.maxRally} · Avg rally {avg}</div>
            </>
          )}
        </div>
        {drill ? (
          <div className="grid grid-cols-2 gap-2 my-4 text-center">
            {[
              ['Score', drill.score],
              ['Returns', drill.hits],
              ['Perfect hits', drill.perfects],
              ['Best streak', drill.best],
              ['Misses', drill.misses],
              [drill.type === 'accuracy' ? 'Avg accuracy' : 'Time', drill.type === 'accuracy' ? (drill.accN ? Math.round(drill.accSum / drill.accN) + '%' : '—') : mmss(sim.time)],
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded-xl bg-white/5 border border-white/10 p-2">
                <div className="text-[10px] uppercase tracking-widest opacity-60">{k}</div>
                <div className="title-font text-2xl">{v}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="my-4 rounded-xl border border-white/10 overflow-hidden text-sm">
            <div className="grid grid-cols-[1fr_70px_70px] bg-white/10 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-widest">
              <div></div><div className="text-center truncate" style={{ color: '#5ac8ff' }}>{sim.teamPlayers(0)[0]?.spec.name.slice(0, 8)}</div><div className="text-center truncate" style={{ color: '#ff9a7a' }}>{sim.teamPlayers(1)[0]?.spec.name.slice(0, 8)}</div>
            </div>
            {rows.map(([k, a, b]) => (
              <div key={k} className="grid grid-cols-[1fr_70px_70px] px-3 py-1.5 border-t border-white/5">
                <div className="opacity-80">{k}</div>
                <div className="text-center font-black">{a}</div>
                <div className="text-center font-black">{b}</div>
              </div>
            ))}
          </div>
        )}
        {data.humanTeams.length > 0 && data.score > 0 && (
          <div className="text-center mb-4 rounded-xl p-3" style={{ background: 'linear-gradient(90deg, rgba(255,210,63,.18), rgba(255,255,255,.04))', border: '1px solid rgba(255,210,63,.4)' }}>
            <div className="text-[11px] uppercase tracking-widest opacity-70">Arcade score</div>
            <div className="title-font text-4xl" style={{ color: '#ffd23f' }}>{data.score.toLocaleString()}</div>
            <div className="text-xs font-bold" style={{ color: data.rank >= 0 && data.rank < 10 ? '#c6ff3a' : '#fff' }}>
              {data.rank === 0 ? '🏆 NEW #1 HIGH SCORE!' : data.rank >= 0 && data.rank < 10 ? `New high score — rank #${data.rank + 1}` : 'Saved to local table'}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {onContinue && <Btn primary onClick={onContinue} icon="➡">{continueLabel ?? 'Continue'}</Btn>}
          {!noRematch && <Btn primary={!onContinue} onClick={onRematch} icon="🔄" sub="Press R or Enter">{drill ? 'Play again' : 'Rematch'}</Btn>}
          <Btn onClick={onMenu} icon="🏠">Main menu</Btn>
        </div>
      </div>
    </div>
  );
}

export function TouchControls() {
  const base = useRef<{ x: number; y: number; id: number } | null>(null);
  const [knob, setKnob] = useState<{ bx: number; by: number; dx: number; dy: number } | null>(null);
  const R = 56;
  useEffect(() => {
    input.touch.enabled = true;
    return () => {
      input.touch.enabled = false;
      input.touch.mx = input.touch.mz = 0;
      input.touch.sprint = false;
    };
  }, []);
  const down = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    base.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    setKnob({ bx: e.clientX, by: e.clientY, dx: 0, dy: 0 });
  };
  const move = (e: React.PointerEvent) => {
    const b = base.current;
    if (!b || b.id !== e.pointerId) return;
    let dx = e.clientX - b.x;
    let dy = e.clientY - b.y;
    const l = Math.hypot(dx, dy);
    if (l > R) {
      dx = (dx / l) * R;
      dy = (dy / l) * R;
    }
    input.touch.mx = dx / R;
    input.touch.mz = -dy / R;
    setKnob({ bx: b.x, by: b.y, dx, dy });
  };
  const up = (e: React.PointerEvent) => {
    if (base.current?.id !== e.pointerId) return;
    base.current = null;
    input.touch.mx = input.touch.mz = 0;
    setKnob(null);
  };
  const btn = (label: string, sub: string, onDown: () => void, onUp?: () => void, color = 'rgba(255,255,255,.18)') => (
    <button
      className="rounded-full font-black text-white flex flex-col items-center justify-center active:scale-90 transition-transform"
      style={{ width: 64, height: 64, background: color, border: '2px solid rgba(255,255,255,.55)', backdropFilter: 'blur(4px)', touchAction: 'none', fontSize: 18, lineHeight: 1 }}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        onDown();
      }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
      <span style={{ fontSize: 9, opacity: 0.85, fontWeight: 700 }}>{sub}</span>
    </button>
  );
  return (
    <div className="absolute inset-0 z-20 pointer-events-none" style={{ touchAction: 'none' }}>
      <div className="absolute left-0 bottom-0 pointer-events-auto" style={{ width: '48%', height: '58%', touchAction: 'none' }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {!knob && <div className="absolute left-8 bottom-8 rounded-full border-2 border-white/30 flex items-center justify-center text-[10px] font-bold opacity-70" style={{ width: 112, height: 112 }}>MOVE</div>}
      </div>
      {knob && (
        <div className="fixed pointer-events-none" style={{ left: knob.bx - R, top: knob.by - R, width: R * 2, height: R * 2, borderRadius: '50%', border: '2px solid rgba(255,255,255,.4)', background: 'rgba(255,255,255,.08)' }}>
          <div className="absolute rounded-full" style={{ width: 52, height: 52, left: R - 26 + knob.dx, top: R - 26 + knob.dy, background: 'rgba(198,255,58,.8)', boxShadow: '0 0 18px #c6ff3a' }} />
        </div>
      )}
      <div className="absolute right-2 bottom-3 pointer-events-auto grid grid-cols-3 gap-2" style={{ touchAction: 'none' }}>
        {btn('◀', 'SHORT', () => (input.touch.shot = 4))}
        {btn('2', 'SHORT', () => (input.touch.shot = 2))}
        {btn('▶', 'SHORT', () => (input.touch.shot = 3))}
        {btn('SPRINT', 'hold', () => (input.touch.sprint = true), () => (input.touch.sprint = false), 'rgba(77,225,255,.3)')}
        {btn('1', 'LONG', () => (input.touch.shot = 1), undefined, 'rgba(198,255,58,.35)')}
        {btn('★', 'SPECIAL', () => (input.touch.special = true), undefined, 'rgba(255,210,63,.4)')}
      </div>
    </div>
  );
}
