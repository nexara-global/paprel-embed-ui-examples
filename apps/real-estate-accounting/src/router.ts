export type Route = { path: string; params: Record<string, string>; query: URLSearchParams };

type Listener = (route: Route) => void;

export class Router {
  private listeners = new Set<Listener>();

  constructor() {
    window.addEventListener("popstate", () => this.notify());
    document.addEventListener("click", (event) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[data-route]");
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      if (link.origin !== window.location.origin) return;
      event.preventDefault();
      this.navigate(`${link.pathname}${link.search}${link.hash}`);
    });
  }

  current(): Route {
    return { path: window.location.pathname, params: {}, query: new URLSearchParams(window.location.search) };
  }

  navigate(to: string, replace = false): void {
    window.history[replace ? "replaceState" : "pushState"]({}, "", to);
    this.notify();
  }

  updateQuery(update: Record<string, unknown>): void {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(update)) {
      if (value == null || value === "" || value === false) url.searchParams.delete(key);
      else url.searchParams.set(key, Array.isArray(value) ? value.join(",") : String(value));
    }
    this.navigate(`${url.pathname}${url.search}`, true);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.current());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const route = this.current();
    this.listeners.forEach((listener) => listener(route));
  }
}
