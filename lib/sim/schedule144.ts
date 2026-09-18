// Regular-season schedule generator for the MEGA144 ruleset (12 conferences,
// 2 divisions of 6 teams each, 144 teams total).
//
//   week1  = cross-conference block (see crossConferenceWeeks144)
//   week2  = F (FCS cupcake), same mechanic as CLASSIC
//   week3  = cross-conference block
//   week4  = division (see below)
//   week5  = cross-conference block
//   week6  = division
//   week7  = non-division conference
//   week8  = division
//   week9  = non-division conference
//   week10 = division
//   week11 = non-division conference
//   week12 = division -- ALWAYS the fixed rivalry ("DR") pairing
//
// Weeks 1/2/3/5 are untouched (unrelated cross-conference/FCS mechanics --
// see crossConferenceWeeks144 and generateRegularSeasonSchedule144).
//
// Weeks 4/6/7/8/9/10/11/12 are ported directly from the user's own
// spreadsheet (`CFB Sim 2_3_2026 (144 teams).xlsx`, Sheet2: the week-formula
// table at BT2:BU15, the cross-division "C" games at A115:AI121, and the
// division "D"/"DR" games at A153:AC159) -- fully deterministic lookup
// tables keyed only by the season number, no history-tracking or heuristics
// needed. This replaces an earlier from-scratch Eulerian-circuit-based
// scheme that had no concept of a specific rivalry pairing at all (division
// mates were just alphabetically ordered and round-robin'd), which is why a
// fixed rivalry like Oregon-Cal always landed on the same host -- there was
// nothing in that scheme that could express "this pairing should alternate
// against ITS specific history" beyond a best-effort bias.
//
// Every team carries a `rivalrySlot` 0-11 (see lib/data/teams144.ts): its
// letter A-L in the user's given rivalry order, NOT reset per division (0-5
// = the conference's first-listed division, 6-11 = its second). Both tables
// below are expressed purely in these slot numbers and already cover an
// entire conference's 6 pairs per category/variant in one flat list (i.e.
// they don't need to be applied "per division" separately -- e.g. D1 already
// contains 3 division-1 pairs and 3 division-2 pairs together).
//
// D_TABLE (weeks 4/6/8/10/12): its 5 categories (D1-D4, DR) are the complete
// round-robin for a 6-team division -- verified directly against the sheet:
// together they cover all 15 unique pairs among {slot 0..5} (and,
// identically, {slot 6..11}) exactly once. Which category lands on which
// week is a season-number formula; DR -- always the fixed rivalry pairing,
// consecutive slots 0-1/2-3/4-5 (and 6-7/8-9/10-11) -- is always week 12.
// Host alternates by season parity (every pairing has an odd/even variant).
//
// The tables above only guarantee a team's home/away split across its 8
// division+conference games is within +/-1 of 4 for a given season (exactly
// 4-4 over any two consecutive seasons). balanceHomeAway144, below, then
// rebalances each conference's slate to exact 4-4 EVERY season by flipping
// a minimal chain of games (never changing who plays whom, and never
// touching week 12's rivalry host).
//
// C_TABLE (weeks 7/9/11): its 3 categories (C1-C3) are the cross-division
// pairings; each has 4 seasonal variants (the sheet's "(k/4)" columns) that
// together give a team all 6 of its cross-division opponents over a
// 4-season cycle. Which category lands on which week, and which of its 4
// variants applies, are both season-number formulas.

import { byName } from "./schedule";
import type { ScheduleTeam, ScheduledGame } from "./schedule";
import type { Rand } from "./rng";

export type { ScheduleTeam, ScheduledGame };

export interface ScheduleTeam144 extends ScheduleTeam {
  rivalrySlot: number; // 0-11 -- see lib/data/teams144.ts
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

// Excel's MOD always returns a result with the same sign as (i.e. in
// [0, n) for a positive) the divisor; JS's `%` can return negative for a
// negative dividend, so every port of one of the sheet's MOD(...) formulas
// needs this instead of a raw `%`.
function mod(x: number, n: number): number {
  return ((x % n) + n) % n;
}

// [away, home] rivalrySlot pairs, ported verbatim from Sheet2 A115:AI121.
// Indexed [category][variant 0-3], variant = mod(season - 1, 4).
const C_TABLE: Record<"C1" | "C2" | "C3", [number, number][][]> = {
  C1: [
    [[0, 6], [7, 1], [2, 8], [9, 3], [4, 10], [11, 5]],
    [[10, 0], [11, 1], [2, 6], [7, 3], [8, 4], [5, 9]],
    [[6, 0], [1, 7], [8, 2], [3, 9], [10, 4], [5, 11]],
    [[0, 10], [1, 11], [6, 2], [3, 7], [4, 8], [9, 5]],
  ],
  C2: [
    [[0, 11], [6, 1], [2, 7], [8, 3], [4, 9], [10, 5]],
    [[8, 0], [1, 9], [10, 2], [3, 11], [6, 4], [5, 7]],
    [[11, 0], [1, 6], [7, 2], [3, 8], [9, 4], [5, 10]],
    [[0, 8], [9, 1], [2, 10], [11, 3], [4, 6], [7, 5]],
  ],
  C3: [
    [[9, 0], [1, 10], [11, 2], [3, 6], [7, 4], [5, 8]],
    [[0, 7], [1, 8], [9, 2], [3, 10], [4, 11], [6, 5]],
    [[0, 9], [10, 1], [2, 11], [6, 3], [4, 7], [8, 5]],
    [[7, 0], [8, 1], [2, 9], [10, 3], [11, 4], [5, 6]],
  ],
};

// [away, home] rivalrySlot pairs, ported verbatim from Sheet2 A153:AC159.
// odd/even keyed by `mod(season, 2) === 1`.
const D_TABLE: Record<"D1" | "D2" | "D3" | "D4" | "DR", { odd: [number, number][]; even: [number, number][] }> = {
  D1: { odd: [[0, 5], [3, 1], [4, 2], [6, 11], [9, 7], [10, 8]], even: [[5, 0], [1, 3], [2, 4], [11, 6], [7, 9], [8, 10]] },
  D2: { odd: [[2, 0], [5, 1], [3, 4], [8, 6], [11, 7], [9, 10]], even: [[0, 2], [1, 5], [4, 3], [6, 8], [7, 11], [10, 9]] },
  D3: { odd: [[0, 3], [1, 4], [2, 5], [6, 9], [7, 10], [8, 11]], even: [[3, 0], [4, 1], [5, 2], [9, 6], [10, 7], [11, 8]] },
  D4: { odd: [[4, 0], [1, 2], [5, 3], [10, 6], [7, 8], [11, 9]], even: [[0, 4], [2, 1], [3, 5], [6, 10], [8, 7], [9, 11]] },
  DR: { odd: [[1, 0], [3, 2], [5, 4], [7, 6], [9, 8], [11, 10]], even: [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11]] },
};

// Sheet2 BU7/BU9/BU11/BU13: week -> [offset into "D" + mod4(T - offset) + 1].
const D_WEEK_OFFSETS: [number, number][] = [
  [4, 1],
  [6, 4],
  [8, 3],
  [10, 2],
];

// Sheet2 BU10/BU12/BU14: week -> [offset into "C" + mod3(season + offset) + 1].
const C_WEEK_OFFSETS: [number, number][] = [
  [7, -1],
  [9, 0],
  [11, 1],
];

// Pairs up every item in `order` (processing the best-ranked item first,
// matching it to the best-ranked available item it isn't `forbidden` with --
// "the best plays the second best IF they haven't played... continue in this
// way"), backtracking instead of committing irrevocably so a later item
// never gets stuck without options. With only 12 conferences, each having
// played just 2 others by this point (weeks 1+3), a full non-repeat pairing
// always exists (the "already played" graph is 2-regular on 12 nodes, so its
// complement is 9-regular -- well past the threshold that guarantees a
// perfect matching) -- backtracking is what actually finds it; a purely
// greedy pass can occasionally strand the last pair with no fresh option.
// Strict: only ever pairs non-`forbidden` candidates, backtracking fully;
// returns null if no completely repeat-free pairing of `remaining` exists.
// (No fallback at any recursion level -- mixing "found a solution" with
// "found one that had to allow a repeat somewhere" would let an early
// forced-repeat choice mask a fully clean solution reachable via a
// different candidate order.)
function strictNoRepeatMatching(
  remaining: string[],
  forbidden: (a: string, b: string) => boolean
): [string, string][] | null {
  if (remaining.length === 0) return [];
  const [first, ...rest] = remaining;
  for (const candidate of rest) {
    if (forbidden(first, candidate)) continue;
    const sub = strictNoRepeatMatching(
      rest.filter((x) => x !== candidate),
      forbidden
    );
    if (sub) return [[first, candidate], ...sub];
  }
  return null;
}

function greedyNoRepeatMatching(order: string[], forbidden: (a: string, b: string) => boolean): [string, string][] {
  const strict = strictNoRepeatMatching(order, forbidden);
  if (strict) return strict;
  // Provably unreachable at n=12 (see doc comment above the call site), but
  // fall back to a naive pairing that allows a repeat rather than throwing.
  const remaining = order.slice();
  const pairs: [string, string][] = [];
  while (remaining.length > 0) {
    const first = remaining.shift()!;
    const candidateIndex = remaining.findIndex((c) => !forbidden(first, c));
    const index = candidateIndex === -1 ? 0 : candidateIndex;
    if (remaining.length === 0) break;
    const [candidate] = remaining.splice(index, 1);
    pairs.push([first, candidate]);
  }
  return pairs;
}

function shuffle<T>(arr: T[], rand: Rand): T[] {
  const result = arr.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export interface ConfRecord144 {
  confWins: number;
  confLosses: number;
  powerElo: number;
}

export interface Schedule144Input {
  // Last season's conference record + powerElo per team; empty for season 1
  // (falls back to `startingPrestige` for the within-conference ranking).
  priorConfRecord: Map<string, ConfRecord144>;
  // Last season's conference-play head-to-head winner, keyed by
  // pairKey(teamA, teamB) -> winning team's id (tiebreak only).
  priorHeadToHead: Map<string, string>;
  // This dynasty's teams' starting Prestige (season-1 ranking fallback).
  startingPrestige: Map<string, number>;
  // This season's Prestige per team (feeds the week-5 conference-average
  // ranking).
  currentSeasonPrestige: Map<string, number>;
  // Total career week-5 cross-conference home-game count per conference
  // code, across this dynasty's history. Fewest-hosts-so-far gets the home
  // game this time (tie -> random).
  week5HistoricalHostCounts: Map<string, number>;
}

function rankWithinConference144(confTeams: ScheduleTeam[], input: Schedule144Input): ScheduleTeam[] {
  const hasPriorData = input.priorConfRecord.size > 0;
  return confTeams.slice().sort((a, b) => {
    if (!hasPriorData) {
      const pa = input.startingPrestige.get(a.id) ?? 0;
      const pb = input.startingPrestige.get(b.id) ?? 0;
      return pb - pa || byName(a, b);
    }
    const ra = input.priorConfRecord.get(a.id);
    const rb = input.priorConfRecord.get(b.id);
    const diffA = (ra?.confWins ?? 0) - (ra?.confLosses ?? 0);
    const diffB = (rb?.confWins ?? 0) - (rb?.confLosses ?? 0);
    if (diffA !== diffB) return diffB - diffA;
    // Tiebreak 1: head-to-head, if these two played each other in
    // conference play last season.
    const h2h = input.priorHeadToHead.get(pairKey(a.id, b.id));
    if (h2h === a.id) return -1;
    if (h2h === b.id) return 1;
    // Tiebreak 2: last season's power rating.
    const powerA = ra?.powerElo ?? 0;
    const powerB = rb?.powerElo ?? 0;
    if (powerA !== powerB) return powerB - powerA;
    return byName(a, b);
  });
}

// The D-table's round-robin only guarantees each team 2 or 3 home division
// games in a given season (see D_TABLE's doc comment), so the 8 division +
// non-division-conference games straight out of the tables land a team on
// 3, 4, or 5 home games -- balanced to exactly 8/8 over any two consecutive
// seasons, but not exactly 4/4 within one. This rebalances a single
// conference's 8-game slate to exact 4-4 for every team, WITHOUT changing
// who plays whom: it only flips a game's home/away assignment, by moving a
// "home credit" from a surplus team (>4 home games) to a deficit team (<4)
// along a chain of currently-unflipped games, so every team in between the
// chosen chain's endpoints nets zero change. Week 12 (the fixed DR rivalry)
// is deliberately excluded from the flip pool, so its season-parity host
// alternation always stays intact -- only weeks 4/6/7/8/9/10/11 are
// eligible. Deterministic: always walks `games`/`teamIds` in the same fixed
// order, so the same season produces the same result every time.
function balanceHomeAway144(games: ScheduledGame[], teamIds: string[]): void {
  const flippable = games.filter((g) => g.week !== 12);
  const homeCount = new Map<string, number>(teamIds.map((id) => [id, 0]));
  for (const g of games) homeCount.set(g.homeTeamId, (homeCount.get(g.homeTeamId) ?? 0) + 1);

  for (const startId of teamIds) {
    while ((homeCount.get(startId) ?? 0) > 4) {
      const path = findCreditTransferPath(startId, flippable, homeCount);
      for (const g of path) {
        const oldHome = g.homeTeamId;
        const oldAway = g.awayTeamId;
        g.homeTeamId = oldAway;
        g.awayTeamId = oldHome;
        homeCount.set(oldHome, homeCount.get(oldHome)! - 1);
        homeCount.set(oldAway, homeCount.get(oldAway)! + 1);
      }
    }
  }
}

// BFS over the "credit transfer" graph: a directed edge cur -> g.awayTeamId
// exists for every currently-unflipped game where cur is home (flipping it
// would move 1 home credit from cur to that away team). Returns the chain
// of games to flip to move a credit from `start` to the first reachable
// team under 4 home games -- interior teams on the chain are entered via a
// credit gain and leave via a credit loss, netting zero.
function findCreditTransferPath(
  start: string,
  flippable: ScheduledGame[],
  homeCount: Map<string, number>
): ScheduledGame[] {
  const visited = new Set<string>([start]);
  const parentGame = new Map<string, ScheduledGame>();
  const parentTeam = new Map<string, string>();
  const queue: string[] = [start];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur !== start && (homeCount.get(cur) ?? 0) < 4) {
      const path: ScheduledGame[] = [];
      let node = cur;
      while (parentGame.has(node)) {
        path.push(parentGame.get(node)!);
        node = parentTeam.get(node)!;
      }
      return path.reverse();
    }
    for (const g of flippable) {
      if (g.homeTeamId !== cur) continue;
      const next = g.awayTeamId;
      if (visited.has(next)) continue;
      visited.add(next);
      parentGame.set(next, g);
      parentTeam.set(next, cur);
      queue.push(next);
    }
  }
  throw new Error(`balanceHomeAway144: no reachable deficit team found from ${start}`);
}

// Weeks 4/6/8/10/12 (division) + 7/9/11 (non-division conference), built
// independently per conference straight from the two lookup tables above,
// then rebalanced (see balanceHomeAway144) to exact 4-4 home/away.
function divisionAndConferenceWeeks144(teams: ScheduleTeam144[], seasonNumber: number): ScheduledGame[] {
  const games: ScheduledGame[] = [];
  const byConference = new Map<string, ScheduleTeam144[]>();
  for (const t of teams) {
    if (!byConference.has(t.conferenceCode)) byConference.set(t.conferenceCode, []);
    byConference.get(t.conferenceCode)!.push(t);
  }

  const isOddSeason = mod(seasonNumber, 2) === 1;
  const T = (seasonNumber * (seasonNumber + 3)) / 2;
  const cVariantIndex = mod(seasonNumber - 1, 4);

  for (const confTeams of byConference.values()) {
    const bySlot = new Map(confTeams.map((t) => [t.rivalrySlot, t]));
    const teamAt = (slot: number) => bySlot.get(slot)!;
    const confGames: ScheduledGame[] = [];

    for (const [week, offset] of D_WEEK_OFFSETS) {
      const category = `D${mod(T - offset, 4) + 1}` as keyof typeof D_TABLE;
      const pairs = isOddSeason ? D_TABLE[category].odd : D_TABLE[category].even;
      for (const [awaySlot, homeSlot] of pairs) {
        confGames.push({ week, awayTeamId: teamAt(awaySlot).id, homeTeamId: teamAt(homeSlot).id });
      }
    }

    // Week 12: always the fixed rivalry pairing (DR), host by season parity.
    const drPairs = isOddSeason ? D_TABLE.DR.odd : D_TABLE.DR.even;
    for (const [awaySlot, homeSlot] of drPairs) {
      confGames.push({ week: 12, awayTeamId: teamAt(awaySlot).id, homeTeamId: teamAt(homeSlot).id });
    }

    for (const [week, offset] of C_WEEK_OFFSETS) {
      const category = `C${mod(seasonNumber + offset, 3) + 1}` as keyof typeof C_TABLE;
      const pairs = C_TABLE[category][cVariantIndex];
      for (const [awaySlot, homeSlot] of pairs) {
        confGames.push({ week, awayTeamId: teamAt(awaySlot).id, homeTeamId: teamAt(homeSlot).id });
      }
    }

    balanceHomeAway144(confGames, confTeams.map((t) => t.id));
    games.push(...confGames);
  }

  return games;
}

// Weeks 1/3/5: the cross-conference block schedule.
function crossConferenceWeeks144(teams: ScheduleTeam[], input: Schedule144Input, rand: Rand): ScheduledGame[] {
  const byConference = new Map<string, ScheduleTeam[]>();
  for (const t of teams) {
    if (!byConference.has(t.conferenceCode)) byConference.set(t.conferenceCode, []);
    byConference.get(t.conferenceCode)!.push(t);
  }
  const conferenceCodes = [...byConference.keys()];

  const rankedByConf = new Map<string, ScheduleTeam[]>();
  for (const [code, confTeams] of byConference) {
    rankedByConf.set(code, rankWithinConference144(confTeams, input));
  }

  function pairGames(awayConf: string, homeConf: string, week: number): ScheduledGame[] {
    const rankedAway = rankedByConf.get(awayConf)!;
    const rankedHome = rankedByConf.get(homeConf)!;
    const size = Math.min(rankedAway.length, rankedHome.length);
    const result: ScheduledGame[] = [];
    for (let i = 0; i < size; i++) {
      result.push({ week, awayTeamId: rankedAway[i].id, homeTeamId: rankedHome[i].id });
    }
    return result;
  }

  // Randomize the 12 conferences into a season order (positions 1-12, i.e.
  // indices 0-11).
  const order = shuffle(conferenceCodes, rand);

  const conferenceMatchupsThisSeason = new Set<string>();
  const games: ScheduledGame[] = [];

  // Week 1: (1,2),(3,4),(5,6),(7,8),(9,10),(11,12) -- first conference away.
  for (let i = 0; i < order.length; i += 2) {
    const awayConf = order[i];
    const homeConf = order[i + 1];
    conferenceMatchupsThisSeason.add(pairKey(awayConf, homeConf));
    games.push(...pairGames(awayConf, homeConf, 1));
  }

  // Week 3: (2,3),(4,5),(6,7),(8,9),(10,11),(12,1) -- first conference away.
  // Every conference is the "first" (away) slot in exactly one of week
  // 1/week 3, and the "second" (home) slot in the other -- so this pairing
  // scheme alone already guarantees 1 home + 1 away across weeks 1+3.
  for (let i = 1; i < order.length; i += 2) {
    const awayConf = order[i];
    const homeConf = order[(i + 1) % order.length];
    conferenceMatchupsThisSeason.add(pairKey(awayConf, homeConf));
    games.push(...pairGames(awayConf, homeConf, 3));
  }

  // Week 5: rank conferences by this season's average team Prestige,
  // descending. Greedily pair the best remaining conference with the
  // best-ranked remaining conference it hasn't already played this season.
  const avgPrestige = new Map<string, number>();
  for (const [code, confTeams] of byConference) {
    const total = confTeams.reduce((sum, t) => sum + (input.currentSeasonPrestige.get(t.id) ?? 0), 0);
    avgPrestige.set(code, total / confTeams.length);
  }
  const byPrestige = conferenceCodes
    .slice()
    .sort((a, b) => avgPrestige.get(b)! - avgPrestige.get(a)! || a.localeCompare(b));

  const week5Pairs = greedyNoRepeatMatching(byPrestige, (a, b) => conferenceMatchupsThisSeason.has(pairKey(a, b)));
  for (const [conf, opponent] of week5Pairs) {
    const hostsConf = input.week5HistoricalHostCounts.get(conf) ?? 0;
    const hostsOpponent = input.week5HistoricalHostCounts.get(opponent) ?? 0;
    let homeConf: string;
    if (hostsConf < hostsOpponent) homeConf = conf;
    else if (hostsOpponent < hostsConf) homeConf = opponent;
    else homeConf = rand() < 0.5 ? conf : opponent;
    const awayConf = homeConf === conf ? opponent : conf;

    games.push(...pairGames(awayConf, homeConf, 5));
  }

  return games;
}

export function generateRegularSeasonSchedule144(
  teams: ScheduleTeam144[],
  fcsTeamId: string,
  seasonNumber: number,
  input: Schedule144Input,
  rand: Rand = Math.random
): ScheduledGame[] {
  const games: ScheduledGame[] = [
    ...crossConferenceWeeks144(teams, input, rand),
    ...divisionAndConferenceWeeks144(teams, seasonNumber),
  ];

  // Week 2: FCS cupcake, always a home game for the real team -- same
  // mechanic as CLASSIC.
  for (const team of teams) {
    games.push({ week: 2, awayTeamId: fcsTeamId, homeTeamId: team.id });
  }

  return games;
}
