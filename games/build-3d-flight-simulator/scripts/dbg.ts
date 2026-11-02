import * as THREE from 'three';
import { getAircraft } from '../src/game/aircraft';
import { createState, placeInAir, stepFlight, pitchOf } from '../src/game/physics';
import { getAirport } from '../src/game/worldData';
const ap = getAirport('SKY'); const spec = getAircraft('lynx45');
const st = createState(spec);
placeInAir(st, spec, ap.x - 8000, 600, ap.z, ap.heading, 62, true);
st.flapsCmd=3; st.flaps=1;
const env = { wind: new THREE.Vector3(), turbulence: 0, assist: true, noThrust: false, frozen: false };
const ctl = { pitch: 0, roll: 0, yaw: 0, throttleAxis: 0, brake: false };
for (let t=0;t<40;t+=1/120){
  const vsT=-2.6; ctl.pitch = Math.max(-1,Math.min(1,(vsT - st.vel.y)*0.05));
  st.throttle = st.ias<60?0.6:0.0;
  stepFlight(st,spec,ctl,env,1/120);
  if (Math.round(t*120)%240===0) console.log(t.toFixed(0),'ias',st.ias.toFixed(0),'vy',st.vel.y.toFixed(1),'pitch',(pitchOf(st.quat)*57.3).toFixed(1),'alpha',(st.alpha*57.3).toFixed(1),'in',ctl.pitch.toFixed(2),'g',st.gLoad.toFixed(2),'w.x',st.w.x.toFixed(2));
}
