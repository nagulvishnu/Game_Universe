import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  COLS,
  DIFFICULTIES,
  ENEMIES,
  LEVELS,
  MAX_TIER,
  MODS,
  ROWS,
  TARGET_MODES,
  TILE,
  TOWERS,
  TOWER_ORDER,
  towerStats,
  upgradeCost,
  type LevelDef,
  type TowerType,
} from '../game/data';
import { ABILITY_CD, CANVAS_H, CANVAS_W, Game, LOGICAL_H, LOGICAL_W, type MsgTone } from '../game/engine';
import { isMuted, setMuted, sfx } from '../game/sfx';

interface Props {
  level: LevelDef;
  diffId: number;
  onExit: () => void;
  onRetry: () => void;
  onNext: (() => void) | null;
  onWin: (stars: number) => void;
}

interface Toast {
  id: number;
  text: string;
  tone: MsgTone;
}

export default function GameScreen({ level, diffId, onExit, onRetry, onNext, onWin }: Props) {
  const game = useMemo(() => {
    const g = new Game(level, diffId);
    g.paused = true;
    return g;
  }, [level, diffId]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snap, setSnap] = useState(() => game.snapshot());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [briefing, setBriefing] = useState(true);
  const [showResult, setShowResult] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const briefingRef = useRef(true);
  const toastId = useRef(0);
  const onWinRef = useRef(onWin);
  onWinRef.current = onWin;

  const diff = DIFFICULTIES[diffId];
  const levelIdx = level.id - 1;
  const unlocked = (t: TowerType) => TOWERS[t].unlock <= levelIdx;

  /* ------------------------ game wiring ------------------------ */
  useEffect(() => {
    game.onMsg = (text, tone) => {
      const id = ++toastId.current;
      setToasts((t) => [...t.slice(-2), { id, text, tone }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400);
    };
    game.onEnd = () => {
      if (game.status === 'won') onWinRef.current(game.stars);
      setTimeout(() => setShowResult(true), 1100);
    };
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let last = performance.now();
    let lastSnap = 0;
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (!briefingRef.current) {
        for (let i = 0; i < game.speed; i++) game.update(dt);
      } else game.update(0);
      game.draw(ctx);
      if (t - lastSnap > 90) {
        lastSnap = t;
        setSnap(game.snapshot());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [game]);

  const startLevel = () => {
    briefingRef.current = false;
    game.paused = false;
    setBriefing(false);
    sfx.click();
  };

  /* ------------------------ actions ------------------------ */
  const selectBuild = useCallback(
    (t: TowerType | null) => {
      if (t && !unlocked(t)) {
        game.onMsg(`Unlocks at Level ${TOWERS[t].unlock + 1}`, 'bad');
        sfx.deny();
        return;
      }
      game.aim = null;
      game.selectedId = null;
      game.buildType = game.buildType === t ? null : t;
      sfx.click();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game, levelIdx],
  );

  const toggleMeteor = useCallback(() => {
    if (game.cd.meteor > 0) {
      game.onMsg('Meteor is recharging', 'bad');
      return;
    }
    game.buildType = null;
    game.selectedId = null;
    game.aim = game.aim ? null : 'meteor';
    sfx.click();
  }, [game]);

  const togglePause = useCallback(() => {
    if (briefingRef.current || game.status !== 'playing') return;
    game.paused = !game.paused;
  }, [game]);

  const cycleSpeed = useCallback(() => {
    game.speed = game.speed === 1 ? 2 : game.speed === 2 ? 3 : 1;
    sfx.click();
  }, [game]);

  const sendWave = useCallback(() => {
    if (briefingRef.current || game.paused) return;
    game.sendWave();
  }, [game]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (briefingRef.current) return;
      const k = e.key.toLowerCase();
      const n = parseInt(k, 10);
      if (n >= 1 && n <= 5) selectBuild(TOWER_ORDER[n - 1]);
      else if (k === ' ') {
        e.preventDefault();
        sendWave();
      } else if (k === 'escape') {
        game.buildType = null;
        game.selectedId = null;
        game.aim = null;
      } else if (k === 'u' && game.selectedId) game.upgradeTower(game.selectedId);
      else if (k === 's' && game.selectedId) game.sellTower(game.selectedId);
      else if (k === 't' && game.selectedId) game.cycleMode(game.selectedId);
      else if (k === 'q') toggleMeteor();
      else if (k === 'w') game.castFreeze();
      else if (k === 'e') game.castRepair();
      else if (k === 'p') togglePause();
      else if (k === 'f') cycleSpeed();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game, selectBuild, sendWave, toggleMeteor, togglePause, cycleSpeed]);

  /* ------------------------ canvas input ------------------------ */
  const toPoint = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * LOGICAL_W;
    const y = ((e.clientY - rect.top) / rect.height) * LOGICAL_H;
    return { x, y, c: Math.floor(x / TILE), r: Math.floor(y / TILE) };
  };

  const onMove = (e: React.PointerEvent) => {
    const p = toPoint(e);
    game.hover = p;
  };

  const onClick = (e: React.MouseEvent) => {
    if (briefingRef.current || game.status !== 'playing' || game.paused) return;
    const p = toPoint(e);
    game.hover = p;
    if (game.aim === 'meteor') {
      if (game.castMeteor(p.x, p.y)) game.aim = null;
      return;
    }
    if (p.c < 0 || p.r < 0 || p.c >= COLS || p.r >= ROWS) return;
    const tw = game.towerAt(p.c, p.r);
    if (tw) {
      game.selectedId = tw.id;
      game.buildType = null;
      sfx.click();
      return;
    }
    if (game.buildType) {
      game.placeTower(p.c, p.r, game.buildType);
      return;
    }
    game.selectedId = null;
  };

  const onContext = (e: React.MouseEvent) => {
    e.preventDefault();
    game.buildType = null;
    game.selectedId = null;
    game.aim = null;
  };

  /* ------------------------ derived ------------------------ */
  const sel = game.selectedTower();
  const buildDef = snap.buildType ? TOWERS[snap.buildType] : null;
  const livesPct = (snap.lives / snap.maxLives) * 100;
  const allSent = snap.waveIdx >= snap.totalWaves;
  const nextLevelAvailable = !!onNext;

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 select-none">
      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-900/90 px-3 py-2 backdrop-blur">
        <button
          onClick={() => {
            sfx.click();
            onExit();
          }}
          className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold hover:bg-slate-700"
        >
          ← Levels
        </button>
        <div className="mr-2 min-w-0">
          <div className="truncate text-sm font-bold leading-tight">
            Level {level.id}: {level.name}
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <span className={`inline-block h-2 w-2 rounded-full ${diff.color}`} />
            {diff.icon} {diff.name}
            {level.mods.map((m) => (
              <span key={m} title={`${MODS[m].name}: ${MODS[m].desc}`} className="cursor-help">
                {MODS[m].icon}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <Stat icon="🪙" value={snap.gold} className="text-yellow-300" />
          <div className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5">
            <span>❤️</span>
            <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-700">
              <div
                className={`h-full transition-all ${livesPct > 50 ? 'bg-emerald-400' : livesPct > 25 ? 'bg-yellow-400' : 'bg-rose-500'}`}
                style={{ width: `${livesPct}%` }}
              />
            </div>
            <span className="w-6 text-sm font-bold tabular-nums">{snap.lives}</span>
          </div>
          <Stat icon="🌊" value={`${Math.min(snap.waveIdx, snap.totalWaves)}/${snap.totalWaves}`} />
          <button
            onClick={cycleSpeed}
            title="Game speed (F)"
            className="w-14 rounded-lg bg-slate-800 py-1.5 text-sm font-bold hover:bg-slate-700"
          >
            {snap.speed}x ⏩
          </button>
          <button
            onClick={togglePause}
            title="Pause (P)"
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-bold hover:bg-slate-700"
          >
            {snap.paused && !briefing ? '▶️' : '⏸️'}
          </button>
          <button
            onClick={() => {
              setMuted(!muted);
              setMutedState(!muted);
            }}
            title="Sound"
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-700"
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-3 p-3 lg:flex-row">
        {/* Board */}
        <div className="relative min-w-0 flex-1">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => (game.hover = null)}
            onClick={onClick}
            onContextMenu={onContext}
            className={`w-full touch-none rounded-xl border-4 border-slate-800 shadow-2xl ${snap.aim ? 'cursor-crosshair' : snap.buildType ? 'cursor-copy' : 'cursor-pointer'}`}
            style={{ aspectRatio: `${COLS * TILE} / ${ROWS * TILE}` }}
          />

          {/* toasts */}
          <div className="pointer-events-none absolute left-1/2 top-3 flex -translate-x-1/2 flex-col items-center gap-1">
            {toasts.map((t) => (
              <div
                key={t.id}
                className={`toast-in rounded-full px-4 py-1.5 text-sm font-bold shadow-lg ${
                  t.tone === 'bad' ? 'bg-rose-600' : t.tone === 'good' ? 'bg-emerald-600' : 'bg-slate-700'
                }`}
              >
                {t.text}
              </div>
            ))}
          </div>

          {/* mode hint */}
          {(snap.aim || buildDef) && !briefing && snap.status === 'playing' && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/85 px-4 py-1.5 text-xs font-semibold text-slate-200">
              {snap.aim
                ? '☄️ Click anywhere to call down a meteor — Esc to cancel'
                : `Placing ${buildDef!.name} — click a free tile (right-click / Esc to cancel)`}
            </div>
          )}

          {briefing && <Briefing level={level} diffId={diffId} onStart={startLevel} />}
          {showResult && snap.status !== 'playing' && (
            <Result
              won={snap.status === 'won'}
              stars={snap.stars}
              kills={snap.kills}
              lives={snap.lives}
              maxLives={snap.maxLives}
              wave={snap.waveIdx}
              total={snap.totalWaves}
              level={level}
              onRetry={onRetry}
              onExit={onExit}
              onNext={nextLevelAvailable ? onNext : null}
              diffId={diffId}
            />
          )}
        </div>

        {/* Side panel */}
        <aside className="flex w-full flex-col gap-3 lg:w-80">
          {/* Next wave */}
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {allSent ? 'Final wave deployed' : `Next: Wave ${snap.waveIdx + 1}`}
              </h3>
              {!snap.waveActive && snap.waveIdx > 0 && !allSent && (
                <span className="rounded bg-slate-800 px-2 py-0.5 text-xs tabular-nums text-slate-300">
                  ⏱ {Math.ceil(snap.breather)}s
                </span>
              )}
              {snap.waveActive && <span className="animate-pulse text-xs font-bold text-rose-400">● IN PROGRESS</span>}
            </div>
            <div className="mb-3 flex min-h-[2.5rem] flex-wrap gap-1.5">
              {snap.next.map((n) => (
                <div
                  key={n.type}
                  title={`${ENEMIES[n.type].name}: ${ENEMIES[n.type].desc}`}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1 text-sm ${n.type === 'boss' ? 'bg-rose-900/70 ring-1 ring-rose-500' : 'bg-slate-800'}`}
                >
                  <span className="text-lg leading-none">{ENEMIES[n.type].icon}</span>
                  <span className="text-xs font-bold">×{n.count}</span>
                  {ENEMIES[n.type].flying && <span className="text-[10px] text-sky-300">air</span>}
                </div>
              ))}
              {allSent && <div className="text-sm text-slate-400">Defeat all remaining enemies to win!</div>}
            </div>
            <button
              disabled={allSent || briefing}
              onClick={sendWave}
              className="w-full rounded-lg bg-gradient-to-b from-emerald-400 to-emerald-600 py-2.5 text-sm font-extrabold text-emerald-950 shadow transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {snap.waveIdx === 0 ? '▶ Start First Wave' : '⏩ Send Next Wave'}
              {snap.bonus > 0 && !allSent && <span className="ml-2 rounded bg-emerald-950/30 px-1.5 py-0.5 text-xs">+{snap.bonus} 🪙</span>}
              <span className="ml-1 text-[10px] opacity-60">[Space]</span>
            </button>
          </section>

          {/* Shop */}
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Build Towers</h3>
            <div className="grid grid-cols-5 gap-1.5 lg:grid-cols-1">
              {TOWER_ORDER.map((t, i) => {
                const d = TOWERS[t];
                const locked = !unlocked(t);
                const afford = snap.gold >= d.cost;
                const active = snap.buildType === t;
                return (
                  <button
                    key={t}
                    onClick={() => selectBuild(t)}
                    className={`group relative flex items-center gap-2 rounded-lg border px-2 py-2 text-left transition ${
                      active
                        ? 'border-white bg-slate-700 ring-2 ring-white/40'
                        : 'border-slate-700 bg-slate-800 hover:border-slate-500 hover:bg-slate-700'
                    } ${locked ? 'opacity-40' : !afford ? 'opacity-70' : ''}`}
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl"
                      style={{ background: d.color + '33', border: `1px solid ${d.color}` }}
                    >
                      {locked ? '🔒' : d.icon}
                    </span>
                    <span className="hidden min-w-0 flex-1 lg:block">
                      <span className="block truncate text-sm font-bold">{d.name}</span>
                      <span className="block truncate text-[11px] text-slate-400">
                        {locked ? `Unlocks at level ${d.unlock + 1}` : d.desc}
                      </span>
                    </span>
                    <span className={`absolute right-1 top-0.5 text-[11px] font-bold lg:static lg:text-sm ${afford && !locked ? 'text-yellow-300' : 'text-slate-400'}`}>
                      {d.cost}
                    </span>
                    <span className="absolute bottom-0.5 left-1 text-[9px] text-slate-500 lg:hidden">{i + 1}</span>
                    <span className="hidden text-[10px] text-slate-500 lg:block">{i + 1}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Selected tower */}
          {sel ? (
            <section className="rounded-xl border border-amber-500/40 bg-slate-900 p-3">
              <TowerPanel
                game={game}
                tower={sel}
                gold={snap.gold}
                onClose={() => (game.selectedId = null)}
              />
            </section>
          ) : (
            <section className="rounded-xl border border-dashed border-slate-800 p-3 text-xs text-slate-500">
              {buildDef ? (
                <div>
                  <div className="font-bold text-slate-300">
                    {buildDef.icon} {buildDef.name}
                  </div>
                  <div className="mt-1">{buildDef.desc}</div>
                  <div className="mt-1">
                    Damage {buildDef.dmg} · Range {buildDef.range} · {(1 / buildDef.rate).toFixed(1)} shots/s
                    {!buildDef.air && ' · Ground only'}
                  </div>
                </div>
              ) : (
                <>💡 Pick a tower, then click a free grass tile. Click a built tower to upgrade it.</>
              )}
            </section>
          )}

          {/* Abilities */}
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Commander Powers</h3>
            <div className="grid grid-cols-3 gap-2">
              <Ability
                icon="☄️"
                name="Meteor"
                hotkey="Q"
                cd={snap.cd.meteor}
                max={ABILITY_CD.meteor}
                active={snap.aim === 'meteor'}
                onClick={toggleMeteor}
                tip="Call a meteor on a spot. Massive area damage."
              />
              <Ability
                icon="🧊"
                name="Freeze"
                hotkey="W"
                cd={snap.cd.freeze}
                max={ABILITY_CD.freeze}
                onClick={() => game.castFreeze()}
                tip="Freeze every enemy for 3.5 seconds."
              />
              <Ability
                icon="🔧"
                name="Repair"
                hotkey="E"
                cd={snap.cd.repair}
                max={ABILITY_CD.repair}
                onClick={() => game.castRepair()}
                tip="Restore 3 lives."
              />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Stat({ icon, value, className = '' }: { icon: string; value: string | number; className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-bold tabular-nums ${className}`}>
      <span>{icon}</span>
      {value}
    </div>
  );
}

function Ability({
  icon,
  name,
  hotkey,
  cd,
  max,
  onClick,
  tip,
  active,
}: {
  icon: string;
  name: string;
  hotkey: string;
  cd: number;
  max: number;
  onClick: () => void;
  tip: string;
  active?: boolean;
}) {
  const ready = cd <= 0;
  return (
    <button
      onClick={onClick}
      title={tip}
      className={`relative overflow-hidden rounded-lg border px-1 py-2 text-center transition ${
        active ? 'border-rose-400 bg-rose-900/50' : ready ? 'border-slate-600 bg-slate-800 hover:bg-slate-700' : 'border-slate-800 bg-slate-800/60'
      }`}
    >
      {!ready && (
        <div className="absolute inset-x-0 bottom-0 bg-slate-950/70" style={{ height: `${(cd / max) * 100}%` }} />
      )}
      <div className="relative text-2xl leading-none">{icon}</div>
      <div className="relative mt-1 text-[11px] font-bold">{ready ? name : `${Math.ceil(cd)}s`}</div>
      <div className="relative text-[9px] text-slate-500">[{hotkey}]</div>
    </button>
  );
}

function TowerPanel({
  game,
  tower,
  gold,
  onClose,
}: {
  game: Game;
  tower: NonNullable<ReturnType<Game['selectedTower']>>;
  gold: number;
  onClose: () => void;
}) {
  const def = TOWERS[tower.type];
  const st = towerStats(tower.type, tower.tier, game.rangeMod);
  const nx = tower.tier < MAX_TIER ? towerStats(tower.type, tower.tier + 1, game.rangeMod) : null;
  const cost = tower.tier < MAX_TIER ? upgradeCost(tower.type, tower.tier) : 0;
  const refund = Math.floor(tower.invested * 0.7);

  const row = (label: string, a: string, b?: string | null) => (
    <div className="flex justify-between text-xs">
      <span className="text-slate-400">{label}</span>
      <span className="font-bold tabular-nums">
        {a}
        {b && <span className="ml-1 text-emerald-400">→ {b}</span>}
      </span>
    </div>
  );

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg text-xl" style={{ background: def.color + '33', border: `1px solid ${def.color}` }}>
          {def.icon}
        </span>
        <div className="flex-1">
          <div className="text-sm font-bold leading-tight">{def.name}</div>
          <div className="flex gap-0.5 text-xs">
            {Array.from({ length: MAX_TIER + 1 }).map((_, i) => (
              <span key={i} className={i <= tower.tier ? 'text-yellow-300' : 'text-slate-700'}>
                ★
              </span>
            ))}
            <span className="ml-1 text-[10px] text-slate-500">{tower.kills} kills</span>
          </div>
        </div>
        <button onClick={onClose} className="rounded px-2 text-slate-500 hover:text-white">
          ✕
        </button>
      </div>
      <div className="space-y-0.5">
        {row('Damage', st.dmg.toFixed(0), nx && nx.dmg.toFixed(0))}
        {row('Range', st.range.toFixed(1), nx && nx.range.toFixed(1))}
        {row('Fire rate', `${(1 / st.rate).toFixed(2)}/s`, nx && `${(1 / nx.rate).toFixed(2)}/s`)}
        {st.splash > 0 && row('Splash', st.splash.toFixed(2), nx && nx.splash.toFixed(2))}
        {st.chain > 0 && row('Chain targets', `${st.chain}`, nx && `${nx.chain}`)}
        {st.slow > 0 && row('Slow', `${Math.round(st.slow * 100)}%`, nx && `${Math.round(nx.slow * 100)}%`)}
        {st.pierce > 0 && row('Armor pierce', `${st.pierce}`)}
      </div>
      <button
        onClick={() => game.cycleMode(tower.id)}
        title="Change targeting (T)"
        className="mt-2 w-full rounded-lg bg-slate-800 py-1.5 text-xs font-semibold hover:bg-slate-700"
      >
        🎯 Target: <span className="text-amber-300">{TARGET_MODES[tower.mode]}</span> <span className="text-slate-500">[T]</span>
      </button>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          disabled={!nx}
          onClick={() => game.upgradeTower(tower.id)}
          className={`rounded-lg py-2 text-xs font-extrabold transition active:scale-95 disabled:opacity-40 ${
            gold >= cost ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-amber-950' : 'bg-slate-700 text-slate-300'
          }`}
        >
          {nx ? `⬆ Upgrade ${cost}🪙` : 'MAX LEVEL'}
          {nx && <span className="block text-[9px] font-semibold opacity-60">[U]</span>}
        </button>
        <button
          onClick={() => game.sellTower(tower.id)}
          className="rounded-lg bg-rose-700 py-2 text-xs font-extrabold hover:bg-rose-600 active:scale-95"
        >
          Sell +{refund}🪙
          <span className="block text-[9px] font-semibold opacity-60">[S]</span>
        </button>
      </div>
    </div>
  );
}

function Briefing({ level, diffId, onStart }: { level: LevelDef; diffId: number; onStart: () => void }) {
  const diff = DIFFICULTIES[diffId];
  const towers = TOWER_ORDER.filter((t) => TOWERS[t].unlock <= level.id - 1);
  const justUnlocked = TOWER_ORDER.filter((t) => TOWERS[t].unlock === level.id - 1 && level.id > 1);
  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-950/80 p-3 backdrop-blur-sm">
      <div className="pop-in max-h-full w-full max-w-md overflow-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <div className="text-xs font-bold uppercase tracking-widest text-amber-400">Mission {level.id}</div>
        <h2 className="text-2xl font-black">{level.name}</h2>
        <p className="mt-1 text-sm text-slate-400">{level.desc}</p>

        <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
          <Mini label="Difficulty" value={`${diff.icon}`} sub={diff.name} />
          <Mini label="Lives" value={`${diff.lives}`} sub="❤️" />
          <Mini label="Gold" value={`${Math.round(level.gold * diff.startGold)}`} sub="🪙" />
          <Mini label="Waves" value={`${level.waves}`} sub="🌊" />
        </div>

        {level.mods.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Battlefield conditions</div>
            {level.mods.map((m) => (
              <div key={m} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${MODS[m].good ? 'bg-emerald-900/40' : 'bg-rose-900/30'}`}>
                <span className="text-lg">{MODS[m].icon}</span>
                <div>
                  <div className="font-bold leading-tight">{MODS[m].name}</div>
                  <div className="text-xs text-slate-400">{MODS[m].desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Arsenal</div>
          <div className="mt-1 flex gap-2">
            {towers.map((t) => (
              <div
                key={t}
                title={TOWERS[t].name}
                className={`flex h-10 w-10 items-center justify-center rounded-lg text-xl ${justUnlocked.includes(t) ? 'animate-bounce ring-2 ring-amber-400' : ''}`}
                style={{ background: TOWERS[t].color + '33', border: `1px solid ${TOWERS[t].color}` }}
              >
                {TOWERS[t].icon}
              </div>
            ))}
          </div>
          {justUnlocked.length > 0 && (
            <div className="mt-1 text-xs text-amber-300">
              New: {justUnlocked.map((t) => TOWERS[t].name).join(', ')}!
            </div>
          )}
        </div>

        {level.id === 1 && (
          <div className="mt-3 rounded-lg bg-sky-900/40 p-3 text-xs text-sky-100">
            <b>How to play:</b> pick a tower on the right, click a free tile to build. Click towers to upgrade them.
            Enemies take the road to your 🏰 — don't let them through! Send waves early for bonus gold.
          </div>
        )}

        <button
          onClick={onStart}
          className="mt-4 w-full rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 py-3 text-base font-black text-amber-950 shadow-lg transition hover:brightness-110 active:scale-[0.98]"
        >
          ⚔️ Start Defending
        </button>
      </div>
    </div>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg bg-slate-800 py-2">
      <div className="text-[10px] uppercase text-slate-500">{label}</div>
      <div className="text-lg font-black leading-tight">{value}</div>
      <div className="text-[10px] text-slate-400">{sub}</div>
    </div>
  );
}

function Result({
  won,
  stars,
  kills,
  lives,
  maxLives,
  wave,
  total,
  level,
  diffId,
  onRetry,
  onExit,
  onNext,
}: {
  won: boolean;
  stars: number;
  kills: number;
  lives: number;
  maxLives: number;
  wave: number;
  total: number;
  level: LevelDef;
  diffId: number;
  onRetry: () => void;
  onExit: () => void;
  onNext: (() => void) | null;
}) {
  const nextTower = TOWER_ORDER.find((t) => TOWERS[t].unlock === level.id);
  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-950/85 p-3 backdrop-blur-sm">
      <div className="pop-in w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center shadow-2xl">
        <div className="text-5xl">{won ? '🏆' : '💀'}</div>
        <h2 className={`mt-2 text-3xl font-black ${won ? 'text-amber-300' : 'text-rose-400'}`}>
          {won ? 'Victory!' : 'Defeated'}
        </h2>
        <p className="text-sm text-slate-400">
          {won ? `${level.name} is safe.` : `The gate fell on wave ${wave} of ${total}.`}
        </p>
        {won && (
          <div className="my-3 flex justify-center gap-2 text-5xl">
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={s <= stars ? 'star-pop text-yellow-300' : 'text-slate-700'}
                style={{ animationDelay: `${s * 0.25}s` }}
              >
                ★
              </span>
            ))}
          </div>
        )}
        <div className="my-3 grid grid-cols-3 gap-2 text-xs">
          <Mini label="Kills" value={`${kills}`} sub="enemies" />
          <Mini label="Lives" value={`${lives}/${maxLives}`} sub="left" />
          <Mini label="Mode" value={DIFFICULTIES[diffId].icon} sub={DIFFICULTIES[diffId].name} />
        </div>
        {won && nextTower && (
          <div className="mb-3 rounded-lg bg-amber-900/30 p-2 text-xs text-amber-200">
            🔓 Unlocked next level: {TOWERS[nextTower].icon} {TOWERS[nextTower].name}
          </div>
        )}
        {!won && diffId > 0 && (
          <div className="mb-3 text-xs text-slate-500">Tip: try upgrading towers instead of building new ones, or lower the difficulty.</div>
        )}
        <div className="flex flex-col gap-2">
          {won && onNext && (
            <button onClick={onNext} className="rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 py-2.5 font-black text-emerald-950 hover:brightness-110">
              Next Level ➜
            </button>
          )}
          <button onClick={onRetry} className="rounded-xl bg-slate-700 py-2.5 font-bold hover:bg-slate-600">
            {won ? '↻ Replay for more stars' : '↻ Try Again'}
          </button>
          <button onClick={onExit} className="rounded-xl bg-slate-800 py-2.5 font-bold text-slate-300 hover:bg-slate-700">
            Level Select
          </button>
        </div>
        {won && level.id === LEVELS.length && (
          <div className="mt-3 text-sm font-bold text-amber-300">🎉 You have conquered every realm!</div>
        )}
      </div>
    </div>
  );
}
