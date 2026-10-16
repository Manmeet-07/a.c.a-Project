import { CandidateProfile } from "@/types/profile";

/**
 * Builds a "javascript:" bookmarklet URI that, when clicked while viewing a
 * real job application page, fills recognizable name/email/phone fields
 * from the candidate's own profile.
 *
 * This intentionally does NOT: submit any form, run headless/unattended,
 * rotate IPs, spoof browser fingerprints, or try to defeat bot detection.
 * It runs once, synchronously, inside the user's own authenticated browser
 * tab when *they* click it -- functionally the same category of tool as a
 * password manager's form-fill, or the "Point Extensions" (Teal/Simplify)
 * the spec names as prior art. The user reviews and submits manually.
 */
export function buildAutofillBookmarklet(profile: CandidateProfile): string {
  const [firstName, ...rest] = profile.name.trim().split(/\s+/).filter(Boolean);
  const lastName = rest.join(" ");

  const data = {
    name: profile.name || "",
    firstName: firstName || "",
    lastName: lastName || "",
    email: profile.email || "",
    phone: profile.phone || "",
    address: profile.address || "",
    city: profile.city || "",
    state: profile.state || "",
    postalCode: profile.postalCode || "",
    linkedin: profile.linkedin || "",
    github: profile.github || "",
    portfolio: profile.portfolio || "",
    website: profile.website || "",
  };

  const serializedData = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

  const script = String.raw`(function(){
  var data = ${serializedData};
  function setNativeValue(el, value) {
    var proto = Object.getPrototypeOf(el);
    var desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) { desc.set.call(el, value); } else { el.value = value; }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function fieldLabel(el) {
    var labels = el.labels ? Array.prototype.map.call(el.labels, function(lbl) { return lbl.innerText; }).filter(Boolean) : [];
    var parent = el.closest('label');
    var text = el.getAttribute('aria-label') || labels[0] || (parent && parent.innerText) || el.placeholder || el.name || el.id || '';
    return text.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').replace(/\s*\*\s*$/, '').trim();
  }

  function shouldReplace(el, label) {
    var current = (el.value || '').trim();
    if (!current) return true;
    var placeholder = el.placeholder || '';
    var aria = el.getAttribute('aria-label') || '';
    if (current === placeholder.trim() || current === aria.trim() || current === label.trim()) return true;
    return false;
  }
  function normalizeUrl(value) {
    return value.replace(/\/+$/, '');
  }
  var fields = Array.prototype.slice.call(document.querySelectorAll('input'));
  var filled = 0;
  fields.forEach(function (el) {
    if (!/^(text|email|tel|url|search)?$/i.test(el.type) || el.tagName === 'TEXTAREA' || el.disabled || el.readOnly) return;
    var label = fieldLabel(el);
    if (label.length > 40 || /\?|company|employer|refer|emergency|school|university|username|security|password|start|\b(day|date)\b/.test(label)) return;
    if (!shouldReplace(el, label)) return;
    var field = null;
    var autocomplete = (el.getAttribute('autocomplete') || '').trim().split(/\s+/).pop();
    var standard = { 'given-name':'firstName', 'family-name':'lastName', name:'name', email:'email', tel:'phone', 'postal-code':'postalCode', 'address-level1':'state', 'address-level2':'city', 'street-address':'address', 'address-line1':'address', url:'website' };
    if (standard[autocomplete]) field = standard[autocomplete];
    else if (/^(legal )?first name$/.test(label)) field = 'firstName';
    else if (/^(legal )?(last name|surname|family name)$/.test(label)) field = 'lastName';
    else if (/^(legal |full |your )?name$/.test(label)) field = 'name';
    else if (/^(e ?mail|email address)$/.test(label)) field = 'email';
    else if (/^(phone|mobile|telephone|tel)( number)?$/.test(label)) field = 'phone';
    else if (/^(street address|address|address line 1)$/.test(label)) field = 'address';
    else if (/^city$/.test(label)) field = 'city';
    else if (/^(state|province|state province)$/.test(label)) field = 'state';
    else if (/^(zip|zip code|postal code)$/.test(label)) field = 'postalCode';
    else if (/^linkedin( url| profile)?$/.test(label)) field = 'linkedin';
    else if (/^github( url| profile)?$/.test(label)) field = 'github';
    else if (/^portfolio( url)?$/.test(label)) field = 'portfolio';
    else if (/^(website|personal website|website url)$/.test(label)) field = 'website';
    if (el.type === 'email' && field !== 'email') return;
    if (el.type === 'tel' && field !== 'phone') return;
    if (el.type === 'url' && !/^(website|portfolio|linkedin|github)$/.test(field || '')) return;
    var value = field && data[field];
    if (value && /^(website|portfolio|linkedin|github)$/.test(field)) value = normalizeUrl(value);
    if (value) { setNativeValue(el, value); filled++; }
  });
  window.alert('ACA Fill-Assist filled ' + filled + ' field(s). Review everything before submitting -- nothing was submitted automatically.');
})();`;

  return `javascript:${encodeURIComponent(script)}`;
}
