import { look } from './rivals';
import type { Look } from '../game/types';

export const PLAYER_LOOKS: { name: string; look: Look }[] = [
  { name: 'Blaze', look: look({ skin: '#f6c9a8', hair: '#2b3a8f', hairStyle: 'spiky', eyes: '#35d0ff', top: '#ff4d6d', top2: '#ffffff', pants: '#26304f', shoes: '#ffffff', acc: 'headband', accColor: '#ffd24a', height: 1, build: 1 }) },
  { name: 'Aqua', look: look({ skin: '#ffe0cc', hair: '#ff7ab8', hairStyle: 'ponytail', eyes: '#7a4bff', top: '#35d0ff', top2: '#ffffff', pants: '#1c2a52', skirt: true, shoes: '#ffffff', acc: 'goggles', accColor: '#ffd24a', height: 0.97, build: 0.92 }) },
  { name: 'Verdant', look: look({ skin: '#e0a97c', hair: '#101018', hairStyle: 'swept', eyes: '#2fd6a4', top: '#2fd6a4', top2: '#1a1a24', pants: '#2a2f3a', shoes: '#ffd24a', acc: 'scarf', accColor: '#ffffff', coat: true, height: 1.03, build: 1.05 }) },
  { name: 'Solar', look: look({ skin: '#b97d55', hair: '#ffd24a', hairStyle: 'bob', eyes: '#c0182e', top: '#ffd24a', top2: '#c0182e', pants: '#2a2338', shoes: '#ffffff', acc: 'cap', accColor: '#c0182e', height: 0.98, build: 0.95 }) },
];
