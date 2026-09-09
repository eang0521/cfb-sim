import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentSeason, getRosterMoves } from "@/lib/dynasty/queries";

const TYPE_LABEL: Record<string, string> = {
  GRADUATED: "Graduated",
  EARLY_DEPARTURE: "Early Departure",
  TRANSFER: "Transfer",
  FRESHMAN: "Incoming Freshman",
};

export default async function OffseasonReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { id } = await params;
  const { season: seasonParam } = await searchParams;
  const { dynasty, season } = await getCurrentSeason(id).catch(() => ({ dynasty: null, season: null }));
  if (!dynasty || !season) notFound();

  const parsedSeason = seasonParam ? Number.parseInt(seasonParam, 10) : NaN;
  const viewedSeasonNumber = Number.isFinite(parsedSeason)
    ? Math.min(Math.max(parsedSeason, 1), dynasty.currentSeasonNumber)
    : season.number;

  const canGoPrev = viewedSeasonNumber > 1;
  const canGoNext = viewedSeasonNumber < dynasty.currentSeasonNumber;

  const moves = await getRosterMoves(dynasty.id, viewedSeasonNumber);

  const departures = moves.filter((m) => m.type === "GRADUATED" || m.type === "EARLY_DEPARTURE");
  const transfers = moves.filter((m) => m.type === "TRANSFER");
  const freshmen = moves.filter((m) => m.type === "FRESHMAN");

  const row = (m: (typeof moves)[number]) => (
    <tr key={m.id} className="odd:bg-zinc-50">
      <td className="py-1 pr-3">{m.playerName}</td>
      <td className="py-1 pr-3">{m.posGroup}</td>
      <td className="py-1 pr-3 text-zinc-600">{TYPE_LABEL[m.type] ?? m.type}</td>
      <td className="py-1 pr-3">{m.fromTeam?.name ?? "High School"}</td>
      <td className="py-1 pr-3">{m.toTeam?.name ?? "—"}</td>
      <td className="py-1 tabular-nums text-zinc-600">{m.ovr}</td>
    </tr>
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <div>
        <Link href={`/dynasty/${dynasty.id}`} className="text-sm text-zinc-500 hover:underline">
          &larr; {dynasty.name}
        </Link>
        <div className="mt-1 flex items-center gap-2">
          {canGoPrev ? (
            <Link
              href={`/dynasty/${dynasty.id}/offseason?season=${viewedSeasonNumber - 1}`}
              className="rounded border border-zinc-300 px-2 py-1 text-sm hover:bg-zinc-50"
              aria-label="Previous season"
            >
              &larr;
            </Link>
          ) : (
            <span className="rounded border border-zinc-100 px-2 py-1 text-sm text-zinc-300">&larr;</span>
          )}
          <h1 className="text-2xl font-bold">Offseason Report — Season {viewedSeasonNumber}</h1>
          {canGoNext ? (
            <Link
              href={`/dynasty/${dynasty.id}/offseason?season=${viewedSeasonNumber + 1}`}
              className="rounded border border-zinc-300 px-2 py-1 text-sm hover:bg-zinc-50"
              aria-label="Next season"
            >
              &rarr;
            </Link>
          ) : (
            <span className="rounded border border-zinc-100 px-2 py-1 text-sm text-zinc-300">&rarr;</span>
          )}
        </div>
        <p className="text-sm text-zinc-500">Every departure, transfer, and incoming freshman that produced that season&apos;s rosters.</p>
      </div>

      {moves.length === 0 ? (
        <p className="text-sm text-zinc-400">
          No offseason moves recorded for this season (season 1&apos;s roster is freshly bootstrapped, not produced
          by an offseason transition).
        </p>
      ) : (
        <>
          <section>
            <h2 className="mb-2 font-semibold">Departures ({departures.length})</h2>
            <p className="mb-2 text-xs text-zinc-500">
              Seniors graduating, plus junior Stars declaring early — both leave college football for good.
            </p>
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-zinc-500">
                <tr>
                  <th className="py-1 pr-3">Name</th>
                  <th className="py-1 pr-3">Pos</th>
                  <th className="py-1 pr-3">Type</th>
                  <th className="py-1 pr-3">From</th>
                  <th className="py-1 pr-3">To</th>
                  <th className="py-1">OVR</th>
                </tr>
              </thead>
              <tbody>{departures.map(row)}</tbody>
            </table>
          </section>

          <section>
            <h2 className="mb-2 font-semibold">Transfers ({transfers.length})</h2>
            <p className="mb-2 text-xs text-zinc-500">
              Every non-leaving player has a 1-in-6 shot of entering the portal; the whole transfer class then
              gets matched to the teams with an opening by Team Value (prestige) vs. Player Value (OVR).
            </p>
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-zinc-500">
                <tr>
                  <th className="py-1 pr-3">Name</th>
                  <th className="py-1 pr-3">Pos</th>
                  <th className="py-1 pr-3">Type</th>
                  <th className="py-1 pr-3">From</th>
                  <th className="py-1 pr-3">To</th>
                  <th className="py-1">OVR</th>
                </tr>
              </thead>
              <tbody>{transfers.map(row)}</tbody>
            </table>
          </section>

          <section>
            <h2 className="mb-2 font-semibold">Incoming Freshmen ({freshmen.length})</h2>
            <p className="mb-2 text-xs text-zinc-500">One new HS signee per graduation/early-departure opening.</p>
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-zinc-500">
                <tr>
                  <th className="py-1 pr-3">Name</th>
                  <th className="py-1 pr-3">Pos</th>
                  <th className="py-1 pr-3">Type</th>
                  <th className="py-1 pr-3">From</th>
                  <th className="py-1 pr-3">To</th>
                  <th className="py-1">OVR</th>
                </tr>
              </thead>
              <tbody>{freshmen.map(row)}</tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}
