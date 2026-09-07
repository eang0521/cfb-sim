"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CLASS_YEARS, POS_GROUP_ORDER } from "@/lib/sim/roster";

export interface PlayerDatabaseRow {
  id: string;
  name: string;
  posGroup: string;
  pos: string;
  classYear: string;
  ovr: number;
  devTrait: number;
  devMarker: string;
  teamId: string;
  teamName: string;
}

type SortKey = "team" | "position" | "dev" | "skill" | "class";
type Direction = "asc" | "desc";
interface SortEntry {
  key: SortKey;
  direction: Direction;
}

const COLUMN_LABEL: Record<SortKey, string> = {
  team: "Team",
  position: "Position",
  dev: "Dev",
  skill: "Skill",
  class: "Class",
};

function keyValue(row: PlayerDatabaseRow, key: SortKey): number | string {
  switch (key) {
    case "team":
      return row.teamName;
    case "position":
      return POS_GROUP_ORDER.indexOf(row.posGroup as (typeof POS_GROUP_ORDER)[number]);
    case "dev":
      return row.devTrait;
    case "skill":
      return row.ovr;
    case "class":
      return CLASS_YEARS.indexOf(row.classYear as (typeof CLASS_YEARS)[number]);
  }
}

function compareByKey(a: PlayerDatabaseRow, b: PlayerDatabaseRow, key: SortKey): number {
  const va = keyValue(a, key);
  const vb = keyValue(b, key);
  if (typeof va === "string" || typeof vb === "string") return String(va).localeCompare(String(vb));
  return va - vb;
}

// Each click promotes that column to the front of the sort stack (or, if
// it's already the front/primary column, flips its direction) -- so
// clicking Skill then Team then Dev ends up sorted by Dev, then Team, then
// Skill as successive tiebreaks: exactly what you'd get from applying a
// stable sort one column at a time, in click order, most-recent = primary.
function toggleSort(stack: SortEntry[], key: SortKey): SortEntry[] {
  if (stack.length > 0 && stack[0].key === key) {
    return [{ key, direction: stack[0].direction === "asc" ? "desc" : "asc" }, ...stack.slice(1)];
  }
  const existing = stack.find((s) => s.key === key);
  const promoted: SortEntry = existing ?? { key, direction: "asc" };
  return [promoted, ...stack.filter((s) => s.key !== key)];
}

export function PlayerDatabaseTable({ players, dynastyId }: { players: PlayerDatabaseRow[]; dynastyId: string }) {
  const [sortStack, setSortStack] = useState<SortEntry[]>([{ key: "skill", direction: "desc" }]);

  const sorted = useMemo(() => {
    return players.slice().sort((a, b) => {
      for (const { key, direction } of sortStack) {
        const cmp = compareByKey(a, b, key) * (direction === "asc" ? 1 : -1);
        if (cmp !== 0) return cmp;
      }
      return 0;
    });
  }, [players, sortStack]);

  const columns: { key: SortKey; label: string }[] = [
    { key: "team", label: "Team" },
    { key: "position", label: "Position" },
    { key: "dev", label: "Dev" },
    { key: "skill", label: "Skill" },
    { key: "class", label: "Class" },
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
              <th className="py-1 pr-3">Name</th>
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
            {sorted.map((p) => (
              <tr key={p.id} className="odd:bg-zinc-50">
                <td className="py-1 pr-3">{p.name}</td>
                <td className="py-1 pr-3">
                  <Link href={`/dynasty/${dynastyId}/team/${p.teamId}`} className="hover:underline">
                    {p.teamName}
                  </Link>
                </td>
                <td className="py-1 pr-3">{p.pos}</td>
                <td className="py-1 pr-3">{p.devMarker || "—"}</td>
                <td className="py-1 pr-3 tabular-nums">{p.ovr}</td>
                <td className="py-1">{p.classYear}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
