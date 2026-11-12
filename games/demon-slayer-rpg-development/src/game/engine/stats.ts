import { CHAR_BY_ID } from '../data/characters';
import { EQUIPMENT, SWORDS, swordMult } from '../data/items';
import { ALL_SKILLS } from '../data/styles';
import type { CharDef, Profile, SkillDef } from '../types';

export interface PStats {
  maxHp: number; maxSta: number; atk: number; def: number; spd: number; maxBreath: number; crit: number; critDmg: number;
  breathMul: number; breathRegen: number; staRegen: number; bladeColor: number; glow: number; burn: boolean; poison: boolean; steal: number; maxUlt: number;
}

export const xpNeed = (lvl: number) => Math.floor(70 * Math.pow(lvl, 1.35));

export function computeStats(p: Profile): PStats {
  const def = CHAR_BY_ID[p.activeChar];
  const cp = p.chars[p.activeChar];
  const L = cp.level;
  const pas = (id: string) => cp.passives[id] ?? 0;
  const eq = { hp: 0, def: 0, sta: 0, atk: 0, spd: 0, breath: 0, crit: 0 };
  (Object.values(p.equipment) as (string | null)[]).forEach((id) => {
    if (!id) return;
    const e = EQUIPMENT[id];
    if (!e) return;
    (Object.keys(e.stats) as (keyof typeof eq)[]).forEach((k) => { eq[k] += e.stats[k] ?? 0; });
  });
  const swId = p.equippedSword[p.activeChar] ?? 'sw_std';
  const sw = SWORDS[swId] ?? SWORDS.sw_std;
  const swLvl = p.swords[swId] ?? 0;
  return {
    maxHp: Math.round((def.stats.hp + 14 * (L - 1) + eq.hp) * (1 + 0.08 * pas('vit'))),
    maxSta: Math.round((def.stats.sta + 2 * (L - 1) + eq.sta) * (1 + 0.08 * pas('end'))),
    atk: (def.stats.atk + 2.3 * (L - 1) + eq.atk) * (1 + 0.06 * pas('might')) * sw.atk * swordMult(swLvl),
    def: (def.stats.def + 1.5 * (L - 1) + eq.def) * (1 + 0.08 * pas('res')),
    spd: def.stats.spd * (1 + 0.03 * pas('swift') + eq.spd),
    maxBreath: def.stats.breath + eq.breath,
    crit: (def.stats.crit + eq.crit) / 100 + (sw.crit ?? 0),
    critDmg: 1.5 + 0.12 * pas('crit'),
    breathMul: Math.max(0.6, 1 - 0.06 * pas('breath')),
    breathRegen: 4 + (sw.breath ?? 0) * 10 + 0.8 * pas('breath'),
    staRegen: 26 * (1 + 0.08 * pas('end')),
    bladeColor: sw.color || def.bladeColor, glow: sw.glow || def.bladeColor, burn: !!sw.burn, poison: !!sw.poison, steal: sw.steal ?? 0,
    maxUlt: 100,
  };
}

export function charLevelOk(p: Profile, id: string) { return p.chars[id]?.level ?? 1; }

/** Resolve the skill assigned to Special (E) and Ultimate (R) keys, taking story upgrades into account. */
export function resolveSpecial(def: CharDef, chapter: number): SkillDef {
  if (def.specialAlt && chapter >= def.specialAlt.chapter) return ALL_SKILLS[def.specialAlt.id];
  return ALL_SKILLS[def.special];
}
export function resolveUlt(def: CharDef, chapter: number): SkillDef {
  if (def.ult2 && chapter >= def.ult2.chapter) return ALL_SKILLS[def.ult2.id];
  return ALL_SKILLS[def.ult];
}

export function skillStatus(p: Profile, charId: string, s: SkillDef): 'unlocked' | 'available' | 'locked' | 'story' {
  const cp = p.chars[charId];
  if (!cp) return 'locked';
  if (s.reqChapter && p.chapter < s.reqChapter) return 'story';
  if (cp.unlocked.includes(s.id)) return 'unlocked';
  return cp.level >= s.level ? 'available' : 'locked';
}
export function specialUnlocked(p: Profile, charId: string, s: SkillDef) {
  const cp = p.chars[charId];
  if (s.reqChapter && p.chapter < s.reqChapter) return false;
  return s.ult ? cp.level >= 3 : cp.level >= 4;
}

/** The mastery of the character's form kit used for damage scaling: +2% per form unlocked. */
export function mastery(p: Profile, charId: string) { return 1 + 0.02 * (p.chars[charId]?.unlocked.length ?? 0); }
