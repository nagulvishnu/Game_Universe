import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import {
  Play, Rocket, Crosshair, Trophy, Settings as SettingsIcon, ChevronLeft, Lock, Coins, Zap, Shield,
  Heart, Gauge, Sword, Battery, Wind, Star, CheckCircle2, XCircle, Crown, Timer, Skull, Infinity as InfIcon,
  Castle, Mountain, BookOpen, Trash2, Volume2, MousePointer2, Sparkles, Award, Pause, Home, RotateCcw, ChevronRight, Info
} from 'lucide-react';
import { useStore, effectiveStats, pilotLevel, type MissionConfig } from '../game/store';
import { SHIPS, WEAPONS, MISSIONS, MODES, UPGRADES, ACHIEVEMENTS, BOSSES, ENEMIES, ABILITY_INFO } from '../data/gameData';
import { upgradeCost } from '../game/engine';
import { audio } from '../game/audio';
import { PlayerShipModel } from '../game/ShipModels';

// ───────────────────────── helpers ─────────────────────────
export function campaignConfig(missionId: number): MissionConfig {
  const m = MISSIONS.find(x => x.id === missionId) ?? MISSIONS[0];
  return { kind: 'campaign', missionId: m.id, name: m.name, env: m.env, type: m.type, killTarget: m.killTarget, timeLimit: m.timeLimit, bossId: m.bossId, waves: m.waves, difficulty: m.difficulty, objectiveText: m.objectiveText, reward: m.reward, xp: m.xp };
}

export function modeConfig(modeId: string): MissionConfig {
  switch (modeId) {
    case 'quick': return { kind: 'quick', name: 'Quick Battle', env: 'nebula', type: 'destroy', killTarget: 0, timeLimit: 0, waves: 3, difficulty: 1.6, objectiveText: 'Destroy all hostiles — 3 waves', reward: 700, xp: 90 };
    case 'survival': return { kind: 'survival', name: 'Survival', env: 'graveyard', type: 'destroy', killTarget: 0, timeLimit: 0, waves: 999, difficulty: 1.4, objectiveText: 'Survive as many waves as you can', reward: 0, xp: 0 };
    case 'endless': return { kind: 'endless', name: 'Endless Galaxy', env: 'blackhole', type: 'destroy', killTarget: 0, timeLimit: 0, waves: 999, difficulty: 1.8, objectiveText: 'Endless procedural combat — push your limits', reward: 0, xp: 0 };
    case 'bossrush': return { kind: 'bossrush', name: 'Boss Rush', env: 'deepfield', type: 'boss', killTarget: 0, timeLimit: 0, waves: 0, difficulty: 3.2, objectiveText: 'Defeat all six bosses back to back', reward: 6000, xp: 900 };
    case 'timeattack': return { kind: 'timeattack', name: 'Time Attack', env: 'redstar', type: 'destroy', killTarget: 30, timeLimit: 180, waves: 999, difficulty: 1.5, objectiveText: 'Destroy 30 targets in 180 seconds', reward: 1500, xp: 200 };
    case 'escort': return { kind: 'escort', name: 'Escort Duty', env: 'frozen', type: 'escort', killTarget: 0, timeLimit: 0, waves: 4, difficulty: 1.9, objectiveText: 'Protect HAULER-7 through 4 waves', reward: 1600, xp: 220 };
    case 'defense': return { kind: 'defense', name: 'Station Defense', env: 'shipyard', type: 'defense', killTarget: 0, timeLimit: 0, waves: 5, difficulty: 2.1, objectiveText: 'Defend the station through 5 waves', reward: 1900, xp: 260 };
    case 'asteroid': return { kind: 'asteroid', name: 'Asteroid Run', env: 'volcanic', type: 'asteroid', killTarget: 40, timeLimit: 0, waves: 3, difficulty: 1.7, objectiveText: 'Clear 40 targets (ships + asteroids)', reward: 1400, xp: 190 };
    default: return modeConfig('quick');
  }
}

function StatBar({ label, value, max, icon }: { label: string; value: number; max: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="text-cyan-400 w-4">{icon}</span>
      <span className="w-24 text-slate-400 tracking-wider">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-800 skew-x-[-12deg]"><div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-300" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div>
      <span className="w-12 text-right text-cyan-200 font-bold">{Math.round(value)}</span>
    </div>
  );
}

export function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-slate-950/70 backdrop-blur-md border border-cyan-400/20 shadow-[0_0_40px_rgba(8,145,178,0.08)] ${className}`}>{children}</div>;
}

export function MenuBtn({ children, onClick, primary = false, className = '', disabled = false }: { children: React.ReactNode; onClick: () => void; primary?: boolean; className?: string; disabled?: boolean }) {
  return (
    <button disabled={disabled} onClick={() => { audio.init(); audio.click(); onClick(); }} onMouseEnter={() => audio.hover()}
      className={`group relative px-5 py-2.5 text-sm font-bold tracking-[0.18em] transition-all duration-150 [clip-path:polygon(10px_0,100%_0,calc(100%-10px)_100%,0_100%)] disabled:opacity-40 disabled:cursor-not-allowed ${primary ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300 hover:shadow-[0_0_24px_rgba(34,211,238,0.6)]' : 'bg-slate-800/80 text-cyan-200 border-y border-cyan-400/30 hover:bg-cyan-400/15 hover:text-white'} ${className}`}>
      {children}
    </button>
  );
}

function BackBtn({ to = 'menu' }: { to?: 'menu' | 'campaign' | 'modes' }) {
  const setScreen = useStore(s => s.setScreen);
  return <MenuBtn onClick={() => setScreen(to)} className="!px-4"><span className="flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> BACK</span></MenuBtn>;
}

function ScreenTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <div className="text-3xl md:text-4xl font-black tracking-[0.22em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-cyan-400 drop-shadow-[0_0_18px_rgba(34,211,238,0.35)]">{title}</div>
      {sub && <div className="text-slate-400 text-xs tracking-[0.3em] mt-1">{sub}</div>}
    </div>
  );
}

// ───────────────────────── 3D background / previews ─────────────────────────
function RotatingShip({ shipId }: { shipId: string }) {
  const g = useRef<THREE.Group>(null);
  const ship = SHIPS.find(s => s.id === shipId) ?? SHIPS[0];
  useFrame((s, dt) => {
    if (g.current) { g.current.rotation.y += dt * 0.55; g.current.position.y = Math.sin(s.clock.elapsedTime * 0.9) * 0.22; g.current.rotation.z = Math.sin(s.clock.elapsedTime * 0.6) * 0.08; }
  });
  return (
    <group ref={g} rotation={[0.15, 0, 0]}>
      <PlayerShipModel color={ship.color} accent={ship.accent} scale={ship.scale} wingSpan={ship.wingSpan} thrust={0.65} />
    </group>
  );
}

export function ShipPreview({ shipId, className = 'h-56' }: { shipId: string; className?: string }) {
  return (
    <div className={`relative ${className} border border-cyan-400/20 bg-[radial-gradient(ellipse_at_center,rgba(14,116,144,0.18),rgba(2,6,23,0.9))]`}>
      <Canvas camera={{ position: [4.6, 2.2, 6.4], fov: 42 }} dpr={[1, 1.75]}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[6, 8, 4]} intensity={1.8} color="#bae6fd" />
        <pointLight position={[-6, -3, -4]} intensity={20} color="#7c3aed" />
        <Stars radius={60} depth={30} count={700} factor={3} fade speed={0.5} />
        <RotatingShip shipId={shipId} />
      </Canvas>
      <div className="absolute bottom-1.5 left-2 text-[9px] tracking-[0.3em] text-cyan-500">HOLO-VIEW · ROTATING</div>
    </div>
  );
}

export function MenuBackground() {
  const save = useStore(s => s.save);
  return (
    <div className="absolute inset-0">
      <Canvas camera={{ position: [10, 5, 16], fov: 55 }} dpr={[0.75, 1.5]}>
        <color attach="background" args={['#020617']} />
        <fog attach="fog" args={['#0b1e3a', 40, 220]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[30, 40, 20]} intensity={1.5} color="#93c5fd" />
        <Stars radius={180} depth={80} count={5000} factor={8} saturation={0.5} fade speed={0.7} />
        <group position={[7, -1, -6]} scale={1.6}><RotatingShip shipId={save.selectedShip} /></group>
        <mesh position={[-46, 14, -70]}>
          <sphereGeometry args={[17, 32, 32]} />
          <meshStandardMaterial color="#2563eb" emissive="#1d4ed8" emissiveIntensity={0.35} roughness={0.7} />
        </mesh>
        <mesh position={[-46, 14, -70]} scale={1.05}>
          <sphereGeometry args={[17, 32, 32]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.08} side={THREE.BackSide} />
        </mesh>
      </Canvas>
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/50" />
    </div>
  );
}

// ───────────────────────── MAIN MENU ─────────────────────────
export function MainMenu() {
  const setScreen = useStore(s => s.setScreen);
  const save = useStore(s => s.save);
  const startMission = useStore(s => s.startMission);
  const setSelectedMission = useStore(s => s.setSelectedMission);
  const lvl = pilotLevel(save);
  const nextMission = MISSIONS.find(m => !save.completedMissions.includes(m.id));
  const ship = SHIPS.find(s => s.id === save.selectedShip);
  const items = [
    { label: nextMission ? 'CONTINUE CAMPAIGN' : 'CAMPAIGN COMPLETE ★', sub: nextMission ? `Mission ${nextMission.id}: ${nextMission.name}` : 'Replay any mission from the campaign map', icon: <Play className="w-4 h-4" />, act: () => { if (nextMission) { setSelectedMission(nextMission.id); setScreen('briefing'); } else setScreen('campaign'); }, primary: true },
    { label: 'QUICK BATTLE', sub: 'Jump straight into the fire', icon: <Zap className="w-4 h-4" />, act: () => startMission(modeConfig('quick')) },
    { label: 'CAMPAIGN MAP', sub: `${save.completedMissions.length}/9 missions complete`, icon: <Star className="w-4 h-4" />, act: () => setScreen('campaign') },
    { label: 'GAME MODES', sub: 'Survival · Boss Rush · Time Attack · more', icon: <Crown className="w-4 h-4" />, act: () => setScreen('modes') },
    { label: 'HANGAR', sub: `${ship?.name} · ${save.ownedShips.length}/8 ships owned`, icon: <Rocket className="w-4 h-4" />, act: () => setScreen('hangar') },
    { label: 'ARSENAL & UPGRADES', sub: `${save.ownedWeapons.length}/15 weapons · upgrade systems`, icon: <Crosshair className="w-4 h-4" />, act: () => setScreen('arsenal') },
    { label: 'WAR CODEX', sub: 'Ships · Enemies · Bosses · Controls', icon: <BookOpen className="w-4 h-4" />, act: () => setScreen('codex') },
    { label: 'ACHIEVEMENTS', sub: `${save.achievements.length}/${ACHIEVEMENTS.length} unlocked`, icon: <Trophy className="w-4 h-4" />, act: () => setScreen('achievements') },
    { label: 'SETTINGS', sub: 'Graphics · Audio · Controls', icon: <SettingsIcon className="w-4 h-4" />, act: () => setScreen('settings') },
  ];
  return (
    <div className="relative z-10 h-full flex flex-col justify-center px-6 md:px-16 max-w-2xl">
      <div className="text-[11px] tracking-[0.5em] text-cyan-400 mb-1">UNITED EARTH FLEET · STARFALL SQUADRON</div>
      <h1 className="text-6xl md:text-7xl font-black leading-[0.95] tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-cyan-200 to-cyan-600 drop-shadow-[0_0_30px_rgba(34,211,238,0.3)]">STARFALL</h1>
      <div className="text-2xl md:text-3xl font-bold tracking-[0.45em] text-amber-300 drop-shadow-[0_0_14px_rgba(251,191,36,0.45)] mt-1">GALACTIC WAR</div>
      <p className="text-slate-300/90 text-sm mt-3 max-w-md font-sans">The Seal is broken. An empire that slept for a million years is pouring into the galaxy. You are the last line of starfighters standing in its way.</p>

      <div className="flex items-center gap-3 mt-4 text-xs">
        <span className="bg-slate-900/80 border border-cyan-400/30 px-2.5 py-1 text-cyan-200 flex items-center gap-1.5"><Award className="w-3.5 h-3.5 text-amber-300" /> PILOT LV {lvl.level}</span>
        <span className="bg-slate-900/80 border border-amber-400/30 px-2.5 py-1 text-amber-200 flex items-center gap-1.5"><Coins className="w-3.5 h-3.5" /> {save.credits.toLocaleString()} CR</span>
        <span className="bg-slate-900/80 border border-slate-600 px-2.5 py-1 text-slate-300 hidden md:block">{save.stats.totalKills.toLocaleString()} career kills</span>
      </div>
      <div className="w-64 h-1 bg-slate-800 mt-2"><div className="h-full bg-amber-400" style={{ width: `${(lvl.into / lvl.needed) * 100}%` }} /></div>

      <div className="mt-6 flex flex-col gap-1.5 max-h-[44vh] overflow-y-auto pr-1 sf-scroll">
        {items.map(it => (
          <button key={it.label} onClick={() => { audio.init(); audio.click(); it.act(); }} onMouseEnter={() => audio.hover()}
            className={`group flex items-center gap-3 text-left px-4 py-2 transition-all [clip-path:polygon(12px_0,100%_0,calc(100%-12px)_100%,0_100%)] ${it.primary ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300' : 'bg-slate-900/70 text-slate-200 hover:bg-cyan-400/15 border-y border-cyan-400/20'}`}>
            <span className={it.primary ? 'text-slate-900' : 'text-cyan-400'}>{it.icon}</span>
            <span className="flex-1">
              <span className="block font-bold tracking-[0.18em] text-[13px]">{it.label}</span>
              <span className={`block text-[10px] ${it.primary ? 'text-slate-700' : 'text-slate-500'}`}>{it.sub}</span>
            </span>
            <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>
      <div className="mt-5 text-[10px] text-slate-500 tracking-wider">DESKTOP + MOUSE RECOMMENDED · CLICK A MENU ITEM TO ENABLE AUDIO · PROGRESS SAVES AUTOMATICALLY</div>
    </div>
  );
}

// ───────────────────────── HANGAR ─────────────────────────
export function Hangar() {
  const save = useStore(s => s.save);
  const buyShip = useStore(s => s.buyShip);
  const selectShip = useStore(s => s.selectShip);
  const [viewId, setViewId] = useState(save.selectedShip);
  const ship = SHIPS.find(s => s.id === viewId) ?? SHIPS[0];
  const owned = save.ownedShips.includes(ship.id);
  const selected = save.selectedShip === ship.id;
  const eff = useMemo(() => effectiveStats({ ...save, selectedShip: ship.id }), [save, ship.id]);
  return (
    <div className="relative z-10 h-full overflow-y-auto sf-scroll p-4 md:p-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4"><BackBtn /><ScreenTitle title="HANGAR" sub="SHIP SELECTION & INSPECTION" /></div>
        <div className="flex items-center gap-1.5 text-amber-300 bg-slate-900/80 border border-amber-400/30 px-3 py-1.5 font-bold"><Coins className="w-4 h-4" /> {save.credits.toLocaleString()} CR</div>
      </div>
      <div className="grid lg:grid-cols-[1fr_420px] gap-4 mt-5">
        <div>
          <ShipPreview shipId={ship.id} className="h-72 md:h-96" />
          <div className="grid grid-cols-4 gap-2 mt-3">
            {SHIPS.map(s => {
              const own = save.ownedShips.includes(s.id);
              return (
                <button key={s.id} onClick={() => { audio.click(); setViewId(s.id); }}
                  className={`text-left p-2.5 border transition-all ${viewId === s.id ? 'border-cyan-300 bg-cyan-400/15' : 'border-slate-700 bg-slate-900/70 hover:border-cyan-500/50'}`}>
                  <div className="w-6 h-1.5 mb-1.5" style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }} />
                  <div className="text-[11px] font-bold text-slate-100 leading-tight">{s.name}</div>
                  <div className="text-[9px] text-slate-500 tracking-wider">{s.role.toUpperCase()}</div>
                  <div className="text-[9px] mt-1">{save.selectedShip === s.id ? <span className="text-cyan-300 font-bold">● DEPLOYED</span> : own ? <span className="text-emerald-400">OWNED</span> : <span className="text-amber-300 flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" />{s.cost.toLocaleString()} CR</span>}</div>
                </button>
              );
            })}
          </div>
        </div>
        <Panel className="p-5 self-start">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xl font-black tracking-wider text-white">{ship.name}</div>
              <div className="text-[10px] tracking-[0.3em]" style={{ color: ship.color }}>{ship.role.toUpperCase()}</div>
            </div>
            <div className="w-10 h-10 border flex items-center justify-center" style={{ borderColor: ship.color }}><Rocket className="w-5 h-5" style={{ color: ship.color }} /></div>
          </div>
          <p className="text-slate-400 text-xs mt-2 font-sans leading-relaxed">{ship.desc}</p>
          <div className="space-y-1.5 mt-4">
            <StatBar label="HULL" value={eff.hull} max={330} icon={<Heart className="w-3.5 h-3.5" />} />
            <StatBar label="SHIELD" value={eff.shield} max={280} icon={<Shield className="w-3.5 h-3.5" />} />
            <StatBar label="SPEED" value={eff.speed * 3.6} max={320} icon={<Gauge className="w-3.5 h-3.5" />} />
            <StatBar label="FIREPOWER" value={eff.damageMult * 100} max={260} icon={<Sword className="w-3.5 h-3.5" />} />
            <StatBar label="ENERGY" value={eff.energy} max={300} icon={<Battery className="w-3.5 h-3.5" />} />
            <StatBar label="AGILITY" value={eff.maneuver * 40} max={120} icon={<Wind className="w-3.5 h-3.5" />} />
            <StatBar label="ARMOR" value={eff.armor * 10} max={220} icon={<Shield className="w-3.5 h-3.5" />} />
          </div>
          <div className="mt-4 border border-purple-400/30 bg-purple-950/20 p-3">
            <div className="text-purple-300 text-xs font-bold tracking-widest flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> {ship.abilityName.toUpperCase()} <span className="text-slate-500 font-normal">[KEY E · {ABILITY_INFO[ship.ability].cooldown}s CD]</span></div>
            <div className="text-slate-400 text-[11px] mt-1 font-sans">{ship.abilityDesc} {ABILITY_INFO[ship.ability].desc}</div>
          </div>
          <div className="mt-4 flex gap-2">
            {owned ? (
              <MenuBtn primary className="flex-1" onClick={() => selectShip(ship.id)} disabled={selected}>{selected ? '✓ DEPLOYED' : 'DEPLOY SHIP'}</MenuBtn>
            ) : (
              <MenuBtn primary className="flex-1" onClick={() => buyShip(ship.id)} disabled={save.credits < ship.cost}>
                {save.credits < ship.cost ? `NEED ${ship.cost.toLocaleString()} CR` : `PURCHASE — ${ship.cost.toLocaleString()} CR`}
              </MenuBtn>
            )}
          </div>
          <div className="text-[10px] text-slate-500 mt-3">Stats include your installed upgrades. Earn credits from missions, salvage pickups, and achievements.</div>
        </Panel>
      </div>
    </div>
  );
}

// ───────────────────────── ARSENAL + UPGRADES ─────────────────────────
export function Arsenal() {
  const save = useStore(s => s.save);
  const buyWeapon = useStore(s => s.buyWeapon);
  const equipWeapon = useStore(s => s.equipWeapon);
  const buyUpgrade = useStore(s => s.buyUpgrade);
  const [tab, setTab] = useState<'primary' | 'secondary' | 'upgrades'>('primary');
  const weapons = WEAPONS.filter(w => w.slot === tab);
  return (
    <div className="relative z-10 h-full overflow-y-auto sf-scroll p-4 md:p-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4"><BackBtn /><ScreenTitle title="ARSENAL" sub="WEAPONS & SHIP UPGRADES" /></div>
        <div className="flex items-center gap-1.5 text-amber-300 bg-slate-900/80 border border-amber-400/30 px-3 py-1.5 font-bold"><Coins className="w-4 h-4" /> {save.credits.toLocaleString()} CR</div>
      </div>
      <div className="flex gap-2 mt-5 flex-wrap">
        {([['primary', 'PRIMARY WEAPONS'], ['secondary', 'SECONDARY WEAPONS'], ['upgrades', 'SHIP UPGRADES']] as const).map(([id, label]) => (
          <button key={id} onClick={() => { audio.click(); setTab(id); }} className={`px-4 py-2 text-xs font-bold tracking-[0.18em] [clip-path:polygon(8px_0,100%_0,calc(100%-8px)_100%,0_100%)] ${tab === id ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800/80 text-cyan-200 hover:bg-cyan-400/15'}`}>{label}</button>
        ))}
        <div className="text-[11px] text-slate-400 self-center ml-1">In combat: <b className="text-cyan-300">Q</b> cycles primary · <b className="text-orange-300">R</b> cycles secondary</div>
      </div>

      {tab !== 'upgrades' ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 mt-4">
          {weapons.map(w => {
            const owned = save.ownedWeapons.includes(w.id);
            const equipped = (w.slot === 'primary' ? save.primaryId : save.secondaryId) === w.id;
            return (
              <Panel key={w.id} className={`p-4 ${equipped ? '!border-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.15)]' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-100 text-sm">{w.name}</div>
                  <span className="text-[9px] px-1.5 py-0.5 border tracking-widest" style={{ color: w.color, borderColor: w.color }}>{w.kind.toUpperCase()}</span>
                </div>
                <p className="text-slate-400 text-[11px] mt-1 font-sans min-h-8">{w.desc}</p>
                <div className="grid grid-cols-3 gap-1 text-[10px] mt-2 text-center">
                  <div className="bg-slate-900 py-1"><div className="text-slate-500">DMG</div><div className="text-cyan-200 font-bold">{w.damage}{w.projectiles > 1 ? `×${w.projectiles}` : ''}</div></div>
                  <div className="bg-slate-900 py-1"><div className="text-slate-500">RATE</div><div className="text-cyan-200 font-bold">{w.kind === 'charge' ? 'CHARGE' : `${w.fireRate}/s`}</div></div>
                  <div className="bg-slate-900 py-1"><div className="text-slate-500">{w.ammo >= 0 ? 'AMMO' : 'ENERGY'}</div><div className="text-cyan-200 font-bold">{w.ammo >= 0 ? w.ammo : `${w.energyCost}/shot`}</div></div>
                  <div className="bg-slate-900 py-1"><div className="text-slate-500">VS SHIELD</div><div className="text-sky-300 font-bold">×{w.shieldMult}</div></div>
                  <div className="bg-slate-900 py-1"><div className="text-slate-500">VS HULL</div><div className="text-orange-300 font-bold">×{w.hullMult}</div></div>
                  <div className="bg-slate-900 py-1"><div className="text-slate-500">RANGE</div><div className="text-cyan-200 font-bold">{w.range}m</div></div>
                </div>
                <div className="mt-3">
                  {owned ? (
                    <MenuBtn primary={equipped} className="w-full" onClick={() => equipWeapon(w.id)} disabled={equipped}>{equipped ? '✓ EQUIPPED' : 'EQUIP'}</MenuBtn>
                  ) : (
                    <MenuBtn primary className="w-full" onClick={() => buyWeapon(w.id)} disabled={save.credits < w.cost}>{save.credits < w.cost ? `NEED ${w.cost.toLocaleString()} CR` : `BUY — ${w.cost.toLocaleString()} CR`}</MenuBtn>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3 mt-4 max-w-5xl">
          {UPGRADES.map(u => {
            const lvl = save.upgrades[u.id] ?? 0;
            const cost = upgradeCost(u.baseCost, lvl);
            const maxed = lvl >= u.max;
            return (
              <Panel key={u.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-100 text-sm">{u.name}</div>
                  <div className="flex gap-0.5">{Array.from({ length: u.max }).map((_, i) => <div key={i} className={`w-2.5 h-3 skew-x-[-12deg] ${i < lvl ? 'bg-cyan-400 shadow-[0_0_6px_#22d3ee]' : 'bg-slate-800'}`} />)}</div>
                </div>
                <p className="text-slate-400 text-[11px] mt-1 font-sans">{u.desc}</p>
                <div className="text-emerald-300 text-[11px] mt-1">Per level: {u.perLevel} · Level {lvl}/{u.max}</div>
                <MenuBtn primary className="w-full mt-3" disabled={maxed || save.credits < cost} onClick={() => buyUpgrade(u.id, cost, u.max)}>
                  {maxed ? 'MAX LEVEL' : save.credits < cost ? `NEED ${cost.toLocaleString()} CR` : `UPGRADE — ${cost.toLocaleString()} CR`}
                </MenuBtn>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── CAMPAIGN MAP + BRIEFING ─────────────────────────
export function Campaign() {
  const save = useStore(s => s.save);
  const setScreen = useStore(s => s.setScreen);
  const setSelectedMission = useStore(s => s.setSelectedMission);
  const maxUnlocked = Math.max(...save.completedMissions, 0) + 1;
  return (
    <div className="relative z-10 h-full overflow-y-auto sf-scroll p-4 md:p-8">
      <div className="flex items-center gap-4"><BackBtn /><ScreenTitle title="CAMPAIGN" sub="THE SHATTERED SEAL — A GALACTIC WAR IN 9 OPERATIONS" /></div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 mt-6">
        {MISSIONS.map(m => {
          const done = save.completedMissions.includes(m.id);
          const unlocked = m.id <= maxUnlocked;
          const grade = save.missionRatings[m.id];
          return (
            <button key={m.id} disabled={!unlocked} onClick={() => { audio.click(); setSelectedMission(m.id); setScreen('briefing'); }}
              className={`text-left p-4 border transition-all ${done ? 'border-emerald-500/40 bg-emerald-950/15 hover:border-emerald-300' : unlocked ? 'border-cyan-400/40 bg-slate-950/70 hover:border-cyan-300 hover:bg-cyan-400/10' : 'border-slate-800 bg-slate-950/50 opacity-50 cursor-not-allowed'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-[0.3em] text-cyan-500">OPERATION 0{m.id}</span>
                {done ? <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold"><CheckCircle2 className="w-3.5 h-3.5" /> COMPLETE {grade && <span className="ml-1 text-amber-300 border border-amber-400/50 px-1">{grade}</span>}</span> : !unlocked && <Lock className="w-4 h-4 text-slate-600" />}
              </div>
              <div className="text-lg font-black tracking-wide text-white mt-1">{m.name}</div>
              <div className="text-[11px] text-slate-500">{m.sector}</div>
              <div className="flex items-center gap-2 mt-2 text-[10px]">
                <span className="border border-slate-700 px-1.5 py-0.5 text-slate-300">{m.type.toUpperCase()}</span>
                {m.bossId && <span className="border border-red-500/50 px-1.5 py-0.5 text-red-300">☠ BOSS</span>}
                <span className="text-red-400">{'◆'.repeat(Math.min(5, Math.ceil(m.difficulty)))}{'◇'.repeat(Math.max(0, 5 - Math.ceil(m.difficulty)))}</span>
              </div>
              <div className="text-[11px] text-amber-300 mt-2">Reward: {m.reward.toLocaleString()} CR · {m.xp} XP</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Briefing() {
  const save = useStore(s => s.save);
  const missionId = useStore(s => s.selectedMission);
  const startMission = useStore(s => s.startMission);
  const setScreen = useStore(s => s.setScreen);
  const m = MISSIONS.find(x => x.id === missionId) ?? MISSIONS[0];
  const boss = m.bossId ? BOSSES.find(b => b.id === m.bossId) : null;
  const ship = SHIPS.find(s => s.id === save.selectedShip);
  const prim = WEAPONS.find(w => w.id === save.primaryId);
  const sec = WEAPONS.find(w => w.id === save.secondaryId);
  return (
    <div className="relative z-10 h-full overflow-y-auto sf-scroll p-4 md:p-8 flex items-center justify-center">
      <div className="max-w-3xl w-full">
        <BackBtn to="campaign" />
        <Panel className="p-6 md:p-8 mt-4">
          <div className="text-[10px] tracking-[0.4em] text-cyan-500">MISSION BRIEFING · OPERATION 0{m.id} · {m.sector.toUpperCase()}</div>
          <div className="text-4xl font-black tracking-wider text-white mt-2">{m.name}</div>
          <p className="text-slate-300 mt-3 font-sans leading-relaxed text-[15px]">{m.brief}</p>
          <div className="grid sm:grid-cols-2 gap-3 mt-5 text-xs">
            <div className="border border-cyan-400/25 bg-slate-900/60 p-3">
              <div className="text-cyan-400 tracking-widest font-bold">OBJECTIVE</div>
              <div className="text-slate-200 mt-1">▸ {m.objectiveText}</div>
              <div className="text-slate-500 mt-1">{m.optionalText}</div>
              <div className="text-slate-500 mt-2">{m.waves} wave{m.waves !== 1 ? 's' : ''} · Threat {'◆'.repeat(Math.min(5, Math.ceil(m.difficulty)))}</div>
            </div>
            <div className="border border-amber-400/25 bg-slate-900/60 p-3">
              <div className="text-amber-300 tracking-widest font-bold">REWARDS</div>
              <div className="text-slate-200 mt-1">{m.reward.toLocaleString()} credits · {m.xp} XP</div>
              <div className="text-slate-500 mt-1">Plus per-kill salvage and battlefield pickups.</div>
            </div>
          </div>
          {m.dialogue.map((d, i) => (
            <div key={i} className="border-l-2 border-cyan-500 bg-cyan-950/20 px-3 py-2 mt-3">
              <span className="text-cyan-400 text-[10px] tracking-[0.25em] font-bold">{d.speaker.toUpperCase()}</span>
              <span className="text-cyan-100 text-sm font-sans ml-2">"{d.text}"</span>
            </div>
          ))}
          {boss && (
            <div className="border border-red-500/50 bg-red-950/20 p-3 mt-3">
              <div className="text-red-400 font-black tracking-[0.25em] flex items-center gap-2"><Skull className="w-4 h-4" /> CAPITAL THREAT: {boss.name}</div>
              <div className="text-slate-300 text-xs mt-1 font-sans">{boss.desc}</div>
              <div className="text-slate-500 text-[11px] mt-1 italic">{boss.quote}</div>
              <div className="text-[11px] text-red-300 mt-1">Attack patterns: {boss.patterns.join(' · ')} · Weak point: glowing core once shields fall.</div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-5 text-[11px] text-slate-400">
            <span>Deploying:</span><b className="text-cyan-200">{ship?.name}</b><span>·</span><span>{prim?.name}</span><span>·</span><span>{sec?.name}</span>
            <button className="text-cyan-400 underline ml-1" onClick={() => setScreen('hangar')}>Change ship</button>
            <button className="text-cyan-400 underline" onClick={() => setScreen('arsenal')}>Change weapons</button>
          </div>
          <MenuBtn primary className="w-full mt-4 !py-3.5 text-base" onClick={() => startMission(campaignConfig(m.id))}>▶ LAUNCH MISSION</MenuBtn>
          <div className="text-center text-[10px] text-slate-500 mt-2">Mouse steer · LMB fire · RMB lock/fire missiles · SHIFT boost · E ability · F ultimate · ESC pause</div>
        </Panel>
      </div>
    </div>
  );
}

// ───────────────────────── MODES ─────────────────────────
const MODE_ICONS: Record<string, React.ReactNode> = {
  quick: <Zap className="w-6 h-6" />, survival: <Skull className="w-6 h-6" />, endless: <InfIcon className="w-6 h-6" />,
  bossrush: <Crown className="w-6 h-6" />, timeattack: <Timer className="w-6 h-6" />, escort: <Shield className="w-6 h-6" />,
  defense: <Castle className="w-6 h-6" />, asteroid: <Mountain className="w-6 h-6" />,
};
export function Modes() {
  const startMission = useStore(s => s.startMission);
  const save = useStore(s => s.save);
  return (
    <div className="relative z-10 h-full overflow-y-auto sf-scroll p-4 md:p-8">
      <div className="flex items-center gap-4"><BackBtn /><ScreenTitle title="GAME MODES" sub="ALTERNATE OPERATIONS — ALL FULLY PLAYABLE" /></div>
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3 mt-6">
        {MODES.map(m => {
          const cfg = modeConfig(m.id);
          return (
            <Panel key={m.id} className="p-5 flex flex-col">
              <div className="text-cyan-300">{MODE_ICONS[m.id]}</div>
              <div className="text-lg font-black tracking-wide text-white mt-2">{m.name}</div>
              <p className="text-slate-400 text-xs font-sans mt-1 flex-1">{m.desc}</p>
              <div className="text-[10px] text-slate-500 mt-2">{cfg.objectiveText}</div>
              {m.id === 'survival' && save.stats.bestSurvivalWave > 0 && <div className="text-[10px] text-amber-300 mt-1">Best: Wave {save.stats.bestSurvivalWave}</div>}
              {cfg.reward > 0 && <div className="text-[10px] text-amber-300 mt-1">Reward: {cfg.reward.toLocaleString()} CR · {cfg.xp} XP</div>}
              <MenuBtn primary className="w-full mt-3" onClick={() => startMission(cfg)}>▶ LAUNCH</MenuBtn>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────── PAUSE / RESULTS ─────────────────────────
export function PauseMenu() {
  const setPaused = useStore(s => s.setPaused);
  const setScreen = useStore(s => s.setScreen);
  const setSettingsFromPause = useStore(s => s.setSettingsFromPause);
  const config = useStore(s => s.config);
  const startMission = useStore(s => s.startMission);
  const hud = useStore(s => s.hud);
  return (
    <div className="absolute inset-0 z-20 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <Panel className="p-7 w-[min(420px,92vw)] text-center">
        <Pause className="w-8 h-8 text-cyan-300 mx-auto" />
        <div className="text-2xl font-black tracking-[0.3em] text-white mt-2">PAUSED</div>
        <div className="text-slate-400 text-xs mt-1">{config?.name} · {hud.kills} kills · {hud.score.toLocaleString()} pts</div>
        <div className="flex flex-col gap-2 mt-6">
          <MenuBtn primary onClick={() => { setPaused(false); setTimeout(() => { try { const r = document.querySelector('canvas')?.requestPointerLock() as unknown as Promise<void> | undefined; r?.catch?.(() => undefined); } catch { /* click canvas to lock */ } }, 120); }}>▶ RESUME (click to re-lock mouse)</MenuBtn>
          <MenuBtn onClick={() => config && startMission(config)}><span className="flex items-center justify-center gap-2"><RotateCcw className="w-4 h-4" /> RESTART MISSION</span></MenuBtn>
          <MenuBtn onClick={() => { setSettingsFromPause(true); setScreen('settings'); }}>SETTINGS</MenuBtn>
          <MenuBtn onClick={() => { setPaused(false); setScreen('menu'); }}><span className="flex items-center justify-center gap-2"><Home className="w-4 h-4" /> ABANDON → MAIN MENU</span></MenuBtn>
        </div>
        <div className="text-[10px] text-slate-500 mt-4 text-left space-y-0.5">
          <div>W/S thrust · A/D strafe · Space/Ctrl vertical · Shift boost</div>
          <div>Mouse steer · LMB primary · RMB hold-lock, release fire</div>
          <div>Q/R cycle weapons · E ability · F ultimate · Tab objectives</div>
        </div>
      </Panel>
    </div>
  );
}

export function Results({ success }: { success: boolean }) {
  const result = useStore(s => s.result);
  const config = useStore(s => s.config);
  const setScreen = useStore(s => s.setScreen);
  const startMission = useStore(s => s.startMission);
  const setSelectedMission = useStore(s => s.setSelectedMission);
  if (!result) return null;
  const mins = Math.floor(result.time / 60), secs = Math.floor(result.time % 60);
  const nextId = config?.missionId ? config.missionId + 1 : 0;
  const mission = config?.missionId ? MISSIONS.find(m => m.id === config.missionId) : null;
  return (
    <div className="absolute inset-0 z-20 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto sf-scroll">
      <Panel className="p-7 w-[min(560px,94vw)]">
        <div className="text-center">
          {success ? <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" /> : <XCircle className="w-12 h-12 text-red-400 mx-auto" />}
          <div className={`text-3xl font-black tracking-[0.25em] mt-2 ${success ? 'text-emerald-300' : 'text-red-300'}`}>{success ? 'MISSION COMPLETE' : 'SHIP DESTROYED'}</div>
          <div className="text-slate-400 text-xs tracking-widest mt-1">{config?.name}</div>
          {mission && <p className="text-slate-300 text-sm font-sans mt-3 leading-relaxed">{success ? mission.debrief : 'Your escape pod was recovered by a fleet tender. The squadron will re-arm and fly again — the galaxy still needs you, pilot.'}</p>}
        </div>
        {success && (
          <div className="text-center mt-4">
            <div className="inline-block border-2 border-amber-400 bg-amber-950/30 px-6 py-2">
              <div className="text-[9px] tracking-[0.35em] text-amber-400">MISSION RATING</div>
              <div className="text-5xl font-black text-amber-300 drop-shadow-[0_0_16px_rgba(251,191,36,0.6)]">{result.grade}</div>
              <div className="text-[10px] text-amber-200/70">{result.points.toLocaleString()} performance pts</div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 mt-5 text-center text-xs">
          {[
            ['KILLS', result.kills], ['SCORE', result.score.toLocaleString()], ['TIME', `${mins}:${String(secs).padStart(2, '0')}`],
            ['ACCURACY', `${Math.round(result.accuracy * 100)}%`], ['HULL LEFT', `${Math.round(result.hullFrac * 100)}%`], ['BOSS', result.bossKilled ? 'DESTROYED ☠' : '—'],
          ].map(([k, v]) => (
            <div key={k} className="bg-slate-900/80 border border-slate-700 py-2"><div className="text-[9px] text-slate-500 tracking-widest">{k}</div><div className="text-cyan-200 font-bold text-sm">{v}</div></div>
          ))}
        </div>
        <div className="flex justify-center gap-4 mt-4 text-sm">
          <span className="text-amber-300 font-bold flex items-center gap-1"><Coins className="w-4 h-4" /> +{result.creditsEarned.toLocaleString()} CR</span>
          <span className="text-cyan-300 font-bold flex items-center gap-1"><Award className="w-4 h-4" /> +{result.xpEarned} XP</span>
        </div>
        {result.newAchievements.length > 0 && (
          <div className="mt-3 border border-amber-400/40 bg-amber-950/20 p-3 text-center">
            <div className="text-amber-300 text-xs font-bold tracking-widest flex items-center justify-center gap-1.5"><Trophy className="w-4 h-4" /> ACHIEVEMENT{result.newAchievements.length > 1 ? 'S' : ''} UNLOCKED</div>
            {result.newAchievements.map(a => <div key={a} className="text-slate-200 text-sm mt-1">{a}</div>)}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-2 mt-6">
          {success && config?.kind === 'campaign' && nextId <= 9 && (
            <MenuBtn primary className="flex-1" onClick={() => { setSelectedMission(nextId); setScreen('briefing'); }}>NEXT MISSION ▸</MenuBtn>
          )}
          <MenuBtn className="flex-1" onClick={() => config && startMission(config)}><span className="flex items-center justify-center gap-1.5"><RotateCcw className="w-4 h-4" /> REPLAY</span></MenuBtn>
          <MenuBtn className="flex-1" onClick={() => setScreen('menu')}><span className="flex items-center justify-center gap-1.5"><Home className="w-4 h-4" /> MAIN MENU</span></MenuBtn>
        </div>
      </Panel>
    </div>
  );
}

// ───────────────────────── SETTINGS ─────────────────────────
function Slider({ label, value, min, max, step, fmt, onChange, icon }: { label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-44 text-slate-300 tracking-wider flex items-center gap-1.5">{icon}{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} className="flex-1 accent-cyan-400" />
      <span className="w-14 text-right text-cyan-200 font-bold">{fmt(value)}</span>
    </div>
  );
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => { audio.click(); onChange(!value); }} className="flex items-center justify-between w-full text-xs py-1">
      <span className="text-slate-300 tracking-wider">{label}</span>
      <span className={`px-2.5 py-0.5 border font-bold ${value ? 'border-cyan-300 text-cyan-300 bg-cyan-400/10' : 'border-slate-600 text-slate-500'}`}>{value ? 'ON' : 'OFF'}</span>
    </button>
  );
}

export function Settings() {
  const settings = useStore(s => s.settings);
  const setSettings = useStore(s => s.setSettings);
  const resetSave = useStore(s => s.resetSave);
  const fromPause = useStore(s => s.settingsFromPause);
  const setSettingsFromPause = useStore(s => s.setSettingsFromPause);
  const setScreen = useStore(s => s.setScreen);
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <div className={`relative z-10 h-full overflow-y-auto sf-scroll p-4 md:p-8 ${fromPause ? 'bg-slate-950/80 backdrop-blur-sm' : ''}`}>
      <div className="flex items-center gap-4">
        {fromPause
          ? <MenuBtn onClick={() => { setSettingsFromPause(false); setScreen('paused'); }} className="!px-4"><span className="flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> BACK TO PAUSE</span></MenuBtn>
          : <BackBtn />}
        <ScreenTitle title="SETTINGS" sub="GRAPHICS · AUDIO · CONTROLS · DATA" />
      </div>
      <div className="grid md:grid-cols-2 gap-4 mt-6 max-w-5xl">
        <Panel className="p-5 space-y-3">
          <div className="text-cyan-300 font-bold tracking-[0.25em] text-sm flex items-center gap-2"><Sparkles className="w-4 h-4" /> GRAPHICS</div>
          <div className="flex items-center gap-3 text-xs">
            <span className="w-44 text-slate-300 tracking-wider">QUALITY PRESET</span>
            <div className="flex gap-1">
              {(['low', 'medium', 'high'] as const).map(q => (
                <button key={q} onClick={() => { audio.click(); setSettings({ quality: q }); }} className={`px-3 py-1 border font-bold tracking-widest text-[11px] ${settings.quality === q ? 'border-cyan-300 text-cyan-200 bg-cyan-400/15' : 'border-slate-700 text-slate-400 hover:border-cyan-500/50'}`}>{q.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <div className="text-[10px] text-slate-500">Low reduces pixel ratio, particles, stars & asteroids. Takes full effect next mission.</div>
          <Slider label="CAMERA SHAKE" value={settings.cameraShake} min={0} max={1.5} step={0.05} fmt={v => `${Math.round(v * 100)}%`} onChange={v => setSettings({ cameraShake: v })} />
          <Toggle label="SCREEN EFFECTS (damage vignette)" value={settings.screenEffects} onChange={v => setSettings({ screenEffects: v })} />
          <Toggle label="SHOW FPS COUNTER" value={settings.showFps} onChange={v => setSettings({ showFps: v })} />
        </Panel>
        <Panel className="p-5 space-y-3">
          <div className="text-cyan-300 font-bold tracking-[0.25em] text-sm flex items-center gap-2"><Volume2 className="w-4 h-4" /> AUDIO</div>
          <Slider label="MASTER VOLUME" value={settings.masterVol} min={0} max={1} step={0.05} fmt={v => `${Math.round(v * 100)}%`} onChange={v => setSettings({ masterVol: v })} />
          <Slider label="MUSIC VOLUME" value={settings.musicVol} min={0} max={1} step={0.05} fmt={v => `${Math.round(v * 100)}%`} onChange={v => setSettings({ musicVol: v })} />
          <Slider label="EFFECTS VOLUME" value={settings.sfxVol} min={0} max={1} step={0.05} fmt={v => `${Math.round(v * 100)}%`} onChange={v => setSettings({ sfxVol: v })} />
          <Slider label="INTERFACE VOLUME" value={settings.uiVol} min={0} max={1} step={0.05} fmt={v => `${Math.round(v * 100)}%`} onChange={v => setSettings({ uiVol: v })} />
          <div className="text-[10px] text-slate-500">All audio is synthesized live with the Web Audio API — zero external files.</div>
        </Panel>
        <Panel className="p-5 space-y-3">
          <div className="text-cyan-300 font-bold tracking-[0.25em] text-sm flex items-center gap-2"><MousePointer2 className="w-4 h-4" /> CONTROLS</div>
          <Slider label="MOUSE SENSITIVITY" value={settings.sensitivity} min={0.3} max={2.5} step={0.05} fmt={v => `${v.toFixed(2)}×`} onChange={v => setSettings({ sensitivity: v })} />
          <Toggle label="INVERT MOUSE Y" value={settings.invertY} onChange={v => setSettings({ invertY: v })} />
          <div className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-800 pt-2 space-y-0.5">
            <div><b className="text-cyan-300">W/S</b> thrust · <b className="text-cyan-300">A/D</b> strafe · <b className="text-cyan-300">Space/Ctrl(C)</b> up/down</div>
            <div><b className="text-cyan-300">Shift</b> boost · <b className="text-cyan-300">Mouse</b> steer · <b className="text-cyan-300">LMB</b> primary fire</div>
            <div><b className="text-cyan-300">RMB</b> hold to lock missiles, release to launch · <b className="text-cyan-300">Q/R</b> cycle weapons</div>
            <div><b className="text-cyan-300">E</b> special ability · <b className="text-cyan-300">F</b> ultimate · <b className="text-cyan-300">Tab</b> objectives · <b className="text-cyan-300">Esc</b> pause</div>
          </div>
        </Panel>
        <Panel className="p-5 space-y-3">
          <div className="text-red-300 font-bold tracking-[0.25em] text-sm flex items-center gap-2"><Trash2 className="w-4 h-4" /> SAVE DATA</div>
          <p className="text-slate-400 text-[11px] font-sans">Progress (credits, ships, weapons, upgrades, campaign, achievements) is saved automatically to this browser. Resetting is permanent.</p>
          {!confirmReset ? (
            <MenuBtn className="!bg-red-950/60 !text-red-300 border-y !border-red-500/40" onClick={() => setConfirmReset(true)}>RESET ALL PROGRESS…</MenuBtn>
          ) : (
            <div className="flex gap-2">
              <MenuBtn className="flex-1 !bg-red-600 !text-white" onClick={() => { resetSave(); setConfirmReset(false); }}>CONFIRM WIPE</MenuBtn>
              <MenuBtn className="flex-1" onClick={() => setConfirmReset(false)}>CANCEL</MenuBtn>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ───────────────────────── ACHIEVEMENTS + CODEX ─────────────────────────
export function Achievements() {
  const save = useStore(s => s.save);
  return (
    <div className="relative z-10 h-full overflow-y-auto sf-scroll p-4 md:p-8">
      <div className="flex items-center gap-4"><BackBtn /><ScreenTitle title="ACHIEVEMENTS" sub={`${save.achievements.length} / ${ACHIEVEMENTS.length} UNLOCKED — GRANT CREDIT BONUSES`} /></div>
      <div className="grid md:grid-cols-2 gap-3 mt-6 max-w-5xl">
        {ACHIEVEMENTS.map(a => {
          const got = save.achievements.includes(a.id);
          const cur = save.stats[a.stat] ?? 0;
          return (
            <Panel key={a.id} className={`p-4 ${got ? '!border-amber-400/50 bg-amber-950/10' : 'opacity-80'}`}>
              <div className="flex items-center gap-3">
                <Trophy className={`w-7 h-7 ${got ? 'text-amber-300' : 'text-slate-600'}`} />
                <div className="flex-1">
                  <div className={`font-bold ${got ? 'text-amber-200' : 'text-slate-200'}`}>{a.name}</div>
                  <div className="text-slate-400 text-[11px] font-sans">{a.desc}</div>
                  <div className="h-1.5 bg-slate-800 mt-2"><div className={`h-full ${got ? 'bg-amber-400' : 'bg-cyan-600'}`} style={{ width: `${Math.min(100, (cur / a.target) * 100)}%` }} /></div>
                  <div className="text-[10px] text-slate-500 mt-1">{Math.min(cur, a.target).toLocaleString()} / {a.target.toLocaleString()} · Reward {a.reward} CR {got && '· ✓ CLAIMED'}</div>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

export function Codex() {
  const [tab, setTab] = useState<'ships' | 'enemies' | 'bosses' | 'weapons'>('ships');
  const [shipId, setShipId] = useState('viper');
  return (
    <div className="relative z-10 h-full overflow-y-auto sf-scroll p-4 md:p-8">
      <div className="flex items-center gap-4"><BackBtn /><ScreenTitle title="WAR CODEX" sub="FLEET INTELLIGENCE DATABASE" /></div>
      <div className="flex gap-2 mt-5 flex-wrap">
        {([['ships', 'STARFIGHTERS'], ['enemies', 'ENEMY FACTIONS'], ['bosses', 'CAPITAL THREATS'], ['weapons', 'WEAPON SYSTEMS']] as const).map(([id, label]) => (
          <button key={id} onClick={() => { audio.click(); setTab(id); }} className={`px-4 py-2 text-xs font-bold tracking-[0.18em] [clip-path:polygon(8px_0,100%_0,calc(100%-8px)_100%,0_100%)] ${tab === id ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800/80 text-cyan-200 hover:bg-cyan-400/15'}`}>{label}</button>
        ))}
      </div>
      {tab === 'ships' && (
        <div className="grid lg:grid-cols-[1fr_380px] gap-4 mt-4">
          <ShipPreview shipId={shipId} className="h-80" />
          <div className="space-y-2">
            {SHIPS.map(s => (
              <button key={s.id} onClick={() => setShipId(s.id)} className={`w-full text-left p-3 border ${shipId === s.id ? 'border-cyan-300 bg-cyan-400/10' : 'border-slate-700 bg-slate-900/60 hover:border-cyan-500/40'}`}>
                <div className="flex justify-between"><span className="font-bold text-sm text-slate-100">{s.name}</span><span className="text-[10px]" style={{ color: s.color }}>{s.role.toUpperCase()}</span></div>
                <div className="text-[11px] text-slate-400 font-sans mt-0.5">{s.desc}</div>
                <div className="text-[10px] text-purple-300 mt-1">Ability: {s.abilityName} — {s.abilityDesc}</div>
              </button>
            ))}
          </div>
        </div>
      )}
      {tab === 'enemies' && (
        <div className="mt-4 space-y-5 max-w-5xl">
          {(['Void Swarm', 'Iron Dominion', 'Astral Collective'] as const).map(f => (
            <div key={f}>
              <div className="text-red-300 font-black tracking-[0.3em] text-sm mb-2">{f.toUpperCase()}</div>
              <div className="grid md:grid-cols-3 gap-2">
                {ENEMIES.filter(e => e.faction === f).map(e => (
                  <Panel key={e.id} className="p-3">
                    <div className="flex justify-between items-center"><span className="font-bold text-sm text-slate-100">{e.name}</span><span className="w-3 h-3 rotate-45" style={{ background: e.color, boxShadow: `0 0 8px ${e.color}` }} /></div>
                    <div className="text-[11px] text-slate-400 font-sans mt-1">{e.desc}</div>
                    <div className="text-[10px] text-slate-500 mt-2">HULL {e.hull} · SHD {e.shield} · SPD {e.speed} · DMG {e.damage} · {e.credits} CR salvage</div>
                  </Panel>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === 'bosses' && (
        <div className="grid md:grid-cols-2 gap-3 mt-4 max-w-5xl">
          {BOSSES.map(b => (
            <Panel key={b.id} className="p-4 !border-red-500/30">
              <div className="flex justify-between"><span className="font-black tracking-wider text-red-300">{b.name}</span><Skull className="w-5 h-5" style={{ color: b.color }} /></div>
              <div className="text-[10px] tracking-[0.25em] text-slate-500">{b.title.toUpperCase()}</div>
              <p className="text-slate-400 text-[11px] font-sans mt-1">{b.desc}</p>
              <div className="text-[10px] text-slate-500 mt-2 italic">{b.quote}</div>
              <div className="text-[10px] text-red-300/80 mt-1">PATTERNS: {b.patterns.join(' · ').toUpperCase()} · BOUNTY {b.reward.toLocaleString()} CR</div>
            </Panel>
          ))}
        </div>
      )}
      {tab === 'weapons' && (
        <div className="grid md:grid-cols-3 gap-2 mt-4 max-w-6xl">
          {WEAPONS.map(w => (
            <Panel key={w.id} className="p-3">
              <div className="flex justify-between"><span className="font-bold text-[13px] text-slate-100">{w.name}</span><span className="text-[9px] px-1 border" style={{ color: w.color, borderColor: w.color }}>{w.slot.toUpperCase()}</span></div>
              <div className="text-[11px] text-slate-400 font-sans mt-0.5">{w.desc}</div>
              <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1"><Info className="w-3 h-3" /> {w.kind} · DMG {w.damage} · shield ×{w.shieldMult} · hull ×{w.hullMult}{w.aoe ? ` · AoE ${w.aoe}m` : ''}{w.homing ? ' · HOMING' : ''}</div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
