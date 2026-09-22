import { prisma } from "@/lib/db/client";

// No cascade deletes are configured on the schema's relations, so a
// dynasty's dependents have to be torn down in FK-dependency order (games +
// team-seasons before their season, then the season itself, alongside the
// dynasty-scoped tables) before the Dynasty row itself can go. All in one
// transaction so a failure partway through can't leave the dynasty
// half-deleted.
export async function deleteDynasty(dynastyId: string): Promise<void> {
  const seasons = await prisma.season.findMany({ where: { dynastyId }, select: { id: true } });
  const seasonIds = seasons.map((s) => s.id);

  await prisma.$transaction([
    prisma.game.deleteMany({ where: { seasonId: { in: seasonIds } } }),
    prisma.teamSeason.deleteMany({ where: { seasonId: { in: seasonIds } } }),
    prisma.season.deleteMany({ where: { dynastyId } }),
    prisma.player.deleteMany({ where: { dynastyId } }),
    prisma.rosterMove.deleteMany({ where: { dynastyId } }),
    prisma.playerSeasonSnapshot.deleteMany({ where: { dynastyId } }),
    prisma.dynasty.delete({ where: { id: dynastyId } }),
  ]);
}
