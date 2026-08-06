import { NextResponse } from "next/server";
import { createClient } from "./supabase/server";
import type { User } from "@supabase/supabase-js";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function error(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/**
 * Resolve the authenticated user for a route handler. Returns the user and a
 * request-scoped Supabase client (RLS-bound to that user), or an error response.
 */
export async function requireUser(): Promise<
  | { user: User; supabase: ReturnType<typeof createClient>; response?: never }
  | { user?: never; supabase?: never; response: NextResponse }
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { response: error("Not authenticated", 401) };
  }
  return { user, supabase };
}

// ---------------------------------------------------------------------
// Very small in-memory rate limiter. Good enough for a single-instance MVP;
// swap for a Redis/Upstash limiter in production behind multiple instances.
// ---------------------------------------------------------------------
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}
