// Resolves a playoff field's persisted seeds + whatever bracket games exist
// so far into a fully-drawn bracket shape (every slot present from the day
// the field is set, filled in round by round as games are created/played).
//
// Round 1 (the first round actually shown -- FIRST_ROUND for the 12-team
// MEGA144 field, QUARTERFINAL for the 6-team CLASSIC field) is always fully
// known from seeding alone: neither side depends on another game's result.
// Every later round has at least one side that's a "winner of" reference --
// unresolved until that feeding game is both created and played, at which
// point it resolves via the actual `Game` row (not by presumed favorite).

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
  fromRound: BracketRoundName;
  anchorSeed: number; // a seed guaranteed to be one of the two sides in the specific feeding-round game this slot depends on -- used to find that game among the (unordered) round's games.
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
  { round: "FIRST_ROUND", away: { seed: 8 }, home: { seed: 9 } },
  { round: "FIRST_ROUND", away: { seed: 7 }, home: { seed: 10 } },
  { round: "FIRST_ROUND", away: { seed: 6 }, home: { seed: 11 } },
  { round: "FIRST_ROUND", away: { seed: 5 }, home: { seed: 12 } },
  { round: "QUARTERFINAL", away: { seed: 1 }, home: { fromRound: "FIRST_ROUND", anchorSeed: 8 } },
  { round: "QUARTERFINAL", away: { seed: 2 }, home: { fromRound: "FIRST_ROUND", anchorSeed: 7 } },
  { round: "QUARTERFINAL", away: { seed: 3 }, home: { fromRound: "FIRST_ROUND", anchorSeed: 6 } },
  { round: "QUARTERFINAL", away: { seed: 4 }, home: { fromRound: "FIRST_ROUND", anchorSeed: 5 } },
  { round: "SEMIFINAL", away: { fromRound: "QUARTERFINAL", anchorSeed: 1 }, home: { fromRound: "QUARTERFINAL", anchorSeed: 4 } },
  { round: "SEMIFINAL", away: { fromRound: "QUARTERFINAL", anchorSeed: 2 }, home: { fromRound: "QUARTERFINAL", anchorSeed: 3 } },
  { round: "FINAL", away: { fromRound: "SEMIFINAL", anchorSeed: 1 }, home: { fromRound: "SEMIFINAL", anchorSeed: 2 } },
];

const SHAPE_6: MatchShape[] = [
  { round: "QUARTERFINAL", away: { seed: 4 }, home: { seed: 5 } },
  { round: "QUARTERFINAL", away: { seed: 3 }, home: { seed: 6 } },
  { round: "SEMIFINAL", away: { seed: 1 }, home: { fromRound: "QUARTERFINAL", anchorSeed: 4 } },
  { round: "SEMIFINAL", away: { seed: 2 }, home: { fromRound: "QUARTERFINAL", anchorSeed: 3 } },
  { round: "FINAL", away: { fromRound: "SEMIFINAL", anchorSeed: 1 }, home: { fromRound: "SEMIFINAL", anchorSeed: 2 } },
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
  const seedByTeamId = new Map(seeds.map((s) => [s.teamId, s.seed]));
  const gamesByRound = new Map<BracketRoundName, BracketGameInput[]>();
  for (const g of games) {
    const round = g.round as BracketRoundName;
    const list = gamesByRound.get(round);
    if (list) list.push(g);
    else gamesByRound.set(round, [g]);
  }

  function resolveSlot(slot: Slot): { teamId: string; seed: number } | null {
    if (isSeedSlot(slot)) {
      const s = teamBySeed.get(slot.seed);
      return s ? { teamId: s.teamId, seed: s.seed } : null;
    }
    const anchor = teamBySeed.get(slot.anchorSeed);
    if (!anchor) return null;
    const game = (gamesByRound.get(slot.fromRound) ?? []).find(
      (g) => g.awayTeamId === anchor.teamId || g.homeTeamId === anchor.teamId
    );
    if (!game || !game.played || game.awayScore === null || game.homeScore === null) return null;
    const winnerId = game.awayScore > game.homeScore ? game.awayTeamId : game.homeTeamId;
    const winnerSeed = seedByTeamId.get(winnerId);
    return winnerSeed !== undefined ? { teamId: winnerId, seed: winnerSeed } : null;
  }

  function toSide(resolved: { teamId: string; seed: number } | null, game: BracketGameInput | undefined, isAway: boolean): BracketSide {
    if (!resolved) return { team: null, score: null, winner: false };
    const info = teamBySeed.get(resolved.seed)!;
    const team: BracketTeamInfo = { teamId: resolved.teamId, name: info.name, seed: resolved.seed };
    if (!game || !game.played || game.awayScore === null || game.homeScore === null) {
      return { team, score: null, winner: false };
    }
    const score = isAway ? game.awayScore : game.homeScore;
    const otherScore = isAway ? game.homeScore : game.awayScore;
    return { team, score, winner: score > otherScore };
  }

  const matches: BracketMatchDisplay[] = shape.map((m) => {
    const awayResolved = resolveSlot(m.away);
    const homeResolved = resolveSlot(m.home);
    const game =
      awayResolved && homeResolved
        ? (gamesByRound.get(m.round) ?? []).find(
            (g) =>
              (g.awayTeamId === awayResolved.teamId && g.homeTeamId === homeResolved.teamId) ||
              (g.awayTeamId === homeResolved.teamId && g.homeTeamId === awayResolved.teamId)
          )
        : undefined;
    const isAwayFirst = !game || game.awayTeamId === awayResolved?.teamId;
    return {
      round: m.round,
      gameId: game?.id ?? null,
      played: game?.played ?? false,
      away: toSide(awayResolved, game, isAwayFirst),
      home: toSide(homeResolved, game, !isAwayFirst),
    };
  });

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
