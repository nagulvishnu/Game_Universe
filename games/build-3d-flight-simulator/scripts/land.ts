import * as THREE from 'three';
import { AIRCRAFT } from '../src/game/aircraft';
import { createState, placeInAir, stepFlight, headingOf, pitchOf } from '../src/game/physics';
import { getAirport } from '../src/game/worldData';
const ap = getAirport('SKY');
for (const spec of AIRCRAFT) {
  if (spec.cls==='helicopter') continue;
  const st = createState(spec);
  const d = 4000;
  placeInAir(st, spec, ap.x - ap.fwd.x*(ap.length/2+d), ap.elev + d*Math.tan(3*Math.PI/180)+10, ap.z - ap.fwd.z*(ap.length/2+d), ap.heading, spec.vApp*1.05, true);
  st.fuel = spec.fuelCap*0.3; st.flapsCmd = spec.flapLevels; st.flaps = 1;
  const env = { wind: new THREE.Vector3(), turbulence: 0, assist: true, noThrust: false, frozen: false };
  const ctl = { pitch: 0, roll: 0, yaw: 0, throttleAxis: 0, brake: false };
  const dt=1/120; let log=''; let td=false;
  for (let t=0;t<200&&!st.crashed;t+=dt){
    const pitch = pitchOf(st.quat)*57.3;
    const vsT = st.agl<15 ? -0.7 : -3.0*(spec.vApp/70);
    if (!st.onGround) {
      const tgtPitch = st.agl<15 ? 4 : -1 + (spec.cls==='fighter'?7:0); ctl.pitch = Math.max(-1,Math.min(1,(tgtPitch - pitch)*0.15 + (vsT-st.vel.y)*0.02));
      st.throttle = Math.max(0, Math.min(1, st.throttle + (spec.vApp - st.ias) * 0.05*dt*10));
      if (st.agl<15) st.throttle = Math.max(0, st.throttle - 0.4*dt);
    } else { st.throttle=0; ctl.pitch=0; ctl.brake = st.ias<60; if (st.vel.length()<1) break; }
    stepFlight(st, spec, ctl, env, dt);
    if (st.newTouchdown) { td=true; log += `TD t=${t.toFixed(1)} sink=${st.lastTouchdown!.sink.toFixed(2)} spd=${st.lastTouchdown!.speed.toFixed(1)} pitch=${pitch.toFixed(1)} integ=${st.integrity.toFixed(0)}\n`; }
    if (Math.round(t*120)%(120*15)===0) log+=`t=${t.toFixed(0)} agl=${st.agl.toFixed(0)} ias=${st.ias.toFixed(0)} vs=${st.vel.y.toFixed(1)} pitch=${pitch.toFixed(1)} thr=${st.throttle.toFixed(2)}\n`;
  }
  const along = (st.pos.x-ap.x)*ap.fwd.x+(st.pos.z-ap.z)*ap.fwd.z;
  console.log('===',spec.name, st.crashed?'CRASH '+st.crashReason:'ok','integ',st.integrity.toFixed(0),'stop u=',along.toFixed(0),'td',td); console.log(log);
}
