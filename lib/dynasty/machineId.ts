// Per-machine isolation without a login system: every browser gets a random
// id the first time it creates a dynasty, stored as an httpOnly cookie. No
// account, no password -- just "this browser created it, so only this
// browser sees it."
import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const COOKIE_NAME = "cfb_machine_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 5; // 5 years

// Read-only: for Server Components (page renders), which cannot set cookies.
// A visitor with no cookie yet has never created a dynasty either, so null
// here correctly means "owns nothing."
export async function getMachineId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

// Read-or-create: for Server Functions, which can also set cookies. Called
// right before a new dynasty needs an owner.
export async function getOrCreateMachineId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE_NAME)?.value;
  if (existing) return existing;

  const id = randomUUID();
  store.set(COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return id;
}
