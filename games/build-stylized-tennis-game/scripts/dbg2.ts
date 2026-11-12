import { planShot, simulateLanding } from '../src/game/physics';
for (const T of [0.84, 1.0]) {
const p = planShot(-4, 0.67, 5.9, 5.1, -7.4, T, 1.8, 1.27);
console.log(p, simulateLanding(-4,0.67,5.9,p.vx,p.vy,p.vz,1.8));
}
const p2 = planShot(0, 1.0, 11, 2, -9.6, 0.95, 0.3, 1.27);
console.log(p2, simulateLanding(0,1,11,p2.vx,p2.vy,p2.vz,0.3));
