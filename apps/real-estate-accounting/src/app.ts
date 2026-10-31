import "@paprel/embed-accounting";
import "@paprel/embed-reports";
import { connectPaprelEvents } from "./paprel/events";
import { embedElement } from "./paprel/elements";
import { renderPage, titleFor } from "./pages/pages";
import { Router } from "./router";
import { SessionManager, type SessionState } from "./session/session-manager";
import { createSidebar } from "./shell/sidebar";

export class App {
  private router = new Router();
  private session = new SessionManager();
  private workspace = document.createElement("main");
  private surface = document.createElement("section");
  private status: HTMLElement = document.createElement("div");
  private toast = document.createElement("div");
  private drawer = document.createElement("aside");
  private toastTimer?: number;
  private sessionView = "";
  private expiredBanner = document.createElement("div");

  constructor(private root: HTMLElement) {
    this.workspace.className = "workspace";
    this.surface.className = "embed-surface";
    this.status.className = "boot-card inline";
    this.toast.className = "success-toast";
    this.toast.setAttribute("role", "status");
    this.toast.hidden = true;
    this.drawer.className = "match-drawer";
    this.drawer.hidden = true;
    this.expiredBanner.className = "session-banner";
    this.expiredBanner.setAttribute("role", "alert");
    this.expiredBanner.hidden = true;
    const shell = document.createElement("div");
    shell.className = "app-shell";
    shell.append(createSidebar(this.session, this.router), this.workspace);
    this.root.replaceChildren(shell, this.drawer, this.toast);
    this.workspace.append(this.createHeader());
    connectPaprelEvents(this.root, this.router, {
      notify: (message) => this.showSuccess(message),
      openTransactionMatches: (id) => this.openMatchDrawer(id),
      transactionResolved: () => this.resolveTransaction(),
    });
    this.router.subscribe(({ path, query }) => this.renderRoute(path, query));
    this.session.subscribe((state) => this.renderSession(state));
  }

  async start(): Promise<void> { await this.session.start(); }

  private renderRoute(path: string, query: URLSearchParams): void {
    if (path === "/") { this.router.navigate("/accounts", true); return; }
    const { element } = renderPage(path, query, this.session.snapshot().company?.currency);
    if (!element.childNodes.length) { this.router.navigate("/accounts", true); return; }
    const header = this.workspace.querySelector<HTMLElement>(".topbar")!;
    header.querySelector(".header-action")?.remove();
    header.querySelector("h1")!.textContent = titleFor(path);
    const primaryAction = element.querySelector<HTMLElement>(".view-actions .action-link");
    if (primaryAction) {
      const actionRow = primaryAction.closest<HTMLElement>(".view-actions");
      const intro = actionRow?.querySelector<HTMLElement>("span");
      primaryAction.classList.add("header-action");
      header.append(primaryAction);
      if (intro) {
        intro.className = "page-intro";
        actionRow?.replaceWith(intro);
      } else {
        actionRow?.remove();
      }
    }
    this.surface.replaceChildren(element);
  }

  private renderSession(state: Readonly<SessionState>): void {
    this.renderExpiredBanner(state);
    // Renewal and refresh also publish state. Rebuilding the page for those would remount the
    // embedded components and throw away whatever the user has typed, so only rebuild when the
    // session actually opens, fails, or moves to another entity.
    const view = state.ready ? `ready:${state.entity.id}` : `pending:${state.entity.id}:${state.error}:${state.setup ? "setup" : ""}`;
    if (view === this.sessionView) return;
    this.sessionView = view;
    this.workspace.replaceChildren(this.createHeader());
    if (!state.ready) {
      if (state.setup) {
        this.status = this.createSetupGuide(state);
      } else {
        this.status.className = `boot-card inline${state.error ? " error" : ""}`;
        const eyebrow = document.createElement("p");
        eyebrow.className = "eyebrow";
        eyebrow.textContent = state.error ? "Connection failed" : "Paprel connection";
        const heading = document.createElement("h2");
        heading.textContent = state.error ? "Unable to open this company" : "Opening the property ledger";
        const detail = document.createElement("p");
        detail.textContent = state.error || "Exchanging an App Connect token securely…";
        this.status.replaceChildren(eyebrow, heading, detail);
      }
      this.workspace.append(this.status);
    } else {
      this.workspace.append(this.expiredBanner, this.surface);
      const route = this.router.current();
      this.renderRoute(route.path, route.query);
    }
  }

  private renderExpiredBanner(state: Readonly<SessionState>): void {
    this.expiredBanner.hidden = !state.expired;
    if (!state.expired) return;
    const message = document.createElement("span");
    message.textContent = state.error;
    const reconnect = document.createElement("button");
    reconnect.type = "button";
    reconnect.textContent = state.refreshing ? "Reconnecting…" : "Reconnect";
    reconnect.disabled = state.refreshing;
    reconnect.addEventListener("click", () => void this.session.refresh());
    this.expiredBanner.replaceChildren(message, reconnect);
  }

  private createSetupGuide(state: Readonly<SessionState>): HTMLElement {
    const guide = document.createElement("section");
    guide.className = "setup-guide";
    const required = state.setup?.required ?? [];
    guide.innerHTML = `<p class="eyebrow">Setup required</p><h2>Connect a Paprel company</h2><p>This example intentionally starts without demo credentials. Create a server-only environment file and add an App Connect client for <strong data-entity-label></strong>.</p><ol><li>Copy <code>apps/real-estate-accounting/.env.example</code> to <code>apps/real-estate-accounting/.env.local</code>.</li><li>Add the required server variables shown below.</li><li>Restart <code>npm run dev</code>.</li></ol><pre></pre><p class="setup-note">Never prefix client secrets with <code>VITE_</code> or expose them to browser code.</p>`;
    guide.querySelector("[data-entity-label]")!.textContent = state.entity.label;
    guide.querySelector("pre")!.textContent = required.map((key) => `${key}=`).join("\n");
    return guide;
  }

  private createHeader(): HTMLElement {
    const header = document.createElement("header");
    header.className = "topbar";
    const copy = document.createElement("div");
    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "Real-estate accounting";
    const heading = document.createElement("h1");
    heading.textContent = titleFor(window.location.pathname);
    copy.append(eyebrow, heading);
    header.append(copy);
    return header;
  }

  private showSuccess(message: string): void {
    window.clearTimeout(this.toastTimer);
    this.toast.textContent = message;
    this.toast.hidden = false;
    this.toastTimer = window.setTimeout(() => { this.toast.hidden = true; }, 4500);
  }

  private openMatchDrawer(transactionId: string): void {
    const header = document.createElement("header");
    const title = document.createElement("div");
    title.innerHTML = `<p class="eyebrow">Transaction review</p><h2>Suggested matches</h2>`;
    const close = document.createElement("button");
    close.className = "drawer-close";
    close.type = "button";
    close.setAttribute("aria-label", "Close suggested matches");
    close.textContent = "×";
    close.addEventListener("click", () => this.closeMatchDrawer());
    header.append(title, close);
    const body = document.createElement("div");
    body.className = "match-drawer-body";
    body.append(embedElement("paprel-transaction-match-sheet", { "transaction-id": transactionId }));
    this.drawer.replaceChildren(header, body);
    this.drawer.hidden = false;
    this.drawer.setAttribute("aria-label", "Suggested transaction matches");
    close.focus();
  }

  private closeMatchDrawer(): void {
    this.drawer.hidden = true;
    this.drawer.replaceChildren();
  }

  private resolveTransaction(): void {
    this.closeMatchDrawer();
    const route = this.router.current();
    this.renderRoute(route.path, route.query);
  }
}
