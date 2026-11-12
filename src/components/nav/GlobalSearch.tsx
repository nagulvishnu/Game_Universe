"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { GameRecord } from "@/games/types";
import { searchGames } from "@/games/registry/registry";
import { getGameTheme } from "@/games/theme";

export interface GlobalSearchProps {
  games: GameRecord[];
  onClose: () => void;
  onNavigate: (href: string) => void;
}

/**
 * Command-palette style search across every registered game.
 * Uses the registry's own search so results always match the real data.
 */
export function GlobalSearch({ games, onClose, onNavigate }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return games.slice(0, 8);
    return searchGames(games, query).slice(0, 8);
  }, [games, query]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (results.length ? (c + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (results.length ? (c - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const g = results[cursor];
      if (g) onNavigate(`/game/${encodeURIComponent(g.id)}`);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="gu-search"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="gu-search__backdrop" onClick={onClose} aria-hidden />
        <motion.div
          className="gu-search__panel gu-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Search games"
          data-testid="global-search"
          initial={{ y: -14, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -10, opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="gu-search__field">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                // The highlighted result resets with the result set.
                setCursor(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search worlds, genres, tags…"
              aria-label="Search games"
              autoComplete="off"
              className="gu-search__input"
            />
            <button type="button" className="gu-chip" onClick={onClose}>
              Esc
            </button>
          </div>

          <ul className="gu-search__results" role="listbox" aria-label="Search results">
            {results.length === 0 && (
              <li className="gu-search__empty">No worlds match “{query}”.</li>
            )}
            {results.map((g, i) => (
              <li key={g.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === cursor}
                  className="gu-search__result"
                  data-active={i === cursor ? "true" : "false"}
                  data-testid="search-result"
                  onPointerEnter={() => setCursor(i)}
                  onClick={() => onNavigate(`/game/${encodeURIComponent(g.id)}`)}
                >
                  <span
                    className="gu-search__dot"
                    style={{ background: getGameTheme(g).primary }}
                    aria-hidden
                  />
                  <span className="gu-search__result-title">{g.title}</span>
                  <span className="gu-search__result-meta">
                    {g.category} · {g.genre}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <p className="gu-search__hint">
            <kbd className="gu-key">↑</kbd>
            <kbd className="gu-key">↓</kbd> navigate · <kbd className="gu-key">↵</kbd> open ·{" "}
            <kbd className="gu-key">esc</kbd> close
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
