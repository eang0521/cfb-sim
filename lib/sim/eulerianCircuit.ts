// Generic graph-orientation helper used by the MEGA144 schedule generator to
// guarantee an EXACT home/away split.
//
// Classical result: any connected graph where every vertex has EVEN degree
// admits an orientation where every vertex's in-degree equals its
// out-degree (exactly half its total degree). Proof/construction: walk an
// Eulerian circuit (a closed tour using every edge exactly once -- always
// possible in an all-even-degree connected graph) and orient each edge along
// the direction it was traversed. Every time the walk passes through a
// vertex it enters via one edge and exits via another, so a vertex visited
// k times contributes exactly k in-edges and k out-edges; since its degree
// is 2k, that's an exact 50/50 split.
//
// Used with "in = home, out = away": a MEGA144 team's combined 8 division +
// conference games form exactly this kind of graph (every vertex/team has
// degree 8), so orienting along an Eulerian circuit guarantees exactly 4
// home + 4 away for every team, every season, unconditionally.

export interface EulerianEdge {
  id: string;
  a: string;
  b: string;
}

export interface OrientedEdge {
  id: string;
  away: string;
  home: string;
}

interface AdjEntry {
  edgeId: string;
  other: string;
}

// `preferredHost`, if given, maps edgeId -> the team that should host that
// edge WHEN POSSIBLE. This is a soft bias on which unused edge the walk
// consumes first at a given vertex -- any choice among unused edges still
// yields a fully valid Eulerian circuit (and therefore an exact-degree
// orientation), so this can never break correctness. It's best-effort: with
// several preferences active at once, some may not be satisfiable together
// (see lib/sim/schedule144.ts), and this makes no attempt to detect or
// resolve that -- it just tends to honor more of them than an unbiased walk.
export function findEulerianOrientation(edges: EulerianEdge[], preferredHost?: Map<string, string>): OrientedEdge[] {
  if (edges.length === 0) return [];

  const adj = new Map<string, AdjEntry[]>();
  const addAdj = (v: string, edgeId: string, other: string) => {
    if (!adj.has(v)) adj.set(v, []);
    adj.get(v)!.push({ edgeId, other });
  };
  for (const e of edges) {
    addAdj(e.a, e.id, e.b);
    addAdj(e.b, e.id, e.a);
  }

  if (preferredHost) {
    // For vertex v's adjacency list: an edge where the OTHER endpoint should
    // host is "good to consume now" (v would be the visitor, as desired) --
    // sort those first. An edge where v itself should host is "bad to
    // consume now" -- sort those last, hoping the walk instead reaches this
    // edge from the other endpoint first.
    for (const [v, list] of adj) {
      list.sort((x, y) => score(v, x) - score(v, y));
    }
    function score(v: string, entry: AdjEntry): number {
      const wantsHost = preferredHost!.get(entry.edgeId);
      if (!wantsHost) return 0;
      return wantsHost === entry.other ? -1 : 1;
    }
  }

  const usedEdge = new Set<string>();
  const ptr = new Map<string, number>();
  for (const v of adj.keys()) ptr.set(v, 0);

  function popUnusedNeighbor(v: string): AdjEntry | null {
    const list = adj.get(v) ?? [];
    let i = ptr.get(v) ?? 0;
    while (i < list.length && usedEdge.has(list[i].edgeId)) i++;
    ptr.set(v, i);
    if (i >= list.length) return null;
    usedEdge.add(list[i].edgeId);
    return list[i];
  }

  // Iterative Hierholzer: walk from an arbitrary start vertex, backtracking
  // (popping) whenever the current vertex has no unused edges left, and
  // recording each edge id in the order it's "closed off" (i.e. reverse
  // traversal order) -- standard stack-based formulation, correct for any
  // connected, all-even-degree graph regardless of which unused edge is
  // picked at each step.
  const startVertex = edges[0].a;
  const vertexStack: string[] = [startVertex];
  const arrivedVia: (string | null)[] = [null];
  const circuitEdgesReversed: string[] = [];

  while (vertexStack.length > 0) {
    const v = vertexStack[vertexStack.length - 1];
    const next = popUnusedNeighbor(v);
    if (next) {
      vertexStack.push(next.other);
      arrivedVia.push(next.edgeId);
    } else {
      vertexStack.pop();
      const viaEdge = arrivedVia.pop()!;
      if (viaEdge) circuitEdgesReversed.push(viaEdge);
    }
  }

  const circuitEdgeIds = circuitEdgesReversed.reverse();
  const edgeById = new Map(edges.map((e) => [e.id, e]));

  const oriented: OrientedEdge[] = [];
  let current = startVertex;
  for (const edgeId of circuitEdgeIds) {
    const edge = edgeById.get(edgeId)!;
    const next = edge.a === current ? edge.b : edge.a;
    oriented.push({ id: edgeId, away: current, home: next });
    current = next;
  }

  return oriented;
}
