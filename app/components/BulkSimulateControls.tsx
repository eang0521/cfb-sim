"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { simulateWeekStepAction, advancePostseasonStepAction } from "@/app/actions";
import { ROUND_LABEL } from "@/app/roundLabels";

const BUTTON =
  "rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40";

const REGULAR_SEASON_WEEKS = 12;

interface Progress {
  label: string;
  current: number | null; // null = indeterminate (postseason step count isn't known ahead of time)
  total: number | null;
}

// Drives multi-step simulation (a month, the rest of a season, etc.) from
// the client, one network round-trip at a time, instead of one big server
// action -- a single server action gives the browser nothing to show until
// the WHOLE thing finishes, which over a network database can take long
// enough to look frozen. Each step here updates a progress bar/status line
// so the user can see it's actually working.
export function BulkSimulateControls({
  dynastyId,
  seasonId,
  status,
  currentWeek,
}: {
  dynastyId: string;
  seasonId: string;
  status: string;
  currentWeek: number;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<Progress | null>(null);
  const isRunning = progress !== null;

  async function runRegularSeasonWeeks(maxWeeks: number, total: number): Promise<number | null> {
    let lastPlayedWeek: number | null = null;
    let completed = 0;
    while (completed < maxWeeks) {
      const result = await simulateWeekStepAction(dynastyId, seasonId);
      completed++;
      lastPlayedWeek = result.week;
      setProgress({ label: `Simulating Week ${result.week}...`, current: completed, total });
      if (result.seasonComplete) break;
    }
    return lastPlayedWeek;
  }

  async function runPostseasonSteps(): Promise<void> {
    while (true) {
      const result = await advancePostseasonStepAction(dynastyId, seasonId);
      const roundLabel = ROUND_LABEL[result.round] ?? result.round;
      setProgress({
        label: result.stage === "scheduled" ? `Setting up the ${roundLabel}...` : `Simulating the ${roundLabel}...`,
        current: null,
        total: null,
      });
      if (result.seasonComplete) break;
    }
  }

  function finish(query: string) {
    setProgress(null);
    router.push(`/dynasty/${dynastyId}${query}`);
    router.refresh();
  }

  async function handleSimulateMonth() {
    setProgress({ label: "Starting...", current: 0, total: 4 });
    const lastPlayedWeek = await runRegularSeasonWeeks(4, 4);
    finish(lastPlayedWeek ? `?week=${lastPlayedWeek}` : "");
  }

  async function handleSimulateRestOfRegularSeason() {
    const total = REGULAR_SEASON_WEEKS - currentWeek + 1;
    setProgress({ label: "Starting...", current: 0, total });
    const lastPlayedWeek = await runRegularSeasonWeeks(Number.MAX_SAFE_INTEGER, total);
    finish(lastPlayedWeek ? `?week=${lastPlayedWeek}` : "");
  }

  async function handleSimulateRestOfPostseason() {
    setProgress({ label: "Starting...", current: null, total: null });
    await runPostseasonSteps();
    finish("");
  }

  async function handleSimulateRestOfSeason() {
    if (status === "IN_PROGRESS") {
      const total = REGULAR_SEASON_WEEKS - currentWeek + 1;
      setProgress({ label: "Starting...", current: 0, total });
      await runRegularSeasonWeeks(Number.MAX_SAFE_INTEGER, total);
    }
    setProgress({ label: "Starting postseason...", current: null, total: null });
    await runPostseasonSteps();
    finish("");
  }

  const buttons =
    status === "IN_PROGRESS"
      ? [
          { label: "Simulate Month (4 Weeks)", onClick: handleSimulateMonth },
          { label: "Simulate Rest of Regular Season", onClick: handleSimulateRestOfRegularSeason },
          { label: "Simulate Rest of Season", onClick: handleSimulateRestOfSeason },
        ]
      : status === "POSTSEASON"
        ? [
            { label: "Simulate Rest of Postseason", onClick: handleSimulateRestOfPostseason },
            { label: "Simulate Rest of Season", onClick: handleSimulateRestOfSeason },
          ]
        : [];

  return (
    <>
      {buttons.map((b) => (
        <button key={b.label} type="button" className={BUTTON} disabled={isRunning} onClick={b.onClick}>
          {b.label}
        </button>
      ))}
      {progress && (
        <div className="flex w-full flex-col gap-1 pt-1">
          <p className="text-xs text-zinc-500">
            {progress.label}
            {progress.current !== null && progress.total !== null ? ` (${progress.current}/${progress.total})` : ""}
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
            {progress.current !== null && progress.total !== null ? (
              <div
                className="h-full rounded-full bg-zinc-900 transition-all duration-300"
                style={{ width: `${Math.min(100, (progress.current / progress.total) * 100)}%` }}
              />
            ) : (
              <div className="animate-progress-sweep h-full w-1/3 rounded-full bg-zinc-900" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
