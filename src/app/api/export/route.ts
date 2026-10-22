import { requireUser, error } from "@/lib/api";
import {
  postToMarkdown,
  postToText,
  actionItemsToCsv,
  postsToCsv,
} from "@/lib/export";
import type { SavedPost, ActionItem } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/export?type=post|posts|action-items|all&format=md|txt|csv|json&id=
export async function GET(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "all";
  const format = url.searchParams.get("format") ?? "json";
  const id = url.searchParams.get("id");

  const send = (body: string, contentType: string, filename: string) =>
    new Response(body, {
      headers: {
        "content-type": contentType,
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });

  if (type === "post") {
    if (!id) return error("id is required for a single post export", 422);
    const { data: post } = await supabase
      .from("saved_posts")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!post) return error("Not found", 404);
    const { data: items } = await supabase
      .from("action_items")
      .select("*")
      .eq("post_id", id)
      .eq("user_id", user.id);
    const p = post as SavedPost;
    const ai = (items ?? []) as ActionItem[];
    if (format === "txt") return send(postToText(p, ai), "text/plain", `post-${id}.txt`);
    if (format === "json")
      return send(JSON.stringify({ post: p, actionItems: ai }, null, 2), "application/json", `post-${id}.json`);
    return send(postToMarkdown(p, ai), "text/markdown", `post-${id}.md`);
  }

  if (type === "action-items") {
    const { data } = await supabase
      .from("action_items")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const items = (data ?? []) as ActionItem[];
    if (format === "json")
      return send(JSON.stringify(items, null, 2), "application/json", "action-items.json");
    return send(actionItemsToCsv(items), "text/csv", "action-items.csv");
  }

  if (type === "posts") {
    const { data } = await supabase
      .from("saved_posts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const posts = (data ?? []) as SavedPost[];
    if (format === "csv") return send(postsToCsv(posts), "text/csv", "posts.csv");
    if (format === "md")
      return send(posts.map((p) => postToMarkdown(p)).join("\n\n---\n\n"), "text/markdown", "posts.md");
    return send(JSON.stringify(posts, null, 2), "application/json", "posts.json");
  }

  // type === "all": full account export (JSON).
  const [posts, actionItems, collections, notes] = await Promise.all([
    supabase.from("saved_posts").select("*").eq("user_id", user.id),
    supabase.from("action_items").select("*").eq("user_id", user.id),
    supabase.from("collections").select("*, collection_posts(post_id)").eq("user_id", user.id),
    supabase.from("personal_notes").select("*").eq("user_id", user.id),
  ]);
  const payload = {
    exported_at: new Date().toISOString(),
    user_id: user.id,
    posts: posts.data ?? [],
    action_items: actionItems.data ?? [],
    collections: collections.data ?? [],
    notes: notes.data ?? [],
  };
  return send(JSON.stringify(payload, null, 2), "application/json", "social-action-vault-export.json");
}
