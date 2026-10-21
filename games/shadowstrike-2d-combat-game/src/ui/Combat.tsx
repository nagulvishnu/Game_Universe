import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../stores/gameStore';
import { GameCanvas } from '../game/GameCanvas';
import type { CombatScene, CombatInit, TrainingOptions } from '../game/scenes/CombatScene';
import { gameEvents, type HudSnapshot, type FighterHud } from '../game/events';
import { Button, Panel, hexStr } from './shared';
import { SkillIcon } from './SkillIcon';
import { SKILL_BY_ID } from '../data/skills';
import { getWeapon, WEAPONS } from '../data/weapons';
import { WeaponGlyph } from './WeaponGlyph';
import { levelFromXp } from '../save/save';
import { IconGem, IconPause } from './Icons';

/* ------------------------------------------------------------------ pieces */

function Portrait({ name, weaponName, enemy }: { name: string; weaponName: string; enemy?: boolean }) {
  const w = WEAPONS.find((x) => x.name === weaponName);
  return (
    <div
      className="ss-portrait h-12 w-12 shrink-0"
      style={{
        borderColor: enemy ? '#ff3b55' : '#a855f7',
        boxShadow: enemy
          ? '0 0 18px rgba(255,59,85,0.5), inset 0 0 14px rgba(0,0,0,0.8)'
          : '0 0 18px rgba(168,85,247,0.55), inset 0 0 14px rgba(0,0,0,0.8)',
      }}
    >
      {w
        ? <WeaponGlyph shape={w.shape} size={26} color={hexStr(w.color)} glow={hexStr(w.glow)} />
        : <span className="text-[10px] font-extrabold uppercase leading-none tracking-wide text-violet-200">{name.slice(0, 2)}</span>}
    </div>
  );
}

function HealthBar({ f, flip, enemy }: { f: FighterHud; flip?: boolean; enemy?: boolean }) {
  const pct = Math.max(0, Math.min(100, (f.health / Math.max(1, f.maxHealth)) * 100));
  const guardPct = Math.max(0, Math.min(100, (f.guard / Math.max(1, f.maxGuard)) * 100));
  return (
    <div className="min-w-0 flex-1">
      <div className={`ss-hud-hp ${enemy ? 'enemy' : ''}`}>
        <span style={{ width: `${pct}%`, right: flip ? 0 : undefined, left: flip ? undefined : 0 }} />
      </div>
      <div className="mt-[3px] flex items-center gap-1.5">
        <div className="ss-hud-xp flex-1">
          <span style={{ width: `${guardPct}%`, marginLeft: flip ? 'auto' : undefined, background: 'linear-gradient(90deg,#22d3ee,#a855f7)' }} />
        </div>
        <span className="font-mono text-[10px] text-white/85">
          {Math.round(f.health)} / {Math.round(f.maxHealth)}
        </span>
      </div>
      {f.statuses.length > 0 && (
        <div className={`mt-1 flex gap-1 ${flip ? 'justify-end' : ''}`}>
          {f.statuses.map((s) => (
            <span key={s} className="border border-amber-300/40 bg-amber-400/10 px-1 text-[9px] font-bold text-amber-200">{s}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function BossHealthBar({ b }: { b: NonNullable<HudSnapshot['boss']> }) {
  const pct = Math.max(0, (b.health / Math.max(1, b.maxHealth)) * 100);
  return (
    <div className="flex w-full flex-col items-center gap-1">
      <div className="flex items-center gap-2">
        <span className="ss-title text-lg uppercase tracking-wider text-white drop-shadow">{b.name}</span>
        <span className="text-[10px] font-bold text-violet-300">Phase {b.phase + 1}</span>
        <span className="text-[10px] text-slate-400">{b.phaseName}</span>
      </div>
      <div className="relative h-4 w-full max-w-md overflow-hidden border border-white/20 bg-black/70">
        <div
          className="absolute inset-y-0 transition-[width] duration-200"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #b14bff, #8a5aff)',
            boxShadow: '0 0 18px #b14bff77',
          }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/90 drop-shadow">
          {Math.round(b.health)} / {Math.round(b.maxHealth)}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- virtual pad */

function SkillPad({ hud, keys, onSkill }: { hud: FighterHud; keys: string[]; onSkill: (i: number) => void }) {
  return (
    <div className="flex items-end gap-2">
      {hud.skills.map((s, i) => {
        const ready = s.cooldown <= 0;
        const pct = ready ? 0 : (s.cooldown / Math.max(1, s.cooldownMax)) * 100;
        const def = SKILL_BY_ID[s.id];
        return (
          <button
            key={s.id}
            onPointerDown={(e) => { e.preventDefault(); onSkill(i); }}
            className="pointer-events-auto relative grid h-14 w-14 place-items-center rounded-full border transition active:scale-95"
            style={{
              borderColor: ready ? s.color : 'rgba(255,255,255,0.18)',
              background: 'radial-gradient(circle at 50% 35%, rgba(20,20,34,0.9), rgba(5,5,12,0.95))',
              boxShadow: ready ? `0 0 18px ${s.color}55` : 'none',
            }}
            title={s.name}
          >
            <span
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(${s.color} 0deg, ${s.color} ${pct}%, transparent ${pct}% 100%)`,
                WebkitMask: 'radial-gradient(circle closest-side, transparent 62%, black 66%)',
                mask: 'radial-gradient(circle closest-side, transparent 62%, black 66%)',
                opacity: ready ? 0.35 : 1,
              }}
            />
            <span className="pointer-events-none relative">
              {def
                ? <SkillIcon skill={def} size={30} grade="owned" />
                : <span className="text-[11px] font-bold" style={{ color: s.color }}>{s.name.slice(0, 4)}</span>}
            </span>
            <span className="ss-key absolute -bottom-1 left-1/2 -translate-x-1/2">{keys[i] ?? ['E', 'R', 'V'][i]}</span>
            {!ready && (
              <span className="pointer-events-none absolute inset-0 grid place-items-center text-[11px] font-bold text-white">
                {(s.cooldown / 1000).toFixed(1)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ the HUD */

export interface CombatHudProps {
  hud: HudSnapshot;
  weaponName: string;
  weaponRarity: string;
  xpPct: number;
  xpInto: number;
  xpNeed: number;
  skillKeys: string[];
  onPause: () => void;
  onSkill: (i: number) => void;
}

export function CombatHud({
  hud, weaponName, weaponRarity, xpPct, xpInto, xpNeed, skillKeys,
  onPause, onSkill,
}: CombatHudProps) {
  const charge = hud.p1.charge;

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col p-3 sm:p-4">
      {/* top row */}
      <div className="flex items-start gap-2 sm:gap-4">
        {/* player */}
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <Portrait name={hud.p1.name} weaponName={hud.p1.weapon} />
          <div className="min-w-0 max-w-[300px] flex-1">
            <div className="flex items-baseline gap-2">
              <span className="ss-title truncate text-base uppercase tracking-wide text-white drop-shadow">{hud.p1.name}</span>
              <span className="hidden text-[9px] font-bold uppercase tracking-widest text-cyan-300/80 sm:inline">
                {weaponName} · {weaponRarity}
              </span>
            </div>
            <HealthBar f={hud.p1} />
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">XP</span>
              <div className="ss-hud-xp w-24">
                <span style={{ width: `${xpPct}%` }} />
              </div>
              <span className="font-mono text-[9px] text-slate-400">{xpInto}/{xpNeed}</span>
            </div>
          </div>
        </div>

        {/* round + timer */}
        <div className="flex w-24 shrink-0 flex-col items-center sm:w-32">
          <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-300">
            Round {hud.round}/{hud.maxRounds}
          </span>
          <span className="ss-title text-4xl leading-none text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.45)] sm:text-5xl">
            {hud.timer > 900 ? '∞' : hud.timer}
          </span>
          {hud.boss && <div className="mt-1 w-full"><BossHealthBar b={hud.boss} /></div>}
        </div>

        {/* opponent */}
        <div className="flex min-w-0 flex-1 items-start justify-end gap-2">
          <div className="min-w-0 max-w-[300px] flex-1">
            <div className="flex items-baseline justify-end gap-2">
              <span className="hidden text-[9px] font-bold uppercase tracking-widest text-rose-300/80 sm:inline">
                {hud.p2.weapon}
              </span>
              <span className="ss-title truncate text-base uppercase tracking-wide text-white drop-shadow">{hud.p2.name}</span>
            </div>
            <HealthBar f={hud.p2} flip enemy />
          </div>
          <Portrait name={hud.p2.name} weaponName={hud.p2.weapon} enemy />
        </div>
      </div>

      {/* combo readout */}
      {(hud.p1.combo > 1 || hud.p2.combo > 1) && (
        <div className="absolute left-4 top-[26%]">
          <div className="ss-combo text-4xl leading-none sm:text-5xl">
            {Math.max(hud.p1.combo, hud.p2.combo)} HIT COMBO
          </div>
          <div className="mt-1 flex items-center gap-1 text-lg font-extrabold text-cyan-300">
            +{Math.max(hud.p1.combo, hud.p2.combo) * 6}
            <IconGem size={14} />
          </div>
        </div>
      )}

      {/* bottom row */}
      <div className="mt-auto flex items-end justify-between gap-3">
        <div className="pointer-events-auto flex items-center gap-2 pb-1">
          <button
            onClick={onPause}
            className="ss-ghost-btn flex items-center gap-1.5 px-2 py-1 text-[10px]"
          >
            <span className="ss-key">ESC</span> <IconPause size={11} /> Pause
          </button>
          <span className="text-[9px] text-slate-500">{hud.fps} FPS</span>
        </div>

        <div className="pointer-events-auto flex items-end gap-3 pb-1">
          <SkillPad hud={hud.p1} keys={skillKeys} onSkill={onSkill} />
          {/* charge gauge */}
          <div className="relative grid h-16 w-16 place-items-center">
            <span
              className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(#a855f7 ${charge * 360}deg, rgba(255,255,255,0.07) 0deg)`,
                WebkitMask: 'radial-gradient(circle closest-side, transparent 58%, black 62%)',
                mask: 'radial-gradient(circle closest-side, transparent 58%, black 62%)',
              }}
            />
            <span className="absolute inset-0 rounded-full border border-violet-400/40 bg-black/50" />
            <span className="relative font-mono text-sm font-bold text-white">{Math.round(charge * 100)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- screen */

export function CombatScreen() {
  const match = useGame((s) => s.match)!;
  const profile = useGame((s) => s.profile);
  const settings = useGame((s) => s.settings);
  const finishMatch = useGame((s) => s.finishMatch);
  const exitToMenu = useGame((s) => s.exitToMenu);
  const recordSkillUse = useGame((s) => s.recordSkillUse);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [paused, setPaused] = useState(false);
  const [training, setTraining] = useState<TrainingOptions | undefined>(match.training);
  const sceneRef = useRef<CombatScene | null>(null);
  const finished = useRef(false);

  const config = useMemo<CombatInit>(() => ({
    mode: match.mode,
    arenaId: match.arenaId,
    opponentId: match.opponentId,
    difficulty: match.difficulty,
    rounds: match.rounds,
    timeLimit: match.timeLimit,
    p1: { name: match.mode === 'pvp' ? 'PLAYER 1' : profile.name, loadout: match.mode === 'pvp' ? profile.pvp.p1 : profile.loadout },
    p2: { name: 'PLAYER 2', loadout: profile.pvp.p2 },
    settings,
    training: match.training,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  useEffect(() => {
    const offHud = gameEvents.onHud(setHud);
    const offSkill = gameEvents.onSkillUse((id) => recordSkillUse(id));
    const offOver = gameEvents.onMatchOver((p) => {
      if (finished.current) return;
      finished.current = true;
      finishMatch({
        mode: match.mode,
        winner: p.winner,
        opponentId: match.opponentId,
        difficulty: match.difficulty,
        damageDealt: p.damageDealt,
        damageTaken: p.damageTaken,
        highestCombo: p.highestCombo,
        durationMs: p.durationMs,
        rounds: p.rounds,
        bossId: match.bossId,
      });
    });
    return () => { offHud(); offSkill(); offOver(); };
  }, [finishMatch, match, recordSkillUse]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const applyTraining = useCallback((patch: Partial<TrainingOptions>) => {
    setTraining((prev) => {
      const next = { ...(prev ?? match.training!), ...patch };
      sceneRef.current?.setTrainingOptions(next);
      return next;
    });
  }, [match.training]);

  const p1Keys = [settings.bindingsP1.skill1, settings.bindingsP1.skill2, settings.bindingsP1.skill3]
    .map((k) => k.replace('Key', ''));

  const myWeapon = getWeapon(profile.loadout.weapon);
  const lvl = levelFromXp(profile.xp);
  const xpPct = Math.min(100, (lvl.into / Math.max(1, lvl.need)) * 100);

  const virtualSkill = useCallback((i: number) => {
    const key = (['skill1', 'skill2', 'skill3'] as const)[i];
    sceneRef.current?.setVirtualInput(1, { [key]: true });
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <GameCanvas config={config} paused={paused} trainingOptions={training}
        onSceneReady={(s) => { sceneRef.current = s; }} />

      {/* ---------------- HUD ---------------- */}
      {hud && (
        <CombatHud
          hud={hud}
          weaponName={myWeapon.name}
          weaponRarity={myWeapon.rarity}
          xpPct={xpPct}
          xpInto={lvl.into}
          xpNeed={lvl.need}
          skillKeys={p1Keys}
          onPause={() => setPaused(true)}
          onSkill={virtualSkill}
        />
      )}


      {/* ---------------- Training HUD ---------------- */}
      {match.mode === 'training' && training && !paused && (
        <div className="absolute right-4 top-1/2 w-56 -translate-y-1/2">
          <Panel title="Training" className="space-y-2 p-3">
            {([
              ['showHitboxes', 'Hitboxes'],
              ['showFrameData', 'Frame data'],
              ['noCooldowns', 'No cooldowns'],
              ['slowMotion', 'Slow motion'],
              ['infiniteHealth', 'Dummy immortal'],
            ] as const).map(([key, label]) => (
              <button key={key} onClick={() => applyTraining({ [key]: !training[key] } as Partial<TrainingOptions>)}
                className={`flex w-full items-center gap-2 border px-2 py-1 text-left text-xs ${training[key] ? 'border-cyan-300/50 bg-cyan-500/10 text-white' : 'border-white/10 text-slate-400'}`}>
                <span className={`h-3 w-3 border ${training[key] ? 'border-cyan-300 bg-cyan-400' : 'border-white/30'}`} />
                {label}
              </button>
            ))}
            <div className="flex flex-col gap-1 pt-1">
              <span className="text-[10px] uppercase tracking-widest text-slate-500">Dummy</span>
              <div className="grid grid-cols-2 gap-1">
                {(['idle', 'block', 'walk', 'attack'] as const).map((b) => (
                  <button key={b} onClick={() => applyTraining({ dummyBehavior: b })}
                    className={`border px-1 py-1 text-[11px] capitalize ${training.dummyBehavior === b ? 'border-violet-400/60 bg-violet-600/20 text-white' : 'border-white/10 text-slate-400'}`}>
                    {b}
                  </button>
                ))}
              </div>
            </div>
            <Button full variant="ghost" onClick={() => sceneRef.current?.resetTraining()}>Reset positions</Button>
          </Panel>
        </div>
      )}

      {/* ---------------- Pause ---------------- */}
      {paused && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <Panel title="Paused" className="w-80 space-y-2 p-5">
            <Button full onClick={() => setPaused(false)}>Resume</Button>
            <Button full variant="ghost" onClick={() => { sceneRef.current?.resetTraining(); setPaused(false); }}>
              Reset positions
            </Button>
            <div className="space-y-2 border-t border-white/10 pt-3">
              {([['masterVolume', 'Master'], ['musicVolume', 'Music'], ['sfxVolume', 'SFX']] as const).map(([k, label]) => (
                <label key={k} className="block text-xs text-slate-400">
                  {label}
                  <input type="range" min={0} max={1} step={0.05} value={settings[k]}
                    onChange={(e) => useGame.getState().updateSettings({ [k]: Number(e.target.value) })}
                    className="w-full accent-violet-500" />
                </label>
              ))}
            </div>
            <Button full variant="danger" onClick={() => { finished.current = true; exitToMenu(); }}>Quit to menu</Button>
            <p className="pt-1 text-center text-[10px] text-slate-500">Esc toggles pause</p>
          </Panel>
        </div>
      )}
    </div>
  );
}
