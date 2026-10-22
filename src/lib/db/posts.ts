import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzeText, analyzeImage } from "../ai/process";
import { getModel } from "../ai/client";
import { embed, toVectorLiteral } from "../ai/embeddings";
import { fetchUrlMetadata } from "../ingest/url-metadata";
import type { PostAnalysis } from "../validation";
import type { SavedPost } from "../types";
import { slugify } from "../utils";
import { ALLOWED_IMAGE_TYPES } from "../constants";

/**
 * Find (or create) a category by name for a user, returning its id.
 */
export async function resolveCategoryId(
  supabase: SupabaseClient,
  userId: string,
  name: string | undefined,
): Promise<string | null> {
  if (!name) return null;
  const slug = slugify(name);
  if (!slug) return null;

  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("slug", slug)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created } = await supabase
    .from("categories")
    .insert({ user_id: userId, name, slug, is_default: false })
    .select("id")
    .single();
  return created?.id ?? null;
}

/**
 * Replace a post's tags with the given names (creating tags as needed).
 */
export async function setPostTags(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
  names: string[],
): Promise<void> {
  const unique = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  await supabase.from("post_tags").delete().eq("post_id", postId).eq("user_id", userId);
  if (unique.length === 0) return;

  const tagIds: string[] = [];
  for (const name of unique) {
    const slug = slugify(name);
    if (!slug) continue;
    const { data: existing } = await supabase
      .from("tags")
      .select("id")
      .eq("user_id", userId)
      .eq("slug", slug)
      .maybeSingle();
    let id = existing?.id;
    if (!id) {
      const { data: created } = await supabase
        .from("tags")
        .insert({ user_id: userId, name, slug })
        .select("id")
        .single();
      id = created?.id;
    }
    if (id) tagIds.push(id);
  }
  if (tagIds.length) {
    await supabase
      .from("post_tags")
      .insert(tagIds.map((tag_id) => ({ post_id: postId, tag_id, user_id: userId })));
  }
}

/**
 * Persist a validated AI analysis onto a saved post: update the post fields,
 * write a post_summaries history row, create action items, tags, and an
 * embedding for semantic search.
 */
export async function persistAnalysis(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
  analysis: PostAnalysis,
  extraCaption?: string,
): Promise<void> {
  const categoryId = await resolveCategoryId(supabase, userId, analysis.category);

  const update: Record<string, unknown> = {
    title: analysis.title || undefined,
    summary: analysis.summary,
    main_points: analysis.main_points,
    key_takeaway: analysis.key_takeaway,
    category_id: categoryId,
    content_type: analysis.content_type,
    priority: analysis.priority,
    sentiment: analysis.sentiment,
    project_area: analysis.project_area || null,
    processing_status: "completed",
    processing_error: null,
  };
  if (extraCaption) update.caption = extraCaption;

  await supabase.from("saved_posts").update(update).eq("id", postId).eq("user_id", userId);

  await supabase.from("post_summaries").insert({
    user_id: userId,
    post_id: postId,
    model: getModel(),
    summary: analysis.summary,
    main_points: analysis.main_points,
    key_takeaway: analysis.key_takeaway,
    raw_response: analysis as unknown as Record<string, unknown>,
  });

  // Fresh action items for this post: clear prior AI-generated links, re-create.
  await supabase.from("action_items").delete().eq("post_id", postId).eq("user_id", userId);
  for (const ai of analysis.action_items) {
    const { data: item } = await supabase
      .from("action_items")
      .insert({
        user_id: userId,
        post_id: postId,
        title: ai.title,
        description: ai.description || null,
        priority: ai.priority,
        estimated_effort: ai.estimated_effort || null,
        due_date: ai.suggested_due_date,
        status: "not_started",
      })
      .select("id")
      .single();
    if (item?.id) {
      await supabase
        .from("action_item_posts")
        .insert({ action_item_id: item.id, post_id: postId, user_id: userId });
    }
  }

  await setPostTags(supabase, userId, postId, analysis.tags);

  // Embedding for semantic search (best-effort).
  try {
    const embedText = [
      analysis.title,
      analysis.summary,
      analysis.key_takeaway,
      analysis.main_points.join(" "),
      analysis.tags.join(" "),
      extraCaption ?? "",
    ]
      .filter(Boolean)
      .join(" ");
    const vector = await embed(embedText);
    await supabase
      .from("saved_posts")
      .update({ embedding: toVectorLiteral(vector) })
      .eq("id", postId)
      .eq("user_id", userId);
  } catch {
    // Non-fatal: keyword search still works without an embedding.
  }
}

/**
 * Run the full processing pipeline for a post: gather content by source type,
 * analyze it, and persist. Sets processing_status appropriately. Always
 * resolves; failures are recorded on the row.
 */
export async function processPost(
  supabase: SupabaseClient,
  userId: string,
  post: SavedPost,
): Promise<{ status: "completed" | "failed"; error?: string }> {
  await supabase
    .from("saved_posts")
    .update({ processing_status: "processing" })
    .eq("id", post.id)
    .eq("user_id", userId);

  await supabase.from("processing_jobs").insert({
    user_id: userId,
    post_id: post.id,
    job_type: "analyze",
    status: "processing",
  });

  try {
    let content = post.caption ?? "";

    // Screenshot: download from storage and analyze via vision.
    if (post.source_type === "screenshot") {
      const path = await getAttachmentPath(supabase, post.id, userId);
      if (!path) throw new Error("No screenshot attachment found");
      const { base64, mediaType } = await downloadImage(supabase, path);
      const result = await analyzeImage({
        base64,
        mediaType,
        url: post.original_url ?? undefined,
        author: post.author ?? undefined,
      });
      if (!result.ok || !result.analysis) {
        return await fail(supabase, userId, post.id, result.error ?? "Image analysis failed");
      }
      await persistAnalysis(
        supabase,
        userId,
        post.id,
        result.analysis,
        result.analysis.extracted_text,
      );
      await finishJob(supabase, post.id, userId, "completed");
      return { status: "completed" };
    }

    // URL: fetch public metadata, then analyze the text we have.
    if (post.source_type === "url" && post.original_url) {
      const meta = await fetchUrlMetadata(post.original_url);
      const metaUpdate: Record<string, unknown> = { platform: meta.platform };
      if (meta.title) metaUpdate.title = meta.title;
      if (meta.author) metaUpdate.author = meta.author;
      if (meta.thumbnail) metaUpdate.thumbnail_url = meta.thumbnail;
      if (meta.publishedAt && !isNaN(Date.parse(meta.publishedAt)))
        metaUpdate.published_at = new Date(meta.publishedAt).toISOString();
      const caption = [meta.title, meta.description].filter(Boolean).join("\n\n");
      if (caption) metaUpdate.caption = caption;
      await supabase.from("saved_posts").update(metaUpdate).eq("id", post.id).eq("user_id", userId);

      content = [meta.title, meta.description].filter(Boolean).join("\n\n") || post.original_url;
      const result = await analyzeText({
        platform: meta.platform,
        url: post.original_url,
        author: meta.author ?? post.author ?? undefined,
        title: meta.title ?? post.title ?? undefined,
        content,
      });
      if (!result.ok || !result.analysis) {
        return await fail(supabase, userId, post.id, result.error ?? "Analysis failed");
      }
      await persistAnalysis(supabase, userId, post.id, result.analysis);
      await finishJob(supabase, post.id, userId, "completed");
      return { status: "completed" };
    }

    // text / transcript / note
    if (!content.trim()) {
      return await fail(supabase, userId, post.id, "No content to analyze");
    }
    const result = await analyzeText({
      platform: post.platform,
      author: post.author ?? undefined,
      title: post.title ?? undefined,
      content,
    });
    if (!result.ok || !result.analysis) {
      return await fail(supabase, userId, post.id, result.error ?? "Analysis failed");
    }
    await persistAnalysis(supabase, userId, post.id, result.analysis);
    await finishJob(supabase, post.id, userId, "completed");
    return { status: "completed" };
  } catch (err) {
    return await fail(supabase, userId, post.id, err instanceof Error ? err.message : "Processing error");
  }
}

async function getAttachmentPath(
  supabase: SupabaseClient,
  postId: string,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.storage_path ?? null;
}

async function downloadImage(
  supabase: SupabaseClient,
  path: string,
): Promise<{ base64: string; mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif" }> {
  const { data, error } = await supabase.storage.from("post-uploads").download(path);
  if (error || !data) throw new Error("Could not download screenshot");
  const type = data.type && ALLOWED_IMAGE_TYPES.includes(data.type) ? data.type : "image/png";
  const buf = Buffer.from(await data.arrayBuffer());
  return {
    base64: buf.toString("base64"),
    mediaType: type as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
  };
}

async function fail(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
  error: string,
): Promise<{ status: "failed"; error: string }> {
  await supabase
    .from("saved_posts")
    .update({ processing_status: "failed", processing_error: error })
    .eq("id", postId)
    .eq("user_id", userId);
  await finishJob(supabase, postId, userId, "failed", error);
  return { status: "failed", error };
}

async function finishJob(
  supabase: SupabaseClient,
  postId: string,
  userId: string,
  status: "completed" | "failed",
  error?: string,
): Promise<void> {
  await supabase
    .from("processing_jobs")
    .update({ status, error: error ?? null, finished_at: new Date().toISOString() })
    .eq("post_id", postId)
    .eq("user_id", userId)
    .eq("status", "processing");
}
