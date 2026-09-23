// Pre-game win-odds estimate for display only (see the "Settings" page's
// "show win odds" toggle) -- never touches the real per-game RNG stream, and
// never influences an actual simulated result.

import { simulateGame, type TeamGameInput } from "./game";

const DEFAULT_TRIALS = 500;

// FNV-1a-ish string hash -> 32-bit seed, so a given game always seeds the
// same private PRNG. Combined with a deterministic `trials` count, the same
// two teams' ratings + the same seedKey always produce the SAME odds -- the
// display doesn't jitter on every page reload the way a fresh Math.random
// draw per render would.
function hashSeed(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface WinProbability {
  awayWinPct: number; // 0-1
  homeWinPct: number; // 0-1
}

// Monte Carlo estimate, using the exact same simulateGame the real result
// will eventually come from (so the odds reflect exactly the mechanics that
// will decide the game), run on a private deterministically-seeded RNG keyed
// off `seedKey` (pass the game's id) -- see hashSeed/mulberry32 above.
export function estimateWinProbability(
  away: TeamGameInput,
  home: TeamGameInput,
  neutralSite: boolean,
  seedKey: string,
  trials = DEFAULT_TRIALS
): WinProbability {
  const rand = mulberry32(hashSeed(seedKey));
  let awayWins = 0;
  for (let i = 0; i < trials; i++) {
    const result = simulateGame(away, home, rand, neutralSite);
    if (result.awayScore > result.homeScore) awayWins++;
  }
  const awayWinPct = awayWins / trials;
  return { awayWinPct, homeWinPct: 1 - awayWinPct };
}
