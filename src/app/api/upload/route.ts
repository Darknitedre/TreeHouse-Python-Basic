import { requireUser, json, error, rateLimit } from "@/lib/api";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants";

export const dynamic = "force-dynamic";

// POST /api/upload — multipart form with a `file` field. Validates and stores a
// screenshot in the private per-user bucket; returns its storage path.
export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;

  if (!rateLimit(`upload:${user.id}`, 30, 60_000)) {
    return error("Too many uploads, slow down a moment.", 429);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return error("Expected multipart form data");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return error("Missing file");

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return error(`Unsupported file type: ${file.type || "unknown"}`, 415);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return error("File too large (max 8MB)", 413);
  }

  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("post-uploads")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return error(uploadError.message, 500);

  const { data: attachment } = await supabase
    .from("attachments")
    .insert({
      user_id: user.id,
      storage_path: path,
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select("id")
    .single();

  return json({ path, attachment_id: attachment?.id }, 201);
}
