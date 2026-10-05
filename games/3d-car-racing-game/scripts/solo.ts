import { TRACKS, CARS, THEMES } from "../src/game/data";
import { buildTrackData } from "../src/game/trackMath";
import { createSimCar, placeCar, stepCar, aiDrive, resolveBarrier, updateLaps } from "../src/game/sim";
for (const td of TRACKS) {
  const t = buildTrackData(td); const th = THEMES[td.theme];
  const env = { roadGrip: th.roadGrip, offroadGrip: th.offroadGrip };
  const out: string[] = [];
  for (const c of CARS) {
    const car = createSimCar(0, c.name, c, 0, { len: 4.4, wid: 1.9 }, false);
    car.skill = 0.98; placeCar(t, car, -8, 0);
    let time = 0, off = 0, hits = 0; const dt = 1/60;
    while (time < 400 && car.lapsDone < 3) {
      aiDrive(t, car, [car], dt, env, 1); stepCar(t, car, dt, env); car.hit = 0; resolveBarrier(t, car, dt);
      if (car.hit > .5) hits++; if (!car.onRoad) off++; updateLaps(t, car, time, 3); time += dt;
    }
    out.push(`${c.id}: ${(car.lapTimes[2] ?? 0).toFixed(1)}s off${off} hit${hits}`);
  }
  console.log(td.id.padEnd(7), out.join(" | "));
}
