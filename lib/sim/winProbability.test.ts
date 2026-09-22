import { describe, expect, it } from "vitest";
import { estimateWinProbability } from "./winProbability";

describe("estimateWinProbability", () => {
  it("gives a much stronger home team a lopsided edge", () => {
    const strong = { offRating: 65, defRating: 65 };
    const weak = { offRating: 35, defRating: 35 };
    const { awayWinPct, homeWinPct } = estimateWinProbability(weak, strong, false, "game-1");
    expect(homeWinPct).toBeGreaterThan(0.8);
    expect(awayWinPct + homeWinPct).toBeCloseTo(1, 5);
  });

  it("gives even teams close to a coin flip, tilted slightly toward the home baseline edge", () => {
    const even = { offRating: 50, defRating: 50 };
    const { awayWinPct, homeWinPct } = estimateWinProbability(even, even, false, "game-2");
    expect(homeWinPct).toBeGreaterThan(awayWinPct);
    expect(homeWinPct).toBeLessThan(0.65);
  });

  it("is deterministic for the same seedKey and ratings", () => {
    const a = { offRating: 55, defRating: 48 };
    const b = { offRating: 45, defRating: 52 };
    const first = estimateWinProbability(a, b, false, "same-seed");
    const second = estimateWinProbability(a, b, false, "same-seed");
    expect(first).toEqual(second);
  });

  it("differs across seedKeys (not just always the same trial sequence)", () => {
    const a = { offRating: 55, defRating: 48 };
    const b = { offRating: 45, defRating: 52 };
    const first = estimateWinProbability(a, b, false, "seed-a");
    const second = estimateWinProbability(a, b, false, "seed-b");
    expect(first).not.toEqual(second);
  });

  it("has no home/away baseline gap at a neutral site", () => {
    const even = { offRating: 50, defRating: 50 };
    const { awayWinPct, homeWinPct } = estimateWinProbability(even, even, true, "game-neutral", 2000);
    expect(Math.abs(awayWinPct - homeWinPct)).toBeLessThan(0.1);
  });
});
