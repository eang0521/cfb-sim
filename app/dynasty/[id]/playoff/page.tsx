import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentSeason, getStandings } from "@/lib/dynasty/queries";
import { prisma } from "@/lib/db/client";
import { GREEDY_NATIONAL_BOWLS_144 } from "@/lib/data/bowls144";
import { formatHeismanValue } from "@/lib/dynasty/heisman";
import { TeamLogo } from "@/app/components/TeamLogo";
import { PlayoffBracket } from "@/app/components/PlayoffBracket";
import { buildBracketDisplay } from "@/lib/dynasty/bracketDisplay";

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
  const bracketGames = postseasonGames.filter((g) => g.round !== "CONF_CHAMPIONSHIP" && g.round !== "BOWL");
  // The 4 greedy national at-large bowls (Brady/Rice/Payton/Montana) always
  // list first; everything else keeps its natural (DB) order.
  const bowlPriority = new Map(GREEDY_NATIONAL_BOWLS_144.map((name, i) => [name, i]));
  const bowlGames = postseasonGames
    .filter((g) => g.round === "BOWL")
    .slice()
    .sort((a, b) => (bowlPriority.get(a.bowlName ?? "") ?? Infinity) - (bowlPriority.get(b.bowlName ?? "") ?? Infinity));

  const championIds = new Set(
    championships.filter((g) => g.played).map((g) => (g.awayScore! > g.homeScore! ? g.awayTeamId : g.homeTeamId))
  );

  // The field is decided once (right after championships) and persisted to
  // TeamSeason.playoffSeed -- read that back rather than recomputing, since
  // national rank keeps moving as playoff/bowl games are played.
  const teamById = new Map(standings.map((ts) => [ts.teamId, ts]));
  const seeds = standings
    .filter((ts) => ts.playoffSeed != null)
    .map((ts) => ({ teamId: ts.teamId, seed: ts.playoffSeed!, name: ts.team.name }));

  const bracket = seeds.length > 0 ? buildBracketDisplay(isMega144 ? 12 : 6, seeds, bracketGames) : null;

  const gameLine = (g: (typeof postseasonGames)[number]) => (
    <li key={g.id} className="flex items-center justify-between rounded px-2 py-1 odd:bg-zinc-50">
      <span className="inline-flex items-center gap-1.5">
        {g.bowlName && <span className="mr-0.5 text-xs text-zinc-500">{g.bowlName}:</span>}
        <TeamLogo name={g.awayTeam.name} />
        {g.awayTeam.name} @ <TeamLogo name={g.homeTeam.name} />
        {g.homeTeam.name}
      </span>
      <span className="tabular-nums text-zinc-600">
        {g.played ? `${g.awayScore} - ${g.homeScore}` : "—"}
      </span>
    </li>
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-16">
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

      <section>
        <h2 className="mb-2 font-semibold">Playoff Bracket</h2>
        {bracket ? (
          <>
            <PlayoffBracket display={bracket} dynastyId={dynasty.id} championTeamIds={championIds} />
            <p className="mt-3 text-xs text-zinc-500">
              * conference champion. {isMega144 ? "Seeds 1-4 receive a bye" : "Seeds 1-2 receive a bye"} into the{" "}
              {isMega144 ? "quarterfinals" : "semifinals"}; all postseason games are neutral-site.
            </p>
          </>
        ) : (
          <p className="text-sm text-zinc-400">
            {isMega144
              ? "Set once conference championships finish — the top 6 conference champions (by national rank) auto-qualify no matter their rank, the other 6 spots go to the best-ranked teams left, and the field is then re-seeded 1-12 by rank."
              : "Set once conference championships finish — the top 3 conference champions (by national rank) auto-qualify no matter their rank, the other 3 spots go to the best-ranked teams left, and the field is then re-seeded 1-6 by rank."}
          </p>
        )}
      </section>

      {season.heismanPlayerName && (
        <section>
          <h2 className="mb-2 font-semibold">Heisman</h2>
          <p className="text-sm text-zinc-600">
            {season.heismanPlayerName} ({season.heismanPosGroup},{" "}
            <Link href={`/dynasty/${dynasty.id}/teams?team=${season.heismanTeamId}`} className="hover:underline">
              {teamById.get(season.heismanTeamId!)?.team.name ?? "?"}
            </Link>
            ) &mdash; {formatHeismanValue(season.heismanValue!)} HEISMAN value
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Frozen right after conference championships -- playoff and bowl games don&apos;t affect it.
          </p>
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
