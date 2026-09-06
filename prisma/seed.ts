// Seeds the static reference data (conferences, divisions, 72 teams) that is
// shared across every dynasty. Run with `npx tsx prisma/seed.ts`.

import { PrismaClient } from "@prisma/client";
import { CONFERENCE_NAMES, DIVISION_NAMES, SEED_TEAMS } from "../lib/data/teams";

const prisma = new PrismaClient();

async function main() {
  const confCodes = [...new Set(SEED_TEAMS.map((t) => t.conf))];
  const conferences = new Map<string, string>(); // code -> id

  for (const code of confCodes) {
    const conf = await prisma.conference.upsert({
      where: { code },
      update: {},
      create: { code, name: CONFERENCE_NAMES[code] ?? code },
    });
    conferences.set(code, conf.id);
  }

  const divCodes = [...new Set(SEED_TEAMS.map((t) => t.div))];
  const divisions = new Map<string, string>(); // code -> id

  for (const code of divCodes) {
    const confCode = SEED_TEAMS.find((t) => t.div === code)!.conf;
    const div = await prisma.division.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name: DIVISION_NAMES[code] ?? code,
        conferenceId: conferences.get(confCode)!,
      },
    });
    divisions.set(code, div.id);
  }

  for (const team of SEED_TEAMS) {
    await prisma.team.upsert({
      where: { name: team.name },
      update: {
        historicScore: team.score,
        conferenceId: conferences.get(team.conf)!,
        divisionId: divisions.get(team.div)!,
      },
      create: {
        name: team.name,
        historicScore: team.score,
        conferenceId: conferences.get(team.conf)!,
        divisionId: divisions.get(team.div)!,
      },
    });
  }

  console.log(`Seeded ${confCodes.length} conferences, ${divCodes.length} divisions, ${SEED_TEAMS.length} teams.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
