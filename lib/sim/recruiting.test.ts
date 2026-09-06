import { describe, expect, it } from "vitest";
import { runPositionMarket, type TeamNeed, type TransferCandidate } from "./recruiting";
import type { RosterPlayer } from "./roster";

function player(overrides: Partial<RosterPlayer> = {}): RosterPlayer {
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

describe("runPositionMarket", () => {
  it("pairs the highest team value with the highest player value, deterministically with rand=0", () => {
    // rand()=0 always -> Team Value = prestige exactly, Player Value = ovr exactly (rand()+1=1)
    const rand = () => 0;
    const teams: TeamNeed[] = [
      { teamId: "low", prestige: 5 },
      { teamId: "high", prestige: 25 },
      { teamId: "mid", prestige: 15 },
    ];
    const transfers: TransferCandidate[] = [
      { teamId: "x", player: player({ ovr: 10, name: "Low OVR" }) },
      { teamId: "y", player: player({ ovr: 30, name: "High OVR" }) },
      { teamId: "z", player: player({ ovr: 20, name: "Mid OVR" }) },
    ];
    const assignments = runPositionMarket("QB", 2, teams, transfers, 0, rand);
    expect(assignments).toHaveLength(3);
    const byTeam = new Map(assignments.map((a) => [a.teamId, a]));
    expect(byTeam.get("high")!.rankedOvr).toBe(30);
    expect(byTeam.get("mid")!.rankedOvr).toBe(20);
    expect(byTeam.get("low")!.rankedOvr).toBe(10);
  });

  it("returns nothing when no team needs the position", () => {
    const assignments = runPositionMarket("QB", 1, [], [], 5, Math.random);
    expect(assignments).toEqual([]);
  });

  it("balances pool size to teams needing (transfers + hsRecruitCount)", () => {
    const teams: TeamNeed[] = Array.from({ length: 5 }, (_, i) => ({ teamId: `t${i}`, prestige: i }));
    const transfers: TransferCandidate[] = [
      { teamId: "a", player: player() },
      { teamId: "b", player: player() },
    ];
    const assignments = runPositionMarket("QB", 1, teams, transfers, 3, Math.random);
    expect(assignments).toHaveLength(5);
    const sources = assignments.map((a) => a.source);
    expect(sources.filter((s) => s === "TRANSFER")).toHaveLength(2);
    expect(sources.filter((s) => s === "FRESHMAN")).toHaveLength(3);
  });

  it("grows a placed transfer by one year but leaves freshmen at FR", () => {
    const teams: TeamNeed[] = [{ teamId: "dest", prestige: 10 }];
    const transfers: TransferCandidate[] = [{ teamId: "src", player: player({ classYear: "SO" }) }];
    const [placed] = runPositionMarket("QB", 1, teams, transfers, 0, Math.random);
    expect(placed.source).toBe("TRANSFER");
    expect(placed.player.classYear).toBe("JR");
    expect(placed.fromTeamId).toBe("src");
  });

  it("marks freshmen as FR with no origin team", () => {
    const teams: TeamNeed[] = [{ teamId: "dest", prestige: 10 }];
    const [placed] = runPositionMarket("QB", 3, teams, [], 1, Math.random);
    expect(placed.source).toBe("FRESHMAN");
    expect(placed.player.classYear).toBe("FR");
    expect(placed.fromTeamId).toBeNull();
  });
});
