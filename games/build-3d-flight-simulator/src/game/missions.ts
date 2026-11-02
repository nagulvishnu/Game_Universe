import * as THREE from 'three';
import type { AircraftClass, AircraftSpec } from './aircraft';
import type { WeatherId } from './environment';
import type { FlightState, Touchdown } from './physics';
import { AIRPORTS, airportLocal, airportSdf, getAirport, getHelipad, terrainHeight, type Airport } from './worldData';
import { clamp } from './noise';

export type ModeId = 'free' | 'career' | 'landing' | 'passenger' | 'cargo' | 'rescue' | 'fighter' | 'trial';
export type MissionKind = 'free' | 'landing' | 'transport' | 'rescue' | 'strike' | 'trial';

export interface MissionDef {
  id: string;
  mode: ModeId;
  kind: MissionKind;
  title: string;
  brief: string;
  difficulty: 1 | 2 | 3;
  reward: number;
  allowed: AircraftClass[];
  recommended: string;
  weather: WeatherId;
  hour: number;
  start: { airport: string } | { air: { airport: string; dist: number; agl: number; speedK?: number; gear?: boolean; bearing?: number } } | { pos: { x: number; z: number; agl: number; heading: number; speed: number } };
  landing?: { airport: string; engineOut?: boolean };
  transport?: { from: string; to: string; cargo: boolean };
  rescue?: { victims: { x: number; z: number; label: string }[]; hospital: string; timeLimit: number };
  strike?: { base: string; targets: { type: 'drone' | 'ground' | 'ship'; x: number; z: number; alt?: number }[]; rtb: boolean };
  trial?: { course: string };
}

const ALL: AircraftClass[] = ['airliner', 'fighter', 'cargo', 'business', 'helicopter', 'prop'];

export interface TrialCourse { id: string; name: string; start: { x: number; z: number; agl: number; heading: number }; gates: [number, number, number][] }
export const TRIALS: Record<string, TrialCourse> = {
  island: {
    id: 'island', name: 'Island Hopper', start: { x: -13000, z: -6600, agl: 280, heading: Math.PI * 1.0 + 0.0 },
    gates: [[-13200, -3500, 250], [-13700, 0, 200], [-14100, 3500, 180], [-14000, 7000, 150], [-11500, 11000, 220], [-8000, 14000, 330], [-6000, 10500, 250], [-3000, 6000, 220]],
  },
  canyon: {
    id: 'canyon', name: 'Canyon Run', start: { x: 6500, z: -3000, agl: 600, heading: 0 },
    gates: [[6300, -5500, 160], [5000, -7500, 150], [4300, -9500, 150], [6300, -11200, 150], [8500, -10500, 150], [9500, -8500, 150], [8200, -6500, 150], [6500, -4200, 150]],
  },
  metro: {
    id: 'metro', name: 'Metro Dash', start: { x: -4800, z: 1500, agl: 160, heading: Math.PI / 2 },
    gates: [[-2500, 2600, 160], [-1500, 4200, 150], [-3500, 4600, 140], [-2500, 5600, 140], [0, 6500, 140], [2000, 8000, 150], [4000, 10200, 140], [4000, 12200, 140]],
  },
  desert: {
    id: 'desert', name: 'Desert Sprint', start: { x: 11000, z: 9800, agl: 220, heading: Math.PI * 1.5 },
    gates: [[9000, 8300, 110], [7500, 6200, 120], [8600, 4200, 160], [11000, 3500, 130], [13500, 5500, 110], [14500, 8500, 100], [12500, 10800, 90], [10500, 9000, 70]],
  },
};
export function courseLength(c: TrialCourse) {
  let d = 0;
  let px = c.start.x;
  let pz = c.start.z;
  for (const g of c.gates) { d += Math.hypot(g[0] - px, g[1] - pz); px = g[0]; pz = g[1]; }
  return d;
}

export const MISSIONS: MissionDef[] = [
  // ---------------- landing challenges ----------------
  {
    id: 'land-sky', mode: 'landing', kind: 'landing', title: 'Skyharbor Visual Approach', difficulty: 1, reward: 300,
    brief: 'Clear skies, 3° glideslope to runway 09 at Skyharbor International. Gear down, flaps, flare and brake to a stop on the runway.',
    allowed: ALL, recommended: 'liner320', weather: 'clear', hour: 10,
    start: { air: { airport: 'SKY', dist: 7500, agl: 60, gear: false } }, landing: { airport: 'SKY' },
  },
  {
    id: 'land-plm', mode: 'landing', kind: 'landing', title: 'Island Crosswind', difficulty: 2, reward: 450,
    brief: 'Gusty winds and rain showers on Palm Island. Short coastal runway – keep it lined up and land on the numbers.',
    allowed: ALL, recommended: 'lynx45', weather: 'rain', hour: 16,
    start: { air: { airport: 'PLM', dist: 6500, agl: 50, gear: false } }, landing: { airport: 'PLM' },
  },
  {
    id: 'land-vlc', mode: 'landing', kind: 'landing', title: 'Volcano Strip – Short Field', difficulty: 3, reward: 650,
    brief: 'A short, sloping strip carved into a volcano at dusk. Precision and speed control are everything.',
    allowed: ['prop', 'business', 'helicopter', 'fighter'], recommended: 'sparrow172', weather: 'partly', hour: 18.6,
    start: { air: { airport: 'VLC', dist: 5000, agl: 80, gear: false, speedK: 1.1 } }, landing: { airport: 'VLC' },
  },
  {
    id: 'land-eng', mode: 'landing', kind: 'landing', title: 'Dead Stick – Engine Failure', difficulty: 3, reward: 800,
    brief: 'Total engine failure at altitude. Glide to Meridian International and put it on the runway without power.',
    allowed: ['business', 'airliner', 'prop', 'cargo', 'fighter'], recommended: 'lynx45', weather: 'partly', hour: 14,
    start: { air: { airport: 'MRD', dist: 9500, agl: 1700, gear: false, speedK: 1.25 } }, landing: { airport: 'MRD', engineOut: true },
  },
  {
    id: 'land-storm', mode: 'landing', kind: 'landing', title: 'Storm Approach', difficulty: 3, reward: 900,
    brief: 'Night thunderstorm over Harborview. Heavy turbulence, low visibility, lightning. Trust your instruments.',
    allowed: ALL, recommended: 'liner320', weather: 'storm', hour: 22.5,
    start: { air: { airport: 'HBR', dist: 8000, agl: 70, gear: false } }, landing: { airport: 'HBR' },
  },
  // ---------------- passenger ----------------
  {
    id: 'pax-1', mode: 'passenger', kind: 'transport', title: 'Coastal Shuttle', difficulty: 1, reward: 500,
    brief: 'Carry 150 passengers from Skyharbor to Harborview. Keep the ride smooth – comfort affects your pay.',
    allowed: ['airliner', 'business', 'prop'], recommended: 'liner320', weather: 'partly', hour: 9,
    start: { airport: 'SKY' }, transport: { from: 'SKY', to: 'HBR', cargo: false },
  },
  {
    id: 'pax-2', mode: 'passenger', kind: 'transport', title: 'Island Express', difficulty: 2, reward: 700,
    brief: 'Executive charter west across the sea to Palm Island. Short runway at the other end.',
    allowed: ['business', 'prop', 'airliner'], recommended: 'lynx45', weather: 'clear', hour: 17,
    start: { airport: 'SKY' }, transport: { from: 'SKY', to: 'PLM', cargo: false },
  },
  {
    id: 'pax-3', mode: 'passenger', kind: 'transport', title: 'Mountain Charter', difficulty: 3, reward: 950,
    brief: 'Sightseers to Alpine Peak Airfield, high in the mountains. Thin air, gusty winds, tricky approach.',
    allowed: ['business', 'prop', 'helicopter'], recommended: 'lynx45', weather: 'overcast', hour: 12,
    start: { airport: 'MRD' }, transport: { from: 'MRD', to: 'ALP', cargo: false },
  },
  // ---------------- cargo ----------------
  {
    id: 'cargo-1', mode: 'cargo', kind: 'transport', title: 'Supply Run', difficulty: 1, reward: 550,
    brief: 'Deliver medical supplies to Coral Isle Regional. Fragile cargo – avoid harsh manoeuvres.',
    allowed: ['cargo', 'prop', 'business', 'airliner'], recommended: 'titan90', weather: 'clear', hour: 8,
    start: { airport: 'SKY' }, transport: { from: 'SKY', to: 'CRL', cargo: true },
  },
  {
    id: 'cargo-2', mode: 'cargo', kind: 'transport', title: 'Heavy Haul', difficulty: 2, reward: 800,
    brief: 'Maximum payload from Meridian to Harborview. Long take-off roll – use the whole runway.',
    allowed: ['cargo', 'airliner'], recommended: 'titan90', weather: 'overcast', hour: 6.5,
    start: { airport: 'MRD' }, transport: { from: 'MRD', to: 'HBR', cargo: true },
  },
  {
    id: 'cargo-3', mode: 'cargo', kind: 'transport', title: 'Desert Delivery', difficulty: 2, reward: 700,
    brief: 'Spare parts to the Dune Field strip. Hot, thin air and a rough sand-edged runway.',
    allowed: ['prop', 'helicopter', 'business', 'cargo'], recommended: 'hawk60', weather: 'clear', hour: 13,
    start: { airport: 'HBR' }, transport: { from: 'HBR', to: 'DUN', cargo: true },
  },
  // ---------------- rescue ----------------
  {
    id: 'rescue-1', mode: 'rescue', kind: 'rescue', title: 'Coastal Rescue', difficulty: 1, reward: 600,
    brief: 'Two sailors adrift off the west coast. Hover low over each beacon to winch them aboard, then fly to Skyharbor General.',
    allowed: ['helicopter'], recommended: 'hawk60', weather: 'partly', hour: 11,
    start: { airport: 'SKY' },
    rescue: { victims: [{ x: -9600, z: 1800, label: 'Sailor 1' }, { x: -10800, z: -1500, label: 'Sailor 2' }], hospital: 'H_SKY', timeLimit: 540 },
  },
  {
    id: 'rescue-2', mode: 'rescue', kind: 'rescue', title: 'Mountain Rescue', difficulty: 2, reward: 850,
    brief: 'Stranded hikers on the slopes below Alpine Peak. Thin air limits lift – fly carefully and bring them to the clinic.',
    allowed: ['helicopter'], recommended: 'hawk60', weather: 'overcast', hour: 15,
    start: { airport: 'ALP' },
    rescue: { victims: [{ x: 5200, z: -9800, label: 'Hiker 1' }, { x: 7600, z: -8300, label: 'Hiker 2' }, { x: 4600, z: -7600, label: 'Hiker 3' }], hospital: 'H_ALP', timeLimit: 600 },
  },
  {
    id: 'rescue-3', mode: 'rescue', kind: 'rescue', title: 'Storm Rescue', difficulty: 3, reward: 1200,
    brief: 'Night, thunderstorm, flooding near Meridian. Find the survivors and get them to hospital before time runs out.',
    allowed: ['helicopter'], recommended: 'hawk60', weather: 'storm', hour: 23,
    start: { airport: 'MRD' },
    rescue: { victims: [{ x: 14500, z: -5500, label: 'Survivor 1' }, { x: 16500, z: -1500, label: 'Survivor 2' }, { x: 13500, z: 1500, label: 'Survivor 3' }], hospital: 'H_MRD', timeLimit: 600 },
  },
  // ---------------- fighter ----------------
  {
    id: 'fighter-1', mode: 'fighter', kind: 'strike', title: 'Range Practice', difficulty: 1, reward: 600,
    brief: 'Destroy six ground targets with cannon and missiles (SPACE = cannon, M = missile), then return to base.',
    allowed: ['fighter'], recommended: 'falcon22', weather: 'clear', hour: 10,
    start: { airport: 'MRD' },
    strike: {
      base: 'MRD', rtb: true, targets: [
        { type: 'ground', x: 15500, z: -1800 }, { type: 'ground', x: 16200, z: -600 }, { type: 'ground', x: 15000, z: 800 },
        { type: 'ground', x: 16800, z: -2600 }, { type: 'ground', x: 15800, z: 1800 }, { type: 'ground', x: 17200, z: 300 },
      ],
    },
  },
  {
    id: 'fighter-2', mode: 'fighter', kind: 'strike', title: 'Air Superiority', difficulty: 2, reward: 900,
    brief: 'Hostile drones are circling over the highlands. Lock on, shoot them down, then land at Meridian.',
    allowed: ['fighter'], recommended: 'falcon22', weather: 'partly', hour: 14,
    start: { airport: 'MRD' },
    strike: {
      base: 'MRD', rtb: true, targets: [
        { type: 'drone', x: 9000, z: -3000, alt: 1800 }, { type: 'drone', x: 9500, z: -3500, alt: 2200 }, { type: 'drone', x: 8500, z: -2500, alt: 2600 },
        { type: 'drone', x: 10000, z: -2000, alt: 2000 }, { type: 'drone', x: 9200, z: -4200, alt: 2900 },
      ],
    },
  },
  {
    id: 'fighter-3', mode: 'fighter', kind: 'strike', title: 'Operation Stormfront', difficulty: 3, reward: 1400,
    brief: 'Night storm. Strike ground installations, a patrol ship and intercept drones – then bring it home.',
    allowed: ['fighter'], recommended: 'falcon22', weather: 'storm', hour: 0.5,
    start: { airport: 'MRD' },
    strike: {
      base: 'MRD', rtb: true, targets: [
        { type: 'ground', x: 16000, z: -4000 }, { type: 'ground', x: 17000, z: -2500 }, { type: 'ground', x: 15500, z: 1500 },
        { type: 'drone', x: 14000, z: -1000, alt: 1500 }, { type: 'drone', x: 15000, z: -5000, alt: 2200 }, { type: 'drone', x: 16500, z: 0, alt: 2600 },
        { type: 'ship', x: -9500, z: 4500 }, { type: 'ship', x: -10500, z: 2500 },
      ],
    },
  },
  // ---------------- time trials ----------------
  { id: 'trial-island', mode: 'trial', kind: 'trial', title: 'Island Hopper', difficulty: 1, reward: 400, brief: 'Skim the archipelago and climb over the volcano summit. 8 gates.', allowed: ALL, recommended: 'sparrow172', weather: 'clear', hour: 9, start: { pos: { x: -13000, z: -6600, agl: 280, heading: Math.PI, speed: 55 } }, trial: { course: 'island' } },
  { id: 'trial-canyon', mode: 'trial', kind: 'trial', title: 'Canyon Run', difficulty: 3, reward: 700, brief: 'Low and fast through the Alpine canyons. Rings hug the terrain – stay sharp.', allowed: ALL, recommended: 'falcon22', weather: 'partly', hour: 15, start: { pos: { x: 6500, z: -3000, agl: 600, heading: 0, speed: 90 } }, trial: { course: 'canyon' } },
  { id: 'trial-metro', mode: 'trial', kind: 'trial', title: 'Metro Dash', difficulty: 2, reward: 550, brief: 'Weave between skyscrapers above Skyharbor and Harborview at dusk.', allowed: ALL, recommended: 'lynx45', weather: 'clear', hour: 18.3, start: { pos: { x: -4800, z: 1500, agl: 160, heading: Math.PI / 2, speed: 80 } }, trial: { course: 'metro' } },
  { id: 'trial-desert', mode: 'trial', kind: 'trial', title: 'Desert Sprint', difficulty: 2, reward: 500, brief: 'A flat-out sprint over the dunes. Keep it low for the best line.', allowed: ALL, recommended: 'falcon22', weather: 'clear', hour: 12, start: { pos: { x: 11000, z: 9800, agl: 220, heading: Math.PI * 1.5, speed: 80 } }, trial: { course: 'desert' } },
];

export const CAREER: string[] = [
  'land-sky', 'pax-1', 'cargo-1', 'trial-island', 'rescue-1', 'land-plm', 'fighter-1', 'pax-2', 'trial-metro', 'cargo-2',
  'land-eng', 'fighter-2', 'rescue-2', 'cargo-3', 'pax-3', 'trial-canyon', 'land-storm', 'rescue-3', 'fighter-3',
];

export const MODES: { id: ModeId; name: string; tagline: string; icon: string; color: string }[] = [
  { id: 'free', name: 'Free Flight', tagline: 'Pick any airport, weather and time of day – and just fly.', icon: '✈', color: '#38bdf8' },
  { id: 'career', name: 'Career Mode', tagline: 'Climb the ranks through a ladder of contracts.', icon: '★', color: '#fbbf24' },
  { id: 'landing', name: 'Landing Challenges', tagline: 'Precision approaches in storms, crosswinds and dead-stick.', icon: '⇩', color: '#34d399' },
  { id: 'passenger', name: 'Passenger Transport', tagline: 'Smooth, safe scheduled flights with happy passengers.', icon: '☺', color: '#a78bfa' },
  { id: 'cargo', name: 'Cargo Missions', tagline: 'Heavy payloads, short fields and tight deadlines.', icon: '▣', color: '#fb923c' },
  { id: 'rescue', name: 'Emergency Rescue', tagline: 'Helicopter winch rescues in all conditions.', icon: '✚', color: '#f87171' },
  { id: 'fighter', name: 'Fighter Missions', tagline: 'Afterburners, cannon and heat-seeking missiles.', icon: '⚔', color: '#f43f5e' },
  { id: 'trial', name: 'Time Trials', tagline: 'Race through ring gates and chase the gold medal.', icon: '⏱', color: '#22d3ee' },
];

export const getMission = (id: string) => MISSIONS.find((m) => m.id === id)!;

/* ------------------------------------------------------------------ */
/* Runtime                                                             */
/* ------------------------------------------------------------------ */
export interface Marker { id: string; kind: 'ring' | 'beam' | 'pad'; x: number; y: number; z: number; r: number; color: number; active: boolean; yaw: number; dim?: boolean }
export interface Target { id: number; type: 'drone' | 'ground' | 'ship'; pos: THREE.Vector3; vel: THREE.Vector3; hp: number; maxHp: number; radius: number; alive: boolean; heading: number; timer: number; turn: number; center: THREE.Vector3 }
export interface MissionHud {
  title: string; objective: string; sub?: string; timer?: string;
  progress?: { label: string; value: number; color: string };
  meters?: { label: string; value: number; color: string }[];
  target?: { x: number; y: number; z: number; label: string } | null;
  notes?: string[];
  count?: string;
}
export interface MissionResult {
  success: boolean; title: string; score: number; stars: number; credits: number; xp: number; message: string; time: number;
  lines: { label: string; value: string }[]; bestKey?: string; bestTime?: number; kills?: number; rescues?: number;
}
export interface Services {
  notify(text: string, tone?: 'info' | 'good' | 'bad'): void;
  sfx(name: 'checkpoint' | 'chime' | 'fail' | 'beep' | 'winch' | 'explosion'): void;
  setPayload(kg: number): void;
  freeze(f: boolean): void;
}
export interface PlayerInfo { st: FlightState; spec: AircraftSpec; heading: number; gs: number; touchdown: Touchdown | null; turb: number }

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
export { fmtTime };

interface LandTD { sink: number; thr: number; off: number; speed: number; gear: boolean; onRwy: boolean }

export class MissionRunner {
  def: MissionDef;
  spec: AircraftSpec;
  sv: Services;
  markers: Marker[] = [];
  targets: Target[] = [];
  hud: MissionHud;
  result: MissionResult | null = null;
  waypoints: { x: number; z: number; label: string; kind: string }[] = [];
  time = 0;
  stage = 'start';
  kills = 0;
  shots = 0;
  hits = 0;
  rescued = 0;
  private stageT = 0;
  private td: LandTD | null = null;
  private stoppedT = 0;
  private comfort = 100;
  private payloadKg = 0;
  private progress = 0;
  private victimIdx = 0;
  private gateIdx = 0;
  private lastPos = new THREE.Vector3();
  private countdown = 3.5;
  private gateTimes: number[] = [];
  private tlimit = 0;
  private noteTimer = 0;
  private landAp: Airport | null = null;
  private nextTargetId = 1;
  private onboard = 0;
  private gearWarned = false;

  constructor(def: MissionDef, spec: AircraftSpec, sv: Services) {
    this.def = def;
    this.spec = spec;
    this.sv = sv;
    this.hud = { title: def.title, objective: '' };
    this.setup();
  }

  private setup() {
    const d = this.def;
    switch (d.kind) {
      case 'landing': {
        this.landAp = getAirport(d.landing!.airport);
        this.stage = 'approach';
        this.addGlideGates(this.landAp);
        this.beam('land', this.landAp.x, this.landAp.elev, this.landAp.z, 0x34d399);
        break;
      }
      case 'transport': {
        const t = d.transport!;
        this.landAp = getAirport(t.to);
        this.stage = 'load';
        this.beam('dest', this.landAp.x, this.landAp.elev, this.landAp.z, 0xa78bfa).active = false;
        this.waypoints.push({ x: this.landAp.x, z: this.landAp.z, label: this.landAp.icao, kind: 'dest' });
        break;
      }
      case 'rescue': {
        this.stage = 'victim';
        const r = d.rescue!;
        r.victims.forEach((v, i) => {
          const y = Math.max(terrainHeight(v.x, v.z), 0);
          this.beam('v' + i, v.x, y, v.z, 0xff4d4d).active = i === 0;
          this.waypoints.push({ x: v.x, z: v.z, label: v.label, kind: 'victim' });
        });
        const hp = getHelipad(r.hospital);
        this.beam('hosp', hp.x, hp.elev, hp.z, 0x22d3ee).active = false;
        this.tlimit = r.timeLimit;
        break;
      }
      case 'strike': {
        this.stage = 'engage';
        const s = d.strike!;
        for (const t of s.targets) this.spawnTarget(t.type, t.x, t.z, t.alt);
        this.landAp = getAirport(s.base);
        this.tlimit = 1100;
        break;
      }
      case 'trial': {
        const c = TRIALS[d.trial!.course];
        this.stage = 'countdown';
        c.gates.forEach((g, i) => {
          const y = this.gateY(g);
          const prev = i === 0 ? c.start : { x: c.gates[i - 1][0], z: c.gates[i - 1][1] };
          const yaw = Math.atan2(g[0] - prev.x, -(g[1] - prev.z));
          this.markers.push({ id: 'g' + i, kind: 'ring', x: g[0], y, z: g[1], r: 85, color: 0x22d3ee, active: i === 0, yaw, dim: false });
          this.waypoints.push({ x: g[0], z: g[1], label: '' + (i + 1), kind: 'gate' });
        });
        this.sv.freeze(true);
        break;
      }
      default: break;
    }
  }

  private gateY(g: [number, number, number]) {
    return Math.max(terrainHeight(g[0], g[1]), 0) + g[2] + (terrainHeight(g[0], g[1]) < 0 ? 60 : 0);
  }

  private beam(id: string, x: number, y: number, z: number, color: number): Marker {
    const m: Marker = { id, kind: 'beam', x, y, z, r: 40, color, active: true, yaw: 0 };
    this.markers.push(m);
    return m;
  }

  private addGlideGates(ap: Airport) {
    const dists = [7000, 5200, 3600, 2300, 1300];
    dists.forEach((dd, i) => {
      const x = ap.x - ap.fwd.x * (ap.length / 2 + dd - 300);
      const z = ap.z - ap.fwd.z * (ap.length / 2 + dd - 300);
      const y = ap.elev + Math.tan((3 * Math.PI) / 180) * (dd + 300) + 6;
      this.markers.push({ id: 'ag' + i, kind: 'ring', x, y, z, r: 70, color: 0x34d399, active: true, yaw: ap.heading, dim: true });
    });
  }

  private spawnTarget(type: Target['type'], x: number, z: number, alt?: number) {
    const gy = Math.max(terrainHeight(x, z), 0);
    const y = type === 'drone' ? (alt ?? 2000) : type === 'ship' ? 2 : gy + 4;
    const hp = type === 'drone' ? 26 : type === 'ship' ? 90 : 40;
    const heading = Math.random() * Math.PI * 2;
    const sp = type === 'drone' ? 150 : type === 'ship' ? 8 : 0;
    this.targets.push({
      id: this.nextTargetId++, type, pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(Math.sin(heading) * sp, 0, -Math.cos(heading) * sp), hp, maxHp: hp,
      radius: type === 'drone' ? 14 : type === 'ship' ? 40 : 18, alive: true, heading, timer: 2 + Math.random() * 3, turn: (Math.random() < 0.5 ? -1 : 1) * 0.3, center: new THREE.Vector3(x, y, z),
    });
  }

  damageTarget(t: Target, dmg: number) {
    if (!t.alive) return false;
    t.hp -= dmg;
    this.hits++;
    if (t.hp <= 0) {
      t.alive = false;
      this.kills++;
      this.sv.sfx('explosion');
      this.sv.notify(`Target destroyed (${this.kills}/${this.targets.length})`, 'good');
      return true;
    }
    return false;
  }

  /* ---------------- landing helper ---------------- */
  private trackLanding(P: PlayerInfo, ap: Airport, dt: number): 'none' | 'rolling' | 'done' {
    const st = P.st;
    if (P.touchdown && !this.td) {
      const tdn = P.touchdown;
      if (airportSdf(ap, tdn.x, tdn.z) < 200) {
        const { u, v } = airportLocal(ap, tdn.x, tdn.z);
        const dir = Math.sin(tdn.heading) * ap.fwd.x - Math.cos(tdn.heading) * ap.fwd.z >= 0 ? 1 : -1;
        const thr = dir > 0 ? u + ap.length / 2 : ap.length / 2 - u;
        const off = Math.abs(v);
        const heli = this.spec.cls === 'helicopter';
        this.td = { sink: tdn.sink, thr, off, speed: tdn.speed, gear: tdn.gearDown && (st.gear > 0.9 || !!this.spec.fixedGear), onRwy: heli ? airportSdf(ap, tdn.x, tdn.z) < 40 : off <= ap.width / 2 + 4 && thr > -40 && thr < ap.length + 40 };
        this.sv.notify(`Touchdown! ${Math.round(tdn.sink * 196.85)} fpm`, tdn.sink < 3 ? 'good' : 'bad');
      }
    }
    if (!this.td) return 'none';
    if (st.onGround && P.gs < 2.2) this.stoppedT += dt; else this.stoppedT = 0;
    if (this.stoppedT > 1.3) return 'done';
    return 'rolling';
  }

  private landingScore(P: PlayerInfo, ap: Airport): { score: number; lines: { label: string; value: string }[] } {
    const td = this.td!;
    const heli = this.spec.cls === 'helicopter';
    const lines: { label: string; value: string }[] = [];
    let s = 0;
    const sink = td.sink;
    const a = sink <= 1 ? 30 : sink <= 2 ? 24 : sink <= 3 ? 16 : sink <= 4.5 ? 8 : 0;
    lines.push({ label: 'Touchdown rate', value: `${Math.round(sink * 196.85)} fpm (+${a})` });
    s += a;
    const b = td.off <= 3 ? 25 : td.off <= 8 ? 18 : td.off <= 15 ? 10 : td.off <= 30 ? 4 : 0;
    const bb = heli ? (td.onRwy ? 25 : 8) : b;
    lines.push({ label: heli ? 'Pad accuracy' : 'Centerline offset', value: heli ? `+${bb}` : `${td.off.toFixed(1)} m (+${bb})` });
    s += bb;
    const c = heli ? 20 : td.thr >= 150 && td.thr <= 900 ? 20 : td.thr >= 60 && td.thr <= 1400 ? 12 : td.thr > 0 ? 4 : 0;
    lines.push({ label: heli ? 'Zone' : 'Touchdown point', value: heli ? '+20' : `${Math.round(td.thr)} m from threshold (+${c})` });
    s += c;
    const dsp = td.speed <= this.spec.vApp * 1.12 ? 10 : td.speed <= this.spec.vApp * 1.35 ? 6 : 0;
    lines.push({ label: 'Approach speed', value: `${Math.round(td.speed * 1.944)} kt (+${dsp})` });
    s += dsp;
    const onAp = airportSdf(ap, P.st.pos.x, P.st.pos.z) < 30;
    const stopPts = td.onRwy && onAp ? 15 : onAp ? 6 : 0;
    lines.push({ label: 'Stopped', value: stopPts ? `+${stopPts}` : 'off airport' });
    s += stopPts;
    if (!td.gear) { s *= 0.4; lines.push({ label: 'Gear-up landing', value: '×0.4' }); }
    const dmg = (100 - P.st.integrity) * 0.5;
    if (dmg > 1) lines.push({ label: 'Damage penalty', value: `-${Math.round(dmg)}` });
    s -= dmg;
    return { score: Math.round(clamp(s, 0, 100)), lines };
  }

  private finish(success: boolean, title: string, score: number, message: string, lines: { label: string; value: string }[], extra: Partial<MissionResult> = {}) {
    if (this.result) return;
    const stars = !success ? 0 : score >= 85 ? 3 : score >= 60 ? 2 : 1;
    const credits = success ? Math.round(this.def.reward * (0.4 + stars * 0.3)) : Math.round(this.def.reward * 0.05);
    const xp = success ? Math.round(this.def.reward * 0.12 * (1 + stars * 0.4)) : 5;
    this.result = { success, title, score, stars, credits, xp, message, time: this.time, lines, ...extra };
    this.sv.sfx(success ? 'chime' : 'fail');
  }

  fail(message: string, P: PlayerInfo) {
    void P;
    this.finish(false, 'Mission Failed', 0, message, [{ label: 'Time', value: fmtTime(this.time) }]);
  }

  /* ---------------- main update ---------------- */
  update(dt: number, P: PlayerInfo) {
    if (this.result) return;
    this.time += dt;
    this.stageT += dt;
    const st = P.st;
    if (st.crashed) { this.fail(st.crashReason || 'Aircraft destroyed', P); return; }
    switch (this.def.kind) {
      case 'landing': this.updateLanding(dt, P); break;
      case 'transport': this.updateTransport(dt, P); break;
      case 'rescue': this.updateRescue(dt, P); break;
      case 'strike': this.updateStrike(dt, P); break;
      case 'trial': this.updateTrial(dt, P); break;
      default:
        this.hud.objective = 'Free flight – explore the world';
        this.hud.sub = 'Land at any airport to refuel and repair';
    }
    this.lastPos.copy(st.pos);
  }

  private distTo(P: PlayerInfo, x: number, z: number) { return Math.hypot(P.st.pos.x - x, P.st.pos.z - z); }

  private updateLanding(dt: number, P: PlayerInfo) {
    const ap = this.landAp!;
    const st = P.st;
    const d = this.distTo(P, ap.x, ap.z);
    this.hud.target = { x: ap.x, y: ap.elev + 30, z: ap.z, label: `${ap.icao} RWY ${String(Math.round(ap.headingDeg / 10) || 36).padStart(2, '0')}` };
    this.hud.objective = this.td ? 'Brake and stop on the runway' : `Land at ${ap.name}`;
    this.hud.sub = this.td ? 'Come to a complete stop' : `${(d / 1000).toFixed(1)} km to go`;
    if (!this.td && !st.gearCmd && !this.spec.fixedGear && st.agl < 450 && d < 5500 && !this.gearWarned) {
      this.gearWarned = true;
      this.sv.notify('Lower the landing gear (G) and set flaps (F)', 'info');
    }
    if (this.def.landing?.engineOut) this.hud.notes = ['ENGINE OUT – glide to the runway'];
    for (const m of this.markers) {
      if (m.id.startsWith('ag')) {
        const dist = Math.hypot(st.pos.x - m.x, st.pos.z - m.z);
        if (dist < m.r * 1.2 && Math.abs(st.pos.y - m.y) < m.r) { if (m.active) { m.active = false; this.progress++; this.sv.sfx('checkpoint'); } }
      }
    }
    const r = this.trackLanding(P, ap, dt);
    if (r === 'done') {
      const { score, lines } = this.landingScore(P, ap);
      const ok = score >= 35 && airportSdf(ap, st.pos.x, st.pos.z) < 60;
      lines.push({ label: 'Glide gates', value: `${this.progress}/5` });
      const total = Math.min(100, score + this.progress * 2);
      this.finish(ok, ok ? 'Landing Complete' : 'Landing Failed', total, ok ? 'Smooth work – the tower is impressed.' : 'You did not land safely on the airport.', lines);
    }
    void dt;
  }

  private updateTransport(dt: number, P: PlayerInfo) {
    const t = this.def.transport!;
    const from = getAirport(t.from);
    const to = getAirport(t.to);
    const st = P.st;
    const cargo = t.cargo;
    const dist = this.distTo(P, to.x, to.z);
    const dest = this.markers.find((m) => m.id === 'dest')!;
    this.hud.meters = [{ label: cargo ? 'CARGO' : 'COMFORT', value: this.comfort / 100, color: this.comfort > 60 ? '#34d399' : this.comfort > 30 ? '#fbbf24' : '#f87171' }];
    switch (this.stage) {
      case 'load': {
        this.hud.objective = cargo ? 'Loading cargo…' : 'Boarding passengers…';
        this.hud.sub = `Hold still on the apron – then take off for ${to.name}`;
        if (st.onGround && P.gs < 1.5) this.progress += dt / 5; else this.progress = Math.max(0, this.progress - dt);
        this.hud.progress = { label: cargo ? 'LOADING' : 'BOARDING', value: this.progress, color: '#a78bfa' };
        if (this.progress >= 1) {
          this.progress = 0;
          this.payloadKg = cargo ? Math.round(this.spec.payloadMax * 0.85) : Math.min(this.spec.pax, 150) * 80;
          this.onboard = cargo ? 0 : Math.min(this.spec.pax, 150);
          this.sv.setPayload(this.payloadKg);
          this.sv.notify(cargo ? `${this.payloadKg} kg loaded` : `${this.onboard} passengers on board`, 'good');
          this.sv.sfx('chime');
          this.stage = 'takeoff';
          this.hud.progress = undefined;
        }
        break;
      }
      case 'takeoff': {
        this.hud.objective = 'Take off and climb';
        this.hud.sub = 'Rotate, gear up, climb above 150 m';
        if (!st.onGround && st.agl > 150) { this.stage = 'cruise'; dest.active = true; this.sv.notify(`Course set for ${to.icao}`, 'info'); }
        break;
      }
      case 'cruise': {
        this.hud.objective = `Fly to ${to.name}`;
        this.hud.sub = `${(dist / 1000).toFixed(1)} km`;
        this.hud.target = { x: to.x, y: to.elev + 40, z: to.z, label: to.icao };
        if (dist < 5000) { this.stage = 'land'; this.sv.notify('Approaching destination – prepare to land', 'info'); }
        break;
      }
      case 'land': {
        this.hud.target = { x: to.x, y: to.elev + 40, z: to.z, label: to.icao };
        this.hud.objective = this.td ? 'Brake and stop' : `Land at ${to.icao}`;
        this.hud.sub = this.td ? 'Stay on the ground until fully stopped' : `${(dist / 1000).toFixed(1)} km – gear down, flaps, land`;
        const r = this.trackLanding(P, to, dt);
        if (r === 'done') {
          this.stage = 'unload';
          this.stageT = 0;
          this.progress = 0;
        }
        break;
      }
      case 'unload': {
        this.hud.objective = cargo ? 'Unloading cargo…' : 'Passengers disembarking…';
        this.progress += dt / 4;
        this.hud.progress = { label: 'UNLOADING', value: this.progress, color: '#a78bfa' };
        if (this.progress >= 1) {
          const { score: ls, lines } = this.landingScore(P, to);
          const par = Math.hypot(to.x - from.x, to.z - from.z) / (this.spec.vCruise * 0.7) + 160;
          const timeScore = clamp(((par * 1.7 - this.time) / (par * 0.7)) * 100, 0, 100);
          const total = Math.round(this.comfort * 0.45 + ls * 0.35 + timeScore * 0.2);
          lines.unshift({ label: cargo ? 'Cargo integrity' : 'Passenger comfort', value: `${Math.round(this.comfort)}%` });
          lines.push({ label: 'Flight time', value: `${fmtTime(this.time)} (par ${fmtTime(par)})` });
          lines.push({ label: 'Time bonus', value: `${Math.round(timeScore)}` });
          const ok = this.td ? this.td.onRwy || airportSdf(to, st.pos.x, st.pos.z) < 60 : false;
          this.finish(ok, ok ? (cargo ? 'Cargo Delivered' : 'Passengers Delivered') : 'Delivery Failed', total, ok ? 'Delivery complete – the customer is satisfied.' : 'Landed away from the airport.', lines);
        }
        break;
      }
      default: break;
    }
    // comfort model
    if (this.stage === 'takeoff' || this.stage === 'cruise' || this.stage === 'land') {
      if (!st.onGround) {
        const ge = Math.abs(st.gLoad - 1);
        if (ge > 0.45) this.comfort -= (ge - 0.45) * 14 * dt * (cargo ? 0.8 : 1);
        const bank = Math.abs(Math.atan2(-new THREE.Vector3(1, 0, 0).applyQuaternion(st.quat).y, new THREE.Vector3(0, 1, 0).applyQuaternion(st.quat).y));
        if (bank > 0.7) this.comfort -= (bank - 0.7) * 5 * dt;
        if (P.turb > 0.3) this.comfort -= (P.turb - 0.3) * 1.6 * dt;
      }
      if (P.touchdown && P.touchdown.sink > 2.2) this.comfort -= (P.touchdown.sink - 2.2) * 10;
      if (st.integrity < 85) this.comfort -= (100 - st.integrity) * 0.01 * dt;
      this.comfort = clamp(this.comfort, 0, 100);
      if (this.comfort <= 0) this.finish(false, 'Mission Failed', 0, cargo ? 'The cargo was destroyed.' : 'The passengers are terrified – complaint filed.', [{ label: 'Time', value: fmtTime(this.time) }]);
    }
    if (st.fuel <= 0 && !st.onGround && this.stage !== 'unload') this.hud.notes = ['OUT OF FUEL'];
    void from;
  }

  private updateRescue(dt: number, P: PlayerInfo) {
    const r = this.def.rescue!;
    const st = P.st;
    const left = Math.max(0, this.tlimit - this.time);
    this.hud.timer = fmtTime(left);
    this.hud.count = `${this.rescued}/${r.victims.length} rescued`;
    if (left <= 0) { this.finish(false, 'Out of Time', 0, 'The window for rescue has closed.', [{ label: 'Rescued', value: `${this.rescued}/${r.victims.length}` }]); return; }
    if (this.stage === 'victim') {
      const v = r.victims[this.victimIdx];
      const gy = Math.max(terrainHeight(v.x, v.z), 0);
      const d = this.distTo(P, v.x, v.z);
      this.hud.objective = `Rescue ${v.label}`;
      this.hud.sub = d > 80 ? `${(d / 1000).toFixed(2)} km – fly to the beacon` : 'Hover low (< 45 m) and hold still to winch';
      this.hud.target = { x: v.x, y: gy + 30, z: v.z, label: v.label };
      const alt = st.pos.y - gy;
      const hs = Math.hypot(st.vel.x, st.vel.z);
      if (d < 55 && alt < 48 && alt > 3 && hs < 9 && Math.abs(st.vel.y) < 4) {
        this.progress += dt / 6;
        if (Math.floor(this.progress * 12) !== Math.floor((this.progress - dt / 6) * 12)) this.sv.sfx('winch');
      } else this.progress = Math.max(0, this.progress - dt / 3);
      this.hud.progress = { label: 'WINCHING', value: this.progress, color: '#f87171' };
      if (this.progress >= 1) {
        this.progress = 0;
        this.rescued++;
        this.markers.find((m) => m.id === 'v' + this.victimIdx)!.active = false;
        this.sv.notify(`${v.label} aboard!`, 'good');
        this.sv.sfx('chime');
        this.victimIdx++;
        if (this.victimIdx >= r.victims.length) {
          this.stage = 'hospital';
          this.markers.find((m) => m.id === 'hosp')!.active = true;
          this.hud.progress = undefined;
        } else this.markers.find((m) => m.id === 'v' + this.victimIdx)!.active = true;
      }
    } else if (this.stage === 'hospital') {
      const hp = getHelipad(r.hospital);
      const d = this.distTo(P, hp.x, hp.z);
      this.hud.objective = 'Deliver survivors to the hospital';
      this.hud.sub = d > 60 ? `${(d / 1000).toFixed(2)} km – land on the helipad` : 'Set down gently on the pad';
      this.hud.target = { x: hp.x, y: hp.elev + 30, z: hp.z, label: 'HOSPITAL' };
      if (st.onGround && d < 28 && P.gs < 2) this.progress += dt / 3; else this.progress = Math.max(0, this.progress - dt);
      this.hud.progress = this.progress > 0 ? { label: 'UNLOADING', value: this.progress, color: '#22d3ee' } : undefined;
      if (this.progress >= 1) {
        const timeScore = clamp((left / this.tlimit) * 100 * 1.2, 0, 100);
        const total = Math.round(timeScore * 0.5 + st.integrity * 0.3 + 20);
        this.finish(true, 'Everyone Saved!', total, 'All survivors were delivered safely to the hospital.', [
          { label: 'Rescued', value: `${this.rescued}/${r.victims.length}` }, { label: 'Time left', value: fmtTime(left) }, { label: 'Aircraft integrity', value: `${Math.round(st.integrity)}%` },
        ], { rescues: this.rescued });
      }
    }
  }

  private updateStrike(dt: number, P: PlayerInfo) {
    const s = this.def.strike!;
    const st = P.st;
    // update targets
    for (const t of this.targets) {
      if (!t.alive) continue;
      if (t.type === 'drone') {
        t.timer -= dt;
        const toP = new THREE.Vector3().subVectors(st.pos, t.pos);
        const near = toP.length() < 3500;
        if (t.timer <= 0) { t.turn = (Math.random() < 0.5 ? -1 : 1) * (near ? 0.9 : 0.3); t.timer = near ? 1.5 + Math.random() * 2 : 3 + Math.random() * 4; }
        t.heading += t.turn * dt;
        const away = Math.hypot(t.pos.x - t.center.x, t.pos.z - t.center.z);
        if (away > 4500) {
          const want = Math.atan2(t.center.x - t.pos.x, -(t.center.z - t.pos.z));
          let diff = want - t.heading;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          t.heading += clamp(diff, -0.5 * dt, 0.5 * dt) * 3;
        }
        const sp = near ? 190 : 150;
        t.vel.set(Math.sin(t.heading) * sp, Math.sin(this.time * 0.4 + t.id) * 25, -Math.cos(t.heading) * sp);
        t.pos.addScaledVector(t.vel, dt);
        if (t.pos.y < 600) t.pos.y = 600;
      } else if (t.type === 'ship') {
        t.heading += Math.sin(this.time * 0.05 + t.id) * 0.01 * dt;
        t.vel.set(Math.sin(t.heading) * 8, 0, -Math.cos(t.heading) * 8);
        t.pos.addScaledVector(t.vel, dt);
        t.pos.y = 2;
      }
    }
    const alive = this.targets.filter((t) => t.alive);
    this.waypoints = alive.map((t) => ({ x: t.pos.x, z: t.pos.z, label: t.type, kind: 'enemy' }));
    this.hud.count = `Targets ${this.kills}/${this.targets.length}`;
    const left = Math.max(0, this.tlimit - this.time);
    this.hud.timer = fmtTime(left);
    if (this.stage === 'engage') {
      let nearest: Target | null = null;
      let nd = Infinity;
      for (const t of alive) { const d = t.pos.distanceTo(st.pos); if (d < nd) { nd = d; nearest = t; } }
      this.hud.objective = 'Destroy all hostile targets';
      this.hud.sub = nearest ? `Nearest: ${nearest.type} – ${(nd / 1000).toFixed(1)} km  •  SPACE cannon  •  M missile` : '';
      this.hud.target = nearest ? { x: nearest.pos.x, y: nearest.pos.y, z: nearest.pos.z, label: nearest.type.toUpperCase() } : null;
      if (alive.length === 0) {
        if (s.rtb) {
          this.stage = 'rtb';
          this.sv.notify('All targets destroyed – return to base and land', 'good');
          this.beam('base', this.landAp!.x, this.landAp!.elev, this.landAp!.z, 0x34d399);
        } else this.completeStrike(P);
      }
      if (left <= 0) this.finish(false, 'Out of Time', 0, 'The mission window has closed.', [{ label: 'Kills', value: `${this.kills}/${this.targets.length}` }]);
    } else if (this.stage === 'rtb') {
      const ap = this.landAp!;
      this.hud.objective = `Return to ${ap.icao} and land`;
      this.hud.sub = `${(this.distTo(P, ap.x, ap.z) / 1000).toFixed(1)} km`;
      this.hud.target = { x: ap.x, y: ap.elev + 30, z: ap.z, label: ap.icao };
      this.hud.timer = undefined;
      const r = this.trackLanding(P, ap, dt);
      if (r === 'done') this.completeStrike(P);
    }
  }

  private completeStrike(P: PlayerInfo) {
    const s = this.def.strike!;
    const acc = this.shots > 0 ? this.hits / this.shots : 0;
    let land = 60;
    const lines: { label: string; value: string }[] = [];
    if (this.td && this.landAp) { const r = this.landingScore(P, this.landAp); land = r.score; }
    const timeScore = clamp(((this.tlimit - this.time) / this.tlimit) * 130, 0, 100);
    const total = Math.round(timeScore * 0.35 + Math.min(100, acc * 400) * 0.15 + P.st.integrity * 0.25 + land * 0.25);
    lines.push({ label: 'Targets destroyed', value: `${this.kills}/${this.targets.length}` });
    lines.push({ label: 'Gun accuracy', value: `${Math.round(acc * 100)}%` });
    lines.push({ label: 'Time', value: fmtTime(this.time) });
    lines.push({ label: 'Aircraft integrity', value: `${Math.round(P.st.integrity)}%` });
    if (s.rtb) lines.push({ label: 'Landing', value: `${land}` });
    this.finish(true, 'Mission Accomplished', total, 'Hostiles eliminated and the Falcon is back on the ground.', lines, { kills: this.kills });
  }

  private updateTrial(dt: number, P: PlayerInfo) {
    const c = TRIALS[this.def.trial!.course];
    const st = P.st;
    if (this.stage === 'countdown') {
      this.countdown -= dt;
      this.time = 0;
      const n = Math.ceil(this.countdown);
      this.hud.objective = n > 0 ? `${n}` : 'GO!';
      this.hud.sub = 'Fly through every ring as fast as you can';
      if (n !== this.noteTimer) { this.noteTimer = n; this.sv.sfx('beep'); }
      if (this.countdown <= 0) { this.stage = 'run'; this.sv.freeze(false); this.time = 0; this.sv.sfx('checkpoint'); }
      return;
    }
    const g = c.gates[this.gateIdx];
    const gy = this.gateY(g);
    this.hud.objective = `Gate ${this.gateIdx + 1}/${c.gates.length}`;
    this.hud.sub = `${Math.round(Math.hypot(st.pos.x - g[0], st.pos.z - g[1], st.pos.y - gy))} m`;
    this.hud.timer = fmtTime(this.time) + '.' + Math.floor((this.time % 1) * 10);
    this.hud.target = { x: g[0], y: gy, z: g[1], label: 'GATE' };
    // segment-sphere test
    const a = this.lastPos;
    const b = st.pos;
    const ab = new THREE.Vector3().subVectors(b, a);
    const center = new THREE.Vector3(g[0], gy, g[1]);
    const t = ab.lengthSq() > 1e-6 ? clamp(new THREE.Vector3().subVectors(center, a).dot(ab) / ab.lengthSq(), 0, 1) : 0;
    const closest = a.clone().addScaledVector(ab, t);
    if (closest.distanceTo(center) < 85 && this.lastPos.lengthSq() > 0) {
      this.gateTimes.push(this.time);
      this.markers[this.gateIdx].active = false;
      this.gateIdx++;
      this.sv.sfx('checkpoint');
      if (this.gateIdx >= c.gates.length) {
        const len = courseLength(c);
        const par = len / (this.spec.vCruise * 0.8);
        const medal = this.time <= par ? 'GOLD' : this.time <= par * 1.15 ? 'SILVER' : this.time <= par * 1.4 ? 'BRONZE' : 'FINISH';
        const stars = medal === 'GOLD' ? 3 : medal === 'SILVER' ? 2 : 1;
        const score = Math.round(clamp(100 - (this.time / par - 0.9) * 120, 20, 100));
        this.finish(true, `${medal} – Course Complete`, score, `${medal} medal for ${c.name}.`, [
          { label: 'Time', value: fmtTime(this.time) + '.' + Math.floor((this.time % 1) * 100).toString().padStart(2, '0') },
          { label: 'Par (gold)', value: fmtTime(par) },
          ...this.gateTimes.map((gt, i) => ({ label: `Gate ${i + 1}`, value: gt.toFixed(1) + ' s' })),
        ], { bestKey: `${c.id}:${this.spec.id}`, bestTime: this.time });
        if (this.result) this.result.stars = stars;
      } else {
        this.markers[this.gateIdx].active = true;
      }
    }
  }

  /** Call when the player stopped far outside the area etc. */
  abort(message: string, P: PlayerInfo) { this.fail(message, P); }
}

export function startPosition(def: MissionDef, spec: AircraftSpec) {
  const s = def.start;
  if ('airport' in s) {
    const ap = getAirport(s.airport);
    const heli = spec.cls === 'helicopter';
    if (heli) {
      // helicopters start on the apron beside the terminal
      const p = { x: ap.x + ap.right.x * 175 + ap.fwd.x * -70, z: ap.z + ap.right.z * 175 + ap.fwd.z * -70 };
      return { ground: true as const, x: p.x, z: p.z, y: ap.elev, heading: ap.heading, speed: 0, gear: true, ap };
    }
    const u = -(ap.length / 2 - Math.min(140, ap.length * 0.08));
    return { ground: true as const, x: ap.x + ap.fwd.x * u, z: ap.z + ap.fwd.z * u, y: ap.elev, heading: ap.heading, speed: 0, gear: true, ap };
  }
  if ('air' in s) {
    const a = s.air;
    const ap = getAirport(a.airport);
    const heli = spec.cls === 'helicopter';
    const dist = heli ? Math.min(a.dist, 2500) : a.dist;
    const bearing = a.bearing !== undefined ? (a.bearing * Math.PI) / 180 : ap.heading + Math.PI; // from airport to plane
    const dirx = Math.sin(bearing);
    const dirz = -Math.cos(bearing);
    let x = ap.x + dirx * dist;
    let z = ap.z + dirz * dist;
    if (a.bearing === undefined) { x = ap.x - ap.fwd.x * (ap.length / 2 + dist); z = ap.z - ap.fwd.z * (ap.length / 2 + dist); }
    const heading = Math.atan2(ap.x - x, -(ap.z - z));
    const slope = Math.tan((3 * Math.PI) / 180) * dist;
    const y = Math.max(terrainHeight(x, z), ap.elev) + (a.agl > 500 ? a.agl : Math.max(slope + a.agl, heli ? 150 : 150));
    return { ground: false as const, x, z, y, heading, speed: heli ? 30 : spec.vApp * (a.speedK ?? 1.15), gear: a.gear ?? false, ap };
  }
  const p = s.pos;
  const y = Math.max(terrainHeight(p.x, p.z), 0) + p.agl;
  return { ground: false as const, x: p.x, z: p.z, y, heading: p.heading, speed: Math.max(p.speed, spec.vApp * 1.4), gear: false, ap: AIRPORTS[0] };
}
