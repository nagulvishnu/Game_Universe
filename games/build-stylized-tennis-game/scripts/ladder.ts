import { Sim } from '../src/game/sim';
import { RULE_PRESETS, defaultLook, type MatchConfig, type PlayerSpec } from '../src/game/constants';
const spec = (n: string, level: number): PlayerSpec => ({ name: n, human: -1, level, personality: 'balanced', look: defaultLook(1) });
function m(a: number, b: number) {
  const cfg: MatchConfig = { mode: 'demo', doubles: false, courtId: 'neon', rules: RULE_PRESETS[0].rules, label: 't', multiplier: 1, teams: [[spec('a', a)], [spec('b', b)]] };
  const sim = new Sim(cfg); let t = 0;
  while (sim.phase !== 'over' && t < 500) { sim.update(1 / 30); t += 1 / 30; sim.events.length = 0; }
  return sim.phase === 'over' ? sim.playerWinner : -1;
}
for (const [a, b] of [[2,1],[3,2],[4,3],[5,4],[6,5],[6,3]]) {
  let w = 0, n = 0, un = 0;
  for (let i = 0; i < 8; i++) { const r = m(a, b); if (r === 0) w++; else if (r < 0) un++; n++; }
  console.log(`L${a} beats L${b}: ${w}/${n} (unfinished ${un})`);
}
