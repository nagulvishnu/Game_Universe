import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverGames, syncGameAssets } from "../discovery/discover";

let dir: string;

function makeGame(folder: string, meta: Record<string, unknown> | string | null, files: string[] = ["index.html"]) {
  const d = path.join(dir, folder);
  fs.mkdirSync(d, { recursive: true });
  if (meta !== null) fs.writeFileSync(path.join(d, "game.json"), typeof meta === "string" ? meta : JSON.stringify(meta));
  for (const f of files) fs.writeFileSync(path.join(d, f), "x");
}

const base = (id: string) => ({ id, title: id.toUpperCase(), description: "d", genre: "Arcade", entry: "index.html", thumbnail: "thumbnail.webp" });

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "gu-games-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("discoverGames", () => {
  it("discovers a valid game and resolves URLs", () => {
    makeGame("alpha", base("alpha"), ["index.html", "thumbnail.webp"]);
    const r = discoverGames({ gamesDir: dir });
    expect(r.games).toHaveLength(1);
    expect(r.games[0].launchUrl).toBe("/play/alpha/index.html");
    expect(r.games[0].thumbnailUrl).toBe("/play/alpha/thumbnail.webp");
    expect(r.diagnostics[0].level).toBe("ok");
  });

  it("skips invalid games without affecting valid ones", () => {
    makeGame("good", base("good"), ["index.html", "thumbnail.webp"]);
    makeGame("no-json", null);
    makeGame("bad-json", "{ not json");
    makeGame("no-entry", { ...base("no-entry"), entry: "missing.html" }, []);
    makeGame("no-title", { id: "no-title", entry: "index.html" });
    const r = discoverGames({ gamesDir: dir });
    expect(r.games.map((g) => g.id)).toEqual(["good"]);
    const errors = r.diagnostics.filter((d) => d.level === "error").map((d) => d.folder).sort();
    expect(errors).toEqual(["bad-json", "no-entry", "no-json", "no-title"]);
  });

  it("keeps games with missing thumbnails and warns", () => {
    makeGame("nothumb", base("nothumb"));
    const r = discoverGames({ gamesDir: dir });
    expect(r.games).toHaveLength(1);
    expect(r.games[0].thumbnailUrl).toBeNull();
    expect(r.diagnostics[0].level).toBe("warning");
    expect(r.diagnostics[0].messages.join()).toMatch(/thumbnail/i);
  });

  it("auto-detects thumbnail and banner files", () => {
    makeGame("auto", { ...base("auto"), thumbnail: undefined }, ["index.html", "thumbnail.png", "banner.webp"]);
    const r = discoverGames({ gamesDir: dir });
    expect(r.games[0].thumbnailUrl).toBe("/play/auto/thumbnail.png");
    expect(r.games[0].bannerUrl).toBe("/play/auto/banner.webp");
  });

  it("discovers multiple games and ignores _ and . folders", () => {
    makeGame("a", base("a"), ["index.html", "thumbnail.webp"]);
    makeGame("b", base("b"), ["index.html", "thumbnail.webp"]);
    makeGame("c", base("c"), ["index.html", "thumbnail.webp"]);
    makeGame("_template", base("template"));
    makeGame(".hidden", base("hidden"));
    const r = discoverGames({ gamesDir: dir });
    expect(r.games.map((g) => g.id)).toEqual(["a", "b", "c"]);
  });

  it("rejects duplicate ids (first folder wins)", () => {
    makeGame("one", base("same"), ["index.html", "thumbnail.webp"]);
    makeGame("two", base("same"), ["index.html", "thumbnail.webp"]);
    const r = discoverGames({ gamesDir: dir });
    expect(r.games).toHaveLength(1);
    expect(r.games[0].folder).toBe("one");
    expect(r.diagnostics.find((d) => d.folder === "two")?.level).toBe("error");
  });

  it("flags ai-beast-world as flagship automatically", () => {
    makeGame("ai-beast-world", base("ai-beast-world"), ["index.html", "thumbnail.webp"]);
    expect(discoverGames({ gamesDir: dir }).games[0].flagship).toBe(true);
  });

  it("returns an empty report when /games does not exist", () => {
    const r = discoverGames({ gamesDir: path.join(dir, "nope") });
    expect(r.games).toEqual([]);
  });

  it("syncs game folders to the public directory", () => {
    makeGame("alpha", base("alpha"), ["index.html", "thumbnail.webp"]);
    const report = discoverGames({ gamesDir: dir });
    const out = path.join(dir, "_out");
    syncGameAssets(report, dir, out);
    expect(fs.existsSync(path.join(out, "alpha", "index.html"))).toBe(true);
  });
});
