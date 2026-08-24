export type ViewId =
  | "accounts"
  | "account-select"
  | "account-form"
  | "banking"
  | "journals"
  | "journal-detail"
  | "journal-new"
  | "journal-edit"
  | "trial-balance"
  | "balance-sheet"
  | "income-statement"
  | "cash-flow"
  | "general-ledger"
  | "transactions"
  | "bank-account-detail"
  | "transaction-detail"
  | "reconciliations"
  | "reconciliation-detail";

export const DEFAULT_VIEW: ViewId = "accounts";

const VIEW_IDS = new Set<ViewId>([
  "accounts",
  "account-select",
  "account-form",
  "banking",
  "journals",
  "journal-detail",
  "journal-new",
  "journal-edit",
  "trial-balance",
  "balance-sheet",
  "income-statement",
  "cash-flow",
  "general-ledger",
  "transactions",
  "bank-account-detail",
  "transaction-detail",
  "reconciliations",
  "reconciliation-detail",
]);

export type JournalEditorMode = "create" | "edit" | "copy" | "reverse";

export function isViewId(value: string | undefined): value is ViewId {
  return !!value && VIEW_IDS.has(value as ViewId);
}

export type ViewMeta = {
  title: string;
  subtitle: string;
  intro: string;
};

export const VIEW_META: Record<ViewId, ViewMeta> = {
  accounts: {
    title: "Chart of accounts",
    subtitle: "paprel-chart-of-accounts",
    intro: "Drop the COA grid into any page after configureAccounting. Toggle tree to try the nested hierarchy layout.",
  },
  "account-select": {
    title: "Account picker",
    subtitle: "paprel-account-select",
    intro: "Searchable combobox grouped by type · subtype. Fires account-change with the selected account id.",
  },
  "account-form": {
    title: "Account form",
    subtitle: "paprel-account-form",
    intro: "Create or edit GL accounts. Set account-id for edit mode. Requires account-add/edit scopes.",
  },
  journals: {
    title: "Journals",
    subtitle: "paprel-journal-list",
    intro: "Paginated journal table. Row click fires journal-select — route to a detail page in your app shell.",
  },
  "journal-detail": {
    title: "Journal detail",
    subtitle: "paprel-journal-detail",
    intro: "Read-only journal header and lines on a dedicated route. Bind journal-id from your router or journal-select.",
  },
  "journal-new": {
    title: "New journal",
    subtitle: "paprel-journal-editor",
    intro: "Manual journal composer with balanced lines. Requires journal-add scope on your App Connect client.",
  },
  "journal-edit": {
    title: "Edit journal",
    subtitle: "paprel-journal-editor",
    intro: "Edit, copy, or reverse an existing journal. Set mode attribute to edit, copy, or reverse.",
  },
  "trial-balance": {
    title: "Trial balance",
    subtitle: "paprel-trial-balance",
    intro: "As-of trial balance report. Requires report:trial-balance scope on your App Connect client.",
  },
  "balance-sheet": {
    title: "Balance sheet",
    subtitle: "paprel-balance-sheet",
    intro: "Assets, liabilities, and equity as of a date. Requires report scope for balance sheet.",
  },
  "income-statement": {
    title: "Income statement",
    subtitle: "paprel-income-statement",
    intro: "Revenue and expense sections for a date range with net income footer.",
  },
  "cash-flow": {
    title: "Cash flow",
    subtitle: "paprel-cash-flow",
    intro: "Summary cash inflow, outflow, and net cash flow for a date range.",
  },
  "general-ledger": {
    title: "General ledger",
    subtitle: "paprel-general-ledger",
    intro: "Per-account debit and credit totals for a date range. Requires report:general-ledger scope.",
  },
  banking: {
    title: "Banking",
    subtitle: "paprel-banking-list",
    intro: "Bank and credit card accounts with balances and uncategorized counts. Row click opens account detail.",
  },
  "bank-account-detail": {
    title: "Bank account",
    subtitle: "paprel-bank-account-detail",
    intro: "Account summary with inbox tabs. Bind account-id from your router or bank-account-select.",
  },
  transactions: {
    title: "Transactions",
    subtitle: "paprel-transaction-inbox",
    intro: "Uncategorized, categorized, and excluded bank transactions. Row click opens transaction detail.",
  },
  "transaction-detail": {
    title: "Transaction",
    subtitle: "paprel-transaction-detail",
    intro: "Read-only transaction profile with entity mappings. Bind transaction-id from transaction-select.",
  },
  reconciliations: {
    title: "Reconciliations",
    subtitle: "paprel-reconciliation-list",
    intro: "Bank reconciliation periods with draft/completed/voided filters. Row click opens reconciliation detail.",
  },
  "reconciliation-detail": {
    title: "Reconciliation",
    subtitle: "paprel-reconciliation-detail",
    intro: "Reconciliation workspace with balances and finalize/void actions. Bind reconciliation-id from reconciliation-select.",
  },
};
