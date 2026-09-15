import { describe, expect, it } from "vitest";
import { buildBracketDisplay, type BracketGameInput, type BracketSeedInput } from "./bracketDisplay";

function seeds12(): BracketSeedInput[] {
  return Array.from({ length: 12 }, (_, i) => ({ teamId: `T${i + 1}`, seed: i + 1, name: `Team ${i + 1}` }));
}

function seeds6(): BracketSeedInput[] {
  return Array.from({ length: 6 }, (_, i) => ({ teamId: `T${i + 1}`, seed: i + 1, name: `Team ${i + 1}` }));
}

function game(overrides: Partial<BracketGameInput> & Pick<BracketGameInput, "id" | "round" | "awayTeamId" | "homeTeamId">): BracketGameInput {
  return { awayScore: null, homeScore: null, played: false, ...overrides };
}

describe("buildBracketDisplay (12-team)", () => {
  it("splits seeds 1/4 (and their first-round games) onto the left, 2/3 onto the right, before any games exist", () => {
    const display = buildBracketDisplay(12, seeds12(), []);
    expect(display.left.firstColumn).toHaveLength(4);
    expect(display.right.firstColumn).toHaveLength(4);
    expect(display.left.firstColumn.map((e) => (e.type === "bye" ? `bye${e.team.seed}` : "game"))).toEqual([
      "bye1",
      "game",
      "bye4",
      "game",
    ]);
    expect(display.right.firstColumn.map((e) => (e.type === "bye" ? `bye${e.team.seed}` : "game"))).toEqual([
      "bye2",
      "game",
      "bye3",
      "game",
    ]);
    const leftGames = display.left.firstColumn.filter((e) => e.type === "game").map((e) => (e.type === "game" ? e.match : null)!);
    expect(leftGames.map((m) => [m.away.team?.seed, m.home.team?.seed])).toEqual([
      [8, 9],
      [5, 12],
    ]);
    const rightGames = display.right.firstColumn.filter((e) => e.type === "game").map((e) => (e.type === "game" ? e.match : null)!);
    expect(rightGames.map((m) => [m.away.team?.seed, m.home.team?.seed])).toEqual([
      [7, 10],
      [6, 11],
    ]);

    expect(display.left.rounds.map((r) => r.round)).toEqual(["QUARTERFINAL", "SEMIFINAL"]);
    expect(display.right.rounds.map((r) => r.round)).toEqual(["QUARTERFINAL", "SEMIFINAL"]);
    // Quarterfinals already know their bye-seed side; everything else TBD.
    expect(display.left.rounds[0].matches.map((m) => m.away.team?.seed)).toEqual([1, 4]);
    expect(display.right.rounds[0].matches.map((m) => m.away.team?.seed)).toEqual([2, 3]);
    expect(display.left.rounds[1].matches[0].away.team).toBeNull();
    expect(display.final.away.team).toBeNull();
    expect(display.final.home.team).toBeNull();
    expect(display.champion).toBeNull();
  });

  it("resolves quarterfinals once seeds 1-4's byes meet the first-round winners", () => {
    const games: BracketGameInput[] = [
      game({ id: "g89", round: "FIRST_ROUND", awayTeamId: "T8", homeTeamId: "T9", awayScore: 10, homeScore: 20, played: true }), // T9 wins
      game({ id: "g7-10", round: "FIRST_ROUND", awayTeamId: "T7", homeTeamId: "T10", awayScore: 30, homeScore: 10, played: true }), // T7 wins
      game({ id: "g6-11", round: "FIRST_ROUND", awayTeamId: "T6", homeTeamId: "T11" }), // not played yet
    ];
    const display = buildBracketDisplay(12, seeds12(), games);
    // Left QF0: seed 1 vs winner of 8v9 (T9)
    expect(display.left.rounds[0].matches[0].away.team?.teamId).toBe("T1");
    expect(display.left.rounds[0].matches[0].home.team?.teamId).toBe("T9");
    // Right QF0: seed 2 vs winner of 7v10 (T7)
    expect(display.right.rounds[0].matches[0].away.team?.teamId).toBe("T2");
    expect(display.right.rounds[0].matches[0].home.team?.teamId).toBe("T7");
    // Right QF1: seed 3 vs winner of 6v11 -- not played, still TBD
    expect(display.right.rounds[0].matches[1].home.team).toBeNull();
  });

  it("resolves the final and champion even when every bye seed (1-4) loses its quarterfinal", () => {
    // Regression test: a "winner of" slot must be identified by bracket
    // POSITION, not by whether a fixed seed happens to survive into it --
    // seeds 1-4 are guaranteed to appear in the quarterfinals (they're
    // byes), but nothing guarantees they win, so none of them may appear in
    // any later round at all.
    const games: BracketGameInput[] = [
      game({ id: "g1", round: "FIRST_ROUND", awayTeamId: "T8", homeTeamId: "T9", awayScore: 10, homeScore: 20, played: true }), // T9
      game({ id: "g2", round: "FIRST_ROUND", awayTeamId: "T5", homeTeamId: "T12", awayScore: 10, homeScore: 20, played: true }), // T12
      game({ id: "g3", round: "FIRST_ROUND", awayTeamId: "T7", homeTeamId: "T10", awayScore: 10, homeScore: 30, played: true }), // T10
      game({ id: "g4", round: "FIRST_ROUND", awayTeamId: "T6", homeTeamId: "T11", awayScore: 10, homeScore: 20, played: true }), // T11
      // Every bye seed (1-4) loses its quarterfinal.
      game({ id: "qf1", round: "QUARTERFINAL", awayTeamId: "T1", homeTeamId: "T9", awayScore: 10, homeScore: 40, played: true }), // T9
      game({ id: "qf2", round: "QUARTERFINAL", awayTeamId: "T4", homeTeamId: "T12", awayScore: 10, homeScore: 40, played: true }), // T12
      game({ id: "qf3", round: "QUARTERFINAL", awayTeamId: "T2", homeTeamId: "T10", awayScore: 10, homeScore: 40, played: true }), // T10
      game({ id: "qf4", round: "QUARTERFINAL", awayTeamId: "T3", homeTeamId: "T11", awayScore: 10, homeScore: 40, played: true }), // T11
      // Left SF: T9 vs T12 -- T9 wins. Right SF: T10 vs T11 -- T10 wins.
      game({ id: "sf1", round: "SEMIFINAL", awayTeamId: "T9", homeTeamId: "T12", awayScore: 30, homeScore: 20, played: true }),
      game({ id: "sf2", round: "SEMIFINAL", awayTeamId: "T10", homeTeamId: "T11", awayScore: 25, homeScore: 24, played: true }),
      game({ id: "final", round: "FINAL", awayTeamId: "T9", homeTeamId: "T10", awayScore: 21, homeScore: 17, played: true }),
    ];
    const display = buildBracketDisplay(12, seeds12(), games);
    expect(display.final.away.team?.teamId).toBe("T9");
    expect(display.final.home.team?.teamId).toBe("T10");
    expect(display.final.away.winner).toBe(true);
    expect(display.champion?.teamId).toBe("T9");
  });
});

describe("buildBracketDisplay (6-team)", () => {
  it("splits seed 1 (and its game) onto the left, seed 2 onto the right, before any games exist", () => {
    const display = buildBracketDisplay(6, seeds6(), []);
    expect(display.left.firstColumn).toHaveLength(2);
    expect(display.right.firstColumn).toHaveLength(2);
    expect(display.left.firstColumn.map((e) => (e.type === "bye" ? `bye${e.team.seed}` : "game"))).toEqual(["bye1", "game"]);
    expect(display.right.firstColumn.map((e) => (e.type === "bye" ? `bye${e.team.seed}` : "game"))).toEqual(["bye2", "game"]);
    const leftGame = display.left.firstColumn.find((e) => e.type === "game")!;
    expect(leftGame.type === "game" && [leftGame.match.away.team?.seed, leftGame.match.home.team?.seed]).toEqual([4, 5]);
    const rightGame = display.right.firstColumn.find((e) => e.type === "game")!;
    expect(rightGame.type === "game" && [rightGame.match.away.team?.seed, rightGame.match.home.team?.seed]).toEqual([3, 6]);

    expect(display.left.rounds.map((r) => r.round)).toEqual(["SEMIFINAL"]);
    expect(display.right.rounds.map((r) => r.round)).toEqual(["SEMIFINAL"]);
  });

  it("resolves semifinals once the quarterfinals are played", () => {
    const games: BracketGameInput[] = [
      game({ id: "qf1", round: "QUARTERFINAL", awayTeamId: "T4", homeTeamId: "T5", awayScore: 10, homeScore: 20, played: true }), // T5
      game({ id: "qf2", round: "QUARTERFINAL", awayTeamId: "T3", homeTeamId: "T6", awayScore: 20, homeScore: 10, played: true }), // T3
    ];
    const display = buildBracketDisplay(6, seeds6(), games);
    expect(display.left.rounds[0].matches[0].away.team?.teamId).toBe("T1");
    expect(display.left.rounds[0].matches[0].home.team?.teamId).toBe("T5");
    expect(display.right.rounds[0].matches[0].away.team?.teamId).toBe("T2");
    expect(display.right.rounds[0].matches[0].home.team?.teamId).toBe("T3");
  });

  it("resolves the final and champion", () => {
    const games: BracketGameInput[] = [
      game({ id: "qf1", round: "QUARTERFINAL", awayTeamId: "T4", homeTeamId: "T5", awayScore: 10, homeScore: 20, played: true }), // T5
      game({ id: "qf2", round: "QUARTERFINAL", awayTeamId: "T3", homeTeamId: "T6", awayScore: 20, homeScore: 10, played: true }), // T3
      game({ id: "sf1", round: "SEMIFINAL", awayTeamId: "T1", homeTeamId: "T5", awayScore: 30, homeScore: 20, played: true }), // T1
      game({ id: "sf2", round: "SEMIFINAL", awayTeamId: "T2", homeTeamId: "T3", awayScore: 15, homeScore: 25, played: true }), // T3
      game({ id: "final", round: "FINAL", awayTeamId: "T1", homeTeamId: "T3", awayScore: 14, homeScore: 21, played: true }), // T3
    ];
    const display = buildBracketDisplay(6, seeds6(), games);
    expect(display.final.away.team?.teamId).toBe("T1");
    expect(display.final.home.team?.teamId).toBe("T3");
    expect(display.final.home.winner).toBe(true);
    expect(display.champion?.teamId).toBe("T3");
  });
});
