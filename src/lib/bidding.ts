/**
 * SINGLE SOURCE OF TRUTH for bid increments.
 *
 * Slabs (must match the `next_increment` SQL function used by `place_bid`):
 *   below 100  -> +10   (50, 60, 70, 80, 90, 100)
 *   below 200  -> +20   (100, 120, 140, 160, 180, 200)
 *   200 and up -> +50   (200, 250, 300, 350 ...)
 *
 * Every screen (owner dashboard, captain dashboard, live auction, bid button,
 * bid history) must import from here. Never re-implement this logic.
 */

export type IncrementSlab = { upto: number | null; increment: number };

export const BID_SLABS: IncrementSlab[] = [
  { upto: 100, increment: 10 },
  { upto: 200, increment: 20 },
  { upto: null, increment: 50 },
];

export const DEFAULT_BASE_PRICE = 50;

/** Increment that applies to a given current bid. */
export function bidIncrementFor(current: number, slabs: IncrementSlab[] = BID_SLABS): number {
  let inc = slabs[slabs.length - 1]?.increment ?? 50;
  for (const slab of slabs) {
    inc = Number(slab.increment) || inc;
    if (slab.upto === null || slab.upto === undefined || current < Number(slab.upto)) return inc;
  }
  return inc;
}

/**
 * The exact next valid bid.
 * With no bid yet the next bid is the player's base price.
 */
export function nextBidAmount(
  currentBid: number | null | undefined,
  basePrice: number = DEFAULT_BASE_PRICE,
  slabs: IncrementSlab[] = BID_SLABS,
): number {
  if (currentBid === null || currentBid === undefined) return Number(basePrice) || DEFAULT_BASE_PRICE;
  const c = Number(currentBid);
  return c + bidIncrementFor(c, slabs);
}

/** Parses tournament.bid_increment_rules into slabs, falling back to BID_SLABS. */
export function slabsFromRules(rules: unknown): IncrementSlab[] {
  if (!Array.isArray(rules) || rules.length === 0) return BID_SLABS;
  const parsed = rules
    .map((r) => {
      const o = r as { upto?: number | null; increment?: number };
      const increment = Number(o?.increment);
      if (!Number.isFinite(increment) || increment <= 0) return null;
      return { upto: o?.upto == null ? null : Number(o.upto), increment };
    })
    .filter((s): s is IncrementSlab => !!s);
  return parsed.length ? parsed : BID_SLABS;
}
