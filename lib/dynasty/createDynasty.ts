import { prisma } from "@/lib/db/client";
import { bootstrapInitialRoster, teamRatings } from "@/lib/sim/roster";
import { generateRegularSeasonSchedule, type PriorStanding, type ScheduleTeam } from "@/lib/sim/schedule";
import { getOrCreateFcsTeam } from "./fcsTeam";
import { recomputeRankings } from "./simulateWeek";

export async function createDynasty(name: string) {
  const teams = await prisma.team.findMany({ include: { conference: true, division: true } });
  const fcsTeam = await getOrCreateFcsTeam();

  const dynasty = await prisma.dynasty.create({
    data: { name, currentSeasonNumber: 1 },
  });

  const season = await prisma.season.create({
    data: { dynastyId: dynasty.id, number: 1, status: "IN_PROGRESS", currentWeek: 1 },
  });

  // No real "prior season" yet -- seed the rank-based non-conference games
  // off each team's initial (historical-strength-derived) prestige order
  // within its own conference.
  const realTeams = teams.filter((t) => t.id !== fcsTeam.id);
  const priorStandings: PriorStanding[] = Object.values(
    realTeams.reduce<Record<string, { teamId: string; prestige: number }[]>>((acc, t) => {
      (acc[t.conferenceId] ??= []).push({ teamId: t.id, prestige: scalePrestige(t.historicScore) });
      return acc;
    }, {})
  ).flatMap((confTeams) =>
    confTeams
      .sort((a, b) => b.prestige - a.prestige)
      .map((t, i) => ({ teamId: t.teamId, conferenceRank: i + 1 }))
  );

  for (const team of teams) {
    const roster = bootstrapInitialRoster(1);
    await prisma.player.createMany({
      data: roster.map((p) => ({
        dynastyId: dynasty.id,
        teamId: team.id,
        name: p.name,
        posGroup: p.posGroup,
        pos: p.pos,
        side: p.side,
        classYear: p.classYear,
        ovr: p.ovr,
        devTrait: p.devTrait,
        devMarker: p.devMarker,
        recruitedSeason: p.recruitedSeason,
      })),
    });

    const prestige = scalePrestige(team.historicScore);
    const ratings = teamRatings(roster, prestige);
    await prisma.teamSeason.create({
      data: {
        seasonId: season.id,
        teamId: team.id,
        prestige,
        offRating: ratings.offRating,
        defRating: ratings.defRating,
        totalRating: ratings.totalRating,
        rating: ratings.rating,
        powerElo: ratings.rating,
      },
    });
  }

  // Preseason rankings: with no games played yet, this ranks teams by their
  // initial (roster + prestige) power rating instead of leaving week 1 with
  // no rank at all, matching how a real preseason poll works.
  await recomputeRankings(season.id);

  const scheduleTeams: ScheduleTeam[] = realTeams.map((t) => ({
    id: t.id,
    name: t.name,
    conferenceCode: t.conference.code,
    divisionCode: t.division.code,
  }));
  const games = generateRegularSeasonSchedule(scheduleTeams, fcsTeam.id, 1, priorStandings);
  await prisma.game.createMany({
    data: games.map((g) => ({
      seasonId: season.id,
      week: g.week,
      awayTeamId: g.awayTeamId,
      homeTeamId: g.homeTeamId,
    })),
  });

  return dynasty;
}

// The workbook's historical `Score` inputs run ~2,000-50,000; the in-sim
// Prestige stat that actually feeds Rating is a small integer (~-15 to +30,
// see S2Teams.F). Map the historical score onto that scale for a new
// dynasty's day-1 prestige.
export function scalePrestige(historicScore: number): number {
  return Math.round((historicScore - 20000) / 1200);
}
