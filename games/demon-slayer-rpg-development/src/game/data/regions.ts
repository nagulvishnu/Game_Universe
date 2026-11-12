import type { DialogueLine } from '../types';

export type PropKind =
  | 'pine' | 'cedar' | 'sakura' | 'maple' | 'bamboo' | 'wisteria' | 'dead' | 'rock' | 'house' | 'shop' | 'lantern' | 'redlantern'
  | 'torii' | 'webtree' | 'cocoon' | 'pillar' | 'forge' | 'wall' | 'seat' | 'tendril' | 'drum' | 'platform' | 'door' | 'crystal'
  | 'tomb' | 'log' | 'pagoda' | 'shrine' | 'cliff' | 'rail' | 'mansion' | 'lotus';

export type PropSpec = [PropKind, number, number, number] | [PropKind, number, number, number, number, number];

export interface NpcSpawn { id: string; name: string; look: string; at: [number, number]; lines: DialogueLine[]; shop?: boolean; smith?: boolean; bobs?: boolean }

export interface RegionDef {
  id: string; name: string; jp: string; sub: string; desc: string; map: [number, number]; unlock: number; level: number;
  hx: number; hz: number; hill: number; ground: [number, number]; kind: 'grass' | 'snow' | 'dirt' | 'stone' | 'tatami' | 'wood';
  sky: { day: [number, number]; night: [number, number] }; fog: number; fixedTime?: number;
  weather: 'none' | 'rain' | 'snow' | 'mist' | 'embers' | 'petals';
  props: PropSpec[]; spawn: { types: string[]; night: string[]; max: number }; music: 'calm' | 'tense' | 'dark' | 'festival' | 'sacred' | 'void';
  amb: 'forest' | 'wind' | 'village' | 'interior' | 'train' | 'forge' | 'river' | 'void'; gates: string[]; npcs: NpcSpawn[];
  collect: { kind: string; n: number }; pond?: { x: number; z: number; r: number }; waterfall?: [number, number, number];
  poi: { id: string; name: string; at: [number, number]; text: string };
  spawnPt: [number, number]; ceiling?: boolean;
}

const D: [number, number] = [0x4a90d8, 0xcfe8ff];
const N: [number, number] = [0x070a1c, 0x1a2848];

export const REGIONS: RegionDef[] = [
  {
    id: 'sagiri', name: 'Mount Sagiri', jp: '狭霧山', sub: 'Snowy home of the Kamado family', desc: 'A quiet, snow-dusted mountain where Tanjiro sells charcoal and where Urokodaki trains his pupils.',
    map: [62, 38], unlock: 0, level: 1, hx: 70, hz: 70, hill: 4.5, ground: [0xe8f0f8, 0xb8c8d8], kind: 'snow', sky: { day: [0x6aa0d8, 0xe8f2ff], night: N }, fog: 0.012, weather: 'snow',
    props: [['pine', 90, 14, 68], ['cedar', 26, 22, 68], ['rock', 20, 10, 68], ['house', 1, 0, -26, 0, -26], ['lantern', 3, -4, -20, 4, -20], ['torii', 1, 0, 55, 0, 55]],
    spawn: { types: ['grunt', 'grunt', 'fast'], night: ['fast', 'brute', 'ambush'], max: 5 }, music: 'calm', amb: 'wind', gates: ['village', 'selection', 'hashira'],
    npcs: [{ id: 'urokodaki', name: 'Sakonji Urokodaki', look: 'urokodaki', at: [8, -20], lines: [{ who: 'Urokodaki', text: 'Mount Sagiri teaches patience. Breathe, let the water flow, then strike.' }, { who: 'Urokodaki', text: 'Do not hurry to the next battle. Even a river takes time to carve stone.' }] }],
    collect: { kind: 'feather', n: 4 }, poi: { id: 'poi_sagiri', name: 'Kamado Memorial', at: [-18, -32], text: 'A small grave marker dusted with snow. Someone has left fresh flowers.' }, spawnPt: [0, 20],
  },
  {
    id: 'selection', name: 'Final Selection', jp: '最終選別', sub: 'The wisteria mountain', desc: 'Wisteria blooms in endless violet to keep demons caged. Seven nights of survival await.',
    map: [50, 60], unlock: 1, level: 3, hx: 64, hz: 64, hill: 3, ground: [0x3a4a3a, 0x2a3a2e], kind: 'grass', sky: { day: N, night: [0x100828, 0x3a2058] }, fog: 0.022, fixedTime: 0.0, weather: 'petals',
    props: [['wisteria', 80, 8, 62], ['cedar', 20, 20, 62], ['rock', 16, 8, 62], ['lantern', 8, 5, 62], ['dead', 8, 15, 60], ['torii', 1, 0, 50, 0, 50]],
    spawn: { types: ['grunt', 'fast', 'ambush', 'regen'], night: ['brute', 'fast', 'guard'], max: 6 }, music: 'dark', amb: 'forest', gates: ['sagiri', 'village', 'natagumo'],
    npcs: [{ id: 'sibling', name: 'Selection Survivor', look: 'villager', at: [6, 12], lines: [{ who: 'Survivor', text: 'Stay close to the wisteria. Demons here are starving and desperate.' }] }],
    collect: { kind: 'wisteria', n: 6 }, poi: { id: 'poi_sel', name: 'Wisteria Grove', at: [20, -30], text: 'Wisteria petals glow like moonlit rain. The scent is strong enough to repel demons.' }, spawnPt: [0, 20],
  },
  {
    id: 'village', name: 'Foothill Village', jp: '麓の村', sub: 'Quiet homes under the mountain', desc: 'A peaceful village where Demon Slayer Corps contracts are posted and rumors of vanished villagers spread.',
    map: [58, 44], unlock: 2, level: 4, hx: 60, hz: 60, hill: 2.2, ground: [0x6a9a4a, 0x5a8a40], kind: 'grass', sky: { day: D, night: N }, fog: 0.008, weather: 'none',
    props: [['house', 6, -16, -38, -16, 30], ['house', 6, 16, -38, 16, 30], ['shop', 3, -9, -10, -9, 12], ['lantern', 12, -6, -40, -6, 40], ['sakura', 14, 18, 56], ['pine', 24, 28, 58], ['rock', 10, 20, 58], ['torii', 1, 0, -50, 0, -50]],
    spawn: { types: ['grunt', 'ambush', 'caster'], night: ['brute', 'ambush', 'caster'], max: 4 }, music: 'calm', amb: 'village', gates: ['sagiri', 'asakusa', 'selection'],
    npcs: [
      { id: 'merchant', name: 'Village Merchant', look: 'merchant', at: [-4, 6], shop: true, lines: [{ who: 'Merchant', text: 'Slayer-sama! Medicine, rice balls, tonics... you will want all of it.' }] },
      { id: 'elder', name: 'Village Elder', look: 'villager', at: [5, -4], lines: [{ who: 'Elder', text: 'Our village sleeps better since the Corps visits. Please check the notice board often.' }] },
      { id: 'kid', name: 'Hanako', look: 'child', at: [10, 10], lines: [{ who: 'Hanako', text: 'My big brother went into the forest for firewood... and never came back.' }] },
    ],
    collect: { kind: 'ema', n: 5 }, poi: { id: 'poi_vil', name: 'Village Shrine', at: [30, 20], text: 'A tiny shrine. Wishes for loved ones hang everywhere.' }, spawnPt: [0, 30],
  },
  {
    id: 'asakusa', name: 'Asakusa', jp: '浅草', sub: 'Lantern-lit city of the Taisho era', desc: 'A busy city of electric light, street food and crowds. A stranger in a hat waits in the throng.',
    map: [68, 52], unlock: 3, level: 6, hx: 58, hz: 58, hill: 0.4, ground: [0x4a4650, 0x3a3640], kind: 'stone', sky: { day: [0x20203a, 0x70506a], night: [0x080a18, 0x302a48] }, fog: 0.014, fixedTime: 0.03, weather: 'none',
    props: [['shop', 8, -13, -44, -13, 40], ['shop', 8, 13, -44, 13, 40], ['house', 6, -30, -40, -30, 30], ['house', 6, 30, -40, 30, 30], ['redlantern', 24, -8, -44, -8, 44], ['redlantern', 24, 8, -44, 8, 44], ['pagoda', 1, 0, -48, 0, -48], ['lantern', 8, 4, 50]],
    spawn: { types: ['grunt', 'caster', 'fast', 'guard'], night: ['brute', 'caster', 'fast', 'guard'], max: 5 }, music: 'festival', amb: 'village', gates: ['village', 'tsuzumi', 'district'],
    npcs: [
      { id: 'muzan_ci', name: 'Mysterious Man', look: 'muzan', at: [0, -12], lines: [{ who: 'Stranger', text: 'You smell of a demon... and yet you cling to one. How curious.' }, { who: 'Tanjiro', text: 'That scent... it is the same as the one at my home! Who are you?' }] },
      { id: 'tamayo', name: 'Tamayo', look: 'tamayo', at: [-12, 14], lines: [{ who: 'Tamayo', text: 'Curing demons is a long, patient road. I will help you if you promise to protect that child.' }] },
      { id: 'vendor', name: 'Street Vendor', look: 'merchant', at: [8, 6], shop: true, lines: [{ who: 'Vendor', text: 'Taiyaki! Medicine! Charms! Fresh stock from the capital!' }] },
    ],
    collect: { kind: 'scroll', n: 4 }, poi: { id: 'poi_asa', name: 'Kaminarimon Gate', at: [0, 42], text: 'A great red lantern hangs here, humming with city noise even at night.' }, spawnPt: [0, 36],
  },
  {
    id: 'tsuzumi', name: 'Tsuzumi Mansion', jp: '鼓屋敷', sub: 'The rotating drum house', desc: 'A grand mansion whose rooms rotate with every drumbeat. Victims were lured into its maze.',
    map: [72, 58], unlock: 3, level: 8, hx: 30, hz: 30, hill: 0, ground: [0x9a7a4a, 0x8a6a40], kind: 'tatami', sky: { day: N, night: [0x1a0a10, 0x4a2020] }, fog: 0.02, fixedTime: 0.0, weather: 'none',
    props: [['mansion', 1, 0, 0, 0, 0], ['wall', 20, 0, 0, 0, 0], ['drum', 4, 6, 24], ['pillar', 10, 8, 24], ['lantern', 8, 6, 26], ['seat', 6, 6, 22]],
    spawn: { types: ['grunt', 'drummer', 'ambush'], night: ['drummer', 'brute', 'ambush'], max: 4 }, music: 'tense', amb: 'interior', gates: ['asakusa'],
    npcs: [{ id: 'hungry', name: 'Wounded Slayer', look: 'villager', at: [-10, 12], lines: [{ who: 'Slayer', text: 'The rooms spin... a drum beats every time he strikes it. Find the one who plays.' }] }],
    collect: { kind: 'scroll', n: 3 }, poi: { id: 'poi_tsu', name: 'Torn Drum Hall', at: [-16, -16], text: 'Shredded paper doors and drum fragments litter the floor.' }, spawnPt: [0, 20],
  },
  {
    id: 'natagumo', name: 'Mount Natagumo', jp: '那田蜘蛛山', sub: 'The spider family forest', desc: 'Thread-wrapped trees, glowing cocoons and a demon \'family\' bound by fear.',
    map: [48, 28], unlock: 4, level: 10, hx: 66, hz: 66, hill: 4, ground: [0x2a3a30, 0x1a2a24], kind: 'dirt', sky: { day: N, night: [0x08180e, 0x2a4a38] }, fog: 0.028, fixedTime: 0.0, weather: 'mist',
    props: [['webtree', 70, 8, 64], ['cocoon', 22, 10, 60], ['dead', 16, 12, 62], ['rock', 14, 8, 62], ['cliff', 2, 0, 0]],
    spawn: { types: ['spider', 'grunt', 'fast', 'ambush'], night: ['spider', 'fast', 'brute'], max: 6 }, music: 'dark', amb: 'forest', gates: ['selection', 'butterfly'],
    npcs: [{ id: 'trapped', name: 'Trapped Slayer', look: 'villager', at: [-12, 10], lines: [{ who: 'Slayer', text: 'Threads everywhere... Cut them with the blade - and mind the glowing ones!' }] }],
    collect: { kind: 'silk', n: 7 }, poi: { id: 'poi_nat', name: 'The Web Throne', at: [24, -30], text: 'A massive web arches over a throne of bones. Something watches from above.' }, spawnPt: [0, 28],
  },
  {
    id: 'butterfly', name: 'Butterfly Mansion', jp: '蝶屋敷', sub: 'Recovery and training', desc: 'A tranquil estate filled with wisteria, medicine and the legendary Insect Hashira.',
    map: [40, 70], unlock: 5, level: 12, hx: 52, hz: 52, hill: 1.2, ground: [0x7ab05a, 0x6a9a4a], kind: 'grass', sky: { day: D, night: N }, fog: 0.007, weather: 'petals',
    props: [['mansion', 1, 0, -20, 0, -20], ['house', 2, -26, -12, 26, -12], ['wisteria', 22, 14, 48], ['sakura', 24, 10, 48], ['lantern', 10, 6, 30], ['bamboo', 40, 28, 50], ['lotus', 1, 0, 0]],
    spawn: { types: ['grunt', 'fast'], night: ['brute', 'caster'], max: 3 }, music: 'sacred', amb: 'river', gates: ['natagumo', 'train'], pond: { x: 22, z: 18, r: 9 },
    npcs: [
      { id: 'shinobu_npc', name: 'Shinobu Kocho', look: 'shinobu', at: [-6, -2], lines: [{ who: 'Shinobu', text: 'Ara, ara. You are healing quickly. Full-body conditioning is next - I promise it will be gentle.' }] },
      { id: 'aoi', name: 'Aoi Kanzaki', look: 'villager', at: [10, 4], shop: true, lines: [{ who: 'Aoi', text: 'Do not push yourself! Take some medicine, or I will tie you to the bed.' }] },
    ],
    collect: { kind: 'wisteria', n: 5 }, poi: { id: 'poi_but', name: 'Medicinal Garden', at: [-30, 20], text: 'Rows of herbs, each labeled in careful handwriting.' }, spawnPt: [0, 24],
  },
  {
    id: 'train', name: 'Mugen Train', jp: '無限列車', sub: 'The endless dream', desc: 'A steam locomotive racing through the night, its carriages swallowed by living flesh.',
    map: [28, 48], unlock: 6, level: 14, hx: 8, hz: 56, hill: 0, ground: [0x6a4a2a, 0x5a3a20], kind: 'wood', sky: { day: N, night: [0x0a0a20, 0x3a1a3a] }, fog: 0.02, fixedTime: 0.0, weather: 'mist',
    props: [['rail', 1, 0, 0, 0, 0], ['seat', 22, -4, 4], ['tendril', 20, 0, 0], ['lantern', 8, 3, 6]],
    spawn: { types: ['flesh', 'grunt', 'fast'], night: ['flesh', 'brute'], max: 5 }, music: 'tense', amb: 'train', gates: ['butterfly', 'district'],
    npcs: [{ id: 'conductor', name: 'Conductor', look: 'villager', at: [0, 30], lines: [{ who: 'Conductor', text: 'Tickets... please. Ah, forgive me, I seem to have dozed off.' }] }],
    collect: { kind: 'ema', n: 3 }, poi: { id: 'poi_tra', name: 'Observation Car', at: [0, -40], text: 'Moonlight and wind rush through the cracked windows.' }, spawnPt: [0, 40],
  },
  {
    id: 'district', name: 'Entertainment District', jp: '遊郭', sub: 'Red lights, sharp secrets', desc: 'A glittering pleasure quarter hiding a demon\'s nest behind the paper lanterns.',
    map: [78, 40], unlock: 7, level: 16, hx: 56, hz: 56, hill: 0.3, ground: [0x4a2a30, 0x3a2028], kind: 'wood', sky: { day: [0x201020, 0x602040], night: [0x0c0414, 0x3a1030] }, fog: 0.016, fixedTime: 0.0, weather: 'none',
    props: [['shop', 9, -12, -46, -12, 42], ['shop', 9, 12, -46, 12, 42], ['redlantern', 30, -7, -46, -7, 46], ['redlantern', 30, 7, -46, 7, 46], ['house', 6, -30, -40, -30, 30], ['house', 6, 30, -40, 30, 30], ['pagoda', 2, 0, -50, 0, -50]],
    spawn: { types: ['obi', 'caster', 'fast', 'regen'], night: ['obi', 'brute', 'caster'], max: 6 }, music: 'festival', amb: 'village', gates: ['train', 'asakusa', 'smith'],
    npcs: [{ id: 'tengen_npc', name: 'Tengen Uzui', look: 'tengen', at: [-6, 10], lines: [{ who: 'Tengen', text: 'You three are going undercover as girls. Don\'t complain - flashy disguises get results!' }] }],
    collect: { kind: 'scroll', n: 4 }, poi: { id: 'poi_dis', name: 'Ogimiya House', at: [0, -36], text: 'Bright and silent. Something sinister hums beneath the floorboards.' }, spawnPt: [0, 36],
  },
  {
    id: 'smith', name: 'Swordsmith Village', jp: '刀鍛冶の里', sub: 'Hidden forge-valley', desc: 'A secret valley of forges, hot springs and mist where Nichirin blades are made.',
    map: [30, 30], unlock: 8, level: 18, hx: 62, hz: 62, hill: 5, ground: [0x7a8a60, 0x5a6a48], kind: 'grass', sky: { day: [0x5a9ad0, 0xe0f0f8], night: N }, fog: 0.014, weather: 'embers',
    props: [['forge', 6, 10, 40], ['house', 8, 16, 46], ['pine', 50, 20, 60], ['maple', 24, 16, 58], ['rock', 18, 8, 60], ['lantern', 10, 5, 40], ['cliff', 2, 0, 0], ['torii', 1, 0, 52, 0, 52]],
    spawn: { types: ['potfish', 'clone', 'grunt', 'regen'], night: ['potfish', 'brute', 'clone'], max: 5 }, music: 'sacred', amb: 'forge', gates: ['district', 'hashira'], pond: { x: -22, z: 22, r: 10 }, waterfall: [-40, -50, 8],
    npcs: [
      { id: 'haganezuka', name: 'Hotaru Haganezuka', look: 'smith', at: [6, 4], smith: true, lines: [{ who: 'Haganezuka', text: 'You broke another blade?! Pay me, and I will make it sing again.' }] },
      { id: 'smithshop', name: 'Forge Apprentice', look: 'merchant', at: [-8, 8], shop: true, lines: [{ who: 'Apprentice', text: 'Whetstones, steel, scarlet iron sand - everything a swordsmith loves.' }] },
    ],
    collect: { kind: 'ore_piece', n: 5 }, poi: { id: 'poi_smi', name: 'Hidden Hot Spring', at: [-30, 30], text: 'Steam curls from the rocks. Nichirin workers soak away their burns here.' }, spawnPt: [0, 30],
  },
  {
    id: 'hashira', name: 'Hashira Training Grounds', jp: '柱稽古', sub: 'The ultimate drills', desc: 'Courses of stone pillars, logs and boulders where the Hashira train the Corps.',
    map: [22, 64], unlock: 9, level: 20, hx: 60, hz: 60, hill: 2.5, ground: [0x8a8470, 0x706a58], kind: 'dirt', sky: { day: [0x4a88c8, 0xd8ecff], night: N }, fog: 0.01, weather: 'none',
    props: [['pillar', 40, 10, 58], ['log', 20, 8, 56], ['rock', 24, 12, 58], ['cedar', 30, 30, 58], ['cliff', 2, 0, 0], ['torii', 1, 0, 50, 0, 50], ['lantern', 8, 5, 40]],
    spawn: { types: ['guard', 'regen', 'fast', 'brute'], night: ['brute', 'guard'], max: 5 }, music: 'sacred', amb: 'wind', gates: ['sagiri', 'smith', 'infinity'], waterfall: [45, -45, 10],
    npcs: [{ id: 'gyomei_npc', name: 'Gyomei Himejima', look: 'gyomei', at: [10, -6], lines: [{ who: 'Gyomei', text: 'Namu... Amida Butsu. Strength is shaped by endurance. Walk the waterfall, split the boulder, then talk to me.' }] }],
    collect: { kind: 'scroll', n: 4 }, poi: { id: 'poi_has', name: 'Waterfall Meditation Seat', at: [32, -34], text: 'A flat rock beneath the falls, worn smooth by countless prayers.' }, spawnPt: [0, 30],
  },
  {
    id: 'infinity', name: 'Infinity Castle', jp: '無限城', sub: 'Impossible architecture', desc: 'A warped fortress of rotating rooms, tilted stairs and endless halls. The demons\' stronghold.',
    map: [86, 76], unlock: 10, level: 22, hx: 44, hz: 44, hill: 0, ground: [0x6a4a30, 0x4a3020], kind: 'tatami', sky: { day: [0x180828, 0x502060], night: [0x180828, 0x502060] }, fog: 0.014, fixedTime: 0.0, weather: 'none',
    props: [['platform', 14, 40, 90], ['door', 16, 24, 42], ['pagoda', 8, 50, 90], ['pillar', 12, 10, 40], ['lantern', 10, 5, 40], ['drum', 2, 10, 20]],
    spawn: { types: ['brute', 'obi', 'potfish', 'guard', 'caster'], night: ['brute', 'obi', 'potfish', 'guard', 'caster'], max: 6 }, music: 'void', amb: 'void', gates: ['hashira', 'final'],
    npcs: [{ id: 'biwa', name: 'Biwa Player', look: 'tamayo', at: [0, -12], lines: [{ who: 'Biwa Player', text: 'Strum... and the floor is a ceiling. Do not trust any direction here.' }] }],
    collect: { kind: 'scroll', n: 4 }, poi: { id: 'poi_inf', name: 'Upside-Down Hall', at: [28, 26], text: 'A hall that exists in three orientations at once.' }, spawnPt: [0, 30],
  },
  {
    id: 'final', name: 'Dawn Battlefield', jp: '夜明け', sub: 'Where the sun will rise', desc: 'A shattered stone plain before the sunrise. The end of the long night.',
    map: [14, 20], unlock: 11, level: 24, hx: 62, hz: 62, hill: 2, ground: [0x4a4a52, 0x35353e], kind: 'stone', sky: { day: [0x2a2050, 0xff9050], night: [0x2a2050, 0xff7a40] }, fog: 0.012, fixedTime: 0.24, weather: 'embers',
    props: [['pillar', 32, 14, 58], ['rock', 40, 10, 60], ['dead', 20, 20, 60], ['tomb', 10, 10, 50], ['lantern', 6, 6, 50]],
    spawn: { types: ['brute', 'regen', 'guard', 'caster', 'obi'], night: ['brute', 'regen', 'guard'], max: 6 }, music: 'void', amb: 'wind', gates: ['infinity'],
    npcs: [{ id: 'last', name: 'Corps Survivor', look: 'villager', at: [-8, 12], lines: [{ who: 'Survivor', text: 'Dawn is close. Hold on until the sun reaches him.' }] }],
    collect: { kind: 'scroll', n: 3 }, poi: { id: 'poi_fin', name: 'Memorial Cairn', at: [0, -40], text: 'Stones stacked by those who fought and will not return.' }, spawnPt: [0, 36],
  },
];

export const REGION_BY_ID: Record<string, RegionDef> = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
