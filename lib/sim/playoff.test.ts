import { describe, expect, it } from "vitest";
import {
  buildFinal12,
  buildFirstRound12,
  buildQuarterfinals12,
  buildSemifinals12,
  selectPlayoffField,
  selectPlayoffField12,
  type Seed,
} from "./playoff";

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

describe("selectPlayoffField12", () => {
  it("takes the top 6 champions plus the next-best 6 at-large, seeded 1-12 by rank", () => {
    const ids = Array.from({ length: 14 }, (_, i) => String.fromCharCode(65 + i)); // A..N
    const teams = ranked(ids);
    const champions = ["A", "B", "C", "D", "E", "F"]; // ranks 1-6
    const seeds = selectPlayoffField12(teams, champions);
    expect(seeds).toHaveLength(12);
    expect(seeds.map((s) => s.teamId)).toEqual(ids.slice(0, 12));
    expect(seeds.map((s) => s.seed)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });

  it("bumps a higher-ranked non-champion for a lower-ranked top-6 champion", () => {
    const ids = Array.from({ length: 14 }, (_, i) => String.fromCharCode(65 + i)); // A..N
    const teams = ranked(ids);
    // M (rank 13) is the 6th-best-ranked champion; without the auto-bid it
    // would miss the 12-team field entirely (ranks 1-12 would exclude it).
    const champions = ["A", "D", "G", "H", "K", "M"];
    const seeds = selectPlayoffField12(teams, champions);
    const resultIds = seeds.map((s) => s.teamId);
    expect(resultIds).toContain("M");
    expect(resultIds).not.toContain("L"); // rank 12, bumped out
    expect(seeds).toHaveLength(12);
  });
});

describe("12-team bracket construction", () => {
  const seeds: Seed[] = Array.from({ length: 12 }, (_, i) => ({ teamId: `S${i + 1}`, seed: i + 1 }));

  it("byes seeds 1-4 and pairs 5v12, 6v11, 7v10, 8v9 in the first round", () => {
    const firstRound = buildFirstRound12(seeds);
    expect(firstRound.map(([a, b]) => [a.seed, b.seed])).toEqual([
      [5, 12],
      [6, 11],
      [7, 10],
      [8, 9],
    ]);
  });

  it("slots quarterfinal winners against the bye seeds in a fixed bracket", () => {
    const win5v12: Seed = { teamId: "S12", seed: 12 };
    const win6v11: Seed = { teamId: "S6", seed: 6 };
    const win7v10: Seed = { teamId: "S7", seed: 7 };
    const win8v9: Seed = { teamId: "S8", seed: 8 };
    const qf = buildQuarterfinals12(seeds, [win5v12, win6v11, win7v10, win8v9]);
    expect(qf.map(([a, b]) => [a.seed, b.seed])).toEqual([
      [1, 8],
      [2, 7],
      [3, 6],
      [4, 12],
    ]);
  });

  it("pairs the 1/4 bracket sides together and the 2/3 bracket sides together in the semis", () => {
    const side1: Seed = { teamId: "side1", seed: 1 };
    const side2: Seed = { teamId: "side2", seed: 2 };
    const side3: Seed = { teamId: "side3", seed: 3 };
    const side4: Seed = { teamId: "side4", seed: 4 };
    const semis = buildSemifinals12([side1, side2, side3, side4]);
    expect(semis).toEqual([
      [side1, side4],
      [side2, side3],
    ]);
  });

  it("builds the final from the two semifinal winners", () => {
    const sf1: Seed = { teamId: "sf1", seed: 1 };
    const sf2: Seed = { teamId: "sf2", seed: 2 };
    expect(buildFinal12(sf1, sf2)).toEqual([sf1, sf2]);
  });
});
