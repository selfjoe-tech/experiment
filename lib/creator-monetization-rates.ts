/**
 * Rates are USD per 1,000 qualifying visits to an individual /watch/:id page.
 * The matching amounts are enforced in Supabase credit_watch_monetization().
 * Change both this module and that database function together.
 */
export const CREATOR_RATE_PER_1000 = {
  unverified: 0.20,
  verified: 0.30,
} as const;

export function creatorRatePer1000(verified: boolean): number {
  return verified ? CREATOR_RATE_PER_1000.verified : CREATOR_RATE_PER_1000.unverified;
}
