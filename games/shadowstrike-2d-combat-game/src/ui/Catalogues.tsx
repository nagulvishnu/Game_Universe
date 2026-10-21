import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../stores/gameStore';
import { ScreenShell, Panel, Button, Tag, RARITY_COLOR, hexStr, Stat } from './shared';
import { SKILLS, SKILL_CATEGORIES, type SkillCategory, type SkillDef } from '../data/skills';
import {
  WEAPONS, WEAPON_CATEGORIES, getWeapon, weaponSkins, applySkin, displayStats,
  type WeaponCategory, type WeaponDef, type Rarity,
} from '../data/weapons';
import { EQUIPMENT, EQUIP_SLOTS, EQUIPMENT_BY_ID, type EquipSlot } from '../data/equipment';
import type { Profile } from '../save/save';
import { FighterPreview } from './FighterPreview';
import { ItemIcon } from './ItemIcon';
import { SkillIcon } from './SkillIcon';
import { StandaloneWeaponPreview, WeaponRarityBadge } from './WeaponShowcase';
import { WeaponGlyph } from './WeaponGlyph';
import { CharacterLook } from './CharacterLook';

type Who = 'solo' | 'p1' | 'p2';

function WhoPicker({ who, setWho }: { who: Who; setWho: (w: Who) => void }) {
  return (
    <div className="flex gap-1 rounded-lg border border-white/10 bg-black/40 p-0.5 text-[11px]">
      {(['solo', 'p1', 'p2'] as Who[]).map((w) => (
        <button key={w} onClick={() => setWho(w)}
          className={`rounded-md px-2.5 py-1 uppercase tracking-wider transition ${who === w
            ? 'bg-gradient-to-r from-violet-600/50 to-fuchsia-600/40 text-white shadow-[0_0_12px_rgba(168,85,247,0.3)]'
            : 'text-slate-400 hover:text-white'}`}>
          {w === 'solo' ? 'Solo' : w.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- SKILLS */

const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const RARITY_RANK: Record<Rarity, number> = Object.fromEntries(RARITY_ORDER.map((r, i) => [r, i])) as Record<Rarity, number>;

type SkillSort = 'name' | 'rarity' | 'cooldown' | 'damage' | 'level';

function skillSortKey(s: SkillDef, sort: SkillSort, profile: Profile): string | number {
  const lv = profile.skillLevels[s.id] ?? 1;
  const cur = s.levels[lv - 1];
  switch (sort) {
    case 'name': return s.name;
    case 'rarity': return RARITY_RANK[s.rarity];
    case 'cooldown': return cur.cooldown;
    case 'damage': return -cur.damage;
    case 'level': return -lv;
    default: return s.name;
  }
}

export function SkillsScreen() {
  const setScreen = useGame((s) => s.setScreen);
  const profile = useGame((s) => s.profile);
  const unlockSkill = useGame((s) => s.unlockSkill);
  const upgradeSkill = useGame((s) => s.upgradeSkill);
  const equipSkill = useGame((s) => s.equipSkill);
  const [cat, setCat] = useState<SkillCategory | 'all' | 'owned'>('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SkillSort>('name');
  const [selId, setSelId] = useState(SKILLS[0].id);
  const [who, setWho] = useState<Who>('solo');

  const loadout = who === 'solo' ? profile.loadout : who === 'p1' ? profile.pvp.p1 : profile.pvp.p2;

  const list = useMemo(() => {
    const out = SKILLS.filter((s) => {
      if (cat === 'owned' && !profile.unlockedSkills.includes(s.id)) return false;
      if (cat !== 'all' && cat !== 'owned' && s.category !== cat) return false;
      if (q && !(`${s.name} ${s.description} ${s.kind} ${s.category}`.toLowerCase().includes(q.toLowerCase()))) return false;
      return true;
    });
    return out.sort((a, b) => {
      const ka = skillSortKey(a, sort, profile);
      const kb = skillSortKey(b, sort, profile);
      if (typeof ka === 'number' && typeof kb === 'number') return ka - kb;
      return String(ka).localeCompare(String(kb));
    });
  }, [cat, q, sort, profile.unlockedSkills, profile.skillLevels]);

  const sel: SkillDef = SKILLS.find((s) => s.id === selId) ?? SKILLS[0];
  const owned = profile.unlockedSkills.includes(sel.id);
  const level = owned ? (profile.skillLevels[sel.id] ?? 1) : 1;
  const maxed = level >= 5;
  const cur = sel.levels[level - 1];
  const next = sel.levels[level];
  const equipped = loadout.skills.includes(sel.id);
  const equippedSlot = loadout.skills.indexOf(sel.id);

  const unlockAffordable = profile.level >= sel.unlock.level && profile.shards >= sel.unlock.cost;
  const upgradeAffordable = owned && !maxed && profile.shards >= next!.cost;

  const slotLabel = (slot: 0 | 1 | 2) => ['E', 'R', 'V'][slot];
  const isEquippedInSlot = (slot: 0 | 1 | 2) => loadout.skills[slot] === sel.id;

  return (
    <ScreenShell title="Skill Catalogue" subtitle={`${SKILLS.length} abilities · ${SKILLS.length * 5} upgrade configurations`}
      onBack={() => setScreen('menu')}
      right={<span className="text-sm text-amber-300">🜛 {profile.shards.toLocaleString()}</span>}>
      <div className="grid gap-4 lg:grid-cols-[1fr_460px]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search skills…"
              className="w-56 border border-white/15 bg-black/50 px-3 py-1.5 text-sm outline-none focus:border-cyan-300/60" />
            <button onClick={() => setCat('all')} className={`border px-2 py-1 text-[11px] uppercase ${cat === 'all' ? 'border-cyan-300/60 text-white' : 'border-white/10 text-slate-400'}`}>All</button>
            <button onClick={() => setCat('owned')} className={`border px-2 py-1 text-[11px] uppercase ${cat === 'owned' ? 'border-cyan-300/60 text-white' : 'border-white/10 text-slate-400'}`}>Owned</button>
            {SKILL_CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)}
                className="border px-2 py-1 text-[11px] uppercase"
                style={{ borderColor: cat === c.id ? c.color : '#ffffff1a', color: cat === c.id ? c.color : '#94a3b8' }}>
                {c.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest text-slate-500 mb-1">
            <span className="flex-1 border-t border-white/5"></span>
            <span>Sort by</span>
            <span className="flex-1 border-t border-white/5"></span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {(['name', 'rarity', 'cooldown', 'damage'] as SkillSort[]).map((s) => (
              <button key={s} onClick={() => setSort(s)}
                className={`border px-2 py-1 text-xs ${sort === s ? 'border-cyan-300/60 bg-cyan-500/10 text-white' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}
                title={s}>
                {s === 'name' ? 'Name' : s === 'rarity' ? 'Rarity' : s === 'cooldown' ? 'Cooldown' : 'Damage'}
              </button>
            ))}
          </div>

          <div className="ss-scroll grid max-h-[70vh] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((s) => {
              const own = profile.unlockedSkills.includes(s.id);
              const lv = profile.skillLevels[s.id] ?? 0;
              const eq = loadout.skills.includes(s.id);
              const eqSlot = loadout.skills.indexOf(s.id);
              const maxedItem = lv >= 5;
              const selected = selId === s.id;
              return (
                <button key={s.id} onClick={() => setSelId(s.id)}
                  className={`group relative p-3 text-left transition border rounded ${
                    selected
                      ? 'border-violet-400/70 bg-violet-900/25 shadow-[0_0_16px_rgba(138,90,255,0.15)]'
                      : eq
                        ? 'border-cyan-300/50 bg-cyan-900/10'
                        : 'border-white/10 hover:border-white/25 hover:bg-white/4'
                  } ${own ? '' : 'opacity-65 grayscale-[0.35]'} ${maxedItem ? 'ring-1 ring-amber-500/35' : ''}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="shrink-0">
                      <SkillIcon skill={s} size={34} grade={own ? 'owned' : 'locked'} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="font-semibold text-white truncate">{s.name}</span>
                        {maxedItem && <span className="text-[9px] text-amber-400 font-bold">MAX</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Tag color={RARITY_COLOR[s.rarity]}>{s.rarity}</Tag>
                        <Tag color="#8899aa">{s.kind}</Tag>
                        {eq && <span className="ml-auto text-[9px] font-mono text-cyan-300">EQUIPPED · {slotLabel(eqSlot as 0 | 1 | 2)}</span>}
                        {!own && <span className="ml-auto text-[9px] text-rose-400">🔒 Lv.{s.unlock.level}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400">Lv.{lv}</span>
                    <span className={`font-mono ${own ? 'text-white' : 'text-slate-500'}`}>{(curLevelCooldown(s, lv) / 1000).toFixed(1)}s</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] text-slate-400 leading-snug">{s.description}</p>
                </button>
              );
            })}
            {list.length === 0 && <p className="text-sm text-slate-500">No skills match that filter.</p>}
          </div>
        </div>

        <Panel title={sel.name} className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="shrink-0">
              <SkillIcon skill={sel} size={64} grade={owned ? 'owned' : 'locked'} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Tag color={RARITY_COLOR[sel.rarity]}>{sel.rarity}</Tag>
                <Tag color={hexStr(sel.color)}>{sel.category}</Tag>
                <Tag color="#8899aa">{sel.kind}</Tag>
                <div className="ml-auto flex items-center gap-2">
                  <WhoPicker who={who} setWho={setWho} />
                </div>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="ss-title text-2xl text-white">{sel.name}</span>
                {maxed && <span className="ml-2 text-amber-400 font-bold">Signature level</span>}
                {!owned && <span className="ml-2 text-rose-400 font-bold">🔒 Locked</span>}
                {equipped && <span className="ml-2 text-cyan-300 font-bold">Equipped · {slotLabel(equippedSlot as 0 | 1 | 2)}</span>}
              </div>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-slate-300">{sel.description}</p>
          <p className="text-xs italic text-slate-500">Counterplay: {sel.counterplay}</p>

          <div className="grid grid-cols-4 gap-3">
            <Stat label="Damage" value={cur.damage} color="#ff8a3a" />
            <Stat label="Cooldown" value={`${(cur.cooldown / 1000).toFixed(1)}s`} color="#66e0ff" />
            <Stat label="Range" value={cur.range} />
            <Stat label="Duration" value={cur.duration ? `${(cur.duration / 1000).toFixed(1)}s` : '—'} />
          </div>

          <div className="border border-white/10 rounded bg-black/40 p-2">
            <div className="flex items-center justify-between border-b border-white/5 pb-1 mb-1">
              <span className="text-[10px] uppercase tracking-widest text-slate-500">Upgrade path</span>
              <span className="text-[10px] text-slate-400">Level {level} of 5</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {sel.levels.map((l) => {
                const active = l.level === level;
                const done = l.level < level;
                const coming = l.level === level + 1;
                return (
                  <div key={l.level}
                    className={`border p-1.5 text-xs rounded transition ${active
                      ? 'border-violet-400/60 bg-violet-900/30'
                      : done
                        ? 'border-emerald-400/35 bg-emerald-900/10'
                        : coming
                          ? 'border-amber-500/35 bg-amber-900/10'
                          : 'border-white/10'}`}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`font-bold ${active ? 'text-violet-300' : done ? 'text-emerald-300' : 'text-slate-500'}`}>
                        Lv.{l.level}
                      </span>
                      {done && <span className="text-[9px] text-emerald-400">✓</span>}
                      {coming && <span className="text-[9px] text-amber-400">🜛 {l.cost}</span>}
                    </div>
                    <p className="mt-0 text-[10px] leading-tight text-slate-400">{l.title}</p>
                    {l.perks.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-0.5">
                        {l.perks.map((p) => <Tag key={p} color="#b06bff">{p}</Tag>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {next && <div className="border border-white/10 rounded bg-black/30 p-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2">
              <span className="text-[10px] uppercase tracking-widest text-slate-500">Next upgrade · Lv.{next.level}</span>
              <span className="text-amber-300 font-mono text-xs">🜛 {next.cost}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="border border-white/5 rounded p-2">
                <div className="text-[9px] text-slate-500 uppercase">Damage</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-slate-400">{cur.damage}</span>
                  <span className={`text-${next.damage > cur.damage ? 'emerald-400' : 'slate-400'} font-bold`}>{next.damage > cur.damage ? '+' : ''}{next.damage - cur.damage}</span>
                </div>
              </div>
              <div className="border border-white/5 rounded p-2">
                <div className="text-[9px] text-slate-500 uppercase">Cooldown</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-slate-400">${(cur.cooldown / 1000).toFixed(1)}s</span>
                  <span className={`text-${next.cooldown < cur.cooldown ? 'emerald-400' : 'slate-400'} font-bold`}>
                    {next.cooldown < cur.cooldown ? '-' : ''}${((cur.cooldown - next.cooldown) / 1000).toFixed(1)}s
                  </span>
                </div>
              </div>
            </div>
            {next.perks.length > 0 && (
              <div className="mt-2">
                <div className="text-[9px] text-slate-500 uppercase mb-1">New perks</div>
                <div className="flex flex-wrap gap-1">
                  {next.perks.map((p) => <Tag key={p} color="#b06bff">{PERK_LABEL[p]}</Tag>)}
                </div>
              </div>
            )}
            <div className="mt-2 text-xs text-slate-400 leading-relaxed">{next.description}</div>
          </div>}

          <div className="border border-white/10 rounded bg-black/30 p-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2">
              <span className="text-[10px] uppercase tracking-widest text-slate-500">Requirements</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="border border-white/5 rounded p-2 flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full border ${profile.level >= sel.unlock.level ? 'border-emerald-400 bg-emerald-900/40' : 'border-rose-500/40 bg-rose-900/20'}`} />
                <span className={profile.level >= sel.unlock.level ? 'text-emerald-300' : 'text-rose-400'}>Requires level {sel.unlock.level} <span className="text-slate-500/70">(you are {profile.level})</span></span>
              </div>
              <div className="border border-white/5 rounded p-2 flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full border ${profile.shards >= sel.unlock.cost ? 'border-emerald-400 bg-emerald-900/40' : 'border-rose-500/40 bg-rose-900/20'}`} />
                <span className={profile.shards >= sel.unlock.cost ? 'text-emerald-300' : 'text-rose-400'}>🜛 {sel.unlock.cost} shards <span className="text-slate-500/70">(you have {profile.shards})</span></span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {!owned && (
              <Button onClick={() => unlockSkill(sel.id)}
                disabled={!unlockAffordable}
                title={!unlockAffordable ? (profile.level < sel.unlock.level ? `Requires level ${sel.unlock.level}` : 'Not enough shards') : undefined}>
                Unlock · 🜛 {sel.unlock.cost}
              </Button>
            )}
            {owned && next && !maxed && (
              <Button onClick={() => upgradeSkill(sel.id)}
                disabled={!upgradeAffordable || level >= 5}
                title={!upgradeAffordable ? 'Not enough shards' : undefined}>
                Upgrade to Lv.{next.level} · 🜛 {next.cost}
              </Button>
            )}
            {owned && maxed && <Tag color="#ffb000">Signature level reached</Tag>}
            {owned && [0, 1, 2].map((slot) => (
              <Button key={slot} variant="ghost"
                onClick={() => equipSkill(slot as 0 | 1 | 2, sel.id, who)}
                disabled={isEquippedInSlot(slot as 0 | 1 | 2)}>
                {isEquippedInSlot(slot as 0 | 1 | 2) ? `Equipped · ${slotLabel(slot as 0 | 1 | 2)}` : `Equip → ${slotLabel(slot as 0 | 1 | 2)}`}
              </Button>
            ))}
          </div>
          <div className="border-t border-white/10 pt-2 text-[11px] text-slate-400">
            Current {who} loadout: {loadout.skills.map((id, i) => `${slotLabel(i as 0 | 1 | 2)}:${SKILLS.find((s) => s.id === id)?.name ?? '—'}`).join('  ·  ')}
          </div>
        </Panel>
      </div>
    </ScreenShell>
  );
}

function curLevelCooldown(s: SkillDef, lv: number): number {
  return s.levels[Math.min(Math.max(lv, 1), 5) - 1].cooldown;
}

const PERK_LABEL: Record<string, string> = {
  pierce: 'Pierce', multishot: 'Multishot', burn: 'Burn', freeze: 'Freeze', shock: 'Shock', slow: 'Slow',
  stun: 'Stun', knockdown: 'Knockdown', lifesteal: 'Lifesteal', shield: 'Shield', haste: 'Haste',
  guardbreak: 'Guard break', extend: 'Extend', seek: 'Seek', split: 'Split', vortex: 'Vortex',
  refund: 'Refund', armor: 'Armor', chain: 'Chain', bigger: 'Bigger', echo: 'Echo', invuln: 'Invuln',
};

/* ---------------------------------------------------------------- WEAPONS */

/** Short trait line shown under the weapon name, e.g. "Fast · Agile · Precise". */
function weaponDescriptor(w: WeaponDef): string {
  const s = displayStats(w);
  const traits: string[] = [];
  if (s.speed >= 80) traits.push('Fast');
  if (s.damage >= 80) traits.push('Lethal');
  if (s.range >= 70) traits.push('Long Reach');
  if (s.recovery >= 60) traits.push('Responsive');
  if (traits.length === 0) traits.push('Precise');
  if (traits.length < 3) traits.push(s.knockback >= 25 ? 'Heavy Impact' : 'Precise');
  return traits.slice(0, 3).join(' · ');
}

function WeaponStatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[76px] shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <span className="ss-stat-bar flex-1">
        <span style={{ width: `${value}%`, background: `linear-gradient(90deg, ${color}, ${color}88)`, boxShadow: `0 0 8px ${color}88` }} />
      </span>
      <span className="w-7 shrink-0 text-right text-[11px] font-bold text-white">{value}</span>
    </div>
  );
}

export function WeaponsScreen() {
  const setScreen = useGame((s) => s.setScreen);
  const profile = useGame((s) => s.profile);
  const unlockWeapon = useGame((s) => s.unlockWeapon);
  const equipWeapon = useGame((s) => s.equipWeapon);
  const [cat, setCat] = useState<WeaponCategory | 'all'>('all');
  const [selId, setSelId] = useState(profile.loadout.weapon);
  const [who, setWho] = useState<Who>('solo');
  const [compareId, setCompareId] = useState<string | null>(null);
  const [skinByWeapon, setSkinByWeapon] = useState<Record<string, string>>({});

  const list = WEAPONS.filter((w) => cat === 'all' || w.category === cat);
  const sel = getWeapon(selId);
  const owned = profile.unlockedWeapons.includes(sel.id);
  const compare = compareId ? getWeapon(compareId) : null;
  const loadout = who === 'solo' ? profile.loadout : who === 'p1' ? profile.pvp.p1 : profile.pvp.p2;

  const skins = useMemo(() => weaponSkins(sel), [sel]);
  const skinId = skinByWeapon[sel.id] ?? 'base';
  const skin = skins.find((s) => s.id === skinId) ?? skins[0];
  const skinned = useMemo(() => applySkin(sel, skin), [sel, skin]);
  const stats = displayStats(sel);

  return (
    <ScreenShell title="Armory" subtitle={`${WEAPONS.length} weapons — each with its own combo, frame data and charged attack`}
      onBack={() => setScreen('menu')}
      right={<span className="text-sm font-bold text-cyan-300">🜛 {profile.shards.toLocaleString()}</span>}>
      <div className="grid gap-4 lg:grid-cols-[1fr_520px]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setCat('all')} className={`border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${cat === 'all' ? 'border-cyan-300/60 bg-cyan-500/10 text-white' : 'border-white/10 text-slate-400'}`}>All</button>
            {WEAPON_CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCat(c)}
                className={`border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${cat === c ? 'border-cyan-300/60 bg-cyan-500/10 text-white' : 'border-white/10 text-slate-400'}`}>{c}</button>
            ))}
          </div>
          <div className="ss-scroll grid max-h-[70vh] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((w) => {
              const own = profile.unlockedWeapons.includes(w.id);
              return (
                <button key={w.id} onClick={() => setSelId(w.id)}
                  className="ss-tile group relative overflow-hidden rounded p-2.5 text-left"
                  data-active={selId === w.id ? 'true' : 'false'}>
                  <div className="flex items-center gap-2">
                    <WeaponGlyph shape={w.shape} size={30} color={hexStr(w.color)} glow={hexStr(w.glow)} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-white">{w.name}</span>
                    {loadout.weapon === w.id && (
                      <span className="text-[9px] font-mono tracking-wider text-cyan-300">EQUIPPED</span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <WeaponRarityBadge rarity={w.rarity} />
                    <Tag color="#8899aa">{w.category}</Tag>
                    {!own && <Tag color="#ff8a3a">🔒 Lv.{w.unlock.level}</Tag>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ------------------------------- weapon showcase (mockup) --- */}
        <Panel className="space-y-4 p-4">
          <div>
            <h2 className="ss-title-gradient text-[30px] uppercase italic leading-none tracking-[0.06em]">{sel.name}</h2>
            <p className="mt-1 text-[12px] font-semibold text-cyan-200/85">{weaponDescriptor(sel)}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <div>
              <StandaloneWeaponPreview weapon={skinned} width={380} height={150} />
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <WeaponRarityBadge rarity={sel.rarity} />
                <Tag color="#8899aa">{sel.category}</Tag>
                <Tag color="#66e0ff">{sel.grip}-hand</Tag>
                {sel.tags.slice(0, 3).map((t) => <Tag key={t} color="#b06bff">{t}</Tag>)}
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-cyan-100/85">{sel.description}</p>
            </div>

            <div className="space-y-2 self-start rounded border border-white/8 bg-black/30 p-3">
              <div className="ss-label mb-1">Stats</div>
              <WeaponStatBar label="Damage" value={stats.damage} color="#ff8a3a" />
              <WeaponStatBar label="Speed" value={stats.speed} color="#22d3ee" />
              <WeaponStatBar label="Range" value={stats.range} color="#a855f7" />
              <WeaponStatBar label="Recovery" value={stats.recovery} color="#6cf0c0" />
              <WeaponStatBar label="Knockback" value={stats.knockback} color="#ff4a70" />
            </div>
          </div>

          {/* skins */}
          <div>
            <div className="ss-label mb-2">Weapon skins</div>
            <div className="grid grid-cols-5 gap-2">
              {skins.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSkinByWeapon((m) => ({ ...m, [sel.id]: s.id })); }}
                  className="ss-tile grid h-[70px] place-items-center rounded"
                  data-active={s.id === skin.id ? 'true' : 'false'}
                  title={s.name}
                >
                  <WeaponGlyph shape={sel.shape} size={44} color={hexStr(s.color)} glow={hexStr(s.glow)} />
                </button>
              ))}
            </div>
            <div className="mt-1 text-right text-[10px] uppercase tracking-widest text-slate-500">{skin.name}</div>
          </div>

          {/* chain + equip */}
          <div className="border-t border-white/8 pt-3">
            <div className="ss-label mb-1.5">Attack chain</div>
            {[...sel.combo, sel.charged].map((a) => (
              <div key={a.id} className="flex items-center justify-between border border-white/8 px-2 py-1 text-[11px]">
                <span className="font-semibold text-white">{a.heavy ? 'Charged' : a.name}</span>
                <span className="text-slate-400">{a.arc}</span>
                <span className="text-amber-300">{a.damage} dmg</span>
                <span className="text-cyan-300">{a.startup}/{a.active}/{a.recovery}ms</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <WhoPicker who={who} setWho={setWho} />
            {!owned ? (
              <Button onClick={() => unlockWeapon(sel.id)}
                disabled={profile.level < sel.unlock.level || profile.shards < sel.unlock.cost}>
                Unlock · 🜛 {sel.unlock.cost} {profile.level < sel.unlock.level ? `(Lv.${sel.unlock.level})` : ''}
              </Button>
            ) : (
              <Button onClick={() => equipWeapon(sel.id, who)}>Equip for {who.toUpperCase()}</Button>
            )}
            <Button variant="ghost" onClick={() => setCompareId(compareId === sel.id ? null : sel.id)}>
              {compareId === sel.id ? 'Clear comparison' : 'Pin for comparison'}
            </Button>
          </div>

          {compare && compare.id !== sel.id && (
            <div className="border-t border-white/10 pt-2">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">Compared with {compare.name}</div>
              <div className="grid grid-cols-2 gap-x-4 text-[11px]">
                <Stat label="Δ combo damage" value={sel.combo.reduce((a, c) => a + c.damage, 0) - compare.combo.reduce((a, c) => a + c.damage, 0)} />
                <Stat label="Δ reach" value={sel.combo[0].reach - compare.combo[0].reach} />
                <Stat label="Δ startup" value={`${sel.combo[0].startup - compare.combo[0].startup}ms`} />
                <Stat label="Δ speed" value={(sel.moveSpeedMul - compare.moveSpeedMul).toFixed(2)} />
              </div>
            </div>
          )}
        </Panel>
      </div>
    </ScreenShell>
  );
}

/* -------------------------------------------------------------- EQUIPMENT */

const SLOT_GROUPS: { label: string; slots: EquipSlot[] }[] = [
  { label: 'Head', slots: ['head', 'mask'] },
  { label: 'Torso', slots: ['outfit', 'armor'] },
  { label: 'Limbs', slots: ['gloves', 'boots'] },
  { label: 'Back', slots: ['back', 'aura'] },
  { label: 'Extras', slots: ['trail', 'emote'] },
];

type EquipSort = 'name' | 'rarity' | 'cost';

function formatMod(k: string, v: number): string {
  const sign = v > 0 ? '+' : '';
  if (k === 'maxHealth') return `HP ${sign}${v}`;
  if (k === 'moveSpeed') return `Speed ${sign}${Math.round(v * 100)}%`;
  if (k === 'guard') return `Guard ${sign}${Math.round(v * 100)}%`;
  if (k === 'cooldown') return `CD ${sign}${Math.round(v * 100)}%`;
  return `${k} ${sign}${v}`;
}

export function EquipmentScreen() {
  const setScreen = useGame((s) => s.setScreen);
  const profile = useGame((s) => s.profile);
  const unlockEquipment = useGame((s) => s.unlockEquipment);
  const equipItem = useGame((s) => s.equipItem);
  const [slot, setSlot] = useState<EquipSlot>('head');
  const [selId, setSelId] = useState<string>('');
  const [who, setWho] = useState<Who>('solo');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<EquipSort>('name');

  const loadout = who === 'solo' ? profile.loadout : who === 'p1' ? profile.pvp.p1 : profile.pvp.p2;

  // Keep the selection inside the currently viewed slot.
  useEffect(() => {
    const equipped = loadout.equipment[slot];
    if (!selId || EQUIPMENT_BY_ID[selId]?.slot !== slot) setSelId(equipped);
  }, [slot, selId, loadout.equipment]);

  const slotItems = useMemo(() => EQUIPMENT.filter((e) => e.slot === slot), [slot]);
  const list = useMemo(() => {
    return slotItems.filter((e) => !q || `${e.name} ${e.description} ${e.style}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name);
        if (sort === 'rarity') return RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity];
        return (a.unlock.cost ?? 0) - (b.unlock.cost ?? 0);
      });
  }, [slotItems, q, sort]);

  const sel = list.find((e) => e.id === selId) ?? list[0] ?? EQUIPMENT_BY_ID[loadout.equipment[slot]];
  const owned = sel ? profile.unlockedEquipment.includes(sel.id) : false;
  const equipped = sel ? loadout.equipment[sel.slot] === sel.id : false;
  const equippedItem = sel ? EQUIPMENT_BY_ID[loadout.equipment[sel.slot]] : null;

  return (
    <ScreenShell title="Equipment" subtitle={`${EQUIPMENT.length} items across ${EQUIP_SLOTS.length} slots — all visible on the fighter`}
      onBack={() => setScreen('menu')}
      right={
        <>
          <span className="text-sm text-amber-300">🜛 {profile.shards.toLocaleString()}</span>
          <WhoPicker who={who} setWho={setWho} />
        </>
      }>
      <div className="grid gap-4 lg:grid-cols-[230px_1fr_360px]">
        {/* Slot groups */}
        <Panel title="Slots" className="p-2 space-y-1.5">
          {SLOT_GROUPS.map((grp) => (
            <div key={grp.label} className="space-y-1">
              <div className="ss-label px-2">{grp.label}</div>
              {grp.slots.map((s) => {
                const equippedId = loadout.equipment[s];
                const item = EQUIPMENT_BY_ID[equippedId];
                const active = slot === s;
                return (
                  <button key={s} onClick={() => setSlot(s)}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-2 py-1.5 text-left text-xs transition ${active
                      ? 'border-violet-400/60 bg-gradient-to-r from-violet-900/40 to-fuchsia-900/15 text-white shadow-[0_0_14px_rgba(168,85,247,0.22)]'
                      : 'border-white/10 text-slate-400 hover:border-white/25 hover:bg-white/5'}`}>
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-md border"
                      style={{
                        borderColor: item ? RARITY_COLOR[item.rarity] + '88' : 'rgba(255,255,255,0.12)',
                        background: 'radial-gradient(circle at 50% 30%, rgba(168,85,247,0.16), rgba(8,8,16,0.9))',
                      }}
                    >
                      {item
                        ? <ItemIcon item={item} size={22} grade={profile.unlockedEquipment.includes(item.id) ? 'owned' : 'locked'} />
                        : <span className="text-[11px] font-bold text-slate-500">{s[0].toUpperCase()}</span>}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-semibold text-white">{item?.name ?? s}</span>
                      <span className="block text-[9px] uppercase tracking-widest text-slate-500">{s}</span>
                    </span>
                    {item && (
                      <span className="shrink-0 text-[9px] font-bold uppercase" style={{ color: RARITY_COLOR[item.rarity] }}>
                        {item.rarity.slice(0, 4)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </Panel>

        {/* Item catalogue */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
            <div className="flex items-center gap-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items…"
                className="w-48 rounded-md border border-white/15 bg-black/50 px-3 py-1.5 text-xs outline-none transition focus:border-cyan-300/60" />
              <span className="text-[10px] uppercase tracking-widest text-slate-500">{list.length} items</span>
            </div>
            <div className="flex gap-1">
              {(['name', 'rarity', 'cost'] as EquipSort[]).map((s) => (
                <button key={s} onClick={() => setSort(s)}
                  className={`rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-wider transition ${sort === s
                    ? 'border-cyan-300/60 bg-cyan-500/10 text-white'
                    : 'border-white/10 text-slate-400 hover:border-white/25 hover:text-white'}`}>
                  {s[0].toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="ss-scroll grid max-h-[78vh] grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((e) => {
              const own = profile.unlockedEquipment.includes(e.id);
              const eq = loadout.equipment[e.slot] === e.id;
              const locked = !own;
              const selNow = sel?.id === e.id;
              const rc = RARITY_COLOR[e.rarity];
              return (
                <button key={e.id} onClick={() => setSelId(e.id)}
                  className={`group relative overflow-hidden rounded-xl border p-3 text-left transition-all duration-150 ${selNow
                    ? 'bg-gradient-to-b from-violet-900/35 to-[#0b0c16]/95 shadow-[0_0_20px_rgba(168,85,247,0.28)]'
                    : eq
                      ? 'border-cyan-300/50 bg-cyan-900/10'
                      : 'border-white/10 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/5'
                  } ${locked ? 'opacity-70 grayscale-[0.4]' : ''}`}
                  style={selNow ? { borderColor: rc + 'cc' } : undefined}>
                  <span className="pointer-events-none absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${rc}, transparent)` }} />
                  <div className="relative flex items-start gap-2.5">
                    <span
                      className="relative grid h-12 w-12 shrink-0 place-items-center rounded-lg border"
                      style={{
                        borderColor: rc + '77',
                        background: `radial-gradient(circle at 50% 30%, ${rc}22, rgba(8,8,16,0.9))`,
                        boxShadow: eq ? `0 0 14px ${rc}55` : undefined,
                      }}
                    >
                      <ItemIcon item={e} size={30} grade={locked ? 'locked' : eq ? 'equipped' : 'owned'} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-1">
                        <span className="truncate text-[13px] font-bold text-white">{e.name}</span>
                        <Tag color={rc}>{e.rarity}</Tag>
                      </span>
                      <span className="mt-0.5 block line-clamp-1 text-[10px] text-slate-400">{e.description}</span>
                    </span>
                    {eq && (
                      <span className="absolute right-0 top-0 rounded-full border border-cyan-300/50 bg-cyan-500/15 px-1.5 py-0.5 text-[8px] font-bold tracking-widest text-cyan-200">
                        EQUIPPED
                      </span>
                    )}
                  </div>
                  {e.mods && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Object.entries(e.mods).map(([k, v]) => (
                        <Tag key={k} color="#55d68a">{formatMod(k, v as number)}</Tag>
                      ))}
                    </div>
                  )}
                  <div className="mt-2.5 flex gap-1.5">
                    {locked ? (
                      <Button onClick={() => unlockEquipment(e.id)}
                        disabled={profile.level < e.unlock.level || profile.shards < e.unlock.cost}>
                        🜛 {e.unlock.cost}
                      </Button>
                    ) : (
                      <Button variant={eq ? 'ghost' : 'primary'} onClick={() => equipItem(e.slot, e.id, who)}>
                        {eq ? 'Equipped' : 'Equip'}
                      </Button>
                    )}
                  </div>
                </button>
              );
            })}
            {list.length === 0 && <p className="text-sm text-slate-500">No items match that filter.</p>}
          </div>
        </div>

        {/* Detail panel */}
        <Panel title="Details" className="p-4 space-y-4">
          {sel ? (
            <>
              <div className="relative overflow-hidden rounded-xl border p-3"
                style={{
                  borderColor: RARITY_COLOR[sel.rarity] + '55',
                  background: `radial-gradient(circle at 85% 20%, ${RARITY_COLOR[sel.rarity]}22, rgba(8,8,16,0.85) 70%)`,
                }}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="shrink-0">
                    <ItemIcon item={sel} size={80} grade={owned ? 'owned' : 'locked'} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Tag color={RARITY_COLOR[sel.rarity]}>{sel.rarity}</Tag>
                      <Tag color="#8899aa">{sel.slot[0].toUpperCase() + sel.slot.slice(1)}</Tag>
                      <span className="ml-auto text-[10px] text-slate-500">🜛 {sel.unlock.cost}</span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="ss-title text-2xl text-white">{sel.name}</span>
                      {equipped && <span className="ml-2 text-cyan-300 font-bold">Equipped</span>}
                      {!owned && <span className="ml-2 text-rose-400 font-bold">🔒 Locked</span>}
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-slate-300">{sel.description}</p>

              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="ss-label mb-2">Statistics</div>
                {sel.mods ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(sel.mods).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-2 rounded-md border border-white/8 bg-white/[0.03] px-2.5 py-2">
                        <span className="text-slate-400 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="font-mono font-bold text-emerald-300">{formatMod(k, v as number)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Cosmetic only — no gameplay statistics.</p>
                )}
              </div>

              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="ss-label mb-2">Requirements</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className={`flex items-center gap-2 rounded-md border px-2.5 py-2 ${profile.level >= sel.unlock.level ? 'border-emerald-400/35 bg-emerald-900/15' : 'border-rose-500/35 bg-rose-900/15'}`}>
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${profile.level >= sel.unlock.level ? 'bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]' : 'bg-rose-500'}`} />
                    <span className={profile.level >= sel.unlock.level ? 'text-emerald-300' : 'text-rose-300'}>
                      Level {sel.unlock.level} <span className="text-slate-500/70">(you are {profile.level})</span>
                    </span>
                  </div>
                  <div className={`flex items-center gap-2 rounded-md border px-2.5 py-2 ${profile.shards >= sel.unlock.cost ? 'border-emerald-400/35 bg-emerald-900/15' : 'border-rose-500/35 bg-rose-900/15'}`}>
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${profile.shards >= sel.unlock.cost ? 'bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]' : 'bg-rose-500'}`} />
                    <span className={profile.shards >= sel.unlock.cost ? 'text-emerald-300' : 'text-rose-300'}>
                      🜛 {sel.unlock.cost} <span className="text-slate-500/70">(you have {profile.shards})</span>
                    </span>
                  </div>
                </div>
              </div>

              {equippedItem && equippedItem.id !== sel.id && (
                <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                  <div className="ss-label mb-2">Compared with equipped {equippedItem.name}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Stat label="Δ HP" value={(sel.mods?.maxHealth ?? 0) - (equippedItem.mods?.maxHealth ?? 0)} />
                    <Stat label="Δ Speed" value={Math.round(((sel.mods?.moveSpeed ?? 0) - (equippedItem.mods?.moveSpeed ?? 0)) * 100)} />
                    <Stat label="Δ Guard" value={Math.round(((sel.mods?.guard ?? 0) - (equippedItem.mods?.guard ?? 0)) * 100)} />
                    <Stat label="Δ CD" value={Math.round(((sel.mods?.cooldown ?? 0) - (equippedItem.mods?.cooldown ?? 0)) * 100)} />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {!owned && (
                  <Button onClick={() => unlockEquipment(sel.id)}
                    disabled={profile.level < sel.unlock.level || profile.shards < sel.unlock.cost}>
                    Unlock · 🜛 {sel.unlock.cost}
                  </Button>
                )}
                {owned && !equipped && (
                  <Button onClick={() => equipItem(sel.slot, sel.id, who)}>Equip</Button>
                )}
                {owned && equipped && <Button variant="ghost" disabled>Equipped</Button>}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Select an item to view details.</p>
          )}
        </Panel>
      </div>
    </ScreenShell>
  );
}

/* --------------------------------------------------------------- LOADOUT */

export function LoadoutScreen() {
  const setScreen = useGame((s) => s.setScreen);
  const profile = useGame((s) => s.profile);
  const saveLoadout = useGame((s) => s.saveLoadout);
  const applySavedLoadout = useGame((s) => s.applySavedLoadout);
  const deleteSavedLoadout = useGame((s) => s.deleteSavedLoadout);
  const equipSkill = useGame((s) => s.equipSkill);
  const equipWeapon = useGame((s) => s.equipWeapon);
  const equipItem = useGame((s) => s.equipItem);
  const [name, setName] = useState('');
  const [who, setWho] = useState<Who>('solo');

  const loadout = who === 'solo' ? profile.loadout : who === 'p1' ? profile.pvp.p1 : profile.pvp.p2;
  const ownedSkills = SKILLS.filter((s) => profile.unlockedSkills.includes(s.id));
  const ownedWeapons = WEAPONS.filter((w) => profile.unlockedWeapons.includes(w.id));

  return (
    <ScreenShell title="Loadout" subtitle="Weapon, three skills and cosmetics — saved automatically"
      onBack={() => setScreen('menu')} right={<WhoPicker who={who} setWho={setWho} />}>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Panel title="Fighter" className="space-y-3 p-4">
          <FighterPreview weaponId={loadout.weapon}
            bodyColor={who === 'p2' ? 0x14101c : 0x0d0d14}
            eyeColor={who === 'p2' ? 0xff5a7a : 0x7fd4ff}
            equipment={Object.values(loadout.equipment)} fighterId={who === 'p2' ? 'raze' : 'kage'} width={250} height={250} />
          <Button full variant="ghost" onClick={() => setScreen('equipment')}>Change appearance</Button>
          {who === 'solo' && (
            <div className="space-y-2 border-t border-white/10 pt-3">
              <div className="flex gap-2">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Preset name"
                  className="min-w-0 flex-1 border border-white/15 bg-black/50 px-2 py-1 text-sm outline-none focus:border-cyan-300/60" />
                <Button onClick={() => { saveLoadout(name); setName(''); }}>Save</Button>
              </div>
              {profile.savedLoadouts.map((l, i) => (
                <div key={i} className="flex items-center gap-2 border border-white/10 px-2 py-1 text-xs">
                  <span className="flex-1 truncate">{l.name}</span>
                  <button className="text-cyan-300 hover:underline" onClick={() => applySavedLoadout(i)}>apply</button>
                  <button className="text-rose-400 hover:underline" onClick={() => deleteSavedLoadout(i)}>×</button>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <CharacterLook />

          <Panel title="Weapon" className="p-3">
            <div className="ss-scroll flex max-h-40 flex-wrap gap-2 overflow-y-auto">
              {ownedWeapons.map((w) => (
                <button key={w.id} onClick={() => equipWeapon(w.id, who)}
                  className={`border px-2 py-1 text-xs ${loadout.weapon === w.id ? 'border-cyan-300/60 bg-cyan-500/10 text-white' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}>
                  {w.name}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Equipment" className="p-3 space-y-2">
            {EQUIP_SLOTS.map((s) => {
              const owned = EQUIPMENT.filter((e) => e.slot === s.id && profile.unlockedEquipment.includes(e.id));
              const equippedId = loadout.equipment[s.id];
              const equipped = EQUIPMENT_BY_ID[equippedId];
              return (
                <div key={s.id} className="border border-white/10 rounded p-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-slate-500 w-20">{s.label}</span>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {equipped && <ItemIcon item={equipped} size={20} grade="owned" />}
                      <span className="text-xs text-slate-300 truncate">{equipped?.name ?? '—'}</span>
                      <span className="ml-auto text-[10px] text-slate-500">{equipped?.rarity[0].toUpperCase() ?? '—'}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {owned.map((e) => (
                      <button key={e.id} onClick={() => equipItem(s.id, e.id, who)}
                        className={`border px-2 py-1 text-xs rounded transition ${
                          loadout.equipment[s.id] === e.id
                            ? 'border-cyan-300/60 bg-cyan-500/10 text-white'
                            : 'border-white/10 text-slate-400 hover:bg-white/5'
                        }`}>
                        {e.name.slice(0, 10)}
                      </button>
                    ))}
                    {owned.length === 0 && <span className="text-[10px] text-slate-500">None owned</span>}
                  </div>
                </div>
              );
            })}
          </Panel>

          {[0, 1, 2].map((slot) => (
            <Panel key={slot} title={`Skill slot ${['E', 'R', 'V'][slot]}`} className="p-3">
              <div className="ss-scroll flex max-h-36 flex-wrap gap-2 overflow-y-auto">
                {ownedSkills.map((s) => (
                  <button key={s.id} onClick={() => equipSkill(slot as 0 | 1 | 2, s.id, who)}
                    className={`border px-2 py-1 text-xs ${loadout.skills[slot] === s.id ? 'border-cyan-300/60 bg-cyan-500/10 text-white' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}
                    style={{ borderLeftColor: hexStr(s.color), borderLeftWidth: 3 }}>
                    {s.name} <span className="text-[10px] text-amber-300">Lv.{profile.skillLevels[s.id] ?? 1}</span>
                  </button>
                ))}
              </div>
            </Panel>
          ))}
          <Button variant="ghost" onClick={() => setScreen('skills')}>Browse full skill catalogue →</Button>
        </div>
      </div>
    </ScreenShell>
  );
}
