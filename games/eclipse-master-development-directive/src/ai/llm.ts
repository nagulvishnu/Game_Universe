// Optional LLM layer. DISABLED unless the user configures an OpenAI-compatible endpoint
// (localStorage 'eclipse.llm'). Used only for sparse ad-lib barks during combat — never per frame,
// never on the critical path. Every failure falls back to local personality-based barks.
import type { CharDef } from '../story/characters';

export interface LlmConfig { endpoint: string; model: string; key?: string }
export const llmStats = { enabled: false, requests: 0, ok: 0, failed: 0, fallbacks: 0 };

export function getLlmConfig(): LlmConfig | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('eclipse.llm') : null;
    const c = raw ? (JSON.parse(raw) as LlmConfig) : null;
    llmStats.enabled = !!c?.endpoint;
    return c?.endpoint ? c : null;
  } catch { return null; }
}

export async function askLLM(system: string, user: string, timeoutMs = 3000): Promise<string | null> {
  const cfg = getLlmConfig();
  if (!cfg) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  llmStats.requests++;
  try {
    const res = await fetch(cfg.endpoint, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(cfg.key ? { Authorization: `Bearer ${cfg.key}` } : {}) },
      body: JSON.stringify({ model: cfg.model, max_tokens: 40, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    const text = j?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('empty');
    llmStats.ok++;
    return text.replace(/^["']|["']$/g, '').slice(0, 90);
  } catch { llmStats.failed++; return null; } finally { clearTimeout(timer); }
}

type BarkKind = 'hit' | 'parry' | 'dodge' | 'ult' | 'hurt';
const BARKS: Record<string, Partial<Record<BarkKind, string[]>>> = {
  kael: { hit: ['Take that!', 'Stay down!'], parry: ['Not today.', 'Too slow!'], dodge: ['Close one!'], ult: ['Eclipse — rise!', 'Burn bright!'], hurt: ['Ngh—!', 'I can still stand.'] },
  seren: { hit: ['Sloppy.', 'Again.'], parry: ['Predictable.', 'Is that all?'], dodge: ['Too slow.'], ult: ['Crimson edge!'], hurt: ['Hah — good.'] },
  orrin: { hit: ['Forgive me.', 'Step back, old friend.'], parry: ['You were taught better.'], dodge: ['Age has its tricks.'], ult: ['Stars, answer me!'], hurt: ['Not... yet.'] },
  malachar: { hit: ['Kneel.', 'Fragile.'], parry: ['Pathetic.', 'Is that your light?'], dodge: ['Foolish.'], ult: ['Bow to the dark!'], hurt: ['Impossible...'] },
};
const DEFAULT: Partial<Record<BarkKind, string[]>> = { hit: ['For the Order!'], parry: ['Hold the line!'], dodge: ['Hah!'], ult: ['Now!'], hurt: ['Argh!'] };

export function localBark(def: CharDef, kind: BarkKind, rng: () => number): string | null {
  const pool = (BARKS[def.id] ?? DEFAULT)[kind] ?? DEFAULT[kind];
  if (!pool?.length) return null;
  return pool[Math.floor(rng() * pool.length)];
}

export async function bark(def: CharDef, kind: BarkKind, situation: string, rng: () => number): Promise<string | null> {
  if (def.tier === 'principal' && getLlmConfig()) {
    const out = await askLLM(
      `You write a single short battle exclamation (max 8 words) for ${def.name} in an anime film. Personality: bravery ${def.personality.bravery}, warmth ${def.personality.warmth}, aggression ${def.personality.aggression}. Reply with only the line.`,
      situation,
    );
    if (out) return out;
    llmStats.fallbacks++;
  }
  return localBark(def, kind, rng);
}
