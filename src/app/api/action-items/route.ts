import { requireUser, json, error } from "@/lib/api";
import { CreateActionItemSchema } from "@/lib/validation";
import { PRIORITY_RANK } from "@/lib/constants";
import { toDateOnly, startOfWeek } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET /api/action-items?status=&priority=&category_id=&due=overdue|today|week&sort=importance|due
export async function GET(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;
  const url = new URL(req.url);

  let query = supabase
    .from("action_items")
    .select("*, post:saved_posts(id,title,category_id)")
    .eq("user_id", user.id);

  const status = url.searchParams.get("status");
  if (status) query = query.eq("status", status);
  const priority = url.searchParams.get("priority");
  if (priority) query = query.eq("priority", priority);

  const due = url.searchParams.get("due");
  const today = toDateOnly(new Date());
  if (due === "overdue") {
    query = query.lt("due_date", today).not("status", "in", "(completed,canceled)");
  } else if (due === "today") {
    query = query.eq("due_date", today);
  } else if (due === "week") {
    const end = new Date(startOfWeek());
    end.setDate(end.getDate() + 6);
    query = query.gte("due_date", toDateOnly(startOfWeek())).lte("due_date", toDateOnly(end));
  }

  const { data, error: dbError } = await query;
  if (dbError) return error(dbError.message, 500);

  let items = data ?? [];

  // Optional category filter (via linked post's category).
  const categoryId = url.searchParams.get("category_id");
  if (categoryId) {
    items = items.filter(
      (i) => (i.post as { category_id?: string } | null)?.category_id === categoryId,
    );
  }

  const sort = url.searchParams.get("sort") ?? "importance";
  if (sort === "importance") {
    items.sort(
      (a, b) =>
        PRIORITY_RANK[a.priority as keyof typeof PRIORITY_RANK] -
          PRIORITY_RANK[b.priority as keyof typeof PRIORITY_RANK] ||
        dueSort(a.due_date, b.due_date),
    );
  } else {
    items.sort((a, b) => dueSort(a.due_date, b.due_date));
  }

  return json({ actionItems: items });
}

// POST /api/action-items — create a manual action item (optionally linked to posts).
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
  const parsed = CreateActionItemSchema.safeParse(body);
  if (!parsed.success) {
    return error(parsed.error.issues.map((i) => i.message).join("; "), 422);
  }
  const input = parsed.data;
  const postIds = new Set(input.post_ids ?? []);
  if (input.post_id) postIds.add(input.post_id);
  const primary = input.post_id ?? input.post_ids?.[0] ?? null;

  const { data: item, error: insertError } = await supabase
    .from("action_items")
    .insert({
      user_id: user.id,
      post_id: primary,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority,
      estimated_effort: input.estimated_effort ?? null,
      due_date: input.due_date ?? null,
      status: input.status,
      completed_at: input.status === "completed" ? new Date().toISOString() : null,
    })
    .select("*")
    .single();
  if (insertError || !item) return error(insertError?.message ?? "Insert failed", 500);

  if (postIds.size) {
    await supabase.from("action_item_posts").insert(
      Array.from(postIds).map((post_id) => ({
        action_item_id: item.id,
        post_id,
        user_id: user.id,
      })),
    );
  }

  return json({ actionItem: item }, 201);
}

function dueSort(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}
