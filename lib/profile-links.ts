/** Extract contact links without fetching any resume-supplied URL. */
function normalizeWebUrl(value: string): URL | undefined {
  if (value.length > 2000 || !/^(?:https?:\/\/|www\.|(?:github|(?:[\w-]+\.)?linkedin)\.com\/)/i.test(value)) return;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.href.length > 2000) return;
    return url;
  } catch { return; }
}
function host(url: URL) { return url.hostname.toLowerCase().replace(/^www\./, ''); }
// Country and mobile LinkedIn hosts (uk., in., mobile.) are the same service.
const isLinkedIn = (url: URL) => /^(?:[\w-]+\.)?linkedin\.com$/.test(host(url));

export function extractProfileLinks(header: string, embeddedLinks: string[] = []) {
  // PDF text fragments sometimes put a space between the domain, slash and handle.
  const text = header.replace(/\b((?:https?:\/\/)?(?:www\.)?(?:github\.com|linkedin\.com))\s*\/\s*/gi, '$1/')
    .replace(/\b(linkedin\.com\/in)\s*\/\s*/gi, '$1/');
  const matches = text.matchAll(/(?<![\w@./-])(?:(?:https?:\/\/|www\.)[^\s<>"|]+|(?:github\.com|(?:[\w-]+\.)?linkedin\.com)\/[^\s<>"|]+)/gi);
  const visible = Array.from(matches, match => match[0].replace(/[),.;:!?\]}]+$/, ''));
  const urls: URL[] = [];
  const seen = new Set<string>();
  for (const value of [...visible, ...embeddedLinks.slice(0, 100)]) {
    const url = normalizeWebUrl(value);
    if (!url || seen.has(url.href)) continue;
    seen.add(url.href); urls.push(url);
  }
  // Check the actual hostname, so lookalike domains cannot become GitHub contacts.
  const githubLinks = urls.filter(url => host(url) === 'github.com' && url.pathname !== '/');
  const github = githubLinks.find(url => /^\/[^/]+\/?$/.test(url.pathname)) || githubLinks[0];
  const linkedin = urls.find(url => isLinkedIn(url) && /^\/in\/[^/]+\/?$/.test(url.pathname));
  const portfolioHosts = ['behance.net', 'dribbble.com', 'codepen.io', 'codesandbox.io'];
  const portfolio = urls.find(url => host(url) !== 'github.com' && !isLinkedIn(url) && (portfolioHosts.includes(host(url)) || /portfolio|personal-site|website/i.test(url.pathname)));
  const website = urls.find(url => url !== portfolio && !isLinkedIn(url) && !['github.com', ...portfolioHosts].includes(host(url))) || portfolio;
  const formatted = (url: URL | undefined) => url?.href.replace(/\/+$/, '');
  return { github: formatted(github), linkedin: formatted(linkedin), portfolio: formatted(portfolio), website: formatted(website) };
}
