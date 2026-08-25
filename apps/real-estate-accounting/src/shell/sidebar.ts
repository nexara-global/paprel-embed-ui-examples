import type { Router } from "../router";
import type { SessionManager, SessionState } from "../session/session-manager";

const navigation = [
  ["/accounts", "Chart of Accounts", "Property ledger structure"], ["/journals", "Journals", "Rent, costs and adjustments"],
  ["/reports", "Reports", "Portfolio performance"], ["/banking", "Banking", "Operating and deposit accounts"],
  ["/transactions", "Transactions", "Categorize property activity"], ["/transaction-locks", "Transaction locks", "Protect closed periods"],
] as const;

export function createSidebar(session: SessionManager, router: Router): HTMLElement {
  const aside = document.createElement("aside");
  aside.className = "sidebar";
  aside.innerHTML = `<div class="identity"><span class="brand-mark">H</span><label class="entity-switcher"><span>Portfolio company</span><select data-entity></select></label></div><nav aria-label="Property accounting"></nav><div class="sidebar-footer"><div class="connected-card" aria-label="Paprel connection"><div class="company-context"><span class="company-mark" data-company-mark>P</span><div class="company-copy"><span class="company-label"><i></i>Paprel connected</span><strong data-company-name>Connected company</strong><small data-currency>Authenticated entity</small></div><div class="company-id" data-company-id-wrap hidden><span>Company ID</span><code data-company-id></code></div></div><div class="connection-footer"><div class="connection-copy"><strong>Session active</strong><span data-expiry>Auto-renews</span></div><button class="refresh-button" data-refresh>Refresh</button></div></div></div>`;
  const nav = aside.querySelector("nav")!;
  for (const [to, label, hint] of navigation) {
    const link = document.createElement("a");
    link.href = to; link.dataset.route = ""; link.className = "nav-item";
    link.innerHTML = `<span>${label}</span><small>${hint}</small>`;
    nav.append(link);
  }
  const select = aside.querySelector<HTMLSelectElement>("[data-entity]")!;
  select.addEventListener("change", async () => { await session.switchEntity(select.value); router.navigate("/accounts"); });
  aside.querySelector<HTMLButtonElement>("[data-refresh]")!.addEventListener("click", () => void session.refresh());
  session.subscribe((state) => updateSidebar(aside, state));
  router.subscribe(({ path }) => aside.querySelectorAll<HTMLAnchorElement>(".nav-item").forEach((link) => link.classList.toggle("is-active", path === link.pathname || path.startsWith(`${link.pathname}/`))));
  return aside;
}

function updateSidebar(aside: HTMLElement, state: Readonly<SessionState>): void {
  const select = aside.querySelector<HTMLSelectElement>("[data-entity]")!;
  if (!select.options.length) state.entityOptions.forEach((entity) => select.add(new Option(entity.label, entity.id)));
  select.value = state.entity.id; select.disabled = !state.ready;
  const name = state.company?.name || "Connected company";
  aside.querySelector("[data-company-mark]")!.textContent = name.slice(0, 1).toUpperCase();
  aside.querySelector("[data-company-name]")!.textContent = name;
  aside.querySelector("[data-currency]")!.textContent = state.company?.currency || "Authenticated entity";
  const idWrap = aside.querySelector<HTMLElement>("[data-company-id-wrap]")!;
  idWrap.hidden = !state.company?.id;
  aside.querySelector("[data-company-id]")!.textContent = state.company?.id || "";
  const minutes = state.expiresAt ? Math.max(1, Math.round((state.expiresAt - Date.now()) / 60_000)) : 0;
  aside.querySelector("[data-expiry]")!.textContent = minutes ? `Auto-renews · ${minutes}m` : "Auto-renews";
  const refresh = aside.querySelector<HTMLButtonElement>("[data-refresh]")!;
  refresh.disabled = state.refreshing; refresh.textContent = state.refreshing ? "Refreshing…" : "Refresh";
}
