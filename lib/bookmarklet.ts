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
  function labelText(node) {
    if (!node) return '';
    if (!node.cloneNode) return node.innerText || node.textContent || '';
    var copy = node.cloneNode(true);
    Array.prototype.forEach.call(copy.querySelectorAll('input, textarea, select, button'), function(control) { control.remove(); });
    return copy.textContent || '';
  }
  function clean(text) {
    return text.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/\bgit hub\b/g, 'github').replace(/\blinked in\b/g, 'linkedin').replace(/[_\-\/\[\]]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function idText(ids) {
    return (ids || '').split(/\s+/).map(function(id) { var node = id && document.getElementById && document.getElementById(id); return node && node.textContent || ''; }).join(' ').trim();
  }
  function fieldLabel(el) {
    var labels = el.labels ? Array.prototype.map.call(el.labels, labelText).filter(Boolean) : [];
    var parent = el.closest('label');
    var text = el.getAttribute('aria-label') || idText(el.getAttribute('aria-labelledby')) || labels[0] || labelText(parent) || el.placeholder || el.name || el.id || '';
    // Trailing required/optional markers: "*", "✱", ":", "(required)", "(optional)".
    return clean(text).replace(/(?:\s*(?:\((?:required|optional)\)|[^\p{L}\p{N}\s?)]))+$/u, '').trim();
  }
  // The chosen label alone ("Name") can't tell the candidate's fields from an
  // emergency contact's, a reference's or an employer's, so also look at the
  // field's name/id, autocomplete section, hint text and fieldset legends.
  function fieldContext(el) {
    var parts = [el.name, el.id, el.getAttribute('autocomplete'), idText(el.getAttribute('aria-describedby'))];
    for (var set = el.closest('fieldset'); set; set = set.parentElement && set.parentElement.closest('fieldset')) {
      var legend = set.querySelector(':scope > legend');
      if (legend) parts.push(legend.textContent);
    }
    return clean(parts.filter(Boolean).join(' '));
  }
  // Nearest heading before the field, without leaving its form.
  function sectionHeading(el) {
    for (var node = el, depth = 0; node && node.tagName !== 'BODY' && depth < 8; node = node.parentElement, depth++) {
      for (var sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) {
        if (/^H[1-6]$/.test(sib.tagName)) return sib.textContent || '';
        var inner = sib.querySelectorAll('h1, h2, h3, h4, h5, h6');
        if (inner.length) return inner[inner.length - 1].textContent || '';
      }
      if (node.tagName === 'FORM') break;
    }
    return '';
  }
  // Honeypots and controls hidden by visibility, opacity or off-screen
  // positioning are not something the user can see or review.
  function invisible(el) {
    if (el.getClientRects && !el.getClientRects().length) return true;
    if (el.checkVisibility) {
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, opacityProperty: true, visibilityProperty: true })) return true;
    } else if (window.getComputedStyle && el.nodeType === 1) {
      var style = window.getComputedStyle(el);
      if (style.visibility !== 'visible' || style.opacity === '0') return true;
    }
    if (!el.getBoundingClientRect) return false;
    var box = el.getBoundingClientRect();
    return box.width <= 1 || box.height <= 1 || box.right + (window.scrollX || 0) <= 0 || box.bottom + (window.scrollY || 0) <= 0;
  }
  function linkKind(label) {
    var match = label.match(/\b(linkedin|github|portfolio)\b/);
    if (!match) return null;
    var rest = label.replace(match[0], '').replace(/\b(your|my|the|to|personal|public|profile|page|url|link|website|site|address|account|optional)\b/g, '');
    return /[\p{L}\p{N}]/u.test(rest) ? null : match[1];
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
    if (tag === 'INPUT' && !/^(text|email|tel|url|search|number)?$/i.test(el.type)) return;
    if (el.disabled || el.readOnly || (el.matches && el.matches(':disabled')) || invisible(el)) return;
    var label = fieldLabel(el);
    if (label.length > 40 || /\?|username|security|password|start|\b(day|date)\b/.test(label)) return;
    if (/company|employer|organi[sz]ation|\brefer|emergency|school|university|college|guardian|next of kin|supervisor/.test(label + ' ' + fieldContext(el))) return;
    // Headings get a narrower test: a page title like "Join our company" sits above every field.
    if (/employer|\brefer|emergency|next of kin|guardian|supervisor/.test(clean(sectionHeading(el)))) return;
    if (!shouldReplace(el, label)) return;
    var field = null;
    var autocomplete = (el.getAttribute('autocomplete') || '').trim().split(/\s+/).pop();
    if (/^organization/.test(autocomplete)) return;
    var standard = { 'given-name':'firstName', 'family-name':'lastName', name:'name', email:'email', tel:'phone', 'postal-code':'postalCode', 'address-level1':'state', 'address-level2':'city', 'street-address':'address', 'address-line1':'address', url:'website' };
    // Generic autocomplete="url" must not turn a GitHub/LinkedIn/Twitter
    // field into the candidate's personal website.
    var linkField = linkKind(label);
    var otherSite = /\b(linkedin|github|gitlab|bitbucket|twitter|x|facebook|instagram|threads|mastodon|dribbble|behance|medium|youtube|tiktok|kaggle|stack ?overflow|social|other)\b/.test(label);
    if (linkField && (!standard[autocomplete] || autocomplete === 'url')) field = linkField;
    else if (standard[autocomplete] && !(autocomplete === 'url' && otherSite)) field = standard[autocomplete];
    else if (/^(legal )?first name$/.test(label)) field = 'firstName';
    else if (/^(legal )?(last name|surname|family name)$/.test(label)) field = 'lastName';
    else if (/^(legal |full |your )?name$/.test(label)) field = 'name';
    else if (/^(e ?mail|email address)$/.test(label)) field = 'email';
    else if (/^((mobile|cell|cellular|primary|preferred|home|personal) )?(phone|mobile|telephone|tel|cell)( number)?$|^contact number$/.test(label)) field = 'phone';
    else if (/^(street address|address|address line 1)$/.test(label)) field = 'address';
    else if (/^city$/.test(label)) field = 'city';
    else if (/^(state|province|region|state (or )?(province|region)|province (or )?state)$/.test(label)) field = 'state';
    else if (/^(zip|postcode|post code|(zip |postal |zip postal |postal zip )code)$/.test(label)) field = 'postalCode';
    else if (/^(website|personal website|website url)$/.test(label)) field = 'website';
    if (el.type === 'email' && field !== 'email') return;
    if (el.type === 'tel' && field !== 'phone') return;
    if (el.type === 'url' && !/^(website|portfolio|linkedin|github)$/.test(field || '')) return;
    if (el.type === 'number' && (field !== 'postalCode' || !/^\d+$/.test(data.postalCode))) return;
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
