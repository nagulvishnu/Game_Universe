// Game entry metadata – consumed by the host "Game Universe" site (also mirrored in public/game.json).
export const GAME_META = {
  id: 'skybound-flight-simulator',
  title: 'SKYBOUND: Flight Simulator',
  version: '1.0.0',
  genre: 'Simulation / Flight',
  engine: 'three.js + React + TypeScript',
  description:
    'A 3D browser flight simulator: fly airliners, fighters, cargo planes, private jets, helicopters and prop planes across a large world with day/night cycles, storms, missions and career progression.',
  entry: 'index.html',
  inputs: ['keyboard', 'mouse', 'gamepad'],
  messageSource: 'skybound',
  storageKey: 'skybound.flightsim.save.v1',
} as const;
