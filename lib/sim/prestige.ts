// Season-over-season prestige update.
//
// The workbook does NOT keep this static — a team's Prestige ("Pres.") stat
// changes every offseason. The live formula that computed it didn't survive
// in the file (only its pasted output, the "NP"/New-Prestige column, does).
// This is the official formula as given directly:
//
//   newPrestige = round((oldPrestige + totalWins - totalLosses) * 2/3)
//               + conferenceBonus + randomSwing
//
// (wins/losses are folded in BEFORE the 2/3 decay, not added after it, so a
// single season's win-loss swing gets damped immediately rather than fully
// carrying over -- this and the wider conference bonus below both push
// toward good/bad programs staying good/bad rather than whipsawing.)
//
// - conferenceBonus (CLASSIC): rank the conferences by the SUM of all their
//   teams' wins that season (ties broken by the sum of the conference's
//   teams' OLD prestige, higher wins first), then look up CONFERENCE_RANK_BONUS.
// - conferenceBonus (MEGA144): NOT rank-based -- permanently locked per
//   conference, given directly by the user, so a conference's bonus doesn't
//   move no matter how that season's games go. See CONFERENCE_BONUS_MEGA144.
// - randomSwing: uniform in {-3,-2,-1,1,2,3} (never 0).

import { randBetween, type Rand } from "./rng";

const RANDOM_SWING = [-3, -2, -1, 1, 2, 3];
// index 0 = best conference that season (CLASSIC only -- MEGA144 is fixed, see below).
export const CONFERENCE_RANK_BONUS = [2, 1, 0, 0, -1, -2];

// MEGA144's 12 conferences' prestige bonus, permanently locked (not derived
// from that season's wins), given directly by the user.
export const CONFERENCE_BONUS_MEGA144: Record<string, number> = {
  SEC: 4,
  B1G: 3,
  P12: 3,
  ACC: 3,
  B12: 3,
  BEC: 0,
  SBT: -3,
  MAC: -3,
  MWC: -1,
  AAC: -3,
  SWC: -2,
  SKY: -4,
};

export interface PrestigeUpdateInput {
  currentPrestige: number;
  totalWins: number;
  totalLosses: number;
  conferenceBonus: number;
}

export function randomPrestigeSwing(rand: Rand = Math.random): number {
  return RANDOM_SWING[randBetween(0, RANDOM_SWING.length - 1, rand)];
}

export function conferenceRankBonus(conferenceRank: number, bonusTable: number[] = CONFERENCE_RANK_BONUS): number {
  return bonusTable[Math.min(Math.max(conferenceRank, 1), bonusTable.length) - 1];
}

export function updatePrestige(input: PrestigeUpdateInput, rand: Rand = Math.random): number {
  const decayed = Math.round(((input.currentPrestige + input.totalWins - input.totalLosses) * 2) / 3);
  return decayed + input.conferenceBonus + randomPrestigeSwing(rand);
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
