import { prisma } from "@/lib/db/client";
import {
  agePlayer,
  isEarlyDeparture,
  isGraduating,
  rollEntersTransferPortal,
  teamRatings,
  type PosGroup,
  type RosterPlayer,
} from "@/lib/sim/roster";
import { runPositionMarket, type TeamNeed, type TransferCandidate } from "@/lib/sim/recruiting";
import { CONFERENCE_RANK_BONUS_MEGA144, rankConferencesByWins, updatePrestige } from "@/lib/sim/prestige";
import { generateRegularSeasonSchedule, type PriorStanding, type ScheduleTeam } from "@/lib/sim/schedule";
import { generateRegularSeasonSchedule144 } from "@/lib/sim/schedule144";
import { getOrCreateFcsTeam } from "./fcsTeam";
import { recomputeRankings } from "./simulateWeek";
import { buildSchedule144Input } from "./schedule144Data";

const POS_GROUPS: PosGroup[] = ["QB", "UT", "OL", "DL", "LB", "DB"];

interface Departure {
  teamId: string;
  posGroup: PosGroup;
  player: RosterPlayer;
  type: "GRADUATED" | "EARLY_DEPARTURE" | "TRANSFER";
}

function toRosterPlayer(row: {
  name: string;
  posGroup: string;
  pos: string;
  side: string;
  classYear: string;
  ovr: number;
  devTrait: number;
  devMarker: string;
  recruitedSeason: number;
}): RosterPlayer {
  return {
    name: row.name,
    posGroup: row.posGroup as PosGroup,
    pos: row.pos,
    side: row.side as RosterPlayer["side"],
    classYear: row.classYear as RosterPlayer["classYear"],
    ovr: row.ovr,
    devTrait: row.devTrait,
    devMarker: row.devMarker as RosterPlayer["devMarker"],
    recruitedSeason: row.recruitedSeason,
  };
}

// Runs the full offseason transition for a just-completed season:
//
// 1. Updates every team's Prestige (lib/sim/prestige.ts).
// 2. Decides each of the 6 rostered players' fate: a senior graduates, a
//    junior Star (dev=3) declares early, everyone else has a 1/6 shot of
//    entering the transfer portal -- anyone not leaving just ages in place.
// 3. Runs the transfer-portal/recruiting market per position group
//    (lib/sim/recruiting.ts) to fill every opening created above, and logs
//    every departure/transfer/incoming-freshman to `RosterMove` for the
//    offseason report.
// 4. Recomputes ratings and stands up next season's schedule.
export async function runOffseason(dynastyId: string) {
  const dynasty = await prisma.dynasty.findUniqueOrThrow({ where: { id: dynastyId } });
  const season = await prisma.season.findUniqueOrThrow({
    where: { dynastyId_number: { dynastyId, number: dynasty.currentSeasonNumber } },
  });
  if (season.status !== "COMPLETE") {
    throw new Error("Season must be COMPLETE (regular season + postseason both played) before running the offseason.");
  }

  const ruleset = dynasty.ruleset;
  const teams = await prisma.team.findMany({ where: { ruleset }, include: { conference: true, division: true } });
  const fcsTeam = await getOrCreateFcsTeam(ruleset);
  const realTeams = teams.filter((t) => t.id !== fcsTeam.id);

  const teamSeasons = await prisma.teamSeason.findMany({ where: { seasonId: season.id } });
  const teamSeasonByTeamId = new Map(teamSeasons.map((ts) => [ts.teamId, ts]));

  // 1. Prestige update -- the NEW prestige is what feeds Team Value in the
  // recruiting market below (a program's current standing drives its pull).
  const conferenceStats: Record<string, { totalWins: number; totalOldPrestige: number }> = {};
  for (const conf of new Set(realTeams.map((t) => t.conferenceId))) {
    const confTeamSeasons = realTeams
      .filter((t) => t.conferenceId === conf)
      .map((t) => teamSeasonByTeamId.get(t.id)!)
      .filter(Boolean);
    conferenceStats[conf] = {
      totalWins: confTeamSeasons.reduce((sum, ts) => sum + ts.wins, 0),
      totalOldPrestige: confTeamSeasons.reduce((sum, ts) => sum + ts.prestige, 0),
    };
  }
  const conferenceRanks = rankConferencesByWins(conferenceStats);

  const conferenceRankBonusTable = ruleset === "MEGA144" ? CONFERENCE_RANK_BONUS_MEGA144 : undefined;
  const newPrestigeByTeamId = new Map<string, number>();
  for (const team of realTeams) {
    const teamSeason = teamSeasonByTeamId.get(team.id)!;
    newPrestigeByTeamId.set(
      team.id,
      updatePrestige(
        {
          currentPrestige: teamSeason.prestige,
          totalWins: teamSeason.wins,
          totalLosses: teamSeason.losses,
          conferenceRank: conferenceRanks[team.conferenceId],
        },
        Math.random,
        conferenceRankBonusTable
      )
    );
  }

  // Next season's rank-seeded non-conference games, off THIS season's final
  // standing within each team's own conference.
  const priorStandings: PriorStanding[] = Object.values(
    realTeams.reduce<Record<string, { teamId: string; powerElo: number }[]>>((acc, t) => {
      const ts = teamSeasonByTeamId.get(t.id);
      if (ts) (acc[t.conferenceId] ??= []).push({ teamId: t.id, powerElo: ts.powerElo });
      return acc;
    }, {})
  ).flatMap((confTeams) =>
    confTeams.sort((a, b) => b.powerElo - a.powerElo).map((t, i) => ({ teamId: t.teamId, conferenceRank: i + 1 }))
  );

  const nextSeasonNumber = dynasty.currentSeasonNumber + 1;
  const nextSeason = await prisma.season.create({
    data: { dynastyId, number: nextSeasonNumber, status: "IN_PROGRESS", currentWeek: 1 },
  });

  // 2. Decide every existing player's fate.
  const allPlayers = await prisma.player.findMany({ where: { dynastyId } });
  const departures: Departure[] = [];

  for (const row of allPlayers) {
    const current = toRosterPlayer(row);

    if (isGraduating(current)) {
      departures.push({ teamId: row.teamId, posGroup: current.posGroup, player: current, type: "GRADUATED" });
    } else if (isEarlyDeparture(current)) {
      departures.push({ teamId: row.teamId, posGroup: current.posGroup, player: current, type: "EARLY_DEPARTURE" });
    } else if (rollEntersTransferPortal()) {
      departures.push({ teamId: row.teamId, posGroup: current.posGroup, player: current, type: "TRANSFER" });
    } else {
      const aged = agePlayer(current)!; // never null here -- not graduating
      await prisma.player.update({
        where: { id: row.id },
        data: { classYear: aged.classYear, ovr: aged.ovr, devTrait: aged.devTrait, devMarker: aged.devMarker },
      });
    }
  }

  // 3. Run the transfer-portal/recruiting market per position group.
  const rosterMoveRows: {
    dynastyId: string;
    seasonNumber: number;
    type: string;
    posGroup: string;
    playerName: string;
    ovr: number;
    devTrait: number;
    fromTeamId: string | null;
    toTeamId: string | null;
  }[] = [];

  for (const posGroup of POS_GROUPS) {
    const groupDepartures = departures.filter((d) => d.posGroup === posGroup);

    for (const d of groupDepartures) {
      if (d.type !== "TRANSFER") {
        rosterMoveRows.push({
          dynastyId,
          seasonNumber: nextSeasonNumber,
          type: d.type,
          posGroup,
          playerName: d.player.name,
          ovr: d.player.ovr,
          devTrait: d.player.devTrait,
          fromTeamId: d.teamId,
          toTeamId: null,
        });
      }
    }

    const teamsNeeding: TeamNeed[] = groupDepartures.map((d) => ({
      teamId: d.teamId,
      prestige: newPrestigeByTeamId.get(d.teamId)!,
    }));
    const transferCandidates: TransferCandidate[] = groupDepartures
      .filter((d) => d.type === "TRANSFER")
      .map((d) => ({ teamId: d.teamId, player: d.player }));
    const hsRecruitCount = groupDepartures.filter((d) => d.type !== "TRANSFER").length;

    const assignments = runPositionMarket(posGroup, nextSeasonNumber, teamsNeeding, transferCandidates, hsRecruitCount);

    for (const a of assignments) {
      const destRow = allPlayers.find((p) => p.teamId === a.teamId && p.posGroup === posGroup)!;
      await prisma.player.update({
        where: { id: destRow.id },
        data: {
          name: a.player.name,
          pos: a.player.pos,
          classYear: a.player.classYear,
          ovr: a.player.ovr,
          devTrait: a.player.devTrait,
          devMarker: a.player.devMarker,
          recruitedSeason: a.player.recruitedSeason,
        },
      });
      rosterMoveRows.push({
        dynastyId,
        seasonNumber: nextSeasonNumber,
        type: a.source === "TRANSFER" ? "TRANSFER" : "FRESHMAN",
        posGroup,
        playerName: a.player.name,
        ovr: a.rankedOvr,
        devTrait: a.player.devTrait,
        fromTeamId: a.fromTeamId,
        toTeamId: a.teamId,
      });
    }
  }

  if (rosterMoveRows.length > 0) {
    await prisma.rosterMove.createMany({ data: rosterMoveRows });
  }

  // 4. Recompute each team's next-season ratings from their final roster,
  // and freeze a snapshot of that roster for the team history page.
  for (const team of realTeams) {
    const finalPlayers = await prisma.player.findMany({ where: { dynastyId, teamId: team.id } });
    const roster = finalPlayers.map(toRosterPlayer);
    const newPrestige = newPrestigeByTeamId.get(team.id)!;
    const ratings = teamRatings(roster, newPrestige);
    await prisma.teamSeason.create({
      data: {
        seasonId: nextSeason.id,
        teamId: team.id,
        prestige: newPrestige,
        offRating: ratings.offRating,
        defRating: ratings.defRating,
        totalRating: ratings.totalRating,
        rating: ratings.rating,
        powerElo: ratings.rating,
      },
    });
    await prisma.playerSeasonSnapshot.createMany({
      data: roster.map((p) => ({
        dynastyId,
        seasonNumber: nextSeasonNumber,
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
  }

  // Preseason rankings for the new season, off each team's freshly rebuilt
  // roster + updated prestige -- otherwise week 1 would show no rank at all
  // until week 1 itself is played.
  await recomputeRankings(nextSeason.id);

  const scheduleTeams: ScheduleTeam[] = realTeams.map((t) => ({
    id: t.id,
    name: t.name,
    conferenceCode: t.conference.code,
    divisionCode: t.division.code,
  }));
  const games =
    ruleset === "MEGA144"
      ? generateRegularSeasonSchedule144(
          scheduleTeams,
          fcsTeam.id,
          nextSeasonNumber,
          await buildSchedule144Input(dynastyId, season.id, realTeams, newPrestigeByTeamId)
        )
      : generateRegularSeasonSchedule(scheduleTeams, fcsTeam.id, nextSeasonNumber, priorStandings);
  await prisma.game.createMany({
    data: games.map((g) => ({
      seasonId: nextSeason.id,
      week: g.week,
      awayTeamId: g.awayTeamId,
      homeTeamId: g.homeTeamId,
    })),
  });

  await prisma.dynasty.update({
    where: { id: dynastyId },
    data: { currentSeasonNumber: nextSeasonNumber },
  });

  return nextSeason;
}
