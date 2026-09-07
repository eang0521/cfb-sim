import { prisma } from "@/lib/db/client";
import type { ConfRecord144, Schedule144Input } from "@/lib/sim/schedule144";

const DIVISION_OR_CONFERENCE_WEEKS = [4, 6, 7, 8, 9, 10, 11, 12];

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

// Builds the historical inputs the MEGA144 schedule generator needs for a
// season AFTER season 1 (which has no prior history at all -- see
// createDynasty.ts for that simpler case).
export async function buildSchedule144Input(
  dynastyId: string,
  justCompletedSeasonId: string,
  realTeams: { id: string; startingPrestige: number | null }[],
  currentSeasonPrestigeByTeamId: Map<string, number>
): Promise<Schedule144Input> {
  // Last season's conference record + powerElo, for the within-conference
  // ranking that decides weeks 1/3/5's rank-vs-rank pairing.
  const lastSeasonTeamSeasons = await prisma.teamSeason.findMany({ where: { seasonId: justCompletedSeasonId } });
  const priorConfRecord = new Map<string, ConfRecord144>();
  for (const ts of lastSeasonTeamSeasons) {
    priorConfRecord.set(ts.teamId, { confWins: ts.confWins, confLosses: ts.confLosses, powerElo: ts.powerElo });
  }

  // Last season's conference-play head-to-head results (division +
  // non-division conference games only), for the ranking tiebreak.
  const lastSeasonConfGames = await prisma.game.findMany({
    where: { seasonId: justCompletedSeasonId, round: "REGULAR", week: { in: DIVISION_OR_CONFERENCE_WEEKS }, played: true },
  });
  const priorHeadToHead = new Map<string, string>();
  for (const g of lastSeasonConfGames) {
    const winnerId = g.awayScore! > g.homeScore! ? g.awayTeamId : g.homeTeamId;
    priorHeadToHead.set(pairKey(g.awayTeamId, g.homeTeamId), winnerId);
  }

  // The most recent PAST division/conference meeting's host for every team
  // pair, across this dynasty's WHOLE history (not just last season) --
  // biases host alternation. Processed oldest-to-newest so the most recent
  // meeting is what survives in the map.
  const allConfGames = await prisma.game.findMany({
    where: { round: "REGULAR", week: { in: DIVISION_OR_CONFERENCE_WEEKS }, played: true, season: { dynastyId } },
    include: { season: true },
    orderBy: { season: { number: "asc" } },
  });
  const priorMeetingHost = new Map<string, string>();
  for (const g of allConfGames) {
    priorMeetingHost.set(pairKey(g.awayTeamId, g.homeTeamId), g.homeTeamId);
  }

  // Career week-5 home-game count per conference, across this dynasty's
  // whole history -- the fewest-hosts-so-far conference gets the home game
  // next time it's paired in week 5.
  const allWeek5Games = await prisma.game.findMany({
    where: { round: "REGULAR", week: 5, played: true, season: { dynastyId } },
    include: { homeTeam: { include: { conference: true } } },
  });
  const week5HistoricalHostCounts = new Map<string, number>();
  for (const g of allWeek5Games) {
    const code = g.homeTeam.conference.code;
    week5HistoricalHostCounts.set(code, (week5HistoricalHostCounts.get(code) ?? 0) + 1);
  }

  return {
    priorConfRecord,
    priorHeadToHead,
    startingPrestige: new Map(realTeams.map((t) => [t.id, t.startingPrestige ?? 0])),
    currentSeasonPrestige: currentSeasonPrestigeByTeamId,
    priorMeetingHost,
    week5HistoricalHostCounts,
  };
}
