import { describe, expect, it } from "vitest";
import { binomInv, coinGeom, possessionDie, randBetween } from "./rng";

function seeded(sequence: number[]): () => number {
  let i = 0;
  return () => sequence[i++ % sequence.length];
}

describe("coinGeom", () => {
  it("matches the CoinGeom VLOOKUP table's boundaries", () => {
    expect(coinGeom(seeded([0]))).toBe(0);
    expect(coinGeom(seeded([0.4999]))).toBe(0);
    expect(coinGeom(seeded([0.5]))).toBe(1);
    expect(coinGeom(seeded([0.74]))).toBe(1);
    expect(coinGeom(seeded([0.75]))).toBe(2);
    expect(coinGeom(seeded([0.875]))).toBe(3);
  });

  it("has a mean around 1 (geometric, p=0.5, matches sheet's implied distribution)", () => {
    let total = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) total += coinGeom(Math.random);
    expect(total / n).toBeGreaterThan(0.85);
    expect(total / n).toBeLessThan(1.15);
  });
});

describe("randBetween", () => {
  it("stays within bounds inclusive", () => {
    for (let i = 0; i < 100; i++) {
      const v = randBetween(1, 6, Math.random);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });
});

describe("possessionDie", () => {
  it("only produces values from the weighted table [1,2,2,2,3,4]", () => {
    for (let i = 0; i < 100; i++) {
      const v = possessionDie(Math.random);
      expect([1, 2, 3, 4]).toContain(v);
    }
  });
});

describe("binomInv", () => {
  it("returns 0 for probability 0 and n for probability 1", () => {
    expect(binomInv(10, 0, Math.random)).toBe(0);
    expect(binomInv(10, 1, Math.random)).toBe(10);
  });

  it("returns 0 trials for 0 trials", () => {
    expect(binomInv(0, 0.5, Math.random)).toBe(0);
  });

  it("averages close to n*p over many draws", () => {
    const n = 12;
    const p = 0.5;
    let total = 0;
    const trials = 5000;
    for (let i = 0; i < trials; i++) total += binomInv(n, p, Math.random);
    const mean = total / trials;
    expect(mean).toBeGreaterThan(n * p - 0.3);
    expect(mean).toBeLessThan(n * p + 0.3);
  });
});
