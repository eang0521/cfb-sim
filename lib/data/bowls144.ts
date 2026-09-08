// Non-playoff bowl tie-ins for the MEGA144 ruleset (12 conferences), per the
// user's own 50-name list. No national at-large tier this time -- every
// named bowl here is a conference-vs-conference seed tie-in; anything left
// over falls to EXTRA_BOWL_NAMES_144, and if that list itself runs out, the
// overflow is auto-numbered starting at "Bowl 51" (23 conference bowls + 27
// extra names = 50) -- see overflowLabel in lib/dynasty/bowls.ts.

import type { ConferenceBowlSpec, NationalBowlSpec } from "./bowls";

export const NATIONAL_BOWLS_144: NationalBowlSpec[] = [];

// Four national at-large bowls, greedily filled from the top of the
// non-playoff bowl-eligible pool: Brady gets the single best team plus the
// best remaining team NOT from its conference, Rice gets the next-best pair
// under the same rule, then Payton, then Montana -- see the greedy loop in
// lib/dynasty/bowls.ts#createBowlGames.
export const GREEDY_NATIONAL_BOWLS_144 = ["Brady Bowl", "Rice Bowl", "Payton Bowl", "Montana Bowl"];

export const CONFERENCE_BOWLS_144: ConferenceBowlSpec[] = [
  { name: "Cowboy Bowl", away: { conference: "SEC", seed: 1 }, home: { conference: "B12", seed: 1 } },
  { name: "Raven Bowl", away: { conference: "ACC", seed: 1 }, home: { conference: "P12", seed: 1 } },
  { name: "Chief Bowl", away: { conference: "B1G", seed: 1 }, home: { conference: "SEC", seed: 2 } },
  { name: "Patriot Bowl", away: { conference: "B12", seed: 2 }, home: { conference: "ACC", seed: 2 } },
  { name: "Viking Bowl", away: { conference: "P12", seed: 2 }, home: { conference: "B1G", seed: 2 } },
  { name: "Dolphin Bowl", away: { conference: "BEC", seed: 1 }, home: { conference: "SEC", seed: 3 } },
  { name: "49er Bowl", away: { conference: "B12", seed: 3 }, home: { conference: "P12", seed: 3 } },
  { name: "Steeler Bowl", away: { conference: "ACC", seed: 3 }, home: { conference: "B1G", seed: 3 } },
  { name: "Bronco Bowl", away: { conference: "MWC", seed: 1 }, home: { conference: "BEC", seed: 2 } },
  { name: "Colt Bowl", away: { conference: "SEC", seed: 4 }, home: { conference: "ACC", seed: 4 } },
  { name: "Bear Bowl", away: { conference: "B12", seed: 4 }, home: { conference: "SWC", seed: 1 } },
  { name: "Seahawk Bowl", away: { conference: "P12", seed: 4 }, home: { conference: "MAC", seed: 1 } },
  { name: "Packer Bowl", away: { conference: "B1G", seed: 4 }, home: { conference: "SBT", seed: 1 } },
  { name: "Ram Bowl", away: { conference: "SKY", seed: 1 }, home: { conference: "MWC", seed: 2 } },
  { name: "Brown Bowl", away: { conference: "BEC", seed: 3 }, home: { conference: "AAC", seed: 1 } },
  { name: "Commie Bowl", away: { conference: "SEC", seed: 5 }, home: { conference: "P12", seed: 5 } },
  { name: "Eagle Bowl", away: { conference: "B12", seed: 5 }, home: { conference: "B1G", seed: 5 } },
  { name: "Raider Bowl", away: { conference: "ACC", seed: 5 }, home: { conference: "SWC", seed: 2 } },
  { name: "Bill Bowl", away: { conference: "MAC", seed: 2 }, home: { conference: "SBT", seed: 2 } },
  { name: "Titan Bowl", away: { conference: "SKY", seed: 2 }, home: { conference: "BEC", seed: 4 } },
  { name: "Charger Bowl", away: { conference: "MWC", seed: 3 }, home: { conference: "AAC", seed: 2 } },
  { name: "Saint Bowl", away: { conference: "SWC", seed: 3 }, home: { conference: "MAC", seed: 3 } },
  { name: "Bengal Bowl", away: { conference: "SBT", seed: 3 }, home: { conference: "SKY", seed: 3 } },
];

export const EXTRA_BOWL_NAMES_144 = [
  "Giant Bowl",
  "Lion Bowl",
  "Panther Bowl",
  "Texan Bowl",
  "Falcon Bowl",
  "Jet Bowl",
  "Jaguar Bowl",
  "Cardinal Bowl",
  "Buccaneer Bowl",
  "Yank Bowl",
  "Bulldog Bowl",
  "Tiger Bowl",
  "Dodger Bowl",
  "Gunner Bowl",
  "Red Bowl",
  "Stapleton Bowl",
  "Indian Bowl",
  "Steamroller Bowl",
  "Marine Bowl",
  "Tornado Bowl",
  "Ranger Bowl",
  "Bison Bowl",
  "Maroon Bowl",
  "Triangle Bowl",
  "Wolverine Bowl",
  "Kelley Bowl",
  "Eskimo Bowl",
];
