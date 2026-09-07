import { describe, expect, it } from "vitest";
import { CONFERENCE_RANK_BONUS_MEGA144, conferenceRankBonus, rankConferencesByWins, updatePrestige } from "./prestige";

function seeded(sequence: number[]): () => number {
  let i = 0;
  return () => sequence[i++ % sequence.length];
}

describe("updatePrestige", () => {
  it("matches the official formula exactly: round(old*2/3) + wins - losses + confBonus + swing", () => {
    // rand() picking index 0 of [-3,-2,-1,1,2,3] -> swing = -3
    const rand = seeded([0]);
    const result = updatePrestige(
      { currentPrestige: 30, totalWins: 9, totalLosses: 3, conferenceRank: 1 },
      rand
    );
    // round(30*2/3)=20, +9-3=6 -> 26, +confBonus(1)=2 -> 28, +swing(-3) -> 25
    expect(result).toBe(20 + 9 - 3 + 2 - 3);
  });

  it("decays negative prestige toward zero too (round(old*2/3))", () => {
    const rand = seeded([0.2]); // floor(0.2*6)=1 -> index 1 -> swing = -2
    const result = updatePrestige(
      { currentPrestige: -9, totalWins: 2, totalLosses: 10, conferenceRank: 6 },
      rand
    );
    // round(-9*2/3) = round(-6) = -6, +2-10=-8 -> -14, +confBonus(6)=-2 -> -16, +swing(-2) -> -18
    expect(result).toBe(-6 + 2 - 10 - 2 - 2);
  });
});

describe("conferenceRankBonus", () => {
  it("matches [+2,+1,0,0,-1,-2] for ranks 1-6", () => {
    expect([1, 2, 3, 4, 5, 6].map((rank) => conferenceRankBonus(rank))).toEqual([2, 1, 0, 0, -1, -2]);
  });

  it("matches the MEGA144 [+3,+2,+2,+1,+1,0,0,-1,-1,-2,-2,-3] table for ranks 1-12", () => {
    const ranks = Array.from({ length: 12 }, (_, i) => i + 1);
    expect(ranks.map((rank) => conferenceRankBonus(rank, CONFERENCE_RANK_BONUS_MEGA144))).toEqual([
      3, 2, 2, 1, 1, 0, 0, -1, -1, -2, -2, -3,
    ]);
  });
});

describe("rankConferencesByWins", () => {
  it("ranks by total wins descending", () => {
    const ranks = rankConferencesByWins({
      SEC: { totalWins: 79, totalOldPrestige: 100 },
      PAC: { totalWins: 89, totalOldPrestige: 50 },
      ACC: { totalWins: 60, totalOldPrestige: 10 },
    });
    expect(ranks.PAC).toBe(1);
    expect(ranks.SEC).toBe(2);
    expect(ranks.ACC).toBe(3);
  });

  it("breaks ties by total old prestige", () => {
    const ranks = rankConferencesByWins({
      A: { totalWins: 70, totalOldPrestige: 40 },
      B: { totalWins: 70, totalOldPrestige: 90 },
    });
    expect(ranks.B).toBe(1);
    expect(ranks.A).toBe(2);
  });
});
