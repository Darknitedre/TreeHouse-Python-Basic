import { requireUser, json, error } from "@/lib/api";
import { UpdatePostSchema } from "@/lib/validation";
import { setPostTags } from "@/lib/db/posts";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// GET /api/posts/:id — full detail (post, category, tags, notes, action items).
export async function GET(_req: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  const { data: post, error: dbError } = await supabase
    .from("saved_posts")
    .select("*, category:categories(*), tags:post_tags(tag:tags(*))")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (dbError) return error(dbError.message, 500);
  if (!post) return error("Not found", 404);

  const { data: actionItems } = await supabase
    .from("action_items")
    .select("*")
    .eq("post_id", params.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const { data: notes } = await supabase
    .from("personal_notes")
    .select("*")
    .eq("post_id", params.id)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const rawTags = (post.tags as Array<{ tag: unknown }> | undefined) ?? [];
  return json({
    post: { ...post, tags: rawTags.map((t) => t.tag).filter(Boolean) },
    actionItems: actionItems ?? [],
    notes: notes ?? [],
  });
}

// PATCH /api/posts/:id — edit any AI-generated or manual field.
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("Invalid JSON body");
  }
  const parsed = UpdatePostSchema.safeParse(body);
  if (!parsed.success) {
    return error(parsed.error.issues.map((i) => i.message).join("; "), 422);
  }
  const { tags, ...fields } = parsed.data;

  // Auto-timestamp review + set completed semantics elsewhere; here just patch.
  if (Object.keys(fields).length > 0) {
    const { error: updateError } = await supabase
      .from("saved_posts")
      .update(fields)
      .eq("id", params.id)
      .eq("user_id", user.id);
    if (updateError) return error(updateError.message, 500);
  }

  if (tags) {
    await setPostTags(supabase, user.id, params.id, tags);
  }

  const { data: post } = await supabase
    .from("saved_posts")
    .select("*, category:categories(*), tags:post_tags(tag:tags(*))")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!post) return error("Not found", 404);

  const rawTags = (post.tags as Array<{ tag: unknown }> | undefined) ?? [];
  return json({ post: { ...post, tags: rawTags.map((t) => t.tag).filter(Boolean) } });
}

// DELETE /api/posts/:id — hard delete (cascades to sources, summaries, notes...).
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  // Clean up any storage objects for this post first.
  const { data: attachments } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("post_id", params.id)
    .eq("user_id", user.id);
  if (attachments && attachments.length) {
    await supabase.storage.from("post-uploads").remove(attachments.map((a) => a.storage_path));
  }

  const { error: delError } = await supabase
    .from("saved_posts")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);
  if (delError) return error(delError.message, 500);
  return json({ ok: true });
}
