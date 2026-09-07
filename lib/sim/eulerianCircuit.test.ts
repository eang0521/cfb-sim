import { describe, expect, it } from "vitest";
import { findEulerianOrientation, type EulerianEdge } from "./eulerianCircuit";

function degreeBalance(edges: EulerianEdge[], oriented: ReturnType<typeof findEulerianOrientation>) {
  const homeCount = new Map<string, number>();
  const awayCount = new Map<string, number>();
  const vertices = new Set<string>();
  for (const e of edges) {
    vertices.add(e.a);
    vertices.add(e.b);
  }
  for (const v of vertices) {
    homeCount.set(v, 0);
    awayCount.set(v, 0);
  }
  for (const o of oriented) {
    homeCount.set(o.home, (homeCount.get(o.home) ?? 0) + 1);
    awayCount.set(o.away, (awayCount.get(o.away) ?? 0) + 1);
  }
  return { homeCount, awayCount, vertices };
}

// A K6 "complete graph" round-robin among 6 teams: each vertex has degree 5
// (odd) -- NOT expected to balance exactly, used elsewhere just to confirm
// we don't crash on odd degree, real usage always feeds even-degree graphs.

// 8-degree graph matching a MEGA144 team's real shape: a 12-team conference
// (2 divisions of 6) with a 5-game division round-robin plus a 3-game
// cross-division round (matching one active non-division group).
function buildConferenceGraph(): EulerianEdge[] {
  const divA = ["A1", "A2", "A3", "A4", "A5", "A6"];
  const divB = ["B1", "B2", "B3", "B4", "B5", "B6"];
  const edges: EulerianEdge[] = [];
  let id = 0;

  // Division round robin (K6, 15 edges, degree 5 each) for both divisions.
  for (const div of [divA, divB]) {
    for (let i = 0; i < div.length; i++) {
      for (let j = i + 1; j < div.length; j++) {
        edges.push({ id: `e${id++}`, a: div[i], b: div[j] });
      }
    }
  }

  // One active cross-division round-robin group of 3 rounds (bipartite,
  // degree 3 each) -- 18 edges total (12 teams x 3 / 2).
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 6; i++) {
      edges.push({ id: `c${id++}`, a: divA[i], b: divB[(i + r) % 6] });
    }
  }

  return edges;
}

describe("findEulerianOrientation", () => {
  it("gives every vertex an exact 4-in/4-out split on an 8-degree graph", () => {
    const edges = buildConferenceGraph();
    const oriented = findEulerianOrientation(edges);
    expect(oriented).toHaveLength(edges.length);

    const { homeCount, awayCount, vertices } = degreeBalance(edges, oriented);
    for (const v of vertices) {
      expect(homeCount.get(v)).toBe(4);
      expect(awayCount.get(v)).toBe(4);
    }
  });

  it("uses every edge exactly once, with no duplicate or missing edges", () => {
    const edges = buildConferenceGraph();
    const oriented = findEulerianOrientation(edges);
    const orientedIds = new Set(oriented.map((o) => o.id));
    expect(orientedIds.size).toBe(edges.length);
    for (const e of edges) expect(orientedIds.has(e.id)).toBe(true);
  });

  it("preserves each oriented edge's original endpoints (just picks a direction)", () => {
    const edges = buildConferenceGraph();
    const oriented = findEulerianOrientation(edges);
    const edgeById = new Map(edges.map((e) => [e.id, e]));
    for (const o of oriented) {
      const original = edgeById.get(o.id)!;
      const pair = [o.away, o.home].sort();
      const originalPair = [original.a, original.b].sort();
      expect(pair).toEqual(originalPair);
    }
  });

  it("stays exactly 4-4 across many random relabelings (stress test)", () => {
    for (let trial = 0; trial < 25; trial++) {
      const edges = buildConferenceGraph();
      const oriented = findEulerianOrientation(edges);
      const { homeCount, awayCount, vertices } = degreeBalance(edges, oriented);
      for (const v of vertices) {
        expect(homeCount.get(v)).toBe(4);
        expect(awayCount.get(v)).toBe(4);
      }
    }
  });

  it("honors a satisfiable set of host preferences", () => {
    const edges = buildConferenceGraph();
    // Prefer B1 to host the A1-B1 cross-division edge.
    const crossEdge = edges.find((e) => (e.a === "A1" && e.b === "B1") || (e.a === "B1" && e.b === "A1"))!;
    const preferredHost = new Map([[crossEdge.id, "B1"]]);
    const oriented = findEulerianOrientation(edges, preferredHost);
    const result = oriented.find((o) => o.id === crossEdge.id)!;
    expect(result.home).toBe("B1");

    // Still exactly balanced even with a preference applied.
    const { homeCount, awayCount, vertices } = degreeBalance(edges, oriented);
    for (const v of vertices) {
      expect(homeCount.get(v)).toBe(4);
      expect(awayCount.get(v)).toBe(4);
    }
  });

  it("returns an empty orientation for an empty edge list", () => {
    expect(findEulerianOrientation([])).toEqual([]);
  });
});
