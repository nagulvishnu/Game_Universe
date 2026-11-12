import { Sim } from '../src/game/sim';
import { RULE_PRESETS, defaultLook, type MatchConfig, type PlayerSpec } from '../src/game/constants';
const spec = (n: string, level: number, pers: any = 'balanced', human = -1): PlayerSpec => ({ name: n, human, level, personality: pers, look: defaultLook(1) });
const lv = +process.argv[2] || 4;
const cfg: MatchConfig = { mode: 'demo', doubles: false, courtId: 'neon', rules: RULE_PRESETS[0].rules, label: 't', multiplier: 1, teams: [[spec('a', lv, 'balanced')], [spec('c', lv, 'balanced')]] };
const sim = new Sim(cfg);
let last: any = null; let n=0; const grades=[0,0,0,0];
for (let i = 0; i < 60 * 600 && n<14; i++) {
  sim.update(1 / 60);
  for (const e of sim.events) {
    if (e.type === 'hit') { last = e; grades[e.grade!]++; }
    if (e.type === 'bounce' && !e.inBounds) console.log('v',last?.vx?.toFixed(1),last?.vy?.toFixed(1),last?.vz?.toFixed(1),'OOB bounce', e.x!.toFixed(2), e.z!.toFixed(2), 'last hit', last?.label, 'grade', last?.grade, 'p', last?.p?.name, 'from', last?.x?.toFixed(1), last?.z?.toFixed(1), 'hy', last?.y?.toFixed(2),'spd',last?.speed?.toFixed(1));
    if (e.type === 'point') { n++; console.log('POINT', e.team, e.reason, 'rally', sim.rallyHits); }
  }
  sim.events.length = 0;
}
console.log('grades', grades.join(','));
