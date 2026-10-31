import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import { test } from "node:test";
import { clientAssertion, mintPartnerSession, PartnerSessionError } from "./partner-session.ts";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const config = {
  apiBaseUrl: "https://api.test",
  clientId: "client",
  keyId: "kid-1",
  privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  companyId: "co/1",
  externalUserId: "user-1",
};
const json = (status: number, body: unknown) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });

test("assertion is a signed EdDSA JWT with the documented claims", () => {
  const [header, payload, signature] = clientAssertion(config, "https://api.test/v1/partner/token", 1_000_000).split(".");
  assert.deepEqual(JSON.parse(Buffer.from(header, "base64url").toString()), { alg: "EdDSA", typ: "JWT", kid: "kid-1" });
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  assert.equal(claims.iss, "client");
  assert.equal(claims.sub, "client");
  assert.equal(claims.aud, "https://api.test/v1/partner/token");
  assert.equal(claims.exp - claims.iat, 120);
  assert.ok(verify(null, Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, "base64url")));
});

test("mints a session and returns only the session token", async () => {
  const calls: Array<{ url: string; headers?: Record<string, string>; body?: string }> = [];
  const tokens = await mintPartnerSession(config, async (url, init) => {
    calls.push({ url, headers: init.headers, body: init.body });
    return url.endsWith("/token")
      ? json(200, { data: { access_token: "partner-secret", expires_in: 900 } })
      : json(200, { data: [{ outcome: "minted", access_token: "session", expires_in: 600, permissions: ["p"] }] });
  }, 1000);
  assert.equal(calls[1].url, "https://api.test/v1/partner/companies/co%2F1/sessions");
  assert.equal(calls[1].headers?.Authorization, "Bearer partner-secret");
  assert.deepEqual(JSON.parse(calls[1].body!), { external_user_id: "user-1" });
  assert.deepEqual(tokens, { accessToken: "session", expiresAt: 601_000, permissions: ["p"], companyId: "co/1", expiresIn: 600 });
});

test("a failed outcome on HTTP 200 is an error", async () => {
  await assert.rejects(
    mintPartnerSession(config, async (url) => url.endsWith("/token")
      ? json(200, { data: { access_token: "x" } })
      : json(200, { data: [{ outcome: "failed", error_code: 404 }] })),
    PartnerSessionError,
  );
});

test("upstream failure keeps its status and hides the body", async () => {
  await assert.rejects(mintPartnerSession(config, async () => json(401, { secret: "detail" })), (err: PartnerSessionError) => {
    assert.equal(err.status, 401);
    assert.ok(!err.message.includes("detail"));
    return true;
  });
});
