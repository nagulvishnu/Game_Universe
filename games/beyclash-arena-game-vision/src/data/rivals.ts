import type { BeyConfig, DistrictId, Look, RivalDef, NpcDef } from '../game/types';

export const DISTRICT_CENTERS: Record<DistrictId, { x: number; z: number }> = {
  residential: { x: -76, z: -40 },
  shopping: { x: 0, z: -40 },
  training: { x: 76, z: -40 },
  competition: { x: 76, z: 40 },
  elite: { x: 0, z: 40 },
  championship: { x: -76, z: 40 },
};

export const look = (p: Partial<Look>): Look => ({
  skin: '#ffe0cc', hair: '#3a2a22', hairStyle: 'short', eyes: '#3b7bff', top: '#ffffff', top2: '#333333',
  pants: '#2c3350', shoes: '#f2f2f2', acc: 'none', accColor: '#ff4040', height: 1, build: 1, ...p,
});
const at = (d: DistrictId, dx: number, dz: number) => ({ x: DISTRICT_CENTERS[d].x + dx, z: DISTRICT_CENTERS[d].z + dz });
const bey = (name: string, color: string, layer: string, disc: string, driver: string, accessory = 'no-accessory'): BeyConfig => ({ name, color, layer, disc, driver, accessory });
const SK = ['#ffe0cc', '#f6c9a8', '#e0a97c', '#b97d55', '#8a5a3c'];

export const RIVALS: RivalDef[] = [
  // ---------------- Residential ----------------
  {
    id: 'riku', name: 'Riku Hanabi', title: 'Neighbourhood Newbie', category: 'Beginner', district: 'residential', home: at('residential', 11, 2), facing: -1.57,
    look: look({ skin: SK[0], hair: '#ff9d3a', hairStyle: 'spiky', eyes: '#7a4a1a', top: '#ffd24a', top2: '#ff7a3a', pants: '#3c4f8a', acc: 'headband', accColor: '#ff3b3b', height: 0.88, build: 0.9 }),
    personality: 'Bubbly, over-confident rookie who loves bragging.',
    bey: bey('Mini Comet', '#ffb13a', 'ember-fang', 'standard-disc', 'flat-driver'), strategy: 'aggressive', difficulty: 'Beginner',
    req: {}, reward: 350, wallet: 1200,
    lines: {
      greet: "Hey, you're new around here! I'm Riku. I'm going to be World Champion someday, y'know!",
      talk: ["I practise every day after school at the park. My Mini Comet never stops attacking!", "Win by ring-out and you score double. Burst is the best though - triple!", "The Elder Tree in the middle of town? Legend says the strongest bladers train beneath it."],
      locked: 'Not yet!', win: 'Ha! Told you my Comet is unstoppable!', lose: "Whoa... you're really good! Let's go again sometime!", defeated: "You beat me fair and square. I'm training twice as hard now. Go find Mina!",
    },
  },
  {
    id: 'mina', name: 'Mina Sorano', title: 'Garden Guardian', category: 'Defense', district: 'residential', home: at('residential', -10, -3), facing: 1.57,
    look: look({ skin: SK[1], hair: '#7a4bff', hairStyle: 'ponytail', eyes: '#ff62a8', top: '#ff9ec7', top2: '#ffffff', pants: '#5a4a8a', skirt: true, height: 0.93, build: 0.92 }),
    personality: 'Calm and patient. Waits for her opponent to make mistakes.',
    bey: bey('Petal Shield', '#c68bff', 'iron-bulwark', 'standard-disc', 'sharp-driver'), strategy: 'defensive', difficulty: 'Beginner',
    req: {}, reward: 400, wallet: 1400,
    lines: {
      greet: "Oh, hello. I'm Mina. I look after the flower beds... and I battle when someone asks nicely.",
      talk: ["A defensive top doesn't need to chase. It lets you come to it.", "Heavy layers and grip drivers make a top really hard to push around.", "Daichi from the next street keeps charging at everyone. Someone should teach him patience."],
      locked: 'Maybe later.', win: 'Patience wins again.', lose: "You broke through my guard. That was lovely.", defeated: "My Petal Shield bows to you. Try the shopping district - the shops stock new parts.",
    },
  },
  {
    id: 'daichi', name: 'Daichi Kurogane', title: 'Street Bruiser', category: 'Aggressive', district: 'residential', home: at('residential', 2, 14), facing: 3.14,
    look: look({ skin: SK[2], hair: '#1b1b1f', hairStyle: 'mohawk', eyes: '#d63030', top: '#2b2b30', top2: '#ff3b3b', pants: '#4a4a52', height: 1.08, build: 1.2, acc: 'scarf', accColor: '#ff3b3b' }),
    personality: 'Loud and aggressive. Respects only strength.',
    bey: bey('Iron Rampage', '#ff3b3b', 'ember-fang', 'heavy-disc', 'flat-driver'), strategy: 'aggressive', difficulty: 'Easy',
    req: { level: 1 }, reward: 650, wallet: 2200, ambush: true,
    lines: {
      greet: "OI! You! Yeah, you with the shiny Beyblade. Battle me. Now.",
      talk: ["Attack! Attack! Attack! That's all there is!", "Ring-outs are for people too scared to burst a top.", "Dodging is for cowards. ...Okay, maybe it works sometimes."],
      locked: 'Come back stronger.', win: 'HAH! Crushed!', lose: "Tch... lucky hit. Again someday!", defeated: "Fine. You're strong. Don't let it go to your head.",
      surprise: "HEY! Stop right there! Nobody walks through MY street without a battle!",
    },
  },
  {
    id: 'yuzu', name: 'Yuzu Tanabe', title: 'Park Sprinter', category: 'Stamina', district: 'residential', home: at('residential', -12, 11), facing: 0.8,
    look: look({ skin: SK[0], hair: '#2fd6a4', hairStyle: 'twin', eyes: '#1a8f6a', top: '#35d0ff', top2: '#ffffff', pants: '#f2f2f2', skirt: true, height: 0.95, build: 0.9, acc: 'cap', accColor: '#ffd24a' }),
    personality: 'Energetic. Never stops moving - except her Beyblade, which hardly moves at all.',
    bey: bey('Calm Breeze', '#38e08c', 'gale-ring', 'standard-disc', 'ball-driver'), strategy: 'stamina', difficulty: 'Easy',
    req: { level: 2, defeated: ['riku'] }, reward: 700, wallet: 2000,
    lines: {
      greet: "Yo! Wanna race? No? Okay then, battle! My Calm Breeze can spin all day.",
      talk: ["Stamina tops barely move. They just wait until you wear yourself out!", "If you chase a stamina top, you'll burn your own energy. Be smart.", "I run laps around the park every morning. Great for focus!"],
      locked: 'Beat Riku first, he talks about you.', win: 'And I did not even break a sweat!', lose: "You outlasted me?! Wow!", defeated: "Whew. You're better at this than I am. Good luck in the Shopping District!",
    },
  },
  {
    id: 'gengo', name: 'Old Master Gengo', title: 'Park Legend', category: 'Technical', district: 'residential', home: at('residential', 9, -15), facing: 2.4,
    look: look({ skin: SK[1], hair: '#e8e8f0', hairStyle: 'swept', eyes: '#444444', top: '#7a5a3a', top2: '#d6c08a', pants: '#554433', coat: true, height: 0.92, build: 1.05, acc: 'glasses', accColor: '#222222' }),
    personality: 'Wise old blader who tests newcomers with a bonus challenge.',
    bey: bey('Ancient Oak', '#b58b4a', 'nova-halo', 'ring-disc', 'orbit-driver', 'balance-chip'), strategy: 'adaptive', difficulty: 'Normal',
    req: { level: 3, defeated: ['mina', 'daichi'] }, reward: 1200, wallet: 4000,
    special: { desc: 'Win by BURST to impress the Master (+2500 pts and a Guard Bolt).', need: ['BURST'], bonus: 2500, part: 'guard-bolt' },
    lines: {
      greet: "Ho ho. Another young spinner. Sit, listen. Let an old man test your resolve.",
      talk: ["Every top has a story. Learn yours.", "A burst is not luck. It is the sum of many small mistakes.", "Heavy layers resist bursting. Light layers dance. Choose your philosophy."],
      locked: 'Prove yourself to the park first.', win: "Experience beats speed, child.", lose: "Hm. The next generation is strong.", defeated: "The Elder Tree smiles. Go - the whole city awaits you.",
    },
  },
  // ---------------- Shopping ----------------
  {
    id: 'sora', name: 'Sora Nakamura', title: 'Mall Racer', category: 'Speed', district: 'shopping', home: at('shopping', 11, 3), facing: -1.57,
    look: look({ skin: SK[1], hair: '#35d0ff', hairStyle: 'swept', eyes: '#0a5a9a', top: '#ff7a3a', top2: '#ffffff', pants: '#222a44', acc: 'goggles', accColor: '#ffd24a', height: 1.02, build: 0.95 }),
    personality: 'Cocky speed freak who never stands still.',
    bey: bey('Zip Fang', '#35d0ff', 'storm-wing', 'light-disc', 'rush-driver'), strategy: 'evasive', difficulty: 'Normal',
    req: { level: 2 }, reward: 1000, wallet: 3000,
    lines: {
      greet: "You wanna battle me? Try to hit me first! Zip Fang is the fastest top in the mall.",
      talk: ["Speed is everything. If you can't touch me, you can't beat me.", "Rush drivers are amazing but they drain stamina like crazy.", "I got my parts at the Bey Garage. Take a look - levels unlock new gear."],
      locked: 'Come back at level 2.', win: 'Too slow!', lose: "Whoa, you actually caught me.", defeated: "Okay okay, you're fast enough. Respect.",
    },
  },
  {
    id: 'hikari', name: 'Hikari Tsukishiro', title: 'Data Analyst', category: 'Technical', district: 'shopping', home: at('shopping', -11, -3), facing: 1.57,
    look: look({ skin: SK[0], hair: '#5b6bff', hairStyle: 'bob', eyes: '#b9c6ff', top: '#ffffff', top2: '#5b6bff', pants: '#2a3050', acc: 'glasses', accColor: '#111111', height: 0.97, build: 0.88 }),
    personality: 'Analytical. Adapts her strategy to how you play.',
    bey: bey('Logic Halo', '#8fa0ff', 'nova-halo', 'standard-disc', 'orbit-driver'), strategy: 'adaptive', difficulty: 'Normal',
    req: { level: 3, defeated: ['riku'] }, reward: 1200, wallet: 3200,
    lines: {
      greet: "I've collected data on all local bladers. You're the new variable. Fascinating.",
      talk: ["My top changes tactics based on stamina advantage. Predictable? Not at all.", "Balanced builds win when they adapt. Stay flexible.", "Statistically, burst finishes happen after eight impacts. Roughly."],
      locked: 'Insufficient data on you. Defeat Riku first.', win: 'As calculated.', lose: "My model did not predict that...", defeated: "Updating records: you are stronger than my estimate. Good luck.",
    },
  },
  {
    id: 'gonzo', name: 'Gonzo Baptiste', title: 'Shop Owner', category: 'Defense', district: 'shopping', home: at('shopping', -3, 13), facing: 3.14,
    look: look({ skin: SK[3], hair: '#222222', hairStyle: 'short', eyes: '#2a2a2a', top: '#ffb13a', top2: '#7a3a1a', pants: '#3a3a3a', height: 1.1, build: 1.3, acc: 'headband', accColor: '#ffffff' }),
    personality: 'Jolly shopkeeper with an unbreakable defence.',
    bey: bey('Big Bulwark', '#ffb13a', 'iron-bulwark', 'heavy-disc', 'grip-driver', 'guard-bolt'), strategy: 'defensive', difficulty: 'Normal',
    req: { level: 3 }, reward: 1300, wallet: 5000,
    lines: {
      greet: "Welcome, welcome! Buying or battling? Either way, Gonzo's ready!",
      talk: ["I sell the best defensive parts in town. Test them on me first!", "Heavy disc plus grip driver equals a wall. Hard to burst, too.", "You'll need credits for the shop. Win battles, collect your transfer."],
      locked: 'Shop is busy. Come back later.', win: 'A sturdy customer deserves a sturdy loss!', lose: "Ahaha! Best battle this week!", defeated: "You've earned a discount. (Not really. But you've earned my respect.)",
    },
  },
  {
    id: 'kaito', name: 'Neon Kaito', title: 'Night Market Trickster', category: 'Speed', district: 'shopping', home: at('shopping', 10, -14), facing: 3.0,
    look: look({ skin: SK[2], hair: '#ff3d9a', hairStyle: 'spiky', eyes: '#ffd24a', top: '#1a1a2a', top2: '#ff3d9a', pants: '#2a1a3a', shoes: '#ff3d9a', acc: 'mask', accColor: '#ffffff', height: 1.04, build: 0.9 }),
    personality: 'Playful trickster who strikes when you are not looking.',
    bey: bey('Glitch Viper', '#ff3d9a', 'storm-wing', 'spike-disc', 'flat-driver'), strategy: 'opportunist', difficulty: 'Normal',
    req: { level: 4, defeated: ['sora'] }, reward: 1500, wallet: 3500, ambush: true,
    lines: {
      greet: "Psst. Lost? Nah. I'm Kaito. Let's play a little game.",
      talk: ["I wait. I watch. When you're near the edge... bam!", "Stay away from the red gaps in the wall. That's where bladers vanish.", "Night market's best after dark. Neon everywhere."],
      locked: 'Beat Sora and maybe we can talk.', win: 'Gotcha!', lose: "Okay, okay, you saw through me!", defeated: "Fair play. Catch you later, champ.",
      surprise: "Boo! Did I scare you? Battle me before the lights go out!",
    },
  },
  // ---------------- Training ----------------
  {
    id: 'raijin', name: 'Coach Raijin', title: 'Head Trainer', category: 'Technical', district: 'training', home: at('training', -11, 3), facing: 1.57,
    look: look({ skin: SK[3], hair: '#1b1b1f', hairStyle: 'short', eyes: '#222222', top: '#2a6af0', top2: '#ffffff', pants: '#1b2a5a', height: 1.1, build: 1.15, acc: 'headband', accColor: '#ffffff' }),
    personality: 'Disciplined coach. Pushes you to improve.',
    bey: bey('Thunder Gear', '#2a6af0', 'nova-halo', 'ring-disc', 'sharp-driver', 'balance-chip'), strategy: 'adaptive', difficulty: 'Normal',
    req: { level: 5 }, reward: 1600, wallet: 5000,
    lines: {
      greet: "Another trainee! Good. Show me you can control your top and not just launch it!",
      talk: ["Dash with Space to land a heavy hit - but it costs stamina.", "Battles are won by stamina, positioning, and nerve.", "Use the practice stadiums here. Try different parts and watch the stats."],
      locked: 'Level 5 minimum. Train more.', win: 'Discipline!', lose: "Excellent form. You'd make a fine coach.", defeated: "You've surpassed my lessons. Go to the Competition District.",
    },
  },
  {
    id: 'akane', name: 'Akane Hoshizora', title: 'Endurance Queen', category: 'Stamina', district: 'training', home: at('training', 12, -4), facing: -1.57,
    look: look({ skin: SK[0], hair: '#ff7ab8', hairStyle: 'long', eyes: '#5a1a8a', top: '#ffffff', top2: '#ff7ab8', pants: '#3a2a5a', skirt: true, height: 1.0, build: 0.9 }),
    personality: 'Serene and unflappable. Her top outlasts everything.',
    bey: bey('Starlit Needle', '#ff7ab8', 'gale-ring', 'ring-disc', 'needle-driver', 'stamina-core'), strategy: 'stamina', difficulty: 'Hard',
    req: { level: 6, defeated: ['gonzo'] }, reward: 2200, wallet: 6500,
    lines: {
      greet: "Hello. Do you know how long a star burns? I intend to find out. Battle?",
      talk: ["I don't chase. I wait. The ring-out will find you.", "Needle drivers live forever - until someone nudges them.", "Break a stamina user's rhythm with sharp hits."],
      locked: 'Not ready yet.', win: 'The stars align.', lose: "My light dims... bravo.", defeated: "You burn brighter than I do. Go on.",
    },
  },
  {
    id: 'bruno', name: 'Bruno Steelheart', title: 'Iron Wall', category: 'Defense', district: 'training', home: at('training', 4, 14), facing: 3.14,
    look: look({ skin: SK[4], hair: '#111111', hairStyle: 'short', eyes: '#333333', top: '#666b78', top2: '#ffd24a', pants: '#333844', height: 1.15, build: 1.35, acc: 'scarf', accColor: '#ffd24a' }),
    personality: 'Gentle giant whose top never budges.',
    bey: bey('Granite King', '#ffd24a', 'aegis-dome', 'gravity-disc', 'grip-driver', 'ward-ring'), strategy: 'defensive', difficulty: 'Hard',
    req: { level: 7, defeated: ['raijin'] }, reward: 2500, wallet: 8000,
    lines: {
      greet: "Rrr. I do not like to fight. But I like to lift weights. And to battle. Come.",
      talk: ["You can't burst a mountain.", "Hit me at speed and I'll hit back harder.", "Gravity discs weigh a ton. Try one when you can afford it."],
      locked: 'Coach Raijin first.', win: 'Mountain stands.', lose: "The mountain crumbles. Impressive.", defeated: "You hit hard, small friend. I'm proud.",
    },
  },
  {
    id: 'zephyr', name: 'Zephyr Kazama', title: 'Wind Sprinter', category: 'Speed', district: 'training', home: at('training', -9, -13), facing: 0.6,
    look: look({ skin: SK[2], hair: '#e8ffe8', hairStyle: 'swept', eyes: '#2fd6a4', top: '#2fd6a4', top2: '#ffffff', pants: '#1a3a3a', height: 1.05, build: 0.9, acc: 'goggles', accColor: '#2fd6a4' }),
    personality: 'Free spirit. Always circling, always smiling.',
    bey: bey('Cyclone Dance', '#2fd6a4', 'storm-wing', 'light-disc', 'rush-driver', 'balance-chip'), strategy: 'evasive', difficulty: 'Hard',
    req: { level: 8, defeated: ['akane'] }, reward: 2800, wallet: 7000,
    lines: {
      greet: "Feel that breeze? That's me getting ready. Wanna dance?",
      talk: ["I orbit my opponent until they get dizzy and stumble into the pockets.", "Stay near the center and don't chase me!", "Light discs make you quick but easier to knock about."],
      locked: 'Akane says you need more practice.', win: 'Caught in the wind!', lose: "You grounded me... fun!", defeated: "Soar high, rival. The breeze follows you.",
    },
  },
  // ---------------- Competition ----------------
  {
    id: 'reina', name: 'Captain Reina Ashford', title: 'Coliseum Captain', category: 'Aggressive', district: 'competition', home: at('competition', -12, 3), facing: 1.57,
    look: look({ skin: SK[1], hair: '#c0182e', hairStyle: 'ponytail', eyes: '#ffb13a', top: '#c0182e', top2: '#ffd24a', pants: '#2a2a3a', coat: true, height: 1.05, build: 1.0 }),
    personality: 'Fierce team captain. Fights with pride.',
    bey: bey('Crimson Lance', '#ff2b4a', 'twin-fury', 'spike-disc', 'flat-driver', 'spike-cap'), strategy: 'aggressive', difficulty: 'Hard',
    req: { level: 9, tournament: 'local' }, reward: 3000, wallet: 9000,
    lines: {
      greet: "A local champion? Show me you belong in the Coliseum!",
      talk: ["I attack head-on. That's honour.", "Tournaments test nerve. Practise your launch timing!", "Elite bladers hide in the north-west. Prove yourself first."],
      locked: 'Win the Local Tournament and then we talk.', win: 'Victory for the Lance!', lose: "A fine duel. Respect.", defeated: "You've earned my banner. Go - the elite await.",
    },
  },
  {
    id: 'tobias', name: 'Tobias Vane', title: 'Tactician', category: 'Technical', district: 'competition', home: at('competition', 11, -3), facing: -1.57,
    look: look({ skin: SK[0], hair: '#222a44', hairStyle: 'swept', eyes: '#35d0ff', top: '#2b3a6a', top2: '#c9d6ff', pants: '#1a2038', coat: true, acc: 'glasses', accColor: '#35d0ff', height: 1.08, build: 0.9 }),
    personality: 'Cold, calculating, always three moves ahead.',
    bey: bey('Chess Prism', '#8cf0ff', 'nova-halo', 'prism-disc', 'orbit-driver', 'balance-chip'), strategy: 'adaptive', difficulty: 'Hard',
    req: { level: 10, defeated: ['reina'] }, reward: 3200, wallet: 9500,
    lines: {
      greet: "Battle is chess played at 1000 RPM. Shall we begin?",
      talk: ["I switch plans the instant I hold an advantage.", "If you're low on stamina, avoid contact. Always.", "Burst gauges accumulate. Count your hits - and theirs."],
      locked: 'Captain Reina first.', win: 'Checkmate.', lose: "A gambit I did not foresee.", defeated: "You play well. We shall meet in the finals.",
    },
  },
  {
    id: 'jun', name: 'Jun "Shadow" Mizuki', title: 'Silent Striker', category: 'Speed', district: 'competition', home: at('competition', 3, 14), facing: 3.14,
    look: look({ skin: SK[2], hair: '#101018', hairStyle: 'long', eyes: '#c068ff', top: '#1a1a24', top2: '#7a4bff', pants: '#121218', acc: 'mask', accColor: '#7a4bff', height: 1.02, build: 0.85 }),
    personality: 'Rarely speaks. Waits, then ends the battle in a single strike.',
    bey: bey('Silent Eclipse', '#7a4bff', 'phantom-claw', 'light-disc', 'rush-driver', 'guard-bolt'), strategy: 'opportunist', difficulty: 'Hard',
    req: { level: 11, tournament: 'district' }, reward: 3500, wallet: 10000, ambush: true,
    special: { desc: 'Win by RING_OUT or BURST (+4000 pts and a Light Disc).', need: ['RING_OUT', 'BURST'], bonus: 4000, part: 'light-disc' },
    lines: {
      greet: "...", talk: ["...", "Edge. Pocket. Gone.", "Don't blink."],
      locked: '...Not yet.', win: '...', lose: "...Tch. Well fought.", defeated: "...",
      surprise: "...Fight me.",
    },
  },
  // ---------------- Elite ----------------
  {
    id: 'lucian', name: 'Lucian Ardent', title: 'Flame Prince', category: 'Elite', district: 'elite', home: at('elite', 12, 3), facing: -1.57,
    look: look({ skin: SK[0], hair: '#ff6a2e', hairStyle: 'swept', eyes: '#ff2b2b', top: '#1a1030', top2: '#ff6a2e', pants: '#14102a', coat: true, height: 1.1, build: 1.0, acc: 'cape', accColor: '#c0182e' }),
    personality: 'Arrogant heir to a blading dynasty. Burns bright.',
    bey: bey('Solar Inferno', '#ff6a2e', 'phantom-claw', 'spike-disc', 'flat-driver', 'fury-crown'), strategy: 'aggressive', difficulty: 'Expert',
    req: { level: 14, tournament: 'city' }, reward: 4200, wallet: 14000,
    lines: {
      greet: "A commoner in the Elite District? Entertaining. Come, amuse me.",
      talk: ["My family has produced champions for four generations.", "Power is the only truth in this ring.", "The Championship District is where my sister waits. Few reach her."],
      locked: 'Win the City Championship, then perhaps.', win: 'Burn!', lose: "Impossible... I burned out?", defeated: "Hmph. You have earned my respect. Not my friendship.",
    },
  },
  {
    id: 'seraphina', name: 'Seraphina Vale', title: 'Silver Swan', category: 'Stamina', district: 'elite', home: at('elite', -11, -3), facing: 1.57,
    look: look({ skin: SK[0], hair: '#e8ecff', hairStyle: 'long', eyes: '#8fa0ff', top: '#ffffff', top2: '#8fa0ff', pants: '#c6d0ff', skirt: true, height: 1.06, build: 0.88 }),
    personality: 'Graceful and mysterious. Never loses her composure.',
    bey: bey('Silver Lullaby', '#c6d0ff', 'gale-ring', 'ring-disc', 'needle-driver', 'stamina-core'), strategy: 'stamina', difficulty: 'Expert',
    req: { level: 15, tournament: 'city' }, reward: 4500, wallet: 14000,
    lines: {
      greet: "How lovely. A challenger. Please, take your time. I certainly will.",
      talk: ["The swan floats while the water churns beneath.", "Impatience is the only enemy of endurance.", "Strike the needle hard enough and even I wobble."],
      locked: 'Not yet.', win: 'Sweet dreams.', lose: "Oh... I do believe you've beaten me.", defeated: "A beautiful finish. Thank you.",
    },
  },
  {
    id: 'gideon', name: 'Gideon Rook', title: 'Fortress Lord', category: 'Defense', district: 'elite', home: at('elite', 4, -14), facing: 0,
    look: look({ skin: SK[3], hair: '#e8e8e8', hairStyle: 'short', eyes: '#aaaaaa', top: '#33384a', top2: '#c9d6ff', pants: '#22263a', coat: true, height: 1.14, build: 1.3, acc: 'scarf', accColor: '#c9d6ff' }),
    personality: 'Stoic fortress. Wins by letting you break yourself.',
    bey: bey('Citadel', '#9aa7ff', 'titan-crown', 'gravity-disc', 'grip-driver', 'ward-ring'), strategy: 'defensive', difficulty: 'Expert',
    req: { level: 16, defeated: ['bruno'], tournament: 'city' }, reward: 4800, wallet: 15000,
    lines: {
      greet: "Every strike you land will be answered. Do you still wish to challenge me?",
      talk: ["A fortress is only as strong as its patience.", "Burst resistance is the foundation of defence.", "Break my wall and you'll break every wall."],
      locked: 'Bruno must acknowledge you first.', win: 'The wall stands.', lose: "The wall has fallen...", defeated: "The wall acknowledges you.",
    },
  },
  {
    id: 'kaede', name: 'Kaede Ishikawa', title: 'Grand Strategist', category: 'Technical', district: 'elite', home: at('elite', -10, 13), facing: 2.5,
    look: look({ skin: SK[1], hair: '#2f7a3a', hairStyle: 'bun', eyes: '#2f7a3a', top: '#ffffff', top2: '#2f7a3a', pants: '#223a28', coat: true, acc: 'glasses', accColor: '#2f7a3a', height: 0.98, build: 0.9 }),
    personality: 'Brilliant strategist who has studied every top in the city.',
    bey: bey('Mind Maze', '#35e08c', 'nova-halo', 'prism-disc', 'orbit-driver', 'balance-chip'), strategy: 'adaptive', difficulty: 'Expert',
    req: { level: 17, defeated: ['lucian'], tournament: 'city' }, reward: 5200, wallet: 16000,
    special: { desc: 'Win by BURST (+5000 pts and a Fury Crown).', need: ['BURST'], bonus: 5000, part: 'fury-crown' },
    lines: {
      greet: "I've watched your battles. You win fast but waste stamina. Let's see if you've fixed it.",
      talk: ["An adaptive top reads the scoreboard better than its master.", "Study the AI. Every strategy has a counter.", "Strategy beats power. Unless the power is large."],
      locked: 'Lucian first. He sets the bar.', win: 'Pattern recognised.', lose: "That is... not in my notes.", defeated: "Your notes are now in mine.",
    },
  },
  // ---------------- Championship ----------------
  {
    id: 'valkyrie', name: 'Valkyrie Thorne', title: 'Storm Empress', category: 'Championship', district: 'championship', home: at('championship', 12, 3), facing: -1.57,
    look: look({ skin: SK[1], hair: '#ffd24a', hairStyle: 'long', eyes: '#35d0ff', top: '#fff2b0', top2: '#b8860b', pants: '#33224a', coat: true, height: 1.1, build: 1.0, acc: 'cape', accColor: '#ffd24a' }),
    personality: 'Regional champion. Commands the ring with overwhelming pressure.',
    bey: bey('Tempest Regalia', '#ffd24a', 'phantom-claw', 'prism-disc', 'rush-driver', 'fury-crown'), strategy: 'aggressive', difficulty: 'Champion',
    req: { level: 18, rep: 900, tournament: 'elite' }, reward: 7000, wallet: 25000,
    lines: {
      greet: "So you are the one climbing the ranks. Let us see if it was luck.",
      talk: ["I never defend. I am the storm.", "The World Championship is not for the timid.", "My brother Lucian thinks fire is stronger than lightning. He is wrong."],
      locked: 'Win the Elite Championship and gain renown first.', win: 'Storm over.', lose: "A worthy storm.", defeated: "The Empress yields. The final throne is in sight.",
    },
  },
  {
    id: 'ozymandias', name: 'Ozymandias Crane', title: 'Immortal', category: 'Championship', district: 'championship', home: at('championship', -12, -3), facing: 1.57,
    look: look({ skin: SK[2], hair: '#b8b8c8', hairStyle: 'swept', eyes: '#ffd24a', top: '#33224a', top2: '#ffd24a', pants: '#1a1230', coat: true, height: 1.12, build: 1.1, acc: 'cape', accColor: '#7a4bff' }),
    personality: 'Ancient champion. Has not lost in twenty years.',
    bey: bey('Eternal Monolith', '#c9d6ff', 'titan-crown', 'ring-disc', 'orbit-driver', 'ward-ring'), strategy: 'adaptive', difficulty: 'Champion',
    req: { level: 19, tournament: 'elite' }, reward: 7500, wallet: 28000,
    lines: {
      greet: "Another hopeful. I have seen thousands. Let me see what makes you different.",
      talk: ["Two decades. Not one defeat.", "Defence, stamina, power... all of it is a conversation.", "The champion's secret: know when to do nothing."],
      locked: 'Return when the Elite Championship is yours.', win: 'As expected.', lose: "...Twenty years. Ended today.", defeated: "You have my blessing. Do not squander it.",
    },
  },
  {
    id: 'aurelia', name: 'Aurelia Zenith', title: 'World Champion', category: 'Championship', district: 'championship', home: at('championship', 2, -15), facing: 0,
    look: look({ skin: SK[0], hair: '#fff7d6', hairStyle: 'twin', eyes: '#ff9d2e', top: '#ffffff', top2: '#ffd24a', pants: '#ffe9a8', skirt: true, coat: true, height: 1.03, build: 0.9, acc: 'cape', accColor: '#ffd24a' }),
    personality: 'The reigning World Champion. Kind, humble, and utterly terrifying in the ring.',
    bey: bey('Genesis Zenith', '#fff2b0', 'world-sovereign', 'prism-disc', 'orbit-driver', 'ward-ring'), strategy: 'adaptive', difficulty: 'Champion',
    req: { level: 21, tournament: 'national', defeated: ['valkyrie', 'ozymandias'] }, reward: 9000, wallet: 40000,
    lines: {
      greet: "I've been waiting to meet you. Don't hold back - I won't.",
      talk: ["The World Championship is a celebration of every blader who dared to dream.", "I was once an unknown beginner too. Remember where you started.", "Whoever stands in the final will remember it forever."],
      locked: 'Win the National Championship and defeat the Storm Empress and the Immortal.', win: 'What a wonderful battle!', lose: "You've done it. You're truly one of us.", defeated: "The champion's seat is yours to defend.",
    },
  },
  {
    id: 'hayato', name: 'Hayato Kuroba', title: 'Dojo Rival', category: 'Aggressive', district: 'training', home: at('training', 12, 12), facing: -2.4,
    look: look({ skin: SK[1], hair: '#101018', hairStyle: 'spiky', eyes: '#ff3b3b', top: '#c0182e', top2: '#ffffff', pants: '#222222', height: 1.04, build: 1.05, acc: 'headband', accColor: '#ffffff' }),
    personality: 'Hot-headed dojo student who dreams of beating Coach Raijin.',
    bey: bey('Crimson Fang', '#ff2b4a', 'ember-fang', 'spike-disc', 'flat-driver', 'spike-cap'), strategy: 'aggressive', difficulty: 'Normal',
    req: { level: 5 }, reward: 1500, wallet: 4000,
    lines: {
      greet: "You're training here? Then you're my rival. Fight me!",
      talk: ["I'm going to beat Coach one day!", "Spike parts hit hard, but I can feel my stamina vanish.", "Pockets in the wall are the whole game. Shove them there!"],
      locked: 'Not until level 5.', win: 'Yes!', lose: "I'll train harder!", defeated: "You're good. I'll come back stronger.",
    },
  },
];

export const RIVAL_MAP: Record<string, RivalDef> = Object.fromEntries(RIVALS.map((r) => [r.id, r]));

export const NPCS: NpcDef[] = [
  { id: 'ayame', name: 'Ayame', role: 'Florist', district: 'residential', home: at('residential', -9, 2), facing: -1.2, look: look({ skin: SK[0], hair: '#ffb3c6', hairStyle: 'bun', top: '#ffffff', top2: '#ff8fb8', skirt: true, pants: '#ff8fb8' }), lines: ["The cherry blossoms are early this year. Riku says they bring luck to bladers.", "Mina loves my daisies. She guards them like they're gold.", "If you win enough battles, you'll be famous around here."] },
  { id: 'kenji', name: 'Kenji', role: 'Mail Carrier', district: 'residential', home: at('residential', 14, -9), facing: 2.0, look: look({ skin: SK[2], hair: '#222', top: '#2a6af0', top2: '#ffffff', pants: '#1a2a5a', acc: 'cap', accColor: '#2a6af0', build: 1.1 }), lines: ["Deliveries all day, but I peek at the park battles when I can.", "Every district has an info board. They list tournament news.", "Heard the Local Tournament is held in the Competition District."] },
  { id: 'miho', name: 'Miho', role: 'Shop Clerk', district: 'shopping', home: at('shopping', 14, 12), facing: 3.14, look: look({ skin: SK[1], hair: '#ff9d3a', hairStyle: 'ponytail', top: '#35d0ff', top2: '#ffffff', skirt: true, pants: '#2a2a44', acc: 'headband', accColor: '#ff3b3b' }), lines: ["Welcome to Bey Garage! Parts unlock as you level up.", "Layers set your attack and defence. Drivers decide how your top moves.", "Guard Bolt makes you much harder to burst!"] },
  { id: 'taka', name: 'Taka', role: 'Street Vendor', district: 'shopping', home: at('shopping', -9, 13), facing: 3.0, look: look({ skin: SK[0], hair: '#552211', top: '#ff7a3a', top2: '#ffffff', pants: '#333', build: 1.2, acc: 'headband', accColor: '#fff' }), lines: ["Takoyaki! Hot and fresh! ...Oh, a blader? Eat first, battle later!", "The mall gets wild after dark. Neon everywhere.", "Gonzo's top never moves. It's creepy."] },
  { id: 'rina', name: 'Rina', role: 'Trainer Assistant', district: 'training', home: at('training', 9, 3), facing: -1.5, look: look({ skin: SK[1], hair: '#35d0ff', hairStyle: 'ponytail', top: '#ffffff', top2: '#2a6af0', pants: '#1a2a5a', acc: 'headband', accColor: '#ff3b3b' }), lines: ["Use the Training Stadium to test parts. Nothing there affects your rank.", "Training teaches SPIN, RING_OUT and BURST finishes.", "Coach Raijin likes students who ask questions."] },
  { id: 'announcer', name: 'Mr. Hoshino', role: 'Announcer', district: 'competition', home: at('competition', 14, 5), facing: 3.0, look: look({ skin: SK[2], hair: '#222', top: '#ffd24a', top2: '#c0182e', pants: '#222', acc: 'none', coat: true, height: 1.05 }), lines: ["Ladies and gentlemen, the tournaments begin at the registration desk!", "Win the Local Tournament and the Coliseum will notice you.", "Each tournament has an entry fee and requirements. Read them carefully!"] },
  { id: 'butler', name: 'Alfred', role: 'Elite Concierge', district: 'elite', home: at('elite', 13, -5), facing: 2.5, look: look({ skin: SK[0], hair: '#cccccc', top: '#111', top2: '#fff', pants: '#111', coat: true, acc: 'none', height: 1.05, build: 0.95 }), lines: ["The Elite District welcomes only those who prove themselves.", "Rumour: the 50,000-point qualification gets you through the Elite gates.", "Master Lucian never loses. At least, he never admits it."] },
  { id: 'guide', name: 'Hana', role: 'Championship Guide', district: 'championship', home: at('championship', 14, 5), facing: 2.5, look: look({ skin: SK[1], hair: '#ffd24a', hairStyle: 'bob', top: '#fff2b0', top2: '#b8860b', skirt: true, pants: '#33224a' }), lines: ["Welcome to the Championship District. Only legends walk here.", "National and World Championships are registered at the Dome desk.", "The golden Dome is the greatest stage in the world."] },
  { id: 'kid', name: 'Pip', role: 'Young Fan', district: 'residential', home: at('residential', -6, 19), facing: 1.0, look: look({ skin: SK[3], hair: '#2fd6a4', hairStyle: 'spiky', top: '#ff3b3b', top2: '#fff', pants: '#2a3a8a', height: 0.8, build: 0.85 }), lines: ["I'm gonna be a blader when I grow up!", "Do you have a cool top? Show me in the workshop!", "Daichi is scary but he gave me a sticker once."] },
];
