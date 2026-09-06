# CFB Dynasty Sim

A web port of a 72-team, 6-conference college football dynasty simulator originally built as a
41-sheet Excel/Google-Sheets workbook. Full dynasty mode: simulate a season week by week, run a
6-team playoff, then roll into an offseason (aging, recruiting, prestige shifts) and repeat.

## Getting started

```bash
npm install
cp .env.example .env
npm run db:push    # creates prisma/dev.db from the schema
npm run db:seed    # seeds the 6 conferences / 12 divisions / 72 teams
npm run dev
```

Open http://localhost:3000, start a dynasty, and simulate.

Run the simulation engine's unit tests with `npm test`.

## How a dynasty works

1. **Create a dynasty** — bootstraps all 72 teams with a 6-player roster (exactly one of QB, UT,
   OL, DL, LB, DB each — confirmed directly against the workbook's own team sheets) and generates
   a 12-game regular-season schedule.
2. **Simulate Week N** — plays every game for the current week and updates records/rankings.
3. Once the regular season ends, **Advance Postseason** repeatedly to run:
   - **Conference championships** (each conference's two division leaders, neutral site).
   - **The 6-team playoff**: the top 3 conference champions by national rank auto-qualify no
     matter what, the other 3 spots go to the best-ranked teams left, then the whole field is
     re-seeded 1-6 by national rank (so a lower-ranked auto-bid champion can still land the
     6-seed over a higher-ranked team that missed the field). Seeds 1-2 bye into the semifinals;
     3v6/4v5 quarterfinals. Every playoff and championship game is neutral-site.
   - **Every non-playoff bowl game** for the other 6+-win teams, run alongside the quarterfinals
     (2 national at-large bowls, 12 conference tie-in bowls, and however many more it takes to
     place every remaining eligible team, cross-conference only) — also neutral-site.
4. Once the season is `COMPLETE`, **Run Offseason**:
   - Updates each team's Prestige.
   - Decides every player's fate: seniors graduate, junior Stars (dev=3) declare early, everyone
     else has a 1-in-6 shot at the transfer portal — anyone not leaving just ages in place.
   - Runs the transfer-portal/recruiting market per position group to fill every opening (see
     below), logging every move to that season's **Offseason Report** page.
   - Schedules the next season.

## Player movement

None of this is in the original workbook (it modeled aging/graduation only) — supplied directly:

- **Early departure**: a junior with a Star (dev=3) dev trait leaves early, same as a senior
  graduating — both are gone from college football for good (`lib/sim/roster.ts#isEarlyDeparture`).
- **Transfer portal**: every player not already leaving has a 1/6 chance
  (`rollEntersTransferPortal`) of entering the portal instead of returning to the same slot.
- **The market** (`lib/sim/recruiting.ts#runPositionMarket`), run once per position group: teams
  with an opening get a **Team Value** = `(new) prestige + rand()*25`; pool players (that
  position's transfers, plus one fresh HS recruit per graduation/early-departure opening) get a
  **Player Value** = `current OVR * (rand()+1)`. Both lists are ranked and paired 1:1 — the
  highest Team Value lands the highest Player Value, and so on down the list — so pool size always
  exactly matches openings (transfers fill transfer-created openings; HS recruits replace
  graduations/departures). A placed transfer is grown one year (same engine as if they'd stayed);
  a placed freshman starts at FR as generated. One rare, accepted quirk: nothing stops the market
  from re-matching a transfer back to the school they just left.
- **Names**: every player gets one from `lib/sim/names.ts` (~220 first x ~430 last names).
- The full transaction log — who left, who arrived, old school, new school — is on each season's
  **Offseason Report** page, backed by the `RosterMove` table.

## What's a faithful port vs. what's reimagined

This started as a reverse-engineering exercise on the original spreadsheet's formulas. Where the
formula survived, it's ported as directly as TypeScript allows:

- `lib/sim/rng.ts` — the `CoinGeom` geometric-distribution lookup, the weighted-d6 possession
  count, and Excel's `BINOM.INV`.
- `lib/sim/game.ts` — possession count → scoring-rate → binomial scores/FG-split → overtime
  (with the real 3rd-OT two-point-conversion rule) → the Elo-style rating swing.
- `lib/sim/roster.ts` — HS recruit generation, the dev-trait roll, and the compounding
  growth-per-dev-trait formula used for aging. Confirmed against `S1Teams` directly: each team
  carries exactly 6 players (one per position group), not a full multi-year roster — a slot ages
  FR→SO→JR→SR and is replaced by that season's fresh recruit for the same slot once it graduates.
- `lib/dynasty/fcsTeam.ts` — the FCS "team" has no persistent roster; the workbook re-rolls its
  strength every single game (pasted, not a live formula, but 216 sampled games fit a 3d6 roll for
  both offense and defense closely: observed mean 10.39/stdev 3.01 vs. 3d6's 10.5/2.96).

Where the original *formula* didn't survive in the file (the workbook only kept pasted values for
a few mechanics, and its author's own memory of the exact rule was fuzzy), the missing piece was
supplied directly and ported exactly:

- **`lib/sim/prestige.ts`** — Prestige is *not* static; it updates every offseason:
  `round(oldPrestige * 2/3) + totalWins - totalLosses + conferenceRankBonus + randomSwing`.
  `conferenceRankBonus` ranks the 6 conferences by total wins that season (ties broken by the
  conference's summed old prestige) and applies `[+2, +1, 0, 0, -1, -2]`; `randomSwing` is uniform
  over `{-3,-2,-1,1,2,3}`.
- **`lib/data/bowls.ts` / `lib/dynasty/bowls.ts`** — non-playoff bowls for every other 6+-win team:
  2 national at-large bowls (ranks 7-8, 9-10 among non-playoff teams), then 12 conference-vs-
  conference seed bowls straight from the workbook's `List of Bowls` sheet (SEC/B10 get their top
  5 non-playoff teams seeded in, B12/PAC their top 4, ACC/BEC their top 3), then everyone still
  eligible gets paired off in rank order under one of the sheet's remaining (previously
  unused-by-any-formula) bowl names — always cross-conference, via a most-constrained-first
  matching so a single heavy conference near the end of the list can't strand itself
  (`lib/sim/bowlPairing.ts`). If the pool of 6+-win teams is odd, the highest-ranked 5-win team is
  added so nobody is left stranded, matching the real NCAA rule.
- **`lib/sim/schedule.ts`** — the workbook's week-rotation formulas survived intact and identically
  in two different sheets (`Sheet2` and `FullSchedGen`), keyed off a `Season` input cell, and are
  ported exactly:
  `week1=R, week2=F, week3=N±, week4=D±, week5=N±, week6=D±, week7=C±, week8=D±, week9=C±,
  week10=D±, week11=C±, week12=DR` — division (D1-D4/DR) and conference cross-division (C1-C3)
  opponents are **fixed forever**, only the week they land in and who hosts rotates by season
  (`MOD(season*(season+3)/2 - k, 4)+1` for division, `MOD(season±k, 3)+1` for conference — both
  ported verbatim). What didn't survive as a portable rule: the exact *identity* of each team's
  fixed D1-D4/DR/C1-C3 partners (the workbook's version was a hand-curated table, not a formula),
  and the exact conference-pairing rotation behind the "N" slots — those are reconstructed: fixed
  partners come from a one-time stable round-robin over each division/conference (same shape,
  same "always set" property, different specific pairings), and the 2 rank-seeded non-conference
  games (weeks 3 & 5) seed each team's rank *within its own conference at the end of the prior
  season* against another conference's same-rank team, rotating which conferences pair up every
  season — matching the rule as described, calibrated where the exact table didn't survive. Week 1
  ("R") is treated as a second fixed, permanent, cross-conference rival, alongside week 2's FCS
  cupcake ("F").
- **Season-1 rosters** and the non-conference seeding for season 1 (no real "prior season" to draw
  on) are freshly generated/derived from initial prestige, rather than importing the workbook's
  original one-off starting values.
- **Conference championships and playoff seeding**: each conference's two division leaders (best
  conference record, ties broken by power rating) meet at a neutral site; the top 3 conference
  champions by national rank auto-qualify for the playoff regardless of rank, the rest of the field
  is at-large, and the combined 6 are re-seeded 1-6 by national rank — supplied directly and
  ported exactly (`lib/sim/playoff.ts#selectPlayoffField`).
- **Recruiting sub-position weights** (within "DL": DE 2/3, DT 1/3; "OL": OT 1/2, OG 1/3, C 1/6;
  "UT": WR 1/2, RB 1/3, TE 1/6; "DB": CB/S 50/50) were supplied directly rather than recovered
  from a formula.

## Stack

Next.js (App Router) + TypeScript + Prisma/SQLite + Vitest. See `prisma/schema.prisma` for the
data model and `lib/dynasty/*.ts` for the season lifecycle (creation, weekly sim, postseason,
offseason).
