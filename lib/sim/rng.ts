// Core RNG primitives ported from the workbook's formulas.
// Every function here is pure and takes a `rand: () => number` source
// (defaults to Math.random) so tests can inject a seeded/deterministic PRNG.

export type Rand = () => number;

export function d6(rand: Rand = Math.random): number {
  return Math.floor(rand() * 6) + 1;
}

export function randBetween(min: number, max: number, rand: Rand = Math.random): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function choose<T>(index1Based: number, options: T[]): T {
  return options[index1Based - 1];
}

// The workbook's `CoinGeom` named range: column A is a cumulative-probability
// ladder (0, 0.5, 0.75, 0.875, ... approaching 1 via A(n) = (1+A(n-1))/2),
// column B is the value returned (0, 1, 2, 3, ...). `VLOOKUP(RAND(), CoinGeom, 2)`
// does an approximate-match lookup: it returns the B value of the largest A
// that is <= the random draw, which gives P(X=k) = 2^-(k+1) for k=0,1,2,...
// — a Geometric(p=0.5) distribution starting at 0, mean 1. Computed here in
// closed form instead of building the 41-row table; same probabilities.
export function coinGeom(rand: Rand = Math.random): number {
  const r = rand();
  if (r < 0.5) return 0;
  // A(n) = 1 - 0.5^n for n >= 1 (A1=0 is n=0). Largest n with A(n) <= r:
  const n = Math.floor(-Math.log2(1 - r));
  return n;
}

// Weighted d6 used for possession counts. Deliberately diverges from the
// sheet's original CHOOSE(RANDBETWEEN(1,6),1,2,2,2,3,4) -- capping the top
// face at 3 instead of 4 trims the high-possession tail, pulling expected
// possessions per team down from 4*(14/6)~9.33 to 4*(13/6)~8.67 (~7% fewer)
// and, downstream, shrinking average scores and score variance by roughly
// that same ~7% without changing home-field advantage in relative terms.
const POSSESSION_DIE = [1, 2, 2, 2, 3, 3];
export function possessionDie(rand: Rand = Math.random): number {
  return choose(randBetween(1, 6, rand), POSSESSION_DIE);
}

// Standard Box-Muller transform -- two independent U(0,1) draws collapsed
// into a single N(mean, stdev) sample (only the cosine branch is used,
// since one normal draw is all any caller here needs; the paired sine
// branch is simply discarded). `rand()` returning exactly 0 would make
// log(0) = -Infinity, so it's floored to Number.EPSILON first.
export function normal(mean: number, stdev: number, rand: Rand = Math.random): number {
  const u1 = Math.max(rand(), Number.EPSILON);
  const u2 = rand();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + stdev * z;
}

// BINOM.INV(trials, probability, rand) — smallest k such that the binomial
// CDF at k is >= rand. Excel/Sheets' inverse-binomial function.
export function binomInv(trials: number, probability: number, rand: Rand = Math.random): number {
  const n = Math.max(0, Math.round(trials));
  const p = Math.min(Math.max(probability, 0), 1);
  if (n === 0) return 0;
  if (p === 0) return 0;
  if (p === 1) return n;

  const r = rand();
  const q = 1 - p;
  let term = Math.pow(q, n); // P(X = 0)
  let cumulative = term;
  if (cumulative >= r) return 0;
  for (let k = 0; k < n; k++) {
    term *= ((n - k) / (k + 1)) * (p / q);
    cumulative += term;
    if (cumulative >= r) return k + 1;
  }
  return n;
}
