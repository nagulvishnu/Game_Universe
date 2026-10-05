import { DIFFICULTIES, LEVELS, MODS, THEMES, TOWERS, TOWER_ORDER, COLS, ROWS, type LevelDef } from '../game/data';
import { isUnlocked, totalStars, type Progress } from '../game/storage';
import { sfx } from '../game/sfx';

interface Props {
  progress: Progress;
  diffId: number;
  setDiffId: (d: number) => void;
  onPlay: (levelId: number) => void;
  onBack: () => void;
}

function MiniMap({ level }: { level: LevelDef }) {
  const th = THEMES[level.theme];
  return (
    <svg viewBox={`0 0 ${COLS} ${ROWS}`} className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <rect width={COLS} height={ROWS} fill={th.g1} />
      {level.paths.map((p, i) => (
        <g key={i}>
          <polyline
            points={p.map(([c, r]) => `${c + 0.5},${r + 0.5}`).join(' ')}
            fill="none"
            stroke={th.edge}
            strokeWidth={1.25}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <polyline
            points={p.map(([c, r]) => `${c + 0.5},${r + 0.5}`).join(' ')}
            fill="none"
            stroke={th.path}
            strokeWidth={0.8}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </g>
      ))}
    </svg>
  );
}

export default function LevelSelect({ progress, diffId, setDiffId, onPlay, onBack }: Props) {
  const stars = totalStars(progress);
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              sfx.click();
              onBack();
            }}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold hover:bg-slate-700"
          >
            ← Menu
          </button>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">🗺️ Choose Your Battle</h1>
          <div className="ml-auto rounded-full bg-slate-800 px-4 py-1.5 text-sm font-bold text-yellow-300">
            ★ {stars} / {LEVELS.length * 3}
          </div>
        </div>

        {/* Difficulty */}
        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Difficulty</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  sfx.click();
                  setDiffId(d.id);
                }}
                className={`rounded-xl border-2 px-3 py-2 text-left transition ${
                  diffId === d.id ? 'border-white bg-slate-800 shadow-lg' : 'border-slate-800 bg-slate-900 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  <span className={`h-2.5 w-2.5 rounded-full ${d.color}`} />
                  {d.icon} {d.name}
                </div>
                <div className="mt-0.5 text-[11px] leading-snug text-slate-400">{d.desc}</div>
                <div className="mt-1 text-[10px] text-slate-500">
                  ❤️ {d.lives} · foes ×{d.hp} HP
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LEVELS.map((lv) => {
            const open = isUnlocked(progress, lv.id);
            const s = progress.stars[lv.id] ?? 0;
            const crown = progress.crown[lv.id] ?? 0;
            const newTowers = TOWER_ORDER.filter((t) => TOWERS[t].unlock === lv.id - 1 && lv.id > 1);
            const th = THEMES[lv.theme];
            return (
              <button
                key={lv.id}
                disabled={!open}
                onClick={() => {
                  sfx.click();
                  onPlay(lv.id);
                }}
                className={`group relative overflow-hidden rounded-2xl border text-left transition ${
                  open
                    ? 'border-slate-700 bg-slate-900 hover:-translate-y-1 hover:border-amber-400 hover:shadow-xl hover:shadow-amber-500/10'
                    : 'cursor-not-allowed border-slate-800 bg-slate-900/60'
                }`}
              >
                <div className={`relative h-28 overflow-hidden bg-gradient-to-br ${th.card} ${open ? '' : 'grayscale'}`}>
                  <div className="h-full w-full opacity-90 transition group-hover:scale-105">
                    <MiniMap level={lv} />
                  </div>
                  <div className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/80 text-sm font-black">
                    {lv.id}
                  </div>
                  <div className="absolute right-2 top-2 rounded-full bg-slate-950/70 px-2 py-0.5 text-[10px] font-bold uppercase">
                    {th.label}
                  </div>
                  {lv.paths.length > 1 && (
                    <div className="absolute bottom-2 left-2 rounded-full bg-slate-950/70 px-2 py-0.5 text-[10px] font-bold">
                      🛣️ {lv.paths.length} lanes
                    </div>
                  )}
                  {!open && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 text-4xl">🔒</div>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-extrabold">{lv.name}</h3>
                    <div className="flex text-lg leading-none">
                      {[1, 2, 3].map((i) => (
                        <span key={i} className={i <= s ? 'text-yellow-300' : 'text-slate-700'}>
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="mt-0.5 min-h-[2rem] text-xs leading-snug text-slate-400">{lv.desc}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">🌊 {lv.waves} waves</span>
                    {lv.mods.map((m) => (
                      <span
                        key={m}
                        title={MODS[m].desc}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${MODS[m].good ? 'bg-emerald-900/60 text-emerald-200' : 'bg-rose-900/50 text-rose-200'}`}
                      >
                        {MODS[m].icon} {MODS[m].name}
                      </span>
                    ))}
                    {newTowers.map((t) => (
                      <span key={t} className="rounded bg-amber-900/60 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                        🆕 {TOWERS[t].icon} {TOWERS[t].name}
                      </span>
                    ))}
                    {crown > 0 && (
                      <span className="ml-auto rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold" title="Highest difficulty beaten">
                        👑 {DIFFICULTIES[crown - 1].name}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          Earn at least 1 ★ to unlock the next level. Keep more lives for 3 ★. Replay on harder difficulties for 👑.
        </p>
      </div>
    </div>
  );
}
