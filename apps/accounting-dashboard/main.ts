import {
  configureAccounting,
  refreshEmbedSession,
  type EmbedTokenSet,
} from "@paprel/accounting";
import "@paprel/reports";
import { errorMessage, escapeAttribute, escapeHtml, requestEmbedTokens } from "../../shared/browser-utils";
import "./styles.css";

type View = "accounts" | "account-detail" | "account-form" | "journals" | "journal-detail" | "journal-form" | "reports" | "banking" | "transactions" | "reconciliation";
type JournalMode = "create" | "edit" | "copy" | "reverse";
type ReportView = "trial-balance" | "balance-sheet" | "income-statement" | "cash-flow" | "general-ledger";

const app = document.querySelector<HTMLDivElement>("#app")!;
const partnerDomain = import.meta.env.VITE_PARTNER_DOMAIN || window.location.hostname;
const themes = {
  ink: { primary: "#1d2925", accent: "#e8f1ec", radius: "10px" },
  indigo: { primary: "#4338ca", accent: "#eef2ff", radius: "8px" },
  emerald: { primary: "#047857", accent: "#ecfdf5", radius: "14px" },
} as const;

let activeView: View = "accounts";
let activeTheme: keyof typeof themes = "ink";
let selectedAccountId = "";
let selectedJournalId = "";
let journalMode: JournalMode = "create";
let activeReport: ReportView = "trial-balance";
let expiresAt = 0;

async function getTokens(): Promise<EmbedTokenSet> {
  const tokens = await requestEmbedTokens();
  expiresAt = tokens.expiresAt;
  return tokens;
}

function viewMarkup(view: View): string {
  switch (view) {
    case "accounts":
      return `<div class="view-actions"><span>Select an account to inspect it.</span><button data-account-new>New account</button></div><paprel-chart-of-accounts id="accounts-widget"></paprel-chart-of-accounts>`;
    case "account-detail":
      return `<div class="view-actions"><button data-back="accounts">← Accounts</button></div><paprel-account-detail account-id="${escapeAttribute(selectedAccountId)}"></paprel-account-detail>`;
    case "account-form":
      return `<div class="view-actions"><button data-back="${selectedAccountId ? "account-detail" : "accounts"}">← Back</button></div><paprel-account-form account-id="${escapeAttribute(selectedAccountId)}" currency="USD"></paprel-account-form>`;
    case "journals":
      return `<div class="view-actions"><span>Select a journal to inspect it.</span><button data-journal-new>New journal</button></div><paprel-journal-list page="1" page-size="25"></paprel-journal-list>`;
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
    case "transactions":
      return `<paprel-transaction-inbox inbox="uncategorized" page="1" page-size="25"></paprel-transaction-inbox>`;
    case "reconciliation":
      return `<paprel-reconciliation-list status="all" page="1" page-size="25"></paprel-reconciliation-list>`;
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
  return nav.find((item) => item.id === activeView)?.label || "Accounting";
}

const nav: Array<{ id: View; label: string; hint: string }> = [
  { id: "accounts", label: "Chart of Accounts", hint: "Ledger structure" },
  { id: "journals", label: "Journals", hint: "Entries and adjustments" },
  { id: "reports", label: "Reports", hint: "Financial statements" },
  { id: "banking", label: "Banking", hint: "Connected accounts" },
  { id: "transactions", label: "Transactions", hint: "Categorize activity" },
  { id: "reconciliation", label: "Reconciliation", hint: "Close the period" },
];

function navActive(id: View): boolean {
  if (id === "accounts") return activeView === "accounts" || activeView === "account-detail" || activeView === "account-form";
  if (id === "journals") return activeView === "journals" || activeView === "journal-detail" || activeView === "journal-form";
  return id === activeView;
}

function renderShell(): void {
  app.innerHTML = `
    <div class="app-shell" data-theme="${activeTheme}">
      <aside class="sidebar">
        <div class="identity">
          <span class="brand-mark">N</span>
          <div><strong>Northstar</strong><span>Finance workspace</span></div>
        </div>
        <nav aria-label="Accounting">
          ${nav.map((item) => `<button class="nav-item${navActive(item.id) ? " is-active" : ""}" data-view="${item.id}">
            <span>${item.label}</span><small>${item.hint}</small>
          </button>`).join("")}
        </nav>
        <div class="connection-card">
          <span class="status-dot"></span>
          <div><strong>Paprel connected</strong><span id="token-expiry">Secure App Connect session</span></div>
        </div>
      </aside>
      <main class="workspace">
        <header class="topbar">
          <div><p class="eyebrow">Embedded accounting</p><h1>${viewTitle()}</h1></div>
          <div class="topbar-actions">
            <label class="theme-control">Theme
              <select id="theme-select"><option value="ink" ${activeTheme === "ink" ? "selected" : ""}>Ink</option><option value="indigo" ${activeTheme === "indigo" ? "selected" : ""}>Indigo</option><option value="emerald" ${activeTheme === "emerald" ? "selected" : ""}>Emerald</option></select>
            </label>
            <button id="refresh-session" class="refresh-button">Refresh session</button>
          </div>
        </header>
        <section class="context-strip">
          <div><span>Partner domain</span><strong>${partnerDomain}</strong></div>
          <div><span>Integration</span><strong>@paprel/accounting</strong></div>
          <div><span>Styles</span><strong>Inherited theme variables</strong></div>
        </section>
        <section id="embed-surface" class="embed-surface">${viewMarkup(activeView)}</section>
      </main>
    </div>`;

  wireShell();
  applyTheme(activeTheme);
  updateExpiry();
}

function navigate(view: View): void {
  activeView = view;
  renderShell();
}

function applyTheme(name: keyof typeof themes): void {
  activeTheme = name;
  const shell = document.querySelector<HTMLElement>(".app-shell");
  if (!shell) return;
  const theme = themes[name];
  shell.dataset.theme = name;
  shell.style.setProperty("--paprel-color-primary", theme.primary);
  shell.style.setProperty("--paprel-color-surface-muted", theme.accent);
  shell.style.setProperty("--paprel-radius", theme.radius);
  shell.style.setProperty("--paprel-radius-sm", theme.radius);
}

function wireShell(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      navigate(button.dataset.view as View);
    });
  });

  document.querySelector<HTMLSelectElement>("#theme-select")?.addEventListener("change", (event) => {
    const name = (event.target as HTMLSelectElement).value as keyof typeof themes;
    applyTheme(name);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-back]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.back as View)));
  document.querySelectorAll<HTMLButtonElement>("[data-report]").forEach((button) => button.addEventListener("click", () => { activeReport = button.dataset.report as ReportView; renderShell(); }));
  document.querySelector<HTMLButtonElement>("[data-account-new]")?.addEventListener("click", () => { selectedAccountId = ""; navigate("account-form"); });
  document.querySelector<HTMLButtonElement>("[data-journal-new]")?.addEventListener("click", () => { selectedJournalId = ""; journalMode = "create"; navigate("journal-form"); });

  document.querySelector("paprel-chart-of-accounts")?.addEventListener("account-select", (event) => {
    selectedAccountId = (event as CustomEvent<{ accountId: string }>).detail.accountId;
    navigate("account-detail");
  });
  document.querySelector("paprel-account-detail")?.addEventListener("account-action", () => navigate("account-form"));
  document.querySelector("paprel-account-form")?.addEventListener("account-saved", (event) => {
    selectedAccountId = String((event as CustomEvent<{ account: { id?: string } }>).detail.account.id || selectedAccountId);
    navigate(selectedAccountId ? "account-detail" : "accounts");
  });
  document.querySelector("paprel-journal-list")?.addEventListener("journal-select", (event) => {
    selectedJournalId = (event as CustomEvent<{ journalId: string }>).detail.journalId;
    navigate("journal-detail");
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
      button.textContent = "Refresh session";
    }
  });
}

function updateExpiry(): void {
  const el = document.querySelector("#token-expiry");
  if (!el || !expiresAt) return;
  const minutes = Math.max(1, Math.round((expiresAt - Date.now()) / 60_000));
  el.textContent = `Session renews automatically · ${minutes}m`;
}

async function bootstrap(): Promise<void> {
  try {
    const initial = await getTokens();
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
    expiresAt = initial.expiresAt;
    renderShell();
  } catch (error) {
    app.innerHTML = `<main class="boot-card error"><span class="brand-mark">!</span><p class="eyebrow">Connection failed</p><h1>Check the local credentials</h1><p>${escapeHtml(errorMessage(error))}</p><code>apps/accounting-dashboard/.env.local</code></main>`;
  }
}

void bootstrap();
