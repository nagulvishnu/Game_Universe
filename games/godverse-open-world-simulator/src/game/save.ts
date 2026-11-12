import { FORMS, POWERS, STARTER_POWERS, WEATHERS } from './types';
import { RIVAL_GODS } from './godwars';

const SAVE_KEY = 'godverse-save-v1';

export interface GameSave {
  version: 1;
  savedAt: string;
  player: {
    position: [number, number, number];
    yaw: number;
    pitch: number;
    form: string;
    flying: boolean;
    speedLevel: number;
    hp: number;
    invulnerable: boolean;
  };
  powers: string[];
  selectedPower: string;
  ownedRegions: string[];
  selectedGod: string;
  warStatus: 'idle' | 'active' | 'victory' | 'defeat';
  warChoice: 'none' | 'imprisoned' | 'killed';
  warGodHp: number;
  warGodMaxHp: number;
  previousInvulnerable: boolean;
  hour: number;
  weather: string;
  seaLevel: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateSave(value: unknown): GameSave {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.player)) {
    throw new Error('The saved game is invalid or uses an unsupported version.');
  }

  const player = value.player;
  const ids = new Set(POWERS.map((power) => power.id));
  const forms = new Set(FORMS.map((form) => form.id));
  const regions = new Set(['Aether Sanctum', ...RIVAL_GODS.map((god) => god.region)]);
  const gods = new Set(RIVAL_GODS.map((god) => god.id));
  const statuses = ['idle', 'active', 'victory', 'defeat'];
  const choices = ['none', 'imprisoned', 'killed'];
  const position = player.position;
  const savedPowers = value.powers;

  if (
    !Array.isArray(position) || position.length !== 3 || !position.every(isFiniteNumber) ||
    !isFiniteNumber(player.yaw) || !isFiniteNumber(player.pitch) ||
    typeof player.form !== 'string' || !forms.has(player.form) ||
    typeof player.flying !== 'boolean' ||
    !Number.isInteger(player.speedLevel) || (player.speedLevel as number) < 0 || (player.speedLevel as number) > 3 ||
    !isFiniteNumber(player.hp) || player.hp < 0 || player.hp > 100 ||
    typeof player.invulnerable !== 'boolean' ||
    !Array.isArray(savedPowers) || !savedPowers.every((id) => typeof id === 'string' && ids.has(id)) ||
    !STARTER_POWERS.every((id) => savedPowers.includes(id)) ||
    typeof value.selectedPower !== 'string' || !ids.has(value.selectedPower) || !savedPowers.includes(value.selectedPower) ||
    !Array.isArray(value.ownedRegions) || !value.ownedRegions.every((region) => typeof region === 'string' && regions.has(region)) ||
    typeof value.selectedGod !== 'string' || !gods.has(value.selectedGod) ||
    typeof value.warStatus !== 'string' || !statuses.includes(value.warStatus) ||
    typeof value.warChoice !== 'string' || !choices.includes(value.warChoice) ||
    !isFiniteNumber(value.warGodHp) || !isFiniteNumber(value.warGodMaxHp) ||
    typeof value.previousInvulnerable !== 'boolean' ||
    !isFiniteNumber(value.hour) || value.hour < 0 || value.hour >= 24 ||
    typeof value.weather !== 'string' || !WEATHERS.some((weather) => weather.id === value.weather) ||
    !isFiniteNumber(value.seaLevel) ||
    typeof value.savedAt !== 'string' || Number.isNaN(Date.parse(value.savedAt))
  ) {
    throw new Error('The saved game is damaged and cannot be continued.');
  }

  return value as unknown as GameSave;
}

export function readGameSave(): GameSave | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(SAVE_KEY);
  } catch {
    throw new Error('Browser storage is unavailable. Check your browser privacy settings.');
  }
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('The saved game is damaged and cannot be continued.');
  }
  return validateSave(parsed);
}

export function writeGameSave(save: GameSave): void {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    throw new Error('Could not save the game. Check available browser storage.');
  }
}
