import { requireUser, json, error, rateLimit } from "@/lib/api";
import { CreatePostSchema } from "@/lib/validation";
import { processPost } from "@/lib/db/posts";
import { detectPlatform } from "@/lib/utils";
import type { SavedPost } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/posts?archived=&category_id=&reviewed=&priority=&limit=&offset=
export async function GET(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  let query = supabase
    .from("saved_posts")
    .select("*, category:categories(*), tags:post_tags(tag:tags(*))", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const archived = url.searchParams.get("archived");
  query = query.eq("archived", archived === "true");
  const categoryId = url.searchParams.get("category_id");
  if (categoryId) query = query.eq("category_id", categoryId);
  const reviewed = url.searchParams.get("reviewed");
  if (reviewed === "true" || reviewed === "false") query = query.eq("reviewed", reviewed === "true");
  const priority = url.searchParams.get("priority");
  if (priority) query = query.eq("priority", priority);

  const { data, count, error: dbError } = await query;
  if (dbError) return error(dbError.message, 500);

  const posts = (data ?? []).map(flattenTags);
  return json({ posts, count });
}

// POST /api/posts — create a post and run the AI pipeline synchronously.
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  if (!rateLimit(`create:${user.id}`, 20, 60_000)) {
    return error("Too many requests, slow down a moment.", 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("Invalid JSON body");
  }
  const parsed = CreatePostSchema.safeParse(body);
  if (!parsed.success) {
    return error(parsed.error.issues.map((i) => i.message).join("; "), 422);
  }
  const input = parsed.data;

  const platform =
    input.platform ?? (input.original_url ? detectPlatform(input.original_url) : "other");
  const captionSeed =
    input.source_type === "text" ||
    input.source_type === "transcript" ||
    input.source_type === "note"
      ? input.text
      : null;

  const { data: created, error: insertError } = await supabase
    .from("saved_posts")
    .insert({
      user_id: user.id,
      source_type: input.source_type,
      original_url: input.original_url ?? null,
      platform,
      author: input.author ?? null,
      title: input.title ?? null,
      caption: captionSeed,
      processing_status: "pending",
    })
    .select("*")
    .single();

  if (insertError || !created) {
    return error(insertError?.message ?? "Could not create post", 500);
  }

  // Record provenance.
  await supabase.from("post_sources").insert({
    user_id: user.id,
    post_id: created.id,
    source_type: input.source_type,
    raw_url: input.original_url ?? null,
    raw_text: input.text ?? null,
  });

  // Link an already-uploaded screenshot attachment to this post.
  if (input.source_type === "screenshot" && input.attachment_path) {
    await supabase
      .from("attachments")
      .update({ post_id: created.id })
      .eq("user_id", user.id)
      .eq("storage_path", input.attachment_path);
  }

  const result = await processPost(supabase, user.id, created as SavedPost);

  const { data: finalPost } = await supabase
    .from("saved_posts")
    .select("*, category:categories(*), tags:post_tags(tag:tags(*))")
    .eq("id", created.id)
    .single();

  return json(
    { post: finalPost ? flattenTags(finalPost) : created, processing: result },
    201,
  );
}

// Flatten the nested post_tags(tag:tags(*)) shape into a plain tags array.
function flattenTags(row: Record<string, unknown>) {
  const rawTags = (row.tags as Array<{ tag: unknown }> | undefined) ?? [];
  return { ...row, tags: rawTags.map((t) => t.tag).filter(Boolean) };
}
