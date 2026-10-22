import { requireUser, json, error } from "@/lib/api";
import { CreateCollectionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/collections — list with post counts.
export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  const { data, error: dbError } = await supabase
    .from("collections")
    .select("*, collection_posts(count)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (dbError) return error(dbError.message, 500);

  const collections = (data ?? []).map((c) => ({
    ...c,
    post_count: (c.collection_posts as Array<{ count: number }> | undefined)?.[0]?.count ?? 0,
  }));
  return json({ collections });
}

// POST /api/collections
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("Invalid JSON body");
  }
  const parsed = CreateCollectionSchema.safeParse(body);
  if (!parsed.success) {
    return error(parsed.error.issues.map((i) => i.message).join("; "), 422);
  }

  const { data, error: insertError } = await supabase
    .from("collections")
    .insert({ user_id: user.id, name: parsed.data.name, description: parsed.data.description ?? null })
    .select("*")
    .single();
  if (insertError) return error(insertError.message, 500);
  return json({ collection: data }, 201);
}
