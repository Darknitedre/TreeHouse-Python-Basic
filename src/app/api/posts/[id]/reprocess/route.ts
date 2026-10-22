import { requireUser, json, error, rateLimit } from "@/lib/api";
import { processPost } from "@/lib/db/posts";
import type { SavedPost } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/posts/:id/reprocess — re-run the AI pipeline for a saved post.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  if (!rateLimit(`reprocess:${user.id}`, 15, 60_000)) {
    return error("Too many requests, slow down a moment.", 429);
  }

  const { data: post } = await supabase
    .from("saved_posts")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!post) return error("Not found", 404);

  const result = await processPost(supabase, user.id, post as SavedPost);

  const { data: finalPost } = await supabase
    .from("saved_posts")
    .select("*, category:categories(*), tags:post_tags(tag:tags(*))")
    .eq("id", params.id)
    .single();

  const rawTags = (finalPost?.tags as Array<{ tag: unknown }> | undefined) ?? [];
  return json({
    post: finalPost ? { ...finalPost, tags: rawTags.map((t) => t.tag).filter(Boolean) } : null,
    processing: result,
  });
}
