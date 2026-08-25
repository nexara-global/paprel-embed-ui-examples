import { actionLink, embedElement } from "../paprel/elements";

type Match = { params: Record<string, string>; element: HTMLElement };

function view(...children: Array<Node | string>): HTMLElement {
  const fragment = document.createElement("div");
  fragment.className = "page-view";
  fragment.append(...children);
  return fragment;
}

function back(to: string, label = "Back"): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "view-actions";
  wrapper.append(actionLink(to, `← ${label}`, "back-link"));
  return wrapper;
}

function actions(text: string, to: string, label: string): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "view-actions";
  const copy = document.createElement("span");
  copy.textContent = text;
  wrapper.append(copy, actionLink(to, label, "action-link"));
  return wrapper;
}

function collectionProps(component: string, query: URLSearchParams): Record<string, string | number> {
  const prefix = component === "paprel-journal-list" ? "journals" : "transactions";
  return {
    page: Number(query.get(`${prefix}.page`) ?? 1), "page-size": Number(query.get(`${prefix}.pageSize`) ?? 25),
    search: query.get(`${prefix}.search`) ?? "",
    ...(component === "paprel-transaction-inbox" ? { inbox: query.get(`${prefix}.tab`) ?? "uncategorized" } : {}),
  };
}

function reports(report: string): HTMLElement {
  const wrapper = view();
  const tabs = document.createElement("div");
  tabs.className = "report-tabs";
  for (const [id, label] of [["trial-balance", "Trial balance"], ["balance-sheet", "Balance sheet"], ["income-statement", "Income statement"], ["cash-flow", "Cash flow"], ["general-ledger", "General ledger"]]) {
    const link = actionLink(`/reports/${id}`, label, report === id ? "is-active" : "");
    tabs.append(link);
  }
  const stack = document.createElement("div");
  stack.className = "report-stack";
  stack.append(embedElement(`paprel-${report}`));
  wrapper.append(tabs, stack);
  return wrapper;
}

export function renderPage(path: string, query: URLSearchParams): Match {
  let match: RegExpMatchArray | null;
  if (path === "/accounts") return { params: {}, element: view(actions("Property income, deposits, liabilities, and operating costs.", "/accounts/new", "New portfolio account"), embedElement("paprel-chart-of-accounts")) };
  if (path === "/accounts/new") return { params: {}, element: view(back("/accounts"), embedElement("paprel-account-form", { currency: "USD" })) };
  if ((match = path.match(/^\/accounts\/([^/]+)\/edit$/))) return { params: { id: match[1] }, element: view(back(`/accounts/${match[1]}`), embedElement("paprel-account-form", { "account-id": match[1], currency: "USD" })) };
  if ((match = path.match(/^\/accounts\/([^/]+)$/))) return { params: { id: match[1] }, element: view(back("/accounts", "Accounts"), embedElement("paprel-account-detail", { "account-id": match[1] })) };
  if (path === "/journals") return { params: {}, element: view(actions("Review rent, fees, repairs, deposits, and adjustments.", "/journals/new", "New property journal"), embedElement("paprel-journal-list", collectionProps("paprel-journal-list", query))) };
  if (path === "/journals/new") return { params: {}, element: view(back("/journals"), embedElement("paprel-journal-editor", { mode: "create", currency: "USD" })) };
  if ((match = path.match(/^\/journals\/([^/]+)\/(edit|copy|reverse)$/))) return { params: { id: match[1], mode: match[2] }, element: view(back(`/journals/${match[1]}`), embedElement("paprel-journal-editor", { "journal-id": match[1], mode: match[2], currency: "USD" })) };
  if ((match = path.match(/^\/journals\/([^/]+)$/))) return { params: { id: match[1] }, element: view(back("/journals", "Journals"), embedElement("paprel-journal-detail", { "journal-id": match[1] })) };
  if (path === "/reports") return { params: {}, element: reports("trial-balance") };
  if ((match = path.match(/^\/reports\/([^/]+)$/))) return { params: { report: match[1] }, element: reports(match[1]) };
  if (path === "/banking") return { params: {}, element: view(embedElement("paprel-banking-list")) };
  if ((match = path.match(/^\/banking\/([^/]+)$/))) return { params: { id: match[1] }, element: view(back("/banking"), embedElement("paprel-bank-account-detail", { "account-id": match[1] })) };
  if (path === "/transactions") return { params: {}, element: view(embedElement("paprel-transaction-inbox", collectionProps("paprel-transaction-inbox", query))) };
  if ((match = path.match(/^\/transactions\/([^/]+)$/))) return { params: { id: match[1] }, element: view(back("/transactions"), embedElement("paprel-transaction-detail", { "transaction-id": match[1] })) };
  if (path === "/transaction-locks") return { params: {}, element: view(embedElement("paprel-transaction-locks", { page: 1, "page-size": 25 })) };
  return { params: {}, element: view() };
}

export function titleFor(path: string): string {
  if (/^\/accounts\/[^/]+\/edit$/.test(path)) return "Edit account";
  const mode = path.match(/^\/journals\/[^/]+\/(edit|copy|reverse)$/)?.[1];
  if (mode) return `${mode[0].toUpperCase()}${mode.slice(1)} journal`;
  const titles: Array<[RegExp, string]> = [
    [/^\/accounts\/new$/, "New account"], [/^\/accounts\//, "Account detail"], [/^\/accounts$/, "Chart of Accounts"],
    [/^\/journals\/new$/, "New journal"], [/^\/journals\//, "Journal detail"], [/^\/journals$/, "Journals"],
    [/^\/reports/, "Reports"], [/^\/banking\//, "Bank account detail"], [/^\/banking$/, "Banking"],
    [/^\/transactions\//, "Transaction detail"], [/^\/transactions$/, "Transactions"], [/^\/transaction-locks$/, "Transaction locks"],
  ];
  return titles.find(([pattern]) => pattern.test(path))?.[1] ?? "Accounting";
}
