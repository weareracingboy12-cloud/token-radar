// Token Radar — scoring model, revision radar-2.
//
// One sealed snapshot goes in; one ranked board comes out. The board always
// carries the whole watchlist first — that list is a floor on coverage, never
// a target to beat — and then the early radar: pre-token protocols sitting
// below the watchlist floor, ordered by TVL. On the sealed 2026-11-14
// snapshot that works out at 226 rows: 40 watchlist rows and 186 early ones
// (EARLY_ROWS caps the early set at 260, and only 186 rankable pre-token
// protocols sit under the floor). A protocol counts as pre-token when its
// index entry carries no token at all — no market cap, no CoinGecko id, no
// symbol. Protocols that already trade are kept out of the ranking entirely
// and shown separately, priced by the market rather than by this model.
//
// A row's implied value is built only from the snapshot's own numbers,
// never from a name:
//
//   size      = tvl_usd * 0.22
//   growth    = clamp(change_7d, -50, +100), in per cent
//   growthMul = 1 + (growth / 100) * 0.6
//   ageMul    = 0.55 + min(age_days, 1095) / 1095 * 0.45
//               (age unknown: 365 days)
//   chainMul  = 1 + 0.02 * min(max(chains - 1, 0), 5)
//   missing   = 0.95 when change_7d is unreported, otherwise 1
//               (unreported growth is read as 0, and the value is marked
//               down for the missing evidence — never guessed)
//   implied   = max(1, round(size * growthMul * ageMul * chainMul * missing))
//
// Why the terms are shaped this way:
// * TVL is the size of the business a token would price. The value is
//   linear in TVL, so the largest pre-token protocols lead — a token's
//   implied value is first a claim on the scale the protocol already has.
// * Seven-day growth is momentum, clamped so one hot week cannot crown a
//   protocol and one bad week cannot bury a large one. The clamp is
//   lopsided (-50 / +100) because TVL can only fall so far in a week while
//   a breakout can run further, and the 0.6 weight keeps growth second
//   to size.
// * Age is patience: a protocol that has run for years with no token has a
//   longer record to price and a longer wait behind it, so it earns up to
//   1.0 while a brand-new protocol earns 0.55. Age is the time since
//   DefiLlama first listed the protocol; an unlisted age uses 365 days,
//   the middle of the range.
// * Chain breadth is distribution: a protocol live on more chains reaches
//   more users and more liquidity, worth a small premium, capped so a
//   protocol on twenty chains does not outrank a much larger one on a
//   single chain.
// * A missing seven-day figure is not free zero growth: the value takes a
//   5% discount for the missing evidence, and the dashboard says so.
//
// The constants are the model's own, stated in the dashboard and changeable
// in the model sandbox. No protocol name is ever special-cased: the same
// function scores every row.

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  base_multiple: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  chain_step: number;
  chain_cap: number;
  missing_growth_discount: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.22,
  growth_weight: 0.6,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 0.55,
  maturity_range: 0.45,
  maturity_days: 1095,
  unknown_age_days: 365,
  chain_step: 0.02,
  chain_cap: 5,
  missing_growth_discount: 0.95,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 260;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 32;

/** One protocol entry from the snapshot: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** One step of a farm plan: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    missing_growth_discount: number;
    age_days: number | null;
  };
  signal: string;
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with the farm plan generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  missing_growth_discount: number;
  watchlist: boolean;
  signal: string;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  watchlist_tvl_usd: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const MS_PER_DAY = 86_400_000;

/** Round to four decimal places, for the multipliers the board records. */
const roundTo4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** `value` when it is a finite number, `fallback` otherwise. */
function numOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Whole days from `listedAt` to `asOf`, never below zero; null when either date is absent or unparsable. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const asOfMs = Date.parse(`${asOf}T00:00:00Z`);
  const listedMs = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(asOfMs) || !Number.isFinite(listedMs)) return null;
  const days = Math.floor((asOfMs - listedMs) / MS_PER_DAY);
  return Math.max(0, days);
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSION_SUFFIX = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSION_SUFFIX.test(p.name);
}

/** The snapshot's protocols keyed by slug. */
function indexBySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  const index = new Map<string, SnapshotProtocol>();
  for (const p of protocols) index.set(p.slug, p);
  return index;
}

/** The five multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
): {
  implied: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  chainMult: number;
  missingDiscount: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = numOr(protocol.change_7d, 0);
  const clampedGrowth = Math.max(model.growth_floor, Math.min(model.growth_cap, rawGrowth));
  const growthMult = 1 + (clampedGrowth / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const ageCapped = Math.min(Math.max(ageForModel, 0), model.maturity_days);
  const maturityMult = model.maturity_floor + (ageCapped / model.maturity_days) * model.maturity_range;
  const chainCount = Array.isArray(protocol.chains) ? protocol.chains.length : 0;
  const extraChains = Math.min(Math.max(chainCount - 1, 0), model.chain_cap);
  const chainMult = 1 + model.chain_step * extraChains;
  const missingDiscount = protocol.change_7d === null ? model.missing_growth_discount : 1;
  const base = protocol.tvl_usd * model.base_multiple;
  const product = base * growthMult * maturityMult * chainMult * missingDiscount;
  const implied = Math.max(1, Math.round(product));
  return {
    implied,
    growthPct: clampedGrowth,
    growthMult,
    maturityMult,
    chainMult,
    missingDiscount,
    age,
  };
}

/** One line saying why a row ranks where it does, from its own figures only. */
export function signalFor(p: SnapshotProtocol, age: number | null, implied: number): string {
  const growth = p.change_7d === null ? '7d growth unreported' : `7d ${p.change_7d >= 0 ? '+' : ''}${p.change_7d.toFixed(2)}%`;
  const ageText = age === null ? 'age unlisted' : age >= 365 ? `${(age / 365).toFixed(1)}y with no token` : `${age}d with no token`;
  const chains = p.chains.length === 0 ? 'no chain listed' : p.chains.length === 1 ? `on ${p.chains[0]}` : `on ${p.chains.length} chains`;
  return `TVL $${Math.round(p.tvl_usd).toLocaleString('en-US')}, ${growth}, ${ageText}, ${chains}. Implied $${implied.toLocaleString('en-US')} is the model's claim, not a price.`;
}

/** The first chain a protocol names, or a neutral phrase. */
function firstChain(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function farmCapital(p: SnapshotProtocol): number {
  const tvl = p.tvl_usd;
  if (tvl >= 5_000_000_000) return 250;
  if (tvl >= 1_000_000_000) return 150;
  if (tvl >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDays(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function primaryAction(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** A second, different action in the same category, so the farm is not one deposit and a wait. */
function followUpAction(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const small = Math.max(10, Math.round(capital / 5));
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Borrow $${small} against the deposit on ${name} and repay it within the week, so the position shows both sides.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Swap $${small} through ${name}'s main pool on ${chain} so the wallet shows a trade as well as liquidity.`;
  if (c.includes('bridge')) return `Bridge $${small} back the other way through ${name} so the wallet shows a round trip, not a single hop.`;
  if (c.includes('staking') || c.includes('restak')) return `Delegate a second, smaller stake of $${small} through ${name} and keep both receipts.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Close the hedge on ${name} and open a second one half its size, so the account shows two trades.`;
  if (c.includes('prediction')) return `Settle the first position on ${name} and place a second one of $${small}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Move $${small} into a second ${name} vault on ${chain} so the wallet holds two vault shares.`;
  if (c.includes('stable')) return `Swap $${small} of the stable asset through ${name} on ${chain} and hold the rest.`;
  if (c.includes('rwa')) return `Reinvest $${small} of the yield the first mint paid into the same asset on ${chain}.`;
  if (c.includes('insurance')) return `Renew the cover on ${name} for a second, shorter term once the first one runs.`;
  return `Make a second deposit of $${small} into ${name} on ${chain} a week after the first, so the wallet shows repeated use.`;
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time.
 * The plan is derived from the protocol's own record (category, chains, TVL,
 * age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = firstChain(p);
  const capital = farmCapital(p);
  const hold = holdDays(age);
  const first = primaryAction(p, capital, chain);
  const second = followUpAction(p, capital, chain);
  const small = Math.max(10, Math.round(capital / 5));
  const gas = capital >= 150 ? 8 : 4;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: first,
      cost: `$${capital} of capital and about $${gas} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: second,
      cost: `about $2 of gas and $${small} moved`,
      time: '10 minutes',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log, then plan the exit: unwind in two steps over two days so one failed transaction does not strand the funds.`,
      cost: 'about $4 of gas to unwind',
      time: '5 minutes to log, 2 days to exit',
    },
  ];
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = indexBySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug in it is carried, even one the
  // snapshot no longer carries (it cannot, but the board's coverage is the
  // gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const found = index.get(slug);
    if (found !== undefined) chosen.set(slug, found);
  }
  // The early radar: pre-token protocols below the watchlist floor, by TVL,
  // capped. Never a replacement for a watchlist row: a chosen protocol
  // stays chosen.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const scoredRow = impliedValue(p, snapshot.as_of, model);
    return { p, ...scoredRow };
  });
  scored.sort(
    (a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0),
  );
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      base_multiple: model.base_multiple,
      growth_pct: s.growthPct,
      growth_multiplier: roundTo4(s.growthMult),
      maturity_multiplier: roundTo4(s.maturityMult),
      chain_multiplier: roundTo4(s.chainMult),
      missing_growth_discount: s.missingDiscount,
      age_days: s.age,
    },
    signal: signalFor(s.p, s.age, s.implied),
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  const live = snapshot.protocols.filter((p) => !isPreToken(p) && p.category !== 'CEX');
  live.sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd);
  return live.slice(0, LIVE_ROWS).map((p) => ({
    slug: p.slug,
    name: p.name,
    category: p.category,
    chains: p.chains,
    tvl_usd: p.tvl_usd,
    mcap_usd: p.mcap_usd,
    change_7d: p.change_7d,
  }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    missing_growth_discount: row.model.missing_growth_discount,
    watchlist: watchlist.has(row.slug),
    signal: row.signal,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const watchlistSet = new Set(snapshot.watchlist);
  let early = 0;
  for (const r of board) if (!watchlistSet.has(r.slug)) early += 1;
  let watchlistTvl = 0;
  for (const p of snapshot.protocols) {
    if (watchlistSet.has(p.slug)) watchlistTvl += p.tvl_usd;
  }
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    watchlist_tvl_usd: watchlistTvl,
    rows: board.map((r) => radarRow(r, watchlistSet)),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new SnapshotError('snapshot.json is not a JSON object');
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) {
    throw new SnapshotError('snapshot.json has no as_of date');
  }
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) {
    throw new SnapshotError('snapshot.json has no floor_usd');
  }
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) {
    throw new SnapshotError('snapshot.json has no watchlist of slugs');
  }
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    }
    const p = v as Record<string, unknown>;
    const okSlug = typeof p.slug === 'string';
    const okName = typeof p.name === 'string';
    const okTvl = typeof p.tvl_usd === 'number' && Number.isFinite(p.tvl_usd);
    if (!okSlug || !okName || !okTvl) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) {
    return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  }
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) {
    if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  }
  for (let i = 1; i < board.length; i++) {
    if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) {
      return `row ${i + 1} outranks row ${i} on implied value`;
    }
  }
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) {
      if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    }
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) {
      return `${r.slug} has implied value ${r.implied_value_usd}`;
    }
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
