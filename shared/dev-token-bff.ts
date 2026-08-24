import http from "node:http";
import https from "node:https";
import { URL } from "node:url";
import type { Plugin } from "vite";

type FetchLikeResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

function isLocalDevHost(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function insecureNodeRequest(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<FetchLikeResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      {
        method: init.method ?? "GET",
        headers: init.headers,
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          const status = res.statusCode ?? 500;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            text: async () => body,
          });
        });
      },
    );
    req.on("error", reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}

async function devFetch(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string },
  env: Record<string, string>,
): Promise<FetchLikeResponse> {
  const insecureTls =
    env.PAPREL_DEV_INSECURE_TLS === "1" ||
    env.PAPREL_DEV_INSECURE_TLS === "true" ||
    isLocalDevHost(url);

  if (insecureTls) {
    return insecureNodeRequest(url, init);
  }

  const res = await fetch(url, init);
  return { ok: res.ok, status: res.status, text: () => res.text() };
}

function formatFetchError(err: unknown, tokenUrl: string): string {
  const base = err instanceof Error ? err.message : String(err);
  const cause = err instanceof Error && err.cause != null ? ` — ${String(err.cause)}` : "";
  if (/fetch failed/i.test(base) && isLocalDevHost(tokenUrl)) {
    return `${base}${cause}. Local HTTPS (e.g. app.paprel.localhost) often needs PAPREL_DEV_INSECURE_TLS=1 or a trusted dev cert.`;
  }
  return `${base}${cause}`;
}

/** Dev-only BFF — exchanges App Connect client_credentials; never expose secret to the browser. */
export function embedTokenBff(env: Record<string, string>): Plugin {
  return {
    name: "embed-token-bff",
    configureServer(server) {
      server.middlewares.use("/api/embed-token", async (req, res) => {
        if (req.method !== "GET" && req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }

        const tokenUrl = env.APP_CONNECT_TOKEN_URL?.trim();
        const clientId = env.APP_CONNECT_CLIENT_ID?.trim();
        const clientSecret = env.APP_CONNECT_CLIENT_SECRET?.trim();
        const partnerDomain = env.PARTNER_DOMAIN?.trim();

        if (!tokenUrl || !clientId || !clientSecret || !partnerDomain) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error:
                "Missing App Connect env. Copy .env.example to .env.local and set APP_CONNECT_TOKEN_URL, APP_CONNECT_CLIENT_ID, APP_CONNECT_CLIENT_SECRET, PARTNER_DOMAIN.",
            }),
          );
          return;
        }

        try {
          const tokenRes = await devFetch(
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

          const raw = await tokenRes.text();
          if (!tokenRes.ok) {
            res.statusCode = tokenRes.status;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Token exchange failed", status: tokenRes.status, body: raw }));
            return;
          }

          const parsed = JSON.parse(raw) as { data?: Record<string, unknown> } & Record<string, unknown>;
          const data = parsed.data ?? parsed;
          const accessToken = data.access_token as string | undefined;
          const expiresIn = Number(data.expires_in ?? 7200);

          if (!accessToken) {
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "No access_token in token response" }));
            return;
          }

          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              accessToken,
              expiresAt: Date.now() + expiresIn * 1000,
              permissions: data.permissions,
              companyId: data.company_id,
              expiresIn,
            }),
          );
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: formatFetchError(err, tokenUrl) }));
        }
      });
    },
  };
}
