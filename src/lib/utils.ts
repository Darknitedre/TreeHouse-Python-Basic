import { PLATFORMS, type Platform } from "./constants";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Best-effort platform detection from a URL host. Never throws.
 */
export function detectPlatform(url: string): Platform {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "other";
  }
  const map: Record<string, Platform> = {
    "instagram.com": "instagram",
    "tiktok.com": "tiktok",
    "facebook.com": "facebook",
    "fb.watch": "facebook",
    "linkedin.com": "linkedin",
    "x.com": "x",
    "twitter.com": "x",
    "youtube.com": "youtube",
    "youtu.be": "youtube",
    "reddit.com": "reddit",
    "threads.net": "threads",
    "threads.com": "threads",
  };
  for (const [domain, platform] of Object.entries(map)) {
    if (host === domain || host.endsWith("." + domain)) return platform;
  }
  return "other";
}

export function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value);
}

/**
 * SSRF-safe URL check. Only http/https, and reject obvious private / loopback
 * / link-local hosts so a user-supplied URL can't be used to probe internal
 * services from the server.
 */
export function isSafePublicUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return false;
  }
  // IPv4 private ranges
  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10) return false;
    if (a === 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
  }
  // Unique-local / loopback IPv6
  if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) {
    return false;
  }
  return true;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const due = new Date(dateStr + "T00:00:00");
  if (isNaN(due.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export function isOverdue(dateStr: string | null | undefined, status: string): boolean {
  if (status === "completed" || status === "canceled") return false;
  const d = daysUntil(dateStr);
  return d !== null && d < 0;
}

export function startOfWeek(d = new Date()): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sun
  const diff = (day + 6) % 7; // days since Monday
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function truncate(text: string, max = 140): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}
