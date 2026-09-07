// The transfer-portal / HS-recruiting market that fills every open roster
// slot each offseason. Supplied directly (not from the workbook):
//
//   Team Value  = team's (post-update) prestige, ties broken by last
//                 season's wins (higher wins ranks first)
//   Player Value = player's current OVR * (rand()+1)   [uniform 1x-2x]
//
// Teams needing this position group are ranked by Team Value, pool players
// (transfers out of other teams + fresh HS recruits) are ranked by Player
// Value, and the two ranked lists are paired 1:1 — highest Team Value gets
// the highest Player Value, and so on down the list. Team Value is
// deliberately NOT randomized (it used to add rand()*25) so that a team's
// prestige/record reliably determines its recruiting pull -- good programs
// keep landing the better talent instead of occasionally losing out to
// random luck.

import type { Rand } from "./rng";
import { agePlayer, generateRecruit, type PosGroup, type RosterPlayer } from "./roster";

export interface TeamNeed {
  teamId: string;
  prestige: number;
  priorWins: number; // last season's wins -- Team Value tiebreak when prestige is equal
}

export interface TransferCandidate {
  teamId: string; // the team they're leaving
  player: RosterPlayer; // their stats at the moment they entered the portal
}

export type PlacementSource = "TRANSFER" | "FRESHMAN";

export interface MarketAssignment {
  teamId: string; // destination
  player: RosterPlayer; // final stats once placed (transfers get grown a year; freshmen are as-generated)
  source: PlacementSource;
  fromTeamId: string | null; // null for freshmen (they came from high school)
  rankedOvr: number; // the OVR actually used to compute Player Value, for reporting
}

// hsRecruitCount should be exactly the number of graduations + early
// departures at this position group this offseason, so the pool size always
// matches the number of teams needing a player (transfers create exactly
// one opening and fill exactly one opening; HS recruits replace the
// players lost to graduation/the draft).
export function runPositionMarket(
  posGroup: PosGroup,
  season: number,
  teamsNeeding: TeamNeed[],
  transferCandidates: TransferCandidate[],
  hsRecruitCount: number,
  rand: Rand = Math.random
): MarketAssignment[] {
  if (teamsNeeding.length === 0) return [];

  const hsRecruits = Array.from({ length: hsRecruitCount }, () => generateRecruit(posGroup, season, rand));

  const pool = [
    ...transferCandidates.map((c) => ({
      source: "TRANSFER" as const,
      fromTeamId: c.teamId as string | null,
      player: c.player,
    })),
    ...hsRecruits.map((p) => ({ source: "FRESHMAN" as const, fromTeamId: null as string | null, player: p })),
  ];

  const rankedTeams = teamsNeeding
    .slice()
    .sort((a, b) => b.prestige - a.prestige || b.priorWins - a.priorWins);

  const rankedPool = pool
    .map((entry) => ({ ...entry, rankedOvr: entry.player.ovr, value: entry.player.ovr * (rand() + 1) }))
    .sort((a, b) => b.value - a.value);

  const count = Math.min(rankedTeams.length, rankedPool.length);
  const assignments: MarketAssignment[] = [];
  for (let i = 0; i < count; i++) {
    const team = rankedTeams[i];
    const entry = rankedPool[i];
    const finalPlayer = entry.source === "TRANSFER" ? (agePlayer(entry.player, rand) ?? entry.player) : entry.player;
    assignments.push({
      teamId: team.teamId,
      player: finalPlayer,
      source: entry.source,
      fromTeamId: entry.fromTeamId,
      rankedOvr: entry.rankedOvr,
    });
  }
  return assignments;
}
