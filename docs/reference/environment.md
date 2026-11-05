# Environment-variable reference

Copy [`.env.example`](../../.env.example) to `.env.local` for local use. Never put
real values in this guide. Environment files are ignored by Git; use the hosting
provider's environment settings for deployed values.

## Required account configuration

| Variable | Exposure | Meaning |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Public browser configuration | Firebase web API key. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Public browser configuration | Firebase auth domain used by the SDK and exact-origin auth-frame CSP. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Public browser configuration | Project containing the user's identity and workspace data. |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Public browser configuration | Registered Firebase web application. |
| `FIREBASE_PROJECT_ID` | Server configuration | Must match the browser project. Normal API verification does not need a checked-in service-account private key. |

`NEXT_PUBLIC_*` values are included in the client build. Update the environment
and rebuild when changing them. The API key is not a substitute for signed-token
verification or Firestore rules. Missing account configuration disables sign-in.

## Optional paid-AI configuration

Local parsing, matching, and suggestions work without these values. Paid calls
also require explicit consent and a valid signed visitor session.

| Variable | Exposure | Requirement or default |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Server secret | Provider credential; never prefix with `NEXT_PUBLIC_`. |
| `ANTHROPIC_MODEL` | Server configuration | The code defaults to `claude-haiku-5-5`; verify actual provider access before enabling it. This is the application's default, not a claim about the newest model. |
| `SESSION_SECRET` | Server secret | A cryptographically random secret of at least 32 characters, consistent across instances. |
| `REDIS_REST_URL` | Server configuration | HTTPS REST endpoint for shared cache/locks/budgets. |
| `REDIS_REST_TOKEN` | Server secret | Credential scoped to that Redis service. |
| `AI_DAILY_CALL_LIMIT` | Server configuration | Defaults to 100 reserved provider attempts per UTC day; `0` prevents new paid calls. |
| `APP_ORIGINS` | Server configuration | Comma-separated exact allowed origins; configure deliberately for production/preview domains. Without an override, request-origin checks use the request URL's origin. |

Redis aliases supported by the implementation:

| Purpose | Accepted aliases |
| --- | --- |
| URL | `UPSTASH_REDIS_REST_URL`, `KV_REST_API_URL` |
| Token | `UPSTASH_REDIS_REST_TOKEN`, `KV_REST_API_TOKEN` |

Budget reservations include retry attempts. They are not a dollar-denominated
billing cap. Configure provider-side spend limits and trusted edge controls
before enabling a paid key; see [deployment](../deployment/vercel.md).

## Development and verification only

| Variable | Purpose | Restriction |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_EMULATORS` | Connect the development client to local Auth/Firestore emulators when `true`. | Disabled by application code in production builds. |
| `FIREBASE_AUTH_EMULATOR_HOST` | Auth emulator host used by test/Admin integrations. | Do not set in production; production API verification rejects this configuration. |
| `FIRESTORE_EMULATOR_HOST` | Firestore emulator host for rules/Admin tests. | Use with demo-project tests, not a production database. |
| `PLAYWRIGHT_EXECUTABLE_PATH` | Installed Chromium-family executable for browser harnesses. | Optional when a supported installed/bundled browser is found. |
| `NEXT_BUILD_DIR` | Alternate generated output directory for local verification. | Keep consistent for build, packaging, and production browser checks. |

The emulator wrapper commands set their required test environment. Their demo
Firebase values are synthetic, not credentials for ACA's deployed project.

Source of truth: [`firebase-client.ts`](../../lib/firebase-client.ts),
[`firebase-server.ts`](../../lib/firebase-server.ts),
[`ai-guard.ts`](../../lib/ai-guard.ts), and [`http.ts`](../../lib/http.ts).
