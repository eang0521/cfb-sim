// Browser-wide display preferences (not tied to any one dynasty), stored the
// same cookie-based way as machineId.ts -- no account, so "this browser" is
// the only identity there is.
import { cookies } from "next/headers";

const SHOW_WIN_ODDS_COOKIE = "cfb_show_win_odds";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 5; // 5 years

export async function getShowWinOdds(): Promise<boolean> {
  const store = await cookies();
  return store.get(SHOW_WIN_ODDS_COOKIE)?.value === "1";
}

export async function setShowWinOdds(show: boolean): Promise<void> {
  const store = await cookies();
  store.set(SHOW_WIN_ODDS_COOKIE, show ? "1" : "0", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}
