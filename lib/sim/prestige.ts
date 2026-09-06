// Season-over-season prestige update.
//
// The workbook does NOT keep this static — a team's Prestige ("Pres.") stat
// changes every offseason. The live formula that computed it didn't survive
// in the file (only its pasted output, the "NP"/New-Prestige column, does).
// This is the official formula as given directly:
//
//   newPrestige = round(oldPrestige * 2/3) + totalWins - totalLosses
//               + conferenceRankBonus + randomSwing
//
// - conferenceRankBonus: rank the 6 conferences by the SUM of all their
//   teams' wins that season (ties broken by the sum of the conference's
//   teams' OLD prestige, higher wins first). Best conference +2, 2nd +1,
//   3rd/4th 0, 5th -1, 6th -2.
// - randomSwing: uniform in {-3,-2,-1,1,2,3} (never 0).

import { randBetween, type Rand } from "./rng";

const RANDOM_SWING = [-3, -2, -1, 1, 2, 3];
const CONFERENCE_RANK_BONUS = [2, 1, 0, 0, -1, -2]; // index 0 = best conference that season

export interface PrestigeUpdateInput {
  currentPrestige: number;
  totalWins: number;
  totalLosses: number;
  conferenceRank: number; // 1-6, 1 = best conference that season
}

export function randomPrestigeSwing(rand: Rand = Math.random): number {
  return RANDOM_SWING[randBetween(0, RANDOM_SWING.length - 1, rand)];
}

export function conferenceRankBonus(conferenceRank: number): number {
  return CONFERENCE_RANK_BONUS[Math.min(Math.max(conferenceRank, 1), 6) - 1];
}

export function updatePrestige(input: PrestigeUpdateInput, rand: Rand = Math.random): number {
  const decayed = Math.round((input.currentPrestige * 2) / 3);
  return (
    decayed +
    input.totalWins -
    input.totalLosses +
    conferenceRankBonus(input.conferenceRank) +
    randomPrestigeSwing(rand)
  );
}

export interface ConferenceSeasonStats {
  totalWins: number;
  totalOldPrestige: number;
}

// Ranks a season's 6 conferences by total wins (summed across every team in
// the conference), breaking ties by the sum of the conference's teams' OLD
// (pre-update) prestige. Returns conference id/code -> rank (1 = best).
export function rankConferencesByWins(
  conferenceStats: Record<string, ConferenceSeasonStats>
): Record<string, number> {
  const sorted = Object.entries(conferenceStats).sort(([, a], [, b]) => {
    if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
    return b.totalOldPrestige - a.totalOldPrestige;
  });
  const ranks: Record<string, number> = {};
  sorted.forEach(([conf], index) => {
    ranks[conf] = index + 1;
  });
  return ranks;
}
