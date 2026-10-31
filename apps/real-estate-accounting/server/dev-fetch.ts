import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

export type FetchLikeResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

export type FetchInit = { method?: string; headers?: Record<string, string>; body?: string };

export function isLocalDevHost(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/**
 * TLS verification may only be relaxed for local hosts, or when a developer opts in.
 * Sandbox and production traffic carries credentials and bearer tokens.
 */
export function allowsInsecureTls(url: string, env: Record<string, string | undefined>): boolean {
  return env.PAPREL_DEV_INSECURE_TLS === "1" || env.PAPREL_DEV_INSECURE_TLS === "true" || isLocalDevHost(url);
}

function insecureNodeRequest(url: string, init: FetchInit): Promise<FetchLikeResponse> {
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

export async function devFetch(url: string, init: FetchInit, env: Record<string, string>): Promise<FetchLikeResponse> {
  if (allowsInsecureTls(url, env)) {
    return insecureNodeRequest(url, init);
  }

  const res = await fetch(url, init);
  return { ok: res.ok, status: res.status, text: () => res.text() };
}
