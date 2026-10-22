import { isSafePublicUrl, detectPlatform } from "../utils";
import type { Platform } from "../constants";

export interface UrlMetadata {
  url: string;
  platform: Platform;
  title?: string;
  description?: string;
  author?: string;
  thumbnail?: string;
  publishedAt?: string;
  siteName?: string;
  fetched: boolean;
  note?: string;
}

/**
 * Fetch publicly-available metadata for a URL (Open Graph / Twitter card / meta
 * tags). This ONLY reads public HTML — it never authenticates, submits
 * credentials, or bypasses platform restrictions. Many platforms block bots or
 * require login; in that case we return whatever we can (usually just the
 * platform + URL) with `fetched: false`.
 */
export async function fetchUrlMetadata(rawUrl: string): Promise<UrlMetadata> {
  const platform = detectPlatform(rawUrl);
  const base: UrlMetadata = { url: rawUrl, platform, fetched: false };

  if (!isSafePublicUrl(rawUrl)) {
    return { ...base, note: "URL rejected by safety validation." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(rawUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Identify as a link-preview bot; respect whatever the site returns.
        "user-agent": "SocialActionVaultBot/1.0 (+link-preview)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) {
      return { ...base, note: `Fetch returned ${res.status}; saved URL only.` };
    }
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return { ...base, note: "Non-HTML response; saved URL only." };
    }
    // Read at most ~512KB of HTML — meta tags live in <head>.
    const html = (await res.text()).slice(0, 512 * 1024);
    const meta = parseMeta(html);
    return {
      ...base,
      fetched: true,
      title: meta.title,
      description: meta.description,
      author: meta.author,
      thumbnail: meta.image,
      publishedAt: meta.publishedAt,
      siteName: meta.siteName,
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return { ...base, note: aborted ? "Fetch timed out; saved URL only." : "Fetch failed; saved URL only." };
  } finally {
    clearTimeout(timeout);
  }
}

interface ParsedMeta {
  title?: string;
  description?: string;
  author?: string;
  image?: string;
  publishedAt?: string;
  siteName?: string;
}

function parseMeta(html: string): ParsedMeta {
  const get = (patterns: RegExp[]): string | undefined => {
    for (const re of patterns) {
      const m = html.match(re);
      const value = m && (m[1] ?? m[2]);
      if (value) return decode(value.trim());
    }
    return undefined;
  };

  const ogTitle = get([metaRe("og:title"), metaRe("twitter:title")]);
  const htmlTitle = get([/<title[^>]*>([^<]+)<\/title>/i]);

  return {
    title: ogTitle || htmlTitle,
    description: get([
      metaRe("og:description"),
      metaRe("twitter:description"),
      metaNameRe("description"),
    ]),
    author: get([metaRe("author"), metaNameRe("author"), metaRe("article:author")]),
    image: get([metaRe("og:image"), metaRe("twitter:image"), metaRe("twitter:image:src")]),
    publishedAt: get([
      metaRe("article:published_time"),
      metaNameRe("date"),
      metaRe("og:updated_time"),
    ]),
    siteName: get([metaRe("og:site_name")]),
  };
}

// property="og:x" content="..." (either attribute order)
function metaRe(prop: string): RegExp {
  const p = escapeRe(prop);
  return new RegExp(
    `<meta[^>]+(?:property|name)=["']${p}["'][^>]*content=["']([^"']*)["']` +
      `|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${p}["']`,
    "i",
  );
}
function metaNameRe(name: string): RegExp {
  return metaRe(name);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}
