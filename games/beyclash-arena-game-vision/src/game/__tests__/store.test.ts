// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RIVAL_MAP } from '../../data/rivals';
import { rivalFighter } from '../../ui/Dialogue';
import { SAVE_KEY } from '../persistence/save';
import { useGame } from '../store';
import { nextPlayerMatch } from '../tournaments/bracket';
import { getCompetitor } from '../tournaments/competitors';
import type { BattleResult } from '../types';

const win = (finish: BattleResult['finish']): BattleResult => ({ winner: 0, loser: 1, finish, time: 21, stamina: [55, 0] });
const settle = () => vi.advanceTimersByTime(2500);

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  useGame.getState().init();
});

describe('store integration', () => {
  it('new game starts at 5000 points in the city', () => {
    useGame.getState().startNew('Tester', 1);
    settle();
    const s = useGame.getState();
    expect(s.scene).toBe('city');
    expect(s.save.points).toBe(5000);
    expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).profile.name).toBe('Tester');
  });

  it('rival battle awards encounter points exactly once and persists', () => {
    useGame.getState().startNew('Tester', 0); settle();
    useGame.getState().startBattle({ mode: 'rival', rivalId: 'riku', opponent: rivalFighter(RIVAL_MAP.riku), stadium: 'park' }); settle();
    expect(useGame.getState().scene).toBe('battle');
    useGame.getState().finishBattle(win('BURST'));
    useGame.getState().finishBattle(win('BURST')); // duplicate must be ignored
    const s = useGame.getState().save;
    expect(s.rivals.riku.points).toBe(3);
    expect(s.stats.battles).toBe(1);
    expect(s.points).toBe(5000 + 250 + Math.round(RIVAL_MAP.riku.reward * 1.3));
    expect(useGame.getState().overlay).toBe('result');
    expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).rivals.riku.points).toBe(3);
    // "refresh": reload from storage
    useGame.getState().init();
    expect(useGame.getState().save.rivals.riku.points).toBe(3);
  });

  it('quick battle and training never touch official progression', () => {
    useGame.getState().startNew('Tester', 0); settle();
    for (const mode of ['quick', 'training'] as const) {
      useGame.getState().startBattle({ mode, opponent: rivalFighter(RIVAL_MAP.riku), stadium: 'park', tutorial: mode === 'training' }); settle();
      useGame.getState().finishBattle(win('RING_OUT'));
    }
    const s = useGame.getState().save;
    expect(s.rivals.riku.points).toBe(0);
    expect(s.points).toBe(5000);
    expect(s.xp).toBe(0);
    expect(s.training.ringOut).toBe(true);
  });

  it('full tournament run through the store requires winning every match', () => {
    useGame.getState().startNew('Tester', 0); settle();
    const g = useGame.getState();
    const rivals = { ...g.save.rivals, riku: { ...g.save.rivals.riku, defeated: true, points: 5 }, mina: { ...g.save.rivals.mina, defeated: true, points: 5 } };
    useGame.setState({ save: { ...g.save, level: 3, rivals } });
    expect(useGame.getState().registerTournament('local')).toBe(true);
    expect(useGame.getState().save.points).toBe(5000 - 300);
    expect(useGame.getState().registerTournament('local')).toBe(false); // already active
    for (let i = 0; i < 2; i++) {
      const act = useGame.getState().save.tournaments.local.active!;
      const nm = nextPlayerMatch(act)!;
      expect(nm).not.toBeNull();
      const opp = getCompetitor(act.entrants[nm.opponent]);
      useGame.getState().startBattle({ mode: 'tournament', tournamentId: 'local', opponent: { id: opp.id, name: opp.name, title: opp.title, look: opp.look, bey: opp.bey, strategy: opp.strategy, difficulty: opp.difficulty }, stadium: 'park', round: 'x' }); settle();
      useGame.getState().finishBattle(win('SPIN'));
      useGame.getState().leaveBattle(); settle();
    }
    const rec = useGame.getState().save.tournaments.local;
    expect(rec.active!.status).toBe('won');
    expect(rec.wins).toBe(1);
    expect(useGame.getState().save.points).toBeGreaterThan(5000 - 300 + 2000);
  });

  it('buying parts spends points once and respects level locks', () => {
    useGame.getState().startNew('Tester', 0); settle();
    expect(useGame.getState().buyPart('twin-fury')).toBe(false); // level locked
    expect(useGame.getState().buyPart('light-disc')).toBe(false); // lvl 2
    useGame.setState({ save: { ...useGame.getState().save, level: 3 } });
    expect(useGame.getState().buyPart('light-disc')).toBe(true);
    expect(useGame.getState().buyPart('light-disc')).toBe(false); // already owned
    expect(useGame.getState().save.points).toBe(5000 - 600);
    useGame.getState().applyConfig({ ...useGame.getState().save.config, disc: 'light-disc' });
    expect(useGame.getState().save.config.disc).toBe('light-disc');
    useGame.getState().applyConfig({ ...useGame.getState().save.config, layer: 'twin-fury' });
    expect(useGame.getState().save.config.layer).toBe('ember-fang'); // not owned: rejected
  });
});
