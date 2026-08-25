# Paprel Embed UI reference application

A production-shaped, framework-neutral reference for embedding Paprel accounting into a multi-entity real-estate platform.

This repository intentionally contains one complete application rather than several overlapping demos. It shows the integration boundaries a partner should own: routing, company context, URL state, session presentation, error states, and the server-side App Connect token exchange.

## What it demonstrates

- Vite, vanilla TypeScript, and native History API routing
- `@paprel/embed-accounting` and `@paprel/embed-reports` Web Components
- host-owned account, journal, bank, transaction, and report routes
- delegated `paprel:resource-open` and `paprel:view-change` events
- URL-backed search, tabs, and pagination
- one App Connect client per managed entity
- automatic token renewal without exposing a client secret to the browser
- inherited Paprel design tokens inside a partner-specific shell

## Run locally

Build and register the adjacent SDK packages, then link them into this application:

```bash
cd ../paprel-embed-ui
npm install
npm run build
npm link -w @paprel/embed-core
npm link -w @paprel/embed-ui
npm link -w @paprel/embed-accounting
npm link -w @paprel/embed-reports

cd ../paprel-embed-ui-examples
npm install
npm link @paprel/embed-core @paprel/embed-ui @paprel/embed-accounting @paprel/embed-reports
cp apps/real-estate-accounting/.env.example apps/real-estate-accounting/.env.local
npm run dev
```

Open <http://127.0.0.1:5181/>.

## Production boundary

The Vite plugin in `apps/real-estate-accounting/server/embed-token-bff.ts` exists only for local development. In production, implement `POST /api/embed-token` in your server or serverless runtime. It must read the selected entity, load that entity's App Connect credentials from server-side secrets, exchange them with Paprel, and return the browser-safe token contract.

Client secrets must never use a `VITE_` prefix, appear in frontend code, or be returned to the browser. Configure history fallback to `index.html` for application routes such as `/journals/:id` and `/banking/:id`.

See the [SDK integration documentation](https://github.com/nexara-global/paprel-embed-ui/tree/main/docs/partner-integration) for the complete BFF contract.

## No warranty or liability

This reference application is provided for demonstration and development purposes without warranty of any kind. Review its security, compliance, accounting, tax, and deployment requirements before production use.
