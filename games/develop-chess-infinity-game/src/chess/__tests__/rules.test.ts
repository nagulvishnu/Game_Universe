import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { Position, perft, search, canMate, mateMoves } from "../engine/core";
import { gameStatus, hasMatingMaterial, timeoutResult, repetitionCount, claimable, START_FEN, trackPieces, applyMoveToPieces, initialPieces } from "../rules";

const play = (c: Chess, sans: string) => sans.split(" ").forEach((s) => c.move(s));

describe("engine perft (own move generator)", () => {
  const cases: [string, string, number, number][] = [
    ["startpos", START_FEN, 4, 197281],
    ["kiwipete", "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", 3, 97862],
    ["position 3", "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", 4, 43238],
    ["position 4", "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", 3, 9467],
    ["position 5", "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", 3, 62379],
  ];
  for (const [name, fen, d, n] of cases) it(`${name} depth ${d} = ${n}`, () => expect(perft(Position.fromFen(fen), d)).toBe(n));
});

describe("chess.js rules used by the game", () => {
  it("chess.js perft matches known values (startpos d3, kiwipete d2)", () => {
    const count = (c: Chess, d: number): number => (d === 0 ? 1 : c.moves({ verbose: true }).reduce((n, m) => { c.move(m); const r = count(c, d - 1); c.undo(); return n + r; }, 0));
    expect(count(new Chess(), 3)).toBe(8902);
    expect(count(new Chess("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1"), 2)).toBe(2039);
  });
  it("scholar's mate is checkmate", () => {
    const c = new Chess(); play(c, "e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7#");
    expect(gameStatus(c, START_FEN)?.kind).toBe("checkmate");
    expect(gameStatus(c, START_FEN)?.winner).toBe("w");
  });
  it("stalemate", () => {
    const c = new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    expect(gameStatus(c, "x")?.kind).toBe("stalemate");
  });
  it("prevents moves leaving the king in check (pin)", () => {
    const c = new Chess("4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1");
    expect(() => c.move("Bd3")).toThrow();
    expect(c.moves({ square: "e2" })).toEqual([]);
  });
  it("castling both sides, and not through check", () => {
    const c = new Chess("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    expect(c.moves()).toContain("O-O"); expect(c.moves()).toContain("O-O-O");
    const d = new Chess("r3k2r/8/8/8/8/5r2/8/R3K2R w KQkq - 0 1");
    expect(d.moves()).not.toContain("O-O");
    c.move("O-O"); expect(c.get("f1")?.type).toBe("r"); expect(c.get("g1")?.type).toBe("k");
    c.move("O-O-O"); expect(c.get("d8")?.type).toBe("r"); expect(c.get("c8")?.type).toBe("k");
  });
  it("en passant works and is tracked for animation", () => {
    const c = new Chess(); play(c, "e4 a6 e5 d5");
    const m = c.move("exd6"); expect(m.flags).toContain("e"); expect(c.get("d5")).toBeFalsy();
    const pcs = trackPieces(START_FEN, c.history({ verbose: true }));
    expect(pcs.find((p) => p.square === "d5")).toBeUndefined();
    expect(pcs.find((p) => p.square === "d6")?.type).toBe("p");
    expect(pcs.length).toBe(31);
  });
  it("all four promotions", () => {
    for (const p of ["q", "r", "b", "n"]) {
      const c = new Chess("8/P6k/8/8/8/8/8/K7 w - - 0 1");
      c.move({ from: "a7", to: "a8", promotion: p });
      expect(c.get("a8")?.type).toBe(p);
      const pcs = applyMoveToPieces(initialPieces("8/P6k/8/8/8/8/8/K7 w - - 0 1"), { from: "a7", to: "a8", flags: "np", promotion: p as never });
      expect(pcs.find((x) => x.square === "a8")?.type).toBe(p);
    }
  });
  it("castling tracked for animation moves the rook", () => {
    const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"; const c = new Chess(fen); c.move("O-O");
    const pcs = trackPieces(fen, c.history({ verbose: true }));
    expect(pcs.find((p) => p.square === "f1")?.type).toBe("r"); expect(pcs.filter((p) => p.square === "h1").length).toBe(0);
  });
  it("undo restores position", () => {
    const c = new Chess(); play(c, "e4 e5 Nf3"); c.undo(); c.undo(); c.undo();
    expect(c.fen()).toBe(START_FEN);
  });
  it("threefold & fivefold repetition", () => {
    const c = new Chess(); const shuffle = "Nf3 Nf6 Ng1 Ng8";
    for (let i = 0; i < 2; i++) play(c, shuffle);
    expect(repetitionCount(c, START_FEN)).toBe(3); expect(claimable(c, START_FEN).threefold).toBe(true);
    expect(gameStatus(c, START_FEN)).toBeNull();
    for (let i = 0; i < 2; i++) play(c, shuffle);
    expect(gameStatus(c, START_FEN)?.kind).toBe("fivefold");
  });
  it("fifty-move claim and 75-move automatic draw", () => {
    const c50 = new Chess("4k3/8/8/8/8/8/8/R3K3 w - - 100 80");
    expect(claimable(c50, "x").fifty).toBe(true); expect(gameStatus(c50, "x")).toBeNull();
    const c75 = new Chess("4k3/8/8/8/8/8/8/R3K3 w - - 150 100");
    expect(gameStatus(c75, "x")?.kind).toBe("seventyfive");
  });
  it("insufficient material", () => {
    expect(gameStatus(new Chess("4k3/8/8/8/8/8/8/4KB2 w - - 0 1"), "x")?.kind).toBe("insufficient");
    expect(gameStatus(new Chess("4k3/8/8/8/8/8/8/4KN2 w - - 0 1"), "x")?.kind).toBe("insufficient");
    expect(gameStatus(new Chess("4k3/8/8/8/8/8/P7/4K3 w - - 0 1"), "x")).toBeNull();
  });
  it("timeout takes mating material into account", () => {
    expect(timeoutResult(new Chess("4k3/8/8/8/8/8/8/R3K3 w - - 0 1"), "b").winner).toBe("w");
    expect(timeoutResult(new Chess("4k3/8/8/8/8/8/8/4KB2 w - - 0 1"), "b").winner).toBeNull();
    expect(timeoutResult(new Chess("4k3/p7/8/8/8/8/8/4KB2 w - - 0 1"), "b").winner).toBe("w");
    expect(hasMatingMaterial(new Chess("4k3/8/8/8/8/8/8/4KN2 w - - 0 1"), "w")).toBe(false);
  });
  it("FEN and PGN round trip", () => {
    const c = new Chess(); play(c, "e4 e5 Nf3 Nc6 Bb5 a6");
    const d = new Chess(); d.loadPgn(c.pgn());
    expect(d.fen()).toBe(c.fen());
    expect(new Chess(c.fen()).fen()).toBe(c.fen());
  });
});

describe("engine search & mate solver", () => {
  it("finds mate in one and returns a legal move", () => {
    const fen = "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1";
    expect(mateMoves(fen, 1)).toEqual(["a1a8"]);
    const r = search(Position.fromFen(fen), 3, 1000);
    expect(new Chess(fen).moves({ verbose: true }).map((m) => m.lan)).toContain("a1a8");
    expect(r.move).not.toBeNull();
  });
  it("canMate on a known mate in 2", () => {
    const pos = Position.fromFen("7k/8/5K2/8/8/8/8/R7 w - - 0 1");
    expect(canMate(pos, 2)).toBe(true);
  });
});
