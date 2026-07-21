const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'igshid',
  'igsh',
  'fbclid',
  'si',
  'ref',
  '_r',
];

/** Strips tracking params and trailing slashes so the same content saved twice hashes the same. */
export function normalizeUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl.trim());
    TRACKING_PARAMS.forEach((p) => u.searchParams.delete(p));
    const sortedParams = Array.from(u.searchParams.entries()).sort(([a], [b]) => a.localeCompare(b));
    u.search = '';
    sortedParams.forEach(([k, v]) => u.searchParams.append(k, v));
    let normalized = `${u.hostname.toLowerCase()}${u.pathname.replace(/\/+$/, '')}`;
    if (u.search) normalized += u.search;
    return normalized;
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

/** Simple, fast, non-cryptographic hash (djb2) — good enough to key duplicate detection. */
export function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export function hashUrl(rawUrl: string): string {
  return hashString(normalizeUrl(rawUrl));
}
