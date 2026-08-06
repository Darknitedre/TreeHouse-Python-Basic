import type { SupabaseClient } from "@supabase/supabase-js";
import { startOfWeek, toDateOnly } from "../utils";
import type { SavedPost, ActionItem } from "../types";

export interface WeeklyData {
  weekStart: string;
  weekEnd: string;
  posts: SavedPost[];
  newActionItems: ActionItem[];
  completedActionItems: ActionItem[];
  overdueActionItems: ActionItem[];
  unreviewedPosts: SavedPost[];
  topLessons: string[];
}

export async function getWeeklyData(
  supabase: SupabaseClient,
  userId: string,
  weekStartDate?: Date,
): Promise<WeeklyData> {
  const start = startOfWeek(weekStartDate ?? new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const today = toDateOnly(new Date());

  const [{ data: posts }, { data: newItems }, { data: completed }, { data: overdue }] =
    await Promise.all([
      supabase
        .from("saved_posts")
        .select("*")
        .eq("user_id", userId)
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .order("created_at", { ascending: false }),
      supabase
        .from("action_items")
        .select("*")
        .eq("user_id", userId)
        .gte("created_at", startIso)
        .lt("created_at", endIso),
      supabase
        .from("action_items")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "completed")
        .gte("completed_at", startIso)
        .lt("completed_at", endIso),
      supabase
        .from("action_items")
        .select("*")
        .eq("user_id", userId)
        .lt("due_date", today)
        .in("status", ["not_started", "in_progress", "deferred"]),
    ]);

  const postList = (posts ?? []) as SavedPost[];
  const unreviewedPosts = postList.filter((p) => !p.reviewed && !p.archived);
  const topLessons = postList
    .map((p) => p.key_takeaway)
    .filter((k): k is string => !!k)
    .slice(0, 5);

  return {
    weekStart: toDateOnly(start),
    weekEnd: toDateOnly(new Date(end.getTime() - 86_400_000)),
    posts: postList,
    newActionItems: (newItems ?? []) as ActionItem[],
    completedActionItems: (completed ?? []) as ActionItem[],
    overdueActionItems: (overdue ?? []) as ActionItem[],
    unreviewedPosts,
    topLessons,
  };
}
