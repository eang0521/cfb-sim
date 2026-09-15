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
  it("shows the whole shape with everything TBD before any bracket games exist", () => {
    const display = buildBracketDisplay(12, seeds12(), []);
    expect(display.firstColumn).toHaveLength(8);
    // Byes (seeds 1-4) interleaved with their paired first-round game.
    expect(display.firstColumn.map((e) => (e.type === "bye" ? `bye${e.team.seed}` : "game"))).toEqual([
      "bye1",
      "game",
      "bye2",
      "game",
      "bye3",
      "game",
      "bye4",
      "game",
    ]);
    const firstRoundGames = display.firstColumn.filter((e) => e.type === "game").map((e) => (e.type === "game" ? e.match : null)!);
    expect(firstRoundGames.map((m) => [m.away.team?.seed, m.home.team?.seed])).toEqual([
      [8, 9],
      [7, 10],
      [6, 11],
      [5, 12],
    ]);
    expect(display.laterRounds.map((r) => r.round)).toEqual(["QUARTERFINAL", "SEMIFINAL", "FINAL"]);
    // Quarterfinals already know their bye-seed side (away); the "winner of
    // the first round" side (home) is TBD. Semifinals and the final are
    // fully TBD -- both sides depend on a later result.
    const qf = display.laterRounds.find((r) => r.round === "QUARTERFINAL")!;
    expect(qf.matches.map((m) => m.away.team?.seed)).toEqual([1, 2, 3, 4]);
    expect(qf.matches.every((m) => m.home.team === null)).toBe(true);
    for (const round of display.laterRounds.filter((r) => r.round !== "QUARTERFINAL")) {
      for (const m of round.matches) {
        expect(m.away.team).toBeNull();
        expect(m.home.team).toBeNull();
      }
    }
    expect(display.champion).toBeNull();
  });

  it("resolves quarterfinals once seeds 1-4's byes meet the first-round winners", () => {
    const games: BracketGameInput[] = [
      game({ id: "g89", round: "FIRST_ROUND", awayTeamId: "T8", homeTeamId: "T9", awayScore: 10, homeScore: 20, played: true }), // T9 wins
      game({ id: "g7-10", round: "FIRST_ROUND", awayTeamId: "T7", homeTeamId: "T10", awayScore: 30, homeScore: 10, played: true }), // T7 wins
      game({ id: "g6-11", round: "FIRST_ROUND", awayTeamId: "T6", homeTeamId: "T11" }), // not played yet
    ];
    const display = buildBracketDisplay(12, seeds12(), games);
    const qf = display.laterRounds.find((r) => r.round === "QUARTERFINAL")!;
    // QF0: seed 1 vs winner of 8v9 (T9)
    expect(qf.matches[0].away.team?.teamId).toBe("T1");
    expect(qf.matches[0].home.team?.teamId).toBe("T9");
    // QF1: seed 2 vs winner of 7v10 (T7)
    expect(qf.matches[1].away.team?.teamId).toBe("T2");
    expect(qf.matches[1].home.team?.teamId).toBe("T7");
    // QF2: seed 3 vs winner of 6v11 -- not played, still TBD
    expect(qf.matches[2].home.team).toBeNull();
  });

  it("resolves the champion once the final is played", () => {
    const games: BracketGameInput[] = [
      game({ id: "g1", round: "FIRST_ROUND", awayTeamId: "T8", homeTeamId: "T9", awayScore: 10, homeScore: 20, played: true }),
      game({ id: "g2", round: "FIRST_ROUND", awayTeamId: "T7", homeTeamId: "T10", awayScore: 30, homeScore: 10, played: true }),
      game({ id: "g3", round: "FIRST_ROUND", awayTeamId: "T6", homeTeamId: "T11", awayScore: 20, homeScore: 10, played: true }),
      game({ id: "g4", round: "FIRST_ROUND", awayTeamId: "T5", homeTeamId: "T12", awayScore: 20, homeScore: 10, played: true }),
      game({ id: "qf1", round: "QUARTERFINAL", awayTeamId: "T1", homeTeamId: "T9", awayScore: 40, homeScore: 10, played: true }), // T1
      game({ id: "qf2", round: "QUARTERFINAL", awayTeamId: "T2", homeTeamId: "T7", awayScore: 40, homeScore: 10, played: true }), // T2
      game({ id: "qf3", round: "QUARTERFINAL", awayTeamId: "T3", homeTeamId: "T6", awayScore: 40, homeScore: 10, played: true }), // T3
      game({ id: "qf4", round: "QUARTERFINAL", awayTeamId: "T4", homeTeamId: "T5", awayScore: 40, homeScore: 10, played: true }), // T4
      // SF0: side1(T1) vs side4(T4) -- T1 wins. SF1: side2(T2) vs side3(T3) -- T2 wins.
      game({ id: "sf1", round: "SEMIFINAL", awayTeamId: "T1", homeTeamId: "T4", awayScore: 30, homeScore: 20, played: true }),
      game({ id: "sf2", round: "SEMIFINAL", awayTeamId: "T2", homeTeamId: "T3", awayScore: 25, homeScore: 24, played: true }),
      game({ id: "final", round: "FINAL", awayTeamId: "T1", homeTeamId: "T2", awayScore: 21, homeScore: 17, played: true }),
    ];
    const display = buildBracketDisplay(12, seeds12(), games);
    expect(display.champion?.teamId).toBe("T1");
    const final = display.laterRounds.find((r) => r.round === "FINAL")!.matches[0];
    expect(final.away.winner).toBe(true);
    expect(final.home.winner).toBe(false);
  });
});

describe("buildBracketDisplay (6-team)", () => {
  it("shows the whole shape TBD before any games exist", () => {
    const display = buildBracketDisplay(6, seeds6(), []);
    expect(display.firstColumn).toHaveLength(4);
    expect(display.firstColumn.map((e) => (e.type === "bye" ? `bye${e.team.seed}` : "game"))).toEqual(["bye1", "game", "bye2", "game"]);
    const firstRoundGames = display.firstColumn.filter((e) => e.type === "game").map((e) => (e.type === "game" ? e.match : null)!);
    expect(firstRoundGames.map((m) => [m.away.team?.seed, m.home.team?.seed])).toEqual([
      [4, 5],
      [3, 6],
    ]);
    expect(display.laterRounds.map((r) => r.round)).toEqual(["SEMIFINAL", "FINAL"]);
  });

  it("resolves semifinals once the quarterfinals are played", () => {
    const games: BracketGameInput[] = [
      game({ id: "qf1", round: "QUARTERFINAL", awayTeamId: "T4", homeTeamId: "T5", awayScore: 10, homeScore: 20, played: true }), // T5
      game({ id: "qf2", round: "QUARTERFINAL", awayTeamId: "T3", homeTeamId: "T6", awayScore: 20, homeScore: 10, played: true }), // T3
    ];
    const display = buildBracketDisplay(6, seeds6(), games);
    const sf = display.laterRounds.find((r) => r.round === "SEMIFINAL")!;
    expect(sf.matches[0].away.team?.teamId).toBe("T1");
    expect(sf.matches[0].home.team?.teamId).toBe("T5");
    expect(sf.matches[1].away.team?.teamId).toBe("T2");
    expect(sf.matches[1].home.team?.teamId).toBe("T3");
  });
});
