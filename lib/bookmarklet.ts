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
    .replace(/\\u2028/g, "\\u2028")
    .replace(/\\u2029/g, "\\u2029");

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
    var text = [el.name, el.id, el.placeholder, el.title, el.getAttribute('aria-label'), el.getAttribute('data-testid')].join(' ');
    if (el.labels) Array.prototype.forEach.call(el.labels, function(lbl) { text += ' ' + lbl.innerText; });
    var parentLabel = el.closest('label');
    if (parentLabel) text += ' ' + parentLabel.innerText;
    return text.toLowerCase();
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
  var fields = Array.prototype.slice.call(document.querySelectorAll('input, textarea'));
  var filled = 0;
  fields.forEach(function (el) {
    if (/^(hidden|password|button|submit|reset|image|file|checkbox|radio)$/i.test(el.type) || el.disabled || el.readOnly) return;
    var label = fieldLabel(el);
    if (/company|employer|reference|emergency|school|university|username/.test(label)) return;
    if (!shouldReplace(el, label)) return;
    var value = null;
    if (/first(?:[\s_-]?name)?/.test(label) && data.firstName) value = data.firstName;
    else if (/last(?:[\s_-]?name)?|surname/.test(label) && data.lastName) value = data.lastName;
    else if (/full(?:[\s_-]?name)?|your(?:[\s_-]?name)?|\bname\b/.test(label) && data.name) value = data.name;
    else if (/e-?mail/.test(label) && data.email) value = data.email;
    else if (/phone|mobile|\btel(ephone)?\b/.test(label) && data.phone) value = data.phone;
    else if (/\baddress\b/.test(label) && !/address[\s_-]*(2|line[\s_-]*2)/.test(label) && data.address) value = data.address;
    else if (/\bcity\b/.test(label) && data.city) value = data.city;
    else if (/\bstate\b/.test(label) && data.state) value = data.state;
    else if (/\b(zip|postal|pin)\b/.test(label) && data.postalCode) value = data.postalCode;
    else if (/linkedin/.test(label) && data.linkedin) value = normalizeUrl(data.linkedin);
    else if (/github/.test(label) && data.github) value = normalizeUrl(data.github);
    else if (/portfolio/.test(label) && data.portfolio) value = normalizeUrl(data.portfolio);
    else if (/\b(url|website|web site|site)\b/.test(label) && data.website) value = normalizeUrl(data.website);
    if (value) { setNativeValue(el, value); filled++; }
  });
  window.alert('ACA Fill-Assist filled ' + filled + ' field(s). Review everything before submitting -- nothing was submitted automatically.');
})();`;

  return `javascript:${encodeURIComponent(script)}`;
}
