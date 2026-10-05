import { useState } from 'react';
import { ENEMIES, LEVELS, TOWERS, TOWER_ORDER } from '../game/data';
import { totalStars, type Progress } from '../game/storage';
import { sfx } from '../game/sfx';

interface Props {
  progress: Progress;
  onPlay: () => void;
  onReset: () => void;
}

const FLOATERS = ['🏹', '💣', '❄️', '⚡', '🎯', '🧟', '🦇', '👹', '🐺', '🦏', '🧙', '🏰'];

export default function Menu({ progress, onPlay, onReset }: Props) {
  const [help, setHelp] = useState(false);
  const stars = totalStars(progress);
  const started = Object.keys(progress.stars).length > 0;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-950 px-4 py-10 text-slate-100">
      {/* floating emoji backdrop */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
        {FLOATERS.map((e, i) => (
          <span
            key={i}
            className="float-slow absolute text-5xl"
            style={{
              left: `${(i * 83) % 95}%`,
              top: `${(i * 47) % 85}%`,
              animationDelay: `${i * 0.7}s`,
              animationDuration: `${6 + (i % 4)}s`,
            }}
          >
            {e}
          </span>
        ))}
      </div>

      <div className="relative w-full max-w-xl text-center">
        <div className="mb-2 text-6xl">🏰</div>
        <h1 className="bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-5xl font-black tracking-tight text-transparent sm:text-6xl">
          BASTION DEFENSE
        </h1>
        <p className="mt-2 text-slate-300">
          A strategy tower-defense with {LEVELS.length} levels, 4 difficulties and ever-changing battlefield conditions.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {TOWER_ORDER.map((t) => (
            <span
              key={t}
              title={TOWERS[t].name}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl"
              style={{ background: TOWERS[t].color + '33', border: `1px solid ${TOWERS[t].color}` }}
            >
              {TOWERS[t].icon}
            </span>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            onClick={() => {
              sfx.click();
              onPlay();
            }}
            className="w-64 rounded-2xl bg-gradient-to-b from-amber-300 to-amber-500 py-4 text-xl font-black text-amber-950 shadow-xl shadow-amber-500/20 transition hover:scale-105 hover:brightness-110 active:scale-95"
          >
            {started ? '▶ Continue Campaign' : '▶ Play'}
          </button>
          <button
            onClick={() => {
              sfx.click();
              setHelp((h) => !h);
            }}
            className="w-64 rounded-2xl bg-slate-800 py-3 font-bold hover:bg-slate-700"
          >
            {help ? 'Hide' : '📖 How to Play'}
          </button>
        </div>

        {help && (
          <div className="pop-in mt-5 rounded-2xl border border-slate-700 bg-slate-900/90 p-5 text-left text-sm leading-relaxed">
            <ul className="space-y-2">
              <li>🏗️ <b>Build</b> towers on free tiles beside the road. Click a tower to <b>upgrade</b> (4 levels), <b>sell</b>, or change its <b>targeting</b>.</li>
              <li>🎯 <b>Mix your defenses.</b> Cannons crush armored ground units but can't hit 🦇 bats. Frost slows runners. Tesla chains through swarms. Snipers ignore armor.</li>
              <li>🚩 <b>Take risks.</b> Send the next wave early (even mid-wave) for bonus gold.</li>
              <li>☄️ <b>Commander powers:</b> Meteor (Q), Freeze (W), Repair (E) — they recharge, so use them!</li>
              <li>⚠️ Read the <b>battlefield conditions</b> of each level: fog, regenerating foes, air raids, hordes…</li>
              <li>⭐ Keep your lives high for 3 stars. Win to unlock the next level and new towers.</li>
              <li>⌨️ Keys: 1–5 towers · Space send wave · U upgrade · S sell · T targeting · F speed · P pause · Esc cancel</li>
            </ul>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center">
              {Object.values(ENEMIES).map((e) => (
                <div key={e.id} title={e.desc} className="rounded-lg bg-slate-800 py-1.5">
                  <div className="text-xl">{e.icon}</div>
                  <div className="text-[10px] text-slate-400">{e.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 text-sm text-slate-400">
          ★ {stars} / {LEVELS.length * 3} stars collected
          {started && (
            <button
              onClick={() => {
                if (confirm('Reset all progress?')) onReset();
              }}
              className="ml-3 text-xs text-slate-600 underline hover:text-rose-400"
            >
              reset progress
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
