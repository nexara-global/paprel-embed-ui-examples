export type BrowserTokenSet = {
  accessToken: string;
  expiresAt: number;
  permissions?: unknown;
  companyId?: unknown;
  expiresIn: number;
};

/**
 * The SDK renews at min(15m, max(60s, 5% of remaining lifetime)) before expiry. A cached token
 * must stop being served before that point: returning a token already inside the SDK's renewal
 * window makes it schedule another renewal immediately, in a tight loop.
 */
export function reuseMarginMs(expiresInSeconds: number): number {
  return Math.max(120_000, expiresInSeconds * 100);
}

/**
 * Token exchange is rate limited per client IP, and in production every user shares the server's
 * IP, so tokens are reused per entity. Production caches must also be keyed by partner user when
 * the token is bound to one. Concurrent misses share one exchange for the same reason.
 */
export class TokenCache {
  private entries = new Map<string, BrowserTokenSet>();
  private pending = new Map<string, Promise<BrowserTokenSet>>();

  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  async get(key: string, mint: () => Promise<BrowserTokenSet>): Promise<BrowserTokenSet> {
    const cached = this.entries.get(key);
    if (cached && cached.expiresAt - reuseMarginMs(cached.expiresIn) > this.now()) return cached;

    const inFlight = this.pending.get(key);
    if (inFlight) return inFlight;

    const request = mint()
      .then((tokens) => {
        this.entries.set(key, tokens);
        return tokens;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }

  /** Drops a token the caller has been told is no longer good, for example after a forced refresh. */
  invalidate(key: string): void {
    this.entries.delete(key);
  }
}
