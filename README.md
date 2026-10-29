# PainRadar

PainRadar helps independent builders find and organize public discussions about problems their products may solve.

## Stack

- pnpm workspaces, Node.js 22+, TypeScript 5.9
- Web: React, Vite, Wouter, TanStack Query
- API: Express 5 with Clerk auth middleware
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod, `drizzle-zod`
- API codegen: Orval (generates typed hooks/schemas from `lib/api-spec/openapi.yaml`)
- Build: Vite for the web app; esbuild for the standalone API server; the
  same Express app is also re-exported as a Vercel serverless function
  (see `api/index.ts`)

## Where things live

- `artifacts/painradar` — the PainRadar web app (SPA) and visual theme
- `artifacts/api-server` — account-scoped API, connectors, and scoring;
  runs standalone via `node dist/index.mjs`, and is also re-exported by
  `api/index.ts` for Vercel
- `api/index.ts` — Vercel serverless entry point; re-exports the Express
  app from `artifacts/api-server` unchanged
- `lib/db/src/schema/painradar.ts` — campaign, lead, and settings schema
- `lib/api-spec/openapi.yaml` — source of truth for generated API clients
  and validation

## Local development

1. Copy `.env.example` to `.env` and fill in `DATABASE_URL` and the Clerk
   keys (see `.env.example` for what each one is and where to get it).
2. Install dependencies:
   ```
   pnpm install
   ```
3. Push the database schema (dev only):
   ```
   pnpm --filter @workspace/db run push
   ```
4. Run the API server and the web app in two terminals:
   ```
   pnpm --filter @workspace/api-server run dev
   pnpm --filter @workspace/painradar run dev
   ```
   The web app's dev server proxies nothing by itself — when running both
   locally outside of a single-origin setup, requests to `/api/*` need the
   API server reachable at the same origin, or set `VITE_CLERK_PROXY_URL`/
   an API base URL as appropriate for your local setup.

Other useful commands:

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck and build all workspace packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks
  and Zod schemas after editing `lib/api-spec/openapi.yaml`

## Deploying

### Database

Provision a Postgres database (e.g. Neon, Supabase, Railway, RDS). Use a
**pooled** connection string if your host is serverless (Vercel functions
can open many short-lived connections). Run the schema push once against
the production database:

```
DATABASE_URL=<your production connection string> pnpm --filter @workspace/db run push
```

### Auth (Clerk)

This project previously ran with Clerk auth managed through Replit's
built-in "Auth pane," which required no separate Clerk account. Outside
Replit, you need your own Clerk application:

1. Create an app at https://dashboard.clerk.com.
2. Copy the Publishable key and Secret key.
3. Once you have a deployed URL, add it under Clerk's allowed domains.

### Vercel

This repo is set up to deploy as a single Vercel project:

- The web app builds to a static SPA (`artifacts/painradar/dist/public`).
- The API runs as a serverless function (`api/index.ts`, which re-exports
  the same Express app used in standalone/local mode).
- `vercel.json` routes `/api/*` to the function and everything else to the
  SPA (with a catch-all rewrite to `index.html` for client-side routing).

Steps:

1. Push this repo to GitHub (see commands below).
2. Import the repo in Vercel.
3. In the Vercel project's Environment Variables, set:
   - `DATABASE_URL`
   - `CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `VITE_CLERK_PUBLISHABLE_KEY` (same value as `CLERK_PUBLISHABLE_KEY` —
     Vite only bakes in vars present at build time, so this one needs the
     `VITE_` prefix to reach the browser bundle)
4. Deploy. Vercel will run `pnpm install` and the build command declared
   in `vercel.json`.
5. After the first deploy, make sure the database schema has been pushed
   (see "Database" above) before signing in and using the app.

## Architecture decisions

- Every campaign, lead, and setting is scoped to the authenticated Clerk
  user ID; the API never accepts an account ID from the browser.
- Manual imports store only user-provided discussion details and URLs.
  PainRadar does not fetch or scrape pasted pages.
- Hacker News is the only live discovery connector, using its official
  public Firebase API (no credentials required). Reddit, X, and Facebook
  would need customer-authorized connections and are not connected — the
  app states this plainly in Settings rather than faking results for them.
- Relevance and intent scoring use transparent rules, not an LLM. Unknown
  discussion dates receive no freshness bonus.
- Demo records are stored separately, flagged `isDemo: true`, and clearly
  labeled in the UI; they use placeholder `example.com` URLs and are never
  presented as real discussions or real people.

## Product

Users can create and manage campaigns, manually import discussions, scan
recent Hacker News posts, search and filter leads, save leads, track
outreach notes and outcomes, and view account-based analytics.

## Known gotchas

- Regenerate API clients and Zod schemas after editing
  `lib/api-spec/openapi.yaml`.
- Push the database schema again after editing `lib/db/src/schema`.
- Keep `@clerk/react` and `@clerk/shared` on compatible major versions —
  a mismatch can pass TypeScript but fail at the Vite production bundle
  step (a missing runtime export), so always run both `pnpm run typecheck`
  and a production build (`pnpm run build`) before deploying a Clerk
  version bump.
