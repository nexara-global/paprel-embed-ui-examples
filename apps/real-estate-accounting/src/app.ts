import "@paprel/embed-accounting";
import "@paprel/embed-reports";
import { connectPaprelEvents } from "./paprel/events";
import { embedElement } from "./paprel/elements";
import { renderPage, titleFor } from "./pages/pages";
import { Router } from "./router";
import { SessionManager } from "./session/session-manager";
import { createSidebar } from "./shell/sidebar";

export class App {
  private router = new Router();
  private session = new SessionManager();
  private workspace = document.createElement("main");
  private surface = document.createElement("section");
  private status = document.createElement("div");
  private toast = document.createElement("div");
  private drawer = document.createElement("aside");
  private toastTimer?: number;

  constructor(private root: HTMLElement) {
    this.workspace.className = "workspace";
    this.surface.className = "embed-surface";
    this.status.className = "boot-card inline";
    this.toast.className = "success-toast";
    this.toast.setAttribute("role", "status");
    this.toast.hidden = true;
    this.drawer.className = "match-drawer";
    this.drawer.hidden = true;
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
    this.session.subscribe((state) => this.renderSession(state.ready, state.error));
  }

  async start(): Promise<void> { await this.session.start(); }

  private renderRoute(path: string, query: URLSearchParams): void {
    if (path === "/") { this.router.navigate("/accounts", true); return; }
    const { element } = renderPage(path, query);
    if (!element.childNodes.length) { this.router.navigate("/accounts", true); return; }
    const header = this.workspace.querySelector<HTMLElement>(".topbar")!;
    header.querySelector(".header-action")?.remove();
    header.querySelector("h1")!.textContent = titleFor(path);
    const primaryAction = element.querySelector<HTMLAnchorElement>(".view-actions .action-link");
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

  private renderSession(ready: boolean, error: string): void {
    this.workspace.replaceChildren(this.createHeader());
    if (!ready) {
      this.status.className = `boot-card inline${error ? " error" : ""}`;
      this.status.innerHTML = error ? `<p class="eyebrow">Connection failed</p><h2>Unable to open this company</h2><p>${error}</p>` : `<p class="eyebrow">Paprel connection</p><h2>Opening the property ledger</h2><p>Exchanging an App Connect token securely…</p>`;
      this.workspace.append(this.status);
    } else {
      this.workspace.append(this.surface);
      const route = this.router.current();
      this.renderRoute(route.path, route.query);
    }
  }

  private createHeader(): HTMLElement {
    const header = document.createElement("header");
    header.className = "topbar";
    header.innerHTML = `<div><p class="eyebrow">Real-estate accounting</p><h1>${titleFor(window.location.pathname)}</h1></div>`;
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
