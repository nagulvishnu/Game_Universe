// Generates the formatted screenplay and per-scene production specification from the scene data.
import type { Beat, SceneDef } from '../engine/types';
import { CHAR_MAP } from '../story/characters';
import { ENVS } from '../world/envData';
import { planShot } from '../camera/director';
import { estimateScene, SCENES } from '../story/orchestrator';

const hh = (h: number) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const nm = (id: string) => (CHAR_MAP[id]?.name.split(' ')[0] ?? id).toUpperCase();

export function cameraPlan(s: SceneDef): string[] {
  const env = ENVS[s.env]; const present = s.cast.map((c) => c.id); let lines = 0; const out: string[] = [];
  s.beats.forEach((b, i) => {
    const shot = planShot({ beat: b, scene: s, beatIdx: i, present, lineCount: lines, pos: (id) => { const c = s.cast.find((x) => x.id === id); return c ? env.marks[c.at] : undefined; } });
    if (b.t === 'line' && !b.off) lines++;
    if (b.t === 'combat') out.push(`#${i} COMBAT COVERAGE: wide orbit → tracking/OTS/low/medium/high cycle; close-up + slow-motion on finishing blow`);
    else if (['line', 'move', 'enter', 'exit', 'act', 'title', 'wait', 'shot'].includes(b.t)) out.push(`#${i} ${shot.k.toUpperCase()}${shot.on?.length ? ' on ' + shot.on.join('/') : ''}${shot.move ? ' (' + shot.move + ')' : ''}`);
  });
  return out;
}

function beatText(b: Beat): string {
  switch (b.t) {
    case 'line': return b.off ? `   ${nm(b.who)} (V.O.${b.emo && b.emo !== 'neutral' ? ', ' + b.emo : ''})\n      ${b.text}` : `   ${nm(b.who)}${b.emo && b.emo !== 'neutral' ? ` (${b.emo})` : ''}${b.to ? ` → ${nm(b.to)}` : ''}\n      ${b.text}`;
    case 'move': return `   ACTION: ${Object.entries(b.to).map(([k, v]) => `${nm(k)} moves to ${v}`).join('; ')}${b.run ? ' (running)' : ''}.`;
    case 'enter': return `   ENTRANCE: ${nm(b.who)} enters from ${b.from} to ${b.to}.`;
    case 'exit': return `   EXIT: ${nm(b.who)} leaves via ${b.via}.`;
    case 'act': return `   ACTION: ${nm(b.who)} — ${b.anim.replace('_', ' ')}${b.at ? ' toward ' + b.at : ''}.`;
    case 'stance': return `   ACTION: ${nm(b.who)} assumes ${b.stance} stance${b.weapon !== undefined ? (b.weapon ? ', weapon drawn' : ', weapon sheathed') : ''}.`;
    case 'face': return `   ACTION: ${nm(b.who)} turns toward ${b.at}.`;
    case 'fx': return `   EVENT: ${b.k}${b.name ? ' ' + b.name : ''}${b.to !== undefined ? ' → ' + b.to : ''}${b.who ? ' (' + b.who + ')' : ''}.`;
    case 'combat': return `   BATTLE [${b.id}]: ${b.sides[0].map(nm).join(' & ')} vs ${b.sides[1].map(nm).join(', ')} — ~${b.dur}s. Outcome: ${b.winner === 'draw' ? 'draw / mutual knock-back' : b.sides[b.winner].map(nm).join(' & ') + ' prevail'}; losers ${b.end}.`;
    case 'title': return `   TITLE CARD: "${b.text}"${b.sub ? ' — ' + b.sub : ''} (${b.dur}s)`;
    case 'wait': return `   (beat — ${b.dur}s)`;
    case 'shot': return `   CAMERA: ${b.shot.k}`;
  }
}

export function renderScene(s: SceneDef, n: number): string {
  const cast = s.cast.map((c) => nm(c.id)).join(', ');
  const header = `${n + 1}. [${s.id}] ${ENVS[s.env].interior ? 'INT.' : 'EXT.'} ${ENVS[s.env].name.toUpperCase()} — ${hh(s.hour)} — ${s.weather.toUpperCase()}${s.eclipse ? ` — ECLIPSE ${Math.round(s.eclipse * 100)}%` : ''}`;
  return [header, `   "${s.title}"  (est. ${Math.round(estimateScene(s))}s)  CAST: ${cast}`, `   MUSIC: ${s.music}`, '', ...s.beats.map(beatText), ''].join('\n');
}

export function renderScreenplay(): string {
  let out = 'ECLIPSE: THE LAST AWAKENING\nScreenplay (generated from the scene database)\n\n';
  let act = 0;
  SCENES.forEach((s, i) => {
    if (s.act !== act) { act = s.act; out += `\n=== ACT ${['', 'ONE', 'TWO', 'THREE', 'FOUR'][act]} ===\n\n`; }
    out += renderScene(s, i) + '\n';
  });
  return out;
}

export function renderSpec(s: SceneDef): string {
  const env = ENVS[s.env];
  const lines = s.beats.filter((b) => b.t === 'line').length, battles = s.beats.filter((b) => b.t === 'combat').length;
  return [
    `SCENE ${s.id} — ${s.title} (Act ${s.act})`,
    `1. Narrative objective: ${s.objective}`,
    `2. Environment & assets: ${env.name} | ${s.assets.join(', ')}`,
    `3. Characters: ${s.cast.map((c) => c.id).join(', ') || '—'}`,
    `4. Starting states: ${s.cast.map((c) => `${c.id}@${c.at}${c.stance ? ' [' + c.stance + ']' : ''}${c.weapon ? ' [armed]' : ''}${c.emo ? ' (' + c.emo + ')' : ''}`).join('; ')}`,
    `5. Motivations: ${Object.entries(s.motivations).map(([k, v]) => `${k}: ${v}`).join(' | ') || '—'}`,
    `6. Actions & interactions: ${s.beats.length} beats; ${battles} battle(s)`,
    `7. Dialogue & voice: ${lines} lines (browser TTS, per-character pitch/rate)`,
    `8. Animation: procedural gestures chosen by utility AI; one-shots per beat; lip-sync from text visemes`,
    `9. Camera plan:\n     ${cameraPlan(s).join('\n     ')}`,
    `10. Music/SFX: ${s.music}; ${s.sfx.join(', ') || 'ambient only'}`,
    `11. Ending conditions: ${s.endCondition}`,
    `12. Continuity → next: ${s.continuity}`,
    `    Requires facts: ${s.requires.join(', ') || '—'} | Sets facts: ${(s.effects.facts ?? []).join(', ') || '—'}`,
  ].join('\n');
}
