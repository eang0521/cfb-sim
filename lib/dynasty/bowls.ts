import { prisma } from "@/lib/db/client";
import { BOWL_ELIGIBILITY_WINS, CONFERENCE_BOWLS, EXTRA_BOWL_NAMES, NATIONAL_BOWLS } from "@/lib/data/bowls";
import { pairAvoidingSameConference } from "@/lib/sim/bowlPairing";

export const BOWL_WEEK = 14; // same week as the playoff quarterfinals; standalone, no bracket advancement

// Creates every non-playoff bowl game this season: the 2 national at-large
// bowls for teams ranked just outside the 6-team playoff, plus the 12
// conference-vs-conference seed bowls. Only bowl-eligible (6+ win) teams not
// already in the playoff are considered, matching the workbook's `List of
// Bowls` sheet (only rows with an actual rule are ported — see lib/data/bowls.ts) —
// except for the real NCAA "odd team out" rule: if an odd number of teams
// clear 6 wins, the single highest-ranked team with fewer than 6 wins is
// added too, so pairings never leave a lone team stranded.
//
// `playoffTeamIds` must be the actual 6-team field (see
// lib/sim/playoff.ts#selectPlayoffField) — NOT just "top 6 by rank", since
// the top-3-conference-champions auto-bid rule can swap in a lower-ranked
// team over a higher-ranked one.
export async function createBowlGames(seasonId: string, playoffTeamIds: Set<string>) {
  const teamSeasons = await prisma.teamSeason.findMany({
    where: { seasonId },
    include: { team: { include: { conference: true } } },
    orderBy: { powerElo: "desc" },
  });
  const realTeams = teamSeasons.filter((ts) => ts.team.name !== "FCS");
  const nonPlayoffTeams = realTeams.filter((ts) => !playoffTeamIds.has(ts.teamId));

  const eligibleIds = new Set(
    nonPlayoffTeams.filter((ts) => ts.wins >= BOWL_ELIGIBILITY_WINS).map((ts) => ts.teamId)
  );
  if (eligibleIds.size % 2 !== 0) {
    const exception = nonPlayoffTeams.find((ts) => !eligibleIds.has(ts.teamId));
    if (exception) eligibleIds.add(exception.teamId);
  }
  // nonPlayoffTeams is already sorted by powerElo desc, so filtering it
  // preserves correct national/conference rank order including the exception.
  const pool = nonPlayoffTeams.filter((ts) => eligibleIds.has(ts.teamId));
  const used = new Set<string>();

  const games: { bowlName: string; awayTeamId: string; homeTeamId: string }[] = [];

  for (const bowl of NATIONAL_BOWLS) {
    const away = pool[bowl.ranks[0] - 1];
    const home = pool[bowl.ranks[1] - 1];
    if (!away || !home) continue;
    games.push({ bowlName: bowl.name, awayTeamId: away.teamId, homeTeamId: home.teamId });
    used.add(away.teamId);
    used.add(home.teamId);
  }

  const remainingByConference = new Map<string, typeof pool>();
  for (const ts of pool) {
    if (used.has(ts.teamId)) continue;
    const code = ts.team.conference.code;
    if (!remainingByConference.has(code)) remainingByConference.set(code, []);
    remainingByConference.get(code)!.push(ts);
  }
  // already sorted by powerElo desc from the query, so index = seed - 1

  for (const bowl of CONFERENCE_BOWLS) {
    const awayTs = remainingByConference.get(bowl.away.conference)?.[bowl.away.seed - 1];
    const homeTs = remainingByConference.get(bowl.home.conference)?.[bowl.home.seed - 1];
    if (!awayTs || !homeTs || used.has(awayTs.teamId) || used.has(homeTs.teamId)) continue;
    games.push({ bowlName: bowl.name, awayTeamId: awayTs.teamId, homeTeamId: homeTs.teamId });
    used.add(awayTs.teamId);
    used.add(homeTs.teamId);
  }

  // Everyone still bowl-eligible and unassigned gets paired off in rank
  // order, skipping same-conference matchups (they just played all season).
  const leftover = pool.filter((ts) => !used.has(ts.teamId));
  pairAvoidingSameConference(leftover).forEach(([away, home], index) => {
    const bowlName = EXTRA_BOWL_NAMES[index] ?? `Bowl Game ${index + 1}`;
    games.push({ bowlName, awayTeamId: away.teamId, homeTeamId: home.teamId });
  });

  if (games.length > 0) {
    await prisma.game.createMany({
      data: games.map((g) => ({
        seasonId,
        week: BOWL_WEEK,
        round: "BOWL",
        neutralSite: true,
        bowlName: g.bowlName,
        awayTeamId: g.awayTeamId,
        homeTeamId: g.homeTeamId,
      })),
    });
  }

  return games.length;
}
