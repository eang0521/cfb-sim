// Game simulation, ported from `SeasonGen` (the workbook's live per-game
// calculator — columns V through AR for a single matchup).

import { binomInv, possessionDie, type Rand } from "./rng";

export interface TeamGameInput {
  offRating: number;
  defRating: number;
}

export interface GameResult {
  awayScore: number;
  homeScore: number;
  otPeriods: number;
  eloChangeAway: number;
  eloChangeHome: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// SeasonGen!V2 = 4x CHOOSE(RANDBETWEEN(1,6),1,2,2,2,3,4)
function possessions(rand: Rand): number {
  return possessionDie(rand) + possessionDie(rand) + possessionDie(rand) + possessionDie(rand);
}

// SeasonGen!W2 = MEDIAN(5,95, 47 + AwayOff - HomeDef)  [53 baseline for home]
function scoreRate(baseline: number, offense: number, defense: number): number {
  return clamp(baseline + offense - defense, 5, 95);
}

interface RegulationResult {
  poss: number;
  rate: number;
  scores: number;
  fgs: number;
  points: number;
}

function simulateRegulation(baseline: number, offense: number, defense: number, rand: Rand): RegulationResult {
  const poss = possessions(rand);
  const rate = scoreRate(baseline, offense, defense);
  const scores = binomInv(poss, rate / 100, rand);
  // SeasonGen!Y2 = BINOM.INV(scores, CEILING(rate/4,1)/rate, rand) — fraction of
  // scores that are field goals rather than touchdowns.
  const fgProbability = Math.ceil(rate / 4) / rate;
  const fgs = binomInv(scores, fgProbability, rand);
  const points = fgs * 3 + (scores - fgs) * 7;
  return { poss, rate, scores, fgs, points };
}

// One overtime possession: field-goal-only scoring uses the same rate/FG-split
// logic as regulation, matching SeasonGen!AG:AN. From round 3 on, a touchdown
// must go for 2 rather than the extra point (real NCAA OT rules).
function simulateOtPossession(rate: number, roundIndex: number, rand: Rand): number {
  const scored = binomInv(1, rate / 100, rand);
  if (!scored) return 0;
  const isFg = binomInv(1, Math.ceil(rate / 4) / rate, rand) === 1;
  if (roundIndex < 3) {
    return isFg ? 3 : 7;
  }
  return isFg ? 3 : 6 + (rand() < 0.5 ? 0 : 2);
}

function simulateOt(awayRate: number, homeRate: number, rand: Rand): { away: number; home: number; periods: number } {
  let away = 0;
  let home = 0;
  let round = 1;
  const MAX_ROUNDS = 3;
  while (round <= MAX_ROUNDS) {
    const roundAway = simulateOtPossession(awayRate, round, rand);
    const roundHome = simulateOtPossession(homeRate, round, rand);
    away += roundAway;
    home += roundHome;
    if (roundAway !== roundHome) {
      return { away, home, periods: round };
    }
    round++;
  }
  // Still tied after 3 OTs: sudden-death 2-point-conversion coin flip, as the
  // sheet's AM/AN columns do (`RANDBETWEEN(0,1)*2`).
  if (rand() < 0.5) {
    away += 2;
  } else {
    home += 2;
  }
  return { away, home, periods: MAX_ROUNDS };
}

// SeasonGen!AO2 = 1 + SIGN(H-O)*15 + TRUNC((N-G)/10) + TRUNC((H-O)/5), where
// H/O are the away/home scores and N/G are the home/away offense ratings.
// This is always computed from the away team's perspective; home's change is
// simply the negation (SeasonGen!AP2 = 0-AO2). Because of that, the formula
// is NOT symmetric by winner: a win on the road nets 2 more rating points
// than a win at home of the same margin/offense gap (and a loss at home
// costs 2 fewer than the same loss on the road), and the offense-strength
// term is always "home offense minus away offense" regardless of who wins.
function awayEloDelta(awayScore: number, homeScore: number, awayOffense: number, homeOffense: number): number {
  const margin = awayScore - homeScore;
  return 1 + Math.sign(margin) * 15 + Math.trunc((homeOffense - awayOffense) / 10) + Math.trunc(margin / 5);
}

// Conference championships, playoff rounds, and bowls are all played at a
// neutral site — no home-field edge, so both sides use the same 50 baseline
// instead of the usual 47 (away) / 53 (home) split.
export function simulateGame(
  away: TeamGameInput,
  home: TeamGameInput,
  rand: Rand = Math.random,
  neutralSite = false
): GameResult {
  const awayBaseline = neutralSite ? 50 : 47;
  const homeBaseline = neutralSite ? 50 : 53;
  const awayReg = simulateRegulation(awayBaseline, away.offRating, home.defRating, rand);
  const homeReg = simulateRegulation(homeBaseline, home.offRating, away.defRating, rand);

  let awayScore = awayReg.points;
  let homeScore = homeReg.points;
  let otPeriods = 0;

  if (awayScore === homeScore) {
    const ot = simulateOt(awayReg.rate, homeReg.rate, rand);
    awayScore += ot.away;
    homeScore += ot.home;
    otPeriods = ot.periods;
  }

  const eloChangeAway = awayEloDelta(awayScore, homeScore, away.offRating, home.offRating);
  const eloChangeHome = -eloChangeAway;

  return { awayScore, homeScore, otPeriods, eloChangeAway, eloChangeHome };
}
