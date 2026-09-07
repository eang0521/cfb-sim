// Seeds the static reference data (conferences, divisions, 72 teams) that is
// shared across every dynasty. Run with `npx tsx prisma/seed.ts`.

import { PrismaClient } from "@prisma/client";
import { CONFERENCE_NAMES, DIVISION_NAMES, SEED_TEAMS } from "../lib/data/teams";
import { CONFERENCE_NAMES_144, DIVISION_NAMES_144, SEED_TEAMS_144 } from "../lib/data/teams144";

const prisma = new PrismaClient();

async function seedClassic() {
  const confCodes = [...new Set(SEED_TEAMS.map((t) => t.conf))];
  const conferences = new Map<string, string>(); // code -> id

  for (const code of confCodes) {
    const conf = await prisma.conference.upsert({
      where: { ruleset_code: { ruleset: "CLASSIC", code } },
      update: {},
      create: { ruleset: "CLASSIC", code, name: CONFERENCE_NAMES[code] ?? code },
    });
    conferences.set(code, conf.id);
  }

  const divCodes = [...new Set(SEED_TEAMS.map((t) => t.div))];
  const divisions = new Map<string, string>(); // code -> id

  for (const code of divCodes) {
    const confCode = SEED_TEAMS.find((t) => t.div === code)!.conf;
    const div = await prisma.division.upsert({
      where: { ruleset_code: { ruleset: "CLASSIC", code } },
      update: {},
      create: {
        ruleset: "CLASSIC",
        code,
        name: DIVISION_NAMES[code] ?? code,
        conferenceId: conferences.get(confCode)!,
      },
    });
    divisions.set(code, div.id);
  }

  for (const team of SEED_TEAMS) {
    await prisma.team.upsert({
      where: { ruleset_name: { ruleset: "CLASSIC", name: team.name } },
      update: {
        historicScore: team.score,
        conferenceId: conferences.get(team.conf)!,
        divisionId: divisions.get(team.div)!,
      },
      create: {
        ruleset: "CLASSIC",
        name: team.name,
        historicScore: team.score,
        conferenceId: conferences.get(team.conf)!,
        divisionId: divisions.get(team.div)!,
      },
    });
  }

  console.log(`Seeded CLASSIC: ${confCodes.length} conferences, ${divCodes.length} divisions, ${SEED_TEAMS.length} teams.`);
}

async function seedMega144() {
  const confCodes = [...new Set(SEED_TEAMS_144.map((t) => t.conf))];
  const conferences = new Map<string, string>();

  for (const code of confCodes) {
    const conf = await prisma.conference.upsert({
      where: { ruleset_code: { ruleset: "MEGA144", code } },
      update: {},
      create: { ruleset: "MEGA144", code, name: CONFERENCE_NAMES_144[code] ?? code },
    });
    conferences.set(code, conf.id);
  }

  const divCodes = [...new Set(SEED_TEAMS_144.map((t) => t.div))];
  const divisions = new Map<string, string>();

  for (const code of divCodes) {
    const confCode = SEED_TEAMS_144.find((t) => t.div === code)!.conf;
    const div = await prisma.division.upsert({
      where: { ruleset_code: { ruleset: "MEGA144", code } },
      update: {},
      create: {
        ruleset: "MEGA144",
        code,
        name: DIVISION_NAMES_144[code] ?? code,
        conferenceId: conferences.get(confCode)!,
      },
    });
    divisions.set(code, div.id);
  }

  for (const team of SEED_TEAMS_144) {
    await prisma.team.upsert({
      where: { ruleset_name: { ruleset: "MEGA144", name: team.name } },
      update: {
        fullName: team.fullName,
        mascot: team.mascot,
        startingPrestige: team.prestige,
        conferenceId: conferences.get(team.conf)!,
        divisionId: divisions.get(team.div)!,
      },
      create: {
        ruleset: "MEGA144",
        name: team.name,
        fullName: team.fullName,
        mascot: team.mascot,
        startingPrestige: team.prestige,
        conferenceId: conferences.get(team.conf)!,
        divisionId: divisions.get(team.div)!,
      },
    });
  }

  console.log(`Seeded MEGA144: ${confCodes.length} conferences, ${divCodes.length} divisions, ${SEED_TEAMS_144.length} teams.`);
}

async function main() {
  await seedClassic();
  await seedMega144();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
