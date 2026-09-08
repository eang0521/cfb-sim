import { prisma } from "@/lib/db/client";
import { simulateGame } from "@/lib/sim/game";
import {
  buildFinal,
  buildFirstRound12,
  buildQuarterfinals,
  buildQuarterfinals12,
  buildSemifinals,
  buildSemifinals12,
  selectPlayoffField,
  selectPlayoffField12,
  type Seed,
} from "@/lib/sim/playoff";
import { updateTeamRecord } from "./teamRecord";
import { createBowlGames, BOWL_DATA_BY_RULESET } from "./bowls";
import { createConferenceChampionships, getConferenceChampionIds } from "./conferenceChampionships";
import { recomputeRankings } from "./simulateWeek";

const FIRST_ROUND_WEEK = 14; // MEGA144 only
const QF_WEEK = 15;
const SF_WEEK = 16;
const FINAL_WEEK = 17;

type GameRow = { id: string; awayTeamId: string; homeTeamId: string; awayScore: number | null; homeScore: number | null };

export interface PostseasonStepResult {
  round: string;
  stage: "scheduled" | "played";
  seasonComplete: boolean;
}

// Advances the postseason by exactly one step: creates the next unplayed
// round's games if they don't exist yet, otherwise simulates whichever round
// is currently pending. Call it repeatedly (mirroring "Simulate Week") until
// it reports the season complete.
//
// Order (CLASSIC, 6-team field): conference championships -> quarterfinals +
// every non-playoff bowl game together -> semifinals -> final.
// Order (MEGA144, 12-team field): conference championships -> first round
// (seeds 5-12) + every non-playoff bowl game together -> quarterfinals
// (seeds 1-4 join the first-round winners) -> semifinals -> final.
// Every postseason game is played at a neutral site.
export async function advancePostseason(seasonId: string): Promise<PostseasonStepResult> {
  const season = await prisma.season.findUniqueOrThrow({ where: { id: seasonId }, include: { dynasty: true } });
  if (season.status !== "POSTSEASON") {
    throw new Error(`Season is ${season.status}, not in the postseason.`);
  }

  const championships = await prisma.game.findMany({ where: { seasonId, round: "CONF_CHAMPIONSHIP" } });
  if (championships.length === 0) {
    await createConferenceChampionships(seasonId);
    return { round: "CONF_CHAMPIONSHIP", stage: "scheduled", seasonComplete: false };
  }
  if (championships.some((g) => !g.played)) {
    await simulateGames(championships.filter((g) => !g.played));
    // Re-rank off the championship results before the playoff field (which
    // reads national rank) and every later round's "entering rank" snapshot
    // are decided -- otherwise both would stay frozen at the week-12 order.
    await recomputeRankings(seasonId);
    return { round: "CONF_CHAMPIONSHIP", stage: "played", seasonComplete: false };
  }

  return season.dynasty.ruleset === "MEGA144" ? advancePlayoff12(seasonId) : advancePlayoff6(seasonId);
}

async function advancePlayoff6(seasonId: string): Promise<PostseasonStepResult> {
  const bowlData = BOWL_DATA_BY_RULESET.CLASSIC;
  const playoffGames = await prisma.game.findMany({
    where: { seasonId, round: { in: ["QUARTERFINAL", "SEMIFINAL", "FINAL", "BOWL"] } },
  });

  if (playoffGames.length === 0) {
    const seeds = await selectAndPersistSeeds(seasonId, 6);
    await createQuarterfinals(seasonId, seeds);
    await createBowlGames(seasonId, new Set(seeds.map((s) => s.teamId)), bowlData);
    return { round: "QUARTERFINAL", stage: "scheduled", seasonComplete: false };
  }

  const quarterfinals = playoffGames.filter((g) => g.round === "QUARTERFINAL");
  const bowls = playoffGames.filter((g) => g.round === "BOWL");
  const semifinals = playoffGames.filter((g) => g.round === "SEMIFINAL");
  const final = playoffGames.filter((g) => g.round === "FINAL");

  if (quarterfinals.some((g) => !g.played) || bowls.some((g) => !g.played)) {
    await simulateGames([...quarterfinals, ...bowls].filter((g) => !g.played));
    return { round: "QUARTERFINAL", stage: "played", seasonComplete: false };
  }
  if (semifinals.length === 0) {
    const seeds = await getPersistedSeeds(seasonId);
    await createSemifinals(seasonId, seeds, quarterfinals);
    return { round: "SEMIFINAL", stage: "scheduled", seasonComplete: false };
  }
  if (semifinals.some((g) => !g.played)) {
    await simulateGames(semifinals.filter((g) => !g.played));
    return { round: "SEMIFINAL", stage: "played", seasonComplete: false };
  }
  if (final.length === 0) {
    await createFinal(seasonId, semifinals);
    return { round: "FINAL", stage: "scheduled", seasonComplete: false };
  }
  if (final.some((g) => !g.played)) {
    await simulateGames(final.filter((g) => !g.played));
    await prisma.season.update({ where: { id: seasonId }, data: { status: "COMPLETE" } });
    return { round: "FINAL", stage: "played", seasonComplete: true };
  }

  return { round: "FINAL", stage: "played", seasonComplete: true };
}

async function advancePlayoff12(seasonId: string): Promise<PostseasonStepResult> {
  const bowlData = BOWL_DATA_BY_RULESET.MEGA144;
  const playoffGames = await prisma.game.findMany({
    where: { seasonId, round: { in: ["FIRST_ROUND", "QUARTERFINAL", "SEMIFINAL", "FINAL", "BOWL"] } },
  });

  if (playoffGames.length === 0) {
    const seeds = await selectAndPersistSeeds(seasonId, 12);
    await createFirstRound12(seasonId, seeds);
    await createBowlGames(seasonId, new Set(seeds.map((s) => s.teamId)), bowlData);
    return { round: "FIRST_ROUND", stage: "scheduled", seasonComplete: false };
  }

  const firstRound = playoffGames.filter((g) => g.round === "FIRST_ROUND");
  const bowls = playoffGames.filter((g) => g.round === "BOWL");
  const quarterfinals = playoffGames.filter((g) => g.round === "QUARTERFINAL");
  const semifinals = playoffGames.filter((g) => g.round === "SEMIFINAL");
  const final = playoffGames.filter((g) => g.round === "FINAL");

  if (firstRound.some((g) => !g.played) || bowls.some((g) => !g.played)) {
    await simulateGames([...firstRound, ...bowls].filter((g) => !g.played));
    return { round: "FIRST_ROUND", stage: "played", seasonComplete: false };
  }
  if (quarterfinals.length === 0) {
    const seeds = await getPersistedSeeds(seasonId);
    await createQuarterfinals12(seasonId, seeds, firstRound);
    return { round: "QUARTERFINAL", stage: "scheduled", seasonComplete: false };
  }
  if (quarterfinals.some((g) => !g.played)) {
    await simulateGames(quarterfinals.filter((g) => !g.played));
    return { round: "QUARTERFINAL", stage: "played", seasonComplete: false };
  }
  if (semifinals.length === 0) {
    await createSemifinals12(seasonId, quarterfinals);
    return { round: "SEMIFINAL", stage: "scheduled", seasonComplete: false };
  }
  if (semifinals.some((g) => !g.played)) {
    await simulateGames(semifinals.filter((g) => !g.played));
    return { round: "SEMIFINAL", stage: "played", seasonComplete: false };
  }
  if (final.length === 0) {
    await createFinal(seasonId, semifinals);
    return { round: "FINAL", stage: "scheduled", seasonComplete: false };
  }
  if (final.some((g) => !g.played)) {
    await simulateGames(final.filter((g) => !g.played));
    await prisma.season.update({ where: { id: seasonId }, data: { status: "COMPLETE" } });
    return { round: "FINAL", stage: "played", seasonComplete: true };
  }

  return { round: "FINAL", stage: "played", seasonComplete: true };
}

// The playoff field: for CLASSIC, top 3 conference champions by national
// rank auto-bid into a 6-team field; for MEGA144, top 6 auto-bid into a
// 12-team field. Either way the rest is at-large, and the whole field is
// re-seeded by national rank. Decided EXACTLY ONCE, right after
// championships, and persisted to TeamSeason.playoffSeed -- national rank
// keeps moving as the later rounds/bowls are played, so recomputing this
// later would silently swap teams in and out of a field that's supposed to
// already be locked in.
async function selectAndPersistSeeds(seasonId: string, fieldSize: 6 | 12): Promise<Seed[]> {
  const teamSeasons = await prisma.teamSeason.findMany({
    where: { seasonId },
    include: { team: true },
    orderBy: { powerElo: "desc" },
  });
  const realTeams = teamSeasons.filter((ts) => ts.team.name !== "FCS");
  const rankedTeams = realTeams.map((ts, i) => ({ teamId: ts.teamId, nationalRank: i + 1 }));
  const championIds = await getConferenceChampionIds(seasonId);
  const seeds = fieldSize === 12 ? selectPlayoffField12(rankedTeams, championIds) : selectPlayoffField(rankedTeams, championIds);

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

async function createSemifinals(seasonId: string, seeds: Seed[], quarterfinals: GameRow[]) {
  const seed1 = seeds.find((s) => s.seed === 1)!;
  const seed2 = seeds.find((s) => s.seed === 2)!;
  const seedByTeam = new Map(seeds.map((s) => [s.teamId, s]));

  const winnerOf = (g: GameRow): Seed => {
    const winnerId = g.awayScore! > g.homeScore! ? g.awayTeamId : g.homeTeamId;
    return seedByTeam.get(winnerId)!;
  };

  // `quarterfinals` comes from an unordered findMany, so it can't be trusted
  // to still be in [3v6, 4v5] creation order -- identify each game by its
  // lower seed (3 or 4, the only seeds that appear in exactly one game each)
  // instead of by array position.
  const winnerByLowSeed = new Map<number, Seed>();
  for (const g of quarterfinals) {
    const lowSeed = Math.min(seedByTeam.get(g.awayTeamId)!.seed, seedByTeam.get(g.homeTeamId)!.seed);
    winnerByLowSeed.set(lowSeed, winnerOf(g));
  }
  const qf1Winner = winnerByLowSeed.get(3)!;
  const qf2Winner = winnerByLowSeed.get(4)!;
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

async function createFirstRound12(seasonId: string, seeds: Seed[]) {
  const matchups = buildFirstRound12(seeds);
  await prisma.game.createMany({
    data: matchups.map(([away, home]) => ({
      seasonId,
      week: FIRST_ROUND_WEEK,
      round: "FIRST_ROUND",
      neutralSite: true,
      awayTeamId: away.teamId,
      homeTeamId: home.teamId,
    })),
  });
}

async function createQuarterfinals12(seasonId: string, seeds: Seed[], firstRound: GameRow[]) {
  const seedByTeam = new Map(seeds.map((s) => [s.teamId, s]));
  const winnerOf = (g: GameRow): Seed => {
    const winnerId = g.awayScore! > g.homeScore! ? g.awayTeamId : g.homeTeamId;
    return seedByTeam.get(winnerId)!;
  };
  // `firstRound` comes from an unordered findMany, so it can't be trusted to
  // still be in [5v12, 6v11, 7v10, 8v9] creation order -- identify each game
  // by its lower seed (5, 6, 7, or 8, each appearing in exactly one game)
  // instead of by array position.
  const winnerByLowSeed = new Map<number, Seed>();
  for (const g of firstRound) {
    const lowSeed = Math.min(seedByTeam.get(g.awayTeamId)!.seed, seedByTeam.get(g.homeTeamId)!.seed);
    winnerByLowSeed.set(lowSeed, winnerOf(g));
  }
  const winners: [Seed, Seed, Seed, Seed] = [
    winnerByLowSeed.get(5)!,
    winnerByLowSeed.get(6)!,
    winnerByLowSeed.get(7)!,
    winnerByLowSeed.get(8)!,
  ];
  const matchups = buildQuarterfinals12(seeds, winners);

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

async function createSemifinals12(seasonId: string, quarterfinals: GameRow[]) {
  // `quarterfinals` comes from an unordered findMany, so it can't be trusted
  // to still be in [1-side, 2-side, 3-side, 4-side] creation order --
  // identify each game by its bye seed (1, 2, 3, or 4: the seed-1-4 team is
  // always the lower seed in its quarterfinal, since every first-round
  // winner it could face has seed 5 or worse) instead of by array position.
  const seeds = await getPersistedSeeds(seasonId);
  const seedByTeam = new Map(seeds.map((s) => [s.teamId, s.seed]));
  const winnerOf = (g: GameRow): Seed => {
    const winnerId = g.awayScore! > g.homeScore! ? g.awayTeamId : g.homeTeamId;
    return { teamId: winnerId, seed: 0 };
  };
  const winnerByByeSeed = new Map<number, Seed>();
  for (const g of quarterfinals) {
    const byeSeed = Math.min(seedByTeam.get(g.awayTeamId)!, seedByTeam.get(g.homeTeamId)!);
    winnerByByeSeed.set(byeSeed, winnerOf(g));
  }
  const winners: [Seed, Seed, Seed, Seed] = [
    winnerByByeSeed.get(1)!,
    winnerByByeSeed.get(2)!,
    winnerByByeSeed.get(3)!,
    winnerByByeSeed.get(4)!,
  ];
  const matchups = buildSemifinals12(winners);

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

async function createFinal(seasonId: string, semifinals: GameRow[]) {
  const winnerId = (g: GameRow) => (g.awayScore! > g.homeScore! ? g.awayTeamId : g.homeTeamId);
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

// Bracket rounds (unlike conference championships and bowls) are seeded --
// the number that actually matters for these games is the persisted playoff
// seed, not the team's live national rank, which drifts as the postseason
// plays out and has no fixed relationship to seed anyway (the top-N
// conference-champion auto-bid rule means seed order isn't just rank order).
const BRACKET_ROUNDS = new Set(["FIRST_ROUND", "QUARTERFINAL", "SEMIFINAL", "FINAL"]);

async function simulateGames(games: (GameRow & { seasonId: string; round: string; neutralSite: boolean })[]) {
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

    const isBracketRound = BRACKET_ROUNDS.has(game.round);
    await prisma.game.update({
      where: { id: game.id },
      data: {
        awayScore: result.awayScore,
        homeScore: result.homeScore,
        otPeriods: result.otPeriods,
        eloChangeAway: result.eloChangeAway,
        eloChangeHome: result.eloChangeHome,
        played: true,
        awayRankEntering: (isBracketRound ? away.playoffSeed : away.rank) ?? null,
        homeRankEntering: (isBracketRound ? home.playoffSeed : home.rank) ?? null,
        awayWinsAfter: awayRecord?.wins ?? null,
        awayLossesAfter: awayRecord?.losses ?? null,
        homeWinsAfter: homeRecord?.wins ?? null,
        homeLossesAfter: homeRecord?.losses ?? null,
      },
    });
  }
}
