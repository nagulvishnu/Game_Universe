// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { SAMPLE_GAMES } from "@/test/fixtures";
import { GamesProvider } from "@/components/providers/GamesProvider";
import { UIContext } from "@/components/providers/UIProvider";
import { ExploreGames } from "@/components/explore/ExploreGames";
import { GameArt } from "@/components/games/GameArt";
import { GameLauncher } from "@/components/launcher/GameLauncher";
import { MainNavigation } from "@/components/nav/MainNavigation";
import { RandomPickButton } from "@/components/universe/RandomPickButton";
import { SelectionReveal } from "@/components/universe/SelectionReveal";

// jsdom has no IntersectionObserver — Reveal would stay hidden / hold observers.
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

const push = vi.fn();
const back = vi.fn();
let pathname = "/explore";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back }),
  usePathname: () => pathname,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const launch = vi.fn();
const openDetails = vi.fn();

function Providers({ children, games = SAMPLE_GAMES }: { children: ReactNode; games?: typeof SAMPLE_GAMES }) {
  return (
    <GamesProvider games={games}>
      <UIContext.Provider
        value={{
          detailsId: null,
          openDetails,
          closeDetails: vi.fn(),
          settingsOpen: false,
          setSettingsOpen: vi.fn(),
          launching: null,
          launch,
          cameFromHub: false,
        }}
      >
        {children}
      </UIContext.Provider>
    </GamesProvider>
  );
}

beforeEach(() => {
  pathname = "/explore";
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  // Always release stubbed fetch + timers so one launcher test can't keep the worker alive.
  vi.unstubAllGlobals();
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  vi.useRealTimers();
});

describe("Explore", () => {
  it("renders a card for every game", () => {
    render(<ExploreGames />, { wrapper: Providers });
    expect(screen.getAllByTestId("game-card")).toHaveLength(3);
    expect(screen.getByText("AI Beast World")).toBeTruthy();
  });

  it("search updates results instantly", () => {
    render(<ExploreGames />, { wrapper: Providers });
    fireEvent.change(screen.getByLabelText("Search games"), { target: { value: "racing" } });
    const cards = screen.getAllByTestId("game-card");
    expect(cards).toHaveLength(1);
    expect(cards[0].getAttribute("data-game-id")).toBe("neon-velocity");
  });

  it("shows a no-results state", () => {
    render(<ExploreGames />, { wrapper: Providers });
    fireEvent.change(screen.getByLabelText("Search games"), { target: { value: "zzzzzz" } });
    expect(screen.getByTestId("no-results")).toBeTruthy();
  });

  it("filters by dynamic category chips", () => {
    render(<ExploreGames />, { wrapper: Providers });
    const group = screen.getByRole("group", { name: "Filter by category" });
    fireEvent.click(within(group).getByRole("button", { name: /^STRATEGY/ }));
    const cards = screen.getAllByTestId("game-card");
    expect(cards).toHaveLength(1);
    expect(cards[0].getAttribute("data-game-id")).toBe("zombie-defense");
    fireEvent.click(within(group).getByRole("button", { name: /^ALL/ }));
    expect(screen.getAllByTestId("game-card")).toHaveLength(3);
  });

  it("applies the category from a category-page deep link", () => {
    render(<ExploreGames initialCategory="strategy" />, { wrapper: Providers });
    const cards = screen.getAllByTestId("game-card");
    expect(cards).toHaveLength(1);
    expect(cards[0].getAttribute("data-game-id")).toBe("zombie-defense");
  });

  it("sorts by the selected mode", () => {
    render(<ExploreGames />, { wrapper: Providers });
    const sort = screen.getByTestId("explore-sort");
    fireEvent.change(sort, { target: { value: "title" } });
    const cards = screen.getAllByTestId("game-card");
    expect(cards.map((c) => c.getAttribute("data-game-id"))).toEqual([
      "ai-beast-world",
      "neon-velocity",
      "zombie-defense",
    ]);
  });

  it("Play launches the right game; non-playable games are disabled", () => {
    render(<ExploreGames />, { wrapper: Providers });
    fireEvent.click(screen.getByRole("button", { name: "Play Neon Velocity" }));
    expect(launch).toHaveBeenCalledWith("neon-velocity", expect.anything());
    const dev = screen.getByRole("button", { name: /Zombie Defense is not playable/ }) as HTMLButtonElement;
    expect(dev.disabled).toBe(true);
  });

  it("clicking a card title opens its details", () => {
    render(<ExploreGames />, { wrapper: Providers });
    fireEvent.click(screen.getByRole("button", { name: "Neon Velocity — view details" }));
    expect(openDetails).toHaveBeenCalledWith("neon-velocity");
  });

  it("shows the empty-universe state when there are no games", () => {
    render(<ExploreGames />, { wrapper: ({ children }) => <Providers games={[]}>{children}</Providers> });
    expect(screen.getByTestId("empty-universe")).toBeTruthy();
    expect(screen.getByText("/games")).toBeTruthy();
  });
});

describe("GameArt", () => {
  it("renders generated fallback art when there is no thumbnail", () => {
    render(<GameArt game={SAMPLE_GAMES[1]} />);
    expect(screen.getByTestId("art-fallback").textContent).toMatch(/NV/);
  });

  it("falls back when the image fails to load", () => {
    const game = { ...SAMPLE_GAMES[1], thumbnailUrl: "/broken.png" };
    const { container } = render(<GameArt game={game} />);
    const img = container.querySelector("img")!;
    fireEvent.error(img);
    expect(screen.getByTestId("art-fallback")).toBeTruthy();
  });
});

describe("Navigation", () => {
  it("renders links to the main routes", () => {
    pathname = "/explore";
    render(<MainNavigation />, { wrapper: Providers });
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByText("Home").closest("a")?.getAttribute("href")).toBe("/");
    expect(within(nav).getByText("Explore Games").closest("a")?.getAttribute("href")).toBe("/explore");
    expect(within(nav).getByText("Categories").closest("a")?.getAttribute("href")).toBe("/categories");
    expect(within(nav).getByText("About").closest("a")?.getAttribute("href")).toBe("/about");
    expect(within(nav).getByText("Explore Games").closest("a")?.getAttribute("aria-current")).toBe("page");
  });

  it("exposes search, sound and fullscreen controls", () => {
    render(<MainNavigation />, { wrapper: Providers });
    expect(screen.getByTestId("nav-search")).toBeTruthy();
    expect(screen.getByTestId("nav-sound")).toBeTruthy();
    expect(screen.getByTestId("nav-fullscreen")).toBeTruthy();
  });

  it("opens the global search and finds a game from the registry", () => {
    render(<MainNavigation />, { wrapper: Providers });
    fireEvent.click(screen.getByTestId("nav-search"));
    const dialog = screen.getByTestId("global-search");
    fireEvent.change(within(dialog).getByLabelText("Search games"), { target: { value: "racing" } });
    const results = within(dialog).getAllByTestId("search-result");
    expect(results).toHaveLength(1);
    expect(results[0].textContent).toContain("Neon Velocity");
  });
});

describe("Random pick", () => {
  it("triggers the pick and locks while spinning", () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <RandomPickButton phase="idle" disabled={false} onClick={onClick} onReset={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("random-pick"));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <RandomPickButton phase="spinning" disabled={false} onClick={onClick} onReset={vi.fn()} />,
    );
    const button = screen.getByTestId("random-pick") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("offers a reset once a destiny has been chosen", () => {
    const onReset = vi.fn();
    render(
      <RandomPickButton phase="revealing" disabled={false} onClick={vi.fn()} onReset={onReset} />,
    );
    fireEvent.click(screen.getByTestId("random-pick"));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

describe("Selection reveal", () => {
  it("shows the chosen world with play and pick-again actions", () => {
    const onPlay = vi.fn();
    const onPickAgain = vi.fn();
    const onBackToUniverse = vi.fn();
    render(
      <SelectionReveal
        game={SAMPLE_GAMES[1]}
        onPlay={onPlay}
        onPickAgain={onPickAgain}
        onBackToUniverse={onBackToUniverse}
        onDetails={vi.fn()}
      />,
    );
    const reveal = screen.getByTestId("selection-reveal");
    expect(reveal.getAttribute("data-game-id")).toBe("neon-velocity");
    expect(within(reveal).getByText(/Your destiny has been chosen/i)).toBeTruthy();
    expect(within(reveal).getByText("Neon Velocity")).toBeTruthy();

    fireEvent.click(within(reveal).getByTestId("reveal-play"));
    expect(onPlay).toHaveBeenCalled();
    fireEvent.click(within(reveal).getByTestId("reveal-pick-again"));
    expect(onPickAgain).toHaveBeenCalled();
    fireEvent.click(within(reveal).getByTestId("reveal-back-to-universe"));
    expect(onBackToUniverse).toHaveBeenCalled();
  });
});

describe("GameLauncher", () => {
  it("opens a valid game in a sandboxed iframe once its files are verified", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    const { container, unmount } = render(<GameLauncher game={SAMPLE_GAMES[1]} requestedId="neon-velocity" />, { wrapper: Providers });
    try {
      await waitFor(() => expect(container.querySelector("iframe")).toBeTruthy());
      const frame = container.querySelector("iframe")!;
      expect(frame.getAttribute("src")).toBe("/play/neon-velocity/index.html");
      expect(frame.getAttribute("sandbox")).toContain("allow-scripts");
      expect(frame.getAttribute("sandbox")).not.toContain("allow-top-navigation");
      expect(screen.getByRole("button", { name: /Exit/ })).toBeTruthy();
      expect(screen.getByText(/Back to Universe/)).toBeTruthy();
    } finally {
      unmount();
    }
  });

  it("falls back to ranged GET when HEAD is rejected by the host", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 405 })
      .mockResolvedValueOnce({ ok: true, status: 206 });
    vi.stubGlobal("fetch", fetchMock);
    const { container, unmount } = render(<GameLauncher game={SAMPLE_GAMES[1]} requestedId="neon-velocity" />, { wrapper: Providers });
    try {
      await waitFor(() => expect(container.querySelector("iframe")).toBeTruthy());
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      unmount();
    }
  });

  it("exit returns to the hub", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    const { unmount } = render(<GameLauncher game={SAMPLE_GAMES[1]} requestedId="neon-velocity" />, { wrapper: Providers });
    try {
      fireEvent.click(screen.getByRole("button", { name: "Exit" }));
      expect(push).toHaveBeenCalledWith("/universe");
    } finally {
      unmount();
    }
  });

  it("shows GAME UNAVAILABLE for an unknown game", () => {
    render(<GameLauncher game={null} requestedId="nope" />, { wrapper: Providers });
    expect(screen.getByTestId("game-unavailable")).toBeTruthy();
    expect(screen.getByText("Game unavailable")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Return to Game Universe/ }).getAttribute("href")).toBe("/");
  });

  it("shows GAME UNAVAILABLE when the entry file is missing", async () => {
    // Both HEAD and ranged-GET fail -> game is really missing.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    render(<GameLauncher game={SAMPLE_GAMES[1]} requestedId="neon-velocity" />, { wrapper: Providers });
    await waitFor(() => expect(screen.getByTestId("game-unavailable")).toBeTruthy());
  });
});
