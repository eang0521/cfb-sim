// Game simulation, ported from `SeasonGen` (the workbook's live per-game
// calculator — columns V through AR for a single matchup).

import { binomInv, possessionDie, type Rand } from "./rng";

export interface TeamGameInput {
  offRating: number;
  defRating: number;
  // The team's overall power rating entering this game -- drives the
  // strength term in both awayEloDelta and neutralEloDelta. Optional only
  // because the synthetic FCS opponent has no persisted rating and instead
  // supplies an ad hoc stand-in each game (see rollFcsRating); every real
  // team always has one, so this defaults to 0 purely for type-safety and
  // that fallback should never actually be exercised.
  powerElo?: number;
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
// H/O are the away/home scores. The workbook's N/G columns were pasted
// OFFENSE ratings, but that was a porting mistake -- the live formula this
// was meant to mirror grades the strength term off each side's overall power
// rating ENTERING the game, not just its offense (a stout defense dragging a
// team's rating up/down should matter here too). This is always computed
// from the away team's perspective; home's change is simply the negation
// (SeasonGen!AP2 = 0-AO2). Because of that, the formula is NOT symmetric by
// winner: a win on the road nets 2 more rating points than a win at home of
// the same margin/power-rating gap (and a loss at home costs 2 fewer than
// the same loss on the road), and the strength term is always "home power
// rating minus away power rating" regardless of who wins.
export function awayEloDelta(
  awayScore: number,
  homeScore: number,
  awayPowerElo: number,
  homePowerElo: number
): number {
  const margin = awayScore - homeScore;
  return 1 + Math.sign(margin) * 15 + Math.trunc((homePowerElo - awayPowerElo) / 10) + Math.trunc(margin / 5);
}

// Same formula, but evaluated from the WINNER's perspective instead of the
// away team's, so a neutral-site game (conference championships, every
// playoff round, every bowl) carries no home/away-shaped bonus at all --
// there's no real home-field edge to reflect on a neutral field, so neither
// side should get the away-formula's road-win bonus or take the (equally
// arbitrary) home-loss discount.
//
// The strength-gap term is the LOSER's power rating minus the WINNER's --
// backwards from what you'd naively expect -- so that beating a team that
// was rated ABOVE you (an upset) adds to your gain, while beating a team
// rated BELOW you (chalk) subtracts from it. That's deliberate: awayEloDelta
// already has this property too (its "home minus away" gap term resolves to
// exactly this loser-minus-winner shape once you negate for whichever side
// didn't win), so both formulas reward beating a stronger team more than
// beating a weaker one, never the reverse.
export function neutralEloDelta(
  awayScore: number,
  homeScore: number,
  awayPowerElo: number,
  homePowerElo: number
): number {
  const margin = awayScore - homeScore;
  const awayWon = margin > 0;
  const winnerPowerElo = awayWon ? awayPowerElo : homePowerElo;
  const loserPowerElo = awayWon ? homePowerElo : awayPowerElo;
  const winnerDelta = 1 + 15 + Math.trunc((loserPowerElo - winnerPowerElo) / 10) + Math.trunc(Math.abs(margin) / 5);
  return awayWon ? winnerDelta : -winnerDelta;
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

  const eloChangeAway = neutralSite
    ? neutralEloDelta(awayScore, homeScore, away.powerElo ?? 0, home.powerElo ?? 0)
    : awayEloDelta(awayScore, homeScore, away.powerElo ?? 0, home.powerElo ?? 0);
  const eloChangeHome = -eloChangeAway;

  return { awayScore, homeScore, otPeriods, eloChangeAway, eloChangeHome };
}
