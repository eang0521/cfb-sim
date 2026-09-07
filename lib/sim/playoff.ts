// 6-team playoff bracket: seeds 1-2 get a bye into the semifinals,
// quarterfinals are 3v6 and 4v5, matching the workbook's "1 vs 4/5",
// "3 vs 6" bowl-rotation naming in `List of Bowls`.

export type PlayoffRound = "QUARTERFINAL" | "SEMIFINAL" | "FINAL";

export interface Seed {
  teamId: string;
  seed: number; // 1-6
}

export interface RankedTeam {
  teamId: string;
  nationalRank: number; // 1 = best, from powerElo across the whole league
}

// Field selection: the top 3 conference champions BY NATIONAL RANK get an
// automatic bid no matter what, then the 3 remaining spots go to the
// best-ranked teams left (which may include the other conference champions,
// competing on equal footing with everyone else for those at-large spots).
// The final 6 are then re-seeded 1-6 by national rank for bracket purposes —
// so a lower-ranked auto-bid champion can still land the 6-seed over a
// higher-ranked team that missed the field entirely.
export function selectPlayoffField(rankedTeams: RankedTeam[], conferenceChampionIds: string[]): Seed[] {
  const byRank = rankedTeams.slice().sort((a, b) => a.nationalRank - b.nationalRank);
  const championSet = new Set(conferenceChampionIds);

  const rankedChampions = byRank.filter((t) => championSet.has(t.teamId));
  const autoBids = rankedChampions.slice(0, 3);
  const autoBidIds = new Set(autoBids.map((t) => t.teamId));

  const atLargeSlots = 6 - autoBids.length;
  const atLarge = byRank.filter((t) => !autoBidIds.has(t.teamId)).slice(0, atLargeSlots);

  return [...autoBids, ...atLarge]
    .sort((a, b) => a.nationalRank - b.nationalRank)
    .map((t, i) => ({ teamId: t.teamId, seed: i + 1 }));
}

export function buildQuarterfinals(seeds: Seed[]): [Seed, Seed][] {
  const bySeed = new Map(seeds.map((s) => [s.seed, s]));
  return [
    [bySeed.get(3)!, bySeed.get(6)!],
    [bySeed.get(4)!, bySeed.get(5)!],
  ];
}

// Given the QF winners (in [3v6-winner, 4v5-winner] order) and the 1/2 seeds,
// returns the two semifinal matchups: 1 vs (4/5 winner), 2 vs (3/6 winner).
export function buildSemifinals(
  seed1: Seed,
  seed2: Seed,
  qf1Winner: Seed,
  qf2Winner: Seed
): [Seed, Seed][] {
  return [
    [seed1, qf2Winner],
    [seed2, qf1Winner],
  ];
}

export function buildFinal(sf1Winner: Seed, sf2Winner: Seed): [Seed, Seed] {
  return [sf1Winner, sf2Winner];
}

// --- MEGA144: 12-team field, top 6 conference champs auto-bid (matches the
// real CFP's current format) ---

// Same idea as selectPlayoffField, scaled up: top 6 conference champions by
// national rank auto-qualify, the other 6 spots go to the best-ranked teams
// left, then the full field is re-seeded 1-12 by national rank.
export function selectPlayoffField12(rankedTeams: RankedTeam[], conferenceChampionIds: string[]): Seed[] {
  const byRank = rankedTeams.slice().sort((a, b) => a.nationalRank - b.nationalRank);
  const championSet = new Set(conferenceChampionIds);

  const rankedChampions = byRank.filter((t) => championSet.has(t.teamId));
  const autoBids = rankedChampions.slice(0, 6);
  const autoBidIds = new Set(autoBids.map((t) => t.teamId));

  const atLargeSlots = 12 - autoBids.length;
  const atLarge = byRank.filter((t) => !autoBidIds.has(t.teamId)).slice(0, atLargeSlots);

  return [...autoBids, ...atLarge]
    .sort((a, b) => a.nationalRank - b.nationalRank)
    .map((t, i) => ({ teamId: t.teamId, seed: i + 1 }));
}

// Seeds 1-4 bye; first round is 5v12, 6v11, 7v10, 8v9.
export function buildFirstRound12(seeds: Seed[]): [Seed, Seed][] {
  const bySeed = new Map(seeds.map((s) => [s.seed, s]));
  return [
    [bySeed.get(5)!, bySeed.get(12)!],
    [bySeed.get(6)!, bySeed.get(11)!],
    [bySeed.get(7)!, bySeed.get(10)!],
    [bySeed.get(8)!, bySeed.get(9)!],
  ];
}

// Fixed bracket (no reseeding): 1 vs (8/9 winner), 2 vs (7/10 winner), 3 vs
// (6/11 winner), 4 vs (5/12 winner). `firstRoundWinners` must be in the same
// order buildFirstRound12 returned its pairs.
export function buildQuarterfinals12(
  seeds: Seed[],
  firstRoundWinners: [Seed, Seed, Seed, Seed]
): [Seed, Seed][] {
  const bySeed = new Map(seeds.map((s) => [s.seed, s]));
  const [win5v12, win6v11, win7v10, win8v9] = firstRoundWinners;
  return [
    [bySeed.get(1)!, win8v9],
    [bySeed.get(2)!, win7v10],
    [bySeed.get(3)!, win6v11],
    [bySeed.get(4)!, win5v12],
  ];
}

// Standard bracket pairing: the 1-seed's and 4-seed's sides meet in one
// semifinal, the 2-seed's and 3-seed's sides meet in the other.
// `quarterfinalWinners` must be in the order buildQuarterfinals12 returned
// its pairs (1-side, 2-side, 3-side, 4-side).
export function buildSemifinals12(quarterfinalWinners: [Seed, Seed, Seed, Seed]): [Seed, Seed][] {
  const [side1, side2, side3, side4] = quarterfinalWinners;
  return [
    [side1, side4],
    [side2, side3],
  ];
}

export function buildFinal12(sf1Winner: Seed, sf2Winner: Seed): [Seed, Seed] {
  return [sf1Winner, sf2Winner];
}
