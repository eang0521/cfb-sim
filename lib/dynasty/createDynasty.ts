import { prisma } from "@/lib/db/client";
import type { Rand } from "@/lib/sim/rng";
import { normal } from "@/lib/sim/rng";
import { bootstrapDynastyRosters, bootstrapInitialRoster, teamRatings } from "@/lib/sim/roster";
import { generateRegularSeasonSchedule, type PriorStanding } from "@/lib/sim/schedule";
import { generateRegularSeasonSchedule144, type ScheduleTeam144 } from "@/lib/sim/schedule144";
import { getOrCreateFcsTeam } from "./fcsTeam";
import { recomputeRankings } from "./simulateWeek";

export type Ruleset = "CLASSIC" | "MEGA144";

export async function createDynasty(name: string, ruleset: Ruleset, ownerId: string, rand: Rand = Math.random) {
  const teams = await prisma.team.findMany({ where: { ruleset }, include: { conference: true, division: true } });
  const fcsTeam = await getOrCreateFcsTeam(ruleset);

  const dynasty = await prisma.dynasty.create({
    data: { name, ruleset, currentSeasonNumber: 1, ownerId },
  });

  const season = await prisma.season.create({
    data: { dynastyId: dynasty.id, number: 1, status: "IN_PROGRESS", currentWeek: 1 },
  });

  const realTeams = teams.filter((t) => t.id !== fcsTeam.id);

  // No real "prior season" yet -- seed the rank-based non-conference games
  // off each team's initial (historical-strength-derived, or given-directly
  // for MEGA144) prestige order within its own conference. Every new
  // league's starting prestige also gets its own one-time Normal(0, 4)
  // jitter (rounded to the nearest integer) on top of that base value, so
  // two dynasties never start with identically-ranked teams -- computed
  // once here and reused everywhere below (roster generation, the
  // persisted TeamSeason row, and the schedule input) instead of being
  // re-derived, which would otherwise apply a DIFFERENT random jitter in
  // each place.
  const startingPrestigeByTeamId = new Map<string, number>(
    realTeams.map((t) => {
      const base = ruleset === "MEGA144" ? (t.startingPrestige ?? 0) : scalePrestige(t.historicScore ?? 0);
      return [t.id, base + Math.round(normal(0, 4, rand))];
    })
  );
  const priorStandings: PriorStanding[] = Object.values(
    realTeams.reduce<Record<string, { teamId: string; prestige: number }[]>>((acc, t) => {
      (acc[t.conferenceId] ??= []).push({ teamId: t.id, prestige: startingPrestigeByTeamId.get(t.id)! });
      return acc;
    }, {})
  ).flatMap((confTeams) =>
    confTeams
      .sort((a, b) => b.prestige - a.prestige)
      .map((t, i) => ({ teamId: t.teamId, conferenceRank: i + 1 }))
  );

  // Every real team's initial roster, assigned together as one
  // prestige-driven market (see bootstrapDynastyRosters) rather than each
  // team rolling independently.
  const rosterByTeamId = bootstrapDynastyRosters(
    realTeams.map((t) => ({ teamId: t.id, prestige: startingPrestigeByTeamId.get(t.id)! })),
    1
  );

  for (const team of teams) {
    const roster = team.id === fcsTeam.id ? bootstrapInitialRoster(1) : rosterByTeamId.get(team.id)!;
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
    await prisma.playerSeasonSnapshot.createMany({
      data: roster.map((p) => ({
        dynastyId: dynasty.id,
        seasonNumber: 1,
        teamId: team.id,
        playerName: p.name,
        posGroup: p.posGroup,
        pos: p.pos,
        side: p.side,
        classYear: p.classYear,
        ovr: p.ovr,
        devTrait: p.devTrait,
        devMarker: p.devMarker,
      })),
    });

    const prestige = team.id === fcsTeam.id ? 0 : startingPrestigeByTeamId.get(team.id)!;
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

  // `rivalrySlot` is MEGA144-only (null for CLASSIC teams, harmlessly
  // defaulted here since CLASSIC's own schedule generator never reads it).
  const scheduleTeams: ScheduleTeam144[] = realTeams.map((t) => ({
    id: t.id,
    name: t.name,
    conferenceCode: t.conference.code,
    divisionCode: t.division.code,
    rivalrySlot: t.rivalrySlot ?? 0,
  }));

  const games =
    ruleset === "MEGA144"
      ? generateRegularSeasonSchedule144(scheduleTeams, fcsTeam.id, 1, {
          priorConfRecord: new Map(),
          priorHeadToHead: new Map(),
          startingPrestige: startingPrestigeByTeamId,
          currentSeasonPrestige: startingPrestigeByTeamId,
          week5HistoricalHostCounts: new Map(),
        })
      : generateRegularSeasonSchedule(scheduleTeams, fcsTeam.id, 1, priorStandings);

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
// dynasty's day-1 prestige. CLASSIC only -- MEGA144 gives Prestige directly.
export function scalePrestige(historicScore: number): number {
  return Math.round((historicScore - 20000) / 1200);
}
