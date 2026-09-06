import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentSeason, getAllGames, getStandingsSnapshotMap } from "@/lib/dynasty/queries";
import { ROUND_LABEL } from "@/app/roundLabels";
import { WeekGamesTable } from "@/app/components/WeekGamesTable";

export default async function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { dynasty, season } = await getCurrentSeason(id).catch(() => ({ dynasty: null, season: null }));
  if (!dynasty || !season) notFound();

  const games = await getAllGames(season.id);
  const standingsByTeamId = await getStandingsSnapshotMap(season.id);
  const byWeek = new Map<number, typeof games>();
  for (const g of games) {
    if (!byWeek.has(g.week)) byWeek.set(g.week, []);
    byWeek.get(g.week)!.push(g);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <div>
        <Link href={`/dynasty/${dynasty.id}`} className="text-sm text-zinc-500 hover:underline">
          &larr; {dynasty.name}
        </Link>
        <h1 className="text-2xl font-bold">Schedule — Season {season.number}</h1>
      </div>

      {[...byWeek.entries()].map(([week, weekGames]) => (
        <section key={week}>
          <h2 className="mb-2 font-semibold">
            {week <= 12
              ? `Week ${week}`
              : [...new Set(weekGames.map((g) => ROUND_LABEL[g.round] ?? g.round))].join(" & ")}
          </h2>
          <WeekGamesTable
            games={weekGames}
            standingsByTeamId={standingsByTeamId}
            dynastyId={dynasty.id}
            showBowlNames={week > 12}
          />
        </section>
      ))}
    </main>
  );
}
