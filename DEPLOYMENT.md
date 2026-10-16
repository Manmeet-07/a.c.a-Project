# Deployment and audit remediation

Use Node 22, `npm ci`, and `npm run build`. Next and its ESLint configuration are pinned together. Fonts use the operating system stack, so builds do not fetch Google Fonts.

## Required before enabling paid AI

The default installation provides local suggestions and never calls Anthropic. To enable AI, configure these server-only variables:

| Variable | Meaning |
| --- | --- |
| `ANTHROPIC_API_KEY` | Restricted Anthropic workspace key |
| `ANTHROPIC_MODEL` | Current model ID; defaults to `claude-haiku-5-5` |
| `SESSION_SECRET` | Random secret of at least 32 characters, shared by all instances |
| `APP_ORIGINS` | Comma-separated exact HTTPS origins, without trailing slashes |
| `REDIS_REST_URL` | HTTPS Redis REST endpoint supporting GET, SET, DEL, EVAL |
| `REDIS_REST_TOKEN` | Credential scoped to that store |
| `AI_DAILY_CALL_LIMIT` | Maximum reserved provider attempts per UTC day; default 100, 0 disables calls |

AI requires explicit consent on each analysis and a signed, one-hour, HttpOnly, SameSite=Strict visitor session. These are anonymous visitor sessions, not verified accounts. Each session can reserve ten analyses per rolling idle hour. A visitor can clear cookies; the atomic global daily budget remains the cost backstop. Add identity-based authentication if the service needs a per-person allowance. Rate-limit session creation and API traffic at your trusted edge/WAF; do not trust arbitrary client-supplied forwarding headers.

Redis failure disables paid AI. The budget is reserved atomically before calling the provider, including three attempts per analysis to cover the SDK's two retries; failed calls do not refund budget. The default therefore permits at most 33 new analyses per UTC day. Each attempt has at most 3,000 output tokens and bounded input. This is an attempt ceiling, not a dollar-denominated billing cap. **Set the Anthropic workspace spend limit in its console before enabling the key.** Actual account limits require account access and are not set by source code.

Results are keyed by a SHA-256 hash of the model and sanitized prompt, retained in Redis for one hour. A distributed lock avoids concurrent duplicate provider calls. Redis stores suggestions and opaque hashes/counters, never raw resumes or job descriptions. Keep Redis access private and use its retention/access controls. Validate current model access in staging; invalid/retired model configuration is logged, and all provider failures fall back visibly to local suggestions. Current model references: https://platform.claude.com/docs/en/models/overview and https://platform.claude.com/docs/en/build-with-claude/structured-outputs.

## Upload and hosting limits

Serve over HTTPS. Configure a request-body ceiling of 11 MiB and a request-body timeout of 15 seconds at the reverse proxy. The application independently counts streamed bytes, including requests without Content-Length, before multipart parsing. It admits two uploads per process, permits a 10 MiB file, and gives each PDF worker 128 MiB old-generation heap, 16 MiB young-generation heap, and ten seconds. V8 heap limits are not total process RSS limits: also set a container memory limit and edge concurrency/rate limits. More than 20 pages is rejected. The worker emits at most 2,000 lines / 100,000 characters. Extracted text beyond that limit is truncated consistently with tailoring.

Package `workers/pdf.cjs` and `pdf2json` with the server; output tracing includes both. The worker is resolved from the application working directory, so start the server from the deployed project root. Test the packaged artifact on your host before promotion. Some serverless hosts enforce smaller request bodies; show their upload error to the user or deploy this endpoint on a Node server with the documented limits.

The page uses a per-request nonce CSP and dynamic rendering. Script execution requires the nonce; inline styles remain allowed for existing React style attributes. HSTS, anti-framing, nosniff, referrer, and permissions headers are configured. Do not cache HTML containing per-request nonces.

## Monitoring

`GET /api/health` is a liveness check. Every API response has `x-request-id`. JSON logs contain route, duration, status and error class, with no request bodies, filenames, provider errors, or contact details. AI emits `ai_success`, `ai_cache_hit`, `ai_fallback` (reason), and token counts. Forward stdout to your hosting log/error collector with request-body capture disabled. Alert on sustained 5xx, parser timeout/resource failures, and an AI fallback fraction above 20% over 15 minutes (exclude intentionally unconfigured AI). Verify alert delivery in staging. External monitoring destinations and account alert rules need deployment credentials and are not provisioned by this repository.

## Browser data

Storage is versioned; legacy data migrates on write. Invalid records are preserved in quarantine before any replacement. Unknown future versions block writes. Tracker mutations use Web Locks, requiring HTTPS/localhost and a modern browser. Users can export private JSON backups, merge imports, and export a pre-import recovery snapshot. This remains device-local storage; a backend synchronization service is a separate product change. Contact extraction favors US layouts; the profile editor supports manual corrections and international names/phone/address text.

## Verification

CI installs from the lockfile, lints, typechecks, runs regression tests, audits production dependencies, builds, and runs the production upload → tailor → tracker browser flow. `npm run test:e2e` starts/stops its own server on a free port. Set `PLAYWRIGHT_EXECUTABLE_PATH` to an installed Chromium browser, or run `npx playwright install chromium`.

On a Windows sandbox that cannot create Turbopack junctions, use `NEXT_BUILD_DIR=.next-verify` with `next build --webpack`, then keep that environment variable for the browser test. The alternate directory preserves existing build artifacts; normal builds clean `.next`.

## Tracked upstream dependency exception

As checked on 2026-10-16, production `npm audit --omit=dev` is clean. Full audit reports the dev-only braces → micromatch → fast-glob → Next ESLint chain (GHSA-vfj7-8cjw-p6xm). The latest published `braces` is 3.0.3, still affected; there is no safe patched-version override. Do not downgrade Next ESLint to 14 to suppress the report. Lint only repository-controlled paths and patterns, keep this exception visible, and remove it when an upstream patched release is available. CI enforces the production audit; full audit must still be reviewed during dependency updates.

## Branch consolidation

The audit branch started one documentation commit ahead of `main`. Keep all fixes together on that branch, review the PR and green CI, then merge into `main`. Delete the source branch only after the merge is confirmed and no unique commits remain. Configure `main` as the deployment branch and require CI before merging.
