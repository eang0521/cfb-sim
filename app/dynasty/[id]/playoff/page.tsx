import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentSeason, getStandings } from "@/lib/dynasty/queries";
import { prisma } from "@/lib/db/client";
import { GREEDY_NATIONAL_BOWLS_144 } from "@/lib/data/bowls144";

export default async function PlayoffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { dynasty, season } = await getCurrentSeason(id).catch(() => ({ dynasty: null, season: null }));
  if (!dynasty || !season) notFound();

  const standings = await getStandings(season.id);
  const isMega144 = dynasty.ruleset === "MEGA144";

  const postseasonGames = await prisma.game.findMany({
    where: {
      seasonId: season.id,
      round: { in: ["CONF_CHAMPIONSHIP", "FIRST_ROUND", "QUARTERFINAL", "SEMIFINAL", "FINAL", "BOWL"] },
    },
    include: { awayTeam: true, homeTeam: true },
    orderBy: { week: "asc" },
  });
  const championships = postseasonGames.filter((g) => g.round === "CONF_CHAMPIONSHIP");
  // The 4 greedy national at-large bowls (Brady/Rice/Payton/Montana) always
  // list first; everything else keeps its natural (DB) order.
  const bowlPriority = new Map(GREEDY_NATIONAL_BOWLS_144.map((name, i) => [name, i]));
  const bowlGames = postseasonGames
    .filter((g) => g.round === "BOWL")
    .slice()
    .sort((a, b) => (bowlPriority.get(a.bowlName ?? "") ?? Infinity) - (bowlPriority.get(b.bowlName ?? "") ?? Infinity));

  const championIds = championships
    .filter((g) => g.played)
    .map((g) => (g.awayScore! > g.homeScore! ? g.awayTeamId : g.homeTeamId));

  // The field is decided once (right after championships) and persisted to
  // TeamSeason.playoffSeed -- read that back rather than recomputing, since
  // national rank keeps moving as playoff/bowl games are played.
  const seeds = standings
    .filter((ts) => ts.playoffSeed != null)
    .sort((a, b) => a.playoffSeed! - b.playoffSeed!)
    .map((ts) => ({ teamId: ts.teamId, seed: ts.playoffSeed! }));
  const teamById = new Map(standings.map((ts) => [ts.teamId, ts]));

  const gameLine = (g: (typeof postseasonGames)[number]) => (
    <li key={g.id} className="flex items-center justify-between rounded px-2 py-1 odd:bg-zinc-50">
      <span>
        {g.bowlName && <span className="mr-2 text-xs text-zinc-500">{g.bowlName}:</span>}
        {g.awayTeam.name} @ {g.homeTeam.name}
      </span>
      <span className="tabular-nums text-zinc-600">
        {g.played ? `${g.awayScore} - ${g.homeScore}` : "—"}
      </span>
    </li>
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <div>
        <Link href={`/dynasty/${dynasty.id}`} className="text-sm text-zinc-500 hover:underline">
          &larr; {dynasty.name}
        </Link>
        <h1 className="text-2xl font-bold">Postseason — Season {season.number}</h1>
      </div>

      <section>
        <h2 className="mb-2 font-semibold">Conference Championships</h2>
        {championships.length === 0 ? (
          <p className="text-sm text-zinc-400">Not played yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">{championships.map(gameLine)}</ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Playoff Field</h2>
        {seeds.length === 0 ? (
          <p className="text-sm text-zinc-400">
            {isMega144
              ? "Set once conference championships finish — the top 6 conference champions (by national rank) auto-qualify no matter their rank, the other 6 spots go to the best-ranked teams left, and the field is then re-seeded 1-12 by rank."
              : "Set once conference championships finish — the top 3 conference champions (by national rank) auto-qualify no matter their rank, the other 3 spots go to the best-ranked teams left, and the field is then re-seeded 1-6 by rank."}
          </p>
        ) : (
          <ol className="flex flex-col gap-1 text-sm">
            {seeds.map((s) => {
              const ts = teamById.get(s.teamId)!;
              const isChampion = championIds.includes(s.teamId);
              return (
                <li key={s.teamId} className="flex items-center justify-between rounded px-2 py-1 odd:bg-zinc-50">
                  <span>
                    #{s.seed} {ts.team.name}
                    {isChampion && <span className="ml-2 text-xs text-zinc-500">(conf. champion)</span>}
                  </span>
                  <span className="tabular-nums text-zinc-600">
                    {ts.wins}-{ts.losses}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        <p className="mt-1 text-xs text-zinc-500">
          {isMega144
            ? "Seeds 1-4 receive a bye into the quarterfinals. All postseason games are neutral-site."
            : "Seeds 1-2 receive a bye into the semifinals. All postseason games are neutral-site."}
        </p>
      </section>

      {(isMega144
        ? (["FIRST_ROUND", "QUARTERFINAL", "SEMIFINAL", "FINAL"] as const)
        : (["QUARTERFINAL", "SEMIFINAL", "FINAL"] as const)
      ).map((round) => {
        const games = postseasonGames.filter((g) => g.round === round);
        if (games.length === 0) return null;
        return (
          <section key={round}>
            <h2 className="mb-2 font-semibold">
              {round === "FINAL"
                ? "National Championship"
                : round === "FIRST_ROUND"
                  ? "First Round"
                  : round.charAt(0) + round.slice(1).toLowerCase()}
            </h2>
            <ul className="flex flex-col gap-1 text-sm">{games.map(gameLine)}</ul>
          </section>
        );
      })}

      {bowlGames.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Bowl Games</h2>
          <p className="mb-2 text-xs text-zinc-500">
            For 6+ win teams that missed the playoff — conference tie-ins ported from the
            workbook&apos;s bowl list, plus two national at-large bowls for the teams ranked just
            outside the playoff cut.
          </p>
          <ul className="flex flex-col gap-1 text-sm">{bowlGames.map(gameLine)}</ul>
        </section>
      )}

      {postseasonGames.length === 0 && (
        <p className="text-sm text-zinc-400">
          Postseason hasn&apos;t been set yet — advance the postseason from the dynasty page.
        </p>
      )}
    </main>
  );
}
