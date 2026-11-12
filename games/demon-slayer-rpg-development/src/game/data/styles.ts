import type { SkillDef, SkillKind, Status, StyleDef, StyleId } from '../types';

type Row = [string, string, SkillKind, number, number, number, number, number, number, number, number, number, number, string, Status?];

// name, form, kind, dmg, range, arc, hits, dur, dash, breath, cd, level, sp, desc, status
const build = (style: StyleId, rows: Row[]): SkillDef[] =>
  rows.map((r, i) => ({
    id: `${style}${i}`, name: r[0], form: r[1], style, kind: r[2], dmg: r[3], range: r[4], arc: r[5], hits: r[6], dur: r[7],
    dash: r[8], breath: r[9], cd: r[10], level: r[11], sp: r[12], desc: r[13], fx: r[14],
    special: i === 6, ult: i === 7,
  }));

const mkStyle = (id: StyleId, name: string, jp: string, color: number, core: number, css: string, wave: number,
  particle: StyleDef['particle'], rows: Row[]): StyleDef => {
  const all = build(id, rows);
  return { id, name, jp, color, core, css, wave, particle, forms: all.slice(0, 6), special: all[6], ultimate: all[7] };
};

export const STYLES: Record<StyleId, StyleDef> = {
  water: mkStyle('water', 'Water Breathing', '水の呼吸', 0x3aa8ff, 0xe8fbff, '#3aa8ff', 0.22, 'water', [
    ['Water Surface Slash', 'First Form', 'dash', 1.7, 2.2, 0, 1, 0.5, 8, 10, 2.5, 1, 0, 'A flowing dash that cuts straight through foes.'],
    ['Water Wheel', 'Second Form', 'slam', 2.0, 3.2, 360, 1, 0.85, 4.5, 14, 4, 1, 1, 'A forward somersault that crashes down in a wheel of water.'],
    ['Flowing Dance', 'Third Form', 'multi', 1.05, 7, 0, 3, 0.85, 0, 16, 5, 3, 1, 'Three fluid, evasive strikes that seek the nearest enemies.'],
    ['Striking Tide', 'Fourth Form', 'spin', 0.85, 3.5, 360, 4, 0.9, 0, 18, 6, 5, 2, 'Spinning waves lash all around you.'],
    ['Blessed Rain After the Drought', 'Fifth Form', 'dash', 3.4, 3.0, 0, 1, 0.7, 9, 22, 8, 8, 2, 'A merciful, devastating thrust that stuns the target.', 'stun'],
    ['Whirlpool', 'Sixth Form', 'spin', 1.0, 4.6, 360, 5, 1.1, 0, 24, 9, 10, 3, 'A vortex drags enemies into its churning center.', 'pull'],
    ['Constant Flux', 'Tenth Form', 'multi', 1.0, 8, 0, 7, 1.6, 0, 30, 14, 12, 3, 'A spiralling dragon of waves; each strike grows stronger.'],
    ['Raging Torrent', 'Ultimate', 'ult', 1.5, 9, 360, 8, 3.0, 0, 0, 0, 1, 0, 'Summon a dragon of water that tears the battlefield apart.'],
  ]),
  thunder: mkStyle('thunder', 'Thunder Breathing', '雷の呼吸', 0xffe14a, 0xffffff, '#ffe14a', 0.05, 'spark', [
    ['Thunderclap and Flash', 'First Form', 'dash', 1.8, 2.2, 0, 1, 0.4, 12, 10, 2.5, 1, 0, 'Sheathed godspeed dash; leaves lightning in its wake.', 'shock'],
    ['Rice Spirit', 'Second Form', 'arc', 0.5, 3.6, 140, 5, 0.7, 0, 14, 4, 1, 1, 'A five-hit flurry of lightning cuts.'],
    ['Thunder Swarm', 'Third Form', 'spin', 0.8, 4, 360, 3, 0.8, 0, 16, 5, 3, 1, 'Crackling arcs burst around you.'],
    ['Heat Lightning', 'Fifth Form', 'dash', 2.4, 3, 0, 1, 0.5, 10, 18, 6, 5, 2, 'A twisting, fiery lightning charge.', 'shock'],
    ['Rumble and Flash', 'Sixth Form', 'multi', 0.9, 9, 0, 6, 1.0, 0, 24, 9, 8, 2, 'Sixfold: six blinding teleporting strikes.', 'shock'],
    ['Distant Thunder', 'Fourth Form', 'proj', 1.6, 14, 0, 3, 0.6, 0, 20, 7, 10, 3, 'Fire lightning slashes down range.', 'shock'],
    ['Godlike Speed', 'Seventh Form', 'multi', 1.1, 10, 0, 8, 1.2, 0, 32, 14, 12, 3, 'Eightfold godspeed: unstoppable lightning ricochet.', 'shock'],
    ['Flaming Thunder God', 'Ultimate', 'ult', 1.6, 10, 360, 7, 2.8, 0, 0, 0, 1, 0, 'A towering bolt of divine thunder crushes everything.', 'shock'],
  ]),
  beast: mkStyle('beast', 'Beast Breathing', '獣の呼吸', 0x5fb4ff, 0xe6f4ff, '#5fb4ff', 0.12, 'wind', [
    ['Fang-Tooth Shredding', 'First Fang', 'dash', 1.5, 2.4, 0, 2, 0.5, 6, 9, 2.2, 1, 0, 'Cross-cut with both blades while charging.'],
    ['Slice and Dice', 'Second Fang', 'spin', 0.7, 3.3, 360, 4, 0.7, 0, 13, 4, 1, 1, 'Whirling dual blades shred everything nearby.'],
    ['Devour', 'Third Fang', 'arc', 1.2, 3.4, 110, 3, 0.6, 0, 15, 4.5, 3, 1, 'A triple crossing bite.'],
    ['Crazy Cutting', 'Fifth Fang', 'multi', 0.8, 6, 0, 5, 0.8, 0, 17, 5.5, 5, 2, 'Erratic frenzy of slashes.'],
    ['Piercing Bore', 'Sixth Fang', 'dash', 2.8, 3, 0, 1, 0.6, 10, 20, 7, 8, 2, 'A charging, drilling double thrust.', 'stun'],
    ['Spatial Awareness', 'Seventh Fang', 'spin', 1.0, 5.5, 360, 5, 1.0, 0, 22, 9, 10, 3, 'Sense every movement; counter all around.'],
    ['Rushing Beast', 'Special', 'multi', 1.0, 8, 0, 7, 1.4, 0, 28, 12, 12, 3, 'An unpredictable multi-directional assault.'],
    ['Wild Beast Explosion', 'Ultimate', 'ult', 1.5, 9, 360, 8, 2.8, 0, 0, 0, 1, 0, 'A storm of fangs from every direction.'],
  ]),
  flame: mkStyle('flame', 'Flame Breathing', '炎の呼吸', 0xff6a1a, 0xffe08a, '#ff6a1a', 0.1, 'fire', [
    ['Unknowing Fire', 'First Form', 'dash', 2.0, 2.4, 0, 1, 0.5, 8, 11, 2.8, 1, 0, 'A blazing straight charge.', 'burn'],
    ['Rising Scorching Sun', 'Second Form', 'arc', 1.8, 3.6, 150, 1, 0.65, 0, 13, 3.5, 1, 1, 'An upward arc of flame.', 'burn'],
    ['Blazing Universe', 'Third Form', 'dash', 2.8, 3.0, 0, 1, 0.65, 7, 17, 6, 3, 1, 'A heavy, downward crushing flame.', 'burn'],
    ['Blooming Flame Undulation', 'Fourth Form', 'spin', 1.0, 3.8, 360, 3, 0.85, 0, 18, 6, 5, 2, 'Whirling flame petals.', 'burn'],
    ['Flame Tiger', 'Fifth Form', 'proj', 2.6, 14, 0, 1, 0.7, 0, 22, 8, 8, 2, 'A tiger of fire ravages the field.', 'burn'],
    ['Rengoku', 'Ninth Form', 'slam', 3.6, 4.4, 360, 1, 1.0, 5, 28, 11, 10, 3, 'Purgatory: a crushing flaming leap.', 'burn'],
    ['Blazing Universe Unleashed', 'Special', 'multi', 1.2, 8, 0, 5, 1.1, 0, 28, 12, 12, 3, 'Five flaming strikes.', 'burn'],
    ['Purgatory Dragon', 'Ultimate', 'ult', 1.7, 10, 360, 7, 2.8, 0, 0, 0, 1, 0, 'Unleash a roaring dragon of flame.', 'burn'],
  ]),
  insect: mkStyle('insect', 'Insect Breathing', '蟲の呼吸', 0xc77dff, 0xffffff, '#c77dff', 0.08, 'poison', [
    ['Butterfly Dance: Caprice', 'First Dance', 'multi', 0.7, 6, 0, 4, 0.7, 0, 9, 2.5, 1, 0, 'Quick, evasive stabs that spread poison.', 'poison'],
    ['Dragonfly: Compound Eye Hexagon', 'Second Dance', 'dash', 1.9, 2.8, 0, 1, 0.45, 9, 12, 4, 1, 1, 'Six rapid thrusts at one point.', 'poison'],
    ['Bee Sting: True Flutter', 'Third Dance', 'dash', 2.1, 3, 0, 1, 0.5, 10, 14, 4.5, 3, 1, 'Piercing lunge that leaves venom.', 'poison'],
    ['Centipede Dance', 'Fourth Dance', 'multi', 0.9, 7, 0, 5, 0.9, 0, 17, 6, 5, 2, 'Zigzagging pursuit of multiple foes.', 'poison'],
    ['Dance of the Moth', 'Fifth Dance', 'spin', 0.9, 4, 360, 4, 0.8, 0, 18, 6.5, 8, 2, 'Scatter poisonous scales.', 'poison'],
    ['Wisteria Overdose', 'Sixth Dance', 'proj', 1.4, 12, 0, 3, 0.6, 0, 20, 7, 10, 3, 'Poison needles pierce distant foes.', 'poison'],
    ['Hundredfold Sting', 'Special', 'multi', 1.0, 8, 0, 8, 1.2, 0, 26, 11, 12, 3, 'A blur of precise stings.', 'poison'],
    ['Venom Butterfly Storm', 'Ultimate', 'ult', 1.4, 9, 360, 8, 2.6, 0, 0, 0, 1, 0, 'A swarm of poison butterflies.', 'poison'],
  ]),
  sound: mkStyle('sound', 'Sound Breathing', '音の呼吸', 0xff3d6e, 0xfff0a0, '#ff3d6e', 0.06, 'note', [
    ['Roar', 'First Movement', 'slam', 2.0, 3.8, 360, 1, 0.8, 3, 12, 3.5, 1, 0, 'A leaping blast of explosive sound.'],
    ['Constant Resounding Slashes', 'Second Movement', 'multi', 0.9, 6, 0, 4, 0.7, 0, 14, 4, 1, 1, 'Rhythmic cleaver strikes.'],
    ['Flashy Flash', 'Third Movement', 'spin', 1.0, 4, 360, 3, 0.8, 0, 16, 5, 3, 1, 'A burst of resonant blasts.'],
    ['Musical Score', 'Fourth Movement', 'dash', 2.3, 3, 0, 1, 0.55, 8, 18, 6, 5, 2, 'Read the enemy rhythm, strike through.'],
    ['Drumbeat Wave', 'Fifth Movement', 'proj', 1.9, 13, 0, 2, 0.6, 0, 20, 7, 8, 2, 'Concussive shock waves.'],
    ['Resonant Arc', 'Sixth Movement', 'arc', 2.3, 4, 180, 2, 0.7, 0, 20, 7, 10, 3, 'Sweeping twin-cleaver arc.'],
    ['Splendid Finale', 'Special', 'multi', 1.1, 8, 0, 6, 1.2, 0, 26, 12, 12, 3, 'Six flashy detonations.'],
    ['Flashiest Crescendo', 'Ultimate', 'ult', 1.6, 10, 360, 7, 2.8, 0, 0, 0, 1, 0, 'A thunderous gunpowder-bright finale.'],
  ]),
  mist: mkStyle('mist', 'Mist Breathing', '霞の呼吸', 0x9fe8f0, 0xffffff, '#9fe8f0', 0.14, 'mist', [
    ['Low Clouds, Distant Haze', 'First Form', 'multi', 0.9, 6, 0, 3, 0.7, 0, 10, 2.8, 1, 0, 'Disappear into mist and strike thrice.'],
    ['Eight-Layered Mist', 'Second Form', 'arc', 1.5, 3.8, 180, 2, 0.7, 0, 13, 4, 1, 1, 'Mist slashes layered in 8 sweeps.'],
    ['Scattering Mist Splash', 'Third Form', 'dash', 2.0, 2.8, 0, 1, 0.5, 9, 14, 4.5, 3, 1, 'A mist-wreathed dash.'],
    ['Shifting Flow Slash', 'Fourth Form', 'spin', 0.9, 4, 360, 4, 0.85, 0, 17, 6, 5, 2, 'Fluid, shifting circular cuts.'],
    ['Moon-Dragon Ringtail', 'Fifth Form', 'dash', 2.9, 3.4, 0, 1, 0.6, 9, 20, 7.5, 8, 2, 'A dragon-like diagonal slash.', 'slow'],
    ['Obscuring Clouds', 'Sixth Form', 'spin', 1.1, 5, 360, 4, 1.0, 0, 22, 9, 10, 3, 'Conceal yourself, then rend all around.', 'slow'],
    ['Sea of Clouds', 'Special', 'multi', 1.0, 8, 0, 6, 1.2, 0, 26, 12, 12, 3, 'Strike unseen from every angle.'],
    ['Cloud Dragon Ascends', 'Ultimate', 'ult', 1.5, 9, 360, 8, 2.8, 0, 0, 0, 1, 0, 'A dragon of mist devours the field.', 'slow'],
  ]),
  love: mkStyle('love', 'Love Breathing', '恋の呼吸', 0xff7eb6, 0xffffff, '#ff7eb6', 0.35, 'petal', [
    ['Shivers of First Love', 'First Form', 'arc', 1.5, 4.2, 150, 2, 0.6, 0, 11, 2.8, 1, 0, 'A whip-like sweep with the flexible blade.'],
    ['Love Pangs', 'Second Form', 'spin', 0.9, 4.2, 360, 4, 0.85, 0, 14, 4.5, 1, 1, 'Spinning whip lashes.'],
    ['Catlove Shower', 'Third Form', 'multi', 0.9, 7, 0, 5, 0.9, 0, 17, 5.5, 3, 1, 'A dancing flurry of whip strikes.'],
    ['Swaying Love: Wild Clutching', 'Fourth Form', 'dash', 2.4, 4, 0, 1, 0.55, 8, 18, 6, 5, 2, 'A rushing tangling slash.'],
    ['Love Wind Heartstrings', 'Fifth Form', 'proj', 1.6, 12, 0, 3, 0.7, 0, 20, 7, 8, 2, 'Send out pink slashes.'],
    ['Heartbreak Whirl', 'Sixth Form', 'slam', 3.2, 4.4, 360, 1, 0.95, 4, 24, 9, 10, 3, 'A great leaping coil.'],
    ['Passion Bloom', 'Special', 'multi', 1.0, 8, 0, 6, 1.2, 0, 26, 12, 12, 3, 'Blossoming flurry.'],
    ['Eternal Love Tempest', 'Ultimate', 'ult', 1.5, 10, 360, 8, 2.8, 0, 0, 0, 1, 0, 'A storm of petals and blades.'],
  ]),
  wind: mkStyle('wind', 'Wind Breathing', '風の呼吸', 0x7ff2c0, 0xffffff, '#7ff2c0', 0.18, 'wind', [
    ['Dust Whirlwind Cutter', 'First Form', 'dash', 1.8, 2.6, 0, 1, 0.5, 8, 10, 2.5, 1, 0, 'A rotating charge of cutting wind.'],
    ['Claws-Purifying Wind', 'Second Form', 'proj', 1.3, 12, 0, 3, 0.55, 0, 13, 3.8, 1, 1, 'Three claw-shaped wind slashes.'],
    ['Clean Storm Wind Tree', 'Third Form', 'spin', 1.0, 4.2, 360, 4, 0.8, 0, 16, 5, 3, 1, 'A tornado of cutting wind.'],
    ['Rising Dust Storm', 'Fourth Form', 'arc', 2.0, 3.8, 160, 2, 0.65, 0, 15, 5, 5, 2, 'An upward-spiraling cut.'],
    ['Cold Mountain Wind', 'Fifth Form', 'slam', 3.0, 4.4, 360, 1, 0.9, 4.5, 21, 7, 8, 2, 'Leaping crush with a gale.'],
    ['Idaten Typhoon', 'Ninth Form', 'multi', 1.0, 7, 0, 6, 1.0, 0, 24, 8, 10, 3, 'A ricocheting typhoon of cuts.'],
    ['Aesthetic Wind', 'Special', 'multi', 1.1, 8, 0, 7, 1.2, 0, 28, 12, 12, 3, 'Seven wind-blade strikes.'],
    ['Black Wind Mountain Mist', 'Ultimate', 'ult', 1.6, 10, 360, 8, 2.8, 0, 0, 0, 1, 0, 'The strongest typhoon.'],
  ]),
  stone: mkStyle('stone', 'Stone Breathing', '岩の呼吸', 0xc9a56b, 0xfff0d0, '#c9a56b', 0.02, 'rock', [
    ['Serpentine Bipedal', 'First Form', 'proj', 2.0, 10, 0, 1, 0.8, 0, 14, 3.5, 1, 0, 'Whip the spiked ball-and-axe.'],
    ['Upper Smash', 'Second Form', 'slam', 2.6, 4, 360, 1, 0.9, 2, 16, 4.5, 1, 1, 'Smash the earth with the flail.'],
    ['Stone Skin', 'Third Form', 'spin', 1.2, 3.6, 360, 3, 0.9, 0, 17, 5.5, 3, 1, 'Whirl the chain around you.'],
    ['Volcanic Rock', 'Fourth Form', 'slam', 3.4, 4.6, 360, 1, 1.0, 4, 22, 7.5, 5, 2, 'A massive crushing blow.', 'stun'],
    ['Arcs of Justice', 'Fifth Form', 'arc', 3.0, 5, 220, 2, 0.9, 0, 22, 7, 8, 2, 'Sweeping arcs of the chain.'],
    ['Boulder Crush', 'Sixth Form', 'proj', 3.0, 12, 0, 2, 0.8, 0, 24, 8, 10, 3, 'Launch the mace like a meteor.', 'stun'],
    ['Mountain Quake', 'Special', 'slam', 4.2, 5.2, 360, 1, 1.1, 3, 30, 12, 12, 3, 'Shake the very ground.', 'stun'],
    ['Titan Judgement', 'Ultimate', 'ult', 1.8, 10, 360, 6, 2.8, 0, 0, 0, 1, 0, 'A rain of boulders and a final smash.', 'stun'],
  ]),
  serpent: mkStyle('serpent', 'Serpent Breathing', '蛇の呼吸', 0xa6ff6a, 0xffffff, '#a6ff6a', 0.4, 'snake', [
    ['Winding Serpent Slash', 'First Form', 'arc', 1.5, 3.8, 140, 2, 0.6, 0, 10, 2.6, 1, 0, 'A curving, slithering slash.'],
    ['Slithering Serpent', 'Second Form', 'dash', 1.9, 2.8, 0, 1, 0.5, 8, 12, 3.6, 1, 1, 'A coiling dash cut.'],
    ['Coil Choke', 'Third Form', 'spin', 1.0, 3.8, 360, 3, 0.85, 0, 15, 5, 3, 1, 'Coil around and constrict.', 'slow'],
    ['Narrow Head Venom Fangs', 'Fourth Form', 'dash', 2.6, 3.2, 0, 1, 0.55, 10, 18, 6, 5, 2, 'A precise thrust.', 'poison'],
    ['Twin-Headed Reptile', 'Fifth Form', 'multi', 1.0, 6, 0, 4, 0.8, 0, 19, 6.5, 8, 2, 'Two-pronged serpentine barrage.'],
    ['Constricting Vortex', 'Sixth Form', 'spin', 1.2, 5, 360, 4, 1.0, 0, 22, 8, 10, 3, 'Spiral of snakes.', 'pull'],
    ['Hissing Eclipse', 'Special', 'multi', 1.0, 8, 0, 6, 1.2, 0, 26, 12, 12, 3, 'Slither unseen and strike.'],
    ['Serpent King Descends', 'Ultimate', 'ult', 1.5, 9, 360, 8, 2.8, 0, 0, 0, 1, 0, 'A colossal spectral serpent.', 'poison'],
  ]),
  sun: mkStyle('sun', 'Hinokami Kagura', '日の呼吸', 0xff4a1c, 0xfff2a0, '#ff4a1c', 0.12, 'sun', [
    ['Dance', 'Hinokami Kagura', 'arc', 2.2, 4, 170, 2, 0.7, 0, 14, 3.2, 1, 1, 'The first dance of the sun - arcs of living flame.', 'burn'],
    ['Clear Blue Sky', 'Hinokami Kagura', 'dash', 2.6, 3.2, 0, 1, 0.5, 9, 16, 4, 1, 1, 'A clean, burning dash.', 'burn'],
    ['Raging Sun', 'Hinokami Kagura', 'spin', 1.2, 4.5, 360, 4, 0.9, 0, 20, 6, 1, 2, 'A ring of solar fire.', 'burn'],
    ['Burning Bones, Summer Sun', 'Hinokami Kagura', 'slam', 3.8, 4.6, 360, 1, 1.0, 5, 26, 9, 1, 3, 'A fiery leap crushing the foe.', 'burn'],
    ['Setting Sun Transformation', 'Hinokami Kagura', 'multi', 1.1, 7, 0, 5, 0.9, 0, 22, 7, 1, 3, 'Consecutive sun dances.', 'burn'],
    ['Solar Heat Haze', 'Hinokami Kagura', 'proj', 2.4, 12, 0, 2, 0.6, 0, 20, 6, 1, 2, 'Flame slashes shimmer outward.', 'burn'],
    ['Dance of the Fire God', 'Hinokami Kagura', 'multi', 1.3, 8, 0, 8, 1.4, 0, 30, 12, 1, 3, 'A flowing continuous 12-dance sequence.', 'burn'],
    ['Sun Halo Dragon Head Dance', 'Ultimate', 'ult', 2.0, 10, 360, 9, 3.2, 0, 0, 0, 1, 0, 'The blazing dragon of the sun.', 'burn'],
  ]),
};

export const ALL_SKILLS: Record<string, SkillDef> = {};
(Object.values(STYLES) as StyleDef[]).forEach((s) => {
  [...s.forms, s.special, s.ultimate].forEach((k) => { ALL_SKILLS[k.id] = k; });
});
// Hinokami Kagura skills are story-gated (chapter 5)
for (let i = 0; i < 7; i++) ALL_SKILLS[`sun${i}`].reqChapter = 5;
ALL_SKILLS['sun7'].reqChapter = 5;
