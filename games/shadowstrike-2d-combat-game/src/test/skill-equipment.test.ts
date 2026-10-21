import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from '../stores/gameStore';
import { SKILL_BY_ID, SKILLS } from '../data/skills';
import { EQUIPMENT_BY_ID } from '../data/equipment';
import { loadSave } from '../save/save';

const state = () => useGame.getState();

beforeEach(() => {
  localStorage.clear();
  state().resetProfile();
});

describe('skill unlock and upgrade', () => {
  it('unlocks an affordable level-1 skill and grants level 1', () => {
    const before = state().profile.shards;
    expect(state().unlockSkill('fire_bolt')).toBe(true);
    const p = state().profile;
    expect(p.unlockedSkills).toContain('fire_bolt');
    expect(p.skillLevels.fire_bolt).toBe(1);
    expect(p.shards).toBe(before); // fire_bolt unlock cost is 0
  });

  it('refuses to unlock a skill the player is underleveled for', () => {
    // ice_shard: unlock level 2; player starts at level 1
    expect(state().unlockSkill('ice_shard')).toBe(false);
    expect(state().profile.unlockedSkills).not.toContain('ice_shard');
  });

  it('upgrades a skill through affordable levels and refuses when unaffordable', () => {
    expect(state().unlockSkill('fire_bolt')).toBe(true);
    // Lv1->2 costs 180, Lv2->3 costs 333 (800 shards -> 287)
    expect(state().upgradeSkill('fire_bolt')).toBe(true);
    expect(state().upgradeSkill('fire_bolt')).toBe(true);
    expect(state().profile.skillLevels.fire_bolt).toBe(3);
    expect(state().profile.shards).toBe(287);
    // Lv3->4 costs 616 > 287 shards
    expect(state().upgradeSkill('fire_bolt')).toBe(false);
    expect(state().profile.skillLevels.fire_bolt).toBe(3);
  });

  it('refuses to upgrade past signature level 5 when shards are plentiful', () => {
    expect(state().unlockSkill('fire_bolt')).toBe(true);
    useGame.setState({ profile: { ...state().profile, shards: 99999 } });
    for (let i = 0; i < 6; i++) state().upgradeSkill('fire_bolt');
    expect(state().profile.skillLevels.fire_bolt).toBe(5);
    expect(state().upgradeSkill('fire_bolt')).toBe(false);
  });

  it('refuses to upgrade without enough shards', () => {
    state().unlockSkill('fire_bolt'); // cost 0, shards 800
    // level1->2 costs 180, level2->3 costs 333, leaving 287; level4 costs 616
    expect(state().upgradeSkill('fire_bolt')).toBe(true);
    expect(state().upgradeSkill('fire_bolt')).toBe(true);
    expect(state().profile.shards).toBe(287);
    expect(state().upgradeSkill('fire_bolt')).toBe(false);
    expect(state().profile.skillLevels.fire_bolt).toBe(3);
  });

  it('equips and swaps skills in loadout slots', () => {
    state().unlockSkill('fire_bolt');
    state().equipSkill(0, 'fire_bolt');
    expect(state().profile.loadout.skills[0]).toBe('fire_bolt');
    state().equipSkill(1, 'fire_bolt');
    expect(state().profile.loadout.skills[1]).toBe('fire_bolt');
    expect(state().profile.loadout.skills[0]).not.toBe('fire_bolt');
  });

  it('refuses to equip a locked skill', () => {
    state().equipSkill(0, 'ice_shard');
    expect(state().profile.loadout.skills[0]).not.toBe('ice_shard');
  });
});

describe('equipment unlock and equip', () => {
  it('unlocks and equips an affordable item into a slot', () => {
    // gloves_wraps: common, level 1, cost 150
    expect(state().unlockEquipment('gloves_wraps')).toBe(true);
    state().equipItem('gloves', 'gloves_wraps');
    expect(state().profile.loadout.equipment.gloves).toBe('gloves_wraps');
  });

  it('refuses to equip an item that is not owned', () => {
    state().equipItem('head', 'head_horns');
    expect(state().profile.loadout.equipment.head).not.toBe('head_horns');
  });

  it('stores real equipment stat modifiers on the loadout', () => {
    state().unlockEquipment('gloves_wraps');
    state().equipItem('gloves', 'gloves_wraps');
    expect(state().profile.loadout.equipment.gloves).toBe('gloves_wraps');
    // data-level stat check
    expect(EQUIPMENT_BY_ID.outfit_ninja.mods?.moveSpeed).toBe(0.03);
  });
});

describe('skill and equipment persistence', () => {
  it('round-trips unlocks, upgrades and equipment through save/load', async () => {
    state().unlockSkill('fire_bolt');
    state().upgradeSkill('fire_bolt');
    state().upgradeSkill('fire_bolt');
    state().equipSkill(0, 'fire_bolt');
    state().unlockEquipment('gloves_wraps');
    state().equipItem('gloves', 'gloves_wraps');

    // persist() debounces 220ms; wait for the flush
    await new Promise((r) => setTimeout(r, 350));

    const reloaded = loadSave();
    expect(reloaded.profile.unlockedSkills).toContain('fire_bolt');
    expect(reloaded.profile.skillLevels.fire_bolt).toBe(3);
    expect(reloaded.profile.loadout.skills[0]).toBe('fire_bolt');
    expect(reloaded.profile.loadout.equipment.gloves).toBe('gloves_wraps');
  });
});

describe('catalogue integrity', () => {
  it('every skill has five levels and a resolvable executor kind', () => {
    for (const s of SKILLS) {
      expect(s.levels).toHaveLength(5);
      expect(SKILL_BY_ID[s.id]).toBe(s);
      expect(s.levels[4].perks.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('every equipment item belongs to a valid slot with bounded stats', () => {
    const items = Object.values(EQUIPMENT_BY_ID);
    expect(items.length).toBeGreaterThanOrEqual(40);
    const slots = new Set(['head', 'mask', 'outfit', 'armor', 'gloves', 'boots', 'back', 'aura', 'trail', 'emote']);
    for (const e of items) {
      expect(slots.has(e.slot), e.id).toBe(true);
      if (e.mods) {
        expect(Math.abs(e.mods.maxHealth ?? 0)).toBeLessThanOrEqual(15);
        expect(Math.abs(e.mods.moveSpeed ?? 0)).toBeLessThanOrEqual(0.1);
        expect(Math.abs(e.mods.cooldown ?? 0)).toBeLessThanOrEqual(0.1);
      }
    }
  });
});
