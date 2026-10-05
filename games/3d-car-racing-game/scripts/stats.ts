import { TRACKS } from "../src/game/data";
import { buildTrackData, trackStats } from "../src/game/trackMath";
for (const d of TRACKS) {
  const t = buildTrackData(d);
  const s = trackStats(t);
  console.log(d.id.padEnd(8), "len", s.length.toFixed(0), "minR", s.minRadius.toFixed(1), "maxSlope", s.maxSlope.toFixed(3), "minSep", s.minSep.toFixed(1), "n", t.n);
}
