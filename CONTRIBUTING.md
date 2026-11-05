# Contributing to ACA

Use the [README](README.md) for installation and the
[documentation index](docs/README.md) for detailed guides. Node.js 22 is the
recommended development runtime; install dependencies with `npm ci`.

## Change workflow

1. Start from an up-to-date branch and keep unrelated local changes separate.
2. Read `AGENTS.md`. When changing Next.js behavior, consult the documentation
   installed under `node_modules/next/dist/docs/` for this project's version.
3. Keep changes focused. Add regression coverage for meaningful behavior or
   security changes; documentation-only edits need link and command review.
4. Run the applicable checks below and explain the results in the commit or PR.
5. Use descriptive commits that state the resulting change. Never commit
   credentials, real resumes, personal account data, or generated test artifacts.

## Verification checklist

| Change type | Expected checks |
| --- | --- |
| Application logic | `npm run lint`, `npm run typecheck`, `npm test`, and relevant browser coverage. |
| Routes, bundling, or PDF processing | `npm run build`, `npm run test:pdf-package`, and `npm run test:e2e`. |
| Accounts or workspace behavior | `npm run test:e2e:auth`; use synthetic accounts in the local emulators. |
| Firestore rules or data contracts | `npm run test:firebase` and relevant storage/validation regression tests. |
| Dependencies | Review lockfile changes and `npm audit --omit=dev`; assess development-only findings separately. |
| Documentation | Resolve relative links, compare commands with `package.json`, and distinguish current guidance from dated evidence. |

Java 21+ is required for emulator suites. Browser tests need Chromium; install it
with `npx playwright install chromium` or set `PLAYWRIGHT_EXECUTABLE_PATH` to a
compatible installed executable. Do not run production builds concurrently with
the development browser harness: generated Next.js files can trigger reloads.

See the [testing guide](docs/testing/README.md) for coverage and prerequisites.
The live MFA helper is an explicitly authorized operator test; it is not a
general contribution or unattended CI command.

## Review expectations

A useful PR description explains the problem, resulting behavior, verification,
and material limitations. Include synthetic screenshots for visual changes when
helpful. Do not include authenticator QR codes, setup keys, tokens, or passwords.

Keep documentation in its relevant `docs/` category. Preserve historical audit
results with their dates rather than silently presenting them as fresh evidence.
Avoid claims of universal form compatibility, custom model training, or complete
production readiness without supporting evidence.
