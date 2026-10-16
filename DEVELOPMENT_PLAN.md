# ACA codebase review and development plan

Reviewed 2026-10-15. No commits, pushes, or deployments were performed.

## Architecture and feature status

- Next.js App Router: `app/page.tsx` renders `AppShell`, with Profile, Tailor and Track tabs. Tailwind CSS provides styling. React state inside each tab is discarded on tab changes.
- Profile: `ResumeUploader` sends a multipart PDF to `/api/upload`. Node-only pdf2json reconstructs text lines; heuristics extract identity, contact information, URLs, location and known skills. The parsed profile is stored locally; original PDF bytes are not persisted by application code.
- Tailor: `/api/tailor` combines term-frequency cosine similarity (45%) and known-skill coverage (55%), then generates suggestions. This does not generate a rewritten resume or submit applications.
- AI: optional server-side `ANTHROPIC_API_KEY` sends truncated resume/job text to Anthropic. Network/provider/JSON failures fall back to heuristic suggestions. Live provider behavior was not verified without credentials.
- Track: browser localStorage holds application records, statuses and saved match results. No authentication, database, background workers, discovery, synchronization or backend application submission exists.
- Autofill: a user-triggered bookmarklet fills contact fields in the current application page. Browser CSP, iframes, custom controls and field naming can prevent it working on particular job sites.

## Prioritized plan

### P0: confirmed dependency security findings — partially resolved

Compatible lockfile updates upgraded Next.js from 16.2.9 to 16.4.2 and updated vulnerable transitive packages. Production audit now reports zero vulnerabilities. Full audit still reports five high findings in the development-only braces → micromatch → fast-glob → Next ESLint dependency chain. npm proposes a major downgrade of eslint-config-next to 14.x; that was not applied because it would conflict with the installed Next.js generation. Follow upstream fixes; assess replacing the affected lint plugin if untrusted glob inputs become part of tooling.

### P1: crashes and incorrect persisted data — fixed in this pass

- Validate tailoring JSON object shape, field types, skill list entries/counts and text lengths; malformed input returns 400 and excessive text returns 413.
- Validate localStorage data before exposing it to components; corrupt JSON, invalid record shapes and unavailable reads fall back safely. Listen for cross-tab storage changes.
- Bind saved tailoring results to the job snapshot actually scored, clear results on description edits and resubmission, and prevent edits during scoring. Surface storage failures when saving a tailored job.
- Fix bookmarklet React lint error by deriving its URI rather than setting state in an effect.

### P1: contact and link safety — fixed in this pass

- Restrict tracker links to absolute HTTP(S) URLs.
- Avoid filling employer, reference, school, username, read-only and secondary address fields with candidate details.
- Use associated DOM labels instead of interpolating arbitrary element IDs into CSS selectors.
- Reject uploads without a PDF signature and avoid logging parser exceptions that could contain resume content. Invalid/unparseable PDF responses use client-error status codes.
- Reject malformed, empty or oversized AI suggestion arrays and fall back to heuristics.

### P1: remaining production hardening

- Both API endpoints are publicly callable. Add authentication/access policy, request rate limiting, upload/request streaming limits and AI spending controls before public hosting. Current field/file limits are checked after the body has been read and do not bound total ingress memory.
- Run PDF parsing in an isolated worker/process with execution/memory limits. A byte-size limit alone does not bound the cost of parsing hostile documents.
- Add storage quota/unavailable-write messages to manual tracker add/status/delete flows; those handlers can still throw. Local data currently has no backup/export UI.
- Explain and obtain an informed AI opt-in before sending personal resume content to an external provider. Confirm a supported provider model and make model selection configurable.

### P2: product correctness and usability

- Add editable profile fields/skills: extraction is heuristic, ASCII name rules and US location rules exclude some candidates, and scanned PDFs need OCR.
- Improve ATS scoring for descriptions with no recognized vocabulary, aliases in supplied profile skills and ambiguous short skills such as Go/R. Scores are directional heuristics.
- Add accessible labels for inputs/status selectors, keyboard-friendly upload, and clipboard failure feedback.
- Preserve draft tab state and add meaningful integration/browser tests for upload → tailor → track and persistence across reloads.
- Add export/backup, deletion controls, duplicate handling and richer tracker notes only after the core reliability work.

## Environment and credential review

`.env*` is ignored; no environment files were found at the project root. `ANTHROPIC_API_KEY` is accessed only in the server AI helper and is not prefixed with `NEXT_PUBLIC_`. No credential values were printed. A pattern scan of 13 commits reachable from all local refs (42 unique blobs) found no common cloud/API token or private-key signatures. This is a bounded pattern scan, not proof that every possible credential format is absent; unreachable Git objects and remote-only history were not inspected. No history rewrite is needed based on current findings.

## Verification

Added `npm test` using Node's test runner and the existing TypeScript compiler, with regression coverage for malformed tailoring requests, valid heuristic results, corrupt/unavailable storage, cross-tab subscription, bookmarklet field exclusions and unsafe posting URLs. Lint, TypeScript and production build are checked separately. The production build needs network access for its configured Google Fonts. Corrupt ignored `.next/dev/types` declarations from the old runtime were cleared; no source or user data was removed.

Final checks: 4 regression tests passed; `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `git diff --check` passed. A temporary production server returned HTTP 200 for the home page and valid heuristic tailoring, HTTP 400 for a null tailoring payload and a spoofed PDF upload. The temporary server was stopped. Real resume parsing, browser visual flows, and live Anthropic requests remain unverified in this pass. Production dependency audit: zero findings; full audit: five high development-only findings.
