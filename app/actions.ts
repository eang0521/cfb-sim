"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { createDynasty } from "@/lib/dynasty/createDynasty";
import { simulateWeek } from "@/lib/dynasty/simulateWeek";
import { advancePostseason } from "@/lib/dynasty/postseason";
import { runOffseason } from "@/lib/dynasty/runOffseason";

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
