// Resolves a playoff field's persisted seeds + whatever bracket games exist
// so far into a fully-drawn bracket shape (every slot present from the day
// the field is set, filling in round by round as games are created/played).
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
}

function isSeedSlot(slot: Slot): slot is SlotSeed {
  return "seed" in slot;
}

// First-round entries are deliberately ordered to pair 1:1 with BYE seeds
// 1, 2, 3, ... (ascending) -- see buildFirstColumn below, which relies on
// that correspondence to interleave "bye seed N" directly next to "the game
// whose winner joins seed N in the next round".
const SHAPE_12: MatchShape[] = [
  { round: "FIRST_ROUND", away: { seed: 8 }, home: { seed: 9 } }, // index 0
  { round: "FIRST_ROUND", away: { seed: 7 }, home: { seed: 10 } }, // index 1
  { round: "FIRST_ROUND", away: { seed: 6 }, home: { seed: 11 } }, // index 2
  { round: "FIRST_ROUND", away: { seed: 5 }, home: { seed: 12 } }, // index 3
  { round: "QUARTERFINAL", away: { seed: 1 }, home: { round: "FIRST_ROUND", index: 0 } }, // index 0
  { round: "QUARTERFINAL", away: { seed: 2 }, home: { round: "FIRST_ROUND", index: 1 } }, // index 1
  { round: "QUARTERFINAL", away: { seed: 3 }, home: { round: "FIRST_ROUND", index: 2 } }, // index 2
  { round: "QUARTERFINAL", away: { seed: 4 }, home: { round: "FIRST_ROUND", index: 3 } }, // index 3
  { round: "SEMIFINAL", away: { round: "QUARTERFINAL", index: 0 }, home: { round: "QUARTERFINAL", index: 3 } }, // index 0
  { round: "SEMIFINAL", away: { round: "QUARTERFINAL", index: 1 }, home: { round: "QUARTERFINAL", index: 2 } }, // index 1
  { round: "FINAL", away: { round: "SEMIFINAL", index: 0 }, home: { round: "SEMIFINAL", index: 1 } },
];

const SHAPE_6: MatchShape[] = [
  { round: "QUARTERFINAL", away: { seed: 4 }, home: { seed: 5 } }, // index 0
  { round: "QUARTERFINAL", away: { seed: 3 }, home: { seed: 6 } }, // index 1
  { round: "SEMIFINAL", away: { seed: 1 }, home: { round: "QUARTERFINAL", index: 0 } }, // index 0
  { round: "SEMIFINAL", away: { seed: 2 }, home: { round: "QUARTERFINAL", index: 1 } }, // index 1
  { round: "FINAL", away: { round: "SEMIFINAL", index: 0 }, home: { round: "SEMIFINAL", index: 1 } },
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

export interface BracketDisplay {
  firstRound: BracketRoundName;
  // Every slot at the "entry level," in top-to-bottom display order, one
  // per bye seed interleaved with the game whose winner joins it next round.
  firstColumn: ({ type: "bye"; team: BracketTeamInfo } | { type: "game"; match: BracketMatchDisplay })[];
  // Every round after the first, each already in top-to-bottom bracket order.
  laterRounds: BracketColumn[];
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

  const firstRoundSeeds = new Set(
    shape
      .filter((m) => m.round === firstRound)
      .flatMap((m) => [m.away, m.home])
      .filter(isSeedSlot)
      .map((s) => s.seed)
  );
  const byes: BracketTeamInfo[] = seeds
    .filter((s) => !firstRoundSeeds.has(s.seed))
    .sort((a, b) => a.seed - b.seed)
    .map((s) => ({ teamId: s.teamId, name: s.name, seed: s.seed }));

  const firstRoundMatches = matches.filter((m) => m.round === firstRound);
  const firstColumn: BracketDisplay["firstColumn"] = byes.flatMap((bye, i) => [
    { type: "bye" as const, team: bye },
    { type: "game" as const, match: firstRoundMatches[i] },
  ]);

  const laterRoundNames = (fieldSize === 12 ? ["QUARTERFINAL", "SEMIFINAL", "FINAL"] : ["SEMIFINAL", "FINAL"]) as BracketRoundName[];
  const laterRounds: BracketColumn[] = laterRoundNames.map((round) => ({
    round,
    matches: matches.filter((m) => m.round === round),
  }));

  const finalMatch = matches.find((m) => m.round === "FINAL")!;
  const champion =
    finalMatch.played && finalMatch.away.winner ? finalMatch.away.team : finalMatch.played && finalMatch.home.winner ? finalMatch.home.team : null;

  return { firstRound, firstColumn, laterRounds, champion };
}
