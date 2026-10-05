import { useEffect, useMemo, useState } from 'react';
import { MODES, DIFFS, BOT_NAMES, type Difficulty, type ModeDef } from '../game/data';
import { getScores, type ScoreEntry } from '../game/storage';

interface Props {
  name: string;
  setName: (n: string) => void;
  mode: string;
  setMode: (m: string) => void;
  diff: Difficulty;
  setDiff: (d: Difficulty) => void;
  onPlay: () => void;
  isTouch: boolean;
}

export function ScoreTable({ highlight, compact }: { highlight?: number; compact?: boolean }) {
  const scores = getScores();
  if (!scores.length) return <div className="text-slate-400 text-sm py-3 text-center">No matches yet — be the first legend.</div>;
  return (
    <div className="text-sm">
      <div className="grid grid-cols-[24px_1fr_52px_36px_52px] gap-x-2 px-2 pb-1 text-[10px] tracking-widest text-slate-500">
        <span>#</span><span>PLAYER</span><span className="text-right">SCORE</span><span className="text-right">K</span><span className="text-right">PLACE</span>
      </div>
      {scores.slice(0, compact ? 5 : 10).map((s: ScoreEntry, i) => (
        <div key={s.date + '-' + i} className={`grid grid-cols-[24px_1fr_52px_36px_52px] gap-x-2 px-2 py-1 rounded ${i === highlight ? 'bg-amber-400/25 border border-amber-400/70' : i % 2 ? 'bg-white/[0.03]' : ''}`}>
          <span className={i < 3 ? 'text-amber-300 font-bold' : 'text-slate-500'}>{i + 1}</span>
          <span className="truncate">{s.name} <span className="text-[10px] text-slate-500">{s.mode}</span></span>
          <span className="text-right font-display text-amber-200 text-[13px]">{s.score}</span>
          <span className="text-right">{s.kills}</span>
          <span className="text-right text-slate-300">#{s.place}</span>
        </div>
      ))}
    </div>
  );
}

function ModeCard({ m, active, onClick }: { m: ModeDef; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-3 rounded-lg border transition-all clip-tag ${active ? 'bg-amber-400/15 border-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.25)] scale-[1.02]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl">{m.icon}</span>
        <div className="min-w-0">
          <div className="font-display font-bold text-sm sm:text-base truncate">{m.name}</div>
          <div className="text-[10px] tracking-[0.15em] text-amber-300">{m.tag}</div>
        </div>
      </div>
      <div className="text-xs text-slate-300 mt-1 leading-snug hidden sm:block">{m.desc}</div>
    </button>
  );
}

export default function Menu({ name, setName, mode, setMode, diff, setDiff, onPlay, isTouch }: Props) {
  const [lobby, setLobby] = useState(false);
  const m = MODES.find((x) => x.id === mode)!;
  const play = () => {
    if (m.room) setLobby(true);
    else onPlay();
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (lobby) return;
      if (e.code === 'Enter' && (e.target as HTMLElement).tagName !== 'INPUT') play();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  return (
    <div className="absolute inset-0 overflow-y-auto bg-gradient-to-b from-[#05080f]/80 via-[#05080f]/55 to-[#05080f]/90">
      <div className="min-h-full max-w-6xl mx-auto px-4 py-5 sm:py-8 flex flex-col">
        <header className="menu-in text-center sm:text-left">
          <div className="flex items-end gap-3 justify-center sm:justify-start">
            <h1 className="font-display font-black text-4xl sm:text-6xl leading-none" style={{ background: 'linear-gradient(180deg,#fff 10%,#fbbf24 55%,#f97316)', WebkitBackgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 4px 18px rgba(249,115,22,0.45))' }}>
              DROPZONE<span className="text-sky-300" style={{ WebkitTextFillColor: '#7dd3fc' }}> 50</span>
            </h1>
            <span className="float-slow text-3xl sm:text-5xl">🪂</span>
          </div>
          <p className="text-slate-300 tracking-[0.25em] text-[11px] sm:text-sm mt-1">DROP · LOOT · DRIVE · SURVIVE THE STORM</p>
        </header>

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4 mt-5 flex-1">
          <section className="menu-in flex flex-col gap-4" style={{ animationDelay: '0.1s' }}>
            <div className="panel p-3 sm:p-4">
              <div className="text-[11px] tracking-[0.25em] text-slate-400 mb-2">SELECT MODE</div>
              <div className="grid grid-cols-2 gap-2">
                {MODES.map((x) => <ModeCard key={x.id} m={x} active={x.id === mode} onClick={() => setMode(x.id)} />)}
              </div>
              <div className="sm:hidden text-xs text-slate-300 mt-2">{m.desc}</div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="panel p-3">
                <div className="text-[11px] tracking-[0.25em] text-slate-400 mb-2">CALLSIGN</div>
                <input
                  value={name}
                  maxLength={14}
                  onChange={(e) => setName(e.target.value.toUpperCase())}
                  className="w-full bg-black/40 border border-white/15 rounded px-3 py-2 font-display font-bold tracking-widest outline-none focus:border-amber-400"
                  placeholder="YOU"
                />
              </div>
              <div className="panel p-3">
                <div className="text-[11px] tracking-[0.25em] text-slate-400 mb-2">BOT DIFFICULTY</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(DIFFS) as Difficulty[]).map((d) => (
                    <button key={d} onClick={() => setDiff(d)} className={`py-2 rounded text-[11px] font-bold tracking-widest border ${d === diff ? 'bg-amber-400 text-black border-amber-300' : 'bg-white/5 border-white/15 hover:bg-white/10'}`}>
                      {DIFFS[d].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={play} className="btn-primary py-4 text-xl sm:text-2xl font-display">
              {m.room ? 'CREATE ROOM' : 'DEPLOY'} ▶
            </button>
          </section>

          <section className="menu-in flex flex-col gap-4" style={{ animationDelay: '0.2s' }}>
            <div className="panel p-3 sm:p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] tracking-[0.25em] text-slate-400">🏆 LOCAL HIGH SCORES</div>
              </div>
              <ScoreTable />
            </div>
            <div className="panel p-3 sm:p-4 text-xs text-slate-300 leading-relaxed">
              <div className="text-[11px] tracking-[0.25em] text-slate-400 mb-2">CONTROLS</div>
              {isTouch ? (
                <ul className="space-y-0.5">
                  <li><b className="text-amber-300">Left stick</b> move · push fully to sprint</li>
                  <li><b className="text-amber-300">Drag right side</b> to look · <b className="text-amber-300">FIRE</b> button also aims</li>
                  <li><b className="text-amber-300">USE</b> enter vehicle / swap gun · 💣 🧨 throw · 🩹 heal</li>
                </ul>
              ) : (
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                  <span><b className="text-amber-300">WASD</b> move</span><span><b className="text-amber-300">SHIFT</b> sprint</span>
                  <span><b className="text-amber-300">MOUSE</b> aim / <b className="text-amber-300">LMB</b> fire</span><span><b className="text-amber-300">RMB</b> scope</span>
                  <span><b className="text-amber-300">SPACE</b> jump / chute</span><span><b className="text-amber-300">R</b> reload</span>
                  <span><b className="text-amber-300">1 2 3 · Q</b> weapons</span><span><b className="text-amber-300">E</b> drive / swap</span>
                  <span><b className="text-amber-300">G</b> grenade · <b className="text-amber-300">B</b> bomb</span><span><b className="text-amber-300">H</b> medkit · <b className="text-amber-300">P</b> pause</span>
                </div>
              )}
            </div>
          </section>
        </div>
        <footer className="text-center text-[10px] text-slate-500 tracking-widest mt-4">LAST ONE STANDING WINS · HIGH SCORES SAVED ON THIS DEVICE</footer>
      </div>
      {lobby && <RoomLobby mode={m} name={name || 'YOU'} onStart={() => { setLobby(false); onPlay(); }} onBack={() => setLobby(false)} />}
    </div>
  );
}

function RoomLobby({ mode, name, onStart, onBack }: { mode: ModeDef; name: string; onStart: () => void; onBack: () => void }) {
  const code = useMemo(() => Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join(''), []);
  const pool = useMemo(() => BOT_NAMES.slice().sort(() => Math.random() - 0.5).slice(0, mode.players - 1), [mode.players]);
  const [joined, setJoined] = useState(1);
  useEffect(() => {
    if (joined >= mode.players) return;
    const t = setTimeout(() => setJoined((j) => j + 1), 260 + Math.random() * 380);
    return () => clearTimeout(t);
  }, [joined, mode.players]);
  const ready = joined >= mode.players;
  return (
    <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-20">
      <div className="panel w-full max-w-xl p-5 menu-in">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] tracking-[0.25em] text-slate-400">ROOM CODE</div>
            <div className="font-display text-4xl font-black text-amber-300 tracking-[0.2em]">{code}</div>
          </div>
          <div className="text-right">
            <div className="font-display text-2xl font-bold">{joined}<span className="text-slate-500">/{mode.players}</span></div>
            <div className="text-[11px] tracking-widest text-slate-400">PLAYERS</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          {Array.from({ length: mode.players }).map((_, i) => {
            const on = i < joined;
            const label = i === 0 ? name : pool[i - 1];
            return (
              <div key={i} className={`px-2 py-1.5 rounded text-xs font-bold tracking-wider truncate border ${on ? (i === 0 ? 'bg-amber-400/20 border-amber-400 text-amber-200' : 'bg-white/10 border-white/20') : 'border-dashed border-white/10 text-slate-600'}`}>
                {on ? `${i === 0 ? '👑 ' : '● '}${label}` : 'waiting…'}
              </div>
            );
          })}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onBack} className="btn-ghost px-5 py-3 rounded">LEAVE</button>
          <button onClick={onStart} className="btn-primary flex-1 py-3 text-lg font-display">{ready ? 'START MATCH' : 'START NOW'} ▶</button>
        </div>
        <div className="text-[11px] text-slate-500 mt-2 text-center">Empty slots are filled with bots when the match starts.</div>
      </div>
    </div>
  );
}
