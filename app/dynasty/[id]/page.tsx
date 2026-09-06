import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCurrentPostseasonWeek,
  getCurrentSeason,
  getMaxScheduledWeek,
  getStandings,
  getStandingsSnapshotMap,
  getWeekGames,
} from "@/lib/dynasty/queries";
import { simulateWeekAction, advancePostseasonAction, runOffseasonAction } from "@/app/actions";
import { ROUND_LABEL } from "@/app/roundLabels";
import { WeekGamesTable } from "@/app/components/WeekGamesTable";

export default async function DynastyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { id } = await params;
  const { week: weekParam } = await searchParams;
  const { dynasty, season } = await getCurrentSeason(id).catch(() => ({ dynasty: null, season: null }));
  if (!dynasty || !season) notFound();

  const standings = await getStandings(season.id);
  const top10 = standings.slice(0, 10);

  const maxWeek = await getMaxScheduledWeek(season.id);
  let defaultWeek = season.currentWeek;
  if (season.status === "POSTSEASON") defaultWeek = (await getCurrentPostseasonWeek(season.id)) ?? 13;
  else if (season.status === "COMPLETE") defaultWeek = maxWeek;

  const parsedWeek = weekParam ? Number.parseInt(weekParam, 10) : NaN;
  const viewedWeek = Number.isFinite(parsedWeek) ? Math.min(Math.max(parsedWeek, 1), Math.max(maxWeek, 1)) : defaultWeek;

  const weekGames = await getWeekGames(season.id, viewedWeek);
  const standingsByTeamId = await getStandingsSnapshotMap(season.id);

  const isViewingCurrentSimWeek = season.status === "IN_PROGRESS" && viewedWeek === season.currentWeek;
  const canGoPrev = viewedWeek > 1;
  const canGoNext = viewedWeek < maxWeek;

  const simulateWeekWithIds = simulateWeekAction.bind(null, dynasty.id, season.id);
  const advancePostseasonWithIds = advancePostseasonAction.bind(null, dynasty.id, season.id);
  const runOffseasonWithId = runOffseasonAction.bind(null, dynasty.id);

  const weekLabel =
    viewedWeek <= 12
      ? `Week ${viewedWeek}`
      : weekGames.length > 0
        ? [...new Set(weekGames.map((g) => ROUND_LABEL[g.round] ?? g.round))].join(" & ")
        : `Week ${viewedWeek}`;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-zinc-500 hover:underline">
            &larr; All Dynasties
          </Link>
          <h1 className="text-2xl font-bold">{dynasty.name}</h1>
          <p className="text-sm text-zinc-500">
            Season {season.number} &middot; {season.status}
          </p>
        </div>
        <nav className="flex gap-3 text-sm">
          <Link href={`/dynasty/${dynasty.id}/standings`} className="hover:underline">
            Standings
          </Link>
          <Link href={`/dynasty/${dynasty.id}/schedule`} className="hover:underline">
            Schedule
          </Link>
          <Link href={`/dynasty/${dynasty.id}/playoff`} className="hover:underline">
            Playoff
          </Link>
          <Link href={`/dynasty/${dynasty.id}/offseason`} className="hover:underline">
            Offseason Report
          </Link>
        </nav>
      </div>

      <section className="rounded border border-zinc-200 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {canGoPrev ? (
              <Link
                href={`/dynasty/${dynasty.id}?week=${viewedWeek - 1}`}
                className="rounded border border-zinc-300 px-2 py-1 text-sm hover:bg-zinc-50"
                aria-label="Previous week"
              >
                &larr;
              </Link>
            ) : (
              <span className="rounded border border-zinc-100 px-2 py-1 text-sm text-zinc-300">&larr;</span>
            )}
            <h2 className="font-semibold">{weekLabel}</h2>
            {canGoNext ? (
              <Link
                href={`/dynasty/${dynasty.id}?week=${viewedWeek + 1}`}
                className="rounded border border-zinc-300 px-2 py-1 text-sm hover:bg-zinc-50"
                aria-label="Next week"
              >
                &rarr;
              </Link>
            ) : (
              <span className="rounded border border-zinc-100 px-2 py-1 text-sm text-zinc-300">&rarr;</span>
            )}
          </div>
          {isViewingCurrentSimWeek && (
            <form action={simulateWeekWithIds}>
              <button className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700">
                Simulate Week {season.currentWeek}
              </button>
            </form>
          )}
          {season.status === "POSTSEASON" && (
            <form action={advancePostseasonWithIds}>
              <button className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700">
                Advance Postseason
              </button>
            </form>
          )}
          {season.status === "COMPLETE" && (
            <form action={runOffseasonWithId}>
              <button className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600">
                Run Offseason &rarr; Season {season.number + 1}
              </button>
            </form>
          )}
        </div>

        {weekGames.length > 0 ? (
          <WeekGamesTable
            games={weekGames}
            standingsByTeamId={standingsByTeamId}
            dynastyId={dynasty.id}
            showBowlNames={viewedWeek > 12}
          />
        ) : (
          <p className="text-sm text-zinc-400">
            {viewedWeek > 12
              ? "Postseason hasn't reached this week yet."
              : "No games scheduled for this week yet."}
          </p>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Top 10</h2>
          <Link href={`/dynasty/${dynasty.id}/standings`} className="text-sm text-zinc-500 hover:underline">
            Full standings &rarr;
          </Link>
        </div>
        <ol className="flex flex-col gap-1 text-sm">
          {top10.map((ts, i) => (
            <li key={ts.id} className="flex items-center justify-between rounded px-2 py-1 odd:bg-zinc-50">
              <span>
                <span className="mr-2 tabular-nums text-zinc-400">{i + 1}.</span>
                <Link href={`/dynasty/${dynasty.id}/team/${ts.teamId}`} className="hover:underline">
                  {ts.team.name}
                </Link>
                <span className="ml-2 text-xs text-zinc-500">{ts.team.conference.code}</span>
              </span>
              <span className="tabular-nums text-zinc-600">
                {ts.wins}-{ts.losses}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
