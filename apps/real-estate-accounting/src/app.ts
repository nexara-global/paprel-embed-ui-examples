import "@paprel/embed-accounting";
import "@paprel/embed-reports";
import { connectPaprelEvents } from "./paprel/events";
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

  constructor(private root: HTMLElement) {
    this.workspace.className = "workspace";
    this.surface.className = "embed-surface";
    this.status.className = "boot-card inline";
    const shell = document.createElement("div");
    shell.className = "app-shell";
    shell.append(createSidebar(this.session, this.router), this.workspace);
    this.root.replaceChildren(shell);
    this.workspace.append(this.createHeader());
    connectPaprelEvents(this.surface, this.router);
    this.router.subscribe(({ path, query }) => this.renderRoute(path, query));
    this.session.subscribe((state) => this.renderSession(state.ready, state.error));
  }

  async start(): Promise<void> { await this.session.start(); }

  private renderRoute(path: string, query: URLSearchParams): void {
    if (path === "/") { this.router.navigate("/accounts", true); return; }
    const { element } = renderPage(path, query);
    if (!element.childNodes.length) { this.router.navigate("/accounts", true); return; }
    this.workspace.querySelector("h1")!.textContent = titleFor(path);
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
}
