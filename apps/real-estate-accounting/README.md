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
  embed-token-bff.ts Local-only token route
  token-cache.ts     Per-entity token reuse
  partner-session.ts Partner API session minting
```

The host owns navigation through the browser History API. Paprel Web Components emit resource and view-state events; the host maps those events into routes and query parameters. Each portfolio entity maps to a Paprel company through either token source below. The same integration boundaries apply in React, Vue, Svelte, or any other frontend stack.

## Configure credentials

The application can start without credentials and will show an in-app setup guide rather than a generic connection error. To connect real data:

```bash
cp apps/real-estate-accounting/.env.example apps/real-estate-accounting/.env.local
```

Set `APP_CONNECT_TOKEN_URL`, `APP_CONNECT_CLIENT_ID`, `APP_CONNECT_CLIENT_SECRET`, and `PARTNER_DOMAIN`, then restart the dev server. Each additional portfolio entity needs its own `APP_CONNECT_ENTITY_<ENTITY>_CLIENT_ID` and `APP_CONNECT_ENTITY_<ENTITY>_CLIENT_SECRET` values.

These variables are read only by the local BFF. Never expose `APP_CONNECT_CLIENT_SECRET` through a `VITE_` variable or frontend code.

## Use Partner API sessions

If Paprel has issued you a partner credential, one `private_key_jwt` credential can open any company you own, so you don't need a client per entity. Set `PAPREL_API_BASE_URL`, `PAPREL_PARTNER_CLIENT_ID`, `PAPREL_PARTNER_KID`, and `PAPREL_PARTNER_PRIVATE_KEY_PEM`, then a `PAPREL_PARTNER_ENTITY_<ENTITY>_COMPANY_ID` and `PAPREL_PARTNER_ENTITY_<ENTITY>_EXTERNAL_USER_ID` for each entity, including `DEFAULT`. Set `VITE_PARTNER_DOMAIN` to your partner identity domain.

The BFF signs a client assertion, gets a partner token, and mints a session for that user and company. The browser receives only the session token, in the same format as App Connect. Sessions last 300 to 900 seconds and carry the user's role permissions, so a production BFF must map the signed-in partner user to `external_user_id` instead of reading it from configuration. See [Sessions and Public API calls](https://paprel.com/documentation/partner-api/sessions).

## Tests

```bash
npm test
```
