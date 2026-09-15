import type { ReactNode } from "react";
import Link from "next/link";
import { TeamLogo } from "@/app/components/TeamLogo";
import type { BracketDisplay, BracketHalfDisplay, BracketMatchDisplay, BracketRoundName, BracketSide } from "@/lib/dynasty/bracketDisplay";
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

function MatchCard({ match, dynastyId, championTeamIds }: { match: BracketMatchDisplay; dynastyId: string; championTeamIds: Set<string> }) {
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

interface HalfColumn {
  round: BracketRoundName;
  body: ReactNode;
}

// Builds one half's columns in "outward from the final" order: the first
// round (byes interleaved with their paired game, each occupying exactly 1
// of that half's BASE_ROWS) is always last; each round before it spans 2x
// the round after it, centered on the rows of the two entries feeding it --
// the classic bracket "doubling" layout, without needing SVG connectors.
function buildHalfColumns(half: BracketHalfDisplay, firstRound: BracketRoundName, dynastyId: string, championTeamIds: Set<string>): HalfColumn[] {
  const baseRows = half.firstColumn.length;
  const firstColumn: HalfColumn = {
    round: firstRound,
    body: (
      <div className="grid w-48 shrink-0 gap-0" style={{ gridTemplateRows: `repeat(${baseRows}, auto)` }}>
        {half.firstColumn.map((entry, i) => (
          <div key={entry.type === "bye" ? `bye-${entry.team.teamId}` : (entry.match.gameId ?? `game-${i}`)} style={{ gridRow: `${i + 1} / span 1` }} className="flex items-center">
            {entry.type === "bye" ? (
              <ByeCard team={entry.team} dynastyId={dynastyId} championTeamIds={championTeamIds} />
            ) : (
              <MatchCard match={entry.match} dynastyId={dynastyId} championTeamIds={championTeamIds} />
            )}
          </div>
        ))}
      </div>
    ),
  };

  const roundColumns: HalfColumn[] = half.rounds.map((col, roundIndex) => {
    const span = Math.pow(2, roundIndex + 1);
    return {
      round: col.round,
      body: (
        <div className="grid w-48 shrink-0 gap-0" style={{ gridTemplateRows: `repeat(${baseRows}, auto)` }}>
          {col.matches.map((m, i) => (
            <div key={m.gameId ?? `${col.round}-${i}`} style={{ gridRow: `${i * span + 1} / span ${span}` }} className="flex items-center">
              <MatchCard match={m} dynastyId={dynastyId} championTeamIds={championTeamIds} />
            </div>
          ))}
        </div>
      ),
    };
  });

  // [firstRound, ...midRounds] -- outermost (first round) first.
  return [firstColumn, ...roundColumns];
}

// Renders a real two-sided bracket: the LEFT half's columns run outward-in
// (first round on the left edge, narrowing toward the middle), the RIGHT
// half is the same columns in reverse (first round on the right edge), and
// the final + champion sit centered between them -- so winners visibly move
// inward from both edges toward the middle, like a printed tournament
// bracket.
export function PlayoffBracket({
  display,
  dynastyId,
  championTeamIds,
}: {
  display: BracketDisplay;
  dynastyId: string;
  championTeamIds: Set<string>;
}) {
  const leftColumns = buildHalfColumns(display.left, display.firstRound, dynastyId, championTeamIds);
  const rightColumns = buildHalfColumns(display.right, display.firstRound, dynastyId, championTeamIds).slice().reverse();
  const centerLabel = "Final";

  const headerRow = (columns: HalfColumn[]) => (
    <div className="mb-2 flex gap-6 text-xs font-semibold uppercase text-zinc-500">
      {columns.map((c, i) => (
        <div key={`${c.round}-${i}`} className="w-48 shrink-0">
          {ROUND_LABEL[c.round] ?? c.round}
        </div>
      ))}
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <div className="flex items-start justify-center gap-6" style={{ minWidth: `${(leftColumns.length * 2 + 1) * 13}rem` }}>
        <div className="shrink-0">
          {headerRow(leftColumns)}
          <div className="flex gap-6">
            {leftColumns.map((c, i) => (
              <div key={`${c.round}-${i}`}>{c.body}</div>
            ))}
          </div>
        </div>

        <div className="shrink-0">
          <div className="mb-2 text-xs font-semibold uppercase text-zinc-500">{centerLabel}</div>
          <div className="flex flex-col items-center gap-3">
            <MatchCard match={display.final} dynastyId={dynastyId} championTeamIds={championTeamIds} />
            {display.champion && (
              <div className="w-48 rounded border border-amber-300 bg-amber-50 px-2 py-2 text-sm">
                <div className="mb-1 text-center text-xs font-semibold uppercase text-amber-700">Champion</div>
                <Link href={`/dynasty/${dynastyId}/teams?team=${display.champion.teamId}`} className="flex items-center justify-center gap-1.5 font-semibold hover:underline">
                  <TeamLogo name={display.champion.name} />
                  <span className="truncate">{display.champion.name}</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0">
          {headerRow(rightColumns)}
          <div className="flex gap-6">
            {rightColumns.map((c, i) => (
              <div key={`${c.round}-${i}`}>{c.body}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
