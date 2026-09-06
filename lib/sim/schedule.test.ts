import { describe, expect, it } from "vitest";
import { generateRegularSeasonSchedule, type PriorStanding, type ScheduleTeam } from "./schedule";

const CONFERENCES = ["SEC", "B10", "B12", "PAC", "ACC", "BEC"];

function buildTeams(): ScheduleTeam[] {
  const teams: ScheduleTeam[] = [];
  for (const conf of CONFERENCES) {
    for (const divSuffix of ["A", "B"]) {
      for (let i = 0; i < 6; i++) {
        teams.push({
          id: `${conf}-${divSuffix}-${i}`,
          name: `${conf}-${divSuffix}-${i}`,
          conferenceCode: conf,
          divisionCode: `${conf}${divSuffix}`,
        });
      }
    }
  }
  return teams;
}

function opponentsByWeek(games: { week: number; awayTeamId: string; homeTeamId: string }[], fcsId: string) {
  const map = new Map<string, Map<number, string>>();
  for (const g of games) {
    for (const [id, opp] of [
      [g.awayTeamId, g.homeTeamId],
      [g.homeTeamId, g.awayTeamId],
    ]) {
      if (id === fcsId) continue;
      if (!map.has(id)) map.set(id, new Map());
      map.get(id)!.set(g.week, opp);
    }
  }
  return map;
}

describe("generateRegularSeasonSchedule", () => {
  const teams = buildTeams();
  const fcsId = "FCS";
  const games = generateRegularSeasonSchedule(teams, fcsId, 1);

  it("gives every team exactly 12 games, one per week, never itself", () => {
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

  it("plays the FCS cupcake game in week 2 only", () => {
    const fcsGames = games.filter((g) => g.awayTeamId === fcsId || g.homeTeamId === fcsId);
    expect(fcsGames).toHaveLength(teams.length);
    expect(fcsGames.every((g) => g.week === 2)).toBe(true);
  });

  it("plays a full 5-game division round robin, with DR always in week 12", () => {
    const divisionOf = new Map(teams.map((t) => [t.id, t.divisionCode]));
    const divisions = new Map<string, string[]>();
    for (const t of teams) {
      if (!divisions.has(t.divisionCode)) divisions.set(t.divisionCode, []);
      divisions.get(t.divisionCode)!.push(t.id);
    }
    for (const divTeams of divisions.values()) {
      const pairsSeen = new Set<string>();
      for (const g of games) {
        if (divTeams.includes(g.awayTeamId) && divTeams.includes(g.homeTeamId)) {
          pairsSeen.add([g.awayTeamId, g.homeTeamId].sort().join("|"));
        }
      }
      expect(pairsSeen.size).toBe(15); // C(6,2) full round robin
    }
    // week 12 is always a division game for everyone
    for (const g of games.filter((g) => g.week === 12)) {
      expect(divisionOf.get(g.awayTeamId)).toBe(divisionOf.get(g.homeTeamId));
    }
  });

  it("plays exactly 3 cross-division conference games (weeks 7, 9, 11)", () => {
    const confOf = new Map(teams.map((t) => [t.id, t.conferenceCode]));
    const divOf = new Map(teams.map((t) => [t.id, t.divisionCode]));
    for (const week of [7, 9, 11]) {
      for (const g of games.filter((g) => g.week === week)) {
        expect(confOf.get(g.awayTeamId)).toBe(confOf.get(g.homeTeamId));
        expect(divOf.get(g.awayTeamId)).not.toBe(divOf.get(g.homeTeamId));
      }
    }
  });
});

describe("fixed identity partners persist across seasons", () => {
  const teams = buildTeams();
  const fcsId = "FCS";

  it("keeps the same division/conference/rival opponents every season (only week/host rotates)", () => {
    const gamesBySeason = [1, 2, 3, 4, 5].map((s) => generateRegularSeasonSchedule(teams, fcsId, s));
    const opponentSetsBySeason = gamesBySeason.map((games) => {
      const byTeam = new Map<string, Set<string>>();
      for (const t of teams) byTeam.set(t.id, new Set());
      for (const g of games) {
        if (g.awayTeamId !== fcsId) byTeam.get(g.homeTeamId)?.add(g.awayTeamId);
        if (g.homeTeamId !== fcsId) byTeam.get(g.awayTeamId)?.add(g.homeTeamId);
      }
      return byTeam;
    });
    for (const t of teams) {
      const first = [...opponentSetsBySeason[0].get(t.id)!].sort();
      for (let s = 1; s < opponentSetsBySeason.length; s++) {
        // The 8 conference/division/rival opponents (everything except the 2
        // rank-seeded N-games) should be identical every season.
        const later = [...opponentSetsBySeason[s].get(t.id)!].sort();
        const overlap = first.filter((id) => later.includes(id));
        expect(overlap.length).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it("rotates which week each fixed matchup falls in across seasons", () => {
    const week1 = opponentsByWeek(generateRegularSeasonSchedule(teams, fcsId, 1), fcsId);
    const week2 = opponentsByWeek(generateRegularSeasonSchedule(teams, fcsId, 2), fcsId);
    const sampleTeam = teams[0].id;
    // Same opponent should show up, but not necessarily in the same week.
    const weeksSeasonA = [...week1.get(sampleTeam)!.entries()];
    const weeksSeasonB = [...week2.get(sampleTeam)!.entries()];
    expect(weeksSeasonA).not.toEqual(weeksSeasonB);
  });

  it("alternates home/away for a fixed pair by season parity", () => {
    const s1 = generateRegularSeasonSchedule(teams, fcsId, 1);
    const s2 = generateRegularSeasonSchedule(teams, fcsId, 2);
    const drGame1 = s1.find((g) => g.week === 12)!;
    const sameDrGame2 = s2.find(
      (g) =>
        g.week === 12 &&
        ((g.awayTeamId === drGame1.awayTeamId && g.homeTeamId === drGame1.homeTeamId) ||
          (g.awayTeamId === drGame1.homeTeamId && g.homeTeamId === drGame1.awayTeamId))
    )!;
    expect(sameDrGame2).toBeDefined();
    expect(sameDrGame2.homeTeamId).not.toBe(drGame1.homeTeamId);
  });
});

describe("rank-seeded non-conference games (weeks 3 & 5)", () => {
  const teams = buildTeams();
  const fcsId = "FCS";

  it("seeds team ranked Nth in their conference against another conference's Nth-ranked team", () => {
    const priorStandings: PriorStanding[] = [];
    for (const conf of CONFERENCES) {
      const confTeams = teams.filter((t) => t.conferenceCode === conf);
      confTeams.forEach((t, i) => priorStandings.push({ teamId: t.id, conferenceRank: i + 1 }));
    }
    const games = generateRegularSeasonSchedule(teams, fcsId, 1, priorStandings);
    const rankOf = new Map(priorStandings.map((s) => [s.teamId, s.conferenceRank]));
    const nGames = games.filter((g) => g.week === 3 || g.week === 5);
    expect(nGames.length).toBeGreaterThan(0);
    for (const g of nGames) {
      expect(rankOf.get(g.awayTeamId)).toBe(rankOf.get(g.homeTeamId));
    }
  });
});

describe("home/away balance", () => {
  const teams = buildTeams();
  const fcsId = "FCS";

  function maxConsecutiveHomeGames(games: { week: number; awayTeamId: string; homeTeamId: string }[], teamId: string) {
    const byWeek = games
      .filter((g) => g.awayTeamId === teamId || g.homeTeamId === teamId)
      .sort((a, b) => a.week - b.week);
    let max = 0;
    let run = 0;
    for (const g of byWeek) {
      if (g.homeTeamId === teamId) {
        run++;
        max = Math.max(max, run);
      } else {
        run = 0;
      }
    }
    return max;
  }

  it("never gives a team 6+ consecutive home games in a season (the reported bug)", () => {
    for (let season = 1; season <= 10; season++) {
      const games = generateRegularSeasonSchedule(teams, fcsId, season);
      for (const t of teams) {
        const streak = maxConsecutiveHomeGames(games, t.id);
        expect(streak).toBeLessThan(6);
      }
    }
  });

  it("keeps each team's total home-game count reasonably balanced across a season", () => {
    for (let season = 1; season <= 10; season++) {
      const games = generateRegularSeasonSchedule(teams, fcsId, season);
      for (const t of teams) {
        const homeCount = games.filter((g) => g.homeTeamId === t.id).length;
        // 12 games/season; FCS is always home, so a healthy split is roughly
        // 4-9 home games, not the 0/12 or 11/1 extremes the old per-pair
        // ID-comparison scheme could produce.
        expect(homeCount).toBeGreaterThanOrEqual(4);
        expect(homeCount).toBeLessThanOrEqual(9);
      }
    }
  });

  it("always plays the FCS cupcake game at home", () => {
    const games = generateRegularSeasonSchedule(teams, fcsId, 1);
    const fcsGames = games.filter((g) => g.awayTeamId === fcsId || g.homeTeamId === fcsId);
    expect(fcsGames.every((g) => g.awayTeamId === fcsId)).toBe(true);
  });

  it("gives each team exactly 1 home and 1 away rank-seeded (N) game per season", () => {
    const priorStandings: PriorStanding[] = [];
    for (const conf of CONFERENCES) {
      const confTeams = teams.filter((t) => t.conferenceCode === conf);
      confTeams.forEach((t, i) => priorStandings.push({ teamId: t.id, conferenceRank: i + 1 }));
    }
    for (let season = 1; season <= 6; season++) {
      const games = generateRegularSeasonSchedule(teams, fcsId, season, priorStandings);
      const nGames = games.filter((g) => g.week === 3 || g.week === 5);
      for (const t of teams) {
        const homeCount = nGames.filter((g) => g.homeTeamId === t.id).length;
        const awayCount = nGames.filter((g) => g.awayTeamId === t.id).length;
        expect(homeCount).toBe(1);
        expect(awayCount).toBe(1);
      }
    }
  });
});
