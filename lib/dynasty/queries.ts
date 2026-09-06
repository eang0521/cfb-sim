import { prisma } from "@/lib/db/client";

export interface StandingsSnapshot {
  rank: number | null;
  wins: number;
  losses: number;
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
  return new Map(standings.map((ts) => [ts.teamId, { rank: ts.rank, wins: ts.wins, losses: ts.losses }]));
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
  return prisma.player.findMany({
    where: { dynastyId, teamId },
    orderBy: [{ posGroup: "asc" }, { classYear: "asc" }, { ovr: "desc" }],
  });
}

// The offseason transaction log for the transition INTO `seasonNumber`
// (i.e. everyone who left/arrived to produce that season's rosters).
export async function getRosterMoves(dynastyId: string, seasonNumber: number) {
  return prisma.rosterMove.findMany({
    where: { dynastyId, seasonNumber },
    include: { fromTeam: true, toTeam: true },
    orderBy: [{ posGroup: "asc" }, { type: "asc" }, { ovr: "desc" }],
  });
}
