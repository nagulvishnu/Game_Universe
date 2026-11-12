import { describe, it, expect } from 'vitest';
import { addXp, xpForLevel, rankIndexFor, elementMultiplier, computeStats, calcDamage, calcIncoming, isAbilityUnlocked, isFormUnlocked, MAX_LEVEL } from '../logic/stats';
import { applyEvent, newProgress, stageComplete, missionAvailable, objectiveRequired } from '../logic/missionLogic';
import { ColliderWorld, resolveHorizontal, groundHeight } from '../logic/collision';
import { defaultProfile, sanitizeProfile, validateSave } from '../logic/profile';
import { CHARACTERS, CHAR_IDS } from '../data/characters';
import { ABILITIES, SKILLS } from '../data/abilities';
import { MISSIONS } from '../data/missions';
import { ENEMIES } from '../data/enemies';
import { ITEMS } from '../data/items';
import { NPCS, COLLECTIBLES, CAMPS, buildColliders, ROOF_RUN, LOW_HOUSES } from '../data/world';

describe('progression', () => {
  it('xp curve is strictly increasing', () => { for (let l = 1; l < MAX_LEVEL; l++) expect(xpForLevel(l + 1)).toBeGreaterThan(xpForLevel(l)); });
  it('addXp levels up multiple times and carries remainder', () => {
    const r = addXp(1, 0, xpForLevel(1) + xpForLevel(2) + 5);
    expect(r.level).toBe(3); expect(r.xp).toBe(5); expect(r.gained).toBe(2);
  });
  it('caps at max level', () => { expect(addXp(MAX_LEVEL, 0, 99999).level).toBe(MAX_LEVEL); });
  it('ranks depend on genin flag and level', () => {
    expect(rankIndexFor(30, false)).toBe(0); expect(rankIndexFor(1, true)).toBe(1); expect(rankIndexFor(10, true)).toBe(2); expect(rankIndexFor(18, true)).toBe(3);
  });
});

describe('combat maths', () => {
  it('element wheel: fire>wind>lightning>earth>water>fire', () => {
    expect(elementMultiplier('fire', 'wind')).toBeGreaterThan(1); expect(elementMultiplier('wind', 'lightning')).toBeGreaterThan(1);
    expect(elementMultiplier('lightning', 'earth')).toBeGreaterThan(1); expect(elementMultiplier('earth', 'water')).toBeGreaterThan(1);
    expect(elementMultiplier('water', 'fire')).toBeGreaterThan(1); expect(elementMultiplier('wind', 'fire')).toBeLessThan(1);
    expect(elementMultiplier('none', 'fire')).toBe(1);
  });
  it('damage falls with defense and rises with power', () => {
    expect(calcDamage({ atk: 20, power: 1, defense: 0 })).toBeGreaterThan(calcDamage({ atk: 20, power: 1, defense: 20 }));
    expect(calcDamage({ atk: 20, power: 3, defense: 5 })).toBeGreaterThan(calcDamage({ atk: 20, power: 1, defense: 5 }));
    expect(calcDamage({ atk: 20, power: 1, defense: 5, crit: true })).toBeGreaterThan(calcDamage({ atk: 20, power: 1, defense: 5 }));
    expect(calcDamage({ atk: 0.1, power: 0.1, defense: 99 })).toBeGreaterThanOrEqual(1);
  });
  it('guarding reduces incoming damage', () => { expect(calcIncoming(100, 5, 0.25)).toBeLessThan(calcIncoming(100, 5, 1)); expect(calcIncoming(100, 5, 0)).toBe(1); });
  it('stats scale with level, skills and equipment', () => {
    const ch = CHARACTERS.naruto; const eq = { weapon: null, armor: null, accessory: null };
    const a = computeStats(ch, 1, [], eq); const b = computeStats(ch, 10, [], eq);
    expect(b.maxHp).toBeGreaterThan(a.maxHp); expect(b.atk).toBeGreaterThan(a.atk);
    expect(computeStats(ch, 1, ['chk1'], eq).maxChakra).toBe(a.maxChakra + 30);
    expect(computeStats(ch, 1, [], { weapon: 'chakraBlade', armor: null, accessory: null }).atk).toBeGreaterThan(a.atk);
    expect(computeStats(ch, 1, [], { weapon: 'chakraBlade', armor: null, accessory: null }, { chakraBlade: 3 }).atk).toBeGreaterThan(computeStats(ch, 1, [], { weapon: 'chakraBlade', armor: null, accessory: null }).atk);
  });
  it('ability and form unlock rules', () => {
    expect(isAbilityUnlocked('clone', 1, {})).toBe(true); expect(isAbilityUnlocked('rasengan', 1, {})).toBe(false); expect(isAbilityUnlocked('rasengan', 2, {})).toBe(true);
    expect(isAbilityUnlocked('rasenshuriken', 20, {})).toBe(false); expect(isAbilityUnlocked('rasenshuriken', 8, { secretWind: true })).toBe(true);
    expect(isFormUnlocked('sage', 'naruto', 6, ['trf1'], {})).toBe(false); expect(isFormUnlocked('sage', 'naruto', 6, ['trf1'], { sageTraining: true })).toBe(true);
    expect(isFormUnlocked('sage', 'sasuke', 20, ['trf1'], { sageTraining: true })).toBe(false); expect(isFormUnlocked('kurama', 'naruto', 10, ['trf1', 'trf3'], {})).toBe(true);
  });
});

describe('mission logic', () => {
  const ch1 = MISSIONS.find((m) => m.id === 'ch1_academy')!; const ch3 = MISSIONS.find((m) => m.id === 'ch3_waves')!;
  it('kill objectives match by tag and def', () => {
    const st = ch1.stages[0]; let p = newProgress(st);
    p = applyEvent(st, p, { t: 'kill', def: 'rogue', tag: 'ch1' }); p = applyEvent(st, p, { t: 'kill', def: 'dummy', tag: 'other' }); expect(p[0]).toBe(0);
    for (let i = 0; i < 3; i++) p = applyEvent(st, p, { t: 'kill', def: 'dummy', tag: 'ch1' });
    expect(stageComplete(st, p)).toBe(true);
  });
  it('reach objective respects minimum height', () => {
    const st = ch1.stages[2]; let p = newProgress(st);
    p = applyEvent(st, p, { t: 'pos', x: -40, y: 0, z: -20 }); expect(stageComplete(st, p)).toBe(false);
    p = applyEvent(st, p, { t: 'pos', x: -40, y: 7, z: -20 }); expect(stageComplete(st, p)).toBe(true);
  });
  it('checkpoints must be touched in order', () => {
    const st = { objectives: [{ type: 'checkpoints' as const, points: [[0, 0], [10, 0], [20, 0]] as [number, number][], radius: 2, label: 'x' }] };
    let p = newProgress(st); p = applyEvent(st, p, { t: 'pos', x: 20, y: 0, z: 0 }); expect(p[0]).toBe(0);
    p = applyEvent(st, p, { t: 'pos', x: 0, y: 0, z: 0 }); p = applyEvent(st, p, { t: 'pos', x: 10, y: 0, z: 0 }); p = applyEvent(st, p, { t: 'pos', x: 20, y: 0, z: 0 }); expect(stageComplete(st, p)).toBe(true);
  });
  it('survive/charge only advance on tick (charge needs charging)', () => {
    const st = { objectives: [{ type: 'charge' as const, seconds: 2, label: 'c' }, { type: 'survive' as const, seconds: 3, label: 's' }] };
    let p = newProgress(st); p = applyEvent(st, p, { t: 'tick', dt: 1, charging: false }); expect(p).toEqual([0, 1]);
    p = applyEvent(st, p, { t: 'tick', dt: 5, charging: true }); expect(stageComplete(st, p)).toBe(true); expect(p[0]).toBe(objectiveRequired(st.objectives[0]));
  });
  it('boss and talk objectives', () => {
    const boss = ch3.stages[4]; let p = newProgress(boss); p = applyEvent(boss, p, { t: 'boss', id: 'gaara' }); expect(stageComplete(boss, p)).toBe(false);
    p = applyEvent(boss, p, { t: 'boss', id: 'zabuza' }); expect(stageComplete(boss, p)).toBe(true);
    const talk = ch1.stages[3]; expect(stageComplete(talk, applyEvent(talk, newProgress(talk), { t: 'talk', npc: 'iruka' }))).toBe(true);
  });
  it('availability gates by rank, level, prerequisites and planned status', () => {
    expect(missionAvailable(ch3, 1, 10, []).ok).toBe(false); expect(missionAvailable(ch3, 1, 2, ['ch2_team7']).ok).toBe(false); expect(missionAvailable(ch3, 1, 5, ['ch2_team7']).ok).toBe(true);
    expect(missionAvailable(MISSIONS.find((m) => m.status === 'planned')!, 4, 30, []).ok).toBe(false);
  });
});

describe('collision', () => {
  it('boxes block walking but can be stood on', () => {
    const w = new ColliderWorld(); w.box(0, 0, 4, 4, 3); const out = { x: 0, z: 0, hit: false };
    resolveHorizontal(w, 2.2, 0, 0.45, 0, out); expect(out.hit).toBe(true); expect(out.x).toBeGreaterThanOrEqual(2.4);
    resolveHorizontal(w, 2.2, 0, 0.45, 3, out); expect(out.hit).toBe(false);
    expect(groundHeight(w, 0, 0, 3)).toBe(3); expect(groundHeight(w, 0, 0, 0)).toBe(0); expect(groundHeight(w, 10, 0, 5)).toBe(0);
  });
  it('low ledges can be stepped onto', () => { const w = new ColliderWorld(); w.box(0, 0, 4, 4, 0.4); const out = { x: 0, z: 0, hit: false }; resolveHorizontal(w, 2.1, 0, 0.45, 0, out); expect(out.hit).toBe(false); });
  it('cylinders push entities out', () => { const w = new ColliderWorld(); w.circle(0, 0, 2, 10); const out = { x: 0, z: 0, hit: false }; resolveHorizontal(w, 1, 0, 0.5, 0, out); expect(Math.hypot(out.x, out.z)).toBeGreaterThanOrEqual(2.49); });
  it('world colliders build and roofs are reachable-height', () => { const w = buildColliders(); expect(w.all.length).toBeGreaterThan(100); });
});

describe('save validation', () => {
  it('round-trips a default profile', () => {
    const p = defaultProfile(); const s = validateSave(JSON.parse(JSON.stringify({ version: 1, savedAt: 5, slot: 'slot1', label: 'x', profile: p })));
    expect(s).not.toBeNull(); expect(s!.profile.charId).toBe('naruto'); expect(s!.profile.chars.naruto.equipped).toEqual(p.chars.naruto.equipped);
  });
  it('rejects garbage safely', () => {
    expect(validateSave(null)).toBeNull(); expect(validateSave('hi')).toBeNull(); expect(validateSave({ version: 99, profile: {} })).toBeNull(); expect(validateSave({ version: 1, profile: 7 })).toBeNull();
    expect(sanitizeProfile([])).toBeNull();
  });
  it('clamps and filters invalid fields', () => {
    const p = sanitizeProfile({ charId: 'sasuke', unlocked: ['sasuke', 'bogus'], ryo: -50, inventory: { ramen: 3, fake: 9, kunai: -4 }, completed: ['ch1_academy', 'nope'],
      chars: { naruto: { level: 999, xp: -5, skills: ['tai1', 'zzz'], equipped: ['x'] } }, pos: { x: 99999, z: NaN }, activeMission: { id: 'ch3_waves', stage: 99, progress: ['a'] }, flags: { genin: true, bad: 1 } })!;
    expect(p.unlocked).toEqual(['naruto', 'sasuke']); expect(p.ryo).toBe(0); expect(p.inventory).toEqual({ ramen: 3 }); expect(p.completed).toEqual(['ch1_academy']);
    expect(p.chars.naruto.level).toBe(MAX_LEVEL); expect(p.chars.naruto.xp).toBe(0); expect(p.chars.naruto.skills).toEqual(['tai1']); expect(p.chars.naruto.equipped.length).toBe(4);
    expect(p.pos.x).toBe(340); expect(Number.isFinite(p.pos.z)).toBe(true); expect(p.activeMission!.stage).toBe(ch3Stages() - 1); expect(p.flags).toEqual({ genin: true });
  });
  it('never leaves the player without Naruto', () => { expect(sanitizeProfile({ unlocked: [] })!.unlocked).toContain('naruto'); });
});
const ch3Stages = () => MISSIONS.find((m) => m.id === 'ch3_waves')!.stages.length;

describe('data integrity', () => {
  it('all characters reference real abilities and have 4 default slots', () => {
    for (const id of CHAR_IDS) { const c = CHARACTERS[id]; expect(c.abilities.length).toBeGreaterThanOrEqual(4); [...c.abilities, c.special, ...Object.values(c.ultimates)].forEach((a) => expect(ABILITIES[a!], `${id}:${a}`).toBeDefined()); }
  });
  it('characters have distinct combat identities', () => { const styles = new Set(CHAR_IDS.map((i) => `${CHARACTERS[i].combo.style}${CHARACTERS[i].combo.hits}${CHARACTERS[i].stats.speed}`)); expect(styles.size).toBe(CHAR_IDS.length); });
  it('skill requirements exist', () => { for (const n of Object.values(SKILLS)) if (n.requires) expect(SKILLS[n.requires]).toBeDefined(); });
  it('missions reference valid items, enemies, npcs and collectibles', () => {
    expect(MISSIONS.filter((m) => m.kind === 'story').map((m) => m.chapter)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    for (const m of MISSIONS) {
      m.rewards.items?.forEach(([i]) => expect(ITEMS[i], i).toBeDefined());
      if (m.status !== 'playable') { expect(m.stages.length).toBe(0); continue; }
      expect(m.stages.length).toBeGreaterThan(0);
      if (m.giver !== 'board') expect(NPCS.some((n) => n.id === m.giver), m.giver).toBe(true);
      for (const st of m.stages) {
        st.spawn?.forEach((s) => expect(ENEMIES[s.def], s.def).toBeDefined()); st.waves?.forEach((w) => w.spawn.forEach((s) => expect(ENEMIES[s.def]).toBeDefined()));
        if (st.boss) expect(ENEMIES[st.boss.id].tier).toBe('boss');
        for (const o of st.objectives) {
          if (o.type === 'talk') expect(NPCS.some((n) => n.id === o.npc) || o.npc === 'tazuna').toBe(true);
          if (o.type === 'collect') expect(COLLECTIBLES.some((c) => c.mission === m.id && (c.tag ?? c.kind) === o.kind)).toBe(true);
          if (o.type === 'ability') expect(ABILITIES[o.ability]).toBeDefined();
          if (o.type === 'collect') expect(COLLECTIBLES.filter((c) => c.mission === m.id && (c.tag ?? c.kind) === o.kind).length).toBeGreaterThanOrEqual(o.count);
        }
      }
    }
  });
  it('enemies, bosses, camps and drops are consistent', () => {
    for (const e of Object.values(ENEMIES)) { e.drops?.forEach((d) => expect(ITEMS[d.item], d.item).toBeDefined()); if (e.tier !== 'dummy') expect(e.patterns.length).toBeGreaterThan(0); e.patterns.forEach((p) => expect(p.windup).toBeGreaterThan(0.2)); }
    for (const b of Object.values(ENEMIES).filter((e) => e.tier === 'boss')) { expect(b.patterns.length).toBeGreaterThanOrEqual(5); expect(b.phases?.length).toBeGreaterThan(0); expect(b.arena).toBeDefined(); }
    CAMPS.forEach((c) => c.spawns.forEach((s) => expect(ENEMIES[s.def]).toBeDefined()));
  });
  it('rooftop run has 5 reachable checkpoints and rooftop chests exist', () => { expect(ROOF_RUN.length).toBe(5); expect(LOW_HOUSES.length).toBeGreaterThan(15); ROOF_RUN.forEach((c) => expect(c[2]).toBeLessThan(4.5)); });
  it('npc and collectible ids are unique', () => { expect(new Set(NPCS.map((n) => n.id)).size).toBe(NPCS.length); expect(new Set(COLLECTIBLES.map((n) => n.id)).size).toBe(COLLECTIBLES.length); });
});
