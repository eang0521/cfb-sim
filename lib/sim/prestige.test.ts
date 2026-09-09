import { describe, expect, it } from "vitest";
import { CONFERENCE_BONUS_MEGA144, conferenceRankBonus, rankConferencesByWins, updatePrestige } from "./prestige";

function seeded(sequence: number[]): () => number {
  let i = 0;
  return () => sequence[i++ % sequence.length];
}

describe("updatePrestige", () => {
  it("matches the official formula exactly: round((old + wins - losses)*2/3) + confBonus + swing", () => {
    // rand() picking index 0 of [-3,-2,-1,1,2,3] -> swing = -3
    const rand = seeded([0]);
    const result = updatePrestige(
      { currentPrestige: 30, totalWins: 9, totalLosses: 3, conferenceBonus: 2 },
      rand
    );
    // round((30+9-3)*2/3) = round(36*2/3) = 24, +confBonus(2) -> 26, +swing(-3) -> 23
    expect(result).toBe(24 + 2 - 3);
  });

  it("folds wins/losses in BEFORE the 2/3 decay, not after", () => {
    // Same wins/losses/confBonus/swing as the case above, but starting prestige
    // has already been decayed the OLD (wrong) way to isolate the fold-in
    // order: if wins/losses were still added after decay, this would equal
    // the case above; it must not.
    const rand = seeded([0]);
    const oldOrderResult = Math.round((30 * 2) / 3) + 9 - 3 + 2 - 3; // the pre-change formula
    const result = updatePrestige(
      { currentPrestige: 30, totalWins: 9, totalLosses: 3, conferenceBonus: 2 },
      rand
    );
    expect(result).not.toBe(oldOrderResult);
  });

  it("decays negative prestige toward zero too", () => {
    const rand = seeded([0.2]); // floor(0.2*6)=1 -> index 1 -> swing = -2
    const result = updatePrestige(
      { currentPrestige: -9, totalWins: 2, totalLosses: 10, conferenceBonus: -2 },
      rand
    );
    // round((-9+2-10)*2/3) = round(-17*2/3) = round(-11.33) = -11, +confBonus(-2) -> -13, +swing(-2) -> -15
    expect(result).toBe(-11 - 2 - 2);
  });
});

describe("conferenceRankBonus", () => {
  it("matches [+2,+1,0,0,-1,-2] for ranks 1-6", () => {
    expect([1, 2, 3, 4, 5, 6].map((rank) => conferenceRankBonus(rank))).toEqual([2, 1, 0, 0, -1, -2]);
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

describe("CONFERENCE_BONUS_MEGA144", () => {
  it("is permanently locked per conference, independent of that season's wins", () => {
    expect(CONFERENCE_BONUS_MEGA144).toEqual({
      SEC: 4,
      B1G: 3,
      P12: 3,
      ACC: 3,
      B12: 3,
      BEC: 0,
      SBT: -3,
      MAC: -3,
      MWC: -1,
      AAC: -3,
      SWC: -2,
      SKY: -4,
    });
  });
});
