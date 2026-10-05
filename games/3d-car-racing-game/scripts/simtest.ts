import { TRACKS, CARS, THEMES } from "../src/game/data";
import { buildTrackData } from "../src/game/trackMath";
import { createSimCar, placeCar, stepCar, aiDrive, resolveBarrier, resolveCars, updateLaps } from "../src/game/sim";

for (const td of TRACKS) {
  const t = buildTrackData(td);
  const th = THEMES[td.theme];
  const env = { roadGrip: th.roadGrip, offroadGrip: th.offroadGrip };
  const cars = CARS.map((c, i) => {
    const car = createSimCar(i, c.name, c, 0xff0000, { len: 4.4, wid: 1.9 }, false);
    car.skill = 0.98; car.aiBaseLane = ((i % 3) - 1) * 3;
    placeCar(t, car, -8 - 8 * Math.floor(i / 2), i % 2 ? 3.6 : -3.6);
    return car;
  });
  let time = 0; const dt = 1 / 60;
  const stats = cars.map(() => ({ hits: 0, off: 0, maxHit: 0, topv: 0 }));
  while (time < 400 && !cars.every((c) => c.finished)) {
    for (const c of cars) { aiDrive(t, c, cars, dt, env, 1); stepCar(t, c, dt, env); }
    resolveCars(cars);
    cars.forEach((c, i) => {
      c.hit = 0; resolveBarrier(t, c, dt);
      if (c.hit > 0.5) stats[i].hits++; stats[i].maxHit = Math.max(stats[i].maxHit, c.hit);
      if (!c.onRoad) stats[i].off++;
      stats[i].topv = Math.max(stats[i].topv, c.speed);
      updateLaps(t, c, time, 3);
    });
    time += dt;
  }
  console.log(td.id, "len", t.length.toFixed(0), "time", time.toFixed(0));
  cars.forEach((c, i) => console.log("  ", c.def.id.padEnd(7), "laps", c.lapsDone, "best", isFinite(c.bestLap) ? c.bestLap.toFixed(1) : "-", "wallHits", stats[i].hits, "maxHit", stats[i].maxHit.toFixed(1), "offFrames", stats[i].off, "top km/h", (stats[i].topv * 3.6).toFixed(0)));
}
