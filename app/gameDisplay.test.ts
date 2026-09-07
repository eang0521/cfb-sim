import { describe, expect, it } from "vitest";
import { formatRank, formatRecord, gameSideDisplay } from "./gameDisplay";

describe("gameSideDisplay", () => {
  it("uses the persisted entering-rank and after-record for a played game", () => {
    const result = gameSideDisplay(true, 7, 9, 2, { rank: 3, wins: 20, losses: 0, powerElo: 100 });
    expect(result).toEqual({ rank: 7, wins: 9, losses: 2 });
  });

  it("falls back to the live/current standings for an unplayed game", () => {
    const result = gameSideDisplay(false, null, null, null, { rank: 5, wins: 6, losses: 1, powerElo: 100 });
    expect(result).toEqual({ rank: 5, wins: 6, losses: 1 });
  });

  it("returns nulls for an unplayed game with no current standings (e.g. FCS)", () => {
    const result = gameSideDisplay(false, null, null, null, undefined);
    expect(result).toEqual({ rank: null, wins: null, losses: null });
  });
});

describe("formatRank", () => {
  it("shows the rank only within the top 25", () => {
    expect(formatRank(1)).toBe("#1");
    expect(formatRank(25)).toBe("#25");
    expect(formatRank(26)).toBe("");
    expect(formatRank(null)).toBe("");
  });
});

describe("formatRecord", () => {
  it("formats wins-losses when available", () => {
    expect(formatRecord({ rank: null, wins: 10, losses: 2 })).toBe("10-2");
  });

  it("returns empty when wins/losses are unavailable", () => {
    expect(formatRecord({ rank: null, wins: null, losses: null })).toBe("");
  });
});
