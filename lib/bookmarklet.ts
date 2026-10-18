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
    var labelledBy = (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(function(id) { var node = document.getElementById && document.getElementById(id); return node && node.textContent || ''; }).join(' ').trim();
    var text = el.getAttribute('aria-label') || labelledBy || labels[0] || (parent && parent.innerText) || el.placeholder || el.name || el.id || '';
    return text.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/\bgit hub\b/g, 'github').replace(/\blinked in\b/g, 'linkedin').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').replace(/\s*(?:\*|\(required\)|:)\s*$/, '').trim();
  }

  function shouldReplace(el, label) {
    var current = (el.value || '').trim();
    return !current;
  }
  function normalizeUrl(value) {
    return value.replace(/\/+$/, '');
  }
  function regionName(value) {
    var states = 'AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|DC:District of Columbia|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming|PR:Puerto Rico|GU:Guam|VI:Virgin Islands|AS:American Samoa|MP:Northern Mariana Islands';
    var entry = states.split('|').find(function(entry) { return entry.split(':')[0] === value.trim().toUpperCase(); });
    return (entry ? entry.split(':')[1] : value).trim().toLowerCase();
  }
  var fields = Array.prototype.slice.call(document.querySelectorAll('input, textarea, select'));
  var filled = 0;
  fields.forEach(function (el) {
    var tag = el.tagName || 'INPUT';
    if (tag === 'INPUT' && !/^(text|email|tel|url|search)?$/i.test(el.type)) return;
    if (el.disabled || el.readOnly || (el.matches && el.matches(':disabled')) || (el.getClientRects && !el.getClientRects().length)) return;
    var label = fieldLabel(el);
    if (label.length > 40 || /\?|company|employer|refer|emergency|school|university|username|security|password|start|\b(day|date)\b/.test(label)) return;
    if (!shouldReplace(el, label)) return;
    var field = null;
    var autocomplete = (el.getAttribute('autocomplete') || '').trim().split(/\s+/).pop();
    var standard = { 'given-name':'firstName', 'family-name':'lastName', name:'name', email:'email', tel:'phone', 'postal-code':'postalCode', 'address-level1':'state', 'address-level2':'city', 'street-address':'address', 'address-line1':'address', url:'website' };
    // Generic autocomplete="url" must not turn a GitHub/LinkedIn field into
    // the candidate's personal website.
    var linkField = /^linkedin(?: (?:url|profile|website|link))?$/.test(label) ? 'linkedin' : /^github(?: (?:url|profile|website|link))?$/.test(label) ? 'github' : /^portfolio(?: (?:url|website|link))?$/.test(label) ? 'portfolio' : null;
    if (linkField && (!autocomplete || autocomplete === 'url')) field = linkField;
    else if (standard[autocomplete]) field = standard[autocomplete];
    else if (/^(legal )?first name$/.test(label)) field = 'firstName';
    else if (/^(legal )?(last name|surname|family name)$/.test(label)) field = 'lastName';
    else if (/^(legal |full |your )?name$/.test(label)) field = 'name';
    else if (/^(e ?mail|email address)$/.test(label)) field = 'email';
    else if (/^(phone|mobile|telephone|tel)( number)?$/.test(label)) field = 'phone';
    else if (/^(street address|address|address line 1)$/.test(label)) field = 'address';
    else if (/^city$/.test(label)) field = 'city';
    else if (/^(state|province|state province|state or region)$/.test(label)) field = 'state';
    else if (/^(zip|zip code|postal code|zip \/ postal code)$/.test(label)) field = 'postalCode';
    else if (/^linkedin( url| profile)?$/.test(label)) field = 'linkedin';
    else if (/^github( url| profile)?$/.test(label)) field = 'github';
    else if (/^portfolio( url)?$/.test(label)) field = 'portfolio';
    else if (/^(website|personal website|website url)$/.test(label)) field = 'website';
    if (el.type === 'email' && field !== 'email') return;
    if (el.type === 'tel' && field !== 'phone') return;
    if (el.type === 'url' && !/^(website|portfolio|linkedin|github)$/.test(field || '')) return;
    if (tag === 'TEXTAREA' && field !== 'address') return;
    if (tag === 'SELECT' && !/^(state|city)$/.test(field || '')) return;
    var value = field && data[field];
    if (value && /^(website|portfolio|linkedin|github)$/.test(field)) value = normalizeUrl(value);
    if (value && tag === 'SELECT') {
      if (el.multiple) return;
      var option = Array.prototype.find.call(el.options, function(option) {
        var normalize = field === 'state' ? regionName : function(text) { return text.trim().toLowerCase(); };
        return option.value && !option.disabled && !(option.parentElement && option.parentElement.disabled) && (normalize(option.value) === normalize(value) || normalize(option.textContent) === normalize(value));
      });
      if (!option) return;
      value = option.value;
    }
    if (value) { setNativeValue(el, value); filled++; }
  });
  window.alert('ACA Fill-Assist filled ' + filled + ' field(s). Review everything before submitting -- nothing was submitted automatically.');
})();`;

  return `javascript:${encodeURIComponent(script)}`;
}
