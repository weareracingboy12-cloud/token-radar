# Token Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/weareracingboy12-cloud/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/weareracingboy12-cloud/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it reads a frozen snapshot of the DefiLlama protocol index,
ranks every pre-token protocol by the value a token would imply, and gives each one
a farm plan for the airdrop that may never come. Built for the make.fun bounty
"Build the best token launch radar" (token-radar-01).

## What it does

- Reads the sealed snapshot (`--input <snapshot.json>`, or `/input/snapshot.json`
  in the grader's container) and scores every pre-token protocol.
- Writes `/output/board.json` (the ranked board), `/output/data.js` (the same
  board for the dashboard), copies `dashboard/` and `screenshots/` to `/output`,
  and writes `/output/dossier.json` (the summary the judge reads).
- The board is 226 rows on the sealed 2026-11-14 snapshot: the 40 watchlist
  protocols (every pre-token protocol at or above the $50M TVL floor) plus 186
  early rows below the floor. Live-token protocols are set aside with their
  market caps shown, never mixed into the ranking.

## The model (radar-2)

Implied value follows only from the snapshot's own figures; no protocol name is
special-cased.

```
base        = tvl_usd x 0.22
growth      = clamp(change_7d, -50, 100) per cent
growthMult  = 1 + (growth / 100) x 0.6
maturity    = 0.55 + min(age_days, 1095) / 1095 x 0.45   (age unknown: 365 days)
chains      = 1 + 0.02 x min(max(chains - 1, 0), 5)     (breadth, capped at +10%)
missing     = 0.95 when change_7d is unreported, else 1
implied     = max(1, round(base x growthMult x maturity x chains x missing))
```

- **TVL** is the size of the business a token would price, so the biggest
  pre-token protocols lead.
- **Seven-day growth** is momentum, clamped so one hot week cannot crown a
  protocol and one bad week cannot bury a large one.
- **Maturity** is patience: a protocol that has run for years with no token
  earns up to 1.0, a brand-new one 0.55. Age is the time since DefiLlama first
  listed it.
- **Chain breadth** is distribution: a protocol on more chains reaches more
  users, worth a small premium, capped at +10%.
- **A missing seven-day figure** is not treated as zero growth for free: the
  value is discounted 5% for the missing evidence, and the dashboard says so.

## The dashboard

`dashboard/` is a static page (no framework, no network): a ranked board, a
protocol detail view with the model's own inputs and a 7-step farm plan, a
filtered view (search, category, chain, watchlist-only, pre-token/live tabs),
and a model sandbox — sliders for the base multiple, growth weight and maturity
floor that re-rank the board live with the same formula. The sandbox changes
only the page; `board.json` keeps the published radar-2 ranks.

Every farm plan is derived from the protocol's category, chains, TVL and age:
a first action with capital, a second and different action in the same
category, a weekly qualifying action, a hold period, a points-page check, and
a farm log with a two-step exit over two days. No name is special-cased.

## How to run

Node 22 or later, standard library only, no network, no external assets.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path to snapshot.json>
```

That writes `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/`
and `out/dossier.json`. Running it twice writes byte-identical `board.json` and
`dossier.json`.

Open `out/dashboard/index.html` to use the board. The screenshots in
`screenshots/` are real renders of this dashboard at 1280x720: the ranked
board, a protocol detail view, and a filtered view.

## What changed vs the starter

- The scoring model is radar-2 (the starter was radar-1): growth weight 0.6
  with an asymmetric -50/+100 clamp, maturity floor 0.55, a chain-breadth
  multiplier capped at +10%, and a 5% discount when the seven-day figure is
  unreported. The board grows from 200 rows to 226 (40 watchlist + 186 early).
- The farm plan is 7 steps instead of 6, adding a second, different action in
  the same category and a two-step unwind over two days.
- The dashboard gains a chain filter, a watchlist-only toggle, a model sandbox
  that re-ranks the board live, a one-line "why this rank" signal per protocol,
  and detail views that show the chain multiplier, the missing-data discount
  and the watchlist badge.
- `main.ts` names the model version in its output. This README is new.
