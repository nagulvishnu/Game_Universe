import * as THREE from 'three';
import { AIRCRAFT } from '../src/game/aircraft';
import { createState, placeOnGround, stepFlight, headingOf, pitchOf, bankOf } from '../src/game/physics';
import { getAirport } from '../src/game/worldData';

const ap = getAirport('SKY');
const only = process.argv[2];
for (const spec of AIRCRAFT) {
  if (only && spec.id !== only) continue;
  const st = createState(spec);
  const start = { x: ap.x - ap.fwd.x * (ap.length / 2 - 100), z: ap.z - ap.fwd.z * (ap.length / 2 - 100) };
  placeOnGround(st, spec, start.x, start.z, ap.heading, ap.elev);
  st.fuel = spec.fuelCap * 0.6;
  const env = { wind: new THREE.Vector3(), turbulence: 0, assist: true, noThrust: false, frozen: false };
  const ctl = { pitch: 0, roll: 0, yaw: 0, throttleAxis: 0, brake: false };
  const dt = 1 / 120;
  let lift = false, log = '';
  const heli = spec.thrustKind === 'heli';
  st.throttle = heli ? 0.7 : 1;
  const climbPitch = spec.cls === 'fighter' ? 15 : 9;
  for (let t = 0; t < 160 && !st.crashed; t += dt) {
    const pitch = pitchOf(st.quat) * 57.3;
    if (!heli) {
      if (st.onGround) ctl.pitch = st.ias > spec.vRotate ? 0.6 : 0;
      else ctl.pitch = Math.max(-1, Math.min(1, (climbPitch - pitch) * 0.08));
      if (t > 90) { st.throttle = 0.6; ctl.roll = t > 100 && t < 112 ? 0.5 : 0; }
      if (t > 130) { st.throttle = 0.0; }
    } else { ctl.throttleAxis = t > 3 ? 1 : 0; if (st.agl > 100) ctl.throttleAxis = 0; ctl.pitch = st.agl > 50 && t<30 ? -0.5 : 0; }
    if (!st.onGround && !lift) { lift = true; log += `liftoff t=${t.toFixed(1)} ias=${st.ias.toFixed(1)} dist=${(Math.hypot(st.pos.x - start.x, st.pos.z - start.z)).toFixed(0)}\n`; }
    if (!spec.fixedGear && lift && st.agl > 20) st.gearCmd = false;
    stepFlight(st, spec, ctl, env, dt);
    if (Math.round(t * 120) % (120 * 10) === 0) log += `t=${t.toFixed(0)} ias=${st.ias.toFixed(0)} alt=${(st.pos.y-ap.elev).toFixed(0)} vs=${st.vel.y.toFixed(1)} pitch=${pitch.toFixed(1)} alpha=${(st.alpha*57.3).toFixed(1)} bank=${(bankOf(st.quat)*57.3).toFixed(1)} g=${st.gLoad.toFixed(2)} hdg=${(headingOf(st.quat)*57.3).toFixed(0)} integ=${st.integrity.toFixed(0)} M=${st.mach.toFixed(2)}\n`;
  }
  console.log('=== ' + spec.name, st.crashed ? 'CRASH ' + st.crashReason : 'ok', 'fuel', st.fuel.toFixed(0));
  console.log(log);
}
