import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { MainMenu } from '../ui/MainMenu';
import { FightSelection } from '../ui/Selection';
import { CharacterLook } from '../ui/CharacterLook';
import { WeaponsScreen } from '../ui/Catalogues';
import { CombatHud } from '../ui/Combat';
import { useGame } from '../stores/gameStore';
import type { HudSnapshot } from '../game/events';

/** Case-insensitive text match that ignores React's text-node comment markers. */
const has = (html: string, needle: string) =>
  expect(html.replace(/<!--.*?-->/g, '').toUpperCase()).toContain(needle.toUpperCase());

const SNAPSHOT: HudSnapshot = {
  p1: {
    name: 'ShadowFox', health: 88, maxHealth: 100, guard: 40, maxGuard: 100,
    combo: 3, charge: 0.42, weapon: 'Shadow Katana', statuses: [],
    rounds: 1,
    skills: [
      { id: 'fire_homing', name: 'Homing Fireball', level: 1, cooldown: 0, cooldownMax: 6000, color: '#ff6a1a' },
      { id: 'laser_beam', name: 'Shadow Laser', level: 1, cooldown: 0, cooldownMax: 8000, color: '#22d3ee' },
      { id: 'shadow_clone', name: 'Shadow Clones', level: 1, cooldown: 0, cooldownMax: 12000, color: '#a855f7' },
    ],
  },
  p2: {
    name: 'Kage', health: 61, maxHealth: 100, guard: 20, maxGuard: 100,
    combo: 0, charge: 0, weapon: 'Shadow Katana', statuses: [],
    rounds: 0,
    skills: [
      { id: 'fire_homing', name: 'Homing Fireball', level: 1, cooldown: 0, cooldownMax: 6000, color: '#ff6a1a' },
      { id: 'mob_dash', name: 'Shadow Dash', level: 1, cooldown: 0, cooldownMax: 4000, color: '#66e0ff' },
      { id: 'def_guard', name: 'Guard', level: 1, cooldown: 0, cooldownMax: 9000, color: '#8899aa' },
    ],
  },
  timer: 92, round: 1, maxRounds: 3, phase: 'fight', announcement: null,
  frameData: null, fps: 60,
};

describe('ui smoke', () => {
  it('renders the main menu without crashing', () => {
    const html = renderToString(createElement(MainMenu));
    has(html, 'SHADOWSTRIKE');
    has(html, 'QUICK FIGHT');
    has(html, 'NEON SHADOW COMBAT');
    has(html, 'A SHADOW STRIKES. A LEGEND RISES.');
  });

  it('renders the fight selection without crashing', () => {
    const html = renderToString(createElement(FightSelection));
    has(html, 'OPPONENTS');
    has(html, 'START MATCH');
    has(html, 'FIGHTING STYLE');
    has(html, 'DIFFICULTY');
    has(html, 'YOUR FIGHTER');
  });

  it('renders the character look panel', () => {
    const html = renderToString(createElement(CharacterLook));
    has(html, 'CHARACTER LOOK');
    has(html, 'LIGHT MODE');
    has(html, 'DARK MODE');
    has(html, 'Same power. Different shadows.');
  });

  it('renders the armory with weapon skins', () => {
    const html = renderToString(createElement(WeaponsScreen));
    has(html, 'WEAPON SKINS');
    has(html, 'SHADOW KATANA');
    has(html, 'KNOCKBACK');
  });

  it('stores the character look choice', () => {
    useGame.getState().setLook({ variant: 'light', accent: 0xa855f7 });
    expect(useGame.getState().profile.look.variant).toBe('light');
    expect(useGame.getState().profile.look.accent).toBe(0xa855f7);
  });

  it('renders the combat HUD', () => {
    const html = renderToString(createElement(CombatHud, {
      hud: SNAPSHOT,
      weaponName: 'Shadow Katana',
      weaponRarity: 'uncommon',
      xpPct: 25,
      xpInto: 588,
      xpNeed: 2506,
      skillKeys: ['E', 'R', 'V'],
      onPause: () => {},
      onSkill: () => {},
    }));
    has(html, 'SHADOWFOX');
    has(html, 'ROUND 1/3');
    has(html, '3 HIT COMBO');
    has(html, 'ESC');
    has(html, 'PAUSE');
  });
});
