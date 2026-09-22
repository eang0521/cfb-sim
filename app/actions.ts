"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { createDynasty, type Ruleset } from "@/lib/dynasty/createDynasty";
import { assertOwnsDynasty } from "@/lib/dynasty/queries";
import { getOrCreateMachineId } from "@/lib/dynasty/machineId";
import { setShowWinOdds } from "@/lib/dynasty/settings";
import { simulateWeek } from "@/lib/dynasty/simulateWeek";
import { advancePostseason, type PostseasonStepResult } from "@/lib/dynasty/postseason";
import { runOffseason } from "@/lib/dynasty/runOffseason";

export async function updateSettingsAction(formData: FormData) {
  await setShowWinOdds(formData.get("showWinOdds") === "on");
  revalidatePath("/", "layout");
  redirect("/settings");
}

export async function createDynastyAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Dynasty name is required.");
  const rulesetInput = String(formData.get("ruleset") ?? "MEGA144");
  const ruleset: Ruleset = rulesetInput === "CLASSIC" ? "CLASSIC" : "MEGA144";
  const ownerId = await getOrCreateMachineId();
  const dynasty = await createDynasty(name, ruleset, ownerId);
  redirect(`/dynasty/${dynasty.id}`);
}

// Stays on the week that was just played (rather than the dashboard's
// default of "whatever week is now current", which has already advanced)
// so the user actually sees the results.
export async function simulateWeekAction(dynastyId: string, seasonId: string) {
  await assertOwnsDynasty(dynastyId);
  const season = await prisma.season.findUniqueOrThrow({ where: { id: seasonId } });
  const weekJustPlayed = season.currentWeek;
  await simulateWeek(seasonId);
  revalidatePath(`/dynasty/${dynastyId}`);
  redirect(`/dynasty/${dynastyId}?week=${weekJustPlayed}`);
}

const POSTSEASON_ROUND_WEEK: Record<string, number> = {
  CONF_CHAMPIONSHIP: 13,
  FIRST_ROUND: 14, // MEGA144 only
  QUARTERFINAL: 15,
  SEMIFINAL: 16,
  FINAL: 17,
};

export async function advancePostseasonAction(dynastyId: string, seasonId: string) {
  await assertOwnsDynasty(dynastyId);
  const result = await advancePostseason(seasonId);
  revalidatePath(`/dynasty/${dynastyId}`);
  redirect(`/dynasty/${dynastyId}?week=${POSTSEASON_ROUND_WEEK[result.round]}`);
}

export async function runOffseasonAction(dynastyId: string) {
  await assertOwnsDynasty(dynastyId);
  await runOffseason(dynastyId);
  revalidatePath(`/dynasty/${dynastyId}`);
  redirect(`/dynasty/${dynastyId}?week=1`);
}

// Non-redirecting "one unit of work" actions, called directly (not via a
// <form>) from BulkSimulateControls' client-side loop so it can show real
// progress between each network round-trip -- a single big server action
// gives the browser nothing to report on until the whole thing finishes,
// which for "simulate the rest of the season" over a network database can
// run long enough to look frozen.
export async function simulateWeekStepAction(dynastyId: string, seasonId: string) {
  await assertOwnsDynasty(dynastyId);
  const result = await simulateWeek(seasonId);
  revalidatePath(`/dynasty/${dynastyId}`);
  return result;
}

export async function advancePostseasonStepAction(dynastyId: string, seasonId: string): Promise<PostseasonStepResult> {
  await assertOwnsDynasty(dynastyId);
  const result = await advancePostseason(seasonId);
  revalidatePath(`/dynasty/${dynastyId}`);
  return result;
}
