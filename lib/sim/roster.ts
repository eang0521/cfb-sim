// Player generation & aging, ported from the workbook's `Construction` sheet
// and the generic random-walk utility on `Sheet1`/`Gen`.

import { coinGeom, d6, type Rand } from "./rng";
import { generatePlayerName } from "./names";

export type Side = "O" | "D";
export type PosGroup = "QB" | "UT" | "OL" | "DL" | "LB" | "DB";
export type ClassYear = "FR" | "SO" | "JR" | "SR";

export interface RosterPlayer {
  name: string;
  posGroup: PosGroup;
  pos: string;
  side: Side;
  classYear: ClassYear;
  ovr: number;
  devTrait: number; // 1 bad, 2 normal, 3 star
  devMarker: "-" | "" | "+";
  recruitedSeason: number;
}

const POS_GROUP_META: Record<PosGroup, { side: Side }> = {
  QB: { side: "O" },
  UT: { side: "O" },
  OL: { side: "O" },
  DL: { side: "D" },
  LB: { side: "D" },
  DB: { side: "D" },
};

// The one true roster order, used everywhere a roster (or a list of players
// spanning multiple position groups) is displayed.
export const POS_GROUP_ORDER: PosGroup[] = ["QB", "UT", "OL", "DL", "LB", "DB"];

export function sortByPosGroup<T extends { posGroup: string }>(players: T[]): T[] {
  return players
    .slice()
    .sort((a, b) => POS_GROUP_ORDER.indexOf(a.posGroup as PosGroup) - POS_GROUP_ORDER.indexOf(b.posGroup as PosGroup));
}

// Sub-position weights within a group (not recoverable from the workbook's
// formulas — they were random-assignment CHOOSE tables with no clean
// pattern — supplied directly): UT is WR 1/2, RB 1/3, TE 1/6; OL is OT 1/2,
// OG 1/3, C 1/6; DL is DE 2/3, DT 1/3; DB is CB/S 50/50.
const SUB_POSITION_WEIGHTS: Partial<Record<PosGroup, [string, number][]>> = {
  UT: [
    ["WR", 3],
    ["RB", 2],
    ["TE", 1],
  ],
  OL: [
    ["OT", 3],
    ["OG", 2],
    ["CE", 1],
  ],
  DL: [
    ["DE", 2],
    ["DT", 1],
  ],
  DB: [
    ["CB", 1],
    ["SF", 1],
  ],
};

function pickWeighted(weights: [string, number][], rand: Rand): string {
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let roll = rand() * total;
  for (const [value, weight] of weights) {
    if (roll < weight) return value;
    roll -= weight;
  }
  return weights[weights.length - 1][0];
}

function subPosition(group: PosGroup, rand: Rand): string {
  const weights = SUB_POSITION_WEIGHTS[group];
  return weights ? pickWeighted(weights, rand) : group;
}

// Construction!M2 = FLOOR((RANDBETWEEN(1,6)+6)/4,1) — dev trait draw for a
// new recruit. Distribution: roll 1 -> Bad(1) [1/6], rolls 2-5 -> Normal(2)
// [4/6], roll 6 -> Star(3) [1/6].
export function rollDevTrait(rand: Rand = Math.random): number {
  return Math.floor((d6(rand) + 6) / 4);
}

function devMarker(dev: number): "-" | "" | "+" {
  if (dev <= 1) return "-";
  if (dev >= 3) return "+";
  return "";
}

// Construction!L2 = RANDBETWEEN(1,6)+RANDBETWEEN(1,6) — HS recruit rating (2-12).
export function rollHsRating(rand: Rand = Math.random): number {
  return d6(rand) + d6(rand);
}

// Construction!N2 style: base rating + one CoinGeom draw, plus one more if
// dev > 1, plus a third if dev > 2 — higher dev trait compounds growth.
export function growOvr(ovr: number, devTrait: number, rand: Rand = Math.random): number {
  let next = ovr + coinGeom(rand);
  if (devTrait > 1) next += coinGeom(rand);
  if (devTrait > 2) next += coinGeom(rand);
  return next;
}

// Construction!O2 style: FLOOR((RANDBETWEEN(1,6)-prevDev)/4,1)+prevDev — a
// random walk that usually holds steady and occasionally drifts by 1,
// clamped to the valid [1,3] trait range.
export function walkDevTrait(prevDev: number, rand: Rand = Math.random): number {
  const next = Math.floor((d6(rand) - prevDev) / 4) + prevDev;
  return Math.min(3, Math.max(1, next));
}

// One incoming recruit for a given position group (Construction sheet: every
// team gets exactly 1 recruit per group per season -> 6 recruits/team/year).
export function generateRecruit(
  posGroup: PosGroup,
  season: number,
  rand: Rand = Math.random
): RosterPlayer {
  const hsRating = rollHsRating(rand);
  const devTrait = rollDevTrait(rand);
  return {
    name: generatePlayerName(rand),
    posGroup,
    pos: subPosition(posGroup, rand),
    side: POS_GROUP_META[posGroup].side,
    classYear: "FR",
    ovr: hsRating,
    devTrait,
    devMarker: devMarker(devTrait),
    recruitedSeason: season,
  };
}

export function generateFreshmanClass(season: number, rand: Rand = Math.random): RosterPlayer[] {
  return (Object.keys(POS_GROUP_META) as PosGroup[]).map((group) =>
    generateRecruit(group, season, rand)
  );
}

export const CLASS_YEARS: ClassYear[] = ["FR", "SO", "JR", "SR"];

// A team's roster is exactly 6 players — one per position group (QB, UT, OL,
// DL, LB, DB) — confirmed directly against the workbook's `S1Teams` sheet
// (72 teams x 6 rows each, one row per group, no more). Each slot is one
// player who ages FR->SO->JR->SR over 4 seasons, then graduates and is
// replaced by that season's fresh recruit for the same slot.
//
// A brand-new dynasty doesn't start with 6 true freshmen — real programs
// already have upperclassmen. Bootstrap season 1 by giving each of the 6
// slots a random starting class year, then fast-forwarding a freshly
// generated recruit through the same growth/dev-walk engine used for normal
// aging to reach that year.
export function bootstrapInitialRoster(season: number, rand: Rand = Math.random): RosterPlayer[] {
  return (Object.keys(POS_GROUP_META) as PosGroup[]).map((group) => {
    const startingYearIndex = Math.floor(rand() * CLASS_YEARS.length);
    const classYear = CLASS_YEARS[startingYearIndex];
    const recruitedSeason = season - startingYearIndex;
    const recruit = generateRecruit(group, recruitedSeason, rand);
    let { ovr, devTrait } = recruit;
    for (let step = 0; step < startingYearIndex; step++) {
      devTrait = walkDevTrait(devTrait, rand);
      ovr = growOvr(ovr, devTrait, rand);
    }
    return { ...recruit, ovr, devTrait, devMarker: devMarker(devTrait), classYear };
  });
}

export interface TeamPrestigeInput {
  teamId: string;
  prestige: number;
}

// Bootstraps every real team's initial 6-man roster for a brand-new dynasty,
// one position group at a time, as a single prestige-driven market (same
// Team-Value/Player-Value mechanism as the ongoing offseason recruiting
// market in lib/sim/recruiting.ts) instead of every team rolling its roster
// independently -- so a blue-blood program's day-1 roster is more likely to
// be stacked with good young talent than a bottom-feeder's.
//
// For each position group: every team's slot gets a random target class
// year (FR-SR) and a freshly generated HS recruit aged up by exactly one
// season of growth -- "freshman level" (HS + one season of progression), a
// flat baseline for every player in the market regardless of their eventual
// class, so the market ranks underlying talent rather than accumulated
// growth. Teams are ranked by Team Value (prestige + rand()*25), pool
// players by Player Value (that baseline OVR * (rand()+1)), and the two
// ranked lists are paired 1:1 (highest Team Value gets highest Player
// Value, and so on down the list) -- then each assigned player is aged the
// rest of the way up to their pre-rolled target class year.
export function bootstrapDynastyRosters(
  teams: TeamPrestigeInput[],
  season: number,
  rand: Rand = Math.random
): Map<string, RosterPlayer[]> {
  const rosterByTeamId = new Map<string, RosterPlayer[]>();
  for (const t of teams) rosterByTeamId.set(t.teamId, []);

  for (const group of Object.keys(POS_GROUP_META) as PosGroup[]) {
    const pool = teams.map(() => {
      const targetYearIndex = Math.floor(rand() * CLASS_YEARS.length);
      const recruit = generateRecruit(group, season - targetYearIndex, rand);
      // Freshman-level baseline: exactly one season of progression, no
      // matter what class this player will end up being.
      const devTrait = walkDevTrait(recruit.devTrait, rand);
      const ovr = growOvr(recruit.ovr, recruit.devTrait, rand);
      return { targetYearIndex, player: { ...recruit, ovr, devTrait, devMarker: devMarker(devTrait) } };
    });

    const rankedTeams = teams
      .map((t) => ({ teamId: t.teamId, value: t.prestige + rand() * 25 }))
      .sort((a, b) => b.value - a.value);
    const rankedPool = pool
      .map((entry) => ({ ...entry, value: entry.player.ovr * (rand() + 1) }))
      .sort((a, b) => b.value - a.value);

    const count = Math.min(rankedTeams.length, rankedPool.length);
    for (let i = 0; i < count; i++) {
      const { targetYearIndex, player } = rankedPool[i];
      let { ovr, devTrait } = player;
      // Progress from freshman-level up to the pre-rolled target class.
      for (let step = 0; step < targetYearIndex; step++) {
        devTrait = walkDevTrait(devTrait, rand);
        ovr = growOvr(ovr, devTrait, rand);
      }
      const finalPlayer: RosterPlayer = {
        ...player,
        ovr,
        devTrait,
        devMarker: devMarker(devTrait),
        classYear: CLASS_YEARS[targetYearIndex],
      };
      rosterByTeamId.get(rankedTeams[i].teamId)!.push(finalPlayer);
    }
  }

  return rosterByTeamId;
}

const NEXT_YEAR: Record<ClassYear, ClassYear | null> = {
  FR: "SO",
  SO: "JR",
  JR: "SR",
  SR: null, // graduates
};

// Ages one slot's incumbent by a year (growth + dev-trait walk), or returns
// null if they just graduated (SR -> gone) — the caller should then plug in
// that season's fresh recruit for the same posGroup instead.
export function agePlayer(player: RosterPlayer, rand: Rand = Math.random): RosterPlayer | null {
  const nextYear = NEXT_YEAR[player.classYear];
  if (nextYear === null) return null;
  const devTrait = walkDevTrait(player.devTrait, rand);
  const ovr = growOvr(player.ovr, player.devTrait, rand);
  return { ...player, classYear: nextYear, devTrait, devMarker: devMarker(devTrait), ovr };
}

// Same growth + dev-trait walk as agePlayer, but leaves classYear alone --
// a fresh HS recruit's year of offseason progression before ever taking the
// field as a true freshman, same "freshman-level" treatment
// bootstrapDynastyRosters gives day-1 rosters (see its comment).
export function growPlayerOneYear(player: RosterPlayer, rand: Rand = Math.random): RosterPlayer {
  const devTrait = walkDevTrait(player.devTrait, rand);
  const ovr = growOvr(player.ovr, player.devTrait, rand);
  return { ...player, devTrait, devMarker: devMarker(devTrait), ovr };
}

// Roster-movement decisions, supplied directly (not from the workbook, which
// never modeled early departures or transfers): a junior Star (dev=3) player
// declares early, same as graduating seniors — both leave college football
// for good. Everyone else who isn't already leaving has a 1/6 shot of
// entering the transfer portal instead of returning to the same slot.
export function isGraduating(player: RosterPlayer): boolean {
  return player.classYear === "SR";
}

export function isEarlyDeparture(player: RosterPlayer): boolean {
  return player.classYear === "JR" && player.devTrait === 3;
}

export function rollEntersTransferPortal(rand: Rand = Math.random): boolean {
  return rand() < 1 / 6;
}

// Team ratings: offRating/defRating = sum of player OVR by side, matching
// S2Teams!G:I (`=SUMIFS($T:$T,$M:$M,$B2,$O:$O,G$1)` etc).
export function teamRatings(players: RosterPlayer[], prestige: number) {
  const offRating = players.filter((p) => p.side === "O").reduce((sum, p) => sum + p.ovr, 0);
  const defRating = players.filter((p) => p.side === "D").reduce((sum, p) => sum + p.ovr, 0);
  const totalRating = offRating + defRating;
  // S2Teams!J2 = I2 + 2*F2  (T + 2*Prestige)
  const rating = totalRating + 2 * prestige;
  return { offRating, defRating, totalRating, rating };
}
