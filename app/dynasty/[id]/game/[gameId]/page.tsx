import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { ROUND_LABEL } from "@/app/roundLabels";

export default async function GamePage({
  params,
}: {
  params: Promise<{ id: string; gameId: string }>;
}) {
  const { id, gameId } = await params;
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { awayTeam: true, homeTeam: true },
  });
  if (!game) notFound();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-6 py-16">
      <Link href={`/dynasty/${id}/schedule`} className="text-sm text-zinc-500 hover:underline">
        &larr; Schedule
      </Link>

      <div className="rounded border border-zinc-200 p-6 text-center">
        <p className="mb-4 text-sm text-zinc-500">
          Week {game.week} &middot;{" "}
          {game.bowlName ?? ROUND_LABEL[game.round] ?? game.round}
          {game.neutralSite ? " (neutral site)" : ""}
        </p>
        <div className="flex items-center justify-center gap-8 text-xl font-semibold">
          <span>{game.awayTeam.name}</span>
          <span className="tabular-nums">
            {game.played ? `${game.awayScore} - ${game.homeScore}` : "vs"}
          </span>
          <span>{game.homeTeam.name}</span>
        </div>
        {game.played && game.otPeriods > 0 && (
          <p className="mt-2 text-sm text-zinc-500">{game.otPeriods} overtime period(s)</p>
        )}
        {game.played && (
          <p className="mt-4 text-sm text-zinc-500">
            Power rating swing: {game.awayTeam.name} {game.eloChangeAway! >= 0 ? "+" : ""}
            {game.eloChangeAway?.toFixed(1)}, {game.homeTeam.name} {game.eloChangeHome! >= 0 ? "+" : ""}
            {game.eloChangeHome?.toFixed(1)}
          </p>
        )}
      </div>
    </main>
  );
}
