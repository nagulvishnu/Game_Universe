export function EmptyUniverse() {
  return (
    <div
      className="gu-panel gu-clip relative mx-auto my-10 max-w-3xl overflow-hidden px-8 py-16 text-center"
      data-testid="empty-universe"
    >
      <div className="gu-fallback-orb -left-10 -top-10 h-56 w-56 bg-violet" aria-hidden />
      <div className="gu-fallback-orb -bottom-16 -right-10 h-64 w-64 bg-neon" aria-hidden style={{ animationDelay: "-6s" }} />
      <div className="relative">
        <p className="gu-kicker">Signal not detected</p>
        <h2 className="gu-title gu-glow-text mt-4 text-3xl sm:text-4xl">Your universe is waiting</h2>
        <p className="mx-auto mt-5 max-w-md text-lg text-dim">No games have been added yet.</p>
        <p className="mt-6 text-dim">Drop a game folder into:</p>
        <p className="mt-3 inline-block border border-neon/60 bg-black/40 px-6 py-3 font-display text-lg tracking-widest text-neon">
          /games
        </p>
        <p className="mt-6 text-dim">
          add a <code className="text-ink">game.json</code>, restart the hub — and it will appear here.
        </p>
      </div>
    </div>
  );
}
