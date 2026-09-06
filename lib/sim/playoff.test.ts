import { describe, expect, it } from "vitest";
import { selectPlayoffField } from "./playoff";

function ranked(ids: string[]) {
  return ids.map((teamId, i) => ({ teamId, nationalRank: i + 1 }));
}

describe("selectPlayoffField", () => {
  it("takes the top 6 by rank when the top 6 are also the top conference champions", () => {
    const teams = ranked(["A", "B", "C", "D", "E", "F", "G", "H"]);
    const seeds = selectPlayoffField(teams, ["A", "B", "C"]);
    expect(seeds.map((s) => s.teamId)).toEqual(["A", "B", "C", "D", "E", "F"]);
    expect(seeds.map((s) => s.seed)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("bumps a higher-ranked non-champion for a lower-ranked top-3 champion", () => {
    // I is ranked 9th but is the 3rd-best-ranked conference champion (behind
    // A and D) -- matches the user's example exactly.
    const teams = ranked(["A", "B", "C", "D", "E", "F", "G", "H", "I"]);
    const champions = ["A", "D", "I"]; // ranks 1, 4, 9 -- the 3 champions
    const seeds = selectPlayoffField(teams, champions);
    const ids = seeds.map((s) => s.teamId);
    expect(ids).toContain("I");
    expect(ids).not.toContain("H"); // rank 8, bumped out
    // 6 teams total, seeded 1-6 by national rank regardless of champion status
    expect(seeds).toHaveLength(6);
    expect(ids).toEqual(["A", "B", "C", "D", "E", "I"]);
    expect(seeds.find((s) => s.teamId === "I")!.seed).toBe(6);
  });

  it("only guarantees the top 3 champions -- a 4th-6th ranked champion competes at-large", () => {
    const teams = ranked(["A", "B", "C", "D", "E", "F", "G"]);
    // 4 champions: A(1), B(2), C(3) get auto bids; G(7) must compete at-large
    // and loses out to D/E/F who are ranked ahead of it.
    const champions = ["A", "B", "C", "G"];
    const seeds = selectPlayoffField(teams, champions);
    const ids = seeds.map((s) => s.teamId);
    expect(ids).not.toContain("G");
    expect(ids).toEqual(["A", "B", "C", "D", "E", "F"]);
  });

  it("handles fewer than 3 champions by filling every remaining spot at-large", () => {
    const teams = ranked(["A", "B", "C", "D", "E", "F"]);
    const seeds = selectPlayoffField(teams, ["C"]);
    expect(seeds.map((s) => s.teamId)).toEqual(["A", "B", "C", "D", "E", "F"]);
  });
});
