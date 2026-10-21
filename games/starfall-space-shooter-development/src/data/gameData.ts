// ─── STARFALL: GALACTIC WAR — Data Definitions ──────────────────────────────

export interface ShipDef {
  id: string; name: string; role: string; desc: string;
  hull: number; shield: number; armor: number; speed: number; accel: number;
  maneuver: number; damage: number; energy: number; boost: number;
  ability: string; abilityName: string; abilityDesc: string;
  color: string; accent: string; cost: number; scale: number; wingSpan: number;
}

export const SHIPS: ShipDef[] = [
  { id:'viper', name:'Viper Interceptor', role:'Interceptor', desc:'Blindingly fast lightweight fighter built for dogfights and hit-and-run strikes.', hull:90, shield:60, armor:2, speed:64, accel:52, maneuver:2.6, damage:1.0, energy:100, boost:120, ability:'overdrive', abilityName:'Afterburner Overdrive', abilityDesc:'Extreme speed + fire-rate surge for 5s.', color:'#38bdf8', accent:'#e0f2fe', cost:0, scale:1, wingSpan:2.6 },
  { id:'aegis', name:'Aegis Defender', role:'Heavy Defender', desc:'A flying fortress. Massive shields and armor shrug off fire that would vaporize lesser craft.', hull:200, shield:160, armor:8, speed:40, accel:30, maneuver:1.5, damage:1.1, energy:130, boost:80, ability:'barrier', abilityName:'Barrier Dome', abilityDesc:'Invulnerable energy dome for 4s.', color:'#f59e0b', accent:'#fef3c7', cost:2500, scale:1.35, wingSpan:3.4 },
  { id:'phantom', name:'Phantom Striker', role:'Stealth Striker', desc:'Cloaking fields and precision cannons. Strikes from nowhere, vanishes before retaliation.', hull:85, shield:70, armor:2, speed:58, accel:46, maneuver:2.3, damage:1.35, energy:110, boost:110, ability:'cloak', abilityName:'Tactical Cloak', abilityDesc:'Become untargetable for 5s; next hits crit.', color:'#a78bfa', accent:'#ede9fe', cost:4000, scale:1.05, wingSpan:2.2 },
  { id:'nova', name:'Nova Bomber', role:'Bomber', desc:'Torpedo bays and area-denial munitions turn capital ships into expanding clouds of debris.', hull:150, shield:90, armor:5, speed:42, accel:32, maneuver:1.6, damage:1.5, energy:120, boost:85, ability:'orbital', abilityName:'Orbital Strike', abilityDesc:'Devastating bombardment on targeted area.', color:'#f97316', accent:'#ffedd5', cost:5500, scale:1.3, wingSpan:3.8 },
  { id:'spectre', name:'Spectre Gunship', role:'Gunship', desc:'Six weapon hardpoints and a drone bay. A one-ship fleet engagement.', hull:135, shield:110, armor:4, speed:48, accel:38, maneuver:1.9, damage:1.25, energy:140, boost:95, ability:'drones', abilityName:'Drone Swarm', abilityDesc:'Deploy 3 autonomous attack drones for 20s.', color:'#34d399', accent:'#d1fae5', cost:7000, scale:1.25, wingSpan:3.6 },
  { id:'tempest', name:'Tempest Assault', role:'Assault', desc:'Balanced frame wired with arc-lightning projectors that chain between hostile hulls.', hull:120, shield:100, armor:4, speed:52, accel:42, maneuver:2.1, damage:1.2, energy:150, boost:100, ability:'emp', abilityName:'EMP Burst', abilityDesc:'Disable all nearby enemies for 3.5s.', color:'#22d3ee', accent:'#cffafe', cost:8500, scale:1.15, wingSpan:3.0 },
  { id:'solar', name:'Solar Lance', role:'Long-Range Sniper', desc:'A railgun with engines attached. Kills targets beyond visual range with solar-charged lances.', hull:95, shield:85, armor:3, speed:50, accel:40, maneuver:1.8, damage:1.6, energy:130, boost:90, ability:'phase', abilityName:'Phase Shift', abilityDesc:'Blink forward, evading all fire.', color:'#facc15', accent:'#fef9c3', cost:11000, scale:1.1, wingSpan:2.4 },
  { id:'eclipse', name:'Eclipse Prototype', role:'Experimental', desc:'Reverse-engineered Void technology. A singularity reactor wrapped in starship armor.', hull:170, shield:150, armor:6, speed:60, accel:50, maneuver:2.4, damage:1.55, energy:180, boost:130, ability:'timefracture', abilityName:'Time Fracture', abilityDesc:'Slow all enemies by 65% for 5s.', color:'#e879f9', accent:'#fae8ff', cost:18000, scale:1.2, wingSpan:3.2 },
];

export type WeaponKind = 'projectile'|'beam'|'homing'|'rocket'|'charge'|'arc'|'singularity'|'ricochet';
export interface WeaponDef {
  id: string; name: string; slot: 'primary'|'secondary'; kind: WeaponKind;
  desc: string; damage: number; fireRate: number; speed: number; range: number;
  spread: number; projectiles: number; energyCost: number; ammo: number; // -1 infinite
  color: string; size: number; aoe: number; homing: number; shieldMult: number; hullMult: number;
  cost: number; chargeTime?: number;
}

export const WEAPONS: WeaponDef[] = [
  { id:'pulse', name:'Pulse Laser Cannons', slot:'primary', kind:'projectile', desc:'Reliable twin pulse lasers. The backbone of the fleet.', damage:9, fireRate:7, speed:340, range:700, spread:0.012, projectiles:2, energyCost:2, ammo:-1, color:'#38bdf8', size:0.32, aoe:0, homing:0, shieldMult:1.1, hullMult:1, cost:0 },
  { id:'plasma', name:'Rapid Plasma Guns', slot:'primary', kind:'projectile', desc:'Superheated plasma at a blistering rate of fire.', damage:6, fireRate:13, speed:300, range:600, spread:0.03, projectiles:1, energyCost:2.5, ammo:-1, color:'#4ade80', size:0.36, aoe:0, homing:0, shieldMult:1.2, hullMult:0.9, cost:1200 },
  { id:'autocannon', name:'Twin Autocannons', slot:'primary', kind:'projectile', desc:'Kinetic slugs that chew through armor plating.', damage:13, fireRate:5, speed:420, range:800, spread:0.018, projectiles:2, energyCost:1, ammo:-1, color:'#fbbf24', size:0.28, aoe:0, homing:0, shieldMult:0.6, hullMult:1.5, cost:2000 },
  { id:'particle', name:'Heavy Particle Cannons', slot:'primary', kind:'projectile', desc:'Slow, devastating bolts of charged particles.', damage:34, fireRate:1.8, speed:280, range:850, spread:0.004, projectiles:1, energyCost:10, ammo:-1, color:'#fb7185', size:0.6, aoe:6, homing:0, shieldMult:1, hullMult:1.3, cost:3500 },
  { id:'beam', name:'Continuous Beam Laser', slot:'primary', kind:'beam', desc:'A sustained lance of coherent light. Melts shields.', damage:55, fireRate:10, speed:0, range:420, spread:0, projectiles:1, energyCost:22, ammo:-1, color:'#f472b6', size:0.5, aoe:0, homing:0, shieldMult:1.6, hullMult:0.8, cost:5000 },
  { id:'ricochet', name:'Ricochet Energy Bolts', slot:'primary', kind:'ricochet', desc:'Bolts that bounce to nearby targets on impact.', damage:14, fireRate:4, speed:320, range:650, spread:0.01, projectiles:1, energyCost:5, ammo:-1, color:'#c084fc', size:0.4, aoe:0, homing:0, shieldMult:1, hullMult:1, cost:6200 },
  { id:'seeker', name:'Heat-Seeking Missiles', slot:'secondary', kind:'homing', desc:'Lock on and let the missile do the flying.', damage:45, fireRate:0.9, speed:150, range:900, spread:0.05, projectiles:1, energyCost:0, ammo:40, color:'#fb923c', size:0.55, aoe:12, homing:3.2, shieldMult:0.8, hullMult:1.2, cost:0 },
  { id:'rockets', name:'Rocket Pods', slot:'secondary', kind:'rocket', desc:'Dumbfire rocket salvos. Point, click, devastate.', damage:16, fireRate:3.5, speed:240, range:700, spread:0.06, projectiles:3, energyCost:0, ammo:90, color:'#f87171', size:0.45, aoe:8, homing:0, shieldMult:0.9, hullMult:1.1, cost:1500 },
  { id:'torpedo', name:'Heavy Torpedoes', slot:'secondary', kind:'homing', desc:'Capital-killer torpedoes with enormous warheads.', damage:160, fireRate:0.35, speed:110, range:1100, spread:0, projectiles:1, energyCost:0, ammo:14, color:'#ef4444', size:0.9, aoe:26, homing:1.6, shieldMult:0.7, hullMult:1.6, cost:4200 },
  { id:'emp-missile', name:'EMP Missiles', slot:'secondary', kind:'homing', desc:'Shuts down enemy systems and strips shields.', damage:15, fireRate:0.7, speed:160, range:850, spread:0.03, projectiles:1, energyCost:0, ammo:24, color:'#67e8f9', size:0.55, aoe:18, homing:3, shieldMult:3, hullMult:0.3, cost:4800 },
  { id:'cluster', name:'Cluster Missiles', slot:'secondary', kind:'homing', desc:'Splits into a swarm of homing sub-munitions.', damage:13, fireRate:0.6, speed:170, range:800, spread:0.14, projectiles:5, energyCost:0, ammo:30, color:'#fde047', size:0.4, aoe:7, homing:3.6, shieldMult:0.9, hullMult:1, cost:6500 },
  { id:'disruptor', name:'Shield Disruptors', slot:'secondary', kind:'projectile', desc:'Phase-shifted rounds that delete shield generators.', damage:20, fireRate:2.2, speed:380, range:750, spread:0.008, projectiles:1, energyCost:0, ammo:60, color:'#93c5fd', size:0.4, aoe:0, homing:0, shieldMult:3.2, hullMult:0.4, cost:7000 },
  { id:'railgun', name:'Charged Railgun', slot:'primary', kind:'charge', desc:'Hold to charge. Release to delete something from existence.', damage:150, fireRate:0.5, speed:900, range:1400, spread:0, projectiles:1, energyCost:30, ammo:-1, color:'#fef08a', size:0.7, aoe:5, homing:0, shieldMult:1.2, hullMult:1.8, cost:9000, chargeTime:1.1 },
  { id:'arc', name:'Arc-Lightning Projector', slot:'primary', kind:'arc', desc:'Lightning that chains between clustered enemies.', damage:26, fireRate:2.5, speed:0, range:380, spread:0, projectiles:1, energyCost:14, ammo:-1, color:'#a5f3fc', size:0.35, aoe:0, homing:0, shieldMult:1.3, hullMult:1, cost:10500 },
  { id:'singularity', name:'Singularity Cannon', slot:'secondary', kind:'singularity', desc:'Fires a micro black hole that crushes everything nearby.', damage:70, fireRate:0.3, speed:90, range:1000, spread:0, projectiles:1, energyCost:0, ammo:8, color:'#e879f9', size:1.4, aoe:46, homing:0.4, shieldMult:1.4, hullMult:1.4, cost:14000 },
];

export interface EnemyDef {
  id: string; name: string; faction: 'Void Swarm'|'Iron Dominion'|'Astral Collective';
  hull: number; shield: number; speed: number; damage: number; fireRate: number;
  score: number; credits: number; color: string; scale: number; behavior: 'swarm'|'fighter'|'heavy'|'kamikaze'|'sniper'|'teleporter'|'carrier';
  desc: string;
}

export const ENEMIES: EnemyDef[] = [
  { id:'scout', name:'Void Scout', faction:'Void Swarm', hull:26, shield:0, speed:44, damage:5, fireRate:0.8, score:100, credits:25, color:'#e879f9', scale:0.8, behavior:'swarm', desc:'Fast and fragile. Dangerous in numbers.' },
  { id:'interceptor', name:'Swarm Interceptor', faction:'Void Swarm', hull:42, shield:15, speed:50, damage:7, fireRate:1.1, score:150, credits:35, color:'#f472b6', scale:0.9, behavior:'fighter', desc:'Aggressive dogfighter with evasive rolls.' },
  { id:'kamikaze', name:'Kamikaze Drone', faction:'Void Swarm', hull:16, shield:0, speed:58, damage:38, fireRate:0, score:120, credits:20, color:'#fb7185', scale:0.65, behavior:'kamikaze', desc:'Charges and detonates. Shoot it first.' },
  { id:'lancer', name:'Iron Lancer', faction:'Iron Dominion', hull:75, shield:40, speed:36, damage:10, fireRate:0.9, score:250, credits:55, color:'#f59e0b', scale:1.1, behavior:'fighter', desc:'Armored line fighter with disciplined strafing runs.' },
  { id:'gunship', name:'Dominion Gunship', faction:'Iron Dominion', hull:170, shield:80, speed:26, damage:13, fireRate:1.6, score:500, credits:110, color:'#ef4444', scale:1.6, behavior:'heavy', desc:'Slow gun platform with saturation fire.' },
  { id:'cruiser', name:'Missile Cruiser', faction:'Iron Dominion', hull:230, shield:110, speed:20, damage:22, fireRate:0.4, score:700, credits:150, color:'#dc2626', scale:2.1, behavior:'sniper', desc:'Launches homing missiles from extreme range.' },
  { id:'wraith', name:'Astral Wraith', faction:'Astral Collective', hull:55, shield:55, speed:46, damage:11, fireRate:1.2, score:350, credits:80, color:'#818cf8', scale:1.0, behavior:'teleporter', desc:'Teleports between attack runs. Unpredictable.' },
  { id:'beamship', name:'Collective Beamship', faction:'Astral Collective', hull:120, shield:90, speed:28, damage:20, fireRate:0.6, score:600, credits:130, color:'#6366f1', scale:1.5, behavior:'sniper', desc:'Charges a piercing energy beam. Break its line of sight.' },
  { id:'carrier', name:'Drone Carrier', faction:'Astral Collective', hull:260, shield:120, speed:18, damage:8, fireRate:0.7, score:800, credits:180, color:'#a78bfa', scale:2.2, behavior:'carrier', desc:'Deploys attack drones until destroyed.' },
];

export interface BossDef {
  id: string; name: string; title: string; desc: string;
  hull: number; shield: number; speed: number; color: string; scale: number;
  patterns: string[]; reward: number; quote: string;
}

export const BOSSES: BossDef[] = [
  { id:'devourer', name:'THE DEVOURER', title:'Biomechanical Leviathan', desc:'A living warship that consumes fleets. Its maw-guns fire in spiraling patterns, and it spawns Void offspring when wounded.', hull:2600, shield:700, speed:10, color:'#d946ef', scale:7, patterns:['spiral','spawn','charge'], reward:3000, quote:'"It is not a ship. It is an appetite." — Cmdr. Voss' },
  { id:'ironclad', name:'IRONCLAD PRIME', title:'Dominion Flagship', desc:'Layers of ablative armor and broadside batteries. Focus fire when its shield cycle drops between phases.', hull:3400, shield:1200, speed:7, color:'#f59e0b', scale:8.5, patterns:['broadside','missiles','barrage'], reward:4200, quote:'"Its armor has armor. Find the seams." — Cmdr. Voss' },
  { id:'riftwarden', name:'THE RIFT WARDEN', title:'Dimensional Warship', desc:'Phases through rifts to reposition and ambush. Punish it in the brief moment it materializes.', hull:3000, shield:1000, speed:14, color:'#818cf8', scale:7.5, patterns:['teleport','beam','spiral'], reward:5200, quote:'"It fights you from next Tuesday." — Lt. Park' },
  { id:'stareater', name:'STAR EATER', title:'Planetary Siege Engine', desc:'A colossal machine built to crack worlds. Its siege cannon telegraphs before firing — never be in front of it.', hull:4500, shield:1400, speed:5, color:'#ef4444', scale:10, patterns:['siegecannon','missiles','spawn'], reward:6500, quote:'"Helios will not fall. Not while I breathe." — Cmdr. Voss' },
  { id:'astralqueen', name:'THE ASTRAL QUEEN', title:'Flagship of the Collective', desc:'A psychic flagship commanding drone swarms and bending energy into homing lances.', hull:4200, shield:1800, speed:11, color:'#a78bfa', scale:8, patterns:['drones','beam','missiles'], reward:8000, quote:'"She hears your thoughts before you think them." — Dr. Senn' },
  { id:'voidemperor', name:'THE VOID EMPEROR', title:'Ancient Sovereign of the Sealed Reach', desc:'The being that slept a million years beyond the Seal. Every weapon system ever feared, in one hull. End this.', hull:6000, shield:2200, speed:12, color:'#f0abfc', scale:11, patterns:['spiral','teleport','beam','missiles','spawn','siegecannon'], reward:15000, quote:'"For every world they took. Fire everything." — Cmdr. Voss' },
];

export interface MissionDef {
  id: number; name: string; sector: string; env: EnvId; brief: string; debrief: string;
  type: 'destroy'|'boss'|'escort'|'defense'|'survival-time'|'asteroid';
  killTarget: number; timeLimit: number; bossId?: string; reward: number; xp: number;
  waves: number; difficulty: number; objectiveText: string; optionalText: string;
  dialogue: { speaker: string; text: string }[];
}

export type EnvId = 'nebula'|'redstar'|'frozen'|'volcanic'|'graveyard'|'shipyard'|'blackhole'|'deepfield';

export const ENVIRONMENTS: Record<EnvId, { name:string; sky:string; fog:string; nebulaA:string; nebulaB:string; planet:string; planetRing:boolean; light:string; asteroidCount:number; hazard:string }> = {
  nebula:    { name:'Cerulean Nebula', sky:'#020617', fog:'#0b1e3a', nebulaA:'#2563eb', nebulaB:'#7c3aed', planet:'#38bdf8', planetRing:false, light:'#93c5fd', asteroidCount:60, hazard:'Sensor interference in dense gas pockets' },
  redstar:   { name:'Ember Reach — Red Dwarf System', sky:'#0f0505', fog:'#2a0d05', nebulaA:'#dc2626', nebulaB:'#f97316', planet:'#f97316', planetRing:false, light:'#fca5a5', asteroidCount:70, hazard:'Solar flare radiation zones' },
  frozen:    { name:'Glacies Ring Worlds', sky:'#020a12', fog:'#082f3a', nebulaA:'#0891b2', nebulaB:'#38bdf8', planet:'#a5f3fc', planetRing:true, light:'#bae6fd', asteroidCount:90, hazard:'Ice shard collisions' },
  volcanic:  { name:'Pyre Belt — Volcanic Asteroid Field', sky:'#120404', fog:'#2d0a04', nebulaA:'#ea580c', nebulaB:'#b91c1c', planet:'#fb923c', planetRing:false, light:'#fdba74', asteroidCount:140, hazard:'Magma eruptions and hot debris' },
  graveyard: { name:'The Derelict Graveyard', sky:'#050508', fog:'#14141f', nebulaA:'#475569', nebulaB:'#7c3aed', planet:'#94a3b8', planetRing:false, light:'#cbd5e1', asteroidCount:110, hazard:'Unstable wreck reactors' },
  shipyard:  { name:'Forge Orbital Shipyards', sky:'#030712', fog:'#111827', nebulaA:'#0ea5e9', nebulaB:'#f59e0b', planet:'#60a5fa', planetRing:false, light:'#dbeafe', asteroidCount:40, hazard:'Construction traffic lanes' },
  blackhole: { name:'Eventide — Black Hole Anomaly', sky:'#000000', fog:'#12041f', nebulaA:'#7c3aed', nebulaB:'#db2777', planet:'#c084fc', planetRing:true, light:'#e9d5ff', asteroidCount:80, hazard:'Gravity distortions near the horizon' },
  deepfield: { name:'The Last Citadel — Deep Battlefield', sky:'#020208', fog:'#0a0a2e', nebulaA:'#4338ca', nebulaB:'#be185d', planet:'#818cf8', planetRing:false, light:'#c7d2fe', asteroidCount:70, hazard:'Dimensional rift storms' },
};

export const MISSIONS: MissionDef[] = [
  { id:1, name:'First Contact', sector:'Cerulean Nebula — Outer Rim Patrol', env:'nebula', type:'destroy', killTarget:12, timeLimit:0, waves:3, difficulty:1, reward:900, xp:120, objectiveText:'Destroy all Void Swarm hostiles', optionalText:'Optional: Finish with hull above 70%',
    brief:'Long-range sensors picked up unknown signatures breaching the Seal at the galaxy\'s edge. Command calls it impossible — nothing has crossed in a million years. You are the closest patrol. Investigate, and if they fire first... make sure you fire last.',
    debrief:'First contact confirmed. Whatever slept beyond the Seal is awake — and it shoots to kill. Command is mobilizing the fleet.',
    dialogue:[{speaker:'Cmdr. Voss',text:'Starfall Actual, this is Voss. Unidentified contacts on your scope — weapons free.'},{speaker:'Lt. Park',text:'Those energy signatures predate every civilization we know. Stay sharp!'}] },
  { id:2, name:'Broken Convoy', sector:'Ember Reach Trade Lane', env:'redstar', type:'escort', killTarget:14, timeLimit:0, waves:3, difficulty:1.4, reward:1200, xp:160, objectiveText:'Protect the transport HAULER-7 and eliminate attackers', optionalText:'Optional: Transport finishes above 50% hull',
    brief:'A civilian convoy carrying reactor cores to the Helios shipyards is under attack by Iron Dominion raiders. The Dominion denies everything, of course. Keep the hauler alive — those cores are the war effort.',
    debrief:'The convoy made it through. Dominion raiders this deep in our space means someone is feeding them our routes.',
    dialogue:[{speaker:'Hauler-7',text:'Mayday! They came out of nowhere — shields are failing!'},{speaker:'Cmdr. Voss',text:'Stay on my wing, Hauler. Starfall, clear those raiders!'}] },
  { id:3, name:'Siege of Helios', sector:'Helios Station — Orbital Defense Grid', env:'shipyard', type:'defense', killTarget:20, timeLimit:0, waves:4, difficulty:1.8, reward:1700, xp:220, objectiveText:'Defend Helios Station from all waves', optionalText:'Optional: Station hull above 60% at end',
    brief:'The Swarm\'s vanguard just dropped out of FTL on top of Helios Station. If the shipyards fall, we lose the ability to build capital ships — and the war. Hold the line, pilot.',
    debrief:'Helios stands. But the last transmission from the swarm leader wasn\'t in any known language... it was coordinates. To the nebula.',
    dialogue:[{speaker:'Helios Control',text:'All defensive batteries are yours, Starfall. Do not let them reach the docks!'},{speaker:'Lt. Park',text:'Kamkaze drones inbound on the station — intercept them!'}] },
  { id:4, name:'Into the Nebula', sector:'Glacies Deep — Sensor-Dead Zone', env:'frozen', type:'survival-time', killTarget:16, timeLimit:150, waves:4, difficulty:2.2, reward:2100, xp:280, objectiveText:'Survive the ambush and destroy 16 hostiles', optionalText:'Optional: Destroy a Drone Carrier',
    brief:'Following the coordinates means flying blind into a frozen nebula where sensors die at fifty meters. The Astral Collective hunts there. They teleport. They whisper on dead channels. Try not to listen.',
    debrief:'You found it: a derelict fleet, older than human spaceflight, frozen mid-battle. And something in it is still transmitting.',
    dialogue:[{speaker:'Dr. Senn',text:'The Collective doesn\'t use radios. If you hear your own voice... it isn\'t you.'},{speaker:'Cmdr. Voss',text:'Ambush! Wraiths everywhere — fight your way out!'}] },
  { id:5, name:'The Lost Fleet', sector:'The Derelict Graveyard', env:'graveyard', type:'boss', killTarget:8, timeLimit:0, bossId:'devourer', waves:2, difficulty:2.6, reward:3200, xp:400, objectiveText:'Destroy THE DEVOURER guarding the Lost Fleet', optionalText:'Optional: No hull damage during boss phase 1',
    brief:'The Lost Fleet is real — and something has been nesting in it. A biomechanical leviathan the scouts call the Devourer. Kill it and recover the fleet\'s data cores. They may tell us what the ancients were running from.',
    debrief:'The data cores are decoded. The ancients weren\'t running. They were sealing something in. And the Dominion just found the door.',
    dialogue:[{speaker:'Dr. Senn',text:'Biomass and starship plating, fused. It grows over what it eats.'},{speaker:'Cmdr. Voss',text:'Then let\'s give it indigestion. Weapons free!'}] },
  { id:6, name:'Assault on the Forge', sector:'Pyre Belt — Dominion Foundry', env:'volcanic', type:'boss', killTarget:10, timeLimit:0, bossId:'ironclad', waves:3, difficulty:3.1, reward:4400, xp:520, objectiveText:'Break the Forge defense and destroy IRONCLAD PRIME', optionalText:'Optional: Destroy 20 asteroids (they had it coming)',
    brief:'The Iron Dominion is building a key to the Seal inside a volcanic foundry, guarded by their flagship Ironclad Prime. This is a declaration-of-war kind of operation. Good thing we\'re already at war.',
    debrief:'The Forge burns. But the key was already gone — delivered to something on the far side of a closing rift.',
    dialogue:[{speaker:'Cmdr. Voss',text:'That\'s the Prime. Every gun in the Dominion fleet, one hull.'},{speaker:'Lt. Park',text:'Its shield cycles between volleys. Hit it in the gaps!'}] },
  { id:7, name:'Rift of Shadows', sector:'Eventide Anomaly', env:'blackhole', type:'boss', killTarget:10, timeLimit:0, bossId:'riftwarden', waves:3, difficulty:3.6, reward:5600, xp:660, objectiveText:'Destroy THE RIFT WARDEN at the anomaly', optionalText:'Optional: Destroy all escorts first',
    brief:'Rifts are tearing open across the sector, guarded by a warship that exists in several moments at once. Destroy the Rift Warden and collapse the breach before the Sealed Reach pours through.',
    debrief:'The breach is sealed — one of hundreds. Behind it, for just a moment, the sensors saw a throne. And something sitting on it, turning toward us.',
    dialogue:[{speaker:'Dr. Senn',text:'It repositions through folded space. When it solidifies, it\'s vulnerable.'},{speaker:'Cmdr. Voss',text:'Watch the shimmer. Where it was is where it strikes.'}] },
  { id:8, name:'The Last Citadel', sector:'Deep Battlefield — Citadel Approach', env:'deepfield', type:'defense', killTarget:26, timeLimit:0, bossId:'astralqueen', waves:5, difficulty:4.2, reward:7400, xp:850, objectiveText:'Defend the Citadel, then destroy THE ASTRAL QUEEN', optionalText:'Optional: Keep Citadel above 40% hull',
    brief:'Every faction that serves the Seal-breakers is converging on the Citadel, humanity\'s final fortress. The Astral Queen leads them personally. If the Citadel falls, so does the galaxy\'s last unified fleet.',
    debrief:'The Queen is gone — but her final transmission was a single word, broadcast to every ship in the galaxy: "KNEEL." He is coming.',
    dialogue:[{speaker:'Cmdr. Voss',text:'Every pilot we have is in this fight. Make it count.'},{speaker:'Astral Queen',text:'Little pilot. I have read your ending. Shall I spoil it?'}] },
  { id:9, name:'Emperor\'s Fall', sector:'The Shattered Seal', env:'deepfield', type:'boss', killTarget:12, timeLimit:0, bossId:'voidemperor', waves:4, difficulty:5, reward:15000, xp:1500, objectiveText:'Destroy THE VOID EMPEROR. End the war.', optionalText:'Optional: Achieve victory with any hull remaining. (Seriously. Good luck.)',
    brief:'The Seal is shattered. The Void Emperor — sovereign of everything that was locked away for a million years — has entered our galaxy at the head of an armada. You are Starfall Squadron\'s last flight. Bring him down, and the Reach collapses with him. No pressure.',
    debrief:'The Emperor is dead. The Reach collapses. Across the galaxy, for the first time in years, the stars are just stars. Starfall, come home. You\'ve earned it. — GALACTIC WAR: VICTORY',
    dialogue:[{speaker:'Void Emperor',text:'A MILLION YEARS I WAITED. YOU WILL WAIT UPON MY THRONE.'},{speaker:'Cmdr. Voss',text:'For Helios. For the Lost Fleet. Starfall — FIRE EVERYTHING.'}] },
];

export interface ModeDef { id: string; name: string; desc: string; env: EnvId; icon: string; }
export const MODES: ModeDef[] = [
  { id:'quick', name:'Quick Battle', desc:'Instant action: 3 waves, mixed factions, no briefings.', env:'nebula', icon:'Zap' },
  { id:'survival', name:'Survival', desc:'Endless escalating waves. How long can you last?', env:'graveyard', icon:'Skull' },
  { id:'endless', name:'Endless Galaxy', desc:'Procedural encounters with scaling difficulty and hazards.', env:'blackhole', icon:'Infinity' },
  { id:'bossrush', name:'Boss Rush', desc:'All six bosses, back to back, limited repairs between fights.', env:'deepfield', icon:'Crown' },
  { id:'timeattack', name:'Time Attack', desc:'Destroy 30 targets before the clock kills your run.', env:'redstar', icon:'Timer' },
  { id:'escort', name:'Escort Duty', desc:'Protect a fragile transport through hostile space.', env:'frozen', icon:'Shield' },
  { id:'defense', name:'Station Defense', desc:'Hold the station against escalating siege waves.', env:'shipyard', icon:'Castle' },
  { id:'asteroid', name:'Asteroid Run', desc:'Dense fields, kamikaze drones, and nowhere to hide.', env:'volcanic', icon:'Mountain' },
];

export interface UpgradeDef { id: string; name: string; desc: string; max: number; baseCost: number; stat: string; perLevel: string; }
export const UPGRADES: UpgradeDef[] = [
  { id:'hull', name:'Reinforced Hull Plating', desc:'Ablative composite armor weave.', max:10, baseCost:350, stat:'hull', perLevel:'+12% hull integrity' },
  { id:'shield', name:'Shield Capacitor Banks', desc:'High-density shield emitters.', max:10, baseCost:350, stat:'shield', perLevel:'+12% shield capacity' },
  { id:'engine', name:'Ion Drive Tuning', desc:'Overclocked thrust assemblies.', max:8, baseCost:400, stat:'speed', perLevel:'+5% speed & accel' },
  { id:'damage', name:'Weapon Overcharge Coils', desc:'Superconducting weapon bus.', max:10, baseCost:500, stat:'damage', perLevel:'+7% all weapon damage' },
  { id:'energy', name:'Reactor Amplifier', desc:'Auxiliary fusion cells.', max:8, baseCost:380, stat:'energy', perLevel:'+10% energy & regen' },
  { id:'boost', name:'Boost Injector Array', desc:'Pressurized afterburner feeds.', max:8, baseCost:380, stat:'boost', perLevel:'+10% boost capacity' },
  { id:'armor', name:'Reactive Armor Mesh', desc:'Energy-dispersing hull mesh.', max:6, baseCost:600, stat:'armor', perLevel:'+2 flat damage reduction' },
  { id:'ability', name:'Ability Nanocircuitry', desc:'Faster special systems cycling.', max:5, baseCost:700, stat:'ability', perLevel:'-8% ability cooldown' },
];

export interface AchievementDef { id: string; name: string; desc: string; target: number; stat: string; reward: number; }
export const ACHIEVEMENTS: AchievementDef[] = [
  { id:'kills100', name:'Centurion', desc:'Destroy 100 enemy ships in total.', target:100, stat:'totalKills', reward:500 },
  { id:'kills500', name:'Fleetbreaker', desc:'Destroy 500 enemy ships in total.', target:500, stat:'totalKills', reward:2000 },
  { id:'boss1', name:'Giantslayer', desc:'Defeat your first boss.', target:1, stat:'bossKills', reward:800 },
  { id:'boss6', name:'End of Legends', desc:'Defeat 6 bosses.', target:6, stat:'bossKills', reward:4000 },
  { id:'missions9', name:'Savior of the Galaxy', desc:'Complete all 9 campaign missions.', target:9, stat:'missionsDone', reward:5000 },
  { id:'credits50k', name:'War Profiteer', desc:'Earn 50,000 lifetime credits.', target:50000, stat:'lifetimeCredits', reward:1500 },
  { id:'ships4', name:'Collector', desc:'Own 4 different ships.', target:4, stat:'shipsOwned', reward:1200 },
  { id:'wave10', name:'Against the Tide', desc:'Reach wave 10 in Survival.', target:10, stat:'bestSurvivalWave', reward:1800 },
  { id:'shots1000', name:'Trigger Discipline (None)', desc:'Fire 1,000 projectiles.', target:1000, stat:'shotsFired', reward:600 },
  { id:'ult20', name:'Cataclysm', desc:'Unleash 20 ultimate attacks.', target:20, stat:'ultsUsed', reward:1500 },
];

export const ABILITY_INFO: Record<string, { cooldown: number; desc: string }> = {
  overdrive: { cooldown: 18, desc:'+80% speed and +60% fire rate for 5s.' },
  barrier: { cooldown: 22, desc:'Invulnerable for 4s.' },
  cloak: { cooldown: 20, desc:'Enemies cannot target you for 5s; your shots crit.' },
  orbital: { cooldown: 26, desc:'Bombardment barrage around your target area: heavy AoE.' },
  drones: { cooldown: 30, desc:'Deploy 3 attack drones for 20s.' },
  emp: { cooldown: 20, desc:'Disable enemies within 130m for 3.5s and strip shields.' },
  phase: { cooldown: 10, desc:'Blink 90m forward through fire.' },
  timefracture: { cooldown: 28, desc:'Slow all enemies and their projectiles by 65% for 5s.' },
  repair: { cooldown: 30, desc:'Restore 30% hull over 4s.' },
  gravity: { cooldown: 24, desc:'Pull enemies together and slow them.' },
};
