import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import {
  ArrowLeft,
  Check,
  Crosshair,
  Flame,
  Lock,
  Shield,
  Sliders,
  Volume2,
} from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { computeWeaponStats } from '../combat/ballistics';
import {
  AMMO_TYPES,
  DEFAULT_LOADOUT_CONFIG,
  EQUIPMENT_ITEMS,
  getAttachmentsForSlot,
} from '../data/customization';
import { WEAPONS } from '../data/weapons';
import {
  AmmoType,
  AttachmentSlot,
  PlayerSaveData,
  WeaponLoadoutConfig,
} from '../types/game';
import { ProceduralRifle } from '../weapons/ProceduralRifle';

interface WeaponWorkshopProps {
  save: PlayerSaveData;
  onUpdateSave: (updater: (prev: PlayerSaveData) => PlayerSaveData) => void;
  onBack: () => void;
  onDeployTestRange: () => void;
}

const SLOTS_LIST: { slot: AttachmentSlot; label: string }[] = [
  { slot: 'optic', label: 'Optic' },
  { slot: 'muzzle', label: 'Muzzle' },
  { slot: 'barrel', label: 'Barrel' },
  { slot: 'underbarrel', label: 'Underbarrel' },
  { slot: 'stock', label: 'Stock' },
  { slot: 'magazine', label: 'Magazine' },
  { slot: 'skin', label: 'Camo Skin' },
  { slot: 'reticle', label: 'Reticle' },
  { slot: 'charm', label: 'Charm' },
];

export const WeaponWorkshop: React.FC<WeaponWorkshopProps> = ({
  save,
  onUpdateSave,
  onBack,
  onDeployTestRange,
}) => {
  const [selectedWeaponId, setSelectedWeaponId] = useState<string>(save.equippedWeaponId);
  const [activeTab, setActiveTab] = useState<'rifles' | 'attachments' | 'gear'>('rifles');
  const [activeSlot, setActiveSlot] = useState<AttachmentSlot>('optic');
  const [boltAnim, setBoltAnim] = useState(0);
  const [flashAnim, setFlashAnim] = useState(0);

  const selectedWeapon = WEAPONS.find((w) => w.id === selectedWeaponId) ?? WEAPONS[0];
  const weaponOwned = save.unlockedWeapons.includes(selectedWeapon.id);
  const isEquipped = save.equippedWeaponId === selectedWeapon.id;
  const currentLoadout: WeaponLoadoutConfig = {
    ...DEFAULT_LOADOUT_CONFIG,
    ...(save.weaponLoadouts[selectedWeapon.id] ?? {}),
  };

  const stats = computeWeaponStats(selectedWeapon, currentLoadout, save.equippedAmmo);

  const handleTestFirePreview = () => {
    soundEngine.playRifleShot(stats.isSuppressed, stats.damage >= 130);
    if (selectedWeapon.action === 'bolt') {
      soundEngine.playBoltCycle(0.2);
    }
    setFlashAnim(1);
    setTimeout(() => setFlashAnim(0), 120);

    let step = 0;
    const interval = setInterval(() => {
      step += 0.1;
      if (step >= 1) {
        setBoltAnim(0);
        clearInterval(interval);
      } else {
        setBoltAnim(step);
      }
    }, 45);
  };

  const handleBuyOrEquipWeapon = () => {
    if (weaponOwned) {
      soundEngine.playUiTone('objective');
      onUpdateSave((prev) => ({
        ...prev,
        equippedWeaponId: selectedWeapon.id,
      }));
      return;
    }

    if (save.rank < selectedWeapon.unlockRank || save.credits < selectedWeapon.price) return;
    soundEngine.playUiTone('objective');
    onUpdateSave((prev) => ({
      ...prev,
      credits: prev.credits - selectedWeapon.price,
      unlockedWeapons: [...prev.unlockedWeapons, selectedWeapon.id],
      equippedWeaponId: selectedWeapon.id,
    }));
  };

  const handleAttachmentAction = (attId: string, price: number, reqRank: number) => {
    const owned = save.ownedAttachments.includes(attId);
    if (owned) {
      soundEngine.playUiTone('click');
      onUpdateSave((prev) => ({
        ...prev,
        weaponLoadouts: {
          ...prev.weaponLoadouts,
          [selectedWeapon.id]: {
            ...currentLoadout,
            [activeSlot]: attId,
          },
        },
      }));
      return;
    }

    if (save.rank < reqRank || save.credits < price) return;
    soundEngine.playUiTone('objective');
    onUpdateSave((prev) => ({
      ...prev,
      credits: prev.credits - price,
      ownedAttachments: [...prev.ownedAttachments, attId],
      weaponLoadouts: {
        ...prev.weaponLoadouts,
        [selectedWeapon.id]: {
          ...currentLoadout,
          [activeSlot]: attId,
        },
      },
    }));
  };

  return (
    <div className="fixed inset-0 bg-zinc-950 text-zinc-100 flex flex-col tactical-grid z-30">
      {/* Top Header */}
      <header className="h-16 border-b border-zinc-800/90 bg-zinc-950/90 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono flex items-center gap-2 transition"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span>HQ MENU</span>
          </button>
          <div>
            <div className="text-[10px] font-mono tracking-[0.2em] text-amber-400">
              TASK FORCE DEADLINE // ARMORY & GUNSMITH
            </div>
            <h1 className="text-lg font-black tracking-wide">3D WEAPON WORKSHOP</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-1.5 text-right font-mono">
            <div className="text-[10px] text-zinc-400">RANK {save.rank} CREDITS</div>
            <div className="text-base font-black text-amber-400">
              ₵ {save.credits.toLocaleString()}
            </div>
          </div>

          <button
            onClick={onDeployTestRange}
            className="px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-mono text-xs font-black tracking-wider transition shadow-lg"
          >
            TEST ON RANGE →
          </button>
        </div>
      </header>

      {/* Main Content Split */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
        {/* Left Navigation Panel: Rifles / Attachments / Ammo & Gear */}
        <div className="lg:col-span-5 border-r border-zinc-800/90 flex flex-col min-h-0 bg-zinc-950/75">
          {/* Category Switch Tabs */}
          <div className="grid grid-cols-3 border-b border-zinc-800 p-2 gap-2 shrink-0">
            <button
              onClick={() => setActiveTab('rifles')}
              className={`py-2 rounded-lg font-mono text-xs font-bold transition ${
                activeTab === 'rifles'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              ARSENAL ({save.unlockedWeapons.length}/15)
            </button>
            <button
              onClick={() => setActiveTab('attachments')}
              className={`py-2 rounded-lg font-mono text-xs font-bold transition ${
                activeTab === 'attachments'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              ATTACHMENTS
            </button>
            <button
              onClick={() => setActiveTab('gear')}
              className={`py-2 rounded-lg font-mono text-xs font-bold transition ${
                activeTab === 'gear'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              AMMO & GEAR
            </button>
          </div>

          {/* Scrollable List Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {activeTab === 'rifles' &&
              WEAPONS.map((w) => {
                const owned = save.unlockedWeapons.includes(w.id);
                const equipped = save.equippedWeaponId === w.id;
                const selected = selectedWeapon.id === w.id;
                const tierColor =
                  w.tier === 'Elite'
                    ? 'text-purple-400 border-purple-500/40 bg-purple-950/40'
                    : w.tier === 'Advanced'
                    ? 'text-cyan-400 border-cyan-500/40 bg-cyan-950/40'
                    : w.tier === 'Intermediate'
                    ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40'
                    : 'text-zinc-300 border-zinc-700 bg-zinc-900';

                return (
                  <div
                    key={w.id}
                    onClick={() => {
                      soundEngine.playUiTone('click');
                      setSelectedWeaponId(w.id);
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition ${
                      selected
                        ? 'bg-zinc-900 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.12)]'
                        : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${tierColor}`}>
                          {w.tier.toUpperCase()}
                        </span>
                        <span className="font-bold text-sm text-white">{w.name}</span>
                      </div>
                      {equipped ? (
                        <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded flex items-center gap-1">
                          <Check className="w-3 h-3" /> EQUIPPED
                        </span>
                      ) : owned ? (
                        <span className="text-[10px] font-mono text-zinc-400">OWNED</span>
                      ) : (
                        <span className="text-xs font-mono text-amber-400 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> ₵{w.price.toLocaleString()} (RNK {w.unlockRank})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-1.5 line-clamp-2">{w.description}</p>
                    <div className="mt-2 flex items-center gap-4 text-[11px] font-mono text-zinc-300">
                      <span>DMG {w.damage}</span>
                      <span>RNG {w.effectiveRange}m</span>
                      <span>VEL {w.muzzleVelocity}m/s</span>
                      <span>{w.action === 'semi' ? 'SEMI-AUTO' : 'BOLT'}</span>
                    </div>
                  </div>
                );
              })}

            {activeTab === 'attachments' && (
              <div className="space-y-3">
                {/* 9 Slot Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {SLOTS_LIST.map((s) => (
                    <button
                      key={s.slot}
                      onClick={() => setActiveSlot(s.slot)}
                      className={`px-2.5 py-1.5 rounded text-xs font-mono border transition ${
                        activeSlot === s.slot
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-2 pt-1">
                  {getAttachmentsForSlot(activeSlot).map((att) => {
                    // Check optic compatibility
                    const compatible =
                      !att.opticType || selectedWeapon.compatibleOptics.includes(att.opticType);
                    const owned = save.ownedAttachments.includes(att.id);
                    const equippedOnWeapon = currentLoadout[activeSlot] === att.id;
                    const rankLocked = save.rank < att.unlockRank;

                    return (
                      <div
                        key={att.id}
                        className={`p-3 rounded-xl border transition ${
                          equippedOnWeapon
                            ? 'bg-zinc-900 border-emerald-500/70'
                            : 'bg-zinc-900/60 border-zinc-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-white">{att.name}</span>
                          {equippedOnWeapon ? (
                            <span className="text-[10px] font-mono text-emerald-400 font-bold">
                              INSTALLED
                            </span>
                          ) : owned ? (
                            <button
                              disabled={!compatible}
                              onClick={() => handleAttachmentAction(att.id, att.price, att.unlockRank)}
                              className="px-3 py-1 rounded bg-zinc-800 hover:bg-emerald-600 text-xs font-mono text-white transition"
                            >
                              {compatible ? 'INSTALL' : 'INCOMPATIBLE'}
                            </button>
                          ) : (
                            <button
                              disabled={!compatible || rankLocked || save.credits < att.price}
                              onClick={() => handleAttachmentAction(att.id, att.price, att.unlockRank)}
                              className={`px-3 py-1 rounded text-xs font-mono font-bold transition ${
                                !compatible || rankLocked || save.credits < att.price
                                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                  : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                              }`}
                            >
                              {rankLocked
                                ? `RANK ${att.unlockRank}`
                                : `BUY ₵${att.price}`}
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">{att.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'gear' && (
              <div className="space-y-5">
                {/* Ammunition Category Selector */}
                <div>
                  <h3 className="text-xs font-mono uppercase tracking-wider text-amber-400 mb-2">
                    Default Mission Ammunition Load
                  </h3>
                  <div className="space-y-2">
                    {(Object.keys(AMMO_TYPES) as AmmoType[]).map((aKey) => {
                      const ammo = AMMO_TYPES[aKey];
                      const active = save.equippedAmmo === aKey;
                      return (
                        <div
                          key={aKey}
                          onClick={() => {
                            soundEngine.playUiTone('click');
                            onUpdateSave((prev) => ({ ...prev, equippedAmmo: aKey }));
                          }}
                          className={`p-3 rounded-xl border cursor-pointer transition ${
                            active
                              ? 'bg-zinc-900 border-cyan-400'
                              : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-white">{ammo.name}</span>
                            <span className="text-[10px] font-mono text-cyan-300">
                              {active ? 'SELECTED' : 'SELECT'}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-1">{ammo.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Secondary Equipment Gadget Unlocks & Slots */}
                <div>
                  <h3 className="text-xs font-mono uppercase tracking-wider text-amber-400 mb-2">
                    Tactical Secondary Equipment (Slots [1] & [2])
                  </h3>
                  <div className="space-y-2">
                    {EQUIPMENT_ITEMS.filter((e) => e.id !== 'binoculars').map((eq) => {
                      const unlocked = save.unlockedEquipment.includes(eq.id);
                      const inSlot1 = save.equippedSlots[0] === eq.id;
                      const inSlot2 = save.equippedSlots[1] === eq.id;
                      const rankLocked = save.rank < eq.unlockRank;

                      return (
                        <div
                          key={eq.id}
                          className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="text-sm font-bold text-white">{eq.name}</span>
                              <span className="ml-2 text-[10px] font-mono text-zinc-400">
                                x{eq.maxCharges} charges
                              </span>
                            </div>
                            {!unlocked ? (
                              <button
                                disabled={rankLocked || save.credits < eq.price}
                                onClick={() => {
                                  soundEngine.playUiTone('objective');
                                  onUpdateSave((prev) => ({
                                    ...prev,
                                    credits: prev.credits - eq.price,
                                    unlockedEquipment: [...prev.unlockedEquipment, eq.id],
                                  }));
                                }}
                                className={`px-3 py-1 rounded text-xs font-mono font-bold ${
                                  rankLocked || save.credits < eq.price
                                    ? 'bg-zinc-800 text-zinc-500'
                                    : 'bg-amber-500 text-zinc-950'
                                }`}
                              >
                                {rankLocked ? `RANK ${eq.unlockRank}` : `UNLOCK ₵${eq.price}`}
                              </button>
                            ) : (
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() =>
                                    onUpdateSave((prev) => ({
                                      ...prev,
                                      equippedSlots: [eq.id, prev.equippedSlots[1]],
                                    }))
                                  }
                                  className={`px-2.5 py-1 rounded text-[11px] font-mono border ${
                                    inSlot1
                                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                                      : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                                  }`}
                                >
                                  SLOT 1
                                </button>
                                <button
                                  onClick={() =>
                                    onUpdateSave((prev) => ({
                                      ...prev,
                                      equippedSlots: [prev.equippedSlots[0], eq.id],
                                    }))
                                  }
                                  className={`px-2.5 py-1 rounded text-[11px] font-mono border ${
                                    inSlot2
                                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                                      : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                                  }`}
                                >
                                  SLOT 2
                                </button>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400">{eq.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Live Interactive 3D Rifle Preview + Ballistic Statistics */}
        <div className="lg:col-span-7 flex flex-col min-h-0 relative">
          {/* Interactive 3D Weapon Viewport */}
          <div className="flex-1 relative min-h-[280px] bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
            <Canvas shadows camera={{ position: [1.45, 0.35, 0.95], fov: 42 }}>
              <ambientLight intensity={1.1} />
              <directionalLight position={[4, 6, 4]} intensity={2.2} castShadow />
              <directionalLight position={[-4, 2, -3]} intensity={1.1} color="#38bdf8" />
              <pointLight position={[0, -1, 1]} intensity={0.8} color="#f59e0b" />

              <group rotation={[0, -Math.PI / 2.4, 0]} position={[0, 0, -0.15]}>
                <ProceduralRifle
                  weapon={selectedWeapon}
                  loadout={currentLoadout}
                  boltCycleProgress={boltAnim}
                  muzzleFlashIntensity={flashAnim}
                  scale={1.15}
                />
              </group>

              <OrbitControls
                enablePan={false}
                minDistance={0.95}
                maxDistance={2.8}
                autoRotate
                autoRotateSpeed={0.85}
              />
            </Canvas>

            {/* Overlay Weapon Header & Live Fire Test Button */}
            <div className="absolute top-4 left-5 right-5 flex items-start justify-between pointer-events-none">
              <div>
                <span className="text-xs font-mono text-amber-400">
                  {selectedWeapon.code} // {selectedWeapon.tier.toUpperCase()} TIER
                </span>
                <h2 className="text-2xl font-black text-white">{selectedWeapon.name}</h2>
                <p className="text-xs text-zinc-400 max-w-md mt-0.5">
                  Drag with mouse/touch to rotate 360° • Zoom to inspect attachments
                </p>
              </div>

              <div className="flex gap-2 pointer-events-auto">
                <button
                  onClick={handleTestFirePreview}
                  className="px-3.5 py-2 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono text-amber-300 flex items-center gap-1.5"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>TEST FIRE & BOLT</span>
                </button>

                <button
                  onClick={handleBuyOrEquipWeapon}
                  disabled={
                    !weaponOwned &&
                    (save.rank < selectedWeapon.unlockRank || save.credits < selectedWeapon.price)
                  }
                  className={`px-5 py-2 rounded-lg font-mono text-xs font-black tracking-wider transition ${
                    isEquipped
                      ? 'bg-emerald-600/30 border border-emerald-400 text-emerald-300'
                      : weaponOwned
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
                      : save.rank < selectedWeapon.unlockRank || save.credits < selectedWeapon.price
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                  }`}
                >
                  {isEquipped
                    ? '✓ CURRENTLY EQUIPPED'
                    : weaponOwned
                    ? 'EQUIP THIS RIFLE'
                    : save.rank < selectedWeapon.unlockRank
                    ? `LOCKED (RANK ${selectedWeapon.unlockRank})`
                    : `PURCHASE & EQUIP (₵${selectedWeapon.price.toLocaleString()})`}
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Weapon Ballistics Stat Comparison Panel */}
          <div className="border-t border-zinc-800 bg-zinc-950 p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 shrink-0">
            <StatBar label="DAMAGE" value={stats.damage} max={185} unit="" icon={<Flame className="w-3.5 h-3.5 text-red-400" />} />
            <StatBar label="EFFECTIVE RANGE" value={stats.effectiveRange} max={540} unit="m" icon={<Crosshair className="w-3.5 h-3.5 text-amber-400" />} />
            <StatBar label="MUZZLE VELOCITY" value={stats.muzzleVelocity} max={1380} unit="m/s" icon={<Sliders className="w-3.5 h-3.5 text-cyan-400" />} />
            <StatBar label="PRECISION RATING" value={stats.accuracy} max={100} unit="%" icon={<Shield className="w-3.5 h-3.5 text-emerald-400" />} />

            <div className="col-span-2 sm:col-span-4 flex flex-wrap items-center justify-between pt-2 border-t border-zinc-800/80 text-xs font-mono text-zinc-400 gap-3">
              <span>MAGAZINE: <strong className="text-white">{stats.magSize} RDS</strong></span>
              <span>RELOAD: <strong className="text-white">{stats.reloadTime}s</strong></span>
              <span>FIRE RATE: <strong className="text-white">{stats.fireRateRpm} RPM</strong></span>
              <span>ARMOR PEN: <strong className="text-cyan-400">{Math.round(stats.armorPenetration * 100)}%</strong></span>
              <span>
                ACOUSTIC RADIUS:{' '}
                <strong className={stats.isSuppressed ? 'text-emerald-400' : 'text-amber-400'}>
                  {stats.soundRadius}m ({stats.isSuppressed ? 'SILENCED' : 'LOUD'})
                </strong>
              </span>
              <span>OPTIC ZOOM: <strong className="text-amber-300">{stats.zoomLevels.join('x / ')}x</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatBar: React.FC<{
  label: string;
  value: number;
  max: number;
  unit: string;
  icon: React.ReactNode;
}> = ({ label, value, max, unit, icon }) => {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-zinc-400 flex items-center gap-1">
          {icon} {label}
        </span>
        <span className="font-bold text-white">
          {value}
          {unit}
        </span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};
