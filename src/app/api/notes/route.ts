import { requireUser, json, error } from "@/lib/api";
import { z } from "zod";

export const dynamic = "force-dynamic";

const NoteSchema = z.object({
  post_id: z.string().uuid(),
  body: z.string().max(10000),
});

// POST /api/notes — upsert the personal note for a post (one note per post here).
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  const parsed = NoteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("post_id and body are required", 422);
  const { post_id, body } = parsed.data;

  const { data: existing } = await supabase
    .from("personal_notes")
    .select("id")
    .eq("post_id", post_id)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { data } = await supabase
      .from("personal_notes")
      .update({ body })
      .eq("id", existing.id)
      .eq("user_id", user.id)
      .select("*")
      .single();
    return json({ note: data });
  }

  const { data, error: insertError } = await supabase
    .from("personal_notes")
    .insert({ user_id: user.id, post_id, body })
    .select("*")
    .single();
  if (insertError) return error(insertError.message, 500);
  return json({ note: data }, 201);
}
