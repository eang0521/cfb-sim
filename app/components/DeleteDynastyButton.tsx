"use client";

import { deleteDynastyAction } from "@/app/actions";

// Deletion is permanent (every season/game/roster for this dynasty goes
// with it), so this confirms before the form even submits rather than
// relying on people not to misclick.
export function DeleteDynastyButton({ dynastyId, dynastyName }: { dynastyId: string; dynastyName: string }) {
  return (
    <form
      action={deleteDynastyAction}
      onSubmit={(e) => {
        if (!confirm(`Delete "${dynastyName}"? This permanently deletes every season, game, and roster in it.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="dynastyId" value={dynastyId} />
      <button
        type="submit"
        className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:border-red-300 hover:text-red-600"
      >
        Delete
      </button>
    </form>
  );
}
