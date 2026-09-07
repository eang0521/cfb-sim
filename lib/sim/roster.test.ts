import { describe, expect, it } from "vitest";
import {
  agePlayer,
  bootstrapDynastyRosters,
  bootstrapInitialRoster,
  generateFreshmanClass,
  isEarlyDeparture,
  isGraduating,
  rollDevTrait,
  rollEntersTransferPortal,
  sortByPosGroup,
  teamRatings,
  walkDevTrait,
  type RosterPlayer,
} from "./roster";

function makePlayer(overrides: Partial<RosterPlayer> = {}): RosterPlayer {
  return {
    name: "Test Player",
    posGroup: "QB",
    pos: "QB",
    side: "O",
    classYear: "SO",
    ovr: 15,
    devTrait: 2,
    devMarker: "",
    recruitedSeason: 1,
    ...overrides,
  };
}

describe("generateFreshmanClass", () => {
  it("generates exactly 6 recruits, one per position group", () => {
    const recruits = generateFreshmanClass(1, Math.random);
    expect(recruits).toHaveLength(6);
    const groups = recruits.map((r) => r.posGroup).sort();
    expect(groups).toEqual(["DB", "DL", "LB", "OL", "QB", "UT"]);
    for (const r of recruits) {
      expect(r.classYear).toBe("FR");
      expect(r.ovr).toBeGreaterThanOrEqual(2);
      expect(r.ovr).toBeLessThanOrEqual(12);
    }
  });
});

describe("rollDevTrait", () => {
  it("is skewed toward Normal(2), matching the 1/6-4/6-1/6 split", () => {
    const counts = { 1: 0, 2: 0, 3: 0 } as Record<number, number>;
    const n = 12000;
    for (let i = 0; i < n; i++) counts[rollDevTrait(Math.random)]++;
    expect(counts[2] / n).toBeGreaterThan(0.55);
    expect(counts[1] / n).toBeLessThan(0.25);
    expect(counts[3] / n).toBeLessThan(0.25);
  });
});

describe("walkDevTrait", () => {
  it("stays within [1,3]", () => {
    for (let i = 0; i < 500; i++) {
      expect(walkDevTrait(1, Math.random)).toBeGreaterThanOrEqual(1);
      expect(walkDevTrait(3, Math.random)).toBeLessThanOrEqual(3);
    }
  });
});

describe("isGraduating / isEarlyDeparture", () => {
  it("flags only seniors as graduating", () => {
    expect(isGraduating(makePlayer({ classYear: "SR" }))).toBe(true);
    for (const year of ["FR", "SO", "JR"] as const) {
      expect(isGraduating(makePlayer({ classYear: year }))).toBe(false);
    }
  });

  it("flags only junior Stars (dev=3) as early departures", () => {
    expect(isEarlyDeparture(makePlayer({ classYear: "JR", devTrait: 3 }))).toBe(true);
    expect(isEarlyDeparture(makePlayer({ classYear: "JR", devTrait: 2 }))).toBe(false);
    expect(isEarlyDeparture(makePlayer({ classYear: "JR", devTrait: 1 }))).toBe(false);
    expect(isEarlyDeparture(makePlayer({ classYear: "SR", devTrait: 3 }))).toBe(false);
    expect(isEarlyDeparture(makePlayer({ classYear: "SO", devTrait: 3 }))).toBe(false);
  });
});

describe("rollEntersTransferPortal", () => {
  it("fires close to 1/6 of the time over many rolls", () => {
    let count = 0;
    const n = 60000;
    for (let i = 0; i < n; i++) if (rollEntersTransferPortal(Math.random)) count++;
    expect(count / n).toBeGreaterThan(0.14);
    expect(count / n).toBeLessThan(0.19);
  });
});

describe("agePlayer", () => {
  it("returns null (graduated) for a senior", () => {
    const senior = {
      name: "Test Senior",
      posGroup: "QB" as const,
      pos: "QB",
      side: "O" as const,
      classYear: "SR" as const,
      ovr: 20,
      devTrait: 2,
      devMarker: "" as const,
      recruitedSeason: 1,
    };
    expect(agePlayer(senior, Math.random)).toBeNull();
  });

  it("advances a non-senior's class year and grows OVR", () => {
    const freshman = {
      name: "Test Freshman",
      posGroup: "OL" as const,
      pos: "OT",
      side: "O" as const,
      classYear: "FR" as const,
      ovr: 10,
      devTrait: 3,
      devMarker: "+" as const,
      recruitedSeason: 4,
    };
    const aged = agePlayer(freshman, Math.random)!;
    expect(aged.classYear).toBe("SO");
    expect(aged.ovr).toBeGreaterThanOrEqual(10);
  });
});

describe("bootstrapInitialRoster", () => {
  it("produces exactly 6 players, one per position group", () => {
    const roster = bootstrapInitialRoster(1, Math.random);
    expect(roster).toHaveLength(6);
    const groups = roster.map((p) => p.posGroup).sort();
    expect(groups).toEqual(["DB", "DL", "LB", "OL", "QB", "UT"]);
  });

  it("spreads starting class years across the roster (not all freshmen)", () => {
    // With 40 independent 6-slot rosters, seeing only FR would be
    // astronomically unlikely if starting years were actually randomized.
    const years = new Set<string>();
    for (let i = 0; i < 40; i++) {
      for (const p of bootstrapInitialRoster(1, Math.random)) years.add(p.classYear);
    }
    expect(years.size).toBeGreaterThan(1);
  });
});

describe("bootstrapDynastyRosters", () => {
  it("gives every team exactly 6 players, one per position group", () => {
    const teams = [
      { teamId: "hi", prestige: 25 },
      { teamId: "mid", prestige: 5 },
      { teamId: "lo", prestige: -20 },
    ];
    const rosters = bootstrapDynastyRosters(teams, 1, Math.random);
    for (const t of teams) {
      const roster = rosters.get(t.teamId)!;
      expect(roster).toHaveLength(6);
      expect(roster.map((p) => p.posGroup).sort()).toEqual(["DB", "DL", "LB", "OL", "QB", "UT"]);
    }
  });

  it("spreads class years across the league (not all one year)", () => {
    const teams = Array.from({ length: 20 }, (_, i) => ({ teamId: `t${i}`, prestige: 0 }));
    const rosters = bootstrapDynastyRosters(teams, 1, Math.random);
    const years = new Set<string>();
    for (const roster of rosters.values()) {
      for (const p of roster) years.add(p.classYear);
    }
    expect(years.size).toBeGreaterThan(1);
  });

  it("correlates higher prestige with a stronger average roster over many trials", () => {
    // Not deterministic per-run (it's a market with randomness on both
    // sides), but across enough independent leagues the high-prestige team
    // should come out ahead far more often than not.
    let highWonCount = 0;
    const trials = 60;
    for (let trial = 0; trial < trials; trial++) {
      const teams = [
        { teamId: "high", prestige: 27 },
        ...Array.from({ length: 10 }, (_, i) => ({ teamId: `filler${i}`, prestige: 0 })),
        { teamId: "low", prestige: -25 },
      ];
      const rosters = bootstrapDynastyRosters(teams, 1, Math.random);
      const avgOvr = (id: string) => {
        const roster = rosters.get(id)!;
        return roster.reduce((sum, p) => sum + p.ovr, 0) / roster.length;
      };
      if (avgOvr("high") > avgOvr("low")) highWonCount++;
    }
    expect(highWonCount / trials).toBeGreaterThan(0.7);
  });

  it("progresses each player's OVR to reflect their assigned class year (later years >= freshman-level baseline on average)", () => {
    // Freshman-level baseline is HS + 1 growth step; a SR has 3 more growth
    // steps on top of that, so should trend meaningfully higher on average.
    const teams = Array.from({ length: 60 }, (_, i) => ({ teamId: `t${i}`, prestige: 0 }));
    const rosters = bootstrapDynastyRosters(teams, 1, Math.random);
    const byClassYear = new Map<string, number[]>();
    for (const roster of rosters.values()) {
      for (const p of roster) {
        if (!byClassYear.has(p.classYear)) byClassYear.set(p.classYear, []);
        byClassYear.get(p.classYear)!.push(p.ovr);
      }
    }
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    expect(avg(byClassYear.get("SR")!)).toBeGreaterThan(avg(byClassYear.get("FR")!));
  });
});

describe("sortByPosGroup", () => {
  it("always orders QB, UT, OL, DL, LB, DB regardless of input order", () => {
    const shuffled = ["DB", "LB", "DL", "OL", "UT", "QB"].map((posGroup) => ({ posGroup }));
    expect(sortByPosGroup(shuffled).map((p) => p.posGroup)).toEqual(["QB", "UT", "OL", "DL", "LB", "DB"]);
  });
});

describe("teamRatings", () => {
  it("sums OVR by side and folds in 2x prestige", () => {
    const players = [
      { side: "O" as const, ovr: 10 },
      { side: "O" as const, ovr: 20 },
      { side: "D" as const, ovr: 15 },
    ] as never;
    const result = teamRatings(players, 25);
    expect(result.offRating).toBe(30);
    expect(result.defRating).toBe(15);
    expect(result.totalRating).toBe(45);
    expect(result.rating).toBe(45 + 50);
  });
});
