import * as THREE from 'three';
import type { EnvState } from '../film/runtime';
import type { EnvId } from '../engine/types';

export const atm = {
  skyTop: new THREE.Color('#4a86d8'), skyHor: new THREE.Color('#bcd6f0'), fog: new THREE.Color('#bcd6f0'), fogDensity: 0.01,
  lightColor: new THREE.Color('#fff2d8'), lightIntensity: 1.5, lightDir: new THREE.Vector3(0.4, 0.8, 0.4),
  ambColor: new THREE.Color('#9fb4d8'), ambIntensity: 0.6, stars: 0, night: 0, day: 1, eclipse: 0, cave: false,
  sunDir: new THREE.Vector3(-0.35, 0.5, -0.9).normalize(),
};

const c1 = new THREE.Color(), c2 = new THREE.Color();
const mix = (out: THREE.Color, a: string, b: string, t: number) => out.set(a).lerp(c2.set(b), Math.max(0, Math.min(1, t)));
const smooth = (x: number) => x * x * (3 - 2 * x);

export function updateAtmosphere(e: EnvState, envId: EnvId, flashBoost: number) {
  const h = ((e.hour % 24) + 24) % 24;
  const elev = Math.sin(((h - 6) / 12) * Math.PI); // -1..1
  const day = smooth(Math.max(0, Math.min(1, elev * 2.2 + 0.25)));
  const warm = Math.max(0, 1 - Math.abs(elev) * 3.2) * (elev > -0.3 ? 1 : 0);
  atm.day = day; atm.night = 1 - day; atm.eclipse = e.eclipse; atm.cave = envId === 'caverns';
  const wx = e.weather;
  const grey = wx === 'storm' ? 0.78 : wx === 'ash' ? 0.65 : wx === 'rain' ? 0.6 : wx === 'mist' ? 0.5 : 0;
  mix(atm.skyTop, '#050818', '#4a86d8', day);
  mix(atm.skyHor, '#141c3a', '#bcd6f0', day);
  c1.set('#ff8f55'); atm.skyHor.lerp(c1, warm * 0.8); atm.skyTop.lerp(c1.set('#5a4a8a'), warm * 0.35);
  const greyTone = wx === 'ash' ? '#7b6d66' : wx === 'storm' ? '#3a3f4c' : '#6c7480';
  c1.set(greyTone).multiplyScalar(0.25 + day * 0.75);
  atm.skyTop.lerp(c1, grey); atm.skyHor.lerp(c1.multiplyScalar(1.15), grey);
  // the eclipse drains the colour from the world and bleeds violet at the horizon
  const ec = e.eclipse;
  atm.skyTop.multiplyScalar(1 - 0.85 * ec); atm.skyHor.lerp(c1.set('#3b1050'), ec * 0.55).multiplyScalar(1 - 0.5 * ec);
  atm.fog.copy(atm.skyHor);
  atm.fogDensity = (wx === 'mist' ? 0.032 : wx === 'ash' ? 0.02 : wx === 'storm' ? 0.018 : wx === 'rain' ? 0.016 : 0.008) + ec * 0.004;
  // key light: sun by day, moon by night
  mix(atm.lightColor, '#9db4ff', '#fff2d8', day); atm.lightColor.lerp(c1.set('#ffa468'), warm * 0.7);
  atm.lightIntensity = (1.0 + day * 1.6) * (1 - grey * 0.45) * (1 - 0.65 * ec);
  atm.lightDir.set(-0.45, Math.max(0.25, 0.35 + Math.abs(elev) * 0.8), 0.7).normalize();
  mix(atm.ambColor, '#2a3566', '#a8bde0', day); atm.ambColor.lerp(c1.set('#5a3a6a'), ec * 0.4);
  atm.ambIntensity = (1.0 + day * 0.5) * (1 - 0.35 * ec);
  atm.stars = Math.max(0, (1 - day) * (1 - grey * 0.8)) + ec * 0.5;
  if (atm.cave) {
    atm.skyTop.set('#04050c'); atm.skyHor.set('#060916'); atm.fog.set('#070a18'); atm.fogDensity = 0.028;
    atm.lightIntensity = 0.12; atm.ambColor.set('#4a5aa0'); atm.ambIntensity = 0.7; atm.stars = 0;
  }
  if (flashBoost > 0) { atm.ambIntensity += flashBoost * 2.2; atm.lightIntensity += flashBoost * 3; atm.skyHor.lerp(c1.set('#ffffff'), flashBoost * 0.5); atm.fog.lerp(c1, flashBoost * 0.3); }
}
