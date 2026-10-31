import { configureAccounting, refreshEmbedSession, type EmbedTokenSet } from "@paprel/embed-accounting";
import { entities, errorMessage, partnerDomain, type EntityConfig } from "../lib/config";

export type Company = { id: string; name: string; currency?: string };
export type SessionState = {
  company: Company | null;
  entity: EntityConfig;
  entityOptions: EntityConfig[];
  error: string;
  expired: boolean;
  expiresAt: number;
  ready: boolean;
  refreshing: boolean;
  setup: { entityId: string; required: string[] } | null;
};

type Listener = (state: Readonly<SessionState>) => void;

async function requestTokens(entityId: string, force = false): Promise<EmbedTokenSet & { companyId?: string }> {
  const response = await fetch(`/api/embed-token?entity=${encodeURIComponent(entityId)}${force ? "&refresh=1" : ""}`, {
    credentials: "include",
  });
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    if (body.code === "APP_CONNECT_NOT_CONFIGURED") {
      throw new AppConnectSetupError(
        String(body.error ?? "App Connect credentials are not configured."),
        String(body.entityId ?? entityId),
        Array.isArray(body.required) ? body.required.map(String) : [],
      );
    }
    throw new Error(String(body.error ?? "Token exchange failed"));
  }
  return body as unknown as EmbedTokenSet & { companyId?: string };
}

class AppConnectSetupError extends Error {
  constructor(message: string, readonly entityId: string, readonly required: string[]) {
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
  private connection = 0;
  private forceNextToken = false;

  constructor() {
    const entityOptions = entities();
    this.state = { company: null, entity: entityOptions[0], entityOptions, error: "", expired: false, expiresAt: 0, ready: false, refreshing: false, setup: null };
  }

  snapshot(): Readonly<SessionState> { return this.state; }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  async start(): Promise<void> { await this.connect(this.state.entity); }

  async reconnect(): Promise<void> { await this.connect(this.state.entity); }

  async switchEntity(id: string): Promise<void> {
    const next = this.state.entityOptions.find((entity) => entity.id === id);
    if (next && next.id !== this.state.entity.id) await this.connect(next);
  }

  async refresh(): Promise<void> {
    this.patch({ refreshing: true });
    this.forceNextToken = true;
    // A failed renewal is already reported through onSessionExpired.
    try { await refreshEmbedSession(); } catch { /* shown as the expired state */ } finally { this.patch({ refreshing: false }); }
  }

  private async connect(entity: EntityConfig): Promise<void> {
    // Only the newest connect may publish state: a slow response for the previous entity must
    // not relabel the screen, or its token could be shown against the wrong company.
    const connection = ++this.connection;
    this.patch({ ready: false, error: "", expired: false, company: null, entity, expiresAt: 0, setup: null });
    try {
      const initial = await requestTokens(entity.id);
      if (connection !== this.connection) return;
      if (entity.companyId && initial.companyId && entity.companyId !== initial.companyId) {
        throw new Error(`${entity.label} is mapped to a different Paprel company.`);
      }
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
            return requestTokens(entity.id, force);
          },
          onTokensUpdated: (tokens) => {
            if (connection === this.connection) this.patch({ expiresAt: tokens.expiresAt, expired: false, error: "" });
          },
          onSessionExpired: () => {
            if (connection === this.connection) this.patch({ expired: true, error: "The Paprel session expired. Your work on this page is still here; reconnect to continue." });
          },
        },
      });
      const company = await requestCompany(initial.accessToken);
      if (connection !== this.connection) return;
      this.patch({ company, entity, expiresAt: initial.expiresAt, ready: true });
    } catch (cause) {
      if (connection !== this.connection) return;
      this.patch({
        error: errorMessage(cause, "Unable to connect to Paprel"),
        setup: cause instanceof AppConnectSetupError ? { entityId: cause.entityId, required: cause.required } : null,
      });
    }
  }

  private patch(update: Partial<SessionState>): void {
    this.state = { ...this.state, ...update };
    this.listeners.forEach((listener) => listener(this.state));
  }
}
