/**
 * Hub-level localStorage helpers.
 *
 * The hub ONLY touches keys with the `gu-` prefix. Games own their own namespaces
 * (e.g. `abw-*`). There is intentionally no clear-all helper and `localStorage.clear()` is never called.
 */
export const HUB_PREFIX = "gu-";

export const HUB_KEYS = {
  settings: "gu-settings",
  lastGame: "gu-last-game",
  introSeen: "gu-intro-seen",
} as const;

function assertHubKey(key: string) {
  if (!key.startsWith(HUB_PREFIX)) throw new Error(`Hub storage keys must start with "${HUB_PREFIX}": ${key}`);
}

export function readHub<T>(key: string, fallback: T): T {
  assertHubKey(key);
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeHub(key: string, value: unknown): void {
  assertHubKey(key);
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode / quota) — preferences just won't persist */
  }
}

export function removeHub(key: string): void {
  assertHubKey(key);
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
