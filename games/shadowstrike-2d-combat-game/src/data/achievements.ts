/** SHADOWSTRIKE — achievements. Each has a real predicate evaluated against profile stats. */

export interface AchievementStats {
  wins: number;
  losses: number;
  matches: number;
  totalDamage: number;
  highestCombo: number;
  hardWins: number;
  bossWins: number;
  weaponsUnlocked: number;
  skillsUnlocked: number;
  skillUpgrades: number;
  equipmentUnlocked: number;
  level: number;
  perfectWins: number;
  skillsUsed: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  reward: { xp: number; shards: number };
  check: (s: AchievementStats) => boolean;
  progress: (s: AchievementStats) => { value: number; target: number };
}

const a = (
  id: string, name: string, description: string, xp: number, shards: number,
  target: number, get: (s: AchievementStats) => number,
): AchievementDef => ({
  id, name, description, reward: { xp, shards },
  check: (s) => get(s) >= target,
  progress: (s) => ({ value: Math.min(get(s), target), target }),
});

export const ACHIEVEMENTS: AchievementDef[] = [
  a('first_blood', 'First Blood', 'Win your first match.', 120, 250, 1, (s) => s.wins),
  a('veteran', 'Veteran', 'Win 10 matches.', 400, 900, 10, (s) => s.wins),
  a('champion', 'Champion', 'Win 50 matches.', 1500, 3500, 50, (s) => s.wins),
  a('combo_10', 'Chain Artist', 'Land a 10-hit combo.', 250, 500, 10, (s) => s.highestCombo),
  a('combo_20', 'Combo Machine', 'Land a 20-hit combo.', 700, 1400, 20, (s) => s.highestCombo),
  a('damage_5k', 'Heavy Hitter', 'Deal 5,000 total damage.', 300, 700, 5000, (s) => s.totalDamage),
  a('damage_25k', 'Devastator', 'Deal 25,000 total damage.', 1200, 2600, 25000, (s) => s.totalDamage),
  a('hard_win', 'No Mercy', 'Win a match on Hard difficulty.', 500, 1200, 1, (s) => s.hardWins),
  a('hard_5', 'Shadow Master', 'Win 5 matches on Hard difficulty.', 1400, 3000, 5, (s) => s.hardWins),
  a('boss_slayer', 'Sovereign Slayer', 'Defeat OBLIVION.', 2000, 5000, 1, (s) => s.bossWins),
  a('armory_10', 'Armory', 'Unlock 10 weapons.', 600, 1200, 10, (s) => s.weaponsUnlocked),
  a('armory_20', 'Master Armorer', 'Unlock 20 weapons.', 1600, 4000, 20, (s) => s.weaponsUnlocked),
  a('scholar_20', 'Arcane Scholar', 'Unlock 20 skills.', 500, 1100, 20, (s) => s.skillsUnlocked),
  a('scholar_60', 'Grand Archivist', 'Unlock 60 skills.', 1800, 4200, 60, (s) => s.skillsUnlocked),
  a('upgrades_10', 'Refiner', 'Purchase 10 skill upgrades.', 450, 1000, 10, (s) => s.skillUpgrades),
  a('upgrades_40', 'Perfectionist', 'Purchase 40 skill upgrades.', 1600, 3800, 40, (s) => s.skillUpgrades),
  a('style_10', 'Dressed to Kill', 'Unlock 10 equipment items.', 400, 900, 10, (s) => s.equipmentUnlocked),
  a('level_10', 'Rising Shadow', 'Reach level 10.', 800, 1800, 10, (s) => s.level),
  a('level_25', 'Elite Shadow', 'Reach level 25.', 2500, 6000, 25, (s) => s.level),
  a('flawless', 'Flawless', 'Win a match without taking damage.', 1000, 2400, 1, (s) => s.perfectWins),
  a('skill_user', 'Spellblade', 'Use 100 skills in combat.', 500, 1000, 100, (s) => s.skillsUsed),
  a('persistent', 'Persistent', 'Play 25 matches.', 350, 750, 25, (s) => s.matches),
];

export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((x) => [x.id, x]),
);
