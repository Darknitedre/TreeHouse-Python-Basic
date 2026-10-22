import { requireUser, json, error } from "@/lib/api";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BodySchema = z.object({ post_id: z.string().uuid() });

// POST /api/collections/:id/posts — add a post to the collection.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("post_id is required", 422);

  const { error: insertError } = await supabase.from("collection_posts").upsert({
    collection_id: params.id,
    post_id: parsed.data.post_id,
    user_id: user.id,
  });
  if (insertError) return error(insertError.message, 500);
  return json({ ok: true }, 201);
}

// DELETE /api/collections/:id/posts?post_id= — remove a post from the collection.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  const postId = new URL(req.url).searchParams.get("post_id");
  if (!postId) return error("post_id is required", 422);

  const { error: delError } = await supabase
    .from("collection_posts")
    .delete()
    .eq("collection_id", params.id)
    .eq("post_id", postId)
    .eq("user_id", user.id);
  if (delError) return error(delError.message, 500);
  return json({ ok: true });
}
