import { configureAccounting, refreshEmbedSession, type EmbedTokenSet } from "@paprel/embed-accounting";
import { errorMessage, partnerDomain } from "../lib/config";

export type Company = { id: string; name: string; currency?: string };
export type SessionState = {
  company: Company | null;
  error: string;
  expired: boolean;
  expiresAt: number;
  ready: boolean;
  refreshing: boolean;
  setup: { required: string[] } | null;
};

type Listener = (state: Readonly<SessionState>) => void;

async function requestTokens(force = false): Promise<EmbedTokenSet> {
  const response = await fetch(`/api/embed-token${force ? "?refresh=1" : ""}`, {
    credentials: "include",
  });
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    if (body.code === "APP_CONNECT_NOT_CONFIGURED") {
      throw new AppConnectSetupError(
        String(body.error ?? "App Connect credentials are not configured."),
        Array.isArray(body.required) ? body.required.map(String) : [],
      );
    }
    throw new Error(String(body.error ?? "Token exchange failed"));
  }
  return body as unknown as EmbedTokenSet;
}

class AppConnectSetupError extends Error {
  constructor(message: string, readonly required: string[]) {
    super(message);
  }
}

async function requestCompany(accessToken: string): Promise<Company | null> {
  const response = await fetch("/v1/company", { headers: { Authorization: `Bearer ${accessToken}`, "x-partner-domain": partnerDomain } });
  if (!response.ok) return null;
  const body = await response.json() as { data?: Record<string, unknown> } & Record<string, unknown>;
  const data = body.data ?? body;
  return { id: String(data.id ?? ""), name: String(data.company_name ?? "Paprel company"), currency: data.currency_id ? String(data.currency_id) : undefined };
}

export class SessionManager {
  private listeners = new Set<Listener>();
  private state: SessionState;
  private forceNextToken = false;

  constructor() {
    this.state = { company: null, error: "", expired: false, expiresAt: 0, ready: false, refreshing: false, setup: null };
  }

  snapshot(): Readonly<SessionState> { return this.state; }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  async start(): Promise<void> { await this.connect(); }

  async reconnect(): Promise<void> { await this.connect(); }

  async refresh(): Promise<void> {
    this.patch({ refreshing: true });
    this.forceNextToken = true;
    // A failed renewal is already reported through onSessionExpired.
    try { await refreshEmbedSession(); } catch { /* shown as the expired state */ } finally { this.patch({ refreshing: false }); }
  }

  private async connect(): Promise<void> {
    this.patch({ ready: false, error: "", expired: false, company: null, expiresAt: 0, setup: null });
    try {
      const initial = await requestTokens();
      // Hand the SDK the token already fetched; exchanging again would spend rate limit for nothing.
      let unused: EmbedTokenSet | null = initial;
      configureAccounting({
        baseUrl: "", locale: "en",
        auth: {
          partnerDomain,
          getTokens: async () => {
            const force = this.forceNextToken;
            this.forceNextToken = false;
            if (unused && !force) {
              const tokens = unused;
              unused = null;
              return tokens;
            }
            unused = null;
            return requestTokens(force);
          },
          onTokensUpdated: (tokens) => this.patch({ expiresAt: tokens.expiresAt, expired: false, error: "" }),
          onSessionExpired: () => {
            this.patch({ expired: true, error: "The Paprel session expired. Your work on this page is still here; reconnect to continue." });
          },
        },
      });
      const company = await requestCompany(initial.accessToken);
      this.patch({ company, expiresAt: initial.expiresAt, ready: true });
    } catch (cause) {
      this.patch({
        error: errorMessage(cause, "Unable to connect to Paprel"),
        setup: cause instanceof AppConnectSetupError ? { required: cause.required } : null,
      });
    }
  }

  private patch(update: Partial<SessionState>): void {
    this.state = { ...this.state, ...update };
    this.listeners.forEach((listener) => listener(this.state));
  }
}
