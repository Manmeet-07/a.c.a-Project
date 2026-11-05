# Testing and verification

This matrix describes the checked-in suites and their boundaries. A coverage
entry is not a claim that every suite was rerun for every documentation edit.
Use the dated audit records for historical evidence and CI/current command output
for fresh results.

## Coverage matrix

| Area | Regression coverage | Browser or rule coverage | Remaining manual boundary |
| --- | --- | --- | --- |
| Resume text and contacts | Parser limits, names, addresses, email/phone edge cases, safe links, skill normalization. | Actual PDF upload and profile persistence in the authenticated browser flow. | Image-only PDFs, unusual layouts, and broad international resume samples. |
| Matching and suggestions | Skill aliases, Unicode tokenization, scoring, edited profiles, local suggestions, mocked AI validation/failures. | Match, save, deduplication, and tracker persistence. | Live paid-model access, output acceptance, and actual account spend settings. |
| Email and Google accounts | Server token checks and provider helper behavior. | Registration, emailed-link verification in emulators, popup cancellation, returning sign-in, and account isolation. | Production email delivery, real Google consent, and browser/device variation. |
| MFA and setup offer | Resolver/factor checks, confirmation, recovery errors, account-scoped skip preference, and blocked preference storage. | Setup/skip entry and session behavior in emulators; separately authorized real TOTP helper. | Physical QR scanning and real Google-account MFA reauthentication. |
| Private data | Schema validation, account-switch write rejection, transactions, imports, limits, and error handling. | Adversarial Firestore owner/schema/default-deny rules. | Operator restore drills, deletion workflows, and traffic/cost limits. |
| Fill-Assist | Labels, native values/events, URL precedence, and protected/invisible controls. | Synthetic external-origin React form: 19 contact controls across 13 profile fields, 25 protected controls, repeat-run preservation, and no submission. | Employer-specific widgets, iframes, screening answers, and unsupported controls. |
| Production packaging | Vercel configuration and Firebase Admin import compatibility. | Public auth boundaries and PDF worker dependency traces. | Account-level hosting protections, uptime alerts, and rollback exercises. |

## Commands

```bash
npm run lint
npm run typecheck
npm test
npm audit --omit=dev
npm run build
npm run test:pdf-package
npm run test:e2e
```

Install Chromium for browser tests if a compatible installed browser is not found:

```bash
npx playwright install chromium
```

With Java 21+ available:

```bash
npm run test:firebase
npm run test:e2e:auth
```

`test:firebase` starts Firestore and runs `test:rules`. `test:e2e:auth` starts Auth
and Firestore, then launches an isolated application/browser flow with synthetic
data. Both wrappers use the `demo-aca` project. Do not point them at live data.

The plain `test:rules` command requires an already-running emulator and
`FIRESTORE_EMULATOR_HOST`. The real TOTP helper is opt-in and requires authorized
Admin access plus explicit test-account creation permission; it is not a generic
CI command. See [MFA verification](../security/two-factor-authentication.md#verification).

## Generated artifacts and local build issues

Browser output is written under the ignored `tests/artifacts/` directory. Do not
commit generated bundles, screenshots containing private information, passwords,
authenticator keys, or real resumes.

Keep production builds separate from a running development browser harness.
Generated Next.js file changes can trigger development reloads. If a Windows
environment cannot create Turbopack junctions, use the existing alternate output:

```powershell
$env:NEXT_BUILD_DIR = '.next-verify'
npx next build --webpack
npm run test:pdf-package
npm run test:e2e
Remove-Item Env:NEXT_BUILD_DIR
```

Do not mix output directories between these commands. Reused generated output
can contain stale route files after a route move; stop its servers and recreate
only that generated directory before a clean verification build.

For the actual pipeline, see [GitHub Actions](../../.github/workflows/ci.yml).
For the form fixture and exact expected values, see [Fill-Assist verification](fill-assist.md).
