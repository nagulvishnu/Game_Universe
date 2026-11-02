// Aircraft specifications: each type has its own handling / performance numbers.

export type AircraftClass = 'airliner' | 'fighter' | 'cargo' | 'business' | 'helicopter' | 'prop';

export interface WheelDef { x: number; y: number; z: number; kind: 'nose' | 'main' | 'skid' }
export interface Pt { x: number; y: number; z: number }

export interface AircraftSpec {
  id: string;
  name: string;
  maker: string;
  cls: AircraftClass;
  blurb: string;
  role: string;
  length: number;
  span: number;
  pax: number;
  // mass (kg)
  mass: number;
  fuelCap: number;
  burn: number; // kg/s at full power
  payloadMax: number;
  // aero
  S: number;
  CLa: number;
  CL0: number;
  alphaStall: number;
  CD0: number;
  k: number;
  CYb: number;
  flapCL: number;
  flapCD: number;
  flapLevels: number;
  gearCD: number;
  airbrakeCD: number;
  fixedGear?: boolean;
  // propulsion
  thrust: number;
  thrustKind: 'jet' | 'prop' | 'heli';
  vPropMax: number;
  spool: number;
  hasAB: boolean;
  // speeds (m/s)
  vRef: number;
  vApp: number;
  vRotate: number;
  vne: number;
  vCruise: number;
  ceiling: number;
  // control
  pitchStab: number;
  pitchDamp: number;
  pitchUp: number;
  pitchDown: number;
  rollRate: number;
  rollResp: number;
  yawAuth: number;
  yawStab: number;
  yawDamp: number;
  dihedral: number;
  gMax: number;
  maxSink: number;
  crashSink: number;
  brake: number;
  heliTilt: number;
  // geometry
  wheels: WheelDef[];
  hard: Pt[];
  cockpit: Pt;
  chase: { dist: number; height: number };
  ratings: { speed: number; agility: number; cargo: number; range: number; ease: number };
}

export const AIRCRAFT: AircraftSpec[] = [
  {
    id: 'liner320', name: 'Skyliner 320', maker: 'Aerowing', cls: 'airliner', role: 'Commercial Passenger Airliner',
    blurb: 'Twin-engine narrow-body airliner. Stable, forgiving and heavy – built for smooth passenger service.',
    length: 37.5, span: 34, pax: 150, mass: 42000, fuelCap: 9000, burn: 3.2, payloadMax: 12000,
    S: 122, CLa: 5.2, CL0: 0.12, alphaStall: 0.28, CD0: 0.024, k: 0.042, CYb: 0.9,
    flapCL: 0.95, flapCD: 0.075, flapLevels: 3, gearCD: 0.022, airbrakeCD: 0.045,
    thrust: 145000, thrustKind: 'jet', vPropMax: 0, spool: 1.5, hasAB: false,
    vRef: 105, vApp: 72, vRotate: 76, vne: 240, vCruise: 225, ceiling: 12000,
    pitchStab: 5.5, pitchDamp: 3.4, pitchUp: 0.17, pitchDown: 0.1,
    rollRate: 0.7, rollResp: 2.6, yawAuth: 0.5, yawStab: 1.3, yawDamp: 1.3, dihedral: 0.5,
    gMax: 2.6, maxSink: 3.6, crashSink: 7.5, brake: 0.55, heliTilt: 0,
    wheels: [
      { x: 0, y: -3.6, z: -12.5, kind: 'nose' },
      { x: -3.8, y: -3.6, z: 1.0, kind: 'main' },
      { x: 3.8, y: -3.6, z: 1.0, kind: 'main' },
    ],
    hard: [
      { x: 0, y: -2, z: -7 }, { x: 0, y: -2, z: 8 }, { x: 0, y: 0.6, z: 18.5 }, { x: -17, y: 0.8, z: 4 }, { x: 17, y: 0.8, z: 4 },
      { x: 0, y: 0, z: -18.6 }, { x: -5.8, y: -3.3, z: -3.5 }, { x: 5.8, y: -3.3, z: -3.5 },
    ],
    cockpit: { x: 0, y: 1.0, z: -16.3 }, chase: { dist: 52, height: 13 },
    ratings: { speed: 7, agility: 3, cargo: 7, range: 8, ease: 8 },
  },
  {
    id: 'falcon22', name: 'Falcon X-22', maker: 'Vanguard Dynamics', cls: 'fighter', role: 'Supersonic Fighter Jet',
    blurb: 'Afterburning multirole fighter with fly-by-wire agility, 9G airframe, cannon and homing missiles.',
    length: 17, span: 11, pax: 1, mass: 9000, fuelCap: 3500, burn: 5.5, payloadMax: 0,
    S: 40, CLa: 4.2, CL0: 0.05, alphaStall: 0.5, CD0: 0.018, k: 0.11, CYb: 0.8,
    flapCL: 0.4, flapCD: 0.04, flapLevels: 2, gearCD: 0.02, airbrakeCD: 0.09,
    thrust: 120000, thrustKind: 'jet', vPropMax: 0, spool: 0.7, hasAB: true,
    vRef: 175, vApp: 78, vRotate: 72, vne: 400, vCruise: 290, ceiling: 18000,
    pitchStab: 13, pitchDamp: 6.5, pitchUp: 0.45, pitchDown: 0.28,
    rollRate: 3.4, rollResp: 8, yawAuth: 1.3, yawStab: 5, yawDamp: 3, dihedral: 0.4,
    gMax: 9, maxSink: 5, crashSink: 9.5, brake: 0.6, heliTilt: 0,
    wheels: [
      { x: 0, y: -2.05, z: -5.0, kind: 'nose' },
      { x: -1.5, y: -2.05, z: 1.8, kind: 'main' },
      { x: 1.5, y: -2.05, z: 1.8, kind: 'main' },
    ],
    hard: [
      { x: 0, y: -0.9, z: -1 }, { x: 0, y: 0.2, z: 8.6 }, { x: -5.5, y: -0.2, z: 3.5 }, { x: 5.5, y: -0.2, z: 3.5 },
      { x: 0, y: 0, z: -8.5 }, { x: -1.4, y: 1.8, z: 6 }, { x: 1.4, y: 1.8, z: 6 },
    ],
    cockpit: { x: 0, y: 0.78, z: -3.3 }, chase: { dist: 30, height: 6.5 },
    ratings: { speed: 10, agility: 10, cargo: 0, range: 4, ease: 4 },
  },
  {
    id: 'titan90', name: 'Titan C-90', maker: 'Heavyline Aerospace', cls: 'cargo', role: 'Heavy Cargo Freighter',
    blurb: 'Four-engine high-wing freighter. Huge payload, long take-off roll and ponderous handling – plan ahead.',
    length: 44, span: 46, pax: 0, mass: 62000, fuelCap: 12000, burn: 4.2, payloadMax: 30000,
    S: 190, CLa: 5.0, CL0: 0.14, alphaStall: 0.27, CD0: 0.028, k: 0.05, CYb: 1.0,
    flapCL: 1.0, flapCD: 0.085, flapLevels: 3, gearCD: 0.03, airbrakeCD: 0.05,
    thrust: 300000, thrustKind: 'jet', vPropMax: 0, spool: 1.9, hasAB: false,
    vRef: 100, vApp: 70, vRotate: 80, vne: 215, vCruise: 200, ceiling: 10500,
    pitchStab: 4.3, pitchDamp: 3.2, pitchUp: 0.15, pitchDown: 0.09,
    rollRate: 0.5, rollResp: 1.9, yawAuth: 0.38, yawStab: 1.0, yawDamp: 1.2, dihedral: 0.4,
    gMax: 2.4, maxSink: 3.2, crashSink: 7, brake: 0.5, heliTilt: 0,
    wheels: [
      { x: 0, y: -4.6, z: -15.5, kind: 'nose' },
      { x: -3.4, y: -4.6, z: 3.0, kind: 'main' },
      { x: 3.4, y: -4.6, z: 3.0, kind: 'main' },
    ],
    hard: [
      { x: 0, y: -2.9, z: -8 }, { x: 0, y: -2.2, z: 12 }, { x: 0, y: 1, z: 22 }, { x: -23, y: 2.5, z: 2.5 }, { x: 23, y: 2.5, z: 2.5 },
      { x: 0, y: 0, z: -22 }, { x: -13.5, y: -0.6, z: -6 }, { x: 13.5, y: -0.6, z: -6 },
    ],
    cockpit: { x: 0, y: 1.9, z: -19.5 }, chase: { dist: 62, height: 15 },
    ratings: { speed: 6, agility: 2, cargo: 10, range: 8, ease: 5 },
  },
  {
    id: 'lynx45', name: 'Lynx LJ-45', maker: 'Meridian Jets', cls: 'business', role: 'Private Business Jet',
    blurb: 'Sleek rear-engine light jet. Quick, responsive and efficient – the executive\'s choice.',
    length: 17.5, span: 16, pax: 8, mass: 5500, fuelCap: 2000, burn: 0.9, payloadMax: 1200,
    S: 32, CLa: 5.0, CL0: 0.12, alphaStall: 0.3, CD0: 0.022, k: 0.04, CYb: 0.85,
    flapCL: 0.8, flapCD: 0.06, flapLevels: 3, gearCD: 0.02, airbrakeCD: 0.05,
    thrust: 29000, thrustKind: 'jet', vPropMax: 0, spool: 1.0, hasAB: false,
    vRef: 90, vApp: 60, vRotate: 60, vne: 235, vCruise: 215, ceiling: 13700,
    pitchStab: 6.5, pitchDamp: 3.6, pitchUp: 0.2, pitchDown: 0.13,
    rollRate: 1.3, rollResp: 4.2, yawAuth: 0.7, yawStab: 1.8, yawDamp: 1.5, dihedral: 0.5,
    gMax: 3.6, maxSink: 4, crashSink: 8, brake: 0.55, heliTilt: 0,
    wheels: [
      { x: 0, y: -1.95, z: -5.5, kind: 'nose' },
      { x: -1.5, y: -1.95, z: 0.8, kind: 'main' },
      { x: 1.5, y: -1.95, z: 0.8, kind: 'main' },
    ],
    hard: [
      { x: 0, y: -0.95, z: -2 }, { x: 0, y: -0.9, z: 4 }, { x: 0, y: 0.4, z: 8.7 }, { x: -8, y: 0.2, z: 1.5 }, { x: 8, y: 0.2, z: 1.5 },
      { x: 0, y: 0, z: -8.7 }, { x: -1.6, y: 0.2, z: 5 }, { x: 1.6, y: 0.2, z: 5 },
    ],
    cockpit: { x: 0, y: 0.55, z: -6.2 }, chase: { dist: 27, height: 6 },
    ratings: { speed: 8, agility: 6, cargo: 3, range: 6, ease: 7 },
  },
  {
    id: 'hawk60', name: 'Hawk H-60', maker: 'Rotorcraft Works', cls: 'helicopter', role: 'Utility / Rescue Helicopter',
    blurb: 'Twin-turbine utility helicopter. Hover, land anywhere, winch rescue – the master of tight spaces.',
    length: 15, span: 14, pax: 6, mass: 3600, fuelCap: 900, burn: 0.38, payloadMax: 1800,
    S: 10, CLa: 0, CL0: 0, alphaStall: 1, CD0: 0, k: 0, CYb: 0,
    flapCL: 0, flapCD: 0, flapLevels: 0, gearCD: 0, airbrakeCD: 0, fixedGear: true,
    thrust: 78000, thrustKind: 'heli', vPropMax: 0, spool: 1.2, hasAB: false,
    vRef: 40, vApp: 20, vRotate: 0, vne: 80, vCruise: 58, ceiling: 5500,
    pitchStab: 0, pitchDamp: 0, pitchUp: 0, pitchDown: 0,
    rollRate: 0, rollResp: 0, yawAuth: 1.6, yawStab: 0, yawDamp: 0, dihedral: 0,
    gMax: 3.2, maxSink: 3.5, crashSink: 7, brake: 0.7, heliTilt: 0.5,
    wheels: [
      { x: -1.25, y: -1.6, z: -1.5, kind: 'skid' }, { x: 1.25, y: -1.6, z: -1.5, kind: 'skid' },
      { x: -1.25, y: -1.6, z: 1.5, kind: 'skid' }, { x: 1.25, y: -1.6, z: 1.5, kind: 'skid' },
    ],
    hard: [{ x: 0, y: 0.5, z: 8.4 }, { x: 0, y: -0.6, z: -3.4 }, { x: 0, y: 1.8, z: 0 }],
    cockpit: { x: 0, y: 0.55, z: -2.0 }, chase: { dist: 24, height: 5.5 },
    ratings: { speed: 3, agility: 8, cargo: 4, range: 3, ease: 5 },
  },
  {
    id: 'sparrow172', name: 'Sparrow S-172', maker: 'Cloudcraft', cls: 'prop', role: 'Light Propeller Plane',
    blurb: 'Classic high-wing trainer. Slow, gentle and a joy to fly low over islands – perfect to learn the ropes.',
    length: 8.3, span: 11, pax: 3, mass: 780, fuelCap: 150, burn: 0.034, payloadMax: 260,
    S: 16.2, CLa: 4.8, CL0: 0.2, alphaStall: 0.27, CD0: 0.03, k: 0.062, CYb: 0.7,
    flapCL: 0.6, flapCD: 0.05, flapLevels: 3, gearCD: 0.0, airbrakeCD: 0.02, fixedGear: true,
    thrust: 3300, thrustKind: 'prop', vPropMax: 100, spool: 0.5, hasAB: false,
    vRef: 42, vApp: 37, vRotate: 27, vne: 85, vCruise: 58, ceiling: 4600,
    pitchStab: 5, pitchDamp: 3.0, pitchUp: 0.2, pitchDown: 0.14,
    rollRate: 1.5, rollResp: 4.5, yawAuth: 0.7, yawStab: 1.6, yawDamp: 1.3, dihedral: 0.6,
    gMax: 4.4, maxSink: 3.6, crashSink: 6.5, brake: 0.45, heliTilt: 0,
    wheels: [
      { x: 0, y: -1.45, z: -1.9, kind: 'nose' },
      { x: -1.15, y: -1.45, z: 0.5, kind: 'main' },
      { x: 1.15, y: -1.45, z: 0.5, kind: 'main' },
    ],
    hard: [
      { x: 0, y: -0.6, z: 0 }, { x: 0, y: 0.2, z: 4.1 }, { x: -5.4, y: 0.9, z: -1 }, { x: 5.4, y: 0.9, z: -1 }, { x: 0, y: 0, z: -3.9 },
    ],
    cockpit: { x: 0, y: 0.5, z: -0.5 }, chase: { dist: 15, height: 3.6 },
    ratings: { speed: 2, agility: 7, cargo: 1, range: 3, ease: 10 },
  },
];

export const getAircraft = (id: string) => AIRCRAFT.find((a) => a.id === id) ?? AIRCRAFT[0];

export interface Livery { name: string; primary: number; secondary: number; accent: number }
export const LIVERIES: Livery[] = [
  { name: 'Arctic', primary: 0xf2f5f8, secondary: 0x2c3e55, accent: 0x1e88e5 },
  { name: 'Sunset', primary: 0xf5efe6, secondary: 0x3a2a2a, accent: 0xff6b2c },
  { name: 'Emerald', primary: 0xeaf4ee, secondary: 0x1d3b2f, accent: 0x1fbf75 },
  { name: 'Crimson', primary: 0xe9e9ee, secondary: 0x2b2b33, accent: 0xe53935 },
  { name: 'Stealth', primary: 0x4a5058, secondary: 0x22252a, accent: 0x9aa6b2 },
  { name: 'Royal', primary: 0x20366b, secondary: 0xe6e9f0, accent: 0xffc107 },
];

export const AIRCRAFT_CLASS_LABEL: Record<AircraftClass, string> = {
  airliner: 'Airliner', fighter: 'Fighter', cargo: 'Cargo', business: 'Private Jet', helicopter: 'Helicopter', prop: 'Prop Plane',
};
