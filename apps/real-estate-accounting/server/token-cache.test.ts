import assert from "node:assert/strict";
import { test } from "node:test";
import { reuseMarginMs, TokenCache, type BrowserTokenSet } from "./token-cache.ts";

const token = (now: number, expiresIn: number, accessToken = "a"): BrowserTokenSet => ({ accessToken, expiresAt: now + expiresIn * 1000, expiresIn });

test("reuses a token until the margin, then mints again", async () => {
  let now = 0;
  let mints = 0;
  const cache = new TokenCache(() => now);
  const mint = async () => token(now, 3600, `t${++mints}`);
  assert.equal((await cache.get(mint)).accessToken, "t1");
  now = 3_000_000;
  assert.equal((await cache.get(mint)).accessToken, "t1");
  now = 3_600_000 - reuseMarginMs(3600);
  assert.equal((await cache.get(mint)).accessToken, "t2");
});

test("margin always exceeds the SDK renewal buffer", () => {
  for (const ttl of [300, 900, 3600, 14400, 86400]) {
    const sdkBuffer = Math.min(900_000, Math.max(60_000, ttl * 1000 * 0.05));
    assert.ok(reuseMarginMs(ttl) > sdkBuffer, `ttl ${ttl}`);
  }
});

test("shares concurrent misses", async () => {
  let mints = 0;
  const cache = new TokenCache(() => 0);
  const mint = async () => token(0, 3600, `t${++mints}`);
  const [a, b] = await Promise.all([cache.get(mint), cache.get(mint)]);
  assert.equal(a, b);
  assert.equal(mints, 1);
});

test("invalidate forces a new token and failures are not cached", async () => {
  let mints = 0;
  const cache = new TokenCache(() => 0);
  await assert.rejects(cache.get(async () => { throw new Error("down"); }));
  await cache.get(async () => token(0, 3600, `t${++mints}`));
  cache.invalidate();
  assert.equal((await cache.get(async () => token(0, 3600, `t${++mints}`))).accessToken, "t2");
});
