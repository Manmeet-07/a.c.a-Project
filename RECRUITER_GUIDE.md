# Explaining ACA to recruiters and engineers

Use first-person claims only for work you actually owned. If you collaborated
with friends or used AI coding assistance, describe your role and the decisions,
debugging, integration, and verification you can personally explain. Do not imply
you wrote Firebase's authentication system or the underlying PDF/QR libraries.

## A short recruiter pitch

“ACA is my full-stack career-workflow project, built with Next.js and TypeScript
and deployed on Vercel. It extracts resume information, compares it with job
descriptions, tracks applications, and helps fill contact fields. It uses Firebase
for Google/email login, optional authenticator-based 2FA, and private user data.
I focused on reliable integrations and tests, including verifying that users
cannot read each other's workspace.”

Adapt “I focused on” to your actual contribution. Follow with the part most
relevant to the role: backend authorization, frontend form behavior, parsing,
cloud integration, or test automation.

## A technical walkthrough

1. **Problem:** repeated resume entry and scattered application tracking. ACA
   centralizes the candidate's data and keeps submission under their control.
2. **Frontend:** React components handle profile upload/editing, match results,
   tracking, account screens, and Security. Next.js App Router serves the pages.
3. **Authentication:** Firebase handles email/Google identity. Enrolled users must
   complete a TOTP challenge. Unenrolled verified users get an optional setup
   offer before the workspace, with a clear skip option.
4. **Authorization and data:** APIs verify signed ID tokens independently of the
   UI. Firestore rules authorize the verified owner of each UID-scoped document.
   Hiding a page is not treated as database security.
5. **Processing:** bounded PDF parsing runs in a Node worker; skill extraction
   and an explainable similarity calculation produce matched/missing skills.
   Paid AI suggestions are optional and guarded, with local fallbacks.
6. **Automation:** a user-triggered bookmarklet fills recognizable contacts and
   dispatches native input/change events so React forms retain the values. It
   preserves existing answers and never submits the application.
7. **Quality:** regression tests, emulator rule tests, browser workflows,
   production builds, dependency checks, and disposable-account live MFA tests
   provide different kinds of evidence. They do not replace monitoring and
   recovery work.

## Resume bullets you can adapt

- Built a Next.js/TypeScript career-workflow application with PDF resume parsing,
  explainable job matching, and persistent application tracking on Vercel.
- Integrated Firebase email/Google authentication, optional TOTP two-factor
  authentication, and UID-scoped Firestore authorization with cross-account tests.
- Added end-to-end verification of 13 contact-field autofill targets in a React
  form while preserving 14 protected controls and preventing automatic submission.
- Added bounded worker-based PDF processing and automated security/reliability
  checks, including 48 regression tests and Firebase emulator browser workflows.

These counts describe the current test suite and synthetic fixtures. They are
not user-growth metrics or a claim that every real job site is supported. Replace
“built”/“added” with “contributed to” where that better reflects your role.

## Questions to be ready for

| Interview question | A defensible answer |
| --- | --- |
| Why Next.js and Firebase? | They let this version share TypeScript across UI and server routes, deploy as one Vercel application, and delegate identity/data services. The tradeoffs include vendor coupling, quotas, and rules/configuration that still need explicit testing. |
| How do you secure another user's data? | API token verification and Firestore verified-owner rules are separate controls. The document path includes the authenticated UID; rules validate fields and deny other users. A UID supplied by the browser is not trusted as proof of identity. |
| Did you implement the 2FA algorithm? | No. Firebase enforces MFA. I integrated enrollment, local QR presentation, valid-code confirmation, challenge resolution, fresh reauthentication for removal, and the optional onboarding offer. The test helper generates codes only for a disposable test account. |
| Can someone click Not now to bypass 2FA? | Only optional setup can be skipped before enrollment. An already enrolled account must complete Firebase's sign-in challenge. The stored UI preference is not an authorization flag. |
| What is the matching algorithm? | Log-weighted term-frequency cosine similarity plus skill coverage: 45/55 when known job skills are present, otherwise text similarity. The number is an explainable heuristic, not a calibrated hiring probability or vendor ATS certification. |
| Is the model trained by you? | No custom model is trained. Parsing/matching are local rules and calculations; optional suggestions integrate an external model with consent, validation, budget controls, and fallback behavior. |
| What was a concrete parsing bug? | GitHub URLs can be hidden in PDF annotations behind a label such as “GitHub”. Text-only extraction missed them. The parser now reads bounded safe web-link annotations and keeps contact-link types distinct. |
| Why did autofill appear to work but not persist? | A React-controlled input needs its underlying native value setter and input/change events. Updating only what appears on the screen is insufficient; the browser test checks both DOM values and React state. |
| Why a worker for PDFs? | Parsing untrusted files can consume CPU/memory. A worker, byte/page/text limits, a deadline, and bounded admission reduce event-loop blocking and resource exhaustion. Per-instance controls still need edge/global protections at scale. |
| Is it production ready? | It is a working beta. Core flows are tested and deployed; alerts, restore/rollback drills, full account deletion/privacy processes, traffic/cost validation, and a wider browser matrix remain launch work. |
| What would you improve next? | Complete account deletion and recovery operations, prove alert/restore behavior, then expand parsing and real-form compatibility based on measured failures. |

## A three-minute demonstration

1. Use a dedicated demo account and a synthetic resume, not another user's data.
2. Show sign-in and the optional 2FA offer. Explain setup versus required
   verification for accounts that already enrolled. Never show an actual setup
   key, QR code, recovery secret, or password in a recorded demonstration.
3. Upload the synthetic PDF and show extracted contacts, including GitHub.
4. Paste a short job description; explain one matched and one missing skill.
5. Save the opportunity and change its tracker status.
6. Demonstrate Fill-Assist on the synthetic application fixture, showing preserved
   answers and that submission remains manual.
7. End with the test evidence and one concrete remaining limitation. Offer to
   walk through a bug fix or authorization test rather than claiming perfection.

Keep the difference between **what you built**, **what a managed service supplies**,
**what you verified**, and **what remains planned** clear throughout the interview.
The current evidence and limitations are in [ACA_AUDIT_REPORT.md](ACA_AUDIT_REPORT.md).
