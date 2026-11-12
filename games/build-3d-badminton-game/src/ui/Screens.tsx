import { useEffect, useState } from 'react';
import { ARENA_LIST, DIFF, Difficulty } from '../game/constants';
import { audio } from '../game/audio';
import { input } from '../game/input';
import {
  DRILLS, MODE_INFO, ModeId, ROUND_NAMES, STAGES, buildDrill, buildLaunch, humanMatch, stageLaunch, tournamentLaunch,
} from '../game/modes';
import { RULE_PRESETS } from '../game/rules';
import { COLORS, DEFAULT_PADMAP, OUTFITS, RACKETS, TRAILS, store as db } from '../game/storage';
import { useUI } from '../game/store';
import { cn } from '../utils/cn';
import { ARENA_GRAD, Btn, Chip, Confetti, Panel, Shell, Slider, fmtTime } from './ui';

// ---------------- Start ----------------
export function StartScreen() {
  const { go, startGame, looks, settings, scores } = useUI();
  const playNow = () => {
    audio.init(); audio.apply(settings); audio.startMusic(220);
    const setup = { mode: 'solo' as ModeId, doubles: false, arena: 'neon' as const, preset: 'quick' as const, arcade: false, diff: 'medium' as Difficulty, drill: 'free' as const };
    startGame(buildLaunch(setup, looks, settings));
  };
  const top = scores.slice(0, 3);
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#04050d]/60 via-transparent to-[#04050d]/90 px-4 text-center anim-fade">
      <svg className="pointer-events-none absolute left-0 top-[18%] h-14 w-14" style={{ animation: 'shuttleFly 5.5s ease-in-out infinite' }} viewBox="0 0 40 40">
        <circle cx="20" cy="8" r="5" fill="#ffb3c7" />
        <path d="M12 12 L28 12 L33 36 L7 36 Z" fill="#fff" opacity=".92" />
        <path d="M20 12 V36 M15 12 L13 36 M25 12 L27 36" stroke="#9fb4d8" strokeWidth="1" />
      </svg>
      <div className="anim-float">
        <h1 className="font-display text-5xl font-black uppercase italic leading-none tracking-tight logo-main sm:text-7xl md:text-8xl">Badminton</h1>
        <h1 className="font-display text-5xl font-black uppercase italic leading-none tracking-tight logo-sub sm:text-7xl md:text-8xl">Masters</h1>
      </div>
      <p className="mt-4 max-w-md text-lg text-cyan-100/80 sm:text-xl">Real shuttle physics. Perfect-timing smashes. Singles, doubles, split-screen.</p>
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <Btn big variant="gold" onClick={playNow}>▶ Play Now</Btn>
        <Btn big variant="ghost" onClick={() => { audio.init(); audio.apply(settings); audio.startMusic(220); go('menu'); }}>Main Menu</Btn>
      </div>
      <p className="mt-5 text-sm text-slate-300/80">Move <b className="text-white">WASD</b> · Shots <b className="text-white">1 2 3 4</b> · Jump-smash <b className="text-white">Space</b> · Sprint <b className="text-white">Shift</b> &nbsp;|&nbsp; Touch & gamepad supported</p>
      {top.length > 0 && (
        <div className="glass mt-6 rounded-xl px-5 py-3 text-left">
          <div className="mb-1 font-display text-[10px] font-extrabold uppercase tracking-[0.3em] text-yellow-300">Top scores</div>
          {top.map((s, i) => (
            <div key={i} className="flex gap-6 text-sm"><span className="w-4 text-yellow-300">{i + 1}</span><span className="w-28 truncate">{s.name}</span><span className="font-display text-cyan-200">{s.score.toLocaleString()}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- Main menu ----------------
const MENU: { id: string; icon: string; title: string; blurb: string; accent: string }[] = [
  { id: 'quick', icon: '⚡', title: 'Quick Match', blurb: 'Singles or doubles, your arena, your rules', accent: 'from-cyan-400/30' },
  { id: 'versus', icon: '🎮', title: 'Local Multiplayer', blurb: '2 players · dynamic split-screen', accent: 'from-pink-500/30' },
  { id: 'solo', icon: '🤖', title: 'Play Against AI', blurb: 'Beginner to Expert opponents', accent: 'from-blue-500/30' },
  { id: 'coop', icon: '🤝', title: 'Doubles Co-op', blurb: 'You + a friend vs 2 smart bots', accent: 'from-lime-400/30' },
  { id: 'tournament', icon: '🏆', title: 'Tournaments', blurb: '8-player knockout, singles or doubles', accent: 'from-yellow-400/30' },
  { id: 'practice', icon: '🎯', title: 'Practice & Challenges', blurb: 'Drills, targets and time trials', accent: 'from-orange-400/30' },
  { id: 'championship', icon: '👑', title: 'Championship', blurb: '6 stages · unlock arenas · win the trophy', accent: 'from-fuchsia-500/30' },
  { id: 'customize', icon: '🎨', title: 'Customization', blurb: 'Colors, outfits, rackets, trails', accent: 'from-teal-400/30' },
  { id: 'stats', icon: '📊', title: 'Statistics', blurb: 'Your career numbers', accent: 'from-indigo-400/30' },
  { id: 'scores', icon: '🥇', title: 'High Scores', blurb: 'Local leaderboard', accent: 'from-yellow-300/30' },
  { id: 'settings', icon: '⚙️', title: 'Settings', blurb: 'Audio, gamepad, graphics', accent: 'from-slate-400/30' },
  { id: 'howto', icon: '❓', title: 'How to Play', blurb: 'Controls, shots and rules', accent: 'from-sky-400/30' },
];

export function MainMenu() {
  const { go, setSetup, newTournament } = useUI();
  const pick = (id: string) => {
    if (['quick', 'versus', 'solo', 'coop'].includes(id)) {
      const info = MODE_INFO[id as ModeId];
      setSetup({ mode: id as ModeId, doubles: !!info.fixedDouble, diff: info.diffs.includes('medium') ? 'medium' : info.diffs[0] });
      go('setup');
    } else if (id === 'tournament') { setSetup({ mode: 'tournament', doubles: false, diff: 'medium' }); go('setup'); }
    else if (id === 'practice') go('practice');
    else go(id as never);
    void newTournament;
  };
  return (
    <div className="absolute inset-0 flex flex-col items-center bg-gradient-to-r from-[#04050d]/85 via-[#070b1f]/55 to-[#04050d]/85 px-4 pt-[max(1rem,env(safe-area-inset-top))] anim-fade">
      <div className="mb-3 mt-1 text-center">
        <h1 className="font-display text-3xl font-black uppercase italic tracking-tight sm:text-5xl"><span className="logo-main">Badminton </span><span className="logo-sub">Masters</span></h1>
      </div>
      <div className="scroll-y min-h-0 w-full max-w-6xl flex-1 pb-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MENU.map((m, i) => (
            <button key={m.id} onClick={() => { audio.ui(); pick(m.id); }}
              style={{ animationDelay: `${i * 35}ms` }}
              className={cn('glass anim-pop group flex items-center gap-4 rounded-2xl bg-gradient-to-br to-transparent p-4 text-left transition hover:scale-[1.03] hover:border-cyan-300/60 active:scale-95', m.accent)}>
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-black/30 text-3xl transition group-hover:rotate-6">{m.icon}</span>
              <span className="min-w-0">
                <span className="block font-display text-base font-extrabold uppercase tracking-wide text-white sm:text-lg">{m.title}</span>
                <span className="block text-sm text-slate-300">{m.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------- Setup ----------------
export function ArenaPicker({ value, onChange }: { value: string; onChange: (id: never) => void }) {
  const unlocked = useUI((s) => s.progress.unlocked);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {ARENA_LIST.map((a) => {
        const open = unlocked.includes(a.id);
        return (
          <button key={a.id} disabled={!open} onClick={() => { audio.ui(); onChange(a.id as never); }}
            className={cn('relative h-24 overflow-hidden rounded-xl border text-left transition active:scale-95', value === a.id ? 'border-cyan-300 shadow-[0_0_18px_rgba(46,230,255,.6)]' : 'border-white/15 hover:border-white/40', !open && 'opacity-60')}
            style={{ background: ARENA_GRAD[a.id] }}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
            <div className="absolute bottom-1.5 left-2.5 right-2 text-xs font-bold uppercase leading-tight text-white sm:text-sm">{a.name}</div>
            {!open && <div className="absolute inset-0 grid place-items-center bg-black/55 text-center text-xs font-bold text-yellow-200">🔒 Win Championship stages to unlock</div>}
            {value === a.id && <div className="absolute right-2 top-2 rounded bg-cyan-300 px-1.5 text-[10px] font-black text-slate-900">SELECTED</div>}
          </button>
        );
      })}
    </div>
  );
}

export function SetupScreen() {
  const { setup, setSetup, go, startGame, looks, settings, newTournament, progress } = useUI();
  const info = MODE_INFO[setup.mode];
  useEffect(() => { if (!progress.unlocked.includes(setup.arena)) setSetup({ arena: 'neon' }); }, [progress, setup.arena, setSetup]);
  const start = () => {
    if (setup.mode === 'tournament') { newTournament(); go('bracket'); return; }
    startGame(buildLaunch(setup, looks, settings));
  };
  const humans = setup.mode === 'versus' || setup.mode === 'coop' ? 2 : 1;
  return (
    <Shell title={info.title} sub={info.blurb} onBack={() => go('menu')}
      right={<Btn variant="gold" onClick={start}>{setup.mode === 'tournament' ? 'Create Bracket' : 'Start Match'} ▶</Btn>}>
      {info.canDouble && (
        <Panel title="Format">
          <div className="flex flex-wrap gap-2">
            <Chip active={!setup.doubles} onClick={() => setSetup({ doubles: false })}>Singles</Chip>
            <Chip active={setup.doubles} onClick={() => setSetup({ doubles: true })}>Doubles</Chip>
          </div>
          {setup.mode === 'versus' && setup.doubles && <p className="mt-2 text-sm text-slate-300">Each human gets an AI partner. Doubles uses the full-width court and rotating service courts.</p>}
        </Panel>
      )}
      {info.fixedDouble && <Panel title="Format"><p className="text-slate-200">Doubles · P1 (WASD) and P2 (Arrows) on one team, each with their own camera, versus two coordinated AI bots.</p></Panel>}
      {setup.mode !== 'versus' || setup.doubles ? (
        <Panel title={setup.mode === 'tournament' ? 'Field strength' : 'AI difficulty'}>
          <div className="flex flex-wrap gap-2">
            {info.diffs.map((d) => <Chip key={d} active={setup.diff === d} onClick={() => setSetup({ diff: d })}>{DIFF[d].label}</Chip>)}
          </div>
          <p className="mt-2 text-sm text-slate-300">Reaction {Math.round(DIFF[setup.diff].react * 1000)} ms · speed ×{DIFF[setup.diff].speed.toFixed(2)} · prediction error {DIFF[setup.diff].predErr} m</p>
        </Panel>
      ) : null}
      <Panel title="Arena"><ArenaPicker value={setup.arena} onChange={(id) => setSetup({ arena: id })} /></Panel>
      {setup.mode !== 'tournament' && (
        <Panel title="Scoring">
          <div className="flex flex-wrap gap-2">
            {Object.entries(RULE_PRESETS).map(([k, v]) => <Chip key={k} active={setup.preset === k} onClick={() => setSetup({ preset: k as never })}>{v.label}</Chip>)}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Chip active={!setup.arcade} onClick={() => setSetup({ arcade: false })}>Standard rules</Chip>
            <Chip active={setup.arcade} onClick={() => setSetup({ arcade: true })}>Arcade rules</Chip>
            <span className="text-sm text-slate-300">{setup.arcade ? 'Bigger reach, faster special meter, any-court serves, wider singles court.' : 'Win by 2, cap at the maximum, diagonal service courts, faults.'}</span>
          </div>
        </Panel>
      )}
      <Panel title="Controls">
        <p className="text-slate-200">{humans === 2 ? 'P1: WASD · 1-4 shots · Space jump/special · Shift sprint · C camera.  P2: Arrows · Numpad 1-4 · Right Shift special · Enter sprint · O camera.' : 'WASD move · 1 clear · 2 drop · 3/4 side shots · Space jump-smash/special · Shift sprint · C camera. Touch & gamepad auto-detected.'}</p>
      </Panel>
    </Shell>
  );
}

// ---------------- Practice & challenge ----------------
export function PracticeScreen() {
  const { go, setup, setSetup, startGame, looks, settings } = useUI();
  const [tab, setTab] = useState<'practice' | 'challenge'>('practice');
  const list = DRILLS.filter((d) => d.challenge === (tab === 'challenge'));
  const scores = useUI((s) => s.scores);
  return (
    <Shell title="Practice & Challenges" sub="No opponent — a feeder machine launches shuttles at you" onBack={() => go('menu')}>
      <div className="mb-4 flex gap-2">
        <Chip active={tab === 'practice'} onClick={() => setTab('practice')}>Practice drills</Chip>
        <Chip active={tab === 'challenge'} onClick={() => setTab('challenge')}>Time challenges</Chip>
      </div>
      <Panel title="Arena"><ArenaPicker value={setup.arena} onChange={(id) => setSetup({ arena: id })} /></Panel>
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((d) => {
          const best = scores.filter((s) => s.mode === d.title)[0];
          return (
            <div key={d.kind} className="glass flex items-center gap-3 rounded-2xl p-4">
              <div className="min-w-0 flex-1">
                <div className="font-display text-sm font-extrabold uppercase tracking-wide text-white">{d.title}</div>
                <div className="text-sm text-slate-300">{d.blurb}</div>
                {best && <div className="mt-1 text-xs text-yellow-300">Best: {best.score.toLocaleString()}</div>}
              </div>
              <Btn onClick={() => { const s = { ...setup, drill: d.kind, mode: (d.challenge ? 'challenge' : 'practice') as ModeId }; startGame(buildDrill(s, looks, settings)); }}>Start</Btn>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

// ---------------- Tournament bracket ----------------
export function BracketScreen() {
  const { tournament: t, go, startGame, settings, newTournament } = useUI();
  if (!t) { return <Shell title="Tournament" onBack={() => go('menu')}><p>No tournament in progress.</p></Shell>; }
  const hm = humanMatch(t);
  const name = (i: number) => t.entrants[i].name + (t.doubles ? ' & ' + (t.entrants[i].human ? 'Partner' : t.entrants[i].partner!.name) : '');
  const stageName = t.champion === -1 ? ROUND_NAMES[t.round] : 'Complete';
  return (
    <Shell title={`${t.doubles ? 'Doubles' : 'Singles'} Tournament`} sub={t.eliminated ? 'You were eliminated' : t.champion === t.humanIdx ? 'You are the champion!' : `Next: ${stageName}`} onBack={() => go('menu')} wide
      right={<div className="flex gap-2">
        {t.champion === t.humanIdx && <Btn variant="gold" onClick={() => go('trophy')}>🏆 Trophy</Btn>}
        {hm && <Btn variant="gold" onClick={() => startGame(tournamentLaunch(t, settings))}>Play {ROUND_NAMES[t.round]} ▶</Btn>}
        {(t.eliminated || t.champion !== -1) && <Btn onClick={() => { newTournament(); }}>New Bracket</Btn>}
      </div>}>
      <div className="flex gap-4 overflow-x-auto pb-3">
        {[0, 1, 2].map((r) => (
          <div key={r} className="flex min-w-[240px] flex-1 flex-col justify-around gap-3">
            <div className="text-center font-display text-xs font-extrabold uppercase tracking-[0.25em] text-cyan-300">{ROUND_NAMES[r]}</div>
            {(t.rounds[r] ?? Array.from({ length: 4 / 2 ** r }).map(() => null)).map((m, i) => (
              <div key={i} className={cn('glass rounded-xl p-3', m && (m.a === t.humanIdx || m.b === t.humanIdx) && 'border-cyan-300/70 shadow-[0_0_18px_rgba(46,230,255,.35)]')}>
                {m ? [m.a, m.b].map((idx) => (
                  <div key={idx} className={cn('flex items-center justify-between py-1 text-sm', m.winner === idx ? 'font-extrabold text-lime-300' : m.winner !== -1 ? 'text-slate-500 line-through' : 'text-slate-100')}>
                    <span className="truncate">{t.entrants[idx].human ? '★ ' : ''}{name(idx)}</span>
                    <span className="ml-2 text-xs text-slate-400">{'●'.repeat(Math.max(1, Math.round(t.entrants[idx].rating / 2)))}</span>
                  </div>
                )) : <div className="py-3 text-center text-sm text-slate-500">TBD</div>}
                {m?.score && <div className="mt-1 text-right text-xs text-cyan-200">{m.score}</div>}
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="text-sm text-slate-300">Quarterfinals and semifinals: one game to 11. Final: best of three to 11. Other matches are simulated from player ratings.</p>
    </Shell>
  );
}

// ---------------- Championship ----------------
export function ChampionshipScreen() {
  const { progress, go, startGame, looks, settings } = useUI();
  return (
    <Shell title="Championship" sub={`${progress.stageCleared}/${STAGES.length} stages cleared · win to unlock new arenas`} onBack={() => go('menu')}
      right={progress.stageCleared >= STAGES.length ? <Btn variant="gold" onClick={() => go('trophy')}>🏆 Trophy</Btn> : undefined}>
      <div className="grid gap-3">
        {STAGES.map((s, i) => {
          const cleared = progress.stageCleared > i, open = progress.stageCleared >= i;
          return (
            <div key={s.name} className={cn('glass flex items-center gap-4 rounded-2xl p-4', cleared && 'border-lime-300/40', !open && 'opacity-55')}>
              <div className="grid h-16 w-24 shrink-0 place-items-center rounded-lg font-display text-3xl font-black text-white" style={{ background: ARENA_GRAD[s.arena] }}>{cleared ? '✓' : i + 1}</div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-base font-extrabold uppercase text-white">{s.name}</div>
                <div className="text-sm text-slate-300">{s.blurb} · {ARENA_LIST.find((a) => a.id === s.arena)!.name}</div>
                <div className="text-xs text-cyan-200">{s.doubles ? 'Doubles' : 'Singles'} · {DIFF[s.diff].label} AI · {s.games > 1 ? `best of 3 to ${s.pts}` : `1 game to ${s.pts}`}{s.unlocks ? ` · unlocks ${ARENA_LIST.find((a) => a.id === s.unlocks)!.name}` : ''}</div>
              </div>
              <Btn disabled={!open} variant={cleared ? 'ghost' : 'gold'} onClick={() => startGame(stageLaunch(i, looks[0], settings))}>{cleared ? 'Replay' : open ? 'Play' : '🔒'}</Btn>
            </div>
          );
        })}
      </div>
      <div className="mt-4"><Btn variant="ghost" onClick={() => { if (confirm('Reset championship progress and arena unlocks?')) { db.saveProgress({ unlocked: ['neon', 'royal'], stageCleared: 0 }); useUI.setState({ progress: db.progress() }); } }}>Reset progress</Btn></div>
    </Shell>
  );
}

export function TrophyScreen() {
  const { go, prev, looks } = useUI();
  const champ = prev === 'championship';
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#1a1200]/80 to-[#04050d]/95 px-4 text-center anim-fade">
      <Confetti />
      <svg viewBox="0 0 120 140" className="anim-float h-56 w-48 drop-shadow-[0_0_30px_rgba(255,210,63,.8)]">
        <defs><linearGradient id="gold" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#fff2a8" /><stop offset=".5" stopColor="#ffd23f" /><stop offset="1" stopColor="#c98a10" /></linearGradient></defs>
        <path d="M30 14h60v32c0 22-14 38-30 40-16-2-30-18-30-40z" fill="url(#gold)" />
        <path d="M30 22H12c0 22 8 34 22 38M90 22h18c0 22-8 34-22 38" fill="none" stroke="url(#gold)" strokeWidth="6" />
        <rect x="54" y="84" width="12" height="20" fill="url(#gold)" />
        <rect x="36" y="104" width="48" height="12" rx="3" fill="url(#gold)" />
        <rect x="28" y="116" width="64" height="12" rx="3" fill="#8a5a10" />
        <circle cx="60" cy="40" r="12" fill="#fff6c8" opacity=".7" />
      </svg>
      <h2 className="mt-4 font-display text-4xl font-black uppercase italic text-yellow-300 glow-text sm:text-6xl">{champ ? 'World Champion' : 'Tournament Champion'}</h2>
      <p className="mt-2 text-xl text-white">{looks[0].name} lifts the trophy!</p>
      <div className="mt-8 flex gap-3"><Btn variant="gold" big onClick={() => go(champ ? 'championship' : 'bracket')}>Continue</Btn><Btn variant="ghost" big onClick={() => go('menu')}>Menu</Btn></div>
    </div>
  );
}

// ---------------- Customization ----------------
function Preview({ color, outfit, racket }: { color: number; outfit: number; racket: number }) {
  const c = COLORS[color % COLORS.length], r = RACKETS[racket % RACKETS.length];
  const arm = outfit === 2 ? '#e8b98f' : outfit === 3 ? '#15151c' : c;
  return (
    <svg viewBox="0 0 120 170" className="h-44 w-32">
      <ellipse cx="60" cy="160" rx="30" ry="6" fill="#000" opacity=".4" />
      <rect x="46" y="100" width="10" height="52" rx="5" fill="#e8b98f" /><rect x="64" y="100" width="10" height="52" rx="5" fill="#e8b98f" />
      <rect x="42" y="148" width="16" height="8" rx="3" fill="#fff" /><rect x="62" y="148" width="16" height="8" rx="3" fill="#fff" />
      <rect x="40" y="90" width="40" height="22" rx="6" fill={outfit === 3 ? '#15151c' : '#1b1f33'} />
      <rect x="38" y="46" width="44" height="52" rx="14" fill={c} />
      {outfit === 1 && <rect x="38" y="64" width="44" height="8" fill="#fff" />}
      <rect x="22" y="50" width="12" height="40" rx="6" fill={arm} transform="rotate(10 28 50)" />
      <rect x="86" y="50" width="12" height="40" rx="6" fill={arm} transform="rotate(-30 92 50)" />
      <circle cx="60" cy="32" r="16" fill="#e8b98f" /><path d="M44 30a16 16 0 0 1 32 0z" fill="#222" />
      {outfit === 3 && <rect x="44" y="26" width="32" height="5" fill="#ffd23f" />}
      <g transform="rotate(35 100 70)"><rect x="98" y="30" width="4" height="22" fill="#222" /><ellipse cx="100" cy="18" rx="11" ry="15" fill="none" stroke={r.frame} strokeWidth="3" /><ellipse cx="100" cy="18" rx="9" ry="13" fill={r.string} opacity=".3" /></g>
    </svg>
  );
}

export function CustomizeScreen() {
  const { looks, setLook, go } = useUI();
  const [p, setP] = useState<0 | 1>(0);
  const L = looks[p];
  return (
    <Shell title="Customization" sub="Cosmetic only — never affects gameplay balance" onBack={() => go('menu')}>
      <div className="mb-3 flex gap-2"><Chip active={p === 0} onClick={() => setP(0)}>Player 1</Chip><Chip active={p === 1} onClick={() => setP(1)}>Player 2</Chip></div>
      <div className="grid gap-4 md:grid-cols-[200px_1fr]">
        <div className="glass grid place-items-center rounded-2xl p-4"><Preview color={L.color} outfit={L.outfit} racket={L.racket} /></div>
        <div>
          <Panel title="Name"><input value={L.name} maxLength={14} onChange={(e) => setLook(p, { name: e.target.value })} className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 font-display text-white outline-none focus:border-cyan-300" style={{ userSelect: 'text' }} /></Panel>
          <Panel title="Kit color"><div className="flex flex-wrap gap-2">{COLORS.map((c, i) => <button key={c} onClick={() => setLook(p, { color: i })} className={cn('h-9 w-9 rounded-full border-2 transition active:scale-90', L.color === i ? 'scale-110 border-white' : 'border-transparent')} style={{ background: c }} />)}</div></Panel>
          <Panel title="Outfit"><div className="flex flex-wrap gap-2">{OUTFITS.map((o, i) => <Chip key={o} active={L.outfit === i} onClick={() => setLook(p, { outfit: i })}>{o}</Chip>)}</div></Panel>
          <Panel title="Racket skin"><div className="flex flex-wrap gap-2">{RACKETS.map((o, i) => <Chip key={o.name} active={L.racket === i} onClick={() => setLook(p, { racket: i })}><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: o.frame }} />{o.name}</Chip>)}</div></Panel>
          <Panel title="Shuttle trail"><div className="flex flex-wrap gap-2">{TRAILS.map((o, i) => <Chip key={o.name} active={L.trail === i} onClick={() => setLook(p, { trail: i })}><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: o.rainbow ? 'linear-gradient(90deg,red,yellow,lime,cyan,magenta)' : o.color }} />{o.name}</Chip>)}</div></Panel>
        </div>
      </div>
    </Shell>
  );
}

// ---------------- Stats / scores ----------------
export function StatsScreen() {
  const { stats, go, progress } = useUI();
  const items: [string, string][] = [
    ['Matches', String(stats.matches)], ['Wins', String(stats.wins)], ['Losses', String(stats.losses)],
    ['Win rate', stats.matches ? `${Math.round((stats.wins / Math.max(1, stats.wins + stats.losses)) * 100)}%` : '–'],
    ['Points won', String(stats.points)], ['Points lost', String(stats.pointsLost)],
    ['Perfect hits', String(stats.perfect)], ['Smash winners', String(stats.smashes)],
    ['Longest rally', String(stats.longestRally)], ['Drills played', String(stats.drills)],
    ['Time played', fmtTime(stats.playSeconds)], ['Tournament titles', String(stats.tournamentTitles)],
    ['Championships', String(stats.championships)], ['Arenas unlocked', `${progress.unlocked.length}/6`],
  ];
  return (
    <Shell title="Statistics" onBack={() => go('menu')}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map(([k, v]) => <div key={k} className="glass rounded-2xl p-4"><div className="text-xs font-bold uppercase tracking-widest text-cyan-300">{k}</div><div className="mt-1 font-display text-2xl font-black text-white">{v}</div></div>)}
      </div>
    </Shell>
  );
}

export function ScoresTable({ limit = 10 }: { limit?: number }) {
  const scores = useUI((s) => s.scores).slice(0, limit);
  if (!scores.length) return <p className="text-slate-300">No scores yet — play a match or drill!</p>;
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/5 text-xs uppercase tracking-widest text-cyan-300"><tr><th className="p-2">#</th><th className="p-2">Name</th><th className="p-2">Mode</th><th className="hidden p-2 sm:table-cell">Detail</th><th className="p-2 text-right">Score</th></tr></thead>
        <tbody>{scores.map((s, i) => <tr key={i} className="border-t border-white/5"><td className="p-2 text-yellow-300">{i + 1}</td><td className="p-2">{s.name}</td><td className="p-2 text-slate-300">{s.mode}</td><td className="hidden p-2 text-slate-400 sm:table-cell">{s.detail}</td><td className="p-2 text-right font-display text-cyan-200">{s.score.toLocaleString()}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
export function ScoresScreen() {
  const { go } = useUI();
  return (
    <Shell title="High Scores" sub="Stored locally on this device" onBack={() => go('menu')} right={<Btn variant="ghost" onClick={() => { db.clearScores(); useUI.setState({ scores: [] }); }}>Clear</Btn>}>
      <ScoresTable limit={25} />
    </Shell>
  );
}

// ---------------- Settings ----------------
const PAD_ACTIONS: [string, string][] = [['jump', 'Jump / Special'], ['clear', 'Long clear (1)'], ['drop', 'Short drop (2)'], ['right', 'Short right (3)'], ['left', 'Short left (4)'], ['sprint', 'Sprint'], ['camera', 'Camera']];
export function SettingsScreen() {
  const { settings, setSettings, go } = useUI();
  const [pads, setPads] = useState<string[]>([]);
  const [bind, setBind] = useState<string | null>(null);
  useEffect(() => {
    const t = setInterval(() => setPads(((navigator.getGamepads?.() ?? []) as (Gamepad | null)[]).filter((p): p is Gamepad => !!p).map((p) => p.id.slice(0, 40))), 600);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { input.padMap = settings.padMap; }, [settings.padMap]);
  const listen = (action: string) => {
    setBind(action);
    input.listening = (btn) => { setSettings({ padMap: { ...settings.padMap, [action]: btn } }); setBind(null); };
  };
  return (
    <Shell title="Settings" onBack={() => { input.listening = null; go(useUI.getState().prev === 'game' ? 'menu' : 'menu'); }}>
      <Panel title="Audio">
        <Slider label="Master" value={settings.master} onChange={(v) => setSettings({ master: v })} />
        <Slider label="Music" value={settings.music} onChange={(v) => setSettings({ music: v })} />
        <Slider label="Effects" value={settings.sfx} onChange={(v) => setSettings({ sfx: v })} />
        <Slider label="Crowd" value={settings.crowd} onChange={(v) => setSettings({ crowd: v })} />
        <Slider label="Announcer" value={settings.voice} onChange={(v) => setSettings({ voice: v })} />
      </Panel>
      <Panel title="Gameplay & graphics">
        <div className="mb-3 flex flex-wrap items-center gap-2"><span className="w-40 text-sm font-bold uppercase">Short shots 3 / 4</span>
          <Chip active={settings.shortSide === 'screen'} onClick={() => setSettings({ shortSide: 'screen' })}>As seen on screen</Chip>
          <Chip active={settings.shortSide === 'opponent'} onClick={() => setSettings({ shortSide: 'opponent' })}>Opponent's perspective</Chip></div>
        <div className="mb-3 flex flex-wrap items-center gap-2"><span className="w-40 text-sm font-bold uppercase">Screen shake</span>
          <Chip active={settings.shake} onClick={() => setSettings({ shake: true })}>On</Chip><Chip active={!settings.shake} onClick={() => setSettings({ shake: false })}>Off</Chip></div>
        <div className="flex flex-wrap items-center gap-2"><span className="w-40 text-sm font-bold uppercase">Quality</span>
          {(['auto', 'high', 'low'] as const).map((q) => <Chip key={q} active={settings.quality === q} onClick={() => setSettings({ quality: q })}>{q}</Chip>)}
          <span className="text-sm text-slate-300">Auto lowers render resolution if FPS drops.</span></div>
      </Panel>
      <Panel title="Gamepad mapping">
        <p className="mb-3 text-sm text-slate-300">{pads.length ? `Connected: ${pads.join(', ')}` : 'No gamepad detected — connect one and press any button.'} Left stick / D-pad moves. Press START to pause.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PAD_ACTIONS.map(([k, label]) => (
            <div key={k} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
              <span className="text-sm font-bold">{label}</span>
              <button onClick={() => listen(k)} className={cn('rounded-md border px-3 py-1 font-display text-xs', bind === k ? 'animate-pulse border-yellow-300 text-yellow-200' : 'border-white/20 text-cyan-200')}>{bind === k ? 'Press a button…' : `Button ${settings.padMap[k]}`}</button>
            </div>
          ))}
        </div>
        <div className="mt-3"><Btn variant="ghost" onClick={() => setSettings({ padMap: { ...DEFAULT_PADMAP } })}>Reset mapping</Btn></div>
      </Panel>
    </Shell>
  );
}

// ---------------- How to play ----------------
export function HowToScreen() {
  const { go } = useUI();
  const row = (a: string, b: string, c: string) => <tr className="border-t border-white/5"><td className="p-2 font-bold text-cyan-200">{a}</td><td className="p-2">{b}</td><td className="p-2">{c}</td></tr>;
  return (
    <Shell title="How to Play" onBack={() => go('menu')}>
      <Panel title="Keyboard controls">
        <table className="w-full text-left text-sm"><thead className="text-xs uppercase tracking-widest text-yellow-300"><tr><th className="p-2">Action</th><th className="p-2">Player 1</th><th className="p-2">Player 2</th></tr></thead><tbody>
          {row('Move', 'W A S D', 'Arrow keys')}{row('Long clear', '1', 'Num 1')}{row('Short drop / net shot', '2', 'Num 2')}
          {row('Short shot → right', '3', 'Num 3')}{row('Short shot → left', '4', 'Num 4')}{row('Jump smash / Special', 'Space', 'Right Shift')}
          {row('Sprint', 'Shift', 'Enter')}{row('Camera', 'C', 'O')}{row('Pause · Restart', 'Esc / P · R', '')}
        </tbody></table>
      </Panel>
      <Panel title="Hitting the shuttle">
        <ul className="list-disc space-y-1.5 pl-5 text-slate-200">
          <li>Walk under the shuttle — the cyan/red ring on the floor shows where it will land (red = out, let it go!).</li>
          <li>When the shuttle comes within range a <b>timing ring</b> appears. Press a shot key as the ring closes and turns <b className="text-yellow-300">gold</b> for a <b>PERFECT</b>.</li>
          <li>The shot depends on contact height: high → clear / drop / cross-court; mid → drive; low → lift or flat push; near the net → net shot.</li>
          <li>Press <b>Space</b> under a high shuttle to <b>jump-smash</b>. Steer with A/D while jumping to aim. Fill the SUPER meter with good hits, then Space for a Super Smash.</li>
          <li>Perfect timing unlocks specials: Perfect Jump Smash, Lightning Drive, Phantom Drop, Precision Clear, Perfect Cross-Court.</li>
          <li>Backhand shots happen automatically when the shuttle is on your non-racket side; lunges stretch your reach but cost recovery time.</li>
        </ul>
      </Panel>
      <Panel title="Rules">
        <p className="text-slate-200">Rally scoring to 21 (win by 2, max 30), best of 3 with change of ends. Serve diagonally into the opposite service court — right court when the server's score is even, left when odd. Doubles uses the wide court and the long-service line at the back of the 'short' doubles service box. Net touches, shots landing out and shots hitting your own side are faults. A shuttle resting on the net tape is a LET.</p>
      </Panel>
      <Panel title="Touch & gamepad">
        <p className="text-slate-200">On touch screens, drag the left pad to move; use the right buttons for CLEAR, DROP, ◀ / ▶ shots, JUMP and SPRINT. Gamepads work automatically (rebind in Settings).</p>
      </Panel>
    </Shell>
  );
}
