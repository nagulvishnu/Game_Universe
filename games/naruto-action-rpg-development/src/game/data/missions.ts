import type { MissionDef, Rewards } from '../types';
import { ROOF_RUN } from './world';

export const RANKS = [
  { id: 0, name: 'Academy Student', minLevel: 1, badge: '🎓' },
  { id: 1, name: 'Genin', minLevel: 1, badge: '🍃' },
  { id: 2, name: 'Chunin', minLevel: 10, badge: '🦺' },
  { id: 3, name: 'Jonin', minLevel: 18, badge: '⭐' },
  { id: 4, name: 'Elite Jonin', minLevel: 26, badge: '🌟' },
];

const rew = (r: Rewards) => r;

const PLAN = (chapter: number, id: string, name: string, summary: string): MissionDef => ({
  id, name, kind: 'story', chapter, status: 'planned', giver: 'board', minRank: 1, summary, offer: [], stages: [],
  rewards: { xp: 0, ryo: 0 }, zone: 'konoha',
});

export const MISSIONS: MissionDef[] = [
  // ------------------------------------------------------------ STORY (playable)
  {
    id: 'ch1_academy', name: 'Chapter 1 — Naruto\'s Academy Days', kind: 'story', chapter: 1, status: 'playable', giver: 'iruka', minRank: 0, zone: 'konoha',
    summary: 'Pass Iruka-sensei\'s graduation exam: defeat training dummies, perform a Shadow Clone Jutsu, and reach the Academy rooftop.',
    offer: [
      { speaker: 'Iruka', text: 'Naruto! You failed the last exam, and the one before that. Today is your last chance to graduate.', portrait: 'iruka' },
      { speaker: 'Naruto', text: 'Believe it, Iruka-sensei! I\'m going to be Hokage someday. This exam is nothing!', portrait: 'naruto' },
      { speaker: 'Iruka', text: 'Then show me. Behind the Academy are training dummies. Defeat three of them — Left click to chain a combo, right click for a heavy blow.', portrait: 'iruka' },
    ],
    stages: [
      { objectives: [{ type: 'kill', def: 'dummy', tag: 'ch1', count: 3, label: 'Defeat the training dummies behind the Academy' }], spawn: [{ def: 'dummy', pos: [-45, -35], tag: 'ch1' }, { def: 'dummy', pos: [-40, -37], tag: 'ch1' }, { def: 'dummy', pos: [-35, -35], tag: 'ch1' }], hint: 'LMB: combo • RMB: heavy • Space: dodge near enemies • F: lock on' },
      { objectives: [{ type: 'ability', ability: 'clone', count: 1, label: 'Perform Shadow Clone Jutsu (press 1)' }], intro: [{ speaker: 'Iruka', text: 'Good. Now the real test: the Clone Jutsu. Use your chakra wisely — watch the blue bar.', portrait: 'iruka' }, { speaker: 'Naruto', text: 'My chakra control is awful... but Shadow Clones? That\'s my specialty!', portrait: 'naruto' }], hint: 'Press 1 to cast. Hold Q to recover chakra.' },
      { objectives: [{ type: 'reach', pos: [-40, -20], radius: 7, minY: 6, label: 'Climb onto the Academy rooftop (use crates + double jump)' }], intro: [{ speaker: 'Iruka', text: 'A ninja must move across rooftops. Climb the crates on the east side and get on the Academy roof!', portrait: 'iruka' }], hint: 'Space to jump — press again in the air for a double jump.' },
      { objectives: [{ type: 'talk', npc: 'iruka', label: 'Return to Iruka-sensei', lines: [{ speaker: 'Iruka', text: 'You passed, Naruto. Close your eyes... I have something for you.', portrait: 'iruka' }, { speaker: 'Naruto', text: 'My very own forehead protector!', portrait: 'naruto' }] }] },
    ],
    outro: [{ speaker: 'Iruka', text: 'Congratulations — you\'re now a Genin of the Hidden Leaf. Missions are posted on the board near the Hokage tower.', portrait: 'iruka' }],
    rewards: rew({ xp: 140, ryo: 300, items: [['ramen', 3], ['leafHeadband', 1], ['soldierPill', 2]], rankNote: 'Promoted to Genin!', flag: 'genin' }),
  },
  {
    id: 'ch2_team7', name: 'Chapter 2 — Team 7 Formation', kind: 'story', chapter: 2, status: 'playable', giver: 'kakashi', minRank: 1, requires: ['ch1_academy'], zone: 'konoha',
    summary: 'Join Sasuke and Sakura under Kakashi and pass the bell test by working together.',
    offer: [
      { speaker: 'Kakashi', text: 'So you\'re Team 7. Sasuke, Sakura, Naruto — I have one question: do you know how to work as a team?', portrait: 'kakashi' },
      { speaker: 'Sasuke', text: 'Tch. I can handle this alone.', portrait: 'sasuke' },
      { speaker: 'Sakura', text: 'Naruto, don\'t get in Sasuke\'s way!', portrait: 'sakura' },
      { speaker: 'Kakashi', text: 'The test: defeat my three shadow-trained shinobi. Come at us as a team!', portrait: 'kakashi' },
    ],
    stages: [
      { companions: ['sasuke', 'sakura'], objectives: [{ type: 'kill', def: 'skilled', tag: 'ch2', count: 3, label: 'Defeat Kakashi\'s test shinobi with Sasuke and Sakura' }], spawn: [{ def: 'skilled', pos: [62, 62], tag: 'ch2' }, { def: 'skilled', pos: [66, 58], tag: 'ch2' }, { def: 'skilled', pos: [58, 66], tag: 'ch2', lv: 1 }], hint: 'Your teammates fight on their own. Lure enemies to them!' },
      { objectives: [{ type: 'ability', ability: 'rasengan', count: 1, label: 'Land a Rasengan (press 2)' }], intro: [{ speaker: 'Kakashi', text: 'Not bad. Now show me a real technique — Naruto, use your Rasengan!', portrait: 'kakashi' }], hint: 'Rasengan dashes at your target. Lock on with F first.' },
      { objectives: [{ type: 'talk', npc: 'kakashi', label: 'Report back to Kakashi', lines: [{ speaker: 'Kakashi', text: 'You pass. Because you worked together — those who abandon their friends are worse than scum.', portrait: 'kakashi' }, { speaker: 'Kakashi', text: 'Welcome to Team 7.', portrait: 'kakashi' }] }] },
    ],
    outro: [{ speaker: 'Kakashi', text: 'Sasuke and Sakura are now playable from the character menu (Tab). Next: a C-rank escort for the Hokage.', portrait: 'kakashi' }],
    rewards: rew({ xp: 380, ryo: 600, items: [['bigRamen', 2], ['steelKunai', 1]], unlockChars: ['sasuke', 'sakura'] }),
  },
  {
    id: 'ch3_waves', name: 'Chapter 3 — Land of Waves', kind: 'story', chapter: 3, status: 'playable', giver: 'hokage', minRank: 1, requires: ['ch2_team7'], minLevel: 4, zone: 'waves',
    summary: 'Escort the bridge-builder Tazuna to the Land of Waves — and face Zabuza, Demon of the Hidden Mist, on the bridge.',
    offer: [
      { speaker: 'Hokage', text: 'Team 7, a C-rank mission: escort the bridge builder Tazuna safely to the Land of Waves, west of the village.', portrait: 'hokage' },
      { speaker: 'Tazuna', text: 'Heh, I\'m counting on you brats. It\'s just a simple trip... nothing dangerous.', portrait: 'tazuna' },
      { speaker: 'Kakashi', text: 'Stay alert. Something about this client feels off.', portrait: 'kakashi' },
    ],
    stages: [
      { companions: ['tazuna', 'sasuke', 'sakura', 'kakashi'], objectives: [{ type: 'reach', pos: [-110, 0], radius: 12, label: 'Escort Tazuna west along the road' }], hint: 'Leave through the west gate. Use the map (M) to follow the marker.' },
      { objectives: [{ type: 'kill', tag: 'ch3a', count: 2, label: 'Defeat the Demon Brothers' }], intro: [{ speaker: 'Kakashi', text: 'Chain assassins! Naruto, protect Tazuna!', portrait: 'kakashi' }], spawn: [{ def: 'demon', pos: [-132, 6], tag: 'ch3a' }, { def: 'demon', pos: [-132, -6], tag: 'ch3a' }] },
      { objectives: [{ type: 'reach', pos: [-185, 0], radius: 10, label: 'Reach the coast of the Land of Waves' }] },
      { objectives: [{ type: 'reach', pos: [-222, 0], radius: 8, label: 'Step onto the Great Bridge' }], intro: [{ speaker: 'Tazuna', text: 'The bridge is just ahead... The mist is getting thick.', portrait: 'tazuna' }, { speaker: 'Sakura', text: 'It\'s so cold... is that killing intent?', portrait: 'sakura' }] },
      { objectives: [{ type: 'boss', boss: 'zabuza', label: 'Defeat Zabuza Momochi' }], boss: { id: 'zabuza', pos: [-264, 0] }, hint: 'Watch the red telegraphs. Dodge (Space), guard (C) or use Substitution (X).' },
      { objectives: [{ type: 'talk', npc: 'tazuna', label: 'Speak with Tazuna', lines: [{ speaker: 'Tazuna', text: 'You did it! You saved me and the whole country. This bridge will carry hope to everyone here.', portrait: 'tazuna' }, { speaker: 'Naruto', text: 'We\'ll protect the Land of Waves — believe it!', portrait: 'naruto' }] }] },
    ],
    outro: [{ speaker: 'Kakashi', text: 'Good work. Kakashi is now a playable ally; Zabuza\'s sword shard is yours.', portrait: 'kakashi' }],
    rewards: rew({ xp: 1100, ryo: 1500, items: [['kubikiriShard', 1], ['chuninVest', 1], ['bigRamen', 3]], unlockChars: ['kakashi'] }),
    checkpoint: [-222, 0],
  },
  PLAN(4, 'ch4_chunin', 'Chapter 4 — Chunin Exams', 'The Forest of Death exam, preliminaries and Orochimaru\'s shadow. (Not yet playable.)'),
  PLAN(5, 'ch5_crush', 'Chapter 5 — Konoha Crush', 'The invasion of Konoha and Gaara\'s rampage. (Not yet playable.)'),
  PLAN(6, 'ch6_tsunade', 'Chapter 6 — Search for Tsunade', 'Track down the legendary Sannin. (Not yet playable.)'),
  PLAN(7, 'ch7_sasuke', 'Chapter 7 — Sasuke Retrieval', 'Chase Sasuke at the Valley of the End. (Not yet playable.)'),
  PLAN(8, 'ch8_kazekage', 'Chapter 8 — Kazekage Rescue', 'Save Gaara from Akatsuki. (Not yet playable.)'),
  PLAN(9, 'ch9_akatsuki', 'Chapter 9 — Akatsuki Encounters', 'Hidden hideouts, Itachi and Kisame. (Not yet playable.)'),
  PLAN(10, 'ch10_pain', 'Chapter 10 — Pain\'s Assault', 'The Six Paths of Pain attack Konoha. (Not yet playable.)'),
  PLAN(11, 'ch11_kage', 'Chapter 11 — Five Kage Summit', 'Clash of the five great nations. (Not yet playable.)'),
  PLAN(12, 'ch12_war', 'Chapter 12 — Fourth Great Ninja War', 'Alliance versus Madara and Obito. (Not yet playable.)'),
  PLAN(13, 'ch13_final', 'Chapter 13 — Final Naruto vs Sasuke', 'The final battle of rivals. (Not yet playable.)'),

  // ------------------------------------------------------------ SIDE (board)
  {
    id: 'rogue_elim', name: 'Rogue Ninja Elimination', kind: 'side', status: 'playable', giver: 'board', minRank: 1, zone: 'konoha',
    summary: 'A band of rogue ninja is raiding merchants near the south road. Eliminate five of them.',
    offer: [{ speaker: 'Mission Board', text: 'D-rank: Rogue ninja spotted south of the village gate. Eliminate 5 rogues.' }],
    stages: [{ objectives: [{ type: 'kill', tag: 'rogue_elim', count: 5, label: 'Eliminate the rogue ninja near the south gate' }], spawn: [{ def: 'rogue', pos: [10, 100], count: 3, spread: 7, tag: 'rogue_elim', lv: 2 }, { def: 'rogue', pos: [-12, 112], count: 2, spread: 5, tag: 'rogue_elim', lv: 3 }] }],
    rewards: rew({ xp: 220, ryo: 450, items: [['kunai', 6]] }),
  },
  {
    id: 'lost_scroll', name: 'Lost Scroll Recovery', kind: 'side', status: 'playable', giver: 'board', minRank: 1, zone: 'forest',
    summary: 'Four sealed scrolls were dropped in the Forest of Death. Recover them (glowing markers).',
    offer: [{ speaker: 'Mission Board', text: 'C-rank: Recover 4 lost scrolls in the Forest of Death. Beware of ambushes.' }],
    stages: [{ objectives: [{ type: 'collect', kind: 'forestScroll', count: 4, label: 'Recover the lost scrolls in the Forest of Death' }] }],
    rewards: rew({ xp: 420, ryo: 650, items: [['chakraPill', 2], ['focusScroll', 1]] }),
  },
  {
    id: 'missing_cat', name: 'Find Tora the Cat', kind: 'side', status: 'playable', giver: 'board', minRank: 1, zone: 'konoha',
    summary: 'The Fire Daimyo\'s wife\'s cat has run off again. Find Tora and return it.',
    offer: [{ speaker: 'Mission Board', text: 'D-rank: Missing-person (cat) investigation. Tora was last seen west of the weapon shop.' }],
    stages: [
      { objectives: [{ type: 'collect', kind: 'cat', count: 1, label: 'Find Tora the cat in the village' }] },
      { objectives: [{ type: 'talk', npc: 'hokage', label: 'Return Tora to the Hokage', lines: [{ speaker: 'Hokage', text: 'Ah, Tora! Excellent work... though those scratches look painful.', portrait: 'hokage' }] }] },
    ],
    rewards: rew({ xp: 140, ryo: 500, items: [['ramen', 2], ['ramenCoupon', 1]] }),
  },
  {
    id: 'rooftop_run', name: 'Rooftop Run', kind: 'side', status: 'playable', giver: 'board', minRank: 1, zone: 'konoha',
    summary: 'A timed traversal challenge: touch five rooftop checkpoints within 55 seconds.',
    offer: [{ speaker: 'Mission Board', text: 'Training: Reach all rooftop checkpoints (south-west quarter) in order within 55 seconds.' }],
    stages: [{ timeLimit: 55, objectives: [{ type: 'checkpoints', points: ROOF_RUN.length ? ROOF_RUN : [[-30, 30, 3]], radius: 5.5, label: 'Touch the rooftop checkpoints in order' }], hint: 'Sprint (Shift) and double jump between roofs.' }],
    rewards: rew({ xp: 260, ryo: 350, items: [['soldierPill', 2]] }),
  },
  {
    id: 'chakra_control', name: 'Chakra Control Exercise', kind: 'side', status: 'playable', giver: 'board', minRank: 1, zone: 'konoha',
    summary: 'Hold Q to gather and refine chakra for a total of 12 seconds.',
    offer: [{ speaker: 'Mission Board', text: 'Training: Chakra control exercise. Hold Q (charge) for 12 seconds in total. Stay out of danger.' }],
    stages: [{ objectives: [{ type: 'charge', seconds: 12, label: 'Charge chakra (hold Q) for 12 seconds' }] }],
    rewards: rew({ xp: 200, ryo: 150, items: [['chakraCrystal', 1]] }),
  },
  {
    id: 'village_defense', name: 'Village Gate Defense', kind: 'side', status: 'playable', giver: 'board', minRank: 1, zone: 'konoha',
    summary: 'Raiders attack the south gate in waves. Hold the line.',
    offer: [{ speaker: 'Mission Board', text: 'B-rank: Raiders are approaching the south gate. Defeat all 8 attackers.' }],
    stages: [{ objectives: [{ type: 'kill', tag: 'def', count: 8, label: 'Defend the south gate (8 attackers)' }], spawn: [{ def: 'rogue', pos: [0, 98], count: 3, spread: 6, tag: 'def', lv: 3 }], waves: [{ at: 18, spawn: [{ def: 'skilled', pos: [-8, 100], count: 2, spread: 4, tag: 'def', lv: 3 }, { def: 'fireNin', pos: [8, 104], count: 1, tag: 'def', lv: 3 }] }, { at: 40, spawn: [{ def: 'lightningNin', pos: [0, 104], count: 1, tag: 'def', lv: 4 }, { def: 'rogue', pos: [0, 108], count: 1, tag: 'def', lv: 4 }] }] }],
    rewards: rew({ xp: 520, ryo: 800, items: [['bigRamen', 1], ['ironScrap', 4]] }),
  },
  {
    id: 'elite_hunt', name: 'Elite Hunt: Mist Swordsman', kind: 'side', status: 'playable', giver: 'board', minRank: 2, minLevel: 8, zone: 'wilds',
    summary: 'A hunter-nin from the Mist has crossed into Fire Country. Defeat this elite swordsman.',
    offer: [{ speaker: 'Mission Board', text: 'A-rank: Defeat the Mist Swordsman stalking the eastern wilds. (Chunin rank)' }],
    stages: [{ objectives: [{ type: 'kill', def: 'mistElite', tag: 'elite_hunt', count: 1, label: 'Defeat the Mist Swordsman in the eastern wilds' }], spawn: [{ def: 'mistElite', pos: [150, 30], tag: 'elite_hunt', lv: 8 }] }],
    rewards: rew({ xp: 800, ryo: 1100, items: [['chakraBlade', 1], ['chakraCrystal', 2]] }),
  },
  {
    id: 'forest_survival', name: 'Forest of Death Survival', kind: 'side', status: 'playable', giver: 'board', minRank: 2, minLevel: 8, zone: 'forest',
    summary: 'Survive 75 seconds against ambushes inside the Forest of Death.',
    offer: [{ speaker: 'Mission Board', text: 'Chunin-level: Survive 75 seconds of ambushes at the heart of the Forest of Death.' }],
    stages: [{ objectives: [{ type: 'survive', seconds: 75, label: 'Survive in the Forest of Death' }], spawn: [{ def: 'skilled', pos: [4, 205], count: 2, spread: 8, tag: 'fs', lv: 6 }], waves: [{ at: 22, spawn: [{ def: 'fireNin', pos: [0, 232], count: 2, spread: 8, tag: 'fs', lv: 7 }, { def: 'illusionist', pos: [-10, 195], count: 1, tag: 'fs', lv: 7 }] }, { at: 48, spawn: [{ def: 'stoneBrute', pos: [8, 230], count: 1, tag: 'fs', lv: 7 }, { def: 'lightningNin', pos: [-8, 205], count: 2, spread: 6, tag: 'fs', lv: 7 }] }]}],
    rewards: rew({ xp: 900, ryo: 1000, items: [['sagePendant', 1]] }),
    checkpoint: [0, 195],
  },
  {
    id: 'secret_technique', name: 'Secret Technique Discovery', kind: 'side', status: 'playable', giver: 'board', minRank: 1, minLevel: 5, zone: 'forest',
    summary: 'Rumors tell of a hidden cave in the Forest of Death holding a forbidden wind scroll. Unlocks Rasenshuriken (with level 8).',
    offer: [{ speaker: 'Mission Board', text: 'Rumor: a hidden scroll lies behind boulders at the south-west end of the Forest of Death. Genin level 5+.' }],
    stages: [{ objectives: [{ type: 'collect', kind: 'secretScroll', count: 1, label: 'Find the hidden Secret Wind Scroll in the Forest of Death' }] }],
    rewards: rew({ xp: 500, ryo: 400, flag: 'secretWind', items: [['xpScroll', 1]] }),
  },
  {
    id: 'sage_training', name: 'Natural Energy Training', kind: 'side', status: 'playable', giver: 'jiraiya', minRank: 1, minLevel: 6, zone: 'myoboku',
    summary: 'Climb Mount Myoboku\'s stone pillars and gather natural energy. Unlocks Sage Mode and Jiraiya.',
    offer: [
      { speaker: 'Jiraiya', text: 'So you\'re the brat Minato\'s legacy... hehe! Want to learn Sage Mode? Gather natural energy from the four stone pillars.', portrait: 'jiraiya' },
      { speaker: 'Naruto', text: 'Bring it on, Pervy Sage!', portrait: 'naruto' },
    ],
    stages: [{ objectives: [{ type: 'collect', kind: 'orb', count: 4, label: 'Gather natural energy from the four pillars' }], hint: 'Jump from pillar to pillar. Orbs glow green.' }],
    outro: [{ speaker: 'Jiraiya', text: 'You\'ve got the feel for it. Spend skill points on "Natural Energy" and press G to enter Sage Mode.', portrait: 'jiraiya' }],
    rewards: rew({ xp: 700, ryo: 600, flag: 'sageTraining', unlockChars: ['jiraiya'], items: [['toadCharm', 1]] }),
  },
  {
    id: 'lee_trial', name: 'Lee\'s Taijutsu Trial', kind: 'side', status: 'playable', giver: 'lee', minRank: 1, minLevel: 3, zone: 'konoha',
    summary: 'Rock Lee challenges you: defeat four sparring shinobi without chakra tricks to prove your youth!',
    offer: [
      { speaker: 'Lee', text: 'Naruto-kun! Let us test our youth! Defeat four of my sparring partners and I shall join you!', portrait: 'lee' },
    ],
    stages: [{ objectives: [{ type: 'kill', tag: 'lee', count: 4, label: 'Defeat the four sparring shinobi at the training grounds' }], spawn: [{ def: 'skilled', pos: [72, 62], count: 2, spread: 4, tag: 'lee', lv: 4 }, { def: 'rogue', pos: [78, 56], count: 2, spread: 4, tag: 'lee', lv: 4 }] }],
    rewards: rew({ xp: 450, ryo: 500, unlockChars: ['lee'], items: [['soldierPill', 3]] }),
  },
  {
    id: 'sand_challenge', name: 'Sand Siblings\' Challenge', kind: 'side', status: 'playable', giver: 'kankuro', minRank: 2, minLevel: 8, zone: 'sand',
    summary: 'Face Gaara in the Hidden Sand arena. An optional boss battle. Unlocks Gaara.',
    offer: [
      { speaker: 'Kankuro', text: 'You want to fight Gaara? Hah! He\'s not the monster he once was, but he\'ll hold nothing back.', portrait: 'kankuro' },
      { speaker: 'Kankuro', text: 'Beat him and he\'ll acknowledge you. Fail... and don\'t say I didn\'t warn you.', portrait: 'kankuro' },
    ],
    stages: [{ objectives: [{ type: 'boss', boss: 'gaara', label: 'Defeat Gaara of the Sand' }], boss: { id: 'gaara', pos: [262, 44] } }],
    rewards: rew({ xp: 1400, ryo: 1600, unlockChars: ['gaara'], items: [['sandGourdCharm', 1]] }),
    checkpoint: [236, 14],
  },
];

export const getMission = (id: string): MissionDef | undefined => MISSIONS.find((m) => m.id === id);
