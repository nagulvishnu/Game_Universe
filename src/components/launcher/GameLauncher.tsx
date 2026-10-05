"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GameRecord } from "@/games/types";
import { statusLabel } from "@/games/theme";
import { useUI } from "@/components/providers/UIProvider";
import { themeStyle } from "@/ui/themeStyle";
import { useFullscreen } from "@/utils/hooks";
import { GameErrorBoundary } from "./GameErrorBoundary";
import { GameUnavailable } from "./GameUnavailable";

type Phase = "loading" | "ready" | "error";

const MIN_LOADER_MS = 1100;
const SLOW_MS = 20000;

function loaderText(progress: number): string {
  if (progress >= 100) return "READY";
  if (progress < 30) return "VERIFYING GAME FILES…";
  return "INITIALIZING WORLD…";
}

function LauncherInner({
  game,
  onRetry,
}: {
  game: GameRecord;
  onRetry: () => void;
}) {
  const router = useRouter();
  const { cameFromHub } = useUI();
  const [phase, setPhase] = useState<Phase>("loading");
  const [progress, setProgress] = useState(4);
  const [src, setSrc] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string>("");
  const { supported: fsSupported, active: isFs } = useFullscreen();
  const wrapRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const startedAt = useRef(0);

  // 1) Preflight: verify the entry exists (real request), then mount the iframe.
  useEffect(() => {
    let cancelled = false;
    startedAt.current = performance.now();

    (async () => {
      if (!game.external) {
        // Some static hosts/CDNs reject HEAD (405/403) even when GET works.
        // Try HEAD first (cheap), then fall back to a 1-byte ranged GET.
        try {
          let ok = false;
          let status = 0;
          try {
            const head = await fetch(game.launchUrl, { method: "HEAD", cache: "no-store" });
            ok = head.ok;
            status = head.status;
          } catch {
            ok = false;
          }
          if (!ok && (status === 0 || status === 403 || status === 404 || status === 405)) {
            try {
              const get = await fetch(game.launchUrl, {
                method: "GET",
                cache: "no-store",
                headers: { Range: "bytes=0-0" },
              });
              // 206 (partial), 200 (no range support), or 416 (empty file but exists) all mean "reachable".
              ok = get.ok || get.status === 416;
              status = get.status;
            } catch {
              ok = false;
            }
          }
          if (!ok) throw new Error(`Entry file responded with ${status || "network error"}`);
        } catch (err) {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : "Could not reach the game files.");
          setPhase("error");
          return;
        }
      }
      if (cancelled) return;
      setProgress(30);
      setSrc(game.launchUrl);
    })();

    return () => {
      cancelled = true;
    };
  }, [game]);

  // 2) Deterministic progress easing while the iframe loads (completes on the real `load` event).
  useEffect(() => {
    if (phase !== "loading" || !src) return;
    const id = setInterval(() => setProgress((p) => Math.min(p + (92 - p) * 0.07 + 0.3, 92)), 120);
    const slowTimer = setTimeout(() => setSlow(true), SLOW_MS);
    return () => {
      clearInterval(id);
      clearTimeout(slowTimer);
    };
  }, [phase, src]);

  const onFrameLoad = useCallback(() => {
    setProgress(100);
    setSlow(false);
    const elapsed = performance.now() - startedAt.current;
    setTimeout(() => {
      setPhase("ready");
      frameRef.current?.focus();
    }, Math.max(0, MIN_LOADER_MS - elapsed) + 250);
  }, []);

  const exit = () => {
    if (cameFromHub) router.back();
    else router.push("/universe");
  };

  const toggleFullscreen = () => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else
      void wrap
        .requestFullscreen()
        .then(() => frameRef.current?.focus())
        .catch(() => {});
  };

  if (phase === "error") {
    return (
      <GameUnavailable
        title={game.title}
        message={error ? `This game could not be loaded. (${error})` : undefined}
        onRetry={onRetry}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[20] flex flex-col bg-black" style={themeStyle(game)} data-testid="game-launcher">
      <header className="gu-panel z-30 flex h-[52px] shrink-0 items-center justify-between gap-3 border-x-0 border-t-0 px-3 sm:px-5">
        <button type="button" className="gu-navlink flex items-center gap-2 font-display text-[0.62rem] tracking-[0.2em] uppercase text-[#aab4e6] hover:text-white" onClick={exit}>
          <span aria-hidden>←</span>
          <span className="hidden sm:inline">Back to Game Universe</span>
          <span className="sm:hidden">Back</span>
        </button>
        <div className="min-w-0 text-center">
          <p className="truncate font-display text-[0.7rem] font-bold tracking-[0.22em] uppercase">{game.title}</p>
          <p className="hidden text-[0.7rem] tracking-[0.2em] text-dim sm:block">{statusLabel(game.status)}{game.version ? ` · V${game.version}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="gu-btn gu-btn--sm"
            onClick={() => frameRef.current?.focus()}
            disabled={phase !== "ready"}
            title="Give keyboard focus to the game"
          >
            Play
          </button>
          <button type="button" className="gu-btn gu-btn--sm" onClick={toggleFullscreen} disabled={!fsSupported}>
            <span className="hidden sm:inline">{isFs ? "Exit fullscreen" : "Fullscreen"}</span>
            <span className="sm:hidden">FS</span>
          </button>
          <button type="button" className="gu-btn gu-btn--sm" onClick={exit}>
            Exit
          </button>
        </div>
      </header>

      <div ref={wrapRef} className="relative min-h-0 flex-1 bg-black">
        {src && (
          <iframe
            key={src}
            ref={frameRef}
            src={src}
            title={`${game.title} — game`}
            className="absolute inset-0 h-full w-full border-0 bg-black"
            // Same-origin games need storage access; everything else is withheld (no top-navigation, no parent access beyond origin).
            sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms allow-modals allow-popups allow-downloads"
            allow="fullscreen; autoplay; gamepad; clipboard-write; accelerometer; gyroscope; xr-spatial-tracking"
            referrerPolicy="no-referrer"
            onLoad={onFrameLoad}
            onError={() => {
              setError("The game frame failed to load.");
              setPhase("error");
            }}
          />
        )}

        {phase === "loading" && (
          <div
            className="absolute inset-0 z-20 grid place-items-center bg-[#04040b] px-6"
            role="status"
            aria-live="polite"
            data-testid="game-loading"
          >
            <div className="gu-fallback-orb left-[15%] top-[20%] h-72 w-72" style={{ background: "var(--c1)" }} aria-hidden />
            <div className="relative w-full max-w-xl text-center">
              <p className="gu-kicker">Entering</p>
              <h1 className="gu-title gu-glow-text mt-3 text-3xl sm:text-5xl">{game.title}</h1>
              <div
                className="gu-bar mt-10"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
                aria-label="Loading progress"
              >
                <i style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-4 flex items-center justify-center gap-3 font-display text-[0.7rem] tracking-[0.28em] text-dim">
                <span className="gu-pulse">{loaderText(progress)}</span>
                <span>{Math.round(progress)}%</span>
              </p>
              {slow && (
                <div className="mt-8">
                  <p className="text-amber">This is taking longer than expected.</p>
                  <div className="mt-4 flex justify-center gap-3">
                    <button type="button" className="gu-btn gu-btn--sm" onClick={onRetry}>
                      Retry
                    </button>
                    <button type="button" className="gu-btn gu-btn--sm" onClick={exit}>
                      Exit
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Owns the retry counter so a retry remounts `LauncherInner` with pristine launch state. */
function GameLauncherSession({ game }: { game: GameRecord }) {
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return (
    <GameErrorBoundary title={game.title} key={attempt}>
      <LauncherInner game={game} onRetry={retry} />
    </GameErrorBoundary>
  );
}

export function GameLauncher({ game, requestedId }: { game: GameRecord | null; requestedId: string }) {
  if (!game) {
    return <GameUnavailable title={requestedId} message="No game with this id exists in the registry." />;
  }
  return <GameLauncherSession game={game} />;
}
