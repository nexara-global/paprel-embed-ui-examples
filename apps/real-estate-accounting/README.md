# HarborStone real-estate accounting

The sole reference application in this repository. It is structured like a partner product rather than a component gallery.

## Architecture

```text
src/
  app.ts            Application composition
  router.ts         Native History API routing
  lib/              Environment configuration
  pages/            Host-owned page composition
  paprel/           Web Component and event adapters
  session/          App Connect session and entity state
  shell/            Partner-owned application shell
server/
  embed-token-bff.ts Local-only server-side token exchange
```

The host owns navigation through the browser History API. Paprel Web Components emit resource and view-state events; the host maps those events into routes and query parameters. Each portfolio entity maps to a separate App Connect client. The same integration boundaries apply in React, Vue, Svelte, or any other frontend stack.

## Configure credentials

The application can start without credentials and will show an in-app setup guide rather than a generic connection error. To connect real data:

```bash
cp apps/real-estate-accounting/.env.example apps/real-estate-accounting/.env.local
```

Set `APP_CONNECT_TOKEN_URL`, `APP_CONNECT_CLIENT_ID`, `APP_CONNECT_CLIENT_SECRET`, and `PARTNER_DOMAIN`, then restart the dev server. Each additional portfolio entity needs its own `APP_CONNECT_ENTITY_<ENTITY>_CLIENT_ID` and `APP_CONNECT_ENTITY_<ENTITY>_CLIENT_SECRET` values.

These variables are read only by the local BFF. Never expose `APP_CONNECT_CLIENT_SECRET` through a `VITE_` variable or frontend code.
