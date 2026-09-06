import { prisma } from "@/lib/db/client";
import { simulateGame } from "@/lib/sim/game";
import { FCS_TEAM_NAME, rollFcsRating } from "./fcsTeam";
import { updateTeamRecord } from "./teamRecord";

const REGULAR_SEASON_WEEKS = 12;

export async function simulateWeek(seasonId: string) {
  const season = await prisma.season.findUniqueOrThrow({ where: { id: seasonId } });
  if (season.status !== "IN_PROGRESS") {
    throw new Error(`Season is ${season.status}, can't simulate a regular-season week.`);
  }

  const week = season.currentWeek;
  const games = await prisma.game.findMany({
    where: { seasonId, week, played: false },
    include: {
      awayTeam: true,
      homeTeam: true,
    },
  });

  const teamSeasons = await prisma.teamSeason.findMany({ where: { seasonId } });
  const teamSeasonByTeamId = new Map(teamSeasons.map((ts) => [ts.teamId, ts]));

  for (const game of games) {
    const awayRatings =
      game.awayTeam.name === FCS_TEAM_NAME
        ? rollFcsRating()
        : teamSeasonByTeamId.get(game.awayTeamId)!;
    const homeRatings =
      game.homeTeam.name === FCS_TEAM_NAME
        ? rollFcsRating()
        : teamSeasonByTeamId.get(game.homeTeamId)!;

    const result = simulateGame(awayRatings, homeRatings);

    const isConferenceGame =
      game.awayTeam.name !== FCS_TEAM_NAME &&
      game.homeTeam.name !== FCS_TEAM_NAME &&
      game.awayTeam.conferenceId === game.homeTeam.conferenceId;
    const awayWon = result.awayScore > result.homeScore;

    // Snapshot each side's rank as it stood BEFORE this week's results were
    // applied ("entering the week"), since the live `rank` field keeps
    // moving in later weeks and can't be recovered from current standings.
    const awayRankEntering = teamSeasonByTeamId.get(game.awayTeamId)?.rank ?? null;
    const homeRankEntering = teamSeasonByTeamId.get(game.homeTeamId)?.rank ?? null;

    const awayRecord = await updateTeamRecord(seasonId, game.awayTeamId, awayWon, isConferenceGame, result.eloChangeAway);
    const homeRecord = await updateTeamRecord(seasonId, game.homeTeamId, !awayWon, isConferenceGame, result.eloChangeHome);

    await prisma.game.update({
      where: { id: game.id },
      data: {
        awayScore: result.awayScore,
        homeScore: result.homeScore,
        otPeriods: result.otPeriods,
        eloChangeAway: result.eloChangeAway,
        eloChangeHome: result.eloChangeHome,
        played: true,
        awayRankEntering,
        homeRankEntering,
        awayWinsAfter: awayRecord?.wins ?? null,
        awayLossesAfter: awayRecord?.losses ?? null,
        homeWinsAfter: homeRecord?.wins ?? null,
        homeLossesAfter: homeRecord?.losses ?? null,
      },
    });
  }

  await recomputeRankings(seasonId);

  const isLastRegularWeek = week >= REGULAR_SEASON_WEEKS;
  await prisma.season.update({
    where: { id: seasonId },
    data: isLastRegularWeek
      ? { status: "POSTSEASON" }
      : { currentWeek: week + 1 },
  });

  return { week, gamesPlayed: games.length, seasonComplete: isLastRegularWeek };
}

export async function recomputeRankings(seasonId: string) {
  const teamSeasons = await prisma.teamSeason.findMany({
    where: { seasonId },
    orderBy: { powerElo: "desc" },
  });
  await prisma.$transaction(
    teamSeasons.map((ts, index) =>
      prisma.teamSeason.update({ where: { id: ts.id }, data: { rank: index + 1 } })
    )
  );
}
