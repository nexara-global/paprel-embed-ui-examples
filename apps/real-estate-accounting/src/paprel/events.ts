import type { PaprelOperationSuccessDetail, PaprelResourceOpenDetail, PaprelViewChangeDetail } from "@paprel/embed-core";
import type { Router } from "../router";

type PaprelEventHandlers = {
  notify(message: string): void;
  openTransactionMatches(id: string): void;
  transactionResolved(): void;
};

export function connectPaprelEvents(root: HTMLElement, router: Router, handlers: PaprelEventHandlers): () => void {
  const resourceOpen = (event: Event) => {
    const custom = event as CustomEvent<PaprelResourceOpenDetail>;
    const { resource, id } = custom.detail;
    const target = resource === "account" ? `/accounts/${id}` : resource === "journal" ? `/journals/${id}`
      : resource === "bank-account" ? `/banking/${id}` : null;
    if (resource === "transaction") {
      custom.preventDefault();
      handlers.openTransactionMatches(id);
      return;
    }
    if (target) { custom.preventDefault(); router.navigate(target); }
  };
  const viewChange = (event: Event) => {
    const { source, state } = (event as CustomEvent<PaprelViewChangeDetail>).detail;
    const prefix = source.component === "paprel-journal-list" ? "journals" : source.component === "paprel-transaction-inbox" ? "transactions" : "";
    if (prefix) router.updateQuery(Object.fromEntries(Object.entries(state).map(([key, value]) => [`${prefix}.${key}`, value])));
  };
  const accountAction = () => router.navigate(`${window.location.pathname}/edit`);
  const accountSaved = (event: Event) => {
    const id = String((event as CustomEvent<{ account: { id?: string } }>).detail.account.id ?? "");
    router.navigate(id ? `/accounts/${id}` : "/accounts");
  };
  const journalAction = (event: Event) => {
    const { action, journalId } = (event as CustomEvent<{ action: string; journalId: string }>).detail;
    router.navigate(`/journals/${journalId}/${action}`);
  };
  const journalSaved = (event: Event) => {
    const id = String((event as CustomEvent<{ journal: { id?: string } }>).detail.journal.id ?? "");
    router.navigate(id ? `/journals/${id}` : "/journals");
  };
  const operationSuccess = (event: Event) => handlers.notify((event as CustomEvent<PaprelOperationSuccessDetail>).detail.message);
  const listeners: Array<[string, EventListener]> = [
    ["paprel:resource-open", resourceOpen as EventListener], ["paprel:view-change", viewChange as EventListener],
    ["paprel:operation-success", operationSuccess as EventListener],
    ["account-action", accountAction], ["account-saved", accountSaved as EventListener],
    ["journal-action", journalAction as EventListener], ["journal-saved", journalSaved as EventListener],
    ["journal-deleted", () => router.navigate("/journals")],
    ["transaction-matched", handlers.transactionResolved],
    ["transaction-excluded", handlers.transactionResolved],
    ["transaction-restored", handlers.transactionResolved],
  ];
  listeners.forEach(([name, listener]) => root.addEventListener(name, listener));
  return () => listeners.forEach(([name, listener]) => root.removeEventListener(name, listener));
}
