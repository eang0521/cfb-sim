// Regular-season schedule generator for the MEGA144 ruleset (12 conferences,
// 2 divisions of 6 teams each, 144 teams total). This ruleset didn't exist in
// the original workbook -- every rule here comes directly from the user's
// own specification, not a ported formula.
//
//   week1  = cross-conference block (see crossConferenceWeeks144)
//   week2  = F (FCS cupcake), same mechanic as CLASSIC
//   week3  = cross-conference block
//   week4  = division
//   week5  = cross-conference block
//   week6  = division
//   week7  = non-division conference
//   week8  = division
//   week9  = non-division conference
//   week10 = division
//   week11 = non-division conference
//   week12 = division
//
// Weeks 4/6/8/10/12 (5 division games) + weeks 7/9/11 (3 non-division
// conference games) are guaranteed EXACTLY 4 home / 4 away per team, every
// season, via lib/sim/eulerianCircuit.ts -- see that file for why. Host
// ALTERNATION for a recurring pairing (every season for division, every 2
// seasons for non-division conference opponents, since those rotate through
// 2 alternating groups of 3) is then applied as a best-effort bias on top of
// that exact split, sourced from this dynasty's own most recent meeting
// between the two teams -- when the two goals conflict, the exact 4-4 split
// always wins (confirmed with the user).

import { bipartiteRoundRobin, byName, circleRoundRobin } from "./schedule";
import type { ScheduleTeam, ScheduledGame } from "./schedule";
import { findEulerianOrientation, type EulerianEdge } from "./eulerianCircuit";
import type { Rand } from "./rng";

export type { ScheduleTeam, ScheduledGame };

const DIVISION_WEEKS = [4, 6, 8, 10, 12];
const CONFERENCE_WEEKS = [7, 9, 11];

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

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
  // The most recent PAST division/non-division-conference game's host for a
  // given team pair (pairKey(teamA, teamB) -> host team id), across this
  // dynasty's whole history. Absent = first-ever meeting, no preference.
  priorMeetingHost: Map<string, string>;
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

// Weeks 4/6/8/10/12 (division) + 7/9/11 (non-division conference), built and
// oriented independently per conference (conferences never share opponents).
function divisionAndConferenceWeeks144(
  teams: ScheduleTeam[],
  seasonNumber: number,
  input: Schedule144Input
): ScheduledGame[] {
  const games: ScheduledGame[] = [];
  const byConference = new Map<string, ScheduleTeam[]>();
  for (const t of teams) {
    if (!byConference.has(t.conferenceCode)) byConference.set(t.conferenceCode, []);
    byConference.get(t.conferenceCode)!.push(t);
  }

  for (const confTeams of byConference.values()) {
    const byDivision = new Map<string, ScheduleTeam[]>();
    for (const t of confTeams) {
      if (!byDivision.has(t.divisionCode)) byDivision.set(t.divisionCode, []);
      byDivision.get(t.divisionCode)!.push(t);
    }
    const [divA, divB] = [...byDivision.values()];
    if (!divA || !divB) continue;

    const orderedA = divA.slice().sort(byName);
    const orderedB = divB.slice().sort(byName);

    const edges: EulerianEdge[] = [];
    const edgeMeta = new Map<string, { category: "division" | "conference"; roundIndex: number }>();
    let edgeCounter = 0;

    // Division round-robin: fixed forever, every season plays all 5
    // division-mates (weeks 4/6/8/10/12).
    for (const div of [orderedA, orderedB]) {
      circleRoundRobin(div).forEach((round, roundIndex) => {
        for (const [a, b] of round) {
          const id = `d${edgeCounter++}`;
          edges.push({ id, a: a.id, b: b.id });
          edgeMeta.set(id, { category: "division", roundIndex });
        }
      });
    }

    // Non-division conference opponents: 6 possible rounds, split into 2
    // groups of 3 -- odd seasons play group A (rounds 0-2), even seasons
    // play group B (rounds 3-5), covering all 6 possible opponents every 2
    // seasons ("alternates every year").
    const allConfRounds = bipartiteRoundRobin(orderedA, orderedB);
    const activeGroup = seasonNumber % 2 === 1 ? allConfRounds.slice(0, 3) : allConfRounds.slice(3, 6);
    activeGroup.forEach((round, roundIndex) => {
      for (const [a, b] of round) {
        const id = `c${edgeCounter++}`;
        edges.push({ id, a: a.id, b: b.id });
        edgeMeta.set(id, { category: "conference", roundIndex });
      }
    });

    const preferredHost = new Map<string, string>();
    for (const e of edges) {
      const host = input.priorMeetingHost.get(pairKey(e.a, e.b));
      if (host) preferredHost.set(e.id, host);
    }

    const oriented = findEulerianOrientation(edges, preferredHost);
    for (const o of oriented) {
      const meta = edgeMeta.get(o.id)!;
      const week = meta.category === "division" ? DIVISION_WEEKS[meta.roundIndex] : CONFERENCE_WEEKS[meta.roundIndex];
      games.push({ week, awayTeamId: o.away, homeTeamId: o.home });
    }
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
  teams: ScheduleTeam[],
  fcsTeamId: string,
  seasonNumber: number,
  input: Schedule144Input,
  rand: Rand = Math.random
): ScheduledGame[] {
  const games: ScheduledGame[] = [
    ...crossConferenceWeeks144(teams, input, rand),
    ...divisionAndConferenceWeeks144(teams, seasonNumber, input),
  ];

  // Week 2: FCS cupcake, always a home game for the real team -- same
  // mechanic as CLASSIC.
  for (const team of teams) {
    games.push({ week: 2, awayTeamId: fcsTeamId, homeTeamId: team.id });
  }

  return games;
}
