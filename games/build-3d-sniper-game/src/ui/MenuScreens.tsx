import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Compass,
  Crosshair,
  FileText,
  Lock,
  Play,
  RefreshCw,
  RotateCcw,
  Settings,
  Shield,
  Sliders,
  Trophy,
  Zap,
} from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { AMMO_TYPES, DEFAULT_LOADOUT_CONFIG, getEquipmentById } from '../data/customization';
import {
  CAMPAIGN_MISSIONS,
  CONTRACT_OPERATIONS,
  createModeMission,
  getDailyContracts,
} from '../data/missions';
import { getWeaponById, WEAPONS } from '../data/weapons';
import {
  ACHIEVEMENTS_LIST,
  getRankTitle,
  xpRequiredForRank,
} from '../save/storage';
import {
  BiomeId,
  GameModeId,
  GameSettings,
  KeyBindings,
  MissionDefinition,
  MissionResultSummary,
  PlayerSaveData,
  ScreenName,
} from '../types/game';
import { ProceduralRifle } from '../weapons/ProceduralRifle';
import { BIOME_PALETTES } from '../world/WorldBuilder';

// ============================================================================
// 1. MAIN MENU SCREEN (WITH LIVE 3D RIFLE DIORAMA & INSTANT PLAY)
// ============================================================================
export const MainMenuScreen: React.FC<{
  save: PlayerSaveData;
  onNavigate: (screen: ScreenName) => void;
  onQuickPlayMission: (mission: MissionDefinition) => void;
  onResetConfirm: () => void;
}> = ({ save, onNavigate, onQuickPlayMission, onResetConfirm }) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const equippedWeapon = getWeaponById(save.equippedWeaponId);
  const loadout = {
    ...DEFAULT_LOADOUT_CONFIG,
    ...(save.weaponLoadouts[equippedWeapon.id] ?? {}),
  };

  // Determine next uncompleted campaign mission for "CONTINUE / INSTANT DEPLOY"
  const nextCampaignMission =
    CAMPAIGN_MISSIONS.find((m) => !save.missionRecords[m.id]?.completed) ??
    CAMPAIGN_MISSIONS[CAMPAIGN_MISSIONS.length - 1];

  const completedCampaignCount = CAMPAIGN_MISSIONS.filter(
    (m) => save.missionRecords[m.id]?.completed
  ).length;

  return (
    <div className="fixed inset-0 bg-zinc-950 text-zinc-100 overflow-hidden flex flex-col justify-between z-20">
      {/* Live 3D Background Showcase Canvas */}
      <div className="fixed inset-0 opacity-85 pointer-events-none">
        <Canvas camera={{ position: [1.25, 0.32, 1.05], fov: 42 }}>
          <color attach="background" args={['#07090d']} />
          <fog attach="fog" args={['#07090d', 2.5, 9]} />
          <ambientLight intensity={0.85} />
          <directionalLight position={[4, 5, 3]} intensity={2.3} color="#fde68a" />
          <directionalLight position={[-4, 2, -2]} intensity={1.3} color="#38bdf8" />
          <group position={[0.35, -0.04, -0.1]} rotation={[0.06, -Math.PI / 2.6, 0.03]}>
            <ProceduralRifle weapon={equippedWeapon} loadout={loadout} scale={1.15} />
          </group>
        </Canvas>
      </div>

      {/* Subtle Vignette Gradient */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(7,9,13,0.94) 0%, rgba(7,9,13,0.68) 52%, rgba(7,9,13,0.35) 100%)',
        }}
      />

      {/* Top Operator Profile Strip */}
      <header className="relative z-10 px-6 md:px-12 pt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/50 flex items-center justify-center">
            <Crosshair className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="text-[11px] font-mono tracking-[0.28em] text-amber-400">
              COVERT PRECISION TASK FORCE
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              SNIPER: <span className="text-amber-400">DEADLINE</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-zinc-900/85 backdrop-blur-md border border-zinc-800 px-4 py-2 rounded-xl font-mono text-xs">
          <div>
            <div className="text-[10px] text-zinc-400">RANK {save.rank} // {getRankTitle(save.rank)}</div>
            <div className="text-amber-400 font-bold">
              ₵ {save.credits.toLocaleString()} CREDITS • {save.xp.toLocaleString()} XP
            </div>
          </div>
          <div className="h-7 w-[1px] bg-zinc-800" />
          <div className="text-right">
            <div className="text-[10px] text-zinc-400">ACTIVE RIFLE</div>
            <div className="text-white font-bold">{equippedWeapon.name}</div>
          </div>
        </div>
      </header>

      {/* Center Menu Column */}
      <main className="relative z-10 px-6 md:px-12 my-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-6 space-y-3 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/60 border border-red-500/40 text-[11px] font-mono text-red-300">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            BLACK MERIDIAN SYNDICATE ACTIVE • {completedCampaignCount}/12 OPS COMPLETE
          </div>

          {/* Primary Instant Action CTA */}
          <button
            onClick={() => {
              soundEngine.playUiTone('objective');
              onQuickPlayMission(nextCampaignMission);
            }}
            className="w-full group p-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-yellow-300 text-zinc-950 flex items-center justify-between shadow-[0_0_30px_rgba(245,158,11,0.3)] transition cursor-pointer"
          >
            <div className="text-left">
              <div className="text-[10px] font-mono font-black tracking-widest opacity-80">
                {save.hasStartedGame ? 'CONTINUE CAMPAIGN OPERATION' : 'INSTANT DEPLOY // START CAMPAIGN'}
              </div>
              <div className="text-lg font-black tracking-wide">
                {nextCampaignMission.codeName}: {nextCampaignMission.title}
              </div>
            </div>
            <Play className="w-7 h-7 fill-zinc-950 shrink-0 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Navigation Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <MenuNavButton
              icon={<Compass className="w-4 h-4 text-amber-400" />}
              title="CAMPAIGN MAP"
              subtitle="12 Black Meridian Story Ops"
              onClick={() => onNavigate('campaign_map')}
            />
            <MenuNavButton
              icon={<Sliders className="w-4 h-4 text-cyan-400" />}
              title="3D WEAPON WORKSHOP"
              subtitle="15 Rifles, Optics, Camo & Gear"
              onClick={() => onNavigate('weapon_workshop')}
            />
            <MenuNavButton
              icon={<Zap className="w-4 h-4 text-emerald-400" />}
              title="GAME MODES (8)"
              subtitle="Free Roam, Survival, Longshot, Stealth"
              onClick={() => onNavigate('game_modes')}
            />
            <MenuNavButton
              icon={<FileText className="w-4 h-4 text-purple-400" />}
              title="CONTRACT BOARD"
              subtitle="10 Contracts + Daily Challenges"
              onClick={() => onNavigate('contract_board')}
            />
            <MenuNavButton
              icon={<Award className="w-4 h-4 text-yellow-400" />}
              title="PROGRESSION & BADGES"
              subtitle="Service Record, Ranks & Unlocks"
              onClick={() => onNavigate('progression')}
            />
            <MenuNavButton
              icon={<Trophy className="w-4 h-4 text-amber-300" />}
              title="HIGH SCORES"
              subtitle="Local Precision Leaderboard"
              onClick={() => onNavigate('leaderboard')}
            />
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            <button
              onClick={() => {
                soundEngine.playUiTone('click');
                onNavigate('settings');
              }}
              className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-xs font-mono text-zinc-200 flex items-center justify-center gap-2 transition"
            >
              <Settings className="w-4 h-4 text-zinc-400" />
              <span>CONTROLS, GRAPHICS & AUDIO SETTINGS</span>
            </button>

            {!confirmReset ? (
              <button
                onClick={() => setConfirmReset(true)}
                className="py-2.5 px-3.5 rounded-xl bg-zinc-900/70 hover:bg-red-950/60 border border-zinc-800 hover:border-red-500/40 text-xs font-mono text-zinc-400 hover:text-red-300 transition"
              >
                NEW GAME / RESET
              </button>
            ) : (
              <div className="flex items-center gap-1.5 bg-red-950/80 border border-red-500/60 px-3 py-1.5 rounded-xl">
                <span className="text-[11px] font-mono text-red-200">Reset save?</span>
                <button
                  onClick={() => {
                    onResetConfirm();
                    setConfirmReset(false);
                  }}
                  className="px-2 py-1 rounded bg-red-600 text-white text-[11px] font-mono font-bold"
                >
                  YES
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="px-2 py-1 rounded bg-zinc-800 text-zinc-300 text-[11px] font-mono"
                >
                  NO
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Quick Briefing Card */}
        <div className="hidden lg:flex lg:col-span-6 justify-end">
          <div className="w-80 bg-zinc-950/80 backdrop-blur-md border border-zinc-800/90 rounded-2xl p-5 space-y-3">
            <div className="text-[10px] font-mono tracking-widest text-cyan-400">
              FIELD CONTROLS QUICK GUIDE
            </div>
            <div className="space-y-1.5 text-xs font-mono text-zinc-300">
              <div className="flex justify-between">
                <span className="text-zinc-400">Move / Sprint</span>
                <span>WASD / Shift</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Scope Aim / Zoom</span>
                <span>Right Click / Wheel</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Fire Rifle</span>
                <span>Left Click</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Steady Breath</span>
                <span>Shift / Space (Scoped)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Recon Binoculars</span>
                <span>[Q] Auto-Mark</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">1st / 3rd Person</span>
                <span>[V] Camera Toggle</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Crouch / Reload</span>
                <span>[C] / [R]</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Mobile / Touch</span>
                <span className="text-amber-400">Twin-Stick Ready</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Status Footer */}
      <footer className="relative z-10 px-6 md:px-12 pb-4 flex flex-wrap items-center justify-between text-[11px] font-mono text-zinc-500">
        <span>SNIPER: DEADLINE v2.0 • LOCAL BALLISTICS & AI SIMULATION ENGINE</span>
        <span>CAREER LONGEST SHOT: {save.lifetimeStats.longestShotMeters}M • CAREER KILLS: {save.lifetimeStats.totalKills}</span>
      </footer>
    </div>
  );
};

const MenuNavButton: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}> = ({ icon, title, subtitle, onClick }) => (
  <button
    onClick={() => {
      soundEngine.playUiTone('click');
      onClick();
    }}
    className="p-3.5 rounded-xl bg-zinc-900/85 hover:bg-zinc-800/95 border border-zinc-800 hover:border-amber-500/50 text-left transition cursor-pointer group"
  >
    <div className="flex items-center gap-2 font-mono text-xs font-bold text-white group-hover:text-amber-300">
      {icon}
      <span>{title}</span>
    </div>
    <div className="text-[11px] text-zinc-400 mt-1">{subtitle}</div>
  </button>
);

// ============================================================================
// 2. CAMPAIGN MAP & MISSION BRIEFING SCREENS
// ============================================================================
export const CampaignMapScreen: React.FC<{
  save: PlayerSaveData;
  onSelectMission: (mission: MissionDefinition) => void;
  onBack: () => void;
}> = ({ save, onSelectMission, onBack }) => {
  // Mission 1 & 2 always open right away so players can either do range training OR jump immediately into live forest combat!
  // Subsequent missions unlock sequentially as prior mission completes (plus free access if completed).
  const isUnlocked = (idx: number): boolean => {
    if (idx <= 2) return true;
    const prev = CAMPAIGN_MISSIONS[idx - 2];
    return Boolean(save.missionRecords[prev.id]?.completed);
  };

  return (
    <div className="fixed inset-0 bg-zinc-950 text-zinc-100 flex flex-col tactical-grid z-30">
      <ScreenTopBar
        title="BLACK MERIDIAN CAMPAIGN"
        subtitle="12 CONNECTED STORY OPERATIONS ACROSS 6 GLOBAL THEATERS"
        credits={save.credits}
        onBack={onBack}
      />

      <div className="flex-1 overflow-y-auto p-6 max-w-6xl w-full mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CAMPAIGN_MISSIONS.map((m) => {
          const idx = m.campaignIndex ?? 1;
          const unlocked = isUnlocked(idx);
          const rec = save.missionRecords[m.id];

          return (
            <div
              key={m.id}
              onClick={() => {
                if (!unlocked) return;
                soundEngine.playUiTone('click');
                onSelectMission(m);
              }}
              className={`p-4 rounded-xl border flex flex-col justify-between transition ${
                unlocked
                  ? 'bg-zinc-900/80 border-zinc-800 hover:border-amber-500 cursor-pointer'
                  : 'bg-zinc-950/60 border-zinc-900 opacity-55 cursor-not-allowed'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-xs font-mono mb-2">
                  <span className="text-amber-400 font-bold">{m.codeName}</span>
                  {rec?.completed ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black">
                      GRADE {rec.bestGrade}
                    </span>
                  ) : unlocked ? (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                      READY
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-zinc-500">
                      <Lock className="w-3 h-3" /> OP-0{idx - 1} REQ
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-black text-white">{m.title}</h3>
                <div className="text-[11px] font-mono text-cyan-400 mt-0.5">
                  {BIOME_PALETTES[m.biome].name} • {m.timeOfDay.toUpperCase()} • {m.weather.toUpperCase()}
                </div>
                <p className="text-xs text-zinc-400 mt-2 line-clamp-3">{m.briefingText}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs font-mono">
                <span className="text-amber-300">₵{m.baseRewardCredits} • +{m.baseRewardXp}XP</span>
                {rec?.completed && (
                  <span className="text-zinc-400">BEST: {rec.bestScore.toLocaleString()}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const MissionBriefingScreen: React.FC<{
  mission: MissionDefinition;
  save: PlayerSaveData;
  onStart: () => void;
  onOpenWorkshop: () => void;
  onBack: () => void;
}> = ({ mission, save, onStart, onOpenWorkshop, onBack }) => {
  const weapon = getWeaponById(save.equippedWeaponId);
  const eq1 = getEquipmentById(save.equippedSlots[0]);
  const eq2 = getEquipmentById(save.equippedSlots[1]);

  return (
    <div className="fixed inset-0 bg-zinc-950 text-zinc-100 flex flex-col tactical-grid z-30">
      <ScreenTopBar
        title={mission.title.toUpperCase()}
        subtitle={`${mission.codeName} // ${mission.subtitle}`}
        credits={save.credits}
        onBack={onBack}
      />

      <div className="flex-1 overflow-y-auto p-6 max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start my-auto">
        <div className="lg:col-span-7 bg-zinc-900/85 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded bg-zinc-950 border border-zinc-700 text-amber-300">
              THEATER: {BIOME_PALETTES[mission.biome].name}
            </span>
            <span className="px-2.5 py-1 rounded bg-zinc-950 border border-zinc-700 text-sky-300">
              CONDITIONS: {mission.timeOfDay.toUpperCase()} / {mission.weather.toUpperCase()}
            </span>
            <span className="px-2.5 py-1 rounded bg-zinc-950 border border-zinc-700 text-emerald-300">
              WIND: {mission.windX >= 0 ? '+' : ''}
              {mission.windX} m/s
            </span>
          </div>

          <p className="text-sm text-zinc-200 leading-relaxed">{mission.briefingText}</p>

          <div className="p-3.5 rounded-xl bg-amber-950/25 border border-amber-500/30 text-xs font-mono text-amber-200 italic">
            {mission.commanderDialogue}
          </div>

          <div className="space-y-2 pt-2">
            <div className="text-xs font-mono uppercase tracking-wider text-zinc-400">
              Mission Objectives
            </div>
            {mission.objectives.map((obj) => (
              <div
                key={obj.id}
                className="flex items-center justify-between bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 rounded-lg text-xs font-mono"
              >
                <span className={obj.optional ? 'text-zinc-300' : 'text-white font-bold'}>
                  {obj.optional ? '[BONUS] ' : '[PRIMARY] '}
                  {obj.title}
                </span>
                <span className="text-amber-400">x{obj.targetCount}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Loadout Confirmation & Deploy Box */}
        <div className="lg:col-span-5 bg-zinc-900/85 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="text-xs font-mono uppercase tracking-wider text-amber-400">
            Active Operator Loadout
          </div>

          <div className="space-y-2.5 text-xs font-mono">
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex justify-between items-center">
              <div>
                <div className="text-zinc-400 text-[10px]">PRIMARY PRECISION RIFLE</div>
                <div className="text-white font-bold text-sm">{weapon.name}</div>
              </div>
              <span className="text-amber-400">{weapon.tier}</span>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex justify-between items-center">
              <div>
                <div className="text-zinc-400 text-[10px]">AMMUNITION LOAD</div>
                <div className="text-cyan-300 font-bold">
                  {AMMO_TYPES[save.equippedAmmo]?.name ?? 'Standard Match'}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
              <div className="text-zinc-400 text-[10px]">TACTICAL GADGETS</div>
              <div className="text-zinc-200 mt-1">
                [Q] Recon Binoculars • [1] {eq1.name} • [2] {eq2.name}
              </div>
            </div>
          </div>

          <button
            onClick={onOpenWorkshop}
            className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-mono font-bold text-zinc-100 transition"
          >
            CUSTOMIZE RIFLE / OPTICS IN WORKSHOP
          </button>

          <button
            onClick={() => {
              soundEngine.playUiTone('objective');
              onStart();
            }}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-yellow-300 text-zinc-950 font-mono text-sm font-black tracking-wider shadow-[0_0_25px_rgba(245,158,11,0.35)] transition cursor-pointer"
          >
            DEPLOY INTO AO →
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. GAME MODES (8 PLAYABLE MODES + 6-BIOME SANDBOX PICKER)
// ============================================================================
export const GameModesScreen: React.FC<{
  save: PlayerSaveData;
  onSelectMission: (mission: MissionDefinition) => void;
  onNavigate: (screen: ScreenName) => void;
  onBack: () => void;
}> = ({ save, onSelectMission, onNavigate, onBack }) => {
  const [selectedBiome, setSelectedBiome] = useState<BiomeId>('forest_outpost');

  const modes: {
    id: GameModeId;
    title: string;
    desc: string;
    action: () => void;
  }[] = [
    {
      id: 'campaign',
      title: '1. Campaign Mode',
      desc: '12 story operations hunting Black Meridian leadership across 6 global environments.',
      action: () => onNavigate('campaign_map'),
    },
    {
      id: 'free_sniper',
      title: '2. Free Sniper Sandbox',
      desc: 'Explore any of the 6 3D biomes freely with unlimited ammo, moving steel targets, and live patrols.',
      action: () => onSelectMission(createModeMission('free_sniper', selectedBiome)),
    },
    {
      id: 'precision_challenge',
      title: '3. Precision Challenge',
      desc: 'Hit moving and static steel targets under strict accuracy and time constraints.',
      action: () => onSelectMission(createModeMission('precision_challenge')),
    },
    {
      id: 'survival',
      title: '4. Survival Siege',
      desc: 'Hold your sniper overwatch against 4 escalating waves of shock troops and counter-snipers.',
      action: () => onSelectMission(createModeMission('survival')),
    },
    {
      id: 'stealth_ops',
      title: '5. Stealth Operations',
      desc: 'Strict zero-alarm covert infiltrations where unsuppressed mistakes fail the operation.',
      action: () => onSelectMission(createModeMission('stealth_ops')),
    },
    {
      id: 'time_attack',
      title: '6. Time Attack Blitz',
      desc: 'Race the 90-second deadline clock across multi-elevation harbor targets.',
      action: () => onSelectMission(createModeMission('time_attack')),
    },
    {
      id: 'longshot_trials',
      title: '7. Longshot Trials (200m+)',
      desc: 'Extreme-distance alpine ballistics testing bullet drop and 6.5 m/s crosswind holdover.',
      action: () => onSelectMission(createModeMission('longshot_trials')),
    },
    {
      id: 'daily_contracts',
      title: '8. Daily Contracts',
      desc: 'Locally rotating high-payout daily operations with +35% bonus credits & XP.',
      action: () => onNavigate('contract_board'),
    },
  ];

  return (
    <div className="fixed inset-0 bg-zinc-950 text-zinc-100 flex flex-col tactical-grid z-30">
      <ScreenTopBar
        title="GAME MODES"
        subtitle="ALL 8 PLAYABLE TACTICAL MODES UNLOCKED & READY"
        credits={save.credits}
        onBack={onBack}
      />

      <div className="flex-1 overflow-y-auto p-6 max-w-6xl w-full mx-auto space-y-6">
        {/* Biome Picker for Free Sniper Sandbox */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-mono">
            <span className="text-emerald-400 font-bold">FREE SNIPER BIOME SELECTOR: </span>
            <span className="text-zinc-400">Choose theater for Free Sniper Sandbox</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(BIOME_PALETTES) as BiomeId[]).map((bKey) => (
              <button
                key={bKey}
                onClick={() => setSelectedBiome(bKey)}
                className={`px-3 py-1.5 rounded text-xs font-mono border transition ${
                  selectedBiome === bKey
                    ? 'bg-emerald-500 text-zinc-950 border-emerald-400 font-bold'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-600'
                }`}
              >
                {BIOME_PALETTES[bKey].name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {modes.map((m) => (
            <div
              key={m.id}
              onClick={() => {
                soundEngine.playUiTone('click');
                m.action();
              }}
              className="p-5 rounded-xl bg-zinc-900/85 border border-zinc-800 hover:border-amber-500 cursor-pointer flex flex-col justify-between transition group"
            >
              <div>
                <h3 className="font-bold text-base text-white group-hover:text-amber-300">
                  {m.title}
                </h3>
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{m.desc}</p>
              </div>
              <div className="mt-5 pt-3 border-t border-zinc-800 text-xs font-mono text-amber-400 font-bold flex items-center justify-between">
                <span>LAUNCH MODE</span>
                <span>→</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. CONTRACT BOARD (10 CONTRACTS + ROTATING DAILY CONTRACTS)
// ============================================================================
export const ContractBoardScreen: React.FC<{
  save: PlayerSaveData;
  onSelectMission: (mission: MissionDefinition) => void;
  onBack: () => void;
}> = ({ save, onSelectMission, onBack }) => {
  const dailies = getDailyContracts();

  return (
    <div className="fixed inset-0 bg-zinc-950 text-zinc-100 flex flex-col tactical-grid z-30">
      <ScreenTopBar
        title="MERCENARY CONTRACT BOARD"
        subtitle="DAILY ROTATING BOUNTIES & SPECIALIZED PRECISION OPERATIONS"
        credits={save.credits}
        onBack={onBack}
      />

      <div className="flex-1 overflow-y-auto p-6 max-w-6xl w-full mx-auto space-y-6">
        <div>
          <h2 className="text-xs font-mono tracking-widest text-amber-400 uppercase mb-3 flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Today's Local Rotating Daily Contracts (+35% Bonus Bounty)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dailies.map((con) => {
              const done = save.missionRecords[con.mission.id]?.completed;
              return (
                <div
                  key={con.id}
                  onClick={() => onSelectMission(con.mission)}
                  className="p-4 rounded-xl bg-gradient-to-b from-amber-950/30 to-zinc-900 border border-amber-500/40 hover:border-amber-400 cursor-pointer flex flex-col justify-between transition"
                >
                  <div>
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-amber-300 font-bold">{con.category.toUpperCase()}</span>
                      {done && <span className="text-emerald-400">✓ COMPLETED</span>}
                    </div>
                    <h3 className="text-base font-black text-white mt-1">{con.title}</h3>
                    <p className="text-xs text-zinc-300 mt-1.5">{con.description}</p>
                  </div>
                  <div className="mt-4 pt-2.5 border-t border-zinc-800 flex justify-between text-xs font-mono text-amber-400 font-bold">
                    <span>₵{con.rewardCredits}</span>
                    <span>+{con.rewardXp} XP</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="text-xs font-mono tracking-widest text-cyan-400 uppercase mb-3">
            Standing Tactical Contracts (10 Operations)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CONTRACT_OPERATIONS.map((con) => {
              const done = save.missionRecords[con.mission.id]?.completed;
              return (
                <div
                  key={con.id}
                  onClick={() => onSelectMission(con.mission)}
                  className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-cyan-400 cursor-pointer flex flex-col justify-between transition"
                >
                  <div>
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-cyan-400">{con.category.toUpperCase()}</span>
                      {done && (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> CLEARED
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-white mt-1">{con.title}</h3>
                    <p className="text-xs text-zinc-400 mt-1.5">{con.description}</p>
                  </div>
                  <div className="mt-4 pt-2.5 border-t border-zinc-800 flex justify-between text-xs font-mono text-amber-300">
                    <span>₵{con.rewardCredits}</span>
                    <span>+{con.rewardXp} XP</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 5. PLAYER PROGRESSION & HIGH SCORE LEADERBOARD SCREENS
// ============================================================================
export const ProgressionScreen: React.FC<{
  save: PlayerSaveData;
  onBack: () => void;
}> = ({ save, onBack }) => {
  const nextRankXp = xpRequiredForRank(save.rank + 1);
  const currRankXp = xpRequiredForRank(save.rank);
  const pct = Math.min(
    100,
    Math.round(((save.xp - currRankXp) / Math.max(1, nextRankXp - currRankXp)) * 100)
  );
  const overallAcc =
    save.lifetimeStats.shotsFired > 0
      ? Math.round((save.lifetimeStats.shotsHit / save.lifetimeStats.shotsFired) * 100)
      : 0;

  return (
    <div className="fixed inset-0 bg-zinc-950 text-zinc-100 flex flex-col tactical-grid z-30">
      <ScreenTopBar
        title="OPERATOR SERVICE RECORD"
        subtitle="RANK PROGRESSION, CAREER TELEMETRY & ACHIEVEMENT BADGES"
        credits={save.credits}
        onBack={onBack}
      />

      <div className="flex-1 overflow-y-auto p-6 max-w-5xl w-full mx-auto space-y-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div>
              <div className="text-xs font-mono text-amber-400">CURRENT CLASSIFICATION</div>
              <h2 className="text-2xl font-black text-white">
                RANK {save.rank} — {getRankTitle(save.rank)}
              </h2>
            </div>
            <div className="text-right font-mono text-xs text-zinc-300">
              {save.xp.toLocaleString()} / {nextRankXp.toLocaleString()} XP TO RANK {save.rank + 1}
            </div>
          </div>

          <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-400"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 font-mono">
            <StatMiniBox label="TOTAL KILLS" val={String(save.lifetimeStats.totalKills)} />
            <StatMiniBox label="HEADSHOTS" val={String(save.lifetimeStats.totalHeadshots)} />
            <StatMiniBox label="ACCURACY" val={`${overallAcc}%`} />
            <StatMiniBox label="LONGEST SHOT" val={`${save.lifetimeStats.longestShotMeters}M`} />
            <StatMiniBox label="RIFLES OWNED" val={`${save.unlockedWeapons.length}/${WEAPONS.length}`} />
          </div>
        </div>

        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-amber-400 mb-3">
            Commendation Badges ({save.achievements.length}/{ACHIEVEMENTS_LIST.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ACHIEVEMENTS_LIST.map((ach) => {
              const earned = save.achievements.includes(ach.id);
              return (
                <div
                  key={ach.id}
                  className={`p-4 rounded-xl border flex items-center justify-between ${
                    earned
                      ? 'bg-zinc-900 border-amber-500/60'
                      : 'bg-zinc-950/60 border-zinc-800 opacity-60'
                  }`}
                >
                  <div>
                    <div className="font-bold text-sm text-white flex items-center gap-2">
                      <Award className={`w-4 h-4 ${earned ? 'text-amber-400' : 'text-zinc-500'}`} />
                      {ach.title}
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">{ach.description}</p>
                  </div>
                  <span className="font-mono text-xs text-amber-300 shrink-0 ml-3">
                    {earned ? 'EARNED' : `+₵${ach.rewardCredits}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export const LeaderboardScreen: React.FC<{
  save: PlayerSaveData;
  onBack: () => void;
}> = ({ save, onBack }) => (
  <div className="fixed inset-0 bg-zinc-950 text-zinc-100 flex flex-col tactical-grid z-30">
    <ScreenTopBar
      title="LOCAL HIGH-SCORE TABLE"
      subtitle="TOP TACTICAL PRECISION DEPLOYMENTS"
      credits={save.credits}
      onBack={onBack}
    />
    <div className="flex-1 overflow-y-auto p-6 max-w-5xl w-full mx-auto">
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left font-mono text-xs">
          <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800">
            <tr>
              <th className="py-3.5 px-4">#</th>
              <th className="py-3.5 px-4">OPERATION</th>
              <th className="py-3.5 px-4">RIFLE</th>
              <th className="py-3.5 px-4">LONGEST</th>
              <th className="py-3.5 px-4">ACCURACY</th>
              <th className="py-3.5 px-4">GRADE</th>
              <th className="py-3.5 px-4 text-right">SCORE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {save.highScores.map((entry, i) => (
              <tr key={entry.id} className="hover:bg-zinc-800/40">
                <td className="py-3 px-4 font-bold text-amber-400">#{i + 1}</td>
                <td className="py-3 px-4 text-white font-semibold">{entry.missionTitle}</td>
                <td className="py-3 px-4 text-zinc-300">{entry.weaponName}</td>
                <td className="py-3 px-4 text-cyan-300">{entry.longestShot}m</td>
                <td className="py-3 px-4 text-zinc-300">{entry.accuracy}%</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                    {entry.grade}
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-black text-white">
                  {entry.score.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

// ============================================================================
// 6. SETTINGS & KEYBINDING CUSTOMIZATION SCREEN
// ============================================================================
export const SettingsScreen: React.FC<{
  settings: GameSettings;
  onChangeSettings: (next: GameSettings) => void;
  onBack: () => void;
}> = ({ settings, onChangeSettings, onBack }) => {
  const [listeningKey, setListeningKey] = useState<keyof KeyBindings | null>(null);

  React.useEffect(() => {
    if (!listeningKey) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      onChangeSettings({
        ...settings,
        keyBindings: {
          ...settings.keyBindings,
          [listeningKey]: e.code,
        },
      });
      setListeningKey(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [listeningKey, onChangeSettings, settings]);

  const bindingLabels: { key: keyof KeyBindings; label: string }[] = [
    { key: 'moveForward', label: 'Move Forward' },
    { key: 'moveBackward', label: 'Move Backward' },
    { key: 'moveLeft', label: 'Strafe Left' },
    { key: 'moveRight', label: 'Strafe Right' },
    { key: 'sprint', label: 'Sprint / Steady Breath' },
    { key: 'crouch', label: 'Toggle Crouch' },
    { key: 'reload', label: 'Reload Weapon' },
    { key: 'binoculars', label: 'Recon Binoculars' },
    { key: 'cameraToggle', label: 'Toggle 1st / 3rd Person' },
    { key: 'equipment1', label: 'Use Gadget Slot 1' },
    { key: 'equipment2', label: 'Use Gadget Slot 2' },
    { key: 'ammoCycle', label: 'Cycle Ammo Type' },
  ];

  return (
    <div className="fixed inset-0 bg-zinc-950 text-zinc-100 flex flex-col tactical-grid z-40">
      <ScreenTopBar
        title="SYSTEM & TACTICAL SETTINGS"
        subtitle="MOUSE SENSITIVITY, GRAPHICS QUALITY, AUDIO & CUSTOM KEYBINDINGS"
        onBack={onBack}
      />

      <div className="flex-1 overflow-y-auto p-6 max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls, Graphics & Audio */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5 font-mono text-xs">
          <h3 className="text-amber-400 font-bold uppercase">Aiming, Camera & Graphics</h3>

          <SliderControl
            label={`Hip / Look Sensitivity: ${settings.mouseSensitivity.toFixed(2)}x`}
            value={settings.mouseSensitivity}
            min={0.25}
            max={2.5}
            step={0.05}
            onChange={(v) => onChangeSettings({ ...settings, mouseSensitivity: v })}
          />
          <SliderControl
            label={`Scoped Zoom Sensitivity: ${settings.scopeSensitivity.toFixed(2)}x`}
            value={settings.scopeSensitivity}
            min={0.15}
            max={1.5}
            step={0.05}
            onChange={(v) => onChangeSettings({ ...settings, scopeSensitivity: v })}
          />
          <SliderControl
            label={`Master Volume: ${Math.round(settings.masterVolume * 100)}%`}
            value={settings.masterVolume}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => onChangeSettings({ ...settings, masterVolume: v })}
          />

          <div className="space-y-1.5">
            <div className="text-zinc-300">Graphics Quality Preset</div>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => onChangeSettings({ ...settings, graphicsQuality: q })}
                  className={`py-2 rounded border uppercase font-bold ${
                    settings.graphicsQuality === q
                      ? 'bg-amber-500 text-zinc-950 border-amber-400'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <ToggleRow
              label="Invert Vertical Mouse Look"
              checked={settings.invertY}
              onToggle={() => onChangeSettings({ ...settings, invertY: !settings.invertY })}
            />
            <ToggleRow
              label="Default Third-Person Exploration Camera"
              checked={settings.thirdPersonDefault}
              onToggle={() =>
                onChangeSettings({
                  ...settings,
                  thirdPersonDefault: !settings.thirdPersonDefault,
                })
              }
            />
            <ToggleRow
              label="Scoped Ballistic Drop Reticle Helper"
              checked={settings.showTrajectoryHelper}
              onToggle={() =>
                onChangeSettings({
                  ...settings,
                  showTrajectoryHelper: !settings.showTrajectoryHelper,
                })
              }
            />
            <ToggleRow
              label="Bullet-Time Longshot Killcam Replay"
              checked={settings.enableKillcamReplay}
              onToggle={() =>
                onChangeSettings({
                  ...settings,
                  enableKillcamReplay: !settings.enableKillcamReplay,
                })
              }
            />
            <ToggleRow
              label="Always Show On-Screen Touch Twin-Stick Pad"
              checked={settings.showTouchControls === 'always'}
              onToggle={() =>
                onChangeSettings({
                  ...settings,
                  showTouchControls: settings.showTouchControls === 'always' ? 'auto' : 'always',
                })
              }
            />
          </div>
        </div>

        {/* Remappable Keybindings */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3 font-mono text-xs">
          <h3 className="text-amber-400 font-bold uppercase">
            Customizable Key Bindings (Click to Rebind)
          </h3>
          <div className="space-y-2">
            {bindingLabels.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between bg-zinc-950 border border-zinc-800 px-3.5 py-2 rounded-lg"
              >
                <span className="text-zinc-300">{item.label}</span>
                <button
                  onClick={() => setListeningKey(item.key)}
                  className={`px-3 py-1 rounded border font-bold ${
                    listeningKey === item.key
                      ? 'bg-amber-500 text-zinc-950 border-amber-300 animate-pulse'
                      : 'bg-zinc-900 border-zinc-700 text-amber-300 hover:border-amber-500'
                  }`}
                >
                  {listeningKey === item.key ? 'PRESS ANY KEY...' : settings.keyBindings[item.key]}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 7. PAUSE OVERLAY & POST-MISSION VICTORY / DEFEAT RESULT SCREEN
// ============================================================================
export const PauseOverlay: React.FC<{
  missionTitle: string;
  onResume: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onQuitToMenu: () => void;
}> = ({ missionTitle, onResume, onRestart, onOpenSettings, onQuitToMenu }) => (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-40 p-4">
    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-7 max-w-md w-full space-y-4 text-center shadow-2xl">
      <div className="text-xs font-mono tracking-widest text-amber-400">OPERATION PAUSED</div>
      <h2 className="text-2xl font-black text-white">{missionTitle}</h2>

      <div className="space-y-2.5 pt-2 font-mono text-xs">
        <button
          onClick={onResume}
          className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black tracking-wider"
        >
          RESUME OPERATION
        </button>
        <button
          onClick={onRestart}
          className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4 text-amber-400" /> INSTANT RESTART MISSION
        </button>
        <button
          onClick={onOpenSettings}
          className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold"
        >
          SETTINGS & CONTROLS
        </button>
        <button
          onClick={onQuitToMenu}
          className="w-full py-3 rounded-xl bg-red-950/60 hover:bg-red-900/70 border border-red-500/40 text-red-200 font-bold"
        >
          ABORT TO HQ MENU
        </button>
      </div>
    </div>
  </div>
);

export const MissionResultScreen: React.FC<{
  result: MissionResultSummary;
  onReplay: () => void;
  onNextMission: (() => void) | null;
  onOpenWorkshop: () => void;
  onReturnMenu: () => void;
}> = ({ result, onReplay, onNextMission, onOpenWorkshop, onReturnMenu }) => (
  <div className="fixed inset-0 bg-zinc-950/95 text-zinc-100 flex items-center justify-center p-6 tactical-grid z-40 overflow-y-auto">
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-7 max-w-2xl w-full space-y-5 shadow-2xl my-auto">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <div
            className={`text-xs font-mono tracking-[0.25em] font-bold ${
              result.victory ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {result.victory ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED'}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white mt-0.5">
            {result.mission.title}
          </h2>
        </div>

        {result.victory && (
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border-2 border-amber-400 flex flex-col items-center justify-center">
            <span className="text-[9px] font-mono text-amber-300">GRADE</span>
            <span className="text-3xl font-black text-amber-400">{result.grade}</span>
          </div>
        )}
      </div>

      <p className="text-sm text-zinc-300 leading-relaxed">
        {result.victory ? result.mission.debriefSuccess : result.failureReason}
      </p>

      {/* Telemetry Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <StatMiniBox label="FINAL SCORE" val={result.score.toLocaleString()} />
        <StatMiniBox label="ACCURACY" val={`${result.accuracy}% (${result.shotsHit}/${result.shotsFired})`} />
        <StatMiniBox label="HEADSHOTS / KILLS" val={`${result.headshots} / ${result.kills}`} />
        <StatMiniBox label="LONGEST SHOT" val={`${result.longestShot}M`} />
        <StatMiniBox label="TIME ELAPSED" val={`${result.timeSeconds}s`} />
        <StatMiniBox label="COMBAT ALARMS" val={String(result.alarmsTriggered)} />
        <StatMiniBox label="CREDITS EARNED" val={`+₵${result.creditsEarned}`} />
        <StatMiniBox label="XP EARNED" val={`+${result.xpEarned} XP`} />
      </div>

      {(result.rankedUpTo || result.newAchievements.length > 0) && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs font-mono text-emerald-200 space-y-1">
          {result.rankedUpTo && (
            <div className="font-bold text-amber-300">
              ★ PROMOTED TO RANK {result.rankedUpTo}: {getRankTitle(result.rankedUpTo)}!
              {result.newlyUnlockedWeapons.length > 0 &&
                ` Unlocked in Armory: ${result.newlyUnlockedWeapons.join(', ')}`}
            </div>
          )}
          {result.newAchievements.map((a) => (
            <div key={a}>★ COMMENDATION UNLOCKED: {a}</div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 font-mono text-xs">
        {result.victory && onNextMission ? (
          <button
            onClick={onNextMission}
            className="py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black tracking-wider cursor-pointer"
          >
            NEXT CAMPAIGN OPERATION →
          </button>
        ) : (
          <button
            onClick={onReplay}
            className="py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black tracking-wider cursor-pointer"
          >
            INSTANT RETRY MISSION ↻
          </button>
        )}

        <button
          onClick={onOpenWorkshop}
          className="py-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-cyan-300 font-bold"
        >
          UPGRADE IN WEAPON WORKSHOP
        </button>

        {result.victory && (
          <button
            onClick={onReplay}
            className="py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold"
          >
            REPLAY FOR HIGHER GRADE
          </button>
        )}

        <button
          onClick={onReturnMenu}
          className="py-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold"
        >
          RETURN TO HQ MENU
        </button>
      </div>
    </div>
  </div>
);

// Shared Subcomponents
const ScreenTopBar: React.FC<{
  title: string;
  subtitle: string;
  credits?: number;
  onBack: () => void;
}> = ({ title, subtitle, credits, onBack }) => (
  <header className="h-16 border-b border-zinc-800/90 bg-zinc-950/90 px-6 flex items-center justify-between shrink-0">
    <div className="flex items-center gap-4">
      <button
        onClick={() => {
          soundEngine.playUiTone('click');
          onBack();
        }}
        className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono flex items-center gap-2 transition cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4 text-amber-400" />
        <span>BACK</span>
      </button>
      <div>
        <div className="text-[10px] font-mono tracking-widest text-amber-400">{subtitle}</div>
        <h1 className="text-lg font-black text-white">{title}</h1>
      </div>
    </div>

    {credits !== undefined && (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-1.5 font-mono text-xs">
        <span className="text-zinc-400 mr-2">CREDITS</span>
        <span className="text-amber-400 font-black text-sm">₵ {credits.toLocaleString()}</span>
      </div>
    )}
  </header>
);

const StatMiniBox: React.FC<{ label: string; val: string }> = ({ label, val }) => (
  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
    <div className="text-[10px] text-zinc-400">{label}</div>
    <div className="text-sm font-black text-white mt-0.5">{val}</div>
  </div>
);

const SliderControl: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step, onChange }) => (
  <div className="space-y-1">
    <div className="text-zinc-300">{label}</div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full accent-amber-500 cursor-pointer"
    />
  </div>
);

const ToggleRow: React.FC<{
  label: string;
  checked: boolean;
  onToggle: () => void;
}> = ({ label, checked, onToggle }) => (
  <div
    onClick={onToggle}
    className="flex items-center justify-between bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 rounded-lg cursor-pointer hover:border-zinc-700"
  >
    <span className="text-zinc-200">{label}</span>
    <span
      className={`px-2.5 py-0.5 rounded font-bold text-[10px] ${
        checked ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
      }`}
    >
      {checked ? 'ON' : 'OFF'}
    </span>
  </div>
);

export const LoadingTransitionScreen: React.FC<{ mission: MissionDefinition }> = ({ mission }) => (
  <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center text-center p-6 z-50">
    <Shield className="w-12 h-12 text-amber-400 animate-pulse mb-4" />
    <div className="text-xs font-mono tracking-[0.3em] text-amber-400">{mission.codeName}</div>
    <h2 className="text-3xl font-black text-white mt-1">{mission.title}</h2>
    <p className="text-xs font-mono text-zinc-400 mt-2">
      GENERATING 3D TERRAIN, BALLISTICS AIRSPACE & ENEMY PATROL ROUTES...
    </p>
    <div className="w-64 h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-6">
      <div className="h-full bg-amber-500 w-full animate-pulse" />
    </div>
  </div>
);
