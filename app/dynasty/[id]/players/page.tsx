import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPlayers, getCurrentSeason } from "@/lib/dynasty/queries";
import { PlayerDatabaseTable, type PlayerDatabaseRow } from "@/app/components/PlayerDatabaseTable";

export default async function PlayersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { dynasty } = await getCurrentSeason(id).catch(() => ({ dynasty: null, season: null }));
  if (!dynasty) notFound();

  const players = await getAllPlayers(dynasty.id);
  const rows: PlayerDatabaseRow[] = players.map((p) => ({
    id: p.id,
    name: p.name,
    posGroup: p.posGroup,
    pos: p.pos,
    classYear: p.classYear,
    ovr: p.ovr,
    devTrait: p.devTrait,
    devMarker: p.devMarker,
    teamId: p.teamId,
    teamName: p.team.name,
  }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <div>
        <Link href={`/dynasty/${dynasty.id}`} className="text-sm text-zinc-500 hover:underline">
          &larr; {dynasty.name}
        </Link>
        <h1 className="text-2xl font-bold">Players</h1>
        <p className="text-sm text-zinc-500">Every current player, league-wide -- sort by team, position, dev, skill, or class.</p>
      </div>

      <PlayerDatabaseTable players={rows} dynastyId={dynasty.id} />
    </main>
  );
}
