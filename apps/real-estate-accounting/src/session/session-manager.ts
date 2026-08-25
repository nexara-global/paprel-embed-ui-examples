import { configureAccounting, refreshEmbedSession, type EmbedTokenSet } from "@paprel/embed-accounting";
import { entities, errorMessage, partnerDomain, type EntityConfig } from "../lib/config";

export type Company = { id: string; name: string; currency?: string };
export type SessionState = {
  company: Company | null;
  entity: EntityConfig;
  entityOptions: EntityConfig[];
  error: string;
  expiresAt: number;
  ready: boolean;
  refreshing: boolean;
};

type Listener = (state: Readonly<SessionState>) => void;

async function requestTokens(entityId: string): Promise<EmbedTokenSet & { companyId?: string }> {
  const response = await fetch(`/api/embed-token?entity=${encodeURIComponent(entityId)}`, { method: "POST" });
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(String(body.error ?? "Token exchange failed"));
  return body as unknown as EmbedTokenSet & { companyId?: string };
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

  constructor() {
    const entityOptions = entities();
    this.state = { company: null, entity: entityOptions[0], entityOptions, error: "", expiresAt: 0, ready: false, refreshing: false };
  }

  snapshot(): Readonly<SessionState> { return this.state; }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  async start(): Promise<void> { await this.connect(this.state.entity); }

  async switchEntity(id: string): Promise<void> {
    const next = this.state.entityOptions.find((entity) => entity.id === id);
    if (next && next.id !== this.state.entity.id) await this.connect(next);
  }

  async refresh(): Promise<void> {
    this.patch({ refreshing: true });
    try { await refreshEmbedSession(); } finally { this.patch({ refreshing: false }); }
  }

  private async connect(entity: EntityConfig): Promise<void> {
    this.patch({ ready: false, error: "", company: null });
    try {
      const initial = await requestTokens(entity.id);
      if (entity.companyId && initial.companyId && entity.companyId !== initial.companyId) {
        throw new Error(`${entity.label} is mapped to a different Paprel company.`);
      }
      configureAccounting({
        baseUrl: "", locale: "en",
        auth: {
          partnerDomain,
          getTokens: async () => {
            const tokens = await requestTokens(entity.id);
            this.patch({ expiresAt: tokens.expiresAt });
            return tokens;
          },
          onTokensUpdated: (tokens) => this.patch({ expiresAt: tokens.expiresAt }),
          onSessionExpired: () => this.patch({ error: "The Paprel session expired. Reconnect to continue." }),
        },
      });
      const company = await requestCompany(initial.accessToken);
      this.patch({ company, entity, expiresAt: initial.expiresAt, ready: true });
    } catch (cause) {
      this.patch({ error: errorMessage(cause, "Unable to connect to Paprel") });
    }
  }

  private patch(update: Partial<SessionState>): void {
    this.state = { ...this.state, ...update };
    this.listeners.forEach((listener) => listener(this.state));
  }
}
