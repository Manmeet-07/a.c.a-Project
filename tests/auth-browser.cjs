/* eslint-disable @typescript-eslint/no-require-imports */
// This entry point must be launched by the Auth + Firestore emulator runner.
process.env.ACA_AUTH_E2E = 'true';
require('./browser-harness.cjs');
