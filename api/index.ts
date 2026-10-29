// Vercel serverless entry point.
//
// Vercel looks for files under /api at the repository root and deploys
// each one as its own serverless function. This file re-exports the
// existing Express app (artifacts/api-server/src/app.ts, via the
// @workspace/api-server package's "." export) unchanged — Vercel's
// Node.js runtime invokes an exported Express app directly as a request
// handler, so no rewrite of route logic is needed and no app.listen()
// call is required (or used) here.
//
// Local development is unaffected: `pnpm --filter @workspace/api-server
// run dev` still boots the same app via artifacts/api-server/src/index.ts,
// which calls app.listen() directly. That file is untouched.
import app from "@workspace/api-server";

export default app;
