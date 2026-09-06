// Pairs off a list of items while never pairing two from the same group
// (e.g. conference). Uses a most-constrained-first heuristic (pair whoever
// has the fewest valid cross-group partners left before they run out of
// options) rather than naive front-to-back pairing, which can paint itself
// into an all-one-group corner near the end of the list.
export function pairAvoidingSameGroup<T>(items: T[], groupKey: (item: T) => string): [T, T][] {
  const remaining = items.slice();
  const pairs: [T, T][] = [];
  while (remaining.length >= 2) {
    let bestIndex = 0;
    let bestOptionCount = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const optionCount = remaining.filter((t, j) => j !== i && groupKey(t) !== groupKey(remaining[i])).length;
      if (optionCount < bestOptionCount) {
        bestOptionCount = optionCount;
        bestIndex = i;
      }
    }
    const a = remaining.splice(bestIndex, 1)[0];
    let opponentIndex = remaining.findIndex((t) => groupKey(t) !== groupKey(a));
    if (opponentIndex === -1) opponentIndex = 0; // every remaining item is one group; unavoidable
    const b = remaining.splice(opponentIndex, 1)[0];
    pairs.push([a, b]);
  }
  return pairs;
}

export interface HasConference {
  teamId: string;
  team: { conferenceId: string };
}

// Convenience wrapper for the bowl-selection shape (see lib/dynasty/bowls.ts).
export function pairAvoidingSameConference<T extends HasConference>(teams: T[]): [T, T][] {
  return pairAvoidingSameGroup(teams, (t) => t.team.conferenceId);
}
