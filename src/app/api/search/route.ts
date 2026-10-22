import { requireUser, json, error } from "@/lib/api";
import { SearchSchema } from "@/lib/validation";
import { embed, toVectorLiteral } from "@/lib/ai/embeddings";

export const dynamic = "force-dynamic";

// GET /api/search?q=&mode=keyword|semantic|hybrid&limit=
// Full-text + semantic (pgvector) search across saved posts.
export async function GET(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  const url = new URL(req.url);
  const parsed = SearchSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return error("Invalid search params", 422);
  const { q, mode, limit } = parsed.data;

  const term = q.trim();
  if (!term) {
    // No query: return recent posts.
    const { data } = await supabase
      .from("saved_posts")
      .select("*, category:categories(*)")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .limit(limit);
    return json({ results: data ?? [] });
  }

  const scores = new Map<string, number>();

  // --- Keyword (full-text) ---
  if (mode === "keyword" || mode === "hybrid") {
    const { data } = await supabase
      .from("saved_posts")
      .select("id")
      .eq("user_id", user.id)
      .eq("archived", false)
      .textSearch("search_vector", term, { type: "websearch", config: "english" })
      .limit(limit * 2);
    (data ?? []).forEach((row, idx) => {
      // Rank-based score so earlier hits weigh more.
      scores.set(row.id, (scores.get(row.id) ?? 0) + (1 - idx / (limit * 2)) * 1.0);
    });
  }

  // --- Semantic (pgvector) ---
  if (mode === "semantic" || mode === "hybrid") {
    try {
      const vector = await embed(term);
      const { data } = await supabase.rpc("match_saved_posts", {
        p_user_id: user.id,
        query_embedding: toVectorLiteral(vector),
        match_count: limit * 2,
      });
      (data as Array<{ id: string; similarity: number }> | null)?.forEach((row) => {
        scores.set(row.id, (scores.get(row.id) ?? 0) + row.similarity * 1.0);
      });
    } catch {
      // Semantic optional; keyword results still returned.
    }
  }

  const rankedIds = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  if (rankedIds.length === 0) return json({ results: [] });

  const { data: posts } = await supabase
    .from("saved_posts")
    .select("*, category:categories(*)")
    .eq("user_id", user.id)
    .in("id", rankedIds);

  // Preserve ranking order.
  const order = new Map(rankedIds.map((id, i) => [id, i]));
  const results = (posts ?? []).sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
  );
  return json({ results });
}
