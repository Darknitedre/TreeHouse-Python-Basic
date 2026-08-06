import { requireUser, json, error } from "@/lib/api";
import { UpdateActionItemSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// PATCH /api/action-items/:id — update status/due/notes/links etc.
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
  const parsed = UpdateActionItemSchema.safeParse(body);
  if (!parsed.success) {
    return error(parsed.error.issues.map((i) => i.message).join("; "), 422);
  }
  const { post_ids, ...fields } = parsed.data;

  const update: Record<string, unknown> = { ...fields };
  // Maintain completed_at when status transitions.
  if (fields.status === "completed") {
    update.completed_at = new Date().toISOString();
  } else if (fields.status) {
    update.completed_at = null;
  }

  if (Object.keys(update).length) {
    const { error: updateError } = await supabase
      .from("action_items")
      .update(update)
      .eq("id", params.id)
      .eq("user_id", user.id);
    if (updateError) return error(updateError.message, 500);
  }

  // Reconcile many-to-many post links if provided.
  if (post_ids) {
    await supabase
      .from("action_item_posts")
      .delete()
      .eq("action_item_id", params.id)
      .eq("user_id", user.id);
    if (post_ids.length) {
      await supabase.from("action_item_posts").insert(
        post_ids.map((post_id) => ({
          action_item_id: params.id,
          post_id,
          user_id: user.id,
        })),
      );
    }
  }

  const { data: item } = await supabase
    .from("action_items")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!item) return error("Not found", 404);
  return json({ actionItem: item });
}

// DELETE /api/action-items/:id
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  const { error: delError } = await supabase
    .from("action_items")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);
  if (delError) return error(delError.message, 500);
  return json({ ok: true });
}
