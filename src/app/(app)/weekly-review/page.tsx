import Link from "next/link";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { getWeeklyData } from "@/lib/db/weekly";
import { PageHeader, StatTile, Card } from "@/components/ui";
import { WeeklyReport } from "@/components/weekly-report";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function WeeklyReviewPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = createClient();

  const data = await getWeeklyData(supabase, user.id);
  const { data: stored } = await supabase
    .from("weekly_reviews")
    .select("report")
    .eq("user_id", user.id)
    .eq("week_start", data.weekStart)
    .maybeSingle();

  return (
    <div>
      <PageHeader
        title="Weekly Review"
        subtitle={`${formatDate(data.weekStart + "T00:00:00")} – ${formatDate(
          data.weekEnd + "T00:00:00",
        )}`}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Posts saved" value={data.posts.length} accent />
        <StatTile label="New tasks" value={data.newActionItems.length} />
        <StatTile label="Completed" value={data.completedActionItems.length} />
        <StatTile label="Overdue" value={data.overdueActionItems.length} />
      </div>

      <div className="mb-6">
        <WeeklyReport initial={(stored?.report as never) ?? null} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Most important lessons</h2>
          {data.topLessons.length === 0 ? (
            <p className="muted text-sm">No lessons captured this week.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {data.topLessons.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Not yet reviewed</h2>
          {data.unreviewedPosts.length === 0 ? (
            <p className="muted text-sm">All caught up — nothing to review.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {data.unreviewedPosts.slice(0, 8).map((p) => (
                <li key={p.id}>
                  <Link href={`/library/${p.id}`} className="line-clamp-1 hover:text-brand">
                    {p.title || p.summary || "Untitled"}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">New action items</h2>
          {data.newActionItems.length === 0 ? (
            <p className="muted text-sm">None created this week.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {data.newActionItems.slice(0, 8).map((a) => (
                <li key={a.id}>{a.title}</li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Overdue tasks</h2>
          {data.overdueActionItems.length === 0 ? (
            <p className="muted text-sm">Nothing overdue. Nice.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {data.overdueActionItems.slice(0, 8).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <span className="line-clamp-1">{a.title}</span>
                  <span className="text-xs text-red-500">{a.due_date}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
