// Regular-season schedule generator — ported from the workbook's rotation
// formulas (found identically in both `Sheet2` and `FullSchedGen`, keyed off
// a `Season` input cell):
//
//   week1  = R                                          (fixed cross-conference rival)
//   week2  = F                                          (FCS cupcake)
//   week3  = N & MOD(FLOOR((season-1)/2),2)+1            (rank-seeded non-conf)
//   week4  = D & MOD(season*(season+3)/2-1,4)+1          (division)
//   week5  = N & MOD(FLOOR((season-1)/2)+1,2)+1          (rank-seeded non-conf)
//   week6  = D & MOD(season*(season+3)/2-4,4)+1          (division)
//   week7  = C & MOD(season-1,3)+1                       (conference cross-division)
//   week8  = D & MOD(season*(season+3)/2-3,4)+1          (division)
//   week9  = C & MOD(season,3)+1                         (conference cross-division)
//   week10 = D & MOD(season*(season+3)/2-2,4)+1          (division)
//   week11 = C & MOD(season+1,3)+1                       (conference cross-division)
//   week12 = DR                                          (division rivalry, always the finale)
//
// D1-D4/DR and C1-C3 are FIXED opponents (never change) — only which WEEK
// they land in, and who hosts, rotates by season. Excel's MOD is always
// non-negative for a positive divisor, which is what `mod()` below matches
// (unlike JS's `%`, which can return negative).
//
// The exact identity of each team's D1-D4/DR/C1-C3 partners, and the exact
// conference-pairing rotation for the N-slots, didn't survive as a portable
// formula in the workbook (see the project README) — those are a faithful
// reconstruction: fixed partners are built once via a stable round-robin
// over the static division/conference rosters, and the N-slots use the
// actual rule that DID survive verbally: seeded by each team's rank within
// its own conference at the end of the PRIOR season.

import { pairAvoidingSameGroup } from "./bowlPairing";

export interface ScheduleTeam {
  id: string;
  name: string;
  conferenceCode: string;
  divisionCode: string;
}

export interface PriorStanding {
  teamId: string;
  conferenceRank: number; // 1 = best in their conference last season
}

export interface ScheduledGame {
  week: number;
  awayTeamId: string;
  homeTeamId: string;
}

export function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function byName(a: ScheduleTeam, b: ScheduleTeam): number {
  return a.name.localeCompare(b.name);
}

// Round-robin "circle method": for `m` teams (m even), returns `m-1` rounds,
// each a perfect matching, with every pair of teams meeting exactly once.
export function circleRoundRobin<T>(teams: T[]): T[][][] {
  const m = teams.length;
  const rounds: T[][][] = [];
  let arr = teams.slice();
  for (let round = 0; round < m - 1; round++) {
    const pairs: T[][] = [];
    for (let i = 0; i < m / 2; i++) {
      pairs.push([arr[i], arr[m - 1 - i]]);
    }
    rounds.push(pairs);
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop() as T);
    arr = [fixed, ...rest];
  }
  return rounds;
}

// Bipartite round-robin: two equal-size pools, `m` rounds pairing every
// A-team with every B-team exactly once.
export function bipartiteRoundRobin<T>(poolA: T[], poolB: T[]): T[][][] {
  const m = poolA.length;
  const rounds: T[][][] = [];
  for (let r = 0; r < m; r++) {
    const round: T[][] = poolA.map((a, i) => [a, poolB[(i + r) % m]]);
    rounds.push(round);
  }
  return rounds;
}

interface FixedOpponent {
  teamId: string;
  hostsOnOdd: boolean; // from THIS team's perspective for THIS specific pairing
}

interface FixedPartners {
  division: [FixedOpponent, FixedOpponent, FixedOpponent, FixedOpponent]; // D1-D4
  divisionRival: FixedOpponent; // DR
  conference: [FixedOpponent, FixedOpponent, FixedOpponent]; // C1-C3
  nonConfRival: FixedOpponent; // R
}

export function isPrimary(a: ScheduleTeam, b: ScheduleTeam): boolean {
  return byName(a, b) < 0;
}

// Orients a list of (unordered) pairings into a balanced home/away
// assignment: greedily, whichever side of a pairing currently has FEWER
// assigned home games in this pass hosts it (ties broken deterministically).
// A single independent comparison per pair (e.g. "alphabetically-first team
// hosts") looks fine for one pairing in isolation, but says nothing about a
// team's OTHER pairings — a team that happens to sort before most of its
// rivals, or that always lands in the same slot of a round-robin rotation,
// could end up "hosting" nearly everything in the same season. Processing
// every pairing through one shared home-count tally is what actually keeps
// each team's total (and therefore how long a home streak can run) in check.
function orientPairingsBalanced(pairs: [ScheduleTeam, ScheduleTeam][]): Map<string, Set<string>> {
  const homeCount = new Map<string, number>();
  const hostsOf = new Map<string, Set<string>>();
  for (const [a, b] of pairs) {
    const countA = homeCount.get(a.id) ?? 0;
    const countB = homeCount.get(b.id) ?? 0;
    let host: ScheduleTeam;
    let visitor: ScheduleTeam;
    if (countA < countB) [host, visitor] = [a, b];
    else if (countB < countA) [host, visitor] = [b, a];
    else [host, visitor] = isPrimary(a, b) ? [a, b] : [b, a];

    homeCount.set(host.id, (homeCount.get(host.id) ?? 0) + 1);
    if (!hostsOf.has(host.id)) hostsOf.set(host.id, new Set());
    hostsOf.get(host.id)!.add(visitor.id);
  }
  return hostsOf;
}

function orientedHosts(
  hostsOf: Map<string, Set<string>>,
  teamId: string,
  opponentId: string
): boolean {
  return hostsOf.get(teamId)?.has(opponentId) ?? false;
}

// Exact version of the same idea for exactly two perfect matchings (each
// team appears in precisely one pair of `matchingA` and one pair of
// `matchingB`): the union is a 2-regular graph, i.e. a disjoint set of
// cycles. Walking a cycle and alternating "current team hosts the next
// edge" gives every team exactly one home + one away game, guaranteed —
// no tie-break needed, and no risk of two already-hosting teams colliding.
function orientCycleAlternating(
  matchingA: [ScheduleTeam, ScheduleTeam][],
  matchingB: [ScheduleTeam, ScheduleTeam][]
): Map<string, Set<string>> {
  const viaA = new Map<string, ScheduleTeam>();
  const viaB = new Map<string, ScheduleTeam>();
  for (const [a, b] of matchingA) {
    viaA.set(a.id, b);
    viaA.set(b.id, a);
  }
  for (const [a, b] of matchingB) {
    viaB.set(a.id, b);
    viaB.set(b.id, a);
  }

  const hostsOf = new Map<string, Set<string>>();
  const visited = new Set<string>();
  for (const startId of viaA.keys()) {
    if (visited.has(startId)) continue;
    let currentId = startId;
    let useA = true;
    do {
      visited.add(currentId);
      const next = (useA ? viaA.get(currentId) : viaB.get(currentId))!;
      if (!hostsOf.has(currentId)) hostsOf.set(currentId, new Set());
      hostsOf.get(currentId)!.add(next.id); // currentId hosts vs next
      currentId = next.id;
      useA = !useA;
    } while (currentId !== startId);
  }
  return hostsOf;
}

// Built once from the static team roster (conference/division membership
// never changes across a dynasty) — same partners every season, forever.
// Home/away is decided as if EVERY season were "odd"; even seasons flip
// every fixed pairing at once (see generateRegularSeasonSchedule), which
// preserves whatever balance orientPairingsBalanced found, since flipping
// every edge of a graph simultaneously can't unbalance it.
function buildFixedPartners(teams: ScheduleTeam[]): Map<string, FixedPartners> {
  const partners = new Map<string, FixedPartners>();
  const placeholder: FixedOpponent = { teamId: "", hostsOnOdd: false };
  for (const t of teams) {
    partners.set(t.id, {
      division: [placeholder, placeholder, placeholder, placeholder],
      divisionRival: placeholder,
      conference: [placeholder, placeholder, placeholder],
      nonConfRival: placeholder,
    });
  }

  // Collect every fixed pairing (division round robin + conference
  // cross-division + the global rival) into one shared list so home/away
  // gets balanced across ALL of a team's fixed opponents together, not
  // category-by-category.
  const allPairs: [ScheduleTeam, ScheduleTeam][] = [];
  const divisionRounds: { roundIndex: number; a: ScheduleTeam; b: ScheduleTeam }[] = [];
  const conferenceRounds: { roundIndex: number; a: ScheduleTeam; b: ScheduleTeam }[] = [];

  const divisions = new Map<string, ScheduleTeam[]>();
  for (const t of teams) {
    if (!divisions.has(t.divisionCode)) divisions.set(t.divisionCode, []);
    divisions.get(t.divisionCode)!.push(t);
  }
  for (const divTeams of divisions.values()) {
    const ordered = divTeams.slice().sort(byName);
    circleRoundRobin(ordered).forEach((round, roundIndex) => {
      for (const [a, b] of round) {
        divisionRounds.push({ roundIndex, a, b });
        allPairs.push([a, b]);
      }
    });
  }

  const conferences = new Map<string, Map<string, ScheduleTeam[]>>();
  for (const t of teams) {
    if (!conferences.has(t.conferenceCode)) conferences.set(t.conferenceCode, new Map());
    const divMap = conferences.get(t.conferenceCode)!;
    if (!divMap.has(t.divisionCode)) divMap.set(t.divisionCode, []);
    divMap.get(t.divisionCode)!.push(t);
  }
  for (const divMap of conferences.values()) {
    const [divA, divB] = [...divMap.values()];
    if (!divA || !divB) continue;
    const orderedA = divA.slice().sort(byName);
    const orderedB = divB.slice().sort(byName);
    bipartiteRoundRobin(orderedA, orderedB)
      .slice(0, 3) // only C1-C3 ever get used
      .forEach((round, roundIndex) => {
        for (const [a, b] of round) {
          conferenceRounds.push({ roundIndex, a, b });
          allPairs.push([a, b]);
        }
      });
  }

  // A fixed, permanent, cross-conference "rival" for the R week — one clean
  // perfect matching across the whole league, avoiding same-conference.
  const allOrdered = teams.slice().sort(byName);
  const rivalPairs = pairAvoidingSameGroup(allOrdered, (t) => t.conferenceCode);
  allPairs.push(...rivalPairs);

  const hostsOf = orientPairingsBalanced(allPairs);
  const entryFor = (team: ScheduleTeam, opponent: ScheduleTeam): FixedOpponent => ({
    teamId: opponent.id,
    hostsOnOdd: orientedHosts(hostsOf, team.id, opponent.id),
  });

  for (const { roundIndex, a, b } of divisionRounds) {
    const [entryA, entryB] = [entryFor(a, b), entryFor(b, a)];
    if (roundIndex < 4) {
      partners.get(a.id)!.division[roundIndex] = entryA;
      partners.get(b.id)!.division[roundIndex] = entryB;
    } else {
      partners.get(a.id)!.divisionRival = entryA;
      partners.get(b.id)!.divisionRival = entryB;
    }
  }
  for (const { roundIndex, a, b } of conferenceRounds) {
    partners.get(a.id)!.conference[roundIndex] = entryFor(a, b);
    partners.get(b.id)!.conference[roundIndex] = entryFor(b, a);
  }
  for (const [a, b] of rivalPairs) {
    partners.get(a.id)!.nonConfRival = entryFor(a, b);
    partners.get(b.id)!.nonConfRival = entryFor(b, a);
  }

  return partners;
}

// This season's week for each of the D1-D4/DR and C1-C3 slots (0-indexed
// into the fixed-partner arrays), ported directly from the recovered
// formulas above.
function weekAssignments(season: number) {
  const t = (season * (season + 3)) / 2;
  const divisionWeekFor = {
    4: mod(t - 1, 4),
    6: mod(t - 4, 4),
    8: mod(t - 3, 4),
    10: mod(t - 2, 4),
  };
  const conferenceWeekFor = {
    7: mod(season - 1, 3),
    9: mod(season, 3),
    11: mod(season + 1, 3),
  };
  const nOrderSwapped = mod(Math.floor((season - 1) / 2), 2) === 1;
  return { divisionWeekFor, conferenceWeekFor, nOrderSwapped };
}

function rankWithinConference(
  teams: ScheduleTeam[],
  priorStandings: PriorStanding[]
): Map<string, number> {
  const rankByTeamId = new Map(priorStandings.map((s) => [s.teamId, s.conferenceRank]));
  const result = new Map<string, number>();
  const byConference = new Map<string, ScheduleTeam[]>();
  for (const t of teams) {
    if (!byConference.has(t.conferenceCode)) byConference.set(t.conferenceCode, []);
    byConference.get(t.conferenceCode)!.push(t);
  }
  for (const confTeams of byConference.values()) {
    const ordered = confTeams.slice().sort((a, b) => {
      const rankA = rankByTeamId.get(a.id) ?? 999;
      const rankB = rankByTeamId.get(b.id) ?? 999;
      return rankA - rankB || byName(a, b);
    });
    ordered.forEach((t, i) => result.set(t.id, i + 1));
  }
  return result;
}

// The 2 rank-seeded non-conference games: pair up the 6 conferences into 3
// cross-conference matchups (a round-robin among conferences themselves, one
// round per game so the pairing rotates every season too), then within each
// matched pair, seed team-ranked-Nth-in-conference-X against
// team-ranked-Nth-in-conference-Y.
function nonConferenceRankSeededGames(
  teams: ScheduleTeam[],
  priorStandings: PriorStanding[],
  season: number
): [ScheduledGame[], ScheduledGame[]] {
  const conferenceCodes = [...new Set(teams.map((t) => t.conferenceCode))].sort();
  const conferenceRounds = circleRoundRobin(conferenceCodes); // 5 rounds x 3 pairs, covers all 6 confs each round
  const round1 = conferenceRounds[mod(season - 1, conferenceRounds.length)];
  const round2 = conferenceRounds[mod(season, conferenceRounds.length)];

  const rankOf = rankWithinConference(teams, priorStandings);
  const teamsByConfAndRank = new Map<string, Map<number, ScheduleTeam>>();
  for (const t of teams) {
    const rank = rankOf.get(t.id)!;
    if (!teamsByConfAndRank.has(t.conferenceCode)) teamsByConfAndRank.set(t.conferenceCode, new Map());
    teamsByConfAndRank.get(t.conferenceCode)!.set(rank, t);
  }

  function pairsForRound(round: string[][]): [ScheduleTeam, ScheduleTeam][] {
    const pairs: [ScheduleTeam, ScheduleTeam][] = [];
    for (const [confA, confB] of round) {
      const poolA = teamsByConfAndRank.get(confA);
      const poolB = teamsByConfAndRank.get(confB);
      if (!poolA || !poolB) continue;
      const size = Math.min(poolA.size, poolB.size);
      for (let rank = 1; rank <= size; rank++) {
        const a = poolA.get(rank);
        const b = poolB.get(rank);
        if (a && b) pairs.push([a, b]);
      }
    }
    return pairs;
  }

  const pairs1 = pairsForRound(round1);
  const pairs2 = pairsForRound(round2);
  // Every team has exactly one game in round1 and one in round2, so the
  // combined pairing is a 2-regular graph (a union of disjoint cycles).
  // Walking each cycle and alternating "this team hosts the next edge" gives
  // every team EXACTLY one home and one away game — not just balanced on
  // average, but guaranteed, unlike a greedy pass that can still collide
  // when two already-hosting teams land on each other.
  const hostsOf = orientCycleAlternating(pairs1, pairs2);
  const toGames = (pairs: [ScheduleTeam, ScheduleTeam][], week: number): ScheduledGame[] =>
    pairs.map(([a, b]) => {
      const aHome = orientedHosts(hostsOf, a.id, b.id);
      return { week, awayTeamId: aHome ? b.id : a.id, homeTeamId: aHome ? a.id : b.id };
    });

  return [toGames(pairs1, 3), toGames(pairs2, 5)];
}

export function generateRegularSeasonSchedule(
  teams: ScheduleTeam[],
  fcsTeamId: string,
  seasonNumber: number,
  priorStandings: PriorStanding[] = []
): ScheduledGame[] {
  const games: ScheduledGame[] = [];
  const partners = buildFixedPartners(teams);
  const { divisionWeekFor, conferenceWeekFor, nOrderSwapped } = weekAssignments(seasonNumber);

  const addFixedGame = (week: number, teamId: string, opponent: FixedOpponent) => {
    // Only add once per pair (skip if we already added it from the other side).
    if (
      games.some(
        (g) =>
          g.week === week &&
          ((g.awayTeamId === teamId && g.homeTeamId === opponent.teamId) ||
            (g.awayTeamId === opponent.teamId && g.homeTeamId === teamId))
      )
    ) {
      return;
    }
    const teamHome = opponent.hostsOnOdd === (seasonNumber % 2 === 1);
    games.push({
      week,
      awayTeamId: teamHome ? opponent.teamId : teamId,
      homeTeamId: teamHome ? teamId : opponent.teamId,
    });
  };

  for (const team of teams) {
    const fixed = partners.get(team.id)!;

    // week1: R (fixed cross-conference rival)
    addFixedGame(1, team.id, fixed.nonConfRival);
    // week12: DR (division rivalry, always the finale)
    addFixedGame(12, team.id, fixed.divisionRival);
    // weeks 4/6/8/10: D1-D4, order rotates by season
    for (const [week, slot] of Object.entries(divisionWeekFor)) {
      addFixedGame(Number(week), team.id, fixed.division[slot]);
    }
    // weeks 7/9/11: C1-C3, order rotates by season
    for (const [week, slot] of Object.entries(conferenceWeekFor)) {
      addFixedGame(Number(week), team.id, fixed.conference[slot]);
    }
    // week2: F (FCS cupcake) -- always a home game, matching the real sport's
    // "money game" convention, and no scheduling conflict since FCS isn't
    // degree-limited like a real opponent.
    games.push({
      week: 2,
      awayTeamId: fcsTeamId,
      homeTeamId: team.id,
    });
  }

  // weeks 3/5: N1/N2 (rank-seeded non-conference, order swaps by season)
  const [firstNGames, secondNGames] = nonConferenceRankSeededGames(teams, priorStandings, seasonNumber);
  if (nOrderSwapped) {
    games.push(...firstNGames.map((g) => ({ ...g, week: 5 })), ...secondNGames.map((g) => ({ ...g, week: 3 })));
  } else {
    games.push(...firstNGames, ...secondNGames);
  }

  breakLongHomeStreaks(games, teams, fcsTeamId);

  return games;
}

// Every category above (division/conference/rival/N-games) is balanced on
// its own, but they're independently decided, so a team can still end up
// with several different categories' home games landing in adjacent weeks
// by coincidence. This final pass catches that directly: scan each team's
// week-ordered schedule for a run of 6+ consecutive home games and flip one
// (non-FCS) game inside the run — repeating until no run is too long, which
// converges quickly since long runs are rare once the per-category balance
// above is in place.
const MAX_HOME_STREAK = 5;

function breakLongHomeStreaks(games: ScheduledGame[], teams: ScheduleTeam[], fcsTeamId: string): void {
  for (let pass = 0; pass < 50; pass++) {
    let flippedAny = false;
    for (const team of teams) {
      const teamGames = games
        .map((g, index) => ({ g, index }))
        .filter(({ g }) => g.awayTeamId === team.id || g.homeTeamId === team.id)
        .sort((a, b) => a.g.week - b.g.week);

      let runStart = -1;
      for (let i = 0; i <= teamGames.length; i++) {
        const isHome = i < teamGames.length && teamGames[i].g.homeTeamId === team.id;
        if (isHome) {
          if (runStart === -1) runStart = i;
          continue;
        }
        const runLength = runStart === -1 ? 0 : i - runStart;
        if (runLength > MAX_HOME_STREAK) {
          for (let k = runStart; k < i; k++) {
            const candidate = teamGames[k].g;
            if (candidate.awayTeamId === fcsTeamId || candidate.homeTeamId === fcsTeamId) continue;
            const game = games[teamGames[k].index];
            [game.awayTeamId, game.homeTeamId] = [game.homeTeamId, game.awayTeamId];
            flippedAny = true;
            break;
          }
        }
        runStart = -1;
      }
    }
    if (!flippedAny) return;
  }
}
