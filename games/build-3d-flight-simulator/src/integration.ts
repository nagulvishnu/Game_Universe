// Optional integration layer for embedding Skybound inside a host site (iframe).
// Outgoing messages:  { source: 'skybound', type: 'ready' | 'start' | 'end', ... }
// Incoming messages:  { target: 'skybound', type: 'pause' | 'resume' | 'mute' | 'unmute' }
import { GAME_META } from './game/meta';

export interface HostCommands { pause(): void; resume(): void; mute(m: boolean): void }

export function post(type: string, payload: Record<string, unknown> = {}) {
  try {
    if (window.parent && window.parent !== window) window.parent.postMessage({ source: GAME_META.messageSource, type, ...payload }, '*');
  } catch { /* cross-origin parent – ignore */ }
}

export function listenHost(cmds: HostCommands) {
  const fn = (e: MessageEvent) => {
    const d = e.data as { target?: string; type?: string } | null;
    if (!d || d.target !== GAME_META.messageSource) return;
    if (d.type === 'pause') cmds.pause();
    else if (d.type === 'resume') cmds.resume();
    else if (d.type === 'mute') cmds.mute(true);
    else if (d.type === 'unmute') cmds.mute(false);
  };
  window.addEventListener('message', fn);
  post('ready', { meta: GAME_META });
  return () => window.removeEventListener('message', fn);
}
