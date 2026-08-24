import type { EmbedTokenSet } from "@paprel/accounting";

type EmbedTokenResponse = EmbedTokenSet & { error?: unknown };

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

export async function requestEmbedTokens(): Promise<EmbedTokenSet> {
  const response = await fetch("/api/embed-token", { credentials: "include" });
  const body = (await response.json().catch(() => ({}))) as Partial<EmbedTokenResponse>;

  if (!response.ok || !body.accessToken || !body.expiresAt) {
    const message = typeof body.error === "string" ? body.error : "Token exchange failed";
    throw new Error(message);
  }

  return body as EmbedTokenSet;
}

export function errorMessage(error: unknown, fallback = "Unable to connect"): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
