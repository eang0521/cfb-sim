import { prisma } from "@/lib/db/client";
import {
  BOWL_ELIGIBILITY_WINS,
  CONFERENCE_BOWLS,
  EXTRA_BOWL_NAMES,
  NATIONAL_BOWLS,
  type ConferenceBowlSpec,
  type NationalBowlSpec,
} from "@/lib/data/bowls";
import {
  CONFERENCE_BOWLS_144,
  EXTRA_BOWL_NAMES_144,
  GREEDY_NATIONAL_BOWLS_144,
  NATIONAL_BOWLS_144,
} from "@/lib/data/bowls144";
import { pairAvoidingSameConference } from "@/lib/sim/bowlPairing";

export interface BowlData {
  nationalBowls: NationalBowlSpec[];
  conferenceBowls: ConferenceBowlSpec[];
  extraBowlNames: string[];
  // Ordered national at-large bowl names filled greedily from the top of the
  // non-playoff bowl-eligible pool (by power rating): each name gets the
  // best remaining team plus the best remaining team NOT from its
  // conference, before conferenceBowls/extraBowlNames get a turn.
  greedyNationalBowls?: string[];
  // Names a bowl once extraBowlNames itself runs out (index is 0-based over
  // ALL leftover pairings, so this is only reached once index reaches
  // extraBowlNames.length). Defaults to the original "Bowl Game N" text.
  overflowLabel?: (index: number) => string;
}

export const BOWL_DATA_BY_RULESET: Record<string, BowlData> = {
  CLASSIC: { nationalBowls: NATIONAL_BOWLS, conferenceBowls: CONFERENCE_BOWLS, extraBowlNames: EXTRA_BOWL_NAMES },
  MEGA144: {
    nationalBowls: NATIONAL_BOWLS_144,
    conferenceBowls: CONFERENCE_BOWLS_144,
    extraBowlNames: EXTRA_BOWL_NAMES_144,
    greedyNationalBowls: GREEDY_NATIONAL_BOWLS_144,
    // The user's list totals 50 named bowls (4 greedy + 23 conference + 27
    // extra) -- anything beyond that is just numbered starting at 51.
    overflowLabel: (index) =>
      `Bowl ${GREEDY_NATIONAL_BOWLS_144.length + CONFERENCE_BOWLS_144.length + index + 1}`,
  },
};

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

// Every REGULAR-season result between two teams in this pool, keyed so
// either order looks up the same entry -- used to break conference-record
// ties for bowl seeding (see createBowlGames).
async function buildHeadToHeadMap(seasonId: string, teamIds: string[]): Promise<Map<string, string>> {
  const games = await prisma.game.findMany({
    where: { seasonId, round: "REGULAR", played: true, awayTeamId: { in: teamIds }, homeTeamId: { in: teamIds } },
  });
  const map = new Map<string, string>();
  for (const g of games) {
    const winner = g.awayScore! > g.homeScore! ? g.awayTeamId : g.homeTeamId;
    map.set(pairKey(g.awayTeamId, g.homeTeamId), winner);
  }
  return map;
}

export const BOWL_WEEK = 14; // same week as the playoff quarterfinals; standalone, no bracket advancement

// Creates every non-playoff bowl game this season, in order: rank-based
// national at-large bowls, conference-vs-conference seed bowls (a conference
// missing an eligible team at some seed just leaves that bowl unplayed --
// see the "orphans" handling below), greedy national at-large bowls
// (orphans get first priority here), then leftover teams paired off under
// the extra/overflow names -- see BowlData. Only bowl-eligible (6+ win)
// teams not already in the playoff are considered, except for the real NCAA
// "odd team out" rule: if an odd number of teams clear 6 wins, the single
// highest-rated team with fewer than 6 wins is added too, so pairings never
// leave a lone team stranded.
//
// `playoffTeamIds` must be the actual playoff field (see
// lib/sim/playoff.ts#selectPlayoffField) — NOT just "top N by rank", since
// the top-conference-champions auto-bid rule can swap in a lower-ranked
// team over a higher-ranked one.
export async function createBowlGames(seasonId: string, playoffTeamIds: Set<string>, bowlData: BowlData) {
  const { nationalBowls, conferenceBowls, extraBowlNames, greedyNationalBowls, overflowLabel } = bowlData;
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

  for (const bowl of nationalBowls) {
    const away = pool[bowl.ranks[0] - 1];
    const home = pool[bowl.ranks[1] - 1];
    if (!away || !home) continue;
    games.push({ bowlName: bowl.name, awayTeamId: away.teamId, homeTeamId: home.teamId });
    used.add(away.teamId);
    used.add(home.teamId);
  }

  const byConference = new Map<string, typeof pool>();
  for (const ts of pool) {
    if (used.has(ts.teamId)) continue;
    const code = ts.team.conference.code;
    if (!byConference.has(code)) byConference.set(code, []);
    byConference.get(code)!.push(ts);
  }
  // Conference-bowl seeding is by CONFERENCE record (not overall power
  // rating), ties broken by this season's head-to-head result and then by
  // power rating -- unlike "best team" below, which always means power
  // rating.
  const headToHeadWinner = await buildHeadToHeadMap(
    seasonId,
    pool.map((ts) => ts.teamId)
  );
  for (const teams of byConference.values()) {
    teams.sort((a, b) => {
      const diff = b.confWins - b.confLosses - (a.confWins - a.confLosses);
      if (diff !== 0) return diff;
      const winner = headToHeadWinner.get(pairKey(a.teamId, b.teamId));
      if (winner === a.teamId) return -1;
      if (winner === b.teamId) return 1;
      return b.powerElo - a.powerElo;
    });
  }

  // If a conference doesn't have an eligible team at the seed a bowl calls
  // for, that bowl's slot is left open rather than forcing a mismatch --
  // but whichever side DID have a team isn't wasted: it becomes an orphan
  // that gets first priority in the greedy at-large bowls below, ahead of
  // the general pool.
  const orphans: typeof pool = [];
  for (const bowl of conferenceBowls) {
    const awayTs = byConference.get(bowl.away.conference)?.[bowl.away.seed - 1];
    const homeTs = byConference.get(bowl.home.conference)?.[bowl.home.seed - 1];
    const awayAvailable = !!awayTs && !used.has(awayTs.teamId);
    const homeAvailable = !!homeTs && !used.has(homeTs.teamId);
    if (awayAvailable && homeAvailable) {
      games.push({ bowlName: bowl.name, awayTeamId: awayTs!.teamId, homeTeamId: homeTs!.teamId });
      used.add(awayTs!.teamId);
      used.add(homeTs!.teamId);
    } else {
      if (awayAvailable) orphans.push(awayTs!);
      if (homeAvailable) orphans.push(homeTs!);
    }
  }

  // Greedy national at-large bowls: "best team" here means power rating --
  // any orphan above is placed first (highest-rated orphan first), then the
  // best remaining team overall, each paired with the best remaining team
  // NOT from its conference, one bowl name at a time.
  const orphanQueue = orphans.slice().sort((a, b) => b.powerElo - a.powerElo);
  for (const bowlName of greedyNationalBowls ?? []) {
    const available = pool.filter((ts) => !used.has(ts.teamId));
    if (available.length < 2) break;
    let away = orphanQueue.shift();
    while (away && used.has(away.teamId)) away = orphanQueue.shift();
    away ??= available[0];
    const remaining = available.filter((ts) => ts.teamId !== away!.teamId);
    let homeIndex = remaining.findIndex((ts) => ts.team.conferenceId !== away!.team.conferenceId);
    if (homeIndex === -1) homeIndex = 0; // every remaining team shares its conference; unavoidable
    const home = remaining[homeIndex];
    if (!home) break;
    games.push({ bowlName, awayTeamId: away.teamId, homeTeamId: home.teamId });
    used.add(away.teamId);
    used.add(home.teamId);
  }

  // Everyone still bowl-eligible and unassigned (including any orphans past
  // the greedy bowls above) gets paired off in rank order, skipping
  // same-conference matchups (they just played all season).
  const leftover = pool.filter((ts) => !used.has(ts.teamId));
  pairAvoidingSameConference(leftover).forEach(([away, home], index) => {
    const bowlName = extraBowlNames[index] ?? overflowLabel?.(index) ?? `Bowl Game ${index + 1}`;
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
