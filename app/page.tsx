import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { createDynastyAction } from "./actions";

export default async function HomePage() {
  const dynasties = await prisma.dynasty.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <div>
        <h1 className="text-2xl font-bold">CFB Dynasty Sim</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Full recruiting &amp; aging engine, ported from the original spreadsheet -- play the
          classic 72-team league or the 144-team mega-league.
        </p>
      </div>

      <form action={createDynastyAction} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            name="name"
            required
            placeholder="New dynasty name"
            className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Start Dynasty
          </button>
        </div>
        <fieldset className="flex gap-4 text-sm text-zinc-600">
          <label className="flex items-center gap-1.5">
            <input type="radio" name="ruleset" value="CLASSIC" defaultChecked />
            72 Teams (Classic)
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="ruleset" value="MEGA144" />
            144 Teams
          </label>
        </fieldset>
      </form>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase text-zinc-500">Your Dynasties</h2>
        {dynasties.length === 0 && (
          <p className="text-sm text-zinc-400">No dynasties yet — start one above.</p>
        )}
        {dynasties.map((d) => (
          <Link
            key={d.id}
            href={`/dynasty/${d.id}`}
            className="flex items-center justify-between rounded border border-zinc-200 px-4 py-3 hover:bg-zinc-50"
          >
            <span className="font-medium">{d.name}</span>
            <span className="text-sm text-zinc-500">
              {d.ruleset === "MEGA144" ? "144 Teams" : "Classic"} &middot; Season {d.currentSeasonNumber}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
