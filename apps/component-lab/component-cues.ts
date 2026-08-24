export type ComponentCue = {
  tag: string;
  description?: string;
  attrs?: string[];
  events?: string[];
  snippet?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function defaultSnippet(cue: ComponentCue): string {
  if (cue.snippet) return cue.snippet;
  const attrs = cue.attrs?.length ? ` ${cue.attrs.join(" ")}` : "";
  return `<${cue.tag}${attrs}></${cue.tag}>`;
}

function summaryHint(cue: ComponentCue): string {
  if (!cue.description) return "Integration reference";
  const oneLine = cue.description.replace(/\s+/g, " ").trim();
  return oneLine.length > 72 ? `${oneLine.slice(0, 69)}…` : oneLine;
}

/** DX panel above each embed widget — collapsed by default to keep the demo shell light. */
export function renderComponentCue(cue: ComponentCue): string {
  const snippet = defaultSnippet(cue);
  const meta: string[] = [];

  if (cue.attrs?.length) {
    meta.push(`<dt>Attributes</dt><dd>${cue.attrs.map((a) => `<code>${escapeHtml(a)}</code>`).join(" ")}</dd>`);
  }
  if (cue.events?.length) {
    meta.push(`<dt>Events</dt><dd>${cue.events.map((e) => `<code>${escapeHtml(e)}</code>`).join(" ")}</dd>`);
  }

  return `
    <details class="embed-cue">
      <summary class="embed-cue-summary">
        <span class="embed-cue-summary-main">
          <span class="embed-cue-label">Web component</span>
          <code class="embed-cue-tag">&lt;${escapeHtml(cue.tag)}&gt;</code>
          <span class="embed-cue-summary-hint">${escapeHtml(summaryHint(cue))}</span>
        </span>
        <button type="button" class="embed-cue-copy" data-copy="${escapeHtml(snippet)}" aria-label="Copy snippet">
          Copy
        </button>
      </summary>
      <div class="embed-cue-body">
        ${cue.description ? `<p class="embed-cue-desc">${escapeHtml(cue.description)}</p>` : ""}
        ${meta.length ? `<dl class="embed-cue-meta">${meta.join("")}</dl>` : ""}
        <pre class="embed-cue-snippet" aria-label="Usage snippet"><code>${escapeHtml(snippet)}</code></pre>
      </div>
    </details>
  `;
}

export function wireComponentCues(root: ParentNode = document): void {
  root.querySelectorAll<HTMLButtonElement>(".embed-cue-copy").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const text = btn.dataset.copy;
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        const prev = btn.textContent;
        btn.textContent = "Copied";
        btn.classList.add("is-copied");
        window.setTimeout(() => {
          btn.textContent = prev;
          btn.classList.remove("is-copied");
        }, 1400);
      } catch {
        btn.textContent = "Failed";
      }
    });
  });
}

export const COMPONENT_CUES = {
  chartOfAccounts: {
    tag: "paprel-chart-of-accounts",
    description: "Flat account grid by default (number, name, type, balance). Use tree for hierarchy; show-archived includes archived accounts.",
    attrs: ['tree (boolean)', 'show-archived (boolean)'],
    snippet: "<paprel-chart-of-accounts></paprel-chart-of-accounts>",
  },
  accountSelect: {
    tag: "paprel-account-select",
    description: "Searchable combobox grouped by type · subtype. Option value is account id.",
    attrs: ['value (string)', 'label (string)', 'compact (boolean — journal lines)'],
    events: ["account-change → detail.accountId"],
    snippet: '<paprel-account-select label="GL account"></paprel-account-select>',
  },
  accountForm: {
    tag: "paprel-account-form",
    description: "Create or edit a GL account. System-defined accounts are read-only.",
    attrs: ['currency (string)', 'account-id (string, edit mode)'],
    events: ["account-saved → detail.account"],
    snippet: '<paprel-account-form currency="USD"></paprel-account-form>',
  },
  trialBalance: {
    tag: "paprel-trial-balance",
    description: "Trial balance report with as-of date filter. Requires report:trial-balance scope.",
    attrs: ['as-of-date (YYYY-MM-DD)', 'currency (optional)'],
    snippet: '<paprel-trial-balance></paprel-trial-balance>',
  },
  balanceSheet: {
    tag: "paprel-balance-sheet",
    description: "Balance sheet with section/subtype/account rows and asset vs liability totals.",
    attrs: ['as-of-date (YYYY-MM-DD)', 'currency (optional)'],
    snippet: '<paprel-balance-sheet></paprel-balance-sheet>',
  },
  incomeStatement: {
    tag: "paprel-income-statement",
    description: "Income statement for a date range with net income footer.",
    attrs: ['date-range (YYYY-MM-DD,YYYY-MM-DD)', 'currency (optional)'],
    snippet: '<paprel-income-statement></paprel-income-statement>',
  },
  cashFlow: {
    tag: "paprel-cash-flow",
    description: "Cash flow summary cards for a date range.",
    attrs: ['date-range (YYYY-MM-DD,YYYY-MM-DD)', 'currency (optional)'],
    snippet: '<paprel-cash-flow></paprel-cash-flow>',
  },
  bankingList: {
    tag: "paprel-banking-list",
    description: "Bank/CC accounts with balance and uncategorized inbox count.",
    events: ["bank-account-select → detail.accountId"],
    snippet: '<paprel-banking-list></paprel-banking-list>',
  },
  generalLedger: {
    tag: "paprel-general-ledger",
    description: "General ledger summary by account for a date range.",
    attrs: ['date-range (YYYY-MM-DD,YYYY-MM-DD)', 'account-id (optional GL account)', 'currency (optional)'],
    snippet: '<paprel-general-ledger></paprel-general-ledger>',
  },
  transactionInbox: {
    tag: "paprel-transaction-inbox",
    description: "Bank transaction inbox with uncategorized / categorized / excluded tabs.",
    attrs: [
      'bank-account-id (optional filter)',
      'inbox (uncategorized | categorized | excluded)',
      'page (number)',
      'page-size (number)',
    ],
    events: ["transaction-select → detail.transactionId, detail.transaction"],
    snippet: '<paprel-transaction-inbox inbox="uncategorized"></paprel-transaction-inbox>',
  },
  bankAccountDetail: {
    tag: "paprel-bank-account-detail",
    description: "Bank account hub: balance, inbox counts, embedded transaction inbox.",
    attrs: ['account-id (required)', 'inbox (uncategorized | categorized | excluded)'],
    events: ["transaction-select → detail.transactionId, detail.transaction"],
    snippet: '<paprel-bank-account-detail account-id="…"></paprel-bank-account-detail>',
  },
  transactionDetail: {
    tag: "paprel-transaction-detail",
    description: "Read-only bank transaction with entity mapping table.",
    attrs: ['transaction-id (required)', 'show-actions (boolean, default true)'],
    events: ["transaction-excluded", "transaction-restored"],
    snippet: '<paprel-transaction-detail transaction-id="…"></paprel-transaction-detail>',
  },
  transactionMatchSheet: {
    tag: "paprel-transaction-match-sheet",
    description: "Suggested invoice/bill/expense matches with confirm-match action.",
    attrs: ['transaction-id (required)'],
    events: ["transaction-matched → detail.transactionId, detail.match"],
    snippet: '<paprel-transaction-match-sheet transaction-id="…"></paprel-transaction-match-sheet>',
  },
  reconciliationList: {
    tag: "paprel-reconciliation-list",
    description: "Reconciliation periods with draft/completed/voided status tabs.",
    attrs: [
      'bank-account-id (optional filter)',
      'status (all | draft | completed | voided)',
      'page (number)',
      'page-size (number)',
      'currency (optional)',
    ],
    events: ["reconciliation-select → detail.reconciliationId, detail.reconciliation"],
    snippet: '<paprel-reconciliation-list bank-account-id="…"></paprel-reconciliation-list>',
  },
  reconciliationForm: {
    tag: "paprel-reconciliation-form",
    description: "Create a draft reconciliation for a bank account.",
    attrs: ['bank-account-id (required)', 'currency (optional)'],
    events: ["reconciliation-created → detail.reconciliationId, detail.reconciliation"],
    snippet: '<paprel-reconciliation-form bank-account-id="…"></paprel-reconciliation-form>',
  },
  reconciliationDetail: {
    tag: "paprel-reconciliation-detail",
    description: "Reconciliation balances, lines, finalize (draft), and void (completed).",
    attrs: ['reconciliation-id (required)', 'currency (optional)', 'show-actions (boolean, default true)'],
    events: ["reconciliation-finalized", "reconciliation-voided → detail.reconciliationId"],
    snippet: '<paprel-reconciliation-detail reconciliation-id="…"></paprel-reconciliation-detail>',
  },
  journalList: {
    tag: "paprel-journal-list",
    description: "Paginated journal table with filters (manual, posted/draft, reference). Row click fires journal-select; edit button fires journal-action.",
    attrs: ['page (number, default 1)', 'page-size (number, default 25)'],
    events: ["journal-select → detail.journalId", "journal-action → detail.action, detail.journalId"],
    snippet: '<paprel-journal-list page="1" page-size="25"></paprel-journal-list>',
  },
  journalDetail: {
    tag: "paprel-journal-detail",
    description: "Read-only journal with action bar (edit, copy, reverse, void, delete). Void/delete run in-component; edit/copy/reverse emit journal-action.",
    attrs: ['journal-id (string, required)', 'show-actions (boolean, default true)'],
    events: [
      "journal-action → detail.action, detail.journalId",
      "journal-voided → detail.journalId",
      "journal-deleted → detail.journalId",
    ],
    snippet: '<paprel-journal-detail journal-id="…"></paprel-journal-detail>',
  },
  journalEditor: {
    tag: "paprel-journal-editor",
    description: "Create or edit a manual journal. mode=edit|copy|reverse with journal-id for existing entries.",
    attrs: ['currency (string)', 'journal-id (string)', 'mode (create | edit | copy | reverse)'],
    events: ["journal-saved → detail.journal"],
    snippet: '<paprel-journal-editor currency="USD" mode="create"></paprel-journal-editor>',
  },
} satisfies Record<string, ComponentCue>;
