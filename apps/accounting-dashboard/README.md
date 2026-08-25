# Paprel accounting dashboard

A clean local application for exploring `@paprel/embed-accounting` with a real App Connect client. Credentials stay in the Vite development server and are never bundled into browser code.

## Start

From the monorepo root:

```bash
cp apps/accounting-dashboard/.env.example apps/accounting-dashboard/.env.local
# Add APP_CONNECT_CLIENT_ID and APP_CONNECT_CLIENT_SECRET
npm run build
npm run dev:accounting
```

Open http://localhost:5180.

Run `npm run build` from the repository root to verify every example application.

The app includes account list/detail/create/edit and journal list/detail/create/edit/copy/reverse workflows; a complete reports module (trial balance, balance sheet, income statement, cash flow, and general ledger); plus banking, transactions, and reconciliation. The client must have scopes for the screens and actions you intend to use. A screen with a missing scope will return the expected 403 state.

## Customize the host style

Edit `styles.css` and override the `--paprel-*` properties on `.app-shell`. The accounting package supplies all component CSS automatically; no separate stylesheet import is required.
