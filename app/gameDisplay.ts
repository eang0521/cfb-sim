// Shared formatting for "rank + record" shown next to a team in a week's
// game list. Deliberately mixes two points in time: the rank is always as
// of ENTERING the week (frozen once the game is played, since a team's live
// rank keeps moving in later weeks), while the record is as of AFTER that
// specific game concludes (falls back to the live/current record for a game
// that hasn't been played yet, since there's no "after" yet).

import type { StandingsSnapshot } from "@/lib/dynasty/queries";

export const RANKED_CUTOFF = 25;

export type { StandingsSnapshot };

export interface GameSideDisplay {
  rank: number | null; // null = unranked (outside the cutoff) or untracked (e.g. FCS)
  wins: number | null;
  losses: number | null;
}

export function gameSideDisplay(
  played: boolean,
  rankEntering: number | null,
  winsAfter: number | null,
  lossesAfter: number | null,
  current: StandingsSnapshot | undefined
): GameSideDisplay {
  if (played) {
    return { rank: rankEntering, wins: winsAfter, losses: lossesAfter };
  }
  if (!current) return { rank: null, wins: null, losses: null };
  return { rank: current.rank, wins: current.wins, losses: current.losses };
}

export function formatRank(rank: number | null): string {
  return rank !== null && rank <= RANKED_CUTOFF ? `#${rank}` : "";
}

export function formatRecord(display: GameSideDisplay): string {
  return display.wins !== null && display.losses !== null ? `${display.wins}-${display.losses}` : "";
}
