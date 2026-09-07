"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { createDynasty } from "@/lib/dynasty/createDynasty";
import { simulateWeek } from "@/lib/dynasty/simulateWeek";
import { advancePostseason } from "@/lib/dynasty/postseason";
import { runOffseason } from "@/lib/dynasty/runOffseason";
import {
  simulateWeeks,
  simulateRestOfRegularSeason,
  simulateRestOfPostseason,
  simulateRestOfSeason,
} from "@/lib/dynasty/bulkSimulate";

export async function createDynastyAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Dynasty name is required.");
  const dynasty = await createDynasty(name);
  redirect(`/dynasty/${dynasty.id}`);
}

// Stays on the week that was just played (rather than the dashboard's
// default of "whatever week is now current", which has already advanced)
// so the user actually sees the results.
export async function simulateWeekAction(dynastyId: string, seasonId: string) {
  const season = await prisma.season.findUniqueOrThrow({ where: { id: seasonId } });
  const weekJustPlayed = season.currentWeek;
  await simulateWeek(seasonId);
  revalidatePath(`/dynasty/${dynastyId}`);
  redirect(`/dynasty/${dynastyId}?week=${weekJustPlayed}`);
}

const POSTSEASON_ROUND_WEEK: Record<string, number> = {
  CONF_CHAMPIONSHIP: 13,
  QUARTERFINAL: 15,
  SEMIFINAL: 16,
  FINAL: 17,
};

export async function advancePostseasonAction(dynastyId: string, seasonId: string) {
  const result = await advancePostseason(seasonId);
  revalidatePath(`/dynasty/${dynastyId}`);
  redirect(`/dynasty/${dynastyId}?week=${POSTSEASON_ROUND_WEEK[result.round]}`);
}

export async function runOffseasonAction(dynastyId: string) {
  await runOffseason(dynastyId);
  revalidatePath(`/dynasty/${dynastyId}`);
  redirect(`/dynasty/${dynastyId}?week=1`);
}

// Bulk regular-season simulation (e.g. "simulate a month"). Lands on the
// last week actually played so the user sees results rather than a blank
// upcoming week -- or the plain dashboard if the regular season ended
// before any week finished playing (shouldn't normally happen from the UI).
export async function simulateWeeksAction(dynastyId: string, seasonId: string, weeks: number) {
  const { lastPlayedWeek } = await simulateWeeks(seasonId, weeks);
  revalidatePath(`/dynasty/${dynastyId}`);
  redirect(lastPlayedWeek ? `/dynasty/${dynastyId}?week=${lastPlayedWeek}` : `/dynasty/${dynastyId}`);
}

export async function simulateRestOfRegularSeasonAction(dynastyId: string, seasonId: string) {
  const { lastPlayedWeek } = await simulateRestOfRegularSeason(seasonId);
  revalidatePath(`/dynasty/${dynastyId}`);
  redirect(lastPlayedWeek ? `/dynasty/${dynastyId}?week=${lastPlayedWeek}` : `/dynasty/${dynastyId}`);
}

export async function simulateRestOfPostseasonAction(dynastyId: string, seasonId: string) {
  await simulateRestOfPostseason(seasonId);
  revalidatePath(`/dynasty/${dynastyId}`);
  redirect(`/dynasty/${dynastyId}`);
}

export async function simulateRestOfSeasonAction(dynastyId: string, seasonId: string) {
  await simulateRestOfSeason(seasonId);
  revalidatePath(`/dynasty/${dynastyId}`);
  redirect(`/dynasty/${dynastyId}`);
}
