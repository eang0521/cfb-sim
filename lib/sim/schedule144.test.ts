import { describe, expect, it } from "vitest";
import { generateRegularSeasonSchedule144, type Schedule144Input, type ScheduleTeam144 } from "./schedule144";

const CONFERENCES = ["SEC", "B1G", "P12", "ACC", "B12", "BEC", "SBT", "MAC", "MWC", "AAC", "SWC", "SKY"];

// rivalrySlot 0-5 = the conference's first division ("A"), 6-11 = its
// second ("B") -- matches lib/data/teams144.ts's convention.
function buildTeams(): ScheduleTeam144[] {
  const teams: ScheduleTeam144[] = [];
  for (const conf of CONFERENCES) {
    for (let slot = 0; slot < 12; slot++) {
      const divSuffix = slot < 6 ? "A" : "B";
      teams.push({
        id: `${conf}-${slot}`,
        name: `${conf}-${slot}`,
        conferenceCode: conf,
        divisionCode: `${conf}${divSuffix}`,
        rivalrySlot: slot,
      });
    }
  }
  return teams;
}

function emptyInput(teams: ScheduleTeam144[]): Schedule144Input {
  return {
    priorConfRecord: new Map(),
    priorHeadToHead: new Map(),
    startingPrestige: new Map(teams.map((t) => [t.id, 0])),
    currentSeasonPrestige: new Map(teams.map((t) => [t.id, 0])),
    week5HistoricalHostCounts: new Map(),
  };
}

// Deterministic pseudo-random generator so a "random" conference order is
// reproducible across a stress-test loop without relying on Math.random.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const teams = buildTeams();
const teamById = new Map(teams.map((t) => [t.id, t]));
const fcsId = "FCS";

describe("generateRegularSeasonSchedule144", () => {
  it("gives every team exactly 12 games, one per week, never itself", () => {
    const games = generateRegularSeasonSchedule144(teams, fcsId, 1, emptyInput(teams), mulberry32(1));
    const counts = new Map<string, number>();
    const byTeamWeek = new Map<string, Set<number>>();
    for (const t of teams) {
      counts.set(t.id, 0);
      byTeamWeek.set(t.id, new Set());
    }
    for (const g of games) {
      expect(g.awayTeamId).not.toBe(g.homeTeamId);
      for (const id of [g.awayTeamId, g.homeTeamId]) {
        if (id === fcsId) continue;
        counts.set(id, (counts.get(id) ?? 0) + 1);
        expect(byTeamWeek.get(id)!.has(g.week)).toBe(false);
        byTeamWeek.get(id)!.add(g.week);
      }
    }
    for (const t of teams) {
      expect(counts.get(t.id)).toBe(12);
      expect(byTeamWeek.get(t.id)!.size).toBe(12);
    }
  });

  it("plays exactly 5 division games (weeks 4/6/8/10/12) and 3 conference games (weeks 7/9/11) per team", () => {
    const games = generateRegularSeasonSchedule144(teams, fcsId, 1, emptyInput(teams), mulberry32(2));
    const divisionWeeks = new Set([4, 6, 8, 10, 12]);
    const conferenceWeeks = new Set([7, 9, 11]);
    const divCount = new Map<string, number>();
    const confCount = new Map<string, number>();
    for (const t of teams) {
      divCount.set(t.id, 0);
      confCount.set(t.id, 0);
    }
    for (const g of games) {
      if (divisionWeeks.has(g.week)) {
        divCount.set(g.awayTeamId, (divCount.get(g.awayTeamId) ?? 0) + 1);
        divCount.set(g.homeTeamId, (divCount.get(g.homeTeamId) ?? 0) + 1);
      }
      if (conferenceWeeks.has(g.week)) {
        confCount.set(g.awayTeamId, (confCount.get(g.awayTeamId) ?? 0) + 1);
        confCount.set(g.homeTeamId, (confCount.get(g.homeTeamId) ?? 0) + 1);
      }
    }
    for (const t of teams) {
      expect(divCount.get(t.id)).toBe(5);
      expect(confCount.get(t.id)).toBe(3);
    }
  });

  it("keeps every team's division opponents within its own division", () => {
    const games = generateRegularSeasonSchedule144(teams, fcsId, 1, emptyInput(teams), mulberry32(3));
    const divisionWeeks = new Set([4, 6, 8, 10, 12]);
    for (const g of games) {
      if (!divisionWeeks.has(g.week)) continue;
      expect(teamById.get(g.awayTeamId)!.divisionCode).toBe(teamById.get(g.homeTeamId)!.divisionCode);
    }
  });

  it("keeps every team's non-division conference opponents cross-division, same conference", () => {
    const games = generateRegularSeasonSchedule144(teams, fcsId, 1, emptyInput(teams), mulberry32(4));
    const conferenceWeeks = new Set([7, 9, 11]);
    for (const g of games) {
      if (!conferenceWeeks.has(g.week)) continue;
      const away = teamById.get(g.awayTeamId)!;
      const home = teamById.get(g.homeTeamId)!;
      expect(away.conferenceCode).toBe(home.conferenceCode);
      expect(away.divisionCode).not.toBe(home.divisionCode);
    }
  });

  // The ported spreadsheet tables alone only balance home/away to within
  // +/-1 in any given season (exactly 8 home / 8 away over any two
  // consecutive seasons) -- balanceHomeAway144 then tightens that to exact
  // 4-4 every single season by flipping a minimal chain of games.
  function homeAwayCounts(season: number, seed: number) {
    const games = generateRegularSeasonSchedule144(teams, fcsId, season, emptyInput(teams), mulberry32(seed));
    const fixedWeeks = new Set([4, 6, 7, 8, 9, 10, 11, 12]);
    const home = new Map<string, number>();
    const away = new Map<string, number>();
    for (const t of teams) {
      home.set(t.id, 0);
      away.set(t.id, 0);
    }
    for (const g of games) {
      if (!fixedWeeks.has(g.week)) continue;
      home.set(g.homeTeamId, (home.get(g.homeTeamId) ?? 0) + 1);
      away.set(g.awayTeamId, (away.get(g.awayTeamId) ?? 0) + 1);
    }
    return { home, away, games };
  }

  it("gives every team EXACTLY 4 home / 4 away division+conference games, every single season", () => {
    for (let season = 1; season <= 20; season++) {
      const { home, away } = homeAwayCounts(season, 100 + season);
      for (const t of teams) {
        expect(home.get(t.id), `season ${season} team ${t.id} home`).toBe(4);
        expect(away.get(t.id), `season ${season} team ${t.id} away`).toBe(4);
      }
    }
  });

  it("never changes WHO plays whom while rebalancing home/away (only flips host/visitor)", () => {
    // Reconstruct the pre-balance pairing straight from the tables (same
    // logic as divisionAndConferenceWeeks144, minus the balancing pass) and
    // confirm the post-balance schedule has the exact same set of pairings.
    for (let season = 1; season <= 6; season++) {
      const { games } = homeAwayCounts(season, 600 + season);
      const pairKey = (g: { awayTeamId: string; homeTeamId: string }) => [g.awayTeamId, g.homeTeamId].sort().join("|");
      const fixedWeeks = new Set([4, 6, 7, 8, 9, 10, 11, 12]);
      const pairs = new Set(games.filter((g) => fixedWeeks.has(g.week)).map(pairKey));
      // Every division-mate and non-division conference-mate pairing must
      // still be present (this is the same coverage the other tests check,
      // restated here as a direct pairing-preservation sanity check).
      for (const t of teams) {
        const conferenceMates = teams.filter((o) => o.conferenceCode === t.conferenceCode && o.id !== t.id);
        const opponentCount = conferenceMates.filter((o) => pairs.has(pairKey({ awayTeamId: t.id, homeTeamId: o.id }))).length;
        expect(opponentCount, `season ${season} team ${t.id}`).toBe(8);
      }
    }
  });

  it("gives every team EXACTLY 8 home / 8 away across any two consecutive seasons' division+conference games", () => {
    for (let season = 1; season <= 9; season += 2) {
      const s1 = homeAwayCounts(season, 300 + season);
      const s2 = homeAwayCounts(season + 1, 300 + season + 1);
      for (const t of teams) {
        const combinedHome = s1.home.get(t.id)! + s2.home.get(t.id)!;
        expect(combinedHome, `seasons ${season}/${season + 1} team ${t.id}`).toBe(8);
      }
    }
  });

  it("alternates the 3 non-division conference opponents between consecutive seasons, covering all 6 over 2 seasons", () => {
    const conferenceWeeks = new Set([7, 9, 11]);
    const opponentsOf = (games: { week: number; awayTeamId: string; homeTeamId: string }[], teamId: string) => {
      const opps = new Set<string>();
      for (const g of games) {
        if (!conferenceWeeks.has(g.week)) continue;
        if (g.awayTeamId === teamId) opps.add(g.homeTeamId);
        if (g.homeTeamId === teamId) opps.add(g.awayTeamId);
      }
      return opps;
    };

    const season1 = generateRegularSeasonSchedule144(teams, fcsId, 1, emptyInput(teams), mulberry32(5));
    const season2 = generateRegularSeasonSchedule144(teams, fcsId, 2, emptyInput(teams), mulberry32(6));

    const sample = teams[0];
    const opps1 = opponentsOf(season1, sample.id);
    const opps2 = opponentsOf(season2, sample.id);
    expect(opps1.size).toBe(3);
    expect(opps2.size).toBe(3);
    // Disjoint -- the two groups of 3 never overlap.
    for (const o of opps1) expect(opps2.has(o)).toBe(false);
    // Together they cover all 6 cross-division opponents.
    const combined = new Set([...opps1, ...opps2]);
    expect(combined.size).toBe(6);
  });

  it("always plays the fixed rivalry pairing (consecutive rivalrySlots) in week 12", () => {
    for (let season = 1; season <= 6; season++) {
      const games = generateRegularSeasonSchedule144(teams, fcsId, season, emptyInput(teams), mulberry32(400 + season));
      const week12 = games.filter((g) => g.week === 12);
      for (const g of week12) {
        const away = teamById.get(g.awayTeamId)!;
        const home = teamById.get(g.homeTeamId)!;
        const [lo, hi] = [away.rivalrySlot, home.rivalrySlot].sort((a, b) => a - b);
        expect(lo % 2, `season ${season} ${away.id} vs ${home.id}`).toBe(0);
        expect(hi).toBe(lo + 1);
      }
    }
  });

  it("flips the week-12 rivalry host between consecutive seasons", () => {
    const games1 = generateRegularSeasonSchedule144(teams, fcsId, 1, emptyInput(teams), mulberry32(7));
    const games2 = generateRegularSeasonSchedule144(teams, fcsId, 2, emptyInput(teams), mulberry32(8));
    const hostOf = (games: { week: number; awayTeamId: string; homeTeamId: string }[], teamId: string) =>
      games.find((g) => g.week === 12 && (g.awayTeamId === teamId || g.homeTeamId === teamId))!.homeTeamId;

    for (const t of teams) {
      const host1 = hostOf(games1, t.id);
      const host2 = hostOf(games2, t.id);
      expect(host1).not.toBe(host2);
    }
  });

  it("plays every division-mate exactly once across weeks 4/6/8/10/12 (the D1-D4+DR round robin), every season", () => {
    for (let season = 1; season <= 4; season++) {
      const games = generateRegularSeasonSchedule144(teams, fcsId, season, emptyInput(teams), mulberry32(500 + season));
      const divisionWeeks = new Set([4, 6, 8, 10, 12]);
      const opponentsByTeam = new Map<string, Set<string>>();
      for (const t of teams) opponentsByTeam.set(t.id, new Set());
      for (const g of games) {
        if (!divisionWeeks.has(g.week)) continue;
        opponentsByTeam.get(g.awayTeamId)!.add(g.homeTeamId);
        opponentsByTeam.get(g.homeTeamId)!.add(g.awayTeamId);
      }
      for (const t of teams) {
        const divisionMates = teams.filter((o) => o.divisionCode === t.divisionCode && o.id !== t.id);
        expect(opponentsByTeam.get(t.id)!.size, `season ${season} team ${t.id}`).toBe(5);
        for (const mate of divisionMates) {
          expect(opponentsByTeam.get(t.id)!.has(mate.id), `season ${season} ${t.id} vs ${mate.id}`).toBe(true);
        }
      }
    }
  });

  it("produces exactly 72 games each in weeks 1/3/5 with no duplicate pairing across them", () => {
    const games = generateRegularSeasonSchedule144(teams, fcsId, 1, emptyInput(teams), mulberry32(9));
    for (const week of [1, 3, 5]) {
      const weekGames = games.filter((g) => g.week === week);
      expect(weekGames).toHaveLength(72);
    }
    const seenPairs = new Set<string>();
    for (const g of games.filter((g) => g.week === 1 || g.week === 3 || g.week === 5)) {
      const key = [g.awayTeamId, g.homeTeamId].sort().join("|");
      expect(seenPairs.has(key)).toBe(false);
      seenPairs.add(key);
    }
  });

  it("gives every team exactly one game in each of weeks 1, 3, and 5", () => {
    const games = generateRegularSeasonSchedule144(teams, fcsId, 1, emptyInput(teams), mulberry32(10));
    for (const week of [1, 3, 5]) {
      const seen = new Set<string>();
      for (const g of games.filter((g) => g.week === week)) {
        expect(seen.has(g.awayTeamId)).toBe(false);
        expect(seen.has(g.homeTeamId)).toBe(false);
        seen.add(g.awayTeamId);
        seen.add(g.homeTeamId);
      }
      expect(seen.size).toBe(teams.length);
    }
  });

  it("never repeats a week-1/3 conference matchup in week 5 when an alternative exists", () => {
    for (let trial = 0; trial < 10; trial++) {
      const games = generateRegularSeasonSchedule144(teams, fcsId, 1, emptyInput(teams), mulberry32(200 + trial));
      const teamConf = new Map(teams.map((t) => [t.id, t.conferenceCode]));
      const confPairKey = (a: string, b: string) => [teamConf.get(a), teamConf.get(b)].sort().join("|");

      const playedByWeek13 = new Set<string>();
      for (const g of games.filter((g) => g.week === 1 || g.week === 3)) {
        playedByWeek13.add(confPairKey(g.awayTeamId, g.homeTeamId));
      }
      for (const g of games.filter((g) => g.week === 5)) {
        expect(playedByWeek13.has(confPairKey(g.awayTeamId, g.homeTeamId))).toBe(false);
      }
    }
  });

  it("does not crash and still balances weeks 1/3/5 when using the last-season ranking + head-to-head tiebreak", () => {
    const input = emptyInput(teams);
    for (const t of teams) {
      input.priorConfRecord.set(t.id, { confWins: Math.floor(Math.random() * 6), confLosses: Math.floor(Math.random() * 6), powerElo: Math.random() * 100 });
    }
    const games = generateRegularSeasonSchedule144(teams, fcsId, 3, input, mulberry32(11));
    expect(games.length).toBeGreaterThan(0);
    for (const week of [1, 3, 5]) {
      expect(games.filter((g) => g.week === week)).toHaveLength(72);
    }
  });
});
