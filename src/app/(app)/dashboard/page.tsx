import Link from "next/link";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { getDashboardStats } from "@/lib/db/dashboard";
import { StatTile, PageHeader, Card, PriorityBadge, EmptyState } from "@/components/ui";
import { PostCard } from "@/components/post-card";
import { Icon } from "@/components/icons";
import { formatDate, isOverdue } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = createClient();
  const stats = await getDashboardStats(supabase, user.id);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Your saved knowledge, turned into action."
        action={
          <Link href="/save" className="btn-primary btn-sm">
            <Icon name="plus" width={16} height={16} /> Save Post
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Total saved" value={stats.totalPosts} accent />
        <StatTile label="This week" value={stats.postsThisWeek} />
        <StatTile label="Open tasks" value={stats.openActionItems} />
        <StatTile label="Overdue" value={stats.overdueActionItems} />
        <StatTile label="Completed" value={stats.completedActionItems} />
        <StatTile label="Unreviewed" value={stats.unreviewedPosts} />
      </div>

      {/* Turn Knowledge Into Action */}
      <Card className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-brand">
            <Icon name="sparkles" width={18} height={18} />
          </span>
          <h2 className="font-semibold">Turn Knowledge Into Action</h2>
        </div>
        {stats.knowledgeIntoAction.length === 0 ? (
          <p className="muted text-sm">
            No open action items yet. Save a post and we&apos;ll generate concrete next steps.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {stats.knowledgeIntoAction.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="text-xs muted">
                    {item.due_date ? (
                      <span className={isOverdue(item.due_date, item.status) ? "text-red-500" : ""}>
                        Due {formatDate(item.due_date + "T00:00:00")}
                      </span>
                    ) : (
                      "No due date"
                    )}
                    {item.estimated_effort ? ` · ${item.estimated_effort}` : ""}
                  </p>
                </div>
                <PriorityBadge priority={item.priority} />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <Link href="/action-items" className="text-sm text-brand">
            View all action items →
          </Link>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Recently saved</h2>
            <Link href="/library" className="text-sm text-brand">
              Library →
            </Link>
          </div>
          {stats.recentPosts.length === 0 ? (
            <EmptyState
              title="Nothing saved yet"
              hint="Save your first post to get started."
              action={
                <Link href="/save" className="btn-primary btn-sm mt-1">
                  Save a post
                </Link>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {stats.recentPosts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-3 font-semibold">Top categories</h2>
            {stats.topCategories.length === 0 ? (
              <p className="muted text-sm">No categories yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {stats.topCategories.map((c) => (
                  <li key={c.name} className="flex items-center justify-between text-sm">
                    <span>{c.name}</span>
                    <span className="badge bg-surface-2 text-muted">{c.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">High priority</h2>
            {stats.highPriorityPosts.length === 0 ? (
              <p className="muted text-sm">No high-priority posts.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {stats.highPriorityPosts.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/library/${p.id}`}
                      className="line-clamp-1 text-sm hover:text-brand"
                    >
                      {p.title || p.summary || "Untitled"}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
