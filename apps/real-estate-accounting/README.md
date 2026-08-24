# Paprel real-estate sample

A real-estate accounting application for exploring `@paprel/accounting` with a real App Connect client. Credentials stay in the Vite development server and are never bundled into browser code.

## Start

From the monorepo root:

```bash
npm run build
npm run dev:real-estate
```

The app automatically reuses `apps/accounting-dashboard/.env.local`, so the working App Connect credentials do not need to be copied. Optional real-estate-specific overrides can be placed in `apps/real-estate-accounting/.env.local`.

This sample represents one embedded entity. In a multi-entity host, bind each entity to its own server-side App Connect client credentials instead of switching entities with browser-side state.

## Multi-entity switcher

Set `VITE_PAPREL_ENTITIES` to browser-safe entity keys and labels, then provide a distinct server-side App Connect client for every additional entity:

```env
VITE_PAPREL_ENTITIES=default:HarborStone Property Group,meridian:Meridian Residential
APP_CONNECT_ENTITY_MERIDIAN_CLIENT_ID=PLC_…
APP_CONNECT_ENTITY_MERIDIAN_CLIENT_SECRET=PLS_…
```

The entity key selects credentials only inside the development BFF. Secrets never enter the browser bundle. Switching entity obtains a new JWT, resets the current view, and reloads all components under the selected company context.

Open http://localhost:5181.

Run `npm run build` from the repository root to verify every example application.

The app includes account list/detail/create/edit and journal list/detail/create/edit/copy/reverse workflows; a complete reports module (trial balance, balance sheet, income statement, cash flow, and general ledger); plus banking, transactions, and reconciliation. The client must have scopes for the screens and actions you intend to use. A screen with a missing scope will return the expected 403 state.

## Customize the host style

Edit `styles.css` and override the `--paprel-*` properties on `.app-shell`. The accounting package supplies all component CSS automatically; no separate stylesheet import is required.
