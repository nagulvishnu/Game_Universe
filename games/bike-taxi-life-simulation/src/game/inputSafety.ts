// Release held controls when the browser stops delivering reliable key-up events.
export function watchInputFocus(release: () => void): () => void {
  const onVisibilityChange = () => { if (document.hidden) release(); };
  window.addEventListener('blur', release);
  document.addEventListener('visibilitychange', onVisibilityChange);
  return () => {
    window.removeEventListener('blur', release);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
