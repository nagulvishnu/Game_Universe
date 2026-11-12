// Static game data for DEMON LORD SIMULATOR
export type FactionId = 'demon' | 'human' | 'celestial' | 'rival' | 'ancient';
export type RegionId = 'capital' | 'bloodfire' | 'shadow' | 'frozen' | 'dragon' | 'ocean' | 'human' | 'celestial' | 'ruins';
export type UnitType = 'infantry' | 'knights' | 'assassins' | 'archers' | 'mages' | 'heavy' | 'giants' | 'dragons' | 'siege' | 'undead' | 'elite';
export type ResKey = 'gold' | 'crystals' | 'mana' | 'food' | 'supplies';
export type Res = Record<ResKey, number>;

export const FACTIONS: Record<FactionId, { name: string; color: string; desc: string }> = {
  demon: { name: 'Demon Realm', color: '#e0153f', desc: 'Your kingdom. The supreme throne of the Demon Realm.' },
  human: { name: 'Human Empire', color: '#5b8cff', desc: 'A vast empire of knights, mages and royal guards led by King Aldric IV.' },
  celestial: { name: 'Celestial Empire', color: '#ffd86b', desc: 'Divine angels ruled by the Celestial Emperor and the Gods.' },
  rival: { name: 'Rival Demon Kingdoms', color: '#b04cff', desc: 'Fractured demon courts ruled by the rebel Demon Lord Azrakar.' },
  ancient: { name: 'Ancient Creatures', color: '#4cd9a0', desc: 'Dragons, titans, abyssal beasts and forgotten guardians.' },
};

export const REGIONS: { id: RegionId; name: string; angle: number; desc: string; weather: string }[] = [
  { id: 'capital', name: 'Demon Capital', angle: 0, desc: 'Your obsidian capital and the Royal Palace.', weather: 'ember' },
  { id: 'bloodfire', name: 'Bloodfire Wasteland', angle: 0, desc: 'Volcanic plains, lava rivers and fire demons.', weather: 'ash' },
  { id: 'human', name: 'Human Empire', angle: Math.PI / 4, desc: 'Green kingdoms, cities, villages and armies of men.', weather: 'rain' },
  { id: 'shadow', name: 'Shadow Forest', angle: Math.PI / 2, desc: 'Ancient twisted woods haunted by shadow creatures.', weather: 'mist' },
  { id: 'ruins', name: 'Ancient Ruins', angle: (3 * Math.PI) / 4, desc: 'Forgotten civilizations and sleeping guardians.', weather: 'dust' },
  { id: 'ocean', name: 'Cursed Ocean', angle: Math.PI, desc: 'A drowned realm of sea monsters and sunken cities.', weather: 'rain' },
  { id: 'dragon', name: 'Dragon Mountains', angle: (-3 * Math.PI) / 4, desc: 'Colossal peaks, dragon nests and wyverns.', weather: 'wind' },
  { id: 'frozen', name: 'Frozen Abyss', angle: -Math.PI / 2, desc: 'Glacial peaks, ice fortresses and frost monsters.', weather: 'snow' },
  { id: 'celestial', name: 'Celestial Domain', angle: -Math.PI / 4, desc: 'A holy plateau in the clouds. Home of angels.', weather: 'holy' },
];
export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<RegionId, (typeof REGIONS)[number]>;

export const WATER_Y = 0;
export const pol = (deg: number, r: number): [number, number] => [Math.cos((deg * Math.PI) / 180) * r, Math.sin((deg * Math.PI) / 180) * r];

export interface TerritoryDef {
  id: string; name: string; region: RegionId; faction: FactionId; x: number; z: number;
  type: 'capital' | 'fortress' | 'city' | 'village' | 'base' | 'ruin' | 'lair';
  defense: number; income: Partial<Res>; pop: number; desc: string; flatR: number;
}
const T = (id: string, name: string, region: RegionId, faction: FactionId, p: [number, number], type: TerritoryDef['type'], defense: number, income: Partial<Res>, pop: number, desc: string): TerritoryDef =>
  ({ id, name, region, faction, x: p[0], z: p[1], type, defense, income, pop, desc, flatR: type === 'city' || type === 'capital' ? 70 : 48 });

export const TERRITORIES: TerritoryDef[] = [
  T('capital', 'Demon Capital — Nox Infernum', 'capital', 'demon', [0, 0], 'capital', 9000, { gold: 900, crystals: 90, mana: 60, food: 250, supplies: 120 }, 480000, 'The seat of your power.'),
  T('infernos_keep', "Infernos' Keep", 'bloodfire', 'demon', pol(-8, 420), 'fortress', 3400, { gold: 220, crystals: 60, supplies: 90 }, 42000, 'A volcanic fortress over a river of magma.'),
  T('azrakar_bastion', 'Azrakar Bastion', 'bloodfire', 'rival', pol(10, 560), 'fortress', 3000, { gold: 260, crystals: 70, mana: 40 }, 38000, 'Stronghold of the rebel Demon Lord Azrakar.'),
  T('aurelia', 'Aurelia, Capital of Men', 'human', 'human', pol(45, 500), 'city', 3800, { gold: 520, food: 260, supplies: 70 }, 310000, 'The shining capital of the Human Empire.'),
  T('stormwatch', 'Stormwatch Fortress', 'human', 'human', pol(30, 390), 'fortress', 2400, { gold: 150, supplies: 130 }, 21000, 'A border fortress facing your realm.'),
  T('greenhollow', 'Greenhollow Village', 'human', 'human', pol(58, 360), 'village', 800, { food: 220, gold: 60 }, 6000, 'A farming village of the Empire.'),
  T('ironkeep', 'Ironkeep Military Base', 'human', 'human', pol(62, 570), 'base', 2800, { supplies: 200, gold: 100 }, 17000, 'The Empire’s largest army base.'),
  T('umbra_sanctum', 'Umbra Sanctum', 'shadow', 'demon', pol(80, 430), 'fortress', 3000, { crystals: 70, mana: 55, gold: 120 }, 25000, 'A hidden temple in the heart of the forest.'),
  T('behemoth_den', "Behemoth's Den", 'shadow', 'demon', pol(102, 520), 'fortress', 3300, { food: 200, supplies: 110 }, 29000, 'A cavern-fortress of monstrous beasts.'),
  T('nyxara_spire', 'Nyxara Spire', 'ruins', 'demon', pol(128, 410), 'fortress', 2800, { mana: 110, crystals: 60 }, 15000, 'A sorcery tower rising from ancient stones.'),
  T('mortis_necropolis', 'Mortis Necropolis', 'ruins', 'demon', pol(150, 520), 'fortress', 3000, { supplies: 80, mana: 60, gold: 80 }, 18000, 'A necropolis of endless undead legions.'),
  T('forgotten_vault', 'The Forgotten Vault', 'ruins', 'ancient', pol(138, 610), 'ruin', 3600, { crystals: 120, mana: 90 }, 0, 'An ancient dungeon sealed by a dead civilization.'),
  T('abyssal_palace', 'Abyssal Palace', 'ocean', 'demon', pol(180, 470), 'fortress', 4200, { gold: 200, crystals: 90, food: 180 }, 60000, 'The drowned court of the Ocean Commanders.'),
  T('leviathan_reef', 'Leviathan Reef', 'ocean', 'ancient', pol(163, 610), 'lair', 3200, { food: 160, crystals: 60 }, 0, 'A reef where abyssal beasts nest.'),
  T('drakmor_aerie', "Drakmor's Aerie", 'dragon', 'demon', pol(-138, 430), 'fortress', 3400, { supplies: 100, gold: 140 }, 14000, 'Dragon-rider roost carved in the cliffs.'),
  T('dragon_nest_peak', 'Dragon Nest Peak', 'dragon', 'ancient', pol(-122, 570), 'lair', 4000, { crystals: 110, gold: 150 }, 0, 'The nest of the Ancient Dragon King.'),
  T('glacius_citadel', 'Glacius Citadel', 'frozen', 'demon', pol(-98, 420), 'fortress', 3200, { mana: 80, supplies: 90 }, 19000, 'An ice fortress older than the kingdom.'),
  T('titans_rest', "Titan's Rest", 'frozen', 'ancient', pol(-82, 570), 'lair', 3800, { crystals: 100, supplies: 120 }, 0, 'A frozen valley where a titan sleeps.'),
  T('solaris_citadel', 'Solaris Citadel', 'celestial', 'celestial', pol(-48, 520), 'fortress', 4300, { gold: 300, mana: 120 }, 35000, 'Radiant fortress of the angelic hosts.'),
  T('dawnspire', 'Dawnspire Sanctum', 'celestial', 'celestial', pol(-36, 610), 'fortress', 4800, { gold: 340, mana: 140, crystals: 80 }, 22000, 'Seat of the Celestial Emperor.'),
];
export const TERR_BY_ID = Object.fromEntries(TERRITORIES.map((t) => [t.id, t])) as Record<string, TerritoryDef>;

export interface GeneralDef {
  id: string; name: string; title: string; color: string; glow: string; personality: string; army: string;
  territory: string; ability: string; abilityDesc: string; focus: UnitType[]; power: number; voice: number;
  lines: string[]; hq: { angle: number }; element: string;
}
export const GENERALS: GeneralDef[] = [
  { id: 'infernos', name: 'INFERNOS', title: 'Fire General', color: '#ff5a1f', glow: '#ffb347', personality: 'Boisterous, proud and hungry for battle. Speaks in boasts and flames.', army: 'Fire demons, destruction units, volcanic forces', territory: 'infernos_keep', ability: 'Magma Nova', abilityDesc: 'Detonates a ring of magma around himself.', focus: ['heavy', 'siege'], power: 900, voice: 95, element: 'fire', hq: { angle: -150 },
    lines: ['My liege! The magma boils for your command. Say the word and the human cities will be glass.', 'Let me burn Stormwatch to ash. My flames grow impatient!', 'Fire is not destruction, my Lord — it is your will made visible.'] },
  { id: 'glacius', name: 'GLACIUS', title: 'Ice General', color: '#7fd8ff', glow: '#d8f6ff', personality: 'Calm, calculating and cold. Values patience and perfect defense.', army: 'Frost demons, defensive forces, ice warriors', territory: 'glacius_citadel', ability: 'Glacial Prison', abilityDesc: 'Freezes the ground and hurls ice spears.', focus: ['heavy', 'knights'], power: 860, voice: 70, element: 'ice', hq: { angle: -110 },
    lines: ['Haste is the enemy of victory, Majesty. Winter waits for no fool, and neither shall we.', 'The northern passes are sealed. Nothing crosses without your leave.', 'I have counted the enemy. Their numbers will thin as the frost deepens.'] },
  { id: 'umbra', name: 'UMBRA', title: 'Shadow General', color: '#8a4bff', glow: '#d3b3ff', personality: 'Whispering, loyal and unnervingly quiet. Appears wherever he is needed.', army: 'Shadow assassins, stealth units, elite shadow forces', territory: 'umbra_sanctum', ability: 'Umbral Execution', abilityDesc: 'Blinks between foes, slashing each in turn.', focus: ['assassins', 'elite'], power: 880, voice: 55, element: 'shadow', hq: { angle: -70 },
    lines: ['...I was already behind you, my Lord. Do not be alarmed.', 'The enemy king sleeps in his tower. I have counted his guards — twelve. Soon: none.', 'Shadows have no loyalty but you. Order, and I shall unmake them.'] },
  { id: 'behemoth', name: 'BEHEMOTH', title: 'Beast General', color: '#c98a3a', glow: '#ffd27a', personality: 'Gruff, enormous and loyal as a hound. Thinks with his fists.', army: 'Gigantic beasts, monster armies, heavy assault', territory: 'behemoth_den', ability: 'Titan Stampede', abilityDesc: 'Charges forward, trampling everything.', focus: ['giants', 'heavy'], power: 1000, voice: 30, element: 'beast', hq: { angle: -30 },
    lines: ['HAH! My beasts are hungry, Majesty! Give them a wall to break!', 'Siege towers? I ate one yesterday. Tasted of wood.', 'Where you point, I break. Simple. Good.'] },
  { id: 'nyxara', name: 'NYXARA', title: 'Dark Sorcery General', color: '#ff4fd0', glow: '#ffc3ee', personality: 'Elegant, theatrical and brilliant. Sees all wars as grand rituals.', army: 'Magical units, spellcasters, dark mages', territory: 'nyxara_spire', ability: 'Void Orbs', abilityDesc: 'Summons orbiting dark orbs that seek foes.', focus: ['mages', 'archers'], power: 920, voice: 80, element: 'dark', hq: { angle: 30 },
    lines: ['Oh, my Lord, the ritual circles hum with delight. Shall we rewrite a kingdom tonight?', 'The Celestials guard their sky with light. Light, however, casts such lovely shadows.', 'Mana is a river, and I am the tide. Command me.'] },
  { id: 'drakmor', name: 'DRAKMOR', title: 'Dragon General', color: '#e8c24a', glow: '#fff0a8', personality: 'Haughty, honorable and fiercely competitive with the other generals.', army: 'Dragon riders, flying units, aerial warfare', territory: 'drakmor_aerie', ability: 'Dragon Dive', abilityDesc: 'Plunges from the sky in a burst of dragonfire.', focus: ['dragons', 'archers'], power: 960, voice: 40, element: 'dragon', hq: { angle: 70 },
    lines: ['The skies belong to us, Majesty. The Celestials merely borrow them.', 'My riders have mapped the Human air defenses. A single sweep will break them.', 'Honor demands I be first into the fire — Infernos can follow me.'] },
  { id: 'mortis', name: 'MORTIS', title: 'Undead General', color: '#7dffa0', glow: '#d4ffe0', personality: 'Dry-witted, patient and eerily polite. Has outlived three kingdoms.', army: 'Undead warriors, necromancers, resurrection forces', territory: 'mortis_necropolis', ability: 'Grave Rising', abilityDesc: 'Raises skeletal warriors from the dead earth.', focus: ['undead', 'mages'], power: 890, voice: 20, element: 'undead', hq: { angle: 120 },
    lines: ['Death is merely a delay, my Lord. I will have every fallen soldier back on his feet by dawn.', 'Do not mourn casualties. Simply... borrow them again.', 'The dead are the most obedient army. They never ask for pay.'] },
];
export const GEN_BY_ID = Object.fromEntries(GENERALS.map((g) => [g.id, g])) as Record<string, GeneralDef>;

export interface CommanderDef { id: string; name: string; title: string; color: string; ability: string; territory: string; army: string; lines: string[]; pos: [number, number]; power: number }
export const COMMANDERS: CommanderDef[] = [
  { id: 'abyssal_king', name: 'ABYSSAL KING', title: 'Supreme Sea Commander', color: '#2f7fff', ability: 'Trident of Ruin', territory: 'abyssal_palace', army: 'Royal Abyssal Guard', pos: pol(180, 470), power: 1200,
    lines: ['The tides bow to the throne, Majesty. As do I.', 'Every drowned kingdom answers to you through me.'] },
  { id: 'leviathan', name: 'LEVIATHAN', title: 'Sea Monster Commander', color: '#19b39a', ability: 'Tidal Roar', territory: 'leviathan_reef', army: 'Sea monster legions', pos: pol(168, 590), power: 1100,
    lines: ['*A low rumble shakes the sea floor.* We are... hungry for orders.', 'The reef is quiet. Quiet things grow vast.'] },
  { id: 'tidal_queen', name: 'TIDAL QUEEN', title: 'Water Magic Commander', color: '#53e0ff', ability: 'Maelstrom', territory: 'abyssal_palace', army: 'Tide-witches and water mages', pos: pol(176, 400), power: 1050,
    lines: ['Dear Lord, the water remembers every secret. And it tells me everything.', 'Shall I drown a fleet for you? It is such a nice evening.'] },
  { id: 'kraken', name: 'KRAKEN', title: 'Giant Sea Creature Commander', color: '#c24bff', ability: 'Eight Arms of Doom', territory: 'leviathan_reef', army: 'Giant tentacle beasts', pos: pol(190, 560), power: 1150,
    lines: ['Eight arms. Eight oaths. All for you, Lord.', 'Ships are such fragile toys.'] },
  { id: 'deepwarden', name: 'DEEPWARDEN', title: 'Underwater Fortress Commander', color: '#8fa7b8', ability: 'Bulwark of the Deep', territory: 'abyssal_palace', army: 'Armored fortress sentinels', pos: pol(160, 520), power: 1000,
    lines: ['Nothing passes the Deep Gate. Not tide, not army, not god.', 'The fortress stands. It will always stand.'] },
];

export interface UnitDef { name: string; cost: Res; power: number; desc: string; vis: string }
const C = (gold: number, crystals = 0, food = 0, supplies = 0, mana = 0): Res => ({ gold, crystals, food, supplies, mana });
export const UNITS: Record<UnitType, UnitDef> = {
  infantry: { name: 'Demon Infantry', cost: C(40, 0, 8, 2), power: 1, desc: 'Horned footsoldiers. The backbone of the army.', vis: 'infantry' },
  knights: { name: 'Elite Demon Knights', cost: C(150, 2, 12, 15), power: 4, desc: 'Heavily armored cavalry-class warriors.', vis: 'knight' },
  assassins: { name: 'Shadow Assassins', cost: C(200, 8, 6, 5), power: 5, desc: 'Silent killers that strike generals.', vis: 'assassin' },
  archers: { name: 'Hellfire Archers', cost: C(70, 1, 8, 8), power: 2, desc: 'Ranged units firing flaming arrows.', vis: 'archer' },
  mages: { name: 'Dark Magi', cost: C(180, 15, 8, 0, 10), power: 6, desc: 'Spellcasters that bombard the battlefield.', vis: 'mage' },
  heavy: { name: 'Heavy Monsters', cost: C(300, 10, 25, 20), power: 10, desc: 'Armored ogres and bruisers.', vis: 'heavy' },
  giants: { name: 'Giant Beasts', cost: C(700, 50, 60, 40), power: 28, desc: 'Titanic monsters that crush walls.', vis: 'giant' },
  dragons: { name: 'Dragons', cost: C(2500, 200, 150, 100), power: 120, desc: 'Winged destroyers of the sky.', vis: 'dragon' },
  siege: { name: 'Siege Monsters', cost: C(600, 20, 30, 80), power: 20, desc: 'Living siege engines.', vis: 'siege' },
  undead: { name: 'Undead Warriors', cost: C(60, 8, 0, 4, 4), power: 1.5, desc: 'Risen skeletal warriors. No food needed.', vis: 'skeleton' },
  elite: { name: 'Special Elite Units', cost: C(900, 100, 40, 40, 30), power: 40, desc: 'Hand-picked champions of the Demon Lord.', vis: 'elite' },
};
export const UNIT_KEYS = Object.keys(UNITS) as UnitType[];
export const START_UNITS: Record<UnitType, number> = { infantry: 4200, knights: 900, assassins: 600, archers: 1500, mages: 500, heavy: 250, giants: 40, dragons: 12, siege: 60, undead: 2000, elite: 80 };

export const BUILDINGS: Record<string, { name: string; desc: string; cost: Partial<Res>; max: number }> = {
  barracks: { name: 'Barracks', desc: '+2000 army capacity and +2% defense per level.', cost: { gold: 800, supplies: 150 }, max: 3 },
  mine: { name: 'Crystal Mine', desc: '+40 Demon Crystals per day per level.', cost: { gold: 900, supplies: 100 }, max: 3 },
  farm: { name: 'Blood Farm', desc: '+120 Food per day per level, boosts population.', cost: { gold: 500, supplies: 60 }, max: 3 },
  market: { name: 'Black Market', desc: '+180 Gold per day per level.', cost: { gold: 700, supplies: 50 }, max: 3 },
  manawell: { name: 'Mana Well', desc: '+45 Mana per day per level.', cost: { gold: 900, crystals: 60 }, max: 3 },
  forge: { name: 'Infernal Forge', desc: '+70 Military Supplies per day per level.', cost: { gold: 750, crystals: 20 }, max: 3 },
  walls: { name: 'Fortress Walls', desc: '+900 defense per level (upgrade fortress).', cost: { gold: 1200, supplies: 300, crystals: 30 }, max: 5 },
  temple: { name: 'Blood Temple', desc: '+3 loyalty/day to the assigned general, +population.', cost: { gold: 1000, crystals: 80 }, max: 3 },
};

export type ItemSlot = 'weapon' | 'armor' | 'ring' | 'artifact' | 'dragon';
export type WeaponType = 'sword' | 'greatsword' | 'spear' | 'dual' | 'staff';
export interface Stats { atk?: number; def?: number; hp?: number; mana?: number; crit?: number; speed?: number; regen?: number }
export interface ItemDef { id: string; name: string; slot: ItemSlot; wtype?: WeaponType; rarity: 'epic' | 'legendary' | 'mythic'; stats: Stats; color: string; color2: string; desc: string; armorSet?: number }
export const ITEMS: ItemDef[] = [
  { id: 'voidreaver', name: 'Voidreaver', slot: 'weapon', wtype: 'sword', rarity: 'legendary', stats: { atk: 120, crit: 10 }, color: '#ff2d55', color2: '#2a0710', desc: 'The Demon Lord’s sword. Its blade drinks light.' },
  { id: 'behemoth_edge', name: "Behemoth's Edge", slot: 'weapon', wtype: 'greatsword', rarity: 'legendary', stats: { atk: 210, speed: -8, crit: 6 }, color: '#ffb347', color2: '#3a2208', desc: 'A slab of cursed iron. Slow, but cleaves armies.' },
  { id: 'hellpiercer', name: 'Hellpiercer', slot: 'weapon', wtype: 'spear', rarity: 'legendary', stats: { atk: 150, crit: 12 }, color: '#ff7a1a', color2: '#2a1005', desc: 'A lance of volcanic glass with extreme reach.' },
  { id: 'twin_fangs', name: 'Twin Eclipse Fangs', slot: 'weapon', wtype: 'dual', rarity: 'legendary', stats: { atk: 95, speed: 12, crit: 20 }, color: '#b36bff', color2: '#150a24', desc: 'Dual blades forged under a black sun.' },
  { id: 'staff_ruin', name: 'Staff of Ruin', slot: 'weapon', wtype: 'staff', rarity: 'mythic', stats: { atk: 85, mana: 250, regen: 6 }, color: '#3ff0ff', color2: '#0a1c2a', desc: 'A staff channeling endless mana.' },
  { id: 'frostbrand', name: 'Frostbrand Reaver', slot: 'weapon', wtype: 'sword', rarity: 'epic', stats: { atk: 100, crit: 14 }, color: '#8fe3ff', color2: '#0b1b2a', desc: 'Frozen blade taken from Glacius’s vault.' },
  { id: 'sunbreaker', name: 'Sunbreaker (Celestial)', slot: 'weapon', wtype: 'greatsword', rarity: 'mythic', stats: { atk: 260, def: 20 }, color: '#ffe48a', color2: '#4a3a10', desc: 'Stolen divine blade of the Celestial Emperor.' },
  { id: 'crimson_royal', name: 'Crimson Royal Armor', slot: 'armor', rarity: 'legendary', stats: { def: 80, hp: 600 }, color: '#d4143c', color2: '#120508', desc: 'Black and crimson armor of the Demon Lord.', armorSet: 0 },
  { id: 'abyssal_plate', name: 'Abyssal Void Plate', slot: 'armor', rarity: 'legendary', stats: { def: 110, hp: 400, mana: 120 }, color: '#8a4bff', color2: '#0b0716', desc: 'Violet-veined armor from the dark between worlds.', armorSet: 1 },
  { id: 'dragonbone_mail', name: 'Dragonbone Regalia', slot: 'armor', rarity: 'mythic', stats: { def: 140, hp: 900, atk: 20 }, color: '#e8d9a8', color2: '#3a2a10', desc: 'Armor of bone and gold from the Dragon King.', armorSet: 2 },
  { id: 'ring_blood', name: 'Ring of Blood Oaths', slot: 'ring', rarity: 'epic', stats: { atk: 40, hp: 150 }, color: '#ff2d55', color2: '#300', desc: 'Strength through bound souls.' },
  { id: 'ring_mana', name: 'Ring of the Void Well', slot: 'ring', rarity: 'epic', stats: { mana: 150, regen: 4 }, color: '#3fb0ff', color2: '#012', desc: 'Doubles as a mana reservoir.' },
  { id: 'ring_swift', name: 'Ring of Hurricane Step', slot: 'ring', rarity: 'epic', stats: { speed: 10, crit: 8 }, color: '#8fffb0', color2: '#031', desc: 'The wearer moves like wind.' },
  { id: 'ring_tyrant', name: 'Tyrant’s Signet', slot: 'ring', rarity: 'legendary', stats: { atk: 70, def: 25 }, color: '#ffd24a', color2: '#310', desc: 'Signet of the first Demon King.' },
  { id: 'art_crown', name: 'Crown of Seven Sins', slot: 'artifact', rarity: 'legendary', stats: { atk: 60, mana: 180, crit: 5 }, color: '#c04bff', color2: '#100', desc: 'Whispers secrets of seven sins.' },
  { id: 'art_eye', name: 'Eye of the Abyss', slot: 'artifact', rarity: 'legendary', stats: { crit: 25, regen: 5 }, color: '#2fffe0', color2: '#012', desc: 'Foresees the weak spot of any foe.' },
  { id: 'art_heart', name: 'Heart of the Volcano', slot: 'artifact', rarity: 'legendary', stats: { hp: 800, def: 30 }, color: '#ff5a1f', color2: '#210', desc: 'A beating heart of magma.' },
  { id: 'art_hourglass', name: 'Hourglass of Ruin', slot: 'artifact', rarity: 'mythic', stats: { regen: 12, speed: 6 }, color: '#e8e8ff', color2: '#112', desc: 'Time itself bends to its owner.' },
  { id: 'dragon_mantle', name: 'Dragon Scale Mantle', slot: 'dragon', rarity: 'legendary', stats: { def: 50, speed: 8 }, color: '#e8c24a', color2: '#210', desc: 'Scales from a hundred dragons. Boosts summoned dragons.' },
  { id: 'dragon_fang', name: 'Dragonfang Talisman', slot: 'dragon', rarity: 'mythic', stats: { atk: 80, crit: 10 }, color: '#ff6a2a', color2: '#210', desc: 'Empowers dragon summons with extra fire.' },
];
export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i])) as Record<string, ItemDef>;
export const START_INVENTORY = ['voidreaver', 'behemoth_edge', 'hellpiercer', 'twin_fangs', 'staff_ruin', 'crimson_royal', 'abyssal_plate', 'ring_blood', 'ring_mana', 'ring_swift', 'art_crown', 'art_eye', 'dragon_mantle'];

export interface QuestDef { id: string; name: string; desc: string; kind: 'kill' | 'boss' | 'conquer' | 'visit' | 'defend' | 'build'; target: string; n: number; reward: { gold: number; crystals: number; item?: string }; }
export const QUESTS: QuestDef[] = [
  { id: 'q_defend', name: 'Defend the Demon Capital', desc: 'Repel invaders when an enemy host attacks Nox Infernum. Defeat 12 raiders.', kind: 'defend', target: 'capital', n: 12, reward: { gold: 5000, crystals: 200 } },
  { id: 'q_human', name: 'Conquer the Human Empire', desc: 'Capture Stormwatch Fortress and Greenhollow Village.', kind: 'conquer', target: 'stormwatch,greenhollow', n: 2, reward: { gold: 8000, crystals: 400, item: 'ring_tyrant' } },
  { id: 'q_god', name: 'Slay the Celestial Emperor', desc: 'Ascend to the Celestial Domain and defeat the Celestial Emperor.', kind: 'boss', target: 'celestial_emperor', n: 1, reward: { gold: 15000, crystals: 800, item: 'sunbreaker' } },
  { id: 'q_ruin', name: 'Investigate the Ancient Ruins', desc: 'Travel to the Forgotten Vault in the Ancient Ruins.', kind: 'visit', target: 'forgotten_vault', n: 1, reward: { gold: 3000, crystals: 300, item: 'art_hourglass' } },
  { id: 'q_protect', name: 'Protect the Fortresses', desc: 'Defeat 15 invaders attacking your territories.', kind: 'defend', target: 'any', n: 15, reward: { gold: 4000, crystals: 150 } },
  { id: 'q_rival', name: 'Eliminate the Rival Demon Lord', desc: 'Defeat Azrakar in the Bloodfire Wasteland.', kind: 'boss', target: 'rival_lord', n: 1, reward: { gold: 9000, crystals: 500, item: 'art_heart' } },
  { id: 'q_dragon', name: 'Defeat the Giant Dragon', desc: 'Slay Vyrmathor, the Ancient Dragon King.', kind: 'boss', target: 'dragon_king', n: 1, reward: { gold: 9000, crystals: 600, item: 'dragonbone_mail' } },
  { id: 'q_invasion', name: 'Stop the Enemy Invasion', desc: 'Defeat 25 enemies in the Human Empire.', kind: 'kill', target: 'human', n: 25, reward: { gold: 3500, crystals: 120 } },
  { id: 'q_dimension', name: 'Discover the Forbidden Dimension', desc: 'Find the Dimensional Rift in the Shadow Forest and destroy the Dimensional Destroyer.', kind: 'boss', target: 'dimensional_destroyer', n: 1, reward: { gold: 12000, crystals: 900, item: 'dragon_fang' } },
  { id: 'q_build', name: 'Master Builder', desc: 'Construct 3 buildings in your territories.', kind: 'build', target: 'any', n: 3, reward: { gold: 2000, crystals: 100 } },
];

export interface BossDef { id: string; name: string; title: string; region: RegionId; pos: [number, number]; hp: number; scale: number; color: string; reward: { gold: number; crystals: number; item?: string }; cat: string; intro: string }
export const BOSSES: BossDef[] = [
  { id: 'dragon_king', name: 'VYRMATHOR', title: 'Ancient Dragon King', region: 'dragon', pos: pol(-122, 540), hp: 18000, scale: 1, color: '#e8b64a', reward: { gold: 6000, crystals: 400, item: 'dragonbone_mail' }, cat: 'Ancient Dragon', intro: 'The mountain shakes. The Dragon King wakes.' },
  { id: 'celestial_emperor', name: 'SERAPHIEL', title: 'Celestial Emperor', region: 'celestial', pos: pol(-36, 590), hp: 24000, scale: 1, color: '#fff3b0', reward: { gold: 9000, crystals: 600, item: 'sunbreaker' }, cat: 'Celestial Emperor', intro: 'Kneel, demon. The heavens judge you.' },
  { id: 'frost_titan', name: 'KRYOLOTH', title: 'Giant Titan', region: 'frozen', pos: pol(-82, 540), hp: 30000, scale: 1, color: '#9ed8ff', reward: { gold: 7000, crystals: 500, item: 'frostbrand' }, cat: 'Giant Titan', intro: 'The ice cracks. The Titan rises.' },
  { id: 'rival_lord', name: 'AZRAKAR', title: 'Rival Demon Lord', region: 'bloodfire', pos: pol(10, 540), hp: 14000, scale: 1, color: '#b04cff', reward: { gold: 6500, crystals: 450, item: 'art_heart' }, cat: 'Rival Demon Lord', intro: 'You dare sit the throne I was denied?' },
  { id: 'sea_beast', name: 'THALASSOR', title: 'Abyssal Sea Beast', region: 'ocean', pos: pol(168, 575), hp: 20000, scale: 1, color: '#2fffd0', reward: { gold: 6000, crystals: 700, item: 'ring_tyrant' }, cat: 'Abyssal Sea Beast', intro: 'The deep devours all.' },
  { id: 'ancient_god', name: 'OZYMAN', title: 'Ancient God of Ruin', region: 'ruins', pos: pol(138, 585), hp: 28000, scale: 1, color: '#ffb84a', reward: { gold: 9000, crystals: 700, item: 'art_hourglass' }, cat: 'Ancient God', intro: 'I was old when your kind learned fire.' },
  { id: 'dimensional_destroyer', name: 'NULL-EYE', title: 'Dimensional Destroyer', region: 'shadow', pos: pol(92, 470), hp: 22000, scale: 1, color: '#ff4fd0', reward: { gold: 10000, crystals: 900, item: 'dragon_fang' }, cat: 'Dimensional Destroyer', intro: 'REALITY... IS... OPTIONAL.' },
];
export const BOSS_BY_ID = Object.fromEntries(BOSSES.map((b) => [b.id, b])) as Record<string, BossDef>;

export interface EnemyType {
  id: string; name: string; fac: FactionId; hp: number; dmg: number; speed: number; scale: number; ranged?: boolean; flying?: boolean; kind: 'humanoid' | 'wyvern' | 'brute';
  cfg: Record<string, unknown>; xp: number; proj?: string;
}
export const ENEMY_TYPES: Record<string, EnemyType> = {
  imp: { id: 'imp', name: 'Fire Imp', fac: 'rival', hp: 120, dmg: 18, speed: 8, scale: 0.8, kind: 'humanoid', xp: 1, cfg: { skin: '#ff6a2a', armor: '#3a1208', trim: '#ffb347', cloth: '#7a1a08', glow: '#ffcc33', horns: 'demon', hornColor: '#2a0a04', weapon: 'club', tail: true, hair: 'flame', hairColor: '#ff8a1a' } },
  rival_soldier: { id: 'rival_soldier', name: 'Rival Demon Guard', fac: 'rival', hp: 220, dmg: 28, speed: 8, scale: 1.05, kind: 'humanoid', xp: 2, cfg: { skin: '#7a4a9a', armor: '#2a1838', trim: '#c07aff', cloth: '#401860', glow: '#d27aff', horns: 'ram', hornColor: '#c8b0e0', weapon: 'sword', shield: true, helm: 'horned' } },
  magma_golem: { id: 'magma_golem', name: 'Magma Golem', fac: 'rival', hp: 900, dmg: 55, speed: 5, scale: 2.1, kind: 'brute', xp: 6, cfg: { skin: '#2a1a14', armor: '#3a2218', trim: '#ff6a1a', cloth: '#1a0a06', glow: '#ff7a1a', horns: 'none', weapon: 'none', bulk: 1.9, helm: 'none', hair: 'flame', hairColor: '#ff4a0a' } },
  shadow_stalker: { id: 'shadow_stalker', name: 'Shadow Stalker', fac: 'ancient', hp: 190, dmg: 30, speed: 11, scale: 1.0, kind: 'humanoid', xp: 2, cfg: { skin: '#120a1e', armor: '#0a0612', trim: '#7a3aff', cloth: '#1a0a2a', glow: '#b36bff', horns: 'long', hornColor: '#1a0a2a', weapon: 'dual', hood: true } },
  wraith: { id: 'wraith', name: 'Forest Wraith', fac: 'ancient', hp: 150, dmg: 32, speed: 7, scale: 1.1, ranged: true, kind: 'humanoid', xp: 3, proj: '#a56bff', cfg: { skin: '#3a2a5a', armor: '#150d28', trim: '#8a5aff', cloth: '#251440', glow: '#e0c0ff', horns: 'none', weapon: 'staff', hood: true } },
  frost_warrior: { id: 'frost_warrior', name: 'Frost Warrior', fac: 'ancient', hp: 260, dmg: 30, speed: 8, scale: 1.1, kind: 'humanoid', xp: 3, cfg: { skin: '#8fc8e8', armor: '#3a5a78', trim: '#d8f4ff', cloth: '#1c3048', glow: '#aef0ff', horns: 'crown', hornColor: '#e8fbff', weapon: 'greatsword', helm: 'crest' } },
  ice_golem: { id: 'ice_golem', name: 'Ice Golem', fac: 'ancient', hp: 1000, dmg: 58, speed: 4.5, scale: 2.2, kind: 'brute', xp: 6, cfg: { skin: '#a8e0ff', armor: '#6aa8d0', trim: '#ffffff', cloth: '#385a78', glow: '#e0faff', horns: 'crown', hornColor: '#ffffff', weapon: 'none', bulk: 2.0 } },
  wyvern: { id: 'wyvern', name: 'Mountain Wyvern', fac: 'ancient', hp: 420, dmg: 40, speed: 16, scale: 1, flying: true, kind: 'wyvern', xp: 5, cfg: { color: '#6a7a4a', belly: '#c8b078', glow: '#ffcc33' } },
  drake_cultist: { id: 'drake_cultist', name: 'Dragon Cultist', fac: 'ancient', hp: 240, dmg: 34, speed: 8, scale: 1.1, kind: 'humanoid', xp: 3, cfg: { skin: '#a87a50', armor: '#5a3a18', trim: '#ffd05a', cloth: '#7a1a10', glow: '#ffb030', horns: 'ram', hornColor: '#e8d8b8', weapon: 'spear', helm: 'horned' } },
  merfolk: { id: 'merfolk', name: 'Abyssal Merfolk', fac: 'ancient', hp: 230, dmg: 30, speed: 9, scale: 1.05, kind: 'humanoid', xp: 3, cfg: { skin: '#2a8a8a', armor: '#0f3a4a', trim: '#53e0ff', cloth: '#0a2a3a', glow: '#7affea', horns: 'crown', hornColor: '#a8fff0', weapon: 'spear', tail: true, hair: 'long', hairColor: '#1a6a6a' } },
  angler: { id: 'angler', name: 'Deep Lurker', fac: 'ancient', hp: 600, dmg: 50, speed: 7, scale: 1.8, kind: 'brute', xp: 5, cfg: { skin: '#1a2a3a', armor: '#0a1a28', trim: '#7affea', cloth: '#050f18', glow: '#7affea', horns: 'long', hornColor: '#7affea', weapon: 'none', bulk: 1.7 } },
  h_soldier: { id: 'h_soldier', name: 'Imperial Soldier', fac: 'human', hp: 200, dmg: 24, speed: 8, scale: 1.0, kind: 'humanoid', xp: 2, cfg: { skin: '#e0b090', armor: '#6a7a8a', trim: '#c0c8d0', cloth: '#2a4a9a', glow: '#000000', horns: 'none', weapon: 'sword', shield: true, helm: 'knight' } },
  h_knight: { id: 'h_knight', name: 'Imperial Knight', fac: 'human', hp: 420, dmg: 40, speed: 7.5, scale: 1.12, kind: 'humanoid', xp: 4, cfg: { skin: '#e0b090', armor: '#aab4c0', trim: '#ffd24a', cloth: '#1a3aa0', glow: '#000000', horns: 'none', weapon: 'greatsword', helm: 'crest' } },
  h_archer: { id: 'h_archer', name: 'Imperial Archer', fac: 'human', hp: 140, dmg: 22, speed: 8, scale: 1.0, ranged: true, kind: 'humanoid', xp: 2, proj: '#d8c090', cfg: { skin: '#e0b090', armor: '#4a5a3a', trim: '#a08a50', cloth: '#2a3a1a', glow: '#000000', horns: 'none', weapon: 'bow', hood: true } },
  h_guard: { id: 'h_guard', name: 'Royal Guard', fac: 'human', hp: 520, dmg: 44, speed: 7, scale: 1.15, kind: 'humanoid', xp: 5, cfg: { skin: '#e0b090', armor: '#d8d8e8', trim: '#ffd24a', cloth: '#a01818', glow: '#000000', horns: 'none', weapon: 'spear', shield: true, helm: 'crest' } },
  h_mage: { id: 'h_mage', name: 'Imperial Mage', fac: 'human', hp: 150, dmg: 34, speed: 7, scale: 1.0, ranged: true, kind: 'humanoid', xp: 3, proj: '#5ab0ff', cfg: { skin: '#e0b090', armor: '#2a3a8a', trim: '#8ac8ff', cloth: '#1a2a70', glow: '#6ab8ff', horns: 'none', weapon: 'staff', hood: true } },
  angel: { id: 'angel', name: 'Angelic Warrior', fac: 'celestial', hp: 340, dmg: 40, speed: 11, scale: 1.1, kind: 'humanoid', xp: 4, cfg: { skin: '#fff0e0', armor: '#f4f0e0', trim: '#ffd24a', cloth: '#ffffff', glow: '#fff3a0', horns: 'none', weapon: 'sword', wings: 'angel', halo: true, helm: 'crest' } },
  divine_knight: { id: 'divine_knight', name: 'Divine Knight', fac: 'celestial', hp: 700, dmg: 56, speed: 8, scale: 1.25, kind: 'humanoid', xp: 6, cfg: { skin: '#fff0e0', armor: '#fff8e0', trim: '#ffcc33', cloth: '#d8e8ff', glow: '#fff3a0', horns: 'none', weapon: 'greatsword', wings: 'angel', halo: true, helm: 'knight', shield: true } },
  holy_mage: { id: 'holy_mage', name: 'Holy Mage', fac: 'celestial', hp: 260, dmg: 46, speed: 8, scale: 1.1, ranged: true, kind: 'humanoid', xp: 5, proj: '#fff3a0', cfg: { skin: '#fff0e0', armor: '#e8e4ff', trim: '#ffd24a', cloth: '#f0f0ff', glow: '#fff8c0', horns: 'none', weapon: 'staff', wings: 'angel', halo: true } },
  skeleton: { id: 'skeleton', name: 'Skeleton Warrior', fac: 'ancient', hp: 180, dmg: 26, speed: 8, scale: 1.05, kind: 'humanoid', xp: 2, cfg: { skin: '#d8d0b8', armor: '#5a5240', trim: '#8a8060', cloth: '#2a2418', glow: '#7affa0', horns: 'none', weapon: 'sword', shield: true, helm: 'skull' } },
  guardian: { id: 'guardian', name: 'Stone Guardian', fac: 'ancient', hp: 1100, dmg: 62, speed: 4.5, scale: 2.3, kind: 'brute', xp: 7, cfg: { skin: '#8a8070', armor: '#6a6050', trim: '#ffb84a', cloth: '#3a3428', glow: '#ffb84a', horns: 'none', weapon: 'none', bulk: 2.1, helm: 'none' } },
  ruin_mage: { id: 'ruin_mage', name: 'Ruin Seer', fac: 'ancient', hp: 190, dmg: 38, speed: 7, scale: 1.05, ranged: true, kind: 'humanoid', xp: 3, proj: '#ffb84a', cfg: { skin: '#c8a878', armor: '#6a4a20', trim: '#ffd05a', cloth: '#402a10', glow: '#ffcc66', horns: 'none', weapon: 'staff', hood: true } },
};
export const REGION_ENEMIES: Partial<Record<RegionId, string[]>> = {
  bloodfire: ['imp', 'imp', 'rival_soldier', 'rival_soldier', 'magma_golem'],
  shadow: ['shadow_stalker', 'shadow_stalker', 'wraith', 'wraith'],
  frozen: ['frost_warrior', 'frost_warrior', 'ice_golem'],
  dragon: ['wyvern', 'wyvern', 'drake_cultist', 'drake_cultist'],
  ocean: ['merfolk', 'merfolk', 'angler'],
  human: ['h_soldier', 'h_soldier', 'h_archer', 'h_knight', 'h_mage', 'h_guard'],
  celestial: ['angel', 'angel', 'divine_knight', 'holy_mage'],
  ruins: ['skeleton', 'skeleton', 'guardian', 'ruin_mage'],
};
export const FACTION_RAIDERS: Record<string, string[]> = {
  human: ['h_soldier', 'h_knight', 'h_archer', 'h_mage'],
  celestial: ['angel', 'divine_knight', 'holy_mage'],
  rival: ['imp', 'rival_soldier', 'rival_soldier', 'magma_golem'],
  ancient: ['skeleton', 'guardian', 'wyvern'],
};

export const WEAPON_STATS: Record<WeaponType, { name: string; dmg: number; speed: number; reach: number; arc: number }> = {
  sword: { name: 'Demon Sword', dmg: 1, speed: 1, reach: 4.6, arc: 1.7 },
  greatsword: { name: 'Greatsword', dmg: 1.7, speed: 0.72, reach: 6.2, arc: 2.2 },
  spear: { name: 'Spear', dmg: 1.15, speed: 0.95, reach: 8, arc: 0.9 },
  dual: { name: 'Dual Blades', dmg: 0.7, speed: 1.45, reach: 4.2, arc: 1.9 },
  staff: { name: 'Magical Staff', dmg: 0.8, speed: 1, reach: 5, arc: 1.6 },
};

export const SAVE_KEY = 'demonlord_save_v2';
export const SAVE_VERSION = 2;
export const ABILITIES = [
  { key: 'E', id: 'fireball', name: 'Infernal Fireball', cd: 2, mana: 15, color: '#ff6a1a' },
  { key: 'R', id: 'beam', name: 'Destruction Beam', cd: 7, mana: 30, color: '#ff2d55' },
  { key: 'Q', id: 'teleport', name: 'Shadow Teleport', cd: 3, mana: 10, color: '#8a4bff' },
  { key: 'V', id: 'cataclysm', name: 'Cataclysm', cd: 40, mana: 80, color: '#ff1a1a' },
  { key: 'T', id: 'form', name: 'Awakened Form', cd: 8, mana: 40, color: '#e8c24a' },
  { key: 'G', id: 'army', name: 'Demon Army', cd: 25, mana: 50, color: '#c0143c' },
  { key: 'X', id: 'dragon', name: 'Summon Dragon', cd: 55, mana: 70, color: '#ffb347' },
  { key: 'F', id: 'flurry', name: 'Weapon Flurry', cd: 5, mana: 0, color: '#ffffff' },
] as const;
