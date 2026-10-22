import { requireUser, json, error } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET /api/categories — the user's categories (defaults + custom).
export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  const { data, error: dbError } = await supabase
    .from("categories")
    .select("*")
    .eq("user_id", user.id)
    .order("name", { ascending: true });
  if (dbError) return error(dbError.message, 500);
  return json({ categories: data ?? [] });
}
