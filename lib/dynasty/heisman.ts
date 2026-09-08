import { prisma } from "@/lib/db/client";
import { FCS_TEAM_NAME } from "./fcsTeam";

// posGroup -> share of the player's team's win total added to their overall
// rating for HEISMAN value. QB gets the full total, UT (the offensive
// skill-position slot) gets half, defensive positions get a quarter. OL gets
// no bonus at all (pure overall rating).
const HEISMAN_WIN_MULTIPLIER: Record<string, number> = {
  QB: 1,
  UT: 0.5,
  DL: 0.25,
  LB: 0.25,
  DB: 0.25,
};

function heismanValue(ovr: number, posGroup: string, teamWins: number): number {
  return ovr + (HEISMAN_WIN_MULTIPLIER[posGroup] ?? 0) * teamWins;
}

interface Candidate {
  teamId: string;
  playerName: string;
  posGroup: string;
  ovr: number;
  devTrait: number;
  value: number;
  wins: number;
  powerElo: number;
}

// Computes this season's HEISMAN winner and freezes it onto the Season row.
// Must be called exactly once, right after conference championships finish
// (see advancePostseason in postseason.ts) -- postseason (playoff/bowl)
// games change team win totals, but the award is explicitly based on wins
// as of right after conference championships, so it can't be recomputed
// later. Ties broken by dev trait, then team wins, then team power rating.
export async function computeAndPersistHeisman(seasonId: string): Promise<void> {
  const season = await prisma.season.findUniqueOrThrow({ where: { id: seasonId } });
  const [players, teamSeasons] = await Promise.all([
    prisma.player.findMany({ where: { dynastyId: season.dynastyId, team: { name: { not: FCS_TEAM_NAME } } } }),
    prisma.teamSeason.findMany({ where: { seasonId } }),
  ]);
  const teamSeasonByTeamId = new Map(teamSeasons.map((ts) => [ts.teamId, ts]));

  const candidates: Candidate[] = players.flatMap((player) => {
    const ts = teamSeasonByTeamId.get(player.teamId);
    if (!ts) return [];
    return [
      {
        teamId: player.teamId,
        playerName: player.name,
        posGroup: player.posGroup,
        ovr: player.ovr,
        devTrait: player.devTrait,
        value: heismanValue(player.ovr, player.posGroup, ts.wins),
        wins: ts.wins,
        powerElo: ts.powerElo,
      },
    ];
  });

  candidates.sort(
    (a, b) => b.value - a.value || b.devTrait - a.devTrait || b.wins - a.wins || b.powerElo - a.powerElo
  );
  const winner = candidates[0];
  if (!winner) return;

  await prisma.season.update({
    where: { id: seasonId },
    data: {
      heismanTeamId: winner.teamId,
      heismanPlayerName: winner.playerName,
      heismanPosGroup: winner.posGroup,
      heismanOvr: winner.ovr,
      heismanValue: winner.value,
    },
  });
}

// Trims a HEISMAN value to at most 2 decimal places for display (values are
// often fractional -- UT/defensive bonuses are wins/2 or wins/4).
export function formatHeismanValue(value: number): string {
  return Number(value.toFixed(2)).toString();
}
