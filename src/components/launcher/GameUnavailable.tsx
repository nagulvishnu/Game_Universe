"use client";

import Link from "next/link";

export function GameUnavailable({
  title,
  message = "This game could not be loaded.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="grid min-h-[100svh] place-items-center px-6 py-24" role="alert" data-testid="game-unavailable">
      <div className="gu-panel gu-clip relative max-w-xl overflow-hidden px-8 py-12 text-center">
        <div className="gu-fallback-orb -right-10 -top-10 h-52 w-52 bg-danger" aria-hidden style={{ opacity: 0.3 }} />
        <div className="relative">
          <p className="gu-kicker" style={{ color: "#ff4d6d" }}>
            Signal lost
          </p>
          <h1 className="gu-title mt-3 text-3xl sm:text-4xl">Game unavailable</h1>
          {title && <p className="mt-3 font-display text-sm tracking-[0.2em] uppercase text-neon">{title}</p>}
          <p className="mt-5 text-lg text-dim">{message}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {onRetry && (
              <button type="button" className="gu-btn" onClick={onRetry}>
                Retry
              </button>
            )}
            <Link href="/" className="gu-btn gu-btn--primary">
              Return to Game Universe
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
