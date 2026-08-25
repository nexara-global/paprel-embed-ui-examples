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

Copy `.env.example` to `.env.local` and supply server-only credentials. Never expose `APP_CONNECT_CLIENT_SECRET` through frontend environment variables.
