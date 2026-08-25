import { configureAccounting, refreshEmbedSession, type EmbedTokenSet } from "@paprel/embed-accounting";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { entities, errorMessage, partnerDomain, type EntityConfig } from "../lib/config";

type Company = { id: string; name: string; currency?: string };
type SessionValue = {
  company: Company | null;
  entity: EntityConfig;
  entityOptions: EntityConfig[];
  error: string;
  expiresAt: number;
  ready: boolean;
  refresh(): Promise<void>;
  switchEntity(id: string): Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);
const entityOptions = entities();

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
  return {
    id: String(data.id ?? ""),
    name: String(data.company_name ?? "Paprel company"),
    currency: data.currency_id ? String(data.currency_id) : undefined,
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [entity, setEntity] = useState(entityOptions[0]);
  const [company, setCompany] = useState<Company | null>(null);
  const [expiresAt, setExpiresAt] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const started = useRef(false);

  const connect = useCallback(async (next: EntityConfig) => {
    setReady(false);
    setError("");
    setCompany(null);
    try {
      const initial = await requestTokens(next.id);
      if (next.companyId && initial.companyId && next.companyId !== initial.companyId) {
        throw new Error(`${next.label} is mapped to a different Paprel company.`);
      }
      configureAccounting({
        baseUrl: "",
        locale: "en",
        auth: {
          partnerDomain,
          getTokens: async () => {
            const tokens = await requestTokens(next.id);
            setExpiresAt(tokens.expiresAt);
            return tokens;
          },
          onTokensUpdated: (tokens) => setExpiresAt(tokens.expiresAt),
          onSessionExpired: () => setError("The Paprel session expired. Reconnect to continue."),
        },
      });
      setExpiresAt(initial.expiresAt);
      setCompany(await requestCompany(initial.accessToken));
      setEntity(next);
      setReady(true);
    } catch (cause) {
      setError(errorMessage(cause, "Unable to connect to Paprel"));
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void connect(entityOptions[0]);
  }, [connect]);

  const value = useMemo<SessionValue>(() => ({
    company,
    entity,
    entityOptions,
    error,
    expiresAt,
    ready,
    refresh: async () => { await refreshEmbedSession(); },
    switchEntity: async (id) => {
      const next = entityOptions.find((option) => option.id === id);
      if (next && next.id !== entity.id) await connect(next);
    },
  }), [company, connect, entity, error, expiresAt, ready]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
