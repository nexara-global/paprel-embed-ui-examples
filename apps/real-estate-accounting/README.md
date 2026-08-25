# HarborStone real-estate accounting

The sole reference application in this repository. It is structured like a partner product rather than a component gallery.

## Architecture

```text
src/
  components/       Host application shell
  lib/              Environment and Web Component helpers
  session/          App Connect session and entity context
  App.tsx            Routes and Paprel event integration
server/
  embed-token-bff.ts Local-only server-side token exchange
```

React Router owns page navigation. Paprel Web Components emit resource and view-state events; the host maps those events into its routes and query parameters. Each portfolio entity maps to a separate App Connect client.

Copy `.env.example` to `.env.local` and supply server-only credentials. Never expose `APP_CONNECT_CLIENT_SECRET` through frontend environment variables.
