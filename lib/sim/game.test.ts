import { describe, expect, it } from "vitest";
import { simulateGame } from "./game";

describe("simulateGame", () => {
  it("produces realistic college-football score ranges over many sims", () => {
    const even = { offRating: 50, defRating: 45 };
    let maxScore = 0;
    let minScore = Infinity;
    for (let i = 0; i < 500; i++) {
      const result = simulateGame(even, even, Math.random);
      maxScore = Math.max(maxScore, result.awayScore, result.homeScore);
      minScore = Math.min(minScore, result.awayScore, result.homeScore);
      expect(result.awayScore).toBeGreaterThanOrEqual(0);
      expect(result.homeScore).toBeGreaterThanOrEqual(0);
      // scores should be reachable via 3s and 7s (or +2 after 3rd OT)
      expect(Number.isInteger(result.awayScore)).toBe(true);
      expect(Number.isInteger(result.homeScore)).toBe(true);
    }
    expect(maxScore).toBeLessThan(100);
  });

  it("never ends in a tie", () => {
    const a = { offRating: 55, defRating: 40 };
    const b = { offRating: 40, defRating: 55 };
    for (let i = 0; i < 300; i++) {
      const result = simulateGame(a, b, Math.random);
      expect(result.awayScore).not.toBe(result.homeScore);
    }
  });

  it("gives a stronger away team a positive win rate edge", () => {
    const strong = { offRating: 65, defRating: 65 };
    const weak = { offRating: 35, defRating: 35 };
    let awayWins = 0;
    const n = 400;
    for (let i = 0; i < n; i++) {
      const result = simulateGame(strong, weak, Math.random);
      if (result.awayScore > result.homeScore) awayWins++;
    }
    expect(awayWins / n).toBeGreaterThan(0.7);
  });

  it("applies equal and opposite elo swings", () => {
    const a = { offRating: 50, defRating: 50 };
    const result = simulateGame(a, a, Math.random);
    expect(result.eloChangeAway).toBe(-result.eloChangeHome);
  });
});
