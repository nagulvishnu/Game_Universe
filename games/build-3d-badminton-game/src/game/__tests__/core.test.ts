import { describe, expect, it } from 'vitest';
import { flight, stepBall, NET_H } from '../physics';
import { SHOTS, planShot, gradeOf, ShotId } from '../shots';
import { makeRules, awardPoint, serveInfo, judgeLanding, nextGame } from '../rules';
import { RuleCfg } from '../constants';

const cfg = (o: Partial<RuleCfg> = {}): RuleCfg => ({ pointsToWin: 21, cap: 30, gamesToWin: 2, doubles: false, arcade: false, ...o });
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

describe('shuttle physics', () => {
  it('decelerates strongly in flight', () => {
    const b = { x: 0, y: 2.5, z: 4, vx: 0, vy: 5, vz: -40 };
    const s0 = Math.hypot(b.vx, b.vy, b.vz);
    for (let i = 0; i < 36; i++) stepBall(b, 1 / 120, 1);
    expect(Math.hypot(b.vx, b.vy, b.vz)).toBeLessThan(s0 * 0.6);
  });
  it('lands eventually', () => {
    const f = flight({ x: 0, y: 2, z: 5, vx: 0, vy: 10, vz: -15 }, 1);
    expect(f.landT).toBeGreaterThan(0.5);
    expect(f.landT).toBeLessThan(6);
  });
});

describe('shot planning', () => {
  const shots: [ShotId, number, number][] = [
    ['highClear', 1, 2.3], ['attackClear', 1, 2.3], ['drop', 2, 2.3], ['netShot', 2, 0.9], ['drive', 3, 1.3],
    ['flatPush', 4, 0.6], ['smash', 5, 2.4], ['jumpSmash', 3, 3.3], ['lift', 1, 0.5], ['cross', 3, 2.3], ['backhand', 1, 1.6],
  ];
  it('every shot type clears the net and lands in court when graded good/perfect', () => {
    for (const [id, key, y] of shots) {
      for (const z of id === 'netShot' ? [1.2, 2, 3.2] : [1.2, 3, 5, 7]) {
        for (const x of [-2.5, 0, 2.5]) {
          for (const aimX of [-2.2, 0, 2.2]) {
            const p = planShot({ shot: id, grade: 'good', special: null, key, aimX, side: 1, start: { x, y, z }, hw: 3.05, serveXSign: 1, serveLong: 5.94, rnd });
            const l = p.launch;
            // net: check by simulating the actual velocity
            const f = flight({ x, y, z, vx: p.vx, vy: p.vy, vz: p.vz }, p.drag);
            expect(f.crossed, `${id} crosses`).toBe(true);
            expect(f.netY - NET_H, `${id} net clearance from z=${z}`).toBeGreaterThan(-0.001);
            expect(Math.abs(f.landX), `${id} x`).toBeLessThan(3.1);
            expect(Math.abs(f.landZ), `${id} z`).toBeLessThan(6.75);
            expect(f.landZ).toBeLessThan(0);
            expect(l.flightT).toBeGreaterThan(0.2);
          }
        }
      }
    }
  });
  it('shot types have distinct flight time / speed', () => {
    const base = (id: ShotId, y: number) => planShot({ shot: id, grade: 'normal', special: null, key: 1, aimX: 0, side: 1, start: { x: 0, y, z: 4 }, hw: 3.05, serveXSign: 1, serveLong: 5.94, rnd });
    const clear = base('highClear', 2.3).launch;
    const smash = base('jumpSmash', 3.3).launch;
    const drop = base('drop', 2.3).launch;
    expect(clear.flightT).toBeGreaterThan(smash.flightT * 3);
    expect(smash.speed).toBeGreaterThan(drop.speed);
    expect(clear.apex).toBeGreaterThan(drop.apex);
    expect(SHOTS.smash.label).toBe('Smash');
  });
  it('smash flight time stays returnable (>0.22s) and perfect > normal speed', () => {
    const n = planShot({ shot: 'jumpSmash', grade: 'normal', special: null, key: 3, aimX: 2, side: 1, start: { x: 0, y: 3.3, z: 3 }, hw: 3.05, serveXSign: 1, serveLong: 5.94, rnd });
    const p = planShot({ shot: 'jumpSmash', grade: 'perfect', special: 'perfectSmash', key: 3, aimX: 2, side: 1, start: { x: 0, y: 3.3, z: 3 }, hw: 3.05, serveXSign: 1, serveLong: 5.94, rnd });
    expect(n.launch.flightT).toBeGreaterThan(0.22);
    expect(p.launch.flightT).toBeGreaterThan(0.2);
    expect(p.launch.speed).toBeGreaterThan(n.launch.speed);
  });
  it('grades', () => {
    expect(gradeOf(0.9)).toBe('perfect');
    expect(gradeOf(0.7)).toBe('good');
    expect(gradeOf(0.5)).toBe('normal');
    expect(gradeOf(0.1)).toBe('poor');
  });
  it('serves land in the diagonal service court', () => {
    for (const key of [1, 2, 3, 4]) {
      const p = planShot({ shot: 'serve', grade: 'normal', special: null, key, aimX: null, side: 1, start: { x: 1.5, y: 1.0, z: 2.7 }, hw: 2.59, serveXSign: -1, serveLong: 6.7, rnd });
      const f = flight({ x: 1.5, y: 1.0, z: 2.7, vx: p.vx, vy: p.vy, vz: p.vz }, p.drag);
      expect(f.netY - NET_H).toBeGreaterThan(0);
      expect(f.landX).toBeLessThan(0.1);
      expect(Math.abs(f.landZ)).toBeGreaterThan(1.9);
    }
  });
});

describe('rules', () => {
  it('singles service court alternates with score parity', () => {
    const rs = makeRules(cfg());
    expect(serveInfo(rs).serverPos.x).toBeGreaterThan(0);
    awardPoint(rs, 0);
    expect(serveInfo(rs).serverPos.x).toBeLessThan(0);
    expect(serveInfo(rs).serverTeam).toBe(0);
    awardPoint(rs, 1);
    expect(serveInfo(rs).serverTeam).toBe(1);
  });
  it('win by two and cap at 30', () => {
    const rs = makeRules(cfg());
    rs.teams[0].score = 20; rs.teams[1].score = 20;
    expect(awardPoint(rs, 0)).toBe('point');
    expect(awardPoint(rs, 0)).toBe('game');
    const r2 = makeRules(cfg());
    r2.teams[0].score = 29; r2.teams[1].score = 29;
    expect(awardPoint(r2, 1)).toBe('game'); // 30 is the cap
  });
  it('best of three flow, sides swap', () => {
    const rs = makeRules(cfg({ pointsToWin: 3, cap: 5 }));
    let r = 'point';
    while (r === 'point') r = awardPoint(rs, 0);
    expect(r).toBe('game');
    nextGame(rs, 0);
    expect(rs.teams[0].side).toBe(-1);
    r = 'point';
    while (r === 'point') r = awardPoint(rs, 0);
    expect(r).toBe('match');
    expect(rs.matchWinner).toBe(0);
  });
  it('doubles: serving team swaps courts, receivers do not', () => {
    const rs = makeRules(cfg({ doubles: true }));
    const a = serveInfo(rs);
    expect(a.serverSlot).toBe(0);
    awardPoint(rs, 0);
    const b = serveInfo(rs);
    expect(b.serverSlot).toBe(0); // odd score -> left court, players swapped so same player
    expect(b.serverPos.x).toBeLessThan(0);
    awardPoint(rs, 1); // side-out
    expect(serveInfo(rs).serverTeam).toBe(1);
  });
  it('judges landings: in, out, net, service fault, let', () => {
    const rs = makeRules(cfg());
    const base = { lastHitTeam: 0 as const, isServe: false, netTouched: false, targetXSign: -1 };
    expect(judgeLanding(rs, { ...base, x: 1, z: -5 }).winner).toBe(0);
    expect(judgeLanding(rs, { ...base, x: 2.7, z: -5 }).winner).toBe(1);
    expect(judgeLanding(rs, { ...base, x: 0, z: -6.9 }).winner).toBe(1);
    expect(judgeLanding(rs, { ...base, x: 0, z: 1, netTouched: true }).reason).toBe('net');
    expect(judgeLanding(rs, { ...base, x: 0, z: 0.05, netTouched: true }).reason).toBe('let');
    expect(judgeLanding(rs, { ...base, x: 1, z: -3, isServe: true }).winner).toBe(1); // wrong court
    expect(judgeLanding(rs, { ...base, x: -1, z: -3, isServe: true }).winner).toBe(0);
    expect(judgeLanding(rs, { ...base, x: -1, z: -1.5, isServe: true }).winner).toBe(1); // short
  });
});
