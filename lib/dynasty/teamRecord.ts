import { prisma } from "@/lib/db/client";

export interface RecordUpdate {
  wins: number;
  losses: number;
}

export async function updateTeamRecord(
  seasonId: string,
  teamId: string,
  won: boolean,
  isConferenceGame: boolean,
  eloChange: number
): Promise<RecordUpdate | null> {
  const teamSeason = await prisma.teamSeason.findUnique({ where: { seasonId_teamId: { seasonId, teamId } } });
  if (!teamSeason) return null; // e.g. the synthetic FCS team has no TeamSeason row
  const wins = teamSeason.wins + (won ? 1 : 0);
  const losses = teamSeason.losses + (won ? 0 : 1);
  await prisma.teamSeason.update({
    where: { id: teamSeason.id },
    data: {
      wins,
      losses,
      confWins: teamSeason.confWins + (won && isConferenceGame ? 1 : 0),
      confLosses: teamSeason.confLosses + (!won && isConferenceGame ? 1 : 0),
      powerElo: teamSeason.powerElo + eloChange,
    },
  });
  return { wins, losses };
}
