import { requireUser, json, error } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// DELETE /api/account — permanently delete the account and ALL its data.
// Removes storage objects, then deletes the auth user, which cascades to every
// owned row via the users foreign keys.
export async function DELETE() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  // Remove uploaded files from storage first.
  const { data: attachments } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("user_id", user.id);
  const paths = (attachments ?? []).map((a) => a.storage_path);
  if (paths.length) {
    await supabase.storage.from("post-uploads").remove(paths);
  }

  try {
    const admin = createAdminClient();
    const { error: delError } = await admin.auth.admin.deleteUser(user.id);
    if (delError) return error(delError.message, 500);
  } catch (e) {
    return error(e instanceof Error ? e.message : "Account deletion failed", 500);
  }

  return json({ ok: true });
}
