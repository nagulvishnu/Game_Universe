export type Cat = 'elemental' | 'cosmic' | 'reality' | 'physical' | 'creation' | 'summoning' | 'destruction';
export interface CatDef { id: Cat; name: string; color: string; icon: string }
export const CATS: CatDef[] = [
  { id: 'elemental', name: 'Elemental', color: '#ff7a3d', icon: 'Flame' },
  { id: 'cosmic', name: 'Cosmic', color: '#a96bff', icon: 'Orbit' },
  { id: 'reality', name: 'Reality', color: '#4de1ff', icon: 'CircleDot' },
  { id: 'physical', name: 'Physical', color: '#ffd24d', icon: 'Dumbbell' },
  { id: 'creation', name: 'Creation', color: '#5dff9a', icon: 'Sparkles' },
  { id: 'summoning', name: 'Summoning', color: '#bb82ff', icon: 'Sparkles' },
  { id: 'destruction', name: 'Destruction', color: '#ff4d6a', icon: 'Skull' },
];

export type PowerMode = 'click' | 'hold' | 'toggle' | 'charge';
export interface PowerDef {
  id: string; name: string; cat: Cat; icon: string; color: string;
  desc: string; hint: string; mode: PowerMode;
}
const P = (id: string, name: string, cat: Cat, icon: string, color: string, mode: PowerMode, hint: string, desc: string): PowerDef =>
  ({ id, name, cat, icon, color, mode, hint, desc });

export const POWERS: PowerDef[] = [
  // ELEMENTAL
  P('fire', 'Inferno Stream', 'elemental', 'Flame', '#ff7a2a', 'hold', 'Hold LMB', 'Unleash a river of divine fire. Ignites trees, melts vehicles, sets people ablaze and chars the ground.'),
  P('lightning', 'Lightning Bolt', 'elemental', 'Zap', '#9fd8ff', 'hold', 'Click / Hold', 'Call bolts from the heavens. Chains between living things, shatters buildings, ignites forests.'),
  P('ice', 'Absolute Zero', 'elemental', 'Snowflake', '#a8f0ff', 'hold', 'Hold LMB', 'Freeze everything in a frost cone. Frozen beings are encased in ice and shatter on impact.'),
  P('tsunami', 'Tidal Wave', 'elemental', 'Waves', '#2fb8ff', 'click', 'Click', 'Raise a colossal wall of water that sweeps across land, tearing through streets and structures.'),
  P('tornado', 'Tornado', 'elemental', 'Tornado', '#c9c2b0', 'click', 'Click', 'Spawn a roaming tornado that lifts vehicles, people, trees and debris and rips buildings apart.'),
  P('quake', 'Earthquake', 'elemental', 'Mountain', '#c28a4a', 'click', 'Click', 'Split the earth. Fissures open, the ground shakes and weakened buildings collapse.'),
  P('wind', 'Hurricane Gust', 'elemental', 'Wind', '#d7f3ff', 'hold', 'Hold LMB', 'Blast a violent gale that sweeps everything in a wide cone off its feet and across the land.'),
  P('storm', 'Thunderstorm', 'elemental', 'CloudLightning', '#8aa4ff', 'toggle', 'Click', 'Command the sky: summons a violent thunderstorm that strikes the land around you. Click again to calm it.'),
  // COSMIC
  P('blackhole', 'Black Hole', 'cosmic', 'Aperture', '#b06bff', 'click', 'Click', 'Open a singularity. It devours matter, buildings and light, then evaporates in a violent burst.'),
  P('gravity', 'Gravity Field', 'cosmic', 'Orbit', '#7a8bff', 'click', 'Click', 'Create a zero-gravity sphere. Everything inside floats, spins and drifts while the field lasts.'),
  P('meteor', 'Meteor Shower', 'cosmic', 'Rocket', '#ff9a3a', 'hold', 'Click / Hold', 'Pull burning rocks from orbit down onto the target. Craters, fire and devastation.'),
  P('nova', 'Supernova Blast', 'cosmic', 'Sun', '#ffe27a', 'charge', 'Hold & Release', 'Charge a star in your hands and release it. Longer charge means a bigger explosion.'),
  P('planet', 'Planet Destroyer', 'cosmic', 'Globe', '#ff5a5a', 'click', 'Aim at planet', 'In space: shatter the planet you aim at. On the surface: rupture the world with a cataclysmic wave.'),
  P('beam', 'Cosmic Beam', 'cosmic', 'Radiation', '#5ad1ff', 'hold', 'Hold LMB', 'A continuous beam of pure cosmic energy that carves through anything in its path.'),
  P('laser_eyes', 'Abyssal Eye Beams', 'cosmic', 'Eye', '#ff526e', 'hold', 'Hold LMB', 'Fire focused red beams from your eyes. Sweep across the skyline to cut through buildings and targets.'),
  P('divine_beam', 'Divine Energy Wave', 'cosmic', 'Orbit', '#83eeff', 'hold', 'Hold LMB', 'Unleash a massive continuous wave of divine energy that tears through structures and targets along its path.'),
  // REALITY
  P('freeze', 'Time Freeze', 'reality', 'Pause', '#7de8ff', 'toggle', 'Click / Z', 'Stop time for the whole world. Only you can move. Click again to resume.'),
  P('rewind', 'Time Reversal', 'reality', 'Rewind', '#ffb86b', 'toggle', 'Click / X', 'Rewind the last seconds: destroyed buildings reassemble, people and vehicles retrace their steps.'),
  P('accel', 'Time Acceleration', 'reality', 'FastForward', '#ffd86b', 'toggle', 'Click', 'Speed time up 6x. Days fly by, traffic races and the whole civilization blurs.'),
  P('teleport', 'Teleportation', 'reality', 'Navigation', '#6bffd8', 'click', 'Click / T', 'Blink instantly to the point you are aiming at, anywhere in the world.'),
  P('portal', 'Dimensional Portal', 'reality', 'CircleDot', '#ff8a3d', 'click', 'Click x2', 'Place two linked gateways. Everything — you, people, vehicles — can step through.'),
  P('matter', 'Matter Manipulation', 'reality', 'Atom', '#ffd24d', 'hold', 'Hold LMB', 'Transmute matter: buildings turn to gold crystal, people to golden statues, ground to crystal.'),
  P('distort', 'Reality Distortion', 'reality', 'Shapes', '#ff6bd8', 'click', 'Click', 'Warp a region: gravity inverts, sizes fluctuate and the fabric of space tears.'),
  // PHYSICAL
  P('strength', 'Titan Strength', 'physical', 'Dumbbell', '#ffb13d', 'click', 'Click', 'Throw an unstoppable punch. Shatters anything it connects with and launches whatever is nearby.'),
  P('speed', 'Super Speed', 'physical', 'Gauge', '#ffe24d', 'click', 'Click cycles', 'Cycle movement speed: Normal → Super → Light Speed → Cosmic. Leave sonic booms in your wake.'),
  P('flight', 'Unlimited Flight', 'physical', 'Feather', '#8ae0ff', 'click', 'Click / F', 'Toggle free flight. Soar, dive, hover and cross the globe in seconds.'),
  P('telekinesis', 'Telekinesis', 'physical', 'Hand', '#d68bff', 'hold', 'Hold LMB', 'Grab people, vehicles, debris — even tear chunks off buildings — hold them, then fling them.'),
  P('jump', 'Super Jump', 'physical', 'ArrowUpFromLine', '#6bff9a', 'click', 'Click', 'Launch into the sky. Landing from height slams the ground with a shockwave.'),
  P('shield', 'Invulnerability', 'physical', 'Shield', '#6bd0ff', 'toggle', 'Click', 'You are indestructible by default. Toggle to become mortal and feel the power of your own attacks.'),
  P('divine_bolt', 'Divine Bolt', 'physical', 'Zap', '#fff1a8', 'click', 'Click', 'Call down a precise divine lightning strike on your target.'),
  P('divine_guard', 'Divine Guard', 'physical', 'ShieldCheck', '#78dcff', 'toggle', 'Click', 'Toggle a protective divine ward that makes you invulnerable.'),
  P('divine_dash', 'Divine Dash', 'physical', 'Wind', '#9affd6', 'click', 'Click', 'Blink a short distance forward to evade danger or cross the world faster.'),
  P('shadow_dragon', 'Shadow Dragon', 'summoning', 'PawPrint', '#b58aff', 'click', 'Summon / breath', 'Summon and ride a shadow dragon. While riding, click again to unleash a destructive breath at your target; press G to dismount.'),
  P('attract', 'Attraction Field', 'physical', 'Magnet', '#ff6b9a', 'hold', 'Hold LMB', 'Pull objects, vehicles and people toward you in a magnetic vortex.'),
  P('repel', 'Repulsion Blast', 'physical', 'Maximize', '#6b9aff', 'click', 'Click', 'Blast everything around you outward with a force pulse.'),
  // CREATION
  P('c_building', 'Create Building', 'creation', 'Building2', '#5dff9a', 'click', 'Click', 'Materialize a building where you aim. Choose house, skyscraper, castle, pyramid and more.'),
  P('c_vehicle', 'Create Vehicle', 'creation', 'Car', '#5dd4ff', 'click', 'Click', 'Summon cars, trucks, planes, helicopters, boats or even a UFO.'),
  P('c_npc', 'Create People', 'creation', 'Users', '#ffd0a0', 'click', 'Click', 'Spawn individuals or whole crowds that live, work and react to the world.'),
  P('c_animal', 'Create Animals', 'creation', 'PawPrint', '#b0ff6b', 'click', 'Click', 'Summon deer, wolves, elephants, whales, flocks of birds and even dragons.'),
  P('c_weapon', 'Create Weapons', 'creation', 'Sword', '#ffe8a0', 'click', 'Click', 'Conjure divine arsenal: rain of swords, spear volleys, homing missiles or a titan hammer.'),
  P('c_structure', 'Create Structure', 'creation', 'Landmark', '#ffcf8a', 'click', 'Click', 'Raise walls, arches, temples and stairways to heaven out of nothing.'),
  P('c_settlement', 'Create Settlement', 'creation', 'Home', '#9aff8a', 'click', 'Click', 'Found an entire village: houses, roads, trees, farm animals and a living population.'),
  P('terraform', 'Terraform', 'creation', 'Layers', '#8aff6b', 'hold', 'Hold LMB', 'Sculpt the planet: raise mountains, dig lakes, flatten land or grow forests.'),
  // SUMMONING
  P('shadow_soldiers', 'Shadow Soldiers', 'summoning', 'Users', '#a97aff', 'click', 'Click', 'Summon a squad of loyal shadow warriors. They follow you and attack rival gods during challenges.'),
  P('summon_beasts', 'Shadow Beasts', 'summoning', 'PawPrint', '#d080ff', 'click', 'Click', 'Summon a pack of shadow wolves. They follow you and fight at your side against rival gods.'),
  // DESTRUCTION
  P('d_vehicle', 'Destroy Vehicles', 'destruction', 'Truck', '#ff8a4d', 'click', 'Click', 'Detonate every vehicle in a wide radius with chain-reaction explosions.'),
  P('d_building', 'Demolish Buildings', 'destruction', 'Hammer', '#ff5a4d', 'click', 'Click', 'Collapse the targeted buildings and their neighbours floor by floor.'),
  P('d_env', 'Erase Environment', 'destruction', 'Trees', '#ff9a4d', 'click', 'Click', 'Shred trees, rocks, lamp posts and every natural object in a region.'),
  P('shockwave', 'Shockwave', 'destruction', 'Radio', '#ff6b4d', 'click', 'Click', 'Release an expanding ring of force that flattens and hurls everything outward from you.'),
  P('blast', 'Energy Explosion', 'destruction', 'Bomb', '#ff4d4d', 'hold', 'Click / Hold', 'A precise, devastating explosion at the target that carves a crater.'),
  P('disaster', 'Large-Scale Disaster', 'destruction', 'Biohazard', '#ff3d6a', 'click', 'Click', 'Trigger the disaster selected in the control panel: apocalypse, volcano, tornado outbreak…'),
];
export const POWER_MAP: Record<string, PowerDef> = Object.fromEntries(POWERS.map(p => [p.id, p]));
export const STARTER_POWERS = ['divine_bolt', 'divine_guard', 'divine_dash', 'flight'];

export interface FormDef { id: string; name: string; tagline: string; color: string; color2: string; desc: string; icon: string }
export const FORMS: FormDef[] = [
  { id: 'supreme', name: 'Supreme God', tagline: 'Radiant sovereign', color: '#ffd24d', color2: '#fff4c8', icon: 'Crown', desc: 'Golden armor, a blazing halo and sacred light. Your energy is pure radiance.' },
  { id: 'cosmic', name: 'Cosmic God', tagline: 'Wielder of galaxies', color: '#a96bff', color2: '#4d8dff', icon: 'Stars', desc: 'A body of living nebula wreathed by orbiting worlds. Your energy burns violet and star-blue.' },
  { id: 'shadow', name: 'Shadow God', tagline: 'Devourer of light', color: '#7a2dd6', color2: '#ff2d55', icon: 'Ghost', desc: 'A silhouette of void and smoke with crimson eyes and bat-like wings. Energy bleeds darkness.' },
  { id: 'destruction', name: 'Destruction God', tagline: 'Herald of the end', color: '#ff3d2a', color2: '#ffb02a', icon: 'Skull', desc: 'Molten armor, burning horns and spikes. Everything you touch erupts in hellfire.' },
  { id: 'elemental', name: 'Elemental God', tagline: 'Master of the four forces', color: '#38d6a0', color2: '#ffd24d', icon: 'Droplets', desc: 'Fire, water, wind and earth orbit you in living orbs. Your powers keep their natural elements.' },
  { id: 'infinite', name: 'Infinite Energy God', tagline: 'Limitless radiance', color: '#4df0ff', color2: '#ffffff', icon: 'Infinity', desc: 'A being of pure white-cyan energy with wings of light. Your aura streams in prismatic colour.' },
];
export const FORM_MAP: Record<string, FormDef> = Object.fromEntries(FORMS.map(f => [f.id, f]));

export const WEATHERS = [
  { id: 'clear', name: 'Clear', icon: 'Sun' },
  { id: 'cloudy', name: 'Cloudy', icon: 'Cloud' },
  { id: 'rain', name: 'Rain', icon: 'CloudRain' },
  { id: 'storm', name: 'Thunderstorm', icon: 'CloudLightning' },
  { id: 'snow', name: 'Snow', icon: 'CloudSnow' },
  { id: 'fog', name: 'Fog', icon: 'CloudFog' },
  { id: 'sand', name: 'Sandstorm', icon: 'Wind' },
];

export const BUILDING_KINDS = [
  { id: 'house', name: 'House' }, { id: 'apartments', name: 'Apartments' }, { id: 'skyscraper', name: 'Skyscraper' },
  { id: 'office', name: 'Office Block' }, { id: 'pyramid', name: 'Pyramid' }, { id: 'castle', name: 'Castle' }, { id: 'obelisk', name: 'Obelisk' },
];
export const STRUCTURE_KINDS = [
  { id: 'wall', name: 'Great Wall' }, { id: 'arch', name: 'Triumphal Arch' }, { id: 'temple', name: 'Temple' }, { id: 'stairs', name: 'Stairway to Heaven' },
];
export const VEHICLE_KINDS = [
  { id: 'sedan', name: 'Sedan' }, { id: 'sports', name: 'Sports Car' }, { id: 'suv', name: 'SUV' }, { id: 'taxi', name: 'Taxi' },
  { id: 'truck', name: 'Truck' }, { id: 'bus', name: 'Bus' }, { id: 'airliner', name: 'Airliner' }, { id: 'plane', name: 'Light Plane' },
  { id: 'helicopter', name: 'Helicopter' }, { id: 'boat', name: 'Boat' }, { id: 'ufo', name: 'UFO' },
];
export const ANIMAL_KINDS = [
  { id: 'deer', name: 'Deer' }, { id: 'cow', name: 'Cow' }, { id: 'wolf', name: 'Wolf' }, { id: 'horse', name: 'Horse' },
  { id: 'elephant', name: 'Elephant' }, { id: 'camel', name: 'Camel' }, { id: 'sheep', name: 'Sheep' }, { id: 'bird', name: 'Bird Flock' },
  { id: 'fish', name: 'Fish School' }, { id: 'whale', name: 'Whale' }, { id: 'dragon', name: 'Dragon' },
];
export const WEAPON_KINDS = [
  { id: 'swords', name: 'Rain of Swords' }, { id: 'spears', name: 'Spear Volley' }, { id: 'missiles', name: 'Homing Missiles' }, { id: 'hammer', name: 'Titan Hammer' },
];
export const DISASTER_KINDS = [
  { id: 'apocalypse', name: 'Apocalypse', desc: 'Meteors, quakes, tornadoes and a tsunami at once' },
  { id: 'earthquake', name: 'Mega Earthquake', desc: 'A city-leveling quake' },
  { id: 'tornadoes', name: 'Tornado Outbreak', desc: 'Five tornadoes tear through the area' },
  { id: 'meteors', name: 'Meteor Storm', desc: 'Dozens of meteors rain from orbit' },
  { id: 'tsunami', name: 'Mega Tsunami', desc: 'A towering wave from the horizon' },
  { id: 'volcano', name: 'Volcanic Eruption', desc: 'A new volcano erupts from the ground' },
  { id: 'blackholes', name: 'Singularity', desc: 'A black hole opens above the city' },
  { id: 'rupture', name: 'World Rupture', desc: 'Planetary cataclysm that shatters the whole land' },
  { id: 'flood', name: 'Great Flood', desc: 'Sea level surges 40 metres' },
];
export const TERRAFORM_MODES = [
  { id: 'raise', name: 'Raise Mountain' }, { id: 'lower', name: 'Dig Lake / Canyon' }, { id: 'flatten', name: 'Flatten' }, { id: 'forest', name: 'Grow Forest' },
];

export const TELEPORT_DESTS = [
  { id: 'downtown', name: 'Downtown Skyline', x: 0, y: 330, z: 40 },
  { id: 'suburbs', name: 'Suburbs', x: 330, y: 20, z: 280 },
  { id: 'airport', name: 'Airport', x: 640, y: 18, z: 90 },
  { id: 'mountains', name: 'Snow Mountains', x: 100, y: 380, z: -640 },
  { id: 'desert', name: 'Desert', x: 80, y: 40, z: 700 },
  { id: 'forest', name: 'Deep Forest', x: -800, y: 40, z: -150 },
  { id: 'island', name: 'Remote Island', x: 1500, y: 40, z: 650 },
  { id: 'underwater', name: 'Ocean Floor', x: 1250, y: -20, z: 300 },
  { id: 'orbit', name: 'Low Orbit', x: 0, y: 2600, z: 0 },
  { id: 'moon', name: 'The Moon', x: -2200, y: 5800, z: -2300 },
  { id: 'mars', name: 'Mars', x: 3500, y: 8400, z: 3300 },
  { id: 'saturn', name: 'Gas Giant', x: -4000, y: 11500, z: 5400 },
];
