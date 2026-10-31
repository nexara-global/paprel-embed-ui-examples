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
 * IP, so one token is reused. Concurrent misses share one exchange for the same reason.
 */
export class TokenCache {
  private token: BrowserTokenSet | null = null;
  private pending: Promise<BrowserTokenSet> | null = null;
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  async get(mint: () => Promise<BrowserTokenSet>): Promise<BrowserTokenSet> {
    if (this.token && this.token.expiresAt - reuseMarginMs(this.token.expiresIn) > this.now()) return this.token;
    if (this.pending) return this.pending;

    this.pending = mint()
      .then((tokens) => {
        this.token = tokens;
        return tokens;
      })
      .finally(() => {
        this.pending = null;
      });
    return this.pending;
  }

  /** Drops a token the caller has been told is no longer good, for example after a forced refresh. */
  invalidate(): void {
    this.token = null;
  }
}
