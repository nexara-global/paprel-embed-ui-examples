import { createPrivateKey, randomUUID, sign } from "node:crypto";
import type { BrowserTokenSet } from "./token-cache.js";
import type { FetchInit, FetchLikeResponse } from "./dev-fetch.js";

export type PartnerSessionConfig = {
  apiBaseUrl: string;
  clientId: string;
  keyId: string;
  privateKeyPem: string;
  companyId: string;
  externalUserId: string;
};

type Fetcher = (url: string, init: FetchInit) => Promise<FetchLikeResponse>;

const base64Url = (value: string | object) =>
  Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");

/** Every assertion needs a new jti: Paprel accepts each one once, so a replay is refused. */
export function clientAssertion(config: Pick<PartnerSessionConfig, "clientId" | "keyId" | "privateKeyPem">, tokenUrl: string, nowMs = Date.now()): string {
  const now = Math.floor(nowMs / 1000);
  const input = `${base64Url({ alg: "EdDSA", typ: "JWT", kid: config.keyId })}.${base64Url({
    iss: config.clientId,
    sub: config.clientId,
    aud: tokenUrl,
    iat: now,
    exp: now + 120,
    jti: randomUUID(),
  })}`;
  return `${input}.${sign(null, Buffer.from(input), createPrivateKey(config.privateKeyPem)).toString("base64url")}`;
}

export class PartnerSessionError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function readJson(response: FetchLikeResponse, step: string): Promise<Record<string, unknown>> {
  const raw = await response.text();
  if (!response.ok) {
    // Upstream bodies stay in the server log; the browser only learns which step failed.
    console.error(`Paprel ${step} failed with status ${response.status}:`, raw);
    throw new PartnerSessionError(`Paprel ${step} failed`, response.status);
  }
  return JSON.parse(raw) as Record<string, unknown>;
}

/** Partner token (900s) -> session for one user in one company. The partner token never leaves the server. */
export async function mintPartnerSession(config: PartnerSessionConfig, fetcher: Fetcher, nowMs = Date.now()): Promise<BrowserTokenSet> {
  const tokenUrl = `${config.apiBaseUrl}/v1/partner/token`;
  const tokenBody = await readJson(
    await fetcher(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: config.clientId,
        client_assertion: clientAssertion(config, tokenUrl, nowMs),
      }),
    }),
    "partner token request",
  );
  const partnerToken = (tokenBody.data as { access_token?: string } | undefined)?.access_token;
  if (!partnerToken) throw new PartnerSessionError("No access_token in partner token response", 502);

  const sessionBody = await readJson(
    await fetcher(`${config.apiBaseUrl}/v1/partner/companies/${encodeURIComponent(config.companyId)}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${partnerToken}` },
      body: JSON.stringify({ external_user_id: config.externalUserId }),
    }),
    "partner session mint",
  );
  // The endpoint reports per user, so an HTTP 200 can still carry a failed outcome.
  const result = (sessionBody.data as Array<Record<string, unknown>> | undefined)?.[0];
  if (result?.outcome !== "minted" || typeof result.access_token !== "string") {
    console.error("Paprel partner session was not minted:", result?.error_code);
    throw new PartnerSessionError("Paprel did not mint a session for this user", 502);
  }

  const expiresIn = Number(result.expires_in ?? 300);
  return {
    accessToken: result.access_token,
    expiresAt: nowMs + expiresIn * 1000,
    permissions: result.permissions,
    companyId: config.companyId,
    expiresIn,
  };
}
