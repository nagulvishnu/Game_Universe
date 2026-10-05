import { describe, expect, it } from "vitest";
import { validateGameMetadata } from "../discovery/validate";

const valid = {
  id: "ai-beast-world",
  title: "AI Beast World",
  description: "A cinematic 3D adventure.",
  genre: "Adventure",
  category: "3D",
  version: "1.0.0",
  thumbnail: "thumbnail.webp",
  entry: "index.html",
  featured: true,
  tags: ["3D", "Adventure"],
  controls: ["WASD"],
  status: "playable",
};

describe("validateGameMetadata", () => {
  it("accepts valid metadata", () => {
    const r = validateGameMetadata(valid);
    expect(r.ok).toBe(true);
    expect(r.metadata?.id).toBe("ai-beast-world");
    expect(r.metadata?.featured).toBe(true);
    expect(r.metadata?.tags).toEqual(["3D", "Adventure"]);
  });

  it("rejects a missing id", () => {
    const { id: _id, ...rest } = valid;
    void _id;
    const r = validateGameMetadata(rest);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/id/);
  });

  it("rejects a missing title", () => {
    const r = validateGameMetadata({ ...valid, title: "  " });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/title/);
  });

  it("rejects a missing entry", () => {
    const r = validateGameMetadata({ ...valid, entry: undefined });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/entry/);
  });

  it("rejects entries that escape the game folder", () => {
    expect(validateGameMetadata({ ...valid, entry: "../secret.html" }).ok).toBe(false);
    expect(validateGameMetadata({ ...valid, entry: "/etc/passwd" }).ok).toBe(false);
  });

  it("rejects ids with unsafe characters", () => {
    expect(validateGameMetadata({ ...valid, id: "../hack" }).ok).toBe(false);
  });

  it("rejects non-object input", () => {
    expect(validateGameMetadata(null).ok).toBe(false);
    expect(validateGameMetadata("nope").ok).toBe(false);
    expect(validateGameMetadata([]).ok).toBe(false);
  });

  it("degrades gracefully on malformed optional values", () => {
    const r = validateGameMetadata({ ...valid, status: "weird", tags: "oops", featured: "yes" });
    expect(r.ok).toBe(true);
    expect(r.metadata?.status).toBe("playable");
    expect(r.metadata?.tags).toEqual([]);
    expect(r.metadata?.featured).toBe(false);
    expect(r.warnings.length).toBeGreaterThanOrEqual(3);
  });

  it("accepts remote https entries", () => {
    const r = validateGameMetadata({ ...valid, entry: "https://example.com/game/" });
    expect(r.ok).toBe(true);
  });
});
