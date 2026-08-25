/**
 * Hash router for the sample app — #/view?journal=uuid survives refresh.
 */
import type { ViewId, JournalEditorMode } from "./views.js";
import { DEFAULT_VIEW, isViewId } from "./views.js";
import type { TransactionInbox } from "@paprel/embed-accounting";

export type SampleRoute = {
  view: ViewId;
  journalId?: string;
  editorMode?: JournalEditorMode;
  bankAccountId?: string;
  transactionId?: string;
  reconciliationId?: string;
  inbox?: TransactionInbox;
};

function parseInbox(value: string | null): TransactionInbox | undefined {
  if (value === "uncategorized" || value === "categorized" || value === "excluded") {
    return value;
  }
  return undefined;
}

export function parseRoute(): SampleRoute {
  const raw = location.hash.replace(/^#\/?/, "").trim();
  const [pathPart, queryPart] = raw.split("?");
  let view = isViewId(pathPart) ? pathPart : DEFAULT_VIEW;
  const query = queryPart ?? (raw.includes("=") ? "" : location.search.slice(1));
  const params = new URLSearchParams(query);
  const journalId = params.get("journal") ?? undefined;
  const bankAccountId = params.get("account") ?? undefined;
  const transactionId = params.get("transaction") ?? undefined;
  const reconciliationId = params.get("reconciliation") ?? undefined;
  const inbox = parseInbox(params.get("tab"));
  const editorModeRaw = params.get("mode");
  const editorMode =
    editorModeRaw === "edit" || editorModeRaw === "copy" || editorModeRaw === "reverse"
      ? editorModeRaw
      : undefined;

  if (view === "journals" && journalId) {
    view = "journal-detail";
  }

  if (view === "journal-detail" && !journalId) {
    view = "journals";
  }

  if (view === "journal-edit" && !journalId) {
    view = "journal-new";
  }

  if (view === "banking" && bankAccountId) {
    view = "bank-account-detail";
  }

  if (view === "bank-account-detail" && !bankAccountId) {
    view = "banking";
  }

  if (view === "transactions" && transactionId) {
    view = "transaction-detail";
  }

  if (view === "transaction-detail" && !transactionId) {
    view = "transactions";
  }

  if (view === "reconciliations" && reconciliationId) {
    view = "reconciliation-detail";
  }

  if (view === "reconciliation-detail" && !reconciliationId) {
    view = "reconciliations";
  }

  return {
    view,
    journalId: journalId || undefined,
    editorMode,
    bankAccountId: bankAccountId || undefined,
    transactionId: transactionId || undefined,
    reconciliationId: reconciliationId || undefined,
    inbox,
  };
}

export function routeToHash(route: SampleRoute): string {
  let hash = `#/${route.view}`;
  const params = new URLSearchParams();

  if (route.view === "journal-detail" && route.journalId) {
    params.set("journal", route.journalId);
  }
  if (route.view === "journal-edit" && route.journalId) {
    params.set("journal", route.journalId);
    if (route.editorMode && route.editorMode !== "create") {
      params.set("mode", route.editorMode);
    }
  }
  if (
    (route.view === "bank-account-detail" ||
      route.view === "transaction-detail" ||
      route.view === "reconciliations" ||
      route.view === "reconciliation-detail") &&
    route.bankAccountId
  ) {
    params.set("account", route.bankAccountId);
  }
  if (route.view === "bank-account-detail" && route.inbox && route.inbox !== "uncategorized") {
    params.set("tab", route.inbox);
  }
  if (route.view === "transaction-detail" && route.transactionId) {
    params.set("transaction", route.transactionId);
  }
  if (
    (route.view === "reconciliation-detail" || route.view === "reconciliations") &&
    route.reconciliationId
  ) {
    params.set("reconciliation", route.reconciliationId);
  }

  const query = params.toString();
  if (query) hash += `?${query}`;
  return hash;
}

export function replaceRoute(route: SampleRoute): void {
  const hash = routeToHash(route);
  if (location.hash !== hash) {
    history.replaceState(route, "", hash);
  }
}

export function pushRoute(route: SampleRoute): void {
  const hash = routeToHash(route);
  if (location.hash !== hash) {
    history.pushState(route, "", hash);
  }
}

export function onRouteChange(listener: (route: SampleRoute) => void): () => void {
  const handler = () => listener(parseRoute());
  window.addEventListener("hashchange", handler);
  window.addEventListener("popstate", handler);
  return () => {
    window.removeEventListener("hashchange", handler);
    window.removeEventListener("popstate", handler);
  };
}
