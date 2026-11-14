import { URL } from "node:url";
import type { Plugin } from "vite";
import { devFetch, isLocalDevHost } from "./dev-fetch.js";
import { TokenCache, type BrowserTokenSet } from "./token-cache.js";

function formatFetchError(err: unknown, tokenUrl: string): string {
  const base = err instanceof Error ? err.message : String(err);
  const cause = err instanceof Error && err.cause != null ? ` — ${String(err.cause)}` : "";
  if (/fetch failed/i.test(base) && isLocalDevHost(tokenUrl)) {
    return `${base}${cause}. Local HTTPS (e.g. app.paprel.localhost) often needs PAPREL_DEV_INSECURE_TLS=1 or a trusted dev cert.`;
  }
  return `${base}${cause}`;
}

class NotConfiguredError extends Error {
  constructor(message: string, readonly required: string[]) {
    super(message);
  }
}

class TokenExchangeError extends Error {
  constructor(readonly status: number) {
    super("Token exchange failed");
  }
}

async function exchangeAppConnect(env: Record<string, string>, entityId: string, safeEntityId: string): Promise<BrowserTokenSet> {
  const prefix = entityId === "default" ? "APP_CONNECT_" : `APP_CONNECT_ENTITY_${safeEntityId}_`;
  const tokenUrl = (env[`${prefix}TOKEN_URL`] || env.APP_CONNECT_TOKEN_URL)?.trim();
  const clientId = env[`${prefix}CLIENT_ID`]?.trim();
  const clientSecret = env[`${prefix}CLIENT_SECRET`]?.trim();
  const partnerDomain = (env[`${prefix}PARTNER_DOMAIN`] || env.PARTNER_DOMAIN)?.trim();

  if (!tokenUrl || !clientId || !clientSecret || !partnerDomain) {
    throw new NotConfiguredError(
      entityId === "default"
        ? "Missing App Connect env. Copy .env.example to .env.local and set APP_CONNECT_TOKEN_URL, APP_CONNECT_CLIENT_ID, APP_CONNECT_CLIENT_SECRET, PARTNER_DOMAIN."
        : `Missing App Connect credentials for entity '${entityId}'. Set APP_CONNECT_ENTITY_${safeEntityId}_CLIENT_ID and APP_CONNECT_ENTITY_${safeEntityId}_CLIENT_SECRET.`,
      [
        ...(!tokenUrl ? ["APP_CONNECT_TOKEN_URL"] : []),
        ...(!clientId ? [`${prefix}CLIENT_ID`] : []),
        ...(!clientSecret ? [`${prefix}CLIENT_SECRET`] : []),
        ...(!partnerDomain ? ["PARTNER_DOMAIN"] : []),
      ],
    );
  }

  let tokenRes;
  try {
    tokenRes = await devFetch(
      tokenUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-partner-domain": partnerDomain,
        },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }),
      },
      env,
    );
  } catch (err) {
    throw new Error(formatFetchError(err, tokenUrl));
  }

  const raw = await tokenRes.text();
  if (!tokenRes.ok) {
    console.error(`Paprel token exchange failed with status ${tokenRes.status}:`, raw);
    throw new TokenExchangeError(tokenRes.status);
  }

  // The OAuth endpoint returns the RFC 6749 shape at the top level; older gateways wrap it in data.
  const parsed = JSON.parse(raw) as { data?: Record<string, unknown> } & Record<string, unknown>;
  const data = parsed.data ?? parsed;
  const accessToken = data.access_token as string | undefined;
  if (!accessToken) throw new Error("No access_token in token response");

  const expiresIn = Number(data.expires_in ?? 3600);
  return {
    accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
    permissions: data.permissions,
    companyId: data.company_id,
    expiresIn,
  };
}

/** Dev-only BFF — exchanges App Connect client_credentials; never expose secret to the browser. */
export function embedTokenBff(env: Record<string, string>): Plugin {
  const cache = new TokenCache();
  return {
    name: "embed-token-bff",
    configureServer(server) {
      server.middlewares.use("/api/embed-token", async (req, res) => {
        res.setHeader("Content-Type", "application/json");
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method Not Allowed" }));
          return;
        }

        const requestUrl = new URL(req.url ?? "/", "http://localhost");
        const entityId = requestUrl.searchParams.get("entity")?.trim() || "default";
        const safeEntityId = entityId.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
        // A host-initiated refresh means the current token is suspect, so it must not be reused.
        if (requestUrl.searchParams.has("refresh")) cache.invalidate(entityId);

        try {
          const tokens = await cache.get(entityId, () => exchangeAppConnect(env, entityId, safeEntityId));
          res.end(JSON.stringify(tokens));
        } catch (err) {
          if (err instanceof NotConfiguredError) {
            res.statusCode = 503;
            res.end(JSON.stringify({ code: "APP_CONNECT_NOT_CONFIGURED", entityId, required: err.required, error: err.message }));
          } else if (err instanceof TokenExchangeError) {
            res.statusCode = err.status;
            res.end(JSON.stringify({ error: err.message, code: "APP_CONNECT_TOKEN_EXCHANGE_FAILED" }));
          } else {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
          }
        }
      });
    },
  };
}
