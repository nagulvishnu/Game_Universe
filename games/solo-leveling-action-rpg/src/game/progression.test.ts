import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { derive, questDef, shadowStats, useGame } from './store';
import { SAVE_VERSION, defaultSettings, freshSave } from './save';
import { ENEMIES, SHADOWS, xpNeeded } from './data';

function resetStore() {
  useGame.setState({
    screen: 'menu',
    panel: 'none',
    session: 0,
    save: freshSave(),
    settings: defaultSettings(),
    scores: [],
    notifs: [],
    dialog: null,
    cine: null,
    arise: null,
    banner: null,
    hasSave: false,
    runScore: 0,
    deathInfo: null,
    lastSaved: 0,
    shopTab: 'buy',
    listVer: 0,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  resetStore();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe('derived stats', () => {
  it('computes starter combat stats from equipment and attributes', () => {
    const derived = derive(freshSave());
    expect(derived.atk).toBeCloseTo(23);
    expect(derived.def).toBeCloseTo(11);
    expect(derived.maxHp).toBe(154);
    expect(derived.maxMp).toBe(90);
    expect(derived.weapon?.id).toBe('rusty_dagger');
  });

  it('changes attack and weapon when a new weapon is equipped', () => {
    useGame.getState().addItem('hunter_sword', 1);
    useGame.getState().equip('hunter_sword');
    const derived = derive(useGame.getState().save);
    expect(derived.atk).toBeCloseTo(34);
    expect(derived.weapon?.wtype).toBe('sword');
  });

  it('applies shadow level and rank scaling', () => {
    const base = shadowStats({
      id: 's1',
      key: 'igris',
      name: 'Igris',
      rank: 4,
      level: 1,
      xp: 0,
      favorite: false,
      squad: 0,
      evo: 0,
      state: 'stored',
      kills: 0,
    });
    const upgraded = shadowStats({
      id: 's1',
      key: 'igris',
      name: 'Igris',
      rank: 5,
      level: 6,
      xp: 0,
      favorite: false,
      squad: 0,
      evo: 1,
      state: 'stored',
      kills: 0,
    });
    expect(base.hp).toBe(SHADOWS.igris.hp);
    expect(upgraded.hp).toBeGreaterThan(base.hp);
    expect(upgraded.atk).toBeGreaterThan(base.atk);
  });
});

describe('daily quest scaling', () => {
  it('scales objective requirements and rewards with daily completions', () => {
    const first = questDef('q_daily', { dailyCount: 0 });
    const fifth = questDef('q_daily', { dailyCount: 4 });
    expect(first).toBeDefined();
    expect(fifth).toBeDefined();
    expect(fifth!.objs[0].need).toBeGreaterThan(first!.objs[0].need);
    expect(fifth!.reward.xp).toBeGreaterThan(first!.reward.xp);
    expect(fifth!.reward.gold).toBeGreaterThan(first!.reward.gold);
  });
});

describe('store actions', () => {
  it('levels up and awards stat points', () => {
    useGame.getState().addXp(xpNeeded(1));
    const save = useGame.getState().save;
    expect(save.level).toBe(2);
    expect(save.xp).toBe(0);
    expect(save.points).toBe(5);
  });

  it('allocates a stat point only when one is available', () => {
    useGame.getState().allocate('str');
    expect(useGame.getState().save.stats.str).toBe(10);
    useGame.getState().addXp(xpNeeded(1));
    useGame.getState().allocate('str');
    expect(useGame.getState().save.stats.str).toBe(11);
    expect(useGame.getState().save.points).toBe(4);
  });

  it('buys, sells, adds and removes items', () => {
    const store = useGame.getState();
    store.buy('hp_potion');
    expect(useGame.getState().save.inv.hp_potion).toBe(3);
    expect(useGame.getState().save.gold).toBe(80);
    useGame.getState().sell('hp_potion');
    expect(useGame.getState().save.inv.hp_potion).toBe(2);
    expect(useGame.getState().save.gold).toBe(96);
    useGame.getState().addItem('mp_potion', 2);
    expect(useGame.getState().save.inv.mp_potion).toBe(2);
    expect(useGame.getState().removeItem('mp_potion', 2)).toBe(true);
    expect(useGame.getState().save.inv.mp_potion).toBeUndefined();
    expect(useGame.getState().removeItem('mp_potion', 1)).toBe(false);
  });

  it('refuses to equip an item the player does not own', () => {
    useGame.getState().equip('hunter_sword');
    expect(useGame.getState().save.equip.weapon).toBe('rusty_dagger');
  });

  it('completes a kill quest and grants its rewards', () => {
    useGame.getState().startQuest('q_gate');
    useGame.getState().questEvent('kill', 'goblin', 2);
    const save = useGame.getState().save;
    expect(save.quests.q_gate.state).toBe('done');
    expect(save.gold).toBe(220);
    expect(save.kills).toBe(2);
    expect(save.xp).toBe(20);
  });

  it('persists through the localStorage fallback when IndexedDB is unavailable', async () => {
    await useGame.getState().persist('manual');
    expect(localStorage.getItem('sl-save-manual')).toBeTruthy();
    expect(localStorage.getItem('sl-save-latest')).toBe('"manual"');
  });

  it('recovers a corrupted loaded save', () => {
    useGame.getState().load({
      ...freshSave(),
      v: 1,
      level: 999,
      gold: -5,
      inv: { invalid_item: 3 },
      equip: { weapon: 'invalid_item' },
    } as never);
    const save = useGame.getState().save;
    expect(useGame.getState().screen).toBe('playing');
    expect(save.level).toBe(60);
    expect(save.gold).toBe(0);
    expect(save.inv.invalid_item).toBeUndefined();
    expect(save.equip.weapon).toBeUndefined();
    expect(save.v).toBe(SAVE_VERSION);
  });

  it('keeps the enemy and shadow reference tables aligned', () => {
    for (const key of Object.keys(SHADOWS)) expect(ENEMIES[key]).toBeDefined();
  });
});
