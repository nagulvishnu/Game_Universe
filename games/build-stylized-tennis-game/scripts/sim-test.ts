import { Sim } from '../src/game/sim';
import { RULE_PRESETS, defaultLook, type MatchConfig, type PlayerSpec } from '../src/game/constants';

const spec = (n: string, level: number, pers: any = 'balanced', human = -1): PlayerSpec => ({ name: n, human, level, personality: pers, look: defaultLook(1) });
function run(l0: number, l1: number, doubles: boolean, rules = RULE_PRESETS[0].rules, maxT = 900) {
  const cfg: MatchConfig = { mode: 'demo', doubles, courtId: 'neon', rules, label: 't', multiplier: 1,
    teams: [doubles ? [spec('a', l0, 'aggressive'), spec('b', l0, 'tactical')] : [spec('a', l0, 'aggressive')], doubles ? [spec('c', l1, 'defensive'), spec('d', l1, 'balanced')] : [spec('c', l1, 'tactical')]] };
  const sim = new Sim(cfg);
  const reasons: Record<string, number> = {};
  let t = 0;
  while (sim.phase !== 'over' && t < maxT) { sim.update(1 / 60); t += 1 / 60; for (const e of sim.events) { if (e.type === 'point') reasons[e.reason!] = (reasons[e.reason!] || 0) + 1; if(e.type==='fault') reasons['F:'+e.reason]=(reasons['F:'+e.reason]||0)+1; } sim.events.length = 0; }
  const avg = sim.rallies.reduce((a, b) => a + b, 0) / Math.max(1, sim.rallies.length);
  console.log(`L${l0} vs L${l1} ${doubles ? 'doubles' : 'singles'}: over=${sim.phase === 'over'} t=${t.toFixed(0)}s winner=${sim.playerWinner} pts=${sim.rallies.length} avgRally=${avg.toFixed(1)} max=${sim.maxRally} games=${JSON.stringify(sim.score.sets)} `, JSON.stringify(reasons), 'perf', sim.stats.map(s => s.perfects).join('/'));
}
for (const [a, b] of [[1, 1], [3, 3], [4, 4], [6, 6], [6, 1], [1, 6]]) run(a, b, false);
run(4, 4, true); run(6, 6, true);
