import Link from "next/link";
import { formatRank, formatRecord, gameSideDisplay, type StandingsSnapshot } from "@/app/gameDisplay";
import { ROUND_LABEL } from "@/app/roundLabels";

export interface WeekGamesTableGame {
  id: string;
  round: string;
  bowlName: string | null;
  played: boolean;
  awayScore: number | null;
  homeScore: number | null;
  otPeriods: number;
  awayRankEntering: number | null;
  homeRankEntering: number | null;
  awayWinsAfter: number | null;
  awayLossesAfter: number | null;
  homeWinsAfter: number | null;
  homeLossesAfter: number | null;
  awayTeam: { id: string; name: string };
  homeTeam: { id: string; name: string };
}

// Rank = as of entering the week (frozen once played); record = as of right
// after that specific game (falls back to the live record when unplayed).
// Columns are real <table> cells so ranks/names/records/scores each line up
// down the page instead of running together in a single line of text.
export function WeekGamesTable({
  games,
  standingsByTeamId,
  dynastyId,
  showBowlNames = false,
}: {
  games: WeekGamesTableGame[];
  standingsByTeamId: Map<string, StandingsSnapshot>;
  dynastyId: string;
  showBowlNames?: boolean;
}) {
  return (
    <table className="w-full text-left text-sm">
      <tbody>
        {games.map((g) => {
          const away = gameSideDisplay(
            g.played,
            g.awayRankEntering,
            g.awayWinsAfter,
            g.awayLossesAfter,
            standingsByTeamId.get(g.awayTeam.id)
          );
          const home = gameSideDisplay(
            g.played,
            g.homeRankEntering,
            g.homeWinsAfter,
            g.homeLossesAfter,
            standingsByTeamId.get(g.homeTeam.id)
          );
          const label = g.bowlName ?? (showBowlNames ? ROUND_LABEL[g.round] ?? null : null);

          return (
            <tr key={g.id} className="odd:bg-zinc-50">
              {showBowlNames && (
                <td className="whitespace-nowrap py-1 pr-2 text-xs text-zinc-500">{label ?? ""}</td>
              )}
              <td className="py-1 pr-1 text-right tabular-nums text-zinc-500">{formatRank(away.rank)}</td>
              <td className="py-1 pr-2">
                <Link href={`/dynasty/${dynastyId}/game/${g.id}`} className="hover:underline">
                  {g.awayTeam.name}
                </Link>
              </td>
              <td className="py-1 pr-3 whitespace-nowrap tabular-nums text-zinc-500">{formatRecord(away)}</td>
              <td className="py-1 pr-3 text-zinc-400">@</td>
              <td className="py-1 pr-1 text-right tabular-nums text-zinc-500">{formatRank(home.rank)}</td>
              <td className="py-1 pr-2">
                <Link href={`/dynasty/${dynastyId}/game/${g.id}`} className="hover:underline">
                  {g.homeTeam.name}
                </Link>
              </td>
              <td className="py-1 pr-3 whitespace-nowrap tabular-nums text-zinc-500">{formatRecord(home)}</td>
              <td className="py-1 text-right tabular-nums text-zinc-600">
                {g.played ? `${g.awayScore}-${g.homeScore}${g.otPeriods ? ` (${g.otPeriods}OT)` : ""}` : "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
