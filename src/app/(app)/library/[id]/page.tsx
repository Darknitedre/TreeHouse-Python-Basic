import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { PostDetail } from "@/components/post-detail";
import type { SavedPost, ActionItem, Category, Tag } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PostPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = createClient();

  const { data: post } = await supabase
    .from("saved_posts")
    .select("*, category:categories(*), tags:post_tags(tag:tags(*))")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!post) notFound();

  const [{ data: actionItems }, { data: notes }, { data: categories }] = await Promise.all([
    supabase
      .from("action_items")
      .select("*")
      .eq("post_id", params.id)
      .eq("user_id", user.id)
      .order("created_at"),
    supabase
      .from("personal_notes")
      .select("*")
      .eq("post_id", params.id)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1),
    supabase.from("categories").select("*").eq("user_id", user.id).order("name"),
  ]);

  // Related posts: same category, most recent.
  let relatedPosts: SavedPost[] = [];
  if (post.category_id) {
    const { data: related } = await supabase
      .from("saved_posts")
      .select("*")
      .eq("user_id", user.id)
      .eq("category_id", post.category_id)
      .eq("archived", false)
      .neq("id", params.id)
      .order("created_at", { ascending: false })
      .limit(4);
    relatedPosts = (related ?? []) as SavedPost[];
  }

  const rawTags = (post.tags as Array<{ tag: Tag }> | undefined) ?? [];
  const normalized = { ...post, tags: rawTags.map((t) => t.tag).filter(Boolean) } as SavedPost & {
    category?: Category | null;
    tags?: Tag[];
  };

  return (
    <div>
      <Link href="/library" className="mb-3 inline-block text-sm text-brand">
        ← Back to library
      </Link>
      <PostDetail
        post={normalized}
        actionItems={(actionItems ?? []) as ActionItem[]}
        note={(notes?.[0]?.body as string) ?? ""}
        categories={(categories ?? []) as Category[]}
        relatedPosts={relatedPosts}
      />
    </div>
  );
}
