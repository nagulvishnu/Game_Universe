export interface ScoreEntry { id: number; name: string; score: number; level: number; kills: number; time: number; date: string; boss: boolean }
const KEY = "aibw_scores_v1", NAME = "aibw_name_v1", SET = "aibw_settings_v1";
export function loadScores(): ScoreEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
export function addScore(e: Omit<ScoreEntry, "id" | "date">) {
  const list = loadScores();
  const entry: ScoreEntry = { ...e, id: Date.now() + Math.floor(Math.random() * 1000), date: new Date().toLocaleDateString() };
  list.push(entry); list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, 10);
  try { localStorage.setItem(KEY, JSON.stringify(top)); } catch { /* ignore */ }
  return { entry, rank: top.findIndex((x) => x.id === entry.id) };
}
export function renameScore(id: number, name: string) {
  const list = loadScores(); const e = list.find((x) => x.id === id);
  if (e) { e.name = name; try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ } }
  try { localStorage.setItem(NAME, name); } catch { /* ignore */ }
}
export const getName = () => { try { return localStorage.getItem(NAME) || "WAYFARER"; } catch { return "WAYFARER"; } };
export function loadSettings(): { vol: number; sens: number; muted: boolean } {
  try { return { vol: 0.7, sens: 1, muted: false, ...JSON.parse(localStorage.getItem(SET) || "{}") }; } catch { return { vol: 0.7, sens: 1, muted: false }; }
}
export function saveSettings(s: { vol: number; sens: number; muted: boolean }) { try { localStorage.setItem(SET, JSON.stringify(s)); } catch { /* ignore */ } }
