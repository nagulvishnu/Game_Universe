// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchInputFocus } from '../inputSafety';
import { useGame } from '../store';
import { generateOffer } from '../logic/rides';

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('playability safeguards', () => {
  it('releases input on focus loss and when the page becomes hidden, and removes listeners', () => {
    const release = vi.fn();
    const stop = watchInputFocus(release);
    window.dispatchEvent(new Event('blur'));
    expect(release).toHaveBeenCalledTimes(1);
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(release).toHaveBeenCalledTimes(2);
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(release).toHaveBeenCalledTimes(2);
    stop();
    window.dispatchEvent(new Event('blur'));
    expect(release).toHaveBeenCalledTimes(2);
    hidden.mockRestore();
  });

  it('preserves the remaining request time across panels, including switching panels', () => {
    vi.useFakeTimers();
    vi.setSystemTime(100000);
    useGame.getState().newGame();
    useGame.getState().act((g) => { g.offer = generateOffer(g, g.player.x, g.player.z); });
    expect(useGame.getState().g!.offer).not.toBeNull();
    useGame.getState().setUI({ offerExpiresAt: 120000 });
    vi.setSystemTime(105000);
    useGame.getState().openPanel('pause');
    vi.setSystemTime(110000);
    useGame.getState().openPanel('map');
    vi.setSystemTime(135000);
    useGame.getState().closePanel();
    expect(useGame.getState().ui.offerExpiresAt - Date.now()).toBe(15000);
  });

  it('clears the previous request timer when continuing a save', () => {
    vi.useFakeTimers();
    vi.setSystemTime(200000);
    useGame.getState().newGame();
    useGame.getState().act((g) => { g.offer = generateOffer(g, g.player.x, g.player.z); });
    useGame.getState().setUI({ offerExpiresAt: 220000 });
    useGame.getState().save();
    vi.setSystemTime(210000);
    expect(useGame.getState().continueGame()).toBe(true);
    expect(useGame.getState().g!.offer).toBeNull();
    expect(useGame.getState().ui.offerExpiresAt).toBe(0);
  });
});
