import Link from "next/link";
import { TeamLogo } from "@/app/components/TeamLogo";
import type { BracketDisplay, BracketSide } from "@/lib/dynasty/bracketDisplay";
import { ROUND_LABEL } from "@/app/roundLabels";

function SideRow({
  side,
  dynastyId,
  championTeamIds,
}: {
  side: BracketSide;
  dynastyId: string;
  championTeamIds: Set<string>;
}) {
  if (!side.team) {
    return (
      <div className="flex items-center justify-between px-2 py-1 text-zinc-400">
        <span className="text-xs">TBD</span>
      </div>
    );
  }
  const isChampion = championTeamIds.has(side.team.teamId);
  return (
    <div className={`flex items-center justify-between gap-2 px-2 py-1 ${side.winner ? "bg-zinc-100 font-semibold" : ""}`}>
      <Link
        href={`/dynasty/${dynastyId}/teams?team=${side.team.teamId}`}
        className="flex min-w-0 items-center gap-1.5 hover:underline"
      >
        <span className="w-4 shrink-0 text-right text-xs tabular-nums text-zinc-400">{side.team.seed}</span>
        <TeamLogo name={side.team.name} />
        <span className="truncate">{side.team.name}</span>
        {isChampion && <span className="shrink-0 text-xs text-zinc-500" title="Conference champion">*</span>}
      </Link>
      {side.score !== null && <span className="shrink-0 tabular-nums text-zinc-600">{side.score}</span>}
    </div>
  );
}

function MatchCard({
  match,
  dynastyId,
  championTeamIds,
}: {
  match: BracketDisplay["laterRounds"][number]["matches"][number];
  dynastyId: string;
  championTeamIds: Set<string>;
}) {
  return (
    <div className={`w-48 rounded border text-sm ${match.played ? "border-zinc-300" : "border-zinc-200"}`}>
      <SideRow side={match.away} dynastyId={dynastyId} championTeamIds={championTeamIds} />
      <div className="border-t border-zinc-200" />
      <SideRow side={match.home} dynastyId={dynastyId} championTeamIds={championTeamIds} />
    </div>
  );
}

function ByeCard({ team, dynastyId, championTeamIds }: { team: { teamId: string; name: string; seed: number }; dynastyId: string; championTeamIds: Set<string> }) {
  const isChampion = championTeamIds.has(team.teamId);
  return (
    <div className="w-48 rounded border border-zinc-200 text-sm">
      <div className="flex items-center justify-between gap-2 px-2 py-1">
        <Link href={`/dynasty/${dynastyId}/teams?team=${team.teamId}`} className="flex min-w-0 items-center gap-1.5 hover:underline">
          <span className="w-4 shrink-0 text-right text-xs tabular-nums text-zinc-400">{team.seed}</span>
          <TeamLogo name={team.name} />
          <span className="truncate">{team.name}</span>
          {isChampion && <span className="shrink-0 text-xs text-zinc-500" title="Conference champion">*</span>}
        </Link>
        <span className="shrink-0 text-xs text-zinc-400">BYE</span>
      </div>
    </div>
  );
}

// Renders the whole bracket as a CSS grid: the first column's BASE_ROWS
// entries (byes interleaved with their paired first-round game) each occupy
// exactly 1 row, and every later round's matches span 2x the previous
// round's span, centered on the rows of the two entries that feed it --
// the classic bracket "doubling" layout, without needing SVG connectors.
export function PlayoffBracket({
  display,
  dynastyId,
  championTeamIds,
}: {
  display: BracketDisplay;
  dynastyId: string;
  championTeamIds: Set<string>;
}) {
  const baseRows = display.firstColumn.length;
  const columns = [
    { round: display.firstRound, isFirst: true },
    ...display.laterRounds.map((r) => ({ round: r.round, isFirst: false })),
  ];

  return (
    <div className="overflow-x-auto">
      <div className="mb-2 flex gap-6 text-xs font-semibold uppercase text-zinc-500" style={{ minWidth: `${columns.length * 13}rem` }}>
        {columns.map((c) => (
          <div key={c.round} className="w-48 shrink-0">
            {ROUND_LABEL[c.round] ?? c.round}
          </div>
        ))}
        {display.champion && <div className="w-48 shrink-0">Champion</div>}
      </div>
      <div className="flex gap-6" style={{ minWidth: `${columns.length * 13}rem` }}>
        <div className="grid w-48 shrink-0 gap-0" style={{ gridTemplateRows: `repeat(${baseRows}, auto)` }}>
          {display.firstColumn.map((entry, i) =>
            entry.type === "bye" ? (
              <div key={`bye-${entry.team.teamId}`} style={{ gridRow: `${i + 1} / span 1` }} className="flex items-center">
                <ByeCard team={entry.team} dynastyId={dynastyId} championTeamIds={championTeamIds} />
              </div>
            ) : (
              <div key={entry.match.gameId ?? `game-${i}`} style={{ gridRow: `${i + 1} / span 1` }} className="flex items-center">
                <MatchCard match={entry.match} dynastyId={dynastyId} championTeamIds={championTeamIds} />
              </div>
            )
          )}
        </div>

        {display.laterRounds.map((col, roundIndex) => {
          const span = Math.pow(2, roundIndex + 1);
          return (
            <div key={col.round} className="grid w-48 shrink-0 gap-0" style={{ gridTemplateRows: `repeat(${baseRows}, auto)` }}>
              {col.matches.map((m, i) => (
                <div
                  key={m.gameId ?? `${col.round}-${i}`}
                  style={{ gridRow: `${i * span + 1} / span ${span}` }}
                  className="flex items-center"
                >
                  <MatchCard match={m} dynastyId={dynastyId} championTeamIds={championTeamIds} />
                </div>
              ))}
            </div>
          );
        })}

        {display.champion && (
          <div className="flex w-48 shrink-0 items-center">
            <div className="w-48 rounded border border-amber-300 bg-amber-50 px-2 py-2 text-sm">
              <Link href={`/dynasty/${dynastyId}/teams?team=${display.champion.teamId}`} className="flex items-center gap-1.5 font-semibold hover:underline">
                <TeamLogo name={display.champion.name} />
                <span className="truncate">{display.champion.name}</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
