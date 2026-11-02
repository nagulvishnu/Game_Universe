import { useGame } from './store';
import { rt } from './runtime';
import { poiById, computeRoute } from './world/city';
import { acceptOffer, activeRide, arriveAtPickup, boardPassenger, cancelPersonalRide, completePersonalRide, declineOffer } from './logic/rides';
import { chime, startAudio } from './audio';
import { notify } from './state';

const st = () => useGame.getState();

export function acceptOfferAction() {
  const r = st().act((s) => acceptOffer(s));
  if (r) { chime('ding'); rt.target = { x: r.pickup.x, z: r.pickup.z, kind: 'pickup' }; }
}
export function declineOfferAction() { st().act((s) => declineOffer(s)); }
export function cancelRideAction() { st().act((s) => cancelPersonalRide(s)); rt.target = null; rt.route = null; }
export function toggleOnline() {
  startAudio();
  st().act((s) => {
    s.player.online = !s.player.online;
    if (!s.player.online) { s.offer = null; }
    notify(s, s.player.online ? 'You are ONLINE on PillionGo. Ride requests will appear.' : 'You went offline.', s.player.online ? 'good' : 'info');
  });
}
export function boardAction() {
  const ok = st().act((s) => boardPassenger(s));
  if (ok) {
    rt.passengerBoarded = true;
    rt.tel = { distanceM: 0, elapsedSec: 0, collisions: 0, hardEvents: 0, speedingSec: 0 };
  }
}
export function dropAction() {
  const r = st().act((s) => completePersonalRide(s, { ...rt.tel }));
  if (r) { chime('good'); rt.passengerBoarded = false; rt.target = null; rt.route = null; st().openPanel('ridesummary', r.id); }
}
export function arriveAction() { st().act((s) => arriveAtPickup(s)); }

export function startNavigation(poiId: string) {
  const p = poiById.get(poiId);
  if (!p) return;
  rt.target = { x: p.x, z: p.z, kind: 'poi' };
  const px = rt.mode === 'walk' ? rt.walk.x : rt.bike.x, pz = rt.mode === 'walk' ? rt.walk.z : rt.bike.z;
  rt.route = computeRoute(px, pz, p.x, p.z).pts;
  st().toast(`GPS: navigating to ${p.name}`);
}
export function clearNavigation() { rt.target = null; rt.route = null; }

export function currentRide() { const g = st().g; return g ? activeRide(g) : null; }
