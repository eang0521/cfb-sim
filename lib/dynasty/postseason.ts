import { prisma } from "@/lib/db/client";
import { simulateGame } from "@/lib/sim/game";
import { buildFinal, buildQuarterfinals, buildSemifinals, selectPlayoffField, type Seed } from "@/lib/sim/playoff";
import { updateTeamRecord } from "./teamRecord";
import { createBowlGames } from "./bowls";
import { createConferenceChampionships, getConferenceChampionIds } from "./conferenceChampionships";
import { recomputeRankings } from "./simulateWeek";

const QF_WEEK = 15;
const SF_WEEK = 16;
const FINAL_WEEK = 17;

// Advances the postseason by exactly one step: creates the next unplayed
// round's games if they don't exist yet, otherwise simulates whichever round
// is currently pending. Call it repeatedly (mirroring "Simulate Week") until
// it reports the season complete.
//
// Order: conference championships -> (playoff field is selected from the
// results) -> quarterfinals + every non-playoff bowl game together (neither
// gates the other) -> semifinals -> final. Every postseason game is played
// at a neutral site (see lib/sim/game.ts's `neutralSite` flag).
export async function advancePostseason(seasonId: string) {
  const season = await prisma.season.findUniqueOrThrow({ where: { id: seasonId } });
  if (season.status !== "POSTSEASON") {
    throw new Error(`Season is ${season.status}, not in the postseason.`);
  }

  const championships = await prisma.game.findMany({ where: { seasonId, round: "CONF_CHAMPIONSHIP" } });
  if (championships.length === 0) {
    await createConferenceChampionships(seasonId);
    return { round: "CONF_CHAMPIONSHIP", stage: "scheduled" as const };
  }
  if (championships.some((g) => !g.played)) {
    await simulateGames(championships.filter((g) => !g.played));
    // Re-rank off the championship results before the playoff field (which
    // reads national rank) and every later round's "entering rank" snapshot
    // are decided -- otherwise both would stay frozen at the week-12 order.
    await recomputeRankings(seasonId);
    return { round: "CONF_CHAMPIONSHIP", stage: "played" as const };
  }

  const playoffGames = await prisma.game.findMany({
    where: { seasonId, round: { in: ["QUARTERFINAL", "SEMIFINAL", "FINAL", "BOWL"] } },
    include: { awayTeam: true, homeTeam: true },
  });

  if (playoffGames.length === 0) {
    const seeds = await selectAndPersistSeeds(seasonId);
    await createQuarterfinals(seasonId, seeds);
    await createBowlGames(seasonId, new Set(seeds.map((s) => s.teamId)));
    return { round: "QUARTERFINAL", stage: "scheduled" as const };
  }

  const quarterfinals = playoffGames.filter((g) => g.round === "QUARTERFINAL");
  const bowls = playoffGames.filter((g) => g.round === "BOWL");
  const semifinals = playoffGames.filter((g) => g.round === "SEMIFINAL");
  const final = playoffGames.filter((g) => g.round === "FINAL");

  if (quarterfinals.some((g) => !g.played) || bowls.some((g) => !g.played)) {
    await simulateGames([...quarterfinals, ...bowls].filter((g) => !g.played));
    return { round: "QUARTERFINAL", stage: "played" as const };
  }
  if (semifinals.length === 0) {
    const seeds = await getPersistedSeeds(seasonId);
    await createSemifinals(seasonId, seeds, quarterfinals);
    return { round: "SEMIFINAL", stage: "scheduled" as const };
  }
  if (semifinals.some((g) => !g.played)) {
    await simulateGames(semifinals.filter((g) => !g.played));
    return { round: "SEMIFINAL", stage: "played" as const };
  }
  if (final.length === 0) {
    await createFinal(seasonId, semifinals);
    return { round: "FINAL", stage: "scheduled" as const };
  }
  if (final.some((g) => !g.played)) {
    await simulateGames(final.filter((g) => !g.played));
    await prisma.season.update({ where: { id: seasonId }, data: { status: "COMPLETE" } });
    return { round: "FINAL", stage: "played" as const, seasonComplete: true };
  }

  return { round: "FINAL", stage: "played" as const, seasonComplete: true };
}

// The 6-team field: top 3 conference champions by national rank auto-bid,
// the rest at-large, re-seeded 1-6 by national rank. Decided EXACTLY ONCE,
// right after championships, and persisted to TeamSeason.playoffSeed --
// national rank keeps moving as the quarterfinals/semifinals/bowls are
// played, so recomputing this later would silently swap teams in and out of
// a field that's supposed to already be locked in.
async function selectAndPersistSeeds(seasonId: string): Promise<Seed[]> {
  const teamSeasons = await prisma.teamSeason.findMany({
    where: { seasonId },
    include: { team: true },
    orderBy: { powerElo: "desc" },
  });
  const realTeams = teamSeasons.filter((ts) => ts.team.name !== "FCS");
  const rankedTeams = realTeams.map((ts, i) => ({ teamId: ts.teamId, nationalRank: i + 1 }));
  const championIds = await getConferenceChampionIds(seasonId);
  const seeds = selectPlayoffField(rankedTeams, championIds);

  await prisma.$transaction(
    seeds.map((s) =>
      prisma.teamSeason.update({
        where: { seasonId_teamId: { seasonId, teamId: s.teamId } },
        data: { playoffSeed: s.seed },
      })
    )
  );

  return seeds;
}

async function getPersistedSeeds(seasonId: string): Promise<Seed[]> {
  const teamSeasons = await prisma.teamSeason.findMany({
    where: { seasonId, playoffSeed: { not: null } },
  });
  return teamSeasons.map((ts) => ({ teamId: ts.teamId, seed: ts.playoffSeed! }));
}

async function createQuarterfinals(seasonId: string, seeds: Seed[]) {
  const matchups = buildQuarterfinals(seeds);
  await prisma.game.createMany({
    data: matchups.map(([away, home]) => ({
      seasonId,
      week: QF_WEEK,
      round: "QUARTERFINAL",
      neutralSite: true,
      awayTeamId: away.teamId,
      homeTeamId: home.teamId,
    })),
  });
}

async function createSemifinals(
  seasonId: string,
  seeds: Seed[],
  quarterfinals: { awayTeamId: string; homeTeamId: string; awayScore: number | null; homeScore: number | null }[]
) {
  const seed1 = seeds.find((s) => s.seed === 1)!;
  const seed2 = seeds.find((s) => s.seed === 2)!;
  const seedByTeam = new Map(seeds.map((s) => [s.teamId, s]));

  const winnerOf = (g: (typeof quarterfinals)[number]): Seed => {
    const winnerId = g.awayScore! > g.homeScore! ? g.awayTeamId : g.homeTeamId;
    return seedByTeam.get(winnerId)!;
  };

  // quarterfinals[0] = 3v6, quarterfinals[1] = 4v5 (creation order in buildQuarterfinals)
  const qf1Winner = winnerOf(quarterfinals[0]);
  const qf2Winner = winnerOf(quarterfinals[1]);
  const matchups = buildSemifinals(seed1, seed2, qf1Winner, qf2Winner);

  await prisma.game.createMany({
    data: matchups.map(([away, home]) => ({
      seasonId,
      week: SF_WEEK,
      round: "SEMIFINAL",
      neutralSite: true,
      awayTeamId: away.teamId,
      homeTeamId: home.teamId,
    })),
  });
}

async function createFinal(
  seasonId: string,
  semifinals: { awayTeamId: string; homeTeamId: string; awayScore: number | null; homeScore: number | null }[]
) {
  const winnerId = (g: (typeof semifinals)[number]) => (g.awayScore! > g.homeScore! ? g.awayTeamId : g.homeTeamId);
  const [sf1, sf2] = semifinals;
  const [away, home] = buildFinal({ teamId: winnerId(sf1), seed: 0 }, { teamId: winnerId(sf2), seed: 0 });

  await prisma.game.create({
    data: {
      seasonId,
      week: FINAL_WEEK,
      round: "FINAL",
      neutralSite: true,
      awayTeamId: away.teamId,
      homeTeamId: home.teamId,
    },
  });
}

async function simulateGames(
  games: { id: string; seasonId: string; awayTeamId: string; homeTeamId: string; neutralSite: boolean }[]
) {
  for (const game of games) {
    const [away, home] = await Promise.all([
      prisma.teamSeason.findUniqueOrThrow({
        where: { seasonId_teamId: { seasonId: game.seasonId, teamId: game.awayTeamId } },
      }),
      prisma.teamSeason.findUniqueOrThrow({
        where: { seasonId_teamId: { seasonId: game.seasonId, teamId: game.homeTeamId } },
      }),
    ]);
    const result = simulateGame(away, home, Math.random, game.neutralSite);

    // Postseason games (conference championships, playoff rounds, bowls)
    // never count toward a team's conference record, even when both sides
    // are from the same conference.
    const isConferenceGame = false;
    const awayWon = result.awayScore > result.homeScore;
    const awayRecord = await updateTeamRecord(game.seasonId, game.awayTeamId, awayWon, isConferenceGame, result.eloChangeAway);
    const homeRecord = await updateTeamRecord(game.seasonId, game.homeTeamId, !awayWon, isConferenceGame, result.eloChangeHome);

    await prisma.game.update({
      where: { id: game.id },
      data: {
        awayScore: result.awayScore,
        homeScore: result.homeScore,
        otPeriods: result.otPeriods,
        eloChangeAway: result.eloChangeAway,
        eloChangeHome: result.eloChangeHome,
        played: true,
        awayRankEntering: away.rank ?? null,
        homeRankEntering: home.rank ?? null,
        awayWinsAfter: awayRecord?.wins ?? null,
        awayLossesAfter: awayRecord?.losses ?? null,
        homeWinsAfter: homeRecord?.wins ?? null,
        homeLossesAfter: homeRecord?.losses ?? null,
      },
    });
  }
}
