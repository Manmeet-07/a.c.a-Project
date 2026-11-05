# ACA documentation

Use the [project README](../README.md) for the product overview, technology stack,
local startup commands, and feature matrix. This directory contains the detailed
guides and dated engineering records.

## Guides by audience

| Audience | Start here | Purpose |
| --- | --- | --- |
| Developers | [Firebase setup](getting-started/firebase.md) | Configure identity, private data, domains, and local verification. |
| Deployment operators | [Vercel deployment](deployment/vercel.md) | Configure hosting, optional AI services, limits, and monitoring. |
| Security reviewers | [Two-factor authentication](security/two-factor-authentication.md) | Understand enrollment, sign-in challenges, recovery, and test boundaries. |
| Release owners | [Production readiness](security/production-readiness.md) | Review the launch checklist and unresolved operational work. |
| Testers | [Fill-Assist verification](testing/fill-assist.md) | Reproduce the resume-to-form browser flow and understand coverage. |
| Recruiters and candidates | [Project presentation guide](project/recruiter-guide.md) | Prepare a project pitch, demonstration, and technical discussion. |

## Dated assessments

| Record | Date | How to use it |
| --- | --- | --- |
| [Engineering and security audit](security/audit-2026-10-21.md) | 2026-10-21 | Evidence and findings for that reviewed changeset; not a certification of later commits. |
| [Historical records](archive/README.md) | 2026-10-15–2026-10-16 | Original plans, remediation findings, and early autofill results. |

## Documentation conventions

- Current guides describe the repository's implementation and commands. External
  account settings still require verification in the relevant service.
- Dated assessments retain their original scope and test results. They must not
  be presented as fresh test evidence after subsequent changes.
- Source paths shown in backticks are relative to the repository root unless a
  guide explicitly says otherwise. Markdown links resolve from each guide.
- Secrets, personal resumes, credentials, and authenticator setup keys do not
  belong in documentation or screenshots.

`AGENTS.md` and `CLAUDE.md` remain in the repository root because development
tools use those locations. They are tool instructions, not product guides.
