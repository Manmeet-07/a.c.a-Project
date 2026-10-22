# Authenticator-app two-factor authentication

Immediately after a verified sign-in, users without enrolled factors see an
optional **Set up 2FA** / **Not now** step before their workspace opens. Setup
goes directly to identity confirmation. Not now is remembered for the current
tab's sign-in, survives a refresh when session storage is available, and clears
on sign-out. Storage failure retains an in-memory fallback. This preference is
never proof of enrollment and cannot skip an enrolled account's required code.

Users can also open **Security** from their workspace, confirm their password or
Google sign-in, scan a locally generated QR code (or enter its setup key), and
confirm a six-digit authenticator code. Setup stays incomplete until Firebase
accepts that code. Cancelling setup discards the displayed key.

After enrollment, email/password and Google sign-in handle Firebase's MFA
challenge before opening the workspace. Users can choose among their enrolled
authenticators. Another authenticator can be enrolled as a backup. Removing a
factor requires fresh authentication, including the existing MFA challenge, and
signs the user out afterward. Existing users are not enrolled automatically.

## Backend configuration

The existing project `aca-career-2026-mm07` already uses Identity Platform.
Optional TOTP MFA is enabled; billing and SMS were not enabled for this change.
The desired Identity Toolkit `mfa` configuration is in `config/firebase-mfa.json`:
optional enrollment, TOTP enabled, and one adjacent 30-second interval for clock
drift. Apply it using the authorized Admin API with `updateMask=mfa`, preserving
other configured providers. `firebase deploy --only auth` does not provision this
TOTP configuration. Do not switch the project to mandatory MFA inadvertently.

Identity Platform's Spark tier has daily active-user limits; consult Firebase's
current pricing/limits before expanding usage. Authenticator codes do not use SMS.

## Security and recovery

- Firebase validates codes and holds enrollment records. ACA never stores a
  client-editable “2FA enabled” flag to authorize access.
- Setup keys, QR contents, passwords, codes, and pending MFA sessions remain in
  client component state. They are not written to Firestore, localStorage, URLs,
  analytics, or application logs. QR generation uses a bundled library, not a
  third-party QR service.
- API token validation and private Firestore rules continue to apply. Previously
  issued ID tokens can remain valid until expiry; enrollment is not a promise of
  immediate revocation of every existing session.
- ACA does not issue recovery codes. Before enrollment, users acknowledge the
  need to protect their authenticator backup. They can enroll another
  authenticator from Security. A password reset does not bypass MFA.
- Losing every authenticator requires administrator-assisted recovery. Establish
  identity through a trusted support process before removing a factor; knowing
  an email address or UID is insufficient. Preserve other enrolled factors and
  consider revoking sessions as part of recovery. No public reset endpoint or
  password-only fallback is provided.

## Verification

`npm test` covers MFA resolver selection, malformed/wrong-factor rejection,
verified-email enrollment, fresh token refresh, user-bound reauthentication,
registered-factor removal, and safe error handling. `npm run test:e2e:auth`
continues to exercise existing email and Google flows with local emulators.

The installed Firebase Auth emulator implements SMS MFA, not TOTP. The opt-in
`tests/mfa-browser.cjs` helper therefore accepts an authorized Admin Auth instance,
an isolated Playwright page, the app origin, and explicit
`confirmTestAccountCreation: true`. It creates one synthetic verified account,
tests real Firebase enrollment/cancellation/incorrect codes/sign-in enforcement/
protected removal, and deletes only that account in `finally`. It does not log
keys, credentials, or screenshots. Run this only against an explicitly selected
project with suitable admin authorization, preferably staging. It is not part of
unattended CI and does not need a service-account key checked into the project.

Real Google-account MFA enrollment/reauthentication and authenticator scanning
on physical mobile devices still require a manual smoke check. The shared MFA
resolver supports both primary sign-in methods.

References: [Firebase TOTP MFA](https://firebase.google.com/docs/auth/web/totp-mfa),
[MFA user management](https://cloud.google.com/identity-platform/docs/work-with-mfa-users).
