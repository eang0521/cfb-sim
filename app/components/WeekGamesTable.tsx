import Link from "next/link";
import { formatRank, formatRecord, gameSideDisplay, RANKED_CUTOFF, type StandingsSnapshot } from "@/app/gameDisplay";
import { ROUND_LABEL } from "@/app/roundLabels";
import { TeamLogo } from "@/app/components/TeamLogo";
import { estimateWinProbability } from "@/lib/sim/winProbability";

export interface WeekGamesTableGame {
  id: string;
  round: string;
  bowlName: string | null;
  neutralSite: boolean;
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

// Bracket rounds are seeded -- the number that matters for these games is
// the persisted playoff seed, not the team's live national rank (which
// drifts as the postseason plays out and has no fixed relationship to seed
// anyway, since the top-N conference-champion auto-bid rule means seed
// order isn't just rank order).
const BRACKET_ROUNDS = new Set(["FIRST_ROUND", "QUARTERFINAL", "SEMIFINAL", "FINAL"]);

function liveSnapshotFor(
  round: string,
  snapshot: StandingsSnapshot | undefined
): StandingsSnapshot | undefined {
  if (!snapshot || !BRACKET_ROUNDS.has(round)) return snapshot;
  return { ...snapshot, rank: snapshot.playoffSeed };
}

// Estimated pre-game odds, formatted the same shape as a final score
// ("away-home") so it drops into the same table cell -- null when either
// side's current-season ratings aren't available (e.g. the FCS cupcake
// opponent, which carries no TeamSeason row at all).
function winOddsLabel(
  g: WeekGamesTableGame,
  standingsByTeamId: Map<string, StandingsSnapshot>
): string | null {
  const away = standingsByTeamId.get(g.awayTeam.id);
  const home = standingsByTeamId.get(g.homeTeam.id);
  if (!away || !home) return null;
  const { awayWinPct, homeWinPct } = estimateWinProbability(
    { offRating: away.offRating, defRating: away.defRating, powerElo: away.powerElo },
    { offRating: home.offRating, defRating: home.defRating, powerElo: home.powerElo },
    g.neutralSite,
    g.id
  );
  // Round independently rounds away/home to the nearest percent can land on
  // 101% or 99% total (e.g. 50.5%/49.5% both round up to 51%/50%) -- round
  // one side, then derive the other from 100 instead of rounding both, so
  // they always sum to exactly 100.
  const awayPct = Math.round(awayWinPct * 100);
  return `${awayPct}%-${100 - awayPct}%`;
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
  showWinOdds = false,
}: {
  games: WeekGamesTableGame[];
  standingsByTeamId: Map<string, StandingsSnapshot>;
  dynastyId: string;
  showBowlNames?: boolean;
  showWinOdds?: boolean;
}) {
  // Sort by the best (lowest-numbered) visible rank in each matchup, so the
  // marquee games surface first; below that (or when neither team is
  // ranked), sort by the best team's power rating instead of leaving
  // unranked games in arbitrary order.
  const withDisplay = games.map((g) => {
    const away = gameSideDisplay(
      g.played,
      g.awayRankEntering,
      g.awayWinsAfter,
      g.awayLossesAfter,
      liveSnapshotFor(g.round, standingsByTeamId.get(g.awayTeam.id))
    );
    const home = gameSideDisplay(
      g.played,
      g.homeRankEntering,
      g.homeWinsAfter,
      g.homeLossesAfter,
      liveSnapshotFor(g.round, standingsByTeamId.get(g.homeTeam.id))
    );
    const visibleRank = (rank: number | null) => (rank !== null && rank <= RANKED_CUTOFF ? rank : Infinity);
    const bestRank = Math.min(visibleRank(away.rank), visibleRank(home.rank));
    const bestPowerElo = Math.max(
      standingsByTeamId.get(g.awayTeam.id)?.powerElo ?? -Infinity,
      standingsByTeamId.get(g.homeTeam.id)?.powerElo ?? -Infinity
    );
    return { game: g, away, home, bestRank, bestPowerElo };
  });
  const sorted = withDisplay.slice().sort((a, b) => a.bestRank - b.bestRank || b.bestPowerElo - a.bestPowerElo);

  return (
    <table className="w-full text-left text-sm">
      <tbody>
        {sorted.map(({ game: g, away, home }) => {
          const label = g.bowlName ?? (showBowlNames ? ROUND_LABEL[g.round] ?? null : null);

          return (
            <tr key={g.id} className="odd:bg-zinc-50">
              {showBowlNames && (
                <td className="whitespace-nowrap py-1 pr-2 text-xs text-zinc-500">{label ?? ""}</td>
              )}
              <td className="py-1 pr-1 text-right tabular-nums text-zinc-500">{formatRank(away.rank)}</td>
              <td className="py-1 pr-2">
                <Link href={`/dynasty/${dynastyId}/teams?team=${g.awayTeam.id}`} className="flex items-center gap-1.5 hover:underline">
                  <TeamLogo name={g.awayTeam.name} />
                  {g.awayTeam.name}
                </Link>
              </td>
              <td className="py-1 pr-3 whitespace-nowrap tabular-nums text-zinc-500">{formatRecord(away)}</td>
              <td className="py-1 pr-3 text-zinc-400">{g.neutralSite ? "vs" : "@"}</td>
              <td className="py-1 pr-1 text-right tabular-nums text-zinc-500">{formatRank(home.rank)}</td>
              <td className="py-1 pr-2">
                <Link href={`/dynasty/${dynastyId}/teams?team=${g.homeTeam.id}`} className="flex items-center gap-1.5 hover:underline">
                  <TeamLogo name={g.homeTeam.name} />
                  {g.homeTeam.name}
                </Link>
              </td>
              <td className="py-1 pr-3 whitespace-nowrap tabular-nums text-zinc-500">{formatRecord(home)}</td>
              <td className="py-1 text-right tabular-nums text-zinc-600">
                <Link href={`/dynasty/${dynastyId}/game/${g.id}`} className="hover:underline">
                  {g.played
                    ? `${g.awayScore}-${g.homeScore}${g.otPeriods ? ` (${g.otPeriods}OT)` : ""}`
                    : (showWinOdds && winOddsLabel(g, standingsByTeamId)) || "—"}
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
