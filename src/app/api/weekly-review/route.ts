import { requireUser, json, error, rateLimit } from "@/lib/api";
import { getWeeklyData } from "@/lib/db/weekly";
import { generateWeeklyReport } from "@/lib/ai/process";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/weekly-review — the current week's data + any stored AI report.
export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  const data = await getWeeklyData(supabase, user.id);
  const { data: stored } = await supabase
    .from("weekly_reviews")
    .select("report")
    .eq("user_id", user.id)
    .eq("week_start", data.weekStart)
    .maybeSingle();

  return json({ data, report: stored?.report ?? null });
}

// POST /api/weekly-review — generate (and store) the AI knowledge-and-action report.
export async function POST() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  if (!rateLimit(`weekly:${user.id}`, 5, 60_000)) {
    return error("Too many requests, slow down a moment.", 429);
  }

  const data = await getWeeklyData(supabase, user.id);
  const report = await generateWeeklyReport({
    week: `${data.weekStart} to ${data.weekEnd}`,
    posts: data.posts.map((p) => ({
      title: p.title,
      summary: p.summary,
      key_takeaway: p.key_takeaway,
      category: p.project_area,
      priority: p.priority,
    })),
    new_action_items: data.newActionItems.map((a) => ({ title: a.title, priority: a.priority })),
    completed_action_items: data.completedActionItems.map((a) => a.title),
    overdue_action_items: data.overdueActionItems.map((a) => a.title),
    unreviewed_count: data.unreviewedPosts.length,
  });

  if (!report) return error("Could not generate report; try again.", 502);

  await supabase.from("weekly_reviews").upsert(
    {
      user_id: user.id,
      week_start: data.weekStart,
      week_end: data.weekEnd,
      report,
      stats: {
        posts: data.posts.length,
        new_action_items: data.newActionItems.length,
        completed: data.completedActionItems.length,
        overdue: data.overdueActionItems.length,
      },
    },
    { onConflict: "user_id,week_start" },
  );

  return json({ report });
}
