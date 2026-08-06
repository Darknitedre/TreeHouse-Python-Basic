import Link from "next/link";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui";
import { PostCardGrid } from "@/components/post-card";
import { LibraryControls } from "@/components/library-controls";
import { Icon } from "@/components/icons";
import type { SavedPost, Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: { q?: string; category_id?: string; priority?: string; reviewed?: string; archived?: string };
}) {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = createClient();

  const { data: cats } = await supabase
    .from("categories")
    .select("*")
    .eq("user_id", user.id)
    .order("name");

  let query = supabase
    .from("saved_posts")
    .select("*")
    .eq("user_id", user.id)
    .eq("archived", searchParams.archived === "true")
    .order("created_at", { ascending: false })
    .limit(60);

  if (searchParams.category_id) query = query.eq("category_id", searchParams.category_id);
  if (searchParams.priority) query = query.eq("priority", searchParams.priority);
  if (searchParams.reviewed === "false") query = query.eq("reviewed", false);
  if (searchParams.q?.trim()) {
    query = query.textSearch("search_vector", searchParams.q.trim(), {
      type: "websearch",
      config: "english",
    });
  }

  const { data } = await query;
  const posts = (data ?? []) as SavedPost[];

  return (
    <div>
      <PageHeader
        title="Library"
        subtitle={`${posts.length} post${posts.length === 1 ? "" : "s"}`}
        action={
          <Link href="/save" className="btn-primary btn-sm">
            <Icon name="plus" width={16} height={16} /> Save
          </Link>
        }
      />
      <LibraryControls categories={(cats ?? []) as Category[]} />
      {posts.length === 0 ? (
        <EmptyState
          title="No posts match"
          hint="Try clearing filters, or save your first post."
          action={
            <Link href="/save" className="btn-primary btn-sm mt-1">
              Save a post
            </Link>
          }
        />
      ) : (
        <PostCardGrid posts={posts} />
      )}
    </div>
  );
}
