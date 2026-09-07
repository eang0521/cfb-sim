// Non-playoff bowl tie-ins for the MEGA144 ruleset (12 conferences). This
// ruleset didn't exist in the original workbook, so -- like the CLASSIC
// bowl list's own extra/fallback names -- these are invented outright,
// roughly double the CLASSIC set's density: 4 national at-large bowls, 24
// conference-vs-conference seed bowls (4 seed tiers x 6 pairings, so every
// conference gets a guaranteed tie-in bowl at each of its top 4
// bowl-eligible seed spots), and 30 extra fallback names for whatever's left
// over. See lib/dynasty/bowls.ts for how these get used.

import type { ConferenceBowlSpec, NationalBowlSpec } from "./bowls";

export const NATIONAL_BOWLS_144: NationalBowlSpec[] = [
  { name: "Cowboy Bowl", ranks: [1, 2] },
  { name: "Patriot Bowl", ranks: [3, 4] },
  { name: "Packer Bowl", ranks: [5, 6] },
  { name: "Raven Bowl", ranks: [7, 8] },
];

export const CONFERENCE_BOWLS_144: ConferenceBowlSpec[] = [
  // Seed-1 tier
  { name: "Comet Bowl", away: { conference: "SEC", seed: 1 }, home: { conference: "SBT", seed: 1 } },
  { name: "Thunder Bowl", away: { conference: "B1G", seed: 1 }, home: { conference: "MAC", seed: 1 } },
  { name: "Wolf Bowl", away: { conference: "P12", seed: 1 }, home: { conference: "MWC", seed: 1 } },
  { name: "Hawk Bowl", away: { conference: "ACC", seed: 1 }, home: { conference: "AAC", seed: 1 } },
  { name: "Stallion Bowl", away: { conference: "B12", seed: 1 }, home: { conference: "SWC", seed: 1 } },
  { name: "Cyclone Bowl", away: { conference: "BEC", seed: 1 }, home: { conference: "SKY", seed: 1 } },

  // Seed-2 tier
  { name: "Hurricane Bowl", away: { conference: "SEC", seed: 2 }, home: { conference: "MAC", seed: 2 } },
  { name: "Volcano Bowl", away: { conference: "B1G", seed: 2 }, home: { conference: "MWC", seed: 2 } },
  { name: "Canyon Bowl", away: { conference: "P12", seed: 2 }, home: { conference: "AAC", seed: 2 } },
  { name: "Summit Bowl", away: { conference: "ACC", seed: 2 }, home: { conference: "SWC", seed: 2 } },
  { name: "Frontier Bowl", away: { conference: "B12", seed: 2 }, home: { conference: "SKY", seed: 2 } },
  { name: "Prairie Bowl", away: { conference: "BEC", seed: 2 }, home: { conference: "SBT", seed: 2 } },

  // Seed-3 tier
  { name: "Harbor Bowl", away: { conference: "SEC", seed: 3 }, home: { conference: "MWC", seed: 3 } },
  { name: "Compass Bowl", away: { conference: "B1G", seed: 3 }, home: { conference: "AAC", seed: 3 } },
  { name: "Anchor Bowl", away: { conference: "P12", seed: 3 }, home: { conference: "SWC", seed: 3 } },
  { name: "Voyager Bowl", away: { conference: "ACC", seed: 3 }, home: { conference: "SKY", seed: 3 } },
  { name: "Ranger Bowl", away: { conference: "B12", seed: 3 }, home: { conference: "SBT", seed: 3 } },
  { name: "Sentinel Bowl", away: { conference: "BEC", seed: 3 }, home: { conference: "MAC", seed: 3 } },

  // Seed-4 tier
  { name: "Blaze Bowl", away: { conference: "SEC", seed: 4 }, home: { conference: "AAC", seed: 4 } },
  { name: "Frost Bowl", away: { conference: "B1G", seed: 4 }, home: { conference: "SWC", seed: 4 } },
  { name: "Meteor Bowl", away: { conference: "P12", seed: 4 }, home: { conference: "SKY", seed: 4 } },
  { name: "Ember Bowl", away: { conference: "ACC", seed: 4 }, home: { conference: "SBT", seed: 4 } },
  { name: "Glacier Bowl", away: { conference: "B12", seed: 4 }, home: { conference: "MAC", seed: 4 } },
  { name: "Tempest Bowl", away: { conference: "BEC", seed: 4 }, home: { conference: "MWC", seed: 4 } },
];

export const EXTRA_BOWL_NAMES_144 = [
  "Cascade Bowl",
  "Delta Bowl",
  "Horizon Bowl",
  "Zephyr Bowl",
  "Monsoon Bowl",
  "Aurora Bowl",
  "Eclipse Bowl",
  "Nebula Bowl",
  "Quasar Bowl",
  "Solstice Bowl",
  "Equinox Bowl",
  "Mirage Bowl",
  "Oasis Bowl",
  "Tundra Bowl",
  "Savanna Bowl",
  "Everglade Bowl",
  "Bayou Bowl",
  "Piedmont Bowl",
  "Highland Bowl",
  "Lowland Bowl",
  "Plateau Bowl",
  "Butte Bowl",
  "Mesa Bowl",
  "Grotto Bowl",
  "Lagoon Bowl",
  "Estuary Bowl",
];
