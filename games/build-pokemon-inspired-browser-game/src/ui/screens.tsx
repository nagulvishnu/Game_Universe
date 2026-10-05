import { useEffect, useState } from 'react';
import { SPECIES, STARTERS, TYPE_COLOR, weaknessesOf } from '../game/data';
import { loadScores } from '../game/engine';
import { isMuted, setMuted, sfx } from '../game/audio';
import { MonCanvas, Modal, TypeChip, useG } from './common';

export function ScoreTable({ highlight, limit = 10 }: { highlight?: string; limit?: number }) {
  const list = loadScores().slice(0, limit);
  if (!list.length) return <p className="py-4 text-center text-sm text-[#9aa0d8]">No runs yet — be the first on the board!</p>;
  return (
    <div className="overflow-hidden rounded-xl border-2 border-[#0b0a1e] bg-[#12102f]">
      <div className="grid grid-cols-[2rem_1fr_5rem_3.5rem] gap-1 bg-[#0b0a1e] px-2 py-1 text-[10px] font-extrabold uppercase text-[#9aa0d8] sm:grid-cols-[2rem_1fr_6rem_4rem_5rem]">
        <span>#</span><span>Trainer</span><span className="text-right">Score</span><span className="text-center">🏅</span><span className="hidden text-right sm:block">Lv</span>
      </div>
      {list.map((e, i) => (
        <div key={e.id} className={`grid grid-cols-[2rem_1fr_5rem_3.5rem] items-center gap-1 px-2 py-1.5 text-xs font-bold sm:grid-cols-[2rem_1fr_6rem_4rem_5rem] sm:text-sm ${e.id === highlight ? 'bg-[#ffd23f]/20 text-[#ffd23f]' : i % 2 ? 'bg-[#171540]' : ''}`}>
          <span className="pixel text-[10px]">{i === 0 ? '👑' : i + 1}</span>
          <span className="truncate">{e.won && '🏆 '}{e.name} <span className="text-[10px] font-semibold text-[#9aa0d8]">· {SPECIES[e.starter]?.name ?? '?'}</span></span>
          <span className="text-right tabular-nums">{e.score.toLocaleString()}</span>
          <span className="text-center">{e.badges}/8</span>
          <span className="hidden text-right sm:block">Lv.{e.lvl}</span>
        </div>
      ))}
    </div>
  );
}

export function Title() {
  const g = useG();
  const [name, setName] = useState(g.name === 'Hero' ? '' : g.name);
  const [view, setView] = useState<'main' | 'scores' | 'help'>('main');
  const start = () => g.newGame(name);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (view !== 'main') { if (e.code === 'Escape') setView('main'); return; }
      if (e.code === 'Enter') start();
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  });
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 overflow-y-auto bg-[#07061a]/35 p-3">
      <div className="anim-float text-center">
        <div className="logo text-[26px] leading-tight sm:text-5xl">MONSTER<br />QUEST</div>
        <div className="pixel mt-3 text-[8px] text-[#ffe9a8] sm:text-[11px]">Road to the Championship</div>
      </div>
      <div className="panel anim-pop flex w-full max-w-xs flex-col gap-2 p-3">
        <input
          value={name} onChange={(e) => setName(e.target.value.slice(0, 12))} placeholder="Your name (Hero)"
          className="rounded-lg border-[3px] border-[#0b0a1e] bg-[#0f0d2c] px-3 py-2 text-center text-sm font-bold text-white outline-none focus:border-[#ffd23f]"
        />
        <button className="btn btn-gold pixel !py-3 text-[11px]" onClick={start}>▶ NEW GAME</button>
        {g.hasSave() && <button className="btn btn-green" onClick={() => g.continueGame()}>⏩ Continue Adventure</button>}
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-blue text-sm" onClick={() => setView('scores')}>🏆 High Scores</button>
          <button className="btn btn-dark text-sm" onClick={() => setView('help')}>❓ How to Play</button>
        </div>
        <p className="anim-blink text-center text-[10px] font-bold text-[#cfd6ff]">Press ENTER or tap NEW GAME</p>
      </div>
      {view === 'scores' && <Modal title="HIGH SCORES" onClose={() => setView('main')}><ScoreTable /></Modal>}
      {view === 'help' && <Modal title="HOW TO PLAY" onClose={() => setView('main')}><Help /></Modal>}
    </div>
  );
}

export function Help() {
  return (
    <div className="space-y-2 text-sm leading-snug text-[#e4e6ff]">
      <p>🎮 <b>Move:</b> Arrow keys / WASD or the on-screen pad. Hold <b>Shift</b> (or RUN) to sprint.</p>
      <p>🌿 <b>Tall grass</b> hides wild monsters. Weaken them, then throw a <b>Capture Orb</b> — the lower their HP, the better your odds.</p>
      <p>⚔️ <b>Type matchups</b> decide everything: 🔥 beats 🍃❄️⚙️, 💧 beats 🔥⛰️🪨, ⚡ beats 💧🕊️, and so on. Move buttons show ×2 / ×½ hints.</p>
      <p>👀 <b>Trainers</b> challenge you when you cross their line of sight. Win to earn money.</p>
      <p>🛒 <b>Marts</b> sell orbs, potions, <b>held items</b> (permanent stat boosts) and <b>Mega Stones</b>.</p>
      <p>✨ <b>Mega Evolution:</b> once per battle, a monster holding its stone transforms for 3 turns with huge power.</p>
      <p>🏅 Beat the <b>Gym Leader</b> in each of 8 regions to open the gate east, then enter the <b>Championship Tournament</b>.</p>
      <p className="rounded-lg bg-[#0f0d2c] p-2 text-xs text-[#9aa0d8]">Battle keys: 1–5 choose, E = Mega, Backspace = back · Esc/P = pause · I = bag · O = team · R = restart (when paused / game over) · M = mute</p>
    </div>
  );
}

export function Starter() {
  const g = useG();
  const [sel, setSel] = useState(0);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === 'Digit1' || e.code === 'ArrowLeft') setSel((s) => (e.code === 'Digit1' ? 0 : Math.max(0, s - 1)));
      else if (e.code === 'Digit2') setSel(1);
      else if (e.code === 'Digit3') setSel(2);
      else if (e.code === 'ArrowRight') setSel((s) => Math.min(2, s + 1));
      else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); g.pickStarter(STARTERS[sel]); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [g, sel]);
  const chosen = SPECIES[STARTERS[sel]];
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 overflow-y-auto bg-[#07061a]/45 p-2 sm:gap-3 sm:p-4">
      <div className="panel anim-slide flex max-w-2xl items-center gap-3 px-3 py-2">
        <div className="text-3xl sm:text-4xl">🧑‍🔬</div>
        <p className="text-xs font-semibold leading-snug sm:text-sm">
          <b className="text-[#ffd23f]">Professor Willow:</b> Welcome, <b>{g.p?.name}</b>! Every great journey starts with a partner. Choose one of these three monsters!
        </p>
      </div>
      <div className="grid w-full max-w-2xl grid-cols-3 gap-2 sm:gap-3">
        {STARTERS.map((id, i) => {
          const s = SPECIES[id]; const on = i === sel;
          return (
            <button
              key={id} onClick={() => { setSel(i); sfx.select(); }}
              className={`panel flex flex-col items-center gap-1 p-2 transition-transform sm:p-3 ${on ? 'scale-105 !border-[#ffd23f]' : 'opacity-80 hover:opacity-100'}`}
              style={{ boxShadow: on ? `0 0 0 3px ${TYPE_COLOR[s.types[0]]} inset, 0 0 28px ${TYPE_COLOR[s.types[0]]}88` : undefined }}
            >
              <div className="pixel text-[8px] text-[#9aa0d8]">{i + 1}</div>
              <div className="sm:hidden"><MonCanvas sp={id} size={64} animate={on} /></div>
              <div className="hidden sm:block"><MonCanvas sp={id} size={110} animate={on} /></div>
              <div className="text-sm font-extrabold sm:text-base">{s.name}</div>
              <TypeChip t={s.types[0]} />
            </button>
          );
        })}
      </div>
      <div className="panel w-full max-w-2xl p-2 text-center text-xs sm:p-3 sm:text-sm">
        <b style={{ color: TYPE_COLOR[chosen.types[0]] }}>{chosen.name}</b> is weak to{' '}
        {weaknessesOf(chosen.types).map((t) => <span key={t} className="mx-0.5"><TypeChip t={t} small /></span>)}
      </div>
      <button className="btn btn-gold pixel !px-6 !py-3 text-[10px] sm:text-xs" onClick={() => g.pickStarter(STARTERS[sel])}>I CHOOSE {chosen.name.toUpperCase()}!</button>
    </div>
  );
}

export function Pause() {
  const g = useG();
  const [view, setView] = useState<'main' | 'scores' | 'help'>('main');
  const [mute, setMute] = useState(isMuted());
  const p = g.p!;
  return (
    <Modal title="PAUSED" onClose={() => g.togglePause()}>
      {view === 'main' && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
            <div className="rounded-lg bg-[#0f0d2c] p-2">Score<div className="pixel mt-1 text-[10px] text-[#ffd23f]">{p.score.toLocaleString()}</div></div>
            <div className="rounded-lg bg-[#0f0d2c] p-2">Badges<div className="pixel mt-1 text-[10px] text-[#ffd23f]">{p.badges.filter(Boolean).length}/8</div></div>
            <div className="rounded-lg bg-[#0f0d2c] p-2">Caught<div className="pixel mt-1 text-[10px] text-[#ffd23f]">{p.dex.length}</div></div>
          </div>
          <button className="btn btn-green" onClick={() => g.togglePause()}>▶ Resume</button>
          <button className="btn btn-red" onClick={() => g.restart()}>⟳ Instant Restart (R)</button>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-blue" onClick={() => setView('scores')}>🏆 Scores</button>
            <button className="btn btn-dark" onClick={() => setView('help')}>❓ Help</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-dark" onClick={() => { setMuted(!mute); setMute(!mute); }}>{mute ? '🔇 Sound off' : '🔊 Sound on'}</button>
            <button className="btn btn-dark" onClick={() => g.toTitle()}>⌂ Quit to Title</button>
          </div>
          <p className="text-center text-[10px] text-[#9aa0d8]">Progress auto-saves at Centers, after battles and at every gym.</p>
        </div>
      )}
      {view === 'scores' && <><ScoreTable highlight={p.runId} /><button className="btn btn-dark mt-2 w-full" onClick={() => setView('main')}>← Back</button></>}
      {view === 'help' && <><Help /><button className="btn btn-dark mt-2 w-full" onClick={() => setView('main')}>← Back</button></>}
    </Modal>
  );
}

export function GameOver() {
  const g = useG(); const p = g.p!;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === 'KeyR') g.restart();
      else if (e.code === 'KeyC' || e.code === 'Enter') g.continueAfterGameOver();
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [g]);
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 overflow-y-auto bg-[#12040c]/75 p-3">
      <div className="pixel anim-pop text-2xl text-[#ff5a5a] drop-shadow-[0_4px_0_#1d1a33] sm:text-4xl">GAME OVER</div>
      <p className="text-center text-sm font-semibold text-[#ffd0d0]">All your monsters fainted, {p.name}...</p>
      <div className="panel grid w-full max-w-md grid-cols-3 gap-2 p-3 text-center text-xs font-bold">
        <div>Score<div className="pixel mt-1 text-xs text-[#ffd23f]">{p.score.toLocaleString()}</div></div>
        <div>Badges<div className="pixel mt-1 text-xs text-[#ffd23f]">{p.badges.filter(Boolean).length}/8</div></div>
        <div>Wins<div className="pixel mt-1 text-xs text-[#ffd23f]">{p.wins}</div></div>
      </div>
      <div className="w-full max-w-md"><ScoreTable highlight={p.runId} limit={5} /></div>
      <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
        <button className="btn btn-gold flex-1" onClick={() => g.continueAfterGameOver()}>⛑ Continue at Center (C)<div className="text-[10px] font-semibold opacity-80">lose half your money</div></button>
        <button className="btn btn-red flex-1" onClick={() => g.restart()}>⟳ Instant Restart (R)</button>
      </div>
      <button className="text-xs font-bold text-[#9aa0d8] underline" onClick={() => g.toTitle()}>Back to title</button>
    </div>
  );
}

export function Victory() {
  const g = useG(); const p = g.p!;
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.code === 'KeyR' || e.code === 'Enter') g.restart(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [g]);
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 overflow-y-auto bg-[#1a1200]/70 p-3">
      <div className="text-5xl anim-float">🏆</div>
      <div className="logo anim-pop text-xl sm:text-4xl">CHAMPION!</div>
      <p className="max-w-md text-center text-sm font-semibold text-[#ffe9a8]">{p.name} conquered 8 gyms and the Championship Tournament. The whole world cheers your name!</p>
      <div className="panel grid w-full max-w-md grid-cols-3 gap-2 p-3 text-center text-xs font-bold">
        <div>Final score<div className="pixel mt-1 text-xs text-[#ffd23f]">{p.score.toLocaleString()}</div></div>
        <div>Monsters<div className="pixel mt-1 text-xs text-[#ffd23f]">{p.dex.length}</div></div>
        <div>Battles won<div className="pixel mt-1 text-xs text-[#ffd23f]">{p.wins}</div></div>
      </div>
      <div className="w-full max-w-md"><ScoreTable highlight={p.runId} limit={5} /></div>
      <div className="flex w-full max-w-md gap-2">
        <button className="btn btn-gold flex-1" onClick={() => g.restart()}>⟳ Play Again (R)</button>
        <button className="btn btn-dark flex-1" onClick={() => g.toTitle()}>⌂ Title</button>
      </div>
    </div>
  );
}
