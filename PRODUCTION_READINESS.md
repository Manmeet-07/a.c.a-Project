# Production readiness

Assessment date: 2026-10-21. Current classification: working beta for a limited
audience, pending operational verification before a wider public launch.

Production ready means the application meets defined expectations for security,
correctness, availability, privacy, capacity, support, and recovery for its
intended audience. A successful deployment or test run alone is insufficient.

## Existing safeguards

- Firebase email/password and Google authentication; processing APIs verify signed
  Firebase ID tokens and verified-email claims independently of the UI.
- Firestore rules isolate workspace data by UID. Emulator tests exercise rules
  and account isolation, including Google accounts.
- Authenticator-based MFA is optional at enrollment and required at sign-in for
  enrolled accounts. Unenrolled users see a setup/skip offer before the workspace.
- Upload byte, parser time, text, and memory limits; bounded processing and
  visible local fallbacks for unavailable AI.
- Nonce-based content security policy, HTTPS hosting, safe error responses, and
  metadata-only application logs.
- Automated regression, browser, type, lint, build, and dependency checks in CI.
  JSON export/import offers user-managed recovery.

## Required checks before a broader launch

| Area | Remaining evidence or work |
| --- | --- |
| Live authentication | Complete a real Google consent/sign-in on desktop and mobile, including Safari and popup-blocking settings. Emulator tests cannot certify Google's live consent service. |
| Monitoring and support | Confirm uptime/error alerts reach an accountable operator and test their delivery. Repository logging does not prove external alerts are configured. |
| Recovery | Define backup retention and a recovery target; demonstrate restoring Firestore data in an isolated environment. User JSON exports are not an operator disaster-recovery plan. |
| Privacy and account lifecycle | Publish a privacy notice and implement/test an account-and-data deletion workflow. Current sign-out and application deletion do not delete an entire account. |
| Capacity and cost | Validate expected concurrent traffic and edge/WAF limits. Before enabling paid AI, confirm live Redis guards, provider access, and provider-side spend limits described in DEPLOYMENT.md. |
| Release process | Confirm branch protection, required CI checks, and a tested rollback procedure. The workflow file alone does not prove repository protections are enabled. |

Google sign-in uses the same Firebase UID model, token validation, and workspace
rules; it does not replace these checks. A real Google account password is never
entered into ACA or an automated test.

See FIREBASE_SETUP.md for configuration and test instructions, DEPLOYMENT.md for
hosting/AI safeguards, and PRE_PROD_AUDIT.md for historical findings and their
remediation status. Historical test and audit counts are dated evidence, not a
current security certification.
The current feature inventory, test record, and prioritized findings are in
[ACA_AUDIT_REPORT.md](ACA_AUDIT_REPORT.md).
