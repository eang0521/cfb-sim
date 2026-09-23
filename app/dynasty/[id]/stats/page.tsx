import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentSeason, getStandings } from "@/lib/dynasty/queries";
import { TeamStatsTable, type TeamStatsRow } from "@/app/components/TeamStatsTable";
import { ScatterChart, type ScatterDatum } from "@/app/components/ScatterChart";

export default async function StatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { dynasty, season } = await getCurrentSeason(id).catch(() => ({ dynasty: null, season: null }));
  if (!dynasty || !season) notFound();

  const standings = await getStandings(season.id);
  const rows: TeamStatsRow[] = standings.map((ts) => ({
    teamId: ts.teamId,
    teamName: ts.team.name,
    conferenceCode: ts.team.conference.code,
    divisionCode: ts.team.division.code,
    prestige: ts.prestige,
    offRating: ts.offRating,
    defRating: ts.defRating,
  }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <div>
        <Link href={`/dynasty/${dynasty.id}`} className="text-sm text-zinc-500 hover:underline">
          &larr; {dynasty.name}
        </Link>
        <h1 className="text-2xl font-bold">Stats — Season {season.number}</h1>
        <p className="text-sm text-zinc-500">Conference, division, prestige, and roster offense/defense totals for every team.</p>
      </div>

      <TeamStatsTable teams={rows} dynastyId={dynasty.id} />

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <ScatterChart
          title="Overall vs. Prestige"
          xLabel="Prestige"
          yLabel="Overall"
          points={rows.map((t): ScatterDatum => ({
            id: t.teamId,
            label: t.teamName,
            x: t.prestige,
            y: t.offRating + t.defRating,
          }))}
        />
        <ScatterChart
          title="Defense vs. Offense"
          xLabel="Offense"
          yLabel="Defense"
          points={rows.map((t): ScatterDatum => ({
            id: t.teamId,
            label: t.teamName,
            x: t.offRating,
            y: t.defRating,
          }))}
        />
      </div>
    </main>
  );
}
