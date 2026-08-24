# Paprel Embed UI examples

Standalone reference applications for the public `@paprel/embed-core`, `@paprel/accounting`, and `@paprel/reports` packages.

These applications demonstrate complete embedded accounting workflows, host-side styling, and a development-only App Connect token exchange. They are intentionally separate from the SDK so they behave like real package consumers.

## Applications

| Application | Purpose | Local URL |
|---|---|---|
| `component-lab` | Complete component and integration smoke harness | http://localhost:5175 |
| `accounting-dashboard` | Polished general accounting host application | http://localhost:5180 |
| `real-estate-accounting` | Industry-specific embedded accounting example | http://localhost:5181 |

## Repository layout

```text
apps/
  accounting-dashboard/   General accounting host
  component-lab/          Complete component smoke harness
  real-estate-accounting/ Real-estate accounting host
shared/
  browser-utils.ts        Safe browser rendering helpers
  dev-token-bff.ts        Development-only token exchange
```

## Local SDK development

Until the packages are published, the root dependencies point to the sibling `../paprel-embed/packages/*` directories. Build the SDK first, then install and run these examples:

```bash
cd ../paprel-embed
npm install
npm run build

cd ../paprel-embed-ui-examples
npm install
cp apps/accounting-dashboard/.env.example apps/accounting-dashboard/.env.local
# Add local App Connect credentials to .env.local
npm run build
npm run dev:real-estate
```

The real-estate app reuses the accounting dashboard credentials by default. Each app can also have its own ignored `.env.local` file.

## Public repository preparation

When the SDK packages are available from npm, replace the four root `file:../paprel-embed/...` dependency values with published semver ranges. The application package manifests already declare `^0.1.0` consumer ranges.

Never commit App Connect client secrets. The included token exchange is a development-only Vite BFF; production deployments require a server-side BFF or serverless function.

## Security

Copy only the supplied `.env.example` files. Local `.env` and `.env.local` files are ignored by Git. If a credential is ever committed or exposed, revoke it immediately rather than relying on deletion from Git history.

## No warranty or liability

These examples are provided for demonstration and development purposes only, without warranty of any kind. Nexara Global and the contributors are not liable for any claim, loss, damage, or other liability arising from their use, modification, or distribution. Review and test the examples for your own security, compliance, accounting, tax, and production requirements before using them in a live environment.
