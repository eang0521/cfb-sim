import { prisma } from "@/lib/db/client";
import { simulateWeek } from "./simulateWeek";
import { advancePostseason } from "./postseason";

export interface RegularSeasonSimResult {
  // The last regular-season week actually played, or null if none were
  // (e.g. called when the season was already past IN_PROGRESS).
  lastPlayedWeek: number | null;
}

// Simulates up to `maxWeeks` regular-season weeks, stopping early if the
// regular season ends (status flips to POSTSEASON) before using them all.
export async function simulateWeeks(seasonId: string, maxWeeks: number): Promise<RegularSeasonSimResult> {
  let lastPlayedWeek: number | null = null;
  for (let i = 0; i < maxWeeks; i++) {
    const season = await prisma.season.findUniqueOrThrow({ where: { id: seasonId } });
    if (season.status !== "IN_PROGRESS") break;
    const result = await simulateWeek(seasonId);
    lastPlayedWeek = result.week;
    if (result.seasonComplete) break;
  }
  return { lastPlayedWeek };
}

export async function simulateRestOfRegularSeason(seasonId: string): Promise<RegularSeasonSimResult> {
  return simulateWeeks(seasonId, Number.MAX_SAFE_INTEGER);
}

// Repeatedly advances the postseason (conference championships -> playoff
// rounds/bowls -> final) until the season is COMPLETE.
export async function simulateRestOfPostseason(seasonId: string): Promise<void> {
  while (true) {
    const season = await prisma.season.findUniqueOrThrow({ where: { id: seasonId } });
    if (season.status !== "POSTSEASON") break;
    await advancePostseason(seasonId);
  }
}

export async function simulateRestOfSeason(seasonId: string): Promise<void> {
  await simulateRestOfRegularSeason(seasonId);
  await simulateRestOfPostseason(seasonId);
}
