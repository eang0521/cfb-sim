"use client";

import { useRouter } from "next/navigation";

export function TeamSelect({
  teams,
  selectedTeamId,
  basePath,
}: {
  teams: { id: string; name: string; conferenceCode: string }[];
  selectedTeamId: string;
  basePath: string;
}) {
  const router = useRouter();

  return (
    <select
      value={selectedTeamId}
      onChange={(e) => router.push(`${basePath}?team=${e.target.value}`)}
      className="w-full max-w-xs rounded border border-zinc-300 px-2 py-1.5 text-sm"
    >
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name} ({t.conferenceCode})
        </option>
      ))}
    </select>
  );
}
