import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardStats, SavedPost, ActionItem } from "../types";
import { PRIORITY_RANK } from "../constants";
import { toDateOnly, startOfWeek } from "../utils";

/**
 * Compute the full dashboard payload for a user in a handful of queries.
 */
export async function getDashboardStats(
  supabase: SupabaseClient,
  userId: string,
): Promise<DashboardStats> {
  const weekStart = toDateOnly(startOfWeek());
  const today = toDateOnly(new Date());

  const [
    totalPosts,
    postsThisWeek,
    openActionItems,
    overdueActionItems,
    completedActionItems,
    unreviewedPosts,
  ] = await Promise.all([
    count(supabase, "saved_posts", (q) => q.eq("user_id", userId).eq("archived", false)),
    count(supabase, "saved_posts", (q) =>
      q.eq("user_id", userId).gte("created_at", weekStart),
    ),
    count(supabase, "action_items", (q) =>
      q.eq("user_id", userId).in("status", ["not_started", "in_progress"]),
    ),
    count(supabase, "action_items", (q) =>
      q
        .eq("user_id", userId)
        .lt("due_date", today)
        .in("status", ["not_started", "in_progress", "deferred"]),
    ),
    count(supabase, "action_items", (q) => q.eq("user_id", userId).eq("status", "completed")),
    count(supabase, "saved_posts", (q) =>
      q.eq("user_id", userId).eq("reviewed", false).eq("archived", false),
    ),
  ]);

  const { data: recentPosts } = await supabase
    .from("saved_posts")
    .select("*")
    .eq("user_id", userId)
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .limit(6);

  const { data: highPriorityPosts } = await supabase
    .from("saved_posts")
    .select("*")
    .eq("user_id", userId)
    .eq("archived", false)
    .in("priority", ["high", "urgent"])
    .order("created_at", { ascending: false })
    .limit(6);

  // Top categories by post count.
  const { data: catRows } = await supabase
    .from("saved_posts")
    .select("category:categories(name)")
    .eq("user_id", userId)
    .eq("archived", false)
    .not("category_id", "is", null);
  const catCounts = new Map<string, number>();
  (catRows ?? []).forEach((r) => {
    const name = (r.category as { name?: string } | null)?.name;
    if (name) catCounts.set(name, (catCounts.get(name) ?? 0) + 1);
  });
  const topCategories = Array.from(catCounts.entries())
    .map(([name, c]) => ({ name, count: c }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // "Turn Knowledge Into Action": most important unfinished items.
  const { data: openItems } = await supabase
    .from("action_items")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["not_started", "in_progress"])
    .limit(50);
  const knowledgeIntoAction = (openItems ?? [])
    .sort(
      (a, b) =>
        PRIORITY_RANK[a.priority as keyof typeof PRIORITY_RANK] -
          PRIORITY_RANK[b.priority as keyof typeof PRIORITY_RANK] ||
        dueSort(a.due_date, b.due_date),
    )
    .slice(0, 5) as ActionItem[];

  return {
    totalPosts,
    postsThisWeek,
    openActionItems,
    overdueActionItems,
    completedActionItems,
    unreviewedPosts,
    topCategories,
    recentPosts: (recentPosts ?? []) as SavedPost[],
    highPriorityPosts: (highPriorityPosts ?? []) as SavedPost[],
    knowledgeIntoAction,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function count(
  supabase: SupabaseClient,
  table: string,
  build: (q: any) => any,
): Promise<number> {
  const q = supabase.from(table).select("id", { count: "exact", head: true });
  const { count: c } = await build(q);
  return c ?? 0;
}

function dueSort(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}
