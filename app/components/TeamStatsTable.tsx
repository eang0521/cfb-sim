"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TeamLogo } from "@/app/components/TeamLogo";

export interface TeamStatsRow {
  teamId: string;
  teamName: string;
  conferenceCode: string;
  divisionCode: string;
  prestige: number;
  offRating: number;
  defRating: number;
}

type SortKey = "team" | "conference" | "division" | "prestige" | "offense" | "defense" | "total";
type Direction = "asc" | "desc";
interface SortEntry {
  key: SortKey;
  direction: Direction;
}

const COLUMN_LABEL: Record<SortKey, string> = {
  team: "Team",
  conference: "Conference",
  division: "Division",
  prestige: "Prestige",
  offense: "Offense",
  defense: "Defense",
  total: "Total",
};

function keyValue(row: TeamStatsRow, key: SortKey): number | string {
  switch (key) {
    case "team":
      return row.teamName;
    case "conference":
      return row.conferenceCode;
    case "division":
      return row.divisionCode;
    case "prestige":
      return row.prestige;
    case "offense":
      return row.offRating;
    case "defense":
      return row.defRating;
    case "total":
      return row.offRating + row.defRating;
  }
}

function compareByKey(a: TeamStatsRow, b: TeamStatsRow, key: SortKey): number {
  const va = keyValue(a, key);
  const vb = keyValue(b, key);
  if (typeof va === "string" || typeof vb === "string") return String(va).localeCompare(String(vb));
  return va - vb;
}

// Each click promotes that column to the front of the sort stack (or, if
// it's already the front/primary column, flips its direction) -- see
// PlayerDatabaseTable's identical toggleSort for the full reasoning.
function toggleSort(stack: SortEntry[], key: SortKey): SortEntry[] {
  if (stack.length > 0 && stack[0].key === key) {
    return [{ key, direction: stack[0].direction === "asc" ? "desc" : "asc" }, ...stack.slice(1)];
  }
  const existing = stack.find((s) => s.key === key);
  const promoted: SortEntry = existing ?? { key, direction: "asc" };
  return [promoted, ...stack.filter((s) => s.key !== key)];
}

export function TeamStatsTable({ teams, dynastyId }: { teams: TeamStatsRow[]; dynastyId: string }) {
  const [sortStack, setSortStack] = useState<SortEntry[]>([{ key: "prestige", direction: "desc" }]);

  const sorted = useMemo(() => {
    return teams.slice().sort((a, b) => {
      for (const { key, direction } of sortStack) {
        const cmp = compareByKey(a, b, key) * (direction === "asc" ? 1 : -1);
        if (cmp !== 0) return cmp;
      }
      return 0;
    });
  }, [teams, sortStack]);

  const columns: { key: SortKey; label: string }[] = [
    { key: "conference", label: "Conference" },
    { key: "division", label: "Division" },
    { key: "prestige", label: "Prestige" },
    { key: "offense", label: "Offense" },
    { key: "defense", label: "Defense" },
    { key: "total", label: "Total" },
  ];

  return (
    <div>
      <p className="mb-2 text-sm text-zinc-500">
        Sorted by {sortStack.map((s) => `${COLUMN_LABEL[s.key]} ${s.direction === "asc" ? "↑" : "↓"}`).join(", then ")}
        {sortStack.length > 0 ? " " : ""}
        <span className="text-zinc-400">-- click a column to sort by it (click again to flip direction)</span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-zinc-500">
            <tr>
              <th className="py-1 pr-3">
                <button
                  type="button"
                  onClick={() => setSortStack((prev) => toggleSort(prev, "team"))}
                  className={`flex items-center gap-1 uppercase hover:text-zinc-900 ${sortStack[0]?.key === "team" ? "font-semibold text-zinc-900" : ""}`}
                >
                  Team
                  {sortStack[0]?.key === "team" && (
                    <span className="tabular-nums text-zinc-400">{sortStack[0].direction === "asc" ? "↑" : "↓"}</span>
                  )}
                </button>
              </th>
              {columns.map((col) => {
                const stackIndex = sortStack.findIndex((s) => s.key === col.key);
                const active = stackIndex !== -1;
                return (
                  <th key={col.key} className="py-1 pr-3">
                    <button
                      type="button"
                      onClick={() => setSortStack((prev) => toggleSort(prev, col.key))}
                      className={`flex items-center gap-1 uppercase hover:text-zinc-900 ${active ? "font-semibold text-zinc-900" : ""}`}
                    >
                      {col.label}
                      {active && (
                        <span className="tabular-nums text-zinc-400">
                          {sortStack[stackIndex].direction === "asc" ? "↑" : "↓"}
                          {sortStack.length > 1 ? stackIndex + 1 : ""}
                        </span>
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <tr key={t.teamId} className="odd:bg-zinc-50">
                <td className="py-1 pr-3">
                  <Link href={`/dynasty/${dynastyId}/teams?team=${t.teamId}`} className="flex items-center gap-1.5 hover:underline">
                    <TeamLogo name={t.teamName} />
                    {t.teamName}
                  </Link>
                </td>
                <td className="py-1 pr-3">{t.conferenceCode}</td>
                <td className="py-1 pr-3">{t.divisionCode}</td>
                <td className="py-1 pr-3 tabular-nums">{Math.round(t.prestige)}</td>
                <td className="py-1 pr-3 tabular-nums">{t.offRating}</td>
                <td className="py-1 pr-3 tabular-nums">{t.defRating}</td>
                <td className="py-1 tabular-nums">{t.offRating + t.defRating}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
