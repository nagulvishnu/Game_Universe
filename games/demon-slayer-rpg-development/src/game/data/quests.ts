import type { DialogueLine, Quest, Step } from '../types';

const d = (who: string, text: string, cam?: DialogueLine['cam']): DialogueLine => ({ who, text, cam });
const dlg = (title: string | undefined, ...lines: DialogueLine[]): Step => ({ t: 'dialogue', lines, title });

export const STORY: Quest[] = [
  {
    id: 'ch1', kind: 'story', cat: 'Story', chapter: 1, title: "Tanjiro's Beginning", sub: 'Chapter 1', region: 'sagiri', diff: 1, level: 1,
    desc: 'A charcoal seller loses everything in one night, and a sister lives on as a demon.',
    steps: [
      dlg('Chapter 1 — Tanjiro\'s Beginning', d('Narrator', 'Mount Sagiri, deep winter. Tanjiro Kamado carries charcoal down the slope to sell in the village.', 'wide'), d('Tanjiro', 'Mother, Nezuko, everyone - I will be back before dark. Keep the fire warm!', 'player')),
      { t: 'reach', at: [0, -14], r: 4, obj: 'Return to the Kamado home through the snow' },
      dlg(undefined, d('Narrator', 'Blood stains the snow. The house is silent. Only Nezuko still breathes - but her skin is cold.', 'wide'), d('Tanjiro', 'Nezuko... hold on. I\'ll carry you down the mountain, I will find help!', 'player'), d('Narrator', 'Her eyes glow pink. Something in her has changed. Demons, drawn by the scent, close in.', 'wide')),
      { t: 'kill', n: 3, types: ['grunt'], obj: 'Defend Nezuko from the demons drawn to the house' },
      { t: 'talk', npc: 'giyu', at: [4, -9], lines: [d('Giyu Tomioka', 'You are fast for a civilian. But that girl is a demon. Step aside.', 'npc'), d('Tanjiro', 'She is my sister! She protected me even after she changed. Please, there must be a way!', 'player'), d('Giyu Tomioka', '...Go to Sakonji Urokodaki, at the foot of Mount Sagiri. Tell him Giyu sent you. Prove your resolve.', 'npc')], obj: 'Speak with the stranger in the snow' },
      { t: 'talk', npc: 'urokodaki', at: [10, -20], lines: [d('Sakonji Urokodaki', 'So you are the boy Giyu mentioned. Your nose is sharp, your will sharper. Train under me for two years.', 'npc'), d('Tanjiro', 'Thank you, Master. I will cut through anything for Nezuko.', 'player')], obj: 'Seek out Sakonji Urokodaki' },
      { t: 'dummy', n: 3, obj: 'Practice Water Breathing on the training dummies' },
      { t: 'kill', n: 1, types: ['boulder'], obj: 'Split the boulder with your blade' },
      dlg(undefined, d('Urokodaki', 'Well done. There is a place in the east where candidates are tested: the Final Selection. Survive seven nights.', 'npc'), d('Tanjiro', 'I\'m ready. Nezuko, we\'re going together.', 'player')),
    ],
    reward: { xp: 220, sen: 250, cp: 40, sp: 2, items: { rice_ball: 3, steel_shard: 1 } },
  },
  {
    id: 'ch2', kind: 'story', cat: 'Story', chapter: 2, title: 'Final Selection', sub: 'Chapter 2', region: 'selection', diff: 2, level: 3,
    desc: 'Seven nights on wisteria mountain. Survive, and become a Demon Slayer.',
    steps: [
      dlg('Chapter 2 — Final Selection', d('Narrator', 'Wisteria blossoms bloom in the dark. Only here are demons held within - and starved.', 'wide'), d('Tanjiro', 'My nose... the whole mountain smells like fear. Stay together, stay alive.', 'player')),
      { t: 'kill', n: 6, types: ['grunt', 'fast', 'ambush'], obj: 'Defeat the demons stalking the candidates' },
      { t: 'collect', n: 3, label: 'Wisteria Blossom', kind: 'wisteria' },
      { t: 'survive', sec: 45, types: ['grunt', 'fast', 'regen'], obj: 'Survive until the wave subsides' },
      { t: 'boss', boss: 'hand', obj: 'Defeat the Hand Demon' },
      dlg(undefined, d('Narrator', 'Dawn breaks on the seventh day. Few remain. Tanjiro walks down the mountain, still breathing.', 'wide'), d('Tanjiro', 'I made it. Now they will forge my blade. The first step is done.', 'player')),
    ],
    reward: { xp: 360, sen: 450, cp: 70, sp: 2, items: { herb: 2, steel_shard: 2 } },
  },
  {
    id: 'ch3', kind: 'story', cat: 'Story', chapter: 3, title: 'First Demon Hunts', sub: 'Chapter 3', region: 'village', diff: 2, level: 4,
    desc: 'Tanjiro takes his first official Corps contracts and meets his first deadly foes.',
    steps: [
      dlg('Chapter 3 — First Demon Hunts', d('Narrator', 'A Kasugai Crow guides Tanjiro to a quiet village where people have been vanishing.', 'wide'), d('Tanjiro', 'A new mission... stay calm. I\'m a Corps member now. People are counting on me.', 'player')),
      { t: 'talk', npc: 'child', at: [-4, 8], lines: [d('Hanako', 'My brother went into the marsh and never came back...', 'npc'), d('Tanjiro', 'I will find him. I promise. Stay here, where it\'s safe.', 'player')], obj: 'Talk to the worried girl' },
      { t: 'collect', n: 3, label: 'Investigation Clue', kind: 'clue' },
      { t: 'kill', n: 5, types: ['ambush', 'grunt', 'caster'], obj: 'Hunt the demons lurking near the village' },
      { t: 'boss', boss: 'swamp', obj: 'Defeat the Swamp Demon' },
      dlg(undefined, d('Narrator', 'The marsh grows quiet. Villagers bow as Tanjiro passes - he is a hero, even if he doesn\'t feel like one.', 'wide'), d('Tanjiro', 'One step at a time. Let\'s keep moving, Nezuko.', 'player')),
    ],
    reward: { xp: 460, sen: 520, cp: 80, sp: 2, items: { rice_ball: 3, tonic: 1 } },
  },
  {
    id: 'ch4', kind: 'story', cat: 'Story', chapter: 4, title: 'Asakusa & Tsuzumi Mansion', sub: 'Chapter 4', region: 'asakusa', diff: 3, level: 6,
    desc: 'A chilling stranger in Asakusa. A rotating mansion. Two new companions.',
    steps: [
      dlg('Chapter 4 — Asakusa & Tsuzumi Mansion', d('Narrator', 'Electric lights hum over the Asakusa crowd. A familiar scent cuts through the noise.', 'wide'), d('Tanjiro', 'That smell... the one from my home. He is here!', 'player')),
      { t: 'talk', npc: 'muzan', at: [0, -16], lines: [d('Stranger', 'That child at your side... how touching. You\'re all so very fragile.', 'npc'), d('Tanjiro', 'You killed my family. I will never forgive you!', 'player'), d('Muzan', 'Take care of yourselves, little ones. I\'ve tired of games.', 'npc')], obj: 'Confront the man in the crowd' },
      { t: 'kill', n: 5, types: ['guard', 'caster', 'grunt'], obj: 'Survive the demons Muzan left behind' },
      dlg(undefined, d('Narrator', 'Hunting a trail of missing men, Tanjiro enters the Tsuzumi Mansion - where rooms rotate with the beat of a drum.', 'wide'), d('Tanjiro', 'Those drums... every beat the room changes. Stay sharp!', 'player')),
      { t: 'kill', n: 5, types: ['drummer', 'ambush', 'grunt'], obj: 'Fight through the mansion', region: 'tsuzumi' },
      { t: 'boss', boss: 'kyogai', obj: 'Defeat Kyogai, the Drum Demon', region: 'tsuzumi' },
      dlg(undefined, d('Zenitsu', 'W-wait! Don\'t leave me! I almost died in that room!', 'npc'), d('Inosuke', 'Hah! I was going to cut him first! Ha ha ha!', 'npc'), d('Tanjiro', 'Zenitsu, Inosuke... let\'s go together. The three of us.', 'player'), d('Narrator', 'Zenitsu and Inosuke join the party.', 'wide')),
    ],
    reward: { xp: 640, sen: 700, cp: 100, sp: 3, items: { herb: 2, steel_shard: 2 }, unlockChar: ['zenitsu', 'inosuke'] },
  },
  {
    id: 'ch5', kind: 'story', cat: 'Story', chapter: 5, title: 'Mount Natagumo', sub: 'Chapter 5', region: 'natagumo', diff: 3, level: 10,
    desc: 'A haunted forest of threads - and the Hinokami Kagura, awakened in desperation.',
    steps: [
      dlg('Chapter 5 — Mount Natagumo', d('Narrator', 'Silver threads cover every branch. Hunters are tied like puppets. The mountain breathes with fear.', 'wide'), d('Tanjiro', 'Zenitsu is gone. Inosuke ran ahead. We have to find them before the threads find us.', 'player')),
      { t: 'kill', n: 6, types: ['spider', 'grunt', 'fast'], obj: 'Cut through the spider family' },
      { t: 'collect', n: 4, label: 'Spider Silk', kind: 'silk' },
      { t: 'boss', boss: 'rui', obj: 'Confront Rui, the Spider Demon' },
      dlg(undefined, d('Narrator', 'The threads are too strong. Tanjiro\'s Water Breathing fails. In his fading mind, his father\'s dance rekindles.', 'wide'), d('Tanjiro', 'Father... I remember the dance. The fire dance! Hinokami Kagura!', 'player'), d('Giyu Tomioka', 'You did well, Tanjiro. Rest now. I\'ll finish this.', 'npc'), d('Narrator', 'Hinokami Kagura unlocked. Giyu Tomioka is now playable.', 'wide')),
    ],
    reward: { xp: 900, sen: 900, cp: 140, sp: 4, items: { elixir: 2, whetstone: 1 }, unlockChar: ['giyu'] },
  },
  {
    id: 'ch6', kind: 'story', cat: 'Story', chapter: 6, title: 'Rehabilitation Training', sub: 'Chapter 6', region: 'butterfly', diff: 2, level: 12,
    desc: 'Recover in Butterfly Mansion and learn total concentration with the Insect Hashira.',
    steps: [
      dlg('Chapter 6 — Rehabilitation Training', d('Narrator', 'Butterflies drift through the mansion gardens. Medicine, laughter, and... a very strict set of exercises.', 'wide'), d('Zenitsu', 'Why is the training so painful? I am a delicate flower!', 'npc')),
      { t: 'talk', npc: 'shinobu', at: [-4, -2], lines: [d('Shinobu Kocho', 'Total Concentration Breathing is a skill, not a talent. Practice every second of every day.', 'npc'), d('Tanjiro', 'Understood! Let\'s begin.', 'player')], obj: 'Speak with Shinobu Kocho' },
      { t: 'collect', n: 4, label: 'Medicinal Herb', kind: 'wisteria' },
      { t: 'dummy', n: 3, obj: 'Reflex training: hit the dummies' },
      { t: 'survive', sec: 40, types: ['grunt', 'fast'], obj: 'Sparring session: survive the practice demons' },
      dlg(undefined, d('Shinobu', 'You have mastered it, haven\'t you? Congratulations - even Zenitsu managed.', 'npc'), d('Narrator', 'Shinobu Kocho is now playable.', 'wide')),
    ],
    reward: { xp: 760, sen: 600, cp: 100, sp: 3, items: { herb: 3, tonic: 2 }, unlockChar: ['shinobu'] },
  },
  {
    id: 'ch7', kind: 'story', cat: 'Story', chapter: 7, title: 'Mugen Train', sub: 'Chapter 7', region: 'train', diff: 4, level: 14,
    desc: 'A hundred passengers sleep on a train that has become a demon\'s body.',
    steps: [
      dlg('Chapter 7 — Mugen Train', d('Narrator', 'Steam and moonlight. The Mugen Train hurtles through the night. The Flame Hashira smiles from the third car.', 'wide'), d('Rengoku', 'Tanjiro! Set your heart ablaze! Together we will protect every passenger!', 'npc')),
      { t: 'kill', n: 6, types: ['flesh', 'grunt', 'fast'], obj: 'Cut down the flesh growths in the carriages' },
      { t: 'boss', boss: 'enmu', obj: 'Defeat Enmu, the Dream Demon' },
      dlg(undefined, d('Narrator', 'Too late - a new danger falls from the sky. Upper Moon Three: Akaza.', 'wide'), d('Akaza', 'Such strength... Join us, Flame Hashira. You will become even stronger as a demon.', 'boss'), d('Rengoku', 'I decline. Whatever happens, my heart stays burning.', 'npc')),
      { t: 'boss', boss: 'akaza', retreat: 0.45, obj: 'Hold your ground against Akaza until dawn' },
      dlg(undefined, d('Narrator', 'Dawn forces Akaza to flee. Rengoku\'s final words will live in every Hashira thereafter.', 'wide'), d('Rengoku', 'Do not weep, young one. Move forward. Rise and keep fighting.', 'npc'), d('Narrator', 'Kyojuro Rengoku\'s legacy is now playable.', 'wide')),
    ],
    reward: { xp: 1200, sen: 1200, cp: 200, sp: 4, items: { elixir: 2, scarlet_ore: 1 }, unlockChar: ['rengoku'] },
  },
  {
    id: 'ch8', kind: 'story', cat: 'Story', chapter: 8, title: 'Entertainment District', sub: 'Chapter 8', region: 'district', diff: 4, level: 16,
    desc: 'Undercover in the red-light district. A demon\'s siblings. A battle that shakes the town.',
    steps: [
      dlg('Chapter 8 — Entertainment District', d('Narrator', 'Paper lanterns, perfume and secrets. A Sound Hashira has brought three students undercover.', 'wide'), d('Tengen', 'Investigate! Subtly! Flashily! Find the demon before it finds us!', 'npc')),
      { t: 'collect', n: 3, label: 'Investigation Clue', kind: 'clue' },
      { t: 'kill', n: 8, types: ['obi', 'caster', 'fast'], obj: 'Cut through the district\'s hidden demons' },
      { t: 'talk', npc: 'tengen', at: [-6, 6], lines: [d('Tengen Uzui', 'The Upper Moon is near. When it starts - stay close, and don\'t die. That\'s an order.', 'npc'), d('Tanjiro', 'Understood. We\'ll end this together.', 'player')], obj: 'Regroup with Tengen' },
      { t: 'boss', boss: 'daki', obj: 'Defeat Daki and Gyutaro' },
      dlg(undefined, d('Narrator', 'The siblings fall, bound by a brutal love. Tanjiro, Zenitsu and Inosuke live; the district\'s smoke slowly clears.', 'wide'), d('Tengen', 'Flashy work, kids. Flashy work.', 'npc')),
    ],
    reward: { xp: 1500, sen: 1500, cp: 240, sp: 4, items: { herb: 3, whetstone: 2 }, unlockChar: ['tengen'] },
  },
  {
    id: 'ch9', kind: 'story', cat: 'Story', chapter: 9, title: 'Swordsmith Village', sub: 'Chapter 9', region: 'smith', diff: 4, level: 18,
    desc: 'New blades, new allies... and two Upper Moons who found the hidden valley.',
    steps: [
      dlg('Chapter 9 — Swordsmith Village', d('Narrator', 'Steam rises from hot springs and forges. Tanjiro\'s blade is cracked; he must find his swordsmith.', 'wide'), d('Tanjiro', 'It is so peaceful here... something feels wrong, though. Be ready.', 'player')),
      { t: 'talk', npc: 'smith', at: [6, 6], lines: [d('Hotaru Haganezuka', 'Another chipped blade?! Do you know how many hours I pour into each one?!', 'npc'), d('Tanjiro', 'I am so sorry! I\'ll treat it better, I promise!', 'player')], obj: 'Meet your swordsmith' },
      { t: 'kill', n: 6, types: ['potfish', 'clone', 'grunt'], obj: 'Defend the village from invaders' },
      { t: 'boss', boss: 'gyokko', obj: 'Defeat Gyokko, the Pot Artist' },
      { t: 'boss', boss: 'hantengu', obj: 'Defeat Hantengu, the many-emotioned' },
      dlg(undefined, d('Narrator', 'Mist swirls through the valley as Muichiro and Mitsuri, two Hashira, arrive to finish the fight.', 'wide'), d('Muichiro', 'Does it matter? We cut.', 'npc'), d('Mitsuri', 'We did it! I\'m so proud of everyone!', 'npc'), d('Narrator', 'Muichiro Tokito and Mitsuri Kanroji are now playable.', 'wide')),
    ],
    reward: { xp: 1900, sen: 1800, cp: 300, sp: 5, items: { scarlet_ore: 1, elixir: 2 }, unlockChar: ['muichiro', 'mitsuri'], sword: 'sw_scarlet' },
  },
  {
    id: 'ch10', kind: 'story', cat: 'Story', chapter: 10, title: 'Hashira Training', sub: 'Chapter 10', region: 'hashira', diff: 4, level: 20,
    desc: 'Every Hashira trains the Corps for the final confrontation.',
    steps: [
      dlg('Chapter 10 — Hashira Training', d('Narrator', 'Boulders, logs, waterfalls. Every Hashira has a course. Every course is brutal.', 'wide'), d('Gyomei', 'Namu Amida Butsu. You will all be much stronger by the end.', 'npc')),
      { t: 'reach', at: [32, -34], r: 4, obj: 'Walk to the waterfall meditation seat' },
      { t: 'kill', n: 2, types: ['boulder'], obj: 'Split the training boulders' },
      { t: 'survive', sec: 50, types: ['guard', 'brute', 'regen'], obj: 'Endure the Hashira\'s combined training' },
      { t: 'kill', n: 4, types: ['guard', 'brute'], obj: 'Sparring with elite demons' },
      dlg(undefined, d('Narrator', 'Wind, Stone and Serpent: three more Hashira share their techniques with the Corps.', 'wide'), d('Sanemi', 'Don\'t slack. The next fight won\'t wait.', 'npc'), d('Obanai', 'Do not let me down.', 'npc'), d('Narrator', 'Sanemi Shinazugawa, Gyomei Himejima, and Obanai Iguro are now playable.', 'wide')),
    ],
    reward: { xp: 2400, sen: 2200, cp: 360, sp: 5, items: { whetstone: 3, herb: 3 }, unlockChar: ['sanemi', 'gyomei', 'obanai'], sword: 'sw_storm' },
  },
  {
    id: 'ch11', kind: 'story', cat: 'Story', chapter: 11, title: 'Infinity Castle', sub: 'Chapter 11', region: 'infinity', diff: 5, level: 22,
    desc: 'The floor falls away. The Upper Moons wait in a world of rotating rooms.',
    steps: [
      dlg('Chapter 11 — Infinity Castle', d('Narrator', 'A biwa strums. The floor vanishes. The Hashira and Corps plunge into a labyrinth of impossible architecture.', 'wide'), d('Tanjiro', 'Everyone, stay together! We\'re at the demons\' heart now!', 'player')),
      { t: 'kill', n: 8, types: ['brute', 'obi', 'potfish', 'guard'], obj: 'Fight through the castle halls' },
      { t: 'boss', boss: 'akaza', obj: 'Rematch: defeat Akaza' },
      { t: 'kill', n: 6, types: ['guard', 'caster', 'brute'], obj: 'Clear the next chamber' },
      { t: 'boss', boss: 'doma', obj: 'Defeat Doma, Upper Moon Two' },
      dlg(undefined, d('Narrator', 'Two Upper Moons fall. The castle shudders: the real nightmare is rising from its foundations.', 'wide'), d('Tanjiro', 'It isn\'t over yet. Now for the strongest of them.', 'player')),
    ],
    reward: { xp: 3500, sen: 3000, cp: 500, sp: 6, items: { scarlet_ore: 2, elixir: 3 }, sword: 'sw_black' },
  },
  {
    id: 'ch12', kind: 'story', cat: 'Story', chapter: 12, title: 'Final Battle', sub: 'Chapter 12', region: 'final', diff: 5, level: 24,
    desc: 'The sun will rise. Muzan must fall before it does.',
    steps: [
      dlg('Chapter 12 — Final Battle', d('Narrator', 'The ruins of the castle give way to a shattered plain. Dawn is only hours away.', 'wide'), d('Tanjiro', 'Everyone\'s feelings, everyone\'s strength... all of it, right here. We will hold the line until the sun comes.', 'player')),
      { t: 'kill', n: 10, types: ['brute', 'regen', 'guard', 'caster', 'obi'], obj: 'Cut through Muzan\'s guard' },
      { t: 'boss', boss: 'kokushibo', obj: 'Defeat Kokushibo, Upper Moon One' },
      dlg(undefined, d('Kokushibo', 'Strong... this is the strength I never reached. Do not stop.', 'boss'), d('Narrator', 'The first Upper Moon crumbles. The ground quakes. The King of Demons rises.', 'wide')),
      { t: 'boss', boss: 'muzan', obj: 'Defeat Muzan Kibutsuji until dawn' },
      dlg(undefined, d('Narrator', 'The sun climbs over the horizon. Light touches the plain, and the night ends - for good.', 'wide'), d('Tanjiro', 'Nezuko... we can go home now. All of us.', 'player'), d('Narrator', 'THE END. Thank you for playing Demon Slayer: The Breathing World.', 'wide')),
    ],
    reward: { xp: 6000, sen: 6000, cp: 1000, sp: 8, items: { scarlet_ore: 3, herb: 5 }, sword: 'sw_sun' },
  },
];

const side = (id: string, cat: string, title: string, region: string, level: number, diff: Quest['diff'], req: Quest['req'], desc: string, steps: Step[], xp: number, sen: number, cp: number, items?: Record<string, number>): Quest => ({
  id, kind: 'side', cat, title, sub: cat, region, level, diff, req, desc, steps, reward: { xp, sen, cp, sp: diff >= 4 ? 1 : 0, items }, once: true,
});

const trial = (id: string, char: string, name: string, region: string, chapter: number, level: number, line: string): Quest => ({
  id, kind: 'trial', cat: 'Hashira Trial', title: `Trial of ${name}`, sub: 'Hashira Trial', region, level, diff: 4, req: { chapter },
  desc: `Prove yourself to ${name} and fight beside them as a playable Hashira.`,
  steps: [dlg(`Trial of ${name}`, d(name, line, 'npc'), d('Narrator', 'The trial begins. Stand your ground.', 'wide')),
    { t: 'survive', sec: 40, types: ['guard', 'brute', 'fast', 'regen'], obj: `Survive ${name}'s endurance test` },
    { t: 'kill', n: 3, types: ['guard', 'brute'], obj: 'Defeat the elite demons' },
    dlg(undefined, d(name, 'You have earned my respect. I will lend you my blade.', 'npc'), d('Narrator', `${name} is now playable.`, 'wide'))],
  reward: { xp: 700, sen: 600, cp: 90, sp: 2, unlockChar: [char] }, once: true,
});

export const SIDE: Quest[] = [
  side('s_hunt1', 'Demon Hunting Contract', 'Contract: Mountain Stalkers', 'sagiri', 2, 1, { chapter: 1 }, 'Demons wander the snowy slopes at night. Hunt eight of them.', [{ t: 'kill', n: 8, types: ['grunt', 'fast'], obj: 'Hunt demons on Mount Sagiri' }], 160, 180, 20, { rice_ball: 2 }),
  side('s_missing', 'Missing-Person Investigation', 'The Vanished Woodcutter', 'village', 4, 2, { chapter: 2 }, 'A woodcutter vanished near the village. Gather clues, then track the culprit.', [{ t: 'collect', n: 3, label: 'Investigation Clue', kind: 'clue' }, { t: 'kill', n: 1, types: ['ambush'], obj: 'Hunt the lurking demon' }, { t: 'kill', n: 3, types: ['grunt', 'caster'], obj: 'Clear the lair' }], 240, 260, 30, { herb: 1 }),
  side('s_protect', 'Village Protection', 'Guard the Lantern Festival', 'asakusa', 6, 2, { chapter: 3 }, 'Demons target the festival. Keep the crowd safe for one minute.', [{ t: 'survive', sec: 60, types: ['grunt', 'caster', 'fast'], obj: 'Protect the festival from demons' }], 300, 320, 35, { tonic: 1 }),
  side('s_escort', 'Escort', 'Escort Hanako to the Shrine', 'village', 4, 2, { chapter: 2 }, 'Walk Hanako safely to the village shrine. Stay close - she follows you.', [{ t: 'reach', at: [30, 20], r: 5, obj: 'Escort Hanako to the shrine', escort: 'child' }], 220, 240, 25, { rice_ball: 2 }),
  side('s_night', 'Nighttime Survival', 'Night of Wisteria', 'selection', 5, 3, { chapter: 2 }, 'Hold out against waves of starved demons for ninety seconds.', [{ t: 'survive', sec: 90, types: ['brute', 'fast', 'ambush', 'guard'], obj: 'Survive the endless night' }], 480, 520, 50, { incense: 1 }),
  side('s_elite', 'Elite Demon Hunting', 'Elite Hunt: Silk Weavers', 'natagumo', 10, 3, { chapter: 4 }, 'Three elite spider demons stalk the mountain. Cut them down.', [{ t: 'kill', n: 3, types: ['spider'], obj: 'Hunt elite Spider Demons' }], 520, 560, 55, { steel_shard: 2 }),
  side('s_smith', 'Swordsmith Request', 'Haganezuka\'s Ore Hunt', 'smith', 18, 2, { chapter: 8 }, 'Haganezuka needs fresh ore pieces from the hills.', [{ t: 'collect', n: 4, label: 'Ore Piece', kind: 'ore_piece' }], 520, 600, 40, { scarlet_ore: 1, whetstone: 1 }),
  side('s_lair', 'Hidden Demon Lair', 'The Spider Mother\'s Den', 'natagumo', 10, 4, { chapter: 5 }, 'A hidden lair deep in the mountain shelters a matriarch.', [{ t: 'kill', n: 4, types: ['spider', 'fast'], obj: 'Fight through the lair' }, { t: 'boss', boss: 'spidermother', obj: 'Defeat the Spider Mother' }], 800, 800, 80, { scarlet_ore: 1, elixir: 1 }),
  side('s_zen', 'Character Story', 'Zenitsu: A Coward\'s Courage', 'tsuzumi', 8, 3, { char: 'zenitsu' }, 'Zenitsu has to cross Tsuzumi Mansion without fainting.', [{ t: 'kill', n: 6, types: ['drummer', 'grunt', 'ambush'], obj: 'Zenitsu\'s test: hunt demons in the mansion' }], 600, 640, 60, { charm_ult: 1 }),
  side('s_ino', 'Character Story', 'Inosuke: King of the Mountain', 'sagiri', 8, 3, { char: 'inosuke' }, 'Inosuke challenges every boulder and beast on the mountain.', [{ t: 'kill', n: 2, types: ['boulder'], obj: 'Smash two boulders' }, { t: 'kill', n: 6, types: ['grunt', 'fast', 'brute'], obj: 'Claim the mountain' }], 600, 640, 60, { herb: 2 }),
  side('s_train', 'Training Challenge', 'Gauntlet of Dummies', 'sagiri', 6, 2, { chapter: 1 }, 'A training challenge: strike five dummies without stopping.', [{ t: 'dummy', n: 5, obj: 'Strike each of the five dummies' }], 260, 260, 30, { steel_shard: 1 }),
  side('s_explore', 'Exploration Discovery', 'Lanterns of Asakusa', 'asakusa', 6, 1, { chapter: 3 }, 'Collect four scrolls scattered around the city.', [{ t: 'collect', n: 4, label: 'Corps Scroll', kind: 'scroll' }], 300, 350, 30, { elixir: 1 }),
  side('s_echo', 'Optional Boss', 'The Drum Demon\'s Echo', 'tsuzumi', 8, 4, { chapter: 4 }, 'An echo of Kyogai\'s drums still plays. Silence it once more.', [{ t: 'boss', boss: 'kyogai', obj: 'Defeat the echo of Kyogai' }], 900, 900, 90, { scarlet_ore: 1 }),
  side('s_district', 'Elite Demon Hunting', 'Elite Hunt: Obi Dancers', 'district', 16, 4, { chapter: 8 }, 'Dancing obi demons are slashing through the district.', [{ t: 'kill', n: 5, types: ['obi'], obj: 'Slay the Obi Dancers' }], 850, 900, 85, { whetstone: 2 }),
  side('s_final', 'Nighttime Survival', 'Last Night Before Dawn', 'final', 24, 5, { chapter: 11 }, 'Hold the line against Muzan\'s remnants.', [{ t: 'survive', sec: 100, types: ['brute', 'regen', 'guard', 'caster'], obj: 'Hold the line until dawn' }], 1600, 1500, 150, { scarlet_ore: 2 }),
];

export const TRIALS: Quest[] = [
  trial('trial_giyu', 'giyu', 'Giyu Tomioka', 'village', 2, 5, 'Do not hesitate. Show me you can keep your heart calm under pressure.'),
  trial('trial_shinobu', 'shinobu', 'Shinobu Kocho', 'asakusa', 4, 8, 'Smile, breathe, and show me how you handle poison and precision.'),
  trial('trial_obanai', 'obanai', 'Obanai Iguro', 'butterfly', 6, 12, 'Weakness is a stain on the Corps. Wipe it clean.'),
  trial('trial_sanemi', 'sanemi', 'Sanemi Shinazugawa', 'train', 7, 14, 'Come at me with everything. If you break, I do not care.'),
  trial('trial_gyomei', 'gyomei', 'Gyomei Himejima', 'district', 8, 16, 'Namu Amida Butsu. Show me the endurance of a mountain.'),
];

export const TRAINING: Quest = {
  id: 'training_free', kind: 'training', cat: 'Training', title: 'Free Training', sub: 'Training', region: 'sagiri', level: 1, diff: 1,
  desc: 'Practice combos, dodges and breathing forms against dummies.', steps: [{ t: 'dummy', n: 9999, obj: 'Practice freely - open the pause menu to leave' }],
  reward: { xp: 0, sen: 0, cp: 0 },
};

export const ALL_QUESTS: Quest[] = [...STORY, ...SIDE, ...TRIALS, TRAINING];
export const QUEST_BY_ID: Record<string, Quest> = Object.fromEntries(ALL_QUESTS.map((q) => [q.id, q]));
