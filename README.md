# Paprel Embed UI reference application

A production-shaped, framework-neutral reference for embedding Paprel accounting into a real-estate platform. It connects one Paprel company through one App Connect client.

This repository intentionally contains one complete application rather than several overlapping demos. It shows the integration boundaries a partner should own: routing, company context, URL state, session presentation, error states, and the server-side App Connect token exchange.

## What it demonstrates

- Vite, vanilla TypeScript, and native History API routing
- `@paprel/embed-accounting` and `@paprel/embed-reports` Web Components
- host-owned account, journal, bank, transaction, and report routes
- delegated `paprel:resource-open` and `paprel:view-change` events
- host-rendered success feedback from `paprel:operation-success`
- URL-backed search, tabs, and pagination
- server-side token caching, and automatic renewal that does not disturb open forms or expose a secret to the browser
- inherited Paprel design tokens inside a partner-specific shell

## Run locally

Install the published beta packages and start the application:

```bash
npm install
cp apps/real-estate-accounting/.env.example apps/real-estate-accounting/.env.local
npm run dev
```

Open <http://127.0.0.1:5181/>.

If App Connect credentials are not available yet, the application still starts and displays a setup guide with the exact server variables required. No shared demo secrets are included in this public repository.

## Production boundary

The Vite plugin in `apps/real-estate-accounting/server/embed-token-bff.ts` exists only for local development. In production, implement `GET /api/embed-token` in your server or serverless runtime. It must load the App Connect credentials from server-side secrets, exchange them with Paprel, and return the browser-safe token contract.

Client secrets must never use a `VITE_` prefix, appear in frontend code, or be returned to the browser. Configure history fallback to `index.html` for application routes such as `/journals/:id` and `/banking/:id`.

The local token endpoint intentionally has no partner-user session because it runs only inside Vite development. A production BFF must authenticate and authorize the partner user before issuing an embed token.

Cache tokens on the server and reuse them until shortly before expiry: the App Connect token route allows 5 requests a minute per client IP, and all of your users share your server's IP.

See the [SDK integration documentation](https://github.com/nexara-global/paprel-embed-ui/tree/main/docs/partner-integration) for the complete BFF contract.

## SDK contributors

The npm packages are the default integration path. Contributors changing the SDK and this example together may temporarily use `npm link` from a sibling `paprel-embed-ui` checkout; do not commit link or `file:` dependency changes.

## Security and license

Report vulnerabilities according to [SECURITY.md](SECURITY.md). This repository is available under the [MIT License](LICENSE).

## No warranty or liability

This reference application is provided for demonstration and development purposes without warranty of any kind. Review its security, compliance, accounting, tax, and deployment requirements before production use.
