import { requireUser, json, error } from "@/lib/api";
import { z } from "zod";

export const dynamic = "force-dynamic";

const PrefsSchema = z.object({
  due_items: z.boolean().optional(),
  overdue_items: z.boolean().optional(),
  weekly_review: z.boolean().optional(),
  unreviewed_posts: z.boolean().optional(),
  unacted_high_priority: z.boolean().optional(),
});

// GET /api/settings — notification preferences.
export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  const { data } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  return json({ preferences: data });
}

// PATCH /api/settings — update notification preferences.
export async function PATCH(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  const parsed = PrefsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("Invalid preferences", 422);

  const { data, error: upErr } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: user.id, ...parsed.data }, { onConflict: "user_id" })
    .select("*")
    .single();
  if (upErr) return error(upErr.message, 500);
  return json({ preferences: data });
}
