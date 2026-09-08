import { prisma } from "@/lib/db/client";
import { sortByPosGroup } from "@/lib/sim/roster";
import { FCS_TEAM_NAME } from "./fcsTeam";

export interface StandingsSnapshot {
  rank: number | null;
  playoffSeed: number | null;
  wins: number;
  losses: number;
  powerElo: number;
}

export async function getCurrentSeason(dynastyId: string) {
  const dynasty = await prisma.dynasty.findUniqueOrThrow({ where: { id: dynastyId } });
  const season = await prisma.season.findUniqueOrThrow({
    where: { dynastyId_number: { dynastyId, number: dynasty.currentSeasonNumber } },
  });
  return { dynasty, season };
}

export async function getStandings(seasonId: string) {
  const teamSeasons = await prisma.teamSeason.findMany({
    where: { seasonId },
    include: { team: { include: { conference: true, division: true } } },
    orderBy: { powerElo: "desc" },
  });
  return teamSeasons.filter((ts) => ts.team.name !== "FCS");
}

// A team-id -> {rank, wins, losses} snapshot of the CURRENT standings, used
// as the display fallback for games that haven't been played yet (see
// app/gameDisplay.ts).
export async function getStandingsSnapshotMap(seasonId: string): Promise<Map<string, StandingsSnapshot>> {
  const standings = await getStandings(seasonId);
  return new Map(
    standings.map((ts) => [
      ts.teamId,
      { rank: ts.rank, playoffSeed: ts.playoffSeed, wins: ts.wins, losses: ts.losses, powerElo: ts.powerElo },
    ])
  );
}

export async function getWeekGames(seasonId: string, week: number) {
  return prisma.game.findMany({
    where: { seasonId, week },
    include: { awayTeam: true, homeTeam: true },
    orderBy: { id: "asc" },
  });
}

// The postseason's "current" week: the earliest postseason week (>12) that
// still has an unplayed game, or the latest postseason week if everything's
// been played (i.e. the final result). Null if the postseason hasn't
// generated any games yet (right when it starts).
export async function getCurrentPostseasonWeek(seasonId: string): Promise<number | null> {
  const games = await prisma.game.findMany({
    where: { seasonId, week: { gt: 12 } },
    orderBy: { week: "asc" },
  });
  if (games.length === 0) return null;
  const pendingWeek = games.find((g) => !g.played)?.week;
  return pendingWeek ?? games[games.length - 1].week;
}

// The last week number that has any games at all for this season, so the
// week-navigation arrows know where to stop rather than paging into empty
// future postseason rounds that haven't been created yet.
export async function getMaxScheduledWeek(seasonId: string): Promise<number> {
  const result = await prisma.game.aggregate({ where: { seasonId }, _max: { week: true } });
  return result._max.week ?? 1;
}

export async function getAllGames(seasonId: string) {
  return prisma.game.findMany({
    where: { seasonId },
    include: { awayTeam: true, homeTeam: true },
    orderBy: [{ week: "asc" }, { id: "asc" }],
  });
}

export async function getTeamRoster(dynastyId: string, teamId: string) {
  const players = await prisma.player.findMany({ where: { dynastyId, teamId } });
  return sortByPosGroup(players);
}

// Every real player in the dynasty (current roster, all teams), for the
// Players database page -- excludes the synthetic FCS team, which has no
// meaningful roster of its own.
export async function getAllPlayers(dynastyId: string) {
  const players = await prisma.player.findMany({
    where: { dynastyId, team: { name: { not: FCS_TEAM_NAME } } },
    include: { team: true },
  });
  return sortByPosGroup(players);
}

// The offseason transaction log for the transition INTO `seasonNumber`
// (i.e. everyone who left/arrived to produce that season's rosters).
export async function getRosterMoves(dynastyId: string, seasonNumber: number) {
  const moves = await prisma.rosterMove.findMany({
    where: { dynastyId, seasonNumber },
    include: { fromTeam: true, toTeam: true },
    orderBy: [{ type: "asc" }, { ovr: "desc" }],
  });
  return sortByPosGroup(moves);
}

// Every season a team has played in this dynasty, with its starting
// prestige, offense/defense ratings, record, and how its postseason run
// ended (or "Missed Postseason" / "Season In Progress").
export async function getTeamHistory(dynastyId: string, teamId: string) {
  const seasons = await prisma.season.findMany({
    where: { dynastyId },
    orderBy: { number: "asc" },
  });

  const results = [];
  for (const season of seasons) {
    const teamSeason = await prisma.teamSeason.findUnique({
      where: { seasonId_teamId: { seasonId: season.id, teamId } },
    });
    if (!teamSeason) continue; // team didn't exist yet in this season (shouldn't normally happen)

    const hasSnapshot =
      (await prisma.playerSeasonSnapshot.count({
        where: { dynastyId, seasonNumber: season.number, teamId },
      })) > 0;

    results.push({
      seasonNumber: season.number,
      seasonStatus: season.status,
      startOfSeasonPrestige: teamSeason.prestige,
      offRating: teamSeason.offRating,
      defRating: teamSeason.defRating,
      wins: teamSeason.wins,
      losses: teamSeason.losses,
      confWins: teamSeason.confWins,
      confLosses: teamSeason.confLosses,
      finalRank: season.status === "COMPLETE" ? await getFinalRank(season.id, teamId) : null,
      resultLabel: await getSeasonResultLabel(season.id, teamId, season.status),
      hasRosterSnapshot: hasSnapshot,
    });
  }
  return results;
}

// A team's final national-power-rating rank once its season is COMPLETE.
// Computed fresh from powerElo (rather than trusting the live `rank` field)
// because `rank` is only ever recomputed through conference championships --
// nothing re-ranks after the playoff/bowls, so a champion's `rank` field can
// still read a pre-playoff number. powerElo itself keeps accumulating
// through every postseason game, so it's already correct once COMPLETE.
async function getFinalRank(seasonId: string, teamId: string): Promise<number | null> {
  const teamSeasons = await prisma.teamSeason.findMany({
    where: { seasonId },
    include: { team: true },
    orderBy: { powerElo: "desc" },
  });
  const realTeamSeasons = teamSeasons.filter((ts) => ts.team.name !== "FCS");
  const index = realTeamSeasons.findIndex((ts) => ts.teamId === teamId);
  return index === -1 ? null : index + 1;
}

async function getSeasonResultLabel(seasonId: string, teamId: string, seasonStatus: string): Promise<string> {
  if (seasonStatus !== "COMPLETE") return "Season In Progress";

  const postseasonGames = await prisma.game.findMany({
    where: {
      seasonId,
      round: { not: "REGULAR" },
      played: true,
      OR: [{ awayTeamId: teamId }, { homeTeamId: teamId }],
    },
  });

  const won = (g: (typeof postseasonGames)[number]) =>
    g.awayTeamId === teamId ? g.awayScore! > g.homeScore! : g.homeScore! > g.awayScore!;

  const final = postseasonGames.find((g) => g.round === "FINAL");
  if (final) return won(final) ? "Won National Championship" : "Lost National Championship";

  const semifinal = postseasonGames.find((g) => g.round === "SEMIFINAL");
  if (semifinal) return "Lost Playoff Semis";

  // QUARTERFINAL is the bracket's FIRST game in the 6-team CLASSIC field
  // (seeds 1-2 bye straight into the semis), but in MEGA144's 12-team field
  // it's a LATER round -- seeds 5-12 play an actual FIRST_ROUND first, and
  // even seeds 1-4's bye means their first bracket game IS the quarterfinal.
  // Whether "quarterfinal" means "first round" or not depends on whether
  // this SEASON's postseason has a FIRST_ROUND at all (MEGA144 only).
  const quarterfinal = postseasonGames.find((g) => g.round === "QUARTERFINAL");
  if (quarterfinal) {
    const hasFirstRound = (await prisma.game.count({ where: { seasonId, round: "FIRST_ROUND" } })) > 0;
    return hasFirstRound ? "Lost Playoff Quarterfinal" : "Lost Playoff First Round";
  }

  const firstRound = postseasonGames.find((g) => g.round === "FIRST_ROUND");
  if (firstRound) return "Lost Playoff First Round";

  const bowl = postseasonGames.find((g) => g.round === "BOWL");
  if (bowl) return `${won(bowl) ? "Won" : "Lost"} ${bowl.bowlName}`;

  const champ = postseasonGames.find((g) => g.round === "CONF_CHAMPIONSHIP");
  if (champ) return won(champ) ? "Won Conference Championship" : "Lost Conference Championship";

  return "Missed Postseason";
}

export async function getSeasonRosterSnapshot(dynastyId: string, teamId: string, seasonNumber: number) {
  const players = await prisma.playerSeasonSnapshot.findMany({
    where: { dynastyId, teamId, seasonNumber },
  });
  return sortByPosGroup(players);
}
