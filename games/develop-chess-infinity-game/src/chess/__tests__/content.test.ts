import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { PUZZLES, LESSONS, OPENINGS, OPERA_GAME } from "../data";
import { Position, mateMoves, mateDistance, rootScores, moveToUci } from "../engine/core";

describe("puzzles", () => {
  for (const p of PUZZLES) {
    it(`${p.id} is valid and solution verified`, () => {
      const chess = new Chess(p.fen); // throws on illegal FEN
      expect(chess.isGameOver()).toBe(false);
      if (p.mateIn) {
        expect(mateDistance(p.fen, 3)).toBe(p.mateIn);
        expect(mateMoves(p.fen, p.mateIn).length).toBeGreaterThan(0);
      } else {
        expect(p.accept && p.accept.length).toBeTruthy();
        const legal = chess.moves({ verbose: true }).map((m) => m.lan);
        for (const a of p.accept!) expect(legal).toContain(a);
        const roots = rootScores(Position.fromFen(p.fen), 5, 30000);
        const best = roots[0].score;
        const acceptedScores = p.accept!.map((a) => roots.find((r) => moveToUci(r.move) === a)!.score);
        const rest = roots.filter((r) => !p.accept!.includes(moveToUci(r.move)));
        if (p.theme !== "defense") {
          // every accepted move is within 60cp of the engine's best, and clearly better than all others
          for (const s of acceptedScores) expect(best - s).toBeLessThanOrEqual(60);
          expect(best - rest[0].score).toBeGreaterThan(100);
        } else {
          // defence: accepted moves all avoid disaster; every other move loses (mate or heavy material)
          for (const s of acceptedScores) expect(s).toBeGreaterThan(-200);
          for (const r of rest) expect(r.score).toBeLessThan(-200);
        }
      }
    }, 60000);
  }
});

describe("training lessons", () => {
  for (const l of LESSONS) {
    it(`${l.id} steps are legal`, () => {
      let chess: Chess | null = null;
      for (const s of l.steps) {
        if (s.fen) chess = new Chess(s.fen);
        if (!chess) throw new Error("no position");
        if (!s.accept) continue;
        const legal = chess.moves({ verbose: true });
        if (s.accept === "mate") {
          expect(legal.some((m) => m.san.endsWith("#"))).toBe(true);
          const mv = legal.find((m) => m.san.endsWith("#"))!; chess.move(mv.san);
        } else {
          for (const a of s.accept) expect(legal.map((m) => m.lan)).toContain(a);
          chess.move(s.accept[0]);
        }
        if (s.reply) {
          const r = chess.moves({ verbose: true }).find((m) => m.lan === s.reply);
          expect(r, `${l.id} reply ${s.reply}`).toBeTruthy();
          chess.move(s.reply);
        }
      }
    });
  }
});

describe("openings", () => {
  for (const o of OPENINGS) it(`${o.name} line is legal`, () => { const c = new Chess(); for (const m of o.moves) c.move(m); expect(c.history().length).toBe(o.moves.length); });
  it("Opera game is legal and ends in mate", () => { const c = new Chess(); OPERA_GAME.forEach((m) => c.move(m)); expect(c.isCheckmate()).toBe(true); });
});
