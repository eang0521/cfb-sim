import { describe, expect, it } from "vitest";
import {
  agePlayer,
  bootstrapInitialRoster,
  generateFreshmanClass,
  isEarlyDeparture,
  isGraduating,
  rollDevTrait,
  rollEntersTransferPortal,
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
