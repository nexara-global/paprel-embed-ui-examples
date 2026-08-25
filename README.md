# Paprel Embed UI reference application

A production-shaped, framework-neutral reference for embedding Paprel accounting into a multi-entity real-estate platform.

This repository intentionally contains one complete application rather than several overlapping demos. It shows the integration boundaries a partner should own: routing, company context, URL state, session presentation, error states, and the server-side App Connect token exchange.

## What it demonstrates

- Vite, vanilla TypeScript, and native History API routing
- `@paprel/embed-accounting` and `@paprel/embed-reports` Web Components
- host-owned account, journal, bank, transaction, and report routes
- delegated `paprel:resource-open` and `paprel:view-change` events
- host-rendered success feedback from `paprel:operation-success`
- URL-backed search, tabs, and pagination
- one App Connect client per managed entity
- automatic token renewal without exposing a client secret to the browser
- inherited Paprel design tokens inside a partner-specific shell

## Run locally

Install the published beta packages and start the application:

```bash
npm install
cp apps/real-estate-accounting/.env.example apps/real-estate-accounting/.env.local
npm run dev
```

Open <http://127.0.0.1:5181/>.

If App Connect credentials are not available yet, the application still starts and displays a setup guide with the exact server variables required for the selected entity. No shared demo secrets are included in this public repository.

## Production boundary

The Vite plugin in `apps/real-estate-accounting/server/embed-token-bff.ts` exists only for local development. In production, implement `POST /api/embed-token` in your server or serverless runtime. It must read the selected entity, load that entity's App Connect credentials from server-side secrets, exchange them with Paprel, and return the browser-safe token contract.

Client secrets must never use a `VITE_` prefix, appear in frontend code, or be returned to the browser. Configure history fallback to `index.html` for application routes such as `/journals/:id` and `/banking/:id`.

The local token endpoint intentionally has no partner-user session because it runs only inside Vite development. A production BFF must authenticate and authorize the partner user before selecting an entity or issuing an embed token.

See the [SDK integration documentation](https://github.com/nexara-global/paprel-embed-ui/tree/main/docs/partner-integration) for the complete BFF contract.

## SDK contributors

The npm packages are the default integration path. Contributors changing the SDK and this example together may temporarily use `npm link` from a sibling `paprel-embed-ui` checkout; do not commit link or `file:` dependency changes.

## Security and license

Report vulnerabilities according to [SECURITY.md](SECURITY.md). This repository is available under the [MIT License](LICENSE).

## No warranty or liability

This reference application is provided for demonstration and development purposes without warranty of any kind. Review its security, compliance, accounting, tax, and deployment requirements before production use.
