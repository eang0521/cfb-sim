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
