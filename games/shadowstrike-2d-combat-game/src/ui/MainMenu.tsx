import { useEffect } from 'react';
import type { ComponentType } from 'react';
import { useGame } from '../stores/gameStore';
import { levelFromXp } from '../save/save';
import { audio } from '../game/audio/AudioManager';
import { SKILLS } from '../data/skills';
import { WEAPONS } from '../data/weapons';
import { FighterPreview } from './FighterPreview';
import {
  IconSword, IconSparkles, IconCrossedSwords, IconShield, IconLayers, IconPerson, IconGear,
  IconPlay, IconChevronRight, IconGem, IconPlus, IconTarget, IconDumbbell, SilhouetteFigure,
} from './Icons';

type Screen = Parameters<ReturnType<typeof useGame.getState>['setScreen']>[0];
type IconCmp = ComponentType<{ size?: number; className?: string }>;

interface NavEntry {
  id: Screen;
  label: string;
  caption: string;
  Icon: IconCmp;
  /** Primary action — rendered as the filled, highlighted card. */
  primary?: boolean;
}

const NAV: NavEntry[] = [
  { id: 'fight-select', label: 'Play', caption: 'Fight · PvP · Training', Icon: IconSword, primary: true },
  { id: 'skills', label: 'Skills', caption: 'Master your abilities', Icon: IconSparkles },
  { id: 'weapons', label: 'Weapons', caption: 'Arsenal and upgrades', Icon: IconCrossedSwords },
  { id: 'equipment', label: 'Equipment', caption: 'Gear & cosmetics', Icon: IconShield },
  { id: 'loadout', label: 'Loadout', caption: 'Build your perfect setup', Icon: IconLayers },
  { id: 'profile', label: 'Profile', caption: 'Stats & achievements', Icon: IconPerson },
  { id: 'settings', label: 'Settings', caption: 'Audio · Controls · Display', Icon: IconGear },
];

const MODE_CARDS: { id: Screen; label: string; caption: string; art: string; accent: string; Icon: IconCmp }[] = [
  { id: 'fight-select', label: 'Fight', caption: 'Battle all opponents', art: 'from-violet-900/70 via-fuchsia-950/40 to-transparent', accent: '#e879f9', Icon: IconCrossedSwords },
  { id: 'pvp-select', label: 'Local PvP', caption: 'Two players, one keyboard', art: 'from-blue-900/70 via-cyan-950/40 to-transparent', accent: '#38bdf8', Icon: IconDumbbell },
  { id: 'training-select', label: 'Training', caption: 'Practice & improve', art: 'from-emerald-900/60 via-teal-950/40 to-transparent', accent: '#2dd4bf', Icon: IconTarget },
];

const TILES: { id: Screen; label: string; caption: string; Icon: IconCmp }[] = [
  { id: 'skills', label: 'Skills', caption: 'Unlock & upgrade', Icon: IconSparkles },
  { id: 'weapons', label: 'Weapons', caption: 'Discover new weapons', Icon: IconCrossedSwords },
  { id: 'equipment', label: 'Equipment', caption: 'Gear & cosmetics', Icon: IconShield },
  { id: 'loadout', label: 'Loadout', caption: 'Manage your setup', Icon: IconLayers },
  { id: 'profile', label: 'Profile', caption: 'Your journey', Icon: IconPerson },
  { id: 'settings', label: 'Settings', caption: 'Game preferences', Icon: IconGear },
];

const EMBERS = [
  { x: 6, y: 78, d: 0, s: 1 }, { x: 14, y: 62, d: 1.4, s: 0.7 }, { x: 22, y: 88, d: 2.6, s: 1.3 },
  { x: 30, y: 70, d: 0.7, s: 0.6 }, { x: 38, y: 84, d: 3.1, s: 1 }, { x: 45, y: 60, d: 1.9, s: 0.8 },
  { x: 52, y: 90, d: 2.2, s: 1.2 }, { x: 58, y: 74, d: 0.3, s: 0.6 }, { x: 64, y: 86, d: 2.9, s: 0.9 },
  { x: 70, y: 66, d: 1.1, s: 1.1 }, { x: 76, y: 88, d: 3.4, s: 0.7 }, { x: 82, y: 72, d: 0.9, s: 1.2 },
  { x: 88, y: 92, d: 2.4, s: 0.8 }, { x: 93, y: 64, d: 1.6, s: 1 }, { x: 97, y: 84, d: 3.7, s: 0.6 },
];

export function MainMenu() {
  const setScreen = useGame((s) => s.setScreen);
  const showToast = useGame((s) => s.showToast);
  const profile = useGame((s) => s.profile);
  const lvl = levelFromXp(profile.xp);

  const bodyColor = profile.look.variant === 'light' ? 0x1c1c2a : 0x08080f;
  const accent = profile.look.accent;

  useEffect(() => {
    audio.startMusic('menu');
    return () => audio.stopMusic();
  }, []);

  const go = (id: Screen) => {
    audio.init();
    audio.play('ui');
    setScreen(id);
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-y-auto bg-[#070810] lg:flex-row lg:overflow-hidden">
      {/* ------------------------------------------------ backdrop ---- */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_36%_40%,rgba(150,15,70,0.55),transparent_60%),radial-gradient(circle_at_55%_30%,rgba(255,60,130,0.18),transparent_45%),radial-gradient(circle_at_12%_88%,rgba(42,8,69,0.55),transparent_55%),linear-gradient(180deg,#070810_0%,#0b0614_45%,#140410_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-[38%] bg-[linear-gradient(0deg,rgba(20,4,16,0.95),transparent)]" />
        {/* neon skyline */}
        <svg className="absolute inset-x-0 bottom-0 h-[46%] w-full opacity-45" viewBox="0 0 1200 300" preserveAspectRatio="none">
          <path d="M0 300V196h38v-34h26v34h40v-62h30v62h54v-40h24v40h52v-92h36v92h48v-52h28v52h60v-30h40v30h46v-74h34v74h56v-46h26v46h52v-104h44v104h58v-36h30v36h66v-58h28v58h54v-44h38v44h60v300Z" fill="#05040c" />
          <path d="M0 300V228h120v-24h90v96h150v-52h110v52h130v-38h140v38h140v-70h120v70h120v-44h90v44z" fill="#07050f" />
        </svg>
        {/* pagoda */}
        <svg className="absolute bottom-0 left-[56%] h-[40%] w-[130px] opacity-80" viewBox="0 0 120 200" preserveAspectRatio="xMidYMax meet">
          <g fill="#05040c">
            <path d="M60 0 96 24H24Z" />
            <rect x="40" y="24" width="40" height="14" />
            <path d="M14 44H106L118 58H2Z" />
            <rect x="40" y="58" width="40" height="14" />
            <path d="M22 78H98L110 92H10Z" />
            <rect x="42" y="92" width="36" height="14" />
            <path d="M30 112H90L100 124H20Z" />
            <rect x="46" y="124" width="28" height="14" />
            <path d="M38 144H82L90 154H30Z" />
            <rect x="44" y="154" width="32" height="46" />
          </g>
        </svg>
        {EMBERS.map((e, i) => (
          <span
            key={i}
            className="absolute h-[3px] w-[3px] rounded-full bg-fuchsia-300/80"
            style={{
              left: `${e.x}%`, top: `${e.y}%`, opacity: 0.7,
              animation: `ss-ember 3.2s ${e.d}s ease-in-out infinite`,
              ['--s' as string]: e.s,
            }}
          />
        ))}
      </div>

      {/* ------------------------------------------------- hero stage --- */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col lg:min-h-0">
        {/* logo */}
        <div className="ss-fade pointer-events-none absolute left-6 top-6 z-20 select-none">
          <h1 className="ss-wordmark text-[clamp(2.8rem,5.6vw,4.8rem)]">SHADOWSTRIKE</h1>
          <p className="mt-1.5 text-[9px] font-bold tracking-[3.5px] text-[#8a91b4]">NEON SHADOW COMBAT</p>
        </div>

        {/* hero character */}
        <div className="pointer-events-none absolute inset-y-0 left-[17%] right-[1%] hidden items-center justify-center lg:flex">
          <div className="relative grid h-[min(560px,88vh)] w-[500px] place-items-end justify-items-center">
            <div className="absolute inset-x-0 bottom-0 h-[26%] bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.26),transparent_70%)]" />
            <FighterPreview
              weaponId={profile.loadout.weapon}
              bodyColor={bodyColor}
              eyeColor={accent}
              equipment={Object.values(profile.loadout.equipment)}
              fighterId="kage"
              width={500}
              height={500}
              transparent
              fill
              zoom={0.78}
            />
          </div>
        </div>

        {/* nav rail */}
        <nav className="ss-fade relative z-20 mt-40 flex min-w-0 flex-1 flex-col justify-center gap-1.5 px-6 pb-24 sm:mt-32">
          {NAV.map((e, i) => {
            const inner = (
              <>
                <span className={`ss-nav-icon shrink-0 transition-colors ${e.primary ? 'text-white' : 'text-[#8a91b4]'}`}>
                  <e.Icon size={21} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold uppercase tracking-[0.5px] text-white">{e.label}</span>
                  <span className="block truncate text-[11px] text-[#a5accf]">{e.caption}</span>
                </span>
                {e.primary && <IconChevronRight size={18} className="shrink-0 text-white/90" />}
              </>
            );
            return (
              <button
                key={e.id}
                onClick={() => go(e.id)}
                className={`${e.primary ? 'ss-nav-primary max-w-[300px]' : 'ss-nav-row max-w-[290px]'} group flex w-full items-center text-left`}
                style={{ animation: `ss-fade-up 0.3s ${i * 40}ms ease-out both` }}
              >
                {inner}
              </button>
            );
          })}
        </nav>

        {/* tagline */}
        <p className="ss-fade pointer-events-none absolute bottom-6 left-8 z-20 text-[10px] font-semibold tracking-[0.36em] text-cyan-200/60">
          A SHADOW STRIKES. A LEGEND RISES.
        </p>
      </div>

      {/* ------------------------------------------------- right rail --- */}
      <aside className="relative z-10 flex w-full shrink-0 flex-col gap-3 border-t border-[#1e2640] bg-[#0b0e1a]/60 p-4 backdrop-blur-md lg:h-full lg:w-[384px] lg:border-l lg:border-t-0">
        {/* floating panel: profile + stats + modes + tiles */}
        <div className="ss-panel ss-scroll flex w-full flex-col gap-3 overflow-y-auto p-4 lg:min-h-0 lg:flex-1">
          {/* profile row */}
          <div className="flex items-center gap-3">
            <div className="ss-portrait h-12 w-12 shrink-0" style={{ borderColor: '#ff3b55', boxShadow: '0 0 18px rgba(255,59,85,0.45), inset 0 0 14px rgba(0,0,0,0.8)' }}>
              <IconSword size={20} className="text-[#00f0ff]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="truncate text-[15px] font-extrabold tracking-wide text-white">{profile.name}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#00f0ff]">Lv. {lvl.level}</span>
              </div>
              <div className="relative mt-1 h-[7px] w-full overflow-hidden rounded-full bg-[#151828]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#2563eb] to-[#22d3ee]"
                  style={{ width: `${Math.min(100, (lvl.into / Math.max(1, lvl.need)) * 100)}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-end gap-1 text-[9px] font-semibold text-[#8a91b4]">
                {lvl.into} / {lvl.need} XP
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-lg border border-[#1f243b] bg-[#151828]/90 px-2 py-1.5">
              <span className="flex items-center gap-1 text-sm font-extrabold text-white">
                <IconGem size={15} className="text-[#ffb800]" /> {profile.shards.toLocaleString()}
              </span>
              <button
                onClick={() => showToast('Shards are earned in matches')}
                className="grid h-6 w-6 place-items-center rounded-md border border-[#00f0ff]/50 bg-[#00f0ff]/10 text-[#00f0ff] transition hover:bg-[#00f0ff]/20"
                title="Earn shards in matches"
              >
                <IconPlus size={12} />
              </button>
            </div>
          </div>

          {/* stats */}
          <div className="grid grid-cols-5 gap-1 border-b border-white/5 px-1 pb-2">
            {([
              ['Wins', profile.stats.wins],
              ['Losses', profile.stats.losses],
              ['Best Combo', profile.stats.highestCombo],
              ['Weapons', `${profile.unlockedWeapons.length}/${WEAPONS.length}`],
              ['Skills', `${profile.unlockedSkills.length}/${SKILLS.length}`],
            ] as const).map(([label, value]) => (
              <div key={label} className="text-center">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
                <div className="mt-0.5 text-sm font-extrabold text-white">{value}</div>
              </div>
            ))}
          </div>

          {/* mode cards */}
          <div className="grid grid-cols-3 gap-2.5">
            {MODE_CARDS.map((m) => (
              <button
                key={m.id}
                onClick={() => go(m.id)}
                className="cyber-card group relative overflow-hidden p-0 text-left h-[118px] w-full"
                data-active="false"
                style={{ borderColor: `${m.accent}55`, boxShadow: `0 0 14px ${m.accent}22` }}
              >
                <div className={`relative flex h-full items-center justify-center bg-gradient-to-b ${m.art}`}>
                  <SilhouetteFigure size={92} color="#0a0614" accent={m.accent} className="translate-y-1 opacity-90 transition-transform group-hover:scale-110" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.14),transparent_60%)]" />
                  <div className="absolute bottom-0 inset-x-0 bg-[rgba(8,10,18,0.88)] px-2 py-1.5">
                    <div className="text-[13px] font-extrabold uppercase tracking-[1px] text-white">{m.label}</div>
                    <div className="text-[9px] leading-tight text-[#8a91b4]">{m.caption}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* feature tiles */}
          <div className="grid grid-cols-3 gap-2.5">
            {TILES.map((t) => (
              <button
                key={t.id}
                onClick={() => go(t.id)}
                className="cyber-card group px-3 py-3 text-left"
                data-active="false"
              >
                <t.Icon size={17} className="text-[#00f0ff] transition-colors group-hover:text-[#bd00ff]" />
                <div className="mt-1.5 text-[13px] font-extrabold uppercase tracking-[0.5px] text-[#7deefd] transition-colors group-hover:text-white">{t.label}</div>
                <div className="text-[9px] leading-tight text-[#8a91b4]">{t.caption}</div>
              </button>
            ))}
          </div>
        </div>

        {/* actions below the panel */}
        <div className="flex gap-2">
          <button onClick={() => go('fight-select')} className="btn-primary-glow flex flex-1 items-center justify-center gap-2 py-3 text-[13px] tracking-[0.16em]">
            <IconPlay size={15} /> QUICK FIGHT
          </button>
          <button
            onClick={() => go('training-select')}
            className="flex flex-1 items-center justify-center border border-white/15 bg-white/5 py-3 text-[13px] font-bold uppercase tracking-[0.16em] text-slate-200 rounded-[10px] transition hover:border-[#00f0ff]/60 hover:text-white"
          >
            PRACTICE
          </button>
        </div>
      </aside>
    </div>
  );
}
