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
```

The host owns navigation through the browser History API. Paprel Web Components emit resource and view-state events; the host maps those events into routes and query parameters. Each portfolio entity maps to a separate App Connect client. The same integration boundaries apply in React, Vue, Svelte, or any other frontend stack.

## Configure credentials

The application can start without credentials and will show an in-app setup guide rather than a generic connection error. To connect real data:

```bash
cp apps/real-estate-accounting/.env.example apps/real-estate-accounting/.env.local
```

Set `APP_CONNECT_TOKEN_URL`, `APP_CONNECT_CLIENT_ID`, `APP_CONNECT_CLIENT_SECRET`, and `PARTNER_DOMAIN`, then restart the dev server.

These variables are read only by the local BFF. Never expose `APP_CONNECT_CLIENT_SECRET` through a `VITE_` variable or frontend code.

## Connect more than one company

In this example an **entity** is one company in your product, such as a property group in a real-estate portfolio. An App Connect client belongs to one company, so each entity has its own client ID and secret. You can run the app with just one.

To add a company:

1. Create an App Connect client in that company.
2. Add the company to the switcher list, using a short key and a display name:

   ```bash
   VITE_PAPREL_ENTITIES=default:Acme Property Group,second:Second Property Group
   ```

3. Set its credentials, using the key in uppercase:

   ```bash
   APP_CONNECT_ENTITY_SECOND_CLIENT_ID=
   APP_CONNECT_ENTITY_SECOND_CLIENT_SECRET=
   ```

4. Restart the dev server.

The `default` key always reads `APP_CONNECT_CLIENT_ID` and `APP_CONNECT_CLIENT_SECRET`. To catch credentials set against the wrong company, add the Paprel company ID as a third value, as in `second:Second Property Group:<company_id>`. The app then refuses to open that entity if the token belongs to a different company.

When someone picks a company in the switcher, the app asks your token route for that company's token and reconnects the embedded components. A production route must check that the signed-in user may access the company before issuing a token.

## Tests

```bash
npm test
```
