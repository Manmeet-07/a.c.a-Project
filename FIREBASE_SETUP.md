# ACA accounts

ACA stays on Vercel. Firebase Authentication manages email/password accounts;
Standard Cloud Firestore in `us-east4` stores each verified user's private data.
The Firebase project is `aca-career-2026-mm07` (ACA Career), on the free plan.

## User flow

The public landing page stays at `/`. Its links lead to `/login`; `/register`
creates an account and sends an email-verification link. A verified user opens
`/app`. Password resets are available from the login screen. Sign-out clears
the workspace snapshots; authentication persists for the browser session.

The processing APIs independently verify Firebase ID token signatures and the
verified-email claim. A client-provided UID is never an authorization source.
Server verification uses public signing certificates and the project ID; do not
add service-account private keys to this application or to GitHub.

Firebase Admin is pinned to 13.10.0 for Vercel compatibility. Its 14.5.0
dependency chain requires loading ESM through CommonJS, which fails in Vercel's
Node 24 runtime with `ERR_REQUIRE_ESM`. A regression test disables that Node
feature and imports the real verifier. Keep this test when upgrading the SDK.
The dependency overrides pin patched UUID 11.1.1 and gRPC 1.14.6 versions;
the emulator flow exercises the resulting auth and database dependency chain.

## Configuration

Copy `.env.example` to `.env.local` and fill the Firebase web app configuration.
Configure those same five variables on Vercel's production environment. The four
`NEXT_PUBLIC_FIREBASE_*` values are public web configuration and are baked in at
build time; changing them requires a new build. `FIREBASE_PROJECT_ID` must match.
With missing configuration, sign-in and workspace access stay disabled.

The checked-in `firebase.json` enables email/password auth and lists authorized
domains. Provision changes using your signed-in Firebase CLI:

```powershell
npx -y firebase-tools@latest deploy --only firestore,auth --project aca-career-2026-mm07
```

This deploys the database rules and indexes as well as the auth configuration.
It does not deploy website hosting. Keep provider credentials and login codes
out of source control and logs. No billing account or paid-plan upgrade is set up.

## Data and rules

Profiles live at `users/{uid}/profile/current`; application records live at
`users/{uid}/applications/{id}`. Rules require both matching UID and verified
email. Create and update validate required fields, allowed keys, field types,
canonical skills, size limits, and immutable application IDs/creation dates.
All other paths deny access. Long resume/job text is excluded from indexing.

The SDK uses memory-only Firestore caching. Resume files are parsed and their
extracted text is saved; original PDFs are not stored in Firebase Storage.
Account imports preserve existing applications, replace the profile, and keep a
pre-import snapshot in memory until reload/sign-out. Browser data from the old
version is imported only via an explicit confirmation on the user's own device;
the old data remains in that browser. No automatic account assignment occurs.

## Verification

```powershell
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
npm run test:firebase
npm run test:e2e:auth
```

Java 21+ is required for emulator tests. The production browser test checks the
landing/login/register flow and denied unauthenticated API access. The auth
browser test uses a demo project and local Auth/Firestore emulators to test
registration, verification, API token checks, uploads, matching, persistence,
sign-out, reset requests, reauthentication, and isolation between two accounts.
It never creates production test accounts. Emulator mode is disabled in
production, and server auth rejects production emulator configuration.

These are prototype rules, with automated adversarial tests; review them before
broadly sharing the app. Account creation quotas and document field limits do
not impose a per-user document-count quota. Monitor usage in Firebase. ID tokens
are verified until their normal expiry; immediate account-revocation checks and
user-facing account deletion are not implemented in this version.
