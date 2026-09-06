import { describe, expect, it } from "vitest";
import { generatePlayerName } from "./names";

describe("generatePlayerName", () => {
  it("produces a 'First Last' formatted name", () => {
    const name = generatePlayerName(Math.random);
    expect(name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });

  it("produces a wide variety of names (not just a handful of repeats)", () => {
    const names = new Set<string>();
    for (let i = 0; i < 500; i++) names.add(generatePlayerName(Math.random));
    expect(names.size).toBeGreaterThan(400);
  });
});
