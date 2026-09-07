import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { getCurrentSeason, getSeasonRosterSnapshot, getTeamHistory } from "@/lib/dynasty/queries";
import { FCS_TEAM_NAME } from "@/lib/dynasty/fcsTeam";
import { TeamSelect } from "@/app/components/TeamSelect";

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ team?: string }>;
}) {
  const { id } = await params;
  const { team: teamParam } = await searchParams;
  const { dynasty } = await getCurrentSeason(id).catch(() => ({ dynasty: null, season: null }));
  if (!dynasty) notFound();

  const teams = await prisma.team.findMany({
    where: { name: { not: FCS_TEAM_NAME } },
    include: { conference: true },
    orderBy: { name: "asc" },
  });
  if (teams.length === 0) notFound();

  const selectedTeamId = teamParam && teams.some((t) => t.id === teamParam) ? teamParam : teams[0].id;
  const selectedTeam = teams.find((t) => t.id === selectedTeamId)!;

  const history = await getTeamHistory(dynasty.id, selectedTeamId);

  const rosterBySeasonNumber = new Map<number, Awaited<ReturnType<typeof getSeasonRosterSnapshot>>>();
  for (const h of history) {
    if (h.hasRosterSnapshot) {
      rosterBySeasonNumber.set(h.seasonNumber, await getSeasonRosterSnapshot(dynasty.id, selectedTeamId, h.seasonNumber));
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <div>
        <Link href={`/dynasty/${dynasty.id}`} className="text-sm text-zinc-500 hover:underline">
          &larr; {dynasty.name}
        </Link>
        <h1 className="text-2xl font-bold">Team History</h1>
      </div>

      <TeamSelect
        teams={teams.map((t) => ({ id: t.id, name: t.name, conferenceCode: t.conference.code }))}
        selectedTeamId={selectedTeamId}
        basePath={`/dynasty/${dynasty.id}/history`}
      />

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">
          <Link href={`/dynasty/${dynasty.id}/team/${selectedTeam.id}`} className="hover:underline">
            {selectedTeam.name}
          </Link>
        </h2>

        {history.length === 0 ? (
          <p className="text-sm text-zinc-400">No seasons played yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-[80px_90px_60px_90px_1fr] gap-2 px-3 text-xs uppercase text-zinc-500">
              <span>Season</span>
              <span>Prestige</span>
              <span>Record</span>
              <span>Conf</span>
              <span>Result</span>
            </div>
            <ul className="flex flex-col gap-2">
              {history.map((h) => (
                <li key={h.seasonNumber} className="rounded border border-zinc-200">
                  <details>
                    <summary className="grid cursor-pointer grid-cols-[80px_90px_60px_90px_1fr] items-center gap-2 px-3 py-2 text-sm">
                      <span className="font-medium">Season {h.seasonNumber}</span>
                      <span className="tabular-nums text-zinc-600">{h.startOfSeasonPrestige}</span>
                      <span className="tabular-nums text-zinc-600">
                        {h.wins}-{h.losses}
                      </span>
                      <span className="tabular-nums text-zinc-600">
                        {h.confWins}-{h.confLosses}
                      </span>
                      <span className="text-zinc-600">{h.resultLabel}</span>
                    </summary>
                    <div className="border-t border-zinc-200 px-3 py-2">
                      {rosterBySeasonNumber.has(h.seasonNumber) ? (
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
                            {rosterBySeasonNumber.get(h.seasonNumber)!.map((p) => (
                              <tr key={p.id} className="odd:bg-zinc-50">
                                <td className="py-1">{p.playerName}</td>
                                <td className="py-1">{p.pos}</td>
                                <td className="py-1">{p.side}</td>
                                <td className="py-1">{p.classYear}</td>
                                <td className="py-1 tabular-nums">{p.ovr}</td>
                                <td className="py-1">{p.devMarker || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-sm text-zinc-400">
                          No roster snapshot recorded for this season (it was played before the history feature was
                          added).
                        </p>
                      )}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
