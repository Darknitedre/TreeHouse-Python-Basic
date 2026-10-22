import { requireUser, json, error } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// GET /api/collections/:id — collection + its posts.
export async function GET(_req: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  const { data: collection } = await supabase
    .from("collections")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!collection) return error("Not found", 404);

  const { data: links } = await supabase
    .from("collection_posts")
    .select("post:saved_posts(*, category:categories(*))")
    .eq("collection_id", params.id)
    .eq("user_id", user.id)
    .order("added_at", { ascending: false });

  const posts = (links ?? []).map((l) => l.post).filter(Boolean);
  return json({ collection, posts });
}

// DELETE /api/collections/:id
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  const { error: delError } = await supabase
    .from("collections")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);
  if (delError) return error(delError.message, 500);
  return json({ ok: true });
}
