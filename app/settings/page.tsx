import Link from "next/link";
import { getShowWinOdds } from "@/lib/dynasty/settings";
import { updateSettingsAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const showWinOdds = await getShowWinOdds();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <div>
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          &larr; CFB Dynasty Sim
        </Link>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">Applies to every dynasty on this browser.</p>
      </div>

      <form action={updateSettingsAction} className="flex flex-col gap-4">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="showWinOdds" defaultChecked={showWinOdds} className="mt-0.5 h-4 w-4" />
          <span>
            Show win odds for upcoming games
            <span className="block text-xs text-zinc-500">
              Replaces the blank score with each team&apos;s estimated chance to win, for any game that
              hasn&apos;t been played yet.
            </span>
          </span>
        </label>
        <button
          type="submit"
          className="self-start rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Save
        </button>
      </form>
    </main>
  );
}
