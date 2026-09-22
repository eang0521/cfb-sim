import { describe, expect, it } from "vitest";
import { awayEloDelta, neutralEloDelta, simulateGame } from "./game";

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

  it("applies equal and opposite elo swings at a neutral site too", () => {
    const a = { offRating: 50, defRating: 50 };
    const result = simulateGame(a, a, Math.random, true);
    expect(result.eloChangeAway).toBe(-result.eloChangeHome);
  });
});

describe("awayEloDelta", () => {
  it("gives a road win 2 more points than the equivalent home win", () => {
    const awayWinDelta = awayEloDelta(20, 15, 50, 50); // away (road) wins by 5, no power-rating gap
    const homeWinOwnDelta = -awayEloDelta(15, 20, 50, 50); // home's own change for winning at home by 5
    expect(awayWinDelta).toBe(17); // 1 + 15 + trunc(0/10) + trunc(5/5)
    expect(homeWinOwnDelta).toBe(15); // 2 fewer than the equivalent road win
  });

  it("rewards beating a stronger opponent more than beating a weaker one, for the same margin", () => {
    const upsetOfStrongerTeam = awayEloDelta(20, 10, 50, 70); // winner (away, 50) beats a STRONGER loser (70) by 10
    const blowoutOfWeakerTeam = awayEloDelta(20, 10, 70, 50); // winner (away, 70) beats a WEAKER loser (50) by 10
    expect(upsetOfStrongerTeam).toBeGreaterThan(blowoutOfWeakerTeam);
  });
});

describe("neutralEloDelta", () => {
  it("gives the SAME baseline swing for an away win and a home win of identical margin/power-rating gap", () => {
    // awayEloDelta (real home/away) has a +/-2 road/home asymmetry that
    // neutralEloDelta must not have -- both scenarios below (winner favored
    // by 10, winning by 5) must swing by the same 16, whichever side wins.
    const awayWinDelta = neutralEloDelta(20, 15, 60, 50); // away (favored by 10) wins by 5
    const homeWinDelta = neutralEloDelta(15, 20, 50, 60); // home (favored by 10) wins by 5 (mirrored)
    expect(awayWinDelta).toBe(16 - 1 + 1); // 1 + 15 + trunc(-10/10) + trunc(5/5)
    expect(homeWinDelta).toBe(-(16 - 1 + 1)); // home winning is the away side's LOSS, so negative
  });

  it("rewards beating a stronger opponent more than beating a weaker one, for the same margin", () => {
    const upsetOfStrongerTeam = neutralEloDelta(20, 10, 50, 70); // winner (50) beats a STRONGER loser (70) by 10
    const blowoutOfWeakerTeam = neutralEloDelta(20, 10, 70, 50); // winner (70) beats a WEAKER loser (50) by 10
    expect(upsetOfStrongerTeam).toBeGreaterThan(blowoutOfWeakerTeam);
  });

  it("stays zero-sum", () => {
    const delta = neutralEloDelta(24, 17, 55, 48);
    expect(delta).toBe(-neutralEloDelta(17, 24, 48, 55));
  });

  it("differs from the real away/home formula's road/home asymmetry", () => {
    // Same inputs (home, favored by 20, wins by 10): awayEloDelta gives the
    // home side only +14 (the deliberate -2 home discount), neutralEloDelta
    // must not apply that discount and gives it +16 instead.
    const away = awayEloDelta(20, 30, 50, 70);
    const neutral = neutralEloDelta(20, 30, 50, 70);
    expect(neutral).not.toBe(away);
    expect(-away).toBe(14);
    expect(-neutral).toBe(16);
  });
});
