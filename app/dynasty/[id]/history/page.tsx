import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentSeason, getSeasonHistorySummaries, type SeasonHistoryTeamRef } from "@/lib/dynasty/queries";

function TeamLink({ dynastyId, team }: { dynastyId: string; team: SeasonHistoryTeamRef }) {
  return (
    <Link href={`/dynasty/${dynastyId}/teams?team=${team.teamId}`} className="hover:underline">
      {team.name}
    </Link>
  );
}

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { dynasty } = await getCurrentSeason(id).catch(() => ({ dynasty: null, season: null }));
  if (!dynasty) notFound();

  const summaries = await getSeasonHistorySummaries(dynasty.id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <div>
        <Link href={`/dynasty/${dynasty.id}`} className="text-sm text-zinc-500 hover:underline">
          &larr; {dynasty.name}
        </Link>
        <h1 className="text-2xl font-bold">History</h1>
      </div>

      {summaries.length === 0 ? (
        <p className="text-sm text-zinc-400">No seasons completed yet.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {summaries
            .slice()
            .reverse()
            .map((s) => (
              <li key={s.seasonNumber} className="rounded border border-zinc-200 p-4">
                <h2 className="mb-2 font-semibold">Season {s.seasonNumber}</h2>

                {s.champion && s.runnerUp ? (
                  <p className="text-sm text-zinc-600">
                    <span className="font-medium text-zinc-900">
                      <TeamLink dynastyId={dynasty.id} team={s.champion} />
                    </span>{" "}
                    ({s.champion.wins}-{s.champion.losses}) def. <TeamLink dynastyId={dynasty.id} team={s.runnerUp} /> (
                    {s.runnerUp.wins}-{s.runnerUp.losses}) &mdash; National Champion
                  </p>
                ) : (
                  <p className="text-sm text-zinc-400">No national championship game recorded.</p>
                )}

                {s.conferenceChampions.length > 0 && (
                  <div className="mt-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Conference Champions
                    </h3>
                    <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-zinc-600 sm:grid-cols-3">
                      {s.conferenceChampions.map((c) => (
                        <li key={c.conferenceCode}>
                          <span className="text-zinc-400">{c.conferenceCode}:</span>{" "}
                          <TeamLink dynastyId={dynasty.id} team={c} /> ({c.wins}-{c.losses})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {s.topRanked.length > 0 && (
                  <div className="mt-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Final Top 5</h3>
                    <ol className="mt-1 flex flex-col gap-0.5 text-sm text-zinc-600">
                      {s.topRanked.map((t) => (
                        <li key={t.rank}>
                          <span className="mr-1 tabular-nums text-zinc-400">#{t.rank}</span>
                          <TeamLink dynastyId={dynasty.id} team={t} /> ({t.wins}-{t.losses})
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </li>
            ))}
        </ul>
      )}
    </main>
  );
}
