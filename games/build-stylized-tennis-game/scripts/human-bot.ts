import { Sim } from '../src/game/sim';
import { updateAI } from '../src/game/ai';
import { RULE_PRESETS, defaultLook, type MatchConfig, type PlayerSpec } from '../src/game/constants';
const spec = (n: string, level: number, human = -1): PlayerSpec => ({ name: n, human, level, personality: 'balanced', look: defaultLook(1) });
function run(label: string, teams: [PlayerSpec[], PlayerSpec[]], doubles: boolean) {
  const cfg: MatchConfig = { mode: 'coop', doubles, courtId: 'neon', rules: RULE_PRESETS[0].rules, label: 't', multiplier: 1, teams };
  const sim = new Sim(cfg);
  let t = 0; let perfects = 0;
  while (sim.phase !== 'over' && t < 700) {
    for (const p of sim.humans()) updateAI(sim, p, 1 / 60); // bot "plays" the human slots
    sim.update(1 / 60); t += 1 / 60;
    for (const p of sim.humans()) if (p.timing.active && p.timing.grade === 3) perfects++;
    sim.events.length = 0;
  }
  console.log(label, 'over', sim.phase === 'over', 'winner', sim.playerWinner, 'sets', JSON.stringify(sim.score.sets), 'rallyMax', sim.maxRally, 'ringPerfectFrames', perfects, 'pts', sim.stats.map(s=>s.points).join('/'));
}
run('solo L1 bot vs L6', [[spec('h', 3, 0)], [spec('c', 6)]], false);
run('coop 2 bots vs L5x2', [[spec('h1', 4, 0), spec('h2', 4, 1)], [spec('c', 5), spec('d', 5)]], true);
run('coop 2 bots vs L6x2', [[spec('h1', 5, 0), spec('h2', 5, 1)], [spec('c', 6), spec('d', 6)]], true);
