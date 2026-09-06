import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { getCurrentSeason, getTeamRoster } from "@/lib/dynasty/queries";

const CLASS_ORDER: Record<string, number> = { FR: 0, SO: 1, JR: 2, SR: 3 };

export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string; teamId: string }>;
}) {
  const { id, teamId } = await params;
  const { dynasty, season } = await getCurrentSeason(id).catch(() => ({ dynasty: null, season: null }));
  if (!dynasty || !season) notFound();

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { conference: true, division: true },
  });
  if (!team) notFound();

  const teamSeason = await prisma.teamSeason.findUnique({
    where: { seasonId_teamId: { seasonId: season.id, teamId } },
  });
  const roster = (await getTeamRoster(dynasty.id, teamId)).sort(
    (a, b) => CLASS_ORDER[a.classYear] - CLASS_ORDER[b.classYear] || b.ovr - a.ovr
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <div>
        <Link href={`/dynasty/${dynasty.id}/standings`} className="text-sm text-zinc-500 hover:underline">
          &larr; Standings
        </Link>
        <h1 className="text-2xl font-bold">{team.name}</h1>
        <p className="text-sm text-zinc-500">
          {team.conference.code} {team.division.code}
        </p>
        {teamSeason && (
          <p className="mt-2 text-sm text-zinc-600">
            {teamSeason.wins}-{teamSeason.losses} &middot; Prestige {teamSeason.prestige} &middot; OFF{" "}
            {teamSeason.offRating} / DEF {teamSeason.defRating} &middot; Power {Math.round(teamSeason.powerElo)}
          </p>
        )}
      </div>

      <section>
        <h2 className="mb-2 font-semibold">Roster</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-zinc-500">
            <tr>
              <th className="py-1">Name</th>
              <th className="py-1">Pos</th>
              <th className="py-1">Side</th>
              <th className="py-1">Yr</th>
              <th className="py-1">OVR</th>
              <th className="py-1">Dev</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((p) => (
              <tr key={p.id} className="odd:bg-zinc-50">
                <td className="py-1">{p.name}</td>
                <td className="py-1">{p.pos}</td>
                <td className="py-1">{p.side}</td>
                <td className="py-1">{p.classYear}</td>
                <td className="py-1 tabular-nums">{p.ovr}</td>
                <td className="py-1">{p.devMarker || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
