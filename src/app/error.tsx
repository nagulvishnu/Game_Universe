"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[GameUniverse]", error);
  }, [error]);

  return (
    <div className="grid min-h-[100svh] place-items-center px-6" role="alert">
      <div className="text-center">
        <p className="gu-kicker" style={{ color: "#ff4d6d" }}>
          System fault
        </p>
        <h1 className="gu-title mt-3 text-4xl sm:text-5xl">Something went wrong</h1>
        <p className="mt-4 text-lg text-dim">The universe hit a snag. Your games and saves are untouched.</p>
        <div className="mt-8 flex justify-center gap-3">
          <button type="button" className="gu-btn" onClick={reset}>
            Try again
          </button>
          <Link href="/" className="gu-btn gu-btn--primary">
            Return to Game Universe
          </Link>
        </div>
      </div>
    </div>
  );
}
