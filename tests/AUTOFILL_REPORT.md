# Resume and application autofill verification

Tested 2026-10-15 with synthetic PDFs only. The user's main workspace on port 3000 was not populated or changed by the browser tests; an isolated ACA instance on port 3103 was used.

## Results

| Check | Maya Chen | Jordan O’Neil |
| --- | --- | --- |
| Actual PDF uploaded through ACA UI | Pass | Pass |
| Name, email and phone parsed correctly | Pass | Pass after name fix |
| Address, city, state, postal code and links extracted | Pass | Pass |
| App-generated bookmarklet equals browser-tested bookmarklet | Pass | Pass |
| Standard application fields populated | 12 | 12 |
| Email/phone exact-value assertions in test form | Pass | Pass |
| Input/change events dispatched | 12 / 12 | 12 / 12 |
| Form submissions | 0 | 0 |

First name, last name, full name, email, phone, street address, city, state, postal code, LinkedIn, GitHub and website were filled. Address line 2, company, emergency contact, username and read-only fields remained blank. An existing email value was preserved. Repeating autofill on the completed Jordan form filled zero additional fields. Uploading Jordan after Maya changed the generated bookmarklet; Jordan's profile survived a page reload.

## Confirmed issue fixed

PDF extraction emitted a curly apostrophe in Jordan O’Neil. The ASCII-only name rule rejected it, and the document-wide fallback incorrectly selected address text as a name. The name rule now supports Unicode letters and curly apostrophes. The unsafe document-wide fallback was removed. Parsed phone numbers are trimmed. A regression test covers both a curly apostrophe and accented names.

## Scope and limitations

The bookmarklet ran in a real browser on local, standard HTML application forms with associated labels and event counters. No employer application was submitted. Greenhouse, Lever, Workday, Ashby, custom controls, framework-controlled form state and cross-origin iframes were not tested here. This confirms standard-field behavior, not universal employer-site compatibility. Saved bookmarks contain a snapshot: after changing resumes, replace the saved bookmarklet with the newly generated one.

## Reproduce

With ACA running at http://127.0.0.1:3000 and a current production build, run `node tests/browser-harness.cjs`. It creates two synthetic PDFs in ignored `tests/artifacts`, parses them through the real upload API, serves test forms at port 3102, and starts an isolated ACA instance at port 3103. Stop the harness and its child server after testing. Unit regression tests run with `npm test`.

Final verification: five regression tests, lint, TypeScript through production build, and production build passed.
