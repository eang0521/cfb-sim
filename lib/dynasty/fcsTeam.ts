import { prisma } from "@/lib/db/client";
import { d6, type Rand } from "@/lib/sim/rng";

export const FCS_TEAM_NAME = "FCS";
const FCS_CONFERENCE_CODE = "IND";
const FCS_DIVISION_CODE = "INDD";

// A single synthetic "FCS" opponent, reused by every team's cupcake game each
// season. Unlike a real team it isn't degree-limited to one game/week — many
// teams can each play "the FCS team" in the same week, matching how the
// workbook's `J2='FCS'` non-conference filler games worked.
export async function getOrCreateFcsTeam() {
  const conference = await prisma.conference.upsert({
    where: { code: FCS_CONFERENCE_CODE },
    update: {},
    create: { code: FCS_CONFERENCE_CODE, name: "Independents" },
  });
  const division = await prisma.division.upsert({
    where: { code: FCS_DIVISION_CODE },
    update: {},
    create: { code: FCS_DIVISION_CODE, name: "FCS", conferenceId: conference.id },
  });
  return prisma.team.upsert({
    where: { name: FCS_TEAM_NAME },
    update: {},
    create: {
      name: FCS_TEAM_NAME,
      historicScore: 0,
      conferenceId: conference.id,
      divisionId: division.id,
    },
  });
}

// FCS isn't one of our tracked teams, so it has no persistent roster — the
// workbook re-rolls a fresh (weak) rating for it every single game rather
// than using a fixed number. Its own "R"/"S" (AO/AD) columns for these games
// are pasted values, not a live formula, but 216 sampled games fit a 3d6
// roll closely (observed mean 10.39/stdev 3.01 vs 3d6's mean 10.5/stdev 2.96,
// range 4-18 vs 3d6's 3-18).
export function rollFcsRating(rand: Rand = Math.random) {
  const threeD6 = () => d6(rand) + d6(rand) + d6(rand);
  return { offRating: threeD6(), defRating: threeD6() };
}
