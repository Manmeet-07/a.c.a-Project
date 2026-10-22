"use client";

const KEY = "aca:mfa-offer-dismissed";

// This is a UI preference, never proof of enrollment or authorization. A missing
// or unavailable session store must not prevent choosing “Not now”.
export function readMfaOfferChoice(userId: string): boolean {
  try { return window.sessionStorage.getItem(KEY) === userId; }
  catch { return false; }
}
export function saveMfaOfferChoice(userId: string) {
  try { window.sessionStorage.setItem(KEY, userId); }
  catch { /* The provider retains the choice in memory for this session. */ }
}
export function clearMfaOfferChoice() {
  try { window.sessionStorage.removeItem(KEY); }
  catch { /* No persistent choice exists when session storage is unavailable. */ }
}
