# Paprel component lab

Local smoke harness for `@paprel/accounting`. Runs every v1 widget against a real Paprel tenant via App Connect M2M — not a production partner template.

## Prerequisites

- **Node.js 22+**
- Paprel API reachable (local `*.localhost`, staging, or sandbox)
- An **App Connect** client with scopes for the screens you want to test (see [scopes](#app-connect-scopes))
- From App Connect client detail, note:
  - **Client ID** and **client secret**
  - **Token URL** — paste the full path exactly as shown in the UI
  - **Partner domain** (e.g. `app.paprel.localhost`)

## Run the sample app

From the examples repository root:

```bash
npm install
npm run build
```

Run `npm run build:component-lab` from the repository root for a production bundle check.
Run `npm run build` to verify all three example applications.

Create `apps/component-lab/.env.local` (gitignored):

```bash
cp apps/component-lab/.env.example apps/component-lab/.env.local
```

Edit `.env.local` and fill in your App Connect credentials:

| Variable | Required | Purpose |
|----------|----------|---------|
| `APP_CONNECT_TOKEN_URL` | yes | Full token URL from App Connect detail |
| `APP_CONNECT_CLIENT_ID` | yes | Client ID |
| `APP_CONNECT_CLIENT_SECRET` | yes | Client secret (dev BFF only — never sent to the browser bundle) |
| `PARTNER_DOMAIN` | yes | `x-partner-domain` header value |
| `VITE_PAPREL_API_BASE_URL` | yes | API origin for the `/v1` dev proxy (usually same host as token URL, no path) |
| `VITE_PARTNER_DOMAIN` | optional | Shown in sample UI; defaults to `PARTNER_DOMAIN` if unset |

Example (local Paprel):

```env
VITE_PAPREL_API_BASE_URL=https://app.paprel.localhost:9000
VITE_PARTNER_DOMAIN=app.paprel.localhost

APP_CONNECT_TOKEN_URL=https://app.paprel.localhost:9000/v1/app-connect/oauth/token
APP_CONNECT_CLIENT_ID=PLC_…
APP_CONNECT_CLIENT_SECRET=PLS_…
PARTNER_DOMAIN=app.paprel.localhost
```

Start the dev server (reads `.env.local` at startup):

```bash
npm run dev:component-lab
```

Open **http://localhost:5175**. The status chip should show **Connected**; COA and journal list should load. Row clicks open detail routes.

Equivalent from `apps/component-lab`: `npm run dev`.

> **Restart required** after changing `.env.local` — Vite loads env when the dev server starts.

## Verify (E0 smoke)

| Check | Expected |
|-------|----------|
| Status chip | `Connected · Nh session` |
| Chart of accounts | Table loads, no console errors |
| Journals | List loads; row opens `#/journal-detail?journal=…` |
| Layer B nav (banking, reports, …) | Loads or **403** if scope missing on the client |

The Paprel Embed SDK repository also contains a headless M2M smoke script for CI verification.

## App Connect scopes

Grant scopes on the App Connect client, then re-open the sample app (new token on refresh).

| Area | Scopes |
|------|--------|
| COA, account form, banking list | `accounting:account-list` (+ add/edit for writes) |
| Journals | `accounting:journal-list`, `accounting:journal-add`, `accounting:journal-edit` |
| Reports | `report:trial-balance`, `report:balance-sheet`, `report:income-statement`, `report:general-ledger`, … |
| Transactions | `accounting:banking-transaction-list` |
| Match / exclude | `accounting:banking-transaction-category` or `-reconcile` |
| Reconciliations | `accounting:banking-transaction-reconcile` |

See the [Paprel Embed SDK documentation](https://github.com/newledgerio/paprel-embed/tree/main/docs) for the full gateway scope map.

## Screens

| Nav | Widget(s) |
|-----|-----------|
| Chart of accounts | `paprel-chart-of-accounts` |
| Account picker / detail / form | `paprel-account-select`, `paprel-account-detail`, `paprel-account-form` |
| Reports | `paprel-trial-balance`, `paprel-balance-sheet`, `paprel-income-statement`, `paprel-cash-flow`, `paprel-general-ledger` |
| Banking | `paprel-banking-list` → `paprel-bank-account-detail` |
| Transactions | `paprel-transaction-inbox` → `paprel-transaction-detail`, `paprel-transaction-match-sheet` |
| Reconciliations | `paprel-reconciliation-form`, `paprel-reconciliation-list` → `paprel-reconciliation-detail` |
| Journals | `paprel-journal-list` → `paprel-journal-detail`, `paprel-journal-editor` |

Integration cues (collapsed by default) show tag, attributes, events, and a copy-paste snippet per screen.

## How it works

```
Browser  →  GET /api/embed-token     →  Vite dev BFF (client_credentials; secret stays on server)
Browser  →  GET /v1/accounting/…    →  Vite proxy → VITE_PAPREL_API_BASE_URL
```

- Embed SDK uses same-origin calls in dev (`baseUrl: ""`).
- Accounting GETs omit `company_id`; hyperlane injects `JWT.cid`.
- `configureAccounting` runs **before** `@paprel/accounting` is imported.
- Detail routes: `#/journal-detail?journal=…`, `#/bank-account-detail?account=…`, etc.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Token BFF 500 “Missing App Connect env” | Create or fix `.env.local`, then **restart** `npm run dev:component-lab` |
| `fetch failed` on token exchange | Local HTTPS cert — auto-tolerated for `*.localhost`; check API is up and URLs match |
| 403 on a screen | Add the scope on the App Connect client; hard-refresh for a new JWT |
| Stale data after edits in Paprel | Click **Refresh** in the top bar or re-open the nav item |
| `configureAccounting … required` | Hard-refresh; components mount only after configure succeeds |

## Production

This app is for **local/staging component testing only**. Partners need their own BFF and CORS (or same-origin gateway). See the [Paprel Embed integration documentation](https://github.com/newledgerio/paprel-embed/tree/main/docs/partner-integration).
