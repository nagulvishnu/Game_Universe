import { useState } from 'react';
import type { ReactNode } from 'react';
import { useGame } from '../stores/gameStore';
import { ScreenShell, Button, Panel, Tag, RARITY_COLOR, hexStr } from './shared';
import { OPPONENTS, DIFFICULTIES, type Difficulty, type AIStyle } from '../data/fighters';
import { ARENAS, type ArenaDef } from '../data/arenas';
import { BOSSES } from '../data/bosses';
import { getWeapon, displayStats } from '../data/weapons';
import { SKILL_BY_ID } from '../data/skills';
import { FighterPreview } from './FighterPreview';
import { WeaponGlyph } from './WeaponGlyph';
import {
  IconChevronLeft, IconChevronRight, IconCrossedSwords, IconLock, IconGrid,
  IconSword, IconSparkles, IconShield, IconBolt, IconFootprints, IconTarget,
} from './Icons';

/* ---------------------------------------------------------------- helpers */

const STYLE_LABEL: Record<AIStyle, string> = {
  aggressive: 'Savage · Relentless',
  defensive: 'Iron · Unbreakable',
  balanced: 'Agile · Precise',
  ranged: 'Patient · Precise',
  specialist: 'Exotic · Lethal',
  boss: 'Shadow · Sovereign',
};

function hexOf(n: number) {
  return '#' + n.toString(16).padStart(6, '0');
}

/** Shared shape of the fighter and boss rosters. */
interface RosterEntry {
  id: string;
  name: string;
  title: string;
  weapon: string;
  unlockLevel: number;
}

function ArenaThumb({ arena, selected, onClick }: { arena: ArenaDef; selected: boolean; onClick: () => void }) {
  const accent = hexOf(arena.accent);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="ss-tile group relative w-full cursor-pointer text-left"
      data-active={selected ? 'true' : 'false'}
      style={selected ? { borderColor: accent, boxShadow: `0 0 16px ${accent}55` } : undefined}
    >
      <div
        className="ss-arena-thumb h-[54px] w-full"
        style={{ background: `linear-gradient(180deg, ${hexOf(arena.skyTop)}, ${hexOf(arena.skyBottom)})` }}
      >
        {/* moon */}
        <div
          className="absolute rounded-full"
          style={{
            width: 30, height: 30, right: 12, top: 6,
            background: `radial-gradient(circle at 38% 32%, ${accent}, ${accent}33 55%, transparent 72%)`,
            boxShadow: `0 0 18px ${accent}88`,
          }}
        />
        {/* far ridge */}
        <svg className="absolute inset-x-0 bottom-0 h-9 w-full opacity-90" viewBox="0 0 120 36" preserveAspectRatio="none">
          <path d="M0 36V20h12v-7h8v7h16v-11h10v11h18v-6h10v6h20v-14h12v14h14v-5h8v5h12v15z" fill={hexOf(arena.floorColor)} opacity="0.75" />
        </svg>
        {/* near ground */}
        <div
          className="absolute inset-x-0 bottom-0 h-[24%]"
          style={{ background: `linear-gradient(0deg, ${hexOf(arena.floorColor)}, transparent)` }}
        />
        <svg className="absolute inset-x-0 bottom-0 h-4 w-full opacity-90" viewBox="0 0 120 16" preserveAspectRatio="none">
          <path d="M0 16V9h10v-4h6v4h14v-6h8v6h16v-3h10v3h18v-7h9v7h15v-3h8v3h6v7z" fill={hexOf(arena.floorColor)} />
        </svg>
        {/* accent rim light */}
        <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: `${accent}66` }} />
      </div>
      <div className={`px-1.5 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wide ${selected ? 'text-white' : 'text-slate-300'}`}>
        {arena.name}
      </div>
    </div>
  );
}

function StatRow({ label, value, color, icon }: { label: string; value: number; color: string; icon?: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[16px] shrink-0" style={{ color }}>{icon}</span>
      <span className="w-[74px] shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <span className="ss-stat-bar flex-1">
        <span style={{ width: `${value}%`, background: `linear-gradient(90deg, ${color}, ${color}88)`, boxShadow: `0 0 8px ${color}88` }} />
      </span>
      <span className="w-6 shrink-0 text-right text-[11px] font-bold text-white">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------ fight select */

export function FightSelection() {
  const setScreen = useGame((s) => s.setScreen);
  const startMatch = useGame((s) => s.startMatch);
  const profile = useGame((s) => s.profile);
  const [view, setView] = useState<'opponents' | 'bosses'>('opponents');
  const [opponent, setOpponent] = useState(OPPONENTS[0].id);
  const [bossId, setBossId] = useState<string>('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [arena, setArena] = useState(ARENAS[0].id);
  const [rounds, setRounds] = useState(3);
  const [showAll, setShowAll] = useState(false);

  const opp = OPPONENTS.find((o) => o.id === opponent)!;
  const boss = BOSSES.find((b) => b.id === bossId);
  const isBoss = view === 'bosses';
  const enemyName = isBoss ? boss?.name ?? '—' : opp.name;
  const enemyTitle = isBoss ? boss?.title ?? '' : opp.title;
  const enemyWeapon = isBoss ? boss?.weapon ?? 'shadow_katana' : opp.weapon;
  const enemyBody = isBoss ? boss?.bodyColor ?? 0x14141c : opp.bodyColor;
  const enemyEye = isBoss ? boss?.eyeColor ?? 0x7fd4ff : opp.eyeColor;
  const enemyHp = isBoss ? boss?.maxHealth ?? 100 : opp.maxHealth;
  const enemySkills: string[] = isBoss ? (boss?.skills ?? []) : opp.skills;
  const enemyStyle: AIStyle = isBoss ? 'boss' : opp.style;
  const tuning = isBoss
    ? { aggression: 0.7, blockChance: 0.6, dodgeChance: 0.6, skillUse: 0.7 }
    : opp.tuning;

  const unlockLevel = isBoss ? boss?.unlockLevel ?? 99 : opp.unlockLevel;
  const locked = profile.level < unlockLevel;

  const weapon = getWeapon(enemyWeapon);
  const stats = displayStats(weapon);
  const myWeapon = getWeapon(profile.loadout.weapon);
  const roster: RosterEntry[] = isBoss ? BOSSES : OPPONENTS;
  const visibleRoster = showAll ? roster : roster.slice(0, 5);

  const start = () => startMatch({
    mode: 'fight',
    opponentId: isBoss ? (bossId || BOSSES[0].id) : opponent,
    difficulty,
    arenaId: arena,
    rounds,
    timeLimit: 99,
    bossId: isBoss ? (bossId || BOSSES[0].id) : undefined,
  });

  return (
    <ScreenShell
      title="Fight"
      subtitle="Choose your opponent, difficulty and arena"
      onBack={() => setScreen('menu')}
      right={<span className="flex items-center gap-1 text-sm font-bold text-cyan-300">🜛 {profile.shards.toLocaleString()}</span>}
    >
      <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
        {/* ---------------------------------------------- opponents --- */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="ss-label">Opponents</span>
            <span className="text-[10px] font-bold text-slate-400">{roster.length}/{roster.length}</span>
          </div>

          <div className="flex gap-1">
            {(['opponents', 'bosses'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`flex-1 rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-widest transition ${
                  view === v ? 'border-violet-400/60 bg-violet-900/30 text-violet-200' : 'border-white/10 text-slate-500 hover:text-slate-300'
                }`}
              >
                {v === 'opponents' ? 'Fighters' : 'Bosses'}
              </button>
            ))}
          </div>

          <div className="ss-scroll max-h-[46vh] space-y-1 overflow-y-auto pr-1">
            {visibleRoster.map((o) => {
              const oLock = profile.level < o.unlockLevel;
              const oWeapon = getWeapon(o.weapon);
              const selected = isBoss ? bossId === o.id : opponent === o.id;
              return (
                <button
                  key={o.id}
                  onClick={() => (isBoss ? setBossId(o.id) : setOpponent(o.id))}
                  className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1 text-left transition ${
                    selected
                      ? 'border-violet-400/70 bg-violet-700/30 shadow-[0_0_16px_rgba(168,85,247,0.28)]'
                      : 'border-transparent hover:border-white/10 hover:bg-white/5'
                  } ${oLock ? 'opacity-45' : ''}`}
                >
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-md border"
                    style={{
                      borderColor: selected ? hexOf(oWeapon.glow) : 'rgba(255,255,255,0.14)',
                      background: `radial-gradient(circle at 50% 30%, ${hexOf(oWeapon.glow)}33, rgba(10,10,20,0.9))`,
                    }}
                  >
                    <WeaponGlyph shape={oWeapon.shape} size={24} color={hexOf(oWeapon.color)} glow={hexOf(oWeapon.glow)} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-extrabold uppercase tracking-wide text-white">{o.name}</span>
                    <span className="block truncate text-[10px] text-slate-400">{o.title}</span>
                  </span>
                  {oLock && <IconLock size={13} className="shrink-0 text-slate-500" />}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setShowAll((v) => !v)}
            className="ss-ghost-btn flex w-full items-center justify-center gap-2 py-2 text-[10px]"
          >
            <IconGrid size={13} /> {showAll ? 'Show fewer' : 'View all opponents'}
            <IconChevronRight size={12} />
          </button>
        </div>

        {/* ----------------------------------------------- preview ----- */}
        <div className="space-y-3">
          {/* character card */}
          <div className="ss-panel relative h-[268px] overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_45%,rgba(168,85,247,0.34),transparent_58%),linear-gradient(120deg,rgba(24,12,44,0.9),rgba(8,6,16,0.95))]" />
            <div
              className="ss-moon pointer-events-none"
              style={{ width: 168, height: 168, right: '13%', top: 14 }}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[26%] bg-[radial-gradient(ellipse_at_72%_120%,rgba(168,85,247,0.35),transparent_70%)]" />
            <div className="relative flex h-full">
              <div className="flex min-w-0 flex-1 flex-col justify-center p-4">
                <h2 className="ss-title text-[34px] leading-none tracking-[0.1em] text-white">{enemyName}</h2>
                <p className="mt-1 text-sm text-violet-200/80">{enemyTitle}</p>
                <p className="mt-2 max-w-[280px] text-[11px] leading-relaxed text-slate-400">
                  {isBoss ? boss?.description : opp.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Tag color="#ff8a3a">HP {enemyHp}</Tag>
                  <Tag color={RARITY_COLOR[weapon.rarity]}>{weapon.name}</Tag>
                  <Tag color="#66e0ff">Reward ×{(isBoss ? 2.2 : opp.rewardMul).toFixed(1)}</Tag>
                </div>
              </div>
              <div className="pointer-events-none relative hidden w-[42%] items-end justify-center sm:flex">
                <FighterPreview
                  weaponId={enemyWeapon}
                  bodyColor={enemyBody}
                  eyeColor={enemyEye}
                  equipment={[]}
                  fighterId={isBoss ? 'oblivion' : opp.id}
                  width={210}
                  height={250}
                  transparent
                  fill
                />
              </div>
            </div>
          </div>

          {/* fighting style */}
          <div className="ss-panel p-3">
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-[150px]">
                <div className="ss-label">Fighting style</div>
                <div className="mt-0.5 text-sm font-bold text-white">{STYLE_LABEL[enemyStyle]}</div>
              </div>
              <div className="flex flex-1 flex-wrap gap-4">
                {([
                  ['Aggression', tuning.aggression],
                  ['Block', tuning.blockChance],
                  ['Skillful', tuning.skillUse],
                ] as const).map(([label, v]) => (
                  <div key={label} className="min-w-[92px]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
                    <div className="mt-0.5 text-sm font-extrabold text-violet-200">{Math.round(v * 100)}%</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5">
                <span className="grid h-8 w-8 place-items-center rounded border border-violet-400/30 bg-violet-900/20 text-violet-200"><IconSword size={14} /></span>
                <span className="grid h-8 w-8 place-items-center rounded border border-cyan-400/30 bg-cyan-900/20 text-cyan-200"><IconShield size={14} /></span>
                <span className="grid h-8 w-8 place-items-center rounded border border-fuchsia-400/30 bg-fuchsia-900/20 text-fuchsia-200"><IconBolt size={14} /></span>
              </div>
            </div>
          </div>

          {/* difficulty */}
          <div className="ss-panel p-3">
            <div className="ss-label mb-2">Difficulty</div>
            <div className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => {
                const p = DIFFICULTIES[d];
                const active = difficulty === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className="ss-tile rounded-lg p-2.5 text-left"
                    data-active="false"
                    style={active ? {
                      borderColor: 'rgba(34,211,238,0.8)',
                      background: 'linear-gradient(180deg, rgba(34,211,238,0.16), rgba(8,10,22,0.9))',
                      boxShadow: '0 0 20px rgba(34,211,238,0.28)',
                    } : undefined}
                  >
                    <div className={`text-[15px] font-extrabold uppercase tracking-wide ${active ? 'text-cyan-200' : 'text-white'}`}>{p.label}</div>
                    <div className="mt-0.5 text-[10px] leading-snug text-slate-400">{p.description}</div>
                    <div className="mt-1 text-[9px] uppercase tracking-wider text-slate-500">
                      Aggression {Math.round(p.aggressionMul * 100)}% · Dodge {Math.round(p.defenseMul * 100)}%
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* arena */}
          <div className="ss-panel p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="ss-label">Arena</span>
              <span className="text-[10px] font-bold text-slate-400">{ARENAS.findIndex((a) => a.id === arena) + 1}/{ARENAS.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="grid h-8 w-6 place-items-center text-slate-500 hover:text-white"
                onClick={() => setArena(ARENAS[Math.max(0, ARENAS.findIndex((a) => a.id === arena) - 1)].id)}
              >
                <IconChevronLeft size={16} />
              </button>
              <div className="grid flex-1 grid-cols-4 gap-2">
                {ARENAS.map((a) => (
                  <ArenaThumb key={a.id} arena={a} selected={a.id === arena} onClick={() => setArena(a.id)} />
                ))}
              </div>
              <button
                className="grid h-8 w-6 place-items-center text-slate-500 hover:text-white"
                onClick={() => setArena(ARENAS[Math.min(ARENAS.length - 1, ARENAS.findIndex((a) => a.id === arena) + 1)].id)}
              >
                <IconChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* -------------------------------------------- side column ---- */}
        <div className="space-y-3">
          {/* stats */}
          <div className="ss-panel p-3">
            <div className="ss-label mb-1.5">Stats</div>
            <div className="space-y-1">
              <StatRow label="Damage" value={stats.damage} color="#ff8a3a" icon={<IconSword size={11} />} />
              <StatRow label="Speed" value={stats.speed} color="#22d3ee" icon={<IconBolt size={11} />} />
              <StatRow label="Range" value={stats.range} color="#a855f7" icon={<IconTarget size={11} />} />
              <StatRow label="Recovery" value={stats.recovery} color="#6cf0c0" icon={<IconFootprints size={11} />} />
              <StatRow label="Knockback" value={stats.knockback} color="#ff4a70" icon={<IconCrossedSwords size={11} />} />
            </div>
          </div>

          {/* weapons & skills */}
          <div className="ss-panel p-3">
            <div className="ss-label mb-2">Weapons &amp; skills</div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center gap-2 rounded border border-white/8 bg-black/30 px-2 py-1.5">
                <WeaponGlyph shape={weapon.shape} size={22} color={hexOf(weapon.color)} glow={hexOf(weapon.glow)} />
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-bold text-white">{weapon.name}</span>
                  <span className="block text-[8px] uppercase tracking-widest text-cyan-400/80">Primary</span>
                </span>
              </div>
              {enemySkills.slice(0, 3).map((id, i) => {
                const s = SKILL_BY_ID[id];
                if (!s) return null;
                return (
                  <div key={id} className="flex items-center gap-2 rounded border border-white/8 bg-black/30 px-2 py-1.5">
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center rounded"
                      style={{ background: `${hexOf(s.color)}22`, border: `1px solid ${hexOf(s.color)}66`, color: hexOf(s.color) }}
                    >
                      <IconSparkles size={12} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[10px] font-bold text-white">{s.name}</span>
                      <span className="block text-[8px] uppercase tracking-widest text-slate-500">({['E', 'R', 'V'][i]})</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* your fighter */}
          <div className="ss-panel p-3">
            <div className="ss-label mb-1.5">Your fighter</div>
            <div className="relative overflow-hidden rounded border border-white/8 bg-[radial-gradient(circle_at_50%_28%,rgba(168,85,247,0.22),rgba(6,6,14,0.92)_68%)]">
              <div className="flex items-end justify-center">
                <FighterPreview
                  weaponId={profile.loadout.weapon}
                  bodyColor={profile.look.variant === 'light' ? 0x1c1c2a : 0x08080f}
                  eyeColor={profile.look.accent}
                  equipment={Object.values(profile.loadout.equipment)}
                  fighterId="kage"
                  width={170}
                  height={132}
                  transparent
                  fill
                />
              </div>
              <div className="flex items-center justify-center gap-1.5 border-t border-white/8 bg-black/50 py-1.5">
                <span className="rounded bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-200">
                  {myWeapon.name}
                </span>
                <span className="h-4 w-px bg-white/10" />
                {profile.loadout.skills.map((id) => {
                  const s = SKILL_BY_ID[id];
                  if (!s) return null;
                  return (
                    <span
                      key={id}
                      className="grid h-6 w-6 place-items-center rounded"
                      style={{ background: `${hexOf(s.color)}22`, border: `1px solid ${hexOf(s.color)}66` }}
                      title={s.name}
                    >
                      <IconSparkles size={12} className="text-white/80" />
                    </span>
                  );
                })}
              </div>
            </div>
            <Button full variant="ghost" className="mt-2 text-[10px]" onClick={() => setScreen('loadout')}>
              Edit loadout
            </Button>
          </div>

          {/* rounds + start */}
          <div className="ss-panel p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="ss-label">Rounds</span>
              <div className="flex gap-1">
                {[1, 3, 5].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRounds(r)}
                    className={`h-6 w-6 rounded border text-[11px] font-bold transition ${
                      rounds === r ? 'border-cyan-300/70 bg-cyan-500/15 text-cyan-200' : 'border-white/12 text-slate-400 hover:text-white'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={start}
              disabled={locked}
              className="ss-neon-btn flex w-full items-center justify-center gap-2 py-2.5 text-[12px] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconCrossedSwords size={16} />
              {locked ? `Unlocks at level ${unlockLevel}` : 'Start match'}
            </button>
          </div>
        </div>
      </div>
    </ScreenShell>
  );
}

/* ---------------------------------------------------------------- local pvp */

export function PvpMenu() {
  const setScreen = useGame((s) => s.setScreen);
  const startMatch = useGame((s) => s.startMatch);
  const profile = useGame((s) => s.profile);
  const settings = useGame((s) => s.settings);
  const [arena, setArena] = useState(ARENAS[0].id);
  const [rounds, setRounds] = useState(3);

  return (
    <ScreenShell title="Local PvP" subtitle="Two players, one keyboard — friendly matches grant no competitive rewards"
      onBack={() => setScreen('menu')}>
      <div className="grid gap-4 lg:grid-cols-2">
        {(['p1', 'p2'] as const).map((who, idx) => {
          const l = who === 'p1' ? profile.pvp.p1 : profile.pvp.p2;
          const b = who === 'p1' ? settings.bindingsP1 : settings.bindingsP2;
          return (
            <Panel key={who} title={who === 'p1' ? 'Player 1' : 'Player 2'} className="space-y-3 p-4">
              <div className="flex gap-4">
                <FighterPreview
                  weaponId={l.weapon} bodyColor={idx === 0 ? 0x0d0d14 : 0x14101c}
                  eyeColor={idx === 0 ? 0x7fd4ff : 0xff5a7a}
                  equipment={Object.values(l.equipment)} fighterId={idx === 0 ? 'kage' : 'raze'} width={180} height={200}
                />
                <div className="min-w-0 flex-1 space-y-2 text-xs">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Tag color={RARITY_COLOR[getWeapon(l.weapon).rarity]}>{getWeapon(l.weapon).name}</Tag>
                    {l.skills.map((id, i) => {
                      const s = SKILL_BY_ID[id];
                      return <Tag key={i} color={s ? hexStr(s.color) : '#888'}>{['E', 'R', 'V'][i]}: {s?.name ?? '—'}</Tag>;
                    })}
                  </div>
                  <div className="space-y-1 border-t border-white/10 pt-2 text-[11px] text-slate-400">
                    <div>Move: {b.left} / {b.right} · Jump: {b.jump} · Crouch: {b.crouch}</div>
                    <div>Attack: {b.attack} (hold = charge)</div>
                    <div>Skills: {b.skill1} / {b.skill2} / {b.skill3}</div>
                    <div>Dodge: {b.dodge} · Block: {b.block}</div>
                  </div>
                  <button className="text-[11px] text-cyan-300 hover:underline" onClick={() => setScreen('settings')}>remap keys</button>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
      <Panel title="Arena" className="mt-5 grid gap-2 p-3 sm:grid-cols-4">
        {ARENAS.map((a) => (
          <ArenaThumb key={a.id} arena={a} selected={arena === a.id} onClick={() => setArena(a.id)} />
        ))}
      </Panel>
      <div className="mt-5 flex items-center gap-3">
        <span className="text-xs text-slate-400">Rounds</span>
        {[1, 3, 5].map((r) => (
          <button key={r} onClick={() => setRounds(r)}
            className={`rounded-lg border px-3 py-1 text-xs ${rounds === r ? 'border-cyan-300/60 bg-cyan-500/10 text-white' : 'border-white/10 text-slate-400'}`}>{r}</button>
        ))}
        <Button className="ml-auto" onClick={() => startMatch({
          mode: 'pvp', opponentId: 'kage', difficulty: 'medium', arenaId: arena, rounds, timeLimit: 99,
        })}>Start Versus</Button>
      </div>
    </ScreenShell>
  );
}

/* ---------------------------------------------------------------- training */

export function TrainingMenu() {
  const setScreen = useGame((s) => s.setScreen);
  const startMatch = useGame((s) => s.startMatch);
  const profile = useGame((s) => s.profile);
  const [arena, setArena] = useState(ARENAS[0].id);
  const [behavior, setBehavior] = useState<'idle' | 'block' | 'walk' | 'attack'>('idle');
  const [noCooldowns, setNoCooldowns] = useState(true);
  const [showHitboxes, setShowHitboxes] = useState(true);
  const [showFrameData, setShowFrameData] = useState(true);
  const [slowMotion, setSlowMotion] = useState(false);
  const [infiniteHealth, setInfiniteHealth] = useState(true);

  const toggle = (label: string, v: boolean, set: (b: boolean) => void, desc: string) => (
    <button onClick={() => set(!v)} className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${v ? 'border-cyan-300/50 bg-cyan-500/10' : 'border-white/10 hover:bg-white/5'}`}>
      <span className={`mt-0.5 h-4 w-4 shrink-0 rounded border ${v ? 'border-cyan-300 bg-cyan-400' : 'border-white/30'}`} />
      <span>
        <span className="block text-sm font-semibold text-white">{label}</span>
        <span className="block text-[11px] text-slate-400">{desc}</span>
      </span>
    </button>
  );

  return (
    <ScreenShell title="Training" subtitle="No rewards are earned here — pure practice" onBack={() => setScreen('menu')}>
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Panel title="Dummy behaviour" className="grid gap-2 p-3 sm:grid-cols-4">
            {(['idle', 'block', 'walk', 'attack'] as const).map((b) => (
              <button key={b} onClick={() => setBehavior(b)}
                className={`rounded-lg border p-3 text-center text-sm capitalize transition ${behavior === b ? 'border-violet-400/60 bg-violet-600/15 text-white' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}>
                {b}
              </button>
            ))}
          </Panel>
          <Panel title="Options" className="grid gap-2 p-3 sm:grid-cols-2">
            {toggle('Unlimited cooldowns', noCooldowns, setNoCooldowns, 'Skills are always ready')}
            {toggle('Hitbox / hurtbox view', showHitboxes, setShowHitboxes, 'Shows active hitboxes and weapon range')}
            {toggle('Frame data overlay', showFrameData, setShowFrameData, 'Startup / active / recovery readout')}
            {toggle('Slow motion', slowMotion, setSlowMotion, 'Runs the match at 40% speed')}
            {toggle('Dummy never dies', infiniteHealth, setInfiniteHealth, 'Health resets after every hit')}
          </Panel>
          <Panel title="Arena" className="grid gap-2 p-3 sm:grid-cols-4">
            {ARENAS.map((a) => (
              <ArenaThumb key={a.id} arena={a} selected={arena === a.id} onClick={() => setArena(a.id)} />
            ))}
          </Panel>
        </div>
        <Panel title="Fighter" className="space-y-3 p-4">
          <FighterPreview weaponId={profile.loadout.weapon} bodyColor={0x0d0d14} eyeColor={0x7fd4ff}
            equipment={Object.values(profile.loadout.equipment)} fighterId="kage" width={240} height={230} />
          <Button full onClick={() => startMatch({
            mode: 'training', opponentId: 'kage', difficulty: 'easy', arenaId: arena, rounds: 1, timeLimit: 999,
            training: { dummyBehavior: behavior, noCooldowns, showHitboxes, showFrameData, slowMotion, infiniteHealth },
          })}>Enter Training</Button>
        </Panel>
      </div>
    </ScreenShell>
  );
}
