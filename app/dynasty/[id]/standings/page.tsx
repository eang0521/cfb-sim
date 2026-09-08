import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentSeason, getStandings } from "@/lib/dynasty/queries";

export default async function StandingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { dynasty, season } = await getCurrentSeason(id).catch(() => ({ dynasty: null, season: null }));
  if (!dynasty || !season) notFound();

  const standings = await getStandings(season.id);
  const byConference = new Map<string, typeof standings>();
  for (const ts of standings) {
    const code = ts.team.conference.code;
    if (!byConference.has(code)) byConference.set(code, []);
    byConference.get(code)!.push(ts);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <div>
        <Link href={`/dynasty/${dynasty.id}`} className="text-sm text-zinc-500 hover:underline">
          &larr; {dynasty.name}
        </Link>
        <h1 className="text-2xl font-bold">Standings — Season {season.number}</h1>
      </div>

      <section>
        <h2 className="mb-2 font-semibold">National Power Rankings</h2>
        <ol className="flex flex-col gap-1 text-sm">
          {standings.map((ts, i) => (
            <li key={ts.id} className="flex items-center justify-between rounded px-2 py-1 odd:bg-zinc-50">
              <span>
                <span className="mr-2 w-6 tabular-nums text-zinc-400">{i + 1}.</span>
                <Link href={`/dynasty/${dynasty.id}/teams?team=${ts.teamId}`} className="hover:underline">
                  {ts.team.name}
                </Link>
                <span className="ml-2 text-xs text-zinc-500">
                  {ts.team.conference.code} {ts.team.division.code}
                </span>
              </span>
              <span className="tabular-nums text-zinc-600">
                {ts.wins}-{ts.losses} &middot; {Math.round(ts.powerElo)} pwr
              </span>
            </li>
          ))}
        </ol>
      </section>

      {[...byConference.entries()].map(([conf, teams]) => {
        const byDivision = new Map<string, typeof standings>();
        for (const ts of teams) {
          const code = ts.team.division.code;
          if (!byDivision.has(code)) byDivision.set(code, []);
          byDivision.get(code)!.push(ts);
        }

        return (
          <section key={conf}>
            <h2 className="mb-2 font-semibold">{conf}</h2>
            <div className="flex flex-col gap-4">
              {[...byDivision.entries()].map(([div, divTeams]) => (
                <div key={div}>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">{div}</h3>
                  <ul className="flex flex-col gap-1 text-sm">
                    {divTeams
                      .slice()
                      .sort((a, b) => b.confWins - b.confLosses - (a.confWins - a.confLosses))
                      .map((ts) => (
                        <li key={ts.id} className="flex items-center justify-between rounded px-2 py-1 odd:bg-zinc-50">
                          <Link href={`/dynasty/${dynasty.id}/teams?team=${ts.teamId}`} className="hover:underline">
                            {ts.team.name}
                          </Link>
                          <span className="tabular-nums text-zinc-600">
                            {ts.confWins}-{ts.confLosses} conf &middot; {ts.wins}-{ts.losses} overall
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
