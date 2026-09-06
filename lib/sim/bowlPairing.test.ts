import { describe, expect, it } from "vitest";
import { pairAvoidingSameConference, type HasConference } from "./bowlPairing";

function team(id: string, conferenceId: string): HasConference {
  return { teamId: id, team: { conferenceId } };
}

describe("pairAvoidingSameConference", () => {
  it("pairs everyone with nobody left over for an even list", () => {
    const teams = [team("a", "SEC"), team("b", "B10"), team("c", "ACC"), team("d", "PAC")];
    const pairs = pairAvoidingSameConference(teams);
    expect(pairs).toHaveLength(2);
    const paired = pairs.flatMap(([a, b]) => [a.teamId, b.teamId]);
    expect(new Set(paired).size).toBe(4);
  });

  it("never pairs two teams from the same conference when a valid matching exists", () => {
    // 3 conferences x 4 teams each = 12 teams, plenty of cross-conference room
    const teams = ["SEC", "B10", "ACC"].flatMap((conf) =>
      Array.from({ length: 4 }, (_, i) => team(`${conf}${i}`, conf))
    );
    const pairs = pairAvoidingSameConference(teams);
    expect(pairs).toHaveLength(6);
    for (const [a, b] of pairs) {
      expect(a.team.conferenceId).not.toBe(b.team.conferenceId);
    }
  });

  it("handles the tricky tail case: a heavy conference doesn't get stranded with itself", () => {
    // 6 SEC teams and only 2 non-SEC teams -- naive front-to-back pairing
    // exhausts the non-SEC teams early and leaves SEC-vs-SEC at the end.
    const teams = [
      ...Array.from({ length: 6 }, (_, i) => team(`SEC${i}`, "SEC")),
      team("B10-0", "B10"),
      team("ACC-0", "ACC"),
    ];
    const pairs = pairAvoidingSameConference(teams);
    expect(pairs).toHaveLength(4);
    const sameConfPairs = pairs.filter(([a, b]) => a.team.conferenceId === b.team.conferenceId);
    // With only 2 cross-conference "escape hatches" for 6 SEC teams, at least
    // 2 SEC pairs are mathematically unavoidable -- but the heuristic should
    // still use both escape hatches rather than wasting them.
    expect(sameConfPairs.length).toBe(2);
    const usedNonSec = pairs.some(([a, b]) => a.team.conferenceId === "B10" || b.team.conferenceId === "B10");
    const usedAcc = pairs.some(([a, b]) => a.team.conferenceId === "ACC" || b.team.conferenceId === "ACC");
    expect(usedNonSec).toBe(true);
    expect(usedAcc).toBe(true);
  });

  it("drops the odd team out with no pairing for an odd-length list", () => {
    const teams = [team("a", "SEC"), team("b", "B10"), team("c", "ACC")];
    const pairs = pairAvoidingSameConference(teams);
    expect(pairs).toHaveLength(1);
  });
});
