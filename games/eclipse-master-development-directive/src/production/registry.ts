// Asset production registry. Status is never inflated: procedural stand-ins are "generated", not "production-ready".
import { CHARACTERS } from '../story/characters';
import { ABILITIES } from '../ai/combat';
import { ENVS } from '../world/envData';
import { SCENES } from '../story/orchestrator';

export type AssetStatus = 'planned' | 'generated' | 'imported' | 'validated' | 'production-ready';
export type AssetCategory = 'character' | 'animation' | 'environment' | 'prop' | 'weapon' | 'creature' | 'vfx' | 'sfx' | 'voice' | 'music';
export interface Asset { id: string; category: AssetCategory; name: string; status: AssetStatus; notes: string; usedIn: string[] }

const ANIMS = ['idle', 'walk', 'run', 'sit', 'kneel', 'down', 'wounded', 'combat_stance', 'slash_h', 'slash_v', 'thrust', 'cast', 'blast', 'raise', 'block', 'dodge', 'hit', 'bow', 'flinch', 'draw', 'reach', 'gesture_open', 'gesture_point', 'gesture_chest', 'gesture_fist', 'gesture_shrug', 'gesture_nod', 'gesture_shake'];
const SFX = ['slash', 'clash', 'hit', 'whoosh', 'magic', 'burst', 'blast', 'thunder', 'rumble', 'crystal', 'gong', 'heartbeat', 'door', 'impact_low', 'eclipse'];
const PLANNED_PROPS: Record<string, string> = {
  'prop:astrolabe': 'Referenced in story/continuity but no 3D model yet.',
  'prop:bread': 'Referenced in dialogue; no 3D model yet.',
  'fx:hologram': 'Veil Key projection in a3_truth is rendered only as an aura + flash.',
};

export function buildRegistry(): Asset[] {
  const used = new Map<string, Set<string>>();
  SCENES.forEach((s) => s.assets.forEach((a) => { if (!used.has(a)) used.set(a, new Set()); used.get(a)!.add(s.id); }));
  const u = (id: string) => [...(used.get(id) ?? [])];
  const out: Asset[] = [];
  CHARACTERS.forEach((c) => {
    out.push({ id: `char:${c.id}`, category: 'character', name: c.name, status: 'generated', usedIn: u(`char:${c.id}`), notes: 'Procedural stylised rig (toon materials, face rig, hair, outfit). No sculpted/imported mesh; not production quality.' });
    if (c.tier === 'principal') out.push({ id: `voice:${c.id}`, category: 'voice', name: `${c.name} voice`, status: 'planned', usedIn: u(`voice:${c.id}`), notes: 'Browser speech synthesis stand-in. No performed or neural voice recordings exist yet.' });
    if (c.weapon !== 'none') out.push({ id: `weapon:${c.id}`, category: 'weapon', name: `${c.name} — ${c.weapon}`, status: 'generated', usedIn: [], notes: 'Primitive-built weapon prop.' });
  });
  ANIMS.forEach((a) => out.push({ id: `anim:${a}`, category: 'animation', name: a, status: 'generated', usedIn: [], notes: 'Procedural joint-target animation; no mocap, no IK, no finger/cloth simulation.' }));
  Object.values(ENVS).forEach((e) => out.push({ id: `env:${e.id}`, category: 'environment', name: e.name, status: 'generated', usedIn: u(`env:${e.id}`), notes: `Procedural 3D space with nav obstacles (${e.obstacles.length}), ${e.destructibles.length} destructibles. Navigation validated headless; art is simplified.` }));
  Object.values(ABILITIES).forEach((a) => out.push({ id: `ability:${a.id}`, category: 'vfx', name: a.name, status: 'generated', usedIn: u(`ability:${a.id}`), notes: 'Pooled ring/arc/beam/burst + sparks, colour-coded.' }));
  SFX.forEach((s) => out.push({ id: `sfx:${s}`, category: 'sfx', name: s, status: 'generated', usedIn: [], notes: 'Procedural WebAudio synthesis; no recorded foley.' }));
  const seen = new Set(out.map((o) => o.id));
  used.forEach((scenes, id) => {
    if (seen.has(id) || id.startsWith('char:') || id.startsWith('env:') || id.startsWith('voice:') || id.startsWith('ability:')) return;
    const [kind, name] = id.split(':');
    const cat: AssetCategory = kind === 'music' ? 'music' : kind === 'fx' ? 'vfx' : 'prop';
    const planned = PLANNED_PROPS[id];
    out.push({ id, category: cat, name, status: planned ? 'planned' : 'generated', usedIn: [...scenes], notes: planned ?? (kind === 'music' ? 'Generative score cue sharing the Eclipse leitmotif; no composed/orchestral recording.' : 'Procedural geometry or shader effect.') });
  });
  out.push({ id: 'creature:none', category: 'creature', name: 'Creatures', status: 'planned', usedIn: [], notes: 'No creatures in the current screenplay; any spec-required creatures are not yet designed.' });
  return out;
}

export function registrySummary(r: Asset[]) {
  const by: Record<AssetStatus, number> = { planned: 0, generated: 0, imported: 0, validated: 0, 'production-ready': 0 };
  r.forEach((a) => by[a.status]++);
  return by;
}
