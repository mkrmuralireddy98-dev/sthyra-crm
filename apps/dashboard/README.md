# Plumb Dashboard (Next.js 14, App Router)

Minimal Phase-0 dashboard shell. Consumes `@plumb/tokens` for the visual system
and proxies requests to the org-service / project-service via server-side
fetch, propagating the request-id end-to-end.

## Develop

```bash
# In project root:
docker compose up -d postgres
pnpm --filter=@plumb/org-service start:pg &
pnpm --filter=@plumb/project-service start:inmem &
pnpm --filter=@plumb/dashboard dev
```

Then open http://localhost:3000.

## Pages

- `/` — Dashboard home. Shows org list + project list pulled from the two services.
- `/orgs/new` — Form to create a new org (POSTs to org-service).
- `/immersive` — Marketing-style placeholder built with the design tokens.

## Architecture

- **Server Components** by default for data fetching (no client-side waterfall).
- **`lib/api.ts`** is the only place that talks to the backend services. Request-id
  is generated per request and forwarded as `x-request-id`.
- **Tokens** are imported from `@plumb/tokens` and emitted via CSS vars in
  `app/layout.tsx`. Light/dark mode switch hooks into the token set.
- **No three.js, no WebGL, no AR view** — that's Phase 1+, not Phase 0.

## Tests

```bash
pnpm --filter=@plumb/dashboard test
```

(Tests are unit tests over the API client; full e2e test/browser work is Phase 1.)
