import { prisma } from "@/lib/db/client";

export const CHAMPIONSHIP_WEEK = 13;

// One championship game per conference: each division's best conference
// record (ties broken by power rating) meet at a neutral site.
export async function createConferenceChampionships(seasonId: string) {
  const teamSeasons = await prisma.teamSeason.findMany({
    where: { seasonId },
    include: { team: { include: { conference: true, division: true } } },
  });
  const realTeams = teamSeasons.filter((ts) => ts.team.name !== "FCS");

  const byConference = new Map<string, typeof realTeams>();
  for (const ts of realTeams) {
    const code = ts.team.conference.code;
    if (!byConference.has(code)) byConference.set(code, []);
    byConference.get(code)!.push(ts);
  }

  const games: { awayTeamId: string; homeTeamId: string }[] = [];
  for (const confTeams of byConference.values()) {
    const byDivision = new Map<string, typeof confTeams>();
    for (const ts of confTeams) {
      const code = ts.team.division.code;
      if (!byDivision.has(code)) byDivision.set(code, []);
      byDivision.get(code)!.push(ts);
    }
    const divisions = [...byDivision.values()];
    if (divisions.length !== 2) continue;

    const divisionWinner = (divTeams: typeof confTeams) =>
      divTeams.slice().sort((a, b) => b.confWins - b.confLosses - (a.confWins - a.confLosses) || b.powerElo - a.powerElo)[0];

    const winnerA = divisionWinner(divisions[0]);
    const winnerB = divisionWinner(divisions[1]);
    games.push({ awayTeamId: winnerA.teamId, homeTeamId: winnerB.teamId });
  }

  await prisma.game.createMany({
    data: games.map((g) => ({
      seasonId,
      week: CHAMPIONSHIP_WEEK,
      round: "CONF_CHAMPIONSHIP",
      neutralSite: true,
      awayTeamId: g.awayTeamId,
      homeTeamId: g.homeTeamId,
    })),
  });

  return games.length;
}

export async function getConferenceChampionIds(seasonId: string): Promise<string[]> {
  const games = await prisma.game.findMany({
    where: { seasonId, round: "CONF_CHAMPIONSHIP", played: true },
  });
  return games.map((g) => (g.awayScore! > g.homeScore! ? g.awayTeamId : g.homeTeamId));
}
