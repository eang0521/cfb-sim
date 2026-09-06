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

// Weighted d6 used for possession counts: CHOOSE(RANDBETWEEN(1,6),1,2,2,2,3,4)
const POSSESSION_DIE = [1, 2, 2, 2, 3, 4];
export function possessionDie(rand: Rand = Math.random): number {
  return choose(randBetween(1, 6, rand), POSSESSION_DIE);
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
