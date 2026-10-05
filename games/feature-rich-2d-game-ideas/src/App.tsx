import { useState } from 'react';
import GameView from './ui/GameView';
import Hub from './ui/Hub';
import { loadSave, writeSave, resetSave, LEVELS, CHARS, type Save } from './game/data';
import type { GameResult } from './game/engine';
import { sfx } from './game/audio';

type Screen = 'title' | 'hub' | 'game' | 'result';

interface Outcome extends GameResult {
  reward: number;
  bonus: number;
  newBest: boolean;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [save, setSaveState] = useState<Save>(() => loadSave());
  const [level, setLevel] = useState(0);
  const [runId, setRunId] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const setSave = (s: Save) => {
    setSaveState(s);
    writeSave(s);
  };

  const deploy = (idx: number) => {
    setLevel(idx);
    setRunId(r => r + 1);
    setScreen('game');
  };

  const handleEnd = (r: GameResult) => {
    const bonus = r.win ? 400 + 150 * r.levelIdx : 0;
    const reward = r.win ? r.credits + bonus : Math.floor(r.credits * 0.5);
    const prevBest = save.best[r.levelIdx] || 0;
    const newBest = r.win && r.score > prevBest;
    const next: Save = {
      ...save,
      credits: save.credits + reward,
      unlocked: r.win ? Math.min(LEVELS.length - 1, Math.max(save.unlocked, r.levelIdx + 1)) : save.unlocked,
      best: r.win ? { ...save.best, [r.levelIdx]: Math.max(prevBest, r.score) } : save.best,
    };
    setSave(next);
    setOutcome({ ...r, reward, bonus, newBest });
    setScreen('result');
  };

  if (screen === 'game') {
    return (
      <GameView
        key={runId}
        charId={save.char}
        levelIdx={level}
        save={save}
        onEnd={handleEnd}
        onQuit={() => setScreen('hub')}
        onRestart={() => setRunId(r => r + 1)}
      />
    );
  }

  if (screen === 'hub') {
    return <Hub save={save} setSave={setSave} onDeploy={deploy} onBack={() => setScreen('title')} initialLevel={level} />;
  }

  if (screen === 'result' && outcome) {
    const o = outcome;
    const lvl = LEVELS[o.levelIdx];
    const final = o.win && o.levelIdx === LEVELS.length - 1;
    const mm = Math.floor(o.time / 60), ss = Math.floor(o.time % 60);
    return (
      <div className="fixed inset-0 flex items-center justify-center overflow-auto bg-slate-950 p-4 text-slate-100">
        <div className="pointer-events-none fixed inset-0" style={{ background: o.win ? 'radial-gradient(circle at 50% 20%, rgba(52,211,153,0.2), transparent 55%)' : 'radial-gradient(circle at 50% 20%, rgba(244,63,94,0.22), transparent 55%)' }} />
        <div className="relative w-full max-w-xl rounded-3xl border border-slate-700 bg-slate-900/90 p-8 text-center shadow-2xl">
          <div className="text-6xl">{o.win ? (final ? '👑' : '🏆') : '💀'}</div>
          <h1 className={`mt-2 text-4xl font-black tracking-widest ${o.win ? 'text-emerald-300' : 'text-rose-400'}`}>
            {final ? 'CAMPAIGN COMPLETE' : o.win ? 'MISSION COMPLETE' : 'MISSION FAILED'}
          </h1>
          <p className="mt-1 text-slate-400">{lvl.name} — {CHARS[save.char].name}</p>
          {o.newBest && <p className="mt-2 text-sm font-bold text-amber-300">★ NEW PERSONAL BEST ★</p>}
          <div className="mt-6 grid grid-cols-2 gap-3 text-left sm:grid-cols-3">
            {[
              ['Score', o.score.toLocaleString()],
              ['Kills', o.kills],
              ['Time', `${mm}:${String(ss).padStart(2, '0')}`],
              ['Damage dealt', Math.round(o.damage).toLocaleString()],
              ['Best combo', o.bestCombo],
              ['Loot', `💰 ${o.credits}`],
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded-xl bg-slate-800/80 p-3">
                <div className="text-[10px] uppercase tracking-widest text-slate-500">{k}</div>
                <div className="text-lg font-bold">{v}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3">
            <div className="text-sm text-amber-200">
              {o.win ? `Mission bonus +${o.bonus}  •  ` : 'Defeat — only 50% of loot recovered  •  '}
              <b className="text-lg text-amber-300">+💰 {o.reward}</b>
            </div>
          </div>
          {final && <p className="mt-4 text-sm text-fuchsia-300">You destroyed the Omega Core and saved the world! Keep upgrading and replay missions for high scores.</p>}
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {o.win && o.levelIdx < LEVELS.length - 1 ? (
              <button onClick={() => { sfx('ult'); deploy(o.levelIdx + 1); }} className="rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-4 py-3 font-black text-slate-950 hover:scale-105">NEXT MISSION ▶</button>
            ) : (
              <button onClick={() => deploy(o.levelIdx)} className="rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-4 py-3 font-black text-slate-950 hover:scale-105">{o.win ? 'REPLAY' : 'RETRY'} ↻</button>
            )}
            <button onClick={() => { setLevel(Math.min(o.levelIdx + (o.win ? 1 : 0), LEVELS.length - 1)); setScreen('hub'); }} className="rounded-xl bg-amber-400 px-4 py-3 font-black text-slate-950 hover:bg-amber-300">🛒 HQ / SHOP</button>
            {o.win && o.levelIdx < LEVELS.length - 1 ? (
              <button onClick={() => deploy(o.levelIdx)} className="rounded-xl bg-slate-700 px-4 py-3 font-bold hover:bg-slate-600">REPLAY ↻</button>
            ) : (
              <button onClick={() => setScreen('title')} className="rounded-xl bg-slate-700 px-4 py-3 font-bold hover:bg-slate-600">TITLE</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------------- TITLE ----------------
  const hasProgress = save.unlocked > 0 || save.chars.length > 1 || save.weapons.length > 1 || save.credits !== 300;
  return (
    <div className="fixed inset-0 overflow-auto bg-slate-950 text-white">
      <div className="nf-grid pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 35%, rgba(34,211,238,0.18), transparent 50%), radial-gradient(circle at 15% 85%, rgba(217,70,239,0.22), transparent 45%), radial-gradient(circle at 90% 80%, rgba(251,146,60,0.15), transparent 40%)' }} />
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} className="nf-streak pointer-events-none absolute h-0.5 rounded-full" style={{ top: `${(i * 37) % 100}%`, left: '-20%', width: `${120 + (i % 4) * 60}px`, animationDelay: `${(i * 0.7) % 5}s`, animationDuration: `${2.2 + (i % 5) * 0.6}s`, background: i % 3 === 0 ? 'linear-gradient(90deg,transparent,#22d3ee)' : i % 3 === 1 ? 'linear-gradient(90deg,transparent,#e879f9)' : 'linear-gradient(90deg,transparent,#fbbf24)' }} />
      ))}
      <div className="relative mx-auto flex min-h-full max-w-5xl flex-col items-center justify-center px-4 py-10 text-center">
        <div className="text-xs font-bold tracking-[0.6em] text-cyan-300/80">TOP-DOWN ACTION SHOOTER</div>
        <h1 className="nf-title mt-3 text-6xl font-black leading-none tracking-wider sm:text-8xl">
          <span className="text-cyan-300">NEON</span> <span className="text-fuchsia-400">FRONT</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-300">
          Fight through <b className="text-white">8 campaigns</b> with <b className="text-white">6 operatives</b>, <b className="text-white">9 weapons</b>, <b className="text-white">4 drivable vehicles</b>, unique skills &amp; ultimates — and take down colossal bosses.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => { sfx('ult'); setLevel(save.unlocked); setScreen('hub'); }}
            className="rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-10 py-4 text-xl font-black tracking-widest text-slate-950 shadow-xl shadow-fuchsia-500/30 transition hover:scale-105"
          >
            {hasProgress ? '▶ CONTINUE' : '▶ START CAMPAIGN'}
          </button>
          {hasProgress && (
            <button
              onClick={() => { if (confirm('Erase all progress and start over?')) setSave(resetSave()); }}
              className="rounded-xl border border-slate-600 px-6 py-4 font-bold text-slate-300 hover:bg-slate-800"
            >
              ⟲ New Game
            </button>
          )}
        </div>

        <div className="mt-12 grid w-full max-w-4xl gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['🧑‍🚀', 'Operatives', 'Ninja, Heavy, Engineer, Sniper, Pyro and more — each with a skill and ultimate.'],
            ['🔫', 'Arsenal', 'Shotguns, plasma, tesla arc, flamethrower, rockets and a piercing railgun.'],
            ['🚙', 'Vehicles', 'Jeep, Tank, Hoverbike & Gunship. Run enemies over or rain fire from above.'],
            ['👾', 'Bosses', 'Every mission ends with a huge multi-phase boss fight.'],
          ].map(([i, t, d]) => (
            <div key={t} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 backdrop-blur">
              <div className="text-3xl">{i}</div>
              <div className="mt-1 font-bold text-cyan-200">{t}</div>
              <div className="mt-1 text-xs text-slate-400">{d}</div>
            </div>
          ))}
        </div>
        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-3 text-xs text-slate-400">
          <b className="text-slate-200">Controls:</b> WASD move • Mouse aim/shoot • R reload • Shift dash • Q skill • Space ultimate • G grenade • V melee • E vehicle • 1-9 / wheel weapons • Esc pause
        </div>
      </div>
    </div>
  );
}
