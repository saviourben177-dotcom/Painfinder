// Vercel serverless entry point.
//
// Vercel looks for files under /api at the repository root and deploys
// each one as its own serverless function.
//
// This imports the already-built, dependency-free bundle produced by
// artifacts/api-server/build.mjs (dist/app-handler.mjs) rather than the
// raw TypeScript source. That bundle is plain JavaScript with every
// workspace/runtime dependency already inlined by esbuild, so Vercel's
// own TypeScript compiler never needs to resolve this monorepo's module
// graph or match its moduleResolution settings — it only has to bundle
// one already-flat .mjs file.
//
// The bundle exports the same Express app used by the standalone server
// (artifacts/api-server/src/app.ts), just without the app.listen() call
// — Vercel's Node.js runtime invokes an exported Express app directly as
// a request handler.
//
// IMPORTANT: artifacts/api-server/dist/app-handler.mjs must exist before
// Vercel builds this function. vercel.json's buildCommand runs the
// api-server build before the frontend build for this reason — see
// vercel.json and artifacts/api-server/build.mjs.
//
// Local development is unaffected: `pnpm --filter @workspace/api-server
// run dev` still runs the TypeScript source directly via tsx, calling
// app.listen() itself. Neither of those files is touched by this change.
// @ts-expect-error -- plain built JS, no type declarations are generated for it
import app from "../artifacts/api-server/dist/app-handler.mjs";

export default app;
