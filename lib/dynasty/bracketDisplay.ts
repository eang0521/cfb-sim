// Resolves a playoff field's persisted seeds + whatever bracket games exist
// so far into a fully-drawn, two-sided bracket shape (every slot present
// from the day the field is set, filling in round by round as games are
// created/played) -- one LEFT side and one RIGHT side, each narrowing
// toward the FINAL in the middle, like a real tournament bracket.
//
// Round 1 (the first round actually shown -- FIRST_ROUND for the 12-team
// MEGA144 field, QUARTERFINAL for the 6-team CLASSIC field) is always fully
// known from seeding alone: neither side depends on another game's result.
// Every later round has at least one side that's a "winner of" reference --
// unresolved until that feeding game is both created and played, at which
// point it resolves via the actual `Game` row (not by presumed favorite).
//
// Winner references are by MATCH POSITION (round + index within that
// round), not by a fixed seed number: a semifinal's participants are
// whichever quarterfinal winners show up, and a bye seed is NOT guaranteed
// to be one of them (upsets happen -- all four bye seeds losing their
// quarterfinal in the same bracket is a real, if rare, outcome). Matches
// are resolved in the shape array's order, which is topological (a round
// only ever references an EARLIER round), so by the time a "winner of"
// reference is looked up, that match's own result has already been
// computed.

export type BracketRoundName = "FIRST_ROUND" | "QUARTERFINAL" | "SEMIFINAL" | "FINAL";
export type BracketHalf = "left" | "right";

export interface BracketTeamInfo {
  teamId: string;
  name: string;
  seed: number;
}

export interface BracketSide {
  team: BracketTeamInfo | null; // null = not decided yet (shown as TBD)
  score: number | null;
  winner: boolean;
}

export interface BracketMatchDisplay {
  round: BracketRoundName;
  gameId: string | null; // null if this round's games haven't been created yet
  played: boolean;
  away: BracketSide;
  home: BracketSide;
}

interface SlotSeed {
  seed: number;
}
interface SlotWinner {
  round: BracketRoundName;
  index: number; // position of the feeding match within that round (shape-array order, 0-based)
}
type Slot = SlotSeed | SlotWinner;

interface MatchShape {
  round: BracketRoundName;
  away: Slot;
  home: Slot;
  half: BracketHalf | "center"; // "center" only for FINAL
}

function isSeedSlot(slot: Slot): slot is SlotSeed {
  return "seed" in slot;
}

// Authored so every round's entries group left-half first, then right-half
// -- byeFirstColumn below relies on each half's bye seeds and first-round
// games appearing in the same relative (ascending-seed) order within their
// half, so they interleave 1:1 without needing any extra bookkeeping.
const SHAPE_12: MatchShape[] = [
  { round: "FIRST_ROUND", away: { seed: 8 }, home: { seed: 9 }, half: "left" }, // index 0 -- feeds seed 1's quarterfinal
  { round: "FIRST_ROUND", away: { seed: 5 }, home: { seed: 12 }, half: "left" }, // index 1 -- feeds seed 4's quarterfinal
  { round: "FIRST_ROUND", away: { seed: 7 }, home: { seed: 10 }, half: "right" }, // index 2 -- feeds seed 2's quarterfinal
  { round: "FIRST_ROUND", away: { seed: 6 }, home: { seed: 11 }, half: "right" }, // index 3 -- feeds seed 3's quarterfinal
  { round: "QUARTERFINAL", away: { seed: 1 }, home: { round: "FIRST_ROUND", index: 0 }, half: "left" }, // index 0
  { round: "QUARTERFINAL", away: { seed: 4 }, home: { round: "FIRST_ROUND", index: 1 }, half: "left" }, // index 1
  { round: "QUARTERFINAL", away: { seed: 2 }, home: { round: "FIRST_ROUND", index: 2 }, half: "right" }, // index 2
  { round: "QUARTERFINAL", away: { seed: 3 }, home: { round: "FIRST_ROUND", index: 3 }, half: "right" }, // index 3
  { round: "SEMIFINAL", away: { round: "QUARTERFINAL", index: 0 }, home: { round: "QUARTERFINAL", index: 1 }, half: "left" }, // index 0
  { round: "SEMIFINAL", away: { round: "QUARTERFINAL", index: 2 }, home: { round: "QUARTERFINAL", index: 3 }, half: "right" }, // index 1
  { round: "FINAL", away: { round: "SEMIFINAL", index: 0 }, home: { round: "SEMIFINAL", index: 1 }, half: "center" },
];

const SHAPE_6: MatchShape[] = [
  { round: "QUARTERFINAL", away: { seed: 4 }, home: { seed: 5 }, half: "left" }, // index 0 -- feeds seed 1's semifinal
  { round: "QUARTERFINAL", away: { seed: 3 }, home: { seed: 6 }, half: "right" }, // index 1 -- feeds seed 2's semifinal
  { round: "SEMIFINAL", away: { seed: 1 }, home: { round: "QUARTERFINAL", index: 0 }, half: "left" }, // index 0
  { round: "SEMIFINAL", away: { seed: 2 }, home: { round: "QUARTERFINAL", index: 1 }, half: "right" }, // index 1
  { round: "FINAL", away: { round: "SEMIFINAL", index: 0 }, home: { round: "SEMIFINAL", index: 1 }, half: "center" },
];

export interface BracketGameInput {
  id: string;
  round: string;
  awayTeamId: string;
  homeTeamId: string;
  awayScore: number | null;
  homeScore: number | null;
  played: boolean;
}

export interface BracketSeedInput {
  teamId: string;
  seed: number;
  name: string;
}

export interface BracketColumn {
  round: BracketRoundName;
  matches: BracketMatchDisplay[];
}

export interface BracketHalfDisplay {
  // Every slot at the "entry level," in top-to-bottom display order, one
  // per bye seed interleaved with the game whose winner joins it next round.
  firstColumn: ({ type: "bye"; team: BracketTeamInfo } | { type: "game"; match: BracketMatchDisplay })[];
  // Rounds strictly between the first round and the final, for this half
  // only, nearest-to-outside first (i.e. in the order they're played).
  rounds: BracketColumn[];
}

export interface BracketDisplay {
  firstRound: BracketRoundName;
  left: BracketHalfDisplay;
  right: BracketHalfDisplay;
  final: BracketMatchDisplay;
  champion: BracketTeamInfo | null;
}

export function buildBracketDisplay(
  fieldSize: 6 | 12,
  seeds: BracketSeedInput[],
  games: BracketGameInput[]
): BracketDisplay {
  const shape = fieldSize === 12 ? SHAPE_12 : SHAPE_6;
  const firstRound: BracketRoundName = fieldSize === 12 ? "FIRST_ROUND" : "QUARTERFINAL";

  const teamBySeed = new Map(seeds.map((s) => [s.seed, s]));
  const gamesByRound = new Map<BracketRoundName, BracketGameInput[]>();
  for (const g of games) {
    const round = g.round as BracketRoundName;
    const list = gamesByRound.get(round);
    if (list) list.push(g);
    else gamesByRound.set(round, [g]);
  }

  // Populated in shape order (topological: a round only ever references an
  // earlier one), so a "winner of" lookup always finds its target already
  // resolved.
  const matchByKey = new Map<string, BracketMatchDisplay>();
  const indexInRound = new Map<BracketRoundName, number>();

  function resolveTeamId(slot: Slot): string | null {
    if (isSeedSlot(slot)) return teamBySeed.get(slot.seed)?.teamId ?? null;
    const feeding = matchByKey.get(`${slot.round}:${slot.index}`);
    if (!feeding || !feeding.played) return null;
    if (feeding.away.winner) return feeding.away.team!.teamId;
    if (feeding.home.winner) return feeding.home.team!.teamId;
    return null;
  }

  function toSide(teamId: string | null, game: BracketGameInput | undefined, isAway: boolean): BracketSide {
    if (!teamId) return { team: null, score: null, winner: false };
    const seed = seeds.find((s) => s.teamId === teamId)!;
    const team: BracketTeamInfo = { teamId, name: seed.name, seed: seed.seed };
    if (!game || !game.played || game.awayScore === null || game.homeScore === null) {
      return { team, score: null, winner: false };
    }
    const score = isAway ? game.awayScore : game.homeScore;
    const otherScore = isAway ? game.homeScore : game.awayScore;
    return { team, score, winner: score > otherScore };
  }

  // Parallel to `shape` -- matches[i] is the resolved display for shape[i].
  const matches: BracketMatchDisplay[] = [];
  for (const m of shape) {
    const index = indexInRound.get(m.round) ?? 0;
    indexInRound.set(m.round, index + 1);

    const awayTeamId = resolveTeamId(m.away);
    const homeTeamId = resolveTeamId(m.home);
    const game =
      awayTeamId && homeTeamId
        ? (gamesByRound.get(m.round) ?? []).find(
            (g) =>
              (g.awayTeamId === awayTeamId && g.homeTeamId === homeTeamId) ||
              (g.awayTeamId === homeTeamId && g.homeTeamId === awayTeamId)
          )
        : undefined;
    const isAwayFirst = !game || game.awayTeamId === awayTeamId;

    const display: BracketMatchDisplay = {
      round: m.round,
      gameId: game?.id ?? null,
      played: game?.played ?? false,
      away: toSide(awayTeamId, game, isAwayFirst),
      home: toSide(homeTeamId, game, !isAwayFirst),
    };
    matches.push(display);
    matchByKey.set(`${m.round}:${index}`, display);
  }

  // A bye seed's half is wherever it appears as a direct seed slot (always
  // exactly once, in the round right after the first).
  const seedHalf = new Map<number, BracketHalf>();
  for (const m of shape) {
    if (m.half === "center") continue;
    for (const slot of [m.away, m.home]) {
      if (isSeedSlot(slot)) seedHalf.set(slot.seed, m.half);
    }
  }

  const firstRoundSeeds = new Set(
    shape
      .filter((m) => m.round === firstRound)
      .flatMap((m) => [m.away, m.home])
      .filter(isSeedSlot)
      .map((s) => s.seed)
  );
  const allByes: BracketTeamInfo[] = seeds
    .filter((s) => !firstRoundSeeds.has(s.seed))
    .sort((a, b) => a.seed - b.seed)
    .map((s) => ({ teamId: s.teamId, name: s.name, seed: s.seed }));

  function buildHalf(half: BracketHalf): BracketHalfDisplay {
    const byes = allByes.filter((b) => seedHalf.get(b.seed) === half);
    const firstRoundMatches = shape
      .map((m, i) => ({ m, match: matches[i] }))
      .filter(({ m }) => m.round === firstRound && m.half === half)
      .map(({ match }) => match);

    const firstColumn: BracketHalfDisplay["firstColumn"] = byes.flatMap((bye, i) => [
      { type: "bye" as const, team: bye },
      { type: "game" as const, match: firstRoundMatches[i] },
    ]);

    const midRoundNames = (fieldSize === 12 ? ["QUARTERFINAL", "SEMIFINAL"] : ["SEMIFINAL"]) as BracketRoundName[];
    const rounds: BracketColumn[] = midRoundNames.map((round) => ({
      round,
      matches: shape
        .map((m, i) => ({ m, match: matches[i] }))
        .filter(({ m }) => m.round === round && m.half === half)
        .map(({ match }) => match),
    }));

    return { firstColumn, rounds };
  }

  const final = matches[matches.length - 1];
  const champion = final.played && final.away.winner ? final.away.team : final.played && final.home.winner ? final.home.team : null;

  return { firstRound, left: buildHalf("left"), right: buildHalf("right"), final, champion };
}
