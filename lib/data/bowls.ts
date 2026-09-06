// Non-playoff bowl tie-ins, ported from the workbook's `List of Bowls` sheet.
// Rows 1-5 there are the playoff-rotation bowls (already modeled as the
// QUARTERFINAL/SEMIFINAL/FINAL rounds in lib/sim/playoff.ts). Rows 6-19 are
// the only other rows with a filled-in matchup rule — everything past row 19
// (Raider, Charger, Bill, ...) has a bowl *name* but no rule, so the
// workbook itself never wired those up either. This ports exactly what's
// there: 2 national at-large bowls for the teams just outside the playoff,
// plus 12 conference-vs-conference seed bowls.

export interface NationalBowlSpec {
  name: string;
  ranks: [number, number]; // 1-indexed rank among bowl-eligible, non-playoff teams nationally
}

export interface ConferenceBowlSpec {
  name: string;
  away: { conference: string; seed: number }; // seed = Nth-best bowl-eligible team in that conference
  home: { conference: string; seed: number };
}

export const NATIONAL_BOWLS: NationalBowlSpec[] = [
  { name: "Chief Bowl", ranks: [1, 2] }, // workbook: "7 vs 8" (ranks just outside the 6-team playoff)
  { name: "Bear Bowl", ranks: [3, 4] }, // workbook: "9 vs 10"
];

export const CONFERENCE_BOWLS: ConferenceBowlSpec[] = [
  { name: "Viking Bowl", away: { conference: "SEC", seed: 1 }, home: { conference: "B10", seed: 1 } },
  { name: "Dolphin Bowl", away: { conference: "SEC", seed: 2 }, home: { conference: "B12", seed: 1 } },
  { name: "49er Bowl", away: { conference: "B10", seed: 2 }, home: { conference: "PAC", seed: 1 } },
  { name: "Steeler Bowl", away: { conference: "B10", seed: 3 }, home: { conference: "BEC", seed: 1 } },
  { name: "Bronco Bowl", away: { conference: "B12", seed: 2 }, home: { conference: "PAC", seed: 2 } },
  { name: "Colt Bowl", away: { conference: "SEC", seed: 3 }, home: { conference: "ACC", seed: 1 } },
  { name: "Seahawk Bowl", away: { conference: "SEC", seed: 4 }, home: { conference: "PAC", seed: 3 } },
  { name: "Giant Bowl", away: { conference: "B10", seed: 4 }, home: { conference: "ACC", seed: 2 } },
  { name: "Brown Bowl", away: { conference: "B12", seed: 3 }, home: { conference: "BEC", seed: 2 } },
  { name: "Ram Bowl", away: { conference: "PAC", seed: 4 }, home: { conference: "ACC", seed: 3 } },
  { name: "Eagle Bowl", away: { conference: "B10", seed: 5 }, home: { conference: "B12", seed: 4 } },
  { name: "Commie Bowl", away: { conference: "SEC", seed: 5 }, home: { conference: "BEC", seed: 3 } },
];

// Real NCAA bowl-eligibility rule: teams need at least 6 wins.
export const BOWL_ELIGIBILITY_WINS = 6;

// The rest of the workbook's named bowls (rows 20-33 of `List of Bowls`) have
// no matchup rule filled in there — this is where they're used: leftover
// bowl-eligible teams (after the national + conference-seed bowls above) are
// paired off in rank order, one bowl name at a time, skipping same-conference
// pairings. If a season somehow has more leftover teams than names here, the
// overflow just doesn't get a bowl (matches the "more eligible teams than
// bowl slots" situation the real sport sometimes runs into).
export const EXTRA_BOWL_NAMES = [
  "Raider Bowl",
  "Charger Bowl",
  "Bill Bowl",
  "Titan Bowl",
  "Saint Bowl",
  "Lion Bowl",
  "Bengal Bowl",
  "Panther Bowl",
  "Texan Bowl",
  "Falcon Bowl",
  "Jet Bowl",
  "Jaguar Bowl",
  "Cardinal Bowl",
  "Buccaneer Bowl",
];
