import {
  configureAccounting,
  refreshEmbedSession,
  type EmbedTokenSet,
} from "@paprel/embed-accounting";
import type { PaprelResourceOpenDetail, PaprelViewChangeDetail, PaprelViewState } from "@paprel/embed-core";
import "@paprel/embed-reports";
import { errorMessage, escapeAttribute, escapeHtml, requestEmbedTokens } from "../../shared/browser-utils";
import "./styles.css";

type View = "accounts" | "account-detail" | "account-form" | "journals" | "journal-detail" | "journal-form" | "reports" | "banking" | "banking-detail" | "transactions" | "transaction-locks";
type JournalMode = "create" | "edit" | "copy" | "reverse";
type ReportView = "trial-balance" | "balance-sheet" | "income-statement" | "cash-flow" | "general-ledger";

const app = document.querySelector<HTMLDivElement>("#app")!;
const partnerDomain = import.meta.env.VITE_PARTNER_DOMAIN || window.location.hostname;
const hostTheme = { primary: "#744c2f", accent: "#f5eee5", radius: "6px" } as const;
const entities = parseEntities(import.meta.env.VITE_PAPREL_ENTITIES);
let activeEntityId = entities[0].id;

let activeView: View = "accounts";
let selectedAccountId = "";
let selectedJournalId = "";
let selectedBankAccountId = "";
let journalMode: JournalMode = "create";
let activeReport: ReportView = "trial-balance";
let expiresAt = 0;
let connectedCompany: { id: string; name: string; currency?: string } | null = null;

function routeViewState(component: string): PaprelViewState {
  const prefix = component === "paprel-journal-list" ? "journals" : component === "paprel-transaction-inbox" ? "transactions" : "";
  if (!prefix) return {};
  const params = new URL(window.location.href).searchParams;
  const page = Number(params.get(`${prefix}.page`) ?? 1);
  const pageSize = Number(params.get(`${prefix}.pageSize`) ?? 25);
  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 25,
    search: params.get(`${prefix}.search`) ?? "",
    tab: params.get(`${prefix}.tab`) ?? undefined,
  };
}

function collectionAttributes(component: "paprel-journal-list" | "paprel-transaction-inbox"): string {
  const state = routeViewState(component);
  const inbox = component === "paprel-transaction-inbox" && state.tab ? ` inbox="${escapeAttribute(String(state.tab))}"` : "";
  const search = state.search ? ` search="${escapeAttribute(String(state.search))}"` : "";
  return `page="${Number(state.page)}" page-size="${Number(state.pageSize)}"${inbox}${search}`;
}

function syncViewState(detail: PaprelViewChangeDetail): void {
  const prefix = detail.source.component === "paprel-journal-list" ? "journals" : detail.source.component === "paprel-transaction-inbox" ? "transactions" : "";
  if (!prefix) return;
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(detail.state)) {
    const parameter = `${prefix}.${key}`;
    if (value == null || value === "" || value === false) url.searchParams.delete(parameter);
    else url.searchParams.set(parameter, Array.isArray(value) ? value.join(",") : String(value));
  }
  window.history.replaceState(window.history.state, "", url);
}

async function getTokens(): Promise<EmbedTokenSet> {
  const tokens = await requestEmbedTokens(activeEntityId) as EmbedTokenSet & { companyId?: string };
  const expectedCompanyId = entities.find((entity) => entity.id === activeEntityId)?.companyId;
  if (expectedCompanyId && tokens.companyId && tokens.companyId !== expectedCompanyId) {
    throw new Error(`The ${activeEntityId} App Connect client is mapped to a different Paprel company.`);
  }
  expiresAt = tokens.expiresAt;
  return tokens;
}

function parseEntities(value: string | undefined): Array<{ id: string; label: string; companyId?: string }> {
  const parsed = String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const separator = item.indexOf(":");
      if (separator < 1) return { id: item, label: item };
      const [id, label, companyId] = item.split(":").map((part) => part.trim());
      return { id, label, companyId: companyId || undefined };
    })
    .filter((entity) => entity.id && entity.label);
  return parsed.length ? parsed : [{ id: "default", label: "HarborStone" }];
}

async function loadConnectedCompany(accessToken: string): Promise<void> {
  try {
    const response = await fetch("/v1/company", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-partner-domain": partnerDomain,
      },
    });
    if (!response.ok) return;
    const body = await response.json() as { data?: Record<string, unknown> } & Record<string, unknown>;
    const data = body.data ?? body;
    connectedCompany = {
      id: String(data.id ?? ""),
      name: String(data.company_name ?? "Paprel company"),
      currency: data.currency_id ? String(data.currency_id) : undefined,
    };
  } catch {
    // Accounting remains usable if optional company presentation data is unavailable.
  }
}

function viewMarkup(view: View): string {
  switch (view) {
    case "accounts":
      return `<div class="view-actions"><span>Property income, deposits, liabilities, and operating costs.</span><button data-account-new>New portfolio account</button></div><paprel-chart-of-accounts id="accounts-widget"></paprel-chart-of-accounts>`;
    case "account-detail":
      return `<div class="view-actions"><button data-back="accounts">← Accounts</button></div><paprel-account-detail account-id="${escapeAttribute(selectedAccountId)}"></paprel-account-detail>`;
    case "account-form":
      return `<div class="view-actions"><button data-back="${selectedAccountId ? "account-detail" : "accounts"}">← Back</button></div><paprel-account-form account-id="${escapeAttribute(selectedAccountId)}" currency="USD"></paprel-account-form>`;
    case "journals":
      return `<div class="view-actions"><span>Review rent, fees, repairs, deposits, and adjustments.</span><button data-journal-new>New property journal</button></div><paprel-journal-list ${collectionAttributes("paprel-journal-list")}></paprel-journal-list>`;
    case "journal-detail":
      return `<div class="view-actions"><button data-back="journals">← Journals</button></div><paprel-journal-detail journal-id="${escapeAttribute(selectedJournalId)}"></paprel-journal-detail>`;
    case "journal-form":
      return `<div class="view-actions"><button data-back="${selectedJournalId ? "journal-detail" : "journals"}">← Back</button></div><paprel-journal-editor journal-id="${escapeAttribute(selectedJournalId)}" mode="${journalMode}" currency="USD"></paprel-journal-editor>`;
    case "reports":
      return `<div class="report-tabs" role="tablist" aria-label="Financial reports">
        ${([['trial-balance','Trial balance'],['balance-sheet','Balance sheet'],['income-statement','Income statement'],['cash-flow','Cash flow'],['general-ledger','General ledger']] as Array<[ReportView,string]>).map(([id,label]) => `<button role="tab" aria-selected="${activeReport === id}" data-report="${id}">${label}</button>`).join("")}
      </div><div class="report-stack">${reportMarkup()}</div>`;
    case "banking":
      return `<paprel-banking-list></paprel-banking-list>`;
    case "banking-detail":
      return `<div class="view-actions"><button data-back="banking">← Banking</button></div><paprel-bank-account-detail account-id="${escapeAttribute(selectedBankAccountId)}"></paprel-bank-account-detail>`;
    case "transactions":
      return `<paprel-transaction-inbox ${collectionAttributes("paprel-transaction-inbox")}></paprel-transaction-inbox>`;
    case "transaction-locks":
      return `<paprel-transaction-locks page="1" page-size="25"></paprel-transaction-locks>`;
  }
}

function reportMarkup(): string {
  if (activeReport === "trial-balance") return `<paprel-trial-balance></paprel-trial-balance>`;
  if (activeReport === "balance-sheet") return `<paprel-balance-sheet></paprel-balance-sheet>`;
  if (activeReport === "income-statement") return `<paprel-income-statement></paprel-income-statement>`;
  if (activeReport === "cash-flow") return `<paprel-cash-flow></paprel-cash-flow>`;
  return `<paprel-general-ledger></paprel-general-ledger>`;
}

function viewTitle(): string {
  if (activeView === "account-detail") return "Account detail";
  if (activeView === "account-form") return selectedAccountId ? "Edit account" : "New account";
  if (activeView === "journal-detail") return "Journal detail";
  if (activeView === "journal-form") return journalMode === "create" ? "New journal" : `${journalMode[0].toUpperCase()}${journalMode.slice(1)} journal`;
  if (activeView === "banking-detail") return "Bank account detail";
  return nav.find((item) => item.id === activeView)?.label || "Accounting";
}

const nav: Array<{ id: View; label: string; hint: string }> = [
  { id: "accounts", label: "Chart of Accounts", hint: "Property ledger structure" },
  { id: "journals", label: "Journals", hint: "Rent, costs and adjustments" },
  { id: "reports", label: "Reports", hint: "Portfolio performance" },
  { id: "banking", label: "Banking", hint: "Operating and deposit accounts" },
  { id: "transactions", label: "Transactions", hint: "Categorize property activity" },
  { id: "transaction-locks", label: "Transaction locks", hint: "Protect closed periods" },
];

function navActive(id: View): boolean {
  if (id === "accounts") return activeView === "accounts" || activeView === "account-detail" || activeView === "account-form";
  if (id === "journals") return activeView === "journals" || activeView === "journal-detail" || activeView === "journal-form";
  if (id === "banking") return activeView === "banking" || activeView === "banking-detail";
  return id === activeView;
}

function renderShell(): void {
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="identity">
          <span class="brand-mark">H</span>
          <label class="entity-switcher">
            <span>Portfolio company</span>
            <select id="company-switcher" aria-label="Portfolio company">
              ${entities.map((entity) => `<option value="${escapeAttribute(entity.id)}"${entity.id === activeEntityId ? " selected" : ""}>${escapeHtml(entity.label)}</option>`).join("")}
            </select>
          </label>
        </div>
        <nav aria-label="Property accounting">
          ${nav.map((item) => `<button class="nav-item${navActive(item.id) ? " is-active" : ""}" data-view="${item.id}">
            <span>${item.label}</span><small>${item.hint}</small>
          </button>`).join("")}
        </nav>
        <div class="sidebar-footer">
          <div class="config-card" aria-label="Embed configuration">
            <div class="company-context">
              <span class="company-mark" aria-hidden="true">${escapeHtml((connectedCompany?.name || "P").slice(0, 1).toUpperCase())}</span>
              <div class="company-copy">
                <span class="company-label"><i></i>Paprel company</span>
                <strong>${escapeHtml(connectedCompany?.name || "Connected company")}</strong>
                <small>${escapeHtml(connectedCompany?.currency || "Authenticated entity")}</small>
              </div>
              ${connectedCompany?.id ? `<div class="company-id"><span>Company ID</span><code>${escapeHtml(connectedCompany.id)}</code></div>` : ""}
            </div>
          </div>
          <div class="connection-card">
            <span class="status-dot"></span>
            <div class="connection-copy"><strong>Paprel connected</strong><span id="token-expiry">Auto-renews</span></div>
            <button id="refresh-session" class="refresh-button">Refresh</button>
          </div>
        </div>
      </aside>
      <main class="workspace">
        <header class="topbar">
          <div><p class="eyebrow">Real-estate accounting</p><h1>${viewTitle()}</h1></div>
        </header>
        <section id="embed-surface" class="embed-surface">${viewMarkup(activeView)}</section>
      </main>
    </div>`;

  wireShell();
  applyHostTheme();
  updateExpiry();
}

function navigate(view: View): void {
  activeView = view;
  renderShell();
}

function applyHostTheme(): void {
  const shell = document.querySelector<HTMLElement>(".app-shell");
  if (!shell) return;
  shell.style.setProperty("--paprel-color-primary", hostTheme.primary);
  shell.style.setProperty("--paprel-color-surface-muted", hostTheme.accent);
  shell.style.setProperty("--paprel-radius", hostTheme.radius);
  shell.style.setProperty("--paprel-radius-sm", hostTheme.radius);
}

function wireShell(): void {
  document.querySelector("#embed-surface")?.addEventListener("paprel:view-change", (event) => {
    syncViewState((event as CustomEvent<PaprelViewChangeDetail>).detail);
  });
  document.querySelector("#embed-surface")?.addEventListener("paprel:resource-open", (event) => {
    const resourceEvent = event as CustomEvent<PaprelResourceOpenDetail>;
    const { resource, id } = resourceEvent.detail;
    resourceEvent.preventDefault();
    if (resource === "account") {
      selectedAccountId = id;
      navigate("account-detail");
    } else if (resource === "journal") {
      selectedJournalId = id;
      navigate("journal-detail");
    } else if (resource === "bank-account") {
      selectedBankAccountId = id;
      navigate("banking-detail");
    }
  });

  document.querySelector<HTMLSelectElement>("#company-switcher")?.addEventListener("change", async (event) => {
    const select = event.currentTarget as HTMLSelectElement;
    const previous = activeEntityId;
    select.disabled = true;
    try {
      await switchEntity(select.value);
    } catch (error) {
      activeEntityId = previous;
      select.value = previous;
      select.disabled = false;
      window.alert(errorMessage(error, "Unable to switch company"));
    }
  });

  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      navigate(button.dataset.view as View);
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-back]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.back as View)));
  document.querySelectorAll<HTMLButtonElement>("[data-report]").forEach((button) => button.addEventListener("click", () => { activeReport = button.dataset.report as ReportView; renderShell(); }));
  document.querySelector<HTMLButtonElement>("[data-account-new]")?.addEventListener("click", () => { selectedAccountId = ""; navigate("account-form"); });
  document.querySelector<HTMLButtonElement>("[data-journal-new]")?.addEventListener("click", () => { selectedJournalId = ""; journalMode = "create"; navigate("journal-form"); });

  document.querySelector("paprel-account-detail")?.addEventListener("account-action", () => navigate("account-form"));
  document.querySelector("paprel-account-form")?.addEventListener("account-saved", (event) => {
    selectedAccountId = String((event as CustomEvent<{ account: { id?: string } }>).detail.account.id || selectedAccountId);
    navigate(selectedAccountId ? "account-detail" : "accounts");
  });
  const onJournalAction = (event: Event) => {
    const detail = (event as CustomEvent<{ action: JournalMode; journalId: string }>).detail;
    selectedJournalId = detail.journalId;
    journalMode = detail.action;
    navigate("journal-form");
  };
  document.querySelector("paprel-journal-list")?.addEventListener("journal-action", onJournalAction);
  document.querySelector("paprel-journal-detail")?.addEventListener("journal-action", onJournalAction);
  document.querySelector("paprel-journal-detail")?.addEventListener("journal-deleted", () => navigate("journals"));
  document.querySelector("paprel-journal-editor")?.addEventListener("journal-saved", (event) => {
    selectedJournalId = String((event as CustomEvent<{ journal: { id?: string } }>).detail.journal.id || selectedJournalId);
    navigate(selectedJournalId ? "journal-detail" : "journals");
  });
  document.querySelector<HTMLButtonElement>("#refresh-session")?.addEventListener("click", async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    button.disabled = true;
    button.textContent = "Refreshing…";
    try {
      await refreshEmbedSession();
      updateExpiry();
    } finally {
      button.disabled = false;
      button.textContent = "Refresh";
    }
  });
}

async function switchEntity(entityId: string): Promise<void> {
  if (entityId === activeEntityId) return;
  activeEntityId = entityId;
  connectedCompany = null;
  selectedAccountId = "";
  selectedJournalId = "";
  selectedBankAccountId = "";
  activeView = "accounts";
  const initial = await getTokens();
  await loadConnectedCompany(initial.accessToken);
  configureSession();
  renderShell();
}

function configureSession(): void {
  configureAccounting({
    baseUrl: "",
    locale: "en",
    auth: {
      partnerDomain,
      getTokens,
      onTokensUpdated(tokens) { expiresAt = tokens.expiresAt; updateExpiry(); },
      onSessionExpired() { app.innerHTML = `<main class="boot-card error"><h1>Session expired</h1><p>Refresh the page to reconnect.</p></main>`; },
    },
  });
}

function updateExpiry(): void {
  const el = document.querySelector("#token-expiry");
  if (!el || !expiresAt) return;
  const minutes = Math.max(1, Math.round((expiresAt - Date.now()) / 60_000));
  el.textContent = `Auto-renews · ${minutes}m`;
}

async function bootstrap(): Promise<void> {
  try {
    const initial = await getTokens();
    await loadConnectedCompany(initial.accessToken);
    configureSession();
    expiresAt = initial.expiresAt;
    renderShell();
  } catch (error) {
    app.innerHTML = `<main class="boot-card error"><span class="brand-mark">!</span><p class="eyebrow">Connection failed</p><h1>Check the local credentials</h1><p>${escapeHtml(errorMessage(error))}</p><code>apps/accounting-dashboard/.env.local</code></main>`;
  }
}

void bootstrap();
