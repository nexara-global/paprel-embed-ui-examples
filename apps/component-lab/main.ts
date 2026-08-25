/**
 * PL-113 sample partner app — dev BFF at /api/embed-token, API via Vite /v1 proxy.
 */
import "./styles/shell.css";
import {
  EMBED_LOCALES,
  configureAccounting,
  refreshEmbedSession,
  setEmbedLocale,
  type EmbedLocale,
  type TransactionInbox,
} from "@paprel/embed-accounting";
import { COMPONENT_CUES, renderComponentCue, wireComponentCues } from "./component-cues";
import { onRouteChange, parseRoute, pushRoute, replaceRoute } from "./router.js";
import { DEFAULT_VIEW, VIEW_META, type JournalEditorMode, type ViewId } from "./views.js";

const LOCALE_STORAGE_KEY = "paprel-embed-sample-locale";

function readStoredLocale(): EmbedLocale {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored && EMBED_LOCALES.some((l) => l.id === stored)) return stored as EmbedLocale;
  return "en";
}

let activeLocale: EmbedLocale = readStoredLocale();

const partnerDomain = import.meta.env.VITE_PARTNER_DOMAIN ?? "app.newledger.io";
const baseUrl = import.meta.env.DEV ? "" : (import.meta.env.VITE_PAPREL_API_BASE_URL ?? import.meta.env.VITE_PAPREL_BASE_URL ?? "");

let sessionMeta = { companyId: "", expiresIn: 0 };
let recoveringSession = false;

type ShowViewFn = (
  id: ViewId,
  options?: {
    reload?: boolean;
    journalId?: string;
    editorMode?: JournalEditorMode;
    bankAccountId?: string;
    transactionId?: string;
    reconciliationId?: string;
    inbox?: TransactionInbox;
    syncUrl?: boolean;
  },
) => void;
let showAppView: ShowViewFn | undefined;

function setStatus(message: string, kind: "loading" | "ok" | "error" = "loading") {
  const chip = document.getElementById("status-chip");
  const boot = document.getElementById("status");
  for (const el of [chip, boot]) {
    if (!el) continue;
    el.textContent = message;
    el.dataset.state = kind;
  }
}

async function fetchEmbedTokens() {
  const res = await fetch("/api/embed-token");
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? `Token BFF failed (${res.status})`);
  }
  return body as {
    accessToken: string;
    expiresAt: number;
    permissions?: string[];
    companyId?: string;
    expiresIn?: number;
  };
}

async function fetchEmbedTokensWithRetry(maxAttempts = 3) {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fetchEmbedTokens();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Token exchange failed");
}

function applySessionMeta(tokens: { companyId?: string; expiresIn?: number }) {
  sessionMeta = {
    companyId: tokens.companyId ?? sessionMeta.companyId,
    expiresIn: tokens.expiresIn ?? sessionMeta.expiresIn,
  };
  const ttlHours = sessionMeta.expiresIn ? Math.round(sessionMeta.expiresIn / 3600) : 0;
  setStatus(`Connected · ${ttlHours}h session`, "ok");
}

async function recoverSession(): Promise<void> {
  if (recoveringSession) return;
  recoveringSession = true;
  setStatus("Renewing session…", "loading");

  try {
    await refreshEmbedSession();
    await refreshAllEmbedWidgets();
    const ttlHours = sessionMeta.expiresIn ? Math.round(sessionMeta.expiresIn / 3600) : 0;
    setStatus(`Connected · ${ttlHours}h session`, "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Session expired — refresh the page", "error");
  } finally {
    recoveringSession = false;
  }
}

function navIcon(path: string): string {
  return `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">${path}</svg>`;
}

const NAV_ITEMS: { id: ViewId; label: string; tag: string; icon: string }[] = [
  {
    id: "accounts",
    label: "Chart of accounts",
    tag: "paprel-chart-of-accounts",
    icon: navIcon(
      '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h10M7 12h10M7 16h6" stroke-linecap="round"/>',
    ),
  },
  {
    id: "account-select",
    label: "Account picker",
    tag: "paprel-account-select",
    icon: navIcon(
      '<path d="M4 7h16M4 12h16M4 17h10" stroke-linecap="round"/><circle cx="18" cy="17" r="2"/>',
    ),
  },
  {
    id: "account-form",
    label: "Account form",
    tag: "paprel-account-form",
    icon: navIcon('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" stroke-linecap="round" stroke-linejoin="round"/>'),
  },
  {
    id: "trial-balance",
    label: "Trial balance",
    tag: "paprel-trial-balance",
    icon: navIcon('<path d="M4 19h16M6 16V8M10 16V5M14 16v-6M18 16v-3" stroke-linecap="round"/>'),
  },
  {
    id: "balance-sheet",
    label: "Balance sheet",
    tag: "paprel-balance-sheet",
    icon: navIcon('<path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3" stroke-linecap="round"/>'),
  },
  {
    id: "income-statement",
    label: "Income statement",
    tag: "paprel-income-statement",
    icon: navIcon('<path d="M4 19h16M7 15l3-3 3 2 4-5" stroke-linecap="round" stroke-linejoin="round"/>'),
  },
  {
    id: "cash-flow",
    label: "Cash flow",
    tag: "paprel-cash-flow",
    icon: navIcon('<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"/>'),
  },
  {
    id: "general-ledger",
    label: "General ledger",
    tag: "paprel-general-ledger",
    icon: navIcon('<path d="M4 6h16M4 10h10M4 14h13M4 18h8" stroke-linecap="round"/>'),
  },
  {
    id: "banking",
    label: "Banking",
    tag: "paprel-banking-list",
    icon: navIcon('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 14h.01M11 14h.01" stroke-linecap="round"/>'),
  },
  {
    id: "transactions",
    label: "Transactions",
    tag: "paprel-transaction-inbox",
    icon: navIcon('<path d="M4 7h16M4 12h10M4 17h6" stroke-linecap="round"/><circle cx="18" cy="17" r="2"/>'),
  },
  {
    id: "reconciliations",
    label: "Reconciliations",
    tag: "paprel-reconciliation-list",
    icon: navIcon('<path d="M8 6h8M8 10h8M8 14h5" stroke-linecap="round"/><path d="M6 6v12" stroke-linecap="round"/>'),
  },
  {
    id: "journals",
    label: "Journals",
    tag: "paprel-journal-list",
    icon: navIcon('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke-linecap="round"/>'),
  },
  {
    id: "journal-new",
    label: "New journal",
    tag: "paprel-journal-editor",
    icon: navIcon('<path d="M12 5v14M5 12h14" stroke-linecap="round"/>'),
  },
];

function mountAppShell() {
  const app = document.getElementById("app");
  if (!app) return;

  const companyShort = sessionMeta.companyId ? sessionMeta.companyId.slice(0, 8) : "—";
  const ttlHours = sessionMeta.expiresIn ? Math.round(sessionMeta.expiresIn / 3600) : 0;

  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" aria-label="Main navigation">
        <div class="brand">
          <div class="brand-mark" aria-hidden="true">AB</div>
          <div class="brand-copy">
            <strong>Acme Books</strong>
            <span>Paprel embed demo</span>
          </div>
        </div>

        <div>
          <div class="nav-section-label">Screens</div>
          <ul class="nav-list" role="list">
            ${NAV_ITEMS.map(
              (item) => `
              <li>
                <button type="button" class="nav-item" data-nav="${item.id}" aria-current="false">
                  ${item.icon}
                  <span class="nav-item-text">
                    <span class="nav-item-label">${item.label}</span>
                    <code class="nav-item-tag">${item.tag}</code>
                  </span>
                </button>
              </li>`,
            ).join("")}
          </ul>
        </div>

        <div class="sidebar-foot">
          <span class="sidebar-foot-label">Locale</span>
          <select id="locale-select" class="locale-select" aria-label="Embed locale">
            ${EMBED_LOCALES.map(
              (loc) => `<option value="${loc.id}" ${loc.id === activeLocale ? "selected" : ""}>${loc.label}</option>`,
            ).join("")}
          </select>
          <span class="sidebar-foot-label">Tenant</span>
          <code>${companyShort}…</code>
          <span class="sidebar-foot-label">Package</span>
          <code>@paprel/embed-accounting</code>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <div class="topbar-copy">
            <p class="topbar-eyebrow" id="view-tag">${VIEW_META.accounts.subtitle}</p>
            <h2 id="view-title">${VIEW_META.accounts.title}</h2>
            <p id="view-subtitle">${VIEW_META.accounts.intro}</p>
          </div>
          <div class="topbar-actions">
            <button type="button" id="refresh-view" class="btn-ghost" title="Reload current view from Paprel">
              Refresh
            </button>
            <div id="status-chip" class="status-chip" data-state="ok">
              Connected · ${ttlHours}h session
            </div>
          </div>
        </header>

        <div class="content">
          <section class="view is-active" data-view="accounts">
            <div class="page-toolbar">
              <label class="toggle">
                <input type="checkbox" id="coa-tree-toggle" />
                <span><code>tree</code> attribute — nested hierarchy instead of flat grid</span>
              </label>
            </div>
            <div class="embed-stage">
              ${renderComponentCue(COMPONENT_CUES.chartOfAccounts)}
              <div class="embed-widget">
                <div class="paprel-shell">
                  <paprel-chart-of-accounts id="coa-widget"></paprel-chart-of-accounts>
                </div>
              </div>
            </div>
          </section>

          <section class="view" data-view="account-select">
            <div class="embed-stage embed-stage-narrow">
              ${renderComponentCue(COMPONENT_CUES.accountSelect)}
              <div class="embed-widget">
                <div class="paprel-shell">
                  <paprel-account-select id="account-select-demo" label="General ledger account"></paprel-account-select>
                </div>
                <p class="embed-widget-note" id="account-select-output">Type to search; selection fires <code>account-change</code>.</p>
              </div>
            </div>
          </section>

          <section class="view" data-view="account-form">
            <div class="embed-stage embed-stage-narrow">
              ${renderComponentCue(COMPONENT_CUES.accountForm)}
              <div class="embed-widget">
                <div class="paprel-shell">
                  <paprel-account-form id="account-form-demo" currency="USD"></paprel-account-form>
                </div>
              </div>
            </div>
          </section>

          <section class="view" data-view="trial-balance">
            <div class="embed-stage">
              ${renderComponentCue(COMPONENT_CUES.trialBalance)}
              <div class="embed-widget">
                <div class="paprel-shell">
                  <paprel-trial-balance id="trial-balance-widget"></paprel-trial-balance>
                </div>
              </div>
            </div>
          </section>

          <section class="view" data-view="balance-sheet">
            <div class="embed-stage">
              ${renderComponentCue(COMPONENT_CUES.balanceSheet)}
              <div class="embed-widget">
                <div class="paprel-shell">
                  <paprel-balance-sheet id="balance-sheet-widget"></paprel-balance-sheet>
                </div>
              </div>
            </div>
          </section>

          <section class="view" data-view="income-statement">
            <div class="embed-stage">
              ${renderComponentCue(COMPONENT_CUES.incomeStatement)}
              <div class="embed-widget">
                <div class="paprel-shell">
                  <paprel-income-statement id="income-statement-widget"></paprel-income-statement>
                </div>
              </div>
            </div>
          </section>

          <section class="view" data-view="cash-flow">
            <div class="embed-stage">
              ${renderComponentCue(COMPONENT_CUES.cashFlow)}
              <div class="embed-widget">
                <div class="paprel-shell">
                  <paprel-cash-flow id="cash-flow-widget"></paprel-cash-flow>
                </div>
              </div>
            </div>
          </section>

          <section class="view" data-view="general-ledger">
            <div class="embed-stage">
              ${renderComponentCue(COMPONENT_CUES.generalLedger)}
              <div class="embed-widget">
                <div class="paprel-shell">
                  <paprel-general-ledger id="general-ledger-widget"></paprel-general-ledger>
                </div>
              </div>
            </div>
          </section>

          <section class="view" data-view="banking">
            <div class="embed-stage">
              ${renderComponentCue(COMPONENT_CUES.bankingList)}
              <div class="embed-widget">
                <div class="paprel-shell">
                  <paprel-banking-list id="banking-list-widget"></paprel-banking-list>
                </div>
                <p class="embed-widget-note" id="banking-select-output">Row click fires <code>bank-account-select</code>.</p>
              </div>
            </div>
          </section>

          <section class="view" data-view="transactions">
            <div class="embed-stage">
              ${renderComponentCue(COMPONENT_CUES.transactionInbox)}
              <div class="embed-widget">
                <div class="paprel-shell">
                  <paprel-transaction-inbox id="transaction-inbox-widget"></paprel-transaction-inbox>
                </div>
                <p class="embed-widget-note" id="transaction-select-output">Row click fires <code>transaction-select</code>.</p>
              </div>
            </div>
          </section>

          <section class="view" data-view="reconciliations">
            <div class="embed-stage">
              ${renderComponentCue(COMPONENT_CUES.reconciliationForm)}
              <div class="embed-widget">
                <div class="paprel-shell">
                  <paprel-reconciliation-form id="reconciliation-form-widget" currency="USD"></paprel-reconciliation-form>
                </div>
              </div>
              ${renderComponentCue(COMPONENT_CUES.reconciliationList)}
              <div class="embed-widget">
                <div class="paprel-shell">
                  <paprel-reconciliation-list id="reconciliation-list-widget" currency="USD"></paprel-reconciliation-list>
                </div>
                <p class="embed-widget-note" id="reconciliation-select-output">Row click fires <code>reconciliation-select</code>.</p>
              </div>
            </div>
          </section>

          <section class="view" data-view="reconciliation-detail">
            <div class="page-toolbar">
              <button type="button" id="reconciliation-detail-back" class="btn-ghost">← Back to reconciliations</button>
            </div>
            <div class="embed-stage">
              ${renderComponentCue(COMPONENT_CUES.reconciliationDetail)}
              <div class="embed-widget">
                <div class="paprel-shell">
                  <paprel-reconciliation-detail id="reconciliation-detail" currency="USD"></paprel-reconciliation-detail>
                </div>
              </div>
            </div>
          </section>

          <section class="view" data-view="bank-account-detail">
            <div class="page-toolbar">
              <button type="button" id="bank-account-detail-back" class="btn-ghost">← Back to banking</button>
            </div>
            <div class="embed-stage">
              ${renderComponentCue(COMPONENT_CUES.bankAccountDetail)}
              <div class="embed-widget">
                <div class="paprel-shell">
                  <paprel-bank-account-detail id="bank-account-detail"></paprel-bank-account-detail>
                </div>
              </div>
            </div>
          </section>

          <section class="view" data-view="transaction-detail">
            <div class="page-toolbar">
              <button type="button" id="transaction-detail-back" class="btn-ghost">← Back to transactions</button>
            </div>
            <div class="embed-stage">
              ${renderComponentCue(COMPONENT_CUES.transactionDetail)}
              <div class="embed-widget">
                <div class="paprel-shell">
                  <paprel-transaction-detail id="transaction-detail"></paprel-transaction-detail>
                </div>
              </div>
              ${renderComponentCue(COMPONENT_CUES.transactionMatchSheet)}
              <div class="embed-widget">
                <div class="paprel-shell">
                  <paprel-transaction-match-sheet id="transaction-match-sheet"></paprel-transaction-match-sheet>
                </div>
              </div>
            </div>
          </section>

          <section class="view" data-view="journals">
            <div class="embed-stage">
              ${renderComponentCue(COMPONENT_CUES.journalList)}
              <div class="embed-widget">
                <div class="paprel-shell">
                  <paprel-journal-list id="journal-list" page="1"></paprel-journal-list>
                </div>
              </div>
            </div>
          </section>

          <section class="view" data-view="journal-detail">
            <div class="page-toolbar">
              <button type="button" id="journal-detail-back" class="btn-ghost">← Back to journals</button>
            </div>
            <div class="embed-stage">
              ${renderComponentCue(COMPONENT_CUES.journalDetail)}
              <div class="embed-widget">
                <div class="paprel-shell">
                  <paprel-journal-detail id="journal-detail"></paprel-journal-detail>
                </div>
              </div>
            </div>
          </section>

          <section class="view" data-view="journal-new">
            <div class="embed-stage">
              ${renderComponentCue(COMPONENT_CUES.journalEditor)}
              <div class="embed-widget">
                <div class="paprel-shell">
                  <paprel-journal-editor id="journal-editor-new" currency="USD"></paprel-journal-editor>
                </div>
              </div>
            </div>
          </section>

          <section class="view" data-view="journal-edit">
            <div class="page-toolbar">
              <button type="button" id="journal-edit-back" class="btn-ghost">← Back to journal</button>
            </div>
            <div class="embed-stage">
              ${renderComponentCue(COMPONENT_CUES.journalEditor)}
              <div class="embed-widget">
                <div class="paprel-shell">
                  <paprel-journal-editor id="journal-editor-edit"></paprel-journal-editor>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  `;

  wireComponentCues(app);
  wireNavigation();
  wireJournalSelection();
  wireAccountSelectDemo();
  wireCoaToggle();
  wireLocaleSelect();
  wireBankingDemo();
  wireTransactionDemo();
  wireReconciliationDemo();
  wireBankingNavigation();
}

function applyBankAccountDetail(bankAccountId?: string, inbox?: TransactionInbox): void {
  const widget = document.getElementById("bank-account-detail");
  if (!widget) return;
  if (!bankAccountId) {
    widget.removeAttribute("account-id");
    return;
  }
  widget.setAttribute("account-id", bankAccountId);
  if (inbox) widget.setAttribute("inbox", inbox);
}

function applyTransactionDetail(transactionId?: string): void {
  const widget = document.getElementById("transaction-detail");
  const matchSheet = document.getElementById("transaction-match-sheet");
  if (!widget) return;
  if (!transactionId) {
    widget.removeAttribute("transaction-id");
    matchSheet?.removeAttribute("transaction-id");
    return;
  }
  widget.setAttribute("transaction-id", transactionId);
  matchSheet?.setAttribute("transaction-id", transactionId);
}

function applyReconciliationDetail(reconciliationId?: string): void {
  const widget = document.getElementById("reconciliation-detail");
  if (!widget) return;
  if (!reconciliationId) {
    widget.removeAttribute("reconciliation-id");
    return;
  }
  widget.setAttribute("reconciliation-id", reconciliationId);
}

function applyReconciliationBankAccount(bankAccountId?: string): void {
  const list = document.getElementById("reconciliation-list-widget");
  const form = document.getElementById("reconciliation-form-widget");
  if (!list && !form) return;
  if (!bankAccountId) {
    list?.removeAttribute("bank-account-id");
    form?.removeAttribute("bank-account-id");
    return;
  }
  list?.setAttribute("bank-account-id", bankAccountId);
  form?.setAttribute("bank-account-id", bankAccountId);
}

function wireReconciliationDemo() {
  const list = document.getElementById("reconciliation-list-widget");
  const output = document.getElementById("reconciliation-select-output");
  list?.addEventListener("reconciliation-select", (event) => {
    const { reconciliationId } = (event as CustomEvent<{ reconciliationId: string }>).detail;
    if (output && reconciliationId) {
      output.innerHTML = `<code>reconciliation-select</code> → <strong>${reconciliationId.slice(0, 8)}…</strong>`;
    }
    if (reconciliationId) {
      const route = parseRoute();
      showAppView?.("reconciliation-detail", {
        reconciliationId,
        bankAccountId: route.bankAccountId,
        reload: true,
      });
    }
  });

  document.getElementById("reconciliation-form-widget")?.addEventListener("reconciliation-created", (event) => {
    const { reconciliationId } = (event as CustomEvent<{ reconciliationId: string }>).detail;
    void (document.querySelector("#reconciliation-list-widget") as RefreshableElement | null)?.refresh?.();
    if (reconciliationId) {
      const route = parseRoute();
      showAppView?.("reconciliation-detail", {
        reconciliationId,
        bankAccountId: route.bankAccountId,
        reload: true,
      });
    }
  });

  document.getElementById("reconciliation-detail-back")?.addEventListener("click", () => {
    const route = parseRoute();
    showAppView?.("reconciliations", { bankAccountId: route.bankAccountId, reload: true });
  });

  document.getElementById("reconciliation-detail")?.addEventListener("reconciliation-finalized", () => {
    void (document.querySelector("#reconciliation-list-widget") as RefreshableElement | null)?.refresh?.();
    void (document.querySelector("#bank-account-detail") as RefreshableElement | null)?.refresh?.();
  });

  document.getElementById("reconciliation-detail")?.addEventListener("reconciliation-voided", () => {
    void (document.querySelector("#reconciliation-list-widget") as RefreshableElement | null)?.refresh?.();
    void (document.querySelector("#bank-account-detail") as RefreshableElement | null)?.refresh?.();
  });
}

function wireTransactionDemo() {
  const widget = document.getElementById("transaction-inbox-widget");
  const output = document.getElementById("transaction-select-output");
  widget?.addEventListener("transaction-select", (event) => {
    const { transactionId } = (event as CustomEvent<{ transactionId: string }>).detail;
    if (output && transactionId) {
      output.innerHTML = `<code>transaction-select</code> → <strong>${transactionId.slice(0, 8)}…</strong>`;
    }
    if (transactionId) showAppView?.("transaction-detail", { transactionId, reload: true });
  });
}

function wireBankingDemo() {
  const widget = document.getElementById("banking-list-widget");
  const output = document.getElementById("banking-select-output");
  widget?.addEventListener("bank-account-select", (event) => {
    const { accountId } = (event as CustomEvent<{ accountId: string }>).detail;
    if (output && accountId) {
      output.innerHTML = `<code>bank-account-select</code> → <strong>${accountId.slice(0, 8)}…</strong>`;
    }
    if (accountId) showAppView?.("bank-account-detail", { bankAccountId: accountId, reload: true });
  });
}

function wireBankingNavigation() {
  document.getElementById("bank-account-detail-back")?.addEventListener("click", () => {
    showAppView?.("banking", { reload: false });
  });

  document.getElementById("bank-account-detail")?.addEventListener("transaction-select", (event) => {
    const { transactionId } = (event as CustomEvent<{ transactionId: string }>).detail;
    const accountId = parseRoute().bankAccountId;
    if (!transactionId) return;
    showAppView?.("transaction-detail", {
      transactionId,
      bankAccountId: accountId,
      reload: true,
    });
  });

  document.getElementById("transaction-detail-back")?.addEventListener("click", () => {
    const route = parseRoute();
    if (route.bankAccountId) {
      showAppView?.("bank-account-detail", {
        bankAccountId: route.bankAccountId,
        inbox: route.inbox,
        reload: true,
      });
      return;
    }
    showAppView?.("transactions", { reload: false });
  });

  document.getElementById("transaction-match-sheet")?.addEventListener("transaction-matched", () => {
    void (document.querySelector("#transaction-detail") as RefreshableElement | null)?.refresh?.();
    void (document.querySelector("#transaction-match-sheet") as RefreshableElement | null)?.refresh?.();
    void (document.querySelector("#transaction-inbox-widget") as RefreshableElement | null)?.refresh?.();
    void (document.querySelector("#bank-account-detail") as RefreshableElement | null)?.refresh?.();
  });

  document.getElementById("transaction-detail")?.addEventListener("transaction-excluded", () => {
    void (document.querySelector("#transaction-inbox-widget") as RefreshableElement | null)?.refresh?.();
    void (document.querySelector("#bank-account-detail") as RefreshableElement | null)?.refresh?.();
  });

  document.getElementById("transaction-detail")?.addEventListener("transaction-restored", () => {
    void (document.querySelector("#transaction-inbox-widget") as RefreshableElement | null)?.refresh?.();
    void (document.querySelector("#bank-account-detail") as RefreshableElement | null)?.refresh?.();
  });
}

async function refreshAllEmbedWidgets(): Promise<void> {
  await refreshView("accounts");
  await refreshView("journals");
  await refreshView("journal-detail");
  document.querySelector("paprel-account-select")?.requestUpdate?.();
  document.querySelector("paprel-journal-editor")?.requestUpdate?.();
  document.querySelector("paprel-journal-detail")?.requestUpdate?.();
}

function wireLocaleSelect() {
  const select = document.getElementById("locale-select") as HTMLSelectElement | null;
  select?.addEventListener("change", async () => {
    const locale = select.value as EmbedLocale;
    activeLocale = locale;
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    setEmbedLocale(locale);
    await refreshAllEmbedWidgets();
  });
}

type RefreshableElement = HTMLElement & { refresh?: () => Promise<void> };

async function refreshView(id: ViewId): Promise<void> {
  if (id === "accounts") {
    await (document.querySelector("#coa-widget") as RefreshableElement | null)?.refresh?.();
    return;
  }
  if (id === "journals") {
    await (document.querySelector("#journal-list") as RefreshableElement | null)?.refresh?.();
    return;
  }
  if (id === "journal-detail") {
    await (document.querySelector("#journal-detail") as RefreshableElement | null)?.refresh?.();
    return;
  }
  if (id === "trial-balance") {
    await (document.querySelector("#trial-balance-widget") as RefreshableElement | null)?.refresh?.();
    return;
  }
  if (id === "balance-sheet") {
    await (document.querySelector("#balance-sheet-widget") as RefreshableElement | null)?.refresh?.();
    return;
  }
  if (id === "income-statement") {
    await (document.querySelector("#income-statement-widget") as RefreshableElement | null)?.refresh?.();
    return;
  }
  if (id === "cash-flow") {
    await (document.querySelector("#cash-flow-widget") as RefreshableElement | null)?.refresh?.();
    return;
  }
  if (id === "general-ledger") {
    await (document.querySelector("#general-ledger-widget") as RefreshableElement | null)?.refresh?.();
    return;
  }
  if (id === "banking") {
    await (document.querySelector("#banking-list-widget") as RefreshableElement | null)?.refresh?.();
    return;
  }
  if (id === "transactions") {
    await (document.querySelector("#transaction-inbox-widget") as RefreshableElement | null)?.refresh?.();
    return;
  }
  if (id === "bank-account-detail") {
    await (document.querySelector("#bank-account-detail") as RefreshableElement | null)?.refresh?.();
    return;
  }
  if (id === "transaction-detail") {
    await (document.querySelector("#transaction-detail") as RefreshableElement | null)?.refresh?.();
    await (document.querySelector("#transaction-match-sheet") as RefreshableElement | null)?.refresh?.();
    return;
  }
  if (id === "reconciliations") {
    await (document.querySelector("#reconciliation-list-widget") as RefreshableElement | null)?.refresh?.();
    return;
  }
  if (id === "reconciliation-detail") {
    await (document.querySelector("#reconciliation-detail") as RefreshableElement | null)?.refresh?.();
  }
}

function applyJournalDetail(journalId?: string): void {
  const journalDetail = document.getElementById("journal-detail");
  if (!journalDetail) return;
  if (!journalId) {
    journalDetail.removeAttribute("journal-id");
    return;
  }
  journalDetail.setAttribute("journal-id", journalId);
}

function applyJournalEditor(journalId?: string, editorMode: JournalEditorMode = "create"): void {
  const editor =
    editorMode === "create"
      ? (document.getElementById("journal-editor-new") as HTMLElement | null)
      : (document.getElementById("journal-editor-edit") as HTMLElement | null);
  if (!editor) return;

  if (!journalId || editorMode === "create") {
    editor.removeAttribute("journal-id");
    editor.setAttribute("mode", "create");
    if (editorMode === "create") editor.setAttribute("currency", "USD");
    return;
  }

  editor.setAttribute("journal-id", journalId);
  editor.setAttribute("mode", editorMode);
}

function wireNavigation() {
  const buttons = document.querySelectorAll<HTMLButtonElement>("[data-nav]");
  const views = document.querySelectorAll<HTMLElement>("[data-view]");
  const title = document.getElementById("view-title");
  const subtitle = document.getElementById("view-subtitle");
  const tagLine = document.getElementById("view-tag");
  const refreshBtn = document.getElementById("refresh-view");
  let currentView: ViewId = DEFAULT_VIEW;

  function showView(
    id: ViewId,
    options: {
      reload?: boolean;
      journalId?: string;
      editorMode?: JournalEditorMode;
      bankAccountId?: string;
      transactionId?: string;
      reconciliationId?: string;
      inbox?: TransactionInbox;
      syncUrl?: boolean;
    } = {},
  ): void {
    const {
      reload = false,
      journalId,
      editorMode,
      bankAccountId,
      transactionId,
      reconciliationId,
      inbox,
      syncUrl = true,
    } = options;
    currentView = id;

    for (const btn of buttons) {
      const nav = btn.dataset.nav as ViewId | undefined;
      const active =
        nav === id ||
        (id === "journal-detail" && nav === "journals") ||
        (id === "journal-edit" && nav === "journal-new") ||
        (id === "bank-account-detail" && nav === "banking") ||
        (id === "transaction-detail" && nav === "transactions") ||
        (id === "reconciliation-detail" && nav === "reconciliations");
      btn.setAttribute("aria-current", active ? "page" : "false");
    }
    for (const view of views) {
      view.classList.toggle("is-active", view.dataset.view === id);
    }

    const meta = VIEW_META[id];
    if (title) title.textContent = meta.title;
    if (subtitle) subtitle.textContent = meta.intro;
    if (tagLine) tagLine.textContent = meta.subtitle;

    if (id === "journal-detail") {
      applyJournalDetail(journalId ?? parseRoute().journalId);
    }
    if (id === "journal-new") {
      applyJournalEditor(undefined, "create");
    }
    if (id === "journal-edit") {
      const route = parseRoute();
      applyJournalEditor(journalId ?? route.journalId, editorMode ?? route.editorMode ?? "edit");
    }
    if (id === "bank-account-detail") {
      const route = parseRoute();
      applyBankAccountDetail(bankAccountId ?? route.bankAccountId, inbox ?? route.inbox);
    }
    if (id === "transaction-detail") {
      const route = parseRoute();
      applyTransactionDetail(transactionId ?? route.transactionId);
    }
    if (id === "reconciliations" || id === "reconciliation-detail") {
      const route = parseRoute();
      applyReconciliationBankAccount(bankAccountId ?? route.bankAccountId);
    }
    if (id === "reconciliation-detail") {
      const route = parseRoute();
      applyReconciliationDetail(reconciliationId ?? route.reconciliationId);
    }

    if (syncUrl) {
      const route = parseRoute();
      const routeJournalId =
        id === "journal-detail" || id === "journal-edit" ? (journalId ?? route.journalId) : undefined;
      pushRoute({
        view: id,
        journalId: routeJournalId,
        editorMode: id === "journal-edit" ? (editorMode ?? route.editorMode ?? "edit") : undefined,
        bankAccountId:
          id === "bank-account-detail" ||
          id === "transaction-detail" ||
          id === "reconciliations" ||
          id === "reconciliation-detail"
            ? (bankAccountId ?? route.bankAccountId)
            : undefined,
        transactionId: id === "transaction-detail" ? (transactionId ?? route.transactionId) : undefined,
        reconciliationId:
          id === "reconciliation-detail" ? (reconciliationId ?? route.reconciliationId) : undefined,
        inbox: id === "bank-account-detail" ? (inbox ?? route.inbox) : undefined,
      });
    }

    if (reload) void refreshView(id);
  }

  for (const btn of buttons) {
    btn.addEventListener("click", () => {
      const id = btn.dataset.nav as ViewId | undefined;
      if (!id) return;
      showView(id, { reload: id === "accounts" || id === "journals" });
    });
  }

  refreshBtn?.addEventListener("click", () => {
    void refreshView(currentView);
  });

  const initialHash = location.hash.replace(/^#\/?/, "").trim();
  if (!initialHash) {
    replaceRoute({ view: DEFAULT_VIEW });
    showView(DEFAULT_VIEW, { reload: true, syncUrl: false });
  } else {
    const initial = parseRoute();
    showView(initial.view, {
      journalId: initial.journalId,
      editorMode: initial.editorMode,
      bankAccountId: initial.bankAccountId,
      transactionId: initial.transactionId,
      reconciliationId: initial.reconciliationId,
      inbox: initial.inbox,
      reload: true,
      syncUrl: false,
    });
  }

  onRouteChange((route) => {
    showView(route.view, {
      journalId: route.journalId,
      editorMode: route.editorMode,
      bankAccountId: route.bankAccountId,
      transactionId: route.transactionId,
      reconciliationId: route.reconciliationId,
      inbox: route.inbox,
      syncUrl: false,
    });
  });

  showAppView = showView;
}

function wireJournalSelection() {
  const journalList = document.getElementById("journal-list");
  const backBtn = document.getElementById("journal-detail-back");
  const editBackBtn = document.getElementById("journal-edit-back");
  const journalDetail = document.getElementById("journal-detail");

  journalList?.addEventListener("journal-select", (event) => {
    const { journalId } = (event as CustomEvent<{ journalId: string }>).detail;
    if (!journalId) return;
    showAppView?.("journal-detail", { journalId, reload: true });
  });

  journalList?.addEventListener("journal-action", (event) => {
    const { action, journalId } = (event as CustomEvent<{ action: string; journalId: string }>).detail;
    if (!journalId || action !== "edit") return;
    showAppView?.("journal-edit", { journalId, editorMode: "edit", reload: false });
  });

  journalDetail?.addEventListener("journal-action", (event) => {
    const { action, journalId } = (event as CustomEvent<{ action: string; journalId: string }>).detail;
    if (!journalId) return;
    if (action === "edit" || action === "copy" || action === "reverse") {
      showAppView?.("journal-edit", { journalId, editorMode: action, reload: false });
    }
  });

  journalDetail?.addEventListener("journal-deleted", () => {
    showAppView?.("journals", { reload: true });
  });

  journalDetail?.addEventListener("journal-voided", () => {
    void (document.querySelector("#journal-detail") as RefreshableElement | null)?.refresh?.();
    void (document.querySelector("#journal-list") as RefreshableElement | null)?.refresh?.();
  });

  document.getElementById("journal-editor-new")?.addEventListener("journal-saved", (event) => {
    const { journal } = (event as CustomEvent<{ journal: { id?: string } }>).detail;
    if (journal?.id) showAppView?.("journal-detail", { journalId: journal.id, reload: true });
  });

  document.getElementById("journal-editor-edit")?.addEventListener("journal-saved", (event) => {
    const { journal } = (event as CustomEvent<{ journal: { id?: string } }>).detail;
    if (journal?.id) showAppView?.("journal-detail", { journalId: journal.id, reload: true });
  });

  document.getElementById("account-form-demo")?.addEventListener("account-saved", () => {
    void (document.querySelector("#coa-widget") as RefreshableElement | null)?.refresh?.();
  });

  backBtn?.addEventListener("click", () => {
    showAppView?.("journals", { reload: false });
  });

  editBackBtn?.addEventListener("click", () => {
    const journalId = parseRoute().journalId;
    if (journalId) showAppView?.("journal-detail", { journalId, reload: true });
    else showAppView?.("journals", { reload: false });
  });
}

function wireAccountSelectDemo() {
  const demo = document.getElementById("account-select-demo");
  const output = document.getElementById("account-select-output");
  demo?.addEventListener("account-change", (event) => {
    const { accountId } = (event as CustomEvent<{ accountId: string }>).detail;
    if (output && accountId) {
      output.innerHTML = `<code>account-change</code> → <strong>${accountId.slice(0, 8)}…</strong> (see trigger for name + type)`;
    }
  });
}

function wireCoaToggle() {
  const toggle = document.getElementById("coa-tree-toggle") as HTMLInputElement | null;
  const widget = document.getElementById("coa-widget");
  toggle?.addEventListener("change", () => {
    if (!widget) return;
    if (toggle.checked) widget.setAttribute("tree", "");
    else widget.removeAttribute("tree");
  });
}

async function bootstrap() {
  setStatus("Exchanging App Connect token…", "loading");

  try {
    const first = await fetchEmbedTokensWithRetry();
    applySessionMeta(first);

    configureAccounting({
      baseUrl,
      cacheTtlMs: 0,
      locale: activeLocale,
      auth: {
        partnerDomain,
        getTokens: fetchEmbedTokensWithRetry,
        onTokensUpdated(tokens) {
          if (tokens.companyId) sessionMeta.companyId = tokens.companyId;
          if (tokens.expiresAt) {
            sessionMeta.expiresIn = Math.max(0, Math.round((tokens.expiresAt - Date.now()) / 1000));
          }
          applySessionMeta(sessionMeta);
        },
        onSessionExpired() {
          void recoverSession();
        },
      },
    });

    mountAppShell();
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Startup failed", "error");
    console.error(err);
  }
}

void bootstrap();
