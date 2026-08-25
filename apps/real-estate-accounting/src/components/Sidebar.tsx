import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useSession } from "../session/SessionContext";

const navigation = [
  ["/accounts", "Chart of Accounts", "Property ledger structure"],
  ["/journals", "Journals", "Rent, costs and adjustments"],
  ["/reports", "Reports", "Portfolio performance"],
  ["/banking", "Banking", "Operating and deposit accounts"],
  ["/transactions", "Transactions", "Categorize property activity"],
  ["/transaction-locks", "Transaction locks", "Protect closed periods"],
] as const;

export function Sidebar() {
  const session = useSession();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const minutes = session.expiresAt ? Math.max(1, Math.round((session.expiresAt - Date.now()) / 60_000)) : 0;

  return <aside className="sidebar">
    <div className="identity">
      <span className="brand-mark">H</span>
      <label className="entity-switcher">
        <span>Portfolio company</span>
        <select value={session.entity.id} disabled={!session.ready} onChange={async (event) => {
          await session.switchEntity(event.target.value);
          navigate("/accounts");
        }}>
          {session.entityOptions.map((entity) => <option key={entity.id} value={entity.id}>{entity.label}</option>)}
        </select>
      </label>
    </div>
    <nav aria-label="Property accounting">
      {navigation.map(([to, label, hint]) => <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? " is-active" : ""}`}>
        <span>{label}</span><small>{hint}</small>
      </NavLink>)}
    </nav>
    <div className="sidebar-footer">
      <div className="connected-card" aria-label="Paprel connection">
        <div className="company-context">
          <span className="company-mark" aria-hidden="true">{(session.company?.name || "P").slice(0, 1).toUpperCase()}</span>
          <div className="company-copy">
            <span className="company-label"><i />Paprel connected</span>
            <strong>{session.company?.name || "Connected company"}</strong>
            <small>{session.company?.currency || "Authenticated entity"}</small>
          </div>
          {session.company?.id && <div className="company-id"><span>Company ID</span><code>{session.company.id}</code></div>}
        </div>
        <div className="connection-footer">
          <div className="connection-copy"><strong>Session active</strong><span>{minutes ? `Auto-renews · ${minutes}m` : "Auto-renews"}</span></div>
          <button className="refresh-button" disabled={refreshing} onClick={async () => {
            setRefreshing(true);
            try { await session.refresh(); } finally { setRefreshing(false); }
          }}>{refreshing ? "Refreshing…" : "Refresh"}</button>
        </div>
      </div>
    </div>
  </aside>;
}
