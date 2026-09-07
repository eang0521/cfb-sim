import {
  simulateWeekAction,
  simulateWeeksAction,
  simulateRestOfRegularSeasonAction,
  advancePostseasonAction,
  simulateRestOfPostseasonAction,
  simulateRestOfSeasonAction,
  runOffseasonAction,
} from "@/app/actions";

const BUTTON = "rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700";
const OFFSEASON_BUTTON = "rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600";

export function SimulationBar({
  dynastyId,
  seasonId,
  seasonNumber,
  status,
  currentWeek,
}: {
  dynastyId: string;
  seasonId: string;
  seasonNumber: number;
  status: string;
  currentWeek: number;
}) {
  const simulateWeekWithIds = simulateWeekAction.bind(null, dynastyId, seasonId);
  const simulateMonthWithIds = simulateWeeksAction.bind(null, dynastyId, seasonId, 4);
  const simulateRestRegularWithIds = simulateRestOfRegularSeasonAction.bind(null, dynastyId, seasonId);
  const advancePostseasonWithIds = advancePostseasonAction.bind(null, dynastyId, seasonId);
  const simulateRestPostseasonWithIds = simulateRestOfPostseasonAction.bind(null, dynastyId, seasonId);
  const simulateRestSeasonWithIds = simulateRestOfSeasonAction.bind(null, dynastyId, seasonId);
  const runOffseasonWithId = runOffseasonAction.bind(null, dynastyId);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-zinc-200 bg-zinc-50 p-3">
      {status === "IN_PROGRESS" && (
        <>
          <form action={simulateWeekWithIds}>
            <button className={BUTTON}>Simulate Week {currentWeek}</button>
          </form>
          <form action={simulateMonthWithIds}>
            <button className={BUTTON}>Simulate Month (4 Weeks)</button>
          </form>
          <form action={simulateRestRegularWithIds}>
            <button className={BUTTON}>Simulate Rest of Regular Season</button>
          </form>
          <form action={simulateRestSeasonWithIds}>
            <button className={BUTTON}>Simulate Rest of Season</button>
          </form>
        </>
      )}
      {status === "POSTSEASON" && (
        <>
          <form action={advancePostseasonWithIds}>
            <button className={BUTTON}>Simulate Next Round</button>
          </form>
          <form action={simulateRestPostseasonWithIds}>
            <button className={BUTTON}>Simulate Rest of Postseason</button>
          </form>
          <form action={simulateRestSeasonWithIds}>
            <button className={BUTTON}>Simulate Rest of Season</button>
          </form>
        </>
      )}
      {status === "COMPLETE" && (
        <form action={runOffseasonWithId}>
          <button className={OFFSEASON_BUTTON}>Run Offseason &rarr; Season {seasonNumber + 1}</button>
        </form>
      )}
    </div>
  );
}
