import "@paprel/embed-accounting";
import "@paprel/embed-reports";
import type { PaprelResourceOpenDetail, PaprelViewChangeDetail } from "@paprel/embed-core";
import { useEffect, useRef } from "react";
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { EmbedElement } from "./lib/embed-element";
import { SessionProvider, useSession } from "./session/SessionContext";

const pageTitles: Array<[string, string]> = [
  ["/accounts/new", "New account"], ["/accounts/", "Account detail"], ["/accounts", "Chart of Accounts"],
  ["/journals/new", "New journal"], ["/journals/", "Journal detail"], ["/journals", "Journals"],
  ["/reports", "Reports"], ["/banking/", "Bank account detail"], ["/banking", "Banking"],
  ["/transactions/", "Transaction detail"], ["/transactions", "Transactions"], ["/transaction-locks", "Transaction locks"],
];

function titleFor(pathname: string): string {
  if (/^\/accounts\/[^/]+\/edit$/.test(pathname)) return "Edit account";
  const journalMode = pathname.match(/^\/journals\/[^/]+\/(edit|copy|reverse)$/)?.[1];
  if (journalMode) return `${journalMode[0].toUpperCase()}${journalMode.slice(1)} journal`;
  return pageTitles.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix))?.[1] ?? "Accounting";
}

function collectionProps(component: string, params: URLSearchParams): Record<string, unknown> {
  const prefix = component === "paprel-journal-list" ? "journals" : "transactions";
  return {
    page: Number(params.get(`${prefix}.page`) ?? 1),
    "page-size": Number(params.get(`${prefix}.pageSize`) ?? 25),
    search: params.get(`${prefix}.search`) ?? "",
    ...(component === "paprel-transaction-inbox" ? { inbox: params.get(`${prefix}.tab`) ?? "uncategorized" } : {}),
  };
}

function HostShell() {
  const session = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const surface = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = surface.current;
    if (!root) return;
    const resourceOpen = (event: Event) => {
      const custom = event as CustomEvent<PaprelResourceOpenDetail>;
      const { resource, id } = custom.detail;
      const target = resource === "account" ? `/accounts/${id}`
        : resource === "journal" ? `/journals/${id}`
        : resource === "bank-account" ? `/banking/${id}`
        : resource === "transaction" ? `/transactions/${id}` : null;
      if (target) { custom.preventDefault(); navigate(target); }
    };
    const viewChange = (event: Event) => {
      const { source, state } = (event as CustomEvent<PaprelViewChangeDetail>).detail;
      const prefix = source.component === "paprel-journal-list" ? "journals" : source.component === "paprel-transaction-inbox" ? "transactions" : "";
      if (!prefix) return;
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(state)) {
        const name = `${prefix}.${key}`;
        if (value == null || value === "" || value === false) next.delete(name);
        else next.set(name, Array.isArray(value) ? value.join(",") : String(value));
      }
      setSearchParams(next, { replace: true });
    };
    const accountAction = () => navigate(`${location.pathname}/edit`);
    const accountSaved = (event: Event) => {
      const id = String((event as CustomEvent<{ account: { id?: string } }>).detail.account.id ?? "");
      navigate(id ? `/accounts/${id}` : "/accounts");
    };
    const journalAction = (event: Event) => {
      const detail = (event as CustomEvent<{ action: string; journalId: string }>).detail;
      navigate(`/journals/${detail.journalId}/${detail.action}`);
    };
    const journalSaved = (event: Event) => {
      const id = String((event as CustomEvent<{ journal: { id?: string } }>).detail.journal.id ?? "");
      navigate(id ? `/journals/${id}` : "/journals");
    };
    const journalDeleted = () => navigate("/journals");
    root.addEventListener("paprel:resource-open", resourceOpen);
    root.addEventListener("paprel:view-change", viewChange);
    root.addEventListener("account-action", accountAction);
    root.addEventListener("account-saved", accountSaved);
    root.addEventListener("journal-action", journalAction);
    root.addEventListener("journal-saved", journalSaved);
    root.addEventListener("journal-deleted", journalDeleted);
    return () => {
      root.removeEventListener("paprel:resource-open", resourceOpen);
      root.removeEventListener("paprel:view-change", viewChange);
      root.removeEventListener("account-action", accountAction);
      root.removeEventListener("account-saved", accountSaved);
      root.removeEventListener("journal-action", journalAction);
      root.removeEventListener("journal-saved", journalSaved);
      root.removeEventListener("journal-deleted", journalDeleted);
    };
  }, [location.pathname, navigate, searchParams, setSearchParams]);

  return <div className="app-shell">
    <Sidebar />
    <main className="workspace">
      <header className="topbar"><div><p className="eyebrow">Real-estate accounting</p><h1>{titleFor(location.pathname)}</h1></div></header>
      {!session.ready && !session.error && <div className="boot-card inline"><p className="eyebrow">Paprel connection</p><h2>Opening the property ledger</h2><p>Exchanging an App Connect token securely…</p></div>}
      {session.error && <div className="boot-card inline error"><p className="eyebrow">Connection failed</p><h2>Unable to open this company</h2><p>{session.error}</p></div>}
      {session.ready && <section ref={surface} className="embed-surface"><AppRoutes searchParams={searchParams} /></section>}
    </main>
  </div>;
}

function AppRoutes({ searchParams }: { searchParams: URLSearchParams }) {
  return <Routes>
    <Route path="/" element={<Navigate to="/accounts" replace />} />
    <Route path="/accounts" element={<><PageActions text="Property income, deposits, liabilities, and operating costs." to="/accounts/new" label="New portfolio account" /><EmbedElement tag="paprel-chart-of-accounts" /></>} />
    <Route path="/accounts/new" element={<><Back to="/accounts" /><EmbedElement tag="paprel-account-form" currency="USD" /></>} />
    <Route path="/accounts/:id" element={<AccountDetail />} />
    <Route path="/accounts/:id/edit" element={<AccountEditor />} />
    <Route path="/journals" element={<><PageActions text="Review rent, fees, repairs, deposits, and adjustments." to="/journals/new" label="New property journal" /><EmbedElement tag="paprel-journal-list" {...collectionProps("paprel-journal-list", searchParams)} /></>} />
    <Route path="/journals/new" element={<><Back to="/journals" /><EmbedElement tag="paprel-journal-editor" mode="create" currency="USD" /></>} />
    <Route path="/journals/:id" element={<JournalDetail />} />
    <Route path="/journals/:id/:mode" element={<JournalEditor />} />
    <Route path="/reports/*" element={<Reports />} />
    <Route path="/banking" element={<EmbedElement tag="paprel-banking-list" />} />
    <Route path="/banking/:id" element={<BankDetail />} />
    <Route path="/transactions" element={<EmbedElement tag="paprel-transaction-inbox" {...collectionProps("paprel-transaction-inbox", searchParams)} />} />
    <Route path="/transactions/:id" element={<TransactionDetail />} />
    <Route path="/transaction-locks" element={<EmbedElement tag="paprel-transaction-locks" page={1} page-size={25} />} />
    <Route path="*" element={<Navigate to="/accounts" replace />} />
  </Routes>;
}

function Back({ to }: { to: string }) { return <div className="view-actions"><NavLink className="back-link" to={to}>← Back</NavLink></div>; }
function PageActions({ text, to, label }: { text: string; to: string; label: string }) { return <div className="view-actions"><span>{text}</span><NavLink className="action-link" to={to}>{label}</NavLink></div>; }
function AccountDetail() { const { id = "" } = useParams(); return <><Back to="/accounts" /><EmbedElement tag="paprel-account-detail" account-id={id} /></>; }
function AccountEditor() { const { id = "" } = useParams(); return <><Back to={`/accounts/${id}`} /><EmbedElement tag="paprel-account-form" account-id={id} currency="USD" /></>; }
function JournalDetail() { const { id = "" } = useParams(); return <><Back to="/journals" /><EmbedElement tag="paprel-journal-detail" journal-id={id} /></>; }
function JournalEditor() { const { id = "", mode = "edit" } = useParams(); return <><Back to={`/journals/${id}`} /><EmbedElement tag="paprel-journal-editor" journal-id={id} mode={mode} currency="USD" /></>; }
function BankDetail() { const { id = "" } = useParams(); return <><Back to="/banking" /><EmbedElement tag="paprel-bank-account-detail" account-id={id} /></>; }
function TransactionDetail() { const { id = "" } = useParams(); return <><Back to="/transactions" /><EmbedElement tag="paprel-transaction-detail" transaction-id={id} /></>; }

function Reports() {
  const location = useLocation();
  const report = location.pathname.split("/")[2] || "trial-balance";
  const reports = [["trial-balance", "Trial balance"], ["balance-sheet", "Balance sheet"], ["income-statement", "Income statement"], ["cash-flow", "Cash flow"], ["general-ledger", "General ledger"]];
  return <><div className="report-tabs">{reports.map(([id, label]) => <NavLink key={id} to={`/reports/${id}`} className={report === id ? "is-active" : ""}>{label}</NavLink>)}</div><div className="report-stack"><EmbedElement tag={`paprel-${report}`} /></div></>;
}

export function App() { return <SessionProvider><HostShell /></SessionProvider>; }
